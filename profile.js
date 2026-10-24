// Kani Favorite — Profile（マリー）：記念日・人物の分析ブック・自分のプロフィール帳
'use strict';
const Profile = (() => {
  let items = [];
  const box = () => $('profList');
  const THEME = { '--accent':'#f59bb8', '--title':'#ef86a9', '--soft':'#fffaf0', '--line':'#f3e3b0' };
  const AV = ['#f59bb8', '#f7b267', '#8fc9e8', '#a8d58f', '#c6a7e8', '#f28c8c'];
  const byOrder = (a, b) => (a.order || 0) - (b.order || 0) || a.createdAt - b.createdAt;
  const kind = k => items.filter(x => x.kind === k).sort(byOrder);
  const nextOrder = k => Math.max(0, ...kind(k).map(x => x.order || 0)) + 1;
  const me = () => items.find(x => x.id === 'me') || { id:'me', kind:'me', f:{}, rate:{}, custom:[] };

  // ===== 項目の定義 =====
  // type：text／area／date／num（単位つき）／tags（読点・カンマ区切り）／seg（選択）／money（ぼかし表示）
  const ME_GROUPS = [
    ['BASIC', [['name', '名前', 'text'], ['nick', '呼び名', 'text'], ['birthday', '誕生日', 'date'], ['from', '出身', 'text'], ['live', '住んでいるところ', 'text'],
               ['height', '身長', 'num', 'cm'], ['blood', '血液型', 'seg', ['A', 'B', 'O', 'AB', '不明']]]],
    ['WORK', [['job', '仕事', 'text'], ['org', '会社・部署', 'text'], ['income', '月収', 'money'], ['goal', '将来の目標', 'area']]],
    ['PERSONALITY', [['one', '性格をひとことで', 'text'], ['good', '長所', 'tags'], ['fix', '直したいところ', 'tags'], ['value', '大事にしていること', 'area'],
                     ['weak', '苦手なもの・人', 'area'], ['relief', 'ストレス解消法', 'text']]],
    ['LOOKS', [['looks', '外見の特徴', 'area'], ['fashion', '好きなファッション', 'text']]],
    ['LIKE', [['hobby', '趣味', 'tags'], ['food', '好きな食べ物', 'text'], ['fav', '好きな作品・キャラ', 'area']]],
  ];
  const ME_RATE = [['stamina', '体力'], ['focus', '集中力'], ['social', '社交性'], ['plan', '計画性'], ['keep', '継続力'], ['self', '自己肯定感', '自己肯定']];
  const P_GROUPS = [
    ['BASIC', [['relation', '関係', 'text'], ['birthday', '誕生日', 'date'], ['met', '出会ったきっかけ', 'area'], ['height', 'だいたいの身長', 'num', 'cm'], ['age', 'だいたいの年齢', 'num', '歳']]],
    ['私からの評価', [['one', 'ひとことで言うと', 'text'], ['impression', '性格の印象', 'area'], ['likes', '好きなところ', 'tags'], ['dislikes', '苦手なところ', 'tags']]],
    ['つきあい', [['together', 'よく一緒にすること', 'text'], ['lastMet', '最後に会った日', 'date'], ['next', '次に話したいこと', 'area'], ['gift', '好きなもの・苦手なもの', 'area']]],
    ['メモ', [['memo', 'メモ', 'area']]],
  ];
  const P_RATE = [['trust', '信頼度', '信頼'], ['talk', '話しやすさ', '話しやすさ'], ['rely', '頼りになる', '頼れる'], ['fun', '一緒にいて楽しい', '楽しい'], ['values', '価値観の近さ', '価値観'], ['again', 'また会いたい', '会いたい']];   // 3つ目はグラフ用の短い名前

  async function load() { items = await DB.all('profile'); render(); }

  // 次に来る日（毎年）までの日数
  function untilYearly(date) {
    const t = D.today(), [ , m, d] = date.split('-').map(Number), y = +t.slice(0, 4);
    let k = `${y}-${p2(m)}-${p2(Math.min(d, new Date(y, m, 0).getDate()))}`;
    if (D.diff(k, t) < 0) k = `${y + 1}-${p2(m)}-${p2(Math.min(d, new Date(y + 1, m, 0).getDate()))}`;
    return { days:D.diff(k, t), years:+k.slice(0, 4) - +date.slice(0, 4) };
  }
  const ageOf = b => { if (!b) return null; const t = D.today(); let a = +t.slice(0, 4) - +b.slice(0, 4); if (t.slice(5) < b.slice(5)) a--; return a; };
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
    const m = me(); if (m.f.birthday) { const u = untilYearly(m.f.birthday); if (u.days <= 1) out.push({ when:u.days, text:'先生の誕生日です' }); }
    return out;
  }
  const stars = (n, max = 5) => `<span class="stars">${'★'.repeat(n || 0)}<i>${'★'.repeat(max - (n || 0))}</i></span>`;
  // レーダーチャート（1〜5）
  function radar(defs, vals, size = 150, color = '#f59bb8') {
    const n = defs.length, c = size / 2, R = size / 2 - (size < 150 ? 24 : 26);
    const pt = (i, r) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [c + Math.cos(a) * r, c + Math.sin(a) * r]; };
    let g = '';
    for (let k = 1; k <= 5; k++) g += `<polygon points="${defs.map((d, i) => pt(i, R * k / 5).join(',')).join(' ')}" class="rg${k === 5 ? ' o' : ''}"/>`;
    defs.forEach((d, i) => { const [x, y] = pt(i, R); g += `<line x1="${c}" y1="${c}" x2="${x}" y2="${y}" class="rl"/>`; });
    const any = defs.some(([k]) => vals[k]);
    if (any) g += `<polygon points="${defs.map(([k], i) => pt(i, R * (vals[k] || 0) / 5).join(',')).join(' ')}" class="rv" style="fill:${color};stroke:${color}"/>`;
    defs.forEach(([k, l, sh], i) => { const [x, y] = pt(i, R + 13); g += `<text x="${x}" y="${y}" class="rt">${sh || l}</text>`; });
    return `<svg class="radar" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${g}</svg>`;
  }

  // ===== 一覧 =====
  function render() {
    const ev = events(), an = kind('anniv'), pe = kind('person'), m = me();
    let html = '';
    ev.filter(e => e.when === 0).forEach(e => html += `<div class="today"><span class="em">🎉</span><div>今日は${esc(e.text)}<small>おめでとうございます</small></div></div>`);
    ev.filter(e => e.when === 1).forEach(e => html += `<div class="today soon"><span class="em">🔔</span><div>明日は${esc(e.text)}</div></div>`);
    if (an.length) html += `<div class="pblock"><div class="sec">ANNIVERSARY</div><div class="lst" data-k="anniv">${an.map(a => {
      const i = annivInfo(a);
      return `<div class="anv${i.today ? ' isToday' : ''}" data-id="${a.id}"><div class="ic">${a.mode === 'count' ? '♡' : '★'}</div><div class="tx">${esc(a.title)}<small>${D.ymd(a.date)}${a.mode === 'count' ? 'から' : '・毎年'}</small></div><div class="num">${i.num}<small>${i.unit}</small></div></div>`;
    }).join('')}</div></div>`;
    if (pe.length) html += `<div class="pblock"><div class="sec">PEOPLE</div><div class="lst" data-k="person">${pe.map(p => {
      const r = p.rate || {}, sub = [];
      if (p.relation) sub.push(esc(p.relation));
      if (p.lastMet) { const d = D.diff(D.today(), p.lastMet); sub.push(d <= 0 ? '今日会った' : `${d}日前に会った`); }
      let bd = '';
      if (p.birthday) { const u = untilYearly(p.birthday); bd = `<em>${u.days === 0 ? '今日が誕生日！' : `誕生日まで${u.days}日`}</em>`; }
      return `<div class="person" data-id="${p.id}"><div class="av" style="background:${AV[hashN(p.name, AV.length)]}">${esc([...p.name][0] || '?')}</div>
        <div class="tx">${esc(p.name)}<small>${sub.join('・')}</small></div><div class="bd">${r.trust ? stars(r.trust) : '<span class="nos">未評価</span>'}${bd}</div></div>`;
    }).join('')}</div></div>`;
    // MY PROFILE（要約カード）
    const f = m.f || {}, age = ageOf(f.birthday), filled = ME_GROUPS.flatMap(g => g[1]).filter(([k]) => f[k] && String(f[k]).length).length, total = ME_GROUPS.flatMap(g => g[1]).length;
    html += `<div class="pblock"><div class="sec">MY PROFILE</div><div class="mycard" id="myCard">
      <div class="mytop"><div class="myav">${esc([...(f.nick || f.name || '先')][0])}</div><div class="myname"><b>${esc(f.nick || f.name || 'じぶん')}</b><span>${[age != null ? `${age}歳` : '', f.job || ''].filter(Boolean).map(esc).join('・') || 'タップして書きはじめる'}</span>
        ${f.one ? `<i>「${esc(f.one)}」</i>` : ''}</div></div>
      <div class="mymid">${radar(ME_RATE, m.rate || {}, 128, '#f59bb8')}<div class="myfill"><small>記入</small><b>${filled}<span>/${total}</span></b><div class="bar"><i style="width:${filled / total * 100}%"></i></div>
        ${(f.good || []).length ? `<div class="chips">${f.good.slice(0, 3).map(t => `<span>${esc(t)}</span>`).join('')}</div>` : ''}</div></div></div></div>`;
    if (!an.length && !pe.length) html += '<p class="phint">＋から、記念日や人物を追加できます</p>';
    box().innerHTML = html;
  }

  // ===== 分析ブック（自分・人物） =====
  let bookEl = null, bookOf = null;
  function fieldVal(def, v, isMe) {
    const [k, l, t, u] = def;
    if (v == null || v === '' || (Array.isArray(v) && !v.length)) return '<span class="emp">未記入</span>';
    if (t === 'tags') return `<div class="chips">${v.map(x => `<span>${esc(x)}</span>`).join('')}</div>`;
    if (t === 'date') {
      const extra = k === 'birthday' ? (() => { const a = ageOf(v); return a != null && isMe ? `（${a}歳）` : ''; })() : k === 'lastMet' ? (() => { const d = D.diff(D.today(), v); return d <= 0 ? '（今日）' : `（${d}日前）`; })() : '';
      return `${D.ymd(v)}<small>${extra}</small>`;
    }
    if (t === 'num') return `${isMe ? '' : 'だいたい '}${esc(v)}<small>${u || ''}</small>`;
    if (t === 'money') return `<span class="blur" data-blur>¥${Number(v).toLocaleString()}</span><small class="tapc">タップで表示</small>`;
    return esc(v).replace(/\n/g, '<br>');
  }
  function openBook(target) {
    bookOf = target;
    const isMe = target === 'me', obj = isMe ? me() : items.find(x => x.id === target); if (!obj) return;
    const data = isMe ? (obj.f || {}) : obj, groups = isMe ? ME_GROUPS : P_GROUPS, rates = isMe ? ME_RATE : P_RATE, rate = obj.rate || {};
    const color = isMe ? '#f59bb8' : AV[hashN(obj.name, AV.length)];
    const title = isMe ? (data.nick || data.name || 'じぶん') : obj.name;
    const html = `<div class="bk-in"><div class="bk-hd"><button class="bk-x" data-x="close">‹</button><div class="bk-tt"><small>${isMe ? 'MY PROFILE' : 'PEOPLE NOTE'}</small><b>${esc(title)}</b></div>
        ${isMe ? '' : '<button class="bk-ed" data-x="edit">名前</button>'}</div>
      <div class="bk-body">
        <div class="bk-cover" style="--c:${color}"><div class="bk-av">${esc([...(title || '?')][0])}</div>
          <div class="bk-cv"><b>${esc(title)}</b>${isMe ? `<span>${[ageOf(data.birthday) != null ? ageOf(data.birthday) + '歳' : '', data.job || ''].filter(Boolean).map(esc).join('・')}</span>` : `<span>${esc(obj.relation || '')}</span>${rate.trust ? `<div>信頼度 ${stars(rate.trust)}</div>` : ''}`}
          ${data.one ? `<i>「${esc(data.one)}」</i>` : ''}</div></div>
        <div class="bk-sec rate" data-rate="1"><h5>${isMe ? '自己評価' : '私からの評価（1〜5）'}<em>タップで評価</em></h5>
          <div class="bk-rate">${radar(rates, rate, 190, color)}<div class="bk-rl">${rates.map(([k, l]) => `<div><span>${l}</span>${stars(rate[k])}</div>`).join('')}</div></div></div>
        ${groups.map(([g, defs]) => `<div class="bk-sec"><h5>${g}</h5>${defs.map(d => `<div class="bk-f ${d[2] === 'area' || d[2] === 'tags' ? 'wide' : ''}" data-f="${d[0]}"><span class="k">${d[1]}</span><div class="v">${fieldVal(d, data[d[0]], isMe)}</div></div>`).join('')}</div>`).join('')}
        ${isMe ? `<div class="bk-sec"><h5>FREE<em>自分で足した項目</em></h5>${(obj.custom || []).map(c => `<div class="bk-f wide" data-c="${c.id}"><span class="k">${esc(c.label)}</span><div class="v">${esc(c.value || '').replace(/\n/g, '<br>') || '<span class="emp">未記入</span>'}</div></div>`).join('')}<button class="bk-add" data-x="addc">＋ 項目を足す</button></div>` : ''}
        ${isMe ? '' : '<button class="bk-del" data-x="del">この人を削除する</button>'}
      </div></div>`;
    if (!bookEl) { bookEl = h('<div id="pbook"></div>'); document.body.appendChild(bookEl); bookEl.addEventListener('click', bookClick); }
    const sc = bookEl.querySelector('.bk-body'), top = sc ? sc.scrollTop : 0, was = bookEl.classList.contains('show');
    bookEl.innerHTML = html; bookEl.classList.add('show');
    if (was) bookEl.querySelector('.bk-body').scrollTop = top;
  }
  function closeBook() { if (!bookEl) return; bookEl.classList.remove('show'); bookOf = null; render(); }
  async function bookClick(e) {
    const t = e.target;
    const b = t.closest('[data-blur]'); if (b) { b.classList.toggle('show'); return; }
    const x = t.closest('[data-x]');
    if (x) {
      const k = x.dataset.x;
      if (k === 'close') return closeBook();
      if (k === 'edit') return editPersonName(items.find(i => i.id === bookOf));
      if (k === 'addc') return editCustom(null);
      if (k === 'del') { const p = items.find(i => i.id === bookOf); if (!confirm(`${p.name}を削除しますか？`)) return; closeBook(); return delItem(p, '人物'); }
    }
    if (t.closest('[data-rate]')) return editRate();
    const c = t.closest('[data-c]'); if (c) return editCustom(me().custom.find(x => x.id === c.dataset.c));
    const f = t.closest('[data-f]'); if (f) return editField(f.dataset.f);
  }
  function defOf(k) { return (bookOf === 'me' ? ME_GROUPS : P_GROUPS).flatMap(g => g[1]).find(d => d[0] === k); }
  function editField(k) {
    const isMe = bookOf === 'me', obj = isMe ? me() : items.find(x => x.id === bookOf), data = isMe ? (obj.f || {}) : obj;
    const d = defOf(k), [, label, type, extra] = d, cur = data[k];
    const body = h('<div></div>');
    let get, focus = null;
    if (type === 'date') { const f = F.date(label, cur, false); body.append(f.el); get = f.get; }
    else if (type === 'area') { const f = F.area(label, cur); body.append(f.el); get = f.get; focus = f.input; }
    else if (type === 'seg') { const f = F.seg(label, extra.map(v => [v, v]), cur || ''); body.append(f.el); get = f.get; }
    else if (type === 'tags') { const f = F.area(label, (cur || []).join('、'), '「、」や改行で区切ると、タグになります'); body.append(f.el); focus = f.input; get = () => f.get().split(/[、,，\n]+/).map(s => s.trim()).filter(Boolean); }
    else { const num = type === 'num' || type === 'money'; const f = F.text(label + (type === 'num' ? `（${extra}）` : type === 'money' ? '（円）' : ''), cur, '', num ? 'number' : 'text'); if (num) f.input.inputMode = 'numeric'; body.append(f.el); focus = f.input; get = f.get; }
    if (type === 'money') body.appendChild(h('<p class="hint">一覧では、タップするまでぼかして表示します。</p>'));
    if (!isMe && (type === 'num')) body.appendChild(h('<p class="hint">「だいたい」でOKです。</p>'));
    Editor.open({ title:label, body, theme:THEME, focus,
      save:async () => {
        let v = get(); if (type === 'num' || type === 'money') v = v === '' ? '' : String(v).replace(/[^\d.]/g, '');
        if (isMe) { obj.f = Object.assign({}, obj.f, { [k]:v }); await saveItem(obj); } else await saveItem(Object.assign({}, obj, { [k]:v }));
        openBook(bookOf);
      } });
  }
  function editRate() {
    const isMe = bookOf === 'me', obj = isMe ? me() : items.find(x => x.id === bookOf), rates = isMe ? ME_RATE : P_RATE, cur = obj.rate || {};
    const body = h('<div class="rateEd"></div>'), fs = {};
    rates.forEach(([k, l]) => { const f = F.seg(l, [1, 2, 3, 4, 5].map(n => [n, '★'.repeat(n)]), cur[k] || 0); fs[k] = f; body.append(f.el); });
    body.appendChild(h(`<p class="hint">${isMe ? '今の自分を、正直に。' : '私から見た、今のその人を。'}あとから何度でも変えられます。</p>`));
    Editor.open({ title:isMe ? '自己評価' : `${obj.name}の評価`, body, theme:THEME,
      save:async () => { const rate = {}; rates.forEach(([k]) => { const v = fs[k].get(); if (v) rate[k] = v; }); await saveItem(Object.assign({}, obj, { rate })); openBook(bookOf); } });
  }
  function editCustom(c) {
    const m = me(), isNew = !c; c = c || { label:'', value:'' };
    const fL = F.text('項目名', c.label, '例：座右の銘'), fV = F.area('内容', c.value);
    const body = h('<div></div>'); body.append(fL.el, fV.el);
    Editor.open({ title:isNew ? '項目を足す' : '項目を編集', body, theme:THEME, focus:isNew ? fL.input : null,
      save:async () => { if (!fL.get()) return false;
        const list = (m.custom || []).slice(), n = Object.assign({}, c, { label:fL.get(), value:fV.get() }, isNew ? { id:newId() } : {});
        const i = list.findIndex(x => x.id === n.id); if (i >= 0) list[i] = n; else list.push(n);
        await saveItem(Object.assign({}, m, { custom:list })); openBook('me'); },
      del:isNew ? null : async () => { await saveItem(Object.assign({}, m, { custom:m.custom.filter(x => x.id !== c.id) })); openBook('me'); } });
  }

  // ===== 編集（記念日・人物） =====
  async function saveItem(obj) { if (obj.id === 'me') obj.kind = 'me'; const i = items.findIndex(x => x.id === obj.id); if (i >= 0) items[i] = obj; else items.push(obj); await DB.put('profile', obj); render(); }
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
  function newPerson() {
    const fN = F.text('名前', '', '例：山下さん'), fR = F.text('関係', '', '例：SCSK時代の同僚');
    const body = h('<div></div>'); body.append(fN.el, fR.el, h('<p class="hint">追加したあと、その人のページで評価や好きなところを書いていけます。</p>'));
    Editor.open({ title:'人物を追加', body, theme:THEME, focus:fN.input,
      save:async () => { if (!shakeIf(fN, fN.get())) return false;
        const p = { id:newId(), kind:'person', name:fN.get(), relation:fR.get(), birthday:'', memo:'', rate:{}, createdAt:Date.now(), order:nextOrder('person') };
        await saveItem(p); setTimeout(() => openBook(p.id), 350); } });
  }
  function editPersonName(p) {
    const fN = F.text('名前', p.name);
    const body = h('<div></div>'); body.append(fN.el);
    Editor.open({ title:'名前を変える', body, theme:THEME, save:async () => { if (!shakeIf(fN, fN.get())) return false; await saveItem(Object.assign({}, p, { name:fN.get() })); openBook(p.id); } });
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
      { label:'人物', sub:'友だち・家族など。私から見たその人を書きためる', fn:() => newPerson() },
      { label:'自分のプロフィール', sub:'MY PROFILEを開く', fn:() => openBook('me') },
    ]);
    box().addEventListener('click', e => {
      if (Sortable.recent()) return;
      const t = e.target, get = id => items.find(x => x.id === id);
      let el;
      if (t.closest('#myCard')) return openBook('me');
      if ((el = t.closest('.anv'))) return editAnniv(get(el.dataset.id));
      if ((el = t.closest('.person'))) return openBook(el.dataset.id);
    });
    // 長押しで並べ替え：記念日・人物
    const reorder = async ids => { ids.forEach((id, i) => { const x = items.find(y => y.id === id); if (x) x.order = i; }); await DB.putMany('profile', items.filter(x => ids.includes(x.id))); };
    Sortable.attach(box(), { items:'.lst > .anv, .lst > .person', onEnd:reorder });
    TabHooks.profile = { enter:() => { Motion.preload('mari'); render(); celebrate(); }, leave:() => { if (bookEl) { bookEl.classList.remove('show'); bookOf = null; } } };
    load();
  }
  return { init, reload:load };
})();
App.modules.push(Profile);
