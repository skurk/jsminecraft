import { DIFFICULTIES } from "../engine/difficulty.js";
import { drawItemIcon, isStackable, itemName } from "../items/items.js";
export class Hud {
    onSelectDifficulty = null;
    slots = [];
    icons = [];
    counts = [];
    rendered = [];
    hearts = [];
    bubbles = [];
    airRow;
    overlay;
    debug;
    flash;
    banner;
    miningBar;
    miningFill;
    fire;
    sick;
    toast;
    difficultyButtons = [];
    constructor(root, slotCount) {
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
        this.airRow = document.createElement('div');
        this.airRow.className = 'air hidden';
        for (let i = 0; i < 10; i++) {
            const bubble = document.createElement('span');
            bubble.className = 'bubble';
            bubble.textContent = '\u25cf';
            this.airRow.appendChild(bubble);
            this.bubbles.push(bubble);
        }
        root.appendChild(this.airRow);
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
        this.sick = document.createElement('div');
        this.sick.className = 'sick hidden';
        root.appendChild(this.sick);
        this.toast = document.createElement('div');
        this.toast.className = 'toast';
        root.appendChild(this.toast);
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
            button.querySelector('b').textContent = difficulty.name;
            button.querySelector('small').textContent = difficulty.description;
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
      <li><b>WASD</b> move &middot; <b>Shift</b> or <b>double-tap W</b> sprint &middot; <b>Space</b> jump</li>
      <li><b>Mouse</b> or <b>arrow keys</b> look around</li>
      <li><b>Hold left click</b> or <b>Ctrl</b> mine &middot; <b>Left click</b> attack &middot; <b>Right click</b> place / use</li>
      <li><b>1-9</b> or <b>scroll</b> select slot &middot; <b>E</b> inventory &amp; crafting &middot; <b>F</b> flight &middot; <b>Esc</b> release cursor</li>
      <li>Mine logs, craft planks and sticks, then place a crafting table for tools.</li>
      <li>Find a village: <b>right click</b> a villager to trade, and feed them bread to grow the village.</li>
      <li class="warn">Zombies and spiders spawn in the dark &mdash; stay in the light.</li>`;
        panel.appendChild(controls);
        this.overlay.appendChild(panel);
        root.appendChild(this.overlay);
        this.setSelected(0);
    }
    setSelected(index) {
        this.slots.forEach((slot, i) => slot.classList.toggle('selected', i === index));
    }
    setHotbar(items, counts) {
        items.forEach((id, i) => {
            if (this.rendered[i] !== id) {
                this.rendered[i] = id;
                const icon = this.icons[i];
                icon.getContext('2d')?.clearRect(0, 0, icon.width, icon.height);
                if (id !== null)
                    drawItemIcon(icon, id);
                this.slots[i].title = id === null ? '' : itemName(id);
            }
            const count = counts[i] ?? 0;
            const showCount = id !== null && isStackable(id) && count > 0;
            this.counts[i].textContent = showCount ? String(count) : '';
            this.slots[i].classList.toggle('empty', id === null || count === 0);
        });
    }
    setHealth(health, maxHealth) {
        const perHeart = maxHealth / this.hearts.length;
        this.hearts.forEach((heart, i) => {
            const filled = health - i * perHeart;
            const state = filled >= perHeart ? 'full' : filled > 0 ? 'half' : 'empty';
            heart.className = `heart ${state}`;
        });
    }
    flashDamage() {
        this.flash.classList.remove('active');
        void this.flash.offsetWidth;
        this.flash.classList.add('active');
    }
    setAir(fraction) {
        this.airRow.classList.toggle('hidden', fraction >= 1);
        const filled = Math.ceil(fraction * this.bubbles.length);
        this.bubbles.forEach((bubble, i) => bubble.classList.toggle('empty', i >= filled));
    }
    setMiningProgress(progress) {
        this.miningBar.classList.toggle('hidden', progress === null);
        if (progress !== null)
            this.miningFill.style.width = `${Math.min(1, progress) * 100}%`;
    }
    setBurning(burning) {
        this.fire.classList.toggle('hidden', !burning);
    }
    setSick(sick) {
        this.sick.classList.toggle('hidden', !sick);
    }
    /** Brief self-clearing message above the hotbar. */
    showToast(text) {
        this.toast.textContent = text;
        this.toast.classList.remove('active');
        void this.toast.offsetWidth;
        this.toast.classList.add('active');
    }
    showBanner(text) {
        this.banner.textContent = text ?? '';
        this.banner.classList.toggle('hidden', text === null);
    }
    setDebug(text) {
        this.debug.textContent = text;
    }
    setOverlayVisible(visible) {
        this.overlay.classList.toggle('hidden', !visible);
    }
    setDifficulty(id) {
        const order = Object.keys(DIFFICULTIES);
        this.difficultyButtons.forEach((button, i) => button.classList.toggle('active', order[i] === id));
    }
}
