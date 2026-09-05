import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 650 },
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node' },
});
