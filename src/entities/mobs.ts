import * as THREE from 'three';
import type { DayCycle } from '../engine/daycycle.ts';
import type { Difficulty } from '../engine/difficulty.ts';
import { DEFAULT_DIFFICULTY, DIFFICULTIES } from '../engine/difficulty.ts';
import type { Player } from '../player/player.ts';
import { Block } from '../world/blocks.ts';
import { CHUNK_HEIGHT } from '../world/chunk.ts';
import type { World } from '../world/world.ts';
import { Mob, SPIDER, ZOMBIE } from './mob.ts';
import type { MobType } from './mob.ts';

const SPAWN_ATTEMPTS = 12;
const MIN_SPAWN_DISTANCE = 14;
const MAX_SPAWN_DISTANCE = 30;
const DESPAWN_DISTANCE = 52;
const MOB_SIMULATION_DISTANCE = 44;

export class MobManager {
  readonly mobs: Mob[] = [];

  private readonly scene: THREE.Scene;
  private readonly world: World;
  private readonly material: THREE.MeshBasicMaterial;
  private difficulty: Difficulty = DIFFICULTIES[DEFAULT_DIFFICULTY];
  private spawnTimer = 0;

  constructor(scene: THREE.Scene, world: World) {
    this.scene = scene;
    this.world = world;
    this.material = new THREE.MeshBasicMaterial({ vertexColors: true });
  }

  setDifficulty(difficulty: Difficulty): void {
    this.difficulty = difficulty;
    while (this.mobs.length > difficulty.maxMobs) this.remove(this.mobs.length - 1);
  }

  setDaylight(brightness: number): void {
    this.material.color.setScalar(brightness);
  }

  update(dt: number, player: Player, day: DayCycle): void {
    const night = day.isNight;
    const daylight = !night;

    this.spawnTimer += dt;
    if (this.spawnTimer >= this.difficulty.spawnInterval) {
      this.spawnTimer = 0;
      this.trySpawn(player, night);
    }

    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const mob = this.mobs[i];
      const distance = mob.position.distanceTo(player.position);

      if (mob.dead || distance > DESPAWN_DISTANCE) {
        this.remove(i);
        continue;
      }

      if (distance > MOB_SIMULATION_DISTANCE) continue;

      const dark = this.isDark(mob.position, night);
      mob.update(dt, this.world, player, dark, daylight, this.difficulty);
      if (mob.dead) this.remove(i);
    }
  }

  /** Returns the closest mob hit by the ray, along with the hit distance. */
  raycast(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number): { mob: Mob; distance: number } | null {
    let closest: { mob: Mob; distance: number } | null = null;

    for (const mob of this.mobs) {
      const min = new THREE.Vector3(
        mob.position.x - mob.radius,
        mob.position.y,
        mob.position.z - mob.radius,
      );
      const max = new THREE.Vector3(
        mob.position.x + mob.radius,
        mob.position.y + mob.height,
        mob.position.z + mob.radius,
      );

      const distance = rayBoxDistance(origin, direction, min, max);
      if (distance === null || distance > maxDistance) continue;
      if (!closest || distance < closest.distance) closest = { mob, distance };
    }

    return closest;
  }

  private remove(index: number): void {
    const [mob] = this.mobs.splice(index, 1);
    this.scene.remove(mob.mesh);
  }

  private isDark(position: THREE.Vector3, night: boolean): boolean {
    const exposed = this.world.isSkyExposed(
      Math.floor(position.x),
      Math.floor(position.y),
      Math.floor(position.z),
    );
    return exposed ? night : true;
  }

  private trySpawn(player: Player, night: boolean): void {
    if (this.mobs.length >= this.difficulty.maxMobs) return;

    let spawned = 0;
    for (let attempt = 0; attempt < SPAWN_ATTEMPTS && spawned < this.difficulty.spawnPerWave; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = MIN_SPAWN_DISTANCE + Math.random() * (MAX_SPAWN_DISTANCE - MIN_SPAWN_DISTANCE);
      const x = Math.floor(player.position.x + Math.cos(angle) * radius);
      const z = Math.floor(player.position.z + Math.sin(angle) * radius);

      const type = Math.random() < 0.65 ? ZOMBIE : SPIDER;
      const top = Math.min(CHUNK_HEIGHT - 3, Math.floor(player.position.y) + 10);
      const bottom = Math.max(1, Math.floor(player.position.y) - 16);

      for (let y = top; y >= bottom; y--) {
        if (!this.canStandAt(x, y, z, type)) continue;
        const position = new THREE.Vector3(x + 0.5, y, z + 0.5);
        if (!this.isDark(position, night)) continue;

        const mob = new Mob(type, position, this.material, this.difficulty.healthMultiplier);
        this.mobs.push(mob);
        this.scene.add(mob.mesh);
        spawned++;
        break;
      }
    }
  }

  private canStandAt(x: number, y: number, z: number, type: MobType): boolean {
    if (!this.world.isSolidAt(x, y - 1, z)) return false;
    const clearance = Math.ceil(type.height);
    for (let i = 0; i < clearance; i++) {
      if (this.world.getBlock(x, y + i, z) !== Block.Air) return false;
    }
    return true;
  }
}

/** Slab-method ray/AABB intersection; returns the entry distance or null. */
function rayBoxDistance(
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  min: THREE.Vector3,
  max: THREE.Vector3,
): number | null {
  let near = 0;
  let far = Infinity;

  for (const axis of ['x', 'y', 'z'] as const) {
    const d = direction[axis];
    const o = origin[axis];

    if (Math.abs(d) < 1e-8) {
      if (o < min[axis] || o > max[axis]) return null;
      continue;
    }

    let t1 = (min[axis] - o) / d;
    let t2 = (max[axis] - o) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];

    near = Math.max(near, t1);
    far = Math.min(far, t2);
    if (near > far) return null;
  }

  return near;
}
