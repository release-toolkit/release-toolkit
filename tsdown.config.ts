import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['packages/core/src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: false,
  clean: true,
});
