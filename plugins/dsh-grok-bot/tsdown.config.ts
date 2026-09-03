/**
 * dsh-grok-bot build: host = ESM runtime plugin, client = ModuleLoader bundle.
 * Host externals stay bare so the installed profile kernel resolves them;
 * the client keeps only the frozen platform seeds + injected runtime deps
 * external and inlines everything else.
 */
import { defineConfig } from 'tsdown'

const PLUGIN_ID = 'dsh-grok-bot'

const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-locale',
  '@deepseek-ai/dsh-client-ui-conversation',
  '@deepseek-ai/dsh-client-ui-theme',
]

/** Anything runtime-resolved by the host harness stays external. */
const HOST_EXTERNALS = [/^@deepseek-ai\//, 'zod']

export default defineConfig([
  {
    name: PLUGIN_ID,
    entry: { index: 'src/index.ts' },
    outDir: 'lib',
    format: 'esm',
    platform: 'node',
    target: 'node22',
    external: HOST_EXTERNALS,
    sourcemap: false,
  },
  {
    name: `${PLUGIN_ID}/client`,
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    external: CLIENT_EXTERNALS,
    noExternal: (id) => (CLIENT_EXTERNALS.includes(id) ? undefined : true),
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PLUGIN_ID)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])