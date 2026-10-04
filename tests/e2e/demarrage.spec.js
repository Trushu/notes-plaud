// @ts-check
'use strict';
// Premier lancement guidé, test des clés, erreurs avec action (feuille de route U1, U2, U3)
const { test, expect, mp3, useSettings } = require('./fixtures');

test.describe('Premier lancement guidé', () => {
  test('clé Groq vérifiée, clé Gemini refusée puis corrigée, dernière étape, puis l\'app est prête', async ({ page, mocks }) => {
    await page.goto('./');
    await expect(page.locator('#onboard')).toBeVisible();
    await page.locator('#onboardBtn').click();
    const sh = page.locator('#sheet');
    await expect(sh).toContainText('Étape 1 sur 3');
    await expect(sh.getByRole('link', { name: 'Ouvrir console.groq.com/keys' })).toHaveAttribute('href', 'https://console.groq.com/keys');
    await page.locator('#wzKey').fill('mauvaise-cle');
    await page.locator('#wzGo').click();
    await expect(page.locator('#wzRes')).toContainText('Une clé Groq commence par « gsk_ »');
    await expect(sh).toContainText('Étape 1 sur 3');
    await page.locator('#wzKey').fill('gsk_bonne');
    await page.locator('#wzGo').click();
    await expect(page.locator('#wzRes')).toContainText('Clé Groq valide');
    await expect(sh).toContainText('Étape 2 sur 3');
    await page.locator('#wzKey').fill('AIza_bad');
    await page.locator('#wzGo').click();
    await expect(page.locator('#wzRes')).toContainText('Clé Gemini refusée');
    await page.locator('#wzKey').fill('AIza_ok');
    await page.locator('#wzGo').click();
    await expect(sh).toContainText('Étape 3 sur 3');
    await page.locator('#wzDone').click();
    await expect(page.locator('#onboard')).toBeHidden();
    const s = await page.evaluate(() => JSON.parse(localStorage.getItem('np-settings')));
    expect([s.key, s.gkey]).toEqual(['gsk_bonne', 'AIza_ok']);
  });

  test('sans réseau : la clé peut être enregistrée quand même ; Gemini peut être passée', async ({ page, context, mocks }) => {
    await page.goto('./');
    await page.locator('#onboardBtn').click();
    await page.locator('#wzKey').fill('gsk_horsligne');
    await context.setOffline(true);
    await page.locator('#wzGo').click();
    await expect(page.locator('#wzRes')).toContainText('Pas de connexion Internet');
    await expect(page.locator('#wzGo')).toHaveText('Enregistrer quand même et continuer');
    await page.locator('#wzGo').click();
    await context.setOffline(false);
    await page.locator('#wzSkip').click();
    await expect(page.locator('#sheet')).toContainText('Étape 3 sur 3');
    expect(await page.evaluate(() => settings.key)).toBe('gsk_horsligne');
  });
});

test('Réglages : bouton « Tester » pour chaque clé', async ({ page, mocks }) => {
  await useSettings(page, { key: 'gsk_bad', gkey: 'AIza_ok' });
  await page.goto('./');
  await page.locator('#settingsBtn').click();
  await page.locator('#sKeyTest').click();
  await expect(page.locator('#sKeyRes')).toContainText('Clé Groq refusée. Vérifie que tu l\'as copiée en entier');
  await expect(page.locator('#sKeyRes')).toHaveClass(/ko/);
  await page.locator('#sGKeyTest').click();
  await expect(page.locator('#sGKeyRes')).toHaveText('Clé Gemini valide ✓');
  mocks.fail = async (route, kind) => { if (kind === 'models') { await route.fulfill({ status: 429, json: {} }); return true; } return false; };
  await page.locator('#sKey').fill('gsk_ok');
  await page.locator('#sKeyTest').click();
  await expect(page.locator('#sKeyRes')).toContainText('limite gratuite atteinte');
  expect(mocks.calls.models.map((x) => x.k)).toEqual(['gsk_bad', 'AIza_ok', 'gsk_ok']);
});

test('erreur de traitement : un bouton mène au bon réglage', async ({ page, mocks }) => {
  await useSettings(page, { key: 'gsk_test' });
  mocks.fail = async (route, kind) => { if (kind === 'transcribe') { await route.fulfill({ status: 401, json: { error: { message: 'Invalid API Key' } } }); return true; } return false; };
  await page.goto('./');
  await page.locator('#fileInput').setInputFiles({ name: 'cours.mp3', mimeType: 'audio/mpeg', buffer: mp3(1) });
  await expect(page.locator('#jobError')).toBeVisible();
  await expect(page.locator('#jobFix')).toHaveText('Vérifier ma clé');
  await page.locator('#jobFix').click();
  await expect(page.locator('#v-settings')).toBeVisible();
  await expect(page.locator('#sKey')).toBeFocused();
});
