import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
  const base = '/damayan-savings/';

  return {
    base,
    envPrefix: ['VITE_', 'REACT_APP_'],
    plugins: [react({ include: /\.[jt]sx?$/ })],
    server: {
      host: true,
      port: 5173,
      strictPort: true,
    },
    preview: {
      host: true,
      port: 5173,
      strictPort: true,
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/setupTests.js',
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
            'vendor-mui-core': ['@mui/material'],
            'vendor-mui-x': ['@mui/x-date-pickers', '@mui/x-data-grid', '@mui/x-charts'],
            'vendor-mui-icons': ['@mui/icons-material'],
            'vendor-emotion': ['@emotion/react', '@emotion/styled'],
          },
        },
      },
    },
  };
});
