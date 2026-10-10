// Every sound here is synthesised with the Web Audio API at runtime; the game
// ships no audio files and never fetches one.
const MASTER_VOLUME = 0.5;
/** Seconds of pink noise generated once and re-read from random offsets. */
const NOISE_SECONDS = 2;
/** Footfalls closer together than this are dropped, so stutter can't machine-gun. */
const MIN_STEP_GAP = 0.08;
/** A gentle rise, so a step is a brush rather than a drum hit. */
const ATTACK = 0.022;
/** A knock, by contrast, is all transient. */
const HIT_ATTACK = 0.003;
/** Hits closer together than this are dropped. */
const MIN_HIT_GAP = 0.06;
/**
 * Per-surface footstep voicing. The noise burst opens at `freq` and closes to
 * `freq * sweep` as the foot settles, which is what reads as a scuff rather
 * than a tone. `body` is the faint low weight behind hard surfaces.
 */
const SURFACES = {
    grass: { gain: 0.2, decay: 0.22, freq: 2400, sweep: 0.35, body: 0 },
    dirt: { gain: 0.22, decay: 0.19, freq: 1600, sweep: 0.3, body: 90 },
    stone: { gain: 0.2, decay: 0.15, freq: 2800, sweep: 0.4, body: 120 },
    sand: { gain: 0.18, decay: 0.26, freq: 3600, sweep: 0.45, body: 0 },
    wood: { gain: 0.21, decay: 0.17, freq: 1900, sweep: 0.35, body: 150 },
    snow: { gain: 0.17, decay: 0.22, freq: 3000, sweep: 0.4, body: 0 },
    leaves: { gain: 0.16, decay: 0.24, freq: 3400, sweep: 0.45, body: 0 },
    water: { gain: 0.2, decay: 0.3, freq: 1200, sweep: 0.3, body: 0 },
};
/**
 * Per-surface knock voicing, scaled by how dense the material is. The impact
 * noise lives between `floor` and `cutoff`, and `ring` is a resonance at
 * `tone` that only solid matter sustains: stone tocks, leaves only hiss.
 */
const HITS = {
    stone: { gain: 0.3, decay: 0.07, floor: 200, cutoff: 3200, tone: 380, q: 9, ring: 0.1 },
    wood: { gain: 0.3, decay: 0.09, floor: 160, cutoff: 2400, tone: 210, q: 6, ring: 0.18 },
    dirt: { gain: 0.28, decay: 0.11, floor: 90, cutoff: 900, tone: 130, q: 2, ring: 0.05 },
    grass: { gain: 0.24, decay: 0.12, floor: 120, cutoff: 1500, tone: 150, q: 2, ring: 0.04 },
    sand: { gain: 0.24, decay: 0.12, floor: 300, cutoff: 1800, tone: 0, q: 0, ring: 0 },
    snow: { gain: 0.2, decay: 0.13, floor: 500, cutoff: 2200, tone: 0, q: 0, ring: 0 },
    leaves: { gain: 0.2, decay: 0.17, floor: 1500, cutoff: 5000, tone: 0, q: 0, ring: 0 },
    water: { gain: 0.22, decay: 0.14, floor: 120, cutoff: 1100, tone: 90, q: 3, ring: 0.12 },
};
const RAIN_VOLUME = 0.3;
/** Seconds for the rain bed to swell or die away, so fronts arrive gently. */
const RAIN_FADE = 3;
/** Detuned layers, which is what hides the loop point of the noise buffer. */
const RAIN_LAYERS = [
    { rate: 0.8, cutoff: 850, gain: 1 },
    { rate: 1.17, cutoff: 2800, gain: 0.3 },
];
const WATER_VOLUME = 0.34;
/** Going under is abrupt, so this bed swaps far quicker than a weather front. */
const WATER_FADE = 0.5;
/** Low cutoffs tilt the pink buffer the rest of the way towards brown noise. */
const WATER_LAYERS = [
    { rate: 0.5, cutoff: 190, gain: 1 },
    { rate: 0.73, cutoff: 420, gain: 0.25 },
];
const THUNDER_VOLUME = 0.6;
/** The strike range the weather picks from, which voices near crack vs. far rumble. */
const THUNDER_NEAR = 20;
const THUNDER_FAR = 80;
/** Swells in the dying roll; real thunder never fades evenly. */
const THUNDER_ROLLS = 4;
/** Knocks in a tumble, and the seconds they are spread over. */
const TUMBLE_KNOCKS = 5;
const TUMBLE_SPAN = 0.5;
/**
 * A looping ambience. The layers run for the life of the page and only the
 * gain above them moves, so switching one on costs nothing.
 */
class Bed {
    ctx;
    gain;
    fade;
    level = -1;
    constructor(ctx, noise, destination, layers, highpass, fade) {
        this.ctx = ctx;
        this.fade = fade;
        this.gain = ctx.createGain();
        this.gain.gain.value = 0;
        const high = ctx.createBiquadFilter();
        high.type = 'highpass';
        high.frequency.value = highpass;
        this.gain.connect(high).connect(destination);
        for (const layer of layers) {
            const source = ctx.createBufferSource();
            source.buffer = noise;
            source.loop = true;
            source.playbackRate.value = layer.rate;
            const low = ctx.createBiquadFilter();
            low.type = 'lowpass';
            low.frequency.value = layer.cutoff;
            low.Q.value = 0.4;
            const gain = ctx.createGain();
            gain.gain.value = layer.gain;
            source.connect(low).connect(gain).connect(this.gain);
            source.start();
        }
    }
    set(level) {
        if (Math.abs(level - this.level) < 0.005)
            return;
        this.level = level;
        // A time constant, so three of them land within a hair of the target.
        this.gain.gain.setTargetAtTime(level, this.ctx.currentTime, this.fade / 3);
    }
}
class AudioEngine {
    ctx = null;
    master = null;
    noise = null;
    lastStep = 0;
    rain = null;
    water = null;
    lastHit = 0;
    /** True once a user gesture has let the context start. */
    get ready() {
        return this.ctx !== null && this.ctx.state === 'running';
    }
    /** Safe to call on every gesture: creating and resuming are both idempotent. */
    resume() {
        if (!this.ctx) {
            const Ctor = window.AudioContext ?? window.webkitAudioContext;
            if (!Ctor)
                return;
            this.ctx = new Ctor();
            this.master = this.ctx.createGain();
            this.master.gain.value = MASTER_VOLUME;
            this.master.connect(this.ctx.destination);
            this.noise = buildNoise(this.ctx);
        }
        if (this.ctx.state === 'suspended')
            void this.ctx.resume();
    }
    /** Steady rainfall at 0..1 strength. Expects to be called every frame. */
    setRain(level) {
        if (!this.ready)
            return;
        if (!this.rain)
            this.rain = new Bed(this.ctx, this.noise, this.master, RAIN_LAYERS, 200, RAIN_FADE);
        this.rain.set(clamp01(level) * RAIN_VOLUME);
    }
    /** The muffled rumble of being under the surface, at 0..1 strength. */
    setUnderwater(level) {
        if (!this.ready)
            return;
        if (!this.water)
            this.water = new Bed(this.ctx, this.noise, this.master, WATER_LAYERS, 20, WATER_FADE);
        this.water.set(clamp01(level) * WATER_VOLUME);
    }
    /** A strike `distance` blocks away: a crack if it is close, a roll either way. */
    playThunder(distance = 50) {
        if (!this.ready)
            return;
        const now = this.ctx.currentTime;
        const near = 1 - Math.max(0, Math.min(1, (distance - THUNDER_NEAR) / (THUNDER_FAR - THUNDER_NEAR)));
        const peak = THUNDER_VOLUME * (0.4 + near * 0.6);
        this.roll(now, near, peak);
        if (near > 0.35)
            this.crack(now, near, peak);
    }
    /** Low noise sweeping downwards as the front of the sound outruns the rest. */
    roll(now, near, peak) {
        const decay = 4.4 - near * 1.8;
        const source = this.ctx.createBufferSource();
        source.buffer = this.noise;
        source.loop = true;
        source.playbackRate.value = 0.55;
        const low = this.ctx.createBiquadFilter();
        low.type = 'lowpass';
        low.Q.value = 0.6;
        const open = 500 + near * 1800;
        low.frequency.setValueAtTime(open, now);
        low.frequency.exponentialRampToValueAtTime(110, now + decay * 0.7);
        const gain = this.ctx.createGain();
        // Distant thunder arrives as a swell; a close one is on you at once.
        const rise = 0.02 + (1 - near) * 0.35;
        const level = gain.gain;
        level.setValueAtTime(0.0001, now);
        level.linearRampToValueAtTime(peak, now + rise);
        for (let i = 1; i <= THUNDER_ROLLS; i++) {
            const at = now + rise + (decay - rise) * (i / THUNDER_ROLLS);
            const step = peak * Math.pow(0.5, i) * (0.6 + Math.random() * 0.8);
            level.exponentialRampToValueAtTime(Math.max(step, 0.0002), at);
        }
        level.exponentialRampToValueAtTime(0.0001, now + decay + 0.3);
        source.connect(low).connect(gain).connect(this.master);
        source.start(now, Math.random() * NOISE_SECONDS);
        source.stop(now + decay + 0.4);
    }
    /** The initial tearing snap, only heard when the bolt lands nearby. */
    crack(now, near, peak) {
        const source = this.ctx.createBufferSource();
        source.buffer = this.noise;
        source.playbackRate.value = 1.6;
        const high = this.ctx.createBiquadFilter();
        high.type = 'highpass';
        high.frequency.value = 500;
        const low = this.ctx.createBiquadFilter();
        low.type = 'lowpass';
        low.frequency.setValueAtTime(6000, now);
        low.frequency.exponentialRampToValueAtTime(900, now + 0.3);
        const gain = this.ctx.createGain();
        const level = gain.gain;
        level.setValueAtTime(0.0001, now);
        level.linearRampToValueAtTime(peak * 0.8 * near, now + 0.004);
        level.exponentialRampToValueAtTime(0.0001, now + 0.35);
        source.connect(high).connect(low).connect(gain).connect(this.master);
        source.start(now, Math.random() * (NOISE_SECONDS - 0.5), 0.4);
    }
    /** A bright hiss of breaking panes followed by a few falling shards. */
    playGlassBreak() {
        if (!this.ready)
            return;
        const now = this.ctx.currentTime;
        const source = this.ctx.createBufferSource();
        source.buffer = this.noise;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(2400, now);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.26);
        source.connect(filter).connect(gain).connect(this.master);
        source.start(now);
        source.stop(now + 0.3);
        for (let i = 0; i < 4; i++)
            this.tinkle(now + 0.03 + i * 0.045 + Math.random() * 0.03);
    }
    tinkle(at) {
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1900 + Math.random() * 2500, at);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.12, at);
        gain.gain.exponentialRampToValueAtTime(0.0005, at + 0.13);
        osc.connect(gain).connect(this.master);
        osc.start(at);
        osc.stop(at + 0.15);
    }
    /** Soft muffled "pff" of a crop being torn up. */
    playCropBreak() {
        if (!this.ready)
            return;
        const now = this.ctx.currentTime;
        const source = this.ctx.createBufferSource();
        source.buffer = this.noise;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(900, now);
        filter.frequency.exponentialRampToValueAtTime(380, now + 0.12);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.09, now + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0004, now + 0.15);
        source.connect(filter).connect(gain).connect(this.master);
        source.start(now);
        source.stop(now + 0.18);
    }
    /** A short knock against a block, voiced by how dense the material is. */
    playHit(surface, volume = 1) {
        const voice = HITS[surface] ?? HITS.dirt;
        if (!this.ready)
            return;
        const now = this.ctx.currentTime;
        if (now - this.lastHit < MIN_HIT_GAP)
            return;
        this.lastHit = now;
        const wobble = 0.9 + Math.random() * 0.2;
        const peak = voice.gain * volume * (0.85 + Math.random() * 0.3);
        this.impact(now, voice, peak);
        if (voice.ring > 0)
            this.resonance(now, voice, wobble, peak);
    }
    /** The contact itself: a noise click, band-limited to the material's grain. */
    impact(now, voice, peak) {
        const source = this.ctx.createBufferSource();
        source.buffer = this.noise;
        const high = this.ctx.createBiquadFilter();
        high.type = 'highpass';
        high.frequency.value = voice.floor;
        const low = this.ctx.createBiquadFilter();
        low.type = 'lowpass';
        low.Q.value = 0.5;
        low.frequency.setValueAtTime(voice.cutoff, now);
        low.frequency.exponentialRampToValueAtTime(voice.cutoff * 0.4, now + voice.decay);
        const gain = this.ctx.createGain();
        envelope(gain.gain, now, peak, voice.decay, HIT_ATTACK);
        source.connect(high).connect(low).connect(gain).connect(this.master);
        source.start(now, Math.random() * (NOISE_SECONDS - voice.decay - 0.1), voice.decay + 0.1);
    }
    /** Dense matter rings after the blow; a narrow bandpass is that ring. */
    resonance(now, voice, wobble, peak) {
        const source = this.ctx.createBufferSource();
        source.buffer = this.noise;
        const band = this.ctx.createBiquadFilter();
        band.type = 'bandpass';
        band.frequency.value = voice.tone * wobble;
        band.Q.value = voice.q;
        const gain = this.ctx.createGain();
        envelope(gain.gain, now, peak * 0.9, voice.ring, HIT_ATTACK);
        source.connect(band).connect(gain).connect(this.master);
        source.start(now, Math.random() * (NOISE_SECONDS - voice.ring - 0.1), voice.ring + 0.1);
    }
    /** Cut wood clattering away: a run of knocks that bunch up and drop in pitch. */
    playTumble() {
        const voice = HITS.wood;
        if (!this.ready)
            return;
        const now = this.ctx.currentTime;
        for (let i = 0; i < TUMBLE_KNOCKS; i++) {
            // The exponent crowds the later knocks together, as a piece settles.
            const at = now + TUMBLE_SPAN * Math.pow(i / TUMBLE_KNOCKS, 0.7) + Math.random() * 0.03;
            const fade = 1 - i / TUMBLE_KNOCKS;
            const peak = voice.gain * (0.3 + fade * 0.6);
            this.impact(at, voice, peak);
            this.resonance(at, voice, 1.15 - i * 0.12 + Math.random() * 0.12, peak);
        }
    }
    playFootstep(surface, volume = 1) {
        const voice = SURFACES[surface] ?? SURFACES.dirt;
        if (!this.ready)
            return;
        const now = this.ctx.currentTime;
        if (now - this.lastStep < MIN_STEP_GAP)
            return;
        this.lastStep = now;
        // Each footfall is detuned a little so a run never sounds like a loop.
        const wobble = 0.85 + Math.random() * 0.3;
        const peak = voice.gain * volume * (0.8 + Math.random() * 0.4);
        this.scuff(now, voice, wobble, peak);
        // The heel lands a shade before the ball of the foot; one grain on its
        // own is what made this read as a single drum hit.
        this.scuff(now + 0.03 + Math.random() * 0.02, voice, wobble * 1.1, peak * 0.45);
        if (voice.body > 0)
            this.weight(now, voice, wobble, peak);
    }
    /** The filtered noise grain: grass blades, loose grains, a wet swish. */
    scuff(at, voice, wobble, peak) {
        const source = this.ctx.createBufferSource();
        source.buffer = this.noise;
        source.playbackRate.value = wobble;
        // A sweeping lowpass instead of a resonant bandpass: broad and airy,
        // with no ringing pitch to latch onto.
        const low = this.ctx.createBiquadFilter();
        low.type = 'lowpass';
        low.Q.value = 0.4;
        const open = voice.freq * wobble;
        low.frequency.setValueAtTime(open, at);
        low.frequency.exponentialRampToValueAtTime(open * voice.sweep, at + voice.decay);
        const high = this.ctx.createBiquadFilter();
        high.type = 'highpass';
        high.frequency.value = 180;
        const gain = this.ctx.createGain();
        envelope(gain.gain, at, peak, voice.decay);
        source.connect(low).connect(high).connect(gain).connect(this.master);
        source.start(at, Math.random() * (NOISE_SECONDS - voice.decay - 0.1), voice.decay + 0.1);
    }
    /** A muted low swell under hard surfaces; enough to feel, not to hear. */
    weight(at, voice, wobble, peak) {
        const osc = this.ctx.createOscillator();
        const base = voice.body * wobble;
        osc.frequency.setValueAtTime(base, at);
        osc.frequency.exponentialRampToValueAtTime(base * 0.6, at + voice.decay);
        const gain = this.ctx.createGain();
        envelope(gain.gain, at, peak * 0.22, voice.decay * 0.7);
        osc.connect(gain).connect(this.master);
        osc.start(at);
        osc.stop(at + voice.decay + 0.05);
    }
}
/**
 * Pink noise, via Paul Kellet's filter. Its tilted spectrum is far closer to
 * real-world rustle than white noise, which hisses.
 */
function buildNoise(ctx) {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * NOISE_SECONDS), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < data.length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852;
        b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.016898;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
    }
    return buffer;
}
/** Soft rise, long tail; exponential ramps cannot touch zero. */
function envelope(param, at, peak, decay, attack = ATTACK) {
    param.setValueAtTime(0.0001, at);
    param.linearRampToValueAtTime(Math.max(peak, 0.0002), at + attack);
    param.exponentialRampToValueAtTime(0.0001, at + decay);
}
function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}
export const audio = new AudioEngine();
