import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base = `/${(env.APP_BASE_PATH || '/Poster-Creater').replace(/^\/+|\/+$/g, '')}/`.replace('//', '/');
  const target = `http://127.0.0.1:${env.PORT || 4017}`;
  return {
    base,
    plugins: [react()],
    server: {
      host: true,
      proxy: {
        [`${base}api`]: target,
        [`${base}uploads`]: target,
      },
    },
  };
});
