/** Deterministic, dependency-free value noise used for terrain and caves. */
function hash2(x, y, seed) {
    let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function hash3(x, y, z, seed) {
    let h = Math.imul(x, 374761393) ^
        Math.imul(y, 668265263) ^
        Math.imul(z, 2147483647) ^
        Math.imul(seed, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function smooth(t) {
    return t * t * (3 - 2 * t);
}
function lerp(a, b, t) {
    return a + (b - a) * t;
}
/** Value noise in the range [0, 1]. */
export function noise2(x, y, seed = 0) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const tx = smooth(x - xi);
    const ty = smooth(y - yi);
    const v00 = hash2(xi, yi, seed);
    const v10 = hash2(xi + 1, yi, seed);
    const v01 = hash2(xi, yi + 1, seed);
    const v11 = hash2(xi + 1, yi + 1, seed);
    return lerp(lerp(v00, v10, tx), lerp(v01, v11, tx), ty);
}
/** Value noise in the range [0, 1]. */
export function noise3(x, y, z, seed = 0) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const zi = Math.floor(z);
    const tx = smooth(x - xi);
    const ty = smooth(y - yi);
    const tz = smooth(z - zi);
    const c000 = hash3(xi, yi, zi, seed);
    const c100 = hash3(xi + 1, yi, zi, seed);
    const c010 = hash3(xi, yi + 1, zi, seed);
    const c110 = hash3(xi + 1, yi + 1, zi, seed);
    const c001 = hash3(xi, yi, zi + 1, seed);
    const c101 = hash3(xi + 1, yi, zi + 1, seed);
    const c011 = hash3(xi, yi + 1, zi + 1, seed);
    const c111 = hash3(xi + 1, yi + 1, zi + 1, seed);
    const x00 = lerp(c000, c100, tx);
    const x10 = lerp(c010, c110, tx);
    const x01 = lerp(c001, c101, tx);
    const x11 = lerp(c011, c111, tx);
    return lerp(lerp(x00, x10, ty), lerp(x01, x11, ty), tz);
}
/** Fractal brownian motion over `noise2`, normalised to [0, 1]. */
export function fbm2(x, y, octaves, seed = 0) {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let total = 0;
    for (let i = 0; i < octaves; i++) {
        value += noise2(x * frequency, y * frequency, seed + i * 71) * amplitude;
        total += amplitude;
        amplitude *= 0.5;
        frequency *= 2;
    }
    return value / total;
}
/** Deterministic pseudo-random value in [0, 1) for a world column. */
export function randomAt(x, z, seed = 0) {
    return hash2(x, z, seed + 9176);
}
/** Small seeded PRNG, handy for procedural textures. */
export function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
