import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',

  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    minify: 'terser',
    cssCodeSplit: false,
    target: 'es2020',
    sourcemap: false,

    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },

    rollupOptions: {
      output: {
        manualChunks: {
          'webgl': [
            '/js/webgl/three-manager.ts',
            '/js/webgl/scene-controller.ts',
            '/js/webgl/shaders/procedural-gradient.ts',
            '/js/webgl/shaders/kuwahara.ts',
            '/js/webgl/shaders/watercolor-enhance.ts'
          ]
        },
        assetFileNames: (assetInfo) => {
          const ext = assetInfo.name.split('.').pop();
          if (ext === 'css') return 'assets/css/[name]-[hash][extname]';
          return `assets/${ext}/[name]-[hash][extname]`;
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js'
      }
    }
  },

  server: {
    port: 8000,
    host: '127.0.0.1',
    open: false
  },

  preview: {
    port: 8000,
    host: '127.0.0.1'
  }
});
