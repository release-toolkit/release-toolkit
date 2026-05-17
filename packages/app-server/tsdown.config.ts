import { defineConfig } from 'tsdown';

/**
 * app-server 构建配置
 */
export default defineConfig({
  format: ['esm'],
  dts: true,
  sourcemap: false,
  clean: true,
  entry: ['src/index.ts'],
});
