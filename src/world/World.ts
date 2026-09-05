import * as THREE from 'three';
import { randomSeed } from '../core/math';
import type { TrackSpec } from '../data/catalog';
import type { Vehicle } from '../game/Vehicle';
import { Track } from './Track';

export class World {
  readonly root = new THREE.Group();
  readonly track: Track;
  readonly obstacles: { x: number; z: number; radius: number }[] = [];

  constructor(spec: TrackSpec, barriers: boolean) {
    this.track = new Track(spec);
    const mat = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.95 });
    const ground = new THREE.Mesh(new THREE.CircleGeometry(360, 80), mat(spec.ground));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.06;
    ground.receiveShadow = true;
    this.root.add(ground);
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(2400, 2400),
      mat(spec.id === 'coast' ? 0x75a4aa : spec.ground),
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -0.4;
    this.root.add(sea);
    this.root.add(this.track.ribbon(-spec.width / 2, spec.width / 2, 0.01, mat(spec.road)));
    for (const sign of [-1, 1]) {
      this.root.add(
        this.track.ribbon(
          (sign * spec.width) / 2 - 0.13,
          (sign * spec.width) / 2 + 0.13,
          0.025,
          mat(0xe2e1ce),
        ),
      );
    }
    const white = mat(0xe5e4d4),
      red = mat(0xd07657),
      railMaterial = mat(0xadb8b3);
    const makeInstances = (
      geometry: THREE.BufferGeometry,
      material: THREE.Material,
      transforms: THREE.Matrix4[],
    ) => {
      const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
      transforms.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.root.add(mesh);
      return mesh;
    };
    const transform = new THREE.Object3D();
    const matrix = (x: number, y: number, z: number, heading = 0, sx = 1, sy = 1, sz = 1) => {
      transform.position.set(x, y, z);
      transform.rotation.set(0, heading, 0);
      transform.scale.set(sx, sy, sz);
      transform.updateMatrix();
      return transform.matrix.clone();
    };
    const markings: THREE.Matrix4[] = [],
      curbA: THREE.Matrix4[] = [],
      curbB: THREE.Matrix4[] = [],
      rails: THREE.Matrix4[] = [];
    const segments = Math.floor(this.track.length / 4);
    for (let i = 0; i < segments; i++) {
      const p = this.track.at(i / segments);
      if (i % 3 === 0) markings.push(matrix(p.x, 0.04, p.z, p.heading));
      for (const side of [-1, 1]) {
        const curb = this.track.at(i / segments, side * (spec.width / 2 + 0.38));
        (i % 2 ? curbA : curbB).push(matrix(curb.x, 0.035, curb.z, curb.heading));
        if (barriers) {
          const rail = this.track.at(i / segments, side * (spec.width / 2 + 0.95));
          rails.push(matrix(rail.x, 0.65, rail.z, rail.heading));
        }
      }
    }
    makeInstances(new THREE.BoxGeometry(0.17, 0.01, 3), white, markings);
    makeInstances(new THREE.BoxGeometry(0.6, 0.055, 4.02), white, curbA);
    makeInstances(new THREE.BoxGeometry(0.6, 0.055, 4.02), red, curbB);
    if (barriers) makeInstances(new THREE.BoxGeometry(0.17, 0.48, 4.05), railMaterial, rails);
    const start = this.track.at(0);
    const banner = new THREE.Group();
    banner.position.set(start.x, 0, start.z);
    banner.rotation.y = start.heading;
    for (let row = 0; row < 2; row++)
      for (let col = 0; col < 16; col++) {
        const square = new THREE.Mesh(
          new THREE.BoxGeometry(spec.width / 16, 0.025, 0.7),
          (row + col) % 2 ? mat(0x202a2c) : white,
        );
        square.position.set(-spec.width / 2 + ((col + 0.5) * spec.width) / 16, 0.048, row * 0.7);
        banner.add(square);
      }
    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.35, 6.5, 0.4), mat(0x293e3d));
      pillar.position.set(side * (spec.width / 2 + 1.5), 3.25, 0);
      banner.add(pillar);
    }
    const bridge = new THREE.Mesh(
      new THREE.BoxGeometry(spec.width + 3.4, 1.0, 0.45),
      mat(0x243b37),
    );
    bridge.position.y = 6.35;
    banner.add(bridge);
    const accent = new THREE.Mesh(new THREE.BoxGeometry(spec.width + 3.4, 0.1, 0.5), mat(0xdfff71));
    accent.position.y = 5.82;
    banner.add(accent);
    this.root.add(banner);

    const random = randomSeed(spec.seed),
      trunks: THREE.Matrix4[] = [],
      crowns: THREE.Matrix4[] = [],
      rocks: THREE.Matrix4[] = [];
    for (let i = 0; i < (spec.id === 'forest' ? 470 : 260); i++) {
      const x = (random() - 0.5) * 640,
        z = (random() - 0.5) * 640;
      if (Math.hypot(x, z) > 330 || this.track.nearest(x, z).distance < spec.width / 2 + 10)
        continue;
      const size = 0.8 + random() * 1.5;
      if (spec.id === 'canyon' && i % 3 !== 0) {
        rocks.push(matrix(x, size * 2.1, z, random() * 6, size * 3.8, size * 4.4, size * 3));
        this.obstacles.push({ x, z, radius: size * 2.8 });
      } else {
        trunks.push(matrix(x, size * 1.5, z, 0, size, size, size));
        crowns.push(matrix(x, size * 4.4, z, random() * 6, size, size, size));
        this.obstacles.push({ x, z, radius: size * 0.5 });
      }
    }
    makeInstances(new THREE.CylinderGeometry(0.3, 0.48, 3, 6), mat(0x65544a), trunks);
    makeInstances(new THREE.ConeGeometry(2.5, 6.8, 7), mat(spec.foliage), crowns);
    if (rocks.length) makeInstances(new THREE.DodecahedronGeometry(1, 0), mat(0x9a7157), rocks);
    const mountains: THREE.Matrix4[] = [];
    for (let i = 0; i < 28; i++) {
      const angle = (i / 28) * Math.PI * 2;
      if (spec.id === 'coast' && i > 12 && i < 24) continue;
      const height = 45 + random() * 65;
      mountains.push(
        matrix(
          Math.cos(angle) * 510,
          height * 0.34 - 4,
          Math.sin(angle) * 510,
          random() * 6,
          65 + random() * 75,
          height,
          60 + random() * 65,
        ),
      );
    }
    makeInstances(
      new THREE.ConeGeometry(1, 1, 5),
      mat(spec.id === 'canyon' ? 0xa68166 : 0x7a9290),
      mountains,
    );
  }

  collideScenery(car: Vehicle): void {
    for (const object of this.obstacles) {
      const dx = car.x - object.x,
        dz = car.z - object.z;
      const distance = Math.hypot(dx, dz),
        radius = object.radius + 1.2;
      if (distance >= radius) continue;
      const nx = distance > 0.001 ? dx / distance : 1,
        nz = distance > 0.001 ? dz / distance : 0;
      car.x = object.x + nx * radius;
      car.z = object.z + nz * radius;
      const approach = car.vx * nx + car.vz * nz;
      if (approach < 0) {
        car.vx -= nx * approach * 1.15;
        car.vz -= nz * approach * 1.15;
      }
    }
    if (Math.hypot(car.x, car.z) > 345) {
      const heading = Math.atan2(car.x, car.z);
      car.x = Math.sin(heading) * 345;
      car.z = Math.cos(heading) * 345;
      car.vx *= 0.8;
      car.vz *= 0.8;
    }
  }
}
