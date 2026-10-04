'use strict';
// Rendu Markdown maison (md) et mise de côté des formules LaTeX (protectMath)
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../helpers/load-app');

const NOW = new Date(2026, 9, 4, 12, 0).getTime();
const { app, run } = loadApp({ now: NOW });
const M = (i) => `\u0000M${i}\u0000`;

test.describe('protectMath', () => {
  test('formules en ligne et en bloc, avec les deux notations', () => {
    const maths = [];
    const out = app.protectMath('Soit $a*b$, puis $$x_1 + x_2$$ et \\(y\\) ou \\[z\\].', maths);
    assert.equal(out, `Soit ${M(2)}, puis ${M(0)} et ${M(3)} ou ${M(1)}.`);
    assert.deepEqual(maths.map((m) => [m.tex, m.display]), [['x_1 + x_2', true], ['z', true], ['a*b', false], ['y', false]]);
    assert.equal(maths[2].raw, '$a*b$');
  });

  test('les prix ne sont pas des formules', () => {
    const maths = [];
    assert.equal(app.protectMath('Le livre coûte $5 et le cahier $10.', maths), 'Le livre coûte $5 et le cahier $10.');
    assert.equal(maths.length, 0);
  });

  test('dollar échappé et dollar entouré d\'espaces', () => {
    const maths = [];
    assert.equal(app.protectMath('Un \\$ littéral et $ a $ non plus', maths), 'Un \\$ littéral et $ a $ non plus');
    assert.equal(maths.length, 0);
  });

  test('une formule ne déborde pas sur la ligne suivante', () => {
    const maths = [];
    app.protectMath('début $a\nb$ fin', maths);
    assert.equal(maths.length, 0);
  });
});

test.describe('md', () => {
  test('titres (niveau 4 ramené à 3), paragraphes, gras, italique, code', () => {
    assert.equal(app.md('# Titre\n#### Sous\nTexte **gras**, *italique* et `code`.'),
      '<h1>Titre</h1><h3>Sous</h3><p>Texte <strong>gras</strong>, <em>italique</em> et <code>code</code>.</p>');
  });

  test('listes à puces et numérotées, séparateurs ignorés', () => {
    assert.equal(app.md('- a\n* b\n• c\n\n---\n1. un\n2) deux'), '<ul><li>a</li><li>b</li><li>c</li></ul><ol><li>un</li><li>deux</li></ol>');
  });

  test('cases à cocher : numérotées dans l\'ordre et cochées', () => {
    const html = app.md('- [ ] Faire A\n- [x] Faire B\n- [X] Faire C');
    assert.deepEqual([...html.matchAll(/data-task="(\d+)" (checked)?/g)].map((m) => [m[1], !!m[2]]), [['0', false], ['1', true], ['2', true]]);
    assert.match(html, /aria-label="Modifier la tâche"/);
    assert.doesNotMatch(app.md('- [ ] A', { i: 0, noEdit: true }), /tedit/);
  });

  test('compteur de tâches partagé entre plusieurs blocs', () => {
    run('globalThis.__ctr = { i: 0 }');
    const b = run("md('- [ ] A', __ctr) + md('- [ ] B', __ctr)");
    assert.equal(run('__ctr.i'), 2);
    assert.match(b, /data-task="0"[\s\S]*data-task="1"/);
  });

  test('échéance d\'une tâche affichée en clair', () => {
    assert.match(app.md('- [ ] Rendre le DM 📅 2026-10-05'), /Demain/);
    assert.match(app.md('- [ ] Rendre le DM 📅 2026-10-01'), /en retard/);
  });

  test('tableau avec alignements', () => {
    assert.equal(app.md('| Nom | Note |\n|:--|--:|\n| **Ana** | 18 |\n| Léo |'),
      '<div class="tbl-wrap"><table><thead><tr><th>Nom</th><th style="text-align:right">Note</th></tr></thead><tbody>'
      + '<tr><td><strong>Ana</strong></td><td style="text-align:right">18</td></tr><tr><td>Léo</td><td style="text-align:right"></td></tr></tbody></table></div>');
  });

  test('bloc de code : contenu brut, sans gras ni formules', () => {
    assert.equal(app.md('```\nf(x) = **x** $y$ <b>\n```\nAprès'), '<pre class="code"><code>f(x) = **x** $y$ &lt;b&gt;</code></pre><p>Après</p>');
  });

  test('clôture de code orpheline retirée', () => {
    assert.equal(app.md('Texte\n```'), '<p>Texte</p>');
  });

  test('une étoile dans une formule ne devient pas de l\'italique', () => {
    const html = app.md('Produit $a*b*c$ et *mot*');
    assert.match(html, /data-tex="a\*b\*c"/);
    assert.match(html, /<em>mot<\/em>/);
  });

  test('formule en bloc', () => {
    assert.equal(app.md('$$\\frac{a}{b}$$'), '<p><span class="math" data-display="1" data-tex="\\frac{a}{b}">$$\\frac{a}{b}$$</span></p>');
  });

  test('le HTML du texte est toujours échappé', () => {
    assert.equal(app.md('<img src=x onerror=alert(1)> & "q"'), '<p>&lt;img src=x onerror=alert(1)&gt; &amp; &quot;q&quot;</p>');
    assert.equal(app.md('# <b>titre</b>'), '<h1>&lt;b&gt;titre&lt;/b&gt;</h1>');
  });

  test('mathify : texte de transcription avec formules', () => {
    assert.equal(app.mathify('a < b et $x^2$'), 'a &lt; b et <span class="math" data-display="0" data-tex="x^2">$x^2$</span>');
  });
});

test.describe('quizHtml', () => {
  test('les questions « → réponse » deviennent des cartes à dévoiler', () => {
    const html = app.quizHtml('- Qu\'est-ce qu\'un arbre ? → Un graphe connexe sans cycle\n- Une ligne sans réponse', { i: 0 });
    assert.match(html, /<li class="qa"><details><summary><span>Qu&#39;est-ce qu&#39;un arbre \?<\/span><\/summary><div class="ans">Un graphe connexe sans cycle<\/div><\/details><\/li>/);
    assert.match(html, /<li>Une ligne sans réponse<\/li>/);
  });
});
