// Yohei Support — 動きと音（効果音・扉のワイプ・押したときの反応・画面に入るときの滑り込み）
'use strict';

// ===== 効果音：ベルのような柔らかい音を、その場で合成する（響き＝短いリバーブつき） =====
const Sfx = (() => {
  let out = null, verb = null, last = {};
  function bus() {
    if (out) return out;
    out = ctx.createGain(); out.gain.value = .9; out.connect(ctx.destination);
    // 短い響き：ノイズを指数で減衰させたインパルス
    verb = ctx.createConvolver();
    const len = ctx.sampleRate * .9, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    verb.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = .22; verb.connect(wet); wet.connect(out);
    return out;
  }
  // ベル：基音＋少しずれた倍音。立ち上がりは速く、余韻はやわらかく
  function bell(f, at, dur, vol, bright = 1) {
    const t = ctx.currentTime + at, o = bus();
    [[1, 1], [2.01, .32 * bright], [3.98, .12 * bright], [.5, .18]].forEach(([m, a]) => {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = 'sine'; osc.frequency.setValueAtTime(f * m, t);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * a, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + dur * (m > 1 ? .55 : 1));
      osc.connect(g); g.connect(o); g.connect(verb); osc.start(t); osc.stop(t + dur + .05);
    });
  }
  function noise(at, dur, vol, f0, f1, q = 1.2) {
    const t = ctx.currentTime + at, b = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = b; bp.type = 'bandpass'; bp.Q.value = q; bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + dur * .25); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(bp); bp.connect(g); g.connect(bus()); g.connect(verb); s.start(t); s.stop(t + dur);
  }
  const P = {
    tap:() => { bell(1760, 0, .09, .06, .4); noise(0, .03, .05, 3500, 2500, 3); },
    soft:() => bell(1318, 0, .12, .04, .3),
    ok:() => { bell(1046.5, 0, .5, .09); bell(1568, .07, .6, .08); },
    cancel:() => { bell(880, 0, .25, .06, .5); bell(659, .06, .3, .05, .5); },
    done:() => { [1046.5, 1318.5, 1568, 2093].forEach((f, i) => bell(f, i * .06, .7, .07)); },
    coin:() => { bell(1975, 0, .25, .07, 1.4); bell(2637, .07, .5, .07, 1.4); },
    door:() => { noise(0, .55, .08, 300, 2400, .8); bell(784, .18, .9, .06); bell(1175, .3, 1, .06); },
    page:() => noise(0, .18, .035, 900, 2600, 1.5),
    msg:() => bell(1568, 0, .06, .025, .2),
    pop:() => { bell(1320, 0, .14, .07, .6); bell(1980, .05, .2, .05, .6); },
  };
  function play(k) {
    try {
      if (ctx.state !== 'running') ctx.resume();
      const now = performance.now(); if (last[k] && now - last[k] < 70) return; last[k] = now;   // 同じ音が重ならないように
      (P[k] || P.tap)();
    } catch (e) {}
  }
  return { play };
})();

// ===== 斜めのワイプ（3サイズ） =====
// 大：扉から部屋へ（覆う → 中で切り替え → はける）／中：パネルや入力シートの切り替え（0.3秒未満）／小：保存・完了の光の一閃（画面は止めない）
const Wipe = (() => {
  let el = null, sl = null;
  function build() {
    el = h('<div id="wipe"><i class="w1"></i><i class="w2"></i><i class="w3"></i><b class="wl"></b></div>');
    sl = h('<div id="slash"><i></i><i></i></div>');
    document.body.append(el, sl);
  }
  // fn は画面が覆われている間に呼ばれる。size：'l'（大）／'m'（中）
  async function play(fn, label = '', size = 'l') {
    if (!el) build();
    const m = size === 'm';
    el.querySelector('.wl').textContent = m ? '' : label;
    el.className = m ? 'in m' : 'in'; if (!m) { Sfx.play('door'); haptic(); } else Sfx.play('page');
    await sleep(m ? 120 : 430);
    try { await fn(); } catch (e) { console.warn(e); }
    await sleep(m ? 20 : 120);
    el.className = m ? 'out m' : 'out';
    await sleep(m ? 130 : 520);
    el.className = '';
  }
  // 小：右上から左下へ、光の筋がさっと走る
  function slash() {
    if (!el) build();
    sl.className = ''; void sl.offsetWidth; sl.className = 'on';
    clearTimeout(slash._t); slash._t = setTimeout(() => { sl.className = ''; }, 300);
  }
  return { play, slash, mid:fn => play(fn, '', 'm') };
})();

// ===== 画面に入るとき：上から順に、右から滑り込む =====
function slideIn(root, sel = '.u-pt, .head > *, .scroll > *') {
  if (!root) return;
  const els = [...root.querySelectorAll(sel)].filter(e => e.offsetParent !== null).slice(0, 12);
  els.forEach((e, i) => e.animate([{ opacity:0, transform:'translateX(26px)' }, { opacity:1, transform:'none' }],
    { duration:440, delay:40 + i * 55, easing:'cubic-bezier(.2,.8,.2,1)', fill:'backwards' }));
}

// ===== 押したとき：縮む・触感・音を、どのボタンにも =====
(() => {
  const SEL = 'button, .yitem, .ymeal, .u-row, .u-ev, .yev, .fpr, .orow, .owish, .omeal, [data-x], [data-it], [data-card], [data-cd], .hpost, .app';
  document.addEventListener('pointerdown', e => {
    const b = e.target.closest(SEL); if (!b || b.disabled) return;
    b.classList.add('prs');
    const up = () => { setTimeout(() => b.classList.remove('prs'), 90); removeEventListener('pointerup', up, true); removeEventListener('pointercancel', up, true); };
    addEventListener('pointerup', up, true); addEventListener('pointercancel', up, true);
  }, { capture:true, passive:true });
  document.addEventListener('click', e => {
    const b = e.target.closest(SEL); if (!b || b.disabled) return;
    const t = (b.textContent || '').trim();
    const k = b.matches('.x, .cancel, .close, [data-close], [data-rm]') || /^(閉じる|やめる|キャンセル|×|消す)$/.test(t) ? 'cancel'
      : b.matches('.save, .ybtn, .u-btn, .kgo, .rbgo, [data-done], [data-todo], [data-ok], [data-ap], [data-wadd], [data-padd]') || /^(保存|記録|記入|追加|入れる|OK|やった|払った)/.test(t) ? 'ok' : 'tap';
    Sfx.play(k); haptic();
  }, { capture:true, passive:true });
})();
