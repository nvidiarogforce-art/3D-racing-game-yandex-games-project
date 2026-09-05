import * as THREE from 'three';
import { randomSeed } from '../core/math';
import type { TrackSpec } from '../data/catalog';
import { Vehicle } from '../game/Vehicle';
import { Track } from './Track';

export class World {
  readonly root = new THREE.Group();
  readonly track: Track;
  readonly obstacles: { x: number; z: number; radius: number }[] = [];
  readonly traffic: {
    vehicle: Vehicle;
    model: THREE.Group;
    axis: 'x' | 'z';
    direction: 1 | -1;
    lane: number;
    speed: number;
  }[] = [];
  // A dense, bounded 840 m × 840 m city keeps the world readable and performant.
  readonly cityHalf = 420;

  constructor(spec: TrackSpec, barriers: boolean) {
    this.track = new Track(spec);
    const mat = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.95 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1500, 1500), mat(spec.ground));
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

    this.buildCity(spec, barriers, mat, makeInstances, matrix);

    const random = randomSeed(spec.seed),
      trunks: THREE.Matrix4[] = [],
      crowns: THREE.Matrix4[] = [],
      rocks: THREE.Matrix4[] = [];
    for (let i = 0; i < (spec.id === 'forest' ? 470 : 260); i++) {
      const x = (random() - 0.5) * 640,
        z = (random() - 0.5) * 640;
      if (
        Math.max(Math.abs(x), Math.abs(z)) < this.cityHalf + 35 ||
        Math.hypot(x, z) > 690 ||
        this.track.nearest(x, z).distance < spec.width / 2 + 10
      )
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
    const cityLimit = this.cityHalf + 85;
    if (Math.max(Math.abs(car.x), Math.abs(car.z)) > cityLimit) {
      const heading = Math.atan2(car.x, car.z);
      const scale =
        cityLimit / Math.max(Math.abs(Math.sin(heading)), Math.abs(Math.cos(heading)), 0.001);
      car.x = Math.sin(heading) * scale;
      car.z = Math.cos(heading) * scale;
      car.vx *= 0.8;
      car.vz *= 0.8;
    }
  }

  private buildCity(
    spec: TrackSpec,
    raceMode: boolean,
    mat: (color: number) => THREE.MeshStandardMaterial,
    makeInstances: (
      geometry: THREE.BufferGeometry,
      material: THREE.Material,
      transforms: THREE.Matrix4[],
    ) => THREE.InstancedMesh,
    matrix: (
      x: number,
      y: number,
      z: number,
      heading?: number,
      sx?: number,
      sy?: number,
      sz?: number,
    ) => THREE.Matrix4,
  ): void {
    const road = mat(spec.id === 'canyon' ? 0x403b39 : 0x2e3b3d);
    const lane = mat(0xd6cda8);
    const sidewalk = mat(0x89928e);
    const citySize = this.cityHalf * 2 + 80;
    const cityGrid = 105;
    const roadWidth = 15;
    const roadDashesX: THREE.Matrix4[] = [],
      roadDashesZ: THREE.Matrix4[] = [];
    for (let line = -this.cityHalf; line <= this.cityHalf; line += cityGrid) {
      const horizontal = new THREE.Mesh(new THREE.BoxGeometry(citySize, 0.04, roadWidth), road);
      horizontal.position.set(0, 0.005, line);
      horizontal.receiveShadow = true;
      this.root.add(horizontal);
      const vertical = new THREE.Mesh(new THREE.BoxGeometry(roadWidth, 0.04, citySize), road);
      vertical.position.set(line, 0.006, 0);
      vertical.receiveShadow = true;
      this.root.add(vertical);
      for (let segment = -this.cityHalf; segment < this.cityHalf; segment += 18) {
        roadDashesX.push(matrix(segment + 4, 0.03, line));
        roadDashesZ.push(matrix(line, 0.03, segment + 4, Math.PI / 2));
      }
      for (const side of [-1, 1]) {
        const horizontalSidewalk = new THREE.Mesh(
          new THREE.BoxGeometry(citySize, 0.1, 1.7),
          sidewalk,
        );
        horizontalSidewalk.position.set(0, 0.045, line + side * (roadWidth / 2 + 0.9));
        this.root.add(horizontalSidewalk);
        const verticalSidewalk = new THREE.Mesh(
          new THREE.BoxGeometry(1.7, 0.1, citySize),
          sidewalk,
        );
        verticalSidewalk.position.set(line + side * (roadWidth / 2 + 0.9), 0.045, 0);
        this.root.add(verticalSidewalk);
      }
    }
    makeInstances(new THREE.BoxGeometry(8, 0.045, 0.13), lane, roadDashesX);
    makeInstances(new THREE.BoxGeometry(8, 0.045, 0.13), lane, roadDashesZ);

    const random = randomSeed(spec.seed * 17 + 5);
    const buildingColors = [0x647878, 0x7f7269, 0x536b73, 0xa18b74, 0x465c5f, 0x8c8b7a];
    const buildingTransforms = buildingColors.map(() => [] as THREE.Matrix4[]);
    const roofTransforms: THREE.Matrix4[] = [];
    for (let x = -this.cityHalf + 18; x < this.cityHalf - 18; x += cityGrid) {
      for (let z = -this.cityHalf + 18; z < this.cityHalf - 18; z += cityGrid) {
        // Leave a broad mixed-use central boulevard and the race route readable.
        const blockDistance = Math.hypot(x, z);
        if (blockDistance < 105 && spec.id === 'coast') continue;
        const count = 2 + Math.floor(random() * 3);
        for (let i = 0; i < count; i++) {
          const width = 14 + random() * 19,
            depth = 14 + random() * 20;
          const bx = x + (random() - 0.5) * 54,
            bz = z + (random() - 0.5) * 54;
          if (this.track.nearest(bx, bz).distance < spec.width / 2 + 16) continue;
          const height = 9 + random() * (blockDistance < 300 ? 42 : 24);
          const colorIndex = Math.floor(random() * buildingColors.length);
          buildingTransforms[colorIndex].push(
            matrix(
              bx,
              height / 2,
              bz,
              (Math.round(random() * 3) * Math.PI) / 2,
              width,
              height,
              depth,
            ),
          );
          roofTransforms.push(matrix(bx, height + 0.3, bz, 0, width * 0.93, 0.6, depth * 0.93));
          this.obstacles.push({ x: bx, z: bz, radius: Math.max(width, depth) * 0.48 });
        }
      }
    }
    buildingTransforms.forEach((transforms, index) =>
      makeInstances(new THREE.BoxGeometry(1, 1, 1), mat(buildingColors[index]), transforms),
    );
    makeInstances(new THREE.BoxGeometry(1, 1, 1), mat(0x263b3c), roofTransforms);
    this.addCityLandmarks(spec, mat, matrix);
    if (!raceMode) this.addTraffic(spec, mat);
  }

  private addCityLandmarks(
    spec: TrackSpec,
    mat: (color: number) => THREE.MeshStandardMaterial,
    matrix: (
      x: number,
      y: number,
      z: number,
      heading?: number,
      sx?: number,
      sy?: number,
      sz?: number,
    ) => THREE.Matrix4,
  ): void {
    const tower = new THREE.Group();
    tower.position.set(-205, 0, -180);
    const towerBody = new THREE.Mesh(
      new THREE.BoxGeometry(34, 150, 34),
      mat(spec.id === 'canyon' ? 0x8a6659 : 0x45666a),
    );
    towerBody.position.y = 75;
    towerBody.castShadow = true;
    tower.add(towerBody);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 55, 8), mat(0xdfff71));
    antenna.position.y = 177;
    tower.add(antenna);
    this.root.add(tower);
    for (let floor = 0; floor < 12; floor++) {
      const light = new THREE.Mesh(new THREE.BoxGeometry(24, 1.8, 1), mat(0xdfff71));
      light.position.set(-205, 12 + floor * 11, -162.5);
      this.root.add(light);
    }
    const plaza = new THREE.Mesh(new THREE.BoxGeometry(120, 0.08, 90), mat(0x71827a));
    plaza.position.set(140, 0.06, 145);
    this.root.add(plaza);
    const fountain = new THREE.Mesh(new THREE.CylinderGeometry(16, 16, 0.8, 24), mat(0x789da2));
    fountain.position.set(140, 0.45, 145);
    this.root.add(fountain);
    const trees: THREE.Matrix4[] = [];
    for (let i = 0; i < 22; i++)
      trees.push(
        matrix(95 + (i % 6) * 18, 3.4, 112 + Math.floor(i / 6) * 22, i * 0.4, 1.2, 1.2, 1.2),
      );
    const treeMesh = new THREE.InstancedMesh(
      new THREE.ConeGeometry(2.4, 7, 7),
      mat(0x2d5c50),
      trees.length,
    );
    trees.forEach((transform, index) => treeMesh.setMatrixAt(index, transform));
    treeMesh.castShadow = true;
    this.root.add(treeMesh);
  }

  private addTraffic(spec: TrackSpec, mat: (color: number) => THREE.MeshStandardMaterial): void {
    const colors = [0xe45b45, 0x5e8dc9, 0xf0ca67, 0x879b8b, 0xb56e9a, 0xe8e8dd];
    const random = randomSeed(spec.seed * 31 + 9);
    for (let i = 0; i < 28; i++) {
      const axis: 'x' | 'z' = i % 2 === 0 ? 'x' : 'z';
      const direction: 1 | -1 = random() > 0.5 ? 1 : -1;
      const road = -this.cityHalf + 52.5 + Math.floor(random() * 8) * 105;
      const lane = direction === 1 ? -3.4 : 3.4;
      const vehicle = new Vehicle({
        ...{
          id: 'traffic',
          name: 'Traffic',
          kind: 'NPC',
          color: colors[i % colors.length],
          maxSpeed: 20,
          acceleration: 0,
          grip: 10,
          steering: 0.1,
          body: 'coupe',
        },
      });
      vehicle.reset(
        axis === 'x' ? (random() - 0.5) * this.cityHalf * 2 : road + lane,
        axis === 'z' ? (random() - 0.5) * this.cityHalf * 2 : road + lane,
        axis === 'x'
          ? direction === 1
            ? 0
            : Math.PI
          : direction === 1
            ? Math.PI / 2
            : -Math.PI / 2,
      );
      const model = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(2.1, 0.55, 4),
        mat(colors[i % colors.length]),
      );
      body.position.y = 0.42;
      body.castShadow = true;
      model.add(body);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.48, 1.75), mat(0x253b42));
      cabin.position.set(0, 0.85, -0.25);
      cabin.castShadow = true;
      model.add(cabin);
      model.position.set(vehicle.x, 0, vehicle.z);
      model.rotation.y = vehicle.heading;
      this.root.add(model);
      this.traffic.push({ vehicle, model, axis, direction, lane, speed: 12 + random() * 8 });
    }
  }

  updateTraffic(dt: number): void {
    for (const npc of this.traffic) {
      if (npc.axis === 'x') {
        npc.vehicle.x += npc.direction * npc.speed * dt;
        if (npc.vehicle.x > this.cityHalf + 20) npc.vehicle.x = -this.cityHalf - 20;
        if (npc.vehicle.x < -this.cityHalf - 20) npc.vehicle.x = this.cityHalf + 20;
        npc.vehicle.z = Math.round(npc.vehicle.z / 105) * 105 + npc.lane;
        npc.vehicle.heading = npc.direction === 1 ? Math.PI / 2 : -Math.PI / 2;
        npc.vehicle.vx = npc.direction * npc.speed;
        npc.vehicle.vz = 0;
      } else {
        npc.vehicle.z += npc.direction * npc.speed * dt;
        if (npc.vehicle.z > this.cityHalf + 20) npc.vehicle.z = -this.cityHalf - 20;
        if (npc.vehicle.z < -this.cityHalf - 20) npc.vehicle.z = this.cityHalf + 20;
        npc.vehicle.x = Math.round(npc.vehicle.x / 105) * 105 + npc.lane;
        npc.vehicle.heading = npc.direction === 1 ? 0 : Math.PI;
        npc.vehicle.vx = 0;
        npc.vehicle.vz = npc.direction * npc.speed;
      }
      npc.model.position.set(npc.vehicle.x, 0, npc.vehicle.z);
      npc.model.rotation.y = npc.vehicle.heading;
    }
  }

  collideTraffic(car: Vehicle): void {
    for (const npc of this.traffic) {
      const dx = car.x - npc.vehicle.x,
        dz = car.z - npc.vehicle.z,
        distance = Math.hypot(dx, dz);
      if (distance >= 3) continue;
      const nx = distance > 0.01 ? dx / distance : 1,
        nz = distance > 0.01 ? dz / distance : 0;
      car.x = npc.vehicle.x + nx * 3;
      car.z = npc.vehicle.z + nz * 3;
      const approach = car.vx * nx + car.vz * nz;
      if (approach < 0) {
        car.vx -= nx * approach * 1.1;
        car.vz -= nz * approach * 1.1;
      }
    }
  }
}
