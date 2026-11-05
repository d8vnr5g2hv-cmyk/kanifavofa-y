// Yohei Support — 毎日の仕組み：3つのリング・今日のミッション・連続記録（お休み券）・5つのステータス・実績と称号・スクラッチの景品
// 置き場所：ホーム（リング・次のタスク）／廊下（ミッション・連続記録）／自室のPC（ステータス・実績）
'use strict';
const Progress = (() => {
  const SID = 'ys-prog';
  let P = null;
  async function load() { if (!P) P = await Life.getS(SID, null) || { id:SID }; P.id = SID; P.st = P.st || { n:0, last:'', best:0 }; P.ach = P.ach || {}; P.bonus = P.bonus || {}; P.titles = P.titles || []; P.used = P.used || []; P.mdone = P.mdone || {}; if (P.tickets == null) P.tickets = 2; return P; }
  const save = () => Life.putS(P);
  const ym = (d = D.today()) => d.slice(0, 7);

  // ===== その日の記録を集める =====
  let cache = { at:0, room:null, todos:null };
  async function src() {
    if (Date.now() - cache.at < 4000 && cache.room) return cache;
    const [room, todos] = await Promise.all([DB.all('room').catch(() => []), DB.all('todos').catch(() => [])]);
    cache = { at:Date.now(), room, todos }; return cache;
  }
  const lsNum = k => +LS.get(k) || 0;
  const talkN = d => { try { const c = JSON.parse(LS.get('ys-talk-' + d) || '{}'); return Object.values(c).reduce((a, b) => a + b, 0); } catch (e) { return 0; } };
  async function dayOf(d) {
    const { room, todos } = await src();
    const get = id => room.find(r => r.id === id) || {};
    const day = get('day-' + d), food = get('food-' + d), act = get('act-' + d);
    const meals = Object.values(food.meals || {}).filter(m => m && m.st !== 'skip').length;
    const cash = room.filter(r => r.id.startsWith('cash-') && r.date === d).length;
    const todo = todos.filter(t => t.done && t.doneAt && D.key(new Date(t.doneAt)) === d).length;
    return { d, sleep:Life.sleepH(day.sleep), meals, mood:day.mood || day.cond || (day.chk ? 3 : 0), chores:act.chores || 0, todo, cash, nospend:!!LS.get('ys-nospend-' + d),
      chat:lsNum('ys-chat-' + d), talk:talkN(d), focus:lsNum('ys-focus-' + d), art:!!get('art-' + d).head };
  }
  // ===== 3つのリング（0〜1） =====
  async function rings(d = D.today()) {
    const x = await dayOf(d);
    const body = ((x.sleep != null ? 1 : 0) + Math.min(x.meals, 2) / 2 + (x.mood ? 1 : 0)) / 3;
    const home = Math.min(1, (x.chores + x.todo) / 3);
    let money = x.cash > 0 || x.nospend ? 1 : 0;
    if (money && d === D.today() && typeof Office !== 'undefined') {
      try { const m = await Office.summary(); if (m && typeof m['今日使った'] === 'number' && typeof m['一日あたり'] === 'number' && m['今日使った'] > Math.max(0, m['一日あたり'])) money = .5; } catch (e) {}
    }
    return { body, home, money, x };
  }
  const counted = r => [r.body, r.home, r.money].filter(v => v >= .5).length >= 2;

  // ===== 連続記録とお休み券（1日1回、前日までを数える） =====
  async function dayStart() {
    await load();
    const t = D.today(), msgs = [];
    if (P.tm !== ym()) { P.tickets = Math.min(3, (P.tickets || 0) + (P.tm ? 2 : 0)); P.tm = ym(); }
    let d = P.st.last ? D.add(P.st.last, 1) : D.add(t, -1);
    if (D.diff(t, d) > 30) d = D.add(t, -30);
    while (d < t) {
      const r = await rings(d);
      if (counted(r)) P.st.n++;
      else if (P.st.n > 0 && P.tickets > 0) { P.tickets--; P.used.push(d); msgs.push(`${D.md(d)}はお休み券を使って、連続記録を守ったよ`); }
      else P.st.n = 0;
      P.st.best = Math.max(P.st.best, P.st.n); P.st.last = d; d = D.add(d, 1);
    }
    await save(); await checkAch(true);
    msgs.forEach((m, i) => setTimeout(() => toast(m, 2600), 3500 + i * 2800));
  }
  async function streak() {
    await load(); const r = await rings();
    return { n:P.st.n + (counted(r) ? 1 : 0), today:counted(r), best:Math.max(P.st.best, P.st.n + (counted(r) ? 1 : 0)), tickets:P.tickets };
  }

  // ===== 今日のミッション（毎日3つ） =====
  async function missions() {
    await load(); const t = D.today();
    if (!P.ms || P.ms.date !== t) {
      const { todos } = await src(), x = await dayOf(t), out = [];
      const open = todos.filter(z => !z.done && z.list === 'do' && z.due);
      const late = open.filter(z => z.due < t).sort((a, b) => a.due.localeCompare(b.due)), due = open.filter(z => z.due === t);
      if (late[0]) out.push({ k:'todo', ref:late[0].id, t:`期限切れの「${late[0].title}」を片付ける`, st:'home' });
      else if (due[0]) out.push({ k:'todo', ref:due[0].id, t:`今日が期限の「${due[0].title}」を終わらせる`, st:'home' });
      const ch = (await Life.chores()).filter(c => (c.last ? D.diff(t, c.last) : 99) >= c.every).sort((a, b) => (a.last || '').localeCompare(b.last || ''));
      if (ch[0]) out.push({ k:'chore', ref:ch[0].id, t:`${ch[0].name}をする`, st:'home' });
      if (x.sleep == null) out.push({ k:'sleep', t:'ゆうべの睡眠を記録する', st:'body' });
      out.push({ k:'cash', t:'家計簿をつける（使ってない日はそれでOK）', st:'money' });
      if (out.length < 3) out.push({ k:'meal2', t:'ご飯を2回以上記録する', st:'body' });
      if (out.length < 3) out.push({ k:'chat', t:'チャットで誰かに返事をする', st:'social' });
      if (out.length < 3) out.push({ k:'mood', t:'今日の気分を記録する', st:'body' });
      P.ms = { date:t, list:out.slice(0, 3), all:false }; await save();
    }
    const { todos } = await src(), x = await dayOf(t), chs = await Life.chores();
    const ok = m => m.k === 'todo' ? !!(todos.find(z => z.id === m.ref) || { done:true }).done
      : m.k === 'chore' ? (chs.find(c => c.id === m.ref) || {}).last === t
      : m.k === 'sleep' ? x.sleep != null : m.k === 'cash' ? x.cash > 0 || x.nospend : m.k === 'meal2' ? x.meals >= 2 : m.k === 'chat' ? x.chat > 0 : m.k === 'mood' ? !!x.mood : false;
    const list = P.ms.list.map(m => Object.assign({}, m, { ok:ok(m) }));
    const n = list.filter(m => m.ok).length;
    if (n === list.length && !P.ms.all) { P.ms.all = true; P.mdone[t] = 1; await save(); Wipe.slash(); Sfx.play('done'); toast('今日のミッション、ぜんぶ達成！', 2200); checkAch(); }
    return { list, n, all:n === list.length };
  }

  // ===== 5つのステータス（この30日の暮らしから） =====
  const STAT = [
    ['body', '体調', ['ぐったり', 'ふつう', '元気', '絶好調', '無敵'], '#ff7fa8'],
    ['home', '家事力', ['散らかり気味', 'ふつう', 'きちんと', 'しっかり者', '家事の達人'], '#f0a020'],
    ['money', '金運', ['ピンチ', 'ふつう', 'やりくり上手', '堅実', '大富豪の素質'], '#2fbf8f'],
    ['social', '交友', ['ひとり好き', 'ふつう', '人気者', 'みんなの中心', 'カリスマ'], '#b48cff'],
    ['know', '知識', ['のんびり', 'ふつう', '勉強家', '物知り', '博士'], '#1fa3ff'],
  ];
  async function stats() {
    await load(); const t = D.today(), ds = [];
    for (let i = 0; i < 30; i++) ds.push(await dayOf(D.add(t, -i)));
    const avg = f => ds.reduce((a, x) => a + f(x), 0) / ds.length;
    const v = {
      body:avg(x => ((x.sleep != null ? (x.sleep >= 6 ? 1 : .5) : 0) + Math.min(x.meals, 3) / 3 + (x.mood ? 1 : 0)) / 3),
      home:avg(x => Math.min(1, (x.chores + x.todo) / 2)),
      money:avg(x => x.cash > 0 || x.nospend ? 1 : 0),
      social:avg(x => Math.min(1, (x.chat + x.talk / 2) / 3)),
      know:avg(x => Math.min(1, x.focus / 50 + (x.art ? .5 : 0))),
    };
    return STAT.map(([k, n, names, c]) => {
      const sc = Math.min(100, Math.round(v[k] * 100) + Math.min(15, P.bonus[k] || 0)), lv = Math.min(5, Math.floor(sc / 20) + 1);
      return { k, n, c, sc, lv, rank:names[lv - 1], next:lv < 5 ? lv * 20 - sc : 0 };
    });
  }

  // ===== 実績と称号 =====
  const ACH = [
    ['first', 'はじめの一歩', '初めて朝の流れを最後まで見た', c => c.morning >= 1],
    ['sleep1', '記録のひと', '睡眠を初めて記録した', c => c.sleepDays >= 1],
    ['sleep7', 'ねむりの番人', '睡眠を7日記録した', c => c.sleepDays >= 7],
    ['good3', '早寝の芽', '6時間以上眠れた日が3日', c => c.good >= 3],
    ['good14', '快眠マスター', '6時間以上眠れた日が14日', c => c.good >= 14],
    ['st3', '三日坊主こえ', '連続記録3日', c => c.best >= 3],
    ['st7', '一週間の約束', '連続記録7日', c => c.best >= 7],
    ['st30', '習慣の人', '連続記録30日', c => c.best >= 30],
    ['m1', 'ミッション・クリア', '今日のミッションを全部達成', c => c.mall >= 1],
    ['m10', 'エージェント', 'ミッション全達成が10日', c => c.mall >= 10],
    ['cash7', '家計簿のひと', '家計簿をつけた日が7日', c => c.cashDays >= 7],
    ['cash30', 'ユウカの右腕', '家計簿をつけた日が30日', c => c.cashDays >= 30],
    ['todo10', 'かたづけ上手', 'やることを10件終えた', c => c.todo >= 10],
    ['todo50', 'シャーレの実務家', 'やることを50件終えた', c => c.todo >= 50],
    ['chat1', 'はじめまして', 'チャットで初めて返事をした', c => c.chat >= 1],
    ['chatall', 'みんなの先生', '8人全員とチャットした', c => c.who >= 8],
    ['mood30', 'こころの日記', '気分を30日記録した', c => c.moodDays >= 30],
    ['sc10', 'けずりの達人', 'スクラッチを10回けずった', c => c.scratch >= 10],
    ['focus60', '集中の入口', '集中タイマーで合計60分', c => c.focus >= 60],
    ['focus600', 'ゾーンの住人', '集中タイマーで合計10時間', c => c.focus >= 600],
    ['ticket', '計画的おやすみ', 'お休み券を初めて使った', c => c.used >= 1],
    ['lv5', '才能開花', 'どれかのステータスがLv5', c => c.lv5 >= 1],
    ['card1', 'はじめての現像', 'カードを初めて作った', c => c.cards >= 1],
    ['card10', 'コレクター', 'カードを10枚作った', c => c.cards >= 10],
    ['card30', 'キサキのお得意さま', 'カードを30枚作った', c => c.cards >= 30],
    ['card4', '王冠のカード', '♛のカードを作った', c => c.crown >= 1],
    ['hl1', 'HALO LINK 突破', 'HALO LINKのステージを初めてクリアした', c => c.hl >= 1],
    ['hl12', '夜を越える者', 'HALO LINKの12ステージをすべてクリアした', c => c.hl >= 12],
    ['night7', 'おやすみの常連', 'おやすみ電話を7回聞いた', c => c.night >= 7],
  ];
  let achAt = 0;
  async function ctxAch() {
    await load(); const { room, todos } = await src(), t = D.today();
    const days = room.filter(r => r.id.startsWith('day-'));
    const cashDays = new Set(room.filter(r => r.id.startsWith('cash-')).map(r => r.date)).size;
    let chat = 0, focus = 0; const who = new Set(JSON.parse(LS.get('ys-chatWho') || '[]'));
    for (let i = 0; i < 400; i++) { const d = D.add(t, -i); chat += lsNum('ys-chat-' + d); focus += lsNum('ys-focus-' + d); }
    const st = await streak(), sts = Feat.on('stats') ? await stats() : [];
    const cards = await DB.all('cards').catch(() => []);
    let hl = 0; try { hl = (JSON.parse(localStorage.getItem('hl-save-v1') || '{}').cleared || []).length; } catch (e) {}
    return { morning:lsNum('ys-morningN'), sleepDays:days.filter(x => x.sleep).length, good:days.filter(x => (Life.sleepH(x.sleep) || 0) >= 6).length, best:st.best,
      mall:Object.keys(P.mdone).length, cashDays, todo:todos.filter(z => z.done).length + (P.todoArch || 0), chat, who:who.size, moodDays:days.filter(x => x.mood).length,
      scratch:P.scratch || 0, focus, used:P.used.length, lv5:sts.filter(s => s.lv >= 5).length,
      cards:cards.length, crown:cards.filter(x => x.rank >= 4).length, hl, night:lsNum('ys-nightN') };
  }
  async function checkAch(quiet) {
    if (!Feat.on('ach') || Date.now() - achAt < 3000) return [];
    achAt = Date.now();
    const c = await ctxAch(), got = [];
    ACH.forEach(([id, name, , test]) => { if (!P.ach[id] && test(c)) { P.ach[id] = D.today(); got.push(name); if (!P.titles.includes(name)) P.titles.push(name); } });
    if (got.length) { await save(); if (!quiet) { Sfx.play('done'); toast(`実績「${got[0]}」を達成！ 称号を手に入れました`, 2600); } else setTimeout(() => toast(`実績「${got[0]}」を達成！`, 2400), 5000); }
    return got;
  }

  // ===== スクラッチの景品 =====
  const PRIZE_TITLES = ['夜ふかし卒業生', 'ラーメン評論家', 'ブルアカの先生', 'サッカー少年', '紅茶の人', '月曜日の勇者', '金曜日の英雄', 'のんびり屋', '湯船の哲学者', 'メッシの弟子'];
  async function drawPrize() {
    await load(); const r = Math.random();
    const free = PRIZE_TITLES.filter(t => !P.titles.includes(t));
    if (r < .10 && P.tickets < 3) return { kind:'ticket', label:'RARE', title:'お休み券', sub:'連続記録を1日守れます' };
    if (r < .25 && free.length) { const t = Cast.pick(free); return { kind:'title', label:'TITLE', title:`称号「${t}」`, sub:'自室のPCで付けかえられます', v:t }; }
    if (r < .60) { const s = Cast.pick(STAT); return { kind:'stat', label:'BONUS', title:`${s[1]} +2`, sub:'ステータスに少しだけ上乗せ', v:s[0] }; }
    const who = Cast.pick(Cast.ORDER.filter(w => w !== 'noa'));
    return { kind:'msg', label:'MESSAGE', title:`${Cast.name(who)}からメッセージ`, sub:'チャットを開いてみてね', v:who };
  }
  async function givePrize(p) {
    await load(); P.scratch = (P.scratch || 0) + 1;
    if (p.kind === 'ticket') P.tickets = Math.min(3, P.tickets + 1);
    if (p.kind === 'title' && !P.titles.includes(p.v)) P.titles.push(p.v);
    if (p.kind === 'stat') P.bonus[p.v] = Math.min(15, (P.bonus[p.v] || 0) + 2);
    await save();
    if (p.kind === 'msg' && typeof Chat !== 'undefined') Chat.prize(p.v);
    checkAch();
  }

  // ===== ホーム：リングと次のタスク（これだけ） =====
  function ringSVG(r, sz = 30) {
    const arc = (v, rad, c) => { const L = 2 * Math.PI * rad; return `<circle r="${rad}" cx="20" cy="20" fill="none" stroke="${c}" stroke-opacity=".22" stroke-width="4.2"/><circle r="${rad}" cx="20" cy="20" fill="none" stroke="${c}" stroke-width="4.2" stroke-linecap="round" stroke-dasharray="${(L * Math.max(.001, v)).toFixed(1)} ${L.toFixed(1)}" transform="rotate(-90 20 20)"/>`; };
    return `<svg viewBox="0 0 40 40" width="${sz}" height="${sz}" class="rings">${arc(r.home, 17, '#ffb347')}${arc(r.money, 12, '#3fd6a0')}${arc(r.body, 7, '#ff6fa8')}</svg>`;
  }
  async function nextTask() {
    const t = D.today(), now = new Date(), hm = `${p2(now.getHours())}:${p2(now.getMinutes())}`;
    const ev = (await DB.all('events').catch(() => [])).filter(e => e.date === t && e.time && e.time >= hm).sort((a, b) => a.time.localeCompare(b.time))[0];
    if (ev) return `${ev.time} ${ev.title}`;
    const { todos } = await src(), open = todos.filter(z => !z.done && z.list === 'do' && z.due && z.due <= t).sort((a, b) => a.due.localeCompare(b.due));
    if (open[0]) return (open[0].due < t ? '期限切れ：' : '今日：') + open[0].title;
    return null;
  }
  let hud = null;
  async function paintHud() {
    if (!hud) {
      hud = h('<button class="ys-hud" aria-label="今日の記録"><span class="hr"></span><span class="ht"></span></button>');
      $('lobby').appendChild(hud);
      ['pointerdown', 'pointerup'].forEach(ev => hud.addEventListener(ev, e => e.stopPropagation()));
      hud.addEventListener('click', e => { e.stopPropagation(); haptic(); openToday(); });
    }
    try {
      const r = await rings(), nt = await nextTask();
      hud.querySelector('.hr').innerHTML = ringSVG(r, 26);
      hud.querySelector('.ht').innerHTML = nt ? `<small>NEXT</small>${esc(nt)}` : '<small>TODAY</small>やることはなし';
    } catch (e) {}
  }

  // ===== 廊下：ミッションのふだ =====
  async function hallChip(el) {
    if (!el) return;
    if (!Feat.on('missions')) { el.innerHTML = ''; el.hidden = true; return; }
    el.hidden = false;
    const m = await missions(), s = await streak();
    el.innerHTML = `<span class="hm-r">${ringSVG(await rings(), 34)}</span><span><small>今日のミッション</small><b>${m.n}<i>/${m.list.length}</i></b></span><span><small>連続</small><b>${s.n}<i>日</i></b></span>`;
  }

  // ===== 今日のボード（廊下・ホームからひらく） =====
  async function openToday() {
    const ov = h('<div class="tdov ui2"><div class="td-in"><button class="td-x" aria-label="閉じる">×</button><div class="td-body"></div></div></div>');
    document.body.appendChild(ov);
    const close = () => Wipe.mid(() => ov.remove());
    ov.querySelector('.td-x').onclick = close;
    ov.addEventListener('click', async e => {
      const b = e.target.closest('[data-td]'); if (!b) return; haptic();
      if (b.dataset.td === 'nospend') { LS.set('ys-nospend-' + D.today(), '1'); Wipe.slash(); toast('今日は使ってない、で記録したよ'); draw(); paintHud(); }
      if (b.dataset.td === 'paper') { close(); setTimeout(() => Room.openBoard('paper', {}), 320); }
    });
    async function draw() {
      const r = await rings(), s = await streak(), t = D.today();
      const m = Feat.on('missions') ? await missions() : null;
      const wk = []; for (let i = 6; i >= 0; i--) { const d = D.add(t, -i), rr = await rings(d); wk.push({ d, ok:counted(rr), used:P.used.includes(d) }); }
      const pct = v => Math.round(v * 100);
      ov.querySelector('.td-body').innerHTML = `
        <div class="u-tt"><small>TODAY BOARD</small><b>今日のボード</b></div>
        <section class="u-hero td-rings">${ringSVG(r, 112)}
          <div class="td-rl"><p><i style="--c:#ffb347"></i>家事<b>${pct(r.home)}%</b><small>やること・家事 ${r.x.todo + r.x.chores}/3</small></p>
            <p><i style="--c:#3fd6a0"></i>お金<b>${pct(r.money)}%</b><small>${r.x.cash ? `家計簿 ${r.x.cash}件` : r.x.nospend ? '使ってない日' : '家計簿まだ'}</small></p>
            <p><i style="--c:#ff6fa8"></i>からだ<b>${pct(r.body)}%</b><small>睡眠${r.x.sleep != null ? '○' : '−'}・ご飯${r.x.meals}・気分${r.x.mood ? '○' : '−'}</small></p></div></section>
        ${!r.x.cash && !r.x.nospend ? '<div class="td-ns"><button class="u-more" data-td="nospend">今日はお金を使ってない</button></div>' : ''}
        ${m ? `<section class="u-sec"><div class="u-sh"><b>今日のミッション</b><small>MISSION ${m.n}/${m.list.length}</small></div>
          ${m.list.map((x, i) => `<div class="u-row td-m ${x.ok ? 'ok' : ''}"><i>${x.ok ? '✓' : p2(i + 1)}</i><span>${esc(x.t)}</span></div>`).join('')}</section>` : ''}
        <section class="u-sec"><div class="u-sh"><b>連続記録</b><small>STREAK</small></div>
          <div class="td-st"><div class="big"><b>${s.n}</b><span>日</span><em>最高 ${s.best}日</em></div>
            <div class="tk"><small>お休み券</small>${'<i class="on"></i>'.repeat(s.tickets)}${'<i></i>'.repeat(Math.max(0, 3 - s.tickets))}</div></div>
          <div class="td-wk">${wk.map(x => `<div class="${x.ok ? 'ok' : x.used ? 'used' : ''}${x.d === t ? ' td' : ''}"><i></i><span>${D.dow(x.d)}</span></div>`).join('')}</div>
          <p class="u-rest">リングが2つ半分をこえた日が「記録した日」。とぎれそうな日は、お休み券が自動で守ります（毎月2枚）</p></section>
        <div class="u-acts"><button class="u-btn" data-td="paper">今週の新聞・週報を見る</button></div>`;
    }
    await draw();
    Wipe.mid(() => ov.classList.add('on'));
  }

  // ===== 自室のPC：ステータス・実績・称号 =====
  async function statusHTML() {
    await load(); await checkAch(true);
    const sts = Feat.on('stats') ? await stats() : null, s = await streak();
    const title = P.title || (P.titles[0] || 'まだ称号はありません');
    const lockedNote = k => `<p class="ps-lock">あと${Math.max(1, Feat.LIST.find(x => x[0] === k)[3] - Feat.day())}日で解放されます</p>`;
    const radar = sts ? (() => {
      const R = 74, cx = 100, cy = 100, pt = (i, v) => { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; return [cx + Math.cos(a) * R * v, cy + Math.sin(a) * R * v]; };
      const grid = [.2, .4, .6, .8, 1].map(g => `<polygon points="${sts.map((_, i) => pt(i, g).join(',')).join(' ')}" class="g"/>`).join('');
      const poly = `<polygon points="${sts.map((x, i) => pt(i, Math.max(.06, x.sc / 100)).join(',')).join(' ')}" class="v"/>`;
      const lab = sts.map((x, i) => { const [lx, ly] = pt(i, 1.24); return `<text x="${lx}" y="${ly + 4}" text-anchor="middle">${x.n}</text>`; }).join('');
      return `<svg viewBox="0 -2 200 200" class="ps-radar">${grid}${poly}${lab}</svg>`;
    })() : '';
    return `<div class="ps">
      <div class="ps-card"><small>TITLE</small><b>${esc(title)}</b><button data-pc="titles">付けかえる</button><span>連続 ${s.n}日 ／ 最高 ${s.best}日 ／ お休み券 ${s.tickets}枚</span></div>
      <div class="ttl">Status</div>${sts ? `${radar}<div class="ps-list">${sts.map(x => `<div class="ps-row"><span>${x.n}</span><b style="color:${x.c}">Lv.${x.lv}</b><em>${x.rank}</em><i><u style="width:${x.sc}%;background:${x.c}"></u></i></div>`).join('')}</div>
        <p class="ps-note">この30日の暮らしから毎日計算します。記録すると上がり、さぼると少しずつ下がります</p>` : lockedNote('stats')}
      <div class="ttl">Achievements<span>${Object.keys(P.ach).length}/${ACH.length}</span></div>
      ${Feat.on('ach') ? `<div class="ps-ach">${ACH.map(([id, name, desc]) => `<div class="${P.ach[id] ? 'on' : ''}"><b>${P.ach[id] ? esc(name) : '？？？'}</b><span>${esc(desc)}</span>${P.ach[id] ? `<em>${D.md(P.ach[id])}</em>` : ''}</div>`).join('')}</div>` : lockedNote('ach')}
      ${typeof Wrapped !== 'undefined' ? await Wrapped.archiveHTML() : ''}
    </div>`;
  }
  async function pickTitle(after) {
    await load();
    if (!P.titles.length) return toast('実績やスクラッチで称号が手に入ります');
    Menu.open('称号を付けかえる', P.titles.map(t => ({ label:t, sub:t === P.title ? 'いま付けている称号' : '', fn:async () => { P.title = t; await save(); toast(`称号「${t}」を付けたよ`); after && after(); } })));
  }

  function init() {
    Life.onChange(async what => {
      if (what === 'chores') {   // その日にやった家事の数を残しておく（家事の履歴は最後の日しか持たないため）
        const t = D.today(), n = (await Life.chores()).filter(c => c.last === t).length;
        const r = (await DB.get('room', 'act-' + t).catch(() => null)) || { id:'act-' + t };
        r.chores = Math.max(r.chores || 0, n); await DB.put('room', r).catch(() => {});
      }
      cache.at = 0; paintHud();
    });
    setInterval(paintHud, 5 * 60e3);
    setTimeout(() => { dayStart().catch(e => console.warn(e)); paintHud(); }, 1200);
  }
  return { init, rings, missions, streak, stats, dayStart, paintHud, hallChip, openToday, statusHTML, pickTitle, drawPrize, givePrize, checkAch, ringSVG, title:async () => (await load()).title || '' ,
    noteTodo:() => { cache.at = 0; paintHud(); setTimeout(() => missions().catch(() => {}), 300); } };
})();
App.modules.push(Progress);
