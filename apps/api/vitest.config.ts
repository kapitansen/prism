import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Let SWC be the sole transpiler (Vitest 4's default is Oxc; turning it off
  // avoids a double-transform warning).
  oxc: false,
  // SWC transpiles TS *with* decorator metadata — Nest DI needs it when we boot
  // the app in API tests (Oxc, Vitest's default, doesn't emit that metadata).
  plugins: [
    swc.vite({
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    // Point the app at the throwaway test DB (overrides .env for the test run).
    env: {
      DATABASE_URL:
        'postgresql://prism:prism@localhost:5432/prism_test?schema=public',
    },
  },
})
