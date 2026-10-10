import * as THREE from 'three';
import { CHUNK_HEIGHT } from "../world/chunk.js";
import { villagesNear } from "../world/village.js";
import { rayBoxDistance } from "./mobs.js";
import { Villager } from "./villager.js";

const POPULATE_DISTANCE = 96;
const UNLOAD_DISTANCE = 160;
const SIMULATION_DISTANCE = 72;
const BREED_DISTANCE = 3.5;
const ZOMBIE_FEAR_RANGE = 9;
const NITWIT_CHANCE = 0.12;

/** Spawns, simulates and retires the villagers living in nearby villages. */
export class VillagerManager {
    villagers = [];
    scene;
    world;
    material;
    populateTimer = 0;

    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.material = new THREE.MeshBasicMaterial({ vertexColors: true });
    }

    setDaylight(brightness) {
        this.material.color.setScalar(brightness);
    }

    update(dt, player, day, mobs) {
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
            if (distance > SIMULATION_DISTANCE)
                continue;
            this.checkThreats(villager, mobs);
            villager.update(dt, this.world, day, distance < 12 ? player.position : null);
            if (villager.dead)
                this.remove(i);
        }

        this.breed();
    }

    /** Closest living villager, used by hostile mobs to pick a victim. */
    nearestPrey(position, maxDistance) {
        let closest = null;
        let best = maxDistance;
        for (const villager of this.villagers) {
            if (villager.health <= 0)
                continue;
            const distance = villager.position.distanceTo(position);
            if (distance >= best)
                continue;
            closest = villager;
            best = distance;
        }
        return closest;
    }

    /** Returns the closest villager hit by the ray, along with the hit distance. */
    raycast(origin, direction, maxDistance) {
        let closest = null;
        const min = new THREE.Vector3();
        const max = new THREE.Vector3();
        for (const villager of this.villagers) {
            min.set(villager.position.x - villager.radius, villager.position.y, villager.position.z - villager.radius);
            max.set(villager.position.x + villager.radius, villager.position.y + villager.height, villager.position.z + villager.radius);
            const distance = rayBoxDistance(origin, direction, min, max);
            if (distance === null || distance > maxDistance)
                continue;
            if (!closest || distance < closest.distance)
                closest = { villager, distance };
        }
        return closest;
    }

    remove(index) {
        const [villager] = this.villagers.splice(index, 1);
        this.scene.remove(villager.mesh);
    }

    checkThreats(villager, mobs) {
        for (const mob of mobs) {
            if (mob.type.passive || mob.dying)
                continue;
            if (mob.position.distanceTo(villager.position) < ZOMBIE_FEAR_RANGE) {
                villager.panic(mob.position);
                return;
            }
        }
    }

    /** Keeps every nearby village stocked with one villager per bed. */
    populate(player) {
        for (const site of villagesNear(player.position.x, player.position.z, POPULATE_DISTANCE)) {
            const residents = this.villagers.filter((villager) => villager.site === site);
            if (residents.length >= site.beds.length)
                continue;
            const takenBeds = new Set(residents.map((villager) => villager.bed));
            const takenJobs = new Set(residents.map((villager) => villager.job));
            for (const bed of site.beds) {
                if (takenBeds.has(bed))
                    continue;
                const job = site.jobs.find((candidate) => !takenJobs.has(candidate)) ?? null;
                this.spawn(site, bed, job);
                break;
            }
        }
    }

    spawn(site, bed, job) {
        const profession = job
            ? job.profession
            : Math.random() < NITWIT_CHANCE
                ? 'nitwit'
                : 'unemployed';
        const villager = new Villager(site, this.standingSpot(bed), this.material, profession);
        villager.bed = bed;
        villager.job = job;
        this.villagers.push(villager);
        this.scene.add(villager.mesh);
    }

    /** Finds breathing room above the bed so a new villager does not spawn inside a wall. */
    standingSpot(bed) {
        for (let y = bed.y; y < Math.min(bed.y + 4, CHUNK_HEIGHT - 2); y++) {
            if (this.world.isSolidAt(bed.x, y, bed.z))
                continue;
            if (this.world.isSolidAt(bed.x, y + 1, bed.z))
                continue;
            return new THREE.Vector3(bed.x + 0.5, y, bed.z + 0.5);
        }
        return new THREE.Vector3(bed.x + 0.5, bed.y + 1, bed.z + 0.5);
    }

    /** Two willing adults beside each other produce a baby when a bed is free. */
    breed() {
        for (let i = 0; i < this.villagers.length; i++) {
            const first = this.villagers[i];
            if (!first.willing || first.baby)
                continue;
            for (let j = i + 1; j < this.villagers.length; j++) {
                const second = this.villagers[j];
                if (!second.willing || second.baby || second.site !== first.site)
                    continue;
                if (first.position.distanceTo(second.position) > BREED_DISTANCE)
                    continue;
                const population = this.villagers.filter((villager) => villager.site === first.site).length;
                if (population >= first.site.beds.length + 2)
                    continue;
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
