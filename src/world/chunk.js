export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 64;
const VOLUME = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT;
export function chunkKey(cx, cz) {
    return `${cx},${cz}`;
}
export class Chunk {
    cx;
    cz;
    voxels = new Uint8Array(VOLUME);
    dirty = true;
    solidMesh = null;
    waterMesh = null;
    lavaMesh = null;
    constructor(cx, cz) {
        this.cx = cx;
        this.cz = cz;
    }
    static index(x, y, z) {
        return (y * CHUNK_SIZE + z) * CHUNK_SIZE + x;
    }
    get(x, y, z) {
        return this.voxels[Chunk.index(x, y, z)];
    }
    set(x, y, z, id) {
        this.voxels[Chunk.index(x, y, z)] = id;
    }
    dispose(scene) {
        for (const mesh of [this.solidMesh, this.waterMesh, this.lavaMesh]) {
            if (!mesh)
                continue;
            scene.remove(mesh);
            mesh.geometry.dispose();
        }
        this.solidMesh = null;
        this.waterMesh = null;
        this.lavaMesh = null;
    }
}
