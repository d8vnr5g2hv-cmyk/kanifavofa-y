// Kani Favorite：オフライン用
// 画面のしくみ（html・js・css）はネット優先＝更新がすぐ反映。画像・音は端末にためて速く。動画は再生の都合でネットから。
const CACHE = 'kani-favorite-v18';
const SHELL = ['./', 'index.html', 'app.css', 'core.js', 'ui.js', 'motion.js', 'todo.js', 'love.js', 'profile.js', 'accounts.js', 'ops.js', 'ops.css', 'room.js', 'room.css', 'games.js', 'applock.js', 'profile.css', 'deco.css', 'deco.js', 'stats.js', 'cafe.js', 'cafe.css', 'office.js', 'office.css',
               'manifest.json', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'splash_bg.jpg', 'bgm_title.mp3'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (/\.mp4$/i.test(url.pathname)) return;   // 動画は通常どおり（iPhoneの部分読み込みを壊さないため）
  if (e.request.mode === 'navigate' || /\.(html|js|css|json)$/i.test(url.pathname) || url.pathname.endsWith('/')) {
    e.respondWith(fetch(e.request).then(r => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); } return r; })
      .catch(() => caches.match(e.request).then(r => r || (e.request.mode === 'navigate' ? caches.match('index.html') : undefined))));
    return;
  }
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
    if (r.ok && r.status === 200) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); }
    return r;
  })));
});
