import { describe, expect, it } from 'vitest';
import { CARS, TRACKS } from '../../src/data/catalog';
import { Vehicle, collideVehicles, NEUTRAL } from '../../src/game/Vehicle';
import { Track } from '../../src/world/Track';

describe('driving physics', () => {
  it('accelerates within the selected car’s limit and brakes into reverse', () => {
    const car = new Vehicle(CARS[0]);
    for (let i = 0; i < 2400; i++) car.step({ ...NEUTRAL, throttle: 1 }, 1 / 120);
    expect(car.speed).toBeGreaterThan(40);
    expect(car.speed).toBeLessThanOrEqual(car.spec.maxSpeed);
    for (let i = 0; i < 1200; i++) car.step({ ...NEUTRAL, brake: 1 }, 1 / 120);
    expect(car.speed).toBeLessThan(-5);
    expect(car.speed).toBeGreaterThanOrEqual(-12);
  });

  it('has comparable acceleration at 60 Hz and 120 Hz', () => {
    const a = new Vehicle(CARS[0]),
      b = new Vehicle(CARS[0]);
    for (let i = 0; i < 600; i++) a.step({ ...NEUTRAL, throttle: 1 }, 1 / 60);
    for (let i = 0; i < 1200; i++) b.step({ ...NEUTRAL, throttle: 1 }, 1 / 120);
    expect(Math.abs(a.speed - b.speed)).toBeLessThan(0.2);
    expect(Math.abs(a.z - b.z)).toBeLessThan(1);
  });

  it('turns right under positive steering and slows on grass', () => {
    const a = new Vehicle(CARS[0]),
      b = new Vehicle(CARS[0]);
    for (let i = 0; i < 600; i++) {
      a.step({ ...NEUTRAL, throttle: 1, steer: 0.4 }, 1 / 120);
      b.step({ ...NEUTRAL, throttle: 1 }, 1 / 120, true);
    }
    expect(a.x).toBeGreaterThan(0);
    expect(b.speed).toBeLessThan(a.speed);
  });

  it('separates overlapping cars without freezing or producing nonfinite values', () => {
    const a = new Vehicle(CARS[0]),
      b = new Vehicle(CARS[1]);
    a.vx = 5;
    b.x = 1;
    b.vx = -5;
    collideVehicles(a, b);
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeCloseTo(2.6);
    for (let i = 0; i < 240; i++) a.step({ ...NEUTRAL, throttle: 1 }, 1 / 120);
    expect(a.speed).toBeGreaterThan(10);
    a.reset(0, 0, 0);
    b.reset(0, 0, 0);
    collideVehicles(a, b);
    expect(Number.isFinite(a.x + b.x)).toBe(true);
  });

  it('deflects the car at a barrier and lets it continue', () => {
    const track = new Track(TRACKS[0]),
      car = new Vehicle(CARS[0]);
    const point = track.at(0.15, 10);
    car.reset(point.x, point.z, point.heading);
    car.vx = Math.sin(car.heading) * 12 + Math.cos(car.heading) * 8;
    car.vz = Math.cos(car.heading) * 12 - Math.sin(car.heading) * 8;
    track.constrain(car);
    expect(track.nearest(car.x, car.z).distance).toBeLessThan(TRACKS[0].width / 2);
    expect(car.speed).toBeGreaterThan(5);
  });
});
