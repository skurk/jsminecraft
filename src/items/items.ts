import * as THREE from 'three';
import { BLOCKS } from '../world/blocks.ts';
import { drawTileTo } from '../world/textures.ts';

export type ToolKind = 'sword' | 'shovel' | 'pickaxe' | 'axe';

/** Non-block items live above the block id range. */
export const Item = {
  Stick: 100,
  WoodSword: 110,
  WoodShovel: 111,
  WoodPickaxe: 112,
  WoodAxe: 113,
  StoneSword: 120,
  StoneShovel: 121,
  StonePickaxe: 122,
  StoneAxe: 123,
} as const;

export interface ToolDef {
  kind: ToolKind;
  /** Mining speed multiplier against blocks matching `kind`. */
  speed: number;
  damage: number;
}

export interface ItemDef {
  name: string;
  /** Head colour of the icon; the handle is always wood. */
  color: number;
  tool: ToolDef | null;
}

const WOOD_HEAD = 0xa9813f;
const STONE_HEAD = 0x8f8f8f;

export const ITEMS: Record<number, ItemDef> = {
  [Item.Stick]: { name: 'Stick', color: 0x9b7442, tool: null },
  [Item.WoodSword]: { name: 'Wooden Sword', color: WOOD_HEAD, tool: { kind: 'sword', speed: 1, damage: 5 } },
  [Item.WoodShovel]: { name: 'Wooden Shovel', color: WOOD_HEAD, tool: { kind: 'shovel', speed: 3, damage: 2 } },
  [Item.WoodPickaxe]: { name: 'Wooden Pickaxe', color: WOOD_HEAD, tool: { kind: 'pickaxe', speed: 3, damage: 2 } },
  [Item.WoodAxe]: { name: 'Wooden Axe', color: WOOD_HEAD, tool: { kind: 'axe', speed: 3, damage: 3 } },
  [Item.StoneSword]: { name: 'Stone Sword', color: STONE_HEAD, tool: { kind: 'sword', speed: 1, damage: 7 } },
  [Item.StoneShovel]: { name: 'Stone Shovel', color: STONE_HEAD, tool: { kind: 'shovel', speed: 6, damage: 3 } },
  [Item.StonePickaxe]: { name: 'Stone Pickaxe', color: STONE_HEAD, tool: { kind: 'pickaxe', speed: 6, damage: 3 } },
  [Item.StoneAxe]: { name: 'Stone Axe', color: STONE_HEAD, tool: { kind: 'axe', speed: 6, damage: 4 } },
};

export function isBlockItem(id: number): boolean {
  return id < 100;
}

export function itemName(id: number): string {
  return isBlockItem(id) ? BLOCKS[id].name : ITEMS[id].name;
}

export function toolOf(id: number | null): ToolDef | null {
  if (id === null || isBlockItem(id)) return null;
  return ITEMS[id].tool;
}

const HANDLE = '#8a6a40';

function drawHandle(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.fillStyle = HANDLE;
  ctx.fillRect(-0.05 * s, -0.04 * s, 0.1 * s, 0.5 * s);
}

function drawToolIcon(ctx: CanvasRenderingContext2D, size: number, id: number): void {
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
  } else if (kind === 'shovel') {
    ctx.fillRect(-0.13 * s, -0.42 * s, 0.26 * s, 0.26 * s);
  } else if (kind === 'pickaxe') {
    ctx.beginPath();
    ctx.moveTo(-0.34 * s, -0.26 * s);
    ctx.quadraticCurveTo(0, -0.52 * s, 0.34 * s, -0.26 * s);
    ctx.lineTo(0.26 * s, -0.15 * s);
    ctx.quadraticCurveTo(0, -0.36 * s, -0.26 * s, -0.15 * s);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'axe') {
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

/** Renders any item (block or tool) into a canvas for the HUD. */
export function drawItemIcon(canvas: HTMLCanvasElement, id: number): void {
  if (isBlockItem(id)) {
    drawTileTo(canvas, BLOCKS[id].top);
    return;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawToolIcon(ctx, canvas.width, id);
}

const textureCache = new Map<number, THREE.Texture>();

/** Icon as a texture, used for the item held in the player's hand. */
export function itemTexture(id: number): THREE.Texture {
  const cached = textureCache.get(id);
  if (cached) return cached;

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
