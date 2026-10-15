import {defineConfig} from 'vite';

/** GitHub Pages project site is /MyMG/, in both development and production. */
export default defineConfig({
  base: '/MyMG/',
  build: {outDir: 'dist', emptyOutDir: true, sourcemap: false},
});
