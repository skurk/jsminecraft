import * as THREE from 'three';
import {
  Block,
  MAX_WATER_SPREAD,
  hasGravity,
  isLiquid,
  isSolid,
  isWater,
  waterFlowId,
  waterLevel,
} from './blocks.ts';
import { CHUNK_HEIGHT, CHUNK_SIZE, Chunk, chunkKey } from './chunk.ts';
import { buildChunkGeometry } from './mesher.ts';
import { generateChunk } from './terrain.ts';
import { atlasTexture } from './textures.ts';

const MAX_BUILDS_PER_FRAME = 3;

const HORIZONTAL: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const NEIGHBORS: [number, number, number][] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

export class World {
  readonly scene: THREE.Scene;
  readonly chunks = new Map<string, Chunk>();
  readonly renderDistance: number;

  private readonly solidMaterial: THREE.MeshBasicMaterial;
  private readonly cutoutMaterial: THREE.MeshBasicMaterial;
  private readonly waterMaterial: THREE.MeshBasicMaterial;
  private readonly lavaMaterial: THREE.MeshBasicMaterial;
  private pendingUpdates = new Set<string>();

  constructor(scene: THREE.Scene, renderDistance = 6) {
    this.scene = scene;
    this.renderDistance = renderDistance;

    const map = atlasTexture();
    this.solidMaterial = new THREE.MeshBasicMaterial({ map, vertexColors: true });
    // Glass and crops keep their texture's holes via alpha testing.
    this.cutoutMaterial = new THREE.MeshBasicMaterial({
      map,
      vertexColors: true,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    });
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

  getChunk(cx: number, cz: number, create = false): Chunk | undefined {
    const key = chunkKey(cx, cz);
    let chunk = this.chunks.get(key);
    if (!chunk && create) {
      chunk = new Chunk(cx, cz);
      generateChunk(chunk);
      this.chunks.set(key, chunk);
    }
    return chunk;
  }

  getBlock(x: number, y: number, z: number): number {
    if (y < 0) return Block.Bedrock;
    if (y >= CHUNK_HEIGHT) return Block.Air;

    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz, true);
    if (!chunk) return Block.Air;

    return chunk.get(x - cx * CHUNK_SIZE, y, z - cz * CHUNK_SIZE);
  }

  setBlock(x: number, y: number, z: number, id: number): void {
    if (y < 1 || y >= CHUNK_HEIGHT) return;

    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz, true);
    if (!chunk) return;

    const lx = x - cx * CHUNK_SIZE;
    const lz = z - cz * CHUNK_SIZE;
    if (chunk.get(lx, y, lz) === id) return;

    chunk.set(lx, y, lz, id);
    chunk.dirty = true;

    // Edits on a border change the neighbouring chunk's visible faces too.
    if (lx === 0) this.markDirty(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1) this.markDirty(cx + 1, cz);
    if (lz === 0) this.markDirty(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1) this.markDirty(cx, cz + 1);

    this.scheduleUpdate(x, y, z);
    this.scheduleUpdate(x - 1, y, z);
    this.scheduleUpdate(x + 1, y, z);
    this.scheduleUpdate(x, y - 1, z);
    this.scheduleUpdate(x, y + 1, z);
    this.scheduleUpdate(x, y, z - 1);
    this.scheduleUpdate(x, y, z + 1);
  }

  /** Steps queued block updates by one voxel; call at a fixed rate. */
  tickPhysics(): void {
    if (this.pendingUpdates.size === 0) return;

    const batch = this.pendingUpdates;
    this.pendingUpdates = new Set<string>();

    const positions: [number, number, number][] = [];
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
        if (below !== Block.Air && !isLiquid(below)) continue;

        this.setBlock(x, y, z, Block.Air);
        this.setBlock(x, y - 1, z, id);
        continue;
      }

      if (isWater(id)) this.flowWater(x, y, z, id);
    }
  }

  private flowWater(x: number, y: number, z: number, id: number): void {
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

    if (level >= MAX_WATER_SPREAD) return;
    const next = waterFlowId(level + 1);
    for (const [dx, dz] of HORIZONTAL) {
      if (this.getBlock(x + dx, y, z + dz) === Block.Air) {
        this.setBlock(x + dx, y, z + dz, next);
      }
    }
  }

  /** A flow survives only while fed from above or by shallower water beside it. */
  private waterSupplied(x: number, y: number, z: number, level: number): boolean {
    if (isWater(this.getBlock(x, y + 1, z))) return true;
    for (const [dx, dz] of HORIZONTAL) {
      const neighbor = this.getBlock(x + dx, y, z + dz);
      if (isWater(neighbor) && waterLevel(neighbor) < level) return true;
    }
    return false;
  }

  private quenchLava(x: number, y: number, z: number): void {
    for (const [dx, dy, dz] of NEIGHBORS) {
      if (this.getBlock(x + dx, y + dy, z + dz) === Block.Lava) {
        this.setBlock(x + dx, y + dy, z + dz, Block.Cobblestone);
      }
    }
  }

  isSolidAt(x: number, y: number, z: number): boolean {
    return isSolid(this.getBlock(x, y, z));
  }

  isLiquidAt(x: number, y: number, z: number): boolean {
    return isLiquid(this.getBlock(x, y, z));
  }

  isWaterAt(x: number, y: number, z: number): boolean {
    return isWater(this.getBlock(x, y, z));
  }

  isLavaAt(x: number, y: number, z: number): boolean {
    return this.getBlock(x, y, z) === Block.Lava;
  }

  /** True when nothing blocks the column above, i.e. the spot can see the sky. */
  isSkyExposed(x: number, y: number, z: number): boolean {
    for (let yy = y + 1; yy < CHUNK_HEIGHT; yy++) {
      if (this.getBlock(x, yy, z) !== Block.Air) return false;
    }
    return true;
  }

  /** Tints terrain to follow the day/night cycle. */
  setDaylight(brightness: number): void {
    this.solidMaterial.color.setScalar(brightness);
    this.cutoutMaterial.color.setScalar(brightness);
    this.waterMaterial.color.setScalar(brightness);
  }

  /** Streams chunks in/out around `center` and rebuilds a few dirty meshes. */
  update(center: THREE.Vector3): void {
    const pcx = Math.floor(center.x / CHUNK_SIZE);
    const pcz = Math.floor(center.z / CHUNK_SIZE);
    const r = this.renderDistance;

    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dz * dz > r * r) continue;
        this.getChunk(pcx + dx, pcz + dz, true);
      }
    }

    const pending: Chunk[] = [];
    for (const chunk of this.chunks.values()) {
      const dx = chunk.cx - pcx;
      const dz = chunk.cz - pcz;
      const distSq = dx * dx + dz * dz;

      if (distSq > (r + 2) * (r + 2)) {
        chunk.dispose(this.scene);
        this.chunks.delete(chunkKey(chunk.cx, chunk.cz));
        continue;
      }

      if (chunk.dirty && distSq <= r * r) pending.push(chunk);
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

  get pendingChunks(): number {
    let count = 0;
    for (const chunk of this.chunks.values()) if (chunk.dirty) count++;
    return count;
  }

  private markDirty(cx: number, cz: number): void {
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (chunk) chunk.dirty = true;
  }

  private scheduleUpdate(x: number, y: number, z: number): void {
    if (y < 1 || y >= CHUNK_HEIGHT) return;
    this.pendingUpdates.add(`${x},${y},${z}`);
  }

  private rebuild(chunk: Chunk): void {
    const { solid, cutout, water, lava } = buildChunkGeometry(chunk, (x, y, z) => this.getBlock(x, y, z));
    chunk.dispose(this.scene);

    const originX = chunk.cx * CHUNK_SIZE;
    const originZ = chunk.cz * CHUNK_SIZE;

    const place = (
      geometry: THREE.BufferGeometry | null,
      material: THREE.Material,
      renderOrder: number,
    ): THREE.Mesh | null => {
      if (!geometry) return null;
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(originX, 0, originZ);
      mesh.renderOrder = renderOrder;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.scene.add(mesh);
      return mesh;
    };

    chunk.solidMesh = place(solid, this.solidMaterial, 0);
    chunk.cutoutMesh = place(cutout, this.cutoutMaterial, 0);
    chunk.lavaMesh = place(lava, this.lavaMaterial, 0);
    chunk.waterMesh = place(water, this.waterMaterial, 1);

    chunk.dirty = false;
  }
}

export interface RayHit {
  /** Coordinates of the block that was hit. */
  block: THREE.Vector3;
  /** Face normal, i.e. the offset to the empty block in front of the hit. */
  normal: THREE.Vector3;
}

/** Amanatides & Woo voxel traversal. */
export function raycast(world: World, origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number): RayHit | null {
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
    } else if (tMaxY < tMaxZ) {
      y += stepY;
      travelled = tMaxY;
      tMaxY += tDeltaY;
      normal.set(0, -stepY, 0);
    } else {
      z += stepZ;
      travelled = tMaxZ;
      tMaxZ += tDeltaZ;
      normal.set(0, 0, -stepZ);
    }
  }

  return null;
}
