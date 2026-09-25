// Service worker de Notes Plaud
// - reçoit les fichiers partagés depuis Android (cible de partage)
// - garde l'application en cache pour qu'elle s'ouvre même avec un mauvais réseau

const CACHE = 'notes-plaud-v1';
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
      try {
        const fd = await e.request.formData();
        const files = fd.getAll('audio').filter((f) => f && typeof f !== 'string');
        if (files.length) await putPending({ file: files[0], at: Date.now() });
      } catch (err) {
        // on redirige quand même, la page affichera qu'aucun fichier n'a été reçu
      }
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
