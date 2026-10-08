import { Item } from "../items/ids.js";
export const Block = {
    Air: 0,
    Grass: 1,
    Dirt: 2,
    Stone: 3,
    Sand: 4,
    Log: 5,
    Leaves: 6,
    Planks: 7,
    Water: 8,
    Cobblestone: 9,
    Bedrock: 10,
    CraftingTable: 11,
    Lava: 12,
    WaterFlow1: 13,
    WaterFlow2: 14,
    WaterFlow3: 15,
    WaterFlow4: 16,
    WaterFlow5: 17,
    WaterFlow6: 18,
    WaterFlow7: 19,
    Snow: 20,
    Ice: 21,
    CoalOre: 22,
    CopperOre: 23,
    IronOre: 24,
    EmeraldOre: 25,
    DiamondOre: 26,
    AppleLeaves: 27,
    Torch: 28,
    BirchLog: 29,
    BirchLeaves: 30,
    PineLog: 31,
    PineLeaves: 32,
    TropicalLeaves: 33,
    Cactus: 34,
    LavaFlow1: 35,
    LavaFlow2: 36,
    LavaFlow3: 37,
    LavaFlow4: 38,
};
/** Index into the procedurally generated texture atlas. */
export const Tile = {
    GrassTop: 0,
    GrassSide: 1,
    Dirt: 2,
    Stone: 3,
    Sand: 4,
    LogSide: 5,
    LogTop: 6,
    Leaves: 7,
    Planks: 8,
    Water: 9,
    Cobblestone: 10,
    Bedrock: 11,
    CraftingTableTop: 12,
    CraftingTableSide: 13,
    Lava: 14,
    Snow: 15,
    Ice: 16,
    CoalOre: 17,
    CopperOre: 18,
    IronOre: 19,
    EmeraldOre: 20,
    DiamondOre: 21,
    // Slot 22 is spare since apple leaves now reuse the plain leaf tile.
    Torch: 23,
    BirchLogSide: 24,
    BirchLogTop: 25,
    BirchLeaves: 26,
    PineLogSide: 27,
    PineLeaves: 28,
    TropicalLeaves: 29,
    CactusSide: 30,
    CactusTop: 31,
};
export const BLOCKS = [
    {
        name: 'Air',
        solid: false,
        liquid: false,
        top: 0,
        side: 0,
        bottom: 0,
        hardness: 0,
        tool: null,
        requiresTool: false,
        drop: 0,
    },
    {
        name: 'Grass',
        solid: true,
        liquid: false,
        top: Tile.GrassTop,
        side: Tile.GrassSide,
        bottom: Tile.Dirt,
        hardness: 0.6,
        tool: 'shovel',
        requiresTool: false,
        drop: Block.Grass,
    },
    {
        name: 'Dirt',
        solid: true,
        liquid: false,
        top: Tile.Dirt,
        side: Tile.Dirt,
        bottom: Tile.Dirt,
        hardness: 0.5,
        tool: 'shovel',
        requiresTool: false,
        drop: Block.Dirt,
    },
    {
        name: 'Stone',
        solid: true,
        liquid: false,
        top: Tile.Stone,
        side: Tile.Stone,
        bottom: Tile.Stone,
        hardness: 1.5,
        tool: 'pickaxe',
        requiresTool: true,
        drop: Block.Cobblestone,
    },
    {
        name: 'Sand',
        solid: true,
        liquid: false,
        top: Tile.Sand,
        side: Tile.Sand,
        bottom: Tile.Sand,
        hardness: 0.5,
        tool: 'shovel',
        requiresTool: false,
        drop: Block.Sand,
    },
    {
        name: 'Log',
        solid: true,
        liquid: false,
        top: Tile.LogTop,
        side: Tile.LogSide,
        bottom: Tile.LogTop,
        hardness: 2,
        tool: 'axe',
        requiresTool: false,
        drop: Block.Log,
    },
    {
        name: 'Leaves',
        solid: true,
        liquid: false,
        top: Tile.Leaves,
        side: Tile.Leaves,
        bottom: Tile.Leaves,
        hardness: 0.2,
        tool: null,
        requiresTool: false,
        drop: Block.Leaves,
    },
    {
        name: 'Planks',
        solid: true,
        liquid: false,
        top: Tile.Planks,
        side: Tile.Planks,
        bottom: Tile.Planks,
        hardness: 2,
        tool: 'axe',
        requiresTool: false,
        drop: Block.Planks,
    },
    {
        name: 'Water',
        solid: false,
        liquid: true,
        top: Tile.Water,
        side: Tile.Water,
        bottom: Tile.Water,
        hardness: 0,
        tool: null,
        requiresTool: false,
        drop: Block.Air,
    },
    {
        name: 'Cobblestone',
        solid: true,
        liquid: false,
        top: Tile.Cobblestone,
        side: Tile.Cobblestone,
        bottom: Tile.Cobblestone,
        hardness: 2,
        tool: 'pickaxe',
        requiresTool: true,
        drop: Block.Cobblestone,
    },
    {
        name: 'Bedrock',
        solid: true,
        liquid: false,
        top: Tile.Bedrock,
        side: Tile.Bedrock,
        bottom: Tile.Bedrock,
        hardness: Infinity,
        tool: null,
        requiresTool: true,
        drop: Block.Air,
    },
    {
        name: 'Crafting Table',
        solid: true,
        liquid: false,
        top: Tile.CraftingTableTop,
        side: Tile.CraftingTableSide,
        bottom: Tile.Planks,
        hardness: 2.5,
        tool: 'axe',
        requiresTool: false,
        drop: Block.CraftingTable,
    },
    {
        name: 'Lava',
        solid: false,
        liquid: true,
        top: Tile.Lava,
        side: Tile.Lava,
        bottom: Tile.Lava,
        hardness: 0,
        tool: null,
        requiresTool: false,
        drop: Block.Air,
    },
];
/** How far flowing water travels from its source before drying up. */
export const MAX_WATER_SPREAD = 7;
for (let level = 1; level <= MAX_WATER_SPREAD; level++) {
    BLOCKS.push({
        name: 'Flowing Water',
        solid: false,
        liquid: true,
        top: Tile.Water,
        side: Tile.Water,
        bottom: Tile.Water,
        hardness: 0,
        tool: null,
        requiresTool: false,
        drop: Block.Air,
    });
}
function mineral(name, id, tile) {
    return {
        name,
        solid: true,
        liquid: false,
        top: tile,
        side: tile,
        bottom: tile,
        hardness: 3,
        tool: 'pickaxe',
        requiresTool: true,
        drop: id,
    };
}
BLOCKS.push({
    name: 'Snow',
    solid: true,
    liquid: false,
    top: Tile.Snow,
    side: Tile.Snow,
    bottom: Tile.Dirt,
    hardness: 0.4,
    tool: 'shovel',
    requiresTool: false,
    drop: Block.Snow,
}, {
    name: 'Ice',
    solid: true,
    liquid: false,
    top: Tile.Ice,
    side: Tile.Ice,
    bottom: Tile.Ice,
    hardness: 0.5,
    tool: 'pickaxe',
    requiresTool: false,
    drop: Block.Ice,
});
const coalOre = mineral('Coal Ore', Block.CoalOre, Tile.CoalOre);
// Mining coal ore yields the fuel itself, which is what torches are made from.
coalOre.drop = Item.Coal;
BLOCKS.push(coalOre);
BLOCKS.push(mineral('Copper Ore', Block.CopperOre, Tile.CopperOre));
BLOCKS.push(mineral('Iron Ore', Block.IronOre, Tile.IronOre));
BLOCKS.push(mineral('Emerald Ore', Block.EmeraldOre, Tile.EmeraldOre));
BLOCKS.push(mineral('Diamond Ore', Block.DiamondOre, Tile.DiamondOre));
BLOCKS.push({
    name: 'Apple Leaves',
    solid: true,
    liquid: false,
    // Indistinguishable from plain leaves, so the apple is a surprise when it drops.
    top: Tile.Leaves,
    side: Tile.Leaves,
    bottom: Tile.Leaves,
    hardness: 0.2,
    tool: null,
    requiresTool: false,
    drop: Item.Apple,
});
BLOCKS.push({
    name: 'Torch',
    solid: false,
    liquid: false,
    top: Tile.Torch,
    side: Tile.Torch,
    bottom: Tile.Torch,
    hardness: 0,
    tool: null,
    requiresTool: false,
    drop: Block.Torch,
    full: false,
    box: [0.42, 0, 0.42, 0.58, 0.62, 0.58],
    light: 1,
});
function wood(name, id, side, top) {
    return {
        name,
        solid: true,
        liquid: false,
        top,
        side,
        bottom: top,
        hardness: 2,
        tool: 'axe',
        requiresTool: false,
        drop: id,
    };
}
function foliage(name, id, tile) {
    return {
        name,
        solid: true,
        liquid: false,
        top: tile,
        side: tile,
        bottom: tile,
        hardness: 0.2,
        tool: null,
        requiresTool: false,
        drop: id,
    };
}
BLOCKS.push(wood('Birch Log', Block.BirchLog, Tile.BirchLogSide, Tile.BirchLogTop));
BLOCKS.push(foliage('Birch Leaves', Block.BirchLeaves, Tile.BirchLeaves));
BLOCKS.push(wood('Pine Log', Block.PineLog, Tile.PineLogSide, Tile.LogTop));
BLOCKS.push(foliage('Pine Needles', Block.PineLeaves, Tile.PineLeaves));
BLOCKS.push(foliage('Tropical Leaves', Block.TropicalLeaves, Tile.TropicalLeaves));
BLOCKS.push({
    name: 'Cactus',
    solid: true,
    liquid: false,
    top: Tile.CactusTop,
    side: Tile.CactusSide,
    bottom: Tile.CactusTop,
    hardness: 0.4,
    tool: 'axe',
    requiresTool: false,
    drop: Block.Cactus,
    full: false,
    box: [0.06, 0, 0.06, 0.94, 1, 0.94],
    hurts: 1,
});
/** Damage dealt per contact tick, 0 for harmless blocks. */
export function blockContactDamage(id) {
    return BLOCKS[id].hurts ?? 0;
}
// Lava creeps only a third as far as water, as in the Overworld.
export const MAX_LAVA_SPREAD = 4;
for (let level = 1; level <= MAX_LAVA_SPREAD; level++) {
    BLOCKS.push({
        name: 'Flowing Lava',
        solid: false,
        liquid: true,
        top: Tile.Lava,
        side: Tile.Lava,
        bottom: Tile.Lava,
        hardness: 0,
        tool: null,
        requiresTool: false,
        drop: Block.Air,
    });
}
const UNIT_BOX = [0, 0, 0, 1, 1, 1];
/** False for blocks that do not fill their voxel, so neighbours keep their faces. */
export function isFullBlock(id) {
    return BLOCKS[id].full !== false;
}
export function blockBox(id) {
    return BLOCKS[id].box ?? UNIT_BOX;
}
export function blockLight(id) {
    return BLOCKS[id].light ?? 0;
}
export function isSolid(id) {
    return BLOCKS[id].solid;
}
export function isWater(id) {
    return id === Block.Water || (id >= Block.WaterFlow1 && id <= Block.WaterFlow7);
}
export function isLava(id) {
    return id === Block.Lava || (id >= Block.LavaFlow1 && id <= Block.LavaFlow4);
}
/** 0 for a source block, 1..MAX_LAVA_SPREAD for flows. */
export function lavaLevel(id) {
    return id === Block.Lava ? 0 : id - Block.LavaFlow1 + 1;
}
export function lavaFlowId(level) {
    return Block.LavaFlow1 + Math.min(level, MAX_LAVA_SPREAD) - 1;
}
/** 0 for a source block, 1..MAX_WATER_SPREAD for flows. */
export function waterLevel(id) {
    return id === Block.Water ? 0 : id - Block.WaterFlow1 + 1;
}
export function waterFlowId(level) {
    return Block.WaterFlow1 + Math.min(level, MAX_WATER_SPREAD) - 1;
}
/** 0 when not a fluid; water variants and lava each share a group. */
export function fluidGroup(id) {
    if (isWater(id))
        return 1;
    if (isLava(id))
        return 2;
    return 0;
}
/** Rendered surface height, which is what tapers the edge of a spreading pool. */
export function fluidHeight(id) {
    if (isWater(id))
        return (8 - waterLevel(id)) / 9;
    // Lava thins over only four levels, so each step drops further.
    if (isLava(id))
        return (8 - lavaLevel(id) * 1.75) / 9;
    return 1;
}
export function isLiquid(id) {
    return BLOCKS[id].liquid;
}
export function isAir(id) {
    return id === Block.Air;
}
/** Which procedural footstep voicing a block uses when walked on. */
export function blockSurface(id) {
    switch (id) {
        case Block.Grass:
            return 'grass';
        case Block.Sand:
            return 'sand';
        case Block.Snow:
            return 'snow';
        case Block.Log:
        case Block.BirchLog:
        case Block.PineLog:
        case Block.Planks:
        case Block.CraftingTable:
        case Block.Cactus:
            return 'wood';
        case Block.Leaves:
        case Block.AppleLeaves:
        case Block.BirchLeaves:
        case Block.PineLeaves:
        case Block.TropicalLeaves:
            return 'leaves';
        case Block.Stone:
        case Block.Cobblestone:
        case Block.Bedrock:
        case Block.Ice:
        case Block.CoalOre:
        case Block.CopperOre:
        case Block.IronOre:
        case Block.EmeraldOre:
        case Block.DiamondOre:
            return 'stone';
        default:
            return 'dirt';
    }
}
export function isBreakable(id) {
    return id !== Block.Air && Number.isFinite(BLOCKS[id].hardness);
}
/** Blocks that fall when the space below them is free. */
export function hasGravity(id) {
    return id === Block.Sand;
}
