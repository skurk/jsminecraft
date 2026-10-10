import { Block } from '../world/blocks.ts';

export const HOTBAR_SIZE = 9;

const DEFAULT_SLOTS: (number | null)[] = [
  Block.Grass,
  Block.Dirt,
  Block.Cobblestone,
  Block.Sand,
  Block.Log,
  Block.Planks,
  Block.CraftingTable,
  Block.Leaves,
  null,
];

export class Hotbar {
  readonly slots: (number | null)[] = [...DEFAULT_SLOTS];
  selected = 0;

  get item(): number | null {
    return this.slots[this.selected];
  }

  assign(index: number, item: number | null): void {
    if (index < 0 || index >= HOTBAR_SIZE) return;
    // Keep assignments unique so an item never occupies two slots.
    const existing = this.slots.indexOf(item);
    if (item !== null && existing >= 0) this.slots[existing] = null;
    this.slots[index] = item;
  }

  has(item: number): boolean {
    return this.slots.includes(item);
  }

  firstEmpty(): number {
    return this.slots.indexOf(null);
  }
}
