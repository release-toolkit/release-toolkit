import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: false,
  clean: true,
  // 确保所有依赖都被打包进 dist
  bundle: true,
  // 不要将任何依赖标记为 external
  external: [],
  // 内联所有导入
  inlineDynamicImports: true,
});
