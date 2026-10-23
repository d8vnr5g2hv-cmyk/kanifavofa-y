// Kani Favorite — 共通の部品（入力シート・メニュー・元に戻す・並べ替え）
'use strict';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const hashN = (s, n) => { let x = 0; for (const c of String(s)) x = (x * 31 + c.charCodeAt(0)) >>> 0; return x % n; };

// ===== 軽い振動（iPhoneは「スイッチ」を押したときの振動を借りる） =====
const haptic = (() => {
  let lb = null;
  return () => {
    try {
      if (navigator.vibrate) { navigator.vibrate(8); return; }
      if (!lb) {
        lb = document.createElement('label'); lb.setAttribute('aria-hidden', 'true');
        lb.style.cssText = 'position:fixed;left:-200px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
        const i = document.createElement('input'); i.type = 'checkbox'; i.setAttribute('switch', ''); i.tabIndex = -1;
        lb.appendChild(i); document.body.appendChild(lb);
      }
      lb.click();
    } catch(e) {}
  };
})();
// ===== タブを開いたとき、中身が上から順にふわっと出る =====
function stagger(box) {
  if (!box) return;
  const els = [...box.querySelectorAll('.today, .sec, .trow, .pc, .arow, .anv, .person, .pcard, .empty, .lockp > *, .gate > *, .doneToggle')].slice(0, 16);
  els.forEach((el, i) => el.animate([{ opacity:0, translate:'0 14px' }, { opacity:1, translate:'0 0' }],
    { duration:420, delay:40 + i * 35, easing:'cubic-bezier(.2,.8,.2,1)', fill:'backwards' }));
}

// ===== 元に戻す（下に出る帯） =====
const Snack = (() => {
  let t, fn;
  const el = () => $('snack');
  return {
    show(msg, label, action, ms = 4500) {
      const s = el(); s.querySelector('span').textContent = msg;
      const b = s.querySelector('button'); b.textContent = label || ''; b.style.display = label ? '' : 'none';
      fn = action; s.classList.add('show'); clearTimeout(t); t = setTimeout(() => this.hide(), ms);
      b.onclick = () => { const f = fn; fn = null; this.hide(); if (f) f(); };
    },
    hide() { el().classList.remove('show'); },
  };
})();

// ===== 入力シート =====
const Editor = (() => {
  let onSave = null, onClose = null, theme = null;
  const ed = () => $('ed'), bg = () => $('edBg');
  function close() {
    ed().classList.remove('show'); bg().classList.remove('show');
    if (document.activeElement) document.activeElement.blur();
    const f = onClose; onSave = onClose = null; if (f) f();
  }
  return {
    // opts: { title, body:Element, save:async()=>bool, del:async()=>void, delLabel, saveLabel, accent, focus:Element }
    open(opts) {
      const e = ed();
      e.querySelector('h3').textContent = opts.title || '';
      const body = e.querySelector('.eb'); body.innerHTML = ''; body.scrollTop = 0;
      body.appendChild(opts.body);
      if (opts.del) {
        const d = h(`<button class="del">${esc(opts.delLabel || '削除する')}</button>`);
        d.onclick = async () => { if (!confirm(opts.delConfirm || 'このデータを削除しますか？')) return; haptic(); await opts.del(); close(); };
        body.appendChild(d);
      }
      const sv = e.querySelector('.save'); sv.textContent = opts.saveLabel || '保存'; sv.style.visibility = opts.save ? '' : 'hidden';
      ['--accent', '--title', '--soft', '--line'].forEach(k => e.style.removeProperty(k));
      if (opts.theme) Object.entries(opts.theme).forEach(([k, v]) => e.style.setProperty(k, v));
      onSave = opts.save; onClose = opts.onClose || null;
      e.classList.add('show'); bg().classList.add('show');
      if (opts.focus) { try { opts.focus.focus({ preventScroll:true }); } catch(err) { opts.focus.focus(); } }
    },
    close,
    init() {
      ed().querySelector('.cancel').onclick = close;
      bg().onclick = close;
      ed().querySelector('.save').onclick = async () => {
        if (!onSave) return close();
        const ok = await onSave(); if (ok !== false) { haptic(); close(); }
      };
    },
  };
})();

// ===== 選択メニュー（下から） =====
const Menu = {
  open(title, items) {   // items: [{ label, sub, danger, fn }]
    const m = $('menu'), bg = $('menuBg');
    m.innerHTML = (title ? `<h4>${esc(title)}</h4>` : '') + items.map((it, i) => `<button class="row${it.danger ? ' danger' : ''}" data-i="${i}"><span>${esc(it.label)}${it.sub ? `<small style="display:block;font-size:11px;color:#9a8a93;margin-top:2px">${esc(it.sub)}</small>` : ''}</span></button>`).join('') + '<button class="close">閉じる</button>';
    const close = () => { m.classList.remove('show'); bg.classList.remove('show'); };
    m.querySelectorAll('.row').forEach(b => b.onclick = () => { close(); items[+b.dataset.i].fn(); });
    m.querySelector('.close').onclick = close; bg.onclick = close;
    m.classList.add('show'); bg.classList.add('show');
  },
};

// ===== 入力欄の部品 =====
const F = {
  wrap(label, inner) { const w = h(`<div class="fl">${label ? `<label>${esc(label)}</label>` : ''}</div>`); w.appendChild(inner); return w; },
  text(label, value, ph = '', type = 'text') {
    const i = h(`<input class="inp" type="${type}" placeholder="${esc(ph)}" autocomplete="off">`); i.value = value || '';
    return { el:F.wrap(label, i), input:i, get:() => i.value.trim() };
  },
  area(label, value, ph = '') {
    const i = h(`<textarea class="inp" placeholder="${esc(ph)}"></textarea>`); i.value = value || '';
    const fit = () => { i.style.height = 'auto'; i.style.height = Math.max(90, i.scrollHeight + 2) + 'px'; };
    i.addEventListener('input', fit); setTimeout(fit, 0);
    return { el:F.wrap(label, i), input:i, get:() => i.value.trim() };
  },
  // 選択（横並びのボタン）
  seg(label, options, value) {   // options: [[value, label]]
    let v = value;
    const box = h('<div class="seg"></div>');
    options.forEach(([ov, ol]) => { const b = h(`<button type="button">${esc(ol)}</button>`); b.classList.toggle('on', ov === v); b.onclick = () => { v = ov; [...box.children].forEach(x => x.classList.toggle('on', x === b)); if (api.onChange) api.onChange(v); }; box.appendChild(b); });
    const api = { el:F.wrap(label, box), get:() => v, onChange:null };
    return api;
  },
  // 日付＋よく使う候補
  date(label, value, quick = true) {
    const wrap = h('<div></div>');
    const i = h('<input class="inp" type="date">'); i.value = value || ''; wrap.appendChild(i);
    if (quick) {
      const t = D.today(), dow = new Date().getDay(), sat = D.add(t, (6 - dow + 7) % 7 || 7);
      const qs = [['今日', t], ['明日', D.add(t, 1)], ['週末', sat], ['来週', D.add(t, 7)], ['なし', '']];
      const q = h('<div class="qk"></div>');
      const mark = () => [...q.children].forEach((b, k) => b.classList.toggle('on', qs[k][1] === i.value));
      qs.forEach(([l, v]) => { const b = h(`<button type="button">${l}</button>`); b.onclick = () => { i.value = v; mark(); }; q.appendChild(b); });
      i.addEventListener('change', mark); mark(); wrap.appendChild(q);
    }
    return { el:F.wrap(label, wrap), input:i, get:() => i.value };
  },
  // 文字入力＋これまでの候補
  suggest(label, value, list, ph = '') {
    const wrap = h('<div></div>');
    const i = h(`<input class="inp" type="text" placeholder="${esc(ph)}" autocomplete="off">`); i.value = value || ''; wrap.appendChild(i);
    if (list.length) {
      const q = h('<div class="qk"></div>');
      const mark = () => [...q.children].forEach(b => b.classList.toggle('on', b.textContent === i.value.trim()));
      list.forEach(v => { const b = h(`<button type="button">${esc(v)}</button>`); b.onclick = () => { i.value = v; mark(); }; q.appendChild(b); });
      i.addEventListener('input', mark); mark(); wrap.appendChild(q);
    }
    return { el:F.wrap(label, wrap), input:i, get:() => i.value.trim() };
  },
};

// ===== 長押しで持ち上げて並べ替え（リストでも2列でも） =====
// opts: { items:'.selector', hold:ms, onStart(el), onMove(x,y,ghost), onDrop(el, info)=>bool(自前で処理したら true), onEnd(ids), canStart(el) }
const Sortable = (() => {
  let drag = null, lastEnd = 0;
  document.addEventListener('touchmove', e => { if (drag) e.preventDefault(); }, { passive:false });
  function attach(container, opts) {
    let pending = null;
    const scroller = opts.scroller || container.closest('.scroll');
    container.addEventListener('pointerdown', e => {
      const el = e.target.closest(opts.items);
      if (!el || !container.contains(el) || drag || e.button > 0) return;
      if (opts.canStart && !opts.canStart(el, e)) return;
      const sx = e.clientX, sy = e.clientY, id = e.pointerId;
      const cancel = () => { if (pending) { clearTimeout(pending.t); pending = null; } };
      pending = { t:setTimeout(() => { pending = null; start(el, sx, sy, id); }, opts.hold || 380), sx, sy };
      const mv = ev => { if (pending && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8) cancel(); };
      const up = () => { cancel(); removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); };
      addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
    });
    function siblings() { return [...container.querySelectorAll(opts.items)].filter(x => x.parentNode === drag.el.parentNode); }
    function start(el, x, y, pid) {
      const r = el.getBoundingClientRect();
      const ghost = el.cloneNode(true);
      ghost.classList.add('dragGhost');
      Object.assign(ghost.style, { left:r.left+'px', top:r.top+'px', width:r.width+'px', height:r.height+'px' });
      document.body.appendChild(ghost);
      el.classList.add('dragHole');
      drag = { el, ghost, dx:x - r.left, dy:y - r.top, x, y, startIndex:null, moved:false };
      drag.startIndex = siblings().indexOf(el);
      document.body.classList.add('dragging'); haptic();
      ghost.animate([{ transform:'scale(1)' }, { transform:'scale(1.05)' }], { duration:160, fill:'forwards', easing:'ease-out' });
      if (navigator.vibrate) navigator.vibrate(10);
      if (opts.onStart) opts.onStart(el, ghost);
      const mv = ev => { ev.preventDefault(); move(ev.clientX, ev.clientY); };
      const up = ev => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); end(ev.clientX, ev.clientY, ev.type === 'pointercancel'); };
      addEventListener('pointermove', mv, { passive:false }); addEventListener('pointerup', up); addEventListener('pointercancel', up);
      loop();
    }
    function loop() {   // 端に近づいたら自動でスクロール
      if (!drag) return;
      if (scroller) {
        const r = scroller.getBoundingClientRect(), m = 56;
        let v = 0; if (drag.y < r.top + m) v = -(r.top + m - drag.y) / 4; else if (drag.y > r.bottom - m) v = (drag.y - (r.bottom - m)) / 4;
        if (v) { scroller.scrollTop += Math.max(-14, Math.min(14, v)); reorder(drag.x, drag.y); }
      }
      requestAnimationFrame(loop);
    }
    function move(x, y) {
      drag.x = x; drag.y = y; drag.moved = true;
      drag.ghost.style.left = (x - drag.dx) + 'px'; drag.ghost.style.top = (y - drag.dy) + 'px';
      if (opts.onMove) opts.onMove(x, y, drag.ghost);
      reorder(x, y);
    }
    function reorder(x, y) {
      const sibs = siblings(); let target = null;
      for (const s of sibs) { if (s === drag.el) continue; const r = s.getBoundingClientRect(); if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) { target = s; break; } }
      if (!target) return;
      const before = new Map(sibs.map(s => [s, s.getBoundingClientRect()]));
      const iT = sibs.indexOf(target), iD = sibs.indexOf(drag.el);
      if (iT > iD) target.after(drag.el); else target.before(drag.el);
      sibs.forEach(s => {   // 他の項目はすっと場所を空ける
        if (s === drag.el) return;
        const a = before.get(s), b = s.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top;
        if (dx || dy) s.animate([{ transform:`translate(${dx}px,${dy}px)` }, { transform:'none' }], { duration:220, easing:'cubic-bezier(.2,.8,.2,1)' });
      });
    }
    async function end(x, y, cancelled) {
      const d = drag; drag = null; lastEnd = Date.now(); document.body.classList.remove('dragging');
      if (!d) return;
      let handled = false;
      if (!cancelled && opts.onDrop) handled = await opts.onDrop(d.el, { x, y, ghost:d.ghost, restore:() => { const sibs = [...d.el.parentNode.children].filter(c => c.matches(opts.items)); const ref = sibs.filter(s => s !== d.el)[d.startIndex]; if (ref) ref.before(d.el); else d.el.parentNode.appendChild(d.el); } });
      const r = d.el.getBoundingClientRect();
      if (!handled) {
        const a = d.ghost.animate([{ left:d.ghost.style.left, top:d.ghost.style.top, transform:'scale(1.05)' }, { left:r.left+'px', top:r.top+'px', transform:'scale(1)' }], { duration:200, easing:'cubic-bezier(.2,.8,.2,1)', fill:'forwards' });
        await a.finished.catch(() => {});
      }
      d.ghost.remove(); d.el.classList.remove('dragHole');
      const ids = [...d.el.parentNode.children].filter(c => c.matches(opts.items)).map(c => c.dataset.id);
      if (opts.onEnd) opts.onEnd(ids, d.el);
    }
  }
  return { attach, active:() => !!drag, recent:() => !!drag || Date.now() - lastEnd < 450 };
})();

// ===== 左スワイプで削除（Todo用） =====
function swipeDelete(container, sel, onDelete) {
  container.addEventListener('pointerdown', e => {
    const row = e.target.closest(sel); if (!row || Sortable.active()) return;
    const fg = row.querySelector('.fg'), bg = row.querySelector('.bg');
    const sx = e.clientX, sy = e.clientY; let dx = 0, mode = null;
    const mv = ev => {
      const ddx = ev.clientX - sx, ddy = ev.clientY - sy;
      if (!mode) { if (Math.abs(ddx) > 10 && Math.abs(ddx) > Math.abs(ddy) * 1.3) mode = 'swipe'; else if (Math.abs(ddy) > 10) mode = 'scroll'; }
      if (mode !== 'swipe' || Sortable.active()) return;
      dx = Math.min(0, ddx); row.classList.add('swiping');
      fg.style.transform = `translateX(${dx}px)`; bg.style.opacity = Math.min(1, -dx / 80);
    };
    const up = () => {
      removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      row.classList.remove('swiping');
      if (mode === 'swipe') {
        row._swiped = true; setTimeout(() => row._swiped = false, 50);
        if (dx < -90) { fg.style.transform = 'translateX(-110%)'; setTimeout(() => onDelete(row.dataset.id, row), 180); }
        else { fg.style.transform = ''; bg.style.opacity = 0; }
      }
    };
    addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  });
}

// ===== 写真を小さくして保存用の文字列に =====
async function shrinkPhoto(file, max = 900, q = 0.82) {
  const url = URL.createObjectURL(file);
  try {
    const im = await new Promise((ok, ng) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ng; i.src = url; });
    const s = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', q);
  } finally { URL.revokeObjectURL(url); }
}
App.modules.push({ init:() => Editor.init() });
