import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

/**
 * Worker 专用构建：打包 @release-toolkit/markdown、js-yaml 等全部依赖，
 * 不与 index 共享 chunk，避免打入 simple-git / node:fs。
 * 输出 dist/worker.js 供 @release-toolkit/app-server 使用。
 */
export default defineConfig({
  build: {
    ssr: true,
    lib: {
      entry: 'src/worker.ts',
      formats: ['es'],
      fileName: 'worker',
    },
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: false,
    minify: false,
    target: 'es2022',
    rollupOptions: {
      // Worker 需内联全部依赖，因此不 external 任何模块
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
      entryRoot: 'src',
    }),
  ],
});
