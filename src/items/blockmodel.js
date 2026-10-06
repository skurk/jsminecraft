import * as THREE from 'three';
import { BLOCKS } from "../world/blocks.js";
import { tileUVBounds } from "../world/textures.js";
const cache = new Map();
/** Textured cube for a block, used by dropped items and the held-item model. */
export function blockCubeGeometry(blockId, size) {
    const key = `${blockId}:${size}`;
    const cached = cache.get(key);
    if (cached)
        return cached;
    const def = BLOCKS[blockId];
    const geometry = new THREE.BoxGeometry(size, size, size).toNonIndexed();
    const uv = geometry.getAttribute('uv');
    const colors = new Float32Array(uv.count * 3);
    // BoxGeometry emits faces in the order +X, -X, +Y, -Y, +Z, -Z with 6 vertices each.
    for (let i = 0; i < uv.count; i++) {
        const face = Math.floor(i / 6);
        const tile = face === 2 ? def.top : face === 3 ? def.bottom : def.side;
        const bounds = tileUVBounds(tile);
        uv.setXY(i, bounds.u0 + (bounds.u1 - bounds.u0) * uv.getX(i), bounds.v0 + (bounds.v1 - bounds.v0) * uv.getY(i));
        const shade = face === 2 ? 1 : face === 3 ? 0.55 : face < 2 ? 0.74 : 0.9;
        colors.set([shade, shade, shade], i * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    cache.set(key, geometry);
    return geometry;
}
