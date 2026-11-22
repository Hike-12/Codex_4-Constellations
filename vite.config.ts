import { gzipSync } from 'node:zlib';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // The single entry is stored as gzip and unpacked by the browser loader.
    chunkSizeWarningLimit: 550,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
  plugins: [{
    name: 'pack-observatory',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const entry = Object.values(bundle).find(file => file.type === 'chunk' && file.isEntry);
      if (!entry || entry.type !== 'chunk') return;
      if (entry.imports.length || entry.dynamicImports.length) {
        this.error('The packed observatory entry must be self-contained.');
      }
      const fileName = entry.fileName.replace(/\.js$/, '.gz');
      this.emitFile({ type: 'asset', fileName, source: gzipSync(entry.code, { level: 9 }) });
      entry.code = `
        const packed = new URL(${JSON.stringify('./' + fileName.split('/').pop())}, import.meta.url);
        const fallback = document.getElementById('fallback');
        try {
          const response = await fetch(packed);
          if (!response.ok || !response.body) throw new Error('Observatory payload unavailable');
          const unpacked = response.body.pipeThrough(new DecompressionStream('gzip'));
          const module = URL.createObjectURL(new Blob([await new Response(unpacked).arrayBuffer()], {
            type: 'text/javascript',
          }));
          try { await import(module); }
          finally { URL.revokeObjectURL(module); }
        } catch (error) {
          fallback.textContent = 'The observatory could not load. Reload the page or try a current browser.';
          fallback.hidden = false;
          console.error(error);
        }
      `;
    },
  }],
});
