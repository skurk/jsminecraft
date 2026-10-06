import * as THREE from 'three';
import { BLOCKS, Block, blockBox, fluidGroup, isFullBlock } from "./blocks.js";
import { CHUNK_HEIGHT, CHUNK_SIZE } from "./chunk.js";
import { tileUVBounds } from "./textures.js";
/** How far a torch casts light, in blocks. */
export const TORCH_RANGE = 9;
const FACES = [
    {
        dir: [-1, 0, 0],
        light: 0.72,
        corners: [
            { pos: [0, 1, 0], uv: [0, 1] },
            { pos: [0, 0, 0], uv: [0, 0] },
            { pos: [0, 1, 1], uv: [1, 1] },
            { pos: [0, 0, 1], uv: [1, 0] },
        ],
    },
    {
        dir: [1, 0, 0],
        light: 0.72,
        corners: [
            { pos: [1, 1, 1], uv: [0, 1] },
            { pos: [1, 0, 1], uv: [0, 0] },
            { pos: [1, 1, 0], uv: [1, 1] },
            { pos: [1, 0, 0], uv: [1, 0] },
        ],
    },
    {
        dir: [0, -1, 0],
        light: 0.5,
        corners: [
            { pos: [1, 0, 1], uv: [1, 0] },
            { pos: [0, 0, 1], uv: [0, 0] },
            { pos: [1, 0, 0], uv: [1, 1] },
            { pos: [0, 0, 0], uv: [0, 1] },
        ],
    },
    {
        dir: [0, 1, 0],
        light: 1,
        corners: [
            { pos: [0, 1, 1], uv: [1, 1] },
            { pos: [1, 1, 1], uv: [0, 1] },
            { pos: [0, 1, 0], uv: [1, 0] },
            { pos: [1, 1, 0], uv: [0, 0] },
        ],
    },
    {
        dir: [0, 0, -1],
        light: 0.86,
        corners: [
            { pos: [1, 0, 0], uv: [0, 0] },
            { pos: [0, 0, 0], uv: [1, 0] },
            { pos: [1, 1, 0], uv: [0, 1] },
            { pos: [0, 1, 0], uv: [1, 1] },
        ],
    },
    {
        dir: [0, 0, 1],
        light: 0.86,
        corners: [
            { pos: [0, 0, 1], uv: [0, 0] },
            { pos: [1, 0, 1], uv: [1, 0] },
            { pos: [0, 1, 1], uv: [0, 1] },
            { pos: [1, 1, 1], uv: [1, 1] },
        ],
    },
];
function tileUV(tile, u, v) {
    const { u0, u1, v0, v1 } = tileUVBounds(tile);
    return [u0 + (u1 - u0) * u, v0 + (v1 - v0) * v];
}
class MeshBuffer {
    positions = [];
    normals = [];
    uvs = [];
    colors = [];
    lights = [];
    indices = [];
    addFace(face, x, y, z, tile, box, lightAt) {
        const base = this.positions.length / 3;
        for (const corner of face.corners) {
            const px = x + box[0] + corner.pos[0] * (box[3] - box[0]);
            const py = y + box[1] + corner.pos[1] * (box[4] - box[1]);
            const pz = z + box[2] + corner.pos[2] * (box[5] - box[2]);
            this.positions.push(px, py, pz);
            this.normals.push(face.dir[0], face.dir[1], face.dir[2]);
            const [u, v] = tileUV(tile, corner.uv[0], corner.uv[1]);
            this.uvs.push(u, v);
            this.colors.push(face.light, face.light, face.light);
            this.lights.push(lightAt(px, py, pz));
        }
        this.indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
    }
    toGeometry() {
        if (this.indices.length === 0)
            return null;
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
        geometry.setAttribute('blockLight', new THREE.Float32BufferAttribute(this.lights, 1));
        geometry.setIndex(this.indices);
        geometry.computeBoundingSphere();
        return geometry;
    }
}
export function buildChunkGeometry(chunk, getBlock, torches = []) {
    const solid = new MeshBuffer();
    const water = new MeshBuffer();
    const lava = new MeshBuffer();
    const originX = chunk.cx * CHUNK_SIZE;
    const originZ = chunk.cz * CHUNK_SIZE;
    // Vertex positions are chunk-local, so shift the torches to match once up front.
    const local = torches.map((t) => [t.x + 0.5 - originX, t.y + 0.35, t.z + 0.5 - originZ]);
    const lightAt = (x, y, z) => {
        let light = 0;
        for (const [tx, ty, tz] of local) {
            const distance = Math.hypot(x - tx, y - ty, z - tz);
            if (distance >= TORCH_RANGE)
                continue;
            const falloff = 1 - distance / TORCH_RANGE;
            light = Math.max(light, falloff * falloff);
        }
        return light;
    };
    for (let y = 0; y < CHUNK_HEIGHT; y++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
            for (let x = 0; x < CHUNK_SIZE; x++) {
                const id = chunk.get(x, y, z);
                if (id === Block.Air)
                    continue;
                const def = BLOCKS[id];
                const group = fluidGroup(id);
                const target = group === 2 ? lava : group === 1 ? water : solid;
                const box = blockBox(id);
                for (const face of FACES) {
                    const neighbor = getBlock(originX + x + face.dir[0], y + face.dir[1], originZ + z + face.dir[2]);
                    const neighborGroup = fluidGroup(neighbor);
                    if (neighbor !== Block.Air && isFullBlock(neighbor) &&
                        !(neighborGroup !== 0 && neighborGroup !== group))
                        continue;
                    const tile = face.dir[1] === 1 ? def.top : face.dir[1] === -1 ? def.bottom : def.side;
                    target.addFace(face, x, y, z, tile, box, lightAt);
                }
            }
        }
    }
    return { solid: solid.toGeometry(), water: water.toGeometry(), lava: lava.toGeometry() };
}
