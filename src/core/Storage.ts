import type { GameMode } from '../data/catalog';

/** Storage is optional: private browsing, quota limits and corrupt saves must not block play. */
export class Storage {
  private best: Record<string, number> = {};
  constructor() {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem('apex-horizon:v1') || '{}');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const [key, value] of Object.entries(parsed))
          if (typeof value === 'number' && Number.isFinite(value) && value > 0)
            this.best[key] = value;
      }
    } catch {
      /* Fall back to session-only records. */
    }
  }
  get(track: string, car: string, mode: GameMode): number {
    return this.best[`${track}:${car}:${mode}`] ?? Infinity;
  }
  save(track: string, car: string, mode: GameMode, time: number): void {
    if (!Number.isFinite(time) || time <= 0) return;
    const key = `${track}:${car}:${mode}`;
    this.best[key] = Math.min(this.get(track, car, mode), time);
    try {
      localStorage.setItem('apex-horizon:v1', JSON.stringify(this.best));
    } catch {
      /* Session record remains available. */
    }
  }
}
