import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5174 },
  build: {
    target: 'es2022',
    // The verification page opens from a QR on a mid-range Android phone over
    // a slow network. Keeping the vendor split explicit stops a router or
    // crypto dependency from landing in the first paint.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
