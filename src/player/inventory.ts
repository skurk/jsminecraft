export class Inventory {
  private readonly counts = new Map<number, number>();

  count(blockId: number): number {
    return this.counts.get(blockId) ?? 0;
  }

  add(blockId: number, amount = 1): void {
    this.counts.set(blockId, this.count(blockId) + amount);
  }

  /** Removes one stack item, returning false when the slot is empty. */
  take(blockId: number, amount = 1): boolean {
    const held = this.count(blockId);
    if (held < amount) return false;
    this.counts.set(blockId, held - amount);
    return true;
  }

  /** Owned items as [id, count] pairs, ordered by id. */
  entries(): [number, number][] {
    return [...this.counts.entries()]
      .filter(([, count]) => count > 0)
      .sort((a, b) => a[0] - b[0]);
  }
}
