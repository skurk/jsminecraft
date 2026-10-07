import * as THREE from 'three';
import { DEFAULT_DIFFICULTY, DIFFICULTIES } from "../engine/difficulty.js";
import { Item } from "../items/ids.js";
import { Block } from "../world/blocks.js";
import { CHUNK_HEIGHT } from "../world/chunk.js";
import { ANIMAL_TYPES, CREEPER, Mob, SKELETON, SPIDER, ZOMBIE } from "./mob.js";
const SPAWN_ATTEMPTS = 12;
const MIN_SPAWN_DISTANCE = 14;
const MAX_SPAWN_DISTANCE = 30;
const DESPAWN_DISTANCE = 52;
const MOB_SIMULATION_DISTANCE = 44;
const MAX_ANIMALS = 16;
const ANIMAL_SPAWN_INTERVAL = 5;
/** Passive mobs arrive as a group of one species, the way a herd would graze together. */
const HERD_MIN = 2;
const HERD_MAX = 4;
const HERD_SPREAD = 5;
/** Animals only settle on ground they could graze on. */
const GRAZEABLE = new Set([Block.Grass, Block.Snow, Block.Sand]);
/** Cumulative spawn weights for the night-time hostile pool. */
const HOSTILE_POOL = [
    { type: ZOMBIE, weight: 0.4 },
    { type: SKELETON, weight: 0.25 },
    { type: CREEPER, weight: 0.2 },
    { type: SPIDER, weight: 0.15 },
];
function pickHostile() {
    let roll = Math.random();
    for (const entry of HOSTILE_POOL) {
        roll -= entry.weight;
        if (roll <= 0)
            return entry.type;
    }
    return ZOMBIE;
}
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
    onShoot = null;
    onExplode = null;
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
            if (mob.pendingShot) {
                const shot = mob.pendingShot;
                mob.pendingShot = null;
                const muzzle = new THREE.Vector3(mob.position.x, mob.position.y + mob.height * 0.8, mob.position.z);
                muzzle.addScaledVector(shot.direction, mob.radius + 0.4);
                this.onShoot?.(muzzle, shot.direction, shot.damage);
            }
            if (mob.exploded) {
                const blast = mob.position.clone();
                blast.y += mob.height * 0.5;
                this.onExplode?.(blast, mob.type.fuse.power);
            }
            if (mob.dead) {
                this.dropLoot(mob);
                this.remove(i);
            }
        }
    }
    dropLoot(mob) {
        // A creeper that detonated is consumed by the blast and leaves nothing.
        if (mob.exploded)
            return;
        for (const drop of mob.type.drops ?? [mob.type.drop]) {
            if (drop === null || drop === undefined)
                continue;
            const count = mob.type.dropRange ? Math.floor(Math.random() * 3) : 1;
            for (let i = 0; i < count; i++)
                this.onDropItem?.(drop, mob.position.x, mob.position.y + 0.3, mob.position.z);
        }
    }
    /** Returns the closest mob hit by the ray, along with the hit distance. */
    raycast(origin, direction, maxDistance) {
        let closest = null;
        for (const mob of this.mobs) {
            if (mob.dying)
                continue;
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
            const type = pickHostile();
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
            const y = this.grazeableGround(x, z, top, bottom, type);
            if (y === null)
                continue;
            this.spawnHerd(type, x, y, z);
            return;
        }
    }
    spawnHerd(type, x, y, z) {
        this.spawnAt(type, new THREE.Vector3(x + 0.5, y, z + 0.5));
        const herd = HERD_MIN + Math.floor(Math.random() * (HERD_MAX - HERD_MIN + 1));
        for (let i = 1; i < herd && this.animalCount < MAX_ANIMALS; i++) {
            const hx = x + Math.round((Math.random() * 2 - 1) * HERD_SPREAD);
            const hz = z + Math.round((Math.random() * 2 - 1) * HERD_SPREAD);
            const hy = this.grazeableGround(hx, hz, y + 4, y - 4, type);
            if (hy !== null)
                this.spawnAt(type, new THREE.Vector3(hx + 0.5, hy, hz + 0.5));
        }
    }
    /** Highest open spot in the column that rests on grazeable ground under open sky. */
    grazeableGround(x, z, top, bottom, type) {
        for (let y = top; y >= bottom; y--) {
            if (!this.canStandAt(x, y, z, type))
                continue;
            if (!GRAZEABLE.has(this.world.getBlock(x, y - 1, z)))
                continue;
            if (!this.world.isSkyExposed(x, y, z))
                continue;
            return y;
        }
        return null;
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
