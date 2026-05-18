import { defineConfig } from 'tsdown';

export default defineConfig({
  format: ['esm'],
  dts: true,
  sourcemap: false,
  clean: true,
  target: 'es2022',
  bundle: true,
  external: ['@release-toolkit/core', '@release-toolkit/changelog-presets'],
});
