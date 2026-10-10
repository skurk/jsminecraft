import type { Villager } from '../entities/villager.ts';
import type { TradeOffer } from '../entities/villager.ts';
import { drawItemIcon, itemName } from '../items/items.ts';
import type { Inventory } from '../player/inventory.ts';

function iconCanvas(size: number, id: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  drawItemIcon(canvas, id);
  return canvas;
}

/** Villager trading window: emeralds in, goods out. */
export class TradeScreen {
  open = false;
  onClose: (() => void) | null = null;
  onChange: (() => void) | null = null;

  private readonly inventory: Inventory;
  private readonly root: HTMLElement;
  private readonly title: HTMLElement;
  private readonly subtitle: HTMLElement;
  private readonly offers: HTMLElement;
  private villager: Villager | null = null;

  constructor(parent: HTMLElement, inventory: Inventory) {
    this.inventory = inventory;

    this.root = document.createElement('div');
    this.root.className = 'inventory hidden';

    const panel = document.createElement('div');
    panel.className = 'inv-panel trade-panel';

    this.title = document.createElement('h2');
    panel.appendChild(this.title);

    this.subtitle = document.createElement('p');
    this.subtitle.className = 'inv-note';
    panel.appendChild(this.subtitle);

    this.offers = document.createElement('div');
    this.offers.className = 'trade-list';
    panel.appendChild(this.offers);

    const close = document.createElement('button');
    close.className = 'inv-close';
    close.textContent = 'Close (E)';
    close.addEventListener('click', () => this.close());
    panel.appendChild(close);

    this.root.appendChild(panel);
    parent.appendChild(this.root);
  }

  show(villager: Villager): void {
    this.villager = villager;
    this.open = true;
    this.root.classList.remove('hidden');
    this.refresh();
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.villager = null;
    this.root.classList.add('hidden');
    this.onClose?.();
  }

  refresh(): void {
    const villager = this.villager;
    if (!villager) return;

    this.title.textContent = villager.name;
    this.subtitle.textContent = `${villager.levelName} \u2014 ${villager.xp} XP`;

    this.offers.replaceChildren();
    const trades = villager.availableTrades;

    if (trades.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'inv-empty';
      empty.textContent = 'No offers available.';
      this.offers.appendChild(empty);
      return;
    }

    for (const trade of trades) this.offers.appendChild(this.createRow(villager, trade));
  }

  private createRow(villager: Villager, trade: TradeOffer): HTMLElement {
    const soldOut = trade.uses >= trade.maxUses;
    const affordable = trade.cost.every((stack) => this.inventory.count(stack.id) >= stack.count);

    const row = document.createElement('button');
    row.className = 'trade';
    row.disabled = soldOut || !affordable;
    row.classList.toggle('sold-out', soldOut);

    const cost = document.createElement('span');
    cost.className = 'trade-side';
    for (const stack of trade.cost) cost.appendChild(this.stack(stack.id, stack.count));
    row.appendChild(cost);

    const arrow = document.createElement('span');
    arrow.className = 'trade-arrow';
    arrow.textContent = '\u2192';
    row.appendChild(arrow);

    const result = document.createElement('span');
    result.className = 'trade-side';
    result.appendChild(this.stack(trade.result.id, trade.result.count));
    row.appendChild(result);

    const status = document.createElement('small');
    status.className = 'trade-status';
    status.textContent = soldOut ? 'Out of stock' : `${trade.maxUses - trade.uses} left`;
    row.appendChild(status);

    row.addEventListener('click', () => {
      if (!this.apply(villager, trade)) return;
      this.refresh();
      this.onChange?.();
    });

    return row;
  }

  private stack(id: number, count: number): HTMLElement {
    const wrapper = document.createElement('span');
    wrapper.className = 'trade-stack';
    wrapper.title = `${itemName(id)} x${count}`;
    wrapper.appendChild(iconCanvas(36, id));

    const badge = document.createElement('span');
    badge.className = 'inv-count';
    badge.textContent = String(count);
    wrapper.appendChild(badge);
    return wrapper;
  }

  private apply(villager: Villager, trade: TradeOffer): boolean {
    if (trade.uses >= trade.maxUses) return false;
    if (!trade.cost.every((stack) => this.inventory.count(stack.id) >= stack.count)) return false;

    for (const stack of trade.cost) this.inventory.take(stack.id, stack.count);
    this.inventory.add(trade.result.id, trade.result.count);
    villager.completeTrade(trade);
    return true;
  }
}
