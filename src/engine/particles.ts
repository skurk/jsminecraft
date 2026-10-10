import * as THREE from 'three';
import { buildBoxGeometry } from './boxmodel.ts';

const GRAVITY = -18;
const MAX_PARTICLES = 200;
const SHARD_SIZE = 0.1;

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  spinX: number;
  spinZ: number;
}

/** Short-lived debris cubes, used for effects like shattering glass. */
export class Particles {
  private readonly scene: THREE.Scene;
  private readonly material: THREE.MeshBasicMaterial;
  private readonly geometries = new Map<number, THREE.BufferGeometry>();
  private readonly live: Particle[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.material = new THREE.MeshBasicMaterial({ vertexColors: true });
  }

  get count(): number {
    return this.live.length;
  }

  setDaylight(brightness: number): void {
    this.material.color.setScalar(brightness);
  }

  /** Throws a puff of shards out from the centre of a block. */
  burst(color: number, x: number, y: number, z: number, count = 16): void {
    const geometry = this.geometryFor(color);

    for (let i = 0; i < count && this.live.length < MAX_PARTICLES; i++) {
      const mesh = new THREE.Mesh(geometry, this.material);
      mesh.position.set(
        x + (Math.random() - 0.5) * 0.7,
        y + (Math.random() - 0.5) * 0.7,
        z + (Math.random() - 0.5) * 0.7,
      );
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);

      const angle = Math.random() * Math.PI * 2;
      const speed = 1.2 + Math.random() * 2.4;
      const velocity = new THREE.Vector3(
        Math.cos(angle) * speed * 0.6,
        speed * (0.4 + Math.random() * 0.8),
        Math.sin(angle) * speed * 0.6,
      );

      const maxLife = 0.45 + Math.random() * 0.45;
      this.scene.add(mesh);
      this.live.push({
        mesh,
        velocity,
        life: maxLife,
        maxLife,
        spinX: (Math.random() - 0.5) * 14,
        spinZ: (Math.random() - 0.5) * 14,
      });
    }
  }

  update(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const particle = this.live[i];
      particle.life -= dt;

      if (particle.life <= 0) {
        this.scene.remove(particle.mesh);
        this.live.splice(i, 1);
        continue;
      }

      particle.velocity.y += GRAVITY * dt;
      particle.mesh.position.addScaledVector(particle.velocity, dt);
      particle.mesh.rotation.x += particle.spinX * dt;
      particle.mesh.rotation.z += particle.spinZ * dt;
      particle.mesh.scale.setScalar(Math.max(0.2, particle.life / particle.maxLife));
    }
  }

  private geometryFor(color: number): THREE.BufferGeometry {
    let geometry = this.geometries.get(color);
    if (!geometry) {
      geometry = buildBoxGeometry([{ size: [SHARD_SIZE, SHARD_SIZE, SHARD_SIZE], offset: [0, 0, 0], color }]);
      this.geometries.set(color, geometry);
    }
    return geometry;
  }
}
