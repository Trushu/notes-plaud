// @ts-check
'use strict';
// Service worker : installation, hors ligne, réseau lent, partage depuis une autre app
const { test, expect, mp3 } = require('./fixtures');

test.use({ serviceWorkers: 'allow' });

async function controlled(page) {
  await page.goto('./');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}

test('installation réussie même si les icônes des raccourcis manquent sur le site', async ({ page, context, mocks }) => {
  await context.route(/\/sc-[a-z]+\.png$/, (r) => r.fulfill({ status: 404, body: '' }));
  await page.goto('./');
  await expect.poll(() => page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return reg && reg.active ? reg.active.state : 'pas installé';
  }), { timeout: 8000 }).toBe('activated');
});

test('hors ligne : l\'app s\'ouvre depuis le cache', async ({ page, context, mocks }) => {
  await controlled(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#greet')).toBeVisible();
  await expect(page.locator('#v-home')).toBeVisible();
  await context.setOffline(false);
});

test('réseau très lent : l\'app s\'ouvre en quelques secondes depuis le cache', async ({ page, context, mocks }) => {
  await controlled(page);
  await context.route(/localhost:\d+\/(index\.html)?(\?.*)?$/, async (r) => { await new Promise((res) => setTimeout(res, 15000)); await r.continue().catch(() => {}); });
  const t = Date.now();
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 12000 });
  await expect(page.locator('#greet')).toBeVisible();
  expect(Date.now() - t).toBeLessThan(8000);
});

test('fichier partagé (cible de partage Android) : reçu par le service worker puis traité', async ({ page, mocks }) => {
  await controlled(page);
  const ok = await page.evaluate(async (bytes) => {
    const fd = new FormData();
    fd.append('audio', new File([new Uint8Array(bytes)], '2026-10-01 08-30.mp3', { type: 'audio/mpeg' }));
    const r = await fetch('./share', { method: 'POST', body: fd });
    return { redirected: r.redirected, url: r.url, status: r.status };
  }, [...mp3(1)]);
  expect(ok.url).toMatch(/\?shared=1/);
  await page.goto('./?shared=1');
  // sans clé Groq, le fichier est gardé dans une note et les réglages s'ouvrent
  await expect(page.locator('#v-settings')).toBeVisible();
  const n = await page.evaluate(async () => (await loadNotes())[0]);
  expect(n.fileName).toBe('2026-10-01 08-30.mp3');
  expect(n.hasAudio).toBe(true);
});
