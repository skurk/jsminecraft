import * as THREE from 'three';
import { Biome, biomeAt } from "../world/terrain.js";
const COUNT = 1500;
/** Half-extent of the particle volume that follows the camera. */
const AREA = 16;
const TOP = 16;
const BOTTOM = -10;
const RAIN_SPEED = 28;
const SNOW_SPEED = 3.2;
const RAIN_STREAK = 1.4;
const BOLT_SEGMENTS = 14;
/** Seconds between strikes: a storm is busy, plain night rain is a rare rumble. */
const STORM_GAP = [5, 14];
const NIGHT_RAIN_GAP = [22, 50];
/** Below this, rain is too thin to carry lightning. */
const NIGHT_RAIN_INTENSITY = 0.25;
function buildRain() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 6), 3));
    const material = new THREE.LineBasicMaterial({
        // Near-white, because a rainy sky is tinted towards the same blue-grey
        // the drops used to be, which made them vanish against the horizon.
        color: 0xcfe4ff,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
        fog: false,
    });
    return new THREE.LineSegments(geometry, material);
}
function buildSnow() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
    const material = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.17,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        fog: false,
    });
    return new THREE.Points(geometry, material);
}
function buildBolt() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(BOLT_SEGMENTS * 6), 3));
    const material = new THREE.LineBasicMaterial({ color: 0xf2f6ff, fog: false, depthWrite: false });
    const bolt = new THREE.LineSegments(geometry, material);
    bolt.visible = false;
    return bolt;
}
/** Rain, snow and thunderstorms rolling over the world on a slow random cycle. */
export class Weather {
    group = new THREE.Group();
    rain = buildRain();
    snow = buildSnow();
    bolt = buildBolt();
    state = 'clear';
    timer = 60 + Math.random() * 120;
    /** Eased 0..1 strength of the current front. */
    intensity = 0;
    target = 0;
    cold = false;
    falling = false;
    flash = 0;
    strikeTimer = 8;
    boltTimer = 0;
    wind = new THREE.Vector2(1, 0.35);
    positions = new Float32Array(COUNT * 3);
    speeds = new Float32Array(COUNT);
    /** Called with the distance in blocks each time a bolt lands. */
    onStrike = null;
    constructor(scene) {
        for (let i = 0; i < COUNT; i++) {
            this.positions[i * 3] = (Math.random() * 2 - 1) * AREA;
            this.positions[i * 3 + 1] = BOTTOM + Math.random() * (TOP - BOTTOM);
            this.positions[i * 3 + 2] = (Math.random() * 2 - 1) * AREA;
            this.speeds[i] = 0.75 + Math.random() * 0.5;
        }
        this.group.add(this.rain, this.snow, this.bolt);
        scene.add(this.group);
    }
    get storming() {
        return this.state === 'storm' && this.intensity > 0.5;
    }
    /** Multiplier applied to daylight; storms are considerably gloomier than drizzle. */
    get lightScale() {
        return 1 - this.intensity * (this.state === 'storm' ? 0.5 : 0.3);
    }
    /** How far the sky colour is pulled towards overcast grey. */
    get overcast() {
        return this.intensity * (this.state === 'storm' ? 0.8 : 0.6);
    }
    get label() {
        if (this.intensity < 0.05)
            return 'clear';
        if (this.state === 'storm')
            return this.cold ? 'blizzard' : 'thunderstorm';
        return this.cold ? 'snow' : 'rain';
    }
    update(dt, player, world, day) {
        this.timer -= dt;
        if (this.timer <= 0)
            this.roll();
        this.intensity += (this.target - this.intensity) * Math.min(1, dt * 0.4);
        const x = Math.floor(player.position.x);
        const z = Math.floor(player.position.z);
        const biome = biomeAt(x, z);
        this.cold = biome === Biome.Tundra;
        // Deserts stay dry, and a roof or deep water hides the weather entirely.
        const exposed = biome !== Biome.Desert &&
            world.isSkyExposed(x, Math.floor(player.position.y + 1.6), z);
        this.falling = this.intensity > 0.03 && exposed;
        this.group.visible = this.falling;
        this.group.position.copy(player.position);
        if (this.falling)
            this.step(dt);
        this.updateLightning(dt, day.isNight);
    }
    roll() {
        if (this.state === 'clear') {
            this.state = Math.random() < 0.35 ? 'storm' : 'rain';
            this.target = this.state === 'storm' ? 1 : 0.5 + Math.random() * 0.25;
            this.timer = 60 + Math.random() * 120;
        }
        else {
            this.state = 'clear';
            this.target = 0;
            this.timer = 150 + Math.random() * 300;
        }
    }
    step(dt) {
        const snowing = this.cold;
        const fall = (snowing ? SNOW_SPEED : RAIN_SPEED) * dt;
        const sway = snowing ? 1.8 : 0.6;
        const driftX = this.wind.x * sway * dt;
        const driftZ = this.wind.y * sway * dt;
        for (let i = 0; i < COUNT; i++) {
            const o = i * 3;
            const speed = this.speeds[i];
            this.positions[o] += driftX * speed;
            this.positions[o + 1] -= fall * speed;
            this.positions[o + 2] += driftZ * speed;
            if (this.positions[o + 1] < BOTTOM) {
                this.positions[o] = (Math.random() * 2 - 1) * AREA;
                this.positions[o + 1] = TOP;
                this.positions[o + 2] = (Math.random() * 2 - 1) * AREA;
            }
            if (this.positions[o] > AREA)
                this.positions[o] -= AREA * 2;
            else if (this.positions[o] < -AREA)
                this.positions[o] += AREA * 2;
            if (this.positions[o + 2] > AREA)
                this.positions[o + 2] -= AREA * 2;
            else if (this.positions[o + 2] < -AREA)
                this.positions[o + 2] += AREA * 2;
        }
        const active = Math.max(1, Math.floor(COUNT * Math.min(1, this.intensity)));
        this.rain.visible = !snowing;
        this.snow.visible = snowing;
        if (snowing)
            this.writeSnow(active);
        else
            this.writeRain(active);
    }
    writeRain(active) {
        const attribute = this.rain.geometry.getAttribute('position');
        const out = attribute.array;
        const tiltX = this.wind.x * 0.1;
        const tiltZ = this.wind.y * 0.1;
        for (let i = 0; i < active; i++) {
            const o = i * 3;
            const t = i * 6;
            out[t] = this.positions[o];
            out[t + 1] = this.positions[o + 1];
            out[t + 2] = this.positions[o + 2];
            out[t + 3] = this.positions[o] + tiltX;
            out[t + 4] = this.positions[o + 1] - RAIN_STREAK;
            out[t + 5] = this.positions[o + 2] + tiltZ;
        }
        attribute.needsUpdate = true;
        this.rain.geometry.setDrawRange(0, active * 2);
    }
    writeSnow(active) {
        const attribute = this.snow.geometry.getAttribute('position');
        attribute.array.set(this.positions.subarray(0, active * 3));
        attribute.needsUpdate = true;
        this.snow.geometry.setDrawRange(0, active);
    }
    updateLightning(dt, night) {
        this.flash = Math.max(0, this.flash - dt * 5);
        this.boltTimer = Math.max(0, this.boltTimer - dt);
        this.bolt.visible = this.boltTimer > 0 && this.falling;
        if (!this.falling || this.cold)
            return;
        // Outside a storm, lightning is a night-time event only.
        const nightRain = night && this.intensity > NIGHT_RAIN_INTENSITY;
        if (!this.storming && !nightRain)
            return;
        this.strikeTimer -= dt;
        if (this.strikeTimer > 0)
            return;
        const [min, max] = this.storming ? STORM_GAP : NIGHT_RAIN_GAP;
        this.strikeTimer = min + Math.random() * (max - min);
        this.flash = 1;
        this.boltTimer = 0.16;
        this.onStrike?.(this.strike());
    }
    /**
     * Lays out a jagged bolt somewhere near the player, in group-local space,
     * and returns how far off it landed.
     */
    strike() {
        const attribute = this.bolt.geometry.getAttribute('position');
        const out = attribute.array;
        const angle = Math.random() * Math.PI * 2;
        const distance = 20 + Math.random() * 60;
        let x = Math.cos(angle) * distance;
        let z = Math.sin(angle) * distance;
        let y = 70;
        const drop = 76 / BOLT_SEGMENTS;
        for (let i = 0; i < BOLT_SEGMENTS; i++) {
            const t = i * 6;
            out[t] = x;
            out[t + 1] = y;
            out[t + 2] = z;
            x += (Math.random() * 2 - 1) * 3;
            z += (Math.random() * 2 - 1) * 3;
            y -= drop;
            out[t + 3] = x;
            out[t + 4] = y;
            out[t + 5] = z;
        }
        attribute.needsUpdate = true;
        return distance;
    }
}
