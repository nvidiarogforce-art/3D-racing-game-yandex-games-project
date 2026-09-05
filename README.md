# Apex Horizon

A complete **Vite + TypeScript + Three.js project scaffold** with a playable arcade racing prototype. Created from the repository’s original README and MIT license.

## Run locally

Install **Node.js 24 LTS** (minimum 22.12), then open a terminal in this folder:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Keep that terminal open while playing. Do not open `index.html` by double-clicking it; ES modules need a local web server.

For a production build:

```sh
npm run build
npm run preview
```

All game code and Three.js are bundled into `dist/`. Relative asset URLs support deployment in a subdirectory. Ordinary builds have no CDN, remote font, image, model, or SDK dependency.

## Included

- Three cars with different acceleration, top speeds, handling, and original procedural models: Sora GT, Veloce R, and Terra RS.
- Three circuits: Coastal Loop, Canyon Run, and Pine Ridge.
- Circuit races against three AI opponents, a countdown, 3 or 5 laps, position tracking, and results.
- Free driving around a large, bounded procedural city with a dense road grid, downtown tower, plaza, hundreds of buildings, roadside scenery, and 28 local traffic NPCs. The city is intentionally finite so it stays responsive on ordinary desktops and supported mobile devices.
- Fixed-step arcade bicycle physics with braking, reverse, steering, tire slip, a handbrake, and off-road resistance.
- Nonfatal car, barrier, tree, and rock collisions. Crashes never trigger a game-over screen.
- AI look-ahead steering, braking for bends, simple car avoidance, and recovery if stuck.
- Traffic NPCs follow the city grid locally and collide softly with the player; there is no external AI API or online backend.
- Chase, wide, and hood cameras; minimap, speedometer, and lap timing.
- Best laps saved locally per track, car, and mode; storage failures do not prevent play.
- Keyboard and multi-pointer touch controls; responsive garage and pause menus.
- High/low graphics, optional synthesized engine audio, tab/focus pause, and WebGL startup errors.
- Optional Yandex SDK initialization, Game Ready and gameplay events, plus ZIP packaging.
- Strict TypeScript, simulation tests, Playwright smoke tests, and GitHub Actions CI.

## Controls

| Action                           | Keyboard   |
| -------------------------------- | ---------- |
| Accelerate                       | W / ↑      |
| Brake, then reverse when stopped | S / ↓      |
| Steer                            | A/D / ←/→  |
| Handbrake                        | Space      |
| Pause / resume                   | Escape / P |
| Recover to the circuit           | R          |
| Cycle camera                     | C          |

Touch buttons appear on small screens and coarse-pointer devices. Sound starts muted; use the sound button to enable it. Switching tabs pauses the simulation and silences audio; resume explicitly when returning.

## Commands

| Command                  | Purpose                                     |
| ------------------------ | ------------------------------------------- |
| `npm run dev`            | Vite development server                     |
| `npm run typecheck`      | Strict TypeScript validation                |
| `npm test`               | Physics, contact, checkpoint, and AI tests  |
| `npm run check`          | Tests plus a production build               |
| `npm run test:e2e`       | Desktop and mobile Chromium gameplay checks |
| `npm run build`          | Standalone static production build          |
| `npm run preview`        | Serve the last production build             |
| `npm run build:yandex`   | Build with the Yandex SDK enabled           |
| `npm run package:yandex` | Create `artifacts/apex-horizon-yandex.zip`  |
| `npm run format`         | Format source and documentation             |
| `npm run format:check`   | Check formatting                            |

Before the first browser test run:

```sh
npx playwright install chromium
npm run test:e2e
```

CI installs browser system dependencies and runs those checks automatically. Test screenshots and the Yandex ZIP are available as a workflow artifact when the job succeeds.

## Source layout

```text
src/
  main.ts                 Startup, fatal errors, HMR cleanup
  style.css               Responsive garage, HUD, and controls
  core/                   Input, audio, safe local storage, math
  data/catalog.ts         Car tuning and circuit definitions
  game/
    Game.ts               Fixed-step loop, cameras, lifecycle, race orchestration
    Vehicle.ts            Independent arcade physics and car contacts
    DriverAI.ts           Look-ahead steering and avoidance
    RaceProgress.ts       Ordered gates, valid laps, and finish timing
  world/
    Track.ts              Closed curves, projection, road ribbons, barriers
  World.ts              Procedural city, grid roads, buildings, traffic, and contacts
    CarModel.ts           Procedural car geometry and animated wheels
  ui/UI.ts                Setup menus, HUD, touch buttons, and minimap
  platform/Yandex.ts      Optional SDK adapter
tests/
  unit/                   Deterministic simulation tests
  e2e/                    Desktop/mobile browser smoke tests
scripts/package.mjs       Cross-platform ZIP creation
```

Physics uses metres, seconds, and radians. Heading zero points along +Z. Simulation runs at 120 Hz with a capped frame accumulator so returning from a suspended tab cannot cause a giant physics jump. Add car and track entries in `src/data/catalog.ts` to expand the catalog.

Lap counting uses twelve ordered gates, forward crossings, on-road validation, and minimum driven distance. Resets return racers to a previously passed gate and cannot directly award a lap. Finish order uses crossing time, so later finishers cannot overtake a recorded result.

## Yandex Games

```sh
npm run package:yandex
```

Upload `artifacts/apex-horizon-yandex.zip` to your Yandex Games draft. The archive contains `index.html` at its root. This command **builds the archive only**; it does not upload or publish the game.

`.env.yandex` enables the official host-provided `/sdk.js` script. The normal build skips SDK loading. A Yandex build expects Yandex hosting or its SDK development proxy; opening that build on an ordinary local server shows an SDK startup error. Use the normal build for standalone previews.

The adapter calls `LoadingAPI.ready()` after the usable menu and initial render; `GameplayAPI.start()` when driving begins or resumes; and `GameplayAPI.stop()` on pause, results, or returning to the garage. Platform pause/resume events are supported, and a platform resume cannot override a separate manual pause.

This is a **playable foundation, not a moderation-approved release**. Before publication, validate the actual SDK in the Yandex draft/debug panel, localize for the chosen audience, test real desktop and mobile devices, and prepare store assets. Ads, cloud saves, leaderboards, purchases, multiplayer, licensed car brands, imported production-quality models, advanced traffic, and realistic suspension/tire simulation are not implemented.

Official references:

- [Vite setup and Node.js requirements](https://vite.dev/guide/)
- [Three.js installation](https://threejs.org/manual/en/installation.html)
- [Yandex SDK connection](https://yandex.com/dev/games/doc/en/sdk/sdk-about)
- [Yandex Game Ready and gameplay events](https://yandex.com/dev/games/doc/en/sdk/sdk-game-events)
- [Yandex platform events](https://yandex.com/dev/games/doc/en/sdk/sdk-events)
- [Yandex upload and draft flow](https://yandex.com/dev/games/doc/en/console/add-new-game)

## License and assets

The original MIT `LICENSE` is preserved. Car geometry, terrain, track geometry, UI icon, and engine sound are generated by this project; no third-party art files are shipped. Three.js is MIT licensed and Vite preserves dependency license comments in production output.
