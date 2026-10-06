import * as THREE from 'three';
import { DEFAULT_DIFFICULTY, DIFFICULTIES } from "../engine/difficulty.js";
import { Item } from "../items/ids.js";
import { Block } from "../world/blocks.js";
import { CHUNK_HEIGHT } from "../world/chunk.js";
import { ANIMAL_TYPES, Mob, SPIDER, ZOMBIE } from "./mob.js";
const SPAWN_ATTEMPTS = 12;
const MIN_SPAWN_DISTANCE = 14;
const MAX_SPAWN_DISTANCE = 30;
const DESPAWN_DISTANCE = 52;
const MOB_SIMULATION_DISTANCE = 44;
const MAX_ANIMALS = 10;
const ANIMAL_SPAWN_INTERVAL = 7;
/** Animals only settle on ground they could graze on. */
const GRAZEABLE = new Set([Block.Grass, Block.Snow, Block.Sand]);
export class MobManager {
    mobs = [];
    scene;
    world;
    material;
    hurtMaterial;
    difficulty = DIFFICULTIES[DEFAULT_DIFFICULTY];
    spawnTimer = 0;
    animalTimer = 0;
    onDropItem = null;
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.material = new THREE.MeshBasicMaterial({ vertexColors: true });
        this.hurtMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
    }
    setDifficulty(difficulty) {
        this.difficulty = difficulty;
        for (let i = this.mobs.length - 1; i >= 0 && this.hostileCount > difficulty.maxMobs; i--) {
            if (!this.mobs[i].type.passive)
                this.remove(i);
        }
    }
    get hostileCount() {
        return this.mobs.reduce((total, mob) => total + (mob.type.passive ? 0 : 1), 0);
    }
    get animalCount() {
        return this.mobs.length - this.hostileCount;
    }
    setDaylight(brightness) {
        this.material.color.setScalar(brightness);
        // Kept bright enough to read as a hit flash even at midnight.
        this.hurtMaterial.color.setRGB(Math.min(1, brightness + 0.45), brightness * 0.18, brightness * 0.18);
    }
    update(dt, player, day) {
        const night = day.isNight;
        const daylight = !night;
        this.spawnTimer += dt;
        if (this.spawnTimer >= this.difficulty.spawnInterval) {
            this.spawnTimer = 0;
            this.trySpawn(player, night);
        }
        this.animalTimer += dt;
        if (this.animalTimer >= ANIMAL_SPAWN_INTERVAL) {
            this.animalTimer = 0;
            this.trySpawnAnimal(player);
        }
        for (let i = this.mobs.length - 1; i >= 0; i--) {
            const mob = this.mobs[i];
            const distance = mob.position.distanceTo(player.position);
            if (mob.dead) {
                this.dropLoot(mob);
                this.remove(i);
                continue;
            }
            if (distance > DESPAWN_DISTANCE) {
                this.remove(i);
                continue;
            }
            if (distance > MOB_SIMULATION_DISTANCE)
                continue;
            const dark = this.isDark(mob.position, night);
            mob.update(dt, this.world, player, dark, daylight, this.difficulty);
            if (mob.pendingEgg) {
                mob.pendingEgg = false;
                this.onDropItem?.(Item.Egg, mob.position.x, mob.position.y + 0.3, mob.position.z);
            }
            if (mob.dead) {
                this.dropLoot(mob);
                this.remove(i);
            }
        }
    }
    dropLoot(mob) {
        const drop = mob.type.drop;
        if (drop === null || drop === undefined)
            return;
        this.onDropItem?.(drop, mob.position.x, mob.position.y + 0.3, mob.position.z);
    }
    /** Returns the closest mob hit by the ray, along with the hit distance. */
    raycast(origin, direction, maxDistance) {
        let closest = null;
        for (const mob of this.mobs) {
            const min = new THREE.Vector3(mob.position.x - mob.radius, mob.position.y, mob.position.z - mob.radius);
            const max = new THREE.Vector3(mob.position.x + mob.radius, mob.position.y + mob.height, mob.position.z + mob.radius);
            const distance = rayBoxDistance(origin, direction, min, max);
            if (distance === null || distance > maxDistance)
                continue;
            if (!closest || distance < closest.distance)
                closest = { mob, distance };
        }
        return closest;
    }
    remove(index) {
        const [mob] = this.mobs.splice(index, 1);
        this.scene.remove(mob.mesh);
    }
    isDark(position, night) {
        // Torchlight keeps a spot safe regardless of the sky above it.
        if (this.world.torchLightAt(position.x, position.y, position.z) > 0.25)
            return false;
        const exposed = this.world.isSkyExposed(Math.floor(position.x), Math.floor(position.y), Math.floor(position.z));
        return exposed ? night : true;
    }
    trySpawn(player, night) {
        if (this.hostileCount >= this.difficulty.maxMobs)
            return;
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
                if (!this.canStandAt(x, y, z, type))
                    continue;
                const position = new THREE.Vector3(x + 0.5, y, z + 0.5);
                if (!this.isDark(position, night))
                    continue;
                this.spawnAt(type, position);
                spawned++;
                break;
            }
        }
    }
    /** Animals wander in under open sky, day or night. */
    trySpawnAnimal(player) {
        if (this.animalCount >= MAX_ANIMALS)
            return;
        for (let attempt = 0; attempt < SPAWN_ATTEMPTS; attempt++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = MIN_SPAWN_DISTANCE + Math.random() * (MAX_SPAWN_DISTANCE - MIN_SPAWN_DISTANCE);
            const x = Math.floor(player.position.x + Math.cos(angle) * radius);
            const z = Math.floor(player.position.z + Math.sin(angle) * radius);
            const type = ANIMAL_TYPES[Math.floor(Math.random() * ANIMAL_TYPES.length)];
            const top = Math.min(CHUNK_HEIGHT - 3, Math.floor(player.position.y) + 10);
            const bottom = Math.max(1, Math.floor(player.position.y) - 8);
            for (let y = top; y >= bottom; y--) {
                if (!this.canStandAt(x, y, z, type))
                    continue;
                if (!GRAZEABLE.has(this.world.getBlock(x, y - 1, z)))
                    continue;
                if (!this.world.isSkyExposed(x, y, z))
                    continue;
                this.spawnAt(type, new THREE.Vector3(x + 0.5, y, z + 0.5));
                return;
            }
        }
    }
    spawnAt(type, position) {
        const scale = type.passive ? 1 : this.difficulty.healthMultiplier;
        const mob = new Mob(type, position, this.material, this.hurtMaterial, scale);
        this.mobs.push(mob);
        this.scene.add(mob.mesh);
        return mob;
    }
    canStandAt(x, y, z, type) {
        if (!this.world.isSolidAt(x, y - 1, z))
            return false;
        const clearance = Math.ceil(type.height);
        for (let i = 0; i < clearance; i++) {
            if (this.world.getBlock(x, y + i, z) !== Block.Air)
                return false;
        }
        return true;
    }
}
/** Slab-method ray/AABB intersection; returns the entry distance or null. */
function rayBoxDistance(origin, direction, min, max) {
    let near = 0;
    let far = Infinity;
    for (const axis of ['x', 'y', 'z']) {
        const d = direction[axis];
        const o = origin[axis];
        if (Math.abs(d) < 1e-8) {
            if (o < min[axis] || o > max[axis])
                return null;
            continue;
        }
        let t1 = (min[axis] - o) / d;
        let t2 = (max[axis] - o) / d;
        if (t1 > t2)
            [t1, t2] = [t2, t1];
        near = Math.max(near, t1);
        far = Math.min(far, t2);
        if (near > far)
            return null;
    }
    return near;
}
