// @ts-check
'use strict';
// Verrouillage par code (feuille de route S1) : écran de confidentialité à l'ouverture et après une absence
const { test, expect, useSettings, seedNotes, note } = require('./fixtures');

const KEY = 'gsk_cle_de_test_assez_longue';
// Simule le passage en arrière-plan puis le retour (Android : multitâche, écran éteint…)
const hide = (page) => page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
const back = (page, awayMs = 0) => page.evaluate((ms) => {
  if (ms) localStorage.setItem('np-lock-hid', String(Date.now() - ms));
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange'));
}, awayMs);

// Rouvrir l'app longtemps après l'avoir quittée (au-delà du délai) : l'heure de départ est vieillie avant chaque chargement
const longAbsence = (page) => page.addInitScript(() => localStorage.setItem('np-lock-hid', '0'));

async function enable(page, code = '2580', delay = null) {
  await page.locator('#settingsBtn').click();
  await page.locator('#lockBtn').click();
  await expect(page.locator('#pin1')).toBeFocused();   // le champ reçoit le focus après l'ouverture de la fenêtre
  await page.locator('#pin1').fill(code);
  await page.locator('#pin2').fill(code);
  if (delay != null) await page.locator('#pinDelay').selectOption(String(delay));
  await page.locator('#pinOk').click();
  await expect(page.locator('#toast')).toContainText('Verrouillage activé');
}

test.describe('Verrouillage par code (S1)', () => {
  test.beforeEach(async ({ page, mocks }) => {
    await useSettings(page, { key: KEY });
    await page.goto('./');
    await seedNotes(page, [note({ id: 'nS', title: 'Note secrète' })]);
  });

  test('activer, puis l\'app s\'ouvre verrouillée ; mauvais code refusé, bon code accepté', async ({ page }) => {
    await page.locator('#settingsBtn').click();
    await page.locator('#lockBtn').click();
    await expect(page.locator('#pin1')).toBeFocused();
    await page.locator('#pin1').fill('1234'); await page.locator('#pin2').fill('1234');
    await page.locator('#pinOk').click();
    await expect(page.locator('#pinRes')).toContainText('Trop facile');
    await page.locator('#pin1').fill('2580'); await page.locator('#pin2').fill('2581');
    await page.locator('#pinOk').click();
    await expect(page.locator('#pinRes')).toContainText('différents');
    await page.locator('#pin2').fill('2580');
    await page.locator('#pinOk').click();
    await expect(page.locator('#toast')).toContainText('Verrouillage activé');
    await expect(page.locator('#lockState')).toContainText('Activé · après 1 minute');
    // le code n'est pas gardé en clair
    const stored = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)]))));
    expect(stored).not.toContain('2580');

    await longAbsence(page);
    await page.reload();
    await expect(page.locator('#lock')).toBeVisible();
    await expect(page.locator('#notesList')).toBeHidden();
    await expect(page.locator('#lockIn')).toBeFocused();
    await page.locator('#lockIn').fill('1111');
    await expect(page.locator('#lockMsg')).toContainText('Code incorrect');
    await expect(page.locator('#lock')).toBeVisible();
    await page.locator('#lockIn').fill('2580');   // 4 chiffres : validé tout seul
    await expect(page.locator('#lock')).toBeHidden();
    await expect(page.locator('#notesList')).toContainText('Note secrète');
  });

  test('rouvrir l\'app avant la fin du délai ne demande pas le code', async ({ page }) => {
    await enable(page);   // après 1 minute
    await page.reload();   // l'app vient d'être quittée
    await expect(page.locator('#notesList')).toContainText('Note secrète');
    await expect(page.locator('#lock')).toBeHidden();
  });

  test('trop d\'essais : pause, même avec le bon code', async ({ page }) => {
    await enable(page);
    await longAbsence(page);
    await page.reload();
    const fails = () => page.evaluate(() => JSON.parse(localStorage.getItem('np-lock-fail') || '{"n":0}').n);
    for (let i = 1; i <= 5; i++) { await page.locator('#lockIn').fill('9999'); await expect.poll(fails).toBe(i); }
    await expect(page.locator('#lockMsg')).toContainText('réessaie dans 30 s');
    await page.locator('#lockIn').fill('2580');
    await expect(page.locator('#lockMsg')).toContainText('Trop d\'essais');
    await expect(page.locator('#lock')).toBeVisible();
    await page.reload();   // relancer l'app ne remet pas le compteur à zéro
    await expect(page.locator('#lockMsg')).toContainText('Trop d\'essais');
    await page.evaluate(() => localStorage.setItem('np-lock-fail', JSON.stringify({ n: 5, u: 0 })));   // la pause est passée
    await page.locator('#lockIn').fill('2580');
    await expect(page.locator('#lock')).toBeHidden();
  });

  test('code oublié : une clé d\'API enregistrée déverrouille et désactive le code', async ({ page }) => {
    await enable(page);
    await longAbsence(page);
    await page.reload();
    await page.locator('#lockForgot').click();
    await page.locator('#lockKey').fill('gsk_une_autre_cle_inconnue');
    await page.locator('#lockKeyGo').click();
    await expect(page.locator('#lockMsg')).toContainText('aucune clé enregistrée');
    await page.locator('#lockKey').fill(KEY);
    await page.locator('#lockKeyGo').click();
    await expect(page.locator('#lock')).toBeHidden();
    await expect(page.locator('#toast')).toContainText('Verrouillage désactivé');
    expect(await page.evaluate(() => localStorage.getItem('np-lock'))).toBeNull();
    await page.reload();   // toujours « longtemps après » : plus de code demandé
    await expect(page.locator('#lock')).toBeHidden();
  });

  test('après une absence : verrouillé selon le délai ; pas pour un sélecteur de fichier', async ({ page }) => {
    await enable(page, '2580', 300000);   // après 5 minutes
    await page.locator('#backBtn').click();
    await hide(page); await back(page, 60000);   // 1 min d'absence : pas de code
    await expect(page.locator('#lock')).toBeHidden();
    await hide(page); await back(page, 6 * 60000);   // 6 min : code demandé
    await expect(page.locator('#lock')).toBeVisible();
    await page.locator('#lockIn').fill('2580');
    await expect(page.locator('#lock')).toBeHidden();
    // choisir un fichier quitte l'app un instant : pas de code au retour (même après 6 min dans la galerie)
    await page.evaluate(() => document.getElementById('fileInput').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await hide(page); await back(page, 6 * 60000);
    await expect(page.locator('#lock')).toBeHidden();
  });

  test('« dès que je quitte l\'app » : verrouillé avant même le retour ; désactiver demande le code', async ({ page }) => {
    await enable(page, '2580', 0);
    await hide(page);
    await expect(page.locator('#lock')).toBeVisible();   // l'aperçu du multitâche ne montre pas les notes
    await back(page);
    await expect(page.locator('#lock')).toBeVisible();
    await page.locator('#lockIn').fill('2580');
    await expect(page.locator('#lock')).toBeHidden();
    await page.locator('#lockOff').click();
    await expect(page.locator('#pinCur')).toBeFocused();
    await page.locator('#pinCur').fill('0000');
    await page.locator('#pinOk').click();
    await expect(page.locator('#pinRes')).toContainText('incorrect');
    await page.locator('#pinCur').fill('2580');
    await page.locator('#pinOk').click();
    await expect(page.locator('#toast')).toContainText('Verrouillage désactivé');
    await expect(page.locator('#lockState')).toHaveText('Désactivé');
    await hide(page); await back(page);
    await expect(page.locator('#lock')).toBeHidden();
  });
});
