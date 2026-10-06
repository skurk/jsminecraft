export const HOTBAR_SIZE = 9;
export class Hotbar {
    slots = new Array(HOTBAR_SIZE).fill(null);
    selected = 0;
    get item() {
        return this.slots[this.selected];
    }
    assign(index, item) {
        if (index < 0 || index >= HOTBAR_SIZE)
            return;
        // Keep assignments unique so an item never occupies two slots.
        const existing = this.slots.indexOf(item);
        if (item !== null && existing >= 0)
            this.slots[existing] = null;
        this.slots[index] = item;
    }
    has(item) {
        return this.slots.includes(item);
    }
    firstEmpty() {
        return this.slots.indexOf(null);
    }
}
