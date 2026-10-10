import * as THREE from 'three';
import { mulberry32 } from '../engine/noise.ts';
import { Tile } from './blocks.ts';

export const TILE_PX = 16;
export const ATLAS_COLS = 8;
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

function paintPath(ctx: CanvasRenderingContext2D, rand: () => number): void {
  const [ox, oy] = tileOrigin(Tile.PathTop);
  const packed: RGB = [150, 122, 86];
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      const rut = y % 7 === 3 || y % 11 === 8 ? -14 : 0;
      const pebble = rand() < 0.06 ? 24 : 0;
      px(ctx, ox + x, oy + y, shade(packed, rut + pebble + (rand() * 2 - 1) * 10));
    }
  }
}

function paintFarmland(ctx: CanvasRenderingContext2D, rand: () => number): void {
  const [ox, oy] = tileOrigin(Tile.Farmland);
  const tilled: RGB = [96, 66, 42];
  for (let y = 0; y < TILE_PX; y++) {
    const furrow = y % 4 === 0 ? -24 : y % 4 === 1 ? 14 : 0;
    for (let x = 0; x < TILE_PX; x++) {
      px(ctx, ox + x, oy + y, shade(tilled, furrow + (rand() * 2 - 1) * 9));
    }
  }
}

/** Thin stalks topped with grain, on a transparent background. */
function paintWheat(ctx: CanvasRenderingContext2D, rand: () => number): void {
  const [ox, oy] = tileOrigin(Tile.Wheat);
  const grain: RGB = [222, 196, 86];
  const husk: RGB = [176, 146, 52];
  const stem: RGB = [150, 150, 70];

  for (let i = 0; i < 4; i++) {
    const column = 1 + i * 4;
    const top = 1 + (i % 2);
    const earEnd = top + 8;

    for (let y = top; y < TILE_PX; y++) {
      const base = y < earEnd ? husk : stem;
      px(ctx, ox + column, oy + y, shade(base, (rand() * 2 - 1) * 10));
    }

    // Grain hangs off alternating sides of the stalk.
    for (let y = top + 1; y < earEnd; y += 2) {
      px(ctx, ox + column - 1, oy + y, shade(grain, (rand() * 2 - 1) * 12));
      px(ctx, ox + column + 1, oy + y + 1, shade(grain, (rand() * 2 - 1) * 12));
    }
  }
}

function paintHayTop(ctx: CanvasRenderingContext2D, rand: () => number): void {
  const [ox, oy] = tileOrigin(Tile.HayTop);
  const cut: RGB = [178, 148, 56];
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      const ring = (x > 2 && x < 13 && y > 2 && y < 13) ? -18 : 0;
      px(ctx, ox + x, oy + y, shade(cut, ring + (rand() * 2 - 1) * 16));
    }
  }
}

function paintHaySide(ctx: CanvasRenderingContext2D, rand: () => number): void {
  const [ox, oy] = tileOrigin(Tile.HaySide);
  const straw: RGB = [190, 160, 60];
  for (let y = 0; y < TILE_PX; y++) {
    const band = y === 1 || y === 14 ? -40 : 0;
    for (let x = 0; x < TILE_PX; x++) {
      px(ctx, ox + x, oy + y, shade(straw, band + (rand() * 2 - 1) * 14));
    }
  }
}

function paintBedTop(ctx: CanvasRenderingContext2D, rand: () => number): void {
  const [ox, oy] = tileOrigin(Tile.BedTop);
  const quilt: RGB = [170, 48, 48];
  const pillow: RGB = [226, 226, 226];
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      const base = y < 5 ? pillow : quilt;
      const seam = y === 5 ? -40 : 0;
      px(ctx, ox + x, oy + y, shade(base, seam + (rand() * 2 - 1) * 10));
    }
  }
}

function paintBedSide(ctx: CanvasRenderingContext2D, rand: () => number): void {
  const [ox, oy] = tileOrigin(Tile.BedSide);
  const quilt: RGB = [160, 44, 44];
  const frame: RGB = [138, 104, 62];
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      const base = y > 10 ? frame : quilt;
      px(ctx, ox + x, oy + y, shade(base, (rand() * 2 - 1) * 10));
    }
  }
}

/** Pane edges only; the middle stays transparent. */
function paintGlass(ctx: CanvasRenderingContext2D, rand: () => number): void {
  const [ox, oy] = tileOrigin(Tile.Glass);
  const pane: RGB = [198, 226, 240];
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      const edge = x === 0 || y === 0 || x === TILE_PX - 1 || y === TILE_PX - 1;
      const glint = x + y === 5 || x + y === 7 || x - y === 6;
      if (!edge && !glint) continue;
      px(ctx, ox + x, oy + y, shade(pane, edge ? -36 : 16 + (rand() * 2 - 1) * 6));
    }
  }
}

function paintStoneBricks(ctx: CanvasRenderingContext2D, rand: () => number): void {
  const [ox, oy] = tileOrigin(Tile.StoneBricks);
  const brick: RGB = [122, 122, 118];
  for (let y = 0; y < TILE_PX; y++) {
    const row = Math.floor(y / 8);
    for (let x = 0; x < TILE_PX; x++) {
      const shifted = (x + row * 8) % 16;
      const mortar = y % 8 === 0 || shifted === 0 ? -34 : 0;
      px(ctx, ox + x, oy + y, shade(brick, mortar + (rand() * 2 - 1) * 9));
    }
  }
}

function paintComposterTop(ctx: CanvasRenderingContext2D, rand: () => number): void {
  const [ox, oy] = tileOrigin(Tile.ComposterTop);
  const wood: RGB = [146, 112, 66];
  const compost: RGB = [96, 118, 48];
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      const inside = x > 2 && x < 13 && y > 2 && y < 13;
      px(ctx, ox + x, oy + y, shade(inside ? compost : wood, (rand() * 2 - 1) * 14));
    }
  }
}

function paintComposterSide(ctx: CanvasRenderingContext2D, rand: () => number): void {
  const [ox, oy] = tileOrigin(Tile.ComposterSide);
  const wood: RGB = [150, 116, 68];
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      const slat = y % 5 === 0 ? -34 : 0;
      const post = x < 2 || x > 13 ? -18 : 0;
      px(ctx, ox + x, oy + y, shade(wood, slat + post + (rand() * 2 - 1) * 8));
    }
  }
}

function paintSmithingTop(ctx: CanvasRenderingContext2D, rand: () => number): void {
  const [ox, oy] = tileOrigin(Tile.SmithingTop);
  const iron: RGB = [96, 100, 110];
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      const anvil = x > 3 && x < 12 && y > 4 && y < 11 ? 32 : 0;
      px(ctx, ox + x, oy + y, shade(iron, anvil + (rand() * 2 - 1) * 10));
    }
  }
}

function paintSmithingSide(ctx: CanvasRenderingContext2D, rand: () => number): void {
  const [ox, oy] = tileOrigin(Tile.SmithingSide);
  const wood: RGB = [92, 70, 54];
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      const top = y < 4 ? 26 : 0;
      const leg = (x > 1 && x < 4) || (x > 11 && x < 14) ? -22 : 0;
      px(ctx, ox + x, oy + y, shade(wood, top + leg + (rand() * 2 - 1) * 8));
    }
  }
}

function paintFletchingTop(ctx: CanvasRenderingContext2D, rand: () => number): void {
  const [ox, oy] = tileOrigin(Tile.FletchingTop);
  const wood: RGB = [168, 138, 92];
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      // Two crossed arrows scratched into the bench.
      const cross = Math.abs(x - y) < 2 || Math.abs(x + y - 15) < 2 ? -36 : 0;
      px(ctx, ox + x, oy + y, shade(wood, cross + (rand() * 2 - 1) * 8));
    }
  }
}

function paintFletchingSide(ctx: CanvasRenderingContext2D, rand: () => number): void {
  const [ox, oy] = tileOrigin(Tile.FletchingSide);
  const wood: RGB = [160, 130, 86];
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      const top = y < 3 ? -30 : 0;
      const fletch = y > 5 && y < 12 && x % 5 === 2 ? -26 : 0;
      px(ctx, ox + x, oy + y, shade(wood, top + fletch + (rand() * 2 - 1) * 8));
    }
  }
}

function paintBellTop(ctx: CanvasRenderingContext2D, rand: () => number): void {
  const [ox, oy] = tileOrigin(Tile.BellTop);
  const beam: RGB = [118, 88, 56];
  const gold: RGB = [214, 176, 64];
  const center = (TILE_PX - 1) / 2;
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      const cap = Math.hypot(x - center, y - center) < 4;
      px(ctx, ox + x, oy + y, shade(cap ? gold : beam, (rand() * 2 - 1) * 10));
    }
  }
}

function paintBellSide(ctx: CanvasRenderingContext2D, rand: () => number): void {
  const [ox, oy] = tileOrigin(Tile.BellSide);
  const beam: RGB = [118, 88, 56];
  const gold: RGB = [206, 168, 60];
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      // Bell body flares out towards the bottom.
      const halfWidth = 2 + Math.floor(y * 0.3);
      const bell = y > 2 && Math.abs(x - 7.5) < halfWidth;
      px(ctx, ox + x, oy + y, shade(bell ? gold : beam, (rand() * 2 - 1) * 10));
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
  paintPath(ctx, rand);
  paintFarmland(ctx, rand);
  paintWheat(ctx, rand);
  paintHayTop(ctx, rand);
  paintHaySide(ctx, rand);
  paintBedTop(ctx, rand);
  paintBedSide(ctx, rand);
  paintGlass(ctx, rand);
  paintStoneBricks(ctx, rand);
  paintComposterTop(ctx, rand);
  paintComposterSide(ctx, rand);
  paintSmithingTop(ctx, rand);
  paintSmithingSide(ctx, rand);
  paintFletchingTop(ctx, rand);
  paintFletchingSide(ctx, rand);
  paintBellTop(ctx, rand);
  paintBellSide(ctx, rand);

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
