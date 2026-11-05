// Yohei Support — Card Shop（自室のさらに左。キサキの店）
// 1枚目：キサキ／2枚目：店内（作業台＝カードを作る・ショーケース＝集めたカードとデッキ・ゲーム機＝HALO LINK）
'use strict';
const CardShop = (() => {
  const IMG_W = 853, IMG_H = 1844;
  // 店内の絵の中の場所（左, 上, 右, 下）
  const SPOT = { make:[0, 760, 250, 1010], case:[268, 395, 655, 705], game:[722, 545, 853, 910] };
  const LAB = { make:['WORKBENCH', 'カードを作る'], case:['SHOWCASE', 'ショーケース'], game:['GAME', 'HALO LINK'] };
  // メモロビ：アプリに入っている動画（新しく足したメモロビは、chars や部屋の1枚目に足せば自動で出る）
  const LOBBY_EXTRA = [
    ['06_christmas', 'other'], ['07_staff', 'mari'], ['08_rest', 'hina'], ['09_aquarium', 'hoshino'], ['10_office', 'yuuka'], ['11_kitchen', 'other'],
    ['12_conductor', 'other'], ['13_drive', 'other'], ['14_sofa', 'other'], ['15_bedtime', 'other'], ['16_mika_night', 'mika'], ['hina', 'hina'],
    ['lobby', 'hoshino'], ['mari', 'mari'], ['mika', 'mika'], ['miyako', 'miyako'], ['lobby_azurite', 'other'], ['lobby_ellen', 'other'],
  ];
  const WHO_OF = { office:'yuuka' };
  function lobbies() {
    const seen = new Map();
    const add = (n, who) => { if (!seen.has(n)) seen.set(n, { n, who:WHO_OF[who] || who || 'other', src:`${n}_tall_h264.mp4`, poster:`${n}_tall_poster.jpg` }); };
    try { chars.forEach(c => add(c.tall.replace('_tall_h264.mp4', ''), c.who)); } catch (e) {}
    document.querySelectorAll('.scenep[data-v]').forEach(p => add(p.dataset.v, p.dataset.who));
    LOBBY_EXTRA.forEach(([n, w]) => add(n, w));
    return [...seen.values()];
  }
  const WHO_ORDER = ['mika', 'hoshino', 'noa', 'hina', 'mari', 'miyako', 'yuuka', 'kisaki', 'other'];

  // ===== 店内 =====
  function size() {
    const pg = $('page-shop'), w = $('shWrap'); if (!pg || !w) return;
    const W = pg.clientWidth, H = pg.clientHeight; if (!W) return;
    const k = Math.max(W / IMG_W, H / IMG_H);
    Object.assign(w.style, { width:IMG_W * k + 'px', height:IMG_H * k + 'px', left:(W - IMG_W * k) / 2 + 'px', top:(H - IMG_H * k) / 2 + 'px' });
  }
  function build() {
    const w = $('shWrap');
    w.insertAdjacentHTML('beforeend', Object.entries(SPOT).map(([k, [x0, y0, x1, y1]]) =>
      `<button class="shhs" data-sh="${k}" style="left:${x0 / IMG_W * 100}%;top:${y0 / IMG_H * 100}%;width:${(x1 - x0) / IMG_W * 100}%;height:${(y1 - y0) / IMG_H * 100}%"><span><small>${LAB[k][0]}</small>${LAB[k][1]}</span></button>`).join(''));
    $('page-shop').addEventListener('click', e => { const b = e.target.closest('[data-sh]'); if (!b) return; haptic(); go(b.dataset.sh); });
    addEventListener('resize', size);
  }
  function go(k) { if (k === 'make') Maker.open(); if (k === 'case') Case.open(); if (k === 'game') Game.open(); }
  async function paint() {
    const n = (await YCard.all().catch(() => [])).length, d = YCard.deck();
    $('shInfo').innerHTML = `<b>${n}</b><span>枚のカード</span><i></i><b>${d.length}</b><span>枚のデッキ</span>`;
  }

  // ===== カードを作る =====
  const Maker = (() => {
    let el = null, c = null, edit = false, src = 'album', orig = null, busy = false;
    const fresh = () => ({ id:'c' + newId(), name:'', who:LS.get('cs-lastWho') || 'mika', rank:1, cost:1, layout:'normal', veil:2, fx:[YCard.fxDefault('dmg')], art:null, at:Date.now() });
    function build() {
      el = h(`<div id="csEd" class="csov"><div class="cs-hd"><button class="cs-x" data-a="close" aria-label="閉じる">×</button><div><small>WORKBENCH</small><b id="csTitle">カードを作る</b></div><button class="cs-go" data-a="save">現像する</button></div>
        <div class="cs-body"><div class="cs-stage"><div class="cs-pv" id="csPv"></div><p class="cs-hint" id="csHint">下から絵を選んでください</p></div>
          <section><h4>絵<small>指で動かす・2本指で拡大</small></h4><div class="cs-tabs" id="csSrc"></div><div class="cs-pick" id="csPick"></div></section>
          <section><h4>名前</h4><input class="cs-in" id="csName" maxlength="16" placeholder="例：夜の約束" autocomplete="off"></section>
          <section><h4>だれのカード</h4><div class="cs-chips" id="csWho"></div></section>
          <section class="cs-two"><div><h4>ランク</h4><div class="cs-chips" id="csRank"></div></div><div><h4>コスト</h4><div class="cs-chips" id="csCost"></div></div></section>
          <section><h4>見た目</h4><div class="cs-chips" id="csLay"></div><div class="cs-chips sub" id="csVeil"></div></section>
          <section><h4>効果1</h4><div id="csFx0"></div></section>
          <section><h4>効果2<small>なくてもOK</small></h4><div id="csFx1"></div></section>
          <section><h4>強さの目安</h4><div class="cs-pow" id="csPow"></div></section>
          <button class="cs-del" data-a="del" hidden>このカードを削除する</button></div></div>`);
      document.body.appendChild(el);
      el.addEventListener('click', onClick);
      el.addEventListener('input', onInput);
      $('csName').addEventListener('input', () => { c.name = $('csName').value.trim(); paintCard(false); });
      bindCrop();
    }
    async function open(card) {
      if (!el) build();
      edit = !!card; c = card ? cloneCard(card) : fresh(); orig = null;
      $('csTitle').textContent = edit ? 'カードを直す' : 'カードを作る';
      el.querySelector('.cs-del').hidden = !edit;
      $('csName').value = c.name || '';
      src = c.art ? ({ photo:'album', lobby:'lobby', video:'video' }[c.art.kind] || 'album') : 'album';
      if (edit && c.art && c.art.kind === 'photo' && c.art.from) { const a = await DB.get('album', c.art.from).catch(() => null); if (a) orig = { blob:a.blob, ar:c.art.oar || 2 / 3 }; }
      paintAll();
      await Wipe.mid(() => { el.classList.add('on'); el.querySelector('.cs-body').scrollTop = 0; });
      Cast.note('kisaki');
    }
    function cloneCard(o) { const n = Object.assign({}, o, { fx:(o.fx || []).map(f => Object.assign({}, f)), art:o.art ? Object.assign({}, o.art) : null }); return n; }
    function close() { Wipe.mid(() => { el.classList.remove('on'); $('csPv').innerHTML = ''; }); CardShop.paint(); }
    function paintAll() { paintSrc(); paintFields(); paintCard(true); }
    // 編集中の絵：写真は元の写真で位置を決める（保存のときに切り取る）
    function editArt() {
      const a = c.art; if (!a) return null;
      if (a.kind === 'photo' && a.tmp) return a;
      if (a.kind === 'photo' && orig) return Object.assign({}, a, { kind:'photo', tmpUrl:YCard.blobUrl(orig.blob), ar:orig.ar, x:a.ox || 0, y:a.oy || 0, s:a.os || 1, editOrig:true });
      return a;
    }
    function paintCard(full) {
      const box = $('csPv'), a = editArt();
      const view = Object.assign({}, c, { art:a && a.tmpUrl ? Object.assign({}, a, { kind:'lobby', poster:a.tmpUrl, src:'' }) : a });
      if (full || !box.firstElementChild) {
        box.innerHTML = c.art ? YCard.html(view, { live:a && (a.kind === 'lobby' || a.kind === 'video'), cls:'cs-card' }) : `<div class="cs-empty">${YCard.html(Object.assign({}, c, { art:{ kind:'basic', static:'' } }), { cls:'cs-card still' })}</div>`;
      } else {
        const cardEl = box.querySelector('.ycard'), nu = h(YCard.html(view, { live:false, cls:'cs-card' }));
        // 絵はそのまま（動画を止めない）、文字と枠だけ入れかえる
        cardEl.className = nu.className; cardEl.style.cssText = nu.getAttribute('style');
        ['.yc-cost', '.yc-type', '.yc-who', '.yc-name', '.yc-text', '.yc-rm'].forEach(s => { const o = cardEl.querySelector(s), n = nu.querySelector(s); if (o && n) o.replaceWith(n); else if (!o && n) cardEl.querySelector('.yc-in').appendChild(n); });
        const of = cardEl.querySelector('.yc-foil'), nf = nu.querySelector('.yc-foil');
        if (of && !nf) of.remove(); if (!of && nf) cardEl.querySelector('.yc-shade').after(nf);
      }
      $('csHint').textContent = c.art ? (c.art.kind === 'photo' ? '指で動かす・2本指で拡大（ゆっくり動いて見えます）' : '指で動かす・2本指で拡大（動画がそのまま動きます）') : '下から絵を選んでください';
      const p = YCard.power(c);
      $('csPow').innerHTML = `<div class="cs-meter l${p.lv}"><i style="width:${Math.min(100, p.r / 1.8 * 100)}%"></i><u></u></div><b>${p.lab}</b><small>コスト${c.cost}に対して ${Math.round(p.r * 100)}%（目安なので、決めるのは自由です）</small>`;
    }
    // ----- 絵の選び方 -----
    async function paintSrc() {
      $('csSrc').innerHTML = [['album', 'アルバム'], ['lobby', 'メモロビ'], ['newphoto', '写真を追加'], ['video', '動画']].map(([k, n]) => `<button data-src="${k}" class="${src === k ? 'on' : ''}">${n}</button>`).join('');
      const box = $('csPick');
      if (src === 'album') {
        const list = (await DB.all('album').catch(() => [])).sort((a, b) => b.at - a.at);
        box.innerHTML = list.length ? list.map(a => `<button class="cs-th" data-al="${a.id}" style="background-image:url(${YCard.blobUrl(a.blob)})"></button>`).join('') : '<p class="cs-mu">アルバムに写真がありません。「写真を追加」から選べます</p>';
      } else if (src === 'lobby') {
        box.innerHTML = lobbies().map(l => `<button class="cs-th tall" data-lb="${l.n}" style="background-image:url(${l.poster})"><i>${esc(YCard.WHO[l.who].n)}</i></button>`).join('');
      } else if (src === 'newphoto') {
        box.innerHTML = '<button class="cs-file" data-file="photo">写真を選ぶ<small>アルバムにも保存されます</small></button>';
      } else {
        box.innerHTML = '<button class="cs-file" data-file="video">動画を選ぶ<small>12秒まで・20MBまで（画面収録など）</small></button>';
      }
    }
    function paintFields() {
      $('csWho').innerHTML = WHO_ORDER.map(k => `<button data-who="${k}" class="${c.who === k ? 'on' : ''}" style="--c:${YCard.WHO[k].c}"><img src="${k === 'other' ? 'icon-ys-192.png' : Cast.av(k)}" alt="">${YCard.WHO[k].n}</button>`).join('');
      $('csRank').innerHTML = [1, 2, 3, 4].map(r => `<button data-rank="${r}" class="${c.rank === r ? 'on' : ''} rk${r}">${YCard.RANK[r]}</button>`).join('');
      $('csCost').innerHTML = [0, 1, 2, 3].map(r => `<button data-cost="${r}" class="${c.cost === r ? 'on' : ''}">${r}</button>`).join('');
      $('csLay').innerHTML = [['normal', '通常'], ['full', 'フルアート']].map(([k, n]) => `<button data-lay="${k}" class="${c.layout === k ? 'on' : ''}">${n}</button>`).join('');
      $('csVeil').innerHTML = c.layout === 'full' ? '<span>効果欄の濃さ</span>' + [[1, 'うすい'], [2, 'ふつう'], [3, 'こい']].map(([k, n]) => `<button data-veil="${k}" class="${(c.veil || 2) === k ? 'on' : ''}">${n}</button>`).join('') : '';
      [0, 1].forEach(i => $('csFx' + i).innerHTML = fxHTML(i));
    }
    function fxHTML(i) {
      const f = c.fx[i];
      const chips = (i === 1 ? '<button data-fk="" class="' + (!f ? 'on' : '') + '">なし</button>' : '') + YCard.KEYS.map(k => `<button data-fk="${k}" data-fi="${i}" class="${f && f.k === k ? 'on' : ''}">${YCard.FX[k].n}</button>`).join('');
      if (!f) return `<div class="cs-chips fx" data-fi="${i}">${chips}</div>`;
      const T = YCard.FX[f.k];
      return `<div class="cs-chips fx" data-fi="${i}">${chips}</div><div class="cs-params">${T.p.map(([key, lab, mn, mx, st]) =>
        `<div class="cs-num" data-fi="${i}" data-key="${key}" data-min="${mn}" data-max="${mx}" data-st="${st}"><span>${lab}</span><button data-step="-1">−</button><input type="number" inputmode="numeric" value="${f[key]}" min="${mn}" max="${mx}"><button data-step="1">＋</button></div>`).join('')}
        ${T.all ? `<button class="cs-tg ${f.all ? 'on' : ''}" data-all="${i}"><i></i>${T.allN || '敵全体'}に効く</button>` : ''}<p class="cs-fxl">${esc(YCard.fxLine(f))}</p></div>`;
    }
    async function onClick(e) {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.a === 'close') return close();
      if (t.dataset.a === 'save') return save();
      if (t.dataset.a === 'del') return del();
      if (t.dataset.src) { src = t.dataset.src; paintSrc(); return; }
      if (t.dataset.al) return pickAlbum(t.dataset.al);
      if (t.dataset.lb) return pickLobby(t.dataset.lb);
      if (t.dataset.file) return pickFile(t.dataset.file);
      if (t.dataset.who) { c.who = t.dataset.who; LS.set('cs-lastWho', c.who); paintFields(); return paintCard(false); }
      if (t.dataset.rank) { c.rank = +t.dataset.rank; paintFields(); return paintCard(false); }
      if (t.dataset.cost) { c.cost = +t.dataset.cost; paintFields(); return paintCard(false); }
      if (t.dataset.lay) { c.layout = t.dataset.lay; paintFields(); return paintCard(false); }
      if (t.dataset.veil) { c.veil = +t.dataset.veil; paintFields(); return paintCard(false); }
      if (t.dataset.fk != null) {
        const i = +(t.closest('[data-fi]').dataset.fi), k = t.dataset.fk;
        if (!k) c.fx = c.fx.slice(0, 1); else if (!c.fx[i] || c.fx[i].k !== k) c.fx[i] = YCard.fxDefault(k);
        paintFields(); return paintCard(false);
      }
      if (t.dataset.all) { const f = c.fx[+t.dataset.all]; f.all = !f.all; paintFields(); return paintCard(false); }
      if (t.dataset.step) {
        const n = t.closest('.cs-num'), f = c.fx[+n.dataset.fi], k = n.dataset.key;
        f[k] = Math.max(+n.dataset.min, Math.min(+n.dataset.max, (+f[k] || 0) + (+t.dataset.step) * (+n.dataset.st)));
        n.querySelector('input').value = f[k]; n.parentElement.querySelector('.cs-fxl').textContent = YCard.fxLine(f); return paintCard(false);
      }
    }
    function onInput(e) {
      const n = e.target.closest('.cs-num'); if (!n) return;
      const f = c.fx[+n.dataset.fi], v = parseInt(e.target.value, 10); if (isNaN(v)) return;
      f[n.dataset.key] = Math.max(+n.dataset.min, Math.min(+n.dataset.max, v));
      n.parentElement.querySelector('.cs-fxl').textContent = YCard.fxLine(f); paintCard(false);
    }
    const imgSize = url => new Promise(ok => { const i = new Image(); i.onload = () => ok({ w:i.naturalWidth, h:i.naturalHeight, img:i }); i.onerror = () => ok(null); i.src = url; });
    async function pickAlbum(id) {
      const a = await DB.get('album', id).catch(() => null); if (!a) return;
      const s = await imgSize(YCard.blobUrl(a.blob)); if (!s) return toast('写真を開けませんでした');
      orig = { blob:a.blob, ar:s.w / s.h };
      c.art = { kind:'photo', tmp:true, from:id, tmpUrl:YCard.blobUrl(a.blob), ar:s.w / s.h, x:0, y:0, s:1 };
      haptic(); paintCard(true);
    }
    function pickLobby(n) {
      const l = lobbies().find(x => x.n === n); if (!l) return;
      c.art = { kind:'lobby', src:l.src, poster:l.poster, ar:1170 / 2534, x:0, y:0, s:1 };
      if (!c.name) { /* 名前は自分で */ }
      if (l.who && l.who !== 'other') { c.who = l.who; paintFields(); }
      if (c.layout === 'normal' && !edit) { c.layout = 'full'; paintFields(); }   // メモロビは最初フルアート
      haptic(); paintCard(true);
    }
    function pickFile(kind) {
      const i = document.createElement('input'); i.type = 'file'; i.accept = kind === 'photo' ? 'image/*' : 'video/*';
      i.onchange = async () => {
        const f = i.files[0]; if (!f) return;
        if (kind === 'photo') {
          const blob = await shrinkBlob(f, 1600); const id = newId();
          await DB.put('album', { id, blob, at:Date.now() }).catch(() => {});
          toast('アルバムに追加しました'); src = 'album'; paintSrc(); return pickAlbum(id);
        }
        if (f.size > 20 * 1048576) return toast('動画は20MBまでです（短く切ってください）', 2600);
        const url = URL.createObjectURL(f), meta = await videoMeta(url);
        if (!meta) return toast('この動画は読み込めませんでした');
        if (meta.dur > 12.5) return toast('動画は12秒までです（短く切ってください）', 2600);
        const poster = await frameBlob(meta.v);
        c.art = { kind:'video', vid:f, img:poster, ar:meta.w / meta.h, x:0, y:0, s:1 };
        if (c.layout === 'normal' && !edit) { c.layout = 'full'; paintFields(); }
        paintCard(true);
      };
      i.click();
    }
    function videoMeta(url) {
      return new Promise(ok => {
        const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
        const t = setTimeout(() => ok(null), 8000);
        v.onloadeddata = () => { clearTimeout(t); try { v.currentTime = Math.min(.2, v.duration / 3); } catch (e) {} setTimeout(() => ok({ v, w:v.videoWidth, h:v.videoHeight, dur:v.duration }), 350); };
        v.onerror = () => { clearTimeout(t); ok(null); };
      });
    }
    function frameBlob(v) {
      return new Promise(ok => { const k = Math.min(1, 1080 / Math.max(v.videoWidth, v.videoHeight)), cv = document.createElement('canvas');
        cv.width = Math.round(v.videoWidth * k); cv.height = Math.round(v.videoHeight * k); cv.getContext('2d').drawImage(v, 0, 0, cv.width, cv.height); cv.toBlob(b => ok(b), 'image/jpeg', .85); });
    }
    async function shrinkBlob(file, max) {
      const url = URL.createObjectURL(file);
      try { const s = await imgSize(url); const k = Math.min(1, max / Math.max(s.w, s.h)), cv = document.createElement('canvas');
        cv.width = Math.round(s.w * k); cv.height = Math.round(s.h * k); cv.getContext('2d').drawImage(s.img, 0, 0, cv.width, cv.height);
        return await new Promise(ok => cv.toBlob(b => ok(b), 'image/jpeg', .9)); } finally { URL.revokeObjectURL(url); }
    }
    // ----- 指で位置と大きさを決める -----
    function bindCrop() {
      const pv = $('csPv'), pts = new Map(); let base = null;
      const art = () => { const a = editArt(); return a && a.kind !== 'basic' ? a : null; };
      const clamp = a => {
        const w = a.s * Math.max(1, a.ar * 1.5), hp = w / a.ar / 1.5;
        a.x = Math.max(-(w - 1) / 2, Math.min((w - 1) / 2, a.x)); a.y = Math.max(-(hp - 1) / 2, Math.min((hp - 1) / 2, a.y));
      };
      const apply = a => pv.querySelectorAll('.yc-m').forEach(m => m.setAttribute('style', YCard.boxStyle(Object.assign({}, a, { kind:'lobby' }))));
      pv.addEventListener('pointerdown', e => { if (!art()) return; pv.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x:e.clientX, y:e.clientY }); start(); });
      pv.addEventListener('pointermove', e => {
        if (!pts.has(e.pointerId) || !base) return; pts.set(e.pointerId, { x:e.clientX, y:e.clientY });
        const a = c.art, r = pv.querySelector('.ycard').getBoundingClientRect(), p = [...pts.values()];
        const cx = p.reduce((s, q) => s + q.x, 0) / p.length, cy = p.reduce((s, q) => s + q.y, 0) / p.length;
        let s = base.s; if (p.length >= 2 && base.d) s = Math.max(1, Math.min(4, base.s * Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) / base.d));
        a.s = s; a.x = base.x + (cx - base.cx) / r.width; a.y = base.y + (cy - base.cy) / r.height; clamp(a); apply(a);
      });
      const up = e => { pts.delete(e.pointerId); start(); };
      pv.addEventListener('pointerup', up); pv.addEventListener('pointercancel', up);
      function start() {
        if (!pts.size || !c.art) { base = null; return; }
        if (c.art.kind === 'photo' && !c.art.tmp && orig) { c.art = Object.assign({}, editArt(), { tmp:true, kind:'photo' }); }   // 保存済みの写真を直すとき
        const p = [...pts.values()], a = c.art;
        base = { x:a.x || 0, y:a.y || 0, s:a.s || 1, cx:p.reduce((s, q) => s + q.x, 0) / p.length, cy:p.reduce((s, q) => s + q.y, 0) / p.length, d:p.length >= 2 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0 };
      }
    }
    // ----- 保存（現像） -----
    async function bakePhoto(a) {
      const blob = orig ? orig.blob : null; if (!blob) return a;
      const s = await imgSize(YCard.blobUrl(blob)); if (!s) return a;
      const W = 720, H = 1080, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const w = a.s * Math.max(1, a.ar * 1.5) * W, hh = w / a.ar, left = W / 2 + a.x * W - w / 2, top = H / 2 + a.y * H - hh / 2;
      const g = cv.getContext('2d'); g.fillStyle = '#0b1430'; g.fillRect(0, 0, W, H); g.drawImage(s.img, left, top, w, hh);
      const img = await new Promise(ok => cv.toBlob(b => ok(b), 'image/jpeg', .86));
      return { kind:'photo', img, from:a.from, oar:a.ar, ox:a.x, oy:a.y, os:a.s, ar:2 / 3, x:0, y:0, s:1 };
    }
    async function save() {
      if (busy) return;
      if (!c.art) return toast('絵を選んでください');
      if (!c.name) { $('csName').focus(); return toast('名前を入れてください'); }
      if (!c.fx.length) return toast('効果を1つ選んでください');
      busy = true;
      try {
        if (c.art.kind === 'photo' && (c.art.tmp || c.art.editOrig)) c.art = await bakePhoto(c.art);
        const rec = Object.assign({}, c, { at:c.at || Date.now(), up:Date.now() }); delete rec.art.tmpUrl; delete rec.art.tmp;
        await DB.put('cards', rec);
        await develop(rec);
        el.classList.remove('on'); $('csPv').innerHTML = '';
        if (typeof Progress !== 'undefined') Progress.checkAch();
        CardShop.paint();
        Case.open(rec.id);
      } catch (e) { console.warn(e); toast('保存できませんでした：' + (e.message || e), 3000); }
      busy = false;
    }
    // 現像の演出：光って、カードが表になる
    async function develop(rec) {
      const ov = h(`<div class="cs-dev r${rec.rank}"><i class="cs-dl"></i><i class="cs-dl b"></i><div class="cs-dc">${YCard.html(rec, { live:true })}</div><p>${rec.rank >= 3 ? 'RARE CARD' : 'NEW CARD'}<small>${esc(rec.name)}</small></p></div>`);
      document.body.appendChild(ov);
      Sfx.play('door'); haptic();
      await sleep(60); ov.classList.add('on');
      await sleep(700); Sfx.play(rec.rank >= 3 ? 'done' : 'ok'); Wipe.slash();
      await sleep(1500);
      await new Promise(r => { ov.onclick = r; setTimeout(r, 1400); });
      ov.classList.add('out'); await sleep(320); ov.remove();
    }
    async function del() {
      if (!(await Ask(`「${c.name}」を削除しますか？\nデッキからも外れます`, { ok:'削除する', danger:true }))) return;
      await DB.del('cards', c.id);
      YCard.setDeck(YCard.deck().filter(x => x !== 'u_' + c.id));
      toast('削除しました'); close(); if (Case.isOpen()) Case.refresh();
    }
    return { open, close };
  })();

  // ===== ショーケース（集めたカード・デッキ） =====
  const Case = (() => {
    let el = null, tab = 'all', who = '', sort = 'new', list = [];
    function build() {
      el = h(`<div id="csCase" class="csov"><div class="cs-hd"><button class="cs-x" data-a="close" aria-label="閉じる">×</button><div><small>SHOWCASE</small><b>ショーケース</b></div><button class="cs-go sub" data-a="make">＋ 作る</button></div>
        <div class="cs-tabs main" id="ccTab"></div><div class="cs-body" id="ccBody"></div></div>`);
      document.body.appendChild(el);
      el.addEventListener('click', onClick);
    }
    async function open(focusId) {
      if (!el) build();
      list = await YCard.all().catch(() => []);
      tab = focusId ? 'all' : tab;
      paint();
      if (!el.classList.contains('on')) await Wipe.mid(() => el.classList.add('on'));
      if (focusId) setTimeout(() => detail(focusId), 200);
    }
    const isOpen = () => !!(el && el.classList.contains('on'));
    async function refresh() { list = await YCard.all().catch(() => []); paint(); }
    function sorted() {
      let l = list.filter(c => !who || c.who === who);
      if (sort === 'new') l.sort((a, b) => (b.at || 0) - (a.at || 0));
      if (sort === 'rank') l.sort((a, b) => b.rank - a.rank || (b.at || 0) - (a.at || 0));
      if (sort === 'cost') l.sort((a, b) => a.cost - b.cost || b.rank - a.rank);
      return l;
    }
    function paint() {
      $('ccTab').innerHTML = [['all', `コレクション ${list.length}`], ['deck', `デッキ ${YCard.deck().length}`]].map(([k, n]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${n}</button>`).join('');
      const b = $('ccBody');
      if (tab === 'all') {
        const counts = {}; list.forEach(c => counts[c.who] = (counts[c.who] || 0) + 1);
        b.innerHTML = `<div class="cs-chips who"><button data-who="" class="${!who ? 'on' : ''}">全員</button>${WHO_ORDER.filter(k => counts[k]).map(k => `<button data-who="${k}" class="${who === k ? 'on' : ''}" style="--c:${YCard.WHO[k].c}"><img src="${k === 'other' ? 'icon-ys-192.png' : Cast.av(k)}" alt="">${YCard.WHO[k].n}<em>${counts[k]}</em></button>`).join('')}</div>
          <div class="cs-sort">${[['new', '新しい順'], ['rank', 'ランク順'], ['cost', 'コスト順']].map(([k, n]) => `<button data-sort="${k}" class="${sort === k ? 'on' : ''}">${n}</button>`).join('')}</div>
          ${list.length ? `<div class="cs-grid">${sorted().map((c, i) => `<button class="cs-cell" data-card="${c.id}" style="animation-delay:${Math.min(i, 18) * 25}ms">${YCard.html(c, { still:true })}${deckCount('u_' + c.id) ? `<em>デッキ ${deckCount('u_' + c.id)}</em>` : ''}</button>`).join('')}</div>`
            : '<div class="cs-emptyl"><p>まだカードがありません</p><button class="cs-go" data-a="make">最初の1枚を作る</button></div>'}`;
      } else deckHTML(b);
    }
    const deckCount = id => YCard.deck().filter(x => x === id).length;
    // ----- デッキ -----
    function deckHTML(b) {
      const d = YCard.deck(), mine = list.slice().sort((a, b) => WHO_ORDER.indexOf(a.who) - WHO_ORDER.indexOf(b.who) || b.rank - a.rank);
      const n = d.length, ok = n >= YCard.DECK.min && n <= YCard.DECK.max;
      const whoN = {}; d.forEach(id => { const c = id.startsWith('u_') ? list.find(x => 'u_' + x.id === id) : null; if (c) whoN[c.who] = (whoN[c.who] || 0) + 1; });
      const row = (c, id) => { const k = deckCount(id), mx = YCard.copyMax(c);
        return `<div class="cs-drow"><div class="cs-dmini">${YCard.html(c, { still:true })}</div><div class="cs-dinfo"><b>${esc(c.name)}</b><span>${esc(YCard.WHO[c.who].n)}・コスト${c.cost}・${YCard.RANK[c.rank]}</span><small>${esc(YCard.fxText(c.fx))}</small></div>
          <div class="cs-dq"><button data-dq="${id}" data-d="-1" ${k ? '' : 'disabled'}>−</button><b>${k}</b><button data-dq="${id}" data-d="1" ${k >= mx ? 'disabled' : ''}>＋</button><small>最大${mx}</small></div></div>`; };
      b.innerHTML = `<div class="cs-dhead ${ok ? '' : 'ng'}"><b>${n}</b><span>/ ${YCard.DECK.min}〜${YCard.DECK.max}枚</span><em>${ok ? 'このデッキで戦えます' : n < YCard.DECK.min ? `あと${YCard.DECK.min - n}枚必要です` : `${n - YCard.DECK.max}枚多すぎます`}</em></div>
        <div class="cs-dwho">${Object.entries(whoN).map(([k, v]) => `<span style="--c:${YCard.WHO[k].c}"><img src="${k === 'other' ? 'icon-ys-192.png' : Cast.av(k)}" alt="">${YCard.WHO[k].n} ${v}</span>`).join('') || '<span>基本カードだけのデッキ</span>'}</div>
        <p class="cs-note">HALO LINK では、デッキに入っている子の中から3人を選んで出撃します。編成に入っていない子のカードは、前列の子が使えます。</p>
        <div class="cs-dbtn"><button data-a="auto">おまかせで組む</button><button data-a="reset">基本だけにもどす</button></div>
        <h4 class="cs-sh">自分のカード</h4>${mine.length ? mine.map(c => row(c, 'u_' + c.id)).join('') : '<p class="cs-mu">作ったカードがここに並びます</p>'}
        <h4 class="cs-sh">基本カード</h4>${YCard.BASIC.map(c => row(c, c.id)).join('')}`;
    }
    function autoDeck() {
      const d = [], add = (id, n) => { for (let i = 0; i < n; i++) d.push(id); };
      list.slice().sort((a, b) => b.rank - a.rank || (b.at || 0) - (a.at || 0)).forEach(c => { if (d.length < 18) add('u_' + c.id, Math.min(YCard.copyMax(c), c.cost <= 1 ? 2 : 1)); });
      const fill = ['b_atk', 'b_def', 'b_atk', 'b_def', 'b_heal', 'b_sup', 'b_atk', 'b_def', 'b_big', 'b_heal', 'b_sup', 'b_atk', 'b_def', 'b_big', 'b_heal', 'b_atk', 'b_def'];
      for (const id of fill) { if (d.length >= 20) break; if (d.filter(x => x === id).length < 4) d.push(id); }
      return d;
    }
    async function onClick(e) {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.a === 'close') return Wipe.mid(() => el.classList.remove('on')).then(() => CardShop.paint());
      if (t.dataset.a === 'make') return Maker.open();
      if (t.dataset.tab) { tab = t.dataset.tab; haptic(); return paint(); }
      if (t.dataset.who != null && tab === 'all') { who = t.dataset.who; return paint(); }
      if (t.dataset.sort) { sort = t.dataset.sort; return paint(); }
      if (t.dataset.card) return detail(t.dataset.card);
      if (t.dataset.dq) {
        const d = YCard.deck().slice(), id = t.dataset.dq;
        if (+t.dataset.d > 0) d.push(id); else d.splice(d.indexOf(id), 1);
        YCard.setDeck(d); haptic(); const y = $('ccBody').scrollTop; paint(); $('ccBody').scrollTop = y; return;
      }
      if (t.dataset.a === 'auto') { YCard.setDeck(autoDeck()); Wipe.slash(); toast('デッキを組みました'); return paint(); }
      if (t.dataset.a === 'reset') { if (await Ask('デッキを基本カードだけにもどしますか？')) { YCard.setDeck(YCard.defaultDeck()); paint(); } return; }
    }
    // ----- 1枚を大きく -----
    function detail(id) {
      const c = list.find(x => x.id === id); if (!c) return;
      const k = deckCount('u_' + c.id), mx = YCard.copyMax(c);
      const ov = h(`<div class="cs-det"><div class="cs-dcard">${YCard.html(c, { live:true, cls:'tilt' })}</div>
        <p class="cs-dmeta">${esc(YCard.WHO[c.who].n)}のカード・${c.art && c.art.kind === 'lobby' ? 'メモロビ' : c.art && c.art.kind === 'video' ? '動画' : '写真'}・${new Date(c.at).toLocaleDateString('ja-JP')}</p>
        <div class="cs-dact"><button data-x="edit">直す</button><button data-x="add" ${k >= mx ? 'disabled' : ''}>デッキに入れる<small>${k}/${mx}</small></button><button data-x="close">閉じる</button></div></div>`);
      document.body.appendChild(ov); requestAnimationFrame(() => ov.classList.add('on'));
      YCard.tilt(ov.querySelector('.ycard'));
      const shut = () => { ov.classList.remove('on'); setTimeout(() => ov.remove(), 260); };
      ov.addEventListener('click', e => {
        const b = e.target.closest('[data-x]'); if (!b) { if (e.target === ov) shut(); return; }
        haptic();
        if (b.dataset.x === 'close') shut();
        if (b.dataset.x === 'edit') { shut(); Maker.open(c); }
        if (b.dataset.x === 'add') { const d = YCard.deck(); d.push('u_' + c.id); YCard.setDeck(d); toast('デッキに入れました'); shut(); paint(); }
      });
    }
    return { open, isOpen, refresh };
  })();

  // ===== ゲーム機（HALO LINK） =====
  const Game = (() => {
    let el = null;
    function open() {
      if (el) return;
      el = h(`<div id="hlGame"><iframe src="hl.html?v=${VERSION}" title="HALO LINK" allow="autoplay"></iframe></div>`);
      document.body.appendChild(el); document.body.classList.add('hlOn');
      syncBgm(0, .3);
      requestAnimationFrame(() => el.classList.add('on'));
    }
    function close() {
      if (!el) return;
      const e = el; el = null; e.classList.remove('on');
      setTimeout(() => e.remove(), 320); document.body.classList.remove('hlOn');
      syncBgm(200); CardShop.paint();
      if (typeof Progress !== 'undefined') Progress.checkAch();
    }
    addEventListener('message', e => { if (e.origin !== location.origin) return; if (e.data === 'hl:close') close(); });
    return { open, close, isOpen:() => !!el };
  })();

  function init() {
    if (!$('page-shop')) return;
    build();
    TAB_BGM.sc_shop = TAB_BGM.shop = L('kisaki_bgm.mp3', 141.0);
    TabHooks.shop = { enter:() => { size(); paint(); requestAnimationFrame(size); } };
  }
  return { init, paint, Maker, Case, Game, lobbies };
})();
App.modules.push(CardShop);
