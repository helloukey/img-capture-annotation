import { defineConfig, devices } from '@playwright/test';

const fakeCamera = '--use-fake-device-for-media-stream';
const PORT = Number(process.env.E2E_PORT ?? 4319);
/** Set E2E_BASE_URL to run the suite against a deployed site instead of the local dev server. */
const REMOTE = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  // Burst tests encode 4K fake-camera frames; more parallel browsers starve each other's CPU
  // and make capture timing (and so frame counts) flaky.
  workers: process.env.CI ? 1 : 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: REMOTE ?? `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop-chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        permissions: ['camera'],
        launchOptions: { args: ['--use-fake-ui-for-media-stream', fakeCamera] },
      },
    },
    {
      name: 'pixel-7',
      use: {
        ...devices['Pixel 7'],
        permissions: ['camera'],
        launchOptions: { args: ['--use-fake-ui-for-media-stream', fakeCamera] },
      },
    },
  ],
  webServer: REMOTE
    ? undefined
    : {
        command: `npm run dev -- --port ${PORT} --strictPort`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: false,
        timeout: 60_000,
      },
});
