import { defineConfig } from 'tsdown';

export default defineConfig({
  format: ['esm'],
  dts: true,
  sourcemap: false,
  clean: true,
  target: 'es2022',
  bundle: true,
  // 不设置 external，让 tsdown 把所有依赖打包进 dist/index.mjs
  // 这样 wrangler 可以直接使用单个入口文件
});
