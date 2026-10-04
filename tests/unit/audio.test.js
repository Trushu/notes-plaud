'use strict';
// Découpage des longs fichiers audio avant l'envoi à Groq (25 Mo maximum par envoi)
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../helpers/load-app');

const { app, run } = loadApp();

// Trames MP3 valides (MPEG-1 Layer III, 128 kb/s, 44,1 kHz) : 417 octets, 1152 échantillons chacune
const FRAME = 417, FRAME_SEC = 1152 / 44100;
function frame() { const b = new Uint8Array(FRAME); b[0] = 0xFF; b[1] = 0xFB; b[2] = 0x90; b[3] = 0x00; return b; }
function mp3(nFrames, mutate) {
  const out = new Uint8Array(nFrames * FRAME);
  for (let i = 0; i < nFrames; i++) out.set(frame(), i * FRAME);
  if (mutate) mutate(out);
  return new File([out], 'cours.mp3', { type: 'audio/mpeg' });
}
async function parts(file) {
  const fns = await app.splitAudio(file);
  const out = [];
  for (const f of fns) out.push(await f());
  return out;
}

test.describe('splitAudio (MP3)', () => {
  test.beforeEach(() => run('CONFIG.maxAudioChunk = 10000'));

  test('petit fichier : envoyé tel quel', async () => {
    run('CONFIG.maxAudioChunk = 20 * 1024 * 1024');
    const p = await parts(mp3(10));
    assert.equal(p.length, 1);
  });

  test('coupe sur un début de trame, sans perte ni chevauchement', async () => {
    const f = mp3(100);
    const p = await parts(f);
    assert.ok(p.length >= 4);
    let total = 0, dur = 0;
    for (const x of p) {
      const b = new Uint8Array(await x.blob.arrayBuffer());
      assert.equal(b[0], 0xFF); assert.equal(b[1], 0xFB);
      assert.ok(x.blob.size <= 10000 + 16384);
      total += x.blob.size; dur += x.duration;
    }
    assert.equal(total, f.size);
    assert.ok(Math.abs(dur - 100 * FRAME_SEC) < 1e-6, `durée ${dur}`);
  });
});

test.describe('Bugs corrigés : découpage MP3', () => {
  test.beforeEach(() => run('CONFIG.maxAudioChunk = 10000'));

  test('une fausse synchronisation dans les données n\'est pas prise pour un début de trame', async () => {
    // octets FF FB 90 juste après la limite de coupe, au milieu d'une trame
    const f = mp3(60, (b) => { const o = 10000 + 5; b[o] = 0xFF; b[o + 1] = 0xFB; b[o + 2] = 0x90; });
    const p = await parts(f);
    let pos = 0;
    for (const x of p) {
      assert.equal(pos % FRAME, 0, `coupe au milieu d'une trame (octet ${pos})`);
      pos += x.blob.size;
    }
    const dur = p.reduce((a, x) => a + x.duration, 0);
    assert.ok(Math.abs(dur - 60 * FRAME_SEC) < 1e-6, `durée ${dur}`);
  });

  test('un dernier morceau minuscule est rattaché au précédent (Groq refuse les fichiers presque vides)', async () => {
    const f = mp3(Math.ceil(20000 / FRAME) + 1);   // un peu plus de 2 × la taille maximale
    const p = await parts(f);
    assert.ok(p.every((x) => x.blob.size > 2000), p.map((x) => x.blob.size).join(', '));
    assert.equal(p.reduce((a, x) => a + x.blob.size, 0), f.size);
  });
});

test.describe('Bugs corrigés : découpage WAV', () => {
  function wav(frames, rate = 16000) {
    const data = new Uint8Array(frames * 2), h = new DataView(new ArrayBuffer(44));
    const w = (o, t) => [...t].forEach((c, i) => h.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); h.setUint32(4, 36 + data.length, true); w(8, 'WAVE'); w(12, 'fmt '); h.setUint32(16, 16, true);
    h.setUint16(20, 1, true); h.setUint16(22, 1, true); h.setUint32(24, rate, true); h.setUint32(28, rate * 2, true);
    h.setUint16(32, 2, true); h.setUint16(34, 16, true); w(36, 'data'); h.setUint32(40, data.length, true);
    return new File([h.buffer, data], 'cours.wav', { type: 'audio/wav' });
  }

  test('morceaux WAV valides, dernier morceau minuscule rattaché', async () => {
    run('CONFIG.maxAudioChunk = 10064');
    const f = wav(10000 + 30);   // 2 morceaux de 5000 échantillons + 30 échantillons
    const p = await parts(f);
    assert.equal(p.length, 2);
    for (const x of p) {
      const b = new Uint8Array(await x.blob.arrayBuffer());
      assert.equal(String.fromCharCode(...b.slice(0, 4)), 'RIFF');
      assert.equal(new DataView(b.buffer).getUint32(40, true), x.blob.size - 44);
    }
    assert.ok(Math.abs(p.reduce((a, x) => a + x.duration, 0) - 10030 / 16000) < 1e-9);
  });
});
