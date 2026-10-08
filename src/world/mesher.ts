import * as THREE from 'three';
import { BLOCKS, Block, fluidGroup } from './blocks.ts';
import { CHUNK_HEIGHT, CHUNK_SIZE, Chunk } from './chunk.ts';
import { tileUVBounds } from './textures.ts';

interface Corner {
  pos: [number, number, number];
  uv: [number, number];
}

interface Face {
  dir: [number, number, number];
  /** Fake directional lighting so block edges stay readable without real lights. */
  light: number;
  corners: Corner[];
}

const FACES: Face[] = [
  {
    dir: [-1, 0, 0],
    light: 0.72,
    corners: [
      { pos: [0, 1, 0], uv: [0, 1] },
      { pos: [0, 0, 0], uv: [0, 0] },
      { pos: [0, 1, 1], uv: [1, 1] },
      { pos: [0, 0, 1], uv: [1, 0] },
    ],
  },
  {
    dir: [1, 0, 0],
    light: 0.72,
    corners: [
      { pos: [1, 1, 1], uv: [0, 1] },
      { pos: [1, 0, 1], uv: [0, 0] },
      { pos: [1, 1, 0], uv: [1, 1] },
      { pos: [1, 0, 0], uv: [1, 0] },
    ],
  },
  {
    dir: [0, -1, 0],
    light: 0.5,
    corners: [
      { pos: [1, 0, 1], uv: [1, 0] },
      { pos: [0, 0, 1], uv: [0, 0] },
      { pos: [1, 0, 0], uv: [1, 1] },
      { pos: [0, 0, 0], uv: [0, 1] },
    ],
  },
  {
    dir: [0, 1, 0],
    light: 1,
    corners: [
      { pos: [0, 1, 1], uv: [1, 1] },
      { pos: [1, 1, 1], uv: [0, 1] },
      { pos: [0, 1, 0], uv: [1, 0] },
      { pos: [1, 1, 0], uv: [0, 0] },
    ],
  },
  {
    dir: [0, 0, -1],
    light: 0.86,
    corners: [
      { pos: [1, 0, 0], uv: [0, 0] },
      { pos: [0, 0, 0], uv: [1, 0] },
      { pos: [1, 1, 0], uv: [0, 1] },
      { pos: [0, 1, 0], uv: [1, 1] },
    ],
  },
  {
    dir: [0, 0, 1],
    light: 0.86,
    corners: [
      { pos: [0, 0, 1], uv: [0, 0] },
      { pos: [1, 0, 1], uv: [1, 0] },
      { pos: [0, 1, 1], uv: [0, 1] },
      { pos: [1, 1, 1], uv: [1, 1] },
    ],
  },
];

function tileUV(tile: number, u: number, v: number): [number, number] {
  const { u0, u1, v0, v1 } = tileUVBounds(tile);
  return [u0 + (u1 - u0) * u, v0 + (v1 - v0) * v];
}

class MeshBuffer {
  readonly positions: number[] = [];
  readonly normals: number[] = [];
  readonly uvs: number[] = [];
  readonly colors: number[] = [];
  readonly indices: number[] = [];

  addFace(face: Face, x: number, y: number, z: number, tile: number): void {
    const base = this.positions.length / 3;
    for (const corner of face.corners) {
      this.positions.push(x + corner.pos[0], y + corner.pos[1], z + corner.pos[2]);
      this.normals.push(face.dir[0], face.dir[1], face.dir[2]);
      const [u, v] = tileUV(tile, corner.uv[0], corner.uv[1]);
      this.uvs.push(u, v);
      this.colors.push(face.light, face.light, face.light);
    }
    this.indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  }

  toGeometry(): THREE.BufferGeometry | null {
    if (this.indices.length === 0) return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setIndex(this.indices);
    geometry.computeBoundingSphere();
    return geometry;
  }
}

export interface ChunkGeometry {
  solid: THREE.BufferGeometry | null;
  water: THREE.BufferGeometry | null;
  lava: THREE.BufferGeometry | null;
}

export type BlockLookup = (x: number, y: number, z: number) => number;

export function buildChunkGeometry(chunk: Chunk, getBlock: BlockLookup): ChunkGeometry {
  const solid = new MeshBuffer();
  const water = new MeshBuffer();
  const lava = new MeshBuffer();
  const originX = chunk.cx * CHUNK_SIZE;
  const originZ = chunk.cz * CHUNK_SIZE;

  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const id = chunk.get(x, y, z);
        if (id === Block.Air) continue;

        const def = BLOCKS[id];
        const group = fluidGroup(id);
        const target = group === 2 ? lava : group === 1 ? water : solid;

        for (const face of FACES) {
          const neighbor = getBlock(
            originX + x + face.dir[0],
            y + face.dir[1],
            originZ + z + face.dir[2],
          );
          const neighborGroup = fluidGroup(neighbor);
          if (neighbor !== Block.Air && !(neighborGroup !== 0 && neighborGroup !== group)) continue;

          const tile = face.dir[1] === 1 ? def.top : face.dir[1] === -1 ? def.bottom : def.side;
          target.addFace(face, x, y, z, tile);
        }
      }
    }
  }

  return { solid: solid.toGeometry(), water: water.toGeometry(), lava: lava.toGeometry() };
}
