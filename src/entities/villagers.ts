import * as THREE from 'three';
import type { DayCycle } from '../engine/daycycle.ts';
import { rayBoxDistance } from '../engine/physics.ts';
import type { Player } from '../player/player.ts';
import { CHUNK_HEIGHT } from '../world/chunk.ts';
import type { JobSite, VillagePoint, VillageSite } from '../world/village.ts';
import { villagesNear } from '../world/village.ts';
import type { World } from '../world/world.ts';
import type { Mob } from './mob.ts';
import type { Prey } from './mob.ts';
import { Villager } from './villager.ts';
import type { Profession } from './villager.ts';

const POPULATE_DISTANCE = 96;
const UNLOAD_DISTANCE = 160;
const SIMULATION_DISTANCE = 72;
const BREED_DISTANCE = 3.5;
const ZOMBIE_FEAR_RANGE = 9;
const NITWIT_CHANCE = 0.12;

/** Spawns, simulates and retires the villagers living in nearby villages. */
export class VillagerManager {
  readonly villagers: Villager[] = [];

  private readonly scene: THREE.Scene;
  private readonly world: World;
  private readonly material: THREE.MeshBasicMaterial;
  private populateTimer = 0;

  constructor(scene: THREE.Scene, world: World) {
    this.scene = scene;
    this.world = world;
    this.material = new THREE.MeshBasicMaterial({ vertexColors: true });
  }

  setDaylight(brightness: number): void {
    this.material.color.setScalar(brightness);
  }

  update(dt: number, player: Player, day: DayCycle, mobs: readonly Mob[]): void {
    this.populateTimer -= dt;
    if (this.populateTimer <= 0) {
      this.populateTimer = 2;
      this.populate(player);
    }

    for (let i = this.villagers.length - 1; i >= 0; i--) {
      const villager = this.villagers[i];
      const distance = villager.position.distanceTo(player.position);

      if (villager.dead || distance > UNLOAD_DISTANCE) {
        this.remove(i);
        continue;
      }
      if (distance > SIMULATION_DISTANCE) continue;

      this.checkThreats(villager, mobs);
      villager.update(dt, this.world, day, distance < 12 ? player.position : null);
      if (villager.dead) this.remove(i);
    }

    this.breed();
  }

  /** Closest living villager, used by hostile mobs to pick a victim. */
  nearestPrey(position: THREE.Vector3, maxDistance: number): Prey | null {
    let closest: Villager | null = null;
    let best = maxDistance;

    for (const villager of this.villagers) {
      if (villager.health <= 0) continue;
      const distance = villager.position.distanceTo(position);
      if (distance >= best) continue;
      closest = villager;
      best = distance;
    }

    return closest;
  }

  /** Returns the closest villager hit by the ray, along with the hit distance. */
  raycast(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number): { villager: Villager; distance: number } | null {
    let closest: { villager: Villager; distance: number } | null = null;
    const min = new THREE.Vector3();
    const max = new THREE.Vector3();

    for (const villager of this.villagers) {
      min.set(villager.position.x - villager.radius, villager.position.y, villager.position.z - villager.radius);
      max.set(
        villager.position.x + villager.radius,
        villager.position.y + villager.height,
        villager.position.z + villager.radius,
      );

      const distance = rayBoxDistance(origin, direction, min, max);
      if (distance === null || distance > maxDistance) continue;
      if (!closest || distance < closest.distance) closest = { villager, distance };
    }

    return closest;
  }

  private remove(index: number): void {
    const [villager] = this.villagers.splice(index, 1);
    this.scene.remove(villager.mesh);
  }

  private checkThreats(villager: Villager, mobs: readonly Mob[]): void {
    for (const mob of mobs) {
      if (mob.position.distanceTo(villager.position) < ZOMBIE_FEAR_RANGE) {
        villager.panic(mob.position);
        return;
      }
    }
  }

  /** Keeps every nearby village stocked with one villager per bed. */
  private populate(player: Player): void {
    const sites = villagesNear(player.position.x, player.position.z, POPULATE_DISTANCE);

    for (const site of sites) {
      const residents = this.villagers.filter((villager) => villager.site === site);
      if (residents.length >= site.beds.length) continue;

      const takenBeds = new Set(residents.map((villager) => villager.bed));
      const takenJobs = new Set(residents.map((villager) => villager.job));

      for (const bed of site.beds) {
        if (takenBeds.has(bed)) continue;
        const job = site.jobs.find((candidate) => !takenJobs.has(candidate)) ?? null;
        if (job) takenJobs.add(job);
        this.spawn(site, bed, job);
        break;
      }
    }
  }

  private spawn(site: VillageSite, bed: VillagePoint, job: JobSite | null): void {
    const profession: Profession = job
      ? job.profession
      : Math.random() < NITWIT_CHANCE
        ? 'nitwit'
        : 'unemployed';

    const position = this.standingSpot(bed);
    const villager = new Villager(site, position, this.material, profession);
    villager.bed = bed;
    villager.job = job;
    this.villagers.push(villager);
    this.scene.add(villager.mesh);
  }

  /** Finds breathing room above the bed so a new villager does not spawn inside a wall. */
  private standingSpot(bed: VillagePoint): THREE.Vector3 {
    for (let y = bed.y; y < Math.min(bed.y + 4, CHUNK_HEIGHT - 2); y++) {
      if (this.world.isSolidAt(bed.x, y, bed.z)) continue;
      if (this.world.isSolidAt(bed.x, y + 1, bed.z)) continue;
      return new THREE.Vector3(bed.x + 0.5, y, bed.z + 0.5);
    }
    return new THREE.Vector3(bed.x + 0.5, bed.y + 1, bed.z + 0.5);
  }

  /** Two willing adults beside each other produce a baby when a bed is free. */
  private breed(): void {
    for (let i = 0; i < this.villagers.length; i++) {
      const first = this.villagers[i];
      if (!first.willing || first.baby) continue;

      for (let j = i + 1; j < this.villagers.length; j++) {
        const second = this.villagers[j];
        if (!second.willing || second.baby || second.site !== first.site) continue;
        if (first.position.distanceTo(second.position) > BREED_DISTANCE) continue;

        const population = this.villagers.filter((villager) => villager.site === first.site).length;
        if (population >= first.site.beds.length + 2) continue;

        first.startBreedCooldown();
        second.startBreedCooldown();

        const baby = new Villager(first.site, first.position.clone(), this.material, 'unemployed', true);
        this.villagers.push(baby);
        this.scene.add(baby.mesh);
        return;
      }
    }
  }
}
