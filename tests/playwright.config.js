// @ts-check
const { defineConfig, devices } = require('@playwright/test');

// Les dates calculées dans les tests doivent correspondre au fuseau du téléphone simulé (timezoneId plus bas)
process.env.TZ = 'Europe/Brussels';

const PORT = 4173;
module.exports = defineConfig({
  testDir: './e2e',
  timeout: 45000,
  expect: { timeout: 10000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    ...devices['Pixel 7'],          // Android, écran de téléphone, tactile
    baseURL: `http://localhost:${PORT}/`,
    locale: 'fr-FR',
    timezoneId: 'Europe/Brussels',
    serviceWorkers: 'block',        // le service worker a ses propres tests ; ici on veut des appels réseau simulés prévisibles
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'android', use: { browserName: 'chromium' } }],
  webServer: {
    command: `node helpers/server.js`,
    env: { PORT: String(PORT) },
    url: `http://localhost:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
  },
});
