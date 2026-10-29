// Kani Favorite — Todo（ホシノ）
'use strict';
const Todo = (() => {
  let items = [], list = 'do', showDone = false;
  const head = () => $('todoHead'), box = () => $('todoList');
  const REP = { none:'', daily:'毎日', weekly:'毎週', monthly:'毎月' };
  const THEME = { '--accent':'#f28cb1', '--title':'#e7779f', '--soft':'#fff0f5', '--line':'#f6dbe5' };

  async function load() {
    items = await DB.all('todos');
    // 完了して30日たったものは片づける
    const lim = Date.now() - 30 * 86400000, old = items.filter(t => t.done && t.doneAt < lim);
    for (const t of old) await DB.del('todos', t.id);
    items = items.filter(t => !old.includes(t));
    render();
  }
  const open = l => items.filter(t => t.list === l && !t.done);
  function group(t) {
    if (!t.due) return 'any';
    const d = D.diff(t.due, D.today());
    return d < 0 ? 'over' : d === 0 ? 'today' : d === 1 ? 'tomorrow' : 'later';
  }
  const GROUPS = [['over', '期限切れ'], ['today', '今日'], ['tomorrow', '明日'], ['later', 'これから'], ['any', 'いつでも']];
  function dueLabel(t) {
    if (!t.due) return '';
    const d = D.diff(t.due, D.today());
    if (d < 0) return `<span class="late">${-d}日すぎてる</span>`;
    if (d === 0) return '今日'; if (d === 1) return '明日';
    if (d < 7) return `${D.md(t.due)}（${D.dow(t.due)}）`;
    return D.md(t.due);
  }
  function row(t) {
    const sub = [];
    if (t.list === 'do' && t.due && !t.done) sub.push(dueLabel(t));
    if (t.repeat && t.repeat !== 'none') sub.push(`↻ ${REP[t.repeat]}`);
    if (t.memo) sub.push('<span class="mute">メモあり</span>');
    if (t.done) sub.push(`<span class="mute">${D.md(D.key(new Date(t.doneAt)))} 完了</span>`);
    return `<div class="trow${t.done ? ' checked' : ''}" data-id="${t.id}"><div class="bg">削除</div><div class="fg"><button class="chk" aria-label="完了"></button>
      <div class="tt"><div class="tl">${esc(t.title)}</div>${sub.length ? `<div class="ts">${sub.join('')}</div>` : ''}</div></div></div>`;
  }
  const byOrder = (a, b) => (a.order || 0) - (b.order || 0) || a.createdAt - b.createdAt;
  function render() {
    const nDo = open('do').length, nTh = open('think').length;
    head().innerHTML = `<div class="seg"><button data-l="do" class="${list === 'do' ? 'on' : ''}">やる<span class="n">${nDo || ''}</span></button><button data-l="think" class="${list === 'think' ? 'on' : ''}">考える<span class="n">${nTh || ''}</span></button></div>`;
    head().querySelectorAll('button').forEach(b => b.onclick = () => { list = b.dataset.l; render(); box().scrollTop = 0; });
    const cur = open(list).sort(byOrder);
    let html = '';
    if (!cur.length) html += list === 'do' ? '<div class="empty"><img class="emc" src="hoshino_chibi.webp" alt="">やることは、ぜんぶおしまい。<br>のんびりしよ〜</div>' : '<div class="empty"><img class="emc" src="m_hoshino_notice.webp" alt="">考えごとは、ここに置いておこう。<br>＋から追加できるよ</div>';
    else if (list === 'do') {
      GROUPS.forEach(([g, label]) => {
        const gs = cur.filter(t => group(t) === g); if (!gs.length) return;
        html += `<div class="grp${g === 'over' ? ' over' : ''}" data-g="${g}"><div class="sec">${label}<span class="n">${gs.length}</span></div>${gs.map(row).join('')}</div>`;
      });
    } else html += `<div class="grp" data-g="all">${cur.map(row).join('')}</div>`;
    const done = items.filter(t => t.list === list && t.done).sort((a, b) => b.doneAt - a.doneAt);
    if (done.length) html += `<button class="doneToggle${showDone ? ' open' : ''}"><i>›</i>完了（${done.length}）</button>${showDone ? `<div class="doneList">${done.map(row).join('')}</div>` : ''}`;
    box().innerHTML = html;
    const tg = box().querySelector('.doneToggle'); if (tg) tg.onclick = () => { showDone = !showDone; render(); };
  }

  // 完了／未完了
  async function toggle(id, rowEl) {
    const t = items.find(x => x.id === id); if (!t) return;
    if (!t.done) {
      rowEl.classList.add('checked'); haptic();
      t.done = true; t.doneAt = Date.now();
      if (typeof Battle !== 'undefined') Battle.gainAP('todo:' + t.id, 10);   // 実戦のAP回復
      let next = null;
      if (t.repeat && t.repeat !== 'none') {   // 繰り返し：次の分をつくる
        const base = t.due && D.diff(t.due, D.today()) >= 0 ? t.due : D.today();
        const due = t.repeat === 'daily' ? D.add(base, 1) : t.repeat === 'weekly' ? D.add(base, 7) : D.addMonth(base, 1);
        next = Object.assign({}, t, { id:newId(), done:false, doneAt:null, due, createdAt:Date.now() });
        t.repeat = 'none';
        items.push(next); await DB.put('todos', next);
      }
      await DB.put('todos', t);
      setTimeout(() => { rowEl.style.maxHeight = rowEl.offsetHeight + 'px'; requestAnimationFrame(() => rowEl.classList.add('leaving')); }, 380);
      setTimeout(render, 760);
      Snack.show(next ? `完了！ 次は ${D.md(next.due)}` : '完了しました', '元に戻す', async () => {
        t.done = false; t.doneAt = null; if (next) { t.repeat = next.repeat; items = items.filter(x => x !== next); await DB.del('todos', next.id); }
        await DB.put('todos', t); render();
      });
      checkAllClear(t);
    } else {
      t.done = false; t.doneAt = null; await DB.put('todos', t); render();
    }
  }
  // 今日のぶんを全部終えたら、ホシノの見せ場（1日1回）
  function checkAllClear(t) {
    if (t.list !== 'do') return;
    const left = open('do').filter(x => x.due && D.diff(x.due, D.today()) <= 0);
    const wasToday = t.due && D.diff(t.due, D.today()) <= 0;
    if (!left.length && wasToday && LS.get('kf-allclear') !== D.today()) {
      LS.set('kf-allclear', D.today());
      setTimeout(() => { toast('今日のやること、ぜんぶクリア！', 1800); Motion.play('hoshino', 'allclear'); }, 700);
    }
  }
  async function remove(id) {
    const t = items.find(x => x.id === id); if (!t) return;
    items = items.filter(x => x !== t); await DB.del('todos', id); render();
    Snack.show('削除しました', '元に戻す', async () => { items.push(t); await DB.put('todos', t); render(); });
  }

  // 追加・編集
  function edit(t) {
    const isNew = !t;
    t = t || { list, title:'', memo:'', due:list === 'do' ? '' : '', repeat:'none' };
    const body = h('<div></div>');
    const fTitle = F.text('やること', t.title, list === 'think' ? '考えたいこと' : '例：家賃の振込');
    const fList = F.seg('リスト', [['do', 'やる'], ['think', '考える']], t.list);
    const fDue = F.date('期限', t.due);
    const fRep = F.seg('繰り返し', [['none', 'なし'], ['daily', '毎日'], ['weekly', '毎週'], ['monthly', '毎月']], t.repeat || 'none');
    const fMemo = F.area('メモ', t.memo, '細かいことはここに');
    const sync = v => { fDue.el.style.display = fRep.el.style.display = v === 'do' ? '' : 'none'; };
    fList.onChange = sync; sync(t.list);
    [fTitle, fList, fDue, fRep, fMemo].forEach(f => body.appendChild(f.el));
    if (isNew) fTitle.input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('ed').querySelector('.save').click(); } });
    Editor.open({
      title:isNew ? 'やることを追加' : '編集', body, theme:THEME, focus:isNew ? fTitle.input : null,
      save:async () => {
        const title = fTitle.get(); if (!title) { fTitle.input.classList.add('shake'); setTimeout(() => fTitle.input.classList.remove('shake'), 400); return false; }
        const l = fList.get();
        let due = l === 'do' ? fDue.get() : '', repeat = l === 'do' ? fRep.get() : 'none';
        if (repeat !== 'none' && !due) due = D.today();
        const obj = Object.assign({}, t, { title, list:l, due, repeat, memo:fMemo.get() });
        if (isNew) Object.assign(obj, { id:newId(), done:false, doneAt:null, createdAt:Date.now(), order:Math.max(0, ...items.filter(x => x.list === l).map(x => x.order || 0)) + 1 });
        const i = items.findIndex(x => x.id === obj.id); if (i >= 0) items[i] = obj; else items.push(obj);
        await DB.put('todos', obj);
        if (l !== list) { list = l; }
        render(); return true;
      },
      del:isNew ? null : () => remove(t.id),
    });
  }

  function init() {
    $('todoAdd').onclick = () => edit(null);
    box().addEventListener('click', e => {
      if (Sortable.recent()) return;
      const r = e.target.closest('.trow'); if (!r || r._swiped) return;
      if (e.target.closest('.chk')) return toggle(r.dataset.id, r);
      const t = items.find(x => x.id === r.dataset.id); if (t) edit(t);
    });
    swipeDelete(box(), '.trow', id => remove(id));
    Sortable.attach(box(), {
      items:'.grp > .trow',
      onEnd:async ids => {   // 同じまとまりの中で並べ替え
        ids.forEach((id, i) => { const t = items.find(x => x.id === id); if (t) t.order = i; });
        await DB.putMany('todos', items.filter(t => ids.includes(t.id)));
      },
    });
    TabHooks.todo = { enter:() => { Motion.preload('hoshino'); render(); } };
    load();
  }
  return { init, reload:load };
})();
App.modules.push(Todo);
