import * as THREE from 'three';
import { Block, MAX_LAVA_SPREAD, MAX_WATER_SPREAD, hasGravity, isLava, isLiquid, isSolid, isWater, lavaFlowId, lavaLevel, waterFlowId, waterLevel, } from "./blocks.js";
import { CHUNK_HEIGHT, CHUNK_SIZE, Chunk, chunkKey } from "./chunk.js";
import { buildChunkGeometry, TORCH_RANGE } from "./mesher.js";
import { generateChunk } from "./terrain.js";
import { atlasTexture } from "./textures.js";
const MAX_BUILDS_PER_FRAME = 3;
// Physics ticks between fluid steps. The Overworld spec is 5 game ticks per
// block for water and 30 for lava, against this game's 0.08s physics tick.
const WATER_TICKS = 3;
const LAVA_TICKS = 19;
const HORIZONTAL = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
];
const NEIGHBORS = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
];
export class World {
    scene;
    chunks = new Map();
    renderDistance;
    solidMaterial;
    waterMaterial;
    lavaMaterial;
    pendingUpdates = new Set();
    tickCount = 0;
    torches = new Map();
    daylightUniform = { value: 1 };
    constructor(scene, renderDistance = 6) {
        this.scene = scene;
        this.renderDistance = renderDistance;
        const map = atlasTexture();
        this.solidMaterial = new THREE.MeshBasicMaterial({ map, vertexColors: true });
        // Block light has to survive the day/night tint, so it is mixed in the shader
        // rather than folded into material.color.
        this.solidMaterial.onBeforeCompile = (shader) => {
            shader.uniforms.uDaylight = this.daylightUniform;
            shader.vertexShader = `attribute float blockLight;\nuniform float uDaylight;\n${shader.vertexShader}`.replace('#include <color_vertex>', '#include <color_vertex>\n\tvColor.rgb *= max(uDaylight, blockLight);');
        };
        this.waterMaterial = new THREE.MeshBasicMaterial({
            map,
            vertexColors: true,
            transparent: true,
            opacity: 0.72,
            depthWrite: false,
            side: THREE.DoubleSide,
        });
        // Lava is its own material so it keeps glowing after dark.
        this.lavaMaterial = new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide });
    }
    getChunk(cx, cz, create = false) {
        const key = chunkKey(cx, cz);
        let chunk = this.chunks.get(key);
        if (!chunk && create) {
            chunk = new Chunk(cx, cz);
            generateChunk(chunk);
            this.chunks.set(key, chunk);
        }
        return chunk;
    }
    getBlock(x, y, z) {
        if (y < 0)
            return Block.Bedrock;
        if (y >= CHUNK_HEIGHT)
            return Block.Air;
        const cx = Math.floor(x / CHUNK_SIZE);
        const cz = Math.floor(z / CHUNK_SIZE);
        const chunk = this.getChunk(cx, cz, true);
        if (!chunk)
            return Block.Air;
        return chunk.get(x - cx * CHUNK_SIZE, y, z - cz * CHUNK_SIZE);
    }
    setBlock(x, y, z, id) {
        if (y < 1 || y >= CHUNK_HEIGHT)
            return;
        const cx = Math.floor(x / CHUNK_SIZE);
        const cz = Math.floor(z / CHUNK_SIZE);
        const chunk = this.getChunk(cx, cz, true);
        if (!chunk)
            return;
        const lx = x - cx * CHUNK_SIZE;
        const lz = z - cz * CHUNK_SIZE;
        const previous = chunk.get(lx, y, lz);
        if (previous === id)
            return;
        chunk.set(lx, y, lz, id);
        chunk.dirty = true;
        if (previous === Block.Torch || id === Block.Torch) {
            const key = `${x},${y},${z}`;
            if (id === Block.Torch)
                this.torches.set(key, { x: x + 0.5, y: y + 0.35, z: z + 0.5 });
            else
                this.torches.delete(key);
            this.markLightDirty(x, z);
        }
        // Edits on a border change the neighbouring chunk's visible faces too.
        if (lx === 0)
            this.markDirty(cx - 1, cz);
        if (lx === CHUNK_SIZE - 1)
            this.markDirty(cx + 1, cz);
        if (lz === 0)
            this.markDirty(cx, cz - 1);
        if (lz === CHUNK_SIZE - 1)
            this.markDirty(cx, cz + 1);
        this.scheduleUpdate(x, y, z);
        this.scheduleUpdate(x - 1, y, z);
        this.scheduleUpdate(x + 1, y, z);
        this.scheduleUpdate(x, y - 1, z);
        this.scheduleUpdate(x, y + 1, z);
        this.scheduleUpdate(x, y, z - 1);
        this.scheduleUpdate(x, y, z + 1);
    }
    /** Steps queued block updates by one voxel; call at a fixed rate. */
    tickPhysics() {
        this.tickCount++;
        if (this.pendingUpdates.size === 0)
            return;
        const waterDue = this.tickCount % WATER_TICKS === 0;
        const lavaDue = this.tickCount % LAVA_TICKS === 0;
        const batch = this.pendingUpdates;
        this.pendingUpdates = new Set();
        const positions = [];
        for (const key of batch) {
            const [x, y, z] = key.split(',').map(Number);
            positions.push([x, y, z]);
        }
        // Lowest first, so a settling column collapses from the bottom up.
        positions.sort((a, b) => a[1] - b[1]);
        for (const [x, y, z] of positions) {
            const id = this.getBlock(x, y, z);
            if (hasGravity(id)) {
                const below = this.getBlock(x, y - 1, z);
                if (below !== Block.Air && !isLiquid(below))
                    continue;
                this.setBlock(x, y, z, Block.Air);
                this.setBlock(x, y - 1, z, id);
                continue;
            }
            // Fluids that are not due yet stay queued so they step on their own cadence.
            if (isWater(id)) {
                if (waterDue)
                    this.flowWater(x, y, z, id);
                else
                    this.pendingUpdates.add(`${x},${y},${z}`);
            }
            else if (isLava(id)) {
                if (lavaDue)
                    this.flowLava(x, y, z, id);
                else
                    this.pendingUpdates.add(`${x},${y},${z}`);
            }
        }
    }
    flowWater(x, y, z, id) {
        const level = waterLevel(id);
        if (level > 0 && !this.waterSupplied(x, y, z, level)) {
            this.setBlock(x, y, z, Block.Air);
            return;
        }
        this.quenchLava(x, y, z);
        // Falling water resets the spread, so a waterfall pools fully at the bottom.
        if (this.getBlock(x, y - 1, z) === Block.Air) {
            this.setBlock(x, y - 1, z, waterFlowId(1));
            return;
        }
        if (level >= MAX_WATER_SPREAD)
            return;
        const next = waterFlowId(level + 1);
        for (const [dx, dz] of HORIZONTAL) {
            if (this.getBlock(x + dx, y, z + dz) === Block.Air) {
                this.setBlock(x + dx, y, z + dz, next);
            }
        }
    }
    /** A flow survives only while fed from above or by shallower water beside it. */
    waterSupplied(x, y, z, level) {
        if (isWater(this.getBlock(x, y + 1, z)))
            return true;
        for (const [dx, dz] of HORIZONTAL) {
            const neighbor = this.getBlock(x + dx, y, z + dz);
            if (isWater(neighbor) && waterLevel(neighbor) < level)
                return true;
        }
        return false;
    }
    flowLava(x, y, z, id) {
        // Lava meeting water sets solid, which is what stops flows underground.
        if (this.touchesWater(x, y, z)) {
            this.setBlock(x, y, z, Block.Cobblestone);
            return;
        }
        const level = lavaLevel(id);
        if (level > 0 && !this.lavaSupplied(x, y, z, level)) {
            this.setBlock(x, y, z, Block.Air);
            return;
        }
        if (this.getBlock(x, y - 1, z) === Block.Air) {
            this.setBlock(x, y - 1, z, lavaFlowId(1));
            return;
        }
        if (level >= MAX_LAVA_SPREAD)
            return;
        const next = lavaFlowId(level + 1);
        for (const [dx, dz] of HORIZONTAL) {
            if (this.getBlock(x + dx, y, z + dz) === Block.Air) {
                this.setBlock(x + dx, y, z + dz, next);
            }
        }
    }
    lavaSupplied(x, y, z, level) {
        if (isLava(this.getBlock(x, y + 1, z)))
            return true;
        for (const [dx, dz] of HORIZONTAL) {
            const neighbor = this.getBlock(x + dx, y, z + dz);
            if (isLava(neighbor) && lavaLevel(neighbor) < level)
                return true;
        }
        return false;
    }
    touchesWater(x, y, z) {
        for (const [dx, dy, dz] of NEIGHBORS) {
            if (isWater(this.getBlock(x + dx, y + dy, z + dz)))
                return true;
        }
        return false;
    }
    quenchLava(x, y, z) {
        for (const [dx, dy, dz] of NEIGHBORS) {
            if (isLava(this.getBlock(x + dx, y + dy, z + dz))) {
                this.setBlock(x + dx, y + dy, z + dz, Block.Cobblestone);
            }
        }
    }
    isSolidAt(x, y, z) {
        return isSolid(this.getBlock(x, y, z));
    }
    isLiquidAt(x, y, z) {
        return isLiquid(this.getBlock(x, y, z));
    }
    isWaterAt(x, y, z) {
        return isWater(this.getBlock(x, y, z));
    }
    isLavaAt(x, y, z) {
        return isLava(this.getBlock(x, y, z));
    }
    /** True when nothing blocks the column above, i.e. the spot can see the sky. */
    isSkyExposed(x, y, z) {
        for (let yy = y + 1; yy < CHUNK_HEIGHT; yy++) {
            if (this.getBlock(x, yy, z) !== Block.Air)
                return false;
        }
        return true;
    }
    /** Tints terrain to follow the day/night cycle. */
    setDaylight(brightness) {
        this.daylightUniform.value = brightness;
        this.waterMaterial.color.setScalar(brightness);
    }
    /** Strongest torch light reaching a point, 0 when unlit. */
    torchLightAt(x, y, z) {
        let light = 0;
        for (const torch of this.torches.values()) {
            const distance = Math.hypot(x - torch.x, y - torch.y, z - torch.z);
            if (distance < TORCH_RANGE)
                light = Math.max(light, 1 - distance / TORCH_RANGE);
        }
        return light;
    }
    torchesNear(cx, cz) {
        const minX = cx * CHUNK_SIZE - TORCH_RANGE;
        const maxX = (cx + 1) * CHUNK_SIZE + TORCH_RANGE;
        const minZ = cz * CHUNK_SIZE - TORCH_RANGE;
        const maxZ = (cz + 1) * CHUNK_SIZE + TORCH_RANGE;
        const near = [];
        for (const torch of this.torches.values()) {
            if (torch.x >= minX && torch.x <= maxX && torch.z >= minZ && torch.z <= maxZ)
                near.push(torch);
        }
        return near;
    }
    /** Re-meshes every chunk a torch at this spot could reach. */
    markLightDirty(x, z) {
        const minCx = Math.floor((x - TORCH_RANGE) / CHUNK_SIZE);
        const maxCx = Math.floor((x + TORCH_RANGE) / CHUNK_SIZE);
        const minCz = Math.floor((z - TORCH_RANGE) / CHUNK_SIZE);
        const maxCz = Math.floor((z + TORCH_RANGE) / CHUNK_SIZE);
        for (let cx = minCx; cx <= maxCx; cx++)
            for (let cz = minCz; cz <= maxCz; cz++)
                this.markDirty(cx, cz);
    }
    /** Streams chunks in/out around `center` and rebuilds a few dirty meshes. */
    update(center) {
        const pcx = Math.floor(center.x / CHUNK_SIZE);
        const pcz = Math.floor(center.z / CHUNK_SIZE);
        const r = this.renderDistance;
        for (let dz = -r; dz <= r; dz++) {
            for (let dx = -r; dx <= r; dx++) {
                if (dx * dx + dz * dz > r * r)
                    continue;
                this.getChunk(pcx + dx, pcz + dz, true);
            }
        }
        const pending = [];
        for (const chunk of this.chunks.values()) {
            const dx = chunk.cx - pcx;
            const dz = chunk.cz - pcz;
            const distSq = dx * dx + dz * dz;
            if (distSq > (r + 2) * (r + 2)) {
                chunk.dispose(this.scene);
                this.chunks.delete(chunkKey(chunk.cx, chunk.cz));
                this.forgetTorches(chunk.cx, chunk.cz);
                continue;
            }
            if (chunk.dirty && distSq <= r * r)
                pending.push(chunk);
        }
        pending.sort((a, b) => {
            const da = (a.cx - pcx) ** 2 + (a.cz - pcz) ** 2;
            const db = (b.cx - pcx) ** 2 + (b.cz - pcz) ** 2;
            return da - db;
        });
        for (let i = 0; i < Math.min(MAX_BUILDS_PER_FRAME, pending.length); i++) {
            this.rebuild(pending[i]);
        }
    }
    get pendingChunks() {
        let count = 0;
        for (const chunk of this.chunks.values())
            if (chunk.dirty)
                count++;
        return count;
    }
    markDirty(cx, cz) {
        const chunk = this.chunks.get(chunkKey(cx, cz));
        if (chunk)
            chunk.dirty = true;
    }
    /** An unloaded chunk regenerates from terrain, so its torches are gone. */
    forgetTorches(cx, cz) {
        for (const [key, torch] of this.torches) {
            if (Math.floor(torch.x / CHUNK_SIZE) === cx && Math.floor(torch.z / CHUNK_SIZE) === cz)
                this.torches.delete(key);
        }
    }
    scheduleUpdate(x, y, z) {
        if (y < 1 || y >= CHUNK_HEIGHT)
            return;
        this.pendingUpdates.add(`${x},${y},${z}`);
    }
    rebuild(chunk) {
        const { solid, water, lava } = buildChunkGeometry(chunk, (x, y, z) => this.getBlock(x, y, z), this.torchesNear(chunk.cx, chunk.cz));
        chunk.dispose(this.scene);
        const originX = chunk.cx * CHUNK_SIZE;
        const originZ = chunk.cz * CHUNK_SIZE;
        const place = (geometry, material, renderOrder) => {
            if (!geometry)
                return null;
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(originX, 0, originZ);
            mesh.renderOrder = renderOrder;
            mesh.matrixAutoUpdate = false;
            mesh.updateMatrix();
            this.scene.add(mesh);
            return mesh;
        };
        chunk.solidMesh = place(solid, this.solidMaterial, 0);
        chunk.lavaMesh = place(lava, this.lavaMaterial, 0);
        chunk.waterMesh = place(water, this.waterMaterial, 1);
        chunk.dirty = false;
    }
}
/** Amanatides & Woo voxel traversal. */
export function raycast(world, origin, direction, maxDistance) {
    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);
    const stepX = Math.sign(direction.x);
    const stepY = Math.sign(direction.y);
    const stepZ = Math.sign(direction.z);
    const tDeltaX = stepX !== 0 ? Math.abs(1 / direction.x) : Infinity;
    const tDeltaY = stepY !== 0 ? Math.abs(1 / direction.y) : Infinity;
    const tDeltaZ = stepZ !== 0 ? Math.abs(1 / direction.z) : Infinity;
    let tMaxX = stepX !== 0 ? ((stepX > 0 ? x + 1 - origin.x : x - origin.x) / direction.x) : Infinity;
    let tMaxY = stepY !== 0 ? ((stepY > 0 ? y + 1 - origin.y : y - origin.y) / direction.y) : Infinity;
    let tMaxZ = stepZ !== 0 ? ((stepZ > 0 ? z + 1 - origin.z : z - origin.z) / direction.z) : Infinity;
    const normal = new THREE.Vector3();
    let travelled = 0;
    while (travelled <= maxDistance) {
        const id = world.getBlock(x, y, z);
        if (id !== Block.Air && !isLiquid(id)) {
            return { block: new THREE.Vector3(x, y, z), normal: normal.clone() };
        }
        if (tMaxX < tMaxY && tMaxX < tMaxZ) {
            x += stepX;
            travelled = tMaxX;
            tMaxX += tDeltaX;
            normal.set(-stepX, 0, 0);
        }
        else if (tMaxY < tMaxZ) {
            y += stepY;
            travelled = tMaxY;
            tMaxY += tDeltaY;
            normal.set(0, -stepY, 0);
        }
        else {
            z += stepZ;
            travelled = tMaxZ;
            tMaxZ += tDeltaZ;
            normal.set(0, 0, -stepZ);
        }
    }
    return null;
}
