import * as THREE from 'three';
import type { BoxPart } from '../engine/boxmodel.ts';
import { buildBoxGeometry } from '../engine/boxmodel.ts';
import type { Difficulty } from '../engine/difficulty.ts';
import type { Body } from '../engine/physics.ts';
import { moveBody } from '../engine/physics.ts';
import type { Player } from '../player/player.ts';
import { Block, isWater } from '../world/blocks.ts';
import type { World } from '../world/world.ts';

const GRAVITY = -28;
const TERMINAL_VELOCITY = -50;
const SWIM_RISE = 2.4;
const SUNLIGHT_BURN_DPS = 4;
const LAVA_DPS = 8;

export interface MobType {
  id: string;
  name: string;
  health: number;
  damage: number;
  speed: number;
  radius: number;
  height: number;
  jumpSpeed: number;
  /** Burns away when caught in direct sunlight. */
  burnsInSunlight: boolean;
  /** Attacks regardless of the light level it is standing in. */
  alwaysHostile: boolean;
  parts: BoxPart[];
}

const ZOMBIE_SKIN = 0x4b8b4b;
const ZOMBIE_SHIRT = 0x2f7d6a;
const ZOMBIE_PANTS = 0x2a3a6b;

export const ZOMBIE: MobType = {
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

function spiderLegs(): BoxPart[] {
  const legs: BoxPart[] = [];
  for (let i = 0; i < 4; i++) {
    const z = -0.22 + i * 0.18;
    for (const side of [-1, 1]) {
      legs.push({ size: [0.46, 0.08, 0.08], offset: [side * 0.56, 0.46, z], color: SPIDER_LEG });
      legs.push({ size: [0.08, 0.46, 0.08], offset: [side * 0.77, 0.23, z], color: SPIDER_LEG });
    }
  }
  return legs;
}

export const SPIDER: MobType = {
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
  parts: [
    { size: [0.86, 0.46, 0.66], offset: [0, 0.48, 0.12], color: SPIDER_BODY },
    { size: [0.5, 0.38, 0.42], offset: [0, 0.5, -0.46], color: 0x3d2e22 },
    { size: [0.1, 0.1, 0.06], offset: [-0.14, 0.58, -0.69], color: 0xd63a2a },
    { size: [0.1, 0.1, 0.06], offset: [0.14, 0.58, -0.69], color: 0xd63a2a },
    ...spiderLegs(),
  ],
};

export const MOB_TYPES: MobType[] = [ZOMBIE, SPIDER];

const geometryCache = new Map<string, THREE.BufferGeometry>();

export function mobGeometry(type: MobType): THREE.BufferGeometry {
  let geometry = geometryCache.get(type.id);
  if (!geometry) {
    geometry = buildBoxGeometry(type.parts);
    geometryCache.set(type.id, geometry);
  }
  return geometry;
}

export class Mob implements Body {
  readonly type: MobType;
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  readonly mesh: THREE.Mesh;
  readonly radius: number;
  readonly height: number;

  onGround = false;
  health: number;
  dead = false;

  private yaw = 0;
  private attackTimer = 0;
  private hurtTimer = 0;
  private wanderTimer = 0;
  private wanderX = 0;
  private wanderZ = 0;
  private walkPhase = 0;

  constructor(type: MobType, position: THREE.Vector3, material: THREE.Material, healthScale = 1) {
    this.type = type;
    this.radius = type.radius;
    this.height = type.height;
    this.health = type.health * healthScale;
    this.position.copy(position);
    this.mesh = new THREE.Mesh(mobGeometry(type), material);
    this.mesh.position.copy(position);
  }

  get eyeHeight(): number {
    return this.height * 0.85;
  }

  hurt(amount: number, knockback: THREE.Vector3): void {
    this.health -= amount;
    this.hurtTimer = 0.25;
    this.velocity.x += knockback.x * 6;
    this.velocity.z += knockback.z * 6;
    if (this.onGround) this.velocity.y = 5;
    if (this.health <= 0) this.dead = true;
  }

  update(
    dt: number,
    world: World,
    player: Player,
    dark: boolean,
    daylight: boolean,
    difficulty: Difficulty,
  ): void {
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);

    if (this.type.burnsInSunlight && daylight && world.isSkyExposed(
      Math.floor(this.position.x),
      Math.floor(this.position.y),
      Math.floor(this.position.z),
    )) {
      this.health -= SUNLIGHT_BURN_DPS * dt;
      if (this.health <= 0) {
        this.dead = true;
        return;
      }
    }

    const toPlayer = player.position.clone().sub(this.position);
    const distance = toPlayer.length();
    const hostile = this.type.alwaysHostile || dark;
    const chasing = hostile && distance < difficulty.aggroRange && player.health > 0;

    let dirX = 0;
    let dirZ = 0;

    if (chasing) {
      const flat = Math.hypot(toPlayer.x, toPlayer.z) || 1;
      dirX = toPlayer.x / flat;
      dirZ = toPlayer.z / flat;
    } else {
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

    const speed = this.type.speed * difficulty.speedMultiplier * (chasing ? 1 : 0.45);
    this.velocity.x = dirX * speed;
    this.velocity.z = dirZ * speed;

    const inFluid = world.getBlock(
      Math.floor(this.position.x),
      Math.floor(this.position.y + 0.2),
      Math.floor(this.position.z),
    );

    if (inFluid === Block.Lava) {
      this.health -= LAVA_DPS * dt;
      if (this.health <= 0) {
        this.dead = true;
        return;
      }
    }

    if (isWater(inFluid) || inFluid === Block.Lava) {
      this.velocity.y = SWIM_RISE;
    } else {
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
      if (Math.hypot(toPlayer.x, toPlayer.z) < reach && Math.abs(toPlayer.y) < this.height + 0.5) {
        if (player.damage(this.type.damage * difficulty.damageMultiplier)) {
          this.attackTimer = difficulty.attackCooldown;
          const flat = Math.hypot(toPlayer.x, toPlayer.z) || 1;
          player.applyKnockback((toPlayer.x / flat) * 5, (toPlayer.z / flat) * 5, 4.5);
        }
      }
    }

    const bob = dirX !== 0 || dirZ !== 0 ? Math.abs(Math.sin(this.walkPhase)) * 0.06 : 0;
    this.mesh.position.set(this.position.x, this.position.y + bob, this.position.z);
    this.mesh.rotation.y = this.yaw;
    this.mesh.scale.setScalar(this.hurtTimer > 0 ? 1.15 : 1);
  }

  /** True when a one-block step is in the way and can be jumped onto. */
  private blockedAhead(world: World, dirX: number, dirZ: number): boolean {
    const ahead = this.radius + 0.35;
    const x = Math.floor(this.position.x + dirX * ahead);
    const z = Math.floor(this.position.z + dirZ * ahead);
    const feet = Math.floor(this.position.y);
    return world.isSolidAt(x, feet, z) && !world.isSolidAt(x, feet + 1, z) && !world.isSolidAt(x, feet + 2, z);
  }
}
