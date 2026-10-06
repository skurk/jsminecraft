import * as THREE from 'three';
import { BLOCKS } from "../world/blocks.js";
import { drawTileTo } from "../world/textures.js";
import { Item } from "./ids.js";
export { Item };
const WOOD_HEAD = 0xa9813f;
const STONE_HEAD = 0x8f8f8f;
export const ITEMS = {
    [Item.Stick]: { name: 'Stick', color: 0x9b7442, tool: null },
    [Item.WoodSword]: { name: 'Wooden Sword', color: WOOD_HEAD, tool: { kind: 'sword', speed: 1, damage: 5 } },
    [Item.WoodShovel]: { name: 'Wooden Shovel', color: WOOD_HEAD, tool: { kind: 'shovel', speed: 3, damage: 2 } },
    [Item.WoodPickaxe]: { name: 'Wooden Pickaxe', color: WOOD_HEAD, tool: { kind: 'pickaxe', speed: 3, damage: 2 } },
    [Item.WoodAxe]: { name: 'Wooden Axe', color: WOOD_HEAD, tool: { kind: 'axe', speed: 3, damage: 3 } },
    [Item.StoneSword]: { name: 'Stone Sword', color: STONE_HEAD, tool: { kind: 'sword', speed: 1, damage: 7 } },
    [Item.StoneShovel]: { name: 'Stone Shovel', color: STONE_HEAD, tool: { kind: 'shovel', speed: 6, damage: 3 } },
    [Item.StonePickaxe]: { name: 'Stone Pickaxe', color: STONE_HEAD, tool: { kind: 'pickaxe', speed: 6, damage: 3 } },
    [Item.StoneAxe]: { name: 'Stone Axe', color: STONE_HEAD, tool: { kind: 'axe', speed: 6, damage: 4 } },
    [Item.Apple]: { name: 'Apple', color: 0xd4312a, tool: null, food: { heal: 4, sickness: 0 } },
    [Item.RawChicken]: { name: 'Raw Chicken', color: 0xf0bfae, tool: null, food: { heal: 3, sickness: 0 } },
    [Item.RawPork]: { name: 'Raw Porkchop', color: 0xf09a9a, tool: null, food: { heal: 5, sickness: 0 } },
    [Item.Mutton]: { name: 'Raw Mutton', color: 0xd4625c, tool: null, food: { heal: 4, sickness: 0 } },
    // Edible in a pinch: a little healing, then a stretch of illness.
    [Item.RottenFlesh]: { name: 'Rotten Flesh', color: 0x7a6a3a, tool: null, food: { heal: 4, sickness: 8 } },
    [Item.Egg]: { name: 'Egg', color: 0xf2eadb, tool: null, throwable: true },
    [Item.Coal]: { name: 'Coal', color: 0x2c2c33, tool: null, sprite: true },
};
export function isBlockItem(id) {
    return id < 100;
}
/** Items that pile up in a stack and need a count badge. */
export function isStackable(id) {
    return isBlockItem(id) || ITEMS[id].food !== undefined || ITEMS[id].throwable === true ||
        ITEMS[id].sprite === true;
}
export function foodOf(id) {
    if (id === null || isBlockItem(id))
        return null;
    return ITEMS[id].food ?? null;
}
export function itemName(id) {
    return isBlockItem(id) ? BLOCKS[id].name : ITEMS[id].name;
}
export function toolOf(id) {
    if (id === null || isBlockItem(id))
        return null;
    return ITEMS[id].tool;
}
const HANDLE = '#8a6a40';
function drawHandle(ctx, s) {
    ctx.fillStyle = HANDLE;
    ctx.fillRect(-0.05 * s, -0.04 * s, 0.1 * s, 0.5 * s);
}
function drawToolIcon(ctx, size, id) {
    const def = ITEMS[id];
    const head = `#${def.color.toString(16).padStart(6, '0')}`;
    const s = size;
    ctx.save();
    ctx.translate(s * 0.5, s * 0.5);
    // Tools read best lying on the icon's diagonal, like the original sprites.
    ctx.rotate(Math.PI / 4);
    if (id === Item.Stick) {
        ctx.fillStyle = HANDLE;
        ctx.fillRect(-0.055 * s, -0.3 * s, 0.11 * s, 0.6 * s);
        ctx.restore();
        return;
    }
    const kind = def.tool?.kind;
    drawHandle(ctx, s);
    ctx.fillStyle = head;
    if (kind === 'sword') {
        ctx.fillRect(-0.06 * s, -0.42 * s, 0.12 * s, 0.4 * s);
        ctx.fillStyle = HANDLE;
        ctx.fillRect(-0.17 * s, -0.06 * s, 0.34 * s, 0.09 * s);
    }
    else if (kind === 'shovel') {
        ctx.fillRect(-0.13 * s, -0.42 * s, 0.26 * s, 0.26 * s);
    }
    else if (kind === 'pickaxe') {
        ctx.beginPath();
        ctx.moveTo(-0.34 * s, -0.26 * s);
        ctx.quadraticCurveTo(0, -0.52 * s, 0.34 * s, -0.26 * s);
        ctx.lineTo(0.26 * s, -0.15 * s);
        ctx.quadraticCurveTo(0, -0.36 * s, -0.26 * s, -0.15 * s);
        ctx.closePath();
        ctx.fill();
    }
    else if (kind === 'axe') {
        ctx.beginPath();
        ctx.moveTo(-0.04 * s, -0.42 * s);
        ctx.lineTo(-0.32 * s, -0.3 * s);
        ctx.lineTo(-0.3 * s, -0.06 * s);
        ctx.lineTo(-0.04 * s, -0.12 * s);
        ctx.closePath();
        ctx.fill();
    }
    ctx.restore();
}
function hex(color) {
    return `#${color.toString(16).padStart(6, '0')}`;
}
function ellipse(ctx, cx, cy, rx, ry, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
}
/** Chunky food sprites drawn from a few primitives. */
function drawFoodIcon(ctx, size, id) {
    const s = size;
    if (id === Item.Apple) {
        ellipse(ctx, s * 0.42, s * 0.6, s * 0.24, s * 0.26, hex(ITEMS[id].color));
        ellipse(ctx, s * 0.62, s * 0.6, s * 0.2, s * 0.24, '#b5231d');
        ctx.fillStyle = '#6b4423';
        ctx.fillRect(s * 0.48, s * 0.22, s * 0.05, s * 0.16);
        ellipse(ctx, s * 0.63, s * 0.27, s * 0.11, s * 0.06, '#4f9b3c');
        return;
    }
    if (id === Item.Egg) {
        ellipse(ctx, s * 0.5, s * 0.54, s * 0.22, s * 0.28, hex(ITEMS[id].color));
        ellipse(ctx, s * 0.42, s * 0.42, s * 0.07, s * 0.09, '#ffffff');
        return;
    }
    if (id === Item.Coal) {
        const base = hex(ITEMS[id].color);
        ctx.fillStyle = base;
        ctx.beginPath();
        ctx.moveTo(s * 0.26, s * 0.46);
        ctx.lineTo(s * 0.46, s * 0.24);
        ctx.lineTo(s * 0.76, s * 0.38);
        ctx.lineTo(s * 0.72, s * 0.7);
        ctx.lineTo(s * 0.44, s * 0.78);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.fillRect(s * 0.38, s * 0.38, s * 0.14, s * 0.08);
        return;
    }
    const base = hex(ITEMS[id].color);
    if (id === Item.RottenFlesh) {
        ctx.fillStyle = base;
        ctx.beginPath();
        ctx.moveTo(s * 0.2, s * 0.4);
        ctx.lineTo(s * 0.42, s * 0.2);
        ctx.lineTo(s * 0.74, s * 0.3);
        ctx.lineTo(s * 0.8, s * 0.62);
        ctx.lineTo(s * 0.52, s * 0.82);
        ctx.lineTo(s * 0.26, s * 0.68);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#5d5228';
        for (const [x, y] of [[0.36, 0.42], [0.56, 0.36], [0.5, 0.6], [0.66, 0.54]])
            ellipse(ctx, s * x, s * y, s * 0.06, s * 0.05, '#5d5228');
        return;
    }
    ellipse(ctx, s * 0.5, s * 0.55, s * 0.28, s * 0.22, base);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fillRect(s * 0.3, s * 0.46, s * 0.4, s * 0.05);
    if (id === Item.RawChicken) {
        ctx.fillStyle = '#efe6d2';
        ctx.fillRect(s * 0.68, s * 0.5, s * 0.18, s * 0.07);
    }
}
/** Renders any item (block or tool) into a canvas for the HUD. */
export function drawItemIcon(canvas, id) {
    if (isBlockItem(id)) {
        drawTileTo(canvas, BLOCKS[id].top);
        return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx)
        return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (ITEMS[id].food || ITEMS[id].throwable || ITEMS[id].sprite)
        drawFoodIcon(ctx, canvas.width, id);
    else
        drawToolIcon(ctx, canvas.width, id);
}
const textureCache = new Map();
/** Icon as a texture, used for the item held in the player's hand. */
export function itemTexture(id) {
    const cached = textureCache.get(id);
    if (cached)
        return cached;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    drawItemIcon(canvas, id);
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    textureCache.set(id, texture);
    return texture;
}
