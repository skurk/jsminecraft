export class Inventory {
    counts = new Map();
    count(blockId) {
        return this.counts.get(blockId) ?? 0;
    }
    add(blockId, amount = 1) {
        this.counts.set(blockId, this.count(blockId) + amount);
    }
    /** Removes one stack item, returning false when the slot is empty. */
    take(blockId, amount = 1) {
        const held = this.count(blockId);
        if (held < amount)
            return false;
        this.counts.set(blockId, held - amount);
        return true;
    }
    /** Owned items as [id, count] pairs, ordered by id. */
    entries() {
        return [...this.counts.entries()]
            .filter(([, count]) => count > 0)
            .sort((a, b) => a[0] - b[0]);
    }
}
