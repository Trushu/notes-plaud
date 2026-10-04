// @ts-check
'use strict';
// Bug corrigé au chantier 2 : une mise à jour de l'app ne doit pas couper un enregistrement au téléphone
const { test, expect, useSettings } = require('./fixtures');

// micro simulé par Chromium
test.use({ permissions: ['microphone'], launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] } });

test.describe('Mise à jour de l\'app', () => {
  test('pas de rechargement pendant un enregistrement au téléphone', async ({ page, mocks }) => {
    await useSettings(page, { key: 'gsk_test' });
    await page.goto('./');
    await page.locator('#recBtn').click();
    await expect(page.locator('#v-rec')).toBeVisible();
    await expect(page.locator('#recTime')).not.toHaveText('0:00', { timeout: 5000 });
    await page.evaluate(() => { window.__avant = 1; applyUpdate(); });
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => [window.__avant, updatePending])).toEqual([1, true]);
    await expect(page.locator('#v-rec')).toBeVisible();
  });
});

