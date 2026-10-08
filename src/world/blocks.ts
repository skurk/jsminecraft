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
} as const;

export interface BlockDef {
  name: string;
  /** Stops the player from walking through it. */
  solid: boolean;
  /** Rendered in the translucent pass. */
  liquid: boolean;
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
