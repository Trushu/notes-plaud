// Service worker de Notes Plaud
// - reçoit les fichiers partagés depuis Android (cible de partage)
// - garde l'application en cache pour qu'elle s'ouvre même avec un mauvais réseau

const CACHE = 'notes-plaud-v22';
const KATEX_CACHE = 'katex-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

// --- IndexedDB minimal (même base que la page) ---
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('notes-plaud', 1);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('notes')) db.createObjectStore('notes', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('pending')) db.createObjectStore('pending');
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function putPending(value) {
  const db = await openDB();
  await new Promise((res, rej) => {
    const t = db.transaction('pending', 'readwrite');
    t.objectStore('pending').put(value, 'shared');
    t.oncomplete = res;
    t.onerror = () => rej(t.error);
  });
}

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== KATEX_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // KaTeX (rendu des formules) : gardé en cache pour fonctionner hors ligne
  if (url.hostname === 'cdn.jsdelivr.net' && url.pathname.startsWith('/npm/katex')) {
    e.respondWith(caches.open(KATEX_CACHE).then((c) => c.match(e.request).then((hit) => hit || fetch(e.request).then((resp) => {
      if (resp.ok) c.put(e.request, resp.clone());
      return resp;
    }))));
    return;
  }
  if (url.origin !== self.location.origin) return; // on ne touche pas aux appels vers Groq et Gemini

  // Fichier partagé depuis une autre app (Plaud -> Partager -> Notes Plaud)
  if (e.request.method === 'POST' && url.pathname.endsWith('/share')) {
    e.respondWith((async () => {
      const info = { at: Date.now(), files: [], texts: [], error: '' };
      let file = null;
      try {
        const fd = await e.request.formData();
        const files = [];
        // on prend les fichiers quel que soit le nom du champ utilisé
        for (const [k, v] of fd.entries()) {
          if (typeof v === 'string') { if (v.trim()) info.texts.push(`${k} : ${v.slice(0, 300)}`); }
          else if (v && v.size) files.push(v);
        }
        info.files = files.map((f) => ({ name: f.name, type: f.type, size: f.size }));
        file = files.find((f) => /^(audio|video)\//.test(f.type) || /\.(mp3|m4a|wav|ogg|opus|aac|flac|amr|3gp|webm|mp4)$/i.test(f.name))
          || files[0] || null;
      } catch (err) {
        info.error = String(err && err.message || err);
      }
      try { await putPending({ file, info }); } catch (err) {}
      return Response.redirect(new URL('./?shared=1', self.registration.scope).href, 303);
    })());
    return;
  }

  // Réseau d'abord (pour recevoir les mises à jour), cache si hors ligne
  if (e.request.method === 'GET') {
    e.respondWith(
      // « no-cache » : on redemande toujours au serveur s'il y a du nouveau (GitHub Pages met sinon les fichiers en cache 10 min)
      fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' })
        .then((resp) => {
          if (resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return resp;
        })
        .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('./index.html')))
    );
  }
});

// Touche sur une notification « Note prête » : on ouvre l'app sur la note
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const id = e.notification.data && e.notification.data.id;
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) { c.postMessage({ open: id }); return c.focus(); }
    return self.clients.openWindow(new URL('./?note=' + encodeURIComponent(id || ''), self.registration.scope).href);
  })());
});

// Demande explicite d'activation d'une nouvelle version (bouton « Vérifier » des réglages)
self.addEventListener('message', (e) => { if (e.data === 'skip') self.skipWaiting(); });

// ---- Rappels de tâches : vérification périodique (Android, si le système l'autorise) ----
function idbReq(store, mode, fn) {
  return openDB().then((db) => new Promise((res, rej) => {
    const t = db.transaction(store, mode); const r = fn(t.objectStore(store));
    t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error);
  }));
}
// Même lecture des tâches que la page (format Obsidian Tasks : ⏰ rappel, 📅 échéance…)
function parseTask(raw) {
  let t = String(raw), remind = null, due = null;
  t = t.replace(/📅\s*(\d{4}-\d{2}-\d{2})/gu, (_, d) => { due = d; return ' '; });
  t = t.replace(/⏰\s*(\d{4}-\d{2}-\d{2})(?:[ T](\d{1,2}:\d{2}))?/gu, (_, d, h) => { remind = d + 'T' + (h ? h.padStart(5, '0') : '09:00'); return ' '; });
  t = t.replace(/✅\s*(\d{4}-\d{2}-\d{2})/gu, ' ');
  t = t.replace(/⏫|🔺|🔼|🔽/gu, ' ');
  t = t.replace(/(^|\s)#(\p{L}[\p{L}\p{N}_-]*)/gu, (_, sp) => sp);
  return { text: t.replace(/\s+/g, ' ').trim(), remind, due };
}
async function checkReminders() {
  const notes = (await idbReq('notes', 'readonly', (s) => s.getAll())) || [];
  const seen = (await idbReq('pending', 'readonly', (s) => s.get('reminded'))) || [];
  const now = Date.now(), fresh = [];
  for (const n of notes) {
    let idx = -1;
    for (const line of String(n.summary || '').split('\n')) {
      const m = /^(\s*[-*•]\s+)\[( |x|X)\]\s+(.*)$/.exec(line); if (!m) continue;
      idx++;
      if (m[2] !== ' ') continue;
      const p = parseTask(m[3]); if (!p.text || !p.remind) continue;
      const at = new Date(p.remind).getTime();
      const key = `${n.id}|${p.text}|${p.remind}`;
      if (at <= now && at > now - 3 * 86400000 && !seen.includes(key)) fresh.push({ key, p, note: n, id: n.id + ':' + idx });
    }
  }
  if (!fresh.length) return;
  await idbReq('pending', 'readwrite', (s) => s.put([...seen, ...fresh.map((f) => f.key)].slice(-400), 'reminded'));
  for (const f of fresh) {
    await self.registration.showNotification('⏰ ' + f.p.text, {
      body: (f.note.id === '__tasks__' ? 'Rappel de tâche' : f.note.title) || 'Rappel de tâche',
      icon: 'icon-192.png', badge: 'icon-192.png', tag: 'rem-' + f.id, data: { id: ':tasks' },
    });
  }
}
self.addEventListener('periodicsync', (e) => { if (e.tag === 'reminders') e.waitUntil(checkReminders()); });
