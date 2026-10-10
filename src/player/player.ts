import * as THREE from 'three';
import type { Input } from '../engine/input.ts';
import type { Body } from '../engine/physics.ts';
import { moveBody } from '../engine/physics.ts';
import { Block, isWater } from '../world/blocks.ts';
import type { World } from '../world/world.ts';

const PLAYER_HEIGHT = 1.8;
const PLAYER_RADIUS = 0.3;
const EYE_HEIGHT = 1.62;

const GRAVITY = -28;
const JUMP_SPEED = 8.6;
const WALK_SPEED = 4.6;
const SPRINT_SPEED = 7.4;
const FLY_SPEED = 13;
const SWIM_SPEED = 3.4;
const SWIM_RISE_SPEED = 4;
const LAVA_SPEED = 1.8;
const LAVA_RISE_SPEED = 1.6;
const LAVA_SINK_SPEED = -1.2;
const TERMINAL_VELOCITY = -54;
const MOUSE_SENSITIVITY = 0.0022;
/** Radians per second when turning with the arrow keys instead of the mouse. */
const KEY_LOOK_SPEED = 2.4;
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

export class Player implements Body {
  /** Centre of the player's feet. */
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  readonly radius = PLAYER_RADIUS;
  readonly height = PLAYER_HEIGHT;

  yaw = 0;
  pitch = 0;
  onGround = false;
  flying = false;
  inWater = false;
  inLava = false;

  readonly maxHealth = MAX_HEALTH;
  health = MAX_HEALTH;

  private readonly knockback = new THREE.Vector3();
  private hurtTimer = 0;
  private regenTimer = 0;
  private fallDistance = 0;
  private burnTimer = 0;

  constructor(x: number, y: number, z: number) {
    this.position.set(x, y, z);
  }

  get eyePosition(): THREE.Vector3 {
    return new THREE.Vector3(this.position.x, this.position.y + EYE_HEIGHT, this.position.z);
  }

  get burning(): boolean {
    return this.burnTimer > 0;
  }

  /** Returns false while the player is still in post-hit immunity. */
  damage(amount: number): boolean {
    if (this.hurtTimer > 0 || this.health <= 0) return false;
    this.hurtTimer = HURT_IMMUNITY;
    this.hurt(amount);
    return true;
  }

  applyKnockback(x: number, z: number, up: number): void {
    this.knockback.x += x;
    this.knockback.z += z;
    if (this.onGround) this.velocity.y = up;
  }

  heal(amount: number): void {
    if (this.health <= 0) return;
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  respawn(x: number, y: number, z: number): void {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
    this.knockback.set(0, 0, 0);
    this.health = this.maxHealth;
    this.hurtTimer = 0;
    this.regenTimer = 0;
    this.fallDistance = 0;
    this.burnTimer = 0;
    this.flying = false;
  }

  /** Environmental damage, which ignores post-hit immunity. */
  private hurt(amount: number): void {
    if (this.health <= 0) return;
    this.health = Math.max(0, this.health - amount);
    this.regenTimer = 0;
  }

  toggleFly(): void {
    this.flying = !this.flying;
    this.velocity.set(0, 0, 0);
  }

  update(dt: number, input: Input, world: World): void {
    if (input.locked) {
      const [mx, my] = input.consumeMouseDelta();
      this.yaw -= mx * MOUSE_SENSITIVITY;
      this.pitch = THREE.MathUtils.clamp(this.pitch - my * MOUSE_SENSITIVITY, -MAX_PITCH, MAX_PITCH);
    } else {
      input.consumeMouseDelta();
    }

    const turn = (input.isDown('ArrowRight') ? 1 : 0) - (input.isDown('ArrowLeft') ? 1 : 0);
    const tilt = (input.isDown('ArrowDown') ? 1 : 0) - (input.isDown('ArrowUp') ? 1 : 0);
    if (turn !== 0 || tilt !== 0) {
      this.yaw -= turn * KEY_LOOK_SPEED * dt;
      this.pitch = THREE.MathUtils.clamp(
        this.pitch - tilt * KEY_LOOK_SPEED * dt,
        -MAX_PITCH,
        MAX_PITCH,
      );
    }

    const feet = world.getBlock(
      Math.floor(this.position.x),
      Math.floor(this.position.y + 0.4),
      Math.floor(this.position.z),
    );
    this.inWater = isWater(feet);
    this.inLava = feet === Block.Lava;

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

    const sprinting = input.isDown('ShiftLeft') && !this.flying;
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
    } else if (this.inLava) {
      this.velocity.y = wantsUp ? LAVA_RISE_SPEED : LAVA_SINK_SPEED;
    } else if (this.inWater) {
      this.velocity.y = wantsUp ? SWIM_RISE_SPEED : Math.max(this.velocity.y + GRAVITY * 0.25 * dt, -3);
    } else {
      if (wantsUp && this.onGround) this.velocity.y = JUMP_SPEED;
      this.velocity.y = Math.max(this.velocity.y + GRAVITY * dt, TERMINAL_VELOCITY);
    }

    const previousY = this.position.y;
    moveBody(world, this, dt);
    this.updateFallDamage(previousY);
    this.updateBurning(dt);
    this.updateVitals(dt);
  }

  applyTo(camera: THREE.Camera): void {
    camera.position.copy(this.eyePosition);
    camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  private updateFallDamage(previousY: number): void {
    if (this.flying || this.inWater || this.inLava) {
      this.fallDistance = 0;
      return;
    }

    if (this.onGround) {
      const excess = this.fallDistance - SAFE_FALL;
      if (excess > 0) this.hurt(Math.round(excess * FALL_DAMAGE_PER_BLOCK));
      this.fallDistance = 0;
      return;
    }

    const dropped = previousY - this.position.y;
    if (dropped > 0) this.fallDistance += dropped;
  }

  private updateBurning(dt: number): void {
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

  private updateVitals(dt: number): void {
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    if (this.health <= 0 || this.health >= this.maxHealth) return;

    this.regenTimer += dt;
    if (this.regenTimer >= REGEN_DELAY + REGEN_INTERVAL) {
      this.regenTimer -= REGEN_INTERVAL;
      this.health = Math.min(this.maxHealth, this.health + 1);
    }
  }
}
