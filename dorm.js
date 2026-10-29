// Kani Favorite — 学生寮（メモロビの右・作戦室の左のドア → エントランス → 廊下 → 各部屋）
// 保存：room ストアの 'dm-state'（寮を開いた日・入寮済み）と 'dm-log-<生徒>'（会話の履歴・覚えていること）
'use strict';
const Dorm = (() => {
  // g：d＝朝・昼組（6〜18時）／n＝夜組（18〜翌2時）。faces：部屋の画像の表情。video：メモロビの動画を部屋にする
  const ST = {
    hoshino:{ name:'ホシノ', g:'d', faces:['normal', 'smile', 'sleepy', 'shy'], stk:1, voice:'hoshino' },
    mari:   { name:'マリー', g:'d', faces:['normal', 'smile', 'shy', 'sleepy'], stk:3, voice:'mari' },
    miyako: { name:'ミヤコ', g:'d', faces:['normal', 'smile', 'shy'], stk:4, voice:'miyako' },
    nico:   { name:'ニコ',   g:'d', faces:['normal'], stk:8, voice:'kitchen' },
    mika:   { name:'ミカ',   g:'n', video:'16_mika_night', stk:2, voice:'mika' },
    hina:   { name:'ヒナ',   g:'n', video:'08_rest', stk:11, voice:'hina' },
    yuuka:  { name:'ユウカ', g:'n', faces:['normal', 'panic', 'sleepy', 'sulky'], stk:9, voice:'office' },
    kisaki: { name:'キサキ', g:'n', faces:['normal', 'smile', 'shy', 'sleepy'], stk:10, voice:'sofa' },
    serina: { name:'セリナ', g:'d', video:'06_christmas', stk:7, voice:'christmas', later:1 },
    seia:   { name:'セイア', g:'n', video:'13_drive', stk:6, voice:'drive', later:1 },
    noa:    { name:'ノア',   g:'n', video:'15_bedtime', stk:5, voice:'bedtime', later:1 },
    hikari: { name:'ヒカリ', g:'d', video:'12_conductor', stk:12, voice:'conductor', later:1 },
  };
  const KEYS = Object.keys(ST);
  const NEED = 10;   // 追加の4人：自室の当番がこの回数で入寮
  const FACE_JA = { normal:'ふだん', smile:'嬉しい・笑顔', shy:'照れ・恥ずかしい', sleepy:'眠い・目を閉じる', panic:'焦り・驚き・注意', sulky:'じと目・すねる' };
  // 部屋に入ったときのひとこと（AIを使わない）
  const HI = {
    hoshino:['うへ〜、先生？ おじさんの部屋まで来てくれたんだ〜', 'ちょうどお昼寝しようと思ってたとこ〜。先生もごろごろする？', 'パジャマのままでごめんね〜。ゆっくりしてってよ〜'],
    mari:['せ、先生！？ こんな格好ですみません……', 'ようこそいらっしゃいました。お茶をお淹れしますね', 'お部屋まで来てくださって、うれしいです'],
    miyako:['先生……！ 自室への来訪、確認しました', '今は非番なので、少しだけ気が抜けています', 'どうぞ。うさぎのクッション、使ってください'],
    nico:['あら、先生〜。いらっしゃい〜', 'ふふ、ちょうどお茶を淹れたところですよ〜', 'ゆっくりしていってくださいね〜'],
    mika:['先生！？ えへへ、来てくれたんだ☆', '見て見て、星がきれいでしょ？ 一緒に見よ☆', 'パジャマ、変じゃない……？'],
    hina:['……先生？ どうしたの、こんな時間に', '今日はもう、仕事はおしまい。……少しだけ、話す？', '散らかってるけど、気にしないで'],
    yuuka:['せ、先生！？ 急に来ないでください……！', 'もう、パジャマなんですから……。それで、どうしたんですか？', '今日の出費、ちゃんと記録しましたか？'],
    kisaki:['ほう、先生か。妾の部屋を訪ねるとはのう', 'ふふ、楽にするがよい。茶でも飲むか？', '妾も今宵はくつろいでおる。少し話そうぞ'],
    serina:['先生、いらっしゃいませ。お怪我はありませんか？', 'ゆっくり休んでいってくださいね'],
    seia:['先生か。来ると思っていたよ', '夜は長い。少し、話をしようか'],
    noa:['先生、いらっしゃいませ♪ 今日の来訪も記録しておきますね', 'ふふ、パジャマ姿は内緒ですよ？'],
    hikari:['先生だーー！ あそびにきたのーー？', 'へやに先生がいるーー'],
  };
  const LATE = {   // 0時〜2時
    mika:'先生、もう遅いよ？ 夜ふかしはだめだからね', hina:'……先生、もう寝たほうがいい。私も、そろそろ寝るから',
    yuuka:'先生！ もう日付が変わってますよ！ 早く寝てください！', kisaki:'もう夜も更けた。先生も早う休むがよい',
    seia:'先生、もう眠る時間だよ。夢の続きは、明日にしよう', noa:'先生、もうこんな時間です。今日の記録はここまでにして、休みましょう？',
  };
  const BGM = { d:L('bgm.mp3', 117.25), n:L('night_bgm.mp3', 132.0) };

  let st = null, scene = null, onDoor = false, cur = null, api = null, busy = false, chat = null;

  // ===== 時間 =====
  const hr = () => new Date().getHours();
  const isNight = () => { const h = hr(); return h >= 18 || h < 6; };
  const inRoom = k => { const h = hr(); return ST[k].g === 'd' ? h >= 6 && h < 18 : h >= 18 || h < 2; };
  function awayMsg(k) {
    const h = hr();
    if (h >= 2 && h < 6) return 'みんな寝ているみたい……（' + (ST[k].g === 'd' ? '朝6時' : '夜6時') + 'ごろ戻ります）';
    return '今はいないみたい……（' + (ST[k].g === 'd' ? '朝6時' : '夜6時') + 'ごろ戻ります）';
  }

  // ===== 保存 =====
  async function load() {
    if (st) return st;
    st = await DB.get('room', 'dm-state').catch(() => null);
    if (!st) { st = { id:'dm-state', since:D.today(), moved:{} }; await DB.put('room', st).catch(() => {}); }
    return st;
  }
  async function dutyCount() {   // 寮を開いた日からの、自室の当番回数（生徒ごと）
    await load();
    const all = await DB.all('room').catch(() => []), n = {};
    all.forEach(r => { if (r.id && r.id.startsWith('duty-') && r.date >= st.since && r.who) n[r.who] = (n[r.who] || 0) + 1; });
    let ch = false;
    KEYS.forEach(k => { if (ST[k].later && !st.moved[k] && (n[k] || 0) >= NEED) { st.moved[k] = D.today(); ch = true; } });
    if (ch) await DB.put('room', st).catch(() => {});
    return n;
  }
  const lived = k => !ST[k].later || (st && st.moved[k]);
  const getLog = async k => (await DB.get('room', 'dm-log-' + k).catch(() => null)) || { id:'dm-log-' + k, log:[], mem:[] };

  // ===== ドア（メモロビの右・作戦室の左） =====
  function makeDoor() {
    const s = h(`<div class="slide dmdoor"><div class="dmdbox"><img class="dmdc" src="dm_door.jpg" alt=""><img class="dmdo" src="dm_door_open.jpg" alt="">
      <div class="dmsign">学生寮<small>DORMITORY</small></div><img class="dmstk a" src="dc_stk4.webp" alt=""><img class="dmstk b" src="dc_stk7.webp" alt="">
      <div class="dmbadge" id="dmBadge"></div></div><div class="rhint dmhint">TAP TO ENTER</div><div class="dmflash"></div></div>`);
    slidesEl.appendChild(s);
    const box = s.querySelector('.dmdbox'), fit = () => cover(box, 853, 1843);
    fit(); addEventListener('resize', fit);
    let tx = 0, ty = 0;
    s.addEventListener('pointerdown', e => { tx = e.clientX; ty = e.clientY; });
    s.addEventListener('pointerup', e => { if (Math.hypot(e.clientX - tx, e.clientY - ty) < 10) openDoor(s); });
    return s;
  }
  function cover(box, w, hh) {
    const p = box.parentNode, W = p.clientWidth, H = p.clientHeight; if (!W) return;
    const s = Math.max(W / w, H / hh);
    Object.assign(box.style, { width:w * s + 'px', height:hh * s + 'px', left:(W - w * s) / 2 + 'px', top:(H - hh * s) / 2 + 'px' });
    box.style.setProperty('--u', s + 'px');
  }
  async function paintDoor() {
    const b = $('dmBadge'); if (!b) return;
    await load();
    const n = KEYS.filter(k => lived(k) && inRoom(k)).length;
    b.innerHTML = `<span>在室 <b>${n}</b>人</span>`;
    b.closest('.dmdoor').classList.toggle('n', isNight());
  }
  async function openDoor(s) {
    if (s.classList.contains('opening')) return;
    ctx.resume(); haptic();
    s.classList.add('opening', 'opened');
    await sleep(800); s.classList.add('flash');
    await sleep(380); await enter();
    setTimeout(() => s.classList.remove('opening', 'opened', 'flash'), 600);
  }
  function setDoor(v) {
    if (onDoor === v) return;
    onDoor = v; document.body.classList.toggle('atDmDoor', v);
    if (v) { paintDoor(); ['dm_door_open.jpg', 'dm_hall_d.jpg', 'dm_hall_n.jpg'].forEach(f => { const i = new Image(); i.src = f; }); }
  }

  // ===== 画面 =====
  function build() {
    const o = h(`<div id="dorm">
      <section class="dm-sc dm-hall"><div class="dm-bgw"><img class="dm-hbg" alt=""></div>
        <div class="dm-top"><button class="dm-back" data-a="out">‹ 出る</button><div class="dm-ttl">学生寮<small>DORMITORY</small></div><div class="dm-clock" id="dmClock"></div></div>
        <div class="dm-board"><div class="dm-bh"><b>在室ボード</b><small id="dmBoardSub"></small></div><div class="dm-bgrid" id="dmBoard"></div>
          <button class="dm-go" data-a="cor">廊下へ進む <i>›</i></button></div>
      </section>
      <section class="dm-sc dm-corr">
        <div class="dm-cor" id="dmCor"></div>
        <div class="dm-top"><button class="dm-back" data-a="hall">‹ エントランス</button><div class="dm-ttl" id="dmCorT">廊下<small>CORRIDOR</small></div></div>
        <button class="dm-arr l" data-a="prev">‹</button><button class="dm-arr r" data-a="next">›</button>
        <div class="dm-dots" id="dmDots"></div>
      </section>
      <section class="dm-sc dm-room">
        <div class="dm-rbg" id="dmRbg"></div>
        <div class="dm-top"><button class="dm-back" data-a="cor">‹ 廊下</button><div class="dm-ttl" id="dmRT"></div><button class="dm-ico" data-a="log" aria-label="履歴">履歴</button></div>
        <div class="dm-mw" id="dmMw"><div class="dm-nm" id="dmNm"></div><div class="dm-tx" id="dmTx"></div><i class="dm-nx">▼</i></div>
        <div class="dm-inp"><input id="dmIn" type="text" placeholder="話しかける…" autocomplete="off" enterkeyhint="send"><button id="dmSend">送信</button></div>
      </section>
      <div class="dm-ov" id="dmOv"></div>
      <div class="dm-fade" id="dmFade"></div>
    </div>`);
    document.body.appendChild(o);
    o.addEventListener('click', onClick);
    $('dmSend').onclick = send;
    $('dmIn').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); send(); } });
    $('dmCor').addEventListener('scroll', () => { const i = Math.round($('dmCor').scrollLeft / $('dmCor').clientWidth); paintDots(i); }, { passive:true });
    addEventListener('resize', () => { if (scene) fitAll(); });
  }
  function fitAll() { document.querySelectorAll('#dorm .dm-fit').forEach(b => cover(b, 853, 1843)); }
  async function enter() {
    await load(); await dutyCount();
    if (!$('dorm')) build();
    $('dorm').className = 'show';
    toHall();
    loadApi();
  }
  function exit() {
    $('dorm').classList.add('out');
    setTimeout(() => { $('dorm').className = ''; scene = null; syncBgm(0, .8); paintDoor(); }, 380);
  }
  async function swap(fn) { const f = $('dmFade'); f.classList.add('on'); await sleep(260); await fn(); f.classList.remove('on'); }
  function show(s) { scene = s; $('dorm').dataset.s = s; $('dorm').classList.toggle('night', isNight()); syncBgm(0, .8); }

  // ----- エントランス -----
  async function toHall() {
    show('hall');
    $('dorm').querySelector('.dm-hbg').src = isNight() ? 'dm_hall_n.jpg' : 'dm_hall_d.jpg';
    const d = new Date(); $('dmClock').textContent = `${p2(d.getHours())}:${p2(d.getMinutes())}`;
    const n = await dutyCount();
    $('dmBoardSub').textContent = isNight() ? '夜（18時〜翌2時）は夜組が在室' : '昼（6時〜18時）は朝・昼組が在室';
    $('dmBoard').innerHTML = KEYS.map((k, i) => {
      const L = lived(k), on = L && inRoom(k);
      return `<button class="dm-bc${on ? ' on' : ''}${L ? '' : ' lk'}" data-room="${i}"><i></i><b>${ST[k].name}</b><small>${L ? (on ? '在室' : '不在') : `入寮まで ${Math.min(n[k] || 0, NEED)}/${NEED}`}</small><em>${101 + i}</em></button>`;
    }).join('');
  }
  // ----- 廊下 -----
  async function toCorridor(idx = null) {
    const n = await dutyCount(), night = isNight();
    $('dmCor').innerHTML = KEYS.map((k, i) => {
      const L = lived(k), on = L && inRoom(k), S = ST[k];
      return `<div class="dm-rd${night ? ' n' : ''}${on ? ' on' : ''}${L ? '' : ' lk'}" data-door="${i}"><div class="dm-fit"><img src="${night ? 'dm_rdoor_n.jpg' : 'dm_rdoor_d.jpg'}" alt="">
        <div class="dm-plate">${S.name}<small>${101 + i}</small></div><i class="dm-lamp"></i><img class="dm-stk" src="dc_stk${S.stk}.webp" alt="">
        ${L ? '' : `<i class="dm-tape a"></i><i class="dm-tape b"></i><div class="dm-wait">入寮予定<small>自室の当番 ${Math.min(n[k] || 0, NEED)}/${NEED}回で入寮</small></div>`}
        ${S.later && L && st.moved[k] === D.today() ? '<div class="dm-new">NEW</div>' : ''}</div>
        <div class="dm-st">${L ? (on ? '<b class="in">在室</b>ノックして入る' : `<b>不在</b>${ST[k].g === 'd' ? '朝6時〜18時' : '夜18時〜翌2時'}に在室`) : '<b>準備中</b>'}</div></div>`;
    }).join('');
    $('dmDots').innerHTML = KEYS.map(() => '<i></i>').join('');
    show('corr'); fitAll();
    const i = idx != null ? idx : (cur ? KEYS.indexOf(cur) : 0);
    $('dmCor').scrollLeft = $('dmCor').clientWidth * i; paintDots(i);
  }
  function paintDots(i) { [...$('dmDots').children].forEach((d, k) => d.classList.toggle('on', k === i)); }
  async function knock(i) {
    const k = KEYS[i], el = $('dmCor').children[i];
    if (!lived(k)) { haptic(); return toast(`${ST[k].name}は、自室の当番を${NEED}回すると入寮します`, 2400); }
    el.classList.remove('knock'); void el.offsetWidth; el.classList.add('knock');
    knockSfx(); haptic();
    await sleep(700);
    if (!inRoom(k)) return toast(awayMsg(k), 2400);
    cur = k;
    await swap(() => toRoom(k));
  }
  function knockSfx() {
    try { const t = ctx.currentTime; [0, .16, .32].forEach(at => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(190, t + at);
      o.frequency.exponentialRampToValueAtTime(90, t + at + .08); g.gain.setValueAtTime(.35, t + at); g.gain.exponentialRampToValueAtTime(.001, t + at + .12); o.connect(g); g.connect(ctx.destination); o.start(t + at); o.stop(t + at + .15); }); } catch(e) {}
  }

  // ----- 部屋 -----
  async function toRoom(k) {
    const S = ST[k];
    $('dmRT').innerHTML = `${S.name}の部屋<small>ROOM ${101 + KEYS.indexOf(k)}</small>`;
    const bg = $('dmRbg');
    if (S.video) bg.innerHTML = `<video class="dm-v" src="${S.video}_tall_h264.mp4" poster="${S.video}_tall_poster.jpg" autoplay loop muted playsinline></video>`;
    else bg.innerHTML = S.faces.map(f => `<img class="dm-f${f === 'normal' ? ' on' : ''}" data-f="${f}" src="dm_${k}_${f}.jpg" alt="">`).join('');
    bg.style.backgroundImage = S.video ? `url(${S.video}_tall_poster.jpg)` : `url(dm_${k}_normal.jpg)`;
    const v = bg.querySelector('video'); if (v) v.play().catch(() => {});
    chat = await getLog(k);
    show('room');
    $('dmIn').value = '';
    $('dmNm').textContent = S.name;
    try { playVoice(S.voice); } catch(e) {}
    const h0 = hr(), late = (h0 >= 0 && h0 < 2) && LATE[k];
    const line = late || HI[k][Math.floor(Math.random() * HI[k].length)];
    setFace(late ? (S.faces && S.faces.includes('panic') ? 'panic' : 'normal') : (S.faces && S.faces.includes('smile') ? 'smile' : 'normal'));
    await say([line]);
  }
  function setFace(f) {
    const S = ST[cur]; if (!S || !S.faces) return;
    if (!S.faces.includes(f)) f = f === 'panic' && S.faces.includes('shy') ? 'shy' : 'normal';
    $('dmRbg').querySelectorAll('.dm-f').forEach(i => i.classList.toggle('on', i.dataset.f === f));
  }
  // メッセージウィンドウ（1文字ずつ。タップで飛ばす／次へ）
  let typing = null;
  function typeLine(t) {
    return new Promise(res => {
      const el = $('dmTx'); el.textContent = ''; let i = 0; $('dmMw').classList.remove('wait');
      const step = () => { if (i >= t.length) { typing = null; $('dmMw').classList.add('wait'); return res(); } el.textContent += t[i++]; typing = { t, timer:setTimeout(step, 32), res }; };
      typing = { t, res, skip:() => { clearTimeout(typing.timer); el.textContent = t; typing = null; $('dmMw').classList.add('wait'); res(); } };
      step();
    });
  }
  let nextRes = null;
  async function say(lines, face) {
    if (face) setFace(face);
    for (let i = 0; i < lines.length; i++) {
      await typeLine(lines[i]);
      if (i < lines.length - 1) await new Promise(r => { nextRes = r; });
    }
  }
  function tapWindow() {
    if (typing && typing.skip) return typing.skip();
    if (nextRes) { const r = nextRes; nextRes = null; r(); }
  }

  // ----- 会話（AI） -----
  async function loadApi() { api = await DB.get('settings', 'opsApi').catch(() => null); return api; }
  const nowStr = () => { const d = new Date(); return `${D.ymd(D.today())}（${D.dow(D.today())}）${p2(d.getHours())}:${p2(d.getMinutes())}`; };
  async function send() {
    const t = $('dmIn').value.trim(); if (!t || busy || !cur) return;
    if (!api || !api.url) { await loadApi(); if (!api || !api.url) return say(['（作戦室の設定でAIを設定すると、お話しできます）']); }
    busy = true; $('dmIn').value = ''; $('dmIn').blur(); $('dorm').classList.add('busy');
    const k = cur, S = ST[k];
    chat.log.push({ who:'me', text:t.slice(0, 300), at:Date.now() });
    $('dmNm').textContent = '先生'; await typeLine(t);
    $('dmNm').textContent = S.name; $('dmTx').innerHTML = '<span class="dm-dots3"><i></i><i></i><i></i></span>'; $('dmMw').classList.remove('wait');
    let r = null;
    for (let n = 0; n < 3 && !r; n++) {
      try {
        const ac = new AbortController(), to = setTimeout(() => ac.abort(), 60000);
        const res = await fetch(api.url, { method:'POST', cache:'no-store', signal:ac.signal, body:JSON.stringify({ key:api.key, action:'dorm', who:k, now:nowStr(),
          faces:(S.faces || []).map(f => [f, FACE_JA[f]]), log:chat.log.slice(-16).map(m => ({ who:m.who, text:m.text })), mem:chat.mem.slice(-20) }) });
        clearTimeout(to);
        const j = JSON.parse(await res.text());
        if (j.error) { if (j.error === 'budget') { r = { lines:['（今月のAIの予算を使い切りました）'] }; break; } if (j.error === 'key') { r = { lines:['（合言葉が違うみたいです。作戦室の設定を確認してください）'] }; break; } throw new Error(j.error); }
        r = j;
      } catch(e) { await sleep(1200 * (n + 1)); }
    }
    if (!r) r = { lines:['……ごめんなさい、うまく聞き取れなかったみたい'], face:'normal' };
    const lines = (r.lines || []).filter(Boolean).slice(0, 4);
    lines.forEach(x => chat.log.push({ who:k, text:x, at:Date.now() }));
    if (r.memo && typeof r.memo === 'string') { chat.mem.push(r.memo.slice(0, 60)); chat.mem = chat.mem.slice(-20); }
    chat.log = chat.log.slice(-200);
    await DB.put('room', chat).catch(() => {});
    busy = false; $('dorm').classList.remove('busy');
    await say(lines.length ? lines : ['……'], r.face);
  }
  function history() {
    const k = cur, S = ST[k];
    $('dmOv').innerHTML = `<div class="dm-sheet"><div class="dm-sh"><b>${S.name}との会話</b><button data-a="ovx">×</button></div>
      <div class="dm-logs">${chat.log.length ? chat.log.map(m => `<div class="dm-l ${m.who === 'me' ? 'me' : ''}"><small>${m.who === 'me' ? '先生' : S.name}・${D.md(D.key(new Date(m.at)))}</small><p>${esc(m.text)}</p></div>`).join('') : '<p class="dm-none">まだ会話はありません</p>'}</div>
      ${chat.mem.length ? `<div class="dm-mem"><b>${S.name}が覚えていること</b>${chat.mem.map(x => `<span>${esc(x)}</span>`).join('')}</div>` : ''}</div>`;
    $('dmOv').className = 'dm-ov on';
    const l = $('dmOv').querySelector('.dm-logs'); l.scrollTop = l.scrollHeight;
  }

  // ----- 入力 -----
  function onClick(e) {
    const a = e.target.closest('[data-a]');
    if (a) {
      const x = a.dataset.a;
      if (x === 'out') return exit();
      if (x === 'hall') return swap(toHall);
      if (x === 'cor') { if (busy) return; const v = $('dmRbg').querySelector('video'); if (v) v.pause(); return swap(() => toCorridor()); }
      if (x === 'prev' || x === 'next') { const c = $('dmCor'), i = Math.round(c.scrollLeft / c.clientWidth) + (x === 'next' ? 1 : -1); c.scrollTo({ left:c.clientWidth * Math.max(0, Math.min(KEYS.length - 1, i)), behavior:'smooth' }); return; }
      if (x === 'log') return history();
      if (x === 'ovx') { $('dmOv').className = 'dm-ov'; $('dmOv').innerHTML = ''; return; }
    }
    if (e.target === $('dmOv')) { $('dmOv').className = 'dm-ov'; $('dmOv').innerHTML = ''; return; }
    const b = e.target.closest('[data-room]'); if (b) { const i = +b.dataset.room; return swap(() => toCorridor(i)); }
    const d = e.target.closest('[data-door] .dm-fit'); if (d) return knock(+d.parentNode.dataset.door);
    if (e.target.closest('#dmMw')) return tapWindow();
  }

  return {
    makeDoor, setDoor, paintDoor,
    isDoor:() => onDoor,
    active:() => !!scene,
    bgm:() => scene ? (isNight() ? BGM.n : BGM.d) : null,
  };
})();
