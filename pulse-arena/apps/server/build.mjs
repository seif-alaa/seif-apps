// Bundles the server and the shared workspace packages into dist/index.js.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  sourcemap: true,
  packages: 'external',
  // Workspace packages are TypeScript sources, so they must be bundled.
  plugins: [
    {
      name: 'bundle-workspace',
      setup(b) {
        b.onResolve({ filter: /^@pulse\// }, () => undefined);
      },
    },
  ],
  external: ['socket.io', 'pg'],
  logLevel: 'info',
});
