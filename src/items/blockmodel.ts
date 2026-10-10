import * as THREE from 'three';
import { BLOCKS, isCross } from '../world/blocks.ts';
import { tileUVBounds } from '../world/textures.ts';

const cache = new Map<string, THREE.BufferGeometry>();

/** Geometry for a block shown as an item: a cube, or a sprite for crops. */
export function blockItemGeometry(blockId: number, size: number): THREE.BufferGeometry {
  const key = `${blockId}:${size}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const geometry = isCross(blockId) ? blockSpriteGeometry(blockId, size) : blockCubeGeometry(blockId, size);
  cache.set(key, geometry);
  return geometry;
}

function blockCubeGeometry(blockId: number, size: number): THREE.BufferGeometry {
  const def = BLOCKS[blockId];
  const geometry = new THREE.BoxGeometry(size, size, size).toNonIndexed();
  const uv = geometry.getAttribute('uv');
  const colors = new Float32Array(uv.count * 3);

  // BoxGeometry emits faces in the order +X, -X, +Y, -Y, +Z, -Z with 6 vertices each.
  for (let i = 0; i < uv.count; i++) {
    const face = Math.floor(i / 6);
    const tile = face === 2 ? def.top : face === 3 ? def.bottom : def.side;
    const bounds = tileUVBounds(tile);
    uv.setXY(
      i,
      bounds.u0 + (bounds.u1 - bounds.u0) * uv.getX(i),
      bounds.v0 + (bounds.v1 - bounds.v0) * uv.getY(i),
    );

    const shade = face === 2 ? 1 : face === 3 ? 0.55 : face < 2 ? 0.74 : 0.9;
    colors.set([shade, shade, shade], i * 3);
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/** Two crossed quads, so a spinning crop drop reads from every angle. */
function blockSpriteGeometry(blockId: number, size: number): THREE.BufferGeometry {
  const { u0, u1, v0, v1 } = tileUVBounds(BLOCKS[blockId].top);
  const h = size / 2;
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];

  const corners: [number, number, number][][] = [
    [
      [-h, -h, 0],
      [h, -h, 0],
      [-h, h, 0],
      [h, h, 0],
    ],
    [
      [0, -h, -h],
      [0, -h, h],
      [0, h, -h],
      [0, h, h],
    ],
  ];
  const texels: [number, number][] = [
    [u0, v0],
    [u1, v0],
    [u0, v1],
    [u1, v1],
  ];

  for (const quad of corners) {
    for (const index of [0, 1, 2, 1, 3, 2]) {
      positions.push(...quad[index]);
      uvs.push(...texels[index]);
      colors.push(1, 1, 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  return geometry;
}
