'use strict';
/*
 * Charge le script principal d'index.html dans un bac à sable Node (module vm), sans navigateur.
 * Le DOM, IndexedDB, le service worker… sont remplacés par un « bouche-trou » universel :
 * le code de démarrage de l'app s'exécute sans erreur, et ses fonctions pures deviennent testables.
 * On teste donc exactement le code livré, sans le modifier ni le recopier.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
// Les tests de dates et de calendrier supposent le fuseau de l'utilisateur (Belgique / France)
process.env.TZ = process.env.TZ || 'Europe/Brussels';

function appScript() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const main = scripts.find((s) => s.includes("'use strict'") && s.includes('function md('));
  if (!main) throw new Error('Script principal introuvable dans index.html');
  return main;
}

// Objet « bouche-trou » : toute propriété, tout appel ou toute construction renvoie encore un bouche-trou.
function makeStub() {
  const target = function stub() {};
  const handler = {
    get(t, k) {
      if (k === Symbol.toPrimitive) return () => '';
      if (k === Symbol.iterator) return function* () {};
      if (k === 'then') return undefined;           // jamais « thenable » (sinon un await bloquerait)
      if (k === 'length') return 0;
      if (k === 'toString' || k === 'valueOf') return () => '';
      return proxy;
    },
    set() { return true; },
    has() { return false; },
    deleteProperty() { return true; },
    apply() { return proxy; },
    construct() { return proxy; },
  };
  const proxy = new Proxy(target, handler);
  return proxy;
}

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    clear: () => m.clear(),
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  };
}

/**
 * Renvoie un objet qui donne accès aux fonctions et constantes globales du script de l'app.
 * @param {object} [opts]
 * @param {object} [opts.settings] réglages à placer dans localStorage avant le chargement
 * @param {number} [opts.now] date « actuelle » figée (ms), pour des résultats reproductibles
 */
function loadApp(opts = {}) {
  const stub = makeStub();
  const localStorage = memoryStorage();
  if (opts.settings) localStorage.setItem('np-settings', JSON.stringify(opts.settings));
  const timers = [];
  const sandbox = {
    console, URL, URLSearchParams, Blob, File, AbortController, TextEncoder, TextDecoder, atob, btoa, structuredClone,
    fetch: opts.fetch || (async () => { throw new Error('réseau désactivé dans les tests'); }),
    // minuteries réelles mais qui n'empêchent pas Node de se terminer
    setTimeout: (fn, ms, ...a) => { const t = setTimeout(fn, ms, ...a); t.unref(); timers.push(t); return t; },
    clearTimeout, setInterval: (fn, ms) => { const t = setInterval(fn, ms); t.unref(); timers.push(t); return t; }, clearInterval,
    queueMicrotask,
    localStorage, sessionStorage: memoryStorage(),
    document: stub, navigator: { userAgent: 'node-test', onLine: true }, location: { search: '', pathname: '/', href: 'http://localhost/', origin: 'http://localhost' },
    history: stub, indexedDB: stub, caches: stub, matchMedia: stub, Audio: stub, Notification: undefined,
    requestAnimationFrame: () => 0, getComputedStyle: stub, CSS: { escape: (s) => String(s) },
    addEventListener: () => {}, removeEventListener: () => {}, scrollTo: () => {}, getSelection: () => '',
    NodeFilter: { SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2 },
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  if (opts.now != null) {
    vm.runInContext(`(() => {
      const R = Date, T = ${Number(opts.now)};
      class FixedDate extends R { constructor(...a) { if (a.length) super(...a); else super(T); } static now() { return T; } }
      globalThis.Date = FixedDate;
    })()`, ctx);
  }
  vm.runInContext(appScript(), ctx, { filename: 'index.html' });
  // Les « const » et « let » du script ne sont pas des propriétés de l'objet global :
  // on les lit par leur nom, dans le même contexte.
  // Les objets créés dans le bac à sable ont leurs propres prototypes : on les recopie côté test
  // pour que les comparaisons (assert.deepStrictEqual) fonctionnent normalement.
  const toHost = (v) => {
    if (v && typeof v === 'object' && typeof v.then === 'function') return Promise.resolve(v).then(toHost);
    if (v && typeof v === 'object') { try { return structuredClone(v); } catch (e) { return v; } }
    return v;
  };
  const read = (name) => vm.runInContext(name, ctx);
  const api = new Proxy({}, {
    get: (_, k) => {
      if (typeof k !== 'string') return undefined;
      const v = read(k);
      return typeof v === 'function' && !/^[A-Z]/.test(k) ? (...a) => toHost(v(...a)) : toHost(v);
    },
  });
  return { app: api, ctx, run: (code) => vm.runInContext(code, ctx), localStorage, stop: () => timers.forEach(clearTimeout) };
}

module.exports = { loadApp, appScript, ROOT };
