// @ts-check
'use strict';
/*
 * Accessibilité : audit axe-core (règles WCAG 2.1 et 2.2 niveau AA) de tous les écrans, dans les 8 thèmes,
 * plus des vérifications que l'outil ne fait pas (libellés, clavier, lecteur d'écran).
 */
const { AxeBuilder } = require('@axe-core/playwright');
const { test, expect, mp3, useSettings, seedNotes, note, serveKatex, SUMMARY } = require('./fixtures');

// micro simulé par Chromium (écran d'enregistrement)
test.use({ permissions: ['microphone'], launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] } });

const THEMES = ['light', 'dark', 'parchemin', 'ocean', 'foret', 'nuit', 'prune'];
const REPORT = !!process.env.A11Y_REPORT;

async function audit(page, where, out) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  for (const v of r.violations) for (const n of v.nodes) out.push(`${where} · ${v.id} · ${n.target.join(' ')} · ${(n.any[0] || n.all[0] || n.none[0] || {}).message || v.help}`);
}

/** Le même écran, audité dans chacun des 8 thèmes. */
async function auditThemes(page, where, out) {
  for (const t of ['auto', ...THEMES]) { await page.evaluate((x) => applyTheme(x, false), t); await audit(page, `${t} ${where}`, out); }
  await page.evaluate(() => applyTheme('auto', false));
}

function report(scheme, out) {
  const key = (x) => { const [w, id, target, msg] = x.split(' · '); const m = /contrast of ([\d.]+) \(foreground color: (#\w+), background color: (#\w+)/.exec(msg || ''); return id === 'color-contrast' && m ? `${w} contraste ${m[1]} ${m[2]} sur ${m[3]} (${target})` : `${w} ${id} ${target}`; };
  const seen = new Map(); for (const x of out) { const k = key(x).replace(/ \(.*\)$/, ''); if (!seen.has(k)) seen.set(k, key(x)); }
  console.log(`\nAXE ${scheme} : ${out.length} problème(s)\n` + [...seen.values()].join('\n'));
}

async function prepare(page) {
  const now = Date.now(), st = (t) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  await page.goto('./');
  await seedNotes(page, [
    note({ id: 'nA', title: 'Algorithmique : les graphes', tags: ['algo', 'graphes'], pinned: true, summary: `# T\n## Résumé\nLe cours présente les **graphes** et la formule $x^2$.\n## Points clés\n- Un sommet\n## À retravailler à la maison\n- [ ] Refaire l'exercice 3 ⏫ 📅 2020-01-01\n- [x] Lire le chapitre\n## Questions pour réviser\n- Qu'est-ce qu'un graphe ? → Des sommets et des arêtes`,
      segments: [{ start: 0, end: 5, text: 'Bonjour à tous.' }, { start: 5, end: 9, text: 'On parle de graphes.' }], lecture: '## Partie 1\nTexte\n## Partie 2\nTexte\n## Partie 3\nTexte',
      chapters: [{ t: 0, title: 'Début' }, { t: 5, title: 'Graphes' }], marks: [5], mine: 'Mes **notes**', cards: [{ id: 'c1', q: 'Q ?', a: 'R', box: 0, due: 0 }],
      chat: [{ q: 'De quoi parle le cours ?', a: 'Des graphes [0:05].', at: now, by: 'gemini', notes: ['nA'] }], course: { key: 'INFO', name: 'Algorithmique', kind: 'cours', start: now - 3600000, end: now, uid: 'c1' } }),
    note({ id: 'nB', title: 'Réunion projet', status: 'err', error: 'Clé API Groq refusée', summary: '' }),
  ]);
  await page.evaluate((t) => saveAgendaText(t, 'file'), ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:c1', 'SUMMARY:Algorithmique', 'CATEGORIES:INFO', `DTSTART:${st(now - 3600000)}`, `DTEND:${st(now + 3600000)}`, 'LOCATION:Salle 1', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:d1', 'SUMMARY:Rapport est dû', `DTSTART:${st(now + 86400000)}`, `DTEND:${st(now + 86400000)}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n'));
  await page.evaluate(() => addTask({ text: 'Tâche manuelle', due: null, tags: ['perso'], prio: 0 }));
  await page.evaluate(() => renderHome());
}

async function tour(page, theme, out) {
  await page.evaluate((t) => applyTheme(t, true), theme);
  await page.locator('#tabbar [data-v=home]').click();
  await audit(page, `${theme} accueil`, out);
  await page.locator('#homeMode [data-mode=cal]').click(); await audit(page, `${theme} calendrier`, out); await page.locator('#homeMode [data-mode=list]').click();
  await page.locator('#notesList .item', { hasText: 'Algorithmique' }).click();
  await audit(page, `${theme} note`, out);
  await page.getByRole('tab', { name: 'Transcription' }).click(); await audit(page, `${theme} transcription`, out);
  await page.getByRole('tab', { name: 'Cours' }).click(); await audit(page, `${theme} cours rédigé`, out);
  await page.getByRole('tab', { name: 'Résumé' }).click();
  await page.locator('#askBtn').click(); await audit(page, `${theme} questions`, out);
  await page.locator('#backBtn').click(); await page.locator('#backBtn').click();
  await page.locator('#tabbar [data-v=tasks]').click(); await audit(page, `${theme} tâches`, out);
  await page.locator('#fab').click(); await page.waitForTimeout(300); await audit(page, `${theme} fiche tâche`, out);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await page.locator('#tabbar [data-v=courses]').click(); await audit(page, `${theme} cours`, out);
  await page.locator('#crsBody .mat').first().click(); await audit(page, `${theme} matière`, out);
  await page.locator('#cVocab').click(); await page.waitForTimeout(300); await audit(page, `${theme} vocabulaire`, out); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await page.locator('#backBtn').click();
  await page.locator('#tabbar [data-v=home]').click();
  await page.locator('#settingsBtn').click(); await audit(page, `${theme} réglages`, out);
  await page.locator('#backBtn').click();
}

test.describe('Audit axe-core (WCAG 2.2 AA)', () => {
  test.setTimeout(240000);
  for (const scheme of ['light', 'dark']) {
    test(`tous les écrans, 8 thèmes (téléphone en mode ${scheme === 'dark' ? 'sombre' : 'clair'})`, async ({ page, mocks }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });   // couleurs finales, sans les fondus d'apparition
      await serveKatex(page);
      await useSettings(page, { key: 'gsk_test' });
      await prepare(page);
      const out = [];
      await tour(page, 'auto', out);
      if (scheme === 'light') for (const t of THEMES) await tour(page, t, out);
      if (REPORT) report(scheme, out);
      else expect(out, out.slice(0, 40).join('\n')).toEqual([]);
    });
  }
});

test.describe('Audit axe-core : autres écrans et fenêtres', () => {
  test.setTimeout(300000);

  test('premier lancement, traitement, erreur, recherche, sélection, fenêtres, révision, photo, enregistrement', async ({ page, mocks }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const out = [];
    await page.goto('./');
    await expect(page.locator('#onboard')).toBeVisible();
    await auditThemes(page, 'premier lancement', out);
    await page.locator('#onboardBtn').click();
    await expect(page.locator('#wzKey')).toBeVisible();
    await page.locator('#wzKey').fill('x'); await page.locator('#wzGo').click();
    await expect(page.locator('#wzRes')).toContainText('refusée');
    await auditThemes(page, 'premier lancement guidé', out);
    await page.keyboard.press('Escape');

    await useSettings(page, { key: 'gsk_test', gkey: 'AIza_test', prelay: 'https://relais.test', ptoken: 'a.b.c', pauto: false });
    let release;
    const gate = new Promise((r) => { release = r; });
    mocks.fail = async (route, kind) => {
      if (kind !== 'transcribe') return false;
      await gate; await route.fulfill({ status: 401, json: { error: { message: 'Invalid API Key' } } }); return true;
    };
    await page.goto('./');
    await page.locator('#fileInput').setInputFiles({ name: 'cours.mp3', mimeType: 'audio/mpeg', buffer: mp3(1) });
    await expect.poll(() => mocks.calls.transcribe.length).toBe(1);
    await auditThemes(page, 'traitement', out);
    release();
    await expect(page.locator('#jobError')).toBeVisible();
    await auditThemes(page, 'erreur de traitement', out);
    await page.locator('#jobHome').click();
    mocks.fail = null;

    await prepare(page);
    await page.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 40; c.height = 30;
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      await dbRun('pending', 'readwrite', (st) => st.put(blob, 'img:p1'));
      const n = await db.get('nA'); n.photos = [{ id: 'p1', t: 5, at: Date.now(), text: '$x^2$ au tableau' }]; await db.put(n);
    });
    await page.locator('#search').fill('parle');
    await expect(page.locator('#notesList mark').first()).toBeVisible();
    await auditThemes(page, 'recherche', out);
    await page.locator('#search').fill('');
    await page.locator('#selectBtn').click();
    await page.locator('#notesList .item').first().click();
    await auditThemes(page, 'sélection', out);
    await page.locator('#selectBtn').click();

    await page.locator('#plaudBtn').click();
    await expect(page.locator('#sheet')).toBeVisible();
    await auditThemes(page, 'import Plaud', out);
    await page.keyboard.press('Escape');
    await expect(page.locator('#homeRev')).toContainText('à réviser');
    await page.locator('#hrStats').click();
    await expect(page.locator('#sheet .rs-tiles')).toBeVisible();
    await auditThemes(page, 'statistiques de révision', out);
    await page.keyboard.press('Escape');
    await page.evaluate(() => { lsSet('np-crs', JSON.stringify({ INFO: { exam: dayKey(Date.now() + 6 * 86400000) } })); MATS = null; return renderHome(); });
    await expect(page.locator('#homeExam')).toContainText('dans 6 jours');
    await page.locator('#heGo').click();
    await expect(page.locator('#sheet .pl-day').first()).toBeVisible();
    await auditThemes(page, 'planning d\'examen', out);
    await page.keyboard.press('Escape');

    await page.locator('#notesList .item[data-id="nA"]').click();
    await page.locator('#stCards').click();
    await auditThemes(page, 'fenêtre fiches', out);
    await page.locator('#cmList').click();
    await auditThemes(page, 'liste des fiches', out);
    await page.locator('[data-ed="c1"]').click();
    await auditThemes(page, 'modifier une fiche', out);
    await page.keyboard.press('Escape');
    await page.locator('#stCards').click();
    await page.locator('#cmGo').click();
    await auditThemes(page, 'révision (question)', out);
    await page.locator('#rvShow').click();
    await auditThemes(page, 'révision (réponse)', out);
    await page.locator('[data-g="2"]').click();
    await auditThemes(page, 'révision terminée', out);
    await page.locator('#rvEnd').click();

    const qzItems = [{ q: 'Que vaut $x^2$ en 2 ?', choices: ['2', '4', '8', '16'], ok: 1, why: 'Deux fois deux.', t: '0:05' }, { q: 'Un graphe ?', choices: ['Sommets et arêtes', 'Une liste', 'Un nombre', 'Un arbre'], ok: 0, why: '' }, { q: 'Un arbre ?', choices: ['Graphe connexe sans cycle', 'Une liste', 'Un tas', 'Un nombre'], ok: 0, why: '' }];
    mocks.summary = (p) => (/^Tu prépares un quiz/.test(p) ? JSON.stringify(qzItems) : SUMMARY);
    await page.locator('#stQuiz').click();
    await auditThemes(page, 'fenêtre quiz', out);
    await page.locator('#qzNew').click();
    await expect(page.locator('.qz-card')).toBeVisible();
    await auditThemes(page, 'quiz (question)', out);
    await page.locator('.qz-ch').first().click();
    await auditThemes(page, 'quiz (correction)', out);
    await page.evaluate(() => { qz.i = qz.items.length; drawQuiz(); });
    await auditThemes(page, 'quiz (résultat)', out);
    await page.locator('#qzEnd').click();

    await page.locator('#phStrip [data-ph]').click();
    await expect(page.locator('#lightbox')).toBeVisible();
    await auditThemes(page, 'photo', out);
    await page.keyboard.press('Escape');
    // passage en cours de lecture (et marqué) dans la transcription, bulle « Expliquer » d'un texte sélectionné : états simulés
    await page.getByRole('tab', { name: 'Transcription', exact: true }).click();
    await page.evaluate(() => { document.querySelector('#noteTr .seg').classList.add('now', 'mark'); $('selAsk').classList.remove('hidden'); });
    await auditThemes(page, 'lecture en cours, sélection', out);
    await page.evaluate(() => $('selAsk').classList.add('hidden'));
    await page.locator('#backBtn').click();

    await page.locator('#recBtn').click();
    await expect(page.locator('#recTime')).not.toHaveText('0:00', { timeout: 5000 });
    await auditThemes(page, 'enregistrement', out);
    page.once('dialog', (d) => d.accept());
    await page.locator('#recCancel').click();

    if (REPORT) report('autres écrans', out);
    else expect(out, out.slice(0, 40).join('\n')).toEqual([]);
  });
});

test('contours des champs et des cases à cocher : contraste ≥ 3:1 dans les 8 thèmes (axe ne le vérifie pas)', async ({ page, mocks }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });   // pas de transition de couleur en changeant de thème
  await useSettings(page, { key: 'gsk_test' });
  await prepare(page);
  await page.locator('#tabbar [data-v=tasks]').click();
  const res = await page.evaluate((themes) => {
    const rgb = (c) => {   // « rgb(…) » ou « color(srgb …) » (couleurs calculées par color-mix)
      const n = (c.match(/-?[\d.]+(e-?\d+)?/g) || []).map(Number);
      if (!n.length) throw new Error('couleur illisible : ' + c);
      return /^color\(/.test(c) ? n.slice(0, 3).map((x) => x * 255) : n.slice(0, 3);
    };
    const lum = (c) => { const [r, g, b] = rgb(c).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const probe = document.createElement('div'); document.body.append(probe);
    const tok = (name) => { probe.style.color = `var(${name})`; return getComputedStyle(probe).color; };
    const out = [];
    for (const t of themes) {
      applyTheme(t, false);
      const fields = [['champ de saisie', getComputedStyle(document.querySelector('#search')).borderTopColor], ['case à cocher', getComputedStyle(document.querySelector('#v-tasks .tck:not(:checked)')).borderTopColor]];
      for (const [what, c] of fields) for (const bg of ['--bg', '--surface', '--surface-2']) out.push({ t, what, bg, r: Math.round(ratio(c, tok(bg)) * 100) / 100 });
    }
    probe.remove(); applyTheme('auto', false);
    return out;
  }, ['auto', ...THEMES]);
  const bad = res.filter((x) => x.r < 3);
  expect(bad, bad.map((x) => `${x.t} ${x.what} sur ${x.bg} : ${x.r}`).join('\n')).toEqual([]);
});

test.describe('Clavier et lecteur d\'écran', () => {
  const focused = (page) => page.evaluate(() => { const a = document.activeElement; return a ? (a.id ? '#' + a.id : a.getAttribute('aria-label') || a.textContent.trim().slice(0, 40)) : null; });

  test('« Nouvel enregistrement » s\'ouvre au clavier, comme au doigt', async ({ page, mocks }) => {
    await useSettings(page, { key: 'gsk_test' });
    await page.goto('./');
    const hero = page.getByRole('button', { name: /Nouvel enregistrement/ });
    await hero.focus();
    const chooser = page.waitForEvent('filechooser');
    await page.keyboard.press('Enter');
    await chooser;
  });

  test('changer d\'écran met le focus sur son titre ; les onglets et filtres disent leur état', async ({ page, mocks }) => {
    await useSettings(page, { key: 'gsk_test' });
    await prepare(page);
    await page.locator('#tabbar [data-v=tasks]').click();
    await expect(page.locator('#tabbar [data-v=tasks]')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#v-tasks h1')).toBeFocused();
    await page.locator('#tabbar [data-v=home]').click();
    await expect(page.locator('#greet')).toBeFocused();
    // filtre par tag : état annoncé, focus gardé sur le même bouton
    const algo = page.locator('#tagBar [data-t="algo"]');
    await expect(algo).toHaveAttribute('aria-pressed', 'false');
    await algo.focus(); await page.keyboard.press('Enter');
    await expect(page.locator('#tagBar [data-t="algo"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#tagBar [data-t="algo"]')).toBeFocused();
    await page.keyboard.press('Enter');
    // recherche : le nombre de résultats est annoncé
    await page.locator('#search').fill('graphes');
    await expect(page.locator('#srLive')).toHaveText('1 note trouvée');
    await page.locator('#search').fill('');
    // ouvrir une note : focus sur son titre ; onglets au clavier (flèches)
    await page.locator('#notesList .item[data-id="nA"]').click();
    await expect(page.locator('#noteTitle')).toBeFocused();
    const tab = (name) => page.getByRole('tab', { name, exact: true });
    await tab('Résumé').focus();
    await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');   // navigation au clavier
    await page.keyboard.press('ArrowRight');
    await expect(tab('Transcription')).toHaveAttribute('aria-selected', 'true');
    await expect(tab('Transcription')).toBeFocused();
    await page.keyboard.press('End');
    await expect(tab('Cours')).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Home');
    await expect(tab('Résumé')).toHaveAttribute('aria-selected', 'true');
  });

  test('fenêtres : le focus y entre, Tab y reste, Échap ferme et rend le focus au bouton', async ({ page, mocks }) => {
    await useSettings(page, { key: 'gsk_test' });
    await prepare(page);
    await page.locator('#tabbar [data-v=tasks]').click();
    await page.locator('#fab').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#sheet')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.getElementById('sheet').contains(document.activeElement))).toBe(true);
    await expect(page.locator('#sheet')).toHaveAccessibleName(/tâche/i);
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => document.getElementById('sheet').contains(document.activeElement)), `Tab n° ${i + 1} : ${await focused(page)}`).toBe(true);
    }
    // priorité : groupe d'options, flèches
    const prio = page.locator('#tPrio [role="radio"]');
    await prio.first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(prio.nth(1)).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Escape');
    await expect(page.locator('#sheet')).toBeHidden();
    await expect(page.locator('#fab')).toBeFocused();
    // une tâche s'ouvre avec Entrée
    const row = page.locator('.titem .tbody', { hasText: 'Tâche manuelle' });
    await row.focus(); await page.keyboard.press('Enter');
    await expect(page.locator('#sheet')).toBeVisible();
    await expect(page.locator('#tText')).toHaveValue('Tâche manuelle');
    await page.keyboard.press('Escape');
    await expect(row).toBeFocused();
  });

  test('photo et fiches de révision : focus déplacé là où ça se passe', async ({ page, mocks }) => {
    await useSettings(page, { key: 'gsk_test' });
    await prepare(page);
    await page.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 40; c.height = 30;
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      await dbRun('pending', 'readwrite', (st) => st.put(blob, 'img:p1'));
      const n = await db.get('nA'); n.photos = [{ id: 'p1', t: 5, at: Date.now(), text: 'Tableau' }]; await db.put(n);
    });
    await page.locator('#notesList .item[data-id="nA"]').click();
    const thumb = page.locator('#phStrip [data-ph]');
    await thumb.focus(); await page.keyboard.press('Enter');
    await expect(page.locator('#lbClose')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#lightbox')).toBeHidden();
    await expect(thumb).toBeFocused();

    await page.locator('#stCards').click();
    await page.locator('#cmGo').click();
    await page.locator('#rvShow').focus(); await page.keyboard.press('Enter');
    await expect(page.locator('.rv-a')).toBeFocused();
    await expect(page.getByRole('button', { name: /^Je savais, / })).toBeVisible();
  });

  test('raccourcis du lecteur audio : ils ne volent pas Entrée / Espace au bouton qui a le focus', async ({ page, mocks }) => {
    await useSettings(page, { key: 'gsk_test' });
    await page.goto('./');
    await seedNotes(page, [note({ id: 'nP', title: 'Avec audio', duration: 2 })]);
    await page.evaluate(async () => { await audioDB.put('nP', new Blob([new Uint8Array(400)], { type: 'audio/mpeg' })); });
    await page.locator('#notesList .item[data-id="nP"]').click();
    await expect.poll(() => page.evaluate(() => !!(pl.parts && pl.parts.length))).toBe(true);
    const tab = page.getByRole('tab', { name: 'Transcription', exact: true });
    await tab.focus();
    await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Space');
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    expect(await page.evaluate(() => pl.el ? pl.el.paused : true)).toBe(true);
  });
});
