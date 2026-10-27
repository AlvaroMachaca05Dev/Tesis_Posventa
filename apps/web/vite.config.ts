import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  envDir: '../../', // lee el .env de la raíz (solo se exponen las variables VITE_*)
  server: { port: 5173 },
  test: { environment: 'jsdom', globals: true, setupFiles: './src/test-setup.ts' },
});
