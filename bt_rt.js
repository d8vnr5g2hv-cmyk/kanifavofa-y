// Kani Favorite — 実戦のリアルタイム戦闘（本家ブルアカ式）
// Battle（battle.js）から BtRT.start(定義, 設定) で呼ばれ、結果を Promise で返す。保存はしない（結果の反映は Battle 側）
'use strict';
const BtRT = (() => {
  // ===== 武器の型（自動攻撃） =====
  // line：前に出る順（大きいほど前）。muz：銃口の位置（ちび絵に対する割合）
  const WEP = {
    hoshino:{ atk:6,  pel:3, rng:.42, cd:1.1,  line:3, se:'sg', muz:[.987, .466] },
    yuuka:  { atk:4,  pel:2, rng:.5,  cd:.55,  line:3, se:'hg', muz:[.986, .538] },
    miyako: { atk:10, pel:1, rng:.66, cd:.85,  line:2, se:'ar', muz:[.986, .5] },
    mika:   { atk:12, pel:1, rng:.62, cd:.62,  line:2, se:'ar', muz:[.989, .538] },
    hina:   { atk:5,  pel:1, rng:.62, cd:.34,  line:2, se:'mg', muz:[.989, .549] },
    kisaki: { atk:6,  pel:1, rng:.6,  cd:.7,   line:1, se:'hg', muz:[.986, .505] },
    mari:   { atk:3,  pel:1, rng:.66, cd:1.0,  line:0, se:'hg', muz:[.986, .489], heal:9, hcd:2.4 },
    nico:   { atk:4,  pel:1, rng:.62, cd:.9,   line:0, se:'hg', muz:[.986, .514], heal:8, hcd:2.2 },
  };
  const VOICE = { hoshino:'hoshino', mari:'mari', miyako:'miyako', nico:'kitchen', mika:'mika', hina:'hina', yuuka:'office', kisaki:'sofa' };
  // 敵（ステージの倍率 m で HP と攻撃が上がる）
  const FOE = {
    drone: { hp:70,   atk:7,  rng:.45, cd:1.1, spd:70, h:.09, fly:1, any:1 },
    thug:  { hp:130,  atk:11, rng:.38, cd:1.3, spd:55, h:.25 },
    robot: { hp:320,  atk:18, rng:.26, cd:1.7, spd:38, h:.26 },
    heavy: { hp:1700, atk:30, rng:.4,  cd:2.1, spd:30, h:.34, boss:1, aoe:4 },
    dummy: { hp:1e9,  atk:6,  rng:.4,  cd:1.6, spd:40, h:.32, dummy:1, img:'bt_e_heavy' },
  };
  const COST_MAX = 10, COST_RATE = 1 / 1.5, TIME = 180;
  // カード効果の倍率（ターン制の数値をリアルタイム用に換算）
  const K = { dmg:8, dmgAll:6, sh:4, heal:4, buff:8, stun:2.5 };

  let A = null;      // Battle から渡される道具（CH, CARD, cardOf, cardHTML など）
  let G = null, done = null, built = false, last = 0, raf = 0;
  const el = id => document.getElementById(id);

  // ===== 効果音 =====
  const SE = { sg:'se_sg.mp3', ar:'se_ar.mp3', hg:'se_hg.mp3', mg:'se_mg.mp3', foe:'se_foe.mp3', big:'se_big.mp3', bigall:'se_bigall.mp3',
    aoe:'se_bossaoe.mp3', heal:'se_heal.mp3', card:'se_card.mp3', boom:'se_boom.mp3' };
  const VOL = { sg:.55, ar:.5, hg:.4, mg:.4, foe:.25, big:.7, bigall:.7, aoe:.6, heal:.5, card:.6, boom:.6 };
  let seGain = null; const seLast = {};
  function preload() { Object.values(SE).forEach(u => loadBuf(u).catch(() => {})); }
  async function se(k, vol = 1) {
    try {
      const now = performance.now(); if (seLast[k] && now - seLast[k] < 45) return; seLast[k] = now;
      if (!seGain) { seGain = ctx.createGain(); seGain.gain.value = .8; seGain.connect(ctx.destination); }
      const buf = await loadBuf(SE[k]);
      const n = ctx.createBufferSource(), g = ctx.createGain(); n.buffer = buf; g.gain.value = (VOL[k] || .5) * vol;
      n.playbackRate.value = 1 + (Math.random() - .5) * .08;
      n.connect(g); g.connect(seGain); n.start();
    } catch (e) {}
  }

  // ===== 画面 =====
  function build() {
    built = true;
    const s = h(`<section class="bt-sc bt-rts" id="rt">
      <div class="rt-top"><button class="rt-pill" id="rtQuit" type="button">撤退</button><div class="rt-wave">WAVE <b id="rtWv">1</b>/<span id="rtWn">3</span></div>
        <div class="rt-time" id="rtTm">3:00</div><button class="rt-pill" id="rtSpd" type="button">×1</button><button class="rt-pill" id="rtAuto" type="button">AUTO</button></div>
      <div class="rt-field" id="rtField"><div class="rt-sky" id="rtSky"></div><div class="rt-floor" id="rtFloor"></div><canvas id="rtCv"></canvas>
        <div id="rtUnits"></div><div id="rtFx"></div><div class="rt-ban" id="rtBan"><b></b></div><div class="rt-hint" id="rtHint" hidden><span>攻撃する敵をタップ</span></div>
        <div class="rt-dum" id="rtDum" hidden></div></div>
      <div class="rt-panel">
        <div class="rt-party" id="rtParty"></div>
        <div class="rt-cost"><b id="rtCostN">0</b><div class="rt-cbar" id="rtCbar">${'<i></i>'.repeat(COST_MAX)}</div></div>
        <div class="rt-hand" id="rtHand"></div>
      </div>
      <div class="rt-over" id="rtOver" hidden></div>
      <div class="rt-big" id="rtBig" hidden></div>
      <div class="rt-ex" id="rtEx" hidden></div>
    </section>`);
    el('bt').appendChild(s);
    el('rtHand').addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) onCard(+b.dataset.i); });
    el('rtParty').addEventListener('click', e => { const b = e.target.closest('[data-ai]'); if (b) onEx(+b.dataset.ai); });
    el('rtField').addEventListener('click', e => {
      const u = e.target.closest('.rt-u.foe'); if (u && G && G.sel != null) { const f = G.units.find(x => x.el === u); if (f && f.hp > 0) return use(G.sel, f); }
      if (G && G.sel != null && !u) { G.sel = null; setTarget(false); paintHand(); }
    });
    el('rtQuit').onclick = quit;
    el('rtSpd').onclick = () => { if (!G) return; G.spd = G.spd === 1 ? 2 : 1; paintTop(); G.opt.onPref && G.opt.onPref({ spd:G.spd, auto:G.auto }); };
    el('rtAuto').onclick = () => { if (!G) return; G.auto = !G.auto; paintTop(); G.opt.onPref && G.opt.onPref({ spd:G.spd, auto:G.auto }); };
    el('rtEx').addEventListener('click', () => { if (G && G.exSkip) G.exSkip(); });
    addEventListener('resize', () => { if (G && !G.over) { const w0 = G.W; size(); G.units.forEach(u => { u.x *= G.W / w0; place(u); scaleImg(u); }); } });
    document.addEventListener('visibilitychange', () => { last = performance.now(); });
  }
  function size() {
    const f = el('rtField'), cv = el('rtCv');
    G.W = f.clientWidth; G.H = f.clientHeight; G.GY = G.H * .17;
    cv.width = G.W * devicePixelRatio; cv.height = G.H * devicePixelRatio; cv.style.width = G.W + 'px'; cv.style.height = G.H + 'px';
    G.g2 = cv.getContext('2d'); G.g2.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }

  // ===== 開始 =====
  // def：{ id, name, waves:[[敵ID...]...], m, t3, dummy }／opt：{ party:[k...], spd, auto, counter, inf, exInf, onPref }
  function start(def, opt, api) {
    A = api;
    if (!built) build();
    preload();
    return new Promise(res => {
      done = res;
      G = { def, opt, t:0, cost:3, wave:-1, scroll:0, adv:0, over:false, busy:false, sel:null, units:[], parts:[], ts:1,
        spd:opt.spd || 1, auto:!!opt.auto, dmg:{}, downed:new Set(), waiting:false, stat:{ last:0, total:0 } };
      el('rtUnits').innerHTML = ''; el('rtFx').innerHTML = ''; el('rtOver').hidden = true; el('rtBig').hidden = true; el('rtEx').hidden = true;
      el('rtQuit').textContent = def.dummy ? '終了' : '撤退';
      el('rtWn').textContent = def.waves.length;
      el('rtDum').hidden = !def.dummy;
      el('rt').classList.toggle('dummy', !!def.dummy);
      el('rtField').style.backgroundImage = def.bg ? `url(${def.bg})` : '';
      requestAnimationFrame(() => {
        size();
        // 並び：前に出る子から順に右へ
        const ks = opt.party.slice().sort((a, b) => WEP[b].line - WEP[a].line);
        const slots = [[.46, 0], [.29, 46], [.12, 12]];
        ks.forEach((k, i) => {
          const w = WEP[k], st = A.statOf(k), sl = slots[i] || [.1 + i * .1, 0];
          G.units.push(mk({ side:'a', k, name:A.CH[k].name, col:A.CH[k].col, hp:st.hp, max:st.hp, sh:0, atk:w.atk * st.atk, sup:st.sup, pel:w.pel, rng:w.rng, cd:w.cd,
            heal:w.heal ? w.heal * st.sup : 0, hcd:w.hcd, t:Math.random() * w.cd, ht:1 + Math.random(), muz:w.muz, se:w.se,
            x:sl[0] * G.W, y:sl[1], ex:opt.exInf ? 100 : 0, buf:{}, am:st.atk, img:`rt_${k}_aim.webp` }));
        });
        G.deck = [];
        opt.party.forEach(k => A.SETS[A.CH[k].set].filter(ty => ty !== 'atk').forEach(ty => G.deck.push({ k, ty, evo:A.isEvo(k, ty) })));
        shuffle(G.deck);
        G.deck.forEach(c => [...A.cardHTML(c.k, c.ty, c.evo).matchAll(/src="([^"]+)"/g)].forEach(m => { new Image().src = m[1]; }));   // カード絵を先に読み込む
        opt.party.forEach(k => ['joy', 'down'].forEach(p => { new Image().src = `rt_${k}_${p}.webp`; }));
        G.hand = G.deck.splice(0, 4);
        paintParty(); paintHand(); paintCost(); paintTop(); paintDum();
        nextWave();
        last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
      });
    });
  }
  function mk(u) {
    const d = document.createElement('div');
    d.className = 'rt-u ' + (u.side === 'a' ? 'ally idle' : 'foe') + (u.fly ? ' fly' : '') + (u.boss ? ' boss' : '');
    d.innerHTML = `<div class="rt-hb"><i></i><s></s></div><img src="${u.img}" alt="">`;
    el('rtUnits').appendChild(d); u.el = d; u.im = d.querySelector('img');
    u.im.onload = () => scaleImg(u);
    place(u); return u;
  }
  // ちび絵は元画像の大きさの比率をそのまま保つ（構え300px＝画面の高さ×h）
  function scaleImg(u) {
    if (!u.im.naturalHeight) return;
    if (u.side === 'a') u.im.style.height = u.im.naturalHeight * (G.H * .22 / 300) + 'px';
    else u.im.style.height = u.h * G.H + 'px';
  }
  function place(u) {
    u.el.style.left = u.x + 'px';
    u.el.style.bottom = (G.GY + u.y + (u.fly ? G.H * .2 : 0)) + 'px';
    u.el.style.zIndex = 20 - Math.round(u.y / 4) + (u.side === 'a' ? 0 : 1);
  }
  function nextWave() {
    G.wave++;
    if (G.wave >= G.def.waves.length) return finish(true);
    el('rtWv').textContent = G.wave + 1;
    G.adv = G.wave === 0 ? .8 : 1.6;
    banner(G.def.waves.length > 1 ? `WAVE ${G.wave + 1}` : 'BATTLE START');
    const m = G.def.m || 1, dm = 1 + (m - 1) * .8;
    G.def.waves[G.wave].forEach((t, i) => {
      const F = FOE[t] || FOE.thug, base = A.FOE[t] || A.FOE.thug;
      G.units.push(mk({ side:'f', t, name:base.name, hp:Math.round(F.hp * m), max:Math.round(F.hp * m), sh:0, atk:F.atk * dm, rng:F.rng, cd:F.cd, spd:F.spd,
        h:F.h, fly:F.fly, any:F.any, boss:F.boss || base.boss, aoe:F.aoe, dummy:F.dummy, n:0, t0:Math.random() * F.cd, buf:{},
        img:(F.img || base.img) + '.webp', x:G.W + 40 + i * 70, y:[-6, 30, 12][i % 3] }));
    });
  }
  const allies = () => G.units.filter(u => u.side === 'a' && u.hp > 0);
  const foes = () => G.units.filter(u => u.side === 'f' && u.hp > 0);
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const on = (u, k) => u.buf[k] && u.buf[k] > G.t;

  // ===== ループ =====
  function loop(now) {
    if (!G) return;
    const real = Math.min(.05, (now - last) / 1000 || 0); last = now;
    if (!G.over && !G.paused) step(real * G.spd * G.ts, real);
    raf = requestAnimationFrame(loop);
  }
  function step(dt, real) {
    G.t += dt;
    G.cost = Math.min(COST_MAX, G.cost + dt * COST_RATE);
    const left = Math.max(0, TIME - G.t);
    el('rtTm').textContent = G.def.dummy ? fmt(G.t) : fmt(left);
    if (left <= 0 && !G.def.dummy) return finish(false);
    const moving = G.adv > 0;
    if (moving) { G.adv -= dt; G.scroll += dt * 90; }
    el('rtFloor').style.backgroundPosition = `${-G.scroll}px 0`;
    el('rtSky').style.backgroundPosition = `${-G.scroll * .3}px 0`;
    const fs = foes();
    for (const u of G.units) {
      if (u.hp <= 0) continue;
      if (u.side === 'a') {
        u.ex = Math.min(100, u.ex + dt * 1);
        const tgt = nearest(u, fs, true);
        u.el.classList.toggle('walk', moving);
        u.el.classList.toggle('idle', !moving);
        if (u.heal) {
          u.ht -= dt;
          const low = allies().filter(a => a.hp < a.max).sort((a, b) => a.hp / a.max - b.hp / b.max)[0];
          if (u.ht <= 0 && low && low.hp / low.max < .85) { u.ht = u.hcd; heal(low, u.heal, u); continue; }
        }
        u.t -= dt;
        if (tgt && u.t <= 0 && !moving) { u.t = u.cd; shoot(u, tgt); }
      } else {
        if (on(u, 'stun')) { place(u); continue; }
        const tgt = foeTarget(u);
        const inRange = tgt && (u.x - tgt.x) <= u.rng * G.W && u.x <= G.W * .9;
        if (moving) u.x -= dt * 90;
        if (!inRange) { u.x -= dt * u.spd; u.el.classList.add('walk'); }
        else { u.el.classList.remove('walk'); u.t0 -= dt; if (u.t0 <= 0) { u.t0 = u.cd; if (!u.dummy || G.opt.counter) foeShoot(u, tgt); } }
        place(u);
      }
    }
    paintBars();
    drawFx(real * G.spd);
    paintCost();
    if (G.auto && !G.busy && G.sel == null) autoUse();
    if (!fs.length && G.adv <= 0 && !G.waiting && !G.over) { G.waiting = true; setTimeout(() => { if (G && !G.over) { G.waiting = false; nextWave(); } }, 700); }
    if (!allies().length) finish(false);
  }
  const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  function nearest(a, fs, inRange) {
    let best = null, bd = 1e9;
    for (const f of fs) { const d = f.x - a.x; if (d < 0 || f.x > G.W - 6) continue; if (inRange && d > a.rng * G.W) continue; if (d < bd) { bd = d; best = f; } }
    return best;
  }
  function foeTarget(f) {
    const al = allies(); if (!al.length) return null;
    const tt = al.find(a => on(a, 'taunt')); if (tt) return tt;
    if (f.any) { if (!f.pick || f.pick.hp <= 0 || Math.random() < .02) f.pick = al[Math.floor(Math.random() * al.length)]; return f.pick; }   // ドローンは後ろの子も狙う
    return al.reduce((m, a) => a.x > m.x ? a : m, al[0]);
  }

  // ===== 攻撃・ダメージ =====
  const fieldRect = () => el('rtField').getBoundingClientRect();
  function muzzle(u) {
    const r = u.im.getBoundingClientRect(), F = fieldRect();
    return u.side === 'a' ? [r.left - F.left + r.width * u.muz[0], r.top - F.top + r.height * u.muz[1]] : [r.left - F.left + r.width * .12, r.top - F.top + r.height * .45];
  }
  function body(u) { const r = u.im.getBoundingClientRect(), F = fieldRect(); return [r.left - F.left + r.width / 2, r.top - F.top + r.height * .5]; }
  function shoot(u, f) {
    const [mx, my] = muzzle(u), [tx, ty] = body(f);
    for (let p = 0; p < u.pel; p++) G.parts.push({ k:'tr', x1:mx, y1:my, x2:tx + (Math.random() - .5) * 24, y2:ty + (Math.random() - .5) * 24, c:u.col, life:.09, l0:.09 });
    G.parts.push({ k:'mz', x:mx, y:my, life:.07, l0:.07 });
    bump(u.el, 'recoil');
    se(u.se);
    damage(f, u.atk * u.pel * (on(u, 'atkUp') ? 1.3 : 1), u, false);
  }
  function foeShoot(f, a) {
    const [mx, my] = muzzle(f), [tx, ty] = body(a);
    bump(f.el, 'frecoil'); f.n++;
    if (f.aoe && f.n % f.aoe === 0) {
      allies().forEach(x => { const [bx, by] = body(x); G.parts.push({ k:'tr', x1:mx, y1:my, x2:bx, y2:by, c:'#ff4b5c', life:.16, l0:.16, w:4 }); hurt(x, f.atk * .7); });
      shake(); se('aoe'); return;
    }
    G.parts.push({ k:'tr', x1:mx, y1:my, x2:tx, y2:ty, c:'#ff6b7a', life:.09, l0:.09 });
    se('foe');
    hurt(a, f.atk * (on(f, 'atkUp') ? 1.3 : 1));
  }
  function damage(f, n, src, big) {
    if (f.hp <= 0) return;
    n = Math.round(n * (on(f, 'weak') ? 1.3 : 1));
    const ab = Math.min(f.sh, n); f.sh -= ab; n -= ab;
    if (f.dummy) { G.stat.last = n; G.stat.total += n; paintDum(); }
    else f.hp = Math.max(0, f.hp - n);
    if (src) { G.dmg[src.k] = (G.dmg[src.k] || 0) + n; src.ex = Math.min(100, src.ex + n * .12); }
    bump(f.el, 'hit', 70);
    const [x, y] = body(f);
    num(x, y - 10, n, big ? 'big' : '');
    spark(x, y, src ? src.col : '#fff', big ? 26 : 8);
    if (f.hp <= 0) {
      f.el.classList.add('dead'); G.parts.push({ k:'ring', x, y, c:'#ffd666', life:.5, l0:.5, r:f.boss ? 90 : 46 }); se('boom');
      if (G.killHook) G.killHook();
      setTimeout(() => f.el.remove(), 600);
    }
  }
  function hurt(a, n) {
    if (a.hp <= 0) return;
    n = Math.round(n * (on(a, 'weak') ? 1.3 : 1));
    const ab = Math.min(a.sh, n); a.sh -= ab; n -= ab;
    a.hp = Math.max(G.def.dummy ? 1 : 0, a.hp - n);
    a.ex = Math.min(100, a.ex + n * .35);
    bump(a.el, 'hit', 70);
    const [x, y] = body(a);
    num(x, y - 14, n ? n : `🛡${ab}`, n ? 'a' : 's');
    if (a.hp <= 0) {
      G.downed.add(a.k); a.el.classList.add('down'); a.el.classList.remove('idle', 'walk'); a.im.src = `rt_${a.k}_down.webp`;
      paintHand();
    }
    paintParty();
  }
  function heal(a, n, src) {
    if (!a || a.hp <= 0) return;
    const v = Math.min(Math.round(n), a.max - a.hp); a.hp += v;
    if (src) src.ex = Math.min(100, src.ex + v * .2);
    const [x, y] = body(a); num(x, y - 14, '+' + v, 'h');
    for (let i = 0; i < 6; i++) G.parts.push({ k:'pl', x:x + (Math.random() - .5) * 40, y:y + 10, vy:-50 - Math.random() * 30, life:.8, l0:.8 });
    paintParty();
  }
  function shield(a, n) { if (!a || a.hp <= 0) return; a.sh += Math.round(n); const [x, y] = body(a); num(x, y - 20, '🛡+' + Math.round(n), 's'); G.parts.push({ k:'hex', x, y, life:.55, l0:.55 }); paintParty(); }
  function buff(u, k, sec, label) { u.buf[k] = G.t + sec; const [x, y] = body(u); num(x, y - 26, label, 'u'); if (u.side === 'a') for (let i = 0; i < 4; i++) G.parts.push({ k:'ar', x:x + (i - 1.5) * 14, y:y + 10, vy:-60, life:.7, l0:.7 }); }

  // ===== カード =====
  const unitOf = k => G.units.find(x => x.side === 'a' && x.k === k);
  function cardDef(c) { return c.ty === 'ex' ? A.CARD[c.k].ex : A.cardOf(c.k, c.ty, c.evo); }
  function costOf(c) { const cd = cardDef(c); return cd.c === 0 ? 2 : cd.c === 1 ? 3 : A.kindOf(cd) === 'heal' ? 5 : 6; }
  const needFoe = cd => cd.o.some(o => ['dmg', 'weak', 'stun'].includes(o[0]));
  function onCard(i) {
    if (!G || G.over || G.busy || i > 2) return;
    const c = G.hand[i], u = unitOf(c.k), b = el('rtHand').children[i];
    if (u.hp <= 0 || (!G.opt.inf && G.cost < costOf(c))) { b.classList.remove('ng'); void b.offsetWidth; b.classList.add('ng'); return; }
    if (G.sel === i) return use(i, nearest(u, foes(), false) || foes()[0]);
    if (needFoe(cardDef(c)) && foes().some(f => f.x < G.W - 6)) { G.sel = i; paintHand(); setTarget(true); return; }
    use(i, null);
  }
  function setTarget(v) { el('rtHint').hidden = !v; foes().forEach(f => f.el.classList.toggle('target', v)); }
  async function use(i, tgt) {
    const c = G.hand[i], u = unitOf(c.k), cd = cardDef(c), cost = costOf(c);
    G.sel = null; setTarget(false);
    if (!G.opt.inf) G.cost -= cost;
    G.busy = true;
    const rect = el('rtHand').children[i].getBoundingClientRect();
    G.hand.splice(i, 1); G.deck.push(c); G.hand.splice(2, 0, G.deck.shift());
    paintHand(); paintCost();
    se('card');
    u.ex = Math.min(100, u.ex + 8);
    const big = cost >= 5;
    if (big) await bigCard(c);
    else await flyCard(c, rect, cd, tgt, u);
    if (!G || G.over) return;
    await apply(u, cd, tgt, 1, big);
    if (!G || G.over) return;
    G.busy = false; paintHand(); paintParty();
  }
  function onEx(ai) {
    if (!G || G.over || G.busy) return;
    const u = G.units.filter(x => x.side === 'a')[ai];
    if (!u || u.hp <= 0 || u.ex < 100) return;
    u.ex = G.opt.exInf ? 100 : 0; G.busy = true; G.sel = null; setTarget(false);
    paintParty();
    (async () => {
      await exCut(u.k);
      if (!G || G.over) return;
      await apply(u, A.CARD[u.k].ex, null, 1.5, true);
      if (!G || G.over) return;
      G.busy = false; paintHand(); paintParty();
    })();
  }
  // 効果の実行（ターン制のカード効果を、リアルタイム用の数値に換算）
  async function apply(src, cd, tgt, mul, big) {
    const am = (on(src, 'atkUp') ? 1.3 : 1) * mul, P = n => n * src.sup * mul;
    let killed = false; G.killHook = () => { killed = true; };
    const pick = () => (tgt && tgt.hp > 0 ? tgt : nearest(src, foes(), false) || foes()[0]);
    for (const o of cd.o) {
      const ty = o[0];
      if (ty === 'dmg') {
        for (let h = 0; h < (o[2] || 1); h++) {
          const f = pick(); if (!f) break;
          const [mx, my] = muzzle(src), [tx, ty2] = body(f);
          G.parts.push({ k:'tr', x1:mx, y1:my, x2:tx, y2:ty2, c:src.col, life:.14, l0:.14, w:big ? 6 : 3 });
          damage(f, o[1] * K.dmg * src.am * am, src, big);
          G.parts.push({ k:'ring', x:tx, y:ty2, c:src.col, life:.4, l0:.4, r:big ? 80 : 40 });
          se(big ? 'big' : WEP[src.k].se);
          if (o[2] > 1) { await wait(110); if (!G || G.over) return; }
        }
        if (big) shake();
      }
      else if (ty === 'dmgAll') {
        G.parts.push({ k:'sweep', c:src.col, life:.45, l0:.45 }); se(big ? 'bigall' : WEP[src.k].se);
        await wait(140); if (!G || G.over) return;
        foes().forEach(f => damage(f, o[1] * K.dmgAll * src.am * am, src, big));
        if (big) shake();
      }
      else if (ty === 'shield') shield(lowest(), P(o[1] * K.sh));
      else if (ty === 'shieldSelf') shield(src, P(o[1] * K.sh));
      else if (ty === 'shieldAll') allies().forEach(a => shield(a, P(o[1] * K.sh)));
      else if (ty === 'heal') { heal(lowest(), P(o[1] * K.heal), src); se('heal'); }
      else if (ty === 'healAll') { allies().forEach(a => heal(a, P(o[1] * K.heal), src)); se('heal'); }
      else if (ty === 'taunt') { buff(src, 'taunt', 6 * o[1], '挑発'); src.el.classList.add('taunt'); setTimeout(() => src.el && src.el.classList.remove('taunt'), 6000 * o[1] / G.spd); }
      else if (ty === 'atkUp') buff(lowest(true), 'atkUp', K.buff * o[1], '攻撃UP');
      else if (ty === 'atkUpSelf') buff(src, 'atkUp', K.buff * o[1], '攻撃UP');
      else if (ty === 'atkUpAll') allies().forEach(a => buff(a, 'atkUp', K.buff * o[1], '攻撃UP'));
      else if (ty === 'weak') { const f = pick(); if (f) buff(f, 'weak', K.buff * o[1], '脆弱'); }
      else if (ty === 'weakAll') foes().forEach(f => buff(f, 'weak', K.buff * o[1], '脆弱'));
      else if (ty === 'stun') { const f = pick(); if (f && !f.boss) buff(f, 'stun', K.stun, 'スタン'); else if (f) buff(f, 'stun', 1, 'ひるみ'); }
      else if (ty === 'stunAll') foes().forEach(f => buff(f, 'stun', f.boss ? 1 : K.stun, f.boss ? 'ひるみ' : 'スタン'));
      else if (ty === 'draw') { G.cost = Math.min(COST_MAX, G.cost + o[1]); costPop('+' + o[1]); }
      else if (ty === 'energy') { G.cost = Math.min(COST_MAX, G.cost + o[1] * 2); costPop('+' + o[1] * 2); }
      else if (ty === 'regen' || ty === 'regenAll') {
        const ts = ty === 'regen' ? [lowest()] : allies(), per = P(o[1] * 1.5), n = o[2] * 3;
        ts.forEach(a => { for (let i = 1; i <= n; i++) setTimeout(() => { if (G && !G.over && a.hp > 0) heal(a, per, src); }, i * 1000 / G.spd); });
      }
      else if (ty === 'cleanse') { const a = lowest(); if (a) delete a.buf.weak; }
      else if (ty === 'cleanseAll') allies().forEach(a => delete a.buf.weak);
      else if (ty === 'revive') G.units.filter(a => a.side === 'a' && a.hp <= 0).forEach(a => {
        a.hp = Math.round(a.max * o[1] / 100); a.el.classList.remove('down'); a.el.classList.add('idle'); a.im.src = `rt_${a.k}_aim.webp`; heal(a, 0); });
      else if (ty === 'exAll') allies().forEach(a => { if (a !== src) a.ex = Math.min(100, a.ex + o[1]); });
      else if (ty === 'refund') { if (killed) { G.cost = Math.min(COST_MAX, G.cost + 2); costPop('+2'); } }
    }
    if (G) { G.killHook = null; paintParty(); }
  }
  function lowest(alive = true) { const al = allies(); return al.sort((a, b) => a.hp / a.max - b.hp / b.max)[0]; }
  function autoUse() {
    for (let i = 0; i < 3; i++) {
      const c = G.hand[i], u = unitOf(c.k);
      if (u.hp > 0 && (G.opt.inf || G.cost >= costOf(c)) && (!needFoe(cardDef(c)) || foes().some(f => f.x < G.W - 6))) { use(i, nearest(u, foes(), false)); return; }
    }
    const ex = G.units.filter(x => x.side === 'a').findIndex(a => a.hp > 0 && a.ex >= 100);
    if (ex >= 0 && foes().some(f => f.x < G.W - 6)) onEx(ex);
  }

  // ===== カードの演出 =====
  // 軽い技：カードが中央に出て、相手に飛ぶ
  async function flyCard(c, r, cd, tgt, u) {
    if (!G) return;
    const R = el('rt').getBoundingClientRect(), w = h(`<div class="rt-fly">${A.cardHTML(c.k, c.ty, c.evo)}</div>`);
    Object.assign(w.style, { left:r.left - R.left + 'px', top:r.top - R.top + 'px', width:r.width + 'px', height:r.height + 'px' });
    el('rt').appendChild(w);
    const cx = R.width / 2 - (r.left - R.left) - r.width / 2, cy = R.height * .36 - (r.top - R.top) - r.height / 2;
    await w.animate([{ transform:'translate(0,0) scale(1)' }, { transform:`translate(${cx}px,${cy}px) scale(1.45)` }], { duration:220 / G.spd, easing:'cubic-bezier(.2,.8,.2,1)', fill:'forwards' }).finished.catch(() => {});
    w.classList.add('glow');
    await wait(150);
    const F = fieldRect();
    let tx = R.width / 2, ty = R.height * .3;
    const t = tgt && tgt.hp > 0 ? tgt : needFoe(cd) ? nearest(u, foes(), false) : u;
    if (t && t.im) { const b = t.im.getBoundingClientRect(); tx = b.left + b.width / 2 - R.left; ty = b.top + b.height / 2 - R.top; }
    if (!G) { w.remove(); return; }
    await w.animate([{ transform:`translate(${cx}px,${cy}px) scale(1.45)`, opacity:1 }, { transform:`translate(${tx - (r.left - R.left) - r.width / 2}px,${ty - (r.top - R.top) - r.height / 2}px) scale(.3) rotate(1turn)`, opacity:.15 }],
      { duration:180 / G.spd, easing:'ease-in', fill:'forwards' }).finished.catch(() => {});
    w.remove();
  }
  // 大技：時間がほぼ止まり、カードが中央に大きく出る → 光になってはじける
  async function bigCard(c) {
    const b = el('rtBig');
    b.innerHTML = `<div class="rt-bigdim"></div><div class="rt-bigc">${A.cardHTML(c.k, c.ty, c.evo, true)}</div><div class="rt-bigfl"></div>`;
    b.hidden = false; b.className = 'rt-big'; G.ts = .05;
    se('card');
    await sleep(820);
    b.className = 'rt-big burst';
    await sleep(240);
    b.hidden = true; b.innerHTML = ''; if (G) G.ts = 1;
  }
  // EX：メモリアルの絵をカードで大きく（奥行き・光の粒・ダイヤの枠）
  const EXFX = { kisaki:'petal', nico:'petal', hoshino:'petal', mika:'feather', mari:'feather', hina:'shard', yuuka:'flare', miyako:'scope' };
  async function exCut(k) {
    const x = el('rtEx'), cd = A.CARD[k].ex, fx = EXFX[k] || 'petal';
    x.innerHTML = `<div class="rt-exbg" style="background-image:url(bt_c_${k}_ex.webp)"></div>
      <div class="rt-exc fx-${fx}"><div class="rt-exfr"></div><div class="rt-exin">
        <img class="rt-exl b" src="ex_${k}_bg.webp" alt=""><div class="rt-exm"></div><img class="rt-exl f" src="ex_${k}_fg.webp" alt="" onerror="this.src='bt_c_${k}_ex.webp'"><div class="rt-exm front"></div>
      </div><span class="rt-exbadge">EX SKILL</span></div>
      <div class="rt-exname"><small>${A.CH[k].name}</small><b>${cd.n}</b></div>`;
    [...x.querySelectorAll('.rt-exm')].forEach((m, j) => { for (let i = 0; i < (j ? 5 : 12); i++) { const p = document.createElement('i');
      p.style.cssText = `left:${Math.random() * 100}%;--s:${(j ? 6 : 3) + Math.random() * 5}px;--d:${3 + Math.random() * 3}s;--dl:${-Math.random() * 4}s;--dx:${(Math.random() - .5) * 60}px`; m.appendChild(p); } });
    x.hidden = false; x.className = 'rt-ex on'; G.ts = .04;
    se('big');
    try { if (VOICE[k]) playVoice(VOICE[k]); } catch (e) {}
    await new Promise(r => { const t = setTimeout(r, 1900); G.exSkip = () => { clearTimeout(t); r(); }; });
    if (!G) { x.hidden = true; x.innerHTML = ''; return; }
    G.exSkip = null;
    x.className = 'rt-ex on out';
    await sleep(260);
    x.hidden = true; x.innerHTML = ''; if (G) G.ts = 1;
    const f = document.createElement('div'); f.className = 'rt-flash'; el('rtField').appendChild(f); setTimeout(() => f.remove(), 400);
  }

  // ===== 描画（DOM） =====
  function paintTop() {
    el('rtSpd').textContent = '×' + G.spd; el('rtSpd').classList.toggle('on', G.spd === 2); el('rtAuto').classList.toggle('on', G.auto);
  }
  function paintParty() {
    const P = el('rtParty'), al = G.units.filter(x => x.side === 'a');
    if (P.children.length !== al.length) P.innerHTML = al.map((u, i) => `<button class="rt-pm" type="button" data-ai="${i}"><span class="rt-pf"><img src="${A.faceImg(u.k)}" alt="${u.name}">
      <svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="16"/><circle class="v" cx="18" cy="18" r="16"/></svg><em>EX</em></span>
      <span class="rt-pb"><span class="rt-bar"><i></i><s></s></span><small></small></span></button>`).join('');
    al.forEach((u, i) => {
      const e = P.children[i];
      e.classList.toggle('down', u.hp <= 0); e.classList.toggle('exok', u.hp > 0 && u.ex >= 100);
      e.querySelector('.rt-bar i').style.width = u.hp / u.max * 100 + '%';
      e.querySelector('.rt-bar s').style.width = Math.min(100, u.sh / u.max * 100) + '%';
      e.querySelector('small').textContent = u.hp + (u.sh ? ` 🛡${u.sh}` : '');
      e.querySelector('circle.v').style.strokeDashoffset = 100.5 * (1 - u.ex / 100);
    });
  }
  let exTick = 0;
  function paintBars() {
    G.units.forEach(u => { if (u.hp <= 0 && u.side === 'f') return; u.el.querySelector('.rt-hb i').style.width = Math.min(100, u.hp / u.max * 100) + '%'; u.el.querySelector('.rt-hb s').style.width = Math.min(100, u.sh / u.max * 100) + '%'; });
    if (++exTick % 10 === 0) paintParty();
  }
  function paintHand() {
    el('rtHand').innerHTML = G.hand.slice(0, 4).map((c, i) => {
      const u = unitOf(c.k), cost = costOf(c);
      const cls = i === 3 ? ' next' : u.hp <= 0 ? ' dead' : (!G.opt.inf && G.cost < cost) ? ' no' : '';
      return `<button type="button" class="rt-card${cls}${G.sel === i ? ' sel' : ''}" data-i="${i}" data-c="${cost}">${A.cardHTML(c.k, c.ty, c.evo).replace(/<i class="bt-cc">\d+<\/i>/, `<i class="bt-cc">${cost}</i>`)}</button>`;
    }).join('');
  }
  let lastCost = -1;
  function paintCost() {
    const c = G.opt.inf ? COST_MAX : G.cost, f = Math.floor(c);
    el('rtCostN').textContent = G.opt.inf ? '∞' : f;
    [...el('rtCbar').children].forEach((i, n) => i.style.setProperty('--p', (n < f ? 100 : n === f ? (c - f) * 100 : 0) + '%'));
    if (f !== lastCost) { lastCost = f; [...el('rtHand').children].forEach((b, i) => { if (i < 3 && !b.classList.contains('dead')) b.classList.toggle('no', !G.opt.inf && G.cost < +b.dataset.c); }); }
  }
  function costPop(t) { const r = el('rtCostN'); r.classList.remove('pop'); void r.offsetWidth; r.classList.add('pop'); }
  function paintDum() { if (!G.def.dummy) return; const s = G.stat; el('rtDum').innerHTML = `<span>直前<b>${s.last}</b></span><span>合計<b>${s.total}</b></span><span>毎秒<b>${Math.round(s.total / Math.max(1, G.t))}</b></span>`; }

  // ===== 演出（canvas＋小物） =====
  function drawFx(dt) {
    const g2 = G.g2, W = G.W, H = G.H;
    g2.clearRect(0, 0, W, H);
    G.parts = G.parts.filter(p => (p.life -= dt) > 0);
    for (const p of G.parts) {
      const a = p.life / p.l0;
      g2.globalAlpha = a;
      if (p.k === 'tr') { g2.strokeStyle = p.c; g2.lineWidth = p.w || 2; g2.shadowColor = p.c; g2.shadowBlur = 8; g2.beginPath(); g2.moveTo(p.x1, p.y1); g2.lineTo(p.x2, p.y2); g2.stroke(); g2.shadowBlur = 0; }
      else if (p.k === 'mz') { g2.fillStyle = '#fff3b0'; g2.beginPath(); g2.arc(p.x, p.y, 7 * a + 3, 0, 7); g2.fill(); }
      else if (p.k === 'sp') { p.x += p.vx * dt; p.y += p.vy * dt; g2.strokeStyle = p.c; g2.lineWidth = 2; g2.beginPath(); g2.moveTo(p.x, p.y); g2.lineTo(p.x - p.vx * .04, p.y - p.vy * .04); g2.stroke(); }
      else if (p.k === 'ring') { g2.strokeStyle = p.c; g2.lineWidth = 4 * a + 1; g2.shadowColor = p.c; g2.shadowBlur = 14; g2.beginPath(); g2.arc(p.x, p.y, p.r * (1.15 - a), 0, 7); g2.stroke(); g2.shadowBlur = 0; }
      else if (p.k === 'pl') { p.y += p.vy * dt; g2.fillStyle = '#8bffb8'; g2.font = '700 16px Fredoka, sans-serif'; g2.fillText('+', p.x, p.y); }
      else if (p.k === 'ar') { p.y += p.vy * dt; g2.fillStyle = '#ffc35a'; g2.font = '700 12px sans-serif'; g2.fillText('▲', p.x, p.y); }
      else if (p.k === 'hex') { const r = 40 * (1.1 - a * .2); g2.strokeStyle = '#8fd8ff'; g2.fillStyle = 'rgba(143,216,255,.18)'; g2.lineWidth = 2; g2.beginPath();
        for (let i = 0; i < 6; i++) { const t = Math.PI / 3 * i - Math.PI / 2; g2[i ? 'lineTo' : 'moveTo'](p.x + Math.cos(t) * r, p.y + Math.sin(t) * r); } g2.closePath(); g2.fill(); g2.stroke(); }
      else if (p.k === 'sweep') { const x = (1 - a) * W * 1.4 - W * .2, gr = g2.createLinearGradient(x - 120, 0, x + 40, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.7, p.c); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g2.fillStyle = gr; g2.fillRect(x - 120, H * .2, 160, H * .55); }
    }
    g2.globalAlpha = 1;
  }
  function spark(x, y, c, n) { for (let i = 0; i < n; i++) { const t = Math.random() * 6.28, v = 120 + Math.random() * 200; G.parts.push({ k:'sp', x, y, vx:Math.cos(t) * v, vy:Math.sin(t) * v, c, life:.25, l0:.25 }); } }
  function num(x, y, t, cls) { const d = document.createElement('div'); d.className = 'rt-num ' + cls; d.textContent = t; d.style.left = x + (Math.random() - .5) * 16 + 'px'; d.style.top = y + 'px'; el('rtFx').appendChild(d); setTimeout(() => d.remove(), 800); }
  function bump(e, c, ms = 130) { e.classList.remove(c); void e.offsetWidth; e.classList.add(c); clearTimeout(e['_' + c]); e['_' + c] = setTimeout(() => e.classList.remove(c), ms); }
  function shake() { const f = el('rtField'); f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake'); }
  function banner(t) { const b = el('rtBan'); b.querySelector('b').textContent = t; b.className = 'rt-ban'; void b.offsetWidth; b.className = 'rt-ban on'; }
  const wait = ms => sleep(ms / (G ? G.spd : 1));

  // ===== 終了 =====
  function finish(win) {
    if (!G || G.over) return;
    G.over = true; G.busy = true;
    if (win) G.units.filter(u => u.side === 'a' && u.hp > 0).forEach(u => { u.im.src = `rt_${u.k}_joy.webp`; u.el.classList.remove('walk', 'idle'); u.el.classList.add('win'); });
    banner(win ? 'VICTORY' : 'DEFEAT');
    const res = { win, time:G.t, downed:G.downed.size, dmg:G.dmg };
    setTimeout(() => { const d = done; done = null; d && d(res); }, 1400);
  }
  function quit() {
    if (!G || G.over) return;
    if (G.def.dummy) { G.over = true; const d = done; done = null; d && d({ quit:true }); return; }
    G.paused = true;
    const o = el('rtOver');
    o.innerHTML = `<div class="rt-box"><b>撤退しますか？</b><small>使ったAPは戻りません</small><div><button type="button" data-q="no">続ける</button><button type="button" data-q="yes" class="red">撤退</button></div></div>`;
    o.hidden = false;
    o.onclick = e => { const b = e.target.closest('[data-q]'); if (!b) return; o.hidden = true; G.paused = false; last = performance.now();
      if (b.dataset.q === 'yes') { G.over = true; const d = done; done = null; d && d({ quit:true }); } };
  }
  function stop() { if (G) G.over = true; cancelAnimationFrame(raf); G = null; }

  return { start, stop, preload, active:() => !!(G && !G.over), _dbg:() => G };
})();
