// Kani Favorite — 土台（音・メモロビ・スプラッシュ・タブ・保存）
'use strict';
const $ = id => document.getElementById(id);
const p2 = n => String(n).padStart(2, '0');
const range = (n, f) => Array.from({ length:n }, (_, i) => f(i + 1));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const vname = (pre, n) => range(n, i => `${pre}_v${p2(i)}.mp3`);

// ===== キャラ（ボイスはキャラ単位で共用） =====
const CHARS = {
  hoshino:  { name:'ホシノ', voices:vname('c1', 12) },
  mika:     { name:'ミカ',   voices:vname('c2', 10) },
  hina:     { name:'ヒナ',   voices:vname('c3', 12) },
  miyako:   { name:'ミヤコ', voices:vname('c4', 12) },
  mari:     { name:'マリー', voices:vname('c5', 10) },
  kitchen:  { name:'ニコ',   voices:vname('nico', 8) },
  christmas:{ name:'セリナ', voices:vname('serina', 4) },
  conductor:{ name:'ヒカリ', voices:vname('hikari', 5) },
  drive:    { name:'セイア', voices:vname('seia', 4) },
  sofa:     { name:'キサキ', voices:vname('kisaki', 7) },
  bedtime:  { name:'ノア',   voices:vname('noa', 4) },
  office:   { name:'ユウカ', voices:vname('yuuka', 10) },
};
// タブ専用ボイスの差し込み口（ファイル名を入れると、その場面ではこちらが優先される）
const VOICE_EVENTS = {
  'todo:allclear':   [],   // ホシノ：今日のやることを全部終えた
  'love:drop':       [],   // ミカ：カードを落とされた
  'accounts:unlock': [],   // ヒナ：ロック解除
  'accounts:weak':   [],   // ミヤコ：弱いパスワードを見つけた
  'accounts:ok':     [],   // ミヤコ：点検で異常なし
  'profile:anniv':   [],   // マリー：記念日
};
// スプラッシュに出るキャラ（画像名）と、そのキャラのメモロビ
const SPLASH = [
  { n:'hoshino', who:'hoshino' }, { n:'mika', who:'mika' }, { n:'hina', who:'hina' }, { n:'miyako', who:'miyako' }, { n:'mari', who:'mari' },
  { n:'serina', who:'christmas' }, { n:'yuuka', who:'office' }, { n:'nico', who:'kitchen' }, { n:'hikari', who:'conductor' },
  { n:'seia', who:'drive' }, { n:'kisaki', who:'sofa' }, { n:'noa', who:'bedtime' },
];

// ===== メモロビ（Favoriteの並び順）＋時計の色 =====
const LOB = n => ({ tall:`${n}_tall_h264.mp4`, tallPoster:`${n}_tall_poster.jpg`, wide:`${n}_h264.mp4`, widePoster:`${n}_poster.jpg` });
const L = (src, len) => ({ src, loopStart:0.2, loopEnd:0.2 + len });   // 前後0.2秒は継ぎ目用の余白
const C = (acc, acc2, glow) => ({ acc, acc2, glow });
// なでなで：反応の動画、縦画面での動画の位置 [X,Y,幅,高さ]、頭の範囲（動画に対する割合 [左,上,右,下]）
const PAT = (n, box, zone) => ({ tall:`${n}_pat_tall_h264.mp4`, wide:`${n}_pat_h264.mp4`, box, zone });
const chars = [
  { who:'hoshino',   ...LOB('lobby'),         bgm:L('bgm.mp3', 117.25),          clock:C('#ffc6d9', '#bfe9ff', 'rgba(30,90,150,.45)') },
  { who:'christmas', ...LOB('06_christmas'),  bgm:L('serina_bgm.mp3', 120.5),   clock:C('#ffd27a', '#ff9a9a', 'rgba(140,30,40,.55)') },
  { who:'mika',      ...LOB('mika'),          bgm:L('c2_bgm.mp3', 67.54),       clock:C('#f5c6ff', '#a9b8ff', 'rgba(60,30,130,.6)'),
    pat:PAT('mika', [2, 871, 1166, 539], [.36, .0, .62, .42]) },
  { who:'office',    ...LOB('10_office'),     bgm:L('yuuka_bgm.mp3', 128.9192), clock:C('#a8d8ff', '#c9b8ff', 'rgba(40,60,120,.5)') },
  { who:'hina',      ...LOB('hina'),          bgm:L('c3_bgm.mp3', 177.5),       clock:C('#d8b4ff', '#9ec7ff', 'rgba(30,20,80,.65)') },
  { who:'drive',     ...LOB('13_drive'),      bgm:L('seia_bgm.mp3', 87.0),      clock:C('#ffc48a', '#ff9ccf', 'rgba(120,40,90,.55)') },
  { who:'miyako',    ...LOB('miyako'),        bgm:L('bgm_profile.mp3', 123.9652), clock:C('#bfe9ff', '#ffd0dc', 'rgba(30,90,150,.45)') },
  { who:'kitchen',   ...LOB('11_kitchen'),    bgm:L('nico_bgm.mp3', 135.0),     clock:C('#ffb3c8', '#ffe08a', 'rgba(120,70,60,.5)') },
  { who:'mari',      ...LOB('mari'),          bgm:L('c5_bgm.mp3', 113.6872),    clock:C('#ffcf7a', '#ffa58a', 'rgba(90,30,20,.6)') },
  { who:'hoshino',   ...LOB('09_aquarium'),   bgm:L('noa_bgm.mp3', 115.7314),   clock:C('#8fe3ff', '#ffc0dc', 'rgba(10,60,130,.55)') },
  { who:'conductor', ...LOB('12_conductor'),  bgm:L('yuuka_bgm.mp3', 128.9192), clock:C('#c9f27a', '#ffd27a', 'rgba(30,40,90,.55)') },
  { who:'sofa',      ...LOB('14_sofa'),       bgm:L('kisaki_bgm.mp3', 140.7833), clock:C('#e8c47a', '#9fb7ff', 'rgba(0,0,0,.65)') },
  { who:'hina',      ...LOB('08_rest'),       bgm:L('night_bgm.mp3', 132.0),    clock:C('#c7b2ff', '#8fc8ff', 'rgba(20,20,70,.65)') },
  { who:'mika',      ...LOB('16_mika_night'), bgm:L('night_bgm.mp3', 132.0),    clock:C('#ffc6e6', '#b9c6ff', 'rgba(40,40,110,.6)') },
  { who:'bedtime',   ...LOB('15_bedtime'),    bgm:L('noa_bgm.mp3', 115.7314),   clock:C('#cfe0ff', '#eef2ff', 'rgba(20,30,80,.65)') },
  { who:'mari',      ...LOB('07_staff'),      bgm:L('nico_bgm.mp3', 135.0),     clock:C('#ffbe8a', '#bdf0c8', 'rgba(40,60,60,.5)') },
];
chars.forEach(c => { c.voices = CHARS[c.who].voices; });
const TITLE_BGM = L('bgm_title.mp3', 34.4441);
const TAB_BGM = { todo:L('bgm_todo.mp3', 135.179), love:L('bgm_love.mp3', 138.0889),
                  accounts:L('bgm_accounts.mp3', 139.054), profile:L('bgm_profile.mp3', 123.9652) };
const TAB_ACCENT = { todo:'#e7779f', love:'#f27ea7', accounts:'#2f9fd6', profile:'#ef86a9' };

const slidesEl = $('slides'), dotsEl = $('dots');
let bgReady = false;   // BGMが鳴り始めたら、重い先読みを始めてよい
const OFF = 3;   // 左端にカフェ・自室・執務室の扉があるので、メモロビは3枚ずれる
const slideOf = i => slidesEl.children[i + OFF];
let current = 0, tab = 'favorite', phase = 'lock';   // lock → splash → app

// ===== 起動ごとのくじ：12人から5人、最初のメモロビはその5人の誰か =====
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const LS = { get:k => { try { return localStorage.getItem(k); } catch(e) { return null; } }, set:(k, v) => { try { localStorage.setItem(k, v); } catch(e) {} } };
const pick5 = (() => {
  const last = LS.get('kf-last5') || '';
  let p; do { p = shuffle(SPLASH.slice()).slice(0, 5); } while (p.map(x => x.n).sort().join() === last);
  LS.set('kf-last5', p.map(x => x.n).sort().join());
  return p;
})();
(() => {
  const lastLobby = +LS.get('kf-lastLobby');
  const whos = new Set(pick5.map(x => x.who));
  let cands = chars.map((c, i) => i).filter(i => whos.has(chars[i].who));
  if (cands.length > 1) cands = cands.filter(i => i !== lastLobby);
  current = cands[Math.floor(Math.random() * cands.length)] || 0;
  LS.set('kf-lastLobby', current);
})();

// ===== 時計 =====
const DOW = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
function tick() {
  const d = new Date();
  $('dow').textContent = DOW[d.getDay()];
  $('md').textContent = `${p2(d.getMonth() + 1)}.${p2(d.getDate())}`;
  $('hh').textContent = p2(d.getHours()); $('mm').textContent = p2(d.getMinutes()); $('ss').textContent = p2(d.getSeconds());
  setTimeout(tick, 1000 - d.getMilliseconds() + 5);
}
function paintClock() {
  const c = chars[current].clock, el = $('clock');
  el.style.setProperty('--cAcc', c.acc); el.style.setProperty('--cAcc2', c.acc2); el.style.setProperty('--cGlow', c.glow);
}

// ===== 音（Web Audio） =====
const ctx = new (window.AudioContext || window.webkitAudioContext)();
const bgmGain = ctx.createGain(); bgmGain.connect(ctx.destination);
const voiceGain = ctx.createGain(); voiceGain.connect(ctx.destination);
const BGM_VOL = 0.55, DUCK_VOL = 0.18;
const buffers = {}, loading = {};
let bgmNode = null, bgmOn = true, voiceNode = null, bgmTimer = null;
const recent = [];
async function loadBuf(url) {
  if (buffers[url]) return buffers[url];
  if (loading[url]) return loading[url];
  return (loading[url] = (async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('not found: ' + url);
      const ab = await res.arrayBuffer();
      return (buffers[url] = await new Promise((ok, ng) => ctx.decodeAudioData(ab, ok, ng)));
    } finally { delete loading[url]; }
  })());
}
// メモリ対策：BGMは「今・前後・今のタブ」だけ展開したまま持つ
function trimBgmCache() {
  const keep = new Set([TITLE_BGM.src]);
  if (bgmNode) keep.add(bgmNode._src);
  [current - 1, current, current + 1].forEach(i => keep.add(chars[(i + chars.length) % chars.length].bgm.src));
  if (TAB_BGM[tab]) keep.add(TAB_BGM[tab].src);
  const all = new Set([...chars.map(c => c.bgm.src), ...Object.values(TAB_BGM).map(b => b.src), TITLE_BGM.src, ...Ops.allBgm().map(b => b.src), ...Cafe.allBgm().map(b => b.src)]);
  if (Ops.active()) Ops.allBgm().forEach(b => keep.add(b.src));
  Object.keys(buffers).forEach(u => { if (all.has(u) && !keep.has(u)) delete buffers[u]; });
}
function ramp(to, sec) {
  const t = ctx.currentTime;
  bgmGain.gain.cancelScheduledValues(t); bgmGain.gain.setValueAtTime(bgmGain.gain.value, t); bgmGain.gain.linearRampToValueAtTime(to, t + sec);
}
function wantedBgm() {
  if (typeof AppLock !== 'undefined' && AppLock.locked()) return TITLE_BGM;   // ロック画面からタイトルの曲
  if (phase === 'splash') return TITLE_BGM;
  if (phase !== 'app') return null;
  const fb = typeof Office !== 'undefined' && Office.bgm(); if (fb) return fb;   // 執務室
  const cb = typeof Cafe !== 'undefined' && Cafe.bgm(); if (cb) return cb;   // カフェ
  const rb = typeof Room !== 'undefined' && Room.bgm(); if (rb) return rb;   // 自室
  const ob = typeof Ops !== 'undefined' && Ops.bgm(); if (ob) return ob;   // 作戦室
  if (tab === 'favorite') return bgmOn ? chars[current].bgm : null;
  return TAB_BGM[tab] || null;
}
function startNode(want, buf, fade) {
  if (bgmNode) stopBgm(0.3);
  const n = ctx.createBufferSource();
  n.buffer = buf; n.loop = true; n.loopStart = want.loopStart; n.loopEnd = want.loopEnd; n._src = want.src;
  n.connect(bgmGain);
  bgmGain.gain.cancelScheduledValues(ctx.currentTime);
  bgmGain.gain.setValueAtTime(0, ctx.currentTime);
  bgmGain.gain.linearRampToValueAtTime(voiceNode ? DUCK_VOL : BGM_VOL, ctx.currentTime + fade);
  n.start(0, want.loopStart);
  bgmNode = n;
}
function syncBgm(delay = 0, fade = 0.6) {
  clearTimeout(bgmTimer);
  const want = wantedBgm();
  if (bgmNode && want && bgmNode._src === want.src) return;
  if (bgmNode) stopBgm(0.35);
  if (!want) return;
  // すでに展開済みなら待たずに即スタート（タイトル曲はこれで頭から鳴る）
  if (!delay && buffers[want.src]) return startNode(want, buffers[want.src], fade);
  bgmTimer = setTimeout(async () => {
    let buf; try { buf = await loadBuf(want.src); } catch(e) { toast('BGMが見つかりません'); return; }
    const now = wantedBgm();
    if (!now || now.src !== want.src || (bgmNode && bgmNode._src === want.src)) return;
    startNode(want, buf, fade);
  }, delay);
}
function stopBgm(sec = 0.4) {
  if (!bgmNode) return;
  const n = bgmNode; bgmNode = null;
  ramp(0, sec); n.stop(ctx.currentTime + sec + 0.05);
}

// ボイス：idx はメモロビ番号、または CHARS のキー。list を渡すとその中から選ぶ
async function playVoice(idx = current, hooks = {}, list = null) {
  list = list || (typeof idx === 'string' ? CHARS[idx] : chars[idx]).voices;
  if (!list.length) { toast('ボイス未登録'); if (hooks.end) hooks.end(); return; }
  const pool = list.filter(v => !recent.includes(v));
  const src = pool.length ? pool : list;
  const pick = src[Math.floor(Math.random() * src.length)];
  recent.push(pick); if (recent.length > Math.min(5, Math.max(1, list.length - 1))) recent.shift();
  try {
    const buf = await loadBuf(pick);
    if (voiceNode) { try { voiceNode.stop(); } catch(e) {} }
    if (voiceNode && voiceNode._end) { const f = voiceNode._end; voiceNode._end = null; f(); }
    const n = ctx.createBufferSource(); n.buffer = buf; n.connect(voiceGain);
    voiceNode = n;
    if (bgmNode) ramp(DUCK_VOL, 0.25);
    if (tab === 'favorite') hideTabs();
    n._end = hooks.end || null;
    if (hooks.start) hooks.start(buf.duration);
    n.onended = () => { if (n._end) { const f = n._end; n._end = null; f(); } if (voiceNode === n) { voiceNode = null; if (bgmNode) ramp(BGM_VOL, 0.8); } };
    n.start();
  } catch(e) { toast('ボイスを読み込めませんでした'); if (hooks.end) hooks.end(); }
}

// ===== タブの表示・非表示（Favoriteでボイス中は隠す） =====
function hideTabs() { if (tab === 'favorite') document.body.classList.add('tabsHidden'); }
function showTabs() { document.body.classList.remove('tabsHidden'); }

// ===== スライド =====
function loadChar(i) {
  const c = chars[i], s = slideOf(i);
  const land = document.body.classList.contains('land');
  const src = land ? c.wide : c.tall, poster = land ? c.widePoster : c.tallPoster;
  s.innerHTML = '';
  // 動画が実際に動き出すまでは、止まった絵を見せる（iPhoneは再生前の動画を黒く描くため、動画は隠しておく）
  const pi = document.createElement('img'); pi.className = 'lposter'; pi.src = poster; pi.alt = ''; pi.decoding = 'async';
  s.appendChild(pi);
  const mk = (cls, loop) => {
    const v = document.createElement('video'); if (cls) v.className = cls;
    v.muted = true; v.loop = loop; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('muted', '');
    return v;
  };
  const v = mk('lv', true);
  v.preload = Math.abs(i - current) <= 1 ? 'auto' : 'metadata'; v.src = src;
  // iPhoneは再生し始めの一瞬、動画を元の大きさで描くことがあるので、映像の大きさが決まって2コマ描けてから見せる
  const show = () => {
    if (v.classList.contains('ready') || v._showing || !(v.currentTime > 0) || !v.videoWidth) return;
    v._showing = true;
    const go = () => requestAnimationFrame(() => requestAnimationFrame(() => { v.classList.add('ready'); v._showing = false; }));
    if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(() => v.requestVideoFrameCallback(go)); else go();
  };
  v.addEventListener('timeupdate', show); v.addEventListener('playing', () => setTimeout(show, 60));
  s.appendChild(v);
  if (c.pat) {   // なでなで：反応の動画（上に重ねて、撫でたときだけ見せる）と頭の範囲
    const pv = mk('patv', false); pv.preload = i === current ? 'auto' : 'none'; pv.src = land ? c.pat.wide : c.pat.tall;
    s.appendChild(pv);
    const z = document.createElement('div'); z.className = 'patzone'; s.appendChild(z);
    Pat.bind(i, s, z, pv);
  }
  sizeMedia(i);
  pi.addEventListener('load', () => sizeMedia(i)); v.addEventListener('loadedmetadata', () => sizeMedia(i));
  if (i === current) v.play().catch(() => {});
}
// 動画と止め絵の大きさ：CSS（object-fit）任せにせず、画面いっぱいに切り抜いた大きさを直接決める
function sizeMedia(i) {
  const s = slideOf(i); if (!s) return;
  const land = document.body.classList.contains('land'), W = s.clientWidth, H = s.clientHeight; if (!W || !H) return;
  const pi = s.querySelector('.lposter');
  s.querySelectorAll('.lposter, video').forEach(m => {
    // 実際の大きさ（読み込み前は止め絵の大きさ → それもなければ標準の大きさ）
    let vw = m.naturalWidth || m.videoWidth || (pi && pi.naturalWidth), vh = m.naturalHeight || m.videoHeight || (pi && pi.naturalHeight);
    if (!vw || !vh) { vw = land ? 2532 : 1170; vh = land ? 1170 : 2534; }
    const k = Math.max(W / vw, H / vh);
    Object.assign(m.style, { left:(W - vw * k) / 2 + 'px', top:(H - vh * k) / 2 + 'px', width:vw * k + 'px', height:vh * k + 'px', right:'auto', bottom:'auto' });
  });
}
// 止め絵を先に全部読み込んでおく（初めてのメモロビでも、すぐ絵が出るように）
function preloadPosters() {
  const land = document.body.classList.contains('land');
  const order = [...chars.keys()].sort((a, b) => Math.abs(a - current) - Math.abs(b - current));
  let k = 0;
  const next = () => {
    if (k >= order.length) return;
    const c = chars[order[k++]], im = new Image(); im.src = land ? c.widePoster : c.tallPoster;
    (im.decode ? im.decode() : Promise.resolve()).catch(() => {}).then(() => setTimeout(next, 120));
  };
  next();
}
addEventListener('resize', () => chars.forEach((c, i) => sizeMedia(i)));
function updateVideos() {
  [...dotsEl.children].forEach((d, i) => d.classList.toggle('on', i === current));
  chars.forEach((c, i) => {
    const s = slideOf(i), v = s && s.querySelector('video.lv'); if (!v) return;
    if (i === current) { v.preload = 'auto'; if (tab === 'favorite') v.play().catch(() => {}); } else v.pause();
    if (Math.abs(i - current) === 1) {   // となりは先に読んで、1コマ目まで準備しておく（スワイプしたらすぐ動く）
      if (v.preload !== 'auto') v.preload = 'auto';
      if (!v._primed && tab === 'favorite' && bgReady) { v._primed = true; v.play().then(() => { if (i !== current) v.pause(); }).catch(() => { v._primed = false; }); }
    }
    const pv = s.querySelector('.patv');
    if (pv) { if (i === current) { if (pv.preload !== 'auto') pv.preload = 'auto'; } else Pat.stop(s); }
  });
  paintClock();
}

// ===== なでなで =====
const Pat = (() => {
  const HEART = '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.9 4.5 6.6 4.5c2.2 0 3.6 1.3 5.4 3.2 1.8-1.9 3.2-3.2 5.4-3.2 3.7 0 5.7 3.9 4.2 7.3C19.5 16.4 12 21 12 21z"/></svg>';
  // 頭の範囲を画面上の位置に置く（動画は画面いっぱいに切り抜いて表示しているので、その計算に合わせる）
  function place(i) {
    const c = chars[i], s = slideOf(i), z = s && s.querySelector('.patzone'); if (!z) return;
    const land = document.body.classList.contains('land'), sw = s.clientWidth, sh = s.clientHeight;
    const vw = land ? 2532 : 1170, vh = land ? 1170 : 2534;
    const [bx, by, bw, bh] = land ? [0, 0, 2532, 1170] : c.pat.box, [u0, v0, u1, v1] = c.pat.zone;
    const k = Math.max(sw / vw, sh / vh), ox = (sw - vw * k) / 2, oy = (sh - vh * k) / 2;
    Object.assign(z.style, { left:(ox + (bx + u0 * bw) * k)+'px', top:(oy + (by + v0 * bh) * k)+'px', width:((u1 - u0) * bw * k)+'px', height:((v1 - v0) * bh * k)+'px' });
  }
  function heart(s, x, y) {
    const r = s.getBoundingClientRect(), el = document.createElement('i'); el.className = 'phrt'; el.innerHTML = HEART;
    const land = document.body.classList.contains('land');
    // 横持ち中は画面が回っているので、指の位置をスライドの中の向きに直す
    const lx = land && !matchMedia('(orientation:landscape)').matches ? y - r.top : x - r.left;
    const ly = land && !matchMedia('(orientation:landscape)').matches ? r.right - x : y - r.top;
    el.style.left = lx + 'px'; el.style.top = ly + 'px';
    const sz = 12 + Math.random() * 10; el.style.width = el.style.height = sz + 'px';
    s.appendChild(el);
    el.animate([{ transform:'translate(-50%,-50%) scale(.3)', opacity:0 }, { transform:'translate(-50%,-90%) scale(1)', opacity:1, offset:.25 },
                { transform:`translate(${-50 + (Math.random() - .5) * 120}%,-260%) scale(.8)`, opacity:0 }], { duration:900, easing:'ease-out' }).finished.then(() => el.remove());
  }
  function start(s, pv) {
    if (s._patting) return; s._patting = true; haptic();
    try { pv.currentTime = 0; } catch(e) {}
    const go = () => {
      pv.classList.add('on');
      const dur = (pv.duration && isFinite(pv.duration) ? pv.duration : 5.6);
      clearTimeout(s._pt); s._pt = setTimeout(() => { pv.classList.remove('on'); s._pt = setTimeout(() => { pv.pause(); s._patting = false; }, 380); }, Math.max(600, (dur - 0.4) * 1000));
    };
    pv.play().then(go).catch(() => { s._patting = false; });
  }
  function stop(s) {
    const pv = s.querySelector('.patv'); if (!pv) return;
    clearTimeout(s._pt); pv.classList.remove('on'); pv.pause(); s._patting = false;
  }
  function bind(i, s, z, pv) {
    let st = null;
    z.addEventListener('pointerdown', e => {
      e.stopPropagation(); ctx.resume(); wake();
      st = { sx:e.clientX, sy:e.clientY, lx:e.clientX, ly:e.clientY, dir:0, ext:e.clientX, rev:0, dist:0, acc:0, t0:Date.now() };
      try { z.setPointerCapture(e.pointerId); } catch(err) {}
    });
    z.addEventListener('pointermove', e => {
      if (!st) return; e.stopPropagation();
      const x = e.clientX, y = e.clientY, d = Math.hypot(x - st.lx, y - st.ly);
      st.dist += d; st.acc += d; st.lx = x; st.ly = y;
      if (st.acc > 38) { st.acc = 0; heart(s, x, y); }   // 撫でている間は小さなハート
      // 左右（または上下）に往復したら「撫でた」
      const p = Math.abs(x - st.sx) >= Math.abs(y - st.sy) ? x : y;
      if (st.dir === 0) { if (Math.abs(p - (Math.abs(x - st.sx) >= Math.abs(y - st.sy) ? st.sx : st.sy)) > 14) { st.dir = 1; st.ext = p; st.axis = p === x ? 'x' : 'y'; st.prev = p; } }
      else {
        const q = st.axis === 'x' ? x : y, mv = q - st.prev; st.prev = q;
        if (Math.sign(mv) === st.dir || mv === 0) { if (st.dir > 0 ? q > st.ext : q < st.ext) st.ext = q; }
        if (st.dir > 0 && st.ext - q > 14) { st.rev++; st.dir = -1; st.ext = q; }
        else if (st.dir < 0 && q - st.ext > 14) { st.rev++; st.dir = 1; st.ext = q; }
        if (st.rev >= 1) start(s, pv);
      }
    });
    const end = e => {
      if (!st) return; e.stopPropagation();
      const tap = st.dist < 10 && Date.now() - st.t0 < 500; st = null;
      if (tap) playVoice();   // 撫でずに軽くタップしたときは、いつもどおりボイス
    };
    z.addEventListener('pointerup', end); z.addEventListener('pointercancel', e => { st = null; });
    place(i);
  }
  addEventListener('resize', () => chars.forEach((c, i) => c.pat && place(i)));
  return { bind, stop, place };
})();
function prefetchNear() {
  [current - 1, current + 1].forEach(i => loadBuf(chars[(i + chars.length) % chars.length].bgm.src).catch(() => {}));
}

// ===== 右上アイコン（4秒で消える） =====
let idleTimer;
function wake() {
  document.body.classList.remove('idle'); clearTimeout(idleTimer);
  idleTimer = setTimeout(() => document.body.classList.add('idle'), 4000);
}
const ICON = {
  on:'<svg viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  off:'<svg viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><path d="M3 3l18 18"/></svg>',
  land:'<svg viewBox="0 0 24 24"><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M2 9a10 10 0 0 0 3 8M22 15a10 10 0 0 0-3-8"/></svg>',
};
function drawIcons() { $('bgmBtn').innerHTML = bgmOn ? ICON.on : ICON.off; $('landBtn').innerHTML = ICON.land; }

// ===== デフォルメの位置（壁紙の中の位置に合わせる） =====
const probe = document.createElement('div');
probe.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;padding-top:env(safe-area-inset-top)';
function layoutChibis() {
  document.querySelectorAll('.page.show').forEach(pg => {
    const cs = [...pg.querySelectorAll('.chibi.real')]; if (!cs.length) return;
    const W = pg.clientWidth, H = pg.clientHeight;
    const safeTop = parseFloat(getComputedStyle(probe).paddingTop) || 0;
    const tabH = $('tabs').offsetHeight;
    const K = 1.12;   // デフォルメを少しだけ大きく（足元を基準に）
    const R = cs.map(c => {
      const ww = +c.dataset.ww, wh = +c.dataset.wh, s = Math.max(W / ww, H / wh), ox = (W - ww * s) / 2;
      const w = c.dataset.w * s, hh = c.dataset.h * s;
      return { c, x: ox + c.dataset.x * s - w * (K - 1) / 2, y: c.dataset.y * s - hh * (K - 1), w: w * K, h: hh * K };
    });
    const bottomBand = pg.classList.contains('bandBottom');
    let dy = 0;
    if (bottomBand) { const lim = H - tabH - 6, mb = Math.max(...R.map(r => r.y + r.h)); if (mb > lim) dy = lim - mb; }
    else { const lim = safeTop + 2, mt = Math.min(...R.map(r => r.y)); if (mt < lim) dy = lim - mt; }
    R.forEach(r => { r.y += dy; Object.assign(r.c.style, { left:r.x+'px', top:r.y+'px', width:r.w+'px', height:r.h+'px' }); });
    const minT = Math.min(...R.map(r => r.y)), maxB = Math.max(...R.map(r => r.y + r.h));
    const minL = Math.min(...R.map(r => r.x)), maxR = Math.max(...R.map(r => r.x + r.w));
    const fr = pg.querySelector('.frame');
    if (bottomBand) fr.style.bottom = (H - minT + 4) + 'px'; else fr.style.top = (maxB + 4) + 'px';
    const band = pg.querySelector('.band');
    const onLeft = (minL + maxR) / 2 < W / 2;
    Object.assign(band.style, { top:minT+'px', height:(maxB-minT)+'px', bottom:'auto', left: onLeft ? maxR+'px' : '0px', right: onLeft ? '0px' : (W-minL)+'px' });
  });
}

// ===== タブ切り替え（各タブの入る・出るを知らせる） =====
const TabHooks = {};   // { todo:{ enter(), leave() }, ... }
function switchTab(next) {
  if (next === tab) return;
  const prev = tab;
  if (TabHooks[prev] && TabHooks[prev].leave) TabHooks[prev].leave();
  tab = next;
  [...$('tabs').children].forEach(x => x.classList.toggle('on', x.dataset.tab === tab));
  const leaving = $('page-' + prev);
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('show', p.id === 'page-' + tab));
  if (leaving) { leaving.classList.add('leaving'); clearTimeout(leaving._lt); leaving._lt = setTimeout(() => leaving.classList.remove('leaving'), 260); }
  haptic();
  $('tabs').classList.toggle('light', tab !== 'favorite');
  $('tabs').style.setProperty('--tabAccent', TAB_ACCENT[tab] || '');
  layoutChibis();
  if (tab === 'favorite') updateVideos();
  else { showTabs(); slidesEl.querySelectorAll('video').forEach(v => v.pause()); }
  syncBgm(120);
  setTimeout(trimBgmCache, 1500);
  if (TabHooks[tab] && TabHooks[tab].enter) TabHooks[tab].enter(prev);
  if (tab !== 'favorite') stagger($('page-' + tab).querySelector('.scroll'));
}

// ===== トースト =====
function toast(msg, ms = 1400) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), ms);
}

// ===== データ保存（IndexedDB：この端末の中だけ） =====
const DB = (() => {
  const STORES = ['todos', 'loves', 'accounts', 'profile', 'settings', 'ops', 'room', 'events', 'album', 'music'];
  const BLOBS = ['album', 'music'];   // 写真・曲は書き出しに入れない（大きいので）
  let dbp;
  const open = () => dbp || (dbp = new Promise((ok, ng) => {
    const r = indexedDB.open('kani-favorite', 3);
    r.onupgradeneeded = () => STORES.forEach(s => { if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s, { keyPath:'id' }); });
    r.onsuccess = () => ok(r.result); r.onerror = () => ng(r.error);
  }));
  const tx = async (store, mode, fn) => { const db = await open(); return new Promise((ok, ng) => {
    const t = db.transaction(store, mode), s = t.objectStore(store), res = fn(s);
    t.oncomplete = () => ok(res && 'result' in res ? res.result : undefined); t.onerror = () => ng(t.error); }); };
  return {
    STORES, BLOBS,
    all: s => tx(s, 'readonly', st => st.getAll()),
    get: (s, id) => tx(s, 'readonly', st => st.get(id)),
    put: (s, obj) => tx(s, 'readwrite', st => st.put(obj)),
    putMany: (s, objs) => tx(s, 'readwrite', st => { objs.forEach(o => st.put(o)); }),
    del: (s, id) => tx(s, 'readwrite', st => st.delete(id)),
    clear: s => tx(s, 'readwrite', st => st.clear()),
  };
})();
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ===== 日付の小道具 =====
const D = {
  key: d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`,
  today: () => D.key(new Date()),
  parse: s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); },
  diff: (a, b) => Math.round((D.parse(a) - D.parse(b)) / 86400000),   // a - b（日）
  add: (s, n) => { const d = D.parse(s); d.setDate(d.getDate() + n); return D.key(d); },
  addMonth: (s, n) => { const d = D.parse(s), day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n);
                        const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(day, last)); return D.key(d); },
  md: s => { const d = D.parse(s); return `${d.getMonth() + 1}/${d.getDate()}`; },
  ymd: s => s.replace(/-/g, '.'),
  dow: s => '日月火水木金土'[D.parse(s).getDay()],
};

// ===== 書き出し・読み込み =====
async function exportData() {
  const data = { app:'kani-favorite', version:1, exportedAt:new Date().toISOString(), stores:{} };
  for (const s of DB.STORES) if (!DB.BLOBS.includes(s)) data.stores[s] = await DB.all(s);
  const d = new Date(), stamp = `${d.getFullYear()}${p2(d.getMonth()+1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}`;
  const name = `kani-favorite-${stamp}.json`;
  const blob = new Blob([JSON.stringify(data)], { type:'application/json' });
  const file = new File([blob], name, { type:'application/json' });
  try {
    if (navigator.canShare && navigator.canShare({ files:[file] })) { await navigator.share({ files:[file], title:name }); LS.set('kf-lastExport', Date.now()); fillInfo(); return toast('書き出しました'); }
  } catch(e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000); LS.set('kf-lastExport', Date.now()); fillInfo(); toast('書き出しました');
}
// 設定の下の情報（件数・容量・最後に書き出した日）
const VERSION = '2.8';
async function fillInfo() {
  const el = $('appInfo'); if (!el) return;
  const n = {}; for (const s of ['todos', 'loves', 'profile', 'accounts']) n[s] = (await DB.all(s)).length;
  let size = '';
  try { const e = await navigator.storage.estimate(); size = `${(e.usage / 1048576).toFixed(1)} MB`; } catch(e) {}
  const last = LS.get('kf-lastExport');
  el.innerHTML = `<div><span>Todo</span><b>${n.todos}</b></div><div><span>Love</span><b>${n.loves}</b></div><div><span>Profile</span><b>${n.profile}</b></div><div><span>Accounts</span><b>${n.accounts}</b></div>
    <div class="w"><span>最後に書き出した日</span><b>${last ? new Date(+last).toLocaleDateString('ja-JP') : 'まだありません'}</b></div>${size ? `<div class="w"><span>使っている容量</span><b>${size}</b></div>` : ''}
    <div class="w ver"><span>Kani Favorite</span><b>v${VERSION}</b></div>`;
}
async function importData(file) {
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'kani-favorite' || !data.stores) throw new Error('format');
    if (!confirm('今のデータを、このファイルの内容で置き換えます。よろしいですか？')) return;
    for (const s of DB.STORES) { if (DB.BLOBS.includes(s) || !data.stores[s] && ['room', 'events'].includes(s)) continue; await DB.clear(s); await DB.putMany(s, data.stores[s] || []); }
    App.reloadAll();
    toast('読み込みました');
  } catch(e) { toast('読み込めませんでした（形式が違います）'); }
}

// ===== スプラッシュ =====
const SLOTS = [   // 中心x・上端y（画面比）、最大幅・最大高さ、飛んでくる方向
  { cx:.25, y:.065, mw:.47, mh:.25, fx:'-70vw', fy:'-40vh', fr:'-25deg' },
  { cx:.76, y:.075, mw:.44, mh:.25, fx:'70vw',  fy:'-40vh', fr:'25deg' },
  { cx:.235, y:.52, mw:.47, mh:.225, fx:'-80vw', fy:'0vh',  fr:'-20deg' },
  { cx:.765, y:.51, mw:.44, mh:.225, fx:'80vw',  fy:'0vh',  fr:'20deg' },
  { cx:.5,  y:.735, mw:.45, mh:.215, fx:'0vw',   fy:'60vh', fr:'15deg' },
];
const imgRatio = {};
function loadImg(src) { return new Promise(ok => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = src; }); }
async function buildSplash() {
  const box = $('scs');
  const order = shuffle([0, 1, 2, 3, 4]);   // 入ってくる順番もばらばら
  const ims = await Promise.all(pick5.map(p => loadImg(`${p.n}_jump.webp`)));
  pick5.forEach((p, k) => { const im = ims[k]; imgRatio[p.n] = im ? im.naturalWidth / im.naturalHeight : .9; loadImg(`${p.n}_chibi.webp`); });
  const place = () => {
    const W = innerWidth, H = innerHeight;
    [...box.children].forEach(el => {
      const s = SLOTS[+el.dataset.slot], ar = imgRatio[el.dataset.n];
      const w = Math.min(s.mw * W, s.mh * H * ar), h = w / ar;
      Object.assign(el.style, { width:w+'px', height:h+'px', left:(s.cx * W - w / 2)+'px', top:(s.y * H + (+el.dataset.slot < 2 ? Math.max(0, s.mh * H - h) : 0))+'px' });
    });
  };
  pick5.forEach((p, k) => {
    const s = SLOTS[k], el = document.createElement('div');
    el.className = 'sc'; el.dataset.n = p.n; el.dataset.slot = k;
    el.style.setProperty('--d', (0.12 + order.indexOf(k) * 0.13) + 's');
    el.style.setProperty('--od', (order.indexOf(k) * 0.05) + 's');
    el.style.setProperty('--bd', (-Math.random() * 2.6) + 's');
    el.style.setProperty('--fx', s.fx); el.style.setProperty('--fy', s.fy); el.style.setProperty('--fr', s.fr);
    el.innerHTML = `<div class="inner"><img class="j" src="${p.n}_jump.webp" alt=""><img class="l" src="${p.n}_chibi.webp" alt=""><div class="dust"><i></i><i></i></div></div>`;
    el.addEventListener('animationend', e => { if (e.animationName === 'flyin') el.classList.add('landed'); });
    box.appendChild(el);
  });
  place(); addEventListener('resize', place);
  // きらきら
  for (let i = 0; i < 14; i++) {
    const s = document.createElement('i'); s.className = 'spk';
    const z = 6 + Math.random() * 9;
    Object.assign(s.style, { left:(5 + Math.random() * 90)+'%', top:(8 + Math.random() * 84)+'%', width:z+'px', height:z+'px' });
    s.style.setProperty('--sd', (1.2 + Math.random() * 3) + 's'); s.style.setProperty('--t', (3 + Math.random() * 2.5) + 's');
    $('splash').insertBefore(s, $('scs'));
  }
}
function buildLogo() {
  const w = $('sword');
  [...'Favorite'].forEach((c, i) => { const s = document.createElement('span'); s.className = 'ch'; s.innerHTML = `<span class="bk">${c}</span><span class="fg">${c}</span>`; s.style.setProperty('--i', i); w.appendChild(s); });
  w.insertAdjacentHTML('beforeend', '<svg class="star" viewBox="0 0 24 24"><path d="M12 1.5l3 6.8 7.3.6-5.5 4.8 1.7 7.2L12 17l-6.5 3.9 1.7-7.2L1.7 8.9l7.3-.6z" fill="#FFD866" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/></svg>');
  const place = () => {
    const r0 = w.getBoundingClientRect(), W = r0.width, L0 = r0.left;
    w.querySelectorAll('.ch').forEach(s => { const r = s.getBoundingClientRect(); s.style.setProperty('--W', W + 'px'); s.style.setProperty('--X', (L0 - r.left) + 'px'); });
    const ci = w.querySelectorAll('.ch')[5].getBoundingClientRect(), st = w.querySelector('.star');
    st.style.left = (ci.left - L0 + ci.width / 2) + 'px'; st.style.top = (ci.height * 0.3) + 'px';
  };
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(place); addEventListener('resize', place);
}

// ===== 起動 =====
const App = {
  modules: [],
  reloadAll() { this.modules.forEach(m => m.reload && m.reload()); },
  boot() {
    document.body.appendChild(probe);
    tick(); drawIcons(); buildLogo(); buildSplash();
    // タイトル曲を最優先で展開（タップした瞬間に鳴らすため）
    const titleReady = loadBuf(TITLE_BGM.src).then(() => { $('loadState').textContent = ''; })
      .catch(() => { $('loadState').textContent = 'BGMの読み込みに失敗しました'; });
    titleReady.then(() => loadBuf(chars[current].bgm.src).catch(() => {}));

    chars.forEach(() => { slidesEl.appendChild(Object.assign(document.createElement('div'), { className:'slide' })); dotsEl.appendChild(document.createElement('span')); });
    Office.makeDoor(); Room.makeDoor(); Ops.makeDoor(); Cafe.makeDoor();   // 左から：カフェ・自室・執務室
    chars.forEach((c, i) => loadChar(i));
    slidesEl.scrollLeft = slidesEl.clientWidth * (current + OFF);
    requestAnimationFrame(() => { slidesEl.scrollLeft = slidesEl.clientWidth * (current + OFF); });
    updateVideos();

    let dotTimer;
    slidesEl.addEventListener('scroll', () => {
      if (phase !== 'app') return;
      dotsEl.classList.add('show'); clearTimeout(dotTimer);
      dotTimer = setTimeout(() => { dotsEl.classList.remove('show'); updateVideos(); }, 1200);   // 止まったら、今のメモロビ以外は止める
      const f = slidesEl.scrollLeft / slidesEl.clientWidth - OFF, nb = f > current ? current + 1 : current - 1;
      if (tab === 'favorite' && Math.abs(f - current) > 0.04) { const ns = slideOf(nb), nv = ns && ns.querySelector('video.lv'); if (nv && nv.paused) { nv.preload = 'auto'; nv.play().catch(() => {}); } }
      const i = Math.round(f);
      Ops.setDoor(i === chars.length);   // 右端の先は作戦室のドア
      Office.setDoor(i === -1);          // メモロビの左隣は執務室
      Room.setDoor(i === -2);            // その左は自室
      Cafe.setDoor(i === -3);            // いちばん左はカフェ
      if (i !== current && i >= 0 && i < chars.length) { current = i; updateVideos(); syncBgm(250); prefetchNear(); setTimeout(trimBgmCache, 1500); }
    }, { passive:true });
    let tx = 0, ty = 0, tt = 0;
    slidesEl.addEventListener('pointerdown', e => { tx = e.clientX; ty = e.clientY; tt = Date.now(); });
    slidesEl.addEventListener('pointerup', e => { if (Ops.isDoor() || Room.isDoor() || Cafe.isDoor() || Office.isDoor()) return; if (Math.hypot(e.clientX - tx, e.clientY - ty) < 10 && Date.now() - tt < 500) { wake(); playVoice(); } });
    document.addEventListener('pointerdown', wake, { passive:true, capture:true });

    const handle = $('handle'); let hy = 0;
    handle.addEventListener('pointerdown', e => { hy = e.clientY; e.stopPropagation(); });
    handle.addEventListener('pointerup', e => { e.stopPropagation(); showTabs(); wake(); });
    handle.addEventListener('pointermove', e => { if (hy && hy - e.clientY > 20) { showTabs(); wake(); hy = 0; } });

    $('bgmBtn').addEventListener('click', e => { e.stopPropagation(); bgmOn = !bgmOn; drawIcons(); syncBgm(); });
    $('landBtn').addEventListener('click', e => {
      e.stopPropagation(); document.body.classList.toggle('land');
      chars.forEach((c, i) => loadChar(i)); preloadPosters();
      requestAnimationFrame(() => { slidesEl.scrollLeft = slidesEl.clientWidth * (current + OFF); });
    });
    document.querySelectorAll('.icons button').forEach(b => ['pointerdown','pointerup'].forEach(ev => b.addEventListener(ev, e => e.stopPropagation())));

    $('tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) switchTab(b.dataset.tab); });
    $('tabs').addEventListener('pointerdown', e => {   // 指が触れた瞬間にそのタブの曲を先読み
      const b = e.target.closest('button'); if (b && TAB_BGM[b.dataset.tab]) loadBuf(TAB_BGM[b.dataset.tab].src).catch(() => {});
      if (b && TabHooks[b.dataset.tab] && TabHooks[b.dataset.tab].press) TabHooks[b.dataset.tab].press();
    }, { passive:true });
    addEventListener('resize', layoutChibis);

    document.addEventListener('visibilitychange', () => {
      if (phase === 'lock') return;
      if (document.hidden) { stopBgm(0.1); ctx.suspend(); }
      else ctx.resume().then(() => { updateVideos(); syncBgm(); Room.paintDoor(); Cafe.paintDoor(); Office.paintDoor(); });
      Object.values(TabHooks).forEach(h => h.visibility && h.visibility(document.hidden));
    });

    // 設定
    const sheet = $('sheet'), sheetBg = $('sheetBg');
    const openSheet = () => { sheet.classList.add('show'); sheetBg.classList.add('show'); fillInfo(); };
    const closeSheet = () => { sheet.classList.remove('show'); sheetBg.classList.remove('show'); };
    ['pointerdown','click'].forEach(ev => $('gearBtn').addEventListener(ev, e => e.stopPropagation()));
    $('gearBtn').addEventListener('click', openSheet);
    sheetBg.addEventListener('click', closeSheet); $('sheetClose').addEventListener('click', closeSheet);
    $('exportBtn').addEventListener('click', exportData);
    $('importBtn').addEventListener('click', () => $('importFile').click());
    $('importFile').addEventListener('change', e => { const f = e.target.files[0]; if (f) importData(f); e.target.value = ''; });

    // 1回目のタップ：ロック解除 → タイトル曲と演出（音はその瞬間に頭から）
    // 2回目のタップ：アプリへ
    const splash = $('splash');
    const startTitle = () => {   // タイトルの演出とBGM（タップの流れの中で呼ぶ）
      if (phase !== 'lock') return;
      ctx.resume();
      phase = 'splash';
      if (buffers[TITLE_BGM.src]) syncBgm(0, 0.12); else titleReady.then(() => syncBgm(0, 0.25));
      splash.classList.add('run');
      setTimeout(() => splash.classList.add('ready'), 2200);
    };
    splash.addEventListener('click', async () => {
      if (phase === 'lock') {
        if (AppLock.locked()) return;
        startTitle();
      } else if (phase === 'splash' && splash.classList.contains('ready')) {
        phase = 'app';
        splash.classList.add('go');
        stopBgm(0.7);
        const v = slideOf(current).querySelector('video'); if (v) v.play().catch(() => {});
        setTimeout(() => { splash.classList.add('hide'); syncBgm(0, 0.9); prefetchNear(); wake(); chars.forEach((c, i) => sizeMedia(i)); }, 800);
        setTimeout(() => Room.warmup(), 8000);   // 前日の日報を裏で用意しておく
        // 重い先読み（となりの動画・止め絵）は、今のメモロビのBGMが鳴り始めてから
        loadBuf(chars[current].bgm.src).catch(() => {}).then(() => sleep(1500)).then(() => { bgReady = true; updateVideos(); setTimeout(preloadPosters, 1500); });
        setTimeout(() => Motion.preloadAll(), 2500);   // 動きの画像は、落ち着いてから先読み
        setTimeout(() => { splash.style.display = 'none'; }, 1500);
      }
    });

    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(e => console.log('sw', e.message));
    this.modules.forEach(m => m.init && m.init());
    AppLock.init();
    if (AppLock.needAtBoot()) AppLock.show(startTitle);   // ロック → 開けたらそのままタイトルへ
  },
};
