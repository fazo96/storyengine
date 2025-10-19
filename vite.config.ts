import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import deno from "@deno/vite-plugin";

const apiPort = Number(process.env.PORT || 8080);

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: `http://localhost:${apiPort}`,
        changeOrigin: true,
      },
    },
  },
  plugins: [vue(), deno()],
});
