import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';

// Patch @imgly/background-removal to force single-threaded ONNX runtime.
// The library hardcodes numThreads = navigator.hardwareConcurrency, which
// requires SharedArrayBuffer + COOP/COEP headers. Those headers block the
// CDN where the AI model is hosted — a catch-22 that crashes the tab.
// Forcing single-threaded mode avoids the SharedArrayBuffer requirement entirely.
const patchBgRemoval = (code: string): string =>
  code
    .replace(
      /ort2\.env\.wasm\.numThreads\s*=\s*maxNumThreads\(\)/g,
      'ort2.env.wasm.numThreads = 1',
    )
    .replace(
      /executionMode:\s*"parallel"/g,
      'executionMode: "sequential"',
    );

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'patch-bg-removal',
      enforce: 'pre',
      transform(code, id) {
        if (id.includes('@imgly/background-removal') && id.includes('index')) {
          return { code: patchBgRemoval(code), map: null };
        }
      },
    },
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: ['@imgly/background-removal'],
    esbuildOptions: {
      plugins: [
        {
          name: 'patch-bg-removal',
          setup(build) {
            build.onLoad(
              { filter: /@imgly[\/\\]background-removal[\/\\]dist[\/\\]index/ },
              async (args) => {
                const content = patchBgRemoval(readFileSync(args.path, 'utf-8'));
                return { contents: content, loader: 'js' };
              },
            );
          },
        },
      ],
    },
  },
});
