// Kani Favorite — Love（ミカ）：ポラロイド風カード、長押しで持ち上げて並べ替え、ミカの上に落とすと反応
'use strict';
const Love = (() => {
  let items = [], cat = '', vIdx = -1, vList = [];
  const head = () => $('loveHead'), box = () => $('loveList');
  const THEME = { '--accent':'#f27ea7', '--title':'#e7779f', '--soft':'#fff3f7', '--line':'#f9d3e0' };
  const sorted = () => items.slice().sort((a, b) => (a.order || 0) - (b.order || 0) || b.createdAt - a.createdAt);
  const cats = () => { const s = []; sorted().forEach(x => { if (x.cat && !s.includes(x.cat)) s.push(x.cat); }); return s; };
  const shown = () => sorted().filter(x => !cat || x.cat === cat);
  const tilt = id => ((hashN(id, 9) - 4) * 0.55).toFixed(2) + 'deg';
  const initial = x => esc([...(x.title || x.cat || '♡')][0]);

  async function load() { items = await DB.all('loves'); render(); }
  function card(x) {
    return `<div class="pc" data-id="${x.id}" style="--tilt:${tilt(x.id)}"><div class="ph">${x.photo ? `<img src="${x.photo}" alt="" loading="lazy" decoding="async">` : `<b>${initial(x)}</b>`}</div>
      <div class="cap">${x.cat ? `<i>${esc(x.cat)}</i>` : ''}<span>${esc(x.title)}</span></div></div>`;
  }
  function render() {
    const cs = cats(); if (cat && !cs.includes(cat)) cat = '';
    head().innerHTML = cs.length ? `<div class="chips"><button data-c="" class="${!cat ? 'on' : ''}">すべて</button>${cs.map(c => `<button data-c="${esc(c)}" class="${c === cat ? 'on' : ''}">${esc(c)}</button>`).join('')}</div>` : '';
    head().querySelectorAll('button').forEach(b => b.onclick = () => { cat = b.dataset.c; render(); });
    const list = shown();
    box().innerHTML = list.length ? `<div class="pgrid">${list.map(card).join('')}</div>`
      : '<div class="empty" style="color:#7a3a52"><b>♡</b>好きなもの、ここに集めよう☆<br>＋からカードを作れるよ</div>';
  }

  // 拡大表示（左右スワイプで前後）
  function view(id) {
    vList = shown(); vIdx = vList.findIndex(x => x.id === id); drawViewer(); $('viewer').classList.add('show');
  }
  function drawViewer() {
    const x = vList[vIdx]; if (!x) return;
    $('viewer').innerHTML = `<div class="vcard"><div class="vph">${x.photo ? `<img src="${x.photo}" alt="">` : `<b>${initial(x)}</b>`}</div>
      <div class="vcap">${x.cat ? `<i>${esc(x.cat)}</i>` : ''}<h4>${esc(x.title)}</h4>${x.memo ? `<p>${esc(x.memo)}</p>` : ''}</div></div>
      <div class="vbtns"><button class="cl">閉じる</button><button class="pri ed">編集</button></div>${vList.length > 1 ? `<div class="vnav">${vIdx + 1} / ${vList.length}　左右にスワイプで切り替え</div>` : ''}`;
    $('viewer').querySelector('.cl').onclick = closeViewer;
    $('viewer').querySelector('.ed').onclick = () => { closeViewer(); edit(x); };
  }
  const closeViewer = () => $('viewer').classList.remove('show');

  function edit(x) {
    const isNew = !x;
    x = x || { cat:cat || '', title:'', memo:'', photo:'' };
    let photo = x.photo || '';
    const body = h('<div></div>');
    const ph = h('<div class="fl"><label>写真</label><div class="photo"></div><input type="file" accept="image/*" class="hiddenFile"></div>');
    const pbox = ph.querySelector('.photo'), fin = ph.querySelector('input');
    const drawPh = () => {
      pbox.innerHTML = photo ? `<img src="${photo}" alt=""><button class="rm" type="button">はずす</button>`
        : '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="15" rx="3"/><circle cx="12" cy="12.5" r="3.5"/><path d="M8 5l1.5-2h5L16 5"/></svg>写真をえらぶ（なくてもOK）';
      const rm = pbox.querySelector('.rm'); if (rm) rm.onclick = e => { e.stopPropagation(); photo = ''; drawPh(); };
    };
    drawPh();
    pbox.onclick = () => fin.click();
    fin.onchange = async () => { const f = fin.files[0]; if (!f) return; pbox.innerHTML = '読み込み中…'; try { photo = await shrinkPhoto(f); } catch(e) { toast('写真を読み込めませんでした'); } drawPh(); fin.value = ''; };
    const fCat = F.suggest('カテゴリ', x.cat, cats(), '例：食べ物、漫画、場所');
    const fTitle = F.text('ひとこと', x.title, '例：辛ラーメン');
    const fMemo = F.area('メモ', x.memo, '好きな理由や思い出など');
    body.append(ph, fCat.el, fTitle.el, fMemo.el);
    Editor.open({
      title:isNew ? 'カードを追加' : 'カードを編集', body, theme:THEME,
      save:async () => {
        const title = fTitle.get();
        if (!title && !photo) { fTitle.input.classList.add('shake'); setTimeout(() => fTitle.input.classList.remove('shake'), 400); return false; }
        const obj = Object.assign({}, x, { cat:fCat.get(), title, memo:fMemo.get(), photo });
        if (isNew) Object.assign(obj, { id:newId(), createdAt:Date.now(), order:Math.min(0, ...items.map(i => i.order || 0)) - 1 });
        const i = items.findIndex(y => y.id === obj.id); if (i >= 0) items[i] = obj; else items.push(obj);
        await DB.put('loves', obj); render();
        if (isNew) setTimeout(() => { const el = box().querySelector(`[data-id="${obj.id}"]`); if (el) el.animate([{ transform:'scale(.6) rotate(-8deg)', opacity:0 }, { transform:`rotate(${tilt(obj.id)})`, opacity:1 }], { duration:420, easing:'cubic-bezier(.3,1.5,.5,1)' }); }, 30);
        return true;
      },
      del:isNew ? null : async () => {
        items = items.filter(y => y.id !== x.id); await DB.del('loves', x.id); render();
        Snack.show('カードを削除しました', '元に戻す', async () => { items.push(x); await DB.put('loves', x); render(); });
      },
    });
  }

  // カードをミカの上に落とした？
  function overMika(px, py) {
    const r = $('loveChibi').getBoundingClientRect();
    return px > r.left + r.width * .12 && px < r.right - r.width * .12 && py > r.top && py < r.bottom;
  }
  async function dropOnMika(el, info) {
    if (Motion.isBusy('mika')) return false;   // 動いている途中は受け付けない（カードは元の場所へ）
    info.restore();
    const g = info.ghost, r = $('loveChibi').getBoundingClientRect();
    const gr = g.getBoundingClientRect(), tx = r.left + r.width * .5 - gr.width / 2, ty = r.top + r.height * .02 - gr.height * .5;
    // 一度ふわっと浮かせて、頭の上に落とす
    await g.animate([{ left:g.style.left, top:g.style.top, transform:'scale(1.05) rotate(0)' }, { left:tx+'px', top:(ty - 70)+'px', transform:'scale(.55) rotate(-12deg)' }],
                    { duration:260, easing:'ease-out', fill:'forwards' }).finished;
    await g.animate([{ left:tx+'px', top:(ty - 70)+'px', transform:'scale(.55) rotate(-12deg)' }, { left:tx+'px', top:ty+'px', transform:'scale(.55) rotate(6deg)' }],
                    { duration:200, easing:'cubic-bezier(.5,0,.9,.5)', fill:'forwards' }).finished;
    const play = Motion.play('mika', 'drop');
    // 頭で跳ねて、元の場所へ帰る
    const er = el.getBoundingClientRect();
    await g.animate([{ left:tx+'px', top:ty+'px', transform:'scale(.55) rotate(6deg)' }, { left:(tx + 40)+'px', top:(ty - 50)+'px', transform:'scale(.6) rotate(30deg)', offset:.35 },
                     { left:er.left+'px', top:er.top+'px', transform:'scale(1) rotate(0)' }], { duration:900, easing:'cubic-bezier(.3,.6,.3,1)', fill:'forwards' }).finished;
    play.catch(() => {});
    return true;
  }
  function init() {
    $('loveAdd').onclick = () => edit(null);
    box().addEventListener('click', e => { if (Sortable.recent()) return; const c = e.target.closest('.pc'); if (c) view(c.dataset.id); });
    Sortable.attach(box(), {
      items:'.pc', hold:320,
      onMove:(x, y, g) => { g.style.filter = overMika(x, y) && !Motion.isBusy('mika') ? 'drop-shadow(0 0 10px #fff) brightness(1.04)' : ''; },
      onDrop:(el, info) => overMika(info.x, info.y) ? dropOnMika(el, info) : false,
      onEnd:async ids => {   // 絞り込み中でも、見えている分の順番だけ入れ替える
        const all = sorted(), pos = all.map((x, i) => ids.includes(x.id) ? i : -1).filter(i => i >= 0);
        const moved = ids.map(id => all.find(x => x.id === id));
        pos.forEach((p, k) => { all[p] = moved[k]; });
        all.forEach((x, i) => { x.order = i; });
        await DB.putMany('loves', all);
      },
    });
    // 拡大表示：左右スワイプ・背景タップで閉じる
    const vw = $('viewer'); let sx = 0, sy = 0;
    vw.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; });
    vw.addEventListener('pointerup', e => {
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) && vList.length > 1) {
        vIdx = (vIdx + (dx < 0 ? 1 : -1) + vList.length) % vList.length; drawViewer();
        vw.querySelector('.vcard').animate([{ transform:`translateX(${dx < 0 ? 40 : -40}px)`, opacity:.3 }, { transform:'none', opacity:1 }], { duration:220, easing:'ease-out' });
      } else if (e.target === vw && Math.hypot(dx, dy) < 10) closeViewer();
    });
    // ミカをタップしたとき：落ちてくるのは自分のカード（写真つき）から1枚
    Motion.handlers.mika = () => {
      const ph = items.filter(x => x.photo);
      const pick = ph.length ? ph[Math.floor(Math.random() * ph.length)].photo : (items.length ? '' : undefined);
      Motion.play('mika', 'tap', pick);
    };
    TabHooks.love = { enter:() => Motion.preload('mika'), leave:closeViewer };
    load();
  }
  return { init, reload:load };
})();
App.modules.push(Love);
