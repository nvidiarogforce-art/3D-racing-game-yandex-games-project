import * as THREE from 'three';
import type { TrackSpec } from '../data/catalog';
import { clamp, wrap } from '../core/math';
import type { Vehicle } from '../game/Vehicle';

export interface TrackPoint {
  x: number;
  z: number;
  heading: number;
  progress: number;
  distance: number;
  signedDistance: number;
}

export class Track {
  readonly points: THREE.Vector3[];
  readonly length: number;
  private readonly lengths: number[] = [0];

  constructor(public readonly spec: TrackSpec) {
    const curve = new THREE.CatmullRomCurve3(
      spec.points.map(([x, z]) => new THREE.Vector3(x, 0, z)),
      true,
      'centripetal',
    );
    this.points = curve.getSpacedPoints(320);
    for (let i = 1; i < this.points.length; i++)
      this.lengths.push(this.lengths[i - 1] + this.points[i].distanceTo(this.points[i - 1]));
    this.length = this.lengths[this.lengths.length - 1];
  }

  at(progress: number, lane = 0): TrackPoint {
    const distance = wrap(progress) * this.length;
    let i = Math.min(this.points.length - 2, Math.floor(wrap(progress) * (this.points.length - 1)));
    while (i > 0 && this.lengths[i] > distance) i--;
    while (i < this.points.length - 2 && this.lengths[i + 1] < distance) i++;
    const a = this.points[i],
      b = this.points[i + 1];
    const t = (distance - this.lengths[i]) / (this.lengths[i + 1] - this.lengths[i]);
    const heading = Math.atan2(b.x - a.x, b.z - a.z);
    return {
      x: a.x + (b.x - a.x) * t + Math.cos(heading) * lane,
      z: a.z + (b.z - a.z) * t - Math.sin(heading) * lane,
      heading,
      progress: wrap(progress),
      distance: 0,
      signedDistance: lane,
    };
  }

  nearest(x: number, z: number): TrackPoint {
    let closest: TrackPoint = this.at(0);
    let best = Infinity;
    for (let i = 0; i < this.points.length - 1; i++) {
      const a = this.points[i],
        b = this.points[i + 1];
      const dx = b.x - a.x,
        dz = b.z - a.z;
      const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz), 0, 1);
      const px = a.x + dx * t,
        pz = a.z + dz * t;
      const squared = (x - px) ** 2 + (z - pz) ** 2;
      if (squared >= best) continue;
      best = squared;
      const length = Math.hypot(dx, dz);
      closest = {
        x: px,
        z: pz,
        heading: Math.atan2(dx, dz),
        progress: (this.lengths[i] + t * length) / this.length,
        distance: Math.sqrt(squared),
        signedDistance: ((x - px) * dz - (z - pz) * dx) / length,
      };
    }
    return closest;
  }

  constrain(car: Vehicle): void {
    const point = this.nearest(car.x, car.z);
    const limit = this.spec.width / 2 - 1.2;
    if (point.distance < limit) return;
    const sign = Math.sign(point.signedDistance) || 1;
    const nx = Math.cos(point.heading) * sign,
      nz = -Math.sin(point.heading) * sign;
    car.x = point.x + nx * limit;
    car.z = point.z + nz * limit;
    const outward = car.vx * nx + car.vz * nz;
    if (outward > 0) {
      car.vx -= nx * outward * 1.18;
      car.vz -= nz * outward * 1.18;
    }
  }

  ribbon(inner: number, outer: number, height: number, material: THREE.Material): THREE.Mesh {
    const positions: number[] = [],
      indices: number[] = [];
    const count = this.points.length - 1;
    for (let i = 0; i <= count; i++) {
      const p = this.at(i / count);
      for (const side of [inner, outer])
        positions.push(p.x + Math.cos(p.heading) * side, height, p.z - Math.sin(p.heading) * side);
      if (i < count) {
        const v = i * 2;
        indices.push(v, v + 2, v + 1, v + 1, v + 2, v + 3);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    return mesh;
  }
}
