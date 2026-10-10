import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // 開發時把 WebSocket 轉給 Node 伺服器（npm run dev 會同時啟動兩者）
    proxy: { '/socket.io': { target: 'http://localhost:3001', ws: true } },
  },
});
