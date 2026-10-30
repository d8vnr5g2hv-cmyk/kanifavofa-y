// Kani Favorite — タイトル画面（メモリアルの絵）
// 流れ：うっすらスプラッシュ →（タッチ：タイトル曲）→ 1枚目 →（タッチ：ロックがオンなら Face ID）→ 2枚目＋ボイス →（タッチ）→ ロビー
// 起動ごとに8人から1人が出迎える。上に、絵の雰囲気に合わせた淡い光の粒・光の筋を重ねる
'use strict';
const Title = (() => {
  // face：顔の位置（絵に対する割合 x, y, 半径x, 半径y）。光の粒は顔に近づくと消える
  const FX = {
    hoshino:{ face:[.66, .51, .21, .13], col:['#fff1e0', '#ffd9c2'], rays:null, glow:['24%', '57%', '220px', 'rgba(255,190,120,.75)'], voice:'hoshino' },
    mika:   { face:[.6, .43, .2, .12], col:['#fff6fb', '#efe4ff'], rays:['rgba(255,240,255,.4)', [8, 22, 70]], voice:'mika' },
    mari:   { face:[.54, .47, .21, .13], col:['#fffaf0', '#ffe6ef'], rays:['rgba(255,245,225,.45)', [55, 75]], voice:'mari' },
    hina:   { face:[.5, .33, .2, .12], col:['#f1dcff', '#c99bff'], rays:null, glow:['50%', '8%', '260px', 'rgba(190,110,255,.45)'], vig:'rgba(20,0,40,.55)', voice:'hina' },
    miyako: { face:[.52, .39, .22, .13], col:['#eef8ff', '#cfe9ff'], rays:['rgba(200,230,255,.35)', [70, 85]], vig:'rgba(0,10,30,.35)', voice:'miyako' },
    kisaki: { face:[.33, .43, .22, .12], col:['#fff4f8', '#ffdbe8'], rays:null, voice:'sofa' },
    nico:   { face:[.6, .39, .22, .13], col:['#fff4f8', '#ffe0ea'], rays:['rgba(255,250,235,.4)', [62, 80]], voice:'kitchen' },
    yuuka:  { face:[.6, .46, .2, .12], col:['#fffbe6', '#e6f4ff'], rays:['rgba(255,250,220,.5)', [78, 90]], glow:['86%', '5%', '300px', 'rgba(255,245,200,.85)'], voice:'office' },
  };
  const KEYS = Object.keys(FX), N = 30, IW = 853, IH = 1843;
  let root, cv, g, W = 0, H = 0, k = null, step = 0, busy = false, parts = [], face = null, raf = 0, last = 0, hooks = {};
  const img = (k, i) => `title_${k}_${i}.jpg`;

  function pick() {
    let prev = null; try { prev = LS.get('kf-title'); } catch (e) {}
    let c; do { c = KEYS[Math.floor(Math.random() * KEYS.length)]; } while (c === prev && KEYS.length > 1);
    try { LS.set('kf-title', c); } catch (e) {}
    return c;
  }
  function build() {
    root = h(`<div id="ttl" class="tt-s0">
      <div class="tt-shot a"></div><div class="tt-shot b"></div>
      <div class="tt-rays"></div><div class="tt-glow"></div><div class="tt-vig"></div>
      <canvas class="tt-cv"></canvas><div class="tt-bloom"></div>
      <div class="tt-clock"><b></b><small></small></div>
      <div class="tt-touch"></div>
      <div class="tt-splash"><b>KANI FAVORITE</b><small id="ttState">TAP TO START</small></div>
    </div>`);
    const sp = $('splash'); sp.classList.add('nt'); sp.insertBefore(root, sp.firstChild);
    cv = root.querySelector('.tt-cv'); g = cv.getContext('2d');
    addEventListener('resize', () => { size(); faceBox(); });
  }
  function size() {
    W = root.clientWidth; H = root.clientHeight;
    cv.width = W * devicePixelRatio; cv.height = H * devicePixelRatio; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    g.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }
  function setChar(c) {
    k = c; const f = FX[c];
    root.querySelector('.tt-shot.a').style.backgroundImage = `url(${img(c, 1)})`;
    root.querySelector('.tt-shot.b').style.backgroundImage = `url(${img(c, 2)})`;
    const r = root.querySelector('.tt-rays'); r.innerHTML = '';
    if (f.rays) f.rays[1].forEach((x, i) => { const e = document.createElement('i');
      e.style.cssText = `--x:${x}%;--w:${40 + Math.random() * 40}px;--r:${x < 50 ? -18 : 18}deg;--rc:${f.rays[0]};--d:${3 + Math.random() * 3}s;--dl:${-i * 1.3}s`; r.appendChild(e); });
    const gl = root.querySelector('.tt-glow');
    if (f.glow) { gl.style.display = ''; ['--gx', '--gy', '--gs', '--gc'].forEach((v, i) => gl.style.setProperty(v, f.glow[i])); } else gl.style.display = 'none';
    root.querySelector('.tt-vig').style.setProperty('--vg', f.vig || 'rgba(0,0,0,0)');
  }
  function faceBox() {
    if (!k) return;
    const f = FX[k].face, sc = Math.max(W * 1.04 / IW, H * 1.04 / IH), iw = IW * sc, ih = IH * sc;
    face = { x:W / 2 + (f[0] - .5) * iw, y:H / 2 + (f[1] - .5) * ih, rx:f[2] * iw, ry:f[3] * ih };
  }
  function faceFade(p) {
    if (!face) return 1;
    const d = Math.hypot((p.x - face.x) / face.rx, (p.y - face.y) / face.ry);
    return d >= 1.25 ? 1 : d <= .85 ? 0 : (d - .85) / .4;
  }
  // 光の粒：奥は小さく淡く、手前は少しぼかす。下からゆっくり浮かぶ
  function spawn(any) {
    const z = Math.random(), near = z > .85;
    return { x:Math.random() * W, y:any ? Math.random() * H : H + 20, z, near, s:(1.5 + z * 3) * (near ? 2.2 : 1), sway:Math.random() * 6.28, tw:Math.random() * 6.28,
      vy:-(12 + z * 40) * .35, vx:0, vb:0, col:FX[k].col[Math.random() < .5 ? 0 : 1] };
  }
  function loop(t) {
    const dt = Math.min(.05, (t - last) / 1000 || 0); last = t;
    g.clearRect(0, 0, W, H);
    if (step >= 1 && step < 3) {
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        p.sway += dt * 1.3; p.tw += dt * 2;
        p.x += (Math.sin(p.sway) * 14 + .08 * (30 + p.z * 60)) * dt + p.vx * dt; p.y += p.vy * dt + p.vb * dt; p.vx *= .985; p.vb *= .985;
        if (p.y < -40 || p.x > W + 40 || p.x < -40 || p.y > H + 40) { parts[i] = spawn(false); continue; }
        const ff = faceFade(p); if (ff <= 0) continue;
        const a = (.25 + .5 * (Math.sin(p.tw * .6) * .5 + .5)) * (.5 + p.z * .5);
        g.save(); g.translate(p.x, p.y); g.globalAlpha = a * ff; if (p.near) g.filter = 'blur(2.5px)';
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, p.s * 3); gr.addColorStop(0, '#fff'); gr.addColorStop(.3, p.col); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(0, 0, p.s * 3, 0, 7); g.fill(); g.restore();
      }
    }
    if (step < 3) raf = requestAnimationFrame(loop);
  }
  function burst(x, y) {
    for (let i = 0; i < 7; i++) { const p = spawn(true); p.x = x; p.y = y; const a = Math.random() * 6.28, v = 30 + Math.random() * 50; p.vx = Math.cos(a) * v; p.vb = Math.sin(a) * v - 25; parts.push(p); }
    if (parts.length > N + 40) parts.splice(0, parts.length - N - 40);
  }
  const clock = () => { const d = new Date(), w = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    root.querySelector('.tt-clock b').textContent = `${p2(d.getHours())}:${p2(d.getMinutes())}`; root.querySelector('.tt-clock small').textContent = `${d.getMonth() + 1}.${d.getDate()} ${w[d.getDay()]}`; };
  function touch(t, d) { const e = root.querySelector('.tt-touch'); e.className = 'tt-touch'; e.textContent = t; setTimeout(() => { if (step < 3) e.className = 'tt-touch on'; }, d); }

  // ===== 入口 =====
  // o：{ start(), enter(), lock:()=>bool, unlock(cb) }
  function init(o) {
    hooks = o; build(); size(); setChar(pick()); faceBox(); clock(); setInterval(clock, 10000);
    [1, 2].forEach(i => { new Image().src = img(k, i); });
    parts = []; for (let i = 0; i < N; i++) parts.push(spawn(true));
    raf = requestAnimationFrame(loop);
    $('splash').addEventListener('click', onTap);
  }
  async function onTap(e) {
    if (busy || e.target.closest('.gear') || e.target.closest('#gate')) return;
    const r = root.getBoundingClientRect(); if (step >= 1) burst(e.clientX - r.left, e.clientY - r.top);
    if (step === 0) {          // スプラッシュ → 1枚目（ここでタイトル曲）
      busy = true; hooks.start(); root.className = 'tt-s1'; step = 1; touch('TOUCH', 2200);
      await sleep(1500); busy = false;
    } else if (step === 1) {   // 1枚目 →（ロックがオンなら解除）→ 2枚目
      if (hooks.lock()) { busy = true; hooks.unlock(() => { busy = false; smile(); }, () => { busy = false; }); return; }
      smile();
    } else if (step === 2) {   // 2枚目 → ロビー
      step = 3; root.querySelector('.tt-touch').className = 'tt-touch'; hooks.enter();
      setTimeout(() => cancelAnimationFrame(raf), 1600);
    }
  }
  async function smile() {
    busy = true;
    root.querySelector('.tt-touch').className = 'tt-touch';
    const b = root.querySelector('.tt-bloom'); b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
    root.className = 'tt-s2'; step = 2;
    try { playVoice(FX[k].voice); } catch (e) {}
    touch('TOUCH TO ENTER', 1800);
    await sleep(1200); busy = false;
  }
  return { init, step:() => step, setLoad:t => { const s = $('ttState'); if (s) s.textContent = t || 'TAP TO START'; } };
})();
