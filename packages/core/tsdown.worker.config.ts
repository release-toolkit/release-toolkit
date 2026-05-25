import { defineConfig } from 'tsdown';

/** Worker 专用构建：不与 index 共享 chunk，避免打入 simple-git / node:fs */
export default defineConfig({
  entry: ['src/worker.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: false,
  clean: false,
  bundle: true,
  external: [],
  inlineDynamicImports: true,
});
