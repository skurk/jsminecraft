/** Two taps of forward inside this window start a sprint. */
const DOUBLE_TAP_MS = 280;
const ATTACK_KEYS = ['ControlLeft', 'ControlRight'];
/** Browsers can report a huge bogus delta right after locking; anything past this is noise. */
const MAX_MOVE_PER_EVENT = 300;
// Chrome bars pointer lock for 1.25s after Escape, so the retry waits that out.
const RELOCK_DELAY = 1350;
/** A lock lost this soon after being asked for was taken back, not given up. */
const REVOKE_WINDOW = 1500;
const MAX_RELOCKS = 2;
function clampMove(amount) {
    return Math.max(-MAX_MOVE_PER_EVENT, Math.min(MAX_MOVE_PER_EVENT, amount));
}
export class Input {
    keys = new Set();
    buttons = new Set();
    mouseDeltaX = 0;
    mouseDeltaY = 0;
    locked = false;
    sprintLatch = false;
    lastForwardTap = 0;
    wheelAccumulator = 0;
    onMouseDown = null;
    onKeyPress = null;
    onScroll = null;
    onLockChange = null;
    onLockBlocked = null;
    element;
    skipNextMove = false;
    /** True while a lock has been asked for but not granted yet. */
    lockPending = false;
    /** Escape bars the pointer lock until the next gesture, so the request waits for one. */
    relockOnGesture = false;
    lockTimer = 0;
    lockRequestedAt = 0;
    relockAttempts = 0;
    constructor(element) {
        this.element = element;
        window.addEventListener('keydown', (event) => {
            if (event.code === 'Space' || event.code.startsWith('Arrow'))
                event.preventDefault();
            // Auto-repeat still refreshes the held set, so a key survives a mid-press clear.
            this.keys.add(event.code);
            if (event.repeat)
                return;
            if (event.code === 'KeyW') {
                const now = performance.now();
                if (now - this.lastForwardTap < DOUBLE_TAP_MS)
                    this.sprintLatch = true;
                this.lastForwardTap = now;
            }
            this.onKeyPress?.(event.code);
            // Escape itself grants no user activation, so any later key does the re-locking.
            if (this.relockOnGesture && event.code !== 'Escape')
                void this.requestLock();
            // Ctrl stands in for the left mouse button, so it swings on press
            // and keeps mining while held.
            if (this.locked && ATTACK_KEYS.includes(event.code))
                this.onMouseDown?.(0);
        });
        window.addEventListener('keyup', (event) => {
            if (event.code === 'KeyW')
                this.sprintLatch = false;
            this.keys.delete(event.code);
        });
        window.addEventListener('blur', () => this.releaseAll());
        document.addEventListener('pointerlockchange', () => {
            this.locked = document.pointerLockElement === this.element;
            if (this.locked) {
                this.cancelRelock();
                // The first move after locking carries the jump from the cursor's old position.
                this.skipNextMove = true;
                this.mouseDeltaX = 0;
                this.mouseDeltaY = 0;
            }
            else {
                this.releaseAll();
                this.buttons.clear();
                // Chrome grants the lock after Escape and then takes it straight back.
                if (performance.now() - this.lockRequestedAt < REVOKE_WINDOW)
                    this.scheduleRelock();
            }
            this.onLockChange?.(this.locked);
        });
        this.element.addEventListener('mousemove', (event) => {
            if (!this.locked)
                return;
            if (this.skipNextMove) {
                this.skipNextMove = false;
                return;
            }
            this.mouseDeltaX += clampMove(event.movementX);
            this.mouseDeltaY += clampMove(event.movementY);
        });
        this.element.addEventListener('mousedown', (event) => {
            if (!this.locked) {
                void this.requestLock();
                return;
            }
            this.buttons.add(event.button);
            this.onMouseDown?.(event.button);
        });
        window.addEventListener('mouseup', (event) => this.buttons.delete(event.button));
        this.element.addEventListener('contextmenu', (event) => event.preventDefault());
        window.addEventListener('wheel', (event) => {
            if (!this.locked)
                return;
            event.preventDefault();
            // Normalised so a trackpad's many small deltas step as one notch.
            const notch = event.deltaMode === 0 ? 100 : event.deltaMode === 1 ? 3 : 1;
            this.wheelAccumulator += event.deltaY / notch;
            // Epsilon, because summing fractions of a notch lands just short of 1.
            while (this.wheelAccumulator >= 1 - 1e-6) {
                this.wheelAccumulator -= 1;
                this.onScroll?.(1);
            }
            while (this.wheelAccumulator <= -1 + 1e-6) {
                this.wheelAccumulator += 1;
                this.onScroll?.(-1);
            }
        }, { passive: false });
    }
    isDown(code) {
        return this.keys.has(code);
    }
    /** True while a sprint started by double-tapping forward is still held. */
    get sprinting() {
        return this.sprintLatch && this.keys.has('KeyW');
    }
    releaseAll() {
        this.keys.clear();
        this.sprintLatch = false;
        this.wheelAccumulator = 0;
    }
    isMouseDown(button) {
        return this.buttons.has(button) || (button === 0 && this.attackKeyDown);
    }
    get attackKeyDown() {
        return ATTACK_KEYS.some((code) => this.keys.has(code));
    }
    /** True while the game is waiting to get the pointer back, so no menu should show. */
    get resuming() {
        return this.lockPending || this.relockOnGesture;
    }
    async requestLock() {
        this.cancelRelock();
        this.relockAttempts = 0;
        this.lockPending = true;
        this.lockRequestedAt = performance.now();
        try {
            await this.element.requestPointerLock();
            this.lockPending = false;
        }
        catch {
            this.scheduleRelock();
        }
    }
    /** Queues another attempt; Escape bars the lock for about a second either way. */
    scheduleRelock() {
        clearTimeout(this.lockTimer);
        if (this.relockAttempts >= MAX_RELOCKS) {
            this.lockTimer = 0;
            this.lockPending = false;
            this.onLockBlocked?.();
            return;
        }
        this.relockAttempts++;
        this.lockPending = true;
        // Also re-lock on the next gesture, for browsers that insist on one.
        this.relockOnGesture = true;
        this.lockTimer = setTimeout(() => this.retryLock(), RELOCK_DELAY);
    }
    async retryLock() {
        this.lockTimer = 0;
        this.lockRequestedAt = performance.now();
        try {
            await this.element.requestPointerLock();
            this.relockOnGesture = false;
            this.lockPending = false;
        }
        catch {
            this.scheduleRelock();
        }
    }
    cancelRelock() {
        clearTimeout(this.lockTimer);
        this.lockTimer = 0;
        this.relockOnGesture = false;
        this.lockPending = false;
    }
    /** Deliberate release, as when a screen opens; nothing should grab the pointer back. */
    releaseLock() {
        this.cancelRelock();
        this.lockRequestedAt = 0;
        document.exitPointerLock();
    }
    consumeMouseDelta() {
        const delta = [this.mouseDeltaX, this.mouseDeltaY];
        this.mouseDeltaX = 0;
        this.mouseDeltaY = 0;
        return delta;
    }
}
