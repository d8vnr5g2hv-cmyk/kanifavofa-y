// Yohei Support — 秘書室（ホシノ）：まとめ・提案書・予定・Siriからの一言
'use strict';
const addTodo = async (title, due = '', memo = '') => {
  const all = await DB.all('todos').catch(() => []);
  const t = { id:newId(), title:title.slice(0, 60), list:'do', due, repeat:'none', memo, done:false, doneAt:null, createdAt:Date.now(), order:Math.max(0, ...all.filter(x => x.list === 'do').map(x => x.order || 0)) + 1 };
  await DB.put('todos', t); if (typeof Todo !== 'undefined') Todo.reload(); Life.changed('todo'); return t;
};
const addEvent = async (date, title, time = '') => { const e = { id:newId(), date, time, title:title.slice(0, 40), createdAt:Date.now() }; await DB.put('events', e); Life.changed('event'); return e; };

// ===== Siriからの一言（GASにためておいたものを取りこむ） =====
const Inbox = (() => {
  async function pull() {
    if (!(await Api.load())) return 0;
    const r = await Api.call('inbox', {}, 15000).catch(() => null);
    const list = r && r.items || [];
    let memo = 0, sl = 0;
    for (const x of list) {
      if (x.kind === 'sleep') { await Life.setDay(x.date || D.today(), { sleep:{ bed:x.bed, wake:x.wake, auto:true } }); sl++; continue; }   // ヘルスケアの睡眠
      await DB.put('room', { id:'inbox-' + newId(), text:String(x.text || '').slice(0, 200), at:x.at || Date.now(), from:'siri' }); memo++;
    }
    if (memo) toast(`Siriからの一言が${memo}件届いています（秘書室）`, 2600);
    else if (sl) toast('ヘルスケアの睡眠を記録しました（保健室）', 2200);
    if (list.length) Life.changed('inbox');
    return memo;
  }
  const items = async () => (await DB.all('room').catch(() => [])).filter(r => r.id.startsWith('inbox-')).sort((a, b) => a.at - b.at);
  // ざっくり振り分け：お金／予定／買い物／やること
  function guess(t) {
    const yen = t.match(/([\d,]+)\s*円?/), num = yen ? +yen[1].replace(/,/g, '') : 0;
    if (/財布|手元/.test(t) && num) return { k:'wallet', amt:num, l:`財布を ${num.toLocaleString()}円 に合わせる` };
    if (/貯金|貯めた/.test(t) && num) return { k:'save', amt:num, l:`貯金に ${num.toLocaleString()}円 入れる` };
    if (num && /円|使|買|払/.test(t)) return { k:'cash', amt:num, title:t.replace(yen[0], '').replace(/(使った|買った|払った|で|に)$/g, '').trim() || t, l:`支出 ${num.toLocaleString()}円 を記録` };
    if (/欲しい|ほしい/.test(t)) return { k:'wish', title:t.replace(/(が|を)?(欲しい|ほしい).*/, ''), l:'欲しいものに入れる' };
    const d = dateIn(t); if (d) return { k:'event', date:d, title:t, l:`${D.md(d)}の予定にする` };
    if (/切れ|なくなった|買う/.test(t)) return { k:'buy', title:t, l:'買い物リストに入れる' };
    return { k:'todo', title:t, l:'やることに入れる' };
  }
  function dateIn(t) {
    const today = D.today();
    if (/明後日|あさって/.test(t)) return D.add(today, 2);
    if (/明日|あした/.test(t)) return D.add(today, 1);
    if (/今日|きょう/.test(t)) return today;
    const m = t.match(/(\d{1,2})[\/月](\d{1,2})日?/); if (m) { const y = new Date().getFullYear(); let k = `${y}-${p2(+m[1])}-${p2(+m[2])}`; if (k < today) k = `${y + 1}-${p2(+m[1])}-${p2(+m[2])}`; return k; }
    const w = t.match(/(来週)?([日月火水木金土])曜/); if (w) { const tg = '日月火水木金土'.indexOf(w[2]); let n = (tg - new Date().getDay() + 7) % 7 || 7; if (w[1]) n += 7; return D.add(today, n); }
    return null;
  }
  async function apply(x, g) {
    if (g.k === 'todo') await addTodo(g.title);
    if (g.k === 'event') await addEvent(g.date, g.title);
    if (g.k === 'buy') { const st = await Life.stock(); const b = (await Life.getS('ys-buy', { id:'ys-buy', list:[] })); b.list.push({ id:newId(), name:g.title.slice(0, 30), done:false }); await Life.putS(b); Life.changed('buy'); }
    if (['cash', 'wallet', 'save', 'wish'].includes(g.k)) await Office.quick(g);
    await DB.del('room', x.id); Life.changed('inbox');
  }
  return { pull, items, guess, apply, dateIn };
})();

const Sec = (() => {
  let busy = false;
  const TH = { '--accent':'#f28cb1', '--title':'#e7779f', '--soft':'#fff0f5', '--line':'#f6dbe5' };
  // その日の提案（手元のルール）。AIの提案は ys-prop-日付 に保存
  async function rules() {
    const t = D.today(), hr = new Date().getHours(), out = [];
    const w = await Life.weather().catch(() => null), td = await Life.day(), y = await Life.day(D.add(t, -1));
    const tmr = w && w.days[1], day0 = w && w.days[0];
    if (day0 && day0.rain >= 50 && hr < 18) out.push({ k:'umb', t:`今日は雨の確率${day0.rain}%。傘を持っていこう`, todo:null });
    if (tmr && tmr.rain >= 50 && hr >= 17) out.push({ k:'umb2', t:`明日は${tmr.text}（降水${tmr.rain}%）。洗濯は今日のうちか、部屋干しで`, todo:null });
    if (tmr && tmr.min <= 8) out.push({ k:'cold', t:`明日の朝は${tmr.min}℃。こたつかエアコンで、寝る前に部屋を温めておこう`, todo:null });
    for (const c of await Life.chores()) { const n = c.last ? D.diff(t, c.last) : 99; if (n >= c.every) out.push({ k:'ch-' + c.id, t:`${c.name}、前回から${n >= 99 ? 'しばらく' : n + '日'}たってるよ`, todo:c.name }); }
    for (const s of await Life.stock()) { const d = Life.stockDays(s); if (d != null && d <= 2) out.push({ k:'st-' + s.id, t:`${s.name}、あと${d}日分くらい。買い時だね`, todo:`${s.name}を買う` }); }
    const sh = Life.sleepH(y.sleep || td.sleep); if (sh != null && sh < 6) out.push({ k:'sleep', t:`睡眠${sh}時間だったね。今日は24時には布団に入ろう`, todo:null });
    if (typeof Office !== 'undefined') { const m = await Office.alerts().catch(() => []); m.forEach((x, i) => out.push({ k:'m' + i, t:x, todo:null })); }
    const k6 = (await Life.checks()).k6[Life.k6Key(t)]; if (k6 != null && k6 >= 10) out.push({ k:'k6', t:'今週はストレスが高めみたい。やることを減らして、乃亜のところで話してみて', todo:null });
    return out.slice(0, 8);
  }
  async function render() {
    const head = $('briefHead'), box = $('briefList'); if (!box) return;
    const t = D.today(), now = new Date(), hr = now.getHours();
    const w = await Life.weather().catch(() => null);
    const todos = (await DB.all('todos').catch(() => [])).filter(x => !x.done && x.list === 'do');
    const late = todos.filter(x => x.due && x.due < t), today = todos.filter(x => x.due === t);
    const evs = (await DB.all('events').catch(() => [])).filter(e => e.date >= t && e.date <= D.add(t, 6)).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
    const props = await rules(), ai = await Life.getS('ys-prop-' + t, null), done = await Life.getS('ys-propDone', { id:'ys-propDone', d:t, k:[] });
    const dk = done.d === t ? done.k : [];
    const inbox = await Inbox.items(), sum = await Life.getS('ys-brief-' + t, null);
    head.innerHTML = `<div class="yb-top"><div class="yb-d"><b>${p2(now.getMonth() + 1)}.${p2(now.getDate())}</b><span>${'SUN MON TUE WED THU FRI SAT'.split(' ')[now.getDay()]}</span></div>
      ${w ? `<div class="yb-w"><b>${w.now}℃</b><span>${esc(w.text)}</span><small>${w.days[0].max}/${w.days[0].min}℃・雨${w.days[0].rain}%</small></div>` : '<div class="yb-w"><span>天気を取得中</span></div>'}</div>`;
    box.innerHTML = `
      <div class="ykpi">${[['今日', today.length, '件'], ['期限切れ', late.length, '件'], ['今週の予定', evs.length, '件']].map(([l, v, u]) => `<div class="${l === '期限切れ' && v ? 'bad' : ''}"><small>${l}</small><b>${v}</b><span>${u}</span></div>`).join('')}</div>
      <div class="yc brief"><h6>${hr < 12 ? '朝のまとめ' : hr < 18 ? '昼のまとめ' : '夜のまとめ'}<button class="ylink" data-x="brief">${busy ? 'まとめ中…' : 'ホシノにまとめてもらう'}</button></h6>
        ${sum ? `<p class="yb-sum">${esc(sum.text)}</p>` : '<p class="mu">ボタンを押すと、天気・予定・お金・体調をまとめて教えてくれるよ</p>'}</div>
      <div class="yc prop"><h6>提案書<em>${D.md(t)}</em><button class="ylink" data-x="propose">AIに提案してもらう</button></h6>
        ${[...(ai ? ai.list.map((x, i) => ({ k:'ai' + i, t:x.text, todo:x.todo })) : []), ...props].map(p => `<div class="yprop ${dk.includes(p.k) ? 'done' : ''}" data-pk="${p.k}"><i></i><span>${esc(p.t)}</span>
          ${p.todo ? `<button data-todo="${esc(p.todo)}" data-pk2="${p.k}">やることへ</button>` : `<button data-ok="${p.k}">OK</button>`}</div>`).join('') || '<p class="mu">今のところ、気になることはないよ〜</p>'}
        <div class="ystamp">ホシノ<small>承認</small></div></div>
      ${inbox.length ? `<div class="yc inbox"><h6>Siriからの一言<em>${inbox.length}件</em></h6>${inbox.map(x => { const g = Inbox.guess(x.text); return `<div class="yin" data-in="${x.id}"><p>${esc(x.text)}</p><div><button data-ap="${x.id}">${esc(g.l)}</button><button data-alt="${x.id}">ほかに</button><button class="x" data-rm="${x.id}">消す</button></div></div>`; }).join('')}</div>` : ''}
      <div class="yc"><h6>これからの予定<em>7日間</em><button class="ylink" data-x="ev">＋ 予定</button></h6>
        ${evs.length ? evs.map(e => `<div class="yev" data-ev="${e.id}"><b>${D.md(e.date)}<small>${D.dow(e.date)}</small></b><span>${e.time ? `<i>${e.time}</i>` : ''}${esc(e.title)}</span></div>`).join('') : '<p class="mu">予定はないよ。廊下のカレンダーからも入れられるよ</p>'}</div>
      <div class="yc quick"><h6>ひとこと入力<em>Siriと同じ言い方でOK</em></h6><div class="yqi"><input id="secQ" placeholder="例：明日 歯医者 15時／洗剤切れた／ランチ 800円" enterkeyhint="send"><button data-x="q">入れる</button></div></div>`;
  }
  async function onClick(e) {
    const t = e.target.closest('button'); if (!t) return; haptic();
    const x = t.dataset.x;
    if (x === 'brief') return brief();
    if (x === 'propose') return propose();
    if (x === 'ev') return evEdit(D.today());
    if (x === 'q') { const v = $('secQ').value.trim(); if (!v) return; const g = Inbox.guess(v); await Inbox.apply({ id:'none' }, g); toast(g.l.replace('する', 'しました').replace('入れる', '入れました')); $('secQ').value = ''; return render(); }
    if (t.dataset.todo) { await addTodo(t.dataset.todo); markDone(t.dataset.pk2); toast('やることに入れたよ'); return; }
    if (t.dataset.ok) return markDone(t.dataset.ok);
    if (t.dataset.ap) { const it = (await Inbox.items()).find(i => i.id === t.dataset.ap); if (it) { await Inbox.apply(it, Inbox.guess(it.text)); toast('入れたよ'); } return render(); }
    if (t.dataset.alt) {
      const it = (await Inbox.items()).find(i => i.id === t.dataset.alt); if (!it) return;
      return Menu.open(it.text, [
        { label:'やることに入れる', fn:async () => { await Inbox.apply(it, { k:'todo', title:it.text }); render(); } },
        { label:'今日の予定にする', fn:async () => { await Inbox.apply(it, { k:'event', date:D.today(), title:it.text }); render(); } },
        { label:'買い物リストに入れる', fn:async () => { await Inbox.apply(it, { k:'buy', title:it.text }); render(); } },
        { label:'生活DBにメモする', fn:async () => { await Life.put({ dm:'habit', cat:'メモ', name:'メモ', val:it.text, state:'heard' }); await DB.del('room', it.id); render(); } },
      ]);
    }
    if (t.dataset.rm) { await DB.del('room', t.dataset.rm); return render(); }
  }
  async function markDone(k) { const t = D.today(), d = await Life.getS('ys-propDone', { id:'ys-propDone', d:t, k:[] }); if (d.d !== t) { d.d = t; d.k = []; } d.k.push(k); await Life.putS(d); render(); }
  async function brief() {
    if (busy) return;
    if (!(await Api.load())) { await Talk.say('hoshino', ['うへ〜、AIの設定がまだみたい。自室の設定から入れてね〜']); return Talk.close(); }
    busy = true; render(); Talk.open('hoshino'); Talk.think('まとめてるよ〜');
    try {
      const r = await Api.call('brief', { now:Api.now(), snap:await Life.snapshot() });
      await Life.putS({ id:'ys-brief-' + D.today(), text:(r.lines || []).join('\n') });
      busy = false; render();
      await Talk.say('hoshino', r.lines, r.face);
    } catch (e) { busy = false; render(); await Talk.say('hoshino', ['ごめん、うまくまとめられなかった〜']); }
    Talk.close();
  }
  async function propose() {
    if (!(await Api.load())) return toast('AIの設定をすると使えます');
    toast('ホシノが考えています…', 2000);
    try { const r = await Api.call('propose', { now:Api.now(), snap:await Life.snapshot() }); await Life.putS({ id:'ys-prop-' + D.today(), list:(r.items || []).slice(0, 5) }); render(); }
    catch (e) { toast('うまく提案できませんでした'); }
  }
  function evEdit(date, ev) {
    const body = h('<div></div>');
    const fT = F.text('予定', ev ? ev.title : '', '例：歯医者'), fD = F.date('日付', ev ? ev.date : date, true), fM = F.text('時刻（なくてもOK）', ev ? ev.time : '', '', 'time');
    body.append(fT.el, fD.el, fM.el);
    Editor.open({ title:ev ? '予定を直す' : '予定を追加', body, focus:ev ? null : fT.input, theme:TH,
      del:ev ? async () => { await DB.del('events', ev.id); render(); Hall.paint(); } : null,
      save:async () => { const t = fT.get(), d = fD.get(); if (!t || !d) return false; if (ev) await DB.put('events', Object.assign(ev, { title:t, date:d, time:fM.get() })); else await addEvent(d, t, fM.get()); render(); Hall.paint(); } });
  }
  function init() {
    $('briefList').addEventListener('click', onClick);
    $('briefList').addEventListener('click', async e => { const v = e.target.closest('[data-ev]'); if (v) { const ev = await DB.get('events', v.dataset.ev); if (ev) evEdit(ev.date, ev); } });
    $('briefList').addEventListener('keydown', e => { if (e.target.id === 'secQ' && e.key === 'Enter' && !e.isComposing) { e.preventDefault(); $('briefList').querySelector('[data-x="q"]').click(); } });
    TabHooks.brief = { enter:() => { Motion.preload('hoshino'); render(); Inbox.pull().then(n => n && render()).catch(() => {}); } };
    Life.onChange(() => { if (tab === 'brief') render(); });
  }
  return { init, render, reload:render, evEdit };
})();
App.modules.push(Sec);
