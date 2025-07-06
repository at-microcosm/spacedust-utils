import { defineConfig } from 'vite'
import { join } from 'node:path';
import { buildSync } from 'esbuild';
import react from '@vitejs/plugin-react'

const buildServiceWorker = forProd => ({
  apply: forProd ? 'build' : 'serve',
  enforce: 'pre',
  transformIndexHtml() {
    buildSync({
      minify: true,
      bundle: true,
      entryPoints: [join(process.cwd(), 'src', 'service-worker.ts')],
      outfile: join(process.cwd(), forProd ? 'dist' : 'public', 'service-worker.js'),
    });
  },
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    buildServiceWorker(true),
    buildServiceWorker(false),
    react(),
  ],
})
