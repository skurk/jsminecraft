import { fbm2, noise3, randomAt } from '../engine/noise.ts';
import { Block } from './blocks.ts';
import { CHUNK_HEIGHT, CHUNK_SIZE, Chunk } from './chunk.ts';

export const SEA_LEVEL = 26;
const LAVA_LEVEL = 9;
const SEED = 20251002;

/** Height of the topmost solid block for a world column. */
export function terrainHeight(x: number, z: number): number {
  const continents = fbm2(x * 0.0075, z * 0.0075, 4, SEED);
  const hills = fbm2(x * 0.035, z * 0.035, 3, SEED + 17);
  const roughness = fbm2(x * 0.12, z * 0.12, 2, SEED + 41);
  const h = 18 + continents * 30 + hills * 9 + roughness * 2;
  return Math.max(1, Math.min(CHUNK_HEIGHT - 10, Math.floor(h)));
}

function isCave(x: number, y: number, z: number): boolean {
  const n = noise3(x * 0.06, y * 0.09, z * 0.06, SEED + 101);
  return n > 0.64;
}

function hasTree(x: number, z: number): boolean {
  const height = terrainHeight(x, z);
  if (height <= SEA_LEVEL + 1) return false;
  // Keep trunks apart by only allowing one candidate per 3x3 cell.
  if (((x % 3) + 3) % 3 !== 1 || ((z % 3) + 3) % 3 !== 1) return false;
  return randomAt(x, z, SEED) < 0.07;
}

function hasLavaPool(x: number, z: number): boolean {
  if (terrainHeight(x, z) <= SEA_LEVEL + 2) return false;
  if (((x % 5) + 5) % 5 !== 2 || ((z % 5) + 5) % 5 !== 2) return false;
  return randomAt(x, z, SEED + 31) < 0.01;
}

function stamp(chunk: Chunk, lx: number, y: number, lz: number, id: number, overwrite: boolean): void {
  if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) return;
  if (y < 0 || y >= CHUNK_HEIGHT) return;
  if (!overwrite && chunk.get(lx, y, lz) !== Block.Air) return;
  chunk.set(lx, y, lz, id);
}

function plantTree(chunk: Chunk, baseX: number, baseZ: number, originX: number, originZ: number): void {
  const ground = terrainHeight(baseX, baseZ);
  const trunk = 4 + Math.floor(randomAt(baseX, baseZ, SEED + 7) * 3);
  const lx = baseX - originX;
  const lz = baseZ - originZ;

  for (let i = 1; i <= trunk; i++) {
    stamp(chunk, lx, ground + i, lz, Block.Log, true);
  }

  const crownY = ground + trunk;
  for (let dy = -2; dy <= 1; dy++) {
    const radius = dy >= 1 ? 1 : 2;
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        if (Math.abs(dx) === radius && Math.abs(dz) === radius && radius > 1) continue;
        stamp(chunk, lx + dx, crownY + dy, lz + dz, Block.Leaves, false);
      }
    }
  }
}

/** Carves a shallow dish of lava into level ground. */
function poolLava(chunk: Chunk, baseX: number, baseZ: number, originX: number, originZ: number): void {
  const level = terrainHeight(baseX, baseZ);

  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      if (dx * dx + dz * dz > 4) continue;
      const wx = baseX + dx;
      const wz = baseZ + dz;
      if (terrainHeight(wx, wz) !== level) continue;
      stamp(chunk, wx - originX, level, wz - originZ, Block.Lava, true);
    }
  }
}

export function generateChunk(chunk: Chunk): void {
  const originX = chunk.cx * CHUNK_SIZE;
  const originZ = chunk.cz * CHUNK_SIZE;

  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wx = originX + lx;
      const wz = originZ + lz;
      const height = terrainHeight(wx, wz);
      const beach = height <= SEA_LEVEL + 1;

      for (let y = 0; y <= Math.max(height, SEA_LEVEL); y++) {
        let id: number = Block.Air;

        if (y === 0) {
          id = Block.Bedrock;
        } else if (y > height) {
          id = y <= SEA_LEVEL ? Block.Water : Block.Air;
        } else if (y === height) {
          id = beach ? Block.Sand : Block.Grass;
        } else if (y > height - 4) {
          id = beach ? Block.Sand : Block.Dirt;
        } else {
          id = Block.Stone;
        }

        if (id !== Block.Bedrock && id !== Block.Water && id !== Block.Air && y < height && isCave(wx, y, wz)) {
          id = y <= LAVA_LEVEL ? Block.Lava : Block.Air;
        }

        chunk.set(lx, y, lz, id);
      }
    }
  }

  // Trees may straddle chunk borders, so scan a margin and clip while stamping.
  for (let lx = -3; lx < CHUNK_SIZE + 3; lx++) {
    for (let lz = -3; lz < CHUNK_SIZE + 3; lz++) {
      const wx = originX + lx;
      const wz = originZ + lz;
      if (hasTree(wx, wz)) plantTree(chunk, wx, wz, originX, originZ);
      if (hasLavaPool(wx, wz)) poolLava(chunk, wx, wz, originX, originZ);
    }
  }
}
