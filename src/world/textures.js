import * as THREE from 'three';
import { mulberry32 } from "../engine/noise.js";
import { Tile } from "./blocks.js";
export const TILE_PX = 16;
export const ATLAS_COLS = 8;
export const ATLAS_ROWS = 8;
function clamp255(v) {
    return Math.max(0, Math.min(255, Math.round(v)));
}
function tileOrigin(tile) {
    return [(tile % ATLAS_COLS) * TILE_PX, Math.floor(tile / ATLAS_COLS) * TILE_PX];
}
function px(ctx, x, y, c) {
    ctx.fillStyle = `rgb(${clamp255(c[0])},${clamp255(c[1])},${clamp255(c[2])})`;
    ctx.fillRect(x, y, 1, 1);
}
function shade(base, amount) {
    return [base[0] + amount, base[1] + amount, base[2] + amount];
}
/** Fills a tile with a flat colour plus per-pixel brightness noise. */
function paintNoise(ctx, tile, base, variance, rand) {
    const [ox, oy] = tileOrigin(tile);
    for (let y = 0; y < TILE_PX; y++) {
        for (let x = 0; x < TILE_PX; x++) {
            px(ctx, ox + x, oy + y, shade(base, (rand() * 2 - 1) * variance));
        }
    }
}
function paintGrassSide(ctx, rand) {
    const [ox, oy] = tileOrigin(Tile.GrassSide);
    const dirt = [134, 96, 67];
    const grass = [94, 157, 66];
    for (let x = 0; x < TILE_PX; x++) {
        const lip = 3 + Math.floor(rand() * 3);
        for (let y = 0; y < TILE_PX; y++) {
            const base = y < lip ? grass : dirt;
            px(ctx, ox + x, oy + y, shade(base, (rand() * 2 - 1) * 16));
        }
    }
}
function paintLogSide(ctx, rand) {
    const [ox, oy] = tileOrigin(Tile.LogSide);
    const bark = [109, 80, 48];
    for (let x = 0; x < TILE_PX; x++) {
        const stripe = x % 4 === 0 ? -22 : 0;
        for (let y = 0; y < TILE_PX; y++) {
            px(ctx, ox + x, oy + y, shade(bark, stripe + (rand() * 2 - 1) * 12));
        }
    }
}
function paintLogTop(ctx, rand) {
    const [ox, oy] = tileOrigin(Tile.LogTop);
    const wood = [160, 126, 80];
    const center = (TILE_PX - 1) / 2;
    for (let y = 0; y < TILE_PX; y++) {
        for (let x = 0; x < TILE_PX; x++) {
            const dist = Math.hypot(x - center, y - center);
            const ring = Math.sin(dist * 2.2) * 14;
            px(ctx, ox + x, oy + y, shade(wood, ring + (rand() * 2 - 1) * 8));
        }
    }
}
function paintPlanks(ctx, rand) {
    const [ox, oy] = tileOrigin(Tile.Planks);
    const wood = [168, 132, 80];
    for (let y = 0; y < TILE_PX; y++) {
        const seam = y % 4 === 0 ? -30 : 0;
        for (let x = 0; x < TILE_PX; x++) {
            px(ctx, ox + x, oy + y, shade(wood, seam + (rand() * 2 - 1) * 10));
        }
    }
}
function paintCobblestone(ctx, rand) {
    const [ox, oy] = tileOrigin(Tile.Cobblestone);
    const stone = [124, 124, 124];
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
function paintLeaves(ctx, rand) {
    const [ox, oy] = tileOrigin(Tile.Leaves);
    const leaf = [62, 124, 48];
    for (let y = 0; y < TILE_PX; y++) {
        for (let x = 0; x < TILE_PX; x++) {
            const clump = rand() < 0.18 ? -34 : 0;
            px(ctx, ox + x, oy + y, shade(leaf, clump + (rand() * 2 - 1) * 20));
        }
    }
}
function paintCraftingTableTop(ctx, rand) {
    const [ox, oy] = tileOrigin(Tile.CraftingTableTop);
    const wood = [150, 115, 68];
    for (let y = 0; y < TILE_PX; y++) {
        for (let x = 0; x < TILE_PX; x++) {
            const border = x < 1 || y < 1 || x > 14 || y > 14 ? -26 : 0;
            const grid = (x + 1) % 5 === 0 || (y + 1) % 5 === 0 ? -42 : 0;
            px(ctx, ox + x, oy + y, shade(wood, border + grid + (rand() * 2 - 1) * 8));
        }
    }
}
function paintCraftingTableSide(ctx, rand) {
    const [ox, oy] = tileOrigin(Tile.CraftingTableSide);
    const wood = [160, 124, 74];
    for (let y = 0; y < TILE_PX; y++) {
        for (let x = 0; x < TILE_PX; x++) {
            // Dark tabletop band with a tool silhouette below it.
            const band = y < 4 ? -38 : 0;
            const tool = y > 6 && y < 12 && ((x > 3 && x < 6) || (x > 9 && x < 12)) ? -30 : 0;
            px(ctx, ox + x, oy + y, shade(wood, band + tool + (rand() * 2 - 1) * 9));
        }
    }
}
function paintLava(ctx, rand) {
    const [ox, oy] = tileOrigin(Tile.Lava);
    const molten = [214, 92, 18];
    for (let y = 0; y < TILE_PX; y++) {
        for (let x = 0; x < TILE_PX; x++) {
            const roll = rand();
            const vein = roll > 0.88 ? 46 : roll < 0.14 ? -58 : 0;
            px(ctx, ox + x, oy + y, shade(molten, vein + (rand() * 2 - 1) * 16));
        }
    }
}
/** Stone speckled with ore blobs. */
function paintOre(ctx, tile, color, rand) {
    const [ox, oy] = tileOrigin(tile);
    const stone = [128, 128, 128];
    for (let y = 0; y < TILE_PX; y++) {
        for (let x = 0; x < TILE_PX; x++) {
            px(ctx, ox + x, oy + y, shade(stone, (rand() * 2 - 1) * 16));
        }
    }
    for (let blob = 0; blob < 5; blob++) {
        const bx = 2 + Math.floor(rand() * 12);
        const by = 2 + Math.floor(rand() * 12);
        const radius = 1 + Math.floor(rand() * 2);
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                if (dx * dx + dy * dy > radius * radius + 1)
                    continue;
                const x = bx + dx;
                const y = by + dy;
                if (x < 0 || y < 0 || x >= TILE_PX || y >= TILE_PX)
                    continue;
                px(ctx, ox + x, oy + y, shade(color, (rand() * 2 - 1) * 18));
            }
        }
    }
}
function paintIce(ctx, rand) {
    const [ox, oy] = tileOrigin(Tile.Ice);
    const ice = [150, 196, 232];
    for (let y = 0; y < TILE_PX; y++) {
        for (let x = 0; x < TILE_PX; x++) {
            const crack = (x + y) % 7 === 0 || (x - y + 16) % 11 === 0 ? -24 : 0;
            px(ctx, ox + x, oy + y, shade(ice, crack + (rand() * 2 - 1) * 10));
        }
    }
}
function paintTorch(ctx, rand) {
    const [ox, oy] = tileOrigin(Tile.Torch);
    for (let y = 0; y < TILE_PX; y++) {
        for (let x = 0; x < TILE_PX; x++) {
            const stick = x >= 6 && x <= 9 && y >= 6;
            const flame = x >= 5 && x <= 10 && y >= 2 && y < 6;
            const core = x >= 6 && x <= 9 && y >= 3 && y < 6;
            if (core)
                px(ctx, ox + x, oy + y, shade([255, 236, 150], (rand() * 2 - 1) * 18));
            else if (flame)
                px(ctx, ox + x, oy + y, shade([244, 158, 42], (rand() * 2 - 1) * 24));
            else if (stick)
                px(ctx, ox + x, oy + y, shade([122, 88, 52], (rand() * 2 - 1) * 14));
            else
                px(ctx, ox + x, oy + y, [24, 18, 12]);
        }
    }
}
/** Leaf canopy in an arbitrary shade, with darker clumps punched through it. */
function paintFoliage(ctx, tile, base, clumpChance, rand) {
    const [ox, oy] = tileOrigin(tile);
    for (let y = 0; y < TILE_PX; y++) {
        for (let x = 0; x < TILE_PX; x++) {
            const clump = rand() < clumpChance ? -34 : 0;
            px(ctx, ox + x, oy + y, shade(base, clump + (rand() * 2 - 1) * 20));
        }
    }
}
function paintBirchLogSide(ctx, rand) {
    const [ox, oy] = tileOrigin(Tile.BirchLogSide);
    const bark = [214, 210, 192];
    for (let x = 0; x < TILE_PX; x++) {
        for (let y = 0; y < TILE_PX; y++) {
            // Short dark dashes are what read as birch at this size.
            const dash = (y % 5 === 2 && x % 7 < 3) || (y % 7 === 5 && x % 9 < 2) ? -78 : 0;
            px(ctx, ox + x, oy + y, shade(bark, dash + (rand() * 2 - 1) * 10));
        }
    }
}
function paintBirchLogTop(ctx, rand) {
    const [ox, oy] = tileOrigin(Tile.BirchLogTop);
    const wood = [206, 192, 160];
    const center = (TILE_PX - 1) / 2;
    for (let y = 0; y < TILE_PX; y++) {
        for (let x = 0; x < TILE_PX; x++) {
            const ring = Math.sin(Math.hypot(x - center, y - center) * 2.2) * 10;
            px(ctx, ox + x, oy + y, shade(wood, ring + (rand() * 2 - 1) * 7));
        }
    }
}
function paintPineLogSide(ctx, rand) {
    const [ox, oy] = tileOrigin(Tile.PineLogSide);
    const bark = [74, 54, 36];
    for (let x = 0; x < TILE_PX; x++) {
        const groove = x % 5 === 0 ? -26 : x % 5 === 3 ? -12 : 0;
        for (let y = 0; y < TILE_PX; y++) {
            px(ctx, ox + x, oy + y, shade(bark, groove + (rand() * 2 - 1) * 14));
        }
    }
}
function paintCactusSide(ctx, rand) {
    const [ox, oy] = tileOrigin(Tile.CactusSide);
    const flesh = [58, 118, 56];
    for (let x = 0; x < TILE_PX; x++) {
        const rib = x % 6 === 0 ? -30 : x % 6 === 3 ? 14 : 0;
        for (let y = 0; y < TILE_PX; y++) {
            px(ctx, ox + x, oy + y, shade(flesh, rib + (rand() * 2 - 1) * 10));
        }
    }
    for (let y = 1; y < TILE_PX; y += 4) {
        for (let x = 2; x < TILE_PX; x += 6) {
            px(ctx, ox + x, oy + y, [226, 226, 196]);
        }
    }
}
function paintCactusTop(ctx, rand) {
    const [ox, oy] = tileOrigin(Tile.CactusTop);
    const flesh = [68, 134, 64];
    const center = (TILE_PX - 1) / 2;
    for (let y = 0; y < TILE_PX; y++) {
        for (let x = 0; x < TILE_PX; x++) {
            const inner = Math.hypot(x - center, y - center) < 4.5 ? 22 : 0;
            px(ctx, ox + x, oy + y, shade(flesh, inner + (rand() * 2 - 1) * 10));
        }
    }
}
function paintPath(ctx, rand) {
    const [ox, oy] = tileOrigin(Tile.PathTop);
    const packed = [150, 122, 86];
    for (let y = 0; y < TILE_PX; y++) {
        for (let x = 0; x < TILE_PX; x++) {
            const rut = y % 7 === 3 || y % 11 === 8 ? -14 : 0;
            const pebble = rand() < 0.06 ? 24 : 0;
            px(ctx, ox + x, oy + y, shade(packed, rut + pebble + (rand() * 2 - 1) * 10));
        }
    }
}
function paintFarmland(ctx, rand) {
    const [ox, oy] = tileOrigin(Tile.Farmland);
    const tilled = [96, 66, 42];
    for (let y = 0; y < TILE_PX; y++) {
        const furrow = y % 4 === 0 ? -24 : y % 4 === 1 ? 14 : 0;
        for (let x = 0; x < TILE_PX; x++) {
            px(ctx, ox + x, oy + y, shade(tilled, furrow + (rand() * 2 - 1) * 9));
        }
    }
}
/** Thin stalks topped with grain, on a transparent background. */
function paintWheat(ctx, rand) {
    const [ox, oy] = tileOrigin(Tile.Wheat);
    const grain = [222, 196, 86];
    const husk = [176, 146, 52];
    const stem = [150, 150, 70];
    for (let i = 0; i < 4; i++) {
        const column = 1 + i * 4;
        const top = 1 + (i % 2);
        const earEnd = top + 8;
        for (let y = top; y < TILE_PX; y++) {
            px(ctx, ox + column, oy + y, shade(y < earEnd ? husk : stem, (rand() * 2 - 1) * 10));
        }
        // Grain hangs off alternating sides of the stalk.
        for (let y = top + 1; y < earEnd; y += 2) {
            px(ctx, ox + column - 1, oy + y, shade(grain, (rand() * 2 - 1) * 12));
            px(ctx, ox + column + 1, oy + y + 1, shade(grain, (rand() * 2 - 1) * 12));
        }
    }
}
function paintHayTop(ctx, rand) {
    const [ox, oy] = tileOrigin(Tile.HayTop);
    const cut = [178, 148, 56];
    for (let y = 0; y < TILE_PX; y++) {
        for (let x = 0; x < TILE_PX; x++) {
            const ring = x > 2 && x < 13 && y > 2 && y < 13 ? -18 : 0;
            px(ctx, ox + x, oy + y, shade(cut, ring + (rand() * 2 - 1) * 16));
        }
    }
}
function paintHaySide(ctx, rand) {
    const [ox, oy] = tileOrigin(Tile.HaySide);
    const straw = [190, 160, 60];
    for (let y = 0; y < TILE_PX; y++) {
        const band = y === 1 || y === 14 ? -40 : 0;
        for (let x = 0; x < TILE_PX; x++) {
            px(ctx, ox + x, oy + y, shade(straw, band + (rand() * 2 - 1) * 14));
        }
    }
}
function paintBedTop(ctx, rand) {
    const [ox, oy] = tileOrigin(Tile.BedTop);
    const quilt = [170, 48, 48];
    const pillow = [226, 226, 226];
    for (let y = 0; y < TILE_PX; y++) {
        for (let x = 0; x < TILE_PX; x++) {
            const seam = y === 5 ? -40 : 0;
            px(ctx, ox + x, oy + y, shade(y < 5 ? pillow : quilt, seam + (rand() * 2 - 1) * 10));
        }
    }
}
function paintBedSide(ctx, rand) {
    const [ox, oy] = tileOrigin(Tile.BedSide);
    const quilt = [160, 44, 44];
    const frame = [138, 104, 62];
    for (let y = 0; y < TILE_PX; y++) {
        for (let x = 0; x < TILE_PX; x++) {
            px(ctx, ox + x, oy + y, shade(y > 10 ? frame : quilt, (rand() * 2 - 1) * 10));
        }
    }
}
/** Pane edges only; the middle stays transparent. */
function paintGlass(ctx, rand) {
    const [ox, oy] = tileOrigin(Tile.Glass);
    const pane = [198, 226, 240];
    for (let y = 0; y < TILE_PX; y++) {
        for (let x = 0; x < TILE_PX; x++) {
            const edge = x === 0 || y === 0 || x === TILE_PX - 1 || y === TILE_PX - 1;
            const glint = x + y === 5 || x + y === 7 || x - y === 6;
            if (!edge && !glint)
                continue;
            px(ctx, ox + x, oy + y, shade(pane, edge ? -36 : 16 + (rand() * 2 - 1) * 6));
        }
    }
}
function paintStoneBricks(ctx, rand) {
    const [ox, oy] = tileOrigin(Tile.StoneBricks);
    const brick = [122, 122, 118];
    for (let y = 0; y < TILE_PX; y++) {
        const row = Math.floor(y / 8);
        for (let x = 0; x < TILE_PX; x++) {
            const shifted = (x + row * 8) % 16;
            const mortar = y % 8 === 0 || shifted === 0 ? -34 : 0;
            px(ctx, ox + x, oy + y, shade(brick, mortar + (rand() * 2 - 1) * 9));
        }
    }
}
function paintComposterTop(ctx, rand) {
    const [ox, oy] = tileOrigin(Tile.ComposterTop);
    const wood = [146, 112, 66];
    const compost = [96, 118, 48];
    for (let y = 0; y < TILE_PX; y++) {
        for (let x = 0; x < TILE_PX; x++) {
            const inside = x > 2 && x < 13 && y > 2 && y < 13;
            px(ctx, ox + x, oy + y, shade(inside ? compost : wood, (rand() * 2 - 1) * 14));
        }
    }
}
function paintComposterSide(ctx, rand) {
    const [ox, oy] = tileOrigin(Tile.ComposterSide);
    const wood = [150, 116, 68];
    for (let y = 0; y < TILE_PX; y++) {
        for (let x = 0; x < TILE_PX; x++) {
            const slat = y % 5 === 0 ? -34 : 0;
            const post = x < 2 || x > 13 ? -18 : 0;
            px(ctx, ox + x, oy + y, shade(wood, slat + post + (rand() * 2 - 1) * 8));
        }
    }
}
function paintSmithingTop(ctx, rand) {
    const [ox, oy] = tileOrigin(Tile.SmithingTop);
    const iron = [96, 100, 110];
    for (let y = 0; y < TILE_PX; y++) {
        for (let x = 0; x < TILE_PX; x++) {
            const anvil = x > 3 && x < 12 && y > 4 && y < 11 ? 32 : 0;
            px(ctx, ox + x, oy + y, shade(iron, anvil + (rand() * 2 - 1) * 10));
        }
    }
}
function paintSmithingSide(ctx, rand) {
    const [ox, oy] = tileOrigin(Tile.SmithingSide);
    const wood = [92, 70, 54];
    for (let y = 0; y < TILE_PX; y++) {
        for (let x = 0; x < TILE_PX; x++) {
            const top = y < 4 ? 26 : 0;
            const leg = (x > 1 && x < 4) || (x > 11 && x < 14) ? -22 : 0;
            px(ctx, ox + x, oy + y, shade(wood, top + leg + (rand() * 2 - 1) * 8));
        }
    }
}
function paintFletchingTop(ctx, rand) {
    const [ox, oy] = tileOrigin(Tile.FletchingTop);
    const wood = [168, 138, 92];
    for (let y = 0; y < TILE_PX; y++) {
        for (let x = 0; x < TILE_PX; x++) {
            // Two crossed arrows scratched into the bench.
            const cross = Math.abs(x - y) < 2 || Math.abs(x + y - 15) < 2 ? -36 : 0;
            px(ctx, ox + x, oy + y, shade(wood, cross + (rand() * 2 - 1) * 8));
        }
    }
}
function paintFletchingSide(ctx, rand) {
    const [ox, oy] = tileOrigin(Tile.FletchingSide);
    const wood = [160, 130, 86];
    for (let y = 0; y < TILE_PX; y++) {
        for (let x = 0; x < TILE_PX; x++) {
            const top = y < 3 ? -30 : 0;
            const fletch = y > 5 && y < 12 && x % 5 === 2 ? -26 : 0;
            px(ctx, ox + x, oy + y, shade(wood, top + fletch + (rand() * 2 - 1) * 8));
        }
    }
}
function paintBellTop(ctx, rand) {
    const [ox, oy] = tileOrigin(Tile.BellTop);
    const beam = [118, 88, 56];
    const gold = [214, 176, 64];
    const center = (TILE_PX - 1) / 2;
    for (let y = 0; y < TILE_PX; y++) {
        for (let x = 0; x < TILE_PX; x++) {
            const cap = Math.hypot(x - center, y - center) < 4;
            px(ctx, ox + x, oy + y, shade(cap ? gold : beam, (rand() * 2 - 1) * 10));
        }
    }
}
function paintBellSide(ctx, rand) {
    const [ox, oy] = tileOrigin(Tile.BellSide);
    const beam = [118, 88, 56];
    const gold = [206, 168, 60];
    for (let y = 0; y < TILE_PX; y++) {
        for (let x = 0; x < TILE_PX; x++) {
            // Bell body flares out towards the bottom.
            const halfWidth = 2 + Math.floor(y * 0.3);
            const bell = y > 2 && Math.abs(x - 7.5) < halfWidth;
            px(ctx, ox + x, oy + y, shade(bell ? gold : beam, (rand() * 2 - 1) * 10));
        }
    }
}
function buildAtlasCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = ATLAS_COLS * TILE_PX;
    canvas.height = ATLAS_ROWS * TILE_PX;
    const ctx = canvas.getContext('2d');
    if (!ctx)
        throw new Error('2D canvas context unavailable');
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
    paintNoise(ctx, Tile.Snow, [238, 243, 250], 8, rand);
    paintIce(ctx, rand);
    paintOre(ctx, Tile.CoalOre, [38, 38, 44], rand);
    paintOre(ctx, Tile.CopperOre, [198, 114, 66], rand);
    paintOre(ctx, Tile.IronOre, [214, 176, 146], rand);
    paintOre(ctx, Tile.EmeraldOre, [38, 198, 110], rand);
    paintOre(ctx, Tile.DiamondOre, [100, 224, 230], rand);
    paintTorch(ctx, rand);
    paintBirchLogSide(ctx, rand);
    paintBirchLogTop(ctx, rand);
    paintFoliage(ctx, Tile.BirchLeaves, [126, 174, 88], 0.16, rand);
    paintPineLogSide(ctx, rand);
    paintFoliage(ctx, Tile.PineLeaves, [38, 86, 54], 0.24, rand);
    paintFoliage(ctx, Tile.TropicalLeaves, [48, 146, 60], 0.2, rand);
    paintCactusSide(ctx, rand);
    paintCactusTop(ctx, rand);
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
// Half-texel inset keeps neighbouring atlas tiles from bleeding into each other.
const INSET_U = 0.5 / (ATLAS_COLS * TILE_PX);
const INSET_V = 0.5 / (ATLAS_ROWS * TILE_PX);
export function tileUVBounds(tile) {
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
let sharedTexture = null;
/** Single shared texture so animated tiles only need one upload per frame. */
export function atlasTexture() {
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
function fluidFrames(base, noiseAmp, waveAmp, crest, seed) {
    const rand = mulberry32(seed);
    const noise = new Float32Array(TILE_PX * TILE_PX);
    for (let i = 0; i < noise.length; i++)
        noise[i] = rand() * 2 - 1;
    const frames = [];
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
export function updateFluidAnimation(time) {
    const waterFrame = Math.floor(time * 7) % ANIM_FRAMES;
    const lavaFrame = Math.floor(time * 4) % ANIM_FRAMES;
    if (waterFrame === lastWaterFrame && lavaFrame === lastLavaFrame)
        return;
    lastWaterFrame = waterFrame;
    lastLavaFrame = lavaFrame;
    const ctx = atlasCanvas.getContext('2d');
    if (!ctx)
        return;
    const [wx, wy] = tileOrigin(Tile.Water);
    ctx.putImageData(waterFrames[waterFrame], wx, wy);
    const [lx, ly] = tileOrigin(Tile.Lava);
    ctx.putImageData(lavaFrames[lavaFrame], lx, ly);
    atlasTexture().needsUpdate = true;
}
/** Draws a single atlas tile scaled into a standalone canvas (used by the hotbar). */
export function drawTileTo(target, tile) {
    const ctx = target.getContext('2d');
    if (!ctx)
        return;
    const [ox, oy] = tileOrigin(tile);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, target.width, target.height);
    ctx.drawImage(atlasCanvas, ox, oy, TILE_PX, TILE_PX, 0, 0, target.width, target.height);
}
