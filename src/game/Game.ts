import * as THREE from 'three';
import { Input } from '../core/Input';
import { EngineAudio } from '../core/Audio';
import { Storage } from '../core/Storage';
import { clamp, formatTime } from '../core/math';
import { CARS, TRACKS, type GameConfig } from '../data/catalog';
import { YandexPlatform } from '../platform/Yandex';
import { UI } from '../ui/UI';
import { CarModel } from '../world/CarModel';
import { World } from '../world/World';
import { driveAI } from './DriverAI';
import { RaceProgress } from './RaceProgress';
import { Vehicle, collideVehicles, type Controls } from './Vehicle';

type State = 'menu' | 'countdown' | 'running' | 'paused' | 'finished';
const STEP = 1 / 120;

function disposeGroup(root: THREE.Group): void {
  const geometries = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>();
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      geometries.add(object.geometry);
      (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) =>
        materials.add(material),
      );
      if (object instanceof THREE.InstancedMesh) object.dispose();
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  root.removeFromParent();
}

export class Game {
  private readonly ui: UI;
  private readonly input: Input;
  private readonly audio = new EngineAudio();
  private readonly storage = new Storage();
  private readonly platform = new YandexPlatform();
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(54, 1, 0.1, 1200);
  private readonly sunlight = new THREE.DirectionalLight(0xffebce, 3.0);
  private readonly lookAt = new THREE.Vector3();
  private readonly desiredCamera = new THREE.Vector3();
  private readonly desiredLook = new THREE.Vector3();
  private readonly abort = new AbortController();
  private config: GameConfig = {
    car: CARS[0],
    track: TRACKS[0],
    mode: 'race',
    laps: 3,
    quality: 'high',
  };
  private world!: World;
  private cars: Vehicle[] = [];
  private models: CarModel[] = [];
  private progress: RaceProgress[] = [];
  private stuckTimers: number[] = [];
  private state: State = 'menu';
  private beforePause: 'countdown' | 'running' = 'running';
  private pauseReasons = new Set<string>();
  private elapsed = 0;
  private countdownTime = 3;
  private lastFrame = 0;
  private accumulator = 0;
  private uiAccumulator = 0;
  private previewTime = 0;
  private cameraMode = 0;
  private toastTimer?: ReturnType<typeof setTimeout>;
  private ready = false;
  private platformPaused = false;

  constructor(root: HTMLElement) {
    this.ui = new UI(root, (action, value) => {
      void this.action(action, value);
    });
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.ui.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.add(new THREE.HemisphereLight(0xd9eeee, 0x495440, 2.3));
    this.sunlight.castShadow = true;
    this.sunlight.shadow.mapSize.set(2048, 2048);
    this.sunlight.shadow.camera.left = -65;
    this.sunlight.shadow.camera.right = 65;
    this.sunlight.shadow.camera.top = 65;
    this.sunlight.shadow.camera.bottom = -65;
    this.sunlight.shadow.camera.near = 1;
    this.sunlight.shadow.camera.far = 220;
    this.sunlight.shadow.normalBias = 0.05;
    this.sunlight.shadow.bias = -0.0002;
    this.scene.add(this.sunlight, this.sunlight.target);
    this.input = new Input((action) => {
      void this.action(action);
    });
    this.loadWorld();
    const options = { signal: this.abort.signal };
    window.addEventListener('resize', () => this.resize(), options);
    window.addEventListener('blur', () => this.pause('focus'), options);
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden) this.pause('visibility');
      },
      options,
    );
    this.ui.canvas.addEventListener(
      'webglcontextlost',
      (event) => {
        event.preventDefault();
        this.pause('graphics');
        this.toast('Graphics context lost. Reload the page to restore the game.');
      },
      options,
    );
    this.resize();
  }

  async init(): Promise<void> {
    this.renderer.render(this.scene, this.camera);
    await this.platform.init();
    this.platform.onPauseResume(
      () => {
        this.platformPaused = true;
        this.pause('platform');
      },
      () => {
        this.platformPaused = false;
        this.resume('platform');
      },
    );
    this.ready = true;
    this.ui.show('menu');
    this.renderer.setAnimationLoop((time) => this.frame(time));
    // Wait for the usable menu and the first rendered scene before Game Ready.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    this.platform.ready();
  }

  private loadWorld(): void {
    if (this.world) disposeGroup(this.world.root);
    this.models.forEach((model) => disposeGroup(model.root));
    this.models = [];
    this.cars = [];
    this.world = new World(this.config.track, this.config.mode === 'race');
    this.scene.add(this.world.root);
    this.scene.background = new THREE.Color(this.config.track.sky);
    this.scene.fog = new THREE.Fog(this.config.track.sky, 170, 780);
    const specs =
      this.config.mode === 'race'
        ? [this.config.car, CARS[1], CARS[2], CARS[0]]
        : [this.config.car];
    this.progress = specs.map(
      () => new RaceProgress(this.config.mode === 'race' ? this.config.laps : Infinity),
    );
    this.stuckTimers = specs.map(() => 0);
    specs.forEach((spec, index) => {
      const vehicle = new Vehicle(spec);
      const point = this.world.track.at(0.004 + index * 0.009, index % 2 ? -2.1 : 2.1);
      vehicle.reset(point.x, point.z, point.heading);
      this.cars.push(vehicle);
      const model = new CarModel(index === 3 ? { ...spec, color: 0xf4f0df } : spec);
      model.update(vehicle, 0);
      this.models.push(model);
      this.scene.add(model.root);
      this.progress[index].resetPosition(point.progress);
    });
    this.ui.configure(this.config);
    this.ui.setMap(this.world.track);
    this.elapsed = 0;
    this.accumulator = 0;
    this.updateCamera(1, true);
    this.updateHUD();
  }

  private async action(action: string, value?: string): Promise<void> {
    if (!this.ready) return;
    if (action === 'audio') {
      try {
        await this.audio.toggle();
        this.ui.get('audio').textContent = this.audio.muted ? 'SOUND OFF' : 'SOUND ON';
        this.ui
          .get('audio')
          .setAttribute(
            'aria-label',
            this.audio.muted ? 'Turn engine sound on' : 'Turn engine sound off',
          );
      } catch {
        this.toast('Audio is unavailable in this browser. Driving still works.');
      }
      return;
    }
    if (action === 'home') {
      this.state = 'menu';
      this.pauseReasons.clear();
      this.input.enabled = false;
      this.input.clear();
      this.platform.setPlaying(false);
      this.ui.show('menu');
      this.loadWorld();
      return;
    }
    if (this.state === 'menu') {
      if (action === 'start') {
        this.start();
        return;
      }
      if (action === 'car') this.config.car = CARS[clamp(Number(value) || 0, 0, CARS.length - 1)];
      else if (action === 'track')
        this.config.track = TRACKS[clamp(Number(value) || 0, 0, TRACKS.length - 1)];
      else if (action === 'mode') this.config.mode = value === 'free' ? 'free' : 'race';
      else if (action === 'laps') this.config.laps = value === '5' ? 5 : 3;
      else if (action === 'quality') {
        this.config.quality = value === 'low' ? 'low' : 'high';
        this.resize();
      } else return;
      this.loadWorld();
      return;
    }
    if (action === 'pause') {
      if (this.state === 'paused') this.resume('user');
      else this.pause('manual');
    } else if (action === 'resume') this.resume('user');
    else if (action === 'restart') this.start();
    else if (action === 'camera') {
      this.cameraMode = (this.cameraMode + 1) % 3;
      this.toast(['Chase camera', 'Wide camera', 'Hood camera'][this.cameraMode]);
    } else if (action === 'reset' && this.state === 'running') {
      this.resetCar(0);
      this.toast('Back on the road.');
    }
  }

  private start(): void {
    if (this.platformPaused || this.pauseReasons.has('graphics')) return;
    this.platform.setPlaying(false);
    this.state = this.config.mode === 'race' ? 'countdown' : 'running';
    this.pauseReasons.clear();
    this.countdownTime = 3;
    this.lastFrame = 0;
    this.loadWorld();
    this.input.clear();
    this.input.enabled = true;
    this.ui.show('game');
    if (this.state === 'countdown') {
      // Make the countdown observable immediately, even before the first animation frame.
      // This keeps input and UI in sync on slower WebGL devices.
      this.ui.countdown.classList.remove('hidden');
      this.ui.countdown.textContent = '3';
    }
    this.updateCamera(1, true);
    this.platform.setPlaying(this.state === 'running');
  }

  private pause(reason: string): void {
    if (this.state === 'menu' || this.state === 'finished') return;
    this.pauseReasons.add(reason);
    if (this.state !== 'paused') {
      this.beforePause = this.state;
      this.state = 'paused';
      this.input.clear();
      this.platform.setPlaying(false);
      this.audio.update(0, false);
      // Freeze the displayed clock at the same instant as the simulation.
      this.updateHUD();
      this.ui.show('paused');
    }
  }

  private resume(reason: string): void {
    if (this.state !== 'paused') return;
    if (reason === 'user') {
      if (document.hidden) return;
      ['manual', 'focus', 'visibility'].forEach((item) => this.pauseReasons.delete(item));
    } else this.pauseReasons.delete(reason);
    if (this.pauseReasons.size) {
      this.toast('Waiting for the platform or graphics to resume.');
      return;
    }
    this.state = this.beforePause;
    this.input.clear();
    this.lastFrame = 0;
    this.accumulator = 0;
    this.ui.show('game');
    this.platform.setPlaying(this.state === 'running');
  }

  private resetCar(index: number): void {
    const car = this.cars[index],
      progress = this.progress[index];
    const p =
      this.config.mode === 'race'
        ? (progress.nextGate - 1) / 12 + 0.002
        : this.world.track.nearest(car.x, car.z).progress;
    const point = this.world.track.at(p, index % 2 ? -2 : 2);
    car.reset(point.x, point.z, point.heading);
    progress.resetPosition(point.progress);
    if (index === 0) this.updateCamera(1, true);
  }

  private frame(time: number): void {
    const rawDt = this.lastFrame ? Math.max(0, (time - this.lastFrame) / 1000) : 0;
    const dt = clamp(rawDt, 0, 0.1);
    this.lastFrame = time;
    if (this.state === 'menu') this.previewTime += dt;
    if (this.state === 'countdown') {
      // Count down in wall-clock time while keeping the physics step capped for stability.
      this.countdownTime -= Math.min(rawDt, 0.5);
      this.ui.countdown.classList.remove('hidden');
      this.ui.countdown.textContent = String(Math.max(1, Math.ceil(this.countdownTime)));
      if (this.countdownTime <= 0) {
        this.state = 'running';
        this.ui.countdown.classList.add('hidden');
        this.platform.setPlaying(true);
        this.toast('Find your line.');
      }
    }
    if (this.state === 'running') {
      this.accumulator += dt;
      while (this.accumulator >= STEP && this.state === 'running') {
        this.step(STEP);
        this.accumulator -= STEP;
      }
    } else this.accumulator = 0;
    this.models.forEach((model, index) =>
      model.update(
        this.cars[index],
        this.state === 'running' ? dt : 0,
        index === 0 && this.input.read().brake > 0,
      ),
    );
    this.models[0].root.visible = this.cameraMode !== 2 || this.state === 'menu';
    this.updateCamera(dt);
    this.audio.update(this.cars[0].speed, this.state === 'running');
    this.uiAccumulator += dt;
    if (this.uiAccumulator > 0.08) {
      this.updateHUD();
      this.uiAccumulator = 0;
    }
    if (!document.hidden) this.renderer.render(this.scene, this.camera);
  }

  private step(dt: number): void {
    this.elapsed += dt;
    this.world.updateTraffic(dt);
    this.cars.forEach((car, index) => {
      const point = this.world.track.nearest(car.x, car.z);
      const controls: Controls =
        index === 0
          ? this.input.read()
          : driveAI(car, this.world.track, this.cars, index % 2 ? -2 : 2);
      car.step(controls, dt, point.distance > this.config.track.width / 2);
      if (this.config.mode === 'race') this.world.track.constrain(car);
      else this.world.collideScenery(car);
      if (index > 0) {
        this.stuckTimers[index] = Math.abs(car.speed) < 1.5 ? this.stuckTimers[index] + dt : 0;
        if (this.stuckTimers[index] > 6) {
          this.resetCar(index);
          this.stuckTimers[index] = 0;
        }
      }
    });
    this.world.collideTraffic(this.cars[0]);
    for (let i = 0; i < this.cars.length; i++)
      for (let j = i + 1; j < this.cars.length; j++) collideVehicles(this.cars[i], this.cars[j]);
    this.cars.forEach((car, index) => {
      const point = this.world.track.nearest(car.x, car.z);
      if (
        this.progress[index].update(
          point.progress,
          this.elapsed,
          point.distance < this.config.track.width / 2 + 1,
        )
      ) {
        if (index === 0) {
          const progress = this.progress[0];
          this.storage.save(
            this.config.track.id,
            this.config.car.id,
            this.config.mode,
            progress.lastLap,
          );
          this.toast(`Lap ${progress.completedLaps} · ${formatTime(progress.lastLap)}`);
          if (this.config.mode === 'race' && progress.finished) {
            this.state = 'finished';
            this.input.clear();
            this.input.enabled = false;
            this.platform.setPlaying(false);
            this.ui.show('finished');
            this.ui.get('modal-text').textContent =
              `Position ${this.position()} of 4 · Total ${formatTime(this.elapsed)} · Best lap ${formatTime(progress.bestLap)}`;
          }
        }
      }
    });
  }

  private position(): number {
    const player = this.progress[0];
    return (
      1 +
      this.progress
        .slice(1)
        .filter((progress) =>
          progress.finished
            ? progress.finishedAt < player.finishedAt
            : progress.score > player.score,
        ).length
    );
  }

  private updateHUD(): void {
    const car = this.cars[0];
    this.ui.update(
      car.speed,
      this.elapsed,
      this.progress[0].completedLaps + 1,
      this.position(),
      this.config,
      this.storage.get(this.config.track.id, this.config.car.id, this.config.mode),
      this.world.track.nearest(car.x, car.z).distance > this.config.track.width / 2,
    );
    this.ui.drawMap(this.cars);
  }

  private updateCamera(dt: number, snap = false): void {
    const car = this.cars[0],
      forwardX = Math.sin(car.heading),
      forwardZ = Math.cos(car.heading);
    if (this.state === 'menu') {
      const angle = car.heading + 0.92 + Math.sin(this.previewTime * 0.12) * 0.13;
      this.desiredCamera.set(car.x + Math.sin(angle) * 9.5, 4.5, car.z + Math.cos(angle) * 9.5);
      this.desiredLook.set(car.x - Math.cos(angle) * 2.0, 0.95, car.z + Math.sin(angle) * 2.0);
    } else if (this.cameraMode === 2) {
      this.desiredCamera.set(car.x + forwardX * 1.15, 1.6, car.z + forwardZ * 1.15);
      this.desiredLook.set(car.x + forwardX * 30, 1.3, car.z + forwardZ * 30);
    } else {
      const distance = (this.cameraMode === 1 ? 17 : 10) + Math.abs(car.speed) * 0.055;
      this.desiredCamera.set(
        car.x - forwardX * distance,
        this.cameraMode === 1 ? 9.5 : 5,
        car.z - forwardZ * distance,
      );
      this.desiredLook.set(car.x + forwardX * 5, 1.0, car.z + forwardZ * 5);
    }
    const blend =
      snap || (this.cameraMode === 2 && this.state !== 'menu') ? 1 : 1 - Math.exp(-6 * dt);
    this.camera.position.lerp(this.desiredCamera, blend);
    this.lookAt.lerp(this.desiredLook, blend);
    this.camera.lookAt(this.lookAt);
    this.sunlight.position.set(car.x + 55, 90, car.z + 35);
    this.sunlight.target.position.set(car.x, 0, car.z);
  }

  private resize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, this.config.quality === 'low' ? 1 : 1.75),
    );
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = this.config.quality === 'high';
    this.renderer.shadowMap.needsUpdate = true;
  }

  private toast(message: string): void {
    clearTimeout(this.toastTimer);
    const toast = this.ui.get('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    this.toastTimer = setTimeout(() => toast.classList.add('hidden'), 3000);
  }

  dispose(): void {
    this.renderer.setAnimationLoop(null);
    this.platform.dispose();
    this.input.dispose();
    this.audio.dispose();
    this.abort.abort();
    clearTimeout(this.toastTimer);
    disposeGroup(this.world.root);
    this.models.forEach((model) => disposeGroup(model.root));
    this.sunlight.shadow.dispose();
    this.renderer.dispose();
  }
}
