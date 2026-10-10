import * as THREE from 'three';

const DAY_COLOR = new THREE.Color(0x8fc3ff);
const DUSK_COLOR = new THREE.Color(0xd9794a);
const NIGHT_COLOR = new THREE.Color(0x070b1a);

// Multiplies linear light, so a small value is needed for a convincingly dark night.
const NIGHT_BRIGHTNESS = 0.09;

/** Drives the sun angle, sky colour and the light level used for mob spawning. */
export class DayCycle {
  /** 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset. */
  time: number;
  readonly dayLength: number;

  private readonly color = new THREE.Color();

  constructor(dayLength = 300, startTime = 0.3) {
    this.dayLength = dayLength;
    this.time = startTime;
  }

  update(dt: number): void {
    this.time = (this.time + dt / this.dayLength) % 1;
  }

  /** -1 at midnight, +1 at noon. */
  get sunHeight(): number {
    return Math.sin((this.time - 0.25) * Math.PI * 2);
  }

  /** 0 while fully dark, 1 in full daylight, ramping through dawn and dusk. */
  get daylight(): number {
    return THREE.MathUtils.clamp((this.sunHeight + 0.18) / 0.42, 0, 1);
  }

  get isNight(): boolean {
    return this.daylight < 0.35;
  }

  get brightness(): number {
    return NIGHT_BRIGHTNESS + (1 - NIGHT_BRIGHTNESS) * this.daylight;
  }

  get skyColor(): THREE.Color {
    const t = this.daylight;
    if (t < 0.5) return this.color.copy(NIGHT_COLOR).lerp(DUSK_COLOR, t / 0.5);
    return this.color.copy(DUSK_COLOR).lerp(DAY_COLOR, (t - 0.5) / 0.5);
  }

  /** Clock label such as "21:30". */
  get clock(): string {
    const minutes = Math.floor(this.time * 24 * 60);
    const h = String(Math.floor(minutes / 60)).padStart(2, '0');
    const m = String(minutes % 60).padStart(2, '0');
    return `${h}:${m}`;
  }
}
