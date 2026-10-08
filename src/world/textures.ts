import * as THREE from 'three';
import { mulberry32 } from '../engine/noise.ts';
import { Tile } from './blocks.ts';

export const TILE_PX = 16;
export const ATLAS_COLS = 4;
export const ATLAS_ROWS = 4;

type RGB = [number, number, number];

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function tileOrigin(tile: number): [number, number] {
  return [(tile % ATLAS_COLS) * TILE_PX, Math.floor(tile / ATLAS_COLS) * TILE_PX];
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, c: RGB): void {
  ctx.fillStyle = `rgb(${clamp255(c[0])},${clamp255(c[1])},${clamp255(c[2])})`;
  ctx.fillRect(x, y, 1, 1);
}

function shade(base: RGB, amount: number): RGB {
  return [base[0] + amount, base[1] + amount, base[2] + amount];
}

/** Fills a tile with a flat colour plus per-pixel brightness noise. */
function paintNoise(
  ctx: CanvasRenderingContext2D,
  tile: number,
  base: RGB,
  variance: number,
  rand: () => number,
): void {
  const [ox, oy] = tileOrigin(tile);
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      px(ctx, ox + x, oy + y, shade(base, (rand() * 2 - 1) * variance));
    }
  }
}

function paintGrassSide(ctx: CanvasRenderingContext2D, rand: () => number): void {
  const [ox, oy] = tileOrigin(Tile.GrassSide);
  const dirt: RGB = [134, 96, 67];
  const grass: RGB = [94, 157, 66];

  for (let x = 0; x < TILE_PX; x++) {
    const lip = 3 + Math.floor(rand() * 3);
    for (let y = 0; y < TILE_PX; y++) {
      const base = y < lip ? grass : dirt;
      px(ctx, ox + x, oy + y, shade(base, (rand() * 2 - 1) * 16));
    }
  }
}

function paintLogSide(ctx: CanvasRenderingContext2D, rand: () => number): void {
  const [ox, oy] = tileOrigin(Tile.LogSide);
  const bark: RGB = [109, 80, 48];
  for (let x = 0; x < TILE_PX; x++) {
    const stripe = x % 4 === 0 ? -22 : 0;
    for (let y = 0; y < TILE_PX; y++) {
      px(ctx, ox + x, oy + y, shade(bark, stripe + (rand() * 2 - 1) * 12));
    }
  }
}

function paintLogTop(ctx: CanvasRenderingContext2D, rand: () => number): void {
  const [ox, oy] = tileOrigin(Tile.LogTop);
  const wood: RGB = [160, 126, 80];
  const center = (TILE_PX - 1) / 2;
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      const dist = Math.hypot(x - center, y - center);
      const ring = Math.sin(dist * 2.2) * 14;
      px(ctx, ox + x, oy + y, shade(wood, ring + (rand() * 2 - 1) * 8));
    }
  }
}

function paintPlanks(ctx: CanvasRenderingContext2D, rand: () => number): void {
  const [ox, oy] = tileOrigin(Tile.Planks);
  const wood: RGB = [168, 132, 80];
  for (let y = 0; y < TILE_PX; y++) {
    const seam = y % 4 === 0 ? -30 : 0;
    for (let x = 0; x < TILE_PX; x++) {
      px(ctx, ox + x, oy + y, shade(wood, seam + (rand() * 2 - 1) * 10));
    }
  }
}

function paintCobblestone(ctx: CanvasRenderingContext2D, rand: () => number): void {
  const [ox, oy] = tileOrigin(Tile.Cobblestone);
  const stone: RGB = [124, 124, 124];
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      const cellX = Math.floor(x / 4);
      const cellY = Math.floor(y / 4);
      const mortar = x % 4 === 0 || y % 4 === 0 ? -36 : 0;
      const tone = ((cellX * 7 + cellY * 13) % 5) * 6 - 12;
      px(ctx, ox + x, oy + y, shade(stone, mortar + tone + (rand() * 2 - 1) * 10));
    }
  }
}

function paintLeaves(ctx: CanvasRenderingContext2D, rand: () => number): void {
  const [ox, oy] = tileOrigin(Tile.Leaves);
  const leaf: RGB = [62, 124, 48];
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      const clump = rand() < 0.18 ? -34 : 0;
      px(ctx, ox + x, oy + y, shade(leaf, clump + (rand() * 2 - 1) * 20));
    }
  }
}

function paintCraftingTableTop(ctx: CanvasRenderingContext2D, rand: () => number): void {
  const [ox, oy] = tileOrigin(Tile.CraftingTableTop);
  const wood: RGB = [150, 115, 68];
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      const border = x < 1 || y < 1 || x > 14 || y > 14 ? -26 : 0;
      const grid = (x + 1) % 5 === 0 || (y + 1) % 5 === 0 ? -42 : 0;
      px(ctx, ox + x, oy + y, shade(wood, border + grid + (rand() * 2 - 1) * 8));
    }
  }
}

function paintCraftingTableSide(ctx: CanvasRenderingContext2D, rand: () => number): void {
  const [ox, oy] = tileOrigin(Tile.CraftingTableSide);
  const wood: RGB = [160, 124, 74];
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      // Dark tabletop band with a tool silhouette below it.
      const band = y < 4 ? -38 : 0;
      const tool = y > 6 && y < 12 && ((x > 3 && x < 6) || (x > 9 && x < 12)) ? -30 : 0;
      px(ctx, ox + x, oy + y, shade(wood, band + tool + (rand() * 2 - 1) * 9));
    }
  }
}

function paintLava(ctx: CanvasRenderingContext2D, rand: () => number): void {
  const [ox, oy] = tileOrigin(Tile.Lava);
  const molten: RGB = [214, 92, 18];
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      const roll = rand();
      const vein = roll > 0.88 ? 46 : roll < 0.14 ? -58 : 0;
      px(ctx, ox + x, oy + y, shade(molten, vein + (rand() * 2 - 1) * 16));
    }
  }
}

function buildAtlasCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_COLS * TILE_PX;
  canvas.height = ATLAS_ROWS * TILE_PX;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');

  const rand = mulberry32(1337);

  paintNoise(ctx, Tile.GrassTop, [92, 160, 64], 18, rand);
  paintGrassSide(ctx, rand);
  paintNoise(ctx, Tile.Dirt, [134, 96, 67], 18, rand);
  paintNoise(ctx, Tile.Stone, [128, 128, 128], 16, rand);
  paintNoise(ctx, Tile.Sand, [219, 206, 154], 14, rand);
  paintLogSide(ctx, rand);
  paintLogTop(ctx, rand);
  paintLeaves(ctx, rand);
  paintPlanks(ctx, rand);
  paintNoise(ctx, Tile.Water, [58, 110, 200], 12, rand);
  paintCobblestone(ctx, rand);
  paintNoise(ctx, Tile.Bedrock, [62, 62, 66], 26, rand);
  paintCraftingTableTop(ctx, rand);
  paintCraftingTableSide(ctx, rand);
  paintLava(ctx, rand);

  return canvas;
}

export const atlasCanvas = buildAtlasCanvas();

export interface TileUV {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

// Half-texel inset keeps neighbouring atlas tiles from bleeding into each other.
const INSET_U = 0.5 / (ATLAS_COLS * TILE_PX);
const INSET_V = 0.5 / (ATLAS_ROWS * TILE_PX);

export function tileUVBounds(tile: number): TileUV {
  const col = tile % ATLAS_COLS;
  const row = Math.floor(tile / ATLAS_COLS);
  return {
    u0: (col + INSET_U) / ATLAS_COLS,
    u1: (col + 1 - INSET_U) / ATLAS_COLS,
    // Canvas rows run top-down while UVs run bottom-up.
    v0: (ATLAS_ROWS - row - 1 + INSET_V) / ATLAS_ROWS,
    v1: (ATLAS_ROWS - row - INSET_V) / ATLAS_ROWS,
  };
}

let sharedTexture: THREE.CanvasTexture | null = null;

/** Single shared texture so animated tiles only need one upload per frame. */
export function atlasTexture(): THREE.CanvasTexture {
  if (!sharedTexture) {
    sharedTexture = new THREE.CanvasTexture(atlasCanvas);
    sharedTexture.magFilter = THREE.NearestFilter;
    sharedTexture.minFilter = THREE.NearestFilter;
    sharedTexture.generateMipmaps = false;
    sharedTexture.colorSpace = THREE.SRGBColorSpace;
  }
  return sharedTexture;
}

const ANIM_FRAMES = TILE_PX;

/** Vertically scrolling noise plus a travelling wave, looping seamlessly. */
function fluidFrames(base: RGB, noiseAmp: number, waveAmp: number, crest: number, seed: number): ImageData[] {
  const rand = mulberry32(seed);
  const noise = new Float32Array(TILE_PX * TILE_PX);
  for (let i = 0; i < noise.length; i++) noise[i] = rand() * 2 - 1;

  const frames: ImageData[] = [];
  for (let f = 0; f < ANIM_FRAMES; f++) {
    const pixels = new Uint8ClampedArray(TILE_PX * TILE_PX * 4);
    for (let y = 0; y < TILE_PX; y++) {
      for (let x = 0; x < TILE_PX; x++) {
        const sample = noise[(((y + f) % TILE_PX) * TILE_PX + x)];
        const wave = Math.sin(((y + f) / TILE_PX + x / TILE_PX) * Math.PI * 2) * waveAmp;
        const delta = sample * noiseAmp + wave + (sample > 0.7 ? crest : 0);
        const i = (y * TILE_PX + x) * 4;
        pixels[i] = clamp255(base[0] + delta);
        pixels[i + 1] = clamp255(base[1] + delta);
        pixels[i + 2] = clamp255(base[2] + delta);
        pixels[i + 3] = 255;
      }
    }
    frames.push(new ImageData(pixels, TILE_PX, TILE_PX));
  }
  return frames;
}

const waterFrames = fluidFrames([58, 110, 200], 10, 12, 26, 4242);
const lavaFrames = fluidFrames([214, 92, 18], 14, 18, 44, 777);

let lastWaterFrame = -1;
let lastLavaFrame = -1;

/** Advances the water and lava tiles; call once per rendered frame. */
export function updateFluidAnimation(time: number): void {
  const waterFrame = Math.floor(time * 7) % ANIM_FRAMES;
  const lavaFrame = Math.floor(time * 4) % ANIM_FRAMES;
  if (waterFrame === lastWaterFrame && lavaFrame === lastLavaFrame) return;

  lastWaterFrame = waterFrame;
  lastLavaFrame = lavaFrame;

  const ctx = atlasCanvas.getContext('2d');
  if (!ctx) return;

  const [wx, wy] = tileOrigin(Tile.Water);
  ctx.putImageData(waterFrames[waterFrame], wx, wy);
  const [lx, ly] = tileOrigin(Tile.Lava);
  ctx.putImageData(lavaFrames[lavaFrame], lx, ly);

  atlasTexture().needsUpdate = true;
}

/** Draws a single atlas tile scaled into a standalone canvas (used by the hotbar). */
export function drawTileTo(target: HTMLCanvasElement, tile: number): void {
  const ctx = target.getContext('2d');
  if (!ctx) return;
  const [ox, oy] = tileOrigin(tile);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, target.width, target.height);
  ctx.drawImage(atlasCanvas, ox, oy, TILE_PX, TILE_PX, 0, 0, target.width, target.height);
}
