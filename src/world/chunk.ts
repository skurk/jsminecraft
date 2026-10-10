import * as THREE from 'three';

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 64;

const VOLUME = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT;

export function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

export class Chunk {
  readonly cx: number;
  readonly cz: number;
  readonly voxels = new Uint8Array(VOLUME);

  dirty = true;
  solidMesh: THREE.Mesh | null = null;
  cutoutMesh: THREE.Mesh | null = null;
  waterMesh: THREE.Mesh | null = null;
  lavaMesh: THREE.Mesh | null = null;

  constructor(cx: number, cz: number) {
    this.cx = cx;
    this.cz = cz;
  }

  static index(x: number, y: number, z: number): number {
    return (y * CHUNK_SIZE + z) * CHUNK_SIZE + x;
  }

  get(x: number, y: number, z: number): number {
    return this.voxels[Chunk.index(x, y, z)];
  }

  set(x: number, y: number, z: number, id: number): void {
    this.voxels[Chunk.index(x, y, z)] = id;
  }

  dispose(scene: THREE.Scene): void {
    for (const mesh of [this.solidMesh, this.cutoutMesh, this.waterMesh, this.lavaMesh]) {
      if (!mesh) continue;
      scene.remove(mesh);
      mesh.geometry.dispose();
    }
    this.solidMesh = null;
    this.cutoutMesh = null;
    this.waterMesh = null;
    this.lavaMesh = null;
  }
}
