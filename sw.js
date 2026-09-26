// Service worker de Notes Plaud
// - reçoit les fichiers partagés depuis Android (cible de partage)
// - garde l'application en cache pour qu'elle s'ouvre même avec un mauvais réseau

const CACHE = 'notes-plaud-v4';
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
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; // on ne touche pas aux appels vers Groq

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
      fetch(e.request)
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
