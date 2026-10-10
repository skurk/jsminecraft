import * as THREE from 'three';
import type { Body } from '../engine/physics.ts';
import { moveBody } from '../engine/physics.ts';
import { blockItemGeometry } from '../items/blockmodel.ts';
import type { Inventory } from '../player/inventory.ts';
import type { Player } from '../player/player.ts';
import { Block } from '../world/blocks.ts';
import { atlasTexture } from '../world/textures.ts';
import type { World } from '../world/world.ts';

const ITEM_SIZE = 0.3;
const GRAVITY = -24;
const GROUND_DRAG = 3.5;
const PICKUP_DELAY = 0.4;
const MAGNET_RANGE = 2;
const PICKUP_RANGE = 0.75;
const MAGNET_SPEED = 9;
const LIFETIME = 120;
const MAX_DROPS = 200;

class ItemDrop implements Body {
  readonly blockId: number;
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  readonly radius = ITEM_SIZE / 2;
  readonly height = ITEM_SIZE;
  readonly mesh: THREE.Mesh;

  onGround = false;
  age = 0;

  private readonly spinOffset = Math.random() * Math.PI * 2;

  constructor(blockId: number, position: THREE.Vector3, material: THREE.Material) {
    this.blockId = blockId;
    this.position.copy(position);
    this.velocity.set((Math.random() - 0.5) * 2.4, 4, (Math.random() - 0.5) * 2.4);
    this.mesh = new THREE.Mesh(blockItemGeometry(blockId, ITEM_SIZE), material);
  }

  /** Returns true once the player has picked it up. */
  update(dt: number, world: World, player: Player): boolean {
    this.age += dt;

    const target = player.position.clone();
    target.y += 0.9;
    const toPlayer = target.sub(this.position);
    const distance = toPlayer.length();

    if (this.age > PICKUP_DELAY && distance < MAGNET_RANGE && player.health > 0) {
      if (distance < PICKUP_RANGE) return true;
      this.position.addScaledVector(toPlayer.normalize(), MAGNET_SPEED * dt);
      this.velocity.set(0, 0, 0);
    } else {
      this.velocity.y = Math.max(this.velocity.y + GRAVITY * dt, -30);
      if (this.onGround) {
        const drag = Math.max(0, 1 - GROUND_DRAG * dt);
        this.velocity.x *= drag;
        this.velocity.z *= drag;
      }
      moveBody(world, this, dt);
    }

    const bob = Math.sin(this.age * 2.6 + this.spinOffset) * 0.06;
    this.mesh.position.set(this.position.x, this.position.y + 0.18 + bob, this.position.z);
    this.mesh.rotation.y = this.spinOffset + this.age * 1.8;
    return false;
  }
}

export class ItemManager {
  private readonly scene: THREE.Scene;
  private readonly world: World;
  private readonly material: THREE.MeshBasicMaterial;
  private readonly drops: ItemDrop[] = [];

  constructor(scene: THREE.Scene, world: World) {
    this.scene = scene;
    this.world = world;
    this.material = new THREE.MeshBasicMaterial({
      map: atlasTexture(),
      vertexColors: true,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    });
  }

  get count(): number {
    return this.drops.length;
  }

  setDaylight(brightness: number): void {
    this.material.color.setScalar(brightness);
  }

  spawn(blockId: number, x: number, y: number, z: number): void {
    // Blocks like glass shatter into nothing; an "Air" stack is not a real item.
    if (blockId === Block.Air) return;
    if (this.drops.length >= MAX_DROPS) return;
    const drop = new ItemDrop(blockId, new THREE.Vector3(x, y, z), this.material);
    this.drops.push(drop);
    this.scene.add(drop.mesh);
  }

  update(dt: number, player: Player, inventory: Inventory): void {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      const collected = drop.update(dt, this.world, player);

      if (collected) inventory.add(drop.blockId);
      if (collected || drop.age > LIFETIME) {
        this.scene.remove(drop.mesh);
        this.drops.splice(i, 1);
      }
    }
  }
}
