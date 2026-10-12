// LinkBazar BD — service worker: makes the shop open instantly on repeat visits.
// After a big change to index.html, bump CACHE (lb-v2, lb-v3 ...) so phones pick up the new version.
const CACHE = 'lb-v1';
const SHELL = ['./', './index.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // never cache the admin panel or Firestore data calls
  if (url.pathname.includes('admin')) return;
  if (url.hostname.includes('firestore.googleapis.com') || url.hostname.includes('firebaseio.com')) return;

  // shop page: show the saved copy instantly, refresh it in the background
  if (req.mode === 'navigate' && url.origin === location.origin) {
    e.respondWith(caches.open(CACHE).then(async c => {
      const cached = await c.match('./index.html') || await c.match(req);
      const fresh = fetch(req).then(r => { if (r.ok) c.put('./index.html', r.clone()); return r; }).catch(() => cached);
      return cached || fresh;
    }));
    return;
  }

  // fonts, Firebase SDK, Cloudinary images: cache-first (these URLs never change)
  const longLived = ['fonts.googleapis.com', 'fonts.gstatic.com', 'www.gstatic.com', 'res.cloudinary.com'];
  if (longLived.includes(url.hostname)) {
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const r = await fetch(req);
      if (r.ok || r.type === 'opaque') c.put(req, r.clone());
      return r;
    }));
  }
});
