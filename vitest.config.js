import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.js'],
    alias: {
      // Allow importing CommonJS modules
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['server/**/*.js', 'shared/**/*.js'],
      exclude: ['**/node_modules/**', '**/tests/**']
    }
  }
});
