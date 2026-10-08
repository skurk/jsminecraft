import * as THREE from 'three';
import { buildBoxGeometry } from '../engine/boxmodel.ts';
import { blockCubeGeometry } from '../items/blockmodel.ts';
import { isBlockItem, itemTexture } from '../items/items.ts';
import { Block } from '../world/blocks.ts';
import { atlasTexture } from '../world/textures.ts';

const SKIN = 0xd9a077;
const SLEEVE = 0x3f7fd6;

const SWING_DURATION = 0.3;
const ARM_LENGTH = 0.88;
// The mesh pivots at the shoulder, which sits just off the bottom-right of the view.
const REST_POSITION = new THREE.Vector3(0.66, -0.58, -0.3);
const REST_ROTATION = new THREE.Euler(0.28, 0.48, 0.08);

/** First-person arm drawn in its own overlay pass so terrain never clips it. */
export class Hand {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(70, 1, 0.01, 10);

  private readonly arm: THREE.Mesh;
  private readonly material: THREE.MeshBasicMaterial;
  private readonly held: THREE.Mesh;
  private readonly heldMaterial: THREE.MeshBasicMaterial;
  private readonly heldBlock: THREE.Mesh;
  private heldItem: number | null = null;
  private swingTime = SWING_DURATION;

  constructor() {
    this.material = new THREE.MeshBasicMaterial({ vertexColors: true });
    // Built along -Z from the origin so rotations swing the arm from the shoulder.
    const geometry = buildBoxGeometry([
      { size: [0.2, 0.2, 0.62], offset: [0, 0, -0.33], color: SLEEVE },
      { size: [0.22, 0.22, 0.24], offset: [0, 0, -0.76], color: SKIN },
    ]);

    this.arm = new THREE.Mesh(geometry, this.material);
    this.arm.position.copy(REST_POSITION);
    this.arm.rotation.copy(REST_ROTATION);
    this.scene.add(this.arm);

    this.heldMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.held = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.52), this.heldMaterial);
    this.held.position.set(0, 0.04, -ARM_LENGTH + 0.04);
    this.held.rotation.set(0, Math.PI / 2, Math.PI / 2);
    this.held.visible = false;
    this.arm.add(this.held);

    this.heldBlock = new THREE.Mesh(
      blockCubeGeometry(Block.Grass, 0.28),
      new THREE.MeshBasicMaterial({ map: atlasTexture(), vertexColors: true }),
    );
    this.heldBlock.position.set(0, 0.06, -ARM_LENGTH - 0.04);
    this.heldBlock.rotation.set(0.3, 0.8, 0.2);
    this.heldBlock.visible = false;
    this.arm.add(this.heldBlock);
  }

  setHeldItem(itemId: number | null): void {
    if (itemId === this.heldItem) return;
    this.heldItem = itemId;

    const block = itemId !== null && isBlockItem(itemId) && itemId !== Block.Air;
    this.held.visible = itemId !== null && !block;
    this.heldBlock.visible = block;

    if (block) {
      this.heldBlock.geometry = blockCubeGeometry(itemId, 0.28);
    } else if (itemId !== null) {
      this.heldMaterial.map = itemTexture(itemId);
      this.heldMaterial.needsUpdate = true;
    }
  }

  swing(): void {
    this.swingTime = 0;
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** Keeps the arm readable at night instead of fading to black with the terrain. */
  setDaylight(brightness: number): void {
    this.material.color.setScalar(0.35 + 0.65 * brightness);
  }

  update(dt: number): void {
    if (this.swingTime >= SWING_DURATION) return;
    this.swingTime = Math.min(SWING_DURATION, this.swingTime + dt);

    const t = this.swingTime / SWING_DURATION;
    // Front-loaded curve drives the strike, back-loaded curve the follow-through.
    const strike = Math.sin(Math.sqrt(t) * Math.PI);
    const sweep = Math.sin(t * t * Math.PI);
    const arc = Math.sin(Math.sqrt(t) * Math.PI * 2);

    this.arm.position.set(
      REST_POSITION.x - sweep * 0.1,
      REST_POSITION.y + arc * 0.07,
      REST_POSITION.z - strike * 0.16,
    );
    this.arm.rotation.set(
      REST_ROTATION.x + strike * 0.6,
      REST_ROTATION.y + sweep * 0.22,
      REST_ROTATION.z - strike * 0.28,
    );
  }
}
