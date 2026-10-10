import type { ToolKind } from '../items/items.ts';

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
  // Village blocks start after the flowing water range.
  Path: 17,
  Farmland: 18,
  Wheat: 19,
  Hay: 20,
  Bed: 21,
  Glass: 22,
  StoneBricks: 23,
  Composter: 24,
  SmithingTable: 25,
  FletchingTable: 26,
  Bell: 27,
} as const;

export type BlockId = (typeof Block)[keyof typeof Block];

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
  PathTop: 15,
  Farmland: 16,
  Wheat: 17,
  HayTop: 18,
  HaySide: 19,
  BedTop: 20,
  BedSide: 21,
  Glass: 22,
  StoneBricks: 23,
  ComposterTop: 24,
  ComposterSide: 25,
  SmithingTop: 26,
  SmithingSide: 27,
  FletchingTop: 28,
  FletchingSide: 29,
  BellTop: 30,
  BellSide: 31,
} as const;

export interface BlockDef {
  name: string;
  /** Stops the player from walking through it. */
  solid: boolean;
  /** Rendered in the translucent pass. */
  liquid: boolean;
  /** Rendered in the alpha-tested pass, and never hides a neighbour's face. */
  cutout?: boolean;
  /** Drawn as intersecting planes instead of a cube, like crops. */
  cross?: boolean;
  /** False for harvested goods that are carried but never put back in the world. */
  placeable?: boolean;
  top: number;
  side: number;
  bottom: number;
  /** Base seconds to mine by hand; Infinity means unbreakable. */
  hardness: number;
  tool: ToolKind | null;
  /** Drops nothing unless mined with the matching tool. */
  requiresTool: boolean;
  drop: number;
}

export const BLOCKS: BlockDef[] = [
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
export const MAX_WATER_SPREAD = 4;

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

// Village building materials, crops and job site blocks.
BLOCKS.push(
  {
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
  },
  {
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
  },
  {
    name: 'Wheat',
    solid: false,
    liquid: false,
    cutout: true,
    cross: true,
    placeable: false,
    top: Tile.Wheat,
    side: Tile.Wheat,
    bottom: Tile.Wheat,
    hardness: 0.1,
    tool: null,
    requiresTool: false,
    drop: Block.Wheat,
  },
  {
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
  },
  {
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
  },
  {
    name: 'Glass',
    solid: true,
    liquid: false,
    cutout: true,
    top: Tile.Glass,
    side: Tile.Glass,
    bottom: Tile.Glass,
    hardness: 0.3,
    tool: null,
    requiresTool: false,
    drop: Block.Air,
  },
  {
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
  },
  {
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
  },
  {
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
  },
  {
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
  },
  {
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
  },
);

export function isSolid(id: number): boolean {
  return BLOCKS[id].solid;
}

export function isWater(id: number): boolean {
  return id === Block.Water || (id >= Block.WaterFlow1 && id <= Block.WaterFlow4);
}

/** 0 for a source block, 1..MAX_WATER_SPREAD for flows. */
export function waterLevel(id: number): number {
  return id === Block.Water ? 0 : id - Block.WaterFlow1 + 1;
}

export function waterFlowId(level: number): number {
  return Block.WaterFlow1 + Math.min(level, MAX_WATER_SPREAD) - 1;
}

/** 0 when not a fluid; water variants and lava each share a group. */
export function fluidGroup(id: number): number {
  if (isWater(id)) return 1;
  if (id === Block.Lava) return 2;
  return 0;
}
export function isLiquid(id: number): boolean {
  return BLOCKS[id].liquid;
}

/** Alpha-tested blocks such as glass and crops. */
export function isCutout(id: number): boolean {
  return BLOCKS[id].cutout === true;
}

export function isCross(id: number): boolean {
  return BLOCKS[id].cross === true;
}

export function isPlaceable(id: number): boolean {
  return BLOCKS[id].placeable !== false;
}

export function isAir(id: number): boolean {
  return id === Block.Air;
}

export function isBreakable(id: number): boolean {
  return id !== Block.Air && Number.isFinite(BLOCKS[id].hardness);
}

/** Blocks that fall when the space below them is free. */
export function hasGravity(id: number): boolean {
  return id === Block.Sand;
}
