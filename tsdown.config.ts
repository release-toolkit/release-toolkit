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
  // app-server 特殊配置：输出为单文件，无外部依赖
  // 注意：app-server 使用 Cloudflare Workers，不需要 tsdown 打包
});
