import * as THREE from 'three';

export interface BoxPart {
  size: [number, number, number];
  offset: [number, number, number];
  color: number;
}

/** Bakes box parts into one non-indexed geometry with directional shading in vertex colours. */
export function buildBoxGeometry(parts: BoxPart[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const color = new THREE.Color();

  for (const part of parts) {
    const box = new THREE.BoxGeometry(part.size[0], part.size[1], part.size[2])
      .translate(part.offset[0], part.offset[1], part.offset[2])
      .toNonIndexed();
    const position = box.getAttribute('position');
    const normal = box.getAttribute('normal');
    color.setHex(part.color);

    for (let i = 0; i < position.count; i++) {
      positions.push(position.getX(i), position.getY(i), position.getZ(i));
      const ny = normal.getY(i);
      const nx = normal.getX(i);
      const shade = ny > 0.5 ? 1 : ny < -0.5 ? 0.55 : Math.abs(nx) > 0.5 ? 0.74 : 0.9;
      colors.push(color.r * shade, color.g * shade, color.b * shade);
    }

    box.dispose();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  return geometry;
}
