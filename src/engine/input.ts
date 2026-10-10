/** Keys the browser would otherwise act on, such as scrolling the page. */
const SWALLOWED_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

/** Browsers can report a huge bogus delta right after locking; anything past this is noise. */
const MAX_MOVE_PER_EVENT = 300;

function clampMove(amount: number): number {
  return Math.max(-MAX_MOVE_PER_EVENT, Math.min(MAX_MOVE_PER_EVENT, amount));
}

export class Input {
  readonly keys = new Set<string>();
  readonly buttons = new Set<number>();
  mouseDeltaX = 0;
  mouseDeltaY = 0;
  locked = false;

  onMouseDown: ((button: number) => void) | null = null;
  onKeyPress: ((code: string) => void) | null = null;
  onLockChange: ((locked: boolean) => void) | null = null;

  private readonly element: HTMLElement;
  private skipNextMove = false;

  constructor(element: HTMLElement) {
    this.element = element;

    window.addEventListener('keydown', (event) => {
      if (SWALLOWED_KEYS.has(event.code)) event.preventDefault();
      // Auto-repeat still refreshes the held set, so a key survives a mid-press clear.
      this.keys.add(event.code);
      if (!event.repeat) this.onKeyPress?.(event.code);
    });

    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
    window.addEventListener('blur', () => this.keys.clear());

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.element;
      if (this.locked) {
        // The first move after locking carries the jump from the cursor's old position.
        this.skipNextMove = true;
        this.mouseDeltaX = 0;
        this.mouseDeltaY = 0;
      } else {
        this.keys.clear();
        this.buttons.clear();
      }
      this.onLockChange?.(this.locked);
    });

    this.element.addEventListener('mousemove', (event) => {
      if (!this.locked) return;
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
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  isMouseDown(button: number): boolean {
    return this.buttons.has(button);
  }

  async requestLock(): Promise<void> {
    try {
      await this.element.requestPointerLock();
    } catch {
      // Browsers reject rapid re-locks; the user can simply click again.
    }
  }

  consumeMouseDelta(): [number, number] {
    const delta: [number, number] = [this.mouseDeltaX, this.mouseDeltaY];
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    return delta;
  }
}
