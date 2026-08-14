import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    // Node 库构建：让 node:fs/path/child_process 等保持外部，而非浏览器兼容处理
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
      external: [
        '@release-toolkit/changelog-presets',
        '@release-toolkit/markdown',
        '@release-toolkit/types',
        'js-yaml',
        'semver',
        'simple-git',
        'octokit',
      ],
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
