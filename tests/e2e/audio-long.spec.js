// @ts-check
'use strict';
// Longs enregistrements faits avec le téléphone (WebM/Opus) : découpés en morceaux WAV pour Groq
const { test, expect, useSettings } = require('./fixtures');

test.use({ permissions: ['microphone'], launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] } });

/** Enregistre `sec` secondes avec MediaRecorder (micro simulé) et renvoie la durée réelle. */
async function recordWebm(page, sec) {
  return page.evaluate(async (ms) => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 64000 });
    const chunks = []; mr.ondataavailable = (e) => chunks.push(e.data);
    mr.start(1000); await new Promise((r) => setTimeout(r, ms)); mr.stop();
    await new Promise((r) => { mr.onstop = r; });
    stream.getTracks().forEach((t) => t.stop());
    window.__webm = new File(chunks, 'enregistrement.webm', { type: 'audio/webm' });
    return window.__webm.size;
  }, sec * 1000);
}

test('un fichier WebM/Opus plus gros que la limite est découpé en morceaux WAV valides', async ({ page, mocks }) => {
  await page.goto('./');
  const size = await recordWebm(page, 6);
  expect(size).toBeGreaterThan(5000);
  const r = await page.evaluate(async () => {
    CONFIG.maxAudioChunk = 64 + 2 * 16000;   // morceaux de 1 s : 32 Ko, moins que le fichier (~45 Ko)
    const parts = await splitAudio(window.__webm);
    const out = [];
    for (const f of parts) { const p = await f(); if (!p) continue; const b = new Uint8Array(await p.blob.arrayBuffer()); out.push({ dur: p.duration, riff: String.fromCharCode(...b.slice(0, 4)), size: p.blob.size }); }
    return { n: parts.length, out };
  });
  expect(r.n).toBeGreaterThanOrEqual(3);
  for (const p of r.out) { expect(p.riff).toBe('RIFF'); expect(p.size).toBeLessThanOrEqual(64 + 2 * 16000 * 1.1 + 44); }
  const total = r.out.reduce((a, p) => a + p.dur, 0);
  expect(total).toBeGreaterThan(5);
  expect(total).toBeLessThan(7.5);
});

test('« Enregistrer avec le téléphone » : un long enregistrement est transcrit en plusieurs parties', async ({ page, mocks }) => {
  await useSettings(page, { key: 'gsk_test' });
  mocks.transcript = (i) => ({ duration: 1, language: 'fr', segments: [{ start: 0.2, end: 0.8, text: `Partie ${i + 1}.`, no_speech_prob: 0, avg_logprob: 0 }] });
  await page.goto('./');
  await page.evaluate(() => { CONFIG.maxAudioChunk = 64 + 2 * 16000; CONFIG.tpmBudget = 1e9; });   // morceaux de 1 s
  await page.locator('#recBtn').click();
  await expect(page.locator('#recTime')).toHaveText('0:06', { timeout: 15000 });
  await page.locator('#recStop').click();
  await expect(page.locator('#noteTitle')).toContainText('Les graphes', { timeout: 30000 });
  expect(mocks.calls.transcribe.length).toBeGreaterThanOrEqual(3);
  for (const c of mocks.calls.transcribe) { expect(c.filename).toMatch(/^audio-\d+\.wav$/); expect(c.riff).toBeGreaterThan(0); }
  const segs = await page.evaluate(async () => (await db.get((await loadNotes())[0].id)).segments.map((s) => Math.round(s.start * 10) / 10));
  expect(segs.length).toBe(mocks.calls.transcribe.length);
  // horodatages continus : chaque partie commence 1 s après la précédente
  segs.forEach((t, i) => expect(Math.abs(t - (0.2 + i))).toBeLessThan(0.25));
});
