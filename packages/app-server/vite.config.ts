import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

/**
 * Cloudflare Worker 构建：将 @release-toolkit/core/worker、@release-toolkit/markdown
 * 及 octokit 等依赖内联进单文件 dist/index.js，供 wrangler 部署。
 */
export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: 'index',
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    minify: false,
    target: 'es2022',
    rollupOptions: {
      // Worker 需内联全部依赖（含 workspace 与 octokit），形成自包含单文件
      external: [],
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  plugins: [
    dts({
      include: ['src'],
      exclude: ['src/**/__tests__/**'],
      insertTypesEntry: true,
    }),
  ],
});
