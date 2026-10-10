import { fbm2, noise3, randomAt } from "../engine/noise.js";
import { Block } from "./blocks.js";
import { CHUNK_HEIGHT, CHUNK_SIZE } from "./chunk.js";
import { SEA_LEVEL, SEED, clamp01, terrainHeight } from "./heightmap.js";
import { applyVillages, insideVillage } from "./village.js";
export { SEA_LEVEL, terrainHeight };
const LAVA_LEVEL = 9;
export const Biome = {
    Plains: 0,
    Forest: 1,
    Desert: 2,
    Rainforest: 3,
    Tundra: 4,
};
const TREES = {
    oak: { log: Block.Log, leaves: Block.Leaves, minTrunk: 5, extraTrunk: 3, radius: 2, bottom: -2, top: 1, shape: 'round', fruit: true },
    birch: { log: Block.BirchLog, leaves: Block.BirchLeaves, minTrunk: 6, extraTrunk: 3, radius: 2, bottom: -2, top: 1, shape: 'round', fruit: false },
    pine: { log: Block.PineLog, leaves: Block.PineLeaves, minTrunk: 7, extraTrunk: 4, radius: 2, bottom: -4, top: 1, shape: 'cone', fruit: false },
    fir: { log: Block.PineLog, leaves: Block.PineLeaves, minTrunk: 6, extraTrunk: 3, radius: 3, bottom: -3, top: 1, shape: 'cone', fruit: false },
    tropical: { log: Block.Log, leaves: Block.TropicalLeaves, minTrunk: 9, extraTrunk: 5, radius: 3, bottom: -2, top: 1, shape: 'canopy', fruit: false },
};
/** Cactus stands in for a tree in the desert, so it shares the placement rules. */
const CACTUS = { cactus: true, minTrunk: 1, extraTrunk: 3 };
const FRUITING_TREE_CHANCE = 0.35;
const APPLE_LEAF_CHANCE = 0.09;
/** Lowest leaf block above the ground, leaving room to walk beneath the canopy. */
const MIN_LEAF_HEIGHT = 3;
export const BIOMES = [
    { name: 'Plains', surface: Block.Grass, filler: Block.Dirt, shore: Block.Sand, treeChance: 0.0075,
        trees: [[TREES.oak, 5], [TREES.pine, 3], [TREES.fir, 2]] },
    { name: 'Forest', surface: Block.Grass, filler: Block.Dirt, shore: Block.Sand, treeChance: 0.045,
        trees: [[TREES.pine, 4], [TREES.fir, 4], [TREES.oak, 3]] },
    { name: 'Desert', surface: Block.Sand, filler: Block.Sand, shore: Block.Sand, treeChance: 0.025,
        trees: [[CACTUS, 1]] },
    { name: 'Rainforest', surface: Block.Grass, filler: Block.Dirt, shore: Block.Sand, treeChance: 0.065,
        trees: [[TREES.tropical, 1]] },
    // Nordic: mostly birch, with firs filling in.
    { name: 'Tundra', surface: Block.Snow, filler: Block.Dirt, shore: Block.Ice, treeChance: 0.02,
        trees: [[TREES.birch, 7], [TREES.fir, 3]] },
];
/** Climate changes slowly: the next zone over is typically a 2-4 minute walk. */
const CLIMATE_SCALE = 0.0005;
const CLIMATE_CONTRAST = 2.4;
function climate(x, z, seed) {
    const n = fbm2(x * CLIMATE_SCALE, z * CLIMATE_SCALE, 2, seed);
    return clamp01((n - 0.5) * CLIMATE_CONTRAST + 0.5);
}
function temperatureAt(x, z) {
    return climate(x, z, SEED + 601);
}
function humidityAt(x, z) {
    return climate(x + 4096, z - 4096, SEED + 733);
}
export function biomeAt(x, z) {
    const temperature = temperatureAt(x, z);
    if (temperature < 0.2)
        return Biome.Tundra;
    const humidity = humidityAt(x, z);
    if (temperature > 0.72)
        return humidity < 0.45 ? Biome.Desert : Biome.Rainforest;
    return humidity > 0.52 ? Biome.Forest : Biome.Plains;
}
export function biomeNameAt(x, z) {
    return BIOMES[biomeAt(x, z)].name;
}
function isCave(x, y, z) {
    const n = noise3(x * 0.06, y * 0.09, z * 0.06, SEED + 101);
    return n > 0.64;
}
const TUNNEL_SCALE = 0.021;
const TUNNEL_RISE = 0.045;
const TUNNEL_RADIUS = 0.03;
const TUNNEL_CEILING = 48;
/** Two independent fields vanish together along a curve, carving a winding tube. */
function isTunnel(x, y, z) {
    if (y < 3 || y > TUNNEL_CEILING)
        return false;
    const a = noise3(x * TUNNEL_SCALE, y * TUNNEL_RISE, z * TUNNEL_SCALE, SEED + 211) - 0.5;
    const b = noise3(x * TUNNEL_SCALE, y * TUNNEL_RISE, z * TUNNEL_SCALE, SEED + 353) - 0.5;
    return a * a + b * b < TUNNEL_RADIUS * TUNNEL_RADIUS;
}
const RAVINE_REGION_SCALE = 0.0009;
const RAVINE_SCALE = 0.0042;
const RAVINE_HALF_WIDTH = 0.008;
const RAVINE_MIN_DEPTH = 12;
/** Describes the slot a ravine cuts through this column, or null if there is none. */
function ravineAt(x, z, height) {
    if (height <= SEA_LEVEL + 3)
        return null;
    const region = fbm2(x * RAVINE_REGION_SCALE, z * RAVINE_REGION_SCALE, 2, SEED + 641);
    if (region < 0.6)
        return null;
    const distance = Math.abs(fbm2(x * RAVINE_SCALE, z * RAVINE_SCALE, 2, SEED + 977) - 0.5);
    const halfWidth = RAVINE_HALF_WIDTH * Math.min(1, (region - 0.6) / 0.06);
    if (distance >= halfWidth)
        return null;
    const floor = 6 + Math.floor(region * 8);
    if (height - floor < RAVINE_MIN_DEPTH)
        return null;
    return { floor, height, offset: distance / halfWidth };
}
/** Ravines pinch shut towards the floor so the walls never overhang. */
function inRavine(ravine, y) {
    if (y < ravine.floor || y > ravine.height)
        return false;
    const t = (y - ravine.floor) / (ravine.height - ravine.floor);
    return ravine.offset < 0.35 + 0.65 * t;
}
const ORES = [
    { id: Block.DiamondOre, min: 1, max: 14, scale: 0.22, threshold: 0.948, seed: 1613 },
    { id: Block.EmeraldOre, min: 3, max: 26, scale: 0.3, threshold: 0.955, seed: 1511 },
    { id: Block.IronOre, min: 3, max: 40, scale: 0.17, threshold: 0.912, seed: 1409 },
    { id: Block.CopperOre, min: 6, max: 46, scale: 0.16, threshold: 0.905, seed: 1301 },
    { id: Block.CoalOre, min: 6, max: 54, scale: 0.14, threshold: 0.885, seed: 1201 },
];
/** Rarest seam wins, so diamonds are never overwritten by coal. */
function oreAt(x, y, z) {
    for (const ore of ORES) {
        if (y < ore.min || y > ore.max)
            continue;
        const n = noise3(x * ore.scale, y * ore.scale, z * ore.scale, SEED + ore.seed);
        if (n > ore.threshold)
            return ore.id;
    }
    return Block.Stone;
}
function pickTree(trees, roll) {
    let total = 0;
    for (const [, weight] of trees)
        total += weight;
    let remaining = roll * total;
    for (const [profile, weight] of trees) {
        remaining -= weight;
        if (remaining <= 0)
            return profile;
    }
    return trees[0][0];
}
function treeAt(x, z) {
    const height = terrainHeight(x, z);
    if (height <= SEA_LEVEL + 1)
        return null;
    // Keep trunks apart by only allowing one candidate per 3x3 cell.
    if (((x % 3) + 3) % 3 !== 1 || ((z % 3) + 3) % 3 !== 1)
        return null;
    const biome = BIOMES[biomeAt(x, z)];
    if (!biome.trees || randomAt(x, z, SEED) >= biome.treeChance)
        return null;
    if (insideVillage(x, z))
        return null;
    // Nothing to root into when a ravine has swallowed the column.
    const ravine = ravineAt(x, z, height);
    if (ravine && inRavine(ravine, height))
        return null;
    return pickTree(biome.trees, randomAt(x, z, SEED + 29));
}
function hasLavaPool(x, z) {
    if (terrainHeight(x, z) <= SEA_LEVEL + 2)
        return false;
    if (((x % 5) + 5) % 5 !== 2 || ((z % 5) + 5) % 5 !== 2)
        return false;
    return randomAt(x, z, SEED + 31) < 0.01;
}
function stamp(chunk, lx, y, lz, id, overwrite) {
    if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE)
        return;
    if (y < 0 || y >= CHUNK_HEIGHT)
        return;
    if (!overwrite && chunk.get(lx, y, lz) !== Block.Air)
        return;
    chunk.set(lx, y, lz, id);
}
function plantTree(chunk, baseX, baseZ, originX, originZ, profile) {
    const ground = terrainHeight(baseX, baseZ);
    let trunk = profile.minTrunk + Math.floor(randomAt(baseX, baseZ, SEED + 7) * profile.extraTrunk);
    const lx = baseX - originX;
    const lz = baseZ - originZ;
    if (profile.cactus) {
        for (let i = 1; i <= trunk; i++)
            stamp(chunk, lx, ground + i, lz, Block.Cactus, true);
        return;
    }
    // A crown that hangs low is pushed up rather than left blocking the way through.
    trunk = Math.max(trunk, MIN_LEAF_HEIGHT - profile.bottom);
    for (let i = 1; i <= trunk; i++) {
        stamp(chunk, lx, ground + i, lz, profile.log, true);
    }
    const crownY = ground + trunk;
    const bearsFruit = profile.fruit && randomAt(baseX, baseZ, SEED + 19) < FRUITING_TREE_CHANCE;
    for (let dy = profile.bottom; dy <= profile.top; dy++) {
        const radius = crownRadius(profile, dy);
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dz = -radius; dz <= radius; dz++) {
                if (Math.abs(dx) === radius && Math.abs(dz) === radius && radius > 1)
                    continue;
                // Offsetting by dy keeps apples from stacking into vertical columns.
                const apple = bearsFruit &&
                    randomAt(baseX + dx, baseZ + dz + dy * 37, SEED + 23) < APPLE_LEAF_CHANCE;
                stamp(chunk, lx + dx, crownY + dy, lz + dz, apple ? Block.AppleLeaves : profile.leaves, false);
            }
        }
    }
}
function crownRadius(profile, dy) {
    if (profile.shape === 'cone') {
        const span = profile.top - profile.bottom;
        return Math.max(1, Math.round((profile.radius * (profile.top - dy)) / span));
    }
    if (profile.shape === 'canopy')
        return dy >= profile.top ? profile.radius - 1 : profile.radius;
    return dy >= 1 ? 1 : profile.radius;
}
/** Carves a shallow dish of lava into level ground. */
function poolLava(chunk, baseX, baseZ, originX, originZ) {
    const level = terrainHeight(baseX, baseZ);
    for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
            if (dx * dx + dz * dz > 4)
                continue;
            const wx = baseX + dx;
            const wz = baseZ + dz;
            if (terrainHeight(wx, wz) !== level)
                continue;
            stamp(chunk, wx - originX, level, wz - originZ, Block.Lava, true);
        }
    }
}
export function generateChunk(chunk) {
    const originX = chunk.cx * CHUNK_SIZE;
    const originZ = chunk.cz * CHUNK_SIZE;
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
            const wx = originX + lx;
            const wz = originZ + lz;
            const height = terrainHeight(wx, wz);
            const beach = height <= SEA_LEVEL + 1;
            const biome = BIOMES[biomeAt(wx, wz)];
            const ravine = ravineAt(wx, wz, height);
            for (let y = 0; y <= Math.max(height, SEA_LEVEL); y++) {
                let id = Block.Air;
                if (y === 0) {
                    id = Block.Bedrock;
                }
                else if (y > height) {
                    id = y <= SEA_LEVEL ? Block.Water : Block.Air;
                }
                else if (y === height) {
                    id = beach ? biome.shore : biome.surface;
                }
                else if (y > height - 4) {
                    id = beach ? biome.shore : biome.filler;
                }
                else {
                    id = Block.Stone;
                }
                if (y > 0 && y <= height && id !== Block.Water) {
                    const carved = ravine !== null && inRavine(ravine, y);
                    if (carved || (y < height && (isCave(wx, y, wz) || isTunnel(wx, y, wz)))) {
                        id = y <= LAVA_LEVEL ? Block.Lava : Block.Air;
                    }
                    else if (id === Block.Stone) {
                        id = oreAt(wx, y, wz);
                    }
                }
                chunk.set(lx, y, lz, id);
            }
        }
    }
    // Trees may straddle chunk borders, so scan a margin and clip while stamping.
    for (let lx = -4; lx < CHUNK_SIZE + 4; lx++) {
        for (let lz = -4; lz < CHUNK_SIZE + 4; lz++) {
            const wx = originX + lx;
            const wz = originZ + lz;
            const tree = treeAt(wx, wz);
            if (tree)
                plantTree(chunk, wx, wz, originX, originZ, tree);
            if (hasLavaPool(wx, wz))
                poolLava(chunk, wx, wz, originX, originZ);
        }
    }
    applyVillages(chunk);
}
