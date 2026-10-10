import * as THREE from 'three';
import { moveBody } from "../engine/physics.js";
import { blockCubeGeometry } from "../items/blockmodel.js";
import { isSpriteModel, itemTexture } from "../items/items.js";
import { Block } from "../world/blocks.js";
import { atlasTexture } from "../world/textures.js";
const ITEM_SIZE = 0.3;
const GRAVITY = -24;
const GROUND_DRAG = 3.5;
const PICKUP_DELAY = 0.4;
const MAGNET_RANGE = 2;
const PICKUP_RANGE = 0.75;
const MAGNET_SPEED = 9;
const LIFETIME = 120;
const MAX_DROPS = 200;
const THROW_SPEED = 14;
const THROW_LIFETIME = 5;
let spriteGeometry = null;
/** Two crossed quads so a flat sprite stays visible from every angle. */
function itemSpriteGeometry() {
    if (!spriteGeometry) {
        const plane = new THREE.PlaneGeometry(ITEM_SIZE * 1.4, ITEM_SIZE * 1.4);
        const second = plane.clone().rotateY(Math.PI / 2);
        const merged = new THREE.BufferGeometry();
        const positions = new Float32Array(plane.attributes.position.count * 3 * 2);
        positions.set(plane.attributes.position.array, 0);
        positions.set(second.attributes.position.array, plane.attributes.position.array.length);
        const uvs = new Float32Array(plane.attributes.uv.count * 2 * 2);
        uvs.set(plane.attributes.uv.array, 0);
        uvs.set(second.attributes.uv.array, plane.attributes.uv.array.length);
        const index = [...plane.index.array, ...[...plane.index.array].map((i) => i + plane.attributes.position.count)];
        merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        merged.setIndex(index);
        second.dispose();
        plane.dispose();
        spriteGeometry = merged;
    }
    return spriteGeometry;
}
class ItemDrop {
    blockId;
    position = new THREE.Vector3();
    velocity = new THREE.Vector3();
    radius = ITEM_SIZE / 2;
    height = ITEM_SIZE;
    mesh;
    onGround = false;
    age = 0;
    thrown = false;
    broke = false;
    hurts = 0;
    spinOffset = Math.random() * Math.PI * 2;
    constructor(blockId, position, material, geometry) {
        this.blockId = blockId;
        this.position.copy(position);
        this.velocity.set((Math.random() - 0.5) * 2.4, 4, (Math.random() - 0.5) * 2.4);
        this.mesh = new THREE.Mesh(geometry, material);
    }
    /** Returns true once the player has picked it up. */
    update(dt, world, player) {
        this.age += dt;
        if (this.thrown)
            return this.updateThrown(dt, world, player);
        const target = player.position.clone();
        target.y += 0.9;
        const toPlayer = target.sub(this.position);
        const distance = toPlayer.length();
        if (this.age > PICKUP_DELAY && distance < MAGNET_RANGE && player.health > 0) {
            if (distance < PICKUP_RANGE)
                return true;
            this.position.addScaledVector(toPlayer.normalize(), MAGNET_SPEED * dt);
            this.velocity.set(0, 0, 0);
        }
        else {
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
    updateThrown(dt, world, player) {
        const before = this.velocity.clone();
        this.velocity.y = Math.max(this.velocity.y + GRAVITY * dt, -30);
        moveBody(world, this, dt);
        if (this.hurts > 0) {
            const chest = player.position.clone();
            chest.y += 1;
            if (chest.distanceTo(this.position) < 0.7) {
                player.damage(this.hurts);
                this.broke = true;
            }
        }
        // moveBody zeroes an axis on contact, which is how the egg knows it hit something.
        const stopped = (before.x !== 0 && this.velocity.x === 0) ||
            (before.z !== 0 && this.velocity.z === 0) ||
            this.onGround;
        if (stopped || this.age > THROW_LIFETIME)
            this.broke = true;
        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = this.age * 9;
        this.mesh.rotation.x = this.age * 6;
        return false;
    }
}
export class ItemManager {
    scene;
    world;
    material;
    spriteMaterials = new Map();
    brightness = 1;
    onThrownBreak = null;
    onPickup = null;
    drops = [];
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.material = new THREE.MeshBasicMaterial({ map: atlasTexture(), vertexColors: true });
    }
    get count() {
        return this.drops.length;
    }
    setDaylight(brightness) {
        this.brightness = brightness;
        this.material.color.setScalar(brightness);
        for (const material of this.spriteMaterials.values())
            material.color.setScalar(brightness);
    }
    spriteMaterial(itemId) {
        let material = this.spriteMaterials.get(itemId);
        if (!material) {
            material = new THREE.MeshBasicMaterial({
                map: itemTexture(itemId),
                transparent: true,
                alphaTest: 0.35,
                side: THREE.DoubleSide,
            });
            material.color.setScalar(this.brightness);
            this.spriteMaterials.set(itemId, material);
        }
        return material;
    }
    create(itemId, x, y, z) {
        const sprite = isSpriteModel(itemId);
        const geometry = sprite ? itemSpriteGeometry() : blockCubeGeometry(itemId, ITEM_SIZE);
        const material = sprite ? this.spriteMaterial(itemId) : this.material;
        const drop = new ItemDrop(itemId, new THREE.Vector3(x, y, z), material, geometry);
        this.drops.push(drop);
        this.scene.add(drop.mesh);
        return drop;
    }
    spawn(itemId, x, y, z) {
        // Blocks like glass shatter into nothing; an "Air" stack is not a real item.
        if (itemId === Block.Air)
            return;
        if (this.drops.length >= MAX_DROPS)
            return;
        this.create(itemId, x, y, z);
    }
    /** Hurls an item forward; it shatters on the first thing it touches. */
    throwItem(itemId, origin, direction, { speed = THROW_SPEED, hurts = 0, lift = 2 } = {}) {
        if (this.drops.length >= MAX_DROPS)
            return;
        const drop = this.create(itemId, origin.x, origin.y, origin.z);
        drop.thrown = true;
        drop.hurts = hurts;
        drop.velocity.copy(direction).normalize().multiplyScalar(speed);
        drop.velocity.y += lift;
    }
    update(dt, player, inventory) {
        for (let i = this.drops.length - 1; i >= 0; i--) {
            const drop = this.drops[i];
            const collected = drop.update(dt, this.world, player);
            if (collected) {
                inventory.add(drop.blockId);
                this.onPickup?.(drop.blockId);
            }
            if (drop.broke)
                this.onThrownBreak?.(drop.blockId, drop.position);
            if (collected || drop.broke || drop.age > LIFETIME) {
                this.scene.remove(drop.mesh);
                this.drops.splice(i, 1);
            }
        }
    }
}
