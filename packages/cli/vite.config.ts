import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    // Node 库构建：让 node:* 保持外部，而非浏览器兼容处理
    ssr: true,
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
      // 保持依赖 external，交由运行时/workspace 解析（monorepo 标准行为）
      external: ['@release-toolkit/core', 'commander', 'picocolors'],
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
