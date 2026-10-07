import * as THREE from 'three';
const PUFFS = 22;
const POOL = 96;
const PUFF_LIFETIME = 0.9;
const FLASH_LIFETIME = 0.3;
/** Per-second velocity retention, so puffs stall quickly instead of flying off. */
const DRAG = 0.02;
const RISE = 0.9;
function puffTexture() {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx)
        throw new Error('2D canvas context unavailable');
    const glow = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    glow.addColorStop(0, 'rgba(255, 255, 255, 1)');
    glow.addColorStop(0.45, 'rgba(255, 255, 255, 0.92)');
    glow.addColorStop(0.75, 'rgba(236, 236, 236, 0.45)');
    glow.addColorStop(1, 'rgba(220, 220, 220, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}
/** A pooled burst of billboard puffs that balloon outwards and fade, as a blast leaves behind. */
export class Explosions {
    pool = [];
    live = [];
    constructor(scene) {
        const map = puffTexture();
        for (let i = 0; i < POOL; i++) {
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
                map,
                transparent: true,
                depthWrite: false,
                fog: false,
            }));
            sprite.visible = false;
            scene.add(sprite);
            this.pool.push(sprite);
        }
    }
    take() {
        return this.pool.pop() ?? null;
    }
    add(sprite, position, velocity, size, lifetime, shade, grow) {
        sprite.visible = true;
        sprite.position.copy(position);
        sprite.material.opacity = 1;
        sprite.material.color.setScalar(shade);
        sprite.scale.setScalar(size);
        this.live.push({ sprite, velocity, size, lifetime, grow, age: 0 });
    }
    spawn(position, power) {
        const flash = this.take();
        if (flash)
            this.add(flash, position, new THREE.Vector3(), power * 0.55, FLASH_LIFETIME, 1, 1.3);
        const offset = new THREE.Vector3();
        for (let i = 0; i < PUFFS; i++) {
            const sprite = this.take();
            if (!sprite)
                break;
            offset.randomDirection().multiplyScalar(power * (0.2 + Math.random() * 0.6));
            const velocity = offset.clone().multiplyScalar(1.1 + Math.random() * 1.2);
            velocity.y += 0.8;
            this.add(sprite, position.clone().add(offset), velocity, power * (0.13 + Math.random() * 0.17), PUFF_LIFETIME * (0.7 + Math.random() * 0.6), 0.72 + Math.random() * 0.28, 1.9);
        }
    }
    update(dt) {
        for (let i = this.live.length - 1; i >= 0; i--) {
            const puff = this.live[i];
            puff.age += dt;
            const progress = puff.age / puff.lifetime;
            if (progress >= 1) {
                puff.sprite.visible = false;
                this.pool.push(puff.sprite);
                this.live.splice(i, 1);
                continue;
            }
            puff.velocity.multiplyScalar(Math.pow(DRAG, dt));
            puff.velocity.y += RISE * dt;
            puff.sprite.position.addScaledVector(puff.velocity, dt);
            puff.sprite.scale.setScalar(puff.size * (1 + progress * puff.grow));
            // Held solid for the first half, so the blast reads before it dissipates.
            puff.sprite.material.opacity = Math.min(1, (1 - progress) * 2);
        }
    }
}
