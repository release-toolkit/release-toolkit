import { defineConfig } from 'tsdown';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  format: ['esm'],
  dts: true,
  sourcemap: false,
  clean: true,
  target: 'es2022',
  bundle: true,
  // 解析本地 workspace 包
  alias: {
    '@release-toolkit/core': join(__dirname, '../../core/dist/index.mjs'),
    '@release-toolkit/changelog-presets': join(__dirname, '../../changelog-presets/dist/index.mjs'),
  },
  // 不设置 external，让 tsdown 把所有依赖打包进 dist/index.mjs
  // 这样 wrangler 可以直接使用单个入口文件
});
