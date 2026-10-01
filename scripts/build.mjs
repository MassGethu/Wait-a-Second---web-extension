import { build } from 'vite';
import { copyFile } from 'node:fs/promises';
await build();
await build({configFile:false,publicDir:false,build:{emptyOutDir:false,lib:{entry:'src/content/index.ts',name:'WaitASecond',formats:['iife'],fileName:()=> 'content.js'},rollupOptions:{output:{inlineDynamicImports:true}}}});
await build({configFile:false,publicDir:false,build:{emptyOutDir:false,lib:{entry:'src/background/serviceWorker.ts',formats:['es'],fileName:()=> 'background.js'},rollupOptions:{output:{inlineDynamicImports:true}}}});
await copyFile('manifest.json','dist/manifest.json');
