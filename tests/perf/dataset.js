// @ts-check
'use strict';
/*
 * Jeu de données réaliste pour les mesures de performance, généré DANS la page (pas de transfert de 100 Mo) :
 * 500 notes, dont un cinquième d'enregistrements de 3 h (transcription brute + améliorée + cours rédigé),
 * le reste d'une heure. Vocabulaire pseudo-français de quelques milliers de mots, graine fixe (reproductible).
 */
function generate({ n = 500, long = 100, seed = 42 } = {}) {
  let x = seed;
  const rnd = () => { x = (x * 1103515245 + 12345) & 0x7fffffff; return x / 0x7fffffff; };
  const syl = ['ra', 'té', 'lo', 'mi', 'son', 'per', 'ca', 'tion', 'vé', 'gu', 'que', 'ment', 'dé', 'fi', 'cour', 'bé', 'nu', 'ar', 'pli', 'zo', 'ex', 'ter', 'ma', 'gré', 'sio'];
  const vocab = [];
  for (let i = 0; i < 4000; i++) { let w = ''; const k = 1 + Math.floor(rnd() * 3); for (let j = 0; j < k; j++) w += syl[Math.floor(rnd() * syl.length)]; vocab.push(w); }
  const common = ['le', 'la', 'de', 'et', 'que', 'on', 'est', 'donc', 'alors', 'pour', 'une', 'des', 'qui', 'dans', 'avec'];
  const word = () => (rnd() < 0.45 ? common[Math.floor(rnd() * common.length)] : vocab[Math.floor(Math.pow(rnd(), 2.2) * vocab.length)]);
  const sentence = (len) => { const a = []; for (let i = 0; i < len; i++) a.push(word()); const s = a.join(' '); return s[0].toUpperCase() + s.slice(1) + '.'; };
  const notes = [];
  const t0 = Date.UTC(2025, 8, 1, 7, 0);
  for (let i = 0; i < n; i++) {
    const isLong = i % Math.round(n / long) === 0;
    const dur = isLong ? 3 * 3600 : 3600;
    const segs = [];
    for (let t = 0; t < dur; t += 5 + rnd() * 3) segs.push({ start: t, end: t + 5, text: sentence(10 + Math.floor(rnd() * 8)) });
    const note = {
      id: 'p' + i.toString(36).padStart(4, '0'), created: t0 + i * 14 * 3600000, addedAt: t0 + i * 14 * 3600000, fileName: `cours-${i}.mp3`, size: dur * 8000,
      title: `Cours ${i} : ${word()} et ${word()}`, status: 'ok', duration: dur, tags: [vocab[i % 40], vocab[(i * 7) % 40]],
      summary: `## Résumé\n${sentence(60)}\n## Points clés\n- ${sentence(12)}\n- ${sentence(12)}\n## À retravailler à la maison\n- [ ] ${sentence(6)} 📅 2026-10-${String(1 + (i % 28)).padStart(2, '0')}\n- [${i % 3 ? ' ' : 'x'}] ${sentence(5)}\n## Questions pour réviser\n- ${sentence(8)} ? → ${sentence(6)}`,
      segments: segs,
    };
    if (isLong) {
      const clean = [];
      for (let k = 0; k < segs.length; k += 6) clean.push({ start: segs[k].start, text: segs.slice(k, k + 6).map((s) => s.text).join(' ') });
      note.clean = clean;
      note.lecture = Array.from({ length: 60 }, (_, k) => `## Partie ${k}\n${sentence(120)}`).join('\n\n');
      note.cards = Array.from({ length: 20 }, (_, k) => ({ id: `c${i}-${k}`, q: sentence(8) + ' ?', a: sentence(10), box: 0, due: 0 }));
    }
    notes.push(note);
  }
  // un mot rare présent dans une seule transcription, pour mesurer une recherche « aiguille dans une botte de foin »
  notes[n - 7].segments[Math.floor(notes[n - 7].segments.length / 2)].text += ' anticonstitutionnellement établi.';
  return notes;
}
module.exports = { generate };
