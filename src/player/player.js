import * as THREE from 'three';
import { audio } from "../engine/audio.js";
import { moveBody } from "../engine/physics.js";
import { Block, blockContactDamage, blockSurface, isLava, isWater } from "../world/blocks.js";
const PLAYER_HEIGHT = 1.8;
const PLAYER_RADIUS = 0.3;
const EYE_HEIGHT = 1.62;
const GRAVITY = -28;
const JUMP_SPEED = 8.6;
export const WALK_SPEED = 4.6;
const SPRINT_SPEED = 7.4;
const FLY_SPEED = 13;
const SWIM_SPEED = 3.4;
const SWIM_RISE_SPEED = 4;
const WATER_SINK_SPEED = -2.6;
/** Grace period after breaking the surface in which Space still counts as a jump. */
const LIQUID_EXIT_GRACE = 0.25;
const LAVA_SPEED = 1.8;
const LAVA_RISE_SPEED = 1.6;
const LAVA_SINK_SPEED = -1.2;
const TERMINAL_VELOCITY = -54;
const MOUSE_SENSITIVITY = 0.0022;
/** Radians per second when looking around with the arrow keys. */
const ARROW_LOOK_SPEED = 2.2;
const MAX_PITCH = Math.PI / 2 - 0.01;
const MAX_HEALTH = 20;
const HURT_IMMUNITY = 0.5;
const REGEN_DELAY = 6;
const REGEN_INTERVAL = 2;
/** Blocks you can drop before landing starts to hurt. */
const SAFE_FALL = 3;
const FALL_DAMAGE_PER_BLOCK = 1;
const LAVA_DPS = 6;
const BURN_DPS = 2;
const BURN_DURATION = 8;
/** Seconds of breath before the player starts drowning. */
const AIR_CAPACITY = 14;
const DROWN_DPS = 2;
const AIR_REFILL_RATE = 5;
const SICK_DPS = 0.35;
/** Blocks of ground covered between footfalls. */
const STRIDE = 2.1;
/** A drop shorter than this lands quietly, so hopping doesn't boom. */
const LANDING_FALL = 1.2;
const JUMP_VOLUME = 1.2;
/** Quiet beat after a take-off, so the push-off doesn't run into a stride. */
const JUMP_STEP_DELAY = 0.25;
const DEATH_TILT = Math.PI / 2;
const DEATH_TILT_SPEED = Math.PI;
export class Player {
    /** Centre of the player's feet. */
    position = new THREE.Vector3();
    velocity = new THREE.Vector3();
    radius = PLAYER_RADIUS;
    height = PLAYER_HEIGHT;
    yaw = 0;
    pitch = 0;
    onGround = false;
    flying = false;
    inWater = false;
    inLava = false;
    submerged = false;
    air = AIR_CAPACITY;
    liquidExit = 0;
    sickTimer = 0;
    maxHealth = MAX_HEALTH;
    health = MAX_HEALTH;
    knockback = new THREE.Vector3();
    hurtTimer = 0;
    regenTimer = 0;
    fallDistance = 0;
    burnTimer = 0;
    deathTilt = 0;
    strideWalked = 0;
    stepDelay = 0;
    constructor(x, y, z) {
        this.position.set(x, y, z);
    }
    get eyePosition() {
        return new THREE.Vector3(this.position.x, this.position.y + EYE_HEIGHT, this.position.z);
    }
    get burning() {
        return this.burnTimer > 0;
    }
    get dead() {
        return this.health <= 0;
    }
    get airFraction() {
        return this.air / AIR_CAPACITY;
    }
    get sick() {
        return this.sickTimer > 0;
    }
    /** Restores health, and for spoiled food starts a bout of illness. */
    eat(food) {
        if (this.dead)
            return false;
        this.health = Math.min(this.maxHealth, this.health + food.heal);
        if (food.sickness > 0)
            this.sickTimer = Math.max(this.sickTimer, food.sickness);
        return true;
    }
    /** Returns false while the player is still in post-hit immunity. */
    damage(amount) {
        if (this.hurtTimer > 0 || this.health <= 0)
            return false;
        this.hurtTimer = HURT_IMMUNITY;
        this.hurt(amount);
        return true;
    }
    applyKnockback(x, z, up) {
        this.knockback.x += x;
        this.knockback.z += z;
        if (this.onGround)
            this.velocity.y = up;
    }
    respawn(x, y, z) {
        this.position.set(x, y, z);
        this.velocity.set(0, 0, 0);
        this.knockback.set(0, 0, 0);
        this.health = this.maxHealth;
        this.hurtTimer = 0;
        this.regenTimer = 0;
        this.fallDistance = 0;
        this.burnTimer = 0;
        this.deathTilt = 0;
        this.strideWalked = 0;
        this.stepDelay = 0;
        this.air = AIR_CAPACITY;
        this.liquidExit = 0;
        this.sickTimer = 0;
        this.flying = false;
    }
    /** Environmental damage, which ignores post-hit immunity. */
    hurt(amount) {
        if (this.health <= 0)
            return;
        this.health = Math.max(0, this.health - amount);
        this.regenTimer = 0;
    }
    toggleFly() {
        this.flying = !this.flying;
        this.velocity.set(0, 0, 0);
    }
    update(dt, input, world) {
        if (this.dead) {
            input.consumeMouseDelta();
            this.deathTilt = Math.min(DEATH_TILT, this.deathTilt + DEATH_TILT_SPEED * dt);
            this.velocity.x = 0;
            this.velocity.z = 0;
            this.knockback.set(0, 0, 0);
            this.velocity.y = Math.max(this.velocity.y + GRAVITY * dt, TERMINAL_VELOCITY);
            moveBody(world, this, dt);
            this.fallDistance = 0;
            return;
        }
        if (input.locked) {
            const [mx, my] = input.consumeMouseDelta();
            this.yaw -= mx * MOUSE_SENSITIVITY;
            this.pitch = THREE.MathUtils.clamp(this.pitch - my * MOUSE_SENSITIVITY, -MAX_PITCH, MAX_PITCH);
        }
        else {
            input.consumeMouseDelta();
        }
        const turn = (input.isDown('ArrowRight') ? 1 : 0) - (input.isDown('ArrowLeft') ? 1 : 0);
        const tilt = (input.isDown('ArrowDown') ? 1 : 0) - (input.isDown('ArrowUp') ? 1 : 0);
        if (turn !== 0 || tilt !== 0) {
            this.yaw -= turn * ARROW_LOOK_SPEED * dt;
            this.pitch = THREE.MathUtils.clamp(this.pitch - tilt * ARROW_LOOK_SPEED * dt, -MAX_PITCH, MAX_PITCH);
        }
        const feet = world.getBlock(Math.floor(this.position.x), Math.floor(this.position.y + 0.4), Math.floor(this.position.z));
        this.inWater = isWater(feet);
        this.inLava = isLava(feet);
        const forward = (input.isDown('KeyW') ? 1 : 0) - (input.isDown('KeyS') ? 1 : 0);
        const strafe = (input.isDown('KeyD') ? 1 : 0) - (input.isDown('KeyA') ? 1 : 0);
        const sin = Math.sin(this.yaw);
        const cos = Math.cos(this.yaw);
        let dx = -sin * forward + cos * strafe;
        let dz = -cos * forward - sin * strafe;
        const length = Math.hypot(dx, dz);
        if (length > 0) {
            dx /= length;
            dz /= length;
        }
        const sprinting = (input.isDown('ShiftLeft') || input.sprinting) && !this.flying;
        const speed = this.flying
            ? FLY_SPEED
            : this.inLava
                ? LAVA_SPEED
                : this.inWater
                    ? SWIM_SPEED
                    : sprinting
                        ? SPRINT_SPEED
                        : WALK_SPEED;
        this.velocity.x = dx * speed + this.knockback.x;
        this.velocity.z = dz * speed + this.knockback.z;
        this.knockback.multiplyScalar(Math.max(0, 1 - dt * 5));
        const wantsUp = input.isDown('Space');
        if (this.flying) {
            const down = input.isDown('ShiftLeft') ? 1 : 0;
            this.velocity.y = ((wantsUp ? 1 : 0) - down) * FLY_SPEED;
        }
        else if (this.inLava) {
            this.velocity.y = wantsUp ? LAVA_RISE_SPEED : LAVA_SINK_SPEED;
        }
        else if (this.inWater) {
            this.velocity.y = wantsUp ? SWIM_RISE_SPEED : Math.max(this.velocity.y + GRAVITY * 0.3 * dt, WATER_SINK_SPEED);
        }
        else {
            if (wantsUp && (this.onGround || this.liquidExit > 0)) {
                if (this.onGround) {
                    audio.playFootstep(this.surfaceUnder(world), JUMP_VOLUME);
                    this.stepDelay = JUMP_STEP_DELAY;
                }
                this.velocity.y = JUMP_SPEED;
                this.liquidExit = 0;
            }
            this.velocity.y = Math.max(this.velocity.y + GRAVITY * dt, TERMINAL_VELOCITY);
        }
        this.liquidExit = this.inWater || this.inLava ? LIQUID_EXIT_GRACE : Math.max(0, this.liquidExit - dt);
        const previousY = this.position.y;
        const previousX = this.position.x;
        const previousZ = this.position.z;
        const wasAirborne = !this.onGround;
        const fallen = this.fallDistance;
        moveBody(world, this, dt);
        this.updateFootsteps(dt, world, previousX, previousZ, wasAirborne, fallen);
        this.updateFallDamage(previousY);
        this.updateBurning(dt);
        this.updateContactDamage(world);
        this.updateBreath(dt, world);
        this.updateSickness(dt);
        this.updateVitals(dt);
    }
    applyTo(camera) {
        camera.position.copy(this.eyePosition);
        camera.rotation.set(this.pitch, this.yaw, this.deathTilt, 'YXZ');
    }
    /** The footstep voicing of whatever is being stood on right now. */
    surfaceUnder(world) {
        if (this.inWater)
            return 'water';
        return blockSurface(world.getBlock(Math.floor(this.position.x), Math.floor(this.position.y - 0.2), Math.floor(this.position.z)));
    }
    /** Footfalls are paced by ground covered, so they track walking and sprinting alike. */
    updateFootsteps(dt, world, previousX, previousZ, wasAirborne, fallen) {
        this.stepDelay = Math.max(0, this.stepDelay - dt);
        if (this.flying || this.inLava || !this.onGround) {
            // Halfway through a stride, so the first step after landing comes soon.
            this.strideWalked = STRIDE * 0.5;
            return;
        }
        if (this.stepDelay > 0)
            return;
        const surface = this.surfaceUnder(world);
        if (wasAirborne) {
            this.strideWalked = 0;
            audio.playFootstep(surface, fallen > LANDING_FALL ? 1.4 : 0.8);
            return;
        }
        this.strideWalked += Math.hypot(this.position.x - previousX, this.position.z - previousZ);
        if (this.strideWalked < STRIDE)
            return;
        this.strideWalked -= STRIDE;
        audio.playFootstep(surface, this.inWater ? 0.8 : 1);
    }
    updateFallDamage(previousY) {
        if (this.flying || this.inWater || this.inLava) {
            this.fallDistance = 0;
            return;
        }
        if (this.onGround) {
            const excess = this.fallDistance - SAFE_FALL;
            if (excess > 0)
                this.hurt(Math.round(excess * FALL_DAMAGE_PER_BLOCK));
            this.fallDistance = 0;
            return;
        }
        const dropped = previousY - this.position.y;
        if (dropped > 0)
            this.fallDistance += dropped;
    }
    updateBurning(dt) {
        if (this.inLava) {
            this.burnTimer = BURN_DURATION;
            this.hurt(LAVA_DPS * dt);
            return;
        }
        if (this.inWater) {
            this.burnTimer = 0;
            return;
        }
        if (this.burnTimer > 0) {
            this.burnTimer = Math.max(0, this.burnTimer - dt);
            this.hurt(BURN_DPS * dt);
        }
    }
    /** Spiky blocks hurt on contact; post-hit immunity paces the damage. */
    updateContactDamage(world) {
        const reach = this.radius + 0.12;
        const minX = Math.floor(this.position.x - reach);
        const maxX = Math.floor(this.position.x + reach);
        const minZ = Math.floor(this.position.z - reach);
        const maxZ = Math.floor(this.position.z + reach);
        const minY = Math.floor(this.position.y + 0.1);
        const maxY = Math.floor(this.position.y + this.height - 0.1);
        for (let y = minY; y <= maxY; y++) {
            for (let z = minZ; z <= maxZ; z++) {
                for (let x = minX; x <= maxX; x++) {
                    const hurts = blockContactDamage(world.getBlock(x, y, z));
                    if (hurts > 0) {
                        this.damage(hurts);
                        return;
                    }
                }
            }
        }
    }
    updateBreath(dt, world) {
        const eye = this.eyePosition;
        this.submerged = isWater(world.getBlock(Math.floor(eye.x), Math.floor(eye.y), Math.floor(eye.z)));
        if (!this.submerged) {
            this.air = Math.min(AIR_CAPACITY, this.air + dt * AIR_REFILL_RATE);
            return;
        }
        this.air = Math.max(0, this.air - dt);
        if (this.air === 0)
            this.hurt(DROWN_DPS * dt);
    }
    updateSickness(dt) {
        if (this.sickTimer <= 0)
            return;
        this.sickTimer = Math.max(0, this.sickTimer - dt);
        this.hurt(SICK_DPS * dt);
    }
    updateVitals(dt) {
        this.hurtTimer = Math.max(0, this.hurtTimer - dt);
        if (this.health <= 0 || this.health >= this.maxHealth)
            return;
        this.regenTimer += dt;
        if (this.regenTimer >= REGEN_DELAY + REGEN_INTERVAL) {
            this.regenTimer -= REGEN_INTERVAL;
            this.health = Math.min(this.maxHealth, this.health + 1);
        }
    }
}
