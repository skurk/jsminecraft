import * as THREE from 'three';
const RADIUS = 400;
const SUN_SIZE = 58;
const MOON_SIZE = 46;
const STAR_COUNT = 900;
const CLOUD_HEIGHT = 124;
/** Width of one cloud block and how thick the slab is, both in world blocks. */
const CLOUD_CELL = 12;
const CLOUD_THICKNESS = 4;
const CLOUD_CELLS = 24;
/** One seamless tile of the mask, repeated across a CLOUD_GRID square. */
const CLOUD_TILE = CLOUD_CELL * CLOUD_CELLS;
const CLOUD_GRID = 7;
const CLOUD_FADE_START = 380;
const CLOUD_FADE_END = 820;
const CLOUD_DRIFT = 0.7;
/** Tilts the daily arc so the sun does not rise exactly along an axis. */
const SKY_TILT = 0.4;
function canvasTexture(size, draw) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx)
        throw new Error('2D canvas context unavailable');
    draw(ctx);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}
function sunTexture() {
    return canvasTexture(64, (ctx) => {
        const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        glow.addColorStop(0, 'rgba(255, 255, 245, 1)');
        glow.addColorStop(0.5, 'rgba(255, 246, 205, 1)');
        glow.addColorStop(0.62, 'rgba(255, 226, 140, 0.85)');
        glow.addColorStop(0.78, 'rgba(255, 200, 100, 0.3)');
        glow.addColorStop(1, 'rgba(255, 190, 90, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, 64, 64);
    });
}
function moonTexture() {
    return canvasTexture(64, (ctx) => {
        const glow = ctx.createRadialGradient(32, 32, 16, 32, 32, 32);
        glow.addColorStop(0, 'rgba(210, 225, 255, 0.35)');
        glow.addColorStop(1, 'rgba(210, 225, 255, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, 64, 64);
        ctx.fillStyle = '#e9eef7';
        ctx.beginPath();
        ctx.arc(32, 32, 19, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(176, 189, 211, 0.75)';
        for (const [cx, cy, r] of [
            [26, 26, 5],
            [38, 34, 3.5],
            [30, 40, 4],
            [40, 23, 2.5],
        ]) {
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();
        }
    });
}
function starField() {
    const positions = new Float32Array(STAR_COUNT * 3);
    const colors = new Float32Array(STAR_COUNT * 3);
    const direction = new THREE.Vector3();
    for (let i = 0; i < STAR_COUNT; i++) {
        direction.randomDirection().multiplyScalar(RADIUS * 0.97);
        positions.set([direction.x, direction.y, direction.z], i * 3);
        const brightness = 0.45 + Math.random() * 0.55;
        colors.set([brightness, brightness, brightness * (0.92 + Math.random() * 0.08)], i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
        size: 2.2,
        sizeAttenuation: false,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        fog: false,
    });
    return new THREE.Points(geometry, material);
}
function celestialBody(texture, size, facing) {
    const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        fog: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
    mesh.position.set(facing * RADIUS, 0, 0);
    mesh.rotation.y = (-facing * Math.PI) / 2;
    return mesh;
}
/** Grows random seeds into blobs with wrapping neighbour counts, so the tile repeats seamlessly. */
function cloudMask() {
    let cells = Array.from({ length: CLOUD_CELLS * CLOUD_CELLS }, () => Math.random() < 0.37);
    const at = (x, y) => cells[((y + CLOUD_CELLS) % CLOUD_CELLS) * CLOUD_CELLS + ((x + CLOUD_CELLS) % CLOUD_CELLS)];
    const neighbours = (x, y) => {
        let filled = 0;
        for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++)
                if ((dx || dy) && at(x + dx, y + dy))
                    filled++;
        return filled;
    };
    for (let pass = 0; pass < 2; pass++) {
        const next = cells.slice();
        for (let y = 0; y < CLOUD_CELLS; y++) {
            for (let x = 0; x < CLOUD_CELLS; x++) {
                const filled = neighbours(x, y);
                next[y * CLOUD_CELLS + x] = filled > 4 || (at(x, y) && filled > 2);
            }
        }
        cells = next;
    }
    // Smoothing alone merges everything into one sheet, so one erosion pass breaks it back apart.
    const eroded = cells.slice();
    for (let y = 0; y < CLOUD_CELLS; y++)
        for (let x = 0; x < CLOUD_CELLS; x++)
            eroded[y * CLOUD_CELLS + x] = at(x, y) && neighbours(x, y) >= 5;
    return eroded;
}
/** Face shades, so the slab sides and undersides read as solid blocks rather than flat paper. */
const CLOUD_SHADE = { top: 1, bottom: 0.72, x: 0.84, z: 0.93 };
/**
 * Builds one static mesh of cloud blocks covering a wide disc. Each filled mask cell becomes a
 * box CLOUD_CELL wide and CLOUD_THICKNESS tall, and only faces with no neighbour are emitted.
 */
function cloudLayer() {
    const cells = cloudMask();
    const filled = (cx, cz) => cells[((cz + CLOUD_CELLS) % CLOUD_CELLS) * CLOUD_CELLS + ((cx + CLOUD_CELLS) % CLOUD_CELLS)];
    const positions = [];
    const colors = [];
    const half = (CLOUD_GRID - 1) / 2;
    const y0 = -CLOUD_THICKNESS / 2;
    const y1 = CLOUD_THICKNESS / 2;
    const vertex = (x, y, z, shade) => {
        const alpha = 1 - THREE.MathUtils.smoothstep(Math.hypot(x, z), CLOUD_FADE_START, CLOUD_FADE_END);
        positions.push(x, y, z);
        colors.push(shade, shade, shade, alpha);
    };
    const quad = (corners, shade) => {
        for (const i of [0, 1, 2, 0, 2, 3])
            vertex(corners[i][0], corners[i][1], corners[i][2], shade);
    };
    for (let gz = 0; gz < CLOUD_GRID; gz++) {
        for (let gx = 0; gx < CLOUD_GRID; gx++) {
            const ox = (gx - half) * CLOUD_TILE;
            const oz = (gz - half) * CLOUD_TILE;
            for (let cz = 0; cz < CLOUD_CELLS; cz++) {
                for (let cx = 0; cx < CLOUD_CELLS; cx++) {
                    if (!filled(cx, cz))
                        continue;
                    const xa = ox + cx * CLOUD_CELL;
                    const xb = xa + CLOUD_CELL;
                    const za = oz + cz * CLOUD_CELL;
                    const zb = za + CLOUD_CELL;
                    // Nothing out past the fade ring would be visible, so it is never built.
                    if (Math.hypot(xa + CLOUD_CELL / 2, za + CLOUD_CELL / 2) > CLOUD_FADE_END)
                        continue;
                    quad([[xa, y1, zb], [xb, y1, zb], [xb, y1, za], [xa, y1, za]], CLOUD_SHADE.top);
                    quad([[xa, y0, za], [xb, y0, za], [xb, y0, zb], [xa, y0, zb]], CLOUD_SHADE.bottom);
                    if (!filled(cx + 1, cz))
                        quad([[xb, y0, zb], [xb, y0, za], [xb, y1, za], [xb, y1, zb]], CLOUD_SHADE.x);
                    if (!filled(cx - 1, cz))
                        quad([[xa, y0, za], [xa, y0, zb], [xa, y1, zb], [xa, y1, za]], CLOUD_SHADE.x);
                    if (!filled(cx, cz + 1))
                        quad([[xa, y0, zb], [xb, y0, zb], [xb, y1, zb], [xa, y1, zb]], CLOUD_SHADE.z);
                    if (!filled(cx, cz - 1))
                        quad([[xb, y0, za], [xa, y0, za], [xa, y1, za], [xb, y1, za]], CLOUD_SHADE.z);
                }
            }
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 4));
    const material = new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        // Faded-out blocks must not write depth and silently occlude the sky behind them.
        alphaTest: 0.02,
        fog: false,
    });
    return new THREE.Mesh(geometry, material);
}
/** Sun, moon and stars riding a dome that is re-centred on the camera every frame. */
export class Sky {
    group = new THREE.Group();
    sun = celestialBody(sunTexture(), SUN_SIZE, 1);
    moon = celestialBody(moonTexture(), MOON_SIZE, -1);
    stars = starField();
    clouds = cloudLayer();
    drift = 0;
    constructor(scene) {
        this.group.add(this.sun, this.moon, this.stars);
        this.group.renderOrder = -1;
        this.sun.renderOrder = -1;
        this.moon.renderOrder = -1;
        this.stars.renderOrder = -2;
        scene.add(this.group);
        scene.add(this.clouds);
    }
    setVisible(visible) {
        this.group.visible = visible;
        this.clouds.visible = visible;
    }
    update(cameraPosition, day, dt = 0, overcast = 0) {
        this.group.position.copy(cameraPosition);
        const angle = (day.time - 0.25) * Math.PI * 2;
        this.group.rotation.set(0, SKY_TILT, angle);
        const sunElevation = Math.sin(angle);
        sunMaterial(this.sun).opacity = horizonFade(sunElevation);
        sunMaterial(this.moon).opacity = horizonFade(-sunElevation) * 0.95;
        this.stars.material.opacity = 1 - day.daylight;
        this.updateClouds(cameraPosition, day, dt, overcast);
    }
    updateClouds(cameraPosition, day, dt, overcast) {
        this.drift += dt * CLOUD_DRIFT;
        // Snapping to whole tiles keeps the repeating pattern locked to the world as the player moves.
        const x = this.drift + Math.round((cameraPosition.x - this.drift) / CLOUD_TILE) * CLOUD_TILE;
        const z = Math.round(cameraPosition.z / CLOUD_TILE) * CLOUD_TILE;
        this.clouds.position.set(x, CLOUD_HEIGHT, z);
        const material = sunMaterial(this.clouds);
        const shade = 1 - overcast * 0.4;
        material.color.setScalar(Math.max(day.brightness, 0.12) * shade);
        material.opacity = 0.9 + overcast * 0.1;
    }
}
function sunMaterial(mesh) {
    return mesh.material;
}
/** Fades a body out as it dips below the horizon. */
function horizonFade(elevation) {
    return THREE.MathUtils.clamp((elevation + 0.09) / 0.12, 0, 1);
}
