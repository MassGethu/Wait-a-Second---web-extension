import { defineConfig } from 'vite';
export default defineConfig({ base:'./', build:{ rollupOptions:{ input:{popup:'popup.html',reset:'reset.html'} } } });
