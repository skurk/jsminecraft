import type * as THREE from 'three';
import type { World } from '../world/world.ts';

const EPSILON = 1e-3;

/** Anything that moves through the voxel grid with an axis-aligned box. */
export interface Body {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  radius: number;
  height: number;
  onGround: boolean;
}

/** Slab-method ray/AABB intersection; returns the entry distance or null. */
export function rayBoxDistance(
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  min: THREE.Vector3,
  max: THREE.Vector3,
): number | null {
  let near = 0;
  let far = Infinity;

  for (const axis of ['x', 'y', 'z'] as const) {
    const d = direction[axis];
    const o = origin[axis];

    if (Math.abs(d) < 1e-8) {
      if (o < min[axis] || o > max[axis]) return null;
      continue;
    }

    let t1 = (min[axis] - o) / d;
    let t2 = (max[axis] - o) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];

    near = Math.max(near, t1);
    far = Math.min(far, t2);
    if (near > far) return null;
  }

  return near;
}

type Axis = 'x' | 'y' | 'z';

export function moveBody(world: World, body: Body, dt: number): void {
  body.onGround = false;
  moveAxis(world, body, 'x', body.velocity.x * dt);
  moveAxis(world, body, 'z', body.velocity.z * dt);
  moveAxis(world, body, 'y', body.velocity.y * dt);
}

/** Moves along a single axis and resolves the first blocking voxel it meets. */
function moveAxis(world: World, body: Body, axis: Axis, amount: number): void {
  if (amount === 0) return;
  body.position[axis] += amount;

  const p = body.position;
  const r = body.radius;
  const minX = Math.floor(p.x - r);
  const maxX = Math.floor(p.x + r);
  const minY = Math.floor(p.y);
  const maxY = Math.floor(p.y + body.height - EPSILON);
  const minZ = Math.floor(p.z - r);
  const maxZ = Math.floor(p.z + r);

  for (let y = minY; y <= maxY; y++) {
    for (let z = minZ; z <= maxZ; z++) {
      for (let x = minX; x <= maxX; x++) {
        if (!world.isSolidAt(x, y, z)) continue;

        if (axis === 'x') {
          p.x = amount > 0 ? x - r - EPSILON : x + 1 + r + EPSILON;
          body.velocity.x = 0;
        } else if (axis === 'z') {
          p.z = amount > 0 ? z - r - EPSILON : z + 1 + r + EPSILON;
          body.velocity.z = 0;
        } else if (amount > 0) {
          p.y = y - body.height - EPSILON;
          body.velocity.y = 0;
        } else {
          p.y = y + 1 + EPSILON;
          body.velocity.y = 0;
          body.onGround = true;
        }

        return;
      }
    }
  }
}
