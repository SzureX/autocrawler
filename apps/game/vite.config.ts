import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { roomLayoutsDev } from './devRoomLayouts';

export default defineConfig({
  base: './',
  plugins: [react(), roomLayoutsDev()],
  server: { port: 5173, strictPort: true },
  build: { target: 'es2022', sourcemap: false },
});
