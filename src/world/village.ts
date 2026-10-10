import { mulberry32 } from '../engine/noise.ts';
import { Block } from './blocks.ts';
import { CHUNK_HEIGHT, CHUNK_SIZE, Chunk } from './chunk.ts';
import { SEA_LEVEL, WORLD_SEED, terrainHeight } from './heightmap.ts';

/** Villages that have a matching job site block in the village. */
export type JobProfession = 'farmer' | 'toolsmith' | 'fletcher';

export const JOB_BLOCKS: Record<JobProfession, number> = {
  farmer: Block.Composter,
  toolsmith: Block.SmithingTable,
  fletcher: Block.FletchingTable,
};

export interface VillagePoint {
  x: number;
  y: number;
  z: number;
}

export interface JobSite extends VillagePoint {
  profession: JobProfession;
}

export interface VillageSite {
  readonly key: string;
  readonly centerX: number;
  readonly centerZ: number;
  /** Ground level the whole settlement is flattened to. */
  readonly level: number;
  readonly beds: VillagePoint[];
  readonly jobs: JobSite[];
  readonly bell: VillagePoint;
  readonly plan: VillagePlan;
}

interface VillagePlan {
  readonly xs: Int32Array;
  readonly ys: Uint8Array;
  readonly zs: Int32Array;
  readonly ids: Uint8Array;
}

/** One village candidate per region; the margin keeps it inside its own region. */
const REGION = 192;
const REGION_MARGIN = 48;
const VILLAGE_RADIUS = 30;
/** Rejects hillsides, so buildings never end up floating or buried. */
const MAX_SLOPE = 6;
const CACHE_LIMIT = 32;

const PROBES: [number, number][] = [
  [0, 0],
  [-18, -18],
  [18, -18],
  [-18, 18],
  [18, 18],
  [-24, 0],
  [24, 0],
  [0, -24],
  [0, 24],
];

/** [x, z, width, depth] of each building lot, relative to the well. */
const LOTS: [number, number, number, number][] = [
  [-14, -13, 9, 9],
  [6, -13, 9, 9],
  [-14, 5, 9, 9],
  [6, 5, 9, 9],
  [-24, -4, 8, 9],
  [17, -4, 8, 9],
  [-4, -24, 9, 8],
  [-4, 17, 9, 8],
];

/** Short path patches linking the main road arms to the corner lots. */
const CONNECTORS: [number, number][] = [
  [-10, 2],
  [8, 2],
  [-10, -4],
  [8, -4],
];

const LAMP_POSTS: [number, number][] = [
  [13, 2],
  [-13, -2],
  [2, -13],
  [-2, 13],
];

const PATH_ARM_START = 4;
const PATH_ARM_END = 16;

const cache = new Map<string, VillageSite | null>();

function regionOf(value: number): number {
  return Math.floor(value / REGION);
}

/** The village for a region, or null when the terrain there is unsuitable. */
export function villageInRegion(rx: number, rz: number): VillageSite | null {
  const key = `${rx},${rz}`;
  if (cache.has(key)) return cache.get(key) ?? null;

  const site = createSite(rx, rz, key);
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
  cache.set(key, site);
  return site;
}

/** Villages whose centre lies within `radius` of the given world column. */
export function villagesNear(x: number, z: number, radius: number): VillageSite[] {
  const found: VillageSite[] = [];
  const rx = regionOf(x);
  const rz = regionOf(z);

  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const site = villageInRegion(rx + dx, rz + dz);
      if (!site) continue;
      if (Math.hypot(site.centerX - x, site.centerZ - z) <= radius) found.push(site);
    }
  }
  return found;
}

/** Stamps every village overlapping the chunk; called during terrain generation. */
export function applyVillages(chunk: Chunk): void {
  const originX = chunk.cx * CHUNK_SIZE;
  const originZ = chunk.cz * CHUNK_SIZE;
  const rx = regionOf(originX);
  const rz = regionOf(originZ);

  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const site = villageInRegion(rx + dx, rz + dz);
      if (!site) continue;
      if (site.centerX + VILLAGE_RADIUS < originX || site.centerX - VILLAGE_RADIUS >= originX + CHUNK_SIZE) continue;
      if (site.centerZ + VILLAGE_RADIUS < originZ || site.centerZ - VILLAGE_RADIUS >= originZ + CHUNK_SIZE) continue;
      stampPlan(site.plan, chunk, originX, originZ);
    }
  }
}

/** True inside the flattened footprint, where trees must not grow. */
export function insideVillage(x: number, z: number): boolean {
  const rx = regionOf(x);
  const rz = regionOf(z);
  const site = villageInRegion(rx, rz);
  if (!site) return false;
  return Math.abs(site.centerX - x) <= VILLAGE_RADIUS && Math.abs(site.centerZ - z) <= VILLAGE_RADIUS;
}

function stampPlan(plan: VillagePlan, chunk: Chunk, originX: number, originZ: number): void {
  const { xs, ys, zs, ids } = plan;
  for (let i = 0; i < ids.length; i++) {
    const lx = xs[i] - originX;
    if (lx < 0 || lx >= CHUNK_SIZE) continue;
    const lz = zs[i] - originZ;
    if (lz < 0 || lz >= CHUNK_SIZE) continue;
    chunk.set(lx, ys[i], lz, ids[i]);
  }
}

function createSite(rx: number, rz: number, key: string): VillageSite | null {
  const rand = mulberry32((Math.imul(rx, 73856093) ^ Math.imul(rz, 19349663) ^ WORLD_SEED) >>> 0);

  const span = REGION - REGION_MARGIN * 2;
  const centerX = rx * REGION + REGION_MARGIN + Math.floor(rand() * span);
  const centerZ = rz * REGION + REGION_MARGIN + Math.floor(rand() * span);

  let lowest = Infinity;
  let highest = -Infinity;
  for (const [dx, dz] of PROBES) {
    const height = terrainHeight(centerX + dx, centerZ + dz);
    if (height <= SEA_LEVEL + 1) return null;
    lowest = Math.min(lowest, height);
    highest = Math.max(highest, height);
  }
  if (highest - lowest > MAX_SLOPE) return null;

  return buildPlan(key, centerX, centerZ, terrainHeight(centerX, centerZ), rand);
}

function buildPlan(
  key: string,
  centerX: number,
  centerZ: number,
  level: number,
  rand: () => number,
): VillageSite {
  const blocks = new Map<number, number>();
  const beds: VillagePoint[] = [];
  const jobs: JobSite[] = [];

  const set = (x: number, y: number, z: number, id: number): void => {
    const lx = x - centerX;
    const lz = z - centerZ;
    if (Math.abs(lx) > VILLAGE_RADIUS || Math.abs(lz) > VILLAGE_RADIUS) return;
    if (y < 1 || y >= CHUNK_HEIGHT) return;
    blocks.set(packKey(lx, y, lz), id);
  };

  /** Levels a rectangle to `level`, filling any hollow below and clearing above. */
  const flatten = (x0: number, z0: number, w: number, d: number, surface: number, clearance: number): void => {
    for (let x = x0; x < x0 + w; x++) {
      for (let z = z0; z < z0 + d; z++) {
        const ground = terrainHeight(x, z);
        set(x, level, z, surface);
        for (let y = level - 1; y > Math.min(ground, level) - 3; y--) set(x, y, z, Block.Dirt);
        const top = Math.max(level + clearance, ground + 1);
        for (let y = level + 1; y <= top; y++) set(x, y, z, Block.Air);
      }
    }
  };

  const roads = (): void => {
    for (let t = PATH_ARM_START; t <= PATH_ARM_END; t++) {
      flatten(centerX + t, centerZ - 1, 1, 3, Block.Path, 4);
      flatten(centerX - t, centerZ - 1, 1, 3, Block.Path, 4);
      flatten(centerX - 1, centerZ + t, 3, 1, Block.Path, 4);
      flatten(centerX - 1, centerZ - t, 3, 1, Block.Path, 4);
    }
    for (const [ox, oz] of CONNECTORS) {
      flatten(centerX + ox, centerZ + oz, 3, 3, Block.Path, 4);
    }
  };

  const well = (): void => {
    flatten(centerX - 3, centerZ - 3, 7, 7, Block.Path, 7);
    for (let x = -2; x <= 2; x++) {
      for (let z = -2; z <= 2; z++) set(centerX + x, level, centerZ + z, Block.StoneBricks);
    }

    for (let x = -1; x <= 1; x++) {
      for (let z = -1; z <= 1; z++) {
        if (x === 0 && z === 0) continue;
        set(centerX + x, level + 1, centerZ + z, Block.Cobblestone);
      }
    }
    for (let y = level - 2; y <= level + 1; y++) set(centerX, y, centerZ, Block.Water);

    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as [number, number][]) {
      set(centerX + x, level + 2, centerZ + z, Block.Log);
      set(centerX + x, level + 3, centerZ + z, Block.Log);
    }
    for (let x = -2; x <= 2; x++) {
      for (let z = -2; z <= 2; z++) set(centerX + x, level + 4, centerZ + z, Block.Planks);
    }
  };

  const lamps = (): void => {
    for (const [ox, oz] of LAMP_POSTS) {
      flatten(centerX + ox, centerZ + oz, 1, 1, Block.Path, 5);
      for (let y = level + 1; y <= level + 3; y++) set(centerX + ox, y, centerZ + oz, Block.Log);
      set(centerX + ox, level + 4, centerZ + oz, Block.Hay);
    }
  };

  const house = (x0: number, z0: number, w: number, d: number, job: JobProfession | null): void => {
    flatten(x0, z0, w, d, Block.Planks, 8);

    const x1 = x0 + w - 1;
    const z1 = z0 + d - 1;
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const onEdge = x === x0 || x === x1 || z === z0 || z === z1;
        if (!onEdge) continue;
        const corner = (x === x0 || x === x1) && (z === z0 || z === z1);
        for (let y = level + 1; y <= level + 3; y++) {
          const material = corner ? Block.Log : y === level + 1 ? Block.Cobblestone : Block.Planks;
          set(x, y, z, material);
        }
        // Windows sit at eye height, skipping the blocks beside the corners.
        const spacing = (x - x0 + z - z0) % 3 === 0;
        if (!corner && spacing) set(x, level + 2, z, Block.Glass);
      }
    }

    carveDoor(set, x0, z0, w, d, level, centerX, centerZ);

    for (let x = x0 - 1; x <= x1 + 1; x++) {
      for (let z = z0 - 1; z <= z1 + 1; z++) set(x, level + 4, z, Block.Planks);
    }
    for (let x = x0 + 1; x <= x1 - 1; x++) {
      for (let z = z0 + 1; z <= z1 - 1; z++) set(x, level + 5, z, Block.Log);
    }

    set(x0 + 1, level + 1, z0 + 1, Block.Bed);
    set(x0 + 1, level + 1, z0 + 2, Block.Bed);
    beds.push({ x: x0 + 1, y: level + 1, z: z0 + 1 });

    if (d >= 9 && rand() < 0.6) {
      set(x1 - 1, level + 1, z1 - 1, Block.Bed);
      set(x1 - 1, level + 1, z1 - 2, Block.Bed);
      beds.push({ x: x1 - 1, y: level + 1, z: z1 - 1 });
    }

    if (job) {
      const jx = x0 + 1;
      const jz = z1 - 1;
      set(jx, level + 1, jz, JOB_BLOCKS[job]);
      jobs.push({ x: jx, y: level + 1, z: jz, profession: job });
    } else {
      set(x1 - 1, level + 1, z0 + 1, Block.CraftingTable);
    }
  };

  const farm = (x0: number, z0: number, w: number, d: number): void => {
    flatten(x0, z0, w, d, Block.Farmland, 6);

    const x1 = x0 + w - 1;
    const z1 = z0 + d - 1;
    const channel = z0 + Math.floor(d / 2);

    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const onEdge = x === x0 || x === x1 || z === z0 || z === z1;
        if (onEdge) {
          set(x, level, z, Block.Path);
          continue;
        }
        if (z === channel) {
          set(x, level, z, Block.Water);
          continue;
        }
        set(x, level, z, Block.Farmland);
        set(x, level + 1, z, Block.Wheat);
      }
    }

    set(x0, level + 1, z0, Block.Hay);
    set(x0, level + 2, z0, Block.Hay);
    set(x1, level + 1, z1, Block.Hay);
  };

  const bellPost = (): void => {
    const x = centerX + 3;
    const z = centerZ + 3;
    set(x, level + 1, z, Block.Log);
    set(x, level + 2, z, Block.Log);
    set(x, level + 3, z, Block.Bell);
  };

  roads();
  well();
  bellPost();
  lamps();

  const kinds = shuffle(
    ['farmer', 'toolsmith', 'fletcher', 'house', 'house', 'farm', 'farm', 'house'] as const,
    rand,
  );
  LOTS.forEach(([ox, oz, w, d], index) => {
    const kind = kinds[index];
    const x0 = centerX + ox;
    const z0 = centerZ + oz;
    if (kind === 'farm') farm(x0, z0, w, d);
    else house(x0, z0, w, d, kind === 'house' ? null : kind);
  });

  return {
    key,
    centerX,
    centerZ,
    level,
    beds,
    jobs,
    bell: { x: centerX + 3, y: level + 3, z: centerZ + 3 },
    plan: freezePlan(blocks, centerX, centerZ),
  };
}

/** Cuts a doorway in the wall that faces the village centre. */
function carveDoor(
  set: (x: number, y: number, z: number, id: number) => void,
  x0: number,
  z0: number,
  w: number,
  d: number,
  level: number,
  centerX: number,
  centerZ: number,
): void {
  const midX = x0 + Math.floor(w / 2);
  const midZ = z0 + Math.floor(d / 2);
  const toCenterX = centerX - midX;
  const toCenterZ = centerZ - midZ;

  let doorX = midX;
  let doorZ = midZ;
  if (Math.abs(toCenterX) > Math.abs(toCenterZ)) doorX = toCenterX > 0 ? x0 + w - 1 : x0;
  else doorZ = toCenterZ > 0 ? z0 + d - 1 : z0;

  set(doorX, level + 1, doorZ, Block.Air);
  set(doorX, level + 2, doorZ, Block.Air);
}

function shuffle<T>(values: readonly T[], rand: () => number): T[] {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const KEY_SPAN = VILLAGE_RADIUS * 2 + 1;

function packKey(lx: number, y: number, lz: number): number {
  return ((lx + VILLAGE_RADIUS) * KEY_SPAN + (lz + VILLAGE_RADIUS)) * CHUNK_HEIGHT + y;
}

/** Flattens the build map into typed arrays so chunk stamping stays cheap. */
function freezePlan(blocks: Map<number, number>, centerX: number, centerZ: number): VillagePlan {
  const size = blocks.size;
  const xs = new Int32Array(size);
  const ys = new Uint8Array(size);
  const zs = new Int32Array(size);
  const ids = new Uint8Array(size);

  let i = 0;
  for (const [key, id] of blocks) {
    const y = key % CHUNK_HEIGHT;
    const flat = (key - y) / CHUNK_HEIGHT;
    const lz = (flat % KEY_SPAN) - VILLAGE_RADIUS;
    const lx = ((flat - (lz + VILLAGE_RADIUS)) / KEY_SPAN) - VILLAGE_RADIUS;
    xs[i] = centerX + lx;
    ys[i] = y;
    zs[i] = centerZ + lz;
    ids[i] = id;
    i++;
  }

  return { xs, ys, zs, ids };
}
