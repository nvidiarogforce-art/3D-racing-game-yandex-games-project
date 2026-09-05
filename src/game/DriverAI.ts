import { angleDelta, clamp } from '../core/math';
import type { Track } from '../world/Track';
import type { Controls, Vehicle } from './Vehicle';

/** Look-ahead steering with corner braking and a short-range car avoidance offset. */
export function driveAI(car: Vehicle, track: Track, rivals: Vehicle[], lane: number): Controls {
  const here = track.nearest(car.x, car.z);
  let offset = lane;
  let following = false;
  for (const other of rivals) {
    if (other === car) continue;
    const dx = other.x - car.x,
      dz = other.z - car.z;
    const ahead = dx * Math.sin(car.heading) + dz * Math.cos(car.heading);
    const side = dx * Math.cos(car.heading) - dz * Math.sin(car.heading);
    if (ahead > 0 && ahead < 15 && Math.abs(side) < 2.8) {
      offset = side >= 0 ? -3 : 3;
      following = ahead < 7;
    }
  }
  const target = track.at(
    here.progress + (8 + Math.max(0, car.speed) * 0.65) / track.length,
    offset,
  );
  const angle = angleDelta(Math.atan2(target.x - car.x, target.z - car.z) - car.heading);
  const future = track.at(here.progress + 35 / track.length);
  const curve = Math.abs(angleDelta(future.heading - here.heading));
  const targetSpeed =
    Math.min(car.spec.maxSpeed * 0.72, 36 / (1 + curve * 2.8)) * (following ? 0.65 : 1);
  return {
    throttle: car.speed < targetSpeed ? 1 : 0,
    brake: car.speed > targetSpeed + 2 ? 0.8 : 0,
    steer: clamp(angle * 2.6, -1, 1),
    handbrake: false,
  };
}
