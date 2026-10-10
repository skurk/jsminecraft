import { fbm2 } from "../engine/noise.js";
import { CHUNK_HEIGHT } from "./chunk.js";

export const SEA_LEVEL = 26;
export const SEED = 20251002;

export function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
}
function lerp(a, b, t) {
    return a + (b - a) * t;
}

const RIVER_SCALE = 0.0016;
const RIVER_HALF_WIDTH = 0.006;
const RIVER_BED = SEA_LEVEL - 4;
const LAKE_SCALE = 0.009;
const LAKE_THRESHOLD = 0.37;
const LAKE_FALLOFF = 0.07;
const LAKE_BED = SEA_LEVEL - 5;

/** 0 outside a river channel, rising to 1 along its centre line. */
function riverWeight(x, z) {
    const distance = Math.abs(fbm2(x * RIVER_SCALE, z * RIVER_SCALE, 3, SEED + 313) - 0.5);
    if (distance >= RIVER_HALF_WIDTH)
        return 0;
    return Math.min(1, (1 - distance / RIVER_HALF_WIDTH) * 1.6);
}

/** Basins of every size, from roadside ponds up to broad lakes. */
function lakeWeight(x, z) {
    const n = fbm2(x * LAKE_SCALE + 137, z * LAKE_SCALE - 91, 3, SEED + 509);
    if (n >= LAKE_THRESHOLD)
        return 0;
    return Math.min(1, (LAKE_THRESHOLD - n) / LAKE_FALLOFF);
}

const heightCache = new Map();
const HEIGHT_CACHE_LIMIT = 300000;

function columnKey(x, z) {
    return (x & 0xfffff) * 0x100000 + (z & 0xfffff);
}

/** Height of the topmost solid block for a world column. */
export function terrainHeight(x, z) {
    const key = columnKey(x, z);
    const cached = heightCache.get(key);
    if (cached !== undefined)
        return cached;
    const continents = fbm2(x * 0.0075, z * 0.0075, 4, SEED);
    const hills = fbm2(x * 0.035, z * 0.035, 3, SEED + 17);
    const roughness = fbm2(x * 0.12, z * 0.12, 2, SEED + 41);
    // Stretching the continent term is what gives the map real lowlands and coasts.
    const shaped = Math.max(-1, Math.min(1, (continents - 0.5) * 3.2));
    let h = 33 + shaped * 21 + (hills - 0.5) * 9 + (roughness - 0.5) * 2;
    // Water bodies only bite into low ground, so mountains keep their peaks.
    const lake = lakeWeight(x, z) * clamp01((SEA_LEVEL + 14 - h) / 14);
    if (lake > 0)
        h = lerp(h, LAKE_BED, lake);
    const river = riverWeight(x, z) * clamp01((SEA_LEVEL + 20 - h) / 16);
    if (river > 0)
        h = lerp(h, RIVER_BED, river);
    const height = Math.max(1, Math.min(CHUNK_HEIGHT - 10, Math.floor(h)));
    if (heightCache.size > HEIGHT_CACHE_LIMIT)
        heightCache.clear();
    heightCache.set(key, height);
    return height;
}
