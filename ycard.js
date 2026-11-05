// 自作カード（Card Shop と HALO LINK の両方で使う）：データの形・効果のテンプレート・見た目
// カード：{ id, name, who, rank(1-4), cost(0-3), layout('normal'|'full'), veil(1-3), fx:[{k, v, n, t, all}],
//          art:{ kind:'photo'|'lobby'|'video', img(Blob), vid(Blob), src(動画のファイル名), poster, ar(横/縦), x, y, s } }
'use strict';
const YCard = (() => {
  // ===== だれのカードか（色と属性はHALO LINKに合わせる） =====
  const WHO = {
    noa:{ n:'乃亜', c:'#ff9ad5', attr:'light' }, hoshino:{ n:'ホシノ', c:'#ffb0c8', attr:'fire' }, mika:{ n:'ミカ', c:'#ffc8ef', attr:'light' },
    mari:{ n:'マリー', c:'#ffe0a8', attr:'wood' }, hina:{ n:'ヒナ', c:'#d9c8ff', attr:'dark' }, miyako:{ n:'ミヤコ', c:'#cfe3ff', attr:'water' },
    yuuka:{ n:'ユウカ', c:'#7aa8ff', attr:'water' }, kisaki:{ n:'キサキ', c:'#9fd7c0', attr:'wood' }, other:{ n:'ゲスト', c:'#c9d3e8', attr:'none' },
    yohei:{ n:'耀平', c:'#c9d3e8', attr:'none' },
  };
  const ATTR_C = { fire:'#ff6a4d', water:'#47a8ff', wood:'#4fdc86', light:'#ffd85a', dark:'#b46bff', none:'#c9d3e8' };
  const RANK = { 1:'◆', 2:'◆◆', 3:'★', 4:'♛' };
  const TYPE = { atk:{ n:'ATTACK', c:'#ff5a6e' }, def:{ n:'GUARD', c:'#4aa8ff' }, sup:{ n:'SKILL', c:'#b48cff' }, heal:{ n:'HEAL', c:'#4fd69a' } };

  // ===== 効果のテンプレート（数字は自分で決める） =====
  // p：決める数字 [キー, ラベル, 最小, 最大, 刻み, 初期値]
  const FX = {
    dmg:   { n:'ダメージ',   p:[['v', '1回のダメージ', 1, 99, 1, 8], ['n', '回数', 1, 6, 1, 1]], all:true },
    heal:  { n:'回復',       p:[['v', '回復量', 1, 60, 1, 6]], all:true, allN:'味方全員' },
    guard: { n:'ガード',     p:[['v', 'ガード', 1, 60, 1, 6]] },
    atkup: { n:'攻撃アップ', p:[['v', '上がる割合（%）', 5, 100, 5, 25], ['t', 'ターン', 1, 5, 1, 2]] },
    weak:  { n:'弱体化',     p:[['v', '敵の攻撃ダウン（%）', 5, 75, 5, 25], ['t', 'ターン', 1, 5, 1, 2]], all:true },
    vuln:  { n:'脆弱',       p:[['t', 'ターン（被ダメ1.5倍）', 1, 5, 1, 2]], all:true },
    poison:{ n:'毒',         p:[['v', '毎ターンのダメージ', 1, 30, 1, 4], ['t', 'ターン', 1, 6, 1, 3]], all:true },
    draw:  { n:'ドロー',     p:[['v', '引く枚数', 1, 4, 1, 1]] },
    energy:{ n:'エネルギー', p:[['v', '回復量', 1, 3, 1, 1]] },
  };
  const KEYS = Object.keys(FX);
  function fxDefault(k) { const o = { k }; FX[k].p.forEach(([key, , , , , d]) => o[key] = d); if (FX[k].all) o.all = false; return o; }
  // 効果の文章。mod：{ up:攻撃の倍率, weak:弱体 } は戦闘中の補正
  function fxLine(f, mod = {}) {
    const d = v => Math.max(0, Math.floor(v * (mod.up || 1) * (mod.weak ? .75 : 1)));
    switch (f.k) {
      case 'dmg':    return `${f.all ? '敵全体に' : ''}${d(f.v)}${f.n > 1 ? '×' + f.n : ''}ダメージ`;
      case 'heal':   return `${f.all ? '味方全員の' : ''}HP${f.v}回復`;
      case 'guard':  return `ガード${f.v}`;
      case 'atkup':  return `攻撃+${f.v}%（${f.t}ターン）`;
      case 'weak':   return `${f.all ? '敵全体の' : ''}攻撃-${f.v}%（${f.t}ターン）`;
      case 'vuln':   return `${f.all ? '敵全体に' : ''}脆弱（${f.t}ターン）`;
      case 'poison': return `${f.all ? '敵全体に' : ''}毒${f.v}（${f.t}ターン）`;
      case 'draw':   return `${f.v}枚引く`;
      case 'energy': return `エネルギー+${f.v}`;
    }
    return '';
  }
  const fxText = (fx, mod) => (fx || []).map(f => fxLine(f, mod)).join('、');
  function typeOf(c) {
    const ks = (c.fx || []).map(f => f.k);
    return ks.includes('dmg') ? 'atk' : ks.includes('heal') ? 'heal' : ks.includes('guard') ? 'def' : 'sup';
  }
  const needsTarget = c => (c.fx || []).some(f => ['dmg', 'weak', 'vuln', 'poison'].includes(f.k) && !f.all);

  // ===== 強さの目安（コストに対して強すぎないか） =====
  function score(c) {
    return (c.fx || []).reduce((a, f) => a + ({
      dmg: f.v * (f.n || 1) * (f.all ? 1.7 : 1), heal: f.v * 1.1 * (f.all ? 1.8 : 1), guard: f.v * .9,
      atkup: f.v / 100 * f.t * 14, weak: f.v / 100 * f.t * 16 * (f.all ? 1.6 : 1), vuln: f.t * 5 * (f.all ? 1.6 : 1),
      poison: f.v * f.t * .7 * (f.all ? 1.7 : 1), draw: f.v * 4.5, energy: f.v * 7,
    }[f.k] || 0), 0);
  }
  const BUDGET = [6, 12, 23, 35];
  function power(c) {
    const r = score(c) / BUDGET[c.cost || 0];
    return { r, lab:r <= .8 ? '控えめ' : r <= 1.15 ? 'ちょうどいい' : r <= 1.5 ? '強め' : '強すぎ', lv:r <= .8 ? 0 : r <= 1.15 ? 1 : r <= 1.5 ? 2 : 3 };
  }

  // ===== 画像（写真は Blob、メモロビはファイル名）。Blob の URL は使い回す =====
  const urls = new Map();
  function blobUrl(b) { if (!b) return ''; if (!urls.has(b)) urls.set(b, URL.createObjectURL(b)); return urls.get(b); }
  function poster(c) { const a = c.art || {}; return a.kind === 'photo' ? blobUrl(a.img) : a.kind === 'video' ? blobUrl(a.img) : a.poster || a.static || ''; }
  function videoSrc(c) { const a = c.art || {}; return a.kind === 'video' ? blobUrl(a.vid) : a.kind === 'lobby' ? a.src : ''; }
  // 切り取りの位置（カードの幅＝1、高さ＝1.5）。s：拡大、x・y：中心のずれ
  function boxStyle(a) {
    if (!a || a.kind === 'photo' || !a.ar) return 'left:0;top:0;width:100%;height:100%';
    const s = a.s || 1, w = s * Math.max(1, a.ar * 1.5), hh = w / a.ar, hp = hh / 1.5;
    return `width:${(w * 100).toFixed(2)}%;height:${(hp * 100).toFixed(2)}%;left:${(50 + (a.x || 0) * 100 - w * 50).toFixed(2)}%;top:${(50 + (a.y || 0) * 100 - hp * 50).toFixed(2)}%`;
  }

  // ===== 1枚のHTML =====
  // opt：{ cls, mod, n, live（動画を動かす）, still（動きを止める）, id（data-id） }
  function html(c, opt = {}) {
    const w = WHO[c.who] || WHO.other, t = TYPE[typeOf(c)], ac = ATTR_C[w.attr] || ATTR_C.none, a = c.art || {};
    const full = c.layout === 'full', live = opt.live && (a.kind === 'lobby' || a.kind === 'video');
    const media = a.kind === 'basic' ? `<img class="yc-m" src="${a.static}" alt="" style="left:0;top:0;width:100%;height:100%">`
      : live ? `<img class="yc-m" src="${poster(c)}" alt="" style="${boxStyle(a)}"><video class="yc-m yc-v" src="${videoSrc(c)}" muted playsinline loop autoplay preload="auto" style="${boxStyle(a)}"></video>`
      : `<img class="yc-m" src="${poster(c)}" alt="" style="${boxStyle(a)}">`;
    return `<div class="${self.HL_GAME ? 'card ' : ''}ycard r${c.rank || 1} t-${typeOf(c)}${full ? ' full v' + (c.veil || 2) : ''}${opt.still ? ' still' : ''}${opt.cls ? ' ' + opt.cls : ''}" data-id="${opt.id || c.id}" style="--tc:${t.c};--ac:${ac}">
      <div class="yc-in"><div class="yc-art ${a.kind === 'photo' ? 'kb' : a.kind === 'basic' ? '' : 'mv'}">${media}</div>
        <div class="yc-shade"></div>${c.rank >= 3 ? '<i class="yc-foil"></i>' : ''}<i class="yc-shine"></i>
        <div class="yc-cost"><b>${c.cost}</b></div><div class="yc-type">${t.n}</div>
        <div class="yc-who"><i style="background:${ac}"></i>${esc(w.n)}</div>
        <div class="yc-name">${esc(c.name || '名前のないカード')}</div>
        <div class="yc-text">${esc(fxText(c.fx, opt.mod)) || '<span class="yc-none">効果なし</span>'}</div>
        ${rankMark(c.rank || 1)}${opt.n ? `<span class="yc-n">×${opt.n}</span>` : ''}</div></div>`;
  }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  const CROWN = '<svg viewBox="0 0 24 16"><path d="M2 14 L1 3 L7 8 L12 1 L17 8 L23 3 L22 14 Z" fill="currentColor"/></svg>';
  function rankMark(r) { return r === 4 ? `<span class="yc-rm crown">${CROWN}</span>` : r === 3 ? '<span class="yc-rm star">★</span>' : `<span class="yc-rm dia">${'<i></i>'.repeat(r)}</span>`; }
  // 詳細表示：指で傾けると光る
  function tilt(el) {
    const mv = e => { const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      el.style.transform = `perspective(900px) rotateY(${x * 20}deg) rotateX(${-y * 20}deg)`; el.style.setProperty('--mx', (x + .5) * 100 + '%'); el.style.setProperty('--my', (y + .5) * 100 + '%'); };
    const lv = () => { el.style.transform = ''; };
    el.addEventListener('pointermove', mv); el.addEventListener('pointerleave', lv); el.addEventListener('pointerup', lv);
  }

  // 動画は再生が始まってから表に出す（それまでは下の静止画が見える）
  document.addEventListener('playing', e => { const v = e.target; if (v.classList && v.classList.contains('yc-v')) v.classList.add('on'); }, true);

  // ===== 保存先（Yohei Support と同じ IndexedDB の cards） =====
  function db() {
    return new Promise((ok, ng) => {
      const r = indexedDB.open('kani-favorite');
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('cards')) r.result.createObjectStore('cards', { keyPath:'id' }); };
      r.onsuccess = () => ok(r.result); r.onerror = () => ng(r.error);
    });
  }
  async function all() {
    const d = await db(); if (!d.objectStoreNames.contains('cards')) return [];
    return new Promise(ok => { const q = d.transaction('cards').objectStore('cards').getAll(); q.onsuccess = () => ok(q.result || []); q.onerror = () => ok([]); });
  }

  // ===== デッキ（HALO LINK の保存と共有） =====
  const BASIC = [
    { id:'b_atk',  name:'踏み込み',   who:'yohei', rank:1, cost:1, fx:[{ k:'dmg', v:6, n:1 }],                      art:{ kind:'basic', static:'hl_g_atk.webp' } },
    { id:'b_def',  name:'身構える',   who:'yohei', rank:1, cost:1, fx:[{ k:'guard', v:6 }],                         art:{ kind:'basic', static:'hl_g_def.webp' } },
    { id:'b_heal', name:'深呼吸',     who:'yohei', rank:1, cost:1, fx:[{ k:'heal', v:4 }, { k:'draw', v:1 }],       art:{ kind:'basic', static:'hl_g_heal.webp' } },
    { id:'b_sup',  name:'作戦会議',   who:'yohei', rank:2, cost:0, fx:[{ k:'draw', v:2 }],                          art:{ kind:'basic', static:'hl_g_sup.webp' } },
    { id:'b_big',  name:'全力の一撃', who:'yohei', rank:2, cost:2, fx:[{ k:'dmg', v:14, n:1 }],                     art:{ kind:'basic', static:'hl_g_big.webp' } },
  ];
  const DECK = { min:15, max:30 };
  const copyMax = c => c.who === 'yohei' ? 4 : c.rank === 4 ? 1 : 2;
  const SKEY = 'hl-custom-v1';
  function loadSave() { try { return JSON.parse(localStorage.getItem(SKEY) || 'null') || {}; } catch (e) { return {}; } }
  function putSave(s) { try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch (e) {} }
  function defaultDeck() { return ['b_atk', 'b_atk', 'b_atk', 'b_atk', 'b_def', 'b_def', 'b_def', 'b_def', 'b_heal', 'b_heal', 'b_heal', 'b_sup', 'b_sup', 'b_big', 'b_big']; }
  function deck() { const s = loadSave(); return Array.isArray(s.deck) && s.deck.length ? s.deck : defaultDeck(); }
  function setDeck(d) { const s = loadSave(); s.deck = d; putSave(s); }

  return { WHO, ATTR_C, RANK, TYPE, FX, KEYS, fxDefault, fxLine, fxText, typeOf, needsTarget, score, power, html, tilt, poster, videoSrc, boxStyle, blobUrl,
    all, BASIC, DECK, copyMax, deck, setDeck, loadSave, putSave, defaultDeck, esc };
})();
