// @ts-check
'use strict';
// Créer une note à partir d'un fichier audio : transcription (Groq), résumé (Groq ou Gemini), affichage
const { test, expect, mp3, useSettings } = require('./fixtures');

test.describe('Note depuis un fichier audio', () => {
  test('avec Groq seul : transcription, résumé, tâches, date reprise du nom', async ({ page, mocks }) => {
    await useSettings(page, { key: 'gsk_test' });
    await page.goto('./');
    await expect(page.locator('#greet')).toBeVisible();
    await expect(page.locator('#onboard')).toBeHidden();

    await page.locator('#fileInput').setInputFiles({ name: '2026-10-01 08-30.mp3', mimeType: 'audio/mpeg', buffer: mp3(2) });

    // la note s'ouvre toute seule quand c'est prêt
    await expect(page.locator('#noteTitle')).toContainText('Les graphes et la récursivité');
    await expect(page.locator('#noteDate')).toContainText('1 octobre');
    await expect(page.locator('#noteSum .sec.k-points')).toContainText('Un graphe est un ensemble');
    await expect(page.locator('#noteSum .sec.k-home li.task')).toHaveCount(2);
    await expect(page.locator('#noteSum .sec.k-quiz li.qa')).toHaveCount(1);
    await expect(page.locator('#noteTags')).toContainText('algorithmique');

    // appels envoyés aux API
    expect(mocks.calls.transcribe).toHaveLength(1);
    expect(mocks.calls.transcribe[0]).toMatchObject({ model: 'whisper-large-v3', language: 'fr', filename: 'audio-1.mp3' });
    expect(mocks.calls.chat).toHaveLength(1);
    expect(mocks.calls.chat[0].auth).toBe('Bearer gsk_test');
    expect(mocks.calls.chat[0].prompt).toContain('Bonjour à tous.');
    expect(mocks.calls.chat[0].prompt).toContain('jeudi 1 octobre 2026');

    // onglet Transcription
    await page.getByRole('tab', { name: 'Transcription' }).click();
    await expect(page.locator('#noteTr .seg')).toHaveCount(3);
    await expect(page.locator('#noteTr .seg').nth(1)).toContainText('récursivité');

    // retour à l'accueil : la note est listée avec ses tâches
    await page.locator('#backBtn').click();
    const item = page.locator('#notesList .item').first();
    await expect(item).toContainText('Les graphes et la récursivité');
    await expect(item).toContainText('2 à faire');
    await expect(page.locator('#stats')).toContainText('1 note');
  });

  test('avec Gemini : le résumé passe par Gemini, la transcription par Groq', async ({ page, mocks }) => {
    await useSettings(page, { key: 'gsk_test', gkey: 'AIza_test' });
    await page.goto('./');
    await page.locator('#fileInput').setInputFiles({ name: 'cours.mp3', mimeType: 'audio/mpeg', buffer: mp3(2) });
    await expect(page.locator('#noteTitle')).toContainText('Les graphes et la récursivité');
    expect(mocks.calls.transcribe).toHaveLength(1);
    expect(mocks.calls.chat).toHaveLength(0);
    expect(mocks.calls.gemini.length).toBeGreaterThanOrEqual(1);
    expect(mocks.calls.gemini[0]).toMatchObject({ model: 'gemini-3.8-flash', key: 'AIza_test' });
    await expect(page.locator('#noteMeta')).toContainText('gemini-3.8-flash');
  });

  test('sans clé Groq : le fichier est gardé et les réglages s\'ouvrent', async ({ page, mocks }) => {
    await page.goto('./');
    await expect(page.locator('#onboard')).toBeVisible();
    await page.locator('#fileInput').setInputFiles({ name: 'cours.mp3', mimeType: 'audio/mpeg', buffer: mp3(1) });
    await expect(page.locator('#v-settings')).toBeVisible();
    expect(mocks.calls.transcribe).toHaveLength(0);
    await page.locator('#sKey').fill('gsk_ajoutee');
    await page.locator('#sSave').click();
    await expect(page.locator('#notesList .item')).toHaveCount(1);
    await expect(page.locator('#notesList .item')).toContainText('Échec');
    // ouvrir la note relance le traitement
    await page.locator('#notesList .item').click();
    await expect(page.locator('#noteTitle')).toContainText('Les graphes et la récursivité');
    expect(mocks.calls.transcribe).toHaveLength(1);
  });

  test('erreur de clé Groq : message clair et bouton Réessayer', async ({ page, mocks }) => {
    await useSettings(page, { key: 'gsk_mauvaise' });
    let refuse = true;
    mocks.fail = async (route, kind) => {
      if (kind === 'transcribe' && refuse) { await route.fulfill({ status: 401, json: { error: { message: 'Invalid API Key' } } }); return true; }
      return false;
    };
    await page.goto('./');
    await page.locator('#fileInput').setInputFiles({ name: 'cours.mp3', mimeType: 'audio/mpeg', buffer: mp3(1) });
    await expect(page.locator('#jobErrorMsg')).toContainText('Clé API Groq refusée');
    refuse = false;
    await page.locator('#jobRetry').click();
    await expect(page.locator('#noteTitle')).toContainText('Les graphes et la récursivité');
  });
});
