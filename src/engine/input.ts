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

  constructor(element: HTMLElement) {
    this.element = element;

    window.addEventListener('keydown', (event) => {
      if (event.repeat) return;
      this.keys.add(event.code);
      this.onKeyPress?.(event.code);
      if (event.code === 'Space') event.preventDefault();
    });

    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
    window.addEventListener('blur', () => this.keys.clear());

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.element;
      if (!this.locked) {
        this.keys.clear();
        this.buttons.clear();
      }
      this.onLockChange?.(this.locked);
    });

    this.element.addEventListener('mousemove', (event) => {
      if (!this.locked) return;
      this.mouseDeltaX += event.movementX;
      this.mouseDeltaY += event.movementY;
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
