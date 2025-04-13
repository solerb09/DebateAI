import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from "path"; // Import path module

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: { // Add resolve configuration
    alias: {
      "@": path.resolve(__dirname, "./src"), // Map @ to the src directory
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5080',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5080',
        changeOrigin: true,
        ws: true,
      },
    },
  },
}); 