import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()], base: './',
  ...(mode === 'component' ? {
    build: {
      outDir: 'dist-component',
      lib: { entry: 'src/index.ts', formats: ['es'], fileName: 'koi-pond', cssFileName: 'koi-pond' },
      rollupOptions: { external: ['react', 'react-dom', 'react/jsx-runtime', 'pixi.js'] },
    },
  } : {}),
}));
