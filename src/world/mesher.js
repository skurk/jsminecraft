import * as THREE from 'three';
import { BLOCKS, Block, blockBox, fluidGroup, fluidHeight, isCross, isCutout, isFullBlock } from "./blocks.js";
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
/** Offsets of the four upright planes that make up a crop, as in the original model. */
const CROSS_PLANES = [
    { axis: 'x', offset: 0.25 },
    { axis: 'x', offset: 0.75 },
    { axis: 'z', offset: 0.25 },
    { axis: 'z', offset: 0.75 },
];
const CROSS_LIGHT = 0.95;
/**
 * Averages the surrounding fluid heights at one corner. Sharing the average
 * between neighbours is what keeps adjoining surfaces continuous.
 */
function cornerHeight(getBlock, wx, y, wz, cx, cz, group) {
    let total = 0;
    let count = 0;
    for (let dz = cz - 1; dz <= cz; dz++) {
        for (let dx = cx - 1; dx <= cx; dx++) {
            if (fluidGroup(getBlock(wx + dx, y + 1, wz + dz)) === group)
                return 1;
            const id = getBlock(wx + dx, y, wz + dz);
            if (fluidGroup(id) === group) {
                total += fluidHeight(id);
                count++;
            }
        }
    }
    return count > 0 ? total / count : fluidHeight(getBlock(wx, y, wz));
}
function fluidCorners(getBlock, wx, y, wz, group) {
    return [
        cornerHeight(getBlock, wx, y, wz, 0, 0, group),
        cornerHeight(getBlock, wx, y, wz, 1, 0, group),
        cornerHeight(getBlock, wx, y, wz, 0, 1, group),
        cornerHeight(getBlock, wx, y, wz, 1, 1, group),
    ];
}
class MeshBuffer {
    positions = [];
    normals = [];
    uvs = [];
    colors = [];
    lights = [];
    indices = [];
    addFace(face, x, y, z, tile, box, lightAt, corners) {
        const base = this.positions.length / 3;
        for (const corner of face.corners) {
            const px = x + box[0] + corner.pos[0] * (box[3] - box[0]);
            const pz = z + box[2] + corner.pos[2] * (box[5] - box[2]);
            // A fluid's top vertices ride on their own corner height, which is what
            // turns a flat slab into a wedge.
            const py = corners && corner.pos[1] === 1
                ? y + corners[(corner.pos[2] > 0.5 ? 2 : 0) + (corner.pos[0] > 0.5 ? 1 : 0)]
                : y + box[1] + corner.pos[1] * (box[4] - box[1]);
            this.positions.push(px, py, pz);
            this.normals.push(face.dir[0], face.dir[1], face.dir[2]);
            const [u, v] = tileUV(tile, corner.uv[0], corner.uv[1]);
            this.uvs.push(u, v);
            this.colors.push(face.light, face.light, face.light);
            this.lights.push(lightAt(px, py, pz));
        }
        this.indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
    }
    /** Upright planes for crops; the material draws both sides so winding is free. */
    addCross(x, y, z, tile, lightAt) {
        for (const { axis, offset } of CROSS_PLANES) {
            const base = this.positions.length / 3;
            for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
                const px = axis === 'x' ? x + offset : x + u;
                const py = y + v;
                const pz = axis === 'x' ? z + u : z + offset;
                this.positions.push(px, py, pz);
                this.normals.push(axis === 'x' ? 1 : 0, 0, axis === 'x' ? 0 : 1);
                const [tu, tv] = tileUV(tile, u, v);
                this.uvs.push(tu, tv);
                this.colors.push(CROSS_LIGHT, CROSS_LIGHT, CROSS_LIGHT);
                this.lights.push(lightAt(px, py, pz));
            }
            this.indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
        }
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
    const cutout = new MeshBuffer();
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
                const target = group === 2 ? lava : group === 1 ? water : isCutout(id) ? cutout : solid;
                const box = blockBox(id);
                if (isCross(id)) {
                    target.addCross(x, y, z, def.top, lightAt);
                    continue;
                }
                // Submerged fluid fills its voxel, so only the surface needs corners.
                const corners = group !== 0 && fluidGroup(getBlock(originX + x, y + 1, originZ + z)) !== group
                    ? fluidCorners(getBlock, originX + x, y, originZ + z, group)
                    : null;
                for (const face of FACES) {
                    const neighbor = getBlock(originX + x + face.dir[0], y + face.dir[1], originZ + z + face.dir[2]);
                    const neighborGroup = fluidGroup(neighbor);
                    if (neighbor !== Block.Air && isFullBlock(neighbor) &&
                        !(neighborGroup !== 0 && neighborGroup !== group))
                        continue;
                    const tile = face.dir[1] === 1 ? def.top : face.dir[1] === -1 ? def.bottom : def.side;
                    target.addFace(face, x, y, z, tile, box, lightAt, corners);
                }
            }
        }
    }
    return { solid: solid.toGeometry(), cutout: cutout.toGeometry(), water: water.toGeometry(), lava: lava.toGeometry() };
}
