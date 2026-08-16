import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3210);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

/**
 * End-to-end configuration.
 *
 * The specs in e2e/ are split in two:
 *   - public.spec.ts    runs with no credentials at all
 *   - authenticated.spec.ts  skips itself unless E2E_EMAIL / E2E_PASSWORD are
 *                            set for a real Supabase account
 *
 * This keeps `npm run test:e2e` useful on a fresh checkout while still covering
 * the signed-in flows once you point it at a project. See docs/SETUP.md.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Reuse an already-running server if there is one; otherwise start a
  // production build, which is what the PWA behaviour needs.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npx next start -p ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
