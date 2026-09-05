import { describe, expect, it } from 'vitest';
import { CARS, TRACKS } from '../../src/data/catalog';
import { driveAI } from '../../src/game/DriverAI';
import { Vehicle } from '../../src/game/Vehicle';
import { RaceProgress } from '../../src/game/RaceProgress';
import { Track } from '../../src/world/Track';

describe('AI route completion', () => {
  it.each(TRACKS)('completes a valid lap on $name using driving physics', (spec) => {
    const track = new Track(spec),
      car = new Vehicle(CARS[1]),
      race = new RaceProgress(1);
    const start = track.at(0.004);
    car.reset(start.x, start.z, start.heading);
    race.resetPosition(start.progress);
    for (let i = 0; i < 120 * 120 && !race.finished; i++) {
      car.step(driveAI(car, track, [car], -2), 1 / 120);
      track.constrain(car);
      const point = track.nearest(car.x, car.z);
      race.update(point.progress, i / 120, point.distance <= spec.width / 2);
    }
    expect(race.finished).toBe(true);
    expect(race.bestLap).toBeGreaterThan(15);
  });
});
