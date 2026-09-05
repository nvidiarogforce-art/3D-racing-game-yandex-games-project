export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
export const wrap = (value: number, range = 1) => ((value % range) + range) % range;
export const angleDelta = (angle: number) => wrap(angle + Math.PI, Math.PI * 2) - Math.PI;
export const damp = (current: number, target: number, rate: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-rate * dt));

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—';
  const ms = Math.floor(Math.max(0, seconds) * 1000);
  return `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
}

export function randomSeed(seed: number): () => number {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
