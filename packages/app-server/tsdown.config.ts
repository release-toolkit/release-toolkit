import { defineConfig } from 'tsdown';

export default defineConfig({
  format: ['esm'],
  dts: true,
  sourcemap: false,
  clean: true,
  target: 'es2022',
  // 强制打包所有依赖
  bundle: true,
  external: [],
  // 内联所有动态导入
  inlineDynamicImports: true,
});
