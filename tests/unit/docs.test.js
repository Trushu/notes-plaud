'use strict';
// Documentation : liens internes valides, fichiers cités présents, version des Nouveautés à jour
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const DOCS = ['LISEZMOI.md', 'GUIDE-EXAMEN.md', 'AMELIORATIONS.md', 'tests/README.md'];
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

// Ancre d'un titre, comme GitHub : minuscules, ponctuation retirée (lettres accentuées gardées), espaces → tirets
const slug = (h) => h.trim().toLowerCase().replace(/[^\p{L}\p{N}\- _]/gu, '').replace(/ /g, '-');
const anchors = (md) => new Set(md.split('\n').filter((l) => /^#{1,6}\s/.test(l)).map((l) => slug(l.replace(/^#+\s*/, ''))));

test.describe('Documentation (Doc1, Doc2)', () => {
  test('chaque lien interne mène à un fichier et à un titre qui existent', () => {
    const bad = [];
    for (const f of DOCS) {
      const md = read(f), dir = path.dirname(f);
      for (const [, target] of md.matchAll(/\]\(([^)\s]+)\)/g)) {
        if (/^(https?:|mailto:)/.test(target)) continue;
        const [file, hash] = target.split('#');
        const dest = file ? path.normalize(path.join(dir, file)) : f;
        if (!fs.existsSync(path.join(ROOT, dest))) { bad.push(`${f} → ${target} (fichier absent)`); continue; }
        if (hash && dest.endsWith('.md') && !anchors(read(dest)).has(decodeURIComponent(hash))) bad.push(`${f} → ${target} (titre absent)`);
      }
    }
    assert.deepEqual(bad, []);
  });

  test('le calcul des ancres suit la règle de GitHub', () => {
    assert.equal(slug("Étape 2 : mettre l'app en ligne sur GitHub Pages (5 min, plus simple sur PC)"), 'étape-2--mettre-lapp-en-ligne-sur-github-pages-5-min-plus-simple-sur-pc');
    assert.equal(slug('Rechercher, épingler, sauvegarder'), 'rechercher-épingler-sauvegarder');
  });

  test('LISEZMOI commence par le démarrage en 5 étapes et les Nouveautés de la version actuelle', () => {
    const md = read('LISEZMOI.md'), html = read('index.html');
    const v = /const APP_VERSION = '(\d+)/.exec(html)[1];
    const iStart = md.indexOf('## Démarrer en 5 étapes'), iNew = md.indexOf('## Nouveautés'), iInstall = md.indexOf('## Étape 1');
    assert.ok(iStart > 0 && iStart < iNew && iNew < iInstall, 'ordre : démarrage, nouveautés, installation détaillée');
    const steps = md.slice(iStart, iNew).match(/^\d\. /gm) || [];
    assert.equal(steps.length, 5);
    assert.match(md.slice(iNew, iNew + 80), new RegExp(`version ${v}\\b`), 'les Nouveautés citent la version de l\'app');
  });

  test('les fichiers à déposer sur GitHub Pages existent tous', () => {
    const md = read('LISEZMOI.md');
    const line = md.split('\n').find((l) => l.includes('Glisse les **9 fichiers**'));
    const files = [...line.matchAll(/`([\w.-]+\.(?:html|js|webmanifest|png))`/g)].map((m) => m[1]).filter((f) => f !== 'relais-plaud-cloudflare.js');
    assert.equal(files.length, 9);
    for (const f of files) assert.ok(fs.existsSync(path.join(ROOT, f)), f);
  });
});
