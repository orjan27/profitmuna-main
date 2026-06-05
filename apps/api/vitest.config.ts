import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Workspace package aliases — mirror tsconfig.base.json paths for Vite resolution
      '@app/db/schema': path.resolve(__dirname, '../../packages/db/src/schema.ts'),
      '@app/db': path.resolve(__dirname, '../../packages/db/src/index.ts'),
    },
  },
  test: {
    globals: true,
  },
});
