import { defineConfig } from 'tsdown';

/**
 * Root tsdown config serves as shared defaults.
 * Actual builds are run per-package via `pnpm -r build`.
 * Each package's own tsdown.config.ts imports and extends this.
 */
export default defineConfig({
  format: ['esm'],
  dts: true,
  sourcemap: false,
  clean: true,
});
