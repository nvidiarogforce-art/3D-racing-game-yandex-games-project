import { wrap } from '../core/math';

/** Ordered gates prevent finish-line oscillation, reversing, and large shortcuts earning laps. */
export class RaceProgress {
  completedLaps = 0;
  nextGate = 1;
  lapStartedAt = 0;
  bestLap = Infinity;
  lastLap = Infinity;
  finishedAt = Infinity;
  private previous = 0;
  private validDistance = 0;

  constructor(
    public readonly totalLaps: number,
    private readonly gates = 12,
  ) {}

  resetPosition(progress: number): void {
    this.previous = wrap(progress);
  }

  update(progress: number, elapsed: number, onTrack: boolean): boolean {
    const current = wrap(progress);
    const delta = wrap(current - this.previous + 0.5) - 0.5;
    const previous = this.previous;
    this.previous = current;
    if (!onTrack || delta <= 0 || delta > 0.08 || this.finished) return false;
    this.validDistance += delta;
    if (
      this.nextGate < this.gates &&
      previous < this.nextGate / this.gates &&
      current >= this.nextGate / this.gates
    )
      this.nextGate++;
    if (
      this.nextGate === this.gates &&
      previous > 0.9 &&
      current < 0.1 &&
      this.validDistance > 0.85
    ) {
      this.completedLaps++;
      if (this.finished) this.finishedAt = elapsed;
      this.lastLap = elapsed - this.lapStartedAt;
      this.bestLap = Math.min(this.bestLap, this.lastLap);
      this.lapStartedAt = elapsed;
      this.nextGate = 1;
      this.validDistance = 0;
      return true;
    }
    return false;
  }

  get finished(): boolean {
    return this.completedLaps >= this.totalLaps;
  }
  get score(): number {
    if (this.finished) return this.totalLaps;
    const validated = Math.min(this.previous, this.nextGate / this.gates);
    return this.completedLaps + validated;
  }
}
