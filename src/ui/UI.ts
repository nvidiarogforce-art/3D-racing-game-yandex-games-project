import { CARS, TRACKS, type GameConfig } from '../data/catalog';
import { formatTime } from '../core/math';
import type { Track } from '../world/Track';
import type { Vehicle } from '../game/Vehicle';

const arrow = '<span aria-hidden="true">↗</span>';

export class UI {
  readonly canvas: HTMLCanvasElement;
  readonly menu: HTMLElement;
  readonly hud: HTMLElement;
  readonly overlay: HTMLElement;
  readonly countdown: HTMLElement;
  private map: HTMLCanvasElement;
  private mapBackground = document.createElement('canvas');
  private mapBounds = { x: 0, z: 0, scale: 1 };
  private elements = new Map<string, HTMLElement>();

  constructor(root: HTMLElement, onAction: (action: string, value?: string) => void) {
    root.innerHTML = `
      <canvas id="scene" aria-label="3D racing environment"></canvas>
      <div class="vignette"></div>
      <header class="topbar">
        <a class="brand" href="#" aria-label="Apex Horizon home" data-action="home"><span class="brand-symbol">Λ</span><span>APEX<span class="brand-light"> / HORIZON</span></span></a>
        <div class="top-actions"><span class="edition">A DRIVING PLAYGROUND</span><button class="icon-button" data-action="audio" id="audio" aria-label="Turn engine sound on" title="Toggle engine sound">SOUND OFF</button></div>
      </header>
      <main id="menu" class="menu">
        <section class="intro"><div class="eyebrow"><span class="live-dot"></span> TAKE THE SCENIC ROUTE</div>
          <h1>Drive your<br>own <em>line.</em></h1>
          <p>Past the last turn. Beyond the finish line.<br>A little freedom, at full throttle.</p>
          <div class="location"><span class="location-cross">+</span><span id="region">01 / PACIFIC COAST</span></div>
        </section>
        <section class="setup" aria-label="Drive setup">
          <div class="setup-heading"><span class="section-label">01 &nbsp; CHOOSE YOUR MACHINE</span><span class="small-note">ALL KEYS ARE YOURS</span></div>
          <div class="cars">${CARS.map((car, index) => `<button class="car-card ${index === 0 ? 'selected' : ''}" data-action="car" data-value="${index}" aria-pressed="${index === 0}"><span class="car-type">${car.kind}</span><span class="car-name"><i style="background:#${car.color.toString(16)}"></i>${car.name}<span class="car-index">0${index + 1}</span></span><span class="car-stat">${Math.round(car.maxSpeed * 3.6)} KM/H <span>•</span> ${car.body.toUpperCase()}</span></button>`).join('')}</div>
          <div class="drive-options">
            <label class="field track-field"><span class="section-label">02 &nbsp; YOUR DESTINATION</span><select id="track-select" data-setting="track" aria-label="Track">${TRACKS.map((track, index) => `<option value="${index}">${track.name}</option>`).join('')}</select></label>
            <div class="field mode-field"><span class="section-label">03 &nbsp; SET YOUR PACE</span><div class="segmented"><button class="selected" data-action="mode" data-value="race" aria-pressed="true">Circuit race</button><button data-action="mode" data-value="free" aria-pressed="false">Free drive</button></div></div>
            <label class="field compact-field"><span class="section-label">LAPS</span><select id="laps-select" data-setting="laps" aria-label="Race laps"><option value="3">3 laps</option><option value="5">5 laps</option></select></label>
            <label class="field compact-field"><span class="section-label">DETAIL</span><select data-setting="quality" aria-label="Graphics quality"><option value="high">High</option><option value="low">Low</option></select></label>
            <button class="launch" data-action="start" id="start">LET’S DRIVE ${arrow}</button>
          </div>
          <div class="setup-footer"><span id="track-description">${TRACKS[0].subtitle}</span><span>WASD / ARROWS <b>TO DRIVE</b> &nbsp; SPACE <b>TO SLIDE</b></span></div>
        </section>
      </main>
      <section id="hud" class="hud hidden" aria-label="Race dashboard">
        <div class="race-stats"><div><span class="section-label">POSITION</span><strong id="position">1 <small>/ 4</small></strong></div><div><span class="section-label">LAP</span><strong id="lap">1 <small>/ 3</small></strong></div><div><span class="section-label">TIME</span><strong class="time" id="time">0:00.000</strong></div><button class="icon-button" data-action="pause" aria-label="Pause game">Ⅱ</button></div>
        <div class="map-panel"><canvas id="minimap" width="360" height="280" aria-label="Track minimap"></canvas><span id="track-name">COASTAL LOOP</span></div>
        <div class="drive-hint">R <span>RESET</span> &nbsp; C <span>CAMERA</span> &nbsp; ESC <span>PAUSE</span></div>
        <div class="speed-panel"><div class="speed-number"><span id="speed">0</span><small>KM/H</small></div><div class="speed-track"><div id="speed-fill"></div></div><div class="speed-bottom"><span id="gear">N</span><span id="surface">ON THE GRID</span></div><div class="best-time">BEST LAP <b id="best">—</b></div></div>
        <div class="touch-controls" aria-label="Touch driving controls"><div><button data-drive="KeyA" aria-label="Steer left">←</button><button data-drive="KeyD" aria-label="Steer right">→</button></div><div><button data-drive="Space" class="touch-drift" aria-label="Handbrake">DRIFT</button><button data-drive="KeyS" aria-label="Brake or reverse">↓</button><button data-drive="KeyW" class="touch-gas" aria-label="Accelerate">↑</button></div></div>
      </section>
      <div id="countdown" class="countdown hidden" aria-live="polite"></div>
      <section id="overlay" class="overlay hidden" aria-label="Game menu"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="eyebrow" id="modal-eyebrow">TAKE A BREATHER</div><h2 id="modal-title">On pause.</h2><p id="modal-text">The road will still be here.</p><button class="launch" data-action="resume" id="resume">KEEP DRIVING ${arrow}</button><button class="secondary" data-action="restart">Restart drive</button><button class="text-button" data-action="home">Back to garage</button></div></section>
      <div id="toast" class="toast hidden" role="status"></div>`;
    this.canvas = this.get('scene') as HTMLCanvasElement;
    this.menu = this.get('menu');
    this.hud = this.get('hud');
    this.overlay = this.get('overlay');
    this.countdown = this.get('countdown');
    this.map = this.get('minimap') as HTMLCanvasElement;
    root.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (!button) return;
      event.preventDefault();
      onAction(button.dataset.action!, button.dataset.value);
    });
    root.addEventListener('change', (event) => {
      const field = event.target as HTMLSelectElement;
      if (field.dataset.setting) onAction(field.dataset.setting, field.value);
    });
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  get(id: string): HTMLElement {
    if (!this.elements.has(id)) this.elements.set(id, document.getElementById(id)!);
    return this.elements.get(id)!;
  }

  configure(config: GameConfig): void {
    document.querySelectorAll<HTMLElement>('[data-action="car"]').forEach((button, index) => {
      const active = CARS[index] === config.car;
      button.classList.toggle('selected', active);
      button.setAttribute('aria-pressed', String(active));
    });
    document.querySelectorAll<HTMLElement>('[data-action="mode"]').forEach((button) => {
      const active = button.dataset.value === config.mode;
      button.classList.toggle('selected', active);
      button.setAttribute('aria-pressed', String(active));
    });
    this.get('region').textContent = config.track.region;
    this.get('track-description').textContent =
      config.mode === 'free'
        ? 'No clock to beat. Leave the circuit and explore the city.'
        : config.track.subtitle;
    (this.get('laps-select') as HTMLSelectElement).disabled = config.mode === 'free';
    this.get('track-name').textContent = config.track.name.toUpperCase();
  }

  show(screen: 'menu' | 'game' | 'paused' | 'finished'): void {
    this.menu.classList.toggle('hidden', screen !== 'menu');
    this.hud.classList.toggle('hidden', screen === 'menu');
    this.overlay.classList.toggle('hidden', screen !== 'paused' && screen !== 'finished');
    document.body.classList.toggle('playing', screen !== 'menu');
    this.countdown.classList.add('hidden');
    if (screen === 'paused' || screen === 'finished') {
      this.get('modal-eyebrow').textContent =
        screen === 'paused' ? 'TAKE A BREATHER' : 'THAT’S A WRAP';
      this.get('modal-title').textContent = screen === 'paused' ? 'On pause.' : 'Finish line.';
      this.get('modal-text').textContent = 'The road will still be here.';
      this.get('resume').classList.toggle('hidden', screen === 'finished');
      (screen === 'paused'
        ? this.get('resume')
        : this.overlay.querySelector<HTMLButtonElement>('[data-action="restart"]')
      )?.focus();
    }
    if (screen === 'game') (document.activeElement as HTMLElement)?.blur();
    if (screen === 'menu') this.get('start').focus({ preventScroll: true });
  }

  setMap(track: Track): void {
    this.mapBackground.width = 360;
    this.mapBackground.height = 280;
    const xs = track.points.map((p) => p.x),
      zs = track.points.map((p) => p.z);
    const minX = Math.min(...xs),
      maxX = Math.max(...xs),
      minZ = Math.min(...zs),
      maxZ = Math.max(...zs);
    this.mapBounds = {
      x: (minX + maxX) / 2,
      z: (minZ + maxZ) / 2,
      scale: Math.min(290 / (maxX - minX), 220 / (maxZ - minZ)),
    };
    const ctx = this.mapBackground.getContext('2d')!;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    track.points.forEach((p, i) => {
      const [x, y] = this.mapPoint(p.x, p.z);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#ffffff25';
    ctx.lineWidth = 15;
    ctx.stroke();
    ctx.strokeStyle = '#b4c4bd';
    ctx.lineWidth = 3;
    ctx.stroke();
    const p = track.at(0),
      [x, y] = this.mapPoint(p.x, p.z);
    ctx.fillStyle = '#f7f6ec';
    ctx.fillRect(x - 4, y - 4, 8, 8);
  }

  private mapPoint(x: number, z: number): [number, number] {
    return [
      180 + (x - this.mapBounds.x) * this.mapBounds.scale,
      140 + (z - this.mapBounds.z) * this.mapBounds.scale,
    ];
  }

  drawMap(cars: Vehicle[]): void {
    const ctx = this.map.getContext('2d')!;
    ctx.clearRect(0, 0, 360, 280);
    ctx.drawImage(this.mapBackground, 0, 0);
    for (let i = cars.length - 1; i >= 0; i--) {
      const car = cars[i],
        [x, y] = this.mapPoint(car.x, car.z);
      ctx.beginPath();
      ctx.arc(x, y, i === 0 ? 7 : 5, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? '#dfff71' : '#f4a58b';
      ctx.fill();
      if (i === 0) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.sin(car.heading) * 15, y + Math.cos(car.heading) * 15);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#dfff71';
        ctx.stroke();
      }
    }
  }

  update(
    speed: number,
    elapsed: number,
    lap: number,
    position: number,
    config: GameConfig,
    best: number,
    offRoad: boolean,
  ): void {
    this.get('speed').textContent = String(Math.round(Math.abs(speed) * 3.6));
    this.get('speed-fill').style.width =
      `${Math.min(100, (Math.abs(speed) / config.car.maxSpeed) * 100)}%`;
    this.get('gear').textContent =
      speed < -0.5
        ? 'R'
        : Math.abs(speed) < 0.5
          ? 'N'
          : String(Math.min(6, 1 + Math.floor(speed / 11)));
    this.get('surface').textContent = offRoad
      ? 'OFF THE BEATEN PATH'
      : config.mode === 'free'
        ? 'FREE TO EXPLORE'
        : 'FIND YOUR LINE';
    this.get('time').textContent = formatTime(elapsed);
    this.get('lap').innerHTML =
      config.mode === 'free'
        ? '∞'
        : `${Math.min(lap, config.laps)} <small>/ ${config.laps}</small>`;
    this.get('position').innerHTML =
      config.mode === 'free' ? '—' : `${position} <small>/ 4</small>`;
    this.get('best').textContent = formatTime(best);
  }
}
