import { describe, expect, it } from 'vitest';
import { RaceProgress } from '../../src/game/RaceProgress';

function lap(progress: RaceProgress, elapsed = 0): void {
  for (let i = 1; i <= 100; i++) progress.update((i % 100) / 100, elapsed + i * 0.5, true);
}

describe('race progression', () => {
  it('freezes the finish time and score after the final lap', () => {
    const progress = new RaceProgress(1);
    lap(progress);
    expect(progress.finishedAt).toBe(50);
    progress.update(0.04, 55, true);
    expect(progress.score).toBe(1);
    expect(progress.finishedAt).toBe(50);
  });
  it('requires all three complete laps and records the best lap', () => {
    const progress = new RaceProgress(3);
    lap(progress);
    expect(progress.completedLaps).toBe(1);
    expect(progress.finished).toBe(false);
    lap(progress, 50);
    lap(progress, 100);
    expect(progress.finished).toBe(true);
    expect(progress.bestLap).toBe(50);
    lap(progress, 150);
    expect(progress.completedLaps).toBe(3);
  });
  it('rejects finish-line oscillation and reverse driving', () => {
    const progress = new RaceProgress(3);
    for (let i = 0; i < 20; i++) {
      progress.update(0.99, i, true);
      progress.update(0.01, i + 0.5, true);
    }
    expect(progress.completedLaps).toBe(0);
    for (let i = 99; i >= 0; i--) progress.update(i / 100, 20 + i, true);
    expect(progress.completedLaps).toBe(0);
  });
  it('rejects off-track gate crossings and teleported shortcuts', () => {
    const progress = new RaceProgress(3);
    for (let i = 1; i <= 100; i++) progress.update((i % 100) / 100, i, i < 8 || i > 10);
    expect(progress.completedLaps).toBe(0);
    const shortcut = new RaceProgress(3);
    shortcut.update(0.4, 1, true);
    shortcut.update(0.8, 2, true);
    shortcut.update(0, 3, true);
    expect(shortcut.completedLaps).toBe(0);
  });
  it('does not award a lap when a car reset changes its position', () => {
    const progress = new RaceProgress(3);
    progress.resetPosition(0.98);
    progress.update(0.01, 1, true);
    expect(progress.completedLaps).toBe(0);
    progress.resetPosition(0.5);
    progress.update(0.51, 2, true);
    expect(progress.completedLaps).toBe(0);
  });
});
