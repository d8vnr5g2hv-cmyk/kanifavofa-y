// Yohei Support：オフライン用
// 画面のしくみ（html・js・css）はネット優先＝更新がすぐ反映。画像・音は端末にためて速く。動画は再生の都合でネットから。
const CACHE = 'yohei-support-v5.0';
const SHELL = ['./', 'index.html', 'app.css', 'core.js', 'ui.js', 'fx.js', 'motion.js', 'data.js', 'rooms.js', 'todo.js', 'love.js', 'accounts.js', 'office.js', 'office.css', 'room.js', 'room.css', 'hall.js', 'secretary.js', 'life.js', 'friends.js', 'clinic.js', 'rabbit.js',
               'applock.js', 'deco.css', 'deco.js', 'stats.js', 'title.js', 'title.css', 'ys.css', 'ys5.css', 'cast.js', 'weather.js', 'progress.js', 'chat.js', 'daily.js', 'wrapped.js', 'focus.js', 'push.js', 'wx_studio.webp', 'manifest.json', 'icon-ys-180.png', 'icon-ys-192.png', 'icon-ys-512.png', 'splash_bg.jpg', 'bgm_title.mp3'];
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

// ===== 通知（Cloudflare Workers から。中身は Worker の /latest から取る） =====
const idbGet = (store, id) => new Promise(ok => { try { const r = indexedDB.open('kani-favorite'); r.onsuccess = () => { try { const q = r.result.transaction(store).objectStore(store).get(id); q.onsuccess = () => ok(q.result || null); q.onerror = () => ok(null); } catch (e) { ok(null); } }; r.onerror = () => ok(null); } catch (e) { ok(null); } });
self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let m = null;
    try { if (e.data) m = e.data.json(); } catch (err) {}
    if (!m) { try { const c = await idbGet('settings', 'ys-push'); if (c && c.url) { const r = await fetch(c.url.replace(/\/+$/, '') + '/latest?key=' + encodeURIComponent(c.key), { cache:'no-store' }); m = await r.json(); } } catch (err) {} }
    m = m && m.title ? m : { title:'Yohei Support', body:'みんなからお知らせがあります' };
    await self.registration.showNotification(m.title, { body:m.body || '', icon:m.who ? 'av_' + m.who + '.webp' : 'icon-ys-192.png', badge:'icon-ys-192.png', tag:m.tag || 'ys', data:{ url:'./' } });
  })());
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type:'window', includeUncontrolled:true }).then(cs => { const c = cs.find(x => 'focus' in x); return c ? c.focus() : self.clients.openWindow('./'); }));
});
