// Bundles the server together with the shared workspace packages (engine, protocol)
// into dist/index.js. Runtime npm dependencies stay external and are installed normally.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  sourcemap: true,
  external: ['socket.io', 'pg'],
  logLevel: 'info',
});
