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
    const inbox = await Inbox.items(), sum = await Life.getS('ys-brief-' + t, null), unread = typeof Chat !== 'undefined' ? await Chat.unread() : 0;
    const all = [...(ai ? ai.list.map((x, i) => ({ k:'ai' + i, t:x.text, todo:x.todo })) : []), ...props].filter(p => !dk.includes(p.k));
    const top = all.slice(0, 3);
    const n = today.length + late.length, slot = hr < 11 ? 'MORNING' : hr < 18 ? 'AFTERNOON' : 'NIGHT';
    const line = sum ? sum.text.split('\n')[0] : n ? `今日やることは${n}件だよ〜。${late.length ? '期限切れからいこっか' : 'のんびりいこ〜'}` : 'やることは、ぜんぶおしまい。のんびりしよ〜';
    head.innerHTML = `<div class="u-hd"><div class="u-tt"><small>SECRETARY ROOM</small><b>秘書室</b></div>
      <div class="u-clk"><b>${p2(now.getHours())}<i>:</i>${p2(now.getMinutes())}</b><span>${p2(now.getMonth() + 1)}.${p2(now.getDate())} ${'SUN MON TUE WED THU FRI SAT'.split(' ')[now.getDay()]}</span></div></div>`;
    box.innerHTML = `
      <section class="u-hero">
        <div class="u-lab"><i></i>${slot} BRIEF</div>
        <div class="u-big"><b>${n}</b><span>件</span><em>今日のやること${late.length ? `<u>うち期限切れ ${late.length}</u>` : ''}</em></div>
        <p class="u-say">${esc(line)}</p>
        ${w ? `<div class="u-wx"><b>${w.now}°</b><span>${esc(w.text)}</span><small>${w.days[0].max}° / ${w.days[0].min}°　雨 ${w.days[0].rain}%</small></div>` : ''}
      </section>
      <section class="u-sec">
        <div class="u-sh"><b>けさの連絡</b><small>MORNING</small></div>
        <div class="u-mc"><button data-x="call"><img src="av_hoshino.webp" alt=""><span>朝の電話<small>聞き直す</small></span></button><button data-x="wx"><img src="av_mika.webp" alt=""><span>天気予報<small>ミカのスタジオ</small></span></button><button data-x="chat"><img src="av_noa.webp" alt=""><span>チャット<small>${unread ? `未読 ${unread}件` : 'みんなと話す'}</small></span></button></div>
      </section>
      <section class="u-sec">
        <div class="u-sh"><b>提案書</b><small>PROPOSAL</small><button class="u-more" data-x="propose">AIで作る</button></div>
        ${top.map((p, i) => `<div class="u-row" data-pk="${p.k}"><i>${p2(i + 1)}</i><span>${esc(p.t)}</span>${p.todo ? `<button data-todo="${esc(p.todo)}" data-pk2="${p.k}" aria-label="やることへ">＋</button>` : `<button data-ok="${p.k}" aria-label="OK">✓</button>`}</div>`).join('') || '<p class="u-empty">今のところ、気になることはないよ〜</p>'}
        ${all.length > 3 ? `<p class="u-rest">ほか ${all.length - 3}件</p>` : ''}
      </section>
      ${inbox.length ? `<section class="u-sec"><div class="u-sh"><b>Siriからの一言</b><small>INBOX ${inbox.length}</small></div>${inbox.map(x => { const g = Inbox.guess(x.text); return `<div class="u-row in" data-in="${x.id}"><i>IN</i><span>${esc(x.text)}<small>${esc(g.l)}</small></span><button data-ap="${x.id}" aria-label="入れる">＋</button><button class="x" data-rm="${x.id}" aria-label="消す">×</button></div>`; }).join('')}</section>` : ''}
      <section class="u-sec">
        <div class="u-sh"><b>これからの予定</b><small>7 DAYS</small><button class="u-more" data-x="ev">＋追加</button></div>
        <div class="u-evs hscroll">${evs.map(e => `<div class="u-ev" data-ev="${e.id}"><b>${D.md(e.date)}</b><small>${D.dow(e.date)}${e.time ? ' ' + e.time : ''}</small><span>${esc(e.title)}</span></div>`).join('') || '<p class="u-empty">予定はないよ</p>'}</div>
      </section>
      <div class="u-acts"><button class="u-btn pri" data-x="brief">${busy ? 'まとめ中…' : 'ホシノにまとめてもらう'}</button></div>
      <div class="u-q"><input id="secQ" placeholder="ひとこと入力　例：明日 歯医者 15時" enterkeyhint="send"><button data-x="q">入れる</button></div>`;
    box.querySelectorAll('.u-hero, .u-sec, .u-acts, .u-q').forEach((el, i) => el.animate([{ opacity:0, transform:'translateX(28px)' }, { opacity:1, transform:'none' }], { duration:460, delay:60 + i * 70, easing:'cubic-bezier(.2,.8,.2,1)', fill:'backwards' }));
  }
  async function onClick(e) {
    const t = e.target.closest('button'); if (!t) return; haptic();
    const x = t.dataset.x;
    if (x === 'brief') return brief();
    if (x === 'call') return Daily.replayCall();
    if (x === 'wx') return Wx.open();
    if (x === 'chat') return Chat.open();
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
