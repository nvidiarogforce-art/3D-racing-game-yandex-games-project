import type { Controls } from '../game/Vehicle';

const DRIVING_KEYS = new Set([
  'KeyW',
  'ArrowUp',
  'KeyS',
  'ArrowDown',
  'KeyA',
  'ArrowLeft',
  'KeyD',
  'ArrowRight',
  'Space',
]);

export class Input {
  enabled = false;
  private keys = new Set<string>();
  private pointers = new Map<number, string>();
  private abort = new AbortController();

  constructor(onAction: (action: string) => void) {
    const options = { signal: this.abort.signal };
    window.addEventListener(
      'keydown',
      (event) => {
        if (
          !this.enabled ||
          event.target instanceof HTMLSelectElement ||
          event.target instanceof HTMLInputElement
        )
          return;
        if (DRIVING_KEYS.has(event.code)) {
          event.preventDefault();
          this.keys.add(event.code);
        }
        if (!event.repeat) {
          if (event.code === 'Escape' || event.code === 'KeyP') onAction('pause');
          if (event.code === 'KeyR') onAction('reset');
          if (event.code === 'KeyC') onAction('camera');
        }
      },
      options,
    );
    window.addEventListener('keyup', (event) => this.keys.delete(event.code), options);
    window.addEventListener('blur', () => this.clear(), options);
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden) this.clear();
      },
      options,
    );
    document.querySelectorAll<HTMLElement>('[data-drive]').forEach((button) => {
      button.addEventListener(
        'pointerdown',
        (event) => {
          event.preventDefault();
          if (!this.enabled) return;
          button.setPointerCapture(event.pointerId);
          this.pointers.set(event.pointerId, button.dataset.drive!);
          button.classList.add('pressed');
        },
        options,
      );
      const release = (event: PointerEvent) => {
        this.pointers.delete(event.pointerId);
        button.classList.remove('pressed');
      };
      button.addEventListener('pointerup', release, options);
      button.addEventListener('pointercancel', release, options);
      button.addEventListener('lostpointercapture', release, options);
    });
  }

  read(): Controls {
    const down = (...codes: string[]) =>
      this.enabled &&
      codes.some((key) => this.keys.has(key) || [...this.pointers.values()].includes(key));
    return {
      throttle: +down('KeyW', 'ArrowUp'),
      brake: +down('KeyS', 'ArrowDown'),
      // Positive steering is the vehicle's left turn. Keep keyboard and touch controls
      // aligned with the labels players see on screen.
      steer: +down('KeyA', 'ArrowLeft') - +down('KeyD', 'ArrowRight'),
      handbrake: down('Space'),
    };
  }

  clear(): void {
    this.keys.clear();
    this.pointers.clear();
    document.querySelectorAll('.pressed').forEach((element) => element.classList.remove('pressed'));
  }
  dispose(): void {
    this.clear();
    this.abort.abort();
  }
}
