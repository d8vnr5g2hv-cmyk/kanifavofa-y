// Yohei Support — 部屋（扉 → 中のページを横にスライド）・会話ウィンドウ・取材・時間と天気の光
'use strict';

// ===== AI（GAS）：自室の設定で入れたURLと合言葉を使う =====
const Api = (() => {
  let cfg = null;
  async function load() { cfg = await DB.get('settings', 'opsApi').catch(() => null); return !!(cfg && cfg.url); }
  async function call(action, body = {}, ms = 45000) {
    if (!cfg) await load();
    if (!cfg || !cfg.url) throw new Error('noapi');
    const ac = new AbortController(), to = setTimeout(() => ac.abort(), ms);
    try {
      const r = await fetch(cfg.url, { method:'POST', body:JSON.stringify(Object.assign({ key:cfg.key, action }, body)), signal:ac.signal, cache:'no-store' });
      const j = JSON.parse(await r.text());
      if (j.budget && typeof Stats !== 'undefined') Stats.noteAI(j.budget);
      if (j.error) throw new Error(j.error);
      return j;
    } finally { clearTimeout(to); }
  }
  const now = () => { const d = new Date(); return `${D.ymd(D.today())}（${D.dow(D.today())}）${p2(d.getHours())}:${p2(d.getMinutes())}`; };
  return { load, call, now, ready:() => !!(cfg && cfg.url), reset:() => { cfg = null; } };
})();

// ===== 人 =====
const WHO = {
  hoshino:{ name:'ホシノ', club:'対策委員会', voice:'hoshino', stand:'o_hoshino_stand.webp', talk:'o_hoshino_talk.webp', color:'#ff9ec4' },
  mika:   { name:'ミカ',   club:'ティーパーティー', voice:'mika', stand:'o_mika_stand.webp', talk:'o_mika_talk.webp', color:'#f2a2d6' },
  mari:   { name:'マリー', club:'シスターフッド', voice:'mari', stand:'o_mari_stand.webp', talk:'o_mari_talk.webp', color:'#ffb26b' },
  hina:   { name:'ヒナ',   club:'風紀委員会', voice:'hina', stand:'o_hina_stand.webp', talk:'o_hina_talk.webp', color:'#b48cff' },
  miyako: { name:'ミヤコ', club:'RABBIT小隊', voice:'miyako', stand:'o_miyako_stand.webp', talk:'o_miyako_talk.webp', color:'#8fb8ff' },
  yuuka:  { name:'ユウカ', club:'セミナー', voice:'office', stand:'o_yuuka_stand.webp', talk:'o_yuuka_talk.webp', color:'#5c9cff' },
  noa:    { name:'乃亜',   club:'保健室', voice:null, stand:null, talk:null, color:'#ff8fb6', face:'noa_face.webp' },
};
// 取材の担当（曜日）：日 乃亜／月 ミカ／火 ヒナ／水 ユウカ／木 ミヤコ／金 マリー／土 ホシノ
const IV_DAY = ['noa', 'mika', 'hina', 'yuuka', 'miyako', 'mari', 'hoshino'];

// ===== 会話ウィンドウ（全員共通） =====
const Talk = (() => {
  let el = null, who = null, queue = [], typing = 0, waitDone = null, asking = null, log = {}, onFace = null;
  function build() {
    el = h(`<div id="talk"><div class="tk-shade"></div><div class="tk-pt"><img class="s" alt=""><img class="t" alt=""></div>
      <div class="tk-top"><button id="tkEnd">CLOSE</button></div>
      <div class="tk-win"><div class="tk-who"><b id="tkN"></b><span id="tkC"></span></div><div class="tk-tx" id="tkT"></div><i class="tk-nx"></i>
        <div class="tk-ch" id="tkCh"></div><div class="tk-in" id="tkIn"><input id="tkI" autocomplete="off" enterkeyhint="send"><button id="tkS">送る</button></div></div></div>`);
    document.body.appendChild(el);
    el.querySelector('.tk-win').addEventListener('click', e => { if (!e.target.closest('.tk-in,.tk-ch')) advance(); });
    $('tkEnd').onclick = () => close();
  }
  function open(w, opt = {}) {
    if (!el) build();
    who = w; onFace = opt.onFace || (w === 'noa' && typeof Clinic !== 'undefined' ? Clinic.face : null);
    const W = WHO[w] || WHO.hoshino;
    $('tkN').textContent = W.name; $('tkC').textContent = W.club;
    el.style.setProperty('--tkc', W.color);
    const pt = el.querySelector('.tk-pt');
    pt.classList.toggle('none', !W.stand || opt.stand !== true);
    if (W.stand) { pt.querySelector('.s').src = W.stand; pt.querySelector('.t').src = W.talk; }
    el.classList.add('on'); document.body.classList.add('talking');
  }
  function close() {
    if (!el) return;
    el.classList.remove('on', 'think'); document.body.classList.remove('talking');
    $('tkCh').innerHTML = ''; $('tkIn').classList.remove('on'); asking = null; queue = []; clearInterval(typing); typing = 0;
    if (onFace) onFace(null);
    if (waitDone) { const f = waitDone; waitDone = null; f(); }
  }
  function mouth(on) { const t = el.querySelector('.tk-pt .t'); if (t) t.classList.toggle('on', on); }
  function typeLine(text, face) {
    const t = $('tkT'); clearInterval(typing); t.textContent = ''; let i = 0; t._full = text;
    if (onFace && face) onFace(face);
    el.classList.remove('think'); mouth(true); sfxTap(880, .08);
    typing = setInterval(() => { i += 2; t.textContent = text.slice(0, i); if (i >= text.length) { clearInterval(typing); typing = 0; mouth(false); } }, 30);
  }
  function think(text = '……') { $('tkT').textContent = text; el.classList.add('think'); }
  function say(w, lines, face = 'normal') {
    lines = (Array.isArray(lines) ? lines : [lines]).filter(Boolean);
    if (!lines.length) return Promise.resolve();
    if (!el || !el.classList.contains('on') || who !== w) open(w);
    $('tkIn').classList.remove('on'); $('tkCh').innerHTML = '';
    queue = lines.slice(1).map(l => [l, face]); typeLine(lines[0], face);
    return new Promise(r => { waitDone = r; });
  }
  function advance() {
    if (asking) return;
    const t = $('tkT');
    if (typing) { clearInterval(typing); typing = 0; t.textContent = t._full; mouth(false); return; }
    if (queue.length) { const [l, f] = queue.shift(); return typeLine(l, f); }
    if (waitDone) { const f = waitDone; waitDone = null; f(); }
  }
  function ask(w, q, opt = {}) {
    if (!el || !el.classList.contains('on') || who !== w) open(w);
    typeLine(q, opt.face || 'normal');
    const inp = $('tkI'), box = $('tkIn');
    inp.value = opt.value || ''; inp.inputMode = opt.type === 'number' ? 'numeric' : 'text'; inp.placeholder = opt.ph || ''; box.classList.add('on');
    $('tkCh').innerHTML = (opt.chips || []).map((c, i) => `<button data-c="${i}">${esc(c)}</button>`).join('') + (opt.noCancel ? '' : '<button data-c="x" class="x">やめる</button>');
    if (!opt.noFocus) setTimeout(() => inp.focus(), 80);
    return new Promise(res => {
      const done = v => { asking = null; box.classList.remove('on'); $('tkCh').innerHTML = ''; inp.blur(); res(v); };
      asking = done;
      $('tkS').onclick = () => { const v = inp.value.trim(); if (v) done(v); };
      inp.onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); $('tkS').onclick(); } };
      $('tkCh').onclick = e => { const b = e.target.closest('[data-c]'); if (!b) return; haptic(); done(b.dataset.c === 'x' ? null : opt.chips[+b.dataset.c]); };
    });
  }
  function choose(w, q, opts, face = 'normal') {
    if (!el || !el.classList.contains('on') || who !== w) open(w);
    typeLine(q, face); $('tkIn').classList.remove('on');
    $('tkCh').innerHTML = opts.map((c, i) => `<button data-c="${i}" class="${c.cls || ''}">${esc(c.label)}</button>`).join('');
    return new Promise(res => {
      asking = v => { asking = null; $('tkCh').innerHTML = ''; res(v); };
      $('tkCh').onclick = e => { const b = e.target.closest('[data-c]'); if (!b) return; haptic(); asking(opts[+b.dataset.c].v); };
    });
  }
  // AIとおしゃべり（どの子とも同じデータを見ている）
  const FALL = {
    hoshino:['うへ〜、先生。おじさん、ちゃんと聞いてるよ〜', 'AIの設定をしてくれたら、もっといっぱい話せるんだけどな〜'],
    mika:['先生、なになに？☆', 'AIの設定をしてくれたら、もっとおしゃべりできるのにな〜'],
    mari:['はい、先生。どうされましたか？', 'AIの設定をしていただければ、もっとお話しできます'],
    hina:['……なに、先生？', 'AIの設定をしてくれたら、ちゃんと答えられるわ'],
    miyako:['先生、ご用件をどうぞ', 'AIの設定が完了すれば、会話任務を開始できます'],
    yuuka:['なんですか、先生？', 'AIの設定をしてくれれば、ちゃんと計算してお答えしますよ'],
    noa:['なあに、ようへい？', 'AIの設定をしてくれたら、もっとちゃんとお話しできるよ'],
  };
  async function chat(w, opt = {}) {
    open(w, opt);
    const L = log[w] || (log[w] = (await DB.get('room', 'tk-' + w).catch(() => null) || { id:'tk-' + w, log:[] }).log);
    if (opt.first) await say(w, opt.first, opt.face || 'normal');
    for (;;) {
      const v = await ask(w, opt.prompt || '……', { ph:`${WHO[w].name}に話しかける`, noFocus:!!opt.first });
      if (!v) return close();
      L.push({ who:'me', text:v, at:Date.now() });
      think();
      let r = null;
      try { await Api.load(); r = await Api.call('chat', { who:w, now:Api.now(), text:v, log:L.slice(-14).map(x => ({ who:x.who, text:x.text })), snap:await Life.snapshot() }); } catch (e) {}
      const lines = r && r.lines && r.lines.length ? r.lines : FALL[w];
      L.push({ who:w, text:lines.join(' '), at:Date.now() });
      while (L.length > 60) L.shift();
      DB.put('room', { id:'tk-' + w, log:L }).catch(() => {});
      if (r && r.memo) Life.put({ dm:r.memo.dm || 'habit', cat:'', name:r.memo.name, val:r.memo.val, state:'heard' });
      await say(w, lines, r && r.face || 'normal');
      opt.first = null; opt.prompt = '……';
    }
  }
  function sfxTap(f, a) { try { const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + .09); o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + .12); } catch (e) {} }
  return { open, close, say, ask, choose, chat, think, active:() => !!(el && el.classList.contains('on')) };
})();

// ===== 新聞の取材（曜日の担当に、その日はじめて会ったとき） =====
const Interview = (() => {
  const ASK = {
    hoshino:'ねえ先生〜、今日はおじさんが新聞の取材当番なんだ〜。なにかネタ、ない〜？', mika:'先生！今日は私が取材の日なの☆ 新聞のネタ、なにかちょうだい！',
    hina:'……先生。今日の新聞、私が記事を書く番なの。なにか話題、ある？', yuuka:'先生、今日は私が新聞の取材担当なんです。ネタ、ありませんか？',
    miyako:'先生、本日の取材任務はRABBIT1が担当します。ネタを一件、ご提供いただけますか', mari:'先生、今日は私が新聞のお当番なんです。なにかお話を聞かせていただけますか？',
    noa:'ねえねえ、ようへい。今日は私が新聞の取材の日なんだ。なにか話してくれる？',
  };
  const WRITE = { hoshino:'うへ〜、いいネタもらっちゃった。書いてくるね〜', mika:'ありがと☆ かわいく書いてくるね！', hina:'……わかった。書いてくるわ', yuuka:'了解です！手早くまとめます', miyako:'取材完了。記事を作成します', mari:'ありがとうございます。心をこめて書きますね', noa:'ありがと。ちゃんと書くね' };
  const today = () => D.today();
  const whoToday = () => IV_DAY[new Date().getDay()];
  async function rec() { return (await DB.get('room', 'iv-' + today()).catch(() => null)) || { id:'iv-' + today(), date:today(), who:whoToday(), status:'new', log:[] }; }
  // 会ったときに呼ぶ。取材したら true
  async function meet(w) {
    if (w !== whoToday() || new Date().getHours() < 6) return false;
    if (!(await Api.load())) return false;
    if (await DB.get('room', 'art-' + today()).catch(() => null)) return false;
    const iv = await rec(); if (iv.status === 'skip' || iv.status === 'done') return false;
    const save = () => DB.put('room', iv).catch(() => {});
    const v = await Talk.choose(w, ASK[w], [{ label:'ネタを話す', v:'go' }, { label:'今日はパス', v:'skip', cls:'x' }]);
    if (v === 'skip') { iv.status = 'skip'; save(); await Talk.say(w, ['わかった。また来週、聞かせてね']); Talk.close(); return true; }
    iv.status = 'active'; iv.log = []; save();
    let q = 'やった！ じゃあ、話題を教えて！';
    for (let turn = 0; turn < 3; turn++) {
      const t = await Talk.ask(w, q, { ph:'話したいこと' });
      if (!t) { save(); Talk.close(); return true; }
      iv.log.push({ who:'me', text:t }); save();
      if (turn === 2) break;
      Talk.think();
      q = 'それで、それで？ もっと聞かせて！';
      try { const r = await Api.call('interview', { who:w, log:iv.log }); if (r.line) q = r.line; } catch (e) {}
      iv.log.push({ who:w, text:q });
    }
    iv.status = 'write'; save();
    await Talk.say(w, [WRITE[w]]); Talk.think('記事を書いています');
    let r = null; try { r = await Api.call('article', { who:w, date:today(), log:iv.log }); } catch (e) {}
    if (!r || !r.head) { await Talk.say(w, ['……ごめん、うまくまとまらなかった。また話を聞かせてね']); iv.status = 'new'; save(); Talk.close(); return true; }
    const d = today(), dow = (D.parse(d).getDay() + 6) % 7;
    await DB.put('room', { id:'art-' + d, date:d, week:D.add(d, -dow), who:w, kind:r.kind, head:r.head, body:r.body, score:r.score, photo:null, read:false, at:Date.now(), log:iv.log });
    iv.status = 'done'; save();
    await Talk.say(w, [r.line || '書けたよ！', `見出しは「${r.head}」。廊下の掲示板に貼っておくね`], 'smile');
    Talk.close(); Hall.paint();
    return true;
  }
  return { meet, whoToday };
})();

// ===== 時間と天気の光（メモロビと部屋の上にうっすら重ねる） =====
const Ambient = (() => {
  let el = null, rainEl = null;
  function tone(hr) {
    if (hr < 5) return ['rgba(40,50,120,.22)', 'multiply'];
    if (hr < 8) return ['rgba(255,190,150,.16)', 'soft-light'];
    if (hr < 16) return ['rgba(255,255,255,0)', 'normal'];
    if (hr < 18) return ['rgba(255,170,90,.16)', 'soft-light'];
    if (hr < 20) return ['rgba(150,90,170,.16)', 'multiply'];
    return ['rgba(40,60,140,.2)', 'multiply'];
  }
  async function paint() {
    if (!el) { el = h('<div id="ambient"></div>'); rainEl = h('<div id="rain"></div>'); document.body.append(el, rainEl); }
    const [c, m] = tone(new Date().getHours());
    el.style.background = c; el.style.mixBlendMode = m;
    const w = await Life.weather().catch(() => null), code = w ? w.code : 0;
    const wet = code >= 51 && code <= 82 && !(code >= 71 && code <= 77);
    rainEl.classList.toggle('on', wet);
    if (wet && !rainEl.children.length) for (let i = 0; i < 36; i++) { const d = document.createElement('i'); d.style.left = Math.random() * 100 + '%'; d.style.animationDelay = (-Math.random() * 1.2) + 's'; d.style.animationDuration = (.7 + Math.random() * .5) + 's'; d.style.opacity = .25 + Math.random() * .35; rainEl.appendChild(d); }
    if (w && w.now <= 8) el.style.boxShadow = 'inset 0 0 120px rgba(150,190,255,.25)'; else el.style.boxShadow = '';
  }
  return { paint, init() { paint(); setInterval(paint, 10 * 60e3); document.addEventListener('visibilitychange', () => { if (!document.hidden) paint(); }); } };
})();

// ===== 部屋（扉とページ） =====
const Rooms = (() => {
  // 部屋の定義：扉の絵（閉・開）、BGM、ページ
  const DEF = {
    sec:     { name:'秘書室', en:'SECRETARY ROOM', door:['dm_door.jpg', 'dm_door_open.jpg'], dw:853, dh:1843, pages:['sc_sec', 'brief', 'todo'], who:'hoshino' },
    mika:    { name:'ミカの部屋', en:"MIKA'S ROOM", door:['dm_rdoor_d.jpg', null], dw:853, dh:1844, pages:['sc_mika', 'wear', 'food', 'love'], who:'mika' },
    mari:    { name:'マリーの部屋', en:"MARIE'S ROOM", door:['cafe_door_d.jpg', 'cafe_door_open_d.jpg'], dw:1024, dh:1536, pages:['sc_mari', 'home', 'friends'], who:'mari' },
    rabbit:  { name:'ウサギ飼育ルーム', en:'RABBIT ROOM', door:['dm_rdoor_n.jpg', null], dw:853, dh:1843, pages:['sc_rabbit', 'rabbit'], stickers:true, who:'miyako' },
    security:{ name:'生徒会室', en:'STUDENT COUNCIL', door:['ops_door.jpg', 'ops_door_open.jpg'], dw:1170, dh:2470, pages:['sc_security', 'accounts'], who:'hina' },
    clinic:  { name:'保健室', en:'INFIRMARY', door:['bt_door.jpg', 'bt_door_open.jpg'], dw:853, dh:1843, pages:['sc_clinic', 'body', 'mind', 'karte'], who:'noa' },
  };
  // ページ：ラベル・担当（sc_〜 は1枚目のメモロビ）
  const PAGE = {
    sc_sec:{ l:'お部屋', who:'hoshino', sc:1 }, brief:{ l:'まとめ', who:'hoshino' }, todo:{ l:'やること', who:'hoshino' },
    sc_mika:{ l:'お部屋', who:'mika', sc:1 }, wear:{ l:'衣', who:'mika' }, food:{ l:'食', who:'mika' }, love:{ l:'すき', who:'mika' },
    sc_mari:{ l:'お部屋', who:'mari', sc:1 }, home:{ l:'住', who:'mari' }, friends:{ l:'友好関係', who:'mari' },
    sc_rabbit:{ l:'お部屋', who:'miyako', sc:1 }, rabbit:{ l:'飼育', who:'miyako' },
    sc_security:{ l:'お部屋', who:'hina', sc:1 }, accounts:{ l:'アカウント', who:'hina' },
    sc_clinic:{ l:'お部屋', who:'noa', sc:1 }, body:{ l:'からだ', who:'noa' }, mind:{ l:'こころ', who:'noa' }, karte:{ l:'カルテ', who:'noa' },
  };
  let room = null, doors = {}, onDoorKey = null;
  const bar = () => $('roomBar');

  function makeDoor(key, after) {
    const R = DEF[key];
    const s = h(`<div class="slide ydoor" data-room="${key}"><div class="ydbox"><img class="c" src="${R.door[0]}" alt="">${R.door[1] ? `<img class="o" src="${R.door[1]}" alt="">` : ''}
      ${R.stickers ? '<img class="ystk a" src="usagi_sit.webp" alt=""><img class="ystk b" src="usagi_hop.webp" alt="">' : ''}</div>
      <div class="yplate"><b>${R.name}</b><small>${R.en}</small><span class="ybadge"></span></div><div class="rhint">TAP TO ENTER</div><div class="rflash"></div></div>`);
    if (after === 'start') slidesEl.insertBefore(s, slidesEl.firstChild); else slidesEl.appendChild(s);
    const box = s.querySelector('.ydbox'), fit = () => { const PW = s.clientWidth, PH = s.clientHeight; if (!PW) return; const k = Math.max(PW / R.dw, PH / R.dh); Object.assign(box.style, { width:R.dw * k + 'px', height:R.dh * k + 'px', left:(PW - R.dw * k) / 2 + 'px', top:(PH - R.dh * k) / 2 + 'px' }); };
    fit(); addEventListener('resize', fit);
    let tx = 0, ty = 0;
    s.addEventListener('pointerdown', e => { tx = e.clientX; ty = e.clientY; });
    s.addEventListener('pointerup', e => { if (Math.hypot(e.clientX - tx, e.clientY - ty) < 10) openDoor(key, s); });
    doors[key] = s;
    return s;
  }
  async function badge(key, html) { const s = doors[key]; if (s) s.querySelector('.ybadge').innerHTML = html || ''; }
  async function openDoor(key, s) {
    if (s.classList.contains('opening') || room) return;
    ctx.resume(); haptic();
    s.classList.add('opening', 'opened'); doorSfx();
    await sleep(700); s.classList.add('flash');
    await sleep(360); enter(key);
    setTimeout(() => s.classList.remove('opening', 'opened', 'flash'), 600);
  }
  function doorSfx() {
    try {
      const t = ctx.currentTime, g = ctx.createGain(); g.gain.value = .35; g.connect(ctx.destination);
      [[988, 0], [1319, .1]].forEach(([f, at]) => { const o = ctx.createOscillator(), gg = ctx.createGain(); o.type = 'sine'; o.frequency.value = f; gg.gain.setValueAtTime(0, t + at); gg.gain.linearRampToValueAtTime(.16, t + at + .01); gg.gain.exponentialRampToValueAtTime(.0001, t + at + .25); o.connect(gg); gg.connect(g); o.start(t + at); o.stop(t + at + .3); });
    } catch (e) {}
  }
  function setDoor(key) {   // 今見えているスライドが扉なら、その部屋の名前
    if (onDoorKey === key) return; onDoorKey = key;
    document.body.classList.toggle('atDoor', !!key);
    if (key && DEF[key]) { const p = new Image(); if (DEF[key].door[1]) p.src = DEF[key].door[1]; }
  }

  // ===== 入る・出る =====
  function enter(key, page) {
    room = key; const R = DEF[key];
    document.body.classList.add('inRoom');
    slidesEl.querySelectorAll('video').forEach(v => v.pause());
    drawBar(page || R.pages[0]);
    switchTab(page || R.pages[0]);
    setTimeout(() => { if (room === key) Interview.meet(R.who); }, 1200);
  }
  function exit() {
    if (!room) return;
    Talk.close(); room = null;
    document.body.classList.remove('inRoom');
    switchTab('favorite');
    paintDoors();
  }
  function drawBar(cur) {
    const R = DEF[room];
    bar().innerHTML = `<button class="rb-x" data-x="out" aria-label="出る"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
      <div class="rb-pg">${R.pages.map(p => `<button data-p="${p}" class="${p === cur ? 'on' : ''} ${PAGE[p].sc ? 'sc' : ''}">${PAGE[p].sc ? '<i class="rb-sc"><svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg></i>' : `<img src="${PAGE[p].who === 'noa' ? 'noa_face.webp' : 'icon_' + PAGE[p].who + '.png'}" alt="">`}<span>${PAGE[p].l}</span></button>`).join('')}</div>
      <button class="rb-t" data-x="talk" aria-label="話す"><svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/></svg><span>話す</span></button>`;
    bar().dataset.room = room;
  }
  function go(p) {
    if (!room || p === tab) return;
    const R = DEF[room], from = R.pages.indexOf(tab), to = R.pages.indexOf(p); if (to < 0) return;
    document.body.dataset.dir = to > from ? 'next' : 'prev';
    bar().querySelectorAll('[data-p]').forEach(b => b.classList.toggle('on', b.dataset.p === p));
    const prevWho = PAGE[tab] && PAGE[tab].who;
    switchTab(p);
  }
  function step(d) { if (!room) return; const P = DEF[room].pages, i = P.indexOf(tab) + d; if (i >= 0 && i < P.length) { haptic(); go(P[i]); } }

  function init() {
    Scene.init();
    bar().addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      haptic();
      if (b.dataset.p) return go(b.dataset.p);
      if (b.dataset.x === 'out') return exit();
      if (b.dataset.x === 'talk') return Talk.chat(PAGE[tab].who, { first:greetLine(PAGE[tab].who), onFace:typeof Clinic !== 'undefined' && PAGE[tab].who === 'noa' ? Clinic.face : null });
    });
    // ページを横にスワイプ
    let sx = 0, sy = 0, st = 0;
    document.addEventListener('pointerdown', e => { if (!room || !e.target.closest('.page')) return; sx = e.clientX; sy = e.clientY; st = Date.now(); }, { passive:true });
    document.addEventListener('pointerup', e => {
      if (!room || !st || !e.target.closest('.page')) return;
      const dx = e.clientX - sx, dy = e.clientY - sy, dt = Date.now() - st; st = 0;
      if (typeof Sortable !== 'undefined' && Sortable.recent()) return;
      if (e.target.closest('.noswipe, input, textarea, .hscroll')) return;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6 && dt < 700) step(dx < 0 ? 1 : -1);
    }, { passive:true });
  }
  const GREET = {
    hoshino:'うへ〜、どうしたの先生？', mika:'なになに、先生？☆', mari:'はい、先生。どうされましたか？', hina:'……なに、先生？',
    miyako:'先生、ご用件をどうぞ', yuuka:'なんですか、先生？', noa:'なあに、ようへい？',
  };
  const greetLine = w => GREET[w];
  async function paintDoors() {
    // 札：やることの期限・在庫・ウサギ・カルテ
    try {
      const t = D.today(), todos = (await DB.all('todos')).filter(x => !x.done && x.due && x.due <= t).length;
      badge('sec', todos ? `<i>期限 ${todos}</i>` : '');
      const low = (await Life.stock()).filter(s => { const d = Life.stockDays(s); return d != null && d <= 2; }).length;
      badge('mari', low ? `<i>在庫 ${low}</i>` : '');
      const f = await Life.food(t), hr = new Date().getHours(); badge('mika', hr >= 20 && !Object.keys(f.meals || {}).length ? '<i>ごはん記録まだ</i>' : '');
      if (typeof Rabbit !== 'undefined') badge('rabbit', await Rabbit.doorBadge());
      const td = await Life.day(); badge('clinic', !td.sleep && new Date().getHours() >= 9 ? '<i>睡眠まだ</i>' : !td.chk ? '<i>3問まだ</i>' : '');
    } catch (e) {}
  }
  return { DEF, PAGE, makeDoor, setDoor, enter, exit, go, init, paintDoors, active:() => room, isDoor:() => !!onDoorKey, greetLine };
})();

// ===== 自動の控え（週に1回、Googleドライブへ） =====
const Backup = (() => {
  async function data() {
    const d = { app:'yohei-support', version:1, exportedAt:new Date().toISOString(), stores:{} };
    for (const s of DB.STORES) if (!DB.BLOBS.includes(s)) d.stores[s] = await DB.all(s);
    return JSON.stringify(d);
  }
  async function now(quiet) {
    if (!(await Api.load())) { if (!quiet) toast('AIの設定（GAS）をすると使えます'); return false; }
    try { const r = await Api.call('backup', { data:await data() }, 60000); LS.set('ys-lastBackup', Date.now()); if (!quiet) toast('ドライブに控えをとりました'); return r.ok; }
    catch (e) { if (!quiet) toast('控えをとれませんでした（GASのドライブ許可を確認してください）', 3000); return false; }
  }
  async function auto() { const last = +LS.get('ys-lastBackup') || 0; if (Date.now() - last > 7 * 86400e3) now(true); }
  async function restore() {
    if (!(await Api.load())) return toast('AIの設定（GAS）をすると使えます');
    let r; try { r = await Api.call('backup', { list:true }); } catch (e) { return toast('控えの一覧を取れませんでした'); }
    if (!r.files || !r.files.length) return toast('ドライブに控えがありません');
    Menu.open('どの控えに戻しますか？', r.files.map(f => ({ label:new Date(f.at).toLocaleString('ja-JP'), sub:f.name, fn:async () => {
      if (!confirm('今のデータを、この控えの内容で置き換えます。よろしいですか？')) return;
      const g = await Api.call('backup', { get:f.id }); const blob = new Blob([g.data], { type:'application/json' });
      importData(new File([blob], f.name), true); } })));
  }
  return { now, auto, restore, last:() => +LS.get('ys-lastBackup') || 0 };
})();

// ===== 部屋の1枚目（メモロビ） =====
const Scene = (() => {
  const VOICE = { hoshino:'hoshino', mika:'mika', mari:'mari', miyako:'miyako', hina:'hina' };
  function size(pg) {
    const W = pg.clientWidth, H = pg.clientHeight; if (!W) return;
    pg.querySelectorAll('.sp:not(.nf), .sv').forEach(m => { const vw = m.naturalWidth || m.videoWidth || 1170, vh = m.naturalHeight || m.videoHeight || 2534, k = Math.max(W / vw, H / vh);
      Object.assign(m.style, { width:vw * k + 'px', height:vh * k + 'px', left:(W - vw * k) / 2 + 'px', top:(H - vh * k) / 2 + 'px' }); });
    const nf = pg.querySelector('.nf'), nb = pg.querySelector('.nb'); if (nf && nb) nf.style.cssText = nb.style.cssText;
  }
  function init() {
    document.querySelectorAll('.scenep').forEach(pg => {
      const key = pg.id.replace('page-', ''), v = pg.querySelector('.sv');
      if (v) {
        const show = () => { if (v.currentTime > 0 && v.videoWidth) requestAnimationFrame(() => requestAnimationFrame(() => v.classList.add('ready'))); };
        v.addEventListener('timeupdate', show); v.addEventListener('loadedmetadata', () => size(pg));
      }
      pg.querySelector('.sp').addEventListener('load', () => size(pg));
      TabHooks[key] = {
        enter:() => { size(pg); if (v) { if (!v.src) v.src = pg.dataset.v + '_tall_h264.mp4'; v.preload = 'auto'; v.play().catch(() => {}); } pg.classList.add('hint'); setTimeout(() => pg.classList.remove('hint'), 3200); },
        leave:() => { if (v) v.pause(); },
        visibility:hidden => { if (v && tab === key) { if (hidden) v.pause(); else v.play().catch(() => {}); } },
      };
      let sx = 0, sy = 0;
      pg.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; });
      pg.addEventListener('pointerup', e => {
        if (Math.hypot(e.clientX - sx, e.clientY - sy) > 10) return;
        ctx.resume(); wake(); const w = pg.dataset.who;
        if (w === 'noa') return Clinic.tapNoa();
        if (VOICE[w]) playVoice(VOICE[w]);
      });
    });
    addEventListener('resize', () => document.querySelectorAll('.scenep.show').forEach(size));
  }
  return { init };
})();
