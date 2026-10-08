import { drawItemIcon, isBlockItem, itemName } from '../items/items.ts';
import type { Recipe } from '../items/recipes.ts';
import { RECIPES, craft, hasIngredients } from '../items/recipes.ts';
import type { Hotbar } from '../player/hotbar.ts';
import { HOTBAR_SIZE } from '../player/hotbar.ts';
import type { Inventory } from '../player/inventory.ts';

interface RecipeCard {
  recipe: Recipe;
  element: HTMLButtonElement;
}

function iconCanvas(size: number, id: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  drawItemIcon(canvas, id);
  return canvas;
}

/** Inventory screen: hotbar assignment, owned items and the recipe book. */
export class InventoryScreen {
  open = false;
  onClose: (() => void) | null = null;
  onChange: (() => void) | null = null;

  private readonly inventory: Inventory;
  private readonly hotbar: Hotbar;
  private readonly root: HTMLElement;
  private readonly note: HTMLElement;
  private readonly slotRow: HTMLElement;
  private readonly itemGrid: HTMLElement;
  private readonly cards: RecipeCard[] = [];
  private atTable = false;

  constructor(parent: HTMLElement, inventory: Inventory, hotbar: Hotbar) {
    this.inventory = inventory;
    this.hotbar = hotbar;

    this.root = document.createElement('div');
    this.root.className = 'inventory hidden';

    const panel = document.createElement('div');
    panel.className = 'inv-panel';

    const title = document.createElement('h2');
    title.textContent = 'Inventory';
    panel.appendChild(title);

    this.note = document.createElement('p');
    this.note.className = 'inv-note';
    panel.appendChild(this.note);

    panel.appendChild(this.section('Hotbar', 'Click a slot, then click an item to put it there.'));
    this.slotRow = document.createElement('div');
    this.slotRow.className = 'inv-hotbar';
    panel.appendChild(this.slotRow);

    panel.appendChild(this.section('Items', 'Everything you are carrying.'));
    this.itemGrid = document.createElement('div');
    this.itemGrid.className = 'inv-items';
    panel.appendChild(this.itemGrid);

    panel.appendChild(this.section('Crafting', null));
    const grid = document.createElement('div');
    grid.className = 'recipe-grid';
    for (const recipe of RECIPES) grid.appendChild(this.createRecipeCard(recipe));
    panel.appendChild(grid);

    const close = document.createElement('button');
    close.className = 'inv-close';
    close.textContent = 'Close (E)';
    close.addEventListener('click', () => this.close());
    panel.appendChild(close);

    this.root.appendChild(panel);
    parent.appendChild(this.root);
  }

  show(atTable: boolean): void {
    this.atTable = atTable;
    this.open = true;
    this.root.classList.remove('hidden');
    this.refresh();
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.root.classList.add('hidden');
    this.onClose?.();
  }

  refresh(): void {
    this.note.textContent = this.atTable
      ? 'Crafting table in use \u2014 all recipes available'
      : 'Hand crafting only \u2014 use a placed crafting table for tools';

    this.renderHotbar();
    this.renderItems();

    for (const card of this.cards) {
      const locked = card.recipe.requiresTable && !this.atTable;
      card.element.disabled = locked || !hasIngredients(this.inventory, card.recipe);
      card.element.classList.toggle('locked', locked);
    }
  }

  private section(title: string, hint: string | null): HTMLElement {
    const header = document.createElement('div');
    header.className = 'inv-section';

    const heading = document.createElement('h3');
    heading.textContent = title;
    header.appendChild(heading);

    if (hint) {
      const small = document.createElement('small');
      small.textContent = hint;
      header.appendChild(small);
    }
    return header;
  }

  private renderHotbar(): void {
    this.slotRow.replaceChildren();

    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const id = this.hotbar.slots[i];
      const slot = document.createElement('button');
      slot.className = 'inv-slot';
      slot.classList.toggle('selected', i === this.hotbar.selected);
      slot.title = id === null ? 'Empty' : itemName(id);

      if (id !== null) {
        slot.appendChild(iconCanvas(40, id));
        const count = this.inventory.count(id);
        if (isBlockItem(id) && count > 0) {
          const badge = document.createElement('span');
          badge.className = 'inv-count';
          badge.textContent = String(count);
          slot.appendChild(badge);
        }
      }

      const key = document.createElement('span');
      key.className = 'inv-key';
      key.textContent = String(i + 1);
      slot.appendChild(key);

      slot.addEventListener('click', () => {
        this.hotbar.selected = i;
        this.refresh();
        this.onChange?.();
      });
      slot.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        this.hotbar.assign(i, null);
        this.refresh();
        this.onChange?.();
      });

      this.slotRow.appendChild(slot);
    }
  }

  private renderItems(): void {
    this.itemGrid.replaceChildren();
    const owned = this.inventory.entries();

    if (owned.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'inv-empty';
      empty.textContent = 'Nothing collected yet \u2014 mine some blocks.';
      this.itemGrid.appendChild(empty);
      return;
    }

    for (const [id, count] of owned) {
      const button = document.createElement('button');
      button.className = 'inv-item';
      button.classList.toggle('equipped', this.hotbar.has(id));
      button.title = `${itemName(id)} x${count}`;
      button.appendChild(iconCanvas(40, id));

      const badge = document.createElement('span');
      badge.className = 'inv-count';
      badge.textContent = String(count);
      button.appendChild(badge);

      button.addEventListener('click', () => {
        this.hotbar.assign(this.hotbar.selected, id);
        this.refresh();
        this.onChange?.();
      });

      this.itemGrid.appendChild(button);
    }
  }

  private createRecipeCard(recipe: Recipe): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'recipe';
    button.appendChild(iconCanvas(44, recipe.result));

    const text = document.createElement('span');
    text.className = 'recipe-text';

    const name = document.createElement('b');
    name.textContent = recipe.count > 1 ? `${itemName(recipe.result)} x${recipe.count}` : itemName(recipe.result);
    text.appendChild(name);

    const cost = document.createElement('small');
    cost.textContent = recipe.ingredients
      .map((ingredient) => `${ingredient.count} ${itemName(ingredient.id)}`)
      .join(' + ');
    text.appendChild(cost);

    button.appendChild(text);
    button.addEventListener('click', () => {
      if (!craft(this.inventory, recipe, this.atTable)) return;
      // New gear goes straight to a free slot so it is usable immediately.
      if (!this.hotbar.has(recipe.result)) {
        const free = this.hotbar.firstEmpty();
        if (free >= 0) this.hotbar.assign(free, recipe.result);
      }
      this.refresh();
      this.onChange?.();
    });

    this.cards.push({ recipe, element: button });
    return button;
  }
}
