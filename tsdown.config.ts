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
    // DSH's client module loader executes classic scripts, not ES modules.
    // Emit CJS in the official window.__ModuleLoader__.load closure.
    format: 'cjs',
    platform: 'browser',
    external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/dsh-client-ui-primitives'],
    outputOptions: {
      entryFileNames: 'client.js',
      codeSplitting: false,
      banner: "window.__ModuleLoader__.load({ id: 'dsh-sidechat', factory: (require) => {",
      intro: 'var module = { exports: {} }; var exports = module.exports;',
      footer: 'return module.exports; } });',
    },
    clean: false,
    tsconfig: './tsconfig.client.json',
    dts: false,
  },
])
