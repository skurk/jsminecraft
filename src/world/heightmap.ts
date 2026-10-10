import { fbm2 } from '../engine/noise.ts';
import { CHUNK_HEIGHT } from './chunk.ts';

export const SEA_LEVEL = 26;
export const WORLD_SEED = 20251002;

/** Height of the topmost solid block for a world column. */
export function terrainHeight(x: number, z: number): number {
  const continents = fbm2(x * 0.0075, z * 0.0075, 4, WORLD_SEED);
  const hills = fbm2(x * 0.035, z * 0.035, 3, WORLD_SEED + 17);
  const roughness = fbm2(x * 0.12, z * 0.12, 2, WORLD_SEED + 41);
  const h = 18 + continents * 30 + hills * 9 + roughness * 2;
  return Math.max(1, Math.min(CHUNK_HEIGHT - 10, Math.floor(h)));
}
