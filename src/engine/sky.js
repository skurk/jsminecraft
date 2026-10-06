import * as THREE from 'three';
const RADIUS = 400;
const SUN_SIZE = 58;
const MOON_SIZE = 46;
const STAR_COUNT = 900;
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
/** Sun, moon and stars riding a dome that is re-centred on the camera every frame. */
export class Sky {
    group = new THREE.Group();
    sun = celestialBody(sunTexture(), SUN_SIZE, 1);
    moon = celestialBody(moonTexture(), MOON_SIZE, -1);
    stars = starField();
    constructor(scene) {
        this.group.add(this.sun, this.moon, this.stars);
        this.group.renderOrder = -1;
        this.sun.renderOrder = -1;
        this.moon.renderOrder = -1;
        this.stars.renderOrder = -2;
        scene.add(this.group);
    }
    setVisible(visible) {
        this.group.visible = visible;
    }
    update(cameraPosition, day) {
        this.group.position.copy(cameraPosition);
        const angle = (day.time - 0.25) * Math.PI * 2;
        this.group.rotation.set(0, SKY_TILT, angle);
        const sunElevation = Math.sin(angle);
        sunMaterial(this.sun).opacity = horizonFade(sunElevation);
        sunMaterial(this.moon).opacity = horizonFade(-sunElevation) * 0.95;
        this.stars.material.opacity = 1 - day.daylight;
    }
}
function sunMaterial(mesh) {
    return mesh.material;
}
/** Fades a body out as it dips below the horizon. */
function horizonFade(elevation) {
    return THREE.MathUtils.clamp((elevation + 0.09) / 0.12, 0, 1);
}
