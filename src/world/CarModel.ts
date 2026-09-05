import * as THREE from 'three';
import type { CarSpec } from '../data/catalog';
import type { Vehicle } from '../game/Vehicle';

function shell(
  bottomWidth: number,
  topWidth: number,
  bottomLength: number,
  topLength: number,
  height: number,
): THREE.BufferGeometry {
  const a = bottomWidth / 2,
    b = topWidth / 2,
    c = bottomLength / 2,
    d = topLength / 2;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [
        -a,
        0,
        -c,
        a,
        0,
        -c,
        a,
        0,
        c,
        -a,
        0,
        c,
        -b,
        height,
        -d,
        b,
        height,
        -d,
        b,
        height,
        d,
        -b,
        height,
        d,
      ],
      3,
    ),
  );
  geometry.setIndex([
    0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 6, 2, 6, 3, 3, 6, 7, 3, 7, 0, 0, 7, 4, 4, 7, 5, 5, 7, 6, 0, 1,
    3, 1, 2, 3,
  ]);
  geometry.computeVertexNormals();
  return geometry;
}

export class CarModel {
  readonly root = new THREE.Group();
  private readonly front: THREE.Group[] = [];
  private readonly wheels: THREE.Group[] = [];
  private readonly brakeMaterial = new THREE.MeshStandardMaterial({
    color: 0xfa4538,
    emissive: 0xff2d16,
    emissiveIntensity: 0.4,
  });

  constructor(spec: CarSpec) {
    const paint = new THREE.MeshStandardMaterial({
      color: spec.color,
      metalness: 0.45,
      roughness: 0.28,
    });
    const dark = new THREE.MeshStandardMaterial({ color: 0x151c22, roughness: 0.6 });
    const glass = new THREE.MeshStandardMaterial({
      color: 0x283d47,
      metalness: 0.55,
      roughness: 0.15,
    });
    const silver = new THREE.MeshStandardMaterial({
      color: 0xd1dadb,
      metalness: 0.8,
      roughness: 0.25,
    });
    const light = new THREE.MeshStandardMaterial({
      color: 0xfff3d3,
      emissive: 0xffefd5,
      emissiveIntensity: 1.5,
    });
    const sport = spec.body === 'sport',
      rally = spec.body === 'rally';
    const box = (
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      material: THREE.Material,
    ) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      this.root.add(mesh);
      return mesh;
    };
    const body = new THREE.Mesh(shell(1.92, 1.77, 4.25, sport ? 4.0 : 3.95, 0.53), paint);
    body.position.y = 0.45;
    body.castShadow = true;
    this.root.add(body);
    box(1.98, 0.15, 4.32, 0, 0.43, 0, dark);
    const cabin = new THREE.Mesh(
      shell(1.68, 1.35, rally ? 2.65 : 2.3, 1.48, sport ? 0.53 : 0.68),
      glass,
    );
    cabin.position.set(0, 0.97, -0.24);
    cabin.castShadow = true;
    this.root.add(cabin);
    box(1.38, 0.065, 1.5, 0, sport ? 1.53 : 1.68, -0.24, paint);
    box(0.105, 0.022, 1.17, -0.34, 0.997, 1.35, dark);
    box(0.105, 0.022, 1.17, 0.34, 0.997, 1.35, dark);
    for (const side of [-1, 1]) {
      box(0.52, 0.13, 0.06, side * 0.61, 0.79, 2.1, light);
      box(0.63, 0.11, 0.06, side * 0.57, 0.81, -2.1, this.brakeMaterial);
      box(0.24, 0.14, 0.3, side * 1.0, 1.13, 0.3, paint);
      box(0.05, 0.08, 0.26, side * 0.91, 1.0, -0.34, silver);
      for (const z of [-1.32, 1.3]) {
        const pivot = new THREE.Group();
        pivot.position.set(side * 0.98, 0.45, z);
        const wheel = new THREE.Group();
        pivot.add(wheel);
        const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.33, 16), dark);
        tire.rotation.z = Math.PI / 2;
        tire.castShadow = true;
        wheel.add(tire);
        const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.345, 12), silver);
        rim.rotation.z = Math.PI / 2;
        wheel.add(rim);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.355, 8), dark);
        hub.rotation.z = Math.PI / 2;
        wheel.add(hub);
        this.wheels.push(wheel);
        if (z > 0) this.front.push(pivot);
        this.root.add(pivot);
      }
    }
    box(1.2, 0.2, 0.045, 0, 0.58, 2.18, dark);
    box(0.5, 0.17, 0.05, 0, 0.69, -2.18, silver);
    if (sport || rally) {
      for (const x of [-0.65, 0.65]) box(0.08, 0.3, 0.12, x, 1.11, -1.8, dark);
      box(2.05, 0.1, 0.4, 0, 1.3, -1.82, sport ? dark : paint);
    }
    if (rally) {
      box(1.5, 0.1, 0.17, 0, 1.8, 0.13, dark);
      for (const x of [-0.48, -0.16, 0.16, 0.48]) box(0.23, 0.18, 0.16, x, 1.86, 0.14, light);
    }
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.3, 4.5),
      new THREE.MeshBasicMaterial({
        color: 0x101820,
        transparent: true,
        opacity: 0.15,
        depthWrite: false,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.035;
    this.root.add(shadow);
  }

  update(car: Vehicle, dt: number, braking = false): void {
    this.root.position.set(car.x, 0.07, car.z);
    this.root.rotation.y = car.heading;
    for (const wheel of this.wheels) wheel.rotation.x += (car.speed * dt) / 0.44;
    for (const wheel of this.front) wheel.rotation.y = car.steering * 0.38;
    this.brakeMaterial.emissiveIntensity = braking ? 3 : 0.4;
  }
}
