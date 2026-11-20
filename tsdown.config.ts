import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    entry: { index: 'src/host/index.ts' },
    outDir: 'lib',
    format: 'esm',
    platform: 'node',
    clean: true,
    tsconfig: './tsconfig.host.json',
    dts: false,
  },
  {
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: 'esm',
    platform: 'browser',
    clean: false,
    tsconfig: './tsconfig.client.json',
    dts: false,
  },
])
