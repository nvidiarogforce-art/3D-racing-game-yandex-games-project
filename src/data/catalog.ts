export interface CarSpec {
  id: string;
  name: string;
  kind: string;
  color: number;
  maxSpeed: number;
  acceleration: number;
  grip: number;
  steering: number;
  body: 'coupe' | 'sport' | 'rally';
}

export const CARS: CarSpec[] = [
  {
    id: 'sora',
    name: 'Sora GT',
    kind: 'THE ALL-ROUNDER',
    color: 0xdfff71,
    maxSpeed: 57,
    acceleration: 16,
    grip: 10,
    steering: 0.48,
    body: 'coupe',
  },
  {
    id: 'veloce',
    name: 'Veloce R',
    kind: 'BUILT FOR SPEED',
    color: 0xfb714e,
    maxSpeed: 68,
    acceleration: 19,
    grip: 8,
    steering: 0.4,
    body: 'sport',
  },
  {
    id: 'terra',
    name: 'Terra RS',
    kind: 'TAKE THE LONG WAY',
    color: 0x9ebfff,
    maxSpeed: 51,
    acceleration: 15,
    grip: 13,
    steering: 0.55,
    body: 'rally',
  },
];

export interface TrackSpec {
  id: string;
  name: string;
  subtitle: string;
  region: string;
  sky: number;
  ground: number;
  foliage: number;
  road: number;
  seed: number;
  width: number;
  points: [number, number][];
}

export const TRACKS: TrackSpec[] = [
  {
    id: 'coast',
    name: 'Coastal loop',
    subtitle: 'Sea air. Wide corners. Endless possibility.',
    region: '01 / PACIFIC COAST',
    sky: 0xc4d7d6,
    ground: 0x83977c,
    foliage: 0x415e50,
    road: 0x384447,
    seed: 21,
    width: 16,
    points: [
      [0, 100],
      [105, 95],
      [175, 25],
      [140, -85],
      [20, -110],
      [-100, -70],
      [-125, 25],
    ],
  },
  {
    id: 'canyon',
    name: 'Canyon run',
    subtitle: 'Warm asphalt. Tight turns. Find your rhythm.',
    region: '02 / RED ROCK VALLEY',
    sky: 0xe8cfac,
    ground: 0xba936f,
    foliage: 0x756f4d,
    road: 0x534a45,
    seed: 68,
    width: 15,
    points: [
      [0, 90],
      [95, 105],
      [150, 35],
      [90, -25],
      [140, -115],
      [25, -135],
      [-95, -85],
      [-65, -10],
      [-120, 60],
    ],
  },
  {
    id: 'forest',
    name: 'Pine ridge',
    subtitle: 'Cool shadows. Flowing bends. Full focus.',
    region: '03 / NORTHERN HIGHLANDS',
    sky: 0xb5c7c4,
    ground: 0x657d64,
    foliage: 0x294d42,
    road: 0x354140,
    seed: 119,
    width: 14,
    points: [
      [0, 110],
      [120, 90],
      [150, -10],
      [75, -70],
      [0, -140],
      [-105, -85],
      [-155, 20],
      [-70, 55],
    ],
  },
];

export type GameMode = 'race' | 'free';
export type Quality = 'low' | 'high';
export interface GameConfig {
  car: CarSpec;
  track: TrackSpec;
  mode: GameMode;
  laps: 3 | 5;
  quality: Quality;
}
