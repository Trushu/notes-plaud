// @ts-check
'use strict';
// Questions hors ligne (feuille de route F4) : gardées, puis envoyées toutes seules au retour du réseau
const { test, expect, useSettings, seedNotes, note, SUMMARY } = require('./fixtures');

const ANSWER = 'Le prof a défini le **théorème de Gauss** [00:05].';
const seg = [{ start: 0, end: 4, text: 'Bonjour.' }, { start: 5, end: 12, text: 'Le théorème de Gauss relie le flux et la charge.' }];

test.describe('Questions hors ligne (F4)', () => {
  test.beforeEach(async ({ page, mocks }) => {
    mocks.summary = (p) => (/Question : /.test(p) ? ANSWER : SUMMARY);
    await useSettings(page, { key: 'gsk_test' });
    await page.goto('./');
    await seedNotes(page, [note({ id: 'nQ', title: 'Électrostatique', segments: seg })]);
  });

  test('sans réseau : la question attend, puis part toute seule au retour de la connexion', async ({ page, mocks }) => {
    await page.evaluate(() => openNote('nQ'));
    await page.locator('#askBtn').click();
    await page.context().setOffline(true);
    await page.locator('#askInput').fill('Qu\'a dit le prof sur Gauss ?');
    await page.locator('#askSend').click();
    await expect(page.locator('#toast')).toContainText('Hors connexion');
    await expect(page.locator('#askList .ask-wait')).toContainText('partira toute seule');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('np-askq')).map((x) => [x.q, x.scope, x.noteId]))).toEqual([['Qu\'a dit le prof sur Gauss ?', 'note', 'nQ']]);
    expect(mocks.calls.chat.length).toBe(0);

    await page.context().setOffline(false);
    await expect(page.locator('#askList .msg.ai .md')).toContainText('théorème de Gauss', { timeout: 15000 });
    await expect(page.locator('#askList .ts')).toHaveCount(1);   // horodatage cliquable
    await expect(page.locator('#askList .ask-wait')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('np-askq'))).toBe('[]');
    expect(await page.evaluate(async () => (await db.get('nQ')).chat.map((m) => m.q))).toEqual(['Qu\'a dit le prof sur Gauss ?']);
  });

  test('une question gardée (app fermée pendant l\'envoi) repart à la réouverture ; « Voir » ouvre la réponse', async ({ page, mocks }) => {
    await page.evaluate(() => localStorage.setItem('np-askq', JSON.stringify([{ id: 'q1', q: 'Résume le cours', at: Date.now(), scope: 'note', noteId: 'nQ', course: null }])));
    await page.reload();
    await expect(page.locator('#toast')).toContainText('Réponse prête', { timeout: 15000 });
    await page.locator('#toast .toast-act').click();
    await expect(page.locator('#v-ask')).toBeVisible();
    await expect(page.locator('#askList .msg.ai .md')).toContainText('théorème de Gauss');
    expect(await page.evaluate(() => localStorage.getItem('np-askq'))).toBe('[]');
    expect(mocks.calls.chat.length).toBe(1);
  });

  test('annuler une question en attente ; la file d\'attente de l\'accueil la montre', async ({ page, mocks }) => {
    await page.context().setOffline(true);
    await page.evaluate(() => { currentNote = null; openAsk('all', 'home'); });
    await page.locator('#askInput').fill('De quoi ai-je parlé cette semaine ?');
    await page.locator('#askSend').click();
    await expect(page.locator('#askList .ask-wait')).toHaveCount(1);
    await page.evaluate(() => show('home'));
    await expect(page.locator('#homeQueue')).toContainText('1 question à envoyer');
    await page.locator('#hqGo').click();
    await expect(page.locator('#sheet')).toContainText('Questions à envoyer (1)');
    await expect(page.locator('#sheet')).toContainText('Partira au retour du réseau');
    await page.locator('#sheet [data-aqrm]').click();
    await expect(page.locator('#toast')).toContainText('Question retirée');
    expect(await page.evaluate(() => localStorage.getItem('np-askq'))).toBe('[]');
    await page.context().setOffline(false);
    await page.waitForTimeout(2500);
    expect(mocks.calls.chat.length).toBe(0);
  });

  test('en ligne : la réponse arrive comme avant, et une question posée pendant un traitement attend son tour', async ({ page, mocks }) => {
    await page.evaluate(() => openNote('nQ'));
    await page.locator('#askBtn').click();
    await page.evaluate(() => { busy = true; });
    await page.locator('#askInput').fill('Première question');
    await page.locator('#askSend').click();
    await expect(page.locator('#toast')).toContainText('ta question partira dès qu\'il sera fini');
    await expect(page.locator('#askList .ask-wait')).toContainText('partira juste après');
    await page.evaluate(() => { busy = false; flushAskQ(); });
    await expect(page.locator('#askList .msg.ai .md')).toHaveCount(1);
    await page.locator('#askInput').fill('Deuxième question');
    await page.locator('#askSend').click();
    await expect(page.locator('#askList .msg.ai .md')).toHaveCount(2);
    expect(await page.evaluate(async () => (await db.get('nQ')).chat.map((m) => m.q))).toEqual(['Première question', 'Deuxième question']);
  });
});
