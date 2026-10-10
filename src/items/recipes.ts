import type { Inventory } from '../player/inventory.ts';
import { Block } from '../world/blocks.ts';
import { Item } from './items.ts';

export interface Ingredient {
  id: number;
  count: number;
}

export interface Recipe {
  result: number;
  count: number;
  /** Only craftable while a crafting table is open. */
  requiresTable: boolean;
  ingredients: Ingredient[];
}

export const RECIPES: Recipe[] = [
  { result: Block.Planks, count: 4, requiresTable: false, ingredients: [{ id: Block.Log, count: 1 }] },
  { result: Item.Stick, count: 4, requiresTable: false, ingredients: [{ id: Block.Planks, count: 2 }] },
  {
    result: Block.CraftingTable,
    count: 1,
    requiresTable: false,
    ingredients: [{ id: Block.Planks, count: 4 }],
  },
  {
    result: Item.WoodSword,
    count: 1,
    requiresTable: true,
    ingredients: [
      { id: Block.Planks, count: 2 },
      { id: Item.Stick, count: 1 },
    ],
  },
  {
    result: Item.WoodShovel,
    count: 1,
    requiresTable: true,
    ingredients: [
      { id: Block.Planks, count: 1 },
      { id: Item.Stick, count: 2 },
    ],
  },
  {
    result: Item.WoodPickaxe,
    count: 1,
    requiresTable: true,
    ingredients: [
      { id: Block.Planks, count: 3 },
      { id: Item.Stick, count: 2 },
    ],
  },
  {
    result: Item.WoodAxe,
    count: 1,
    requiresTable: true,
    ingredients: [
      { id: Block.Planks, count: 3 },
      { id: Item.Stick, count: 2 },
    ],
  },
  {
    result: Item.StoneSword,
    count: 1,
    requiresTable: true,
    ingredients: [
      { id: Block.Cobblestone, count: 2 },
      { id: Item.Stick, count: 1 },
    ],
  },
  {
    result: Item.StoneShovel,
    count: 1,
    requiresTable: true,
    ingredients: [
      { id: Block.Cobblestone, count: 1 },
      { id: Item.Stick, count: 2 },
    ],
  },
  {
    result: Item.StonePickaxe,
    count: 1,
    requiresTable: true,
    ingredients: [
      { id: Block.Cobblestone, count: 3 },
      { id: Item.Stick, count: 2 },
    ],
  },
  {
    result: Item.StoneAxe,
    count: 1,
    requiresTable: true,
    ingredients: [
      { id: Block.Cobblestone, count: 3 },
      { id: Item.Stick, count: 2 },
    ],
  },
  {
    result: Item.Bread,
    count: 1,
    requiresTable: true,
    ingredients: [{ id: Block.Wheat, count: 3 }],
  },
  {
    result: Block.Hay,
    count: 1,
    requiresTable: true,
    ingredients: [{ id: Block.Wheat, count: 9 }],
  },
  {
    result: Block.StoneBricks,
    count: 4,
    requiresTable: true,
    ingredients: [{ id: Block.Cobblestone, count: 4 }],
  },
];

export function hasIngredients(inventory: Inventory, recipe: Recipe): boolean {
  return recipe.ingredients.every((ingredient) => inventory.count(ingredient.id) >= ingredient.count);
}

export function craft(inventory: Inventory, recipe: Recipe, atTable: boolean): boolean {
  if (recipe.requiresTable && !atTable) return false;
  if (!hasIngredients(inventory, recipe)) return false;

  for (const ingredient of recipe.ingredients) inventory.take(ingredient.id, ingredient.count);
  inventory.add(recipe.result, recipe.count);
  return true;
}
