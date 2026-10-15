import {defineConfig} from 'vite';

/** GitHub Pages project site lives under /MyMG/; local dev is served from /. */
export default defineConfig({
  base: process.env.MYMG_BASE_PATH ?? (process.env.GITHUB_ACTIONS ? '/MyMG/' : '/'),
  build: {outDir: 'dist', emptyOutDir: true, sourcemap: false},
});
