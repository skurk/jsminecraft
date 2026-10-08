import type { DifficultyId } from '../engine/difficulty.ts';
import { DIFFICULTIES } from '../engine/difficulty.ts';
import { drawItemIcon, isBlockItem, itemName } from '../items/items.ts';

export class Hud {
  onSelectDifficulty: ((id: DifficultyId) => void) | null = null;

  private readonly slots: HTMLElement[] = [];
  private readonly icons: HTMLCanvasElement[] = [];
  private readonly counts: HTMLElement[] = [];
  private readonly rendered: (number | null)[] = [];
  private readonly hearts: HTMLElement[] = [];
  private readonly overlay: HTMLElement;
  private readonly debug: HTMLElement;
  private readonly flash: HTMLElement;
  private readonly banner: HTMLElement;
  private readonly miningBar: HTMLElement;
  private readonly miningFill: HTMLElement;
  private readonly fire: HTMLElement;
  private readonly difficultyButtons: HTMLButtonElement[] = [];

  constructor(root: HTMLElement, slotCount: number) {
    const crosshair = document.createElement('div');
    crosshair.className = 'crosshair';
    root.appendChild(crosshair);

    const health = document.createElement('div');
    health.className = 'health';
    for (let i = 0; i < 10; i++) {
      const heart = document.createElement('span');
      heart.className = 'heart';
      heart.textContent = '\u2665';
      health.appendChild(heart);
      this.hearts.push(heart);
    }
    root.appendChild(health);

    const hotbar = document.createElement('div');
    hotbar.className = 'hotbar';
    for (let index = 0; index < slotCount; index++) {
      const slot = document.createElement('div');
      slot.className = 'slot empty';

      const icon = document.createElement('canvas');
      icon.width = 48;
      icon.height = 48;
      slot.appendChild(icon);
      this.icons.push(icon);
      this.rendered.push(null);

      const label = document.createElement('span');
      label.className = 'slot-key';
      label.textContent = String(index + 1);
      slot.appendChild(label);

      const count = document.createElement('span');
      count.className = 'slot-count';
      slot.appendChild(count);
      this.counts.push(count);

      hotbar.appendChild(slot);
      this.slots.push(slot);
    }
    root.appendChild(hotbar);

    this.debug = document.createElement('div');
    this.debug.className = 'debug';
    root.appendChild(this.debug);

    this.flash = document.createElement('div');
    this.flash.className = 'damage-flash';
    root.appendChild(this.flash);

    this.banner = document.createElement('div');
    this.banner.className = 'banner hidden';
    root.appendChild(this.banner);

    this.miningBar = document.createElement('div');
    this.miningBar.className = 'mining-bar hidden';
    this.miningFill = document.createElement('div');
    this.miningBar.appendChild(this.miningFill);
    root.appendChild(this.miningBar);

    this.fire = document.createElement('div');
    this.fire.className = 'fire hidden';
    root.appendChild(this.fire);

    this.overlay = document.createElement('div');
    this.overlay.className = 'overlay';

    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
      <h1>jsminecraft</h1>
      <p class="hint">Pick a difficulty to play</p>`;

    const choices = document.createElement('div');
    choices.className = 'difficulty';
    for (const difficulty of Object.values(DIFFICULTIES)) {
      const button = document.createElement('button');
      button.className = 'difficulty-btn';
      button.innerHTML = `<b></b><small></small>`;
      button.querySelector('b')!.textContent = difficulty.name;
      button.querySelector('small')!.textContent = difficulty.description;
      // Handled on mousedown so the click is not lost when pointer lock engages.
      button.addEventListener('mousedown', (event) => {
        event.stopPropagation();
        this.onSelectDifficulty?.(difficulty.id);
      });
      choices.appendChild(button);
      this.difficultyButtons.push(button);
    }
    panel.appendChild(choices);

    const controls = document.createElement('ul');
    controls.innerHTML = `
      <li><b>WASD</b> move &middot; <b>Shift</b> sprint &middot; <b>Space</b> jump</li>
      <li><b>Hold left click</b> mine &middot; <b>Left click</b> attack &middot; <b>Right click</b> place / use</li>
      <li><b>1-9</b> select slot &middot; <b>E</b> inventory &amp; crafting &middot; <b>F</b> flight &middot; <b>Esc</b> release cursor</li>
      <li>Mine logs, craft planks and sticks, then place a crafting table for tools.</li>
      <li class="warn">Zombies and spiders spawn in the dark &mdash; stay in the light.</li>`;
    panel.appendChild(controls);

    this.overlay.appendChild(panel);
    root.appendChild(this.overlay);

    this.setSelected(0);
  }

  setSelected(index: number): void {
    this.slots.forEach((slot, i) => slot.classList.toggle('selected', i === index));
  }

  setHotbar(items: readonly (number | null)[], counts: readonly number[]): void {
    items.forEach((id, i) => {
      if (this.rendered[i] !== id) {
        this.rendered[i] = id;
        const icon = this.icons[i];
        icon.getContext('2d')?.clearRect(0, 0, icon.width, icon.height);
        if (id !== null) drawItemIcon(icon, id);
        this.slots[i].title = id === null ? '' : itemName(id);
      }

      const count = counts[i] ?? 0;
      const showCount = id !== null && isBlockItem(id) && count > 0;
      this.counts[i].textContent = showCount ? String(count) : '';
      this.slots[i].classList.toggle('empty', id === null || count === 0);
    });
  }

  setHealth(health: number, maxHealth: number): void {
    const perHeart = maxHealth / this.hearts.length;
    this.hearts.forEach((heart, i) => {
      const filled = health - i * perHeart;
      const state = filled >= perHeart ? 'full' : filled > 0 ? 'half' : 'empty';
      heart.className = `heart ${state}`;
    });
  }

  flashDamage(): void {
    this.flash.classList.remove('active');
    void this.flash.offsetWidth;
    this.flash.classList.add('active');
  }

  setMiningProgress(progress: number | null): void {
    this.miningBar.classList.toggle('hidden', progress === null);
    if (progress !== null) this.miningFill.style.width = `${Math.min(1, progress) * 100}%`;
  }

  setBurning(burning: boolean): void {
    this.fire.classList.toggle('hidden', !burning);
  }

  showBanner(text: string | null): void {
    this.banner.textContent = text ?? '';
    this.banner.classList.toggle('hidden', text === null);
  }

  setDebug(text: string): void {
    this.debug.textContent = text;
  }

  setOverlayVisible(visible: boolean): void {
    this.overlay.classList.toggle('hidden', !visible);
  }

  setDifficulty(id: DifficultyId): void {
    const order = Object.keys(DIFFICULTIES) as DifficultyId[];
    this.difficultyButtons.forEach((button, i) => button.classList.toggle('active', order[i] === id));
  }
}
