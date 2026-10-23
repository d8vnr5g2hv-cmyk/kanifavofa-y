// Kani Favorite — Profile（マリー）：記念日・人物・自由なセクション
'use strict';
const Profile = (() => {
  let items = [];
  const head = () => $('profHead'), box = () => $('profList');
  const THEME = { '--accent':'#f59bb8', '--title':'#ef86a9', '--soft':'#fffaf0', '--line':'#f3e3b0' };
  const AV = ['#f59bb8', '#f7b267', '#8fc9e8', '#a8d58f', '#c6a7e8', '#f28c8c'];
  const byOrder = (a, b) => (a.order || 0) - (b.order || 0) || a.createdAt - b.createdAt;
  const kind = k => items.filter(x => x.kind === k).sort(byOrder);
  const nextOrder = k => Math.max(0, ...kind(k).map(x => x.order || 0)) + 1;

  async function load() { items = await DB.all('profile'); render(); }

  // 次に来る日（毎年）までの日数
  function untilYearly(date) {
    const t = D.today(), [ , m, d] = date.split('-').map(Number), y = +t.slice(0, 4);
    let k = `${y}-${p2(m)}-${p2(Math.min(d, new Date(y, m, 0).getDate()))}`;
    if (D.diff(k, t) < 0) k = `${y + 1}-${p2(m)}-${p2(Math.min(d, new Date(y + 1, m, 0).getDate()))}`;
    return { days:D.diff(k, t), years:+k.slice(0, 4) - +date.slice(0, 4) };
  }
  function annivInfo(a) {
    if (a.mode === 'count') {
      const n = D.diff(D.today(), a.date) + 1, u = untilYearly(a.date);
      const today = u.days === 0 && u.years > 0 ? `${u.years}周年` : n > 1 && (n - 1) % 100 === 0 ? `${n - 1}日記念` : null;
      return { num:n > 0 ? `${n.toLocaleString()}` : `あと${-n + 1}`, unit:n > 0 ? '日目' : '日で開始', today, soon:u.days === 1 && u.years > 0 };
    }
    const u = untilYearly(a.date);
    return { num:u.days === 0 ? '今日！' : `あと${u.days}`, unit:u.days === 0 ? (u.years > 0 ? `${u.years}周年` : '') : `日${u.years > 0 ? `・${u.years}周年` : ''}`, today:u.days === 0, soon:u.days === 1 };
  }
  function events() {   // 今日・明日のできごと
    const out = [];
    kind('anniv').forEach(a => {
      const i = annivInfo(a), u = untilYearly(a.date);
      if (i.today) out.push({ when:0, text:a.mode === 'count' ? `「${a.title}」から${i.today}です` : `${a.title}です` });
      else if (i.soon) out.push({ when:1, text:a.mode === 'count' ? `「${a.title}」から${u.years}周年です` : `${a.title}です` });
    });
    kind('person').forEach(p => { if (!p.birthday) return; const u = untilYearly(p.birthday); if (u.days <= 1) out.push({ when:u.days, text:`${p.name}の誕生日です` }); });
    return out;
  }
  function render() {
    const ev = events(), an = kind('anniv'), pe = kind('person'), se = kind('section');
    let html = '';
    ev.filter(e => e.when === 0).forEach(e => html += `<div class="today"><span class="em">🎉</span><div>今日は${esc(e.text)}<small>おめでとうございます</small></div></div>`);
    ev.filter(e => e.when === 1).forEach(e => html += `<div class="today soon"><span class="em">🔔</span><div>明日は${esc(e.text)}</div></div>`);
    if (an.length) html += `<div class="pblock"><div class="sec">ANNIVERSARY</div><div class="lst" data-k="anniv">${an.map(a => {
      const i = annivInfo(a);
      return `<div class="anv${i.today ? ' isToday' : ''}" data-id="${a.id}"><div class="ic">${a.mode === 'count' ? '♡' : '★'}</div><div class="tx">${esc(a.title)}<small>${D.ymd(a.date)}${a.mode === 'count' ? 'から' : '・毎年'}</small></div><div class="num">${i.num}<small>${i.unit}</small></div></div>`;
    }).join('')}</div></div>`;
    if (pe.length) html += `<div class="pblock"><div class="sec">PEOPLE</div><div class="lst" data-k="person">${pe.map(p => {
      let bd = '';
      if (p.birthday) { const u = untilYearly(p.birthday); bd = `${D.md(p.birthday)}<br>${u.days === 0 ? '今日が誕生日！' : `あと${u.days}日`}`; }
      return `<div class="person" data-id="${p.id}"><div class="av" style="background:${AV[hashN(p.name, AV.length)]}">${esc([...p.name][0] || '?')}</div><div class="tx">${esc(p.name)}<small>${esc(p.relation || '')}</small></div><div class="bd">${bd}</div></div>`;
    }).join('')}</div></div>`;
    if (se.length) html += `<div class="lst" data-k="section">${se.map(s => `<div class="pblock sblk" data-id="${s.id}"><div class="sec"><span>${esc(s.title)}</span><button class="ed" aria-label="セクションを編集">…</button></div>
      <div class="pcard" data-sid="${s.id}">${(s.rows || []).map(r => `<div class="prow" data-rid="${r.id}"><span class="k">${esc(r.label)}</span><span class="v">${esc(r.value)}</span></div>`).join('')}<div class="prow add" data-add="${s.id}">＋ 項目を追加</div></div></div>`).join('')}</div>`;
    if (!an.length && !pe.length && !se.length) html = (html || '') + '<div class="empty"><b>✿</b>まだ何もありません。<br>＋から、記念日・人物・自分のことを<br>書き足してくださいね</div>';
    box().innerHTML = html;
  }

  // ===== 編集 =====
  async function saveItem(obj) { const i = items.findIndex(x => x.id === obj.id); if (i >= 0) items[i] = obj; else items.push(obj); await DB.put('profile', obj); render(); }
  async function delItem(obj, label) {
    items = items.filter(x => x.id !== obj.id); await DB.del('profile', obj.id); render();
    Snack.show(`${label}を削除しました`, '元に戻す', async () => { items.push(obj); await DB.put('profile', obj); render(); });
  }
  const shakeIf = (f, ok) => { if (ok) return true; f.input.classList.add('shake'); setTimeout(() => f.input.classList.remove('shake'), 400); return false; };
  function editAnniv(a) {
    const isNew = !a; a = a || { title:'', date:'', mode:'count' };
    const fT = F.text('タイトル', a.title, '例：付き合った日'), fD = F.date('日付', a.date, false);
    const fM = F.seg('数え方', [['count', '日数を数える（○日目）'], ['yearly', '毎年の記念日（あと○日）']], a.mode);
    const body = h('<div></div>'); body.append(fT.el, fD.el, fM.el);
    Editor.open({ title:isNew ? '記念日を追加' : '記念日を編集', body, theme:THEME, focus:isNew ? fT.input : null,
      save:async () => { if (!shakeIf(fT, fT.get()) || !shakeIf(fD, fD.get())) return false;
        await saveItem(Object.assign({}, a, { kind:'anniv', title:fT.get(), date:fD.get(), mode:fM.get() }, isNew ? { id:newId(), createdAt:Date.now(), order:nextOrder('anniv') } : {})); },
      del:isNew ? null : () => delItem(a, '記念日') });
  }
  function editPerson(p) {
    const isNew = !p; p = p || { name:'', relation:'', birthday:'', memo:'' };
    const fN = F.text('名前', p.name, '例：山下さん'), fR = F.text('関係', p.relation, '例：SCSK時代の同僚'), fB = F.date('誕生日', p.birthday, false), fM = F.area('メモ', p.memo, '好きなもの、話したことなど');
    const body = h('<div></div>'); body.append(fN.el, fR.el, fB.el, fM.el);
    body.appendChild(h('<p class="hint">誕生日を入れておくと、前の日と当日にお知らせします。</p>'));
    Editor.open({ title:isNew ? '人物を追加' : '人物を編集', body, theme:THEME, focus:isNew ? fN.input : null,
      save:async () => { if (!shakeIf(fN, fN.get())) return false;
        await saveItem(Object.assign({}, p, { kind:'person', name:fN.get(), relation:fR.get(), birthday:fB.get(), memo:fM.get() }, isNew ? { id:newId(), createdAt:Date.now(), order:nextOrder('person') } : {})); },
      del:isNew ? null : () => delItem(p, '人物') });
  }
  function editSection(s) {
    const isNew = !s; s = s || { title:'', rows:[] };
    const fT = F.text('セクション名', s.title, '例：BASIC、WORK、LIKE');
    const body = h('<div></div>'); body.append(fT.el);
    if (isNew) body.appendChild(h('<p class="hint">作ったあと、「＋ 項目を追加」から中身を書いていけます。</p>'));
    Editor.open({ title:isNew ? 'セクションを追加' : 'セクションを編集', body, theme:THEME, focus:fT.input,
      save:async () => { if (!shakeIf(fT, fT.get())) return false;
        await saveItem(Object.assign({}, s, { kind:'section', title:fT.get() }, isNew ? { id:newId(), createdAt:Date.now(), order:nextOrder('section'), rows:[] } : {})); },
      del:isNew ? null : () => delItem(s, 'セクション'), delLabel:'セクションごと削除する', delConfirm:'このセクションと中の項目を削除しますか？' });
  }
  function editRow(s, r) {
    const isNew = !r; r = r || { label:'', value:'' };
    const fL = F.text('項目名', r.label, '例：呼び名'), fV = F.area('内容', r.value, '例：カニナベ');
    const body = h('<div></div>'); body.append(fL.el, fV.el);
    Editor.open({ title:isNew ? `${s.title}に追加` : '項目を編集', body, theme:THEME, focus:isNew ? fL.input : null,
      save:async () => { if (!shakeIf(fL, fL.get())) return false;
        const rows = (s.rows || []).slice(), nr = Object.assign({}, r, { label:fL.get(), value:fV.get() }, isNew ? { id:newId() } : {});
        const i = rows.findIndex(x => x.id === nr.id); if (i >= 0) rows[i] = nr; else rows.push(nr);
        await saveItem(Object.assign({}, s, { rows })); },
      del:isNew ? null : async () => { await saveItem(Object.assign({}, s, { rows:s.rows.filter(x => x.id !== r.id) })); } });
  }

  // 記念日の当日：マリーのお祝い（1日1回）
  function celebrate() {
    const ev = events().filter(e => e.when === 0); if (!ev.length) return;
    if (LS.get('kf-anniv') === D.today()) return;
    LS.set('kf-anniv', D.today());
    setTimeout(() => Motion.play('mari', 'anniv'), 500);
  }
  function init() {
    $('profAdd').onclick = () => Menu.open('何を追加しますか？', [
      { label:'記念日', sub:'付き合った日、誕生日など。○日目／あと○日を表示', fn:() => editAnniv(null) },
      { label:'人物', sub:'名前・関係・誕生日・メモ', fn:() => editPerson(null) },
      { label:'セクション', sub:'BASIC・WORKのように、自分のことをまとめる', fn:() => editSection(null) },
    ]);
    box().addEventListener('click', e => {
      if (Sortable.recent()) return;
      const t = e.target, get = id => items.find(x => x.id === id);
      let el;
      if ((el = t.closest('.ed'))) return editSection(get(el.closest('.sblk').dataset.id));
      if ((el = t.closest('[data-add]'))) return editRow(get(el.dataset.add));
      if ((el = t.closest('.prow[data-rid]'))) { const s = get(el.closest('.pcard').dataset.sid); return editRow(s, s.rows.find(r => r.id === el.dataset.rid)); }
      if ((el = t.closest('.anv'))) return editAnniv(get(el.dataset.id));
      if ((el = t.closest('.person'))) return editPerson(get(el.dataset.id));
    });
    // 長押しで並べ替え：記念日・人物・セクション・セクションの中の項目
    const reorder = async ids => { ids.forEach((id, i) => { const x = items.find(y => y.id === id); if (x) x.order = i; }); await DB.putMany('profile', items.filter(x => ids.includes(x.id))); };
    Sortable.attach(box(), { items:'.lst > .anv, .lst > .person', onEnd:reorder });
    Sortable.attach(box(), { items:'.lst > .sblk', canStart:(el, e) => !!e.target.closest('.sec'), onEnd:reorder });
    Sortable.attach(box(), { items:'.pcard > .prow[data-rid]', onEnd:async (ids, el) => {
      const s = items.find(x => x.id === el.closest('.pcard').dataset.sid);
      s.rows = ids.map(id => s.rows.find(r => r.id === id)).filter(Boolean); await DB.put('profile', s);
    } });
    TabHooks.profile = { enter:() => { Motion.preload('mari'); render(); celebrate(); } };
    load();
  }
  return { init, reload:load };
})();
App.modules.push(Profile);
