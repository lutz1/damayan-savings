import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
  const base = '/damayan-savings/';

  return {
    base,
    envPrefix: ['VITE_', 'REACT_APP_'],
    plugins: [react({ include: /\.[jt]sx?$/ })],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/setupTests.js',
    },
  };
});
