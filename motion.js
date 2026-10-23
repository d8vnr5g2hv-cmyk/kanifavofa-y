// Kani Favorite — デフォルメの動き（ポーズ画像のコマ送り＋コードの動き）
// 決まりごと：普段は止まっている／タップで一連の動き → 普段の位置に戻る／動いている途中のタップは無視
'use strict';
// 各ポーズの置き場所：[左%, 上%, 幅%]（普段の画像に対する割合。足元をそろえてある）
const POSE = {"hoshino":{"_":[420,451],"aim":[11.14,-1.41,97.26],"fire":[6.41,0.52,103.07],"lean":[6.68,-1.49,97.18],"notice":[0.77,0.13,98.92],"shy":[0.64,0.13,99.09]},"mika":{"_":[400,495],"dream":[-0.49,0.49,109.43],"drop":[3.39,0.57,110.92],"ouch":[-0.44,0.41,104.27],"pop":[-0.73,0.65,112.01],"think":[-0.57,0.49,109.53]},"hina":{"_":[420,422],"found":[4.44,0.55,97.22],"guardL":[6.87,0.95,95.4],"guardR":[4.8,1.18,96.67],"jito":[3.33,0.16,97.22],"shy":[5.19,0.47,93.82]},"mari":{"_":[420,667],"bow":[-0.32,-0.3,111.14],"found":[-4.98,-0.45,123.51],"pray":[11.09,0.17,92.33],"singA":[-2.42,0.56,109.16],"singB":[0.48,-0.07,117.82]},"miyako":{"_":[420,684],"land":[-8.1,27.85,114.14],"ok":[-0.99,23.06,116.27],"rope":[26.73,26.23,97.82],"scopeL":[5.57,24.86,109.17],"scopeR":[4.6,25.3,109.27],"warn":[19.37,22.06,114.14]}};
const Motion = (() => {
  const busy = {}, loops = {}, keep = [];
  const el = ch => document.querySelector(`.chibi.real[data-char="${ch}"]`);
  const src = (ch, p) => `m_${ch}_${p}.webp`;
  function ensure(ch) {
    const c = el(ch);
    if (!c._mv) {
      const mv = h('<div class="mv"><div class="pose"><img alt=""><img alt=""></div></div>');
      c.appendChild(mv); c._mv = mv; c._imgs = [...mv.querySelectorAll('img')]; c._ai = 0;
    }
    return c;
  }
  function preload(ch) {
    if (preload[ch]) return; preload[ch] = true;
    Object.keys(POSE[ch]).filter(k => k !== '_').forEach(p => { const i = new Image(); i.src = src(ch, p); if (i.decode) i.decode().catch(() => {}); keep.push(i); });
  }
  // ポーズを切り替える（新しいほうを上に重ねて溶かす）
  async function pose(ch, p) {
    const c = ensure(ch), [Lx, Ty, Wd] = POSE[ch][p];
    const nxt = c._imgs[1 - c._ai], cur = c._imgs[c._ai];
    Object.assign(nxt.style, { left:Lx + '%', top:Ty + '%', width:Wd + '%', zIndex:2 }); cur.style.zIndex = 1;
    if (nxt._p !== p) { nxt.src = src(ch, p); nxt._p = p; try { await nxt.decode(); } catch(e) {} }
    nxt.classList.add('on'); c.classList.add('acting');
    setTimeout(() => { if (c._imgs[c._ai] === nxt) cur.classList.remove('on'); }, 90);
    c._ai = 1 - c._ai;
  }
  function rest(ch) {
    const c = el(ch); if (!c._imgs) return;
    c.classList.remove('acting');
    setTimeout(() => { if (!c.classList.contains('acting')) c._imgs.forEach(i => i.classList.remove('on')); }, 30);
    if (c._mv) c._mv.getAnimations().forEach(a => a.cancel());
  }
  const mv = (ch, kf, o) => ensure(ch)._mv.animate(kf, Object.assign({ duration:400, easing:'ease-in-out', fill:'forwards' }, o));
  // ボイス（場面専用があればそちら）。終わるまで待つ
  function say(ch, ev, min = 1400) {
    const list = ev && VOICE_EVENTS[ev] && VOICE_EVENTS[ev].length ? VOICE_EVENTS[ev] : null;
    const t0 = Date.now();
    // 話している間は、ゆっくり息をするように小さく上下
    const br = ensure(ch)._mv.animate([{ transform:'translateY(0) scale(1)' }, { transform:'translateY(-.6%) scale(1.008,1.004)' }], { duration:900, iterations:Infinity, direction:'alternate', easing:'ease-in-out', composite:'add' });
    return new Promise(res => {
      let done = false; const fin = () => { if (done) return; done = true; setTimeout(() => { br.cancel(); res(); }, Math.max(0, min - (Date.now() - t0))); };
      setTimeout(fin, 20000);
      playVoice(ch, { end:fin }, list);
    });
  }
  // ビクッ（小さく縦に）
  const jolt = ch => mv(ch, [{ transform:'translateY(0)' }, { transform:'translateY(-5%)' }, { transform:'translateY(0)' }], { duration:220, easing:'ease-out', fill:'none' });
  // 画面（壁紙）を小さく揺らす
  function shake(ch, n = 3) {
    const wall = el(ch).closest('.page').querySelector('.wall');
    const k = []; for (let i = 0; i < n; i++) k.push({ transform:'translate(3px,-2px)' }, { transform:'translate(-3px,2px)' }); k.push({ transform:'none' });
    wall.animate(k, { duration:60 * k.length, easing:'linear' });
  }
  function bubble(ch, text, sub, onTap, ms) {
    const c = el(ch), b = h(`<div class="bubble">${esc(text)}${sub ? `<small>${esc(sub)}</small>` : ''}</div>`);
    c.appendChild(b);
    if (onTap) b.addEventListener('click', e => { e.stopPropagation(); onTap(); b.remove(); });
    return new Promise(r => setTimeout(() => { b.style.transition = 'opacity .25s'; b.style.opacity = 0; setTimeout(() => { b.remove(); r(); }, 260); }, ms));
  }
  function petals(ch, n = 22) {
    const page = el(ch).closest('.page'), W = page.clientWidth, H = page.clientHeight;
    for (let i = 0; i < n; i++) {
      const p = h('<i class="petal"></i>'); page.appendChild(p);
      const x = Math.random() * W, d = 2600 + Math.random() * 2200, dl = Math.random() * 1800, sw = (Math.random() - .5) * 120;
      p.style.left = x + 'px'; p.style.top = '-20px';
      p.animate([{ transform:'translate(0,0) rotate(0)', opacity:0 }, { opacity:.95, offset:.1 },
                 { transform:`translate(${sw}px,${H * .55}px) rotate(${180 + Math.random() * 200}deg)`, opacity:.9, offset:.6 },
                 { transform:`translate(${-sw / 2}px,${H + 40}px) rotate(${400 + Math.random() * 200}deg)`, opacity:0 }],
                { duration:d, delay:dl, easing:'linear', fill:'both' }).finished.then(() => p.remove());
    }
  }
  // 上から何かが落ちてきて頭に当たる（ミカ用）。thumb があればそのカード
  function dropOnHead(ch, thumb) {
    const r = el(ch).getBoundingClientRect(), x = r.left + r.width * .5 - 27, y = r.top + r.height * .1;
    const f = thumb !== undefined ? h(`<div class="fxCard">${thumb ? `<img src="${thumb}" alt="">` : '<div></div>'}</div>`)
                                  : h('<svg class="fxHeart" viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.9 4.5 6.6 4.5c2.2 0 3.6 1.3 5.4 3.2 1.8-1.9 3.2-3.2 5.4-3.2 3.7 0 5.7 3.9 4.2 7.3C19.5 16.4 12 21 12 21z" fill="#ff8fb3" stroke="#fff" stroke-width="1.6"/></svg>');
    document.body.appendChild(f); f.style.left = x + 'px'; f.style.top = '0px';
    return f.animate([{ transform:`translateY(-80px) rotate(-20deg)` }, { transform:`translateY(${y}px) rotate(8deg)` }], { duration:480, easing:'cubic-bezier(.5,0,.9,.5)', fill:'forwards' })
      .finished.then(() => {
        f.animate([{ transform:`translateY(${y}px) rotate(8deg)`, opacity:1 }, { transform:`translate(46px,${y - 46}px) rotate(40deg)`, opacity:1, offset:.35 },
                   { transform:`translate(80px,${y + 70}px) rotate(110deg)`, opacity:0 }], { duration:720, easing:'ease-out', fill:'forwards' }).finished.then(() => f.remove());
      });
  }
  // ロープ（ミヤコ）：ポーズの手の位置から上へ伸びる
  function rope(ch) {
    const c = ensure(ch), [Lx, Ty, Wd] = POSE[ch].rope, NW = POSE[ch]._[0], NH = POSE[ch]._[1];
    const img = c._imgs[c._ai];   // 今出ているロープのポーズ
    const ar = img.naturalWidth ? img.naturalHeight / img.naturalWidth : 1.2;
    const hx = Lx + Wd * .41, hy = Ty + (Wd * NW / 100) * ar * .10 / NH * 100;
    const r = h('<div class="rope"></div>'); r.style.left = hx + '%'; r.style.bottom = (100 - hy) + '%';
    c._mv.appendChild(r); return r;
  }

  // ===== キャラごとの流れ =====
  const SEQ = {
    async hoshino(ev) {
      await pose('hoshino', 'notice'); await sleep(850);
      await pose('hoshino', 'aim'); await sleep(520);
      for (let i = 0; i < 3; i++) { await pose('hoshino', 'fire'); shake('hoshino', 1); await sleep(110); await pose('hoshino', 'aim'); await sleep(85); }
      await pose('hoshino', 'fire'); shake('hoshino', 2); await sleep(380);
      await pose('hoshino', 'lean');
      mv('hoshino', [{ transform:'translate(4%,0) rotate(2deg)' }, { transform:'none' }], { duration:520, easing:'cubic-bezier(.2,.8,.3,1)', fill:'none' });
      await sleep(1100);
      await pose('hoshino', 'shy');
      await say('hoshino', ev === 'allclear' ? 'todo:allclear' : null);
    },
    async mika(ev, thumb) {
      if (ev !== 'drop') {
        await pose('mika', 'think');
        mv('mika', [{ transform:'translateY(0)' }, { transform:'translateY(-2%)' }, { transform:'translateY(0)' }], { duration:2400, fill:'none' });
        await sleep(1250);
        await pose('mika', 'dream'); await sleep(1150);
        await pose('mika', 'pop'); jolt('mika'); await sleep(420);
        dropOnHead('mika', thumb); await sleep(480);
      }
      await pose('mika', 'drop'); jolt('mika'); await sleep(750);
      await pose('mika', 'ouch'); await sleep(1300);
      await pose('mika', 'think');
      await say('mika', ev === 'drop' ? 'love:drop' : null);
    },
    async hina(ev) {
      if (ev !== 'unlock') {
        await pose('hina', 'jito'); await sleep(1000);
        await pose('hina', 'guardL'); mv('hina', [{ transform:'translateX(0)' }, { transform:'translateX(-2%)' }], { duration:500, easing:'ease-out' }); await sleep(800);
        await pose('hina', 'guardR'); mv('hina', [{ transform:'translateX(-2%)' }, { transform:'translateX(2%)' }], { duration:600, easing:'ease-in-out' }); await sleep(800);
        mv('hina', [{ transform:'translateX(2%)' }, { transform:'none' }], { duration:200 });
      }
      await pose('hina', 'found'); jolt('hina'); await sleep(850);
      await pose('hina', 'shy');
      await say('hina', ev === 'unlock' ? 'accounts:unlock' : null);
    },
    async miyako(ev, info) {
      if (ev === 'weak') {   // 保存したパスワードが弱い
        await pose('miyako', 'warn'); jolt('miyako');
        await bubble('miyako', info.text, info.sub, info.onTap, 2600);
        return;
      }
      await pose('miyako', 'scopeL');
      mv('miyako', [{ transform:'rotate(0)' }, { transform:'rotate(-2deg) translateX(-1.5%)' }, { transform:'rotate(0)' }], { duration:1000, fill:'none' });
      await sleep(1000);
      await pose('miyako', 'scopeR');
      mv('miyako', [{ transform:'rotate(0)' }, { transform:'rotate(2deg) translateX(1.5%)' }, { transform:'rotate(0)' }], { duration:1000, fill:'none' });
      await sleep(1000);
      if (info && info.issues) {   // パトロールで問題あり
        await pose('miyako', 'warn'); jolt('miyako');
        await bubble('miyako', info.text, info.sub, info.onTap, 3200);
        return;
      }
      await pose('miyako', 'ok'); jolt('miyako');
      await say('miyako', info ? 'accounts:ok' : null);
    },
    async mari(ev) {
      if (ev === 'anniv') petals('mari');
      await pose('mari', 'pray'); await sleep(1300);
      for (let i = 0; i < 4; i++) {
        await pose('mari', i % 2 ? 'singB' : 'singA');
        mv('mari', [{ transform:`rotate(${i % 2 ? 2 : -2}deg)` }], { duration:420, easing:'ease-in-out' });
        await sleep(430);
      }
      mv('mari', [{ transform:'none' }], { duration:200 });
      await pose('mari', 'found'); jolt('mari'); await sleep(950);
      await pose('mari', 'bow');
      await say('mari', ev === 'anniv' ? 'profile:anniv' : null);
    },
  };

  // 一連の動きを流す（動いている途中は受け付けない）
  async function play(ch, ev = 'tap', arg) {
    if (busy[ch] || !SEQ[ch]) return false;
    busy[ch] = true; preload(ch);
    try { await SEQ[ch](ev, arg); } catch(e) { console.warn(e); }
    rest(ch); busy[ch] = false;
    return true;
  }
  // ミヤコの登場：上からロープで降りてくる
  async function rappel() {
    const ch = 'miyako'; if (busy[ch]) return; busy[ch] = true; preload(ch);
    const c = ensure(ch), sh = c.querySelector('.shadow');
    try {
      // 先に画面の外へ（普段の姿は消しておく）
      c.classList.add('acting'); sh.style.opacity = 0;
      const hold = mv(ch, [{ transform:'translateY(-110vh)' }], { duration:1 });
      await pose(ch, 'rope'); const r = rope(ch); hold.cancel();
      await mv(ch, [{ transform:'translateY(-110vh)' }, { transform:'translateY(4%) rotate(1.5deg)', offset:.82 }, { transform:'translateY(0) rotate(-1deg)' }],
               { duration:1150, easing:'cubic-bezier(.22,.62,.36,1)' }).finished;
      await sleep(120);
      r.animate([{ transform:'translateY(0)' }, { transform:'translateY(-170vh)' }], { duration:520, easing:'ease-in', fill:'forwards' }).finished.then(() => r.remove());
      mv(ch, [{ transform:'translateY(0)' }], { duration:120 });
      await pose(ch, 'land'); sh.style.opacity = '';
      await sleep(650);
    } catch(e) { console.warn(e); }
    rest(ch); busy[ch] = false;
  }
  // ヒナのロック中：ジト目と左右の警戒をくり返す
  async function guardLoop() {
    const ch = 'hina'; if (loops[ch]) return; preload(ch);
    while (busy[ch]) await sleep(100);
    busy[ch] = true; const token = loops[ch] = {};
    const steps = [['jito', 1600, 0], ['guardL', 1300, -2], ['guardR', 1300, 2]];
    let k = 0;
    while (loops[ch] === token) {
      const [p, d, x] = steps[k++ % steps.length];
      await pose(ch, p); mv(ch, [{ transform:`translateX(${x}%)` }], { duration:500 });
      const t0 = Date.now(); while (loops[ch] === token && Date.now() - t0 < d) await sleep(80);
    }
  }
  async function stopLoop(ch, then) {
    if (!loops[ch]) return;
    loops[ch] = null;
    mv(ch, [{ transform:'none' }], { duration:200 });
    if (then === 'unlock') { try { await SEQ.hina('unlock'); } catch(e) {} }
    rest(ch); busy[ch] = false;
  }
  async function pout(ch) {   // ロック中に失敗したとき：ジト目で首をふる
    await pose(ch, 'jito');
    mv(ch, [{ transform:'translateX(0)' }, { transform:'translateX(-2%)' }, { transform:'translateX(2%)' }, { transform:'translateX(-1%)' }, { transform:'none' }], { duration:480, fill:'none' });
  }

  const handlers = {};   // タブ側でタップの中身を差し替えられる
  function init() {
    document.querySelectorAll('.chibi.real').forEach(c => c.addEventListener('click', e => {
      e.stopPropagation(); ctx.resume();
      const ch = c.dataset.char; if (busy[ch]) return;
      if (handlers[ch]) handlers[ch](); else play(ch);
    }));
  }
  function preloadAll() { Object.keys(POSE).forEach(preload); }
  return { preloadAll, play, rappel, guardLoop, stopLoop, pout, preload, handlers, init, isBusy:ch => !!busy[ch], dropOnHead };
})();
App.modules.push(Motion);
