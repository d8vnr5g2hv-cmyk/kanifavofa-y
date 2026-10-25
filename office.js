// Kani Favorite — 執務室（自室の扉の右。ユウカと家計簿・食事管理）
'use strict';
const Office = (() => {
  const BGM = { src:'yuuka_bgm.mp3', loopStart:0.2, loopEnd:0.2 + 128.9192 };
  const VIDEO = { src:'10_office_tall_h264.mp4', poster:'10_office_tall_poster.jpg' };
  const FACES = { normal:'office_f_normal.jpg', panic:'office_f_panic.jpg', smile:'office_f_smile.jpg' };
  const yen = n => (n < 0 ? '−¥' : '¥') + Math.abs(Math.round(n)).toLocaleString();
  const CFG_ID = 'office';

  // ===== 家計簿の分類（アイコンはステッカーやカフェの絵を流用）=====
  const CATS = [
    ['食費', 'cf_ing2', '#5cc8a8'], ['外食', 'cf_food3', '#ff9a6b'], ['飲み会', 'cf_drink6', '#ffb84d'], ['カフェ', 'cf_drink2', '#c9a27a'],
    ['タバコ', 'dc_stk10', '#a99be0'], ['日用品', 'dc_note1', '#7cc4ff'], ['交通', 'dc_stk12', '#5aa0e8'], ['趣味', 'dc_stk9', '#6fa8ff'],
    ['交際費', 'dc_stk7', '#ff8fb6'], ['服・美容', 'dc_stk8', '#f7a8c6'], ['医療', 'dc_stk3', '#ffd36b'], ['その他', 'dc_stk6', '#a8b4c4'],
  ];
  const CAT = Object.fromEntries(CATS.map(([n, i, c]) => [n, { n, i, c }]));
  const KEYWORD = [[/タバコ|たばこ|煙草|アイコス|iqos/i, 'タバコ'], [/飲み会|居酒屋|バー|ビール|酒/, '飲み会'], [/カフェ|スタバ|ドトール|コーヒー|珈琲/, 'カフェ'],
    [/電車|バス|タクシー|交通|定期|ガソリン/, '交通'], [/ランチ|ラーメン|外食|出前|ウーバー|マック|定食|寿司|焼肉/, '外食'], [/スーパー|コンビニ|食材|弁当|おにぎり|パン/, '食費'],
    [/病院|薬|医/, '医療'], [/服|美容|散髪|カット|コスメ/, '服・美容'], [/ゲーム|漫画|本|課金|サッカー|映画/, '趣味'], [/プレゼント|ご祝儀|お祝い/, '交際費'], [/洗剤|ティッシュ|日用|雑貨/, '日用品']];
  const guessCat = s => (KEYWORD.find(([r]) => r.test(s)) || [0, 'その他'])[1];

  // ===== 食事 =====
  const SLOTS = [['b', '朝', 'MORNING'], ['l', '昼', 'LUNCH'], ['d', '夜', 'DINNER'], ['s', '間食・お酒', 'SNACK']];
  const SLOT_NAME = Object.fromEntries(SLOTS.map(([k, n]) => [k, n]));

  let cfg = null, el = null, active = false, onDoor = false, tab = 'cash', api = null, month = null, foodDay = null, chat = [];
  const fresh = () => ({ id:CFG_ID, cash:{ income:0, payday:25, bonus:[], fixed:[], saved:0, goal:0, start:'', goalBy:'' }, food:{ w:90, h:177, age:25, act:1.4, mode:'cut' } });
  async function loadCfg() {
    if (cfg) return cfg;
    cfg = Object.assign(fresh(), await DB.get('settings', CFG_ID).catch(() => null) || {});
    cfg.cash = Object.assign(fresh().cash, cfg.cash);
    return cfg;
  }
  const saveCfg = () => DB.put('settings', cfg).catch(() => {});
  const all = async pre => (await DB.all('room').catch(() => [])).filter(r => r.id.startsWith(pre));

  // ===== 家計の計算 =====
  const ym = (d = D.today()) => d.slice(0, 7);
  const daysIn = m => new Date(+m.slice(0, 4), +m.slice(5, 7), 0).getDate();
  const FIXED_KIND = ['家賃', '光熱費', '通信', 'サブスク', '保険', 'ローン', 'その他'];
  // 貯金を始める月から期限の月まで、何か月あるか
  function saveMonths(c) {
    if (!c.goalBy) return 0;
    const [gy, gm] = c.goalBy.split('-').map(Number);
    const st = c.start && c.start > D.today() ? c.start : D.today(), sy = +st.slice(0, 4), sm = +st.slice(5, 7);
    return Math.max(1, (gy - sy) * 12 + (gm - sm) + 1);
  }
  const isPrep = (c = cfg.cash) => !!c.start && D.today() < c.start;   // 貯金の開始前（準備期間）
  const daysTo = d => Math.round((D.parse(d) - D.parse(D.today())) / 86400000);
  function nextPayday(c) {
    const t = D.today(), m = ym(t), pd = Math.min(c.payday || 25, daysIn(m)), k = `${m}-${p2(pd)}`;
    if (k >= t) return k;
    const d = new Date(+m.slice(0, 4), +m.slice(5, 7), 1), m2 = `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;
    return `${m2}-${p2(Math.min(c.payday || 25, daysIn(m2)))}`;
  }
  async function cashSum(m = ym()) {
    const c = cfg.cash, ents = (await all('cash-')).filter(e => e.date.startsWith(m)), plans = (await all('plan-')).filter(p => p.date.startsWith(m));
    const fixed = c.fixed.reduce((a, f) => a + (+f.amt || 0), 0);
    const bonus = (c.bonus || []).filter(b => +b.m === +m.slice(5, 7)).reduce((a, b) => a + (+b.amt || 0), 0);
    const left = c.goal > c.saved ? saveMonths(c) : 0, saveM = left ? Math.ceil((c.goal - c.saved) / left) : 0;
    const startM = c.start ? ym(c.start) : '';
    const saving = !startM || m >= startM;   // この月は積立の対象か
    const extra = ents.filter(e => e.kind === 'in').reduce((a, e) => a + e.amt, 0);
    const spent = ents.filter(e => e.kind !== 'in').reduce((a, e) => a + e.amt, 0);
    const planLeft = plans.filter(p => !p.done).reduce((a, p) => a + p.amt, 0);
    const budget = c.income + bonus - fixed - (saving ? saveM : 0) + extra;
    const remain = budget - spent - planLeft;
    const today = D.today(), dLeft = m === ym() ? daysIn(m) - (+today.slice(8, 10)) + 1 : daysIn(m);
    const byCat = {}; ents.filter(e => e.kind !== 'in').forEach(e => byCat[e.cat] = (byCat[e.cat] || 0) + e.amt);
    const todaySpent = ents.filter(e => e.date === today && e.kind !== 'in').reduce((a, e) => a + e.amt, 0);
    return { m, ents, plans, fixed, bonus, saveM, saving, extra, spent, planLeft, budget, remain, dLeft, perDay:Math.floor(remain / Math.max(1, dLeft)), byCat, todaySpent,
      ready:c.income > 0, prep:isPrep(c) };
  }
  const sumForAI = s => ({ 今月の予算:s.budget, 使った:s.spent, 支払い予定の残り:s.planLeft, あと使える:s.remain, 残り日数:s.dLeft, 一日あたり:s.perDay, 今日使った:s.todaySpent, 分類別:s.byCat,
    貯金の積立:s.saving ? s.saveM : 0, 給料日:cfg.cash.income ? nextPayday(cfg.cash) : '未設定', 準備期間:s.prep ? `貯金は${cfg.cash.start}から` : 'いいえ' });

  // ===== 食事の計算 =====
  function target() {
    const f = cfg.food, bmr = 10 * f.w + 6.25 * f.h - 5 * f.age + 5, k = Math.round((bmr * f.act - (f.mode === 'cut' ? 400 : 0)) / 10) * 10;
    return { kcal:k, bmr:Math.round(bmr), p:Math.round(k * .22 / 4), f:Math.round(k * .25 / 9), c:Math.round(k * .53 / 4) };
  }
  async function dayRec(d) { return (await DB.get('room', 'food-' + d).catch(() => null)) || { id:'food-' + d, date:d, meals:{} }; }
  const tot = r => Object.values(r.meals || {}).reduce((a, m) => ({ kcal:a.kcal + (m.kcal || 0), p:a.p + (m.p || 0), f:a.f + (m.f || 0), c:a.c + (m.c || 0) }), { kcal:0, p:0, f:0, c:0 });
  const foodForAI = r => Object.fromEntries(SLOTS.map(([k, n]) => { const m = (r.meals || {})[k]; return [n, !m ? '未記録' : m.st === 'skip' ? '抜いた' : `${m.text}（約${m.kcal || '?'}kcal）`]; }));

  // ===== API =====
  async function loadApi() { api = await DB.get('settings', 'opsApi').catch(() => null); return api && api.url; }
  async function call(action, body) {
    if (!api || !api.url) throw new Error('noapi');
    const ac = new AbortController(), to = setTimeout(() => ac.abort(), 60000);
    try {
      const r = await fetch(api.url, { method:'POST', body:JSON.stringify(Object.assign({ key:api.key, action }, body)), signal:ac.signal, cache:'no-store' });
      const j = JSON.parse(await r.text());
      if (j.budget && typeof Stats !== 'undefined') Stats.noteAI(j.budget);
      if (j.error) throw new Error(j.error);
      return j;
    } finally { clearTimeout(to); }
  }
  const nowStr = () => { const d = new Date(); return `${D.ymd(D.today())}（${D.dow(D.today())}）${p2(d.getHours())}:${p2(d.getMinutes())}`; };

  // ===== 入口 =====
  function makeDoor() {
    const s = h(`<div class="slide odoor"><div class="odbox"><img class="odc" src="office_door.jpg" alt=""><img class="odo" src="office_door_open.jpg" alt="">
      <div class="oplate">執務室<small>OFFICE</small></div><img class="ostk a" src="dc_stk6.webp" alt=""><img class="ostk b" src="dc_stk11.webp" alt=""><i class="otape"></i>
      <div class="obadge" id="ofBadge"></div></div><div class="rhint">TAP TO ENTER</div><div class="rflash"></div></div>`);
    slidesEl.insertBefore(s, slidesEl.firstChild);
    const box = s.querySelector('.odbox'), fit = () => fitBox(box, 1027, 1531, 940);
    fit(); addEventListener('resize', fit);
    let tx = 0, ty = 0;
    s.addEventListener('pointerdown', e => { tx = e.clientX; ty = e.clientY; });
    s.addEventListener('pointerup', e => { if (Math.hypot(e.clientX - tx, e.clientY - ty) < 10) openDoor(s); });
    return s;
  }
  function fitBox(box, w, hh, keepX) {
    const p = box.parentNode, PW = p.clientWidth, PH = p.clientHeight; if (!PW) return;
    const s = Math.max(PW / w, PH / hh);
    let left = (PW - w * s) / 2;
    if (keepX && left + keepX * s > PW - 6) left = Math.max(PW - w * s, PW - 6 - keepX * s);
    Object.assign(box.style, { width:w * s + 'px', height:hh * s + 'px', left:left + 'px', top:(PH - hh * s) / 2 + 'px' });
    box.style.setProperty('--u', s + 'px');
  }
  async function paintDoor() {
    const b = $('ofBadge'); if (!b) return;
    await loadCfg();
    const r = await dayRec(D.today()), n = Object.keys(r.meals || {}).length, hr = new Date().getHours();
    b.innerHTML = hr >= 9 && n === 0 ? '<span class="nt">ごはん<br>記録まだ</span>' : '';
  }
  async function openDoor(s) {
    if (s.classList.contains('opening')) return;
    ctx.resume(); haptic();
    s.classList.add('opening', 'opened');
    await sleep(750); s.classList.add('flash');
    await sleep(380); await enter();
    setTimeout(() => s.classList.remove('opening', 'opened', 'flash'), 600);
  }
  function setDoor(v) {
    if (onDoor === v) return;
    onDoor = v; document.body.classList.toggle('atOfficeDoor', v);
    if (v) { paintDoor(); const i = new Image(); i.src = 'office_door_open.jpg'; Object.values(FACES).forEach(f => { const x = new Image(); x.src = f; }); }
  }

  // ===== 画面 =====
  function build() {
    el = h(`<div id="office">
      <video class="ofv" id="ofV" muted playsinline loop preload="auto" poster="${VIDEO.poster}" src="${VIDEO.src}"></video>
      <div class="ofaces">${Object.entries(FACES).map(([k, f]) => `<img data-face="${k}" src="${f}" alt="">`).join('')}</div>
      <div class="ofhud"><button class="ofback" id="ofBack">‹ 出る</button><div class="ofttl"><b>OFFICE</b><span>セミナー会計 出張所</span></div>
        <button class="ofbtn" id="ofTalk">話す</button><button class="ofbtn ic" id="ofSet" aria-label="設定"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/></svg></button></div>
      <div class="ofw" id="ofW"><i class="tp1"></i><img class="sk1" src="dc_stk4.webp" alt=""><img class="sk2" src="dc_stk11.webp" alt="">
        <div class="ofh"><span class="dot"></span><div class="ofts"><button data-tab="cash" class="on">Cash</button><button data-tab="food">Food</button></div><span class="tm" id="ofTm"></span><button class="fold" id="ofFold" aria-label="たたむ">▾</button></div>
        <div class="ofb" id="ofB"></div></div>
      <div class="omw" id="ofMW"><div class="who"><b>ユウカ</b><span>セミナー</span></div><div class="tx" id="ofMT"></div><i class="nx"></i>
        <div class="ochips" id="ofChips"></div><div class="oinp" id="ofInp"><input id="ofIn" autocomplete="off" enterkeyhint="send"><button id="ofSend">送る</button></div></div>
      <div id="ofOv"></div>
    </div>`);
    document.body.appendChild(el);
    el.addEventListener('click', onClick);
    $('ofBack').onclick = exit;
    $('ofTalk').onclick = () => { sfx('tap'); talk(); };
    $('ofSet').onclick = () => { sfx('tap'); openSettings(); };
    $('ofFold').onclick = () => { sfx('tap'); el.classList.toggle('folded'); };
    $('ofMW').addEventListener('click', e => { if (!e.target.closest('.oinp,.ochips')) advance(); });
  }
  function sfx(k) {
    try {
      const t = ctx.currentTime, g = ctx.createGain(); g.gain.value = .3; g.connect(ctx.destination);
      const tone = (f, a, d, at = 0, type = 'triangle') => { const o = ctx.createOscillator(), gg = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t + at); gg.gain.setValueAtTime(0, t + at); gg.gain.linearRampToValueAtTime(a, t + at + .01); gg.gain.exponentialRampToValueAtTime(.0001, t + at + d); o.connect(gg); gg.connect(g); o.start(t + at); o.stop(t + at + d + .05); };
      if (k === 'tap') tone(1175, .12, .1);
      if (k === 'msg') tone(880, .1, .08);
      if (k === 'ok') { tone(988, .14, .12); tone(1319, .14, .2, .07); }
      if (k === 'coin') { tone(1976, .12, .08, 0, 'square'); tone(2637, .12, .22, .06, 'square'); }
    } catch(e) {}
  }
  const clock = () => { const d = new Date(), t = $('ofTm'); if (t) t.textContent = `${p2(d.getHours())}:${p2(d.getMinutes())}`; };
  function setFace(f) { el.querySelectorAll('.ofaces img').forEach(i => i.classList.toggle('on', i.dataset.face === f)); el.classList.toggle('faced', !!f); }

  // ===== メッセージウィンドウ =====
  let queue = [], typing = 0, waitDone = null, asking = null;
  function mwOpen() { el.classList.add('talking'); $('ofMW').classList.add('on'); }
  function mwClose() {
    el.classList.remove('talking'); $('ofMW').classList.remove('on'); setFace(null);
    $('ofChips').innerHTML = ''; $('ofInp').classList.remove('on'); asking = null; queue = [];
    if (waitDone) { const f = waitDone; waitDone = null; f(); }
  }
  function typeLine(text) {
    const t = $('ofMT'); clearInterval(typing); t.textContent = ''; let i = 0; sfx('msg');
    typing = setInterval(() => { i += 2; t.textContent = text.slice(0, i); if (i >= text.length) { clearInterval(typing); typing = 0; } }, 28);
    t._full = text;
  }
  // セリフを順に出す（タップで送る）。face：表情
  function say(lines, face = 'normal') {
    lines = (Array.isArray(lines) ? lines : [lines]).filter(Boolean);
    if (!lines.length) return Promise.resolve();
    mwOpen(); setFace(FACES[face] ? face : 'normal');
    $('ofInp').classList.remove('on'); $('ofChips').innerHTML = '';
    queue = lines.slice(1); typeLine(lines[0]);
    return new Promise(r => { waitDone = r; });
  }
  function advance() {
    if (asking) return;
    const t = $('ofMT');
    if (typing) { clearInterval(typing); typing = 0; t.textContent = t._full; return; }
    if (queue.length) return typeLine(queue.shift());
    if (waitDone) { const f = waitDone; waitDone = null; f(); }
  }
  // 質問して答えを待つ（type: text / number）。chips：候補のボタン
  function ask(q, opt = {}) {
    mwOpen(); setFace(opt.face || 'normal'); typeLine(q);
    const inp = $('ofIn'), box = $('ofInp');
    inp.value = opt.value || ''; inp.type = opt.type === 'number' ? 'text' : 'text'; inp.inputMode = opt.type === 'number' ? 'numeric' : 'text';
    inp.placeholder = opt.ph || ''; box.classList.add('on');
    $('ofChips').innerHTML = (opt.chips || []).map((c, i) => `<button data-chip="${i}">${esc(c)}</button>`).join('') + '<button data-chip="x" class="x">やめる</button>';
    setTimeout(() => inp.focus(), 80);
    return new Promise(res => {
      const done = v => { asking = null; box.classList.remove('on'); $('ofChips').innerHTML = ''; inp.blur(); res(v); };
      asking = done;
      $('ofSend').onclick = () => { const v = inp.value.trim(); if (!v) return; done(v); };
      inp.onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); $('ofSend').onclick(); } };
      $('ofChips').onclick = e => { const b = e.target.closest('[data-chip]'); if (!b) return; sfx('tap'); done(b.dataset.chip === 'x' ? null : opt.chips[+b.dataset.chip]); };
    });
  }
  // 選択肢だけ出す
  function choose(q, opts, face = 'normal') {
    mwOpen(); setFace(face); typeLine(q); $('ofInp').classList.remove('on');
    $('ofChips').innerHTML = opts.map((c, i) => `<button data-chip="${i}" class="${c.cls || ''}">${c.html || esc(c.label)}</button>`).join('');
    return new Promise(res => {
      asking = v => { asking = null; $('ofChips').innerHTML = ''; res(v); };
      $('ofChips').onclick = e => { const b = e.target.closest('[data-chip]'); if (!b) return; sfx('tap'); asking(opts[+b.dataset.chip].v); };
    });
  }

  // ===== 描画 =====
  async function draw(keep) {
    el.querySelectorAll('.ofts button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    const b = $('ofB'), y = b.scrollTop;
    b.innerHTML = tab === 'cash' ? await cashHTML() : await foodHTML();
    b.scrollTop = keep === true ? y : 0;
  }
  let sub = 'plan', calSel = null, wishKind = 'buy';
  async function cashHTML() {
    const c = cfg.cash;
    if (!c.income) { sub = 'set'; return `<div class="osetup"><img src="dc_note1.webp" alt=""><p>まずは予算を決めましょう、先生。<br>手取り・固定費・貯金の目標を入れると、<br>「あと何円使えるか」を計算します。</p></div>` + await budgetHTML(); }
    const s = await cashSum(month), cur = month === ym();
    let top;
    if (s.prep && cur) {
      const dl = daysTo(c.start);
      top = `<div class="oprep"><img class="pin" src="dc_note7.webp" alt=""><small>準備期間</small><p>今は準備期間ですね。<br>帳尻0円で、貯金開始の<b>${D.md(c.start)}</b>を迎えられるよう頑張ってください。</p>
        <div class="cd"><span>貯金開始まで</span><b>${dl}</b><span>日</span></div></div>`;
    } else {
      const used = Math.max(0, Math.min(1, (s.spent + s.planLeft) / Math.max(1, s.budget)));
      top = `<div class="okpi ${s.remain < 0 ? 'over' : ''}"><small>${cur ? '今月あと使える' : 'この月の残り'}</small><b>${yen(s.remain)}</b>
        ${cur ? `<div class="pd"><span>1日あたり</span><em>${yen(Math.max(0, s.perDay))}</em><span>残り${s.dLeft}日</span></div>` : ''}
        <div class="obar"><i style="width:${used * 100}%"></i></div><div class="bl"><span>使った ${yen(s.spent)}</span><span>予定 ${yen(s.planLeft)}</span><span>予算 ${yen(s.budget)}</span></div></div>
        ${cur ? `<p class="opay">給料日まで あと<b>${daysTo(nextPayday(c))}</b>日（${D.md(nextPayday(c))}）</p><button class="orec" data-x="rec"><img src="cf_ui1.webp" alt="">記録する</button>` : ''}`;
    }
    const goalP = c.goal ? Math.min(1, c.saved / c.goal) : 0;
    const goal = c.goal ? `<div class="ocard goal"><h6>貯金の目標<em>${c.start ? `${D.md(c.start)}開始・` : ''}${c.goalBy ? `${c.goalBy.replace('-', '年')}月まで` : ''}</em></h6><div class="gl"><b>${yen(c.saved)}</b><span>/ ${yen(c.goal)}</span></div><div class="obar g"><i style="width:${goalP * 100}%"></i></div><p>毎月の積立 ${yen(s.saveM)}${s.prep ? '（開始月から予算に反映）' : '（予算から先に引いています）'}</p></div>` : '';
    const cats = Object.entries(s.byCat).sort((a, b) => b[1] - a[1]), mx = Math.max(1, ...cats.map(x => x[1]));
    const catCard = cats.length ? `<div class="ocard"><h6>分類ごと<em>${yen(s.spent)}</em></h6>${cats.map(([k, v]) => { const C = CAT[k] || CAT['その他']; return `<div class="ocat"><img src="${C.i}.webp" alt=""><span>${esc(k)}</span><b><i style="width:${v / mx * 100}%;background:${C.c}"></i></b><em>${yen(v)}</em></div>`; }).join('')}</div>` : '';
    const recent = s.ents.slice().sort((a, b) => b.date.localeCompare(a.date) || b.at - a.at).slice(0, 6);
    const recCard = recent.length ? `<div class="ocard"><h6>さいきんの記録</h6>${recent.map(e => { const C = CAT[e.cat] || CAT['その他']; return `<div class="orow" data-ent="${e.id}"><img src="${C.i}.webp" alt=""><span class="d">${D.md(e.date)}</span><span class="t">${esc(e.title)}<small>${esc(e.kind === 'in' ? '収入' : e.cat)}</small></span><b class="${e.kind === 'in' ? 'in' : ''}">${e.kind === 'in' ? '+' : '−'}${yen(e.amt)}</b></div>`; }).join('')}</div>` : '';
    const tabs = [['plan', '出費予定', 'dc_note2'], ['wish', '買いたいもの', 'dc_note3'], ['set', '予算の設定', 'dc_note4']];
    const body = sub === 'plan' ? await calHTML() : sub === 'wish' ? await wishHTML() : await budgetHTML();
    const checkable = !s.prep;
    return `<div class="omon"><button data-mon="-1">‹</button><b>${+s.m.slice(5)}月</b><span>${s.m.slice(0, 4)}</span><button data-mon="1">›</button></div>
      ${top}${goal}
      <div class="osub">${tabs.map(([k, n, i]) => `<button data-sub="${k}" class="${k === sub ? 'on' : ''}"><img src="${i}.webp" alt="">${n}</button>`).join('')}</div>
      <div class="osubb">${body}</div>
      <button class="ochk" data-x="check" ${checkable ? '' : 'disabled'}><img src="dc_stk4.webp" alt=""><span>ユウカにチェックしてもらう<small>${checkable ? `${s.prep ? '' : (c.start && ym(c.start) === s.m ? D.md(c.start) : (+s.m.slice(5)) + '/1')}から今日までを分析します` : `${D.md(c.start)}から使えます`}</small></span></button>
      ${catCard}${recCard}`;
  }
  // 出費予定（カレンダー）
  async function calHTML() {
    const m = month, ents = (await all('cash-')).filter(e => e.date.startsWith(m)), plans = (await all('plan-')).filter(p => p.date.startsWith(m));
    const out = {}, inc = {}; ents.forEach(e => { const o = e.kind === 'in' ? inc : out; o[e.date] = (o[e.date] || 0) + e.amt; });
    const tIn = Object.values(inc).reduce((a, b) => a + b, 0), tOut = Object.values(out).reduce((a, b) => a + b, 0);
    const first = new Date(+m.slice(0, 4), +m.slice(5, 7) - 1, 1).getDay(), n = daysIn(m);
    const short = v => v >= 10000 ? (v / 10000).toFixed(v >= 100000 ? 0 : 1) + '万' : v.toLocaleString();
    let cells = ''; for (let i = 0; i < first; i++) cells += '<i></i>';
    for (let d = 1; d <= n; d++) {
      const k = `${m}-${p2(d)}`, ps = plans.filter(p => p.date === k), pay = cfg.cash.income && +(cfg.cash.payday || 25) === d;
      cells += `<button data-cd="${k}" class="${k === D.today() ? 'tdy' : ''} ${k === calSel ? 'sel' : ''} ${k < (cfg.cash.start || '') ? 'pre' : ''}"><b>${d}</b>
        ${inc[k] ? `<small class="in">+${short(inc[k])}</small>` : ''}${out[k] ? `<small class="out">−${short(out[k])}</small>` : ''}
        ${ps.length ? `<em class="${ps.every(p => p.done) ? 'ok' : ''}">${ps.every(p => p.done) ? '✓' : ''}</em>` : ''}${pay ? '<u>給</u>' : ''}${k === cfg.cash.start ? '<s>START</s>' : ''}</button>`;
    }
    let detail = '';
    if (calSel && calSel.startsWith(m)) {
      const de = ents.filter(e => e.date === calSel), dp = plans.filter(p => p.date === calSel);
      detail = `<div class="ocdl"><h6>${D.md(calSel)}（${D.dow(calSel)}）</h6>
        ${dp.map(p => `<div class="orow plan ${p.done ? 'done' : ''}" data-pl="${p.id}"><span class="pk ${p.done ? 'ok' : ''}">${p.done ? '支払い済み' : '予定'}</span><span class="t">${esc(p.title)}</span><b>${yen(p.amt)}</b></div>`).join('')}
        ${de.map(e => { const C = CAT[e.cat] || CAT['その他']; return `<div class="orow" data-ent="${e.id}"><img src="${C.i}.webp" alt=""><span class="t">${esc(e.title)}<small>${esc(e.kind === 'in' ? '収入' : e.cat)}</small></span><b class="${e.kind === 'in' ? 'in' : 'out'}">${e.kind === 'in' ? '+' : '−'}${yen(e.amt)}</b></div>`; }).join('')}
        ${!de.length && !dp.length ? '<p class="oem">この日の記録・予定はありません</p>' : ''}
        <div class="padd"><input id="pT" placeholder="支払いの名前"><input id="pA" inputmode="numeric" placeholder="金額"><button data-padd="1">この日に予定を追加</button></div></div>`;
    }
    return `<div class="ocsum"><div class="in"><small>収入</small><b>+${yen(tIn)}</b></div><div class="out"><small>支出</small><b>−${yen(tOut)}</b></div><div class="${tIn - tOut >= 0 ? 'in' : 'out'}"><small>収支</small><b>${tIn - tOut >= 0 ? '+' : ''}${yen(tIn - tOut)}</b></div></div>
      <div class="ocalw">${'日月火水木金土'.split('').map(x => `<span>${x}</span>`).join('')}</div><div class="ocal">${cells}</div>
      <p class="olg"><span class="in">＋収入</span><span class="out">−出費</span><span class="pl">●予定</span><span class="ok">✓支払い済み</span><span class="py">給 給料日</span></p>
      ${detail || '<p class="oem">日付をタップすると、明細と「予定を追加」が出ます</p>'}`;
  }
  // 買いたいもの・やりたいこと
  async function wishHTML() {
    const list = (await all('wish-')).filter(w => w.kind === wishKind).sort((a, b) => (a.done - b.done) || (b.pri - a.pri) || a.at - b.at);
    const sum = list.filter(w => !w.done).reduce((a, w) => a + (w.price || 0), 0);
    return `<div class="owk2"><button data-wk="buy" class="${wishKind === 'buy' ? 'on' : ''}">買いたいもの</button><button data-wk="do" class="${wishKind === 'do' ? 'on' : ''}">やりたいこと</button></div>
      ${sum ? `<p class="owsum">まだの分の合計 <b>${yen(sum)}</b></p>` : ''}
      ${list.length ? list.map(w => `<div class="owish ${w.done ? 'done' : ''}" data-wish="${w.id}"><button class="ck" data-wck="${w.id}">${w.done ? '✓' : ''}</button>
        <span class="t"><b>${esc(w.title)}</b>${w.memo ? `<small>${esc(w.memo)}</small>` : ''}</span><span class="pr">${'★'.repeat(w.pri || 1)}</span>${w.price ? `<em>${yen(w.price)}</em>` : ''}
        ${w.done ? '<img class="st" src="dc_stamp1.webp" alt="">' : ''}</div>`).join('') : `<p class="oem">${wishKind === 'buy' ? '欲しいものを書いておくと、ユウカが予算と相談してくれます' : 'やってみたいことを、気軽に書いておきましょう'}</p>`}
      <div class="wadd"><input id="wT" placeholder="${wishKind === 'buy' ? '欲しいもの' : 'やりたいこと'}"><input id="wP" inputmode="numeric" placeholder="${wishKind === 'buy' ? 'だいたいの金額' : '金額（なくてもOK）'}">
        <select id="wR"><option value="1">★</option><option value="2" selected>★★</option><option value="3">★★★</option></select><button data-wadd="1">追加</button></div>`;
  }
  // 予算の設定（ページの中で直接編集）
  async function budgetHTML() {
    const c = cfg.cash, s = await cashSum(ym(c.start && c.start > D.today() ? c.start : D.today()));
    const free = Math.max(0, c.income - s.fixed - s.saveM), W = Math.max(1, c.income);
    const seg = c.income ? `<div class="oflow"><i class="fx" style="width:${s.fixed / W * 100}%"></i><i class="sv" style="width:${s.saveM / W * 100}%"></i><i class="fr" style="width:${free / W * 100}%"></i></div>
      <p class="olg"><span class="fx">固定費 ${yen(s.fixed)}</span><span class="sv">積立 ${yen(s.saveM)}</span><span class="fr">自由 ${yen(free)}</span></p>` : '';
    return `<div class="obud">${seg}
      <h6>収入</h6>
      <label>毎月の手取り<input id="sInc" inputmode="numeric" value="${c.income || ''}" placeholder="例：280000"></label>
      <label>給料日<span class="sfx"><input id="sPay" inputmode="numeric" value="${c.payday || ''}" placeholder="25">日</span></label>
      <div class="fx"><p>ボーナス<small>（月と手取り額）</small></p>${(c.bonus || []).map((b, i) => `<div class="fxr"><span>${b.m}月</span><b>${yen(b.amt)}</b><button data-bnd="${i}">×</button></div>`).join('')}
        <div class="fxr add"><input id="sBm" inputmode="numeric" placeholder="月"><input id="sBa" inputmode="numeric" placeholder="金額"><button data-bna="1">＋</button></div></div>
      <h6>固定費</h6>
      <div class="fx">${c.fixed.map((x, i) => `<div class="fxr"><span class="k">${esc(x.kind || 'その他')}</span><span>${esc(x.n)}${x.day ? `<small>${x.day}日</small>` : ''}</span><b>${yen(x.amt)}</b><button data-fxd="${i}">×</button></div>`).join('') || '<p class="oem">家賃・通信・サブスクなど</p>'}
        <div class="fxr add"><select id="sFk">${FIXED_KIND.map(k => `<option>${k}</option>`).join('')}</select><input id="sFn" placeholder="名前"><input id="sFa" inputmode="numeric" placeholder="金額"><input id="sFd" inputmode="numeric" placeholder="日"><button data-fxa="1">＋</button></div></div>
      <h6>貯金</h6>
      <label>今の貯金額<input id="sSv" inputmode="numeric" value="${c.saved || ''}" placeholder="0"></label>
      <label>目標額<input id="sGl" inputmode="numeric" value="${c.goal || ''}" placeholder="例：500000"></label>
      <label>開始日<input id="sSt" type="date" value="${c.start || ''}"></label>
      <label>期限<input id="sBy" type="month" value="${c.goalBy || ''}"></label>
      <button class="save" data-bsave="1">保存する</button></div>`;
  }
  async function foodHTML() {
    const d = foodDay || D.today(), r = await dayRec(d), t = tot(r), T = target(), left = T.kcal - t.kcal, rate = Math.min(1.25, t.kcal / T.kcal);
    const ring = (() => { const R = 46, C = 2 * Math.PI * R, a = Math.min(1, rate); return `<svg viewBox="0 0 110 110"><circle cx="55" cy="55" r="${R}" class="rb"/><circle cx="55" cy="55" r="${R}" class="rf ${rate > 1.05 ? 'over' : ''}" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - a)}"/></svg>`; })();
    const pfc = [['たんぱく質', t.p, T.p, '#5cc8a8'], ['脂質', t.f, T.f, '#ffb84d'], ['炭水化物', t.c, T.c, '#7cb8ff']];
    const all3 = ['b', 'l', 'd'].every(k => r.meals[k]);
    const week = await Promise.all(Array.from({ length:7 }, (_, i) => D.add(d, i - 6)).map(async x => [x, tot(await dayRec(x)).kcal]));
    const wmax = Math.max(T.kcal * 1.2, ...week.map(w => w[1]));
    return `<div class="omon"><button data-day="-1">‹</button><b>${D.md(d)}</b><span>${D.dow(d)}</span><button data-day="1" ${d >= D.today() ? 'disabled' : ''}>›</button></div>
      <div class="ofood"><div class="ring">${ring}<div class="rt"><small>${left >= 0 ? 'あと' : 'オーバー'}</small><b>${Math.abs(left).toLocaleString()}</b><span>kcal</span></div></div>
        <div class="pfc"><p class="tg">目標 ${T.kcal.toLocaleString()}kcal<small>${cfg.food.mode === 'cut' ? '（少し控えめ）' : '（維持）'}</small></p>${pfc.map(([n, v, g, c]) => `<div><span>${n}</span><b><i style="width:${Math.min(100, v / g * 100)}%;background:${c}"></i></b><em>${v}<small>/${g}g</small></em></div>`).join('')}</div>
        ${all3 ? '<img class="ostamp" src="dc_stamp1.webp" alt="">' : ''}</div>
      ${r.next ? `<div class="onext"><img src="dc_note7.webp" alt=""><span>ユウカのおすすめ：<b>${esc(r.next)}</b></span></div>` : ''}
      <div class="omeals">${SLOTS.map(([k, n, en]) => { const m = r.meals[k];
        return `<button class="omeal ${m ? (m.st === 'skip' ? 'skip' : 'ate') : ''}" data-meal="${k}"><span class="mh"><b>${n}</b><small>${en}</small></span>
          <span class="mb">${!m ? '<i class="add">＋ 記録する</i>' : m.st === 'skip' ? '<i class="sk">食べなかった</i>' : `${esc(m.text)}`}</span>
          ${m && m.st !== 'skip' ? `<em>${m.kcal != null ? m.kcal.toLocaleString() + '<small>kcal</small>' : '<small>未計算</small>'}</em>` : ''}</button>`; }).join('')}</div>
      <div class="ocard"><h6>体重<em>入れたい日だけでOK</em></h6><div class="owt"><input id="ofWt" inputmode="decimal" placeholder="${cfg.food.w}" value="${r.weight || ''}"><span>kg</span><button data-x="wt">記録</button></div></div>
      <div class="ocard"><h6>この1週間<em>目標 ${T.kcal.toLocaleString()}kcal</em></h6><div class="owk">${week.map(([x, v]) => `<div class="${x === d ? 'on' : ''}"><b style="height:${v / wmax * 100}%" class="${v > T.kcal * 1.05 ? 'over' : ''}"></b><span>${D.dow(x)}</span></div>`).join('')}<i class="tl" style="bottom:${T.kcal / wmax * 100}%"></i></div></div>
      <p class="onote">カロリーと栄養素はAIによる目安です。基準：基礎代謝 約${T.bmr.toLocaleString()}kcal</p>`;
  }

  // ===== クリック =====
  async function onClick(e) {
    const t = e.target;
    const tb = t.closest('[data-tab]'); if (tb) { sfx('tap'); tab = tb.dataset.tab; return draw(); }
    const mo = t.closest('[data-mon]'); if (mo && !mo.disabled) { sfx('tap'); const [y, m] = month.split('-').map(Number), d = new Date(y, m - 1 + +mo.dataset.mon, 1); month = `${d.getFullYear()}-${p2(d.getMonth() + 1)}`; calSel = null; return draw(true); }
    const dy = t.closest('[data-day]'); if (dy && !dy.disabled) { sfx('tap'); foodDay = D.add(foodDay || D.today(), +dy.dataset.day); return draw(); }
    const x = t.closest('[data-x]');
    if (x) {
      sfx('tap'); const k = x.dataset.x;
      if (k === 'rec') return recordCash();
      if (k === 'check') return cashCheck();
      if (k === 'wt') return saveWeight();
    }
    const ml = t.closest('[data-meal]'); if (ml) { sfx('tap'); return recordMeal(ml.dataset.meal); }
    const en = t.closest('[data-ent]'); if (en) { sfx('tap'); return editEntry(en.dataset.ent); }
    const sb = t.closest('[data-sub]'); if (sb) { sfx('tap'); stashBudget(); sub = sb.dataset.sub; return draw(true); }
    const cd = t.closest('[data-cd]'); if (cd) { sfx('tap'); calSel = cd.dataset.cd; return draw(true); }
    if (t.closest('[data-padd]')) {
      const tt = $('pT').value.trim(), a = vnum('pA'); if (!tt || !a) return toast('名前と金額を入れてください');
      await DB.put('room', { id:'plan-' + newId(), title:tt.slice(0, 20), amt:a, date:calSel, done:false }); sfx('ok'); return draw(true);
    }
    const pl = t.closest('[data-pl]'); if (pl) { sfx('tap'); return planMenu(pl.dataset.pl); }
    const wk = t.closest('[data-wk]'); if (wk) { sfx('tap'); wishKind = wk.dataset.wk; return draw(true); }
    const wc = t.closest('[data-wck]'); if (wc) { sfx('tap'); const w = await DB.get('room', wc.dataset.wck); if (w) toggleWish(w); return; }
    if (t.closest('[data-wadd]')) {
      const tt = $('wT').value.trim(); if (!tt) return toast(wishKind === 'buy' ? '欲しいものを書いてください' : 'やりたいことを書いてください');
      await DB.put('room', { id:'wish-' + newId(), kind:wishKind, title:tt.slice(0, 30), price:vnum('wP'), pri:+$('wR').value || 2, memo:'', done:false, at:Date.now() }); sfx('ok'); return draw(true);
    }
    const ws = t.closest('[data-wish]'); if (ws && !t.closest('.ck')) { sfx('tap'); return wishMenu(ws.dataset.wish); }
    if (t.closest('.obud') && await budgetClick(t) !== false) return;
  }

  // ===== 家計簿：記録 =====
  async function recordCash() {
    const recent = [...new Set((await all('cash-')).sort((a, b) => b.at - a.at).map(e => e.title))].slice(0, 4);
    const what = await ask('先生、何に使いました？', { ph:'例：コンビニで昼ごはん', chips:['収入を記録', ...recent] });
    if (!what) return mwClose();
    if (what === '収入を記録') return recordIncome();
    const v = await ask(`「${what}」ですね。いくらでした？`, { type:'number', ph:'例：680' });
    const amt = Math.round(+String(v || '').replace(/[^\d.]/g, ''));
    if (!amt) return mwClose();
    const ent = { id:'cash-' + newId(), date:D.today(), at:Date.now(), title:what.slice(0, 20), amt, kind:'out', cat:guessCat(what) };
    await DB.put('room', ent); sfx('coin');
    $('ofMT').textContent = '……計算中です'; setFace('normal');
    let lines, face = 'normal';
    if (await loadApi()) {
      try {
        const s = await cashSum();
        const r = await call('cash', { now:nowStr(), what, amount:amt, sum:sumForAI(s), cats:CATS.map(c => c[0]) });
        if (r.cat && CAT[r.cat]) ent.cat = r.cat; if (r.title) ent.title = r.title;
        await DB.put('room', ent); lines = r.lines; face = r.face;
      } catch(e) {}
    }
    if (!lines || !lines.length) { const s = await cashSum(); lines = [s.remain < 0 ? `先生、今月の予算を${yen(-s.remain)}超えてます……！` : `記録しました。今月はあと${yen(s.remain)}、1日あたり${yen(Math.max(0, s.perDay))}です`]; face = s.remain < 0 ? 'panic' : 'smile'; }
    draw();
    await say(lines, face);
    const nx = await choose(`分類は「${ent.cat}」にしました`, [{ label:'もう1件', v:'more' }, { html:`分類を変える`, v:'cat' }, { label:'閉じる', v:'close', cls:'x' }], face);
    if (nx === 'more') return recordCash();
    if (nx === 'cat') return changeCat(ent);
    mwClose();
  }
  async function recordIncome() {
    const v = await ask('臨時の収入ですか？ 金額を教えてください（毎月の手取りは設定に入れてください）', { type:'number', ph:'例：5000' });
    const amt = Math.round(+String(v || '').replace(/[^\d.]/g, '')); if (!amt) return mwClose();
    const ttl = await ask('何のお金ですか？', { ph:'例：立て替えの返金', chips:['臨時収入', '返金', 'お小遣い'] });
    await DB.put('room', { id:'cash-' + newId(), date:D.today(), at:Date.now(), title:(ttl || '臨時収入').slice(0, 20), amt, kind:'in', cat:'その他' });
    sfx('coin'); draw(); const s = await cashSum();
    await say([`${yen(amt)}、記録しました！ 今月はあと${yen(s.remain)}です`], 'smile'); mwClose();
  }
  async function changeCat(ent) {
    const v = await choose('どの分類にしますか？', CATS.map(([n, i]) => ({ html:`<img src="${i}.webp" alt="">${n}`, v:n })));
    ent.cat = v; await DB.put('room', ent); draw(); sfx('ok');
    await say([`「${v}」に直しました`], 'smile'); mwClose();
  }
  async function editEntry(id) {
    const e = await DB.get('room', id); if (!e) return;
    Menu.open(`${D.md(e.date)} ${e.title}　${yen(e.amt)}`, [
      { label:'金額を直す', fn:async () => { const v = prompt('金額', e.amt); const n = Math.round(+String(v || '').replace(/[^\d]/g, '')); if (n) { e.amt = n; await DB.put('room', e); draw(); } } },
      { label:'名前を直す', fn:async () => { const v = prompt('名前', e.title); if (v) { e.title = v.slice(0, 20); await DB.put('room', e); draw(); } } },
      { label:'分類を変える', fn:() => changeCat(e) },
      { label:'この記録を消す', danger:true, fn:async () => { if (!confirm('この記録を消しますか？')) return; await DB.del('room', id); draw(); } },
    ]);
  }

  // ===== 出費予定 =====
  async function markPaid(p) {
    p.done = true; await DB.put('room', p);
    await DB.put('room', { id:'cash-' + newId(), date:D.today() < p.date ? D.today() : p.date, at:Date.now(), title:p.title, amt:p.amt, kind:'out', cat:guessCat(p.title) });
    sfx('coin'); draw();
  }
  async function planMenu(id) {
    const p = await DB.get('room', id); if (!p) return;
    Menu.open(`${p.title}　${yen(p.amt)}（${D.md(p.date)}）`, [
      ...(p.done ? [{ label:'未払いに戻す', fn:async () => { p.done = false; await DB.put('room', p); draw(); } }] : [{ label:'払った（家計簿に記録）', fn:() => markPaid(p) }]),
      { label:'この予定を消す', danger:true, fn:async () => { await DB.del('room', p.id); draw(); } },
    ]);
  }
  // 期限が来た予定を聞く
  async function askDuePlans() {
    const due = (await all('plan-')).filter(p => !p.done && p.date <= D.today());
    for (const p of due) {
      const v = await choose(`先生、${D.md(p.date)}の「${p.title}」${yen(p.amt)}、もう払いましたか？`, [{ label:'払った', v:'y' }, { label:'まだ', v:'n' }], 'normal');
      if (v === 'y') await markPaid(p);
    }
    if (due.length) mwClose();
    return due.length;
  }
  // 買いたいもの
  async function wishMenu(id) {
    const w = await DB.get('room', id); if (!w) return;
    Menu.open(`${w.title}${w.price ? '　' + yen(w.price) : ''}`, [
      { label:w.done ? (w.kind === 'buy' ? 'まだ買っていない' : 'まだやっていない') : (w.kind === 'buy' ? '買った！' : 'やった！'), fn:() => toggleWish(w) },
      ...(w.kind === 'buy' && !w.done && w.price ? [{ label:'買った！（家計簿にも記録）', fn:async () => { await toggleWish(w); await DB.put('room', { id:'cash-' + newId(), date:D.today(), at:Date.now(), title:w.title.slice(0, 20), amt:w.price, kind:'out', cat:guessCat(w.title) }); draw(); } }] : []),
      { label:'メモを書く', fn:async () => { const v = prompt('メモ', w.memo || ''); if (v != null) { w.memo = v.slice(0, 60); await DB.put('room', w); draw(); } } },
      { label:'消す', danger:true, fn:async () => { await DB.del('room', w.id); draw(); } },
    ]);
  }
  async function toggleWish(w) { w.done = !w.done; w.doneAt = w.done ? Date.now() : null; await DB.put('room', w); if (w.done) sfx('ok'); draw(); }
  // ユウカのチェック（その月の1日、または貯金の開始日から今日まで）
  async function cashCheck() {
    const c = cfg.cash, from = c.start && ym(c.start) === ym() ? c.start : ym() + '-01';
    if (!(await loadApi())) { await say(['AIの設定をすると、チェックできますよ'], 'normal'); return mwClose(); }
    mwOpen(); setFace('normal'); typeLine('……帳簿を確認しています');
    try {
      const s = await cashSum(ym()), ents = s.ents.filter(e => e.date >= from).map(e => `${e.date.slice(5)} ${e.kind === 'in' ? '収入' : e.cat} ${e.title} ${e.amt}円`);
      const wish = (await all('wish-')).filter(w => !w.done && w.kind === 'buy').map(w => `${w.title}${w.price ? ' ' + w.price + '円' : ''}（優先度${w.pri}）`);
      const r = await call('cashcheck', { now:nowStr(), from, sum:sumForAI(s), ents:ents.slice(-80), wish, goal:{ 目標額:c.goal, 今の貯金:c.saved, 期限:c.goalBy, 毎月の積立:s.saveM } });
      await say(r.lines, r.face);
    } catch(e) { await say(['ごめんなさい、うまく確認できませんでした'], 'panic'); }
    mwClose();
  }

  // ===== 食事：記録 =====
  async function recordMeal(k) {
    const d = foodDay || D.today(), r = await dayRec(d), m = r.meals[k];
    const ov = $('ofOv');
    ov.innerHTML = `<div class="osh meal"><div class="sh"><b>${SLOT_NAME[k]}${k === 's' ? '' : 'ごはん'}</b><span>${D.md(d)}</span><button data-close="1">×</button></div>
      <textarea id="mT" placeholder="何を食べましたか？\n例：豚肉500gと茄子と小松菜、ごはん大盛り">${m && m.st !== 'skip' ? esc(m.text) : ''}</textarea>
      ${m && m.items && m.items.length ? `<div class="mits">${m.items.map(x => `<span>${esc(x.name)}<b>${x.kcal}kcal</b></span>`).join('')}</div>` : ''}
      <div class="mbtn"><button class="skip" data-st="skip">${k === 's' ? 'なし' : '食べなかった'}</button><button class="go" data-st="ate">記録してユウカに見せる</button></div>
      ${m ? '<button class="rm" data-st="del">この記録を消す</button>' : ''}</div>`;
    ov.className = 'on';
    setTimeout(() => { const t = $('mT'); if (t && !m) t.focus(); }, 300);
    ov.onclick = async e => {
      if (e.target.closest('[data-close]') || e.target === ov) { ov.className = ''; ov.innerHTML = ''; return; }
      const b = e.target.closest('[data-st]'); if (!b) return; sfx('tap');
      const st = b.dataset.st, text = ($('mT').value || '').trim();
      if (st === 'ate' && !text) return toast('食べたものを書いてください');
      ov.className = ''; ov.innerHTML = '';
      if (st === 'del') { delete r.meals[k]; await DB.put('room', r); draw(); return; }
      if (st === 'skip') { r.meals[k] = { st:'skip', at:Date.now() }; await DB.put('room', r); draw(); return reactSkip(k); }
      r.meals[k] = { st:'ate', text:text.slice(0, 200), at:Date.now(), kcal:null }; await DB.put('room', r); draw();
      mwOpen(); setFace('normal'); typeLine('……ちょっと計算しますね');
      const T = target(); let lines, face = 'normal';
      if (await loadApi()) {
        try {
          const others = foodForAI(r); delete others[SLOT_NAME[k]];
          const f = cfg.food, res = await call('food', { now:nowStr(), body:`男性・${f.age}歳・${f.w}kg・${f.h}cm`, target:T.kcal, tp:T.p, tf:T.f, tc:T.c, slot:SLOT_NAME[k], text, day:others });
          const it = res.items || [];
          Object.assign(r.meals[k], { items:it, kcal:it.reduce((a, x) => a + x.kcal, 0), p:it.reduce((a, x) => a + x.p, 0), f:it.reduce((a, x) => a + x.f, 0), c:it.reduce((a, x) => a + x.c, 0) });
          if (res.next) r.next = res.next;
          await DB.put('room', r); lines = res.lines; face = res.face;
        } catch(e) { lines = ['ごめんなさい、計算がうまくいきませんでした。記録は残してあります']; face = 'panic'; }
      } else lines = ['記録しました。AIの設定をすると、カロリーも計算できますよ'];
      draw(); paintDoor();
      await say(lines, face); mwClose();
    };
  }
  function reactSkip(k) {
    const L = { b:['先生、朝ごはんは抜いちゃダメですよー！', 'お昼に食べすぎないように、気をつけてくださいね'], l:['お昼、食べてないんですか？ 何か少しでも食べてください！'], d:['夜ごはん抜きは、明日に響きますよ……軽くでもいいので'], s:['間食なし、えらいです！'] };
    paintDoor(); return say(L[k], k === 's' ? 'smile' : 'panic').then(mwClose);
  }
  async function saveWeight() {
    const v = parseFloat(($('ofWt').value || '').replace(/[^\d.]/g, '')); if (!v || v < 30 || v > 250) return toast('体重を数字で入れてください');
    const d = foodDay || D.today(), r = await dayRec(d); r.weight = v; await DB.put('room', r);
    cfg.food.w = Math.round(v * 10) / 10; saveCfg(); sfx('ok'); draw();
    toast('体重を記録しました（目標カロリーも更新しました）');
  }

  // ===== 設定 =====
  function openSettings() {
    const f = cfg.food, ov = $('ofOv');
    ov.innerHTML = `<div class="osh set"><div class="sh"><b>食事の設定</b><button data-close="1">×</button></div><div class="lst">
      <p class="oem">家計簿の設定は、Cashの「予算の設定」タブにあります</p>
      <div class="two"><label>体重(kg)<input id="fW" inputmode="decimal" value="${f.w}"></label><label>身長(cm)<input id="fH" inputmode="numeric" value="${f.h}"></label><label>年齢<input id="fA" inputmode="numeric" value="${f.age}"></label></div>
      <label>ふだんの動き<select id="fAct"><option value="1.3" ${f.act == 1.3 ? 'selected' : ''}>ほぼ座りっぱなし</option><option value="1.4" ${f.act == 1.4 ? 'selected' : ''}>デスクワーク＋少し歩く</option><option value="1.6" ${f.act == 1.6 ? 'selected' : ''}>よく動く</option></select></label>
      <label>目標<select id="fMd"><option value="cut" ${f.mode === 'cut' ? 'selected' : ''}>少し控えめ（−400kcal）</option><option value="keep" ${f.mode === 'keep' ? 'selected' : ''}>維持</option></select></label>
      </div><button class="save" data-save="1">保存</button></div>`;
    ov.className = 'on';
    const num = id => Math.round(+($(id).value || '').replace(/[^\d.]/g, '')) || 0;
    ov.onclick = async e => {
      if (e.target.closest('[data-close]') || e.target === ov) { ov.className = ''; ov.innerHTML = ''; return; }
      if (e.target.closest('[data-save]')) {
        f.w = parseFloat($('fW').value) || f.w; f.h = num('fH') || f.h; f.age = num('fA') || f.age; f.act = parseFloat($('fAct').value); f.mode = $('fMd').value;
        await saveCfg(); sfx('ok'); ov.className = ''; ov.innerHTML = ''; draw(); toast('保存しました');
      }
    };
  }
  // 予算の設定タブの入力
  const vnum = id => { const e = $(id); return e ? Math.round(+(e.value || '').replace(/[^\d.]/g, '')) || 0 : 0; };
  function stashBudget() {
    const c = cfg.cash; if (!$('sInc')) return;
    c.income = vnum('sInc'); c.payday = Math.min(31, Math.max(1, vnum('sPay') || 25)); c.saved = vnum('sSv'); c.goal = vnum('sGl');
    c.start = $('sSt').value || ''; c.goalBy = $('sBy').value || '';
  }
  async function budgetClick(t) {
    const c = cfg.cash;
    const fd = t.closest('[data-fxd]'); if (fd) { stashBudget(); c.fixed.splice(+fd.dataset.fxd, 1); await saveCfg(); return draw(); }
    if (t.closest('[data-fxa]')) { const n = $('sFn').value.trim(), a = vnum('sFa'), d = vnum('sFd'); if (!n || !a) return toast('名前と金額を入れてください'); stashBudget(); c.fixed.push({ kind:$('sFk').value, n:n.slice(0, 16), amt:a, day:d ? Math.min(31, d) : 0 }); await saveCfg(); sfx('ok'); return draw(); }
    const bd = t.closest('[data-bnd]'); if (bd) { stashBudget(); c.bonus.splice(+bd.dataset.bnd, 1); await saveCfg(); return draw(); }
    if (t.closest('[data-bna]')) { const m = vnum('sBm'), a = vnum('sBa'); if (!m || m > 12 || !a) return toast('月（1〜12）と金額を入れてください'); stashBudget(); c.bonus.push({ m, amt:a }); await saveCfg(); sfx('ok'); return draw(); }
    if (t.closest('[data-bsave]')) { stashBudget(); await saveCfg(); sfx('ok'); toast('保存しました'); if (c.income) sub = isPrep(c) ? 'wish' : 'plan'; return draw(); }
    return false;
  }

  // ===== 雑談 =====
  async function ctxForAI() { const s = await cashSum(ym()); return { cash:s.ready ? sumForAI(s) : '未設定', food:Object.assign(foodForAI(await dayRec(D.today())), { 目標kcal:target().kcal, 今日の合計kcal:tot(await dayRec(D.today())).kcal }) }; }
  async function talk() {
    if (!(await loadApi())) { await say(['AIの設定をすると、お話しできますよ。自室か作戦室の設定から入れてくださいね'], 'normal'); return mwClose(); }
    for (;;) {
      const v = await ask('なんですか、先生？', { ph:'ユウカに話しかける', face:'normal' });
      if (!v) return mwClose();
      chat.push({ who:'me', text:v });
      typeLine('……');
      try {
        const r = await call('office', Object.assign({ now:nowStr(), text:v, log:chat.slice(-12) }, await ctxForAI()));
        chat.push({ who:'yuuka', text:(r.lines || []).join(' ') });
        await say(r.lines, r.face);
      } catch(e) { await say(['ごめんなさい、通信がうまくいきませんでした'], 'panic'); }
    }
  }
  // 入ったときのあいさつ（その日はじめて）
  async function greet() {
    if (await askDuePlans()) return;
    const key = 'ofGreet', d = D.today(); if (LS.get(key) === d) return; LS.set(key, d);
    const r = await dayRec(d), hr = new Date().getHours(), s = await cashSum(ym());
    let lines, face = 'normal';
    if (await loadApi()) {
      try { const res = await call('office', Object.assign({ now:nowStr(), mode:'open', log:[] }, await ctxForAI())); lines = res.lines; face = res.face; } catch(e) {}
    }
    if (!lines || !lines.length) {
      lines = [hr < 11 ? 'おはようございます、先生。朝ごはん、ちゃんと食べましたか？' : hr < 18 ? 'お疲れさまです、先生。今日の記録、つけておきましょう' : 'お疲れさまです、先生。今日もちゃんと記録しましょうね'];
      if (s.ready && s.prep) lines.push(`貯金開始の${D.md(cfg.cash.start)}まで、あと${daysTo(cfg.cash.start)}日です。帳尻0円で迎えましょうね`);
      else if (s.ready) lines.push(`今月はあと${yen(s.remain)}、1日あたり${yen(Math.max(0, s.perDay))}です`);
      if (!r.meals.b && hr >= 10 && hr < 18) { lines.push('……朝ごはんの記録がまだですね？'); face = 'panic'; }
    }
    await say(lines, face); mwClose();
  }

  // ===== 入退室 =====
  async function enter() {
    await loadCfg(); await loadApi();
    if (!el) build();
    month = ym(); foodDay = null;
    el.className = 'show'; document.body.classList.add('officeOn');
    document.querySelectorAll('#slides video').forEach(v => v.pause());
    const v = $('ofV'); v.currentTime = 0; v.play().catch(() => {});
    active = true; syncBgm(0, .8); clock(); clearInterval(enter._t); enter._t = setInterval(clock, 15000);
    await draw();
    setTimeout(() => { if (active) greet(); }, 900);
  }
  function exit() {
    if (!active) return;
    mwClose(); $('ofOv').className = ''; $('ofOv').innerHTML = '';
    el.classList.add('out'); $('ofV').pause(); clearInterval(enter._t);
    setTimeout(() => { el.className = ''; document.body.classList.remove('officeOn'); }, 350);
    active = false; syncBgm(200); updateVideos(); paintDoor();
  }

  return {
    makeDoor, setDoor, paintDoor,
    isDoor:() => onDoor,
    active:() => active,
    bgm:() => active ? BGM : null,
  };
})();
