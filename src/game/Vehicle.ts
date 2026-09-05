import type { CarSpec } from '../data/catalog';
import { clamp, damp } from '../core/math';

export interface Controls {
  throttle: number;
  brake: number;
  steer: number;
  handbrake: boolean;
}
export const NEUTRAL: Controls = { throttle: 0, brake: 0, steer: 0, handbrake: false };

/** Arcade bicycle model. Metres, seconds, radians; +Z is forward at heading zero. */
export class Vehicle {
  x = 0;
  z = 0;
  heading = 0;
  vx = 0;
  vz = 0;
  steering = 0;
  constructor(public readonly spec: CarSpec) {}

  get speed(): number {
    return this.vx * Math.sin(this.heading) + this.vz * Math.cos(this.heading);
  }

  reset(x: number, z: number, heading: number): void {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.vx = 0;
    this.vz = 0;
    this.steering = 0;
  }

  step(input: Controls, dt: number, offRoad = false): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 1 / 30);
    let forward = this.speed;
    let side = this.vx * Math.cos(this.heading) - this.vz * Math.sin(this.heading);
    const throttle = clamp(input.throttle, 0, 1);
    const brake = clamp(input.brake, 0, 1);
    forward += throttle * (forward < -0.5 ? 28 : this.spec.acceleration) * dt;
    if (brake > 0) {
      forward = forward > 0.5 ? Math.max(0, forward - brake * 32 * dt) : forward - brake * 8 * dt;
    }
    const resistance = 0.18 + (offRoad ? 1.4 : 0) + (input.handbrake ? 1.7 : 0);
    forward *= Math.exp(-resistance * dt);
    forward = clamp(forward, -12, this.spec.maxSpeed);
    if (Math.abs(forward) < 0.035 && !throttle && !brake) forward = 0;
    this.steering = damp(this.steering, clamp(input.steer, -1, 1), 7, dt);
    const steerAngle = (this.steering * this.spec.steering) / (1 + Math.abs(forward) * 0.045);
    const yaw = ((Math.tan(steerAngle) * forward) / 2.8) * dt * (input.handbrake ? 1.3 : 1);
    this.heading += yaw;
    // Keep world momentum as the body turns; tire grip gradually removes side slip.
    const rotatedForward = forward * Math.cos(yaw) + side * Math.sin(yaw);
    side =
      (side * Math.cos(yaw) - forward * Math.sin(yaw)) *
      Math.exp(-(input.handbrake ? 1.8 : this.spec.grip) * dt);
    forward = rotatedForward;
    this.vx = forward * Math.sin(this.heading) + side * Math.cos(this.heading);
    this.vz = forward * Math.cos(this.heading) - side * Math.sin(this.heading);
    this.x += this.vx * dt;
    this.z += this.vz * dt;
  }
}

/** Equal-mass circle contact. Separates cars and applies a small, nonfatal impulse. */
export function collideVehicles(a: Vehicle, b: Vehicle): void {
  const dx = a.x - b.x,
    dz = a.z - b.z;
  const distance = Math.hypot(dx, dz),
    radius = 2.6;
  if (distance >= radius) return;
  const nx = distance > 0.001 ? dx / distance : 1;
  const nz = distance > 0.001 ? dz / distance : 0;
  const penetration = (radius - distance) * 0.5;
  a.x += nx * penetration;
  a.z += nz * penetration;
  b.x -= nx * penetration;
  b.z -= nz * penetration;
  const closing = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
  if (closing >= 0) return;
  const impulse = -closing * 0.6;
  a.vx += nx * impulse;
  a.vz += nz * impulse;
  b.vx -= nx * impulse;
  b.vz -= nz * impulse;
}
