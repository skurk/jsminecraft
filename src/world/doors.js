import * as THREE from 'three';
import { DOOR_FACINGS, Tile } from "./blocks.js";
import { tileUVBounds } from "./textures.js";

/** Panel thickness, as a fraction of a block. */
const THICKNESS = 0.1875;
/** Radians per second, so a swing takes about a sixth of a second. */
const SWING_SPEED = Math.PI * 3;
const OPEN_ANGLE = -Math.PI / 2;
// Matches the chunk mesher's per-face shading, in BoxGeometry's face order.
const FACE_SHADES = [0.72, 0.72, 1, 0.5, 0.86, 0.86];

/**
 * One half of a door, with the hinge at the local origin and the panel reaching
 * along +X. The lower half sits at y 0..1, the upper at y 1..2.
 */
function halfGeometry(tile, bottom) {
    const geometry = new THREE.BoxGeometry(1, 1, THICKNESS);
    geometry.translate(0.5 - THICKNESS / 2, bottom + 0.5, 0);
    const uv = geometry.getAttribute('uv');
    const { u0, u1, v0, v1 } = tileUVBounds(tile);
    const colors = new Float32Array(uv.count * 3);
    for (let i = 0; i < uv.count; i++) {
        uv.setXY(i, u0 + (u1 - u0) * uv.getX(i), v0 + (v1 - v0) * uv.getY(i));
        const shade = FACE_SHADES[Math.floor(i / 4)];
        colors[i * 3] = shade;
        colors[i * 3 + 1] = shade;
        colors[i * 3 + 2] = shade;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('blockLight', new THREE.BufferAttribute(new Float32Array(uv.count), 1));
    return geometry;
}

/** World position of the hinge pin for a door block, given its facing. */
function hingePosition(x, y, z, facing) {
    const { angle } = DOOR_FACINGS[facing];
    // Canonical hinge corner of a north-facing door, relative to the voxel centre.
    const a = THICKNESS / 2 - 0.5;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return [x + 0.5 + a * (cos + sin), y, z + 0.5 + a * (cos - sin)];
}

/**
 * Draws and animates every door in the loaded chunks. Doors are kept out of the
 * chunk meshes so they can swing on their hinge instead of popping between states.
 */
export class DoorManager {
    scene;
    material;
    geometries;
    /** Block position key to its swinging mesh. */
    doors = new Map();
    /** Chunk key to the door keys it owns, so unloading can clean up. */
    chunks = new Map();

    constructor(scene, material) {
        this.scene = scene;
        this.material = material;
        this.geometries = [halfGeometry(Tile.DoorLower, 0), halfGeometry(Tile.DoorUpper, 1)];
    }

    /** Replaces the doors of one chunk with what its latest mesh pass found. */
    sync(chunkKey, entries) {
        const previous = this.chunks.get(chunkKey) ?? [];
        const keys = [];
        for (const entry of entries) {
            const key = `${entry.x},${entry.y},${entry.z}`;
            keys.push(key);
            let door = this.doors.get(key);
            const target = entry.open ? OPEN_ANGLE : 0;
            if (!door) {
                const group = new THREE.Group();
                for (const geometry of this.geometries)
                    group.add(new THREE.Mesh(geometry, this.material));
                group.position.set(...hingePosition(entry.x, entry.y, entry.z, entry.facing));
                this.scene.add(group);
                // A door that streams in is already at rest, so it must not swing.
                door = { group, angle: target };
                this.doors.set(key, door);
            }
            door.base = DOOR_FACINGS[entry.facing].angle;
            door.target = target;
            door.group.rotation.y = door.base + door.angle;
        }
        for (const key of previous) {
            if (!keys.includes(key))
                this.drop(key);
        }
        this.chunks.set(chunkKey, keys);
    }

    /** Starts the swing straight away, ahead of the chunk re-mesh that confirms it. */
    setOpen(x, y, z, open) {
        const door = this.doors.get(`${x},${y},${z}`);
        if (door)
            door.target = open ? OPEN_ANGLE : 0;
    }

    drop(key) {
        const door = this.doors.get(key);
        if (!door)
            return;
        this.scene.remove(door.group);
        this.doors.delete(key);
    }

    update(dt) {
        for (const door of this.doors.values()) {
            if (door.angle === door.target)
                continue;
            const step = SWING_SPEED * dt;
            const remaining = door.target - door.angle;
            door.angle = Math.abs(remaining) <= step ? door.target : door.angle + Math.sign(remaining) * step;
            door.group.rotation.y = door.base + door.angle;
        }
    }
}
