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
    // Village blocks.
    Path: 39,
    Farmland: 40,
    Wheat: 41,
    Hay: 42,
    Bed: 43,
    Glass: 44,
    StoneBricks: 45,
    Composter: 46,
    SmithingTable: 47,
    FletchingTable: 48,
    Bell: 49,
    // Plants. Wheat above is the ripe stage, which doubles as the harvested item.
    TallGrass: 50,
    WheatSprout: 51,
    WheatYoung: 52,
    WheatTall: 53,
    // First of 16 door states: lower/upper half x four facings x open/closed.
    Door: 54,
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
    PathTop: 32,
    Farmland: 33,
    Wheat: 34,
    HayTop: 35,
    HaySide: 36,
    BedTop: 37,
    BedSide: 38,
    Glass: 39,
    StoneBricks: 40,
    ComposterTop: 41,
    ComposterSide: 42,
    SmithingTop: 43,
    SmithingSide: 44,
    FletchingTop: 45,
    FletchingSide: 46,
    BellTop: 47,
    BellSide: 48,
    TallGrass: 49,
    WheatSprout: 50,
    WheatYoung: 51,
    WheatTall: 52,
    DoorLower: 53,
    DoorUpper: 54,
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
// Village building materials, crops and job site blocks. Must stay last so the
// array indices keep matching the Block ids above.
BLOCKS.push({
    name: 'Dirt Path',
    solid: true,
    liquid: false,
    top: Tile.PathTop,
    side: Tile.Dirt,
    bottom: Tile.Dirt,
    hardness: 0.65,
    tool: 'shovel',
    requiresTool: false,
    drop: Block.Dirt,
}, {
    name: 'Farmland',
    solid: true,
    liquid: false,
    top: Tile.Farmland,
    side: Tile.Dirt,
    bottom: Tile.Dirt,
    hardness: 0.6,
    tool: 'shovel',
    requiresTool: false,
    drop: Block.Dirt,
}, {
    name: 'Wheat',
    solid: false,
    liquid: false,
    top: Tile.Wheat,
    side: Tile.Wheat,
    bottom: Tile.Wheat,
    hardness: 0.1,
    tool: null,
    requiresTool: false,
    drop: Block.Wheat,
    drops: [{ id: Block.Wheat }, { id: Item.Seeds, min: 0, max: 3 }],
    full: false,
    cutout: true,
    cross: true,
    placeable: false,
}, {
    name: 'Hay Bale',
    solid: true,
    liquid: false,
    top: Tile.HayTop,
    side: Tile.HaySide,
    bottom: Tile.HayTop,
    hardness: 0.5,
    tool: null,
    requiresTool: false,
    drop: Block.Hay,
}, {
    name: 'Bed',
    solid: true,
    liquid: false,
    top: Tile.BedTop,
    side: Tile.BedSide,
    bottom: Tile.Planks,
    hardness: 0.2,
    tool: null,
    requiresTool: false,
    drop: Block.Bed,
}, {
    name: 'Glass',
    solid: true,
    liquid: false,
    top: Tile.Glass,
    side: Tile.Glass,
    bottom: Tile.Glass,
    hardness: 0.3,
    tool: null,
    requiresTool: false,
    drop: Block.Air,
    full: false,
    cutout: true,
}, {
    name: 'Stone Bricks',
    solid: true,
    liquid: false,
    top: Tile.StoneBricks,
    side: Tile.StoneBricks,
    bottom: Tile.StoneBricks,
    hardness: 1.5,
    tool: 'pickaxe',
    requiresTool: true,
    drop: Block.StoneBricks,
}, {
    name: 'Composter',
    solid: true,
    liquid: false,
    top: Tile.ComposterTop,
    side: Tile.ComposterSide,
    bottom: Tile.Planks,
    hardness: 0.6,
    tool: 'axe',
    requiresTool: false,
    drop: Block.Composter,
}, {
    name: 'Smithing Table',
    solid: true,
    liquid: false,
    top: Tile.SmithingTop,
    side: Tile.SmithingSide,
    bottom: Tile.Planks,
    hardness: 2.5,
    tool: 'axe',
    requiresTool: false,
    drop: Block.SmithingTable,
}, {
    name: 'Fletching Table',
    solid: true,
    liquid: false,
    top: Tile.FletchingTop,
    side: Tile.FletchingSide,
    bottom: Tile.Planks,
    hardness: 2.5,
    tool: 'axe',
    requiresTool: false,
    drop: Block.FletchingTable,
}, {
    name: 'Bell',
    solid: true,
    liquid: false,
    top: Tile.BellTop,
    side: Tile.BellSide,
    bottom: Tile.BellSide,
    hardness: 3,
    tool: 'pickaxe',
    requiresTool: true,
    drop: Block.Bell,
}, {
    name: 'Grass',
    solid: false,
    liquid: false,
    top: Tile.TallGrass,
    side: Tile.TallGrass,
    bottom: Tile.TallGrass,
    hardness: 0.05,
    tool: null,
    requiresTool: false,
    drop: Block.Air,
    // One clump in eight gives up a seed, as in the Overworld.
    drops: [{ id: Item.Seeds, chance: 0.125 }],
    full: false,
    cutout: true,
    cross: true,
    placeable: false,
}, {
    name: 'Wheat Crop',
    solid: false,
    liquid: false,
    top: Tile.WheatSprout,
    side: Tile.WheatSprout,
    bottom: Tile.WheatSprout,
    hardness: 0.05,
    tool: null,
    requiresTool: false,
    drop: Item.Seeds,
    full: false,
    cutout: true,
    cross: true,
    placeable: false,
}, {
    name: 'Wheat Crop',
    solid: false,
    liquid: false,
    top: Tile.WheatYoung,
    side: Tile.WheatYoung,
    bottom: Tile.WheatYoung,
    hardness: 0.05,
    tool: null,
    requiresTool: false,
    drop: Item.Seeds,
    full: false,
    cutout: true,
    cross: true,
    placeable: false,
}, {
    name: 'Wheat Crop',
    solid: false,
    liquid: false,
    top: Tile.WheatTall,
    side: Tile.WheatTall,
    bottom: Tile.WheatTall,
    hardness: 0.05,
    tool: null,
    requiresTool: false,
    drop: Item.Seeds,
    full: false,
    cutout: true,
    cross: true,
    placeable: false,
});
/**
 * The way a door looks, as the horizontal normal of its closed face. `angle` is
 * the Y rotation that turns the canonical north-facing door into this one.
 */
export const DOOR_FACINGS = [
    { dx: 0, dz: -1, angle: 0 },
    { dx: -1, dz: 0, angle: Math.PI / 2 },
    { dx: 0, dz: 1, angle: Math.PI },
    { dx: 1, dz: 0, angle: -Math.PI / 2 },
];
export const DoorFacing = { North: 0, West: 1, South: 2, East: 3 };
const DOOR_STATES = DOOR_FACINGS.length * 4;
// Doors carry their own geometry, so the chunk mesher skips them; only the id
// matters here, for collision and for what the block drops.
for (let state = 0; state < DOOR_STATES; state++) {
    const upper = state >= DOOR_STATES / 2;
    const open = state % 2 === 1;
    const tile = upper ? Tile.DoorUpper : Tile.DoorLower;
    BLOCKS.push({
        name: 'Oak Door',
        solid: !open,
        liquid: false,
        top: tile,
        side: tile,
        bottom: tile,
        hardness: 0.6,
        tool: 'axe',
        requiresTool: false,
        drop: Item.Door,
        // Only the lower half yields the door, so breaking either gives one back.
        drops: upper ? [] : [{ id: Item.Door }],
        full: false,
        placeable: false,
    });
}
export function isDoor(id) {
    return id >= Block.Door && id < Block.Door + DOOR_STATES;
}
export function isDoorUpper(id) {
    return id - Block.Door >= DOOR_STATES / 2;
}
export function isDoorOpen(id) {
    return (id - Block.Door) % 2 === 1;
}
export function doorFacing(id) {
    return Math.floor(((id - Block.Door) % (DOOR_STATES / 2)) / 2);
}
export function doorId(upper, facing, open) {
    return Block.Door + (upper ? DOOR_STATES / 2 : 0) + facing * 2 + (open ? 1 : 0);
}
export function toggledDoor(id) {
    return isDoorOpen(id) ? id - 1 : id + 1;
}
const UNIT_BOX = [0, 0, 0, 1, 1, 1];
/** False for blocks that do not fill their voxel, so neighbours keep their faces. */
export function isFullBlock(id) {
    return BLOCKS[id].full !== false;
}
export function blockBox(id) {
    return BLOCKS[id].box ?? UNIT_BOX;
}
/** Alpha-tested blocks such as glass and crops. */
export function isCutout(id) {
    return BLOCKS[id].cutout === true;
}
/** Drawn as intersecting planes instead of a cube, like crops. */
export function isCross(id) {
    return BLOCKS[id].cross === true;
}
/** False for harvested goods that are carried but never put back in the world. */
export function isPlaceable(id) {
    return BLOCKS[id].placeable !== false;
}
/** Wheat from sprout to ripe; only the last stage yields grain. */
export const WHEAT_STAGES = [Block.WheatSprout, Block.WheatYoung, Block.WheatTall, Block.Wheat];
export function isCrop(id) {
    return WHEAT_STAGES.includes(id);
}
/** The stage a crop grows into, or null once it is ripe. */
export function nextCropStage(id) {
    const stage = WHEAT_STAGES.indexOf(id);
    return stage >= 0 && stage < WHEAT_STAGES.length - 1 ? WHEAT_STAGES[stage + 1] : null;
}
export function isPlant(id) {
    return id === Block.TallGrass || isCrop(id);
}
/** Plants pop off when the ground they need is taken away. */
export function canPlantStay(id, soil) {
    if (isCrop(id))
        return soil === Block.Farmland || soil === Block.Grass;
    if (id === Block.TallGrass)
        return soil === Block.Grass || soil === Block.Dirt || soil === Block.Farmland;
    return true;
}
/** Ground wheat seeds take root in; farmland is just the tended version. */
export function isSowable(id) {
    return id === Block.Farmland || id === Block.Grass;
}
/** Blocks a hoe turns into farmland. */
export function isTillable(id) {
    return id === Block.Grass || id === Block.Dirt;
}
/** Rolls what a broken block leaves behind; chance and count cover crops and grass. */
export function blockDrops(id) {
    const def = BLOCKS[id];
    const spawned = [];
    for (const entry of def.drops ?? [{ id: def.drop }]) {
        if (entry.chance !== undefined && Math.random() >= entry.chance)
            continue;
        const count = entry.max === undefined
            ? entry.count ?? 1
            : entry.min + Math.floor(Math.random() * (entry.max - entry.min + 1));
        for (let i = 0; i < count; i++)
            spawned.push(entry.id);
    }
    return spawned;
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
    if (isDoor(id))
        return 'wood';
    switch (id) {
        case Block.Grass:
        case Block.TallGrass:
        case Block.Wheat:
        case Block.WheatSprout:
        case Block.WheatYoung:
        case Block.WheatTall:
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
/** Tree stems, as opposed to worked wood like planks. */
export function isLog(id) {
    return id === Block.Log || id === Block.BirchLog || id === Block.PineLog;
}
