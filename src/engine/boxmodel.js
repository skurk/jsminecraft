import * as THREE from 'three';
/** World size of one mottle patch, matching the coarse pixels of a 16x16 skin. */
const PATCH = 0.125;
function hash(x, y, z) {
    const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
    return n - Math.floor(n);
}
/** Two octaves, so patches clump into blotches instead of looking like per-pixel noise. */
function blotch(x, y, z) {
    const q = (v, step) => Math.floor(v / step);
    const fine = hash(q(x, PATCH), q(y, PATCH), q(z, PATCH));
    const coarse = hash(q(x, PATCH * 2), q(y, PATCH * 2), q(z, PATCH * 2));
    return fine * 0.45 + coarse * 0.55;
}
/** Bakes box parts into one non-indexed geometry with directional shading in vertex colours. */
export function buildBoxGeometry(parts) {
    const positions = [];
    const colors = [];
    const color = new THREE.Color();
    for (const part of parts) {
        const mottle = part.mottle ?? 0;
        const segments = mottle > 0
            ? part.size.map((s) => Math.max(1, Math.round(s / PATCH)))
            : [1, 1, 1];
        const box = new THREE.BoxGeometry(part.size[0], part.size[1], part.size[2], segments[0], segments[1], segments[2])
            .translate(part.offset[0], part.offset[1], part.offset[2])
            .toNonIndexed();
        const position = box.getAttribute('position');
        const normal = box.getAttribute('normal');
        color.setHex(part.color);
        // Walked a quad at a time, because a patch must be flat rather than a gradient across it.
        for (let quad = 0; quad < position.count; quad += 6) {
            let cx = 0;
            let cy = 0;
            let cz = 0;
            for (let k = 0; k < 6; k++) {
                cx += position.getX(quad + k);
                cy += position.getY(quad + k);
                cz += position.getZ(quad + k);
            }
            const patch = mottle > 0 ? 1 - mottle * blotch(cx / 6, cy / 6, cz / 6) : 1;
            for (let k = 0; k < 6; k++) {
                const i = quad + k;
                positions.push(position.getX(i), position.getY(i), position.getZ(i));
                const ny = normal.getY(i);
                const nx = normal.getX(i);
                const shade = (ny > 0.5 ? 1 : ny < -0.5 ? 0.55 : Math.abs(nx) > 0.5 ? 0.74 : 0.9) * patch;
                colors.push(color.r * shade, color.g * shade, color.b * shade);
            }
        }
        box.dispose();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeBoundingSphere();
    return geometry;
}
