import * as THREE from 'three';
import { buildBoxGeometry } from "../engine/boxmodel.js";
import { moveBody } from "../engine/physics.js";
import { Block, isLava, isWater } from "../world/blocks.js";
import { Item } from "../items/ids.js";
import { WALK_SPEED } from "../player/player.js";
const GRAVITY = -28;
const TERMINAL_VELOCITY = -50;
const SWIM_RISE = 2.4;
/** Nothing outruns a walking player, so retreating is always an option. */
const MAX_CHASE_SPEED = WALK_SPEED * 0.9;
const FLEE_DURATION = 6;
const PANIC_SPEED_MULTIPLIER = 2.2;
/** A bolting animal can match a walk, so hunting one means sprinting after it. */
const MAX_PANIC_SPEED = WALK_SPEED;
const SHELTER_RESCAN = 0.5;
const SHELTER_SAMPLES = 16;
/** Rings searched for cover, nearest first. */
const SHELTER_RADII = [3, 6, 10];
const BURN_FLASH_INTERVAL = 0.5;
/** How long a scorched mob lurks in cover before it dares chase again. */
const SUN_SHY_DURATION = 8;
const ARROW_SPEED = 26;
/** Seconds to topple onto its side, and how long the body lingers before it is cleared away. */
const DEATH_TILT_TIME = 0.4;
const DEATH_DURATION = 0.8;
const EGG_MIN_INTERVAL = 40;
const EGG_MAX_INTERVAL = 100;
const SUNLIGHT_BURN_DPS = 4;
const LAVA_DPS = 8;
const ZOMBIE_SKIN = 0x4b8b4b;
const ZOMBIE_SHIRT = 0x2f7d6a;
const ZOMBIE_PANTS = 0x2a3a6b;
export const ZOMBIE = {
    id: 'zombie',
    name: 'Zombie',
    health: 20,
    damage: 3,
    speed: 2.6,
    radius: 0.3,
    height: 1.9,
    jumpSpeed: 8.2,
    burnsInSunlight: true,
    alwaysHostile: true,
    passive: false,
    drop: Item.RottenFlesh,
    parts: [
        { size: [0.24, 0.8, 0.24], offset: [-0.15, 0.4, 0], color: ZOMBIE_PANTS },
        { size: [0.24, 0.8, 0.24], offset: [0.15, 0.4, 0], color: ZOMBIE_PANTS },
        { size: [0.56, 0.7, 0.3], offset: [0, 1.15, 0], color: ZOMBIE_SHIRT },
        { size: [0.2, 0.2, 0.62], offset: [-0.38, 1.36, -0.26], color: ZOMBIE_SHIRT },
        { size: [0.2, 0.2, 0.62], offset: [0.38, 1.36, -0.26], color: ZOMBIE_SHIRT },
        { size: [0.21, 0.21, 0.18], offset: [-0.38, 1.36, -0.64], color: ZOMBIE_SKIN },
        { size: [0.21, 0.21, 0.18], offset: [0.38, 1.36, -0.64], color: ZOMBIE_SKIN },
        { size: [0.5, 0.5, 0.5], offset: [0, 1.75, 0], color: ZOMBIE_SKIN },
        { size: [0.34, 0.16, 0.02], offset: [0, 1.82, -0.26], color: 0x12230f },
    ],
};
const SPIDER_BODY = 0x33261d;
const SPIDER_LEG = 0x241a13;
function spiderLegs() {
    const legs = [];
    for (let i = 0; i < 4; i++) {
        const z = -0.22 + i * 0.18;
        for (const side of [-1, 1]) {
            legs.push({ size: [0.46, 0.08, 0.08], offset: [side * 0.56, 0.46, z], color: SPIDER_LEG });
            legs.push({ size: [0.08, 0.46, 0.08], offset: [side * 0.77, 0.23, z], color: SPIDER_LEG });
        }
    }
    return legs;
}
export const SPIDER = {
    id: 'spider',
    name: 'Spider',
    health: 16,
    damage: 2,
    speed: 3.9,
    radius: 0.45,
    height: 0.85,
    jumpSpeed: 8.8,
    burnsInSunlight: false,
    alwaysHostile: false,
    passive: false,
    drop: null,
    parts: [
        { size: [0.86, 0.46, 0.66], offset: [0, 0.48, 0.12], color: SPIDER_BODY },
        { size: [0.5, 0.38, 0.42], offset: [0, 0.5, -0.46], color: 0x3d2e22 },
        { size: [0.1, 0.1, 0.06], offset: [-0.14, 0.58, -0.69], color: 0xd63a2a },
        { size: [0.1, 0.1, 0.06], offset: [0.14, 0.58, -0.69], color: 0xd63a2a },
        ...spiderLegs(),
    ],
};
export const MOB_TYPES = [ZOMBIE, SPIDER];
const CREEPER_BODY = 0x58a447;
const CREEPER_DARK = 0x0f1a10;
export const CREEPER = {
    id: 'creeper',
    name: 'Creeper',
    health: 20,
    damage: 0,
    speed: 2.6,
    radius: 0.3,
    height: 1.7,
    jumpSpeed: 8.2,
    burnsInSunlight: false,
    alwaysHostile: true,
    passive: false,
    drop: Item.Gunpowder,
    drops: [Item.Gunpowder],
    dropRange: true,
    // Stops at 3 blocks, swells for 1.5s, and aborts if the target gets 7 away.
    fuse: { trigger: 3, seconds: 1.5, cancel: 7, power: 3, maxDamage: 22 },
    parts: [
        { size: [0.25, 0.37, 0.25], offset: [-0.12, 0.19, -0.19], color: CREEPER_BODY, mottle: 0.34 },
        { size: [0.25, 0.37, 0.25], offset: [0.12, 0.19, -0.19], color: CREEPER_BODY, mottle: 0.34 },
        { size: [0.25, 0.37, 0.25], offset: [-0.12, 0.19, 0.19], color: CREEPER_BODY, mottle: 0.34 },
        { size: [0.25, 0.37, 0.25], offset: [0.12, 0.19, 0.19], color: CREEPER_BODY, mottle: 0.34 },
        { size: [0.5, 0.75, 0.25], offset: [0, 0.75, 0], color: CREEPER_BODY, mottle: 0.34 },
        { size: [0.5, 0.5, 0.5], offset: [0, 1.37, 0], color: CREEPER_BODY, mottle: 0.34 },
        { size: [0.13, 0.13, 0.03], offset: [-0.13, 1.47, -0.26], color: CREEPER_DARK },
        { size: [0.13, 0.13, 0.03], offset: [0.13, 1.47, -0.26], color: CREEPER_DARK },
        { size: [0.13, 0.22, 0.03], offset: [0, 1.3, -0.26], color: CREEPER_DARK },
        { size: [0.28, 0.1, 0.03], offset: [0, 1.36, -0.26], color: CREEPER_DARK },
    ],
};
const BONE = 0xd8d6cb;
const BOW_WOOD = 0x6b4a26;
export const SKELETON = {
    id: 'skeleton',
    name: 'Skeleton',
    health: 20,
    damage: 0,
    speed: 2.6,
    radius: 0.3,
    height: 1.99,
    jumpSpeed: 8.2,
    burnsInSunlight: true,
    alwaysHostile: true,
    passive: false,
    drop: Item.Bone,
    drops: [Item.Bone, Item.Arrow],
    dropRange: true,
    // Fires from 15 blocks and backs off if crowded, as in Java Edition.
    bow: { range: 15, cooldown: 2, retreat: 4, damage: [3, 5] },
    parts: [
        { size: [0.13, 0.75, 0.13], offset: [-0.1, 0.37, 0], color: BONE },
        { size: [0.13, 0.75, 0.13], offset: [0.1, 0.37, 0], color: BONE },
        { size: [0.4, 0.6, 0.2], offset: [0, 1.05, 0], color: BONE },
        { size: [0.13, 0.13, 0.5], offset: [-0.26, 1.28, -0.2], color: BONE },
        { size: [0.13, 0.13, 0.5], offset: [0.26, 1.28, -0.2], color: BONE },
        { size: [0.44, 0.44, 0.44], offset: [0, 1.6, 0], color: BONE },
        { size: [0.09, 0.09, 0.03], offset: [-0.1, 1.64, -0.23], color: 0x101010 },
        { size: [0.09, 0.09, 0.03], offset: [0.1, 1.64, -0.23], color: 0x101010 },
        { size: [0.05, 0.62, 0.05], offset: [-0.3, 1.28, -0.44], color: BOW_WOOD },
        { size: [0.05, 0.08, 0.1], offset: [-0.3, 1.58, -0.4], color: BOW_WOOD },
        { size: [0.05, 0.08, 0.1], offset: [-0.3, 0.98, -0.4], color: BOW_WOOD },
    ],
};
const CHICKEN_BODY = 0xe9e9e4;
const CHICKEN_BEAK = 0xe0a62e;
export const CHICKEN = {
    id: 'chicken',
    name: 'Chicken',
    health: 4,
    damage: 0,
    speed: 1.4,
    radius: 0.25,
    height: 0.75,
    jumpSpeed: 8.2,
    burnsInSunlight: false,
    alwaysHostile: false,
    passive: true,
    drop: Item.RawChicken,
    laysEggs: true,
    parts: [
        { size: [0.3, 0.3, 0.42], offset: [0, 0.44, 0], color: CHICKEN_BODY },
        { size: [0.06, 0.26, 0.32], offset: [-0.18, 0.46, 0], color: 0xd8d8d2 },
        { size: [0.06, 0.26, 0.32], offset: [0.18, 0.46, 0], color: 0xd8d8d2 },
        { size: [0.22, 0.22, 0.22], offset: [0, 0.68, -0.22], color: CHICKEN_BODY },
        { size: [0.1, 0.08, 0.12], offset: [0, 0.66, -0.37], color: CHICKEN_BEAK },
        { size: [0.07, 0.12, 0.05], offset: [0, 0.56, -0.31], color: 0xc43a30 },
        { size: [0.06, 0.1, 0.12], offset: [0, 0.82, -0.2], color: 0xc43a30 },
        { size: [0.07, 0.3, 0.07], offset: [-0.09, 0.15, 0.02], color: CHICKEN_BEAK },
        { size: [0.07, 0.3, 0.07], offset: [0.09, 0.15, 0.02], color: CHICKEN_BEAK },
    ],
};
const PIG_SKIN = 0xef9d9d;
export const PIG = {
    id: 'pig',
    name: 'Pig',
    health: 10,
    damage: 0,
    speed: 1.8,
    radius: 0.35,
    height: 0.95,
    jumpSpeed: 8.3,
    burnsInSunlight: false,
    alwaysHostile: false,
    passive: true,
    drop: Item.RawPork,
    parts: [
        { size: [0.58, 0.5, 0.9], offset: [0, 0.58, 0], color: PIG_SKIN },
        { size: [0.42, 0.4, 0.36], offset: [0, 0.62, -0.6], color: PIG_SKIN },
        { size: [0.2, 0.15, 0.08], offset: [0, 0.56, -0.81], color: 0xd98282 },
        { size: [0.07, 0.07, 0.03], offset: [-0.13, 0.72, -0.78], color: 0x241a13 },
        { size: [0.07, 0.07, 0.03], offset: [0.13, 0.72, -0.78], color: 0x241a13 },
        { size: [0.15, 0.33, 0.15], offset: [-0.18, 0.16, -0.3], color: 0xe08a8a },
        { size: [0.15, 0.33, 0.15], offset: [0.18, 0.16, -0.3], color: 0xe08a8a },
        { size: [0.15, 0.33, 0.15], offset: [-0.18, 0.16, 0.3], color: 0xe08a8a },
        { size: [0.15, 0.33, 0.15], offset: [0.18, 0.16, 0.3], color: 0xe08a8a },
    ],
};
const WOOL = 0xf0efe6;
export const SHEEP = {
    id: 'sheep',
    name: 'Sheep',
    health: 10,
    damage: 0,
    speed: 1.7,
    radius: 0.38,
    height: 1.2,
    jumpSpeed: 8.3,
    burnsInSunlight: false,
    alwaysHostile: false,
    passive: true,
    drop: Item.Mutton,
    parts: [
        { size: [0.68, 0.6, 0.96], offset: [0, 0.82, 0], color: WOOL },
        { size: [0.34, 0.4, 0.34], offset: [0, 0.92, -0.62], color: 0xd9cfbd },
        { size: [0.38, 0.26, 0.26], offset: [0, 1.1, -0.56], color: WOOL },
        { size: [0.06, 0.06, 0.03], offset: [-0.11, 0.98, -0.79], color: 0x241a13 },
        { size: [0.06, 0.06, 0.03], offset: [0.11, 0.98, -0.79], color: 0x241a13 },
        { size: [0.15, 0.52, 0.15], offset: [-0.2, 0.26, -0.3], color: 0xdcd5c6 },
        { size: [0.15, 0.52, 0.15], offset: [0.2, 0.26, -0.3], color: 0xdcd5c6 },
        { size: [0.15, 0.52, 0.15], offset: [-0.2, 0.26, 0.3], color: 0xdcd5c6 },
        { size: [0.15, 0.52, 0.15], offset: [0.2, 0.26, 0.3], color: 0xdcd5c6 },
    ],
};
const HIDE = 0x8b5a2b;
const MANE = 0x3f2a14;
export const HORSE = {
    id: 'horse',
    name: 'Horse',
    health: 15,
    damage: 0,
    speed: 2.4,
    radius: 0.45,
    height: 1.6,
    jumpSpeed: 8.8,
    burnsInSunlight: false,
    alwaysHostile: false,
    passive: true,
    drop: null,
    parts: [
        { size: [0.6, 0.66, 1.3], offset: [0, 1.05, 0], color: HIDE },
        { size: [0.28, 0.56, 0.34], offset: [0, 1.4, -0.56], color: HIDE },
        { size: [0.26, 0.26, 0.54], offset: [0, 1.6, -0.86], color: HIDE },
        { size: [0.1, 0.52, 0.3], offset: [0, 1.52, -0.42], color: MANE },
        { size: [0.07, 0.12, 0.07], offset: [-0.1, 1.78, -0.68], color: HIDE },
        { size: [0.07, 0.12, 0.07], offset: [0.1, 1.78, -0.68], color: HIDE },
        { size: [0.1, 0.46, 0.12], offset: [0, 1.12, 0.7], color: MANE },
        { size: [0.17, 0.74, 0.17], offset: [-0.21, 0.37, -0.42], color: 0x7a4e24 },
        { size: [0.17, 0.74, 0.17], offset: [0.21, 0.37, -0.42], color: 0x7a4e24 },
        { size: [0.17, 0.74, 0.17], offset: [-0.21, 0.37, 0.45], color: 0x7a4e24 },
        { size: [0.17, 0.74, 0.17], offset: [0.21, 0.37, 0.45], color: 0x7a4e24 },
    ],
};
export const ANIMAL_TYPES = [CHICKEN, PIG, SHEEP, HORSE];
const geometryCache = new Map();
export function mobGeometry(type) {
    let geometry = geometryCache.get(type.id);
    if (!geometry) {
        geometry = buildBoxGeometry(type.parts);
        geometryCache.set(type.id, geometry);
    }
    return geometry;
}
export class Mob {
    type;
    position = new THREE.Vector3();
    velocity = new THREE.Vector3();
    mesh;
    radius;
    height;
    onGround = false;
    health;
    dead = false;
    yaw = 0;
    attackTimer = 0;
    hurtTimer = 0;
    wanderTimer = 0;
    wanderX = 0;
    wanderZ = 0;
    walkPhase = 0;
    fleeTimer = 0;
    fleeX = 0;
    fleeZ = 0;
    shelterTimer = 0;
    shelterX = 0;
    shelterZ = 0;
    shelterPhase = Math.random() * Math.PI * 2;
    burnFlash = 0;
    sunShyTimer = 0;
    fuseTimer = 0;
    shootTimer = 0;
    strafe = Math.random() < 0.5 ? 1 : -1;
    pendingShot = null;
    exploded = false;
    dying = false;
    deathTimer = 0;
    eggTimer = EGG_MIN_INTERVAL + Math.random() * (EGG_MAX_INTERVAL - EGG_MIN_INTERVAL);
    pendingEgg = false;
    material;
    hurtMaterial;
    constructor(type, position, material, hurtMaterial, healthScale = 1) {
        this.type = type;
        this.radius = type.radius;
        this.height = type.height;
        this.health = type.health * healthScale;
        this.position.copy(position);
        this.material = material;
        this.hurtMaterial = hurtMaterial;
        this.mesh = new THREE.Mesh(mobGeometry(type), material);
        this.mesh.position.copy(position);
    }
    get eyeHeight() {
        return this.height * 0.85;
    }
    hurt(amount, knockback) {
        if (this.dying)
            return;
        this.health -= amount;
        this.hurtTimer = 0.25;
        this.velocity.x += knockback.x * 6;
        this.velocity.z += knockback.z * 6;
        if (this.type.passive) {
            this.fleeTimer = FLEE_DURATION;
            this.fleeX = knockback.x;
            this.fleeZ = knockback.z;
        }
        if (this.onGround)
            this.velocity.y = 5;
        if (this.health <= 0)
            this.die();
    }
    die() {
        this.dying = true;
        this.deathTimer = 0;
        this.velocity.set(0, 0, 0);
    }
    /** Tips the body onto its side and holds it there, so a kill reads before the corpse vanishes. */
    updateDeath(dt, world) {
        this.deathTimer += dt;
        this.velocity.x = 0;
        this.velocity.z = 0;
        moveBody(world, this, dt);
        const roll = Math.min(1, this.deathTimer / DEATH_TILT_TIME) * (Math.PI / 2);
        this.mesh.position.copy(this.position);
        this.mesh.rotation.set(0, this.yaw, roll);
        this.mesh.material = this.hurtMaterial;
        this.mesh.scale.setScalar(1);
        if (this.deathTimer >= DEATH_DURATION)
            this.dead = true;
    }
    update(dt, world, player, dark, daylight, difficulty, prey = null) {
        this.attackTimer = Math.max(0, this.attackTimer - dt);
        this.hurtTimer = Math.max(0, this.hurtTimer - dt);
        if (this.dying) {
            this.updateDeath(dt, world);
            return;
        }
        const scorching = this.type.burnsInSunlight && daylight &&
            world.isSkyExposed(Math.floor(this.position.x), Math.floor(this.position.y), Math.floor(this.position.z));
        if (scorching) {
            this.health -= SUNLIGHT_BURN_DPS * dt;
            this.sunShyTimer = SUN_SHY_DURATION;
            this.pulseBurn(dt);
            if (this.health <= 0) {
                this.die();
                return;
            }
            this.updateShelterSearch(dt, world);
        }
        else {
            this.shelterTimer = 0;
            this.shelterX = 0;
            this.shelterZ = 0;
            this.sunShyTimer = Math.max(0, this.sunShyTimer - dt);
        }
        const toPlayer = player.position.clone().sub(this.position);
        const distance = toPlayer.length();
        // Villagers are hunted like the player, but creepers and bows stay fixed on the
        // player so their own range checks are unaffected.
        const preyDistance = prey && prey.health > 0 ? prey.position.distanceTo(this.position) : Infinity;
        const victim = preyDistance < distance ? prey : player;
        const toVictim = victim === player ? toPlayer : victim.position.clone().sub(this.position);
        const victimDistance = Math.min(distance, preyDistance);
        const hostile = !this.type.passive && (this.type.alwaysHostile || dark);
        const chasing = hostile && victimDistance < difficulty.aggroRange && victim.health > 0;
        const fleeing = this.fleeTimer > 0;
        this.fleeTimer = Math.max(0, this.fleeTimer - dt);
        this.updateEgg(dt);
        const sheltering = this.shelterX !== 0 || this.shelterZ !== 0;
        // Fresh out of the sun: hold the shade rather than stepping straight back into it.
        const cowering = !sheltering && this.sunShyTimer > 0;
        const priming = this.updateFuse(dt, distance, chasing, world, player, difficulty);
        const aiming = this.updateBow(dt, distance, chasing, toPlayer, difficulty);
        let dirX = 0;
        let dirZ = 0;
        if (this.dead)
            return;
        if (priming) {
            dirX = 0;
            dirZ = 0;
        }
        else if (aiming) {
            dirX = aiming.x;
            dirZ = aiming.z;
        }
        else if (sheltering) {
            dirX = this.shelterX;
            dirZ = this.shelterZ;
        }
        else if (cowering) {
            dirX = 0;
            dirZ = 0;
        }
        else if (chasing) {
            const flat = Math.hypot(toVictim.x, toVictim.z) || 1;
            dirX = toVictim.x / flat;
            dirZ = toVictim.z / flat;
        }
        else if (fleeing) {
            // Keep heading directly away from the player, so chasing does not corner it.
            const flat = Math.hypot(toPlayer.x, toPlayer.z);
            if (flat > 0.01) {
                dirX = -toPlayer.x / flat;
                dirZ = -toPlayer.z / flat;
            }
            else {
                dirX = this.fleeX;
                dirZ = this.fleeZ;
            }
        }
        else {
            this.wanderTimer -= dt;
            if (this.wanderTimer <= 0) {
                this.wanderTimer = 2 + Math.random() * 4;
                const angle = Math.random() * Math.PI * 2;
                const idle = Math.random() < 0.35;
                this.wanderX = idle ? 0 : Math.cos(angle);
                this.wanderZ = idle ? 0 : Math.sin(angle);
            }
            dirX = this.wanderX;
            dirZ = this.wanderZ;
        }
        const speed = fleeing
            ? Math.min(this.type.speed * PANIC_SPEED_MULTIPLIER, MAX_PANIC_SPEED)
            : Math.min(this.type.speed * difficulty.speedMultiplier, MAX_CHASE_SPEED) *
                (chasing || sheltering ? 1 : 0.45);
        this.velocity.x = dirX * speed;
        this.velocity.z = dirZ * speed;
        const inFluid = world.getBlock(Math.floor(this.position.x), Math.floor(this.position.y + 0.2), Math.floor(this.position.z));
        if (isLava(inFluid)) {
            this.health -= LAVA_DPS * dt;
            this.pulseBurn(dt);
            if (this.health <= 0) {
                this.die();
                return;
            }
        }
        if (isWater(inFluid) || isLava(inFluid)) {
            this.velocity.y = SWIM_RISE;
        }
        else {
            this.velocity.y = Math.max(this.velocity.y + GRAVITY * dt, TERMINAL_VELOCITY);
            if (this.onGround && (dirX !== 0 || dirZ !== 0) && this.blockedAhead(world, dirX, dirZ)) {
                this.velocity.y = this.type.jumpSpeed;
            }
        }
        moveBody(world, this, dt);
        if (dirX !== 0 || dirZ !== 0) {
            this.yaw = Math.atan2(-dirX, -dirZ);
            this.walkPhase += dt * speed * 3;
        }
        if (chasing && this.attackTimer === 0) {
            const reach = this.radius + 0.45;
            if (Math.hypot(toVictim.x, toVictim.z) < reach && Math.abs(toVictim.y) < this.height + 0.5) {
                if (victim.damage(this.type.damage * difficulty.damageMultiplier)) {
                    this.attackTimer = difficulty.attackCooldown;
                    const flat = Math.hypot(toVictim.x, toVictim.z) || 1;
                    victim.applyKnockback((toVictim.x / flat) * 5, (toVictim.z / flat) * 5, 4.5);
                }
            }
        }
        const bob = dirX !== 0 || dirZ !== 0 ? Math.abs(Math.sin(this.walkPhase)) * 0.06 : 0;
        this.mesh.position.set(this.position.x, this.position.y + bob, this.position.z);
        this.mesh.rotation.y = this.yaw;
        const hurting = this.hurtTimer > 0;
        // A priming creeper owns its scale, so the hit pop must not overwrite the swell.
        const swelling = this.fuseTimer > 0;
        this.mesh.material = hurting || swelling ? this.hurtMaterial : this.material;
        if (!swelling)
            this.mesh.scale.setScalar(hurting ? 1.15 : 1);
    }
    /** Reuses the hit flash so steady burn damage is visible, not silent. */
    pulseBurn(dt) {
        this.burnFlash -= dt;
        if (this.burnFlash <= 0) {
            this.burnFlash = BURN_FLASH_INTERVAL;
            this.hurtTimer = 0.15;
        }
    }
    /** Swells while the player stays close, then detonates. Returns true while priming. */
    updateFuse(dt, distance, chasing, world, player, difficulty) {
        const fuse = this.type.fuse;
        if (!fuse)
            return false;
        if (!chasing || distance > fuse.cancel) {
            this.fuseTimer = 0;
            this.mesh.scale.setScalar(1);
            return false;
        }
        if (this.fuseTimer === 0 && distance > fuse.trigger)
            return false;
        this.fuseTimer += dt;
        const swell = this.fuseTimer / fuse.seconds;
        this.mesh.scale.setScalar(1 + swell * 0.4);
        if (this.fuseTimer < fuse.seconds)
            return true;
        this.explode(world, player, difficulty);
        return true;
    }
    explode(world, player, difficulty) {
        const fuse = this.type.fuse;
        const radius = fuse.power * 1.33;
        const origin = this.position.clone();
        origin.y += this.height * 0.5;
        const reach = origin.distanceTo(player.eyePosition);
        if (reach < radius) {
            const falloff = 1 - reach / radius;
            player.hurt(fuse.maxDamage * falloff * difficulty.damageMultiplier);
            const push = player.position.clone().sub(this.position).setY(0).normalize();
            player.applyKnockback(push.x * 9, push.z * 9, 6);
        }
        const cx = Math.floor(origin.x);
        const cy = Math.floor(origin.y);
        const cz = Math.floor(origin.z);
        const blocks = Math.floor(radius);
        for (let dy = -blocks; dy <= blocks; dy++) {
            for (let dz = -blocks; dz <= blocks; dz++) {
                for (let dx = -blocks; dx <= blocks; dx++) {
                    if (dx * dx + dy * dy + dz * dz > blocks * blocks)
                        continue;
                    const id = world.getBlock(cx + dx, cy + dy, cz + dz);
                    if (id === Block.Air || id === Block.Bedrock)
                        continue;
                    world.setBlock(cx + dx, cy + dy, cz + dz, Block.Air);
                }
            }
        }
        this.exploded = true;
        this.dead = true;
    }
    /** Keeps bow range and fires on cooldown. Returns a strafe direction while engaged. */
    updateBow(dt, distance, chasing, toPlayer, difficulty) {
        const bow = this.type.bow;
        if (!bow)
            return null;
        this.shootTimer = Math.max(0, this.shootTimer - dt);
        if (!chasing || distance > bow.range)
            return null;
        if (this.shootTimer === 0) {
            this.shootTimer = bow.cooldown * (2 - difficulty.speedMultiplier);
            const aim = toPlayer.clone().normalize();
            // Lift the shot slightly so gravity does not drop it short.
            aim.y += 0.1;
            const [low, high] = bow.damage;
            this.pendingShot = {
                direction: aim.normalize(),
                damage: (low + Math.random() * (high - low)) * difficulty.damageMultiplier,
            };
        }
        const flat = Math.hypot(toPlayer.x, toPlayer.z) || 1;
        const towardX = toPlayer.x / flat;
        const towardZ = toPlayer.z / flat;
        // Back off when crowded, otherwise circle the target.
        if (distance < bow.retreat)
            return { x: -towardX, z: -towardZ };
        return { x: -towardZ * this.strafe, z: towardX * this.strafe };
    }
    /** Looks for open ground with something overhead, so burning mobs make for cover. */
    updateShelterSearch(dt, world) {
        this.shelterTimer -= dt;
        if (this.shelterTimer > 0)
            return;
        this.shelterTimer = SHELTER_RESCAN;
        const y = Math.floor(this.position.y);
        for (const radius of SHELTER_RADII) {
            for (let i = 0; i < SHELTER_SAMPLES; i++) {
                const angle = this.shelterPhase + (i / SHELTER_SAMPLES) * Math.PI * 2;
                const dx = Math.cos(angle);
                const dz = Math.sin(angle);
                const x = Math.floor(this.position.x + dx * radius);
                const z = Math.floor(this.position.z + dz * radius);
                if (world.getBlock(x, y, z) !== Block.Air || world.isSkyExposed(x, y, z))
                    continue;
                this.shelterX = dx;
                this.shelterZ = dz;
                return;
            }
        }
        // No cover in reach, so keep moving rather than standing still and cooking.
        if (this.shelterX === 0 && this.shelterZ === 0) {
            const angle = Math.random() * Math.PI * 2;
            this.shelterX = Math.cos(angle);
            this.shelterZ = Math.sin(angle);
        }
    }
    updateEgg(dt) {
        if (!this.type.laysEggs)
            return;
        this.eggTimer -= dt;
        if (this.eggTimer > 0)
            return;
        this.eggTimer = EGG_MIN_INTERVAL + Math.random() * (EGG_MAX_INTERVAL - EGG_MIN_INTERVAL);
        this.pendingEgg = true;
    }
    /** True when a one-block step is in the way and can be jumped onto. */
    blockedAhead(world, dirX, dirZ) {
        const ahead = this.radius + 0.35;
        const x = Math.floor(this.position.x + dirX * ahead);
        const z = Math.floor(this.position.z + dirZ * ahead);
        const feet = Math.floor(this.position.y);
        return world.isSolidAt(x, feet, z) && !world.isSolidAt(x, feet + 1, z) && !world.isSolidAt(x, feet + 2, z);
    }
}
