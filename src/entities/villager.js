import * as THREE from 'three';
import { buildBoxGeometry } from "../engine/boxmodel.js";
import { moveBody } from "../engine/physics.js";
import { Item } from "../items/ids.js";
import { Block, isLava, isWater } from "../world/blocks.js";
import { JOB_BLOCKS } from "../world/village.js";

const GRAVITY = -28;
const TERMINAL_VELOCITY = -50;
const SWIM_RISE = 2.4;
const LAVA_DPS = 8;

const WALK_SPEED = 1.5;
const PANIC_SPEED = 3.4;
const PANIC_DURATION = 6;
const ARRIVE_DISTANCE = 1.3;
/** Seconds before a baby grows into an adult. */
const GROW_UP_TIME = 180;
const BREED_COOLDOWN = 120;

export const PROFESSION_NAMES = {
    unemployed: 'Unemployed',
    nitwit: 'Nitwit',
    farmer: 'Farmer',
    toolsmith: 'Toolsmith',
    fletcher: 'Fletcher',
};

export const LEVEL_NAMES = ['Novice', 'Apprentice', 'Journeyman', 'Expert', 'Master'];
const LEVEL_XP = [0, 10, 70, 150, 250];

function offer(cost, result, tier, xp, maxUses = 12) {
    return { cost, result, tier, maxUses, uses: 0, xp };
}

const TRADES = {
    farmer: () => [
        offer([{ id: Block.Wheat, count: 20 }], { id: Item.Emerald, count: 1 }, 1, 2, 16),
        offer([{ id: Item.Emerald, count: 1 }], { id: Item.Bread, count: 6 }, 1, 1, 16),
        offer([{ id: Item.Emerald, count: 1 }], { id: Block.Hay, count: 4 }, 2, 5),
        offer([{ id: Block.Hay, count: 10 }], { id: Item.Emerald, count: 3 }, 3, 10),
        offer([{ id: Item.Emerald, count: 1 }], { id: Block.Wheat, count: 8 }, 4, 15),
    ],
    toolsmith: () => [
        offer([{ id: Block.Cobblestone, count: 20 }], { id: Item.Emerald, count: 1 }, 1, 2, 16),
        offer([{ id: Item.Emerald, count: 2 }], { id: Item.StonePickaxe, count: 1 }, 1, 1, 6),
        offer([{ id: Item.Emerald, count: 2 }], { id: Item.StoneAxe, count: 1 }, 2, 5, 6),
        offer([{ id: Item.Emerald, count: 1 }], { id: Item.StoneShovel, count: 1 }, 3, 10, 6),
        offer([{ id: Item.Emerald, count: 4 }], { id: Item.StoneSword, count: 1 }, 4, 15, 4),
        offer([{ id: Item.Emerald, count: 1 }], { id: Block.StoneBricks, count: 8 }, 5, 30),
    ],
    fletcher: () => [
        offer([{ id: Item.Stick, count: 32 }], { id: Item.Emerald, count: 1 }, 1, 2, 16),
        offer([{ id: Item.Emerald, count: 1 }], { id: Block.Planks, count: 16 }, 1, 1, 16),
        offer([{ id: Block.Log, count: 16 }], { id: Item.Emerald, count: 2 }, 2, 5),
        offer([{ id: Item.Emerald, count: 1 }], { id: Item.Arrow, count: 8 }, 3, 10),
        offer([{ id: Block.Planks, count: 24 }], { id: Item.Emerald, count: 3 }, 4, 15),
    ],
};

const SKIN = 0xbe8a60;
const BROW = 0x6b4a2f;
const NOSE = 0xa9764d;

const PALETTES = {
    unemployed: { robe: 0x6b5a46, trim: 0x8f7a5e },
    nitwit: { robe: 0x6b5a46, trim: 0x59a14f },
    farmer: { robe: 0x6b5a46, trim: 0xc9b458 },
    toolsmith: { robe: 0x6b5a46, trim: 0x4d4f57 },
    fletcher: { robe: 0x6b5a46, trim: 0xa3623a },
};

function villagerParts(profession) {
    const { robe, trim } = PALETTES[profession];
    return [
        { size: [0.22, 0.72, 0.22], offset: [-0.13, 0.36, 0], color: robe },
        { size: [0.22, 0.72, 0.22], offset: [0.13, 0.36, 0], color: robe },
        { size: [0.6, 0.74, 0.34], offset: [0, 1.09, 0], color: robe },
        // Profession colours show as an apron across the chest.
        { size: [0.62, 0.3, 0.36], offset: [0, 0.98, 0], color: trim },
        { size: [0.22, 0.54, 0.24], offset: [-0.4, 1.18, 0], color: robe },
        { size: [0.22, 0.54, 0.24], offset: [0.4, 1.18, 0], color: robe },
        // Villagers hold their hands together in front of the belly.
        { size: [0.46, 0.22, 0.26], offset: [0, 1.06, -0.24], color: trim },
        { size: [0.52, 0.5, 0.5], offset: [0, 1.71, 0], color: SKIN },
        { size: [0.54, 0.12, 0.52], offset: [0, 1.88, 0], color: BROW },
        { size: [0.14, 0.26, 0.16], offset: [0, 1.66, -0.31], color: NOSE },
    ];
}

const geometryCache = new Map();

function villagerGeometry(profession) {
    let geometry = geometryCache.get(profession);
    if (!geometry) {
        geometry = buildBoxGeometry(villagerParts(profession));
        geometryCache.set(profession, geometry);
    }
    return geometry;
}

export class Villager {
    position = new THREE.Vector3();
    velocity = new THREE.Vector3();
    site;
    mesh;
    radius = 0.3;
    height = 1.95;
    onGround = false;
    health = 20;
    dead = false;
    profession;
    bed = null;
    job = null;
    level = 1;
    xp = 0;
    trades = [];
    baby;
    age;
    willing = false;
    breedCooldown = 0;
    sleeping = false;
    yaw = 0;
    walkPhase = 0;
    panicTimer = 0;
    fleeFrom = new THREE.Vector3();
    wanderTimer = 0;
    wanderTarget = new THREE.Vector3();
    hurtTimer = 0;
    restocksToday = 0;
    lastSchedule = 'wander';

    constructor(site, position, material, profession, baby = false) {
        this.site = site;
        this.profession = profession;
        this.baby = baby;
        this.age = baby ? 0 : GROW_UP_TIME;
        this.position.copy(position);
        this.wanderTarget.copy(position);
        this.mesh = new THREE.Mesh(villagerGeometry(profession), material);
        this.mesh.position.copy(position);
        this.applySize();
        this.setProfession(profession);
    }

    get name() {
        return this.baby ? 'Baby Villager' : PROFESSION_NAMES[this.profession];
    }

    get canTrade() {
        return !this.baby && this.profession !== 'unemployed' && this.profession !== 'nitwit';
    }

    get levelName() {
        return LEVEL_NAMES[this.level - 1];
    }

    /** Offers the player can currently see, i.e. unlocked by the villager's level. */
    get availableTrades() {
        return this.trades.filter((trade) => trade.tier <= this.level);
    }

    setProfession(profession) {
        this.profession = profession;
        this.mesh.geometry = villagerGeometry(profession);
        this.trades = profession === 'unemployed' || profession === 'nitwit' ? [] : TRADES[profession]();
    }

    /** Records a completed trade and promotes the villager when it earns enough XP. */
    completeTrade(trade) {
        trade.uses++;
        this.xp += trade.xp;
        while (this.level < 5 && this.xp >= LEVEL_XP[this.level])
            this.level++;
        this.health = Math.min(20, this.health + 2);
    }

    damage(amount) {
        if (this.health <= 0)
            return false;
        this.hurt(amount, new THREE.Vector3());
        return true;
    }

    hurt(amount, knockback) {
        this.health -= amount;
        this.hurtTimer = 0.25;
        this.sleeping = false;
        this.panic(this.position.clone().sub(knockback));
        this.velocity.x += knockback.x * 5;
        this.velocity.z += knockback.z * 5;
        if (this.onGround)
            this.velocity.y = 4.5;
        if (this.health <= 0)
            this.dead = true;
    }

    applyKnockback(x, z, up) {
        this.velocity.x += x;
        this.velocity.z += z;
        if (this.onGround)
            this.velocity.y = up;
    }

    /** Bread makes a villager willing to breed, like food does in the original game. */
    feed() {
        if (this.baby || this.willing || this.breedCooldown > 0)
            return false;
        this.willing = true;
        return true;
    }

    panic(threat) {
        this.panicTimer = PANIC_DURATION;
        this.fleeFrom.copy(threat);
    }

    update(dt, world, day, playerPosition) {
        this.hurtTimer = Math.max(0, this.hurtTimer - dt);
        this.panicTimer = Math.max(0, this.panicTimer - dt);
        this.breedCooldown = Math.max(0, this.breedCooldown - dt);

        if (this.baby) {
            this.age += dt;
            if (this.age >= GROW_UP_TIME) {
                this.baby = false;
                this.applySize();
            }
        }

        this.verifyJob(world);

        const schedule = this.scheduleFor(day);
        if (schedule !== this.lastSchedule) {
            if (schedule === 'wander' && this.lastSchedule === 'sleep')
                this.restocksToday = 0;
            this.lastSchedule = schedule;
        }

        const target = this.targetFor(schedule, dt);
        const toTarget = target ? target.clone().sub(this.position) : null;
        const flat = toTarget ? Math.hypot(toTarget.x, toTarget.z) : 0;
        const arrived = toTarget === null || flat < ARRIVE_DISTANCE;

        this.sleeping = schedule === 'sleep' && arrived && this.bed !== null && this.panicTimer === 0;
        if (this.sleeping)
            this.sleep();
        else
            this.walk(dt, world, toTarget, flat, arrived, schedule);

        if (schedule === 'work' && arrived && this.job)
            this.restock();

        if (arrived && playerPosition && this.panicTimer === 0 && !this.sleeping) {
            const toPlayer = playerPosition.clone().sub(this.position);
            if (toPlayer.lengthSq() < 36)
                this.yaw = Math.atan2(-toPlayer.x, -toPlayer.z);
        }

        this.render();
    }

    walk(dt, world, toTarget, flat, arrived, schedule) {
        let dirX = 0;
        let dirZ = 0;
        const fleeing = this.panicTimer > 0;

        if (fleeing) {
            const away = this.position.clone().sub(this.fleeFrom);
            const length = Math.hypot(away.x, away.z) || 1;
            dirX = away.x / length;
            dirZ = away.z / length;
        }
        else if (toTarget && !arrived) {
            dirX = toTarget.x / flat;
            dirZ = toTarget.z / flat;
        }

        const base = fleeing ? PANIC_SPEED : WALK_SPEED * (schedule === 'play' ? 1.5 : 1);
        const speed = base * (this.baby ? 1.2 : 1);
        this.velocity.x = dirX * speed;
        this.velocity.z = dirZ * speed;

        const fluid = world.getBlock(Math.floor(this.position.x), Math.floor(this.position.y + 0.2), Math.floor(this.position.z));
        if (isLava(fluid)) {
            this.health -= LAVA_DPS * dt;
            if (this.health <= 0) {
                this.dead = true;
                return;
            }
        }

        if (isWater(fluid) || isLava(fluid)) {
            this.velocity.y = SWIM_RISE;
        }
        else {
            this.velocity.y = Math.max(this.velocity.y + GRAVITY * dt, TERMINAL_VELOCITY);
            if (this.onGround && (dirX !== 0 || dirZ !== 0) && this.blockedAhead(world, dirX, dirZ)) {
                this.velocity.y = 8.2;
            }
        }

        moveBody(world, this, dt);

        if (dirX !== 0 || dirZ !== 0) {
            this.yaw = Math.atan2(-dirX, -dirZ);
            this.walkPhase += dt * speed * 3;
        }
    }

    /** Lies down on the claimed bed instead of standing on top of it. */
    sleep() {
        this.velocity.set(0, 0, 0);
        if (!this.bed)
            return;
        this.position.set(this.bed.x + 0.5, this.bed.y, this.bed.z + 0.5);
    }

    scheduleFor(day) {
        const t = day.time;
        if (t >= 0.75 || t < 0.25)
            return 'sleep';
        if (this.baby)
            return 'play';
        const employed = this.profession !== 'unemployed' && this.profession !== 'nitwit';
        if (t < 1 / 3)
            return 'wander';
        if (t < 0.625)
            return employed ? 'work' : 'wander';
        if (t < 17 / 24)
            return 'gather';
        return 'wander';
    }

    targetFor(schedule, dt) {
        if (this.panicTimer > 0)
            return null;
        if (schedule === 'sleep' && this.bed)
            return new THREE.Vector3(this.bed.x + 0.5, this.bed.y, this.bed.z + 0.5);
        if (schedule === 'work' && this.job)
            return new THREE.Vector3(this.job.x + 0.5, this.job.y, this.job.z + 0.5);
        if (schedule === 'gather')
            return new THREE.Vector3(this.site.centerX + 0.5, this.site.level + 1, this.site.centerZ + 0.5);

        this.wanderTimer -= dt;
        if (this.wanderTimer <= 0 || this.position.distanceTo(this.wanderTarget) < ARRIVE_DISTANCE) {
            this.wanderTimer = 3 + Math.random() * 5;
            const angle = Math.random() * Math.PI * 2;
            const radius = (schedule === 'play' ? 10 : 16) * Math.sqrt(Math.random());
            this.wanderTarget.set(this.site.centerX + Math.cos(angle) * radius, this.site.level + 1, this.site.centerZ + Math.sin(angle) * radius);
        }
        return this.wanderTarget;
    }

    /** Working refills locked trades, up to twice per day. */
    restock() {
        if (this.restocksToday >= 2)
            return;
        if (!this.trades.some((trade) => trade.uses > 0))
            return;
        this.restocksToday++;
        for (const trade of this.trades)
            trade.uses = 0;
    }

    /** Losing the job site block sends the villager back to unemployment. */
    verifyJob(world) {
        if (!this.job)
            return;
        if (world.getBlock(this.job.x, this.job.y, this.job.z) === JOB_BLOCKS[this.job.profession])
            return;
        this.job = null;
        if (this.xp === 0)
            this.setProfession('unemployed');
    }

    applySize() {
        this.radius = this.baby ? 0.22 : 0.3;
        this.height = this.baby ? 0.98 : 1.95;
    }

    render() {
        const scale = (this.baby ? 0.5 : 1) * (this.hurtTimer > 0 ? 1.15 : 1);
        const bob = !this.sleeping && (this.velocity.x !== 0 || this.velocity.z !== 0)
            ? Math.abs(Math.sin(this.walkPhase)) * 0.06
            : 0;
        this.mesh.scale.setScalar(scale);
        this.mesh.rotation.set(this.sleeping ? -Math.PI / 2 : 0, this.yaw, 0, 'YXZ');
        this.mesh.position.set(this.position.x, this.position.y + bob + (this.sleeping ? 0.25 : 0), this.position.z);
    }

    blockedAhead(world, dirX, dirZ) {
        const ahead = this.radius + 0.35;
        const x = Math.floor(this.position.x + dirX * ahead);
        const z = Math.floor(this.position.z + dirZ * ahead);
        const feet = Math.floor(this.position.y);
        return world.isSolidAt(x, feet, z) && !world.isSolidAt(x, feet + 1, z) && !world.isSolidAt(x, feet + 2, z);
    }

    startBreedCooldown() {
        this.willing = false;
        this.breedCooldown = BREED_COOLDOWN;
    }
}
