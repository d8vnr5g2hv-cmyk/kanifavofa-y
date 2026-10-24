// Kani Favorite — 自室（メモロビの左端の扉 → 机／部屋）
'use strict';
const Room = (() => {
  // ===== 12人 =====
  const NAME = { hoshino:'ホシノ', mika:'ミカ', miyako:'ミヤコ', mari:'マリー', serina:'セリナ', kisaki:'キサキ', hina:'ヒナ', seia:'セイア', noa:'ノア', yuuka:'ユウカ', hikari:'ヒカリ', nico:'ニコ' };
  // 名前の横に出る所属（空欄なら出さない）
  const CLUB = { hoshino:'対策委員会', mika:'ティーパーティー', miyako:'RABBIT小隊', mari:'シスターフッド', serina:'救護騎士団', kisaki:'玄龍門',
                 hina:'風紀委員会', seia:'ティーパーティー', noa:'セミナー', yuuka:'セミナー', hikari:'', nico:'' };
  const HEIGHT = { hoshino:145, mika:157, hina:142, miyako:156, mari:151, serina:156, yuuka:156, noa:161, seia:149, kisaki:142, hikari:147, nico:160 };
  // APIを使わないときのひとこと
  const LINES = {
    hoshino:['うへ〜、先生おかえり〜','今日の当番はおじさんだよ〜。のんびりいこっか','先生、ちゃんと休めてる？'],
    mika:['先生、おかえり☆ 今日の当番は私だよ！','ねえねえ、今日は何する？','えへへ、先生のお部屋って落ち着くね☆'],
    miyako:['先生、本日の当番はRABBIT1です','室内、異常ありません','……うさぎの付箋、貼っておきました'],
    mari:['先生、おかえりなさい。今日は私が当番です','お部屋、少しだけ整えておきました','無理はなさらないでくださいね'],
    serina:['先生、おかえりなさい。お怪我はありませんか？','今日は私が当番です。何でも言ってくださいね','ちゃんと眠れていますか？'],
    kisaki:['よう戻った、先生。今日は妾が当番じゃ','ふむ、この部屋も悪くないのう','先生、茶でも淹れようか'],
    hina:['……おかえり、先生。今日は私が当番','書類なら、片付けておいたわ','先生も少し座ったら？'],
    seia:['おかえり、先生。今日は私が当番だよ','この時間に来ると、夢で見ていたよ','少し、話をしようか'],
    noa:['おかえりなさい、先生♪ 今日の当番はノアです','今日の来訪も、記録しておきますね','ふふ、ユウカちゃんには内緒ですよ'],
    yuuka:['先生、おかえりなさい！今日は私が当番です','机の上、また散らかってましたよ？','予定の確認、しておきましょうか'],
    hikari:['先生だーー！今日はわたしが当番ーー！','ひまだよーーー','おへや、ひろーーい'],
    nico:['先生、おかえりなさい〜。今日は私が当番ですよ〜','お腹すいてませんか〜？','ふふ、ゆっくりしていってくださいね〜'],
  };
  const SLEEP = { hoshino:'うへ〜……日報は出しといたよ〜……先生も、もう寝よ……', mika:'日報、出しておいたよ☆ ……先生も、そろそろ寝なきゃだめだよ？',
    miyako:'日報は提出済みです。……先生も、休息を', mari:'日報はお出ししておきました。先生、どうかお休みください',
    serina:'日報、出しておきました。もう遅いですから、先生も休んでくださいね', kisaki:'日報は出しておいた。……先生、夜更かしは体に毒じゃ',
    hina:'……日報は出したわ。先生も、もう休んで', seia:'日報は届けておいたよ。夜は眠るためにあるものだ、先生',
    noa:'日報は提出済みです♪ 先生のお休みも、記録しておきますね', yuuka:'日報は出しました！先生、もう寝てください。明日に響きますよ？',
    hikari:'にっぽう、だしたーー……ねむいーー……', nico:'日報、出しておきましたよ〜。先生も、おやすみなさい〜' };
  const img = (k, p) => { if (k === 'hikari' && p === 'stand') p = 'sit'; return `o_${k}_${p}.webp`; };

  // ===== 時間帯 =====
  // 6:00〜17:59 昼／18:00〜23:59 夜／0:00〜2:00 夜（見るだけ）／2:01〜5:59 入れない
  function period(d = new Date()) {
    const m = d.getHours() * 60 + d.getMinutes();
    if (m > 120 && m < 360) return 'closed';
    if (m >= 360 && m < 1080) return 'day';
    return 'night';
  }
  const viewOnly = (d = new Date()) => d.getHours() < 6;               // 0:00〜（日報提出のあと）は話せない
  const dutyDay = (d = new Date()) => d.getHours() < 6 ? D.add(D.key(d), -1) : D.key(d);   // 当番の1日は朝6時に切り替わる
  function greet(d = new Date()) { const h = d.getHours(); return h >= 5 && h < 11 ? 'Good morning' : h >= 11 && h < 18 ? 'Hello' : 'Good evening'; }
  const monday = (s = D.today()) => { const dow = D.parse(s).getDay(); return D.add(s, -((dow + 6) % 7)); };

  // ===== 部屋の絵（941×1672）の中の位置 =====
  const W = 941, H = 1672;
  const DESK = { pc:[52, 444, 531, 938], tray:[505, 330, 775, 585], drawer1:[655, 1065, 925, 1147], drawer2:[655, 1150, 925, 1235] };
  const SOFA = { board:[0, 340, 380, 740], cal:[735, 262, 890, 470], game:[745, 910, 880, 990] };
  // 当番の居場所（時間で変わる）：中心x%・足元y%・身長156cmの子の高さ%
  function dutySpot(d = new Date()) {
    const hr = d.getHours();
    if (hr < 6) return { cx:70, by:53, h:15 };            // 夜中：ソファーでうとうと
    if (hr < 11) return { cx:27, by:57, h:19 };           // 朝：ホワイトボードの前
    if (hr < 18) return { cx:55, by:67, h:21 };           // 昼：ソファーの横
    return { cx:31, by:73, h:24 };                        // 夜：机のそば
  }
  const pct = ([x0, y0, x1, y1]) => `left:${(x0 / W * 100).toFixed(2)}%;top:${(y0 / H * 100).toFixed(2)}%;width:${((x1 - x0) / W * 100).toFixed(2)}%;height:${((y1 - y0) / H * 100).toFixed(2)}%`;

  // ===== 音楽 =====
  const TRACK_NAME = {
    'bgm.mp3':['Abydos Afternoon', 'メモロビ・ホシノ'], 'serina_bgm.mp3':['Holy Night', 'メモロビ・セリナ'], 'c2_bgm.mp3':['Tea Party', 'メモロビ・ミカ'],
    'yuuka_bgm.mp3':['Seminar Office', 'メモロビ・ユウカ'], 'c3_bgm.mp3':['Prefect Team', 'メモロビ・ヒナ'], 'seia_bgm.mp3':['Daydream Drive', 'メモロビ・セイア'],
    'bgm_profile.mp3':['RABBIT Squad', 'メモロビ・ミヤコ／Profile'], 'nico_bgm.mp3':['Kitchen', 'メモロビ・ニコ'], 'c5_bgm.mp3':['Sisterhood', 'メモロビ・マリー'],
    'noa_bgm.mp3':['Aquarium', 'メモロビ・ノア'], 'kisaki_bgm.mp3':['Shanhaijing', 'メモロビ・キサキ'], 'night_bgm.mp3':['Midnight', 'メモロビ・夜'],
    'bgm_title.mp3':['Title', 'タイトル'], 'bgm_todo.mp3':['Todo', 'Todo'], 'bgm_love.mp3':['Love', 'Love'], 'bgm_accounts.mp3':['Accounts', 'Accounts'],
    'ops_door_bgm.mp3':['Operation Room', '作戦室・扉'], 'ops_lounge_bgm.mp3':['Standby', '作戦室・待機室'], 'meet_a_bgm.mp3':['Briefing A', '作戦室・会議'],
    'meet_b_bgm.mp3':['Briefing B', '作戦室・会議（重め）'], 'ops_result_bgm.mp3':['Mission Clear', '作戦室・決着'],
  };
  function builtinTracks() {
    const seen = new Set(), list = [];
    const push = b => { if (!b || seen.has(b.src)) return; seen.add(b.src); const n = TRACK_NAME[b.src] || [b.src.replace(/\.mp3$/, ''), '']; list.push({ id:b.src, name:n[0], sub:n[1], bgm:b }); };
    chars.forEach(c => push(c.bgm)); push(TITLE_BGM); Object.values(TAB_BGM).forEach(push); Ops.allBgm().forEach(push);
    return list;
  }
  const DEFAULT_BGM = { day:'bgm.mp3', night:'night_bgm.mp3' };
  let musicSel = null;            // 選んだ曲のid（null＝おまかせ）
  const customUrl = {};           // 追加した曲 → 再生用URL

  let el = null, active = false, onDoor = false, duty = null, per = 'day', api = null;

  // ===== 入口 =====
  function makeDoor() {
    const s = h(`<div class="slide rdoor"><div class="rdbox"><img class="rc" src="room_door.jpg" alt=""><img class="ro" src="room_door_open.jpg" alt="">
      <div class="rplate">先生の部屋<small>SENSEI'S ROOM</small></div></div><div class="rhint">TAP TO ENTER</div><div class="rflash"></div></div>`);
    slidesEl.insertBefore(s, slidesEl.firstChild);
    // 画面が細いときは、扉と名札が見えるように少し右に寄せる
    const box = s.querySelector('.rdbox'), fit = () => fitBox(box, 1027, 1531, 940);
    fit(); addEventListener('resize', fit);
    let tx = 0, ty = 0;
    s.addEventListener('pointerdown', e => { tx = e.clientX; ty = e.clientY; });
    s.addEventListener('pointerup', e => { if (Math.hypot(e.clientX - tx, e.clientY - ty) < 10) openDoor(s); });
    paintDoor(s);
    return s;
  }
  function fitBox(box, w, hh, keepX) {   // keepX：この位置（画像のx）までは画面に入れる
    const p = box.parentNode, PW = p.clientWidth, PH = p.clientHeight; if (!PW) return;
    const s = Math.max(PW / w, PH / hh);
    let left = (PW - w * s) / 2;
    if (keepX && left + keepX * s > PW - 6) left = Math.max(PW - w * s, PW - 6 - keepX * s);
    Object.assign(box.style, { width:w * s + 'px', height:hh * s + 'px', left:left + 'px', top:(PH - hh * s) / 2 + 'px' });
  }
  function paintDoor(s = slidesEl.querySelector('.rdoor')) {
    if (!s) return;
    const closed = period() === 'closed';
    s.classList.toggle('closed', closed);
    s.querySelector('.rhint').textContent = closed ? 'GOOD NIGHT' : 'TAP TO ENTER';
  }
  async function openDoor(s) {
    if (s.classList.contains('opening')) return;
    ctx.resume(); haptic(); paintDoor(s);
    if (period() === 'closed') { toast('もう遅い時間です。先生、おやすみなさい', 2200); return; }
    s.classList.add('opening'); preload();
    sfx('open');
    s.classList.add('opened');
    await sleep(750);
    s.classList.add('flash');
    await sleep(380);
    enter();
    setTimeout(() => s.classList.remove('opening', 'opened', 'flash'), 600);
  }
  function setDoor(v) {
    if (onDoor === v) return;
    onDoor = v; document.body.classList.toggle('atRoomDoor', v);
    if (v) { paintDoor(); preload(); }
  }
  function sfx(kind) {
    const t = ctx.currentTime, g = ctx.createGain(); g.gain.value = .4; g.connect(ctx.destination);
    const tone = (f, a, d, at = 0, type = 'sine') => { const o = ctx.createOscillator(), gg = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t + at);
      gg.gain.setValueAtTime(0, t + at); gg.gain.linearRampToValueAtTime(a, t + at + .01); gg.gain.exponentialRampToValueAtTime(.0001, t + at + d); o.connect(gg); gg.connect(g); o.start(t + at); o.stop(t + at + d + .05); };
    if (kind === 'open') {
      tone(988, .18, .15); tone(1319, .18, .25, .1);
      const n = ctx.createBufferSource(), b = ctx.createBuffer(1, ctx.sampleRate * .6, ctx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2) * .6;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(2200, t + .5);
      n.buffer = b; n.connect(f); f.connect(g); n.start(t + .15);
    }
    if (kind === 'tap') tone(1175, .12, .1, 0, 'triangle');
    if (kind === 'pc') { tone(784, .12, .12, 0, 'triangle'); tone(1175, .12, .2, .08, 'triangle'); }
    if (kind === 'msg') tone(880, .1, .08, 0, 'triangle');
  }
  let pre = false;
  function preload() {
    if (pre) return; pre = true;
    const p = period() === 'day' ? 'd' : 'n';
    ['room_door_open.jpg', `room_desk_${p}.jpg`, `room_sofa_${p}.jpg`].forEach(s => { const i = new Image(); i.src = s; });
  }

  // ===== 部屋 =====
  function build() {
    el = h(`<div id="room">
      <div class="rs" id="rs">
        <div class="rsl"><div class="rbx" data-w="${W}" data-h="${H}"><img class="bg" id="rbgDesk" alt="">
          <div class="hs" data-k="pc" style="${pct(DESK.pc)}"></div>
          <div class="hs" data-k="report" style="${pct(DESK.tray)}"></div>
          <div class="hs" data-k="drawer" style="${pct(DESK.drawer1)}"></div>
          <div class="hs" data-k="drawer" style="${pct(DESK.drawer2)}"></div>
        </div></div>
        <div class="rsl"><div class="rbx" data-w="${W}" data-h="${H}"><img class="bg" id="rbgSofa" alt="">
          <div class="hs" data-k="paper" style="${pct(SOFA.board)}"></div>
          <div class="hs" data-k="cal" style="${pct(SOFA.cal)}"></div>
          <div class="hs" data-k="game" style="${pct(SOFA.game)}"></div>
          <div class="duty" id="rduty"><div class="dw"><img class="s" alt=""><img class="t" alt=""></div></div>
        </div></div>
      </div>
      <div class="rhud"><button class="rback" id="rBack">‹ 出る</button><div class="rttl">SENSEI'S ROOM<small id="rDuty"></small><small id="rBudget"></small></div>
        <button class="rset" id="rSet" aria-label="設定"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/></svg></button></div>
      <div class="rmdots"><i class="on"></i><i></i></div>
      <div id="rz"></div>
      <div id="rmw"><div class="shade"></div><div class="pt" id="rpt"><img class="s" alt=""><img class="t" alt=""></div>
        <div class="top"><button id="rmwLog">LOG</button><button id="rmwEnd">CLOSE</button></div>
        <div class="ch" id="rch"></div>
        <div class="win" id="rwin"><div class="who"><b id="rwN"></b><span id="rwC"></span></div><div class="tx" id="rwT"></div><i class="nx"></i>
          <div class="rinp"><input id="rIn" type="text" placeholder="先生として話す…" autocomplete="off" enterkeyhint="send"><button id="rSend">送信</button></div></div>
      </div>
    </div>`);
    document.body.appendChild(el);
    const rs = $('rs');
    rs.addEventListener('scroll', () => { const i = Math.round(rs.scrollLeft / rs.clientWidth); el.querySelectorAll('.rmdots i').forEach((d, k) => d.classList.toggle('on', k === i)); }, { passive:true });
    el.addEventListener('click', e => {
      const hs = e.target.closest('.hs'); if (hs) return openItem(hs.dataset.k, hs);
      if (e.target.closest('#rduty')) return tapDuty();
    });
    $('rBack').onclick = exit;
    $('rSet').onclick = () => Menu.open('自室', [
      { label:'今日の当番', sub:duty ? NAME[duty] : '', fn:() => toast(`今日の当番は${NAME[duty]}です`) },
      { label:'今月のAIの使いみち', sub:'種類ごとの金額', fn:() => budgetDetail() },
      { label:'AIの設定', sub:'作戦室と同じGASを使います', fn:() => opsSettings() },
    ]);
    $('rz').addEventListener('click', e => { if (e.target.id === 'rz' || e.target.closest('.rzx')) closeZoom(); });
    // メッセージウィンドウ
    $('rwin').addEventListener('click', e => { if (!e.target.closest('.rinp')) advance(); });
    $('rSend').onclick = sendTalk;
    $('rIn').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); sendTalk(); } });
    $('rmwEnd').onclick = () => endTalk(true);
    $('rmwLog').onclick = showLog;
    addEventListener('resize', () => { fit(); const z = $('rz'); if (z && z.classList.contains('on')) fitQuads(z); });
  }
  function fit() {
    if (!el) return;
    el.querySelectorAll('.rbx').forEach(b => fitBox(b, +b.dataset.w, +b.dataset.h));
  }
  function paintRoom() {
    per = period(); const p = per === 'day' ? 'd' : 'n';
    el.classList.toggle('night', per !== 'day');
    $('rbgDesk').src = `room_desk_${p}.jpg`; $('rbgSofa').src = `room_sofa_${p}.jpg`;
  }
  async function pickDuty() {
    const day = dutyDay(), rec = await DB.get('room', 'duty-' + day).catch(() => null);
    if (rec) return rec.who;
    const prev = await DB.get('room', 'duty-' + D.add(day, -1)).catch(() => null);
    const keys = Object.keys(NAME).filter(k => !prev || k !== prev.who);
    const who = keys[Math.floor(Math.random() * keys.length)];
    await DB.put('room', { id:'duty-' + day, who, date:day });
    return who;
  }
  function placeDuty() {
    const d = $('rduty'), sleepy = viewOnly(), at = dutySpot();
    const hh = duty === 'hikari' ? at.h * .55 : at.h * HEIGHT[duty] / 156;
    Object.assign(d.style, { left:at.cx + '%', bottom:(100 - at.by) + '%', height:hh + '%' });
    d.querySelector('.s').src = img(duty, sleepy ? 'sit' : 'stand');
    d.querySelector('.t').src = img(duty, 'talk'); d.classList.toggle('sleepy', sleepy);
    d.querySelector('.zz') && d.querySelector('.zz').remove();
    if (sleepy) d.insertAdjacentHTML('beforeend', '<i class="zz">z z</i>');
    $('rDuty').textContent = `今日の当番：${NAME[duty]}`;
  }
  async function enter() {
    if (!el) build();
    paintRoom();
    duty = await pickDuty();
    placeDuty();
    document.body.classList.add('roomOn');
    el.className = 'show' + (per !== 'day' ? ' night' : '');
    fit(); requestAnimationFrame(fit);
    $('rs').scrollLeft = 0;
    active = true;
    musicSel = (await DB.get('settings', 'roomMusic').catch(() => null) || {}).sel || null;
    syncBgm(0, .8);
    await loadApi();
    if (api && api.url) call('budget', {}, true).catch(() => {}); else $('rBudget').textContent = '';
    checkReport(); markPaper();
    // その日はじめて入ったら、当番があいさつ（部屋のほうへ移ってから）
    const day = dutyDay(), log = await DB.get('room', 'chat-' + day).catch(() => null);
    if (!viewOnly() && (!log || !log.greeted)) setTimeout(() => { if (!active) return; $('rs').scrollTo({ left:$('rs').clientWidth, behavior:'smooth' }); setTimeout(() => openTalk('open'), 650); }, 900);
  }
  function exit() {
    if (!active) return;
    closeZoom(); endTalk(false); if (typeof Games !== 'undefined') Games.close(true);
    el.classList.add('out');
    setTimeout(() => { el.className = ''; document.body.classList.remove('roomOn'); }, 350);
    active = false; syncBgm(200);
  }

  // ===== アイテム =====
  function openItem(k, hs) {
    sfx('tap'); haptic();
    if (k === 'drawer') return;   // 引き出しは、あとでギミックを入れる
    const r = hs.getBoundingClientRect(), cx = r.left + r.width / 2 - innerWidth / 2, cy = r.top + r.height / 2 - innerHeight / 2;
    const F = { pc:openPC, report:openReport, paper:openPaper, cal:openCal, game:openGame }[k];
    if (F) F({ fx:cx + 'px', fy:cy + 'px' });
  }
  function zoom(html, from = {}, cls = '') {
    const z = $('rz');
    z.innerHTML = `<button class="rzx" aria-label="閉じる">×</button><div class="rzc ${cls}" style="--fx:${from.fx || 0};--fy:${from.fy || 0}">${html}</div>`;
    z.classList.add('on');
    return z.querySelector('.rzc');
  }
  function closeZoom() {
    const z = $('rz'); if (!z || !z.classList.contains('on')) return;
    z.classList.remove('on'); z.innerHTML = '';
    Object.values(viewUrls).forEach(u => URL.revokeObjectURL(u)); for (const k in viewUrls) delete viewUrls[k];
  }

  // ----- PC -----
  const IC = {
    music:'<svg viewBox="0 0 24 24"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>',
    stats:'<svg viewBox="0 0 24 24"><path d="M3 20h18"/><path d="M5 16l4-5 4 3 6-8"/><circle cx="19" cy="6" r="1.3"/></svg>',
    mem:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/></svg>',
  };
  const viewUrls = {};
  function openPC(from) {
    sfx('pc');
    const c = zoom('<div class="rpc" id="rpc"></div>', from, 'zpc');
    pcView('home');
    c.addEventListener('click', pcClick);
  }
  function pcHead(t, back) {
    const d = new Date();
    return `<div class="hd">${back ? '<button class="bk" data-pc="home">‹</button>' : ''}<b></b>${t}<span class="tm">${p2(d.getHours())}:${p2(d.getMinutes())}</span></div>`;
  }
  async function pcView(v) {
    const p = $('rpc'); if (!p) return;
    if (v === 'home') {
      const t = D.today(), [evs, todos] = await Promise.all([DB.all('events').catch(() => []), DB.all('todos').catch(() => [])]);
      const ev = evs.filter(e => e.date === t).sort((a, b) => (a.time || '').localeCompare(b.time || '')).slice(0, 3);
      const td = todos.filter(x => !x.done && x.list === 'do' && x.due && x.due <= D.add(t, 1)).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 3);
      const due = x => x.due < t ? '<em class="late">期限切れ</em>' : x.due === t ? '<em>今日</em>' : '<em>明日</em>';
      const nowName = (() => { if (musicSel && musicSel.startsWith('c:')) return '追加した曲'; const b = roomBgm(), n = TRACK_NAME[b.src]; return n ? n[0] : 'Music'; })();
      p.innerHTML = pcHead('SCHALE OS') + `<div class="bd"><div class="wel">${greet()}, Sensei<small>${D.ymd(t)} ${DOW[new Date().getDay()]}</small></div>
        <div class="apps"><div class="app" data-pc="music">${IC.music}<b>Music</b></div><div class="app" data-pc="mem">${IC.mem}<b>Memories</b></div><div class="app" data-pc="stats">${IC.stats}<b>Analytics</b></div></div>
        <div class="wdg"><h6>TODAY</h6>${ev.length ? ev.map(e => `<p><i>${e.time || '終日'}</i>${esc(e.title)}</p>`).join('') : '<p class="mu">今日の予定はありません</p>'}</div>
        <div class="wdg"><h6>TODO</h6>${td.length ? td.map(x => `<p>${due(x)}${esc(x.title)}</p>`).join('') : '<p class="mu">期限の近いTodoはありません</p>'}</div>
        <div class="wdg now" data-pc="music"><h6>NOW PLAYING</h6><p><span class="eq"><i></i><i></i><i></i></span>${esc(nowName)}</p></div></div>`;
    }
    if (v === 'music') {
      const custom = (await DB.all('music').catch(() => [])).sort((a, b) => a.at - b.at);
      const cur = currentTrackId();
      const row = (id, name, sub, i, rm) => `<div class="tr ${cur === id ? 'on' : ''}" data-tr="${esc(id)}" style="animation-delay:${Math.min(i, 14) * .03}s"><i>${cur === id ? '❚❚' : '▶'}</i><div><p>${esc(name)}</p><span>${esc(sub)}</span></div>${rm ? `<button class="rm" data-rm="${esc(id)}">×</button>` : ''}</div>`;
      let html = row('auto', 'Auto', '時間帯に合わせておまかせ', 0, false);
      builtinTracks().forEach((t, i) => html += row(t.id, t.name, t.sub, i + 1, false));
      custom.forEach((t, i) => html += row('c:' + t.id, t.name, '追加した曲', i + 20, true));
      p.innerHTML = pcHead('MUSIC', 1) + `<div class="bd"><div class="ttl">Music<button data-pc="addMusic">＋ 曲を追加</button></div>${html}</div>`;
    }
    if (v === 'stats') {
      const body = await Stats.html(); if (!$('rpc')) return;
      p.innerHTML = pcHead('ANALYTICS', 1) + `<div class="bd sbd"><div class="ttl">Analytics</div>${body}</div>`;
    }
    if (v === 'mem') {
      const list = (await DB.all('album').catch(() => [])).sort((a, b) => b.at - a.at);
      Object.values(viewUrls).forEach(u => URL.revokeObjectURL(u));
      const cells = list.map((a, i) => { const u = viewUrls[a.id] = URL.createObjectURL(a.blob); return `<div data-ph="${a.id}" style="background-image:url(${u});animation-delay:${Math.min(i, 14) * .03}s"></div>`; }).join('');
      p.innerHTML = pcHead('MEMORIES', 1) + `<div class="bd"><div class="ttl">Memories</div><div class="gal"><div class="add" data-pc="addPhoto">＋</div>${cells}</div>${list.length ? '' : '<div class="em">スクショや思い出の写真を、＋から追加できます</div>'}</div>`;
    }
  }
  async function pcClick(e) {
    const rm = e.target.closest('[data-rm]');
    if (rm) { e.stopPropagation(); if (!confirm('この曲をリストから消しますか？')) return; const id = rm.dataset.rm.slice(2); await DB.del('music', id); if (musicSel === 'c:' + id) setMusic(null); return pcView('music'); }
    const tr = e.target.closest('[data-tr]');
    if (tr) { const id = tr.dataset.tr; await setMusic(id === 'auto' ? null : id); return pcView('music'); }
    const st = e.target.closest('[data-st]');
    if (st) { sfx('tap'); Stats.setTab(st.dataset.st); return pcView('stats'); }
    const ph = e.target.closest('[data-ph]');
    if (ph) return viewPhoto(ph.dataset.ph);
    const b = e.target.closest('[data-pc]'); if (!b) return;
    const v = b.dataset.pc;
    if (v === 'addMusic') return pickFile('audio/*', true, addMusic);
    if (v === 'addPhoto') return pickFile('image/*', true, addPhotos);
    sfx('tap'); pcView(v);
  }
  function pickFile(accept, multiple, fn) {
    const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.multiple = multiple;
    i.onchange = () => { if (i.files.length) fn([...i.files]); }; i.click();
  }
  async function addMusic(files) {
    for (const f of files) await DB.put('music', { id:newId(), name:f.name.replace(/\.[^.]+$/, ''), blob:f, at:Date.now() });
    toast('曲を追加しました'); pcView('music');
  }
  // 写真は長い辺1600pxまでに縮めて保存（容量の節約）
  function shrink(file) {
    return new Promise(ok => {
      const u = URL.createObjectURL(file), im = new Image();
      im.onload = () => {
        const s = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
        c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
        c.toBlob(b => ok(b || file), 'image/jpeg', .86);
      };
      im.onerror = () => { URL.revokeObjectURL(u); ok(file); };
      im.src = u;
    });
  }
  async function addPhotos(files) {
    toast('追加しています…', 900);
    for (const f of files) await DB.put('album', { id:newId(), blob:await shrink(f), at:Date.now() });
    toast(`${files.length}枚追加しました`); pcView('mem');
  }
  async function viewPhoto(id) {
    const a = await DB.get('album', id); if (!a) return;
    const u = viewUrls['v'] = URL.createObjectURL(a.blob);
    const v = h(`<div class="rview"><img src="${u}" alt=""><div><button data-x="close">閉じる</button><button data-x="del">削除</button></div></div>`);
    $('rpc').appendChild(v);
    v.onclick = async e => {
      const x = e.target.closest('[data-x]'); if (!x) return; e.stopPropagation();
      if (x.dataset.x === 'del') { if (!confirm('この写真を削除しますか？')) return; await DB.del('album', id); v.remove(); pcView('mem'); }
      else v.remove();
    };
  }
  // ----- 音楽の切り替え -----
  function currentTrackId() { return musicSel || 'auto'; }
  async function setMusic(id) {
    musicSel = id; await DB.put('settings', { id:'roomMusic', sel:id }).catch(() => {});
    if (id && id.startsWith('c:') && !customUrl[id]) {
      const t = await DB.get('music', id.slice(2)); if (t) customUrl[id] = URL.createObjectURL(t.blob);
    }
    syncBgm(0, .6);
  }
  function roomBgm() {
    if (musicSel && musicSel.startsWith('c:')) { const u = customUrl[musicSel]; if (u) return { src:u, loopStart:0, loopEnd:0 }; }
    else if (musicSel) { const t = builtinTracks().find(x => x.id === musicSel); if (t) return t.bgm; }
    const src = DEFAULT_BGM[per === 'day' ? 'day' : 'night'];
    return chars.map(c => c.bgm).find(b => b.src === src) || chars[0].bgm;
  }

  // ----- カレンダー -----
  const GX = [216, 348, 478, 606, 736, 862, 986, 1116], GY = [462, 573, 686, 798, 910, 1023], PX = [284, 413, 542, 672, 798, 924, 1048];
  const CW = 1312, CH = 1199;
  let calMonth = null, calSel = null;
  async function openCal(from) {
    calMonth = D.today().slice(0, 7); calSel = D.today();
    const c = zoom(`<div class="rcal" id="rcal"></div><div class="rday" id="rday"></div>`, from);
    c.style.maxHeight = '100%';
    drawCal();
  }
  async function drawCal() {
    const box = $('rcal'); if (!box) return;
    const [y, m] = calMonth.split('-').map(Number);
    const first = new Date(y, m - 1, 1), days = new Date(y, m, 0).getDate(), off = first.getDay();
    const evs = await DB.all('events').catch(() => []), todos = (await DB.all('todos').catch(() => [])).filter(t => t.due && !t.done);
    const by = {}; const addTo = (d, x) => (by[d] = by[d] || []).push(x);
    evs.forEach(e => addTo(e.date, { t:(e.time ? e.time + ' ' : '') + e.title, td:false, time:e.time || '' }));
    todos.forEach(t => addTo(t.due, { t:t.title, td:true, time:'99' }));
    const today = D.today();
    let html = `<img src="room_cal_${per === 'day' ? 'd' : 'n'}.jpg" alt=""><div class="mo"><b>${m}</b>月 <span style="font-size:11px">${y}</span></div>
      <div class="nav"><button data-cm="-1">‹</button><button data-cm="1">›</button></div>`;
    '日月火水木金土'.split('').forEach((w, i) => html += `<div class="wd" style="left:${(PX[i] - 30) / CW * 100}%;width:${60 / CW * 100}%">${w}</div>`);
    // 6週ある月は、最後の段を「23/30」のように2日分で使う
    const cells = {};
    for (let d = 1; d <= days; d++) { const idx = off + d - 1; let row = Math.floor(idx / 7); const col = idx % 7; if (row > 4) row = 4; (cells[row + '-' + col] = cells[row + '-' + col] || []).push(d); }
    Object.entries(cells).forEach(([rc, ds]) => {
      const [r, c] = rc.split('-').map(Number), key = `${y}-${p2(m)}-${p2(ds[0])}`;
      const items = ds.flatMap(d => by[`${y}-${p2(m)}-${p2(d)}`] || []).sort((a, b) => a.time.localeCompare(b.time));
      const isToday = ds.some(d => `${y}-${p2(m)}-${p2(d)}` === today), isSel = ds.some(d => `${y}-${p2(m)}-${p2(d)}` === calSel);
      const sty = `left:${GX[c] / CW * 100}%;top:${GY[r] / CH * 100}%;width:${(GX[c + 1] - GX[c]) / CW * 100}%;height:${(GY[r + 1] - GY[r]) / CH * 100}%`;
      html += `<div class="cell ${c === 0 ? 'sun' : c === 6 ? 'sat' : ''} ${isToday ? 'tdy' : ''} ${isSel ? 'sel' : ''}" data-d="${isToday ? today : key}" style="${sty}"><span class="n">${ds[0]}</span>${ds[1] ? `<span class="n2">/${ds[1]}</span>` : ''}
        ${items.slice(0, 2).map(x => `<span class="ev ${x.td ? 'td' : ''}">${esc(x.t)}</span>`).join('')}${items.length > 2 ? `<span class="more">+${items.length - 2}</span>` : ''}</div>`;
    });
    box.innerHTML = html;
    box.onclick = e => {
      const n = e.target.closest('[data-cm]'); if (n) { const d = D.addMonth(calMonth + '-01', +n.dataset.cm); calMonth = d.slice(0, 7); sfx('tap'); return drawCal(); }
      const c = e.target.closest('.cell'); if (c) { calSel = c.dataset.d; sfx('tap'); drawCal(); }
    };
    drawDay(evs, todos);
  }
  async function drawDay(evs, todos) {
    const box = $('rday'); if (!box) return;
    evs = evs || await DB.all('events'); todos = todos || (await DB.all('todos')).filter(t => t.due && !t.done);
    const d = calSel, es = evs.filter(e => e.date === d).sort((a, b) => (a.time || '').localeCompare(b.time || '')), ts = todos.filter(t => t.due === d);
    box.innerHTML = `<h4>${D.md(d)}（${D.dow(d)}）${d === D.today() ? ' 今日' : ''}<button id="rAddEv">＋予定</button></h4>
      ${es.map(e => `<div class="it"><i>${e.time || '終日'}</i><span>${esc(e.title)}</span><button data-dev="${e.id}">×</button></div>`).join('')}
      ${ts.map(t => `<div class="it td"><i>Todo</i><span>${esc(t.title)}</span></div>`).join('')}
      ${!es.length && !ts.length ? '<div class="em">予定はありません</div>' : ''}`;
    $('rAddEv').onclick = () => addEvent(d);
    box.querySelectorAll('[data-dev]').forEach(b => b.onclick = async () => { if (!confirm('この予定を消しますか？')) return; await DB.del('events', b.dataset.dev); drawCal(); });
  }
  function addEvent(date, title = '', time = '') {
    const body = h('<div></div>');
    const fT = F.text('予定', title, '例：歯医者'), fD = F.date('日付', date, false), fM = F.text('時刻（なくてもOK）', time, '', 'time');
    body.append(fT.el, fD.el, fM.el);
    Editor.open({ title:'予定を追加', body, focus:fT.input, theme:{ '--accent':'#3d86d6', '--title':'#3d6fa8', '--soft':'#eef5ff', '--line':'#d6e4f5' },
      save:async () => { const t = fT.get(), d = fD.get(); if (!t || !d) return false; await DB.put('events', { id:newId(), date:d, time:fM.get(), title:t, createdAt:Date.now() }); calSel = d; calMonth = d.slice(0, 7); drawCal(); toast('予定を追加しました'); } });
  }

  // ----- ゲーム機 -----
  function openGame(from) {
    zoom(`<div class="rgame"><img class="gbg" src="room_game_${per === 'day' ? 'd' : 'n'}.jpg" alt=""><div class="scr"><div><div class="gmenu"><h6>GAME</h6>
      <button data-g="puzzle">🧩 メモロビパズル<small>PLAY</small></button><button data-g="memory">🃏 神経衰弱<small>PLAY</small></button><button data-g="maker">✏️ アイデア帳<small>SOON</small></button></div></div></div></div>`, from).onclick = e => {
      const g = e.target.closest('[data-g]'); if (!g) return; sfx('tap');
      if (g.dataset.g === 'maker') return toast('準備中です。お楽しみに');
      const r = e.target.closest('.scr').getBoundingClientRect();
      closeZoom();
      Games.open(g.dataset.g, { duty, name:NAME, img, rect:r, host:el });
    };
  }

  // ----- 日報 -----
  let reportBusy = false;
  async function reports() { return (await DB.all('room').catch(() => [])).filter(r => r.id.startsWith('report-')).sort((a, b) => b.date.localeCompare(a.date)); }
  async function markNew() {
    const hs = el && el.querySelector('.hs[data-k="report"]'); if (!hs) return;
    const r = (await reports())[0];
    hs.innerHTML = r && !r.read ? '<i class="new">NEW</i>' : '';
  }
  // 前日の日報（0時に締め切り。アプリを開いていなくても、次に入ったときに届く）
  async function checkReport() {
    const day = D.add(D.today(), -1);
    const have = await DB.get('room', 'report-' + day).catch(() => null);
    if (have || reportBusy) return markNew();
    if (!api || !api.url) return markNew();
    reportBusy = true;
    try {
      const drec = await DB.get('room', 'duty-' + day).catch(() => null), who = drec ? drec.who : (duty || await pickDuty());
      const todos = await DB.all('todos'), evs = await DB.all('events').catch(() => []);
      const inDay = t => t && D.key(new Date(t)) === day;
      const chat = await DB.get('room', 'chat-' + day).catch(() => null);
      const r = await call('report', { who, date:day, dow:D.dow(day),
        done:todos.filter(t => t.done && inDay(t.doneAt)).map(t => t.title).slice(0, 15),
        late:todos.filter(t => !t.done && t.due && t.due <= day).map(t => t.title + '（期限' + D.md(t.due) + '）').slice(0, 10),
        events:evs.filter(e => e.date === day).map(e => (e.time || '') + ' ' + e.title),
        next:{ events:evs.filter(e => e.date === D.today()).map(e => (e.time || '') + ' ' + e.title), todos:todos.filter(t => !t.done && t.due === D.today()).map(t => t.title) },
        log:chat ? chat.log.slice(-16) : [] }, true);
      if (r && r.text) await DB.put('room', { id:'report-' + day, date:day, who, text:r.text, read:false });
    } catch(e) {} finally { reportBusy = false; markNew(); }
  }
  async function openReport(from, idx = 0) {
    const list = await reports();
    const c = zoom(`<div class="rclip"><div class="rrep"><img class="rpbg" src="room_report_${per === 'day' ? 'd' : 'n'}.jpg" alt=""><div class="rph" id="rph"></div><div class="sheet" id="rsheet"></div><div class="rstamp" id="rstamp"></div></div>
      <div class="rnav"><button data-rn="1">‹ 前の日</button><button data-rn="-1">次の日 ›</button></div></div>`, idx ? {} : from);
    const rr = c.querySelector('.rrep'), unit = () => rr.style.setProperty('--ru', rr.clientHeight / 1402 + 'px');
    unit(); requestAnimationFrame(unit);
    const show = async i => {
      const s = $('rsheet'); if (!s) return;
      const r = list[i];
      c.querySelector('[data-rn="1"]').disabled = i >= list.length - 1; c.querySelector('[data-rn="-1"]').disabled = i <= 0;
      $('rph').innerHTML = r ? `<b>日報</b><span>${D.ymd(r.date)}（${D.dow(r.date)}）</span>` : '<b>日報</b>';
      $('rstamp').innerHTML = r ? `<i>${NAME[r.who] || ''}<small>確認</small></i>` : '';
      if (!r) { s.innerHTML = `<div class="rload">${reportBusy ? `<img src="${img(duty, 'stand')}" alt="">当番が日報を書いています…` : 'まだ日報はありません。<br>毎日0時に、その日の当番が書いてくれます。' + (api && api.url ? '' : '<br><br>（右上の設定から、AIの設定をすると届くようになります）')}</div>`; return; }
      s.innerHTML = `<div class="meta">当番：${NAME[r.who] || ''}　提出 0:00</div><div class="body">${esc(r.text)}</div>`;
      s.scrollTop = 0;
      if (!r.read) { r.read = true; await DB.put('room', r); markNew(); }
    };
    let i = idx; show(i);
    c.querySelector('.rnav').onclick = e => { const b = e.target.closest('[data-rn]'); if (!b || b.disabled) return; i += +b.dataset.rn; sfx('tap'); show(i); };
  }

  // ----- 新聞（ホワイトボードのアップ） -----
  // アップ画像（1440×1200）と、その中の2枚の紙の位置 [左, 上, 幅, 高さ]
  // 紙は少し傾いて貼ってあるので、四隅の位置（左上・右上・右下・左下）に合わせて変形して重ねる
  const NP = { W:1374, H:1145, quads:[[[324, 159], [720, 191], [725, 814], [315, 831]], [[749, 193], [1093, 223], [1104, 797], [753, 811]]],
    // 紙の上に乗っているマグネットとテープ（元の絵を切り抜いて、いちばん上に重ねる）
    front:[[[472, 143], [538, 143], [538, 216], [472, 216]], [[889, 181], [958, 181], [958, 250], [889, 250]],
      [[658, 186], [673, 172], [733, 228], [716, 245]], [[298, 796], [313, 776], [368, 822], [352, 843]],
      [[1038, 213], [1051, 199], [1098, 241], [1083, 258]], [[1044, 781], [1103, 712], [1126, 731], [1062, 803]]] };
  // 正方形 → 四角形 の射影変換（CSSの matrix3d 用）
  function quadMatrix(q, w, hh, k) {
    const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q.map(([x, y]) => [x * k, y * k]);
    const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2, sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
    const den = dx1 * dy2 - dx2 * dy1, g = (sx * dy2 - dx2 * sy) / den, hh2 = (dx1 * sy - sx * dy1) / den;
    const a = x1 - x0 + g * x1, b = x3 - x0 + hh2 * x3, d = y1 - y0 + g * y1, e = y3 - y0 + hh2 * y3;
    return `matrix3d(${a / w},${d / w},0,${g / w},${b / hh},${e / hh},0,${hh2 / hh},0,0,1,0,${x0},${y0},0,1)`;
  }
  function fitQuads(root) {
    const b = root.querySelector('.rnp'); if (!b || !b.clientWidth) return;
    const k = b.clientWidth / NP.W;
    b.querySelectorAll('.npq').forEach((w, i) => { w.style.transform = quadMatrix(NP.quads[i], PW, PH, k); });
  }
  const PW = 1000, PH = 1540;   // 紙の中の座標（補正した紙の画像の大きさ）
  // 紙に印刷されている枠：[左, 上, 右, 下]
  const SLOT = { title:[142, 117, 808, 270], big:[70, 357, 622, 737], right:[670, 357, 957, 737], c1:[75, 775, 330, 1100], c2a:[362, 775, 625, 1128], c2b:[362, 1142, 625, 1500],
                 c3:[675, 762, 957, 1075], bl:[62, 1112, 325, 1387], br:[675, 1100, 957, 1387] };
  const PLACE = [['big', 'c1'], ['right', 'c3'], ['bl', 'c2a'], ['br', 'c2b']];   // 1面・2面それぞれ4つの記事の置き場（写真, 本文）
  const KIND_COLOR = { 急募:'#ff6b8a', 速報:'#ff9a3c', インタビュー:'#3d9cf0', コラム:'#7c8fd6', お悩み相談:'#b47ce0', 特集:'#20b39a', ひとこと:'#8a9ab0', 募集中:'#e06c9f' };
  const COLOR = { hoshino:'#ff9ec4', mika:'#f2a2d6', miyako:'#8fb8ff', mari:'#ffb26b', serina:'#ff8f9a', kisaki:'#e6b24f', hina:'#b48cff', seia:'#f5c95c', noa:'#aab8f0', yuuka:'#5c9cff', hikari:'#86d86a', nico:'#ffa98f' };
  const ADS = [
    { head:'ゲーム開発部　テストプレイヤー募集中！', body:'新作のテストプレイをしてくれる人を探しています。報酬はクリアしたときの達成感です。先生も大歓迎！' },
    { head:'給食部　試食係、募集中！', body:'新メニューの味見をしてくれる人を探しています。おかわり自由。ただし感想は正直にお願いします。' },
    { head:'シャーレ冷蔵庫　名前書き運動にご協力を', body:'プリンに名前を書いていないと、だれかのおなかに消えてしまいます。名前ペンは冷蔵庫の横にあります。' },
    { head:'補習授業部　一緒に勉強してくれる人募集！', body:'テスト前の放課後、勉強会をひらきます。わからないところを聞ける人がいると、とっても助かります。' },
    { head:'風紀委員会より　夜ふかし取り締まり週間', body:'今週は夜ふかし取り締まり強化週間です。先生も対象です。早く寝てください。' },
    { head:'便利屋68　ご依頼お待ちしております', body:'ペット探しから大掃除まで、なんでも承ります。お値段は応相談。社長はとても頼りになります。' },
  ];
  let npWeek = null, npPage = 0;
  const weekOf = s => monday(s);
  async function weekArts(week) {
    return (await DB.all('room').catch(() => [])).filter(r => r.id.startsWith('art-') && r.week === week).sort((a, b) => a.date.localeCompare(b.date));
  }
  // 一面：先生が選んだもの → 写真付きで注目度が高いもの → 全体で注目度が高いもの（同じなら新しいほう）
  function arrange(arts, pick) {
    const by = (a, b) => (b.score || 3) - (a.score || 3) || b.date.localeCompare(a.date);
    let front = arts.find(a => a.id === pick);
    if (!front) front = arts.filter(a => a.photo).sort(by)[0] || arts.slice().sort(by)[0];
    const rest = arts.filter(a => a !== front);
    const list = front ? [front, ...rest] : [];
    return [[list[0], list[1], list[2], list[3]], [list[4], list[5], list[6], 'ad']];
  }
  const rect = (r, mirror) => { const [x0, y0, x1, y1] = r, a = mirror ? PW - x1 : x0, b = mirror ? PW - x0 : x1; return `left:${a}px;top:${y0}px;width:${b - a}px;height:${y1 - y0}px`; };
  function photoUrl(a) { if (!a || !a.photo) return null; if (!viewUrls[a.id]) viewUrls[a.id] = URL.createObjectURL(a.photo); return viewUrls[a.id]; }
  // 1枚の紙（1000×1540の座標で組んで、表示するときに縮める）
  function sheetHTML(page, items, week, no) {
    const mir = page === 1, ad = ADS[(no - 1) % ADS.length];
    let html = `<div class="nps" style="width:${PW}px;height:${PH}px"><img class="npbg ${mir ? 'mir' : ''}" src="room_np_paper.jpg" alt="">
      <div class="npt" style="${rect(SLOT.title, mir)}">${page === 0 ? `<b>シャーレ週報</b><span>第${no}号　${D.md(week)}〜${D.md(D.add(week, 6))}</span>` : `<b>2面</b><span>生徒たちの取材ノート</span>`}</div>`;
    items.forEach((a, k) => {
      const [ps, ts] = PLACE[k], front = page === 0 && k === 0;
      if (a === 'ad') {
        html += `<div class="npp ad" style="${rect(SLOT[ps], mir)}"><i>📣</i></div>
          <div class="npx ad" style="${rect(SLOT[ts], mir)}"><span class="kd" style="background:${KIND_COLOR['募集中']}">募集中！</span><h6>${esc(ad.head)}</h6><p>${esc(ad.body)}</p></div>`;
      } else if (!a) {
        html += `<div class="npp none" style="${rect(SLOT[ps], mir)}"></div><div class="npx none" style="${rect(SLOT[ts], mir)}"><div class="stk">取材中…<small>当番がネタを集めています</small></div></div>`;
      } else {
        const u = photoUrl(a), c = COLOR[a.who] || '#9ab';
        html += `<div class="npp ${u ? '' : 'nophoto'}" data-art="${a.id}" style="${rect(SLOT[ps], mir)};--c:${c}">${u ? `<img src="${u}" alt="">` : `<img class="ch" src="${img(a.who, 'stand')}" alt=""><em>写真なし</em>`}</div>
          <div class="npx ${front ? 'front' : ''}" data-art="${a.id}" style="${rect(SLOT[ts], mir)};--c:${c}"><span class="kd" style="background:${KIND_COLOR[a.kind] || '#7c8fd6'}">${esc(a.kind)}</span>
            <h6>${esc(a.head)}</h6><p>${esc(a.body)}</p><div class="by"><img src="${img(a.who, 'stand')}" alt="">${NAME[a.who] || ''}記者</div></div>`;
      }
    });
    return html + '</div>';
  }
  function fitSheets(root) {   // 紙の中身を、表示されている大きさに合わせて縮める
    root.querySelectorAll('.npwrap').forEach(w => { const s = w.querySelector('.nps'); if (s && w.clientWidth) s.style.transform = `scale(${w.clientWidth / PW})`; });
  }
  async function issue(week) {
    const arts = await weekArts(week), pick = (await DB.get('room', 'front-' + week).catch(() => null) || {}).art;
    const no = Math.max(1, Math.round((D.parse(week) - D.parse('2026-10-19')) / 604800000) + 1);
    return { arts, pages:arrange(arts, pick), no };
  }
  async function markPaper() {
    const hs = el && el.querySelector('.hs[data-k="paper"]'); if (!hs) return;
    const arts = await weekArts(monday());
    hs.innerHTML = arts.some(a => a.read === false) ? '<i class="new">NEW</i>' : '';
  }
  // ホワイトボードのアップ（2枚が貼ってある）
  async function openPaper(from, week) {
    npWeek = week || monday();
    const { arts, pages, no } = await issue(npWeek);
    const wb = `room_wb_${per === 'day' ? 'd' : 'n'}.jpg`;
    const c = zoom(`<div class="rnp"><img class="npwb" src="${wb}" alt="">
      ${NP.quads.map((q, i) => `<div class="npq" data-pg="${i}" style="width:${PW}px;height:${PH}px">${sheetHTML(i, pages[i], npWeek, no)}</div>`).join('')}
      ${NP.front.map(f => `<img class="npfr" src="${wb}" style="clip-path:polygon(${f.map(([x, y]) => `${(x / NP.W * 100).toFixed(2)}% ${(y / NP.H * 100).toFixed(2)}%`).join(',')})" alt="">`).join('')}
      </div><div class="npnav"><button data-wk="-7">‹ 前の号</button><span>第${no}号</span><button data-wk="7" ${npWeek >= monday() ? 'disabled' : ''}>次の号 ›</button></div>
      <p class="nphint">${arts.length ? '紙をタップすると読めます' : '今週はまだ記事がありません。当番が取材に来るのを待ってね'}</p>`, week ? {} : from);
    requestAnimationFrame(() => fitQuads(c));
    c.onclick = e => {
      const w = e.target.closest('[data-wk]'); if (w) { if (w.disabled) return; sfx('tap'); return openPaper(null, D.add(npWeek, +w.dataset.wk)); }
      const p = e.target.closest('.npq'); if (p) { sfx('tap'); readSheet(+p.dataset.pg); }
    };
    arts.filter(a => a.read === false).forEach(a => { a.read = true; DB.put('room', a).catch(() => {}); });
    setTimeout(markPaper, 300);
  }
  // 紙を読む（1面・2面）
  async function readSheet(pg) {
    npPage = pg;
    const { pages, no } = await issue(npWeek);
    const c = zoom(`<div class="npr"><div class="nptab"><button data-pg="0" class="${pg === 0 ? 'on' : ''}">1面</button><button data-pg="1" class="${pg === 1 ? 'on' : ''}">2面</button><button data-back="1">ボードに戻る</button></div>
      <div class="npwrap big">${sheetHTML(pg, pages[pg], npWeek, no)}</div></div>`);
    requestAnimationFrame(() => fitSheets(c));
    let sx = 0;
    c.addEventListener('pointerdown', e => { sx = e.clientX; });
    c.addEventListener('pointerup', e => { const dx = e.clientX - sx; if (Math.abs(dx) > 60 && !e.target.closest('button')) { const n = dx < 0 ? 1 : 0; if (n !== npPage) readSheet(n); } });
    c.onclick = e => {
      const t = e.target.closest('[data-pg]'); if (t) { sfx('tap'); return readSheet(+t.dataset.pg); }
      if (e.target.closest('[data-back]')) return openPaper(null, npWeek);
      const a = e.target.closest('[data-art]'); if (a) { sfx('tap'); readArticle(a.dataset.art); }
    };
  }
  // 記事を1本読む
  async function readArticle(id) {
    const { arts, pages } = await issue(npWeek), i = arts.findIndex(a => a.id === id), a = arts[i]; if (!a) return;
    const front = pages[0][0] && pages[0][0].id;
    const u = photoUrl(a), c = COLOR[a.who] || '#9ab';
    const box = zoom(`<div class="npa" style="--c:${c}"><div class="ph">${u ? `<img src="${u}" alt="">` : `<img class="ch" src="${img(a.who, 'stand')}" alt=""><em>写真なし</em>`}</div>
      <div class="bd"><span class="kd" style="background:${KIND_COLOR[a.kind] || '#7c8fd6'}">${esc(a.kind)}</span><h4>${esc(a.head)}</h4><p>${esc(a.body)}</p>
      <div class="by"><img src="${img(a.who, 'stand')}" alt=""><b>${NAME[a.who] || ''}記者</b><span>${D.md(a.date)}（${D.dow(a.date)}）取材</span><i class="hanko">${(NAME[a.who] || '').slice(0, 2)}</i></div></div>
      <div class="act"><button data-x="prev" ${i <= 0 ? 'disabled' : ''}>‹</button><button data-x="front" ${front === a.id ? 'disabled' : ''}>${front === a.id ? '一面にしています' : '一面にする'}</button>
        <button data-x="photo">${u ? '写真を変える' : '写真を貼る'}</button><button data-x="next" ${i >= arts.length - 1 ? 'disabled' : ''}>›</button></div>
      <button class="npback" data-x="back">紙面に戻る</button></div>`);
    box.onclick = async e => {
      const b = e.target.closest('[data-x]'); if (!b || b.disabled) return; sfx('tap');
      const x = b.dataset.x;
      if (x === 'prev') return readArticle(arts[i - 1].id);
      if (x === 'next') return readArticle(arts[i + 1].id);
      if (x === 'back') return readSheet(npPage);
      if (x === 'front') { await DB.put('room', { id:'front-' + npWeek, art:a.id }); toast('一面にしました'); return readArticle(a.id); }
      if (x === 'photo') pickFile('image/*', false, async ([f]) => { a.photo = await shrink(f); if (viewUrls[a.id]) { URL.revokeObjectURL(viewUrls[a.id]); delete viewUrls[a.id]; } await DB.put('room', a); readArticle(a.id); });
    };
  }

  // ===== 新聞の取材（1日1回、当番が先生にインタビュー） =====
  const IV = {
    ask:{ hoshino:'ねえ先生〜、今日の新聞のネタ、なにかない〜？ おじさんが記事にしてあげるよ〜', mika:'先生！今日の新聞のネタちょうだい☆ なんでもいいよ、私がかわいく書くから！',
      miyako:'先生、本日の取材任務です。新聞のネタを一件、ご提供いただけますか', mari:'先生、新聞のお手伝いをしています。今日はなにかお話を聞かせていただけますか？',
      serina:'先生、今日の新聞のネタ集めをしているんです。なにかありませんか？', kisaki:'先生、今日は妾が記者じゃ。なにか面白い話はないかのう？',
      hina:'……先生。新聞の記事、今日は私の番なの。なにか話題、ある？', seia:'先生、今日は私が筆を執る日だ。君の話を、ひとつ聞かせてくれないか',
      noa:'先生、今日の取材をさせてください♪ どんなお話でも、しっかり記録しますね', yuuka:'先生、新聞の記事を一本書かないといけないんです。ネタ、ありませんか？',
      hikari:'せんせーー！しんぶんのネタちょうだーーい！', nico:'先生〜、今日の新聞のネタ、なにかありませんか〜？' },
    write:{ hoshino:'うへ〜、いいネタもらっちゃった。ちょっと書いてくるね〜', mika:'ありがと☆ じゃあ書いてくるね！', miyako:'取材完了。記事を作成します', mari:'ありがとうございます。心をこめて書きますね',
      serina:'ありがとうございます！すぐ書いてきますね', kisaki:'うむ、しかと聞いた。筆を執るとしよう', hina:'……わかった。書いてくるわ', seia:'ありがとう。言葉にしてみるよ',
      noa:'ありがとうございます♪ 記事にまとめますね', yuuka:'了解です！手早くまとめます！', hikari:'かいてくるーー！', nico:'ありがとうございます〜。書いてきますね〜' },
    photo:{ hoshino:'あ、写真もあったら貼りたいな〜。なにかある〜？', mika:'写真もあったら貼りたいな☆ ある？', miyako:'写真資料があれば、ご提供ください', mari:'もしよろしければ、写真もいただけますか？',
      serina:'写真もあれば、一緒に貼りたいです', kisaki:'絵になるものはあるかの？写真じゃ', hina:'写真、ある？あれば貼るわ', seia:'添える写真はあるかな？', noa:'写真もあれば、記録として貼りますね♪',
      yuuka:'写真があると記事が映えるんですけど、ありますか？', hikari:'しゃしんもちょうだーーい！', nico:'写真もあったら、うれしいです〜' },
    thanks:{ hoshino:'ありがと〜。ホワイトボードに貼っておくね〜', mika:'ありがと☆ さっそく貼ってくるね！', miyako:'掲示を完了しました', mari:'ありがとうございます。貼っておきますね',
      serina:'ありがとうございます！貼っておきますね', kisaki:'うむ、貼っておいたぞ', hina:'……貼っておいたわ', seia:'貼っておいたよ。いい紙面になりそうだ', noa:'貼っておきました♪',
      yuuka:'貼っておきました！今週の新聞、いい感じです', hikari:'はったーー！', nico:'貼っておきましたよ〜' },
    skip:'わかった。また明日、聞かせてね',
    q:'それで、それで？ もっと聞かせて！',
  };
  let ivMode = false, iv = null;
  async function ivRec() {
    const day = dutyDay();
    return (await DB.get('room', 'iv-' + day).catch(() => null)) || { id:'iv-' + day, date:day, who:duty, status:'new', log:[] };
  }
  const saveIv = () => DB.put('room', iv).catch(() => {});
  // 取材を始める（まだ今日の記事がなければ）。始めたら true
  async function maybeInterview() {
    if (!api || !api.url || viewOnly()) return false;
    if (await DB.get('room', 'art-' + dutyDay()).catch(() => null)) return false;
    iv = await ivRec();
    if (iv.status === 'skip' || iv.status === 'done') return false;
    if (iv.status === 'write') { await writeArticle(true); return true; }   // 前回うまく書けなかった分
    await sayLines([IV.ask[duty]]);
    choice([['talk', 'ネタを話す'], ['skip', '今日はパス']], async v => {
      if (v === 'skip') { iv.status = 'skip'; saveIv(); await sayLines([IV.skip]); return toInput(); }
      iv.status = 'active'; iv.log = []; saveIv(); ivMode = true;
      await sayLines(['やった！ じゃあ、話題を教えて！']); toInput();
    });
    return true;
  }
  function choice(list, fn) {
    $('rch').innerHTML = list.map(([v, l]) => `<button data-c="${v}">${esc(l)}</button>`).join('');
    setMode('choice');
    $('rch').onclick = e => { const b = e.target.closest('[data-c]'); if (!b) return; $('rch').innerHTML = ''; showWin(); setMode('typing'); fn(b.dataset.c); };
  }
  async function ivSend(t) {
    iv.log.push({ who:'me', text:t }); saveIv();
    const turns = iv.log.filter(m => m.who === 'me').length;
    if (turns >= 3) return writeArticle(false);
    $('rwT').textContent = ''; setMode('think');
    let line = IV.q;
    try { const r = await call('interview', { who:duty, log:iv.log }); if (r.line) line = r.line; } catch(e) {}
    iv.log.push({ who:'duty', text:line }); saveIv();
    if (mode === 'off') return;
    await sayLines([line]); toInput();
  }
  async function writeArticle(retry) {
    ivMode = false; iv.status = 'write'; saveIv();
    await sayLines([retry ? 'あ、先生。さっきの記事、もう一回書いてみるね' : IV.write[duty]]);
    $('rwT').textContent = '記事を書いています'; setMode('think');
    let r;
    try { r = await call('article', { who:duty, date:dutyDay(), log:iv.log }); } catch(e) {}
    if (!r || !r.head) { await sayLines(['……ごめんね、うまくまとまらなかった。あとでもう一回書いてみるね']); return toInput(); }
    const day = dutyDay();
    const art = { id:'art-' + day, date:day, week:weekOf(day), who:duty, kind:r.kind, head:r.head, body:r.body, score:r.score, photo:null, read:false, at:Date.now(), log:iv.log };
    await DB.put('room', art);
    iv.status = 'done'; saveIv(); markPaper();
    sfx('pc');
    await sayLines([r.line || '書けたよ、先生！', `見出しは「${r.head}」！`, IV.photo[duty]]);
    choice([['photo', '写真を選ぶ'], ['no', '写真なしでOK']], async v => {
      if (v === 'photo') {
        pickFile('image/*', false, async ([f]) => { art.photo = await shrink(f); await DB.put('room', art); if (mode === 'off') return; await sayLines([IV.thanks[duty]]); toInput(); });
        await sayLines(['写真、待ってるね！（あとから新聞の記事からも貼れるよ）']); return toInput();
      }
      await sayLines([IV.thanks[duty]]); toInput();
    });
  }

  // ===== 当番との会話（メッセージウィンドウ） =====
  let queue = [], typing = null, mode = 'off', talkLog = null, pendingAct = null;
  async function chatRec() {
    const day = dutyDay();
    return (await DB.get('room', 'chat-' + day).catch(() => null)) || { id:'chat-' + day, date:day, who:duty, log:[], greeted:false };
  }
  async function saveChat() { if (talkLog) await DB.put('room', talkLog).catch(() => {}); }
  function showWin() {
    const pt = $('rpt');
    pt.className = 'pt' + (duty === 'hikari' ? ' hikari' : '');
    pt.querySelector('.s').src = img(duty, 'stand'); pt.querySelector('.t').src = img(duty, 'talk');
    $('rwN').textContent = NAME[duty]; $('rwC').textContent = CLUB[duty] || '';
    $('rwT').textContent = '';
    $('rmw').className = 'on';
  }
  function setMode(m) { mode = m; const w = $('rmw'); ['wait', 'input', 'choice', 'think'].forEach(c => w.classList.toggle(c, c === m)); }
  function sayLines(lines) {
    queue = lines.slice();
    return new Promise(res => { queue.done = res; nextLine(); });
  }
  function nextLine() {
    const t = queue.shift();
    if (t == null) { $('rpt').classList.remove('talk'); const f = queue.done; queue = []; if (f) f(); return; }
    const box = $('rwT'); box.textContent = ''; setMode('typing'); $('rpt').classList.add('talk');
    let i = 0;
    clearInterval(typing);
    typing = setInterval(() => {
      box.textContent = t.slice(0, ++i);
      if (i >= t.length) { clearInterval(typing); typing = null; $('rpt').classList.remove('talk'); setMode('wait'); }
    }, 38);
    box._full = t;
  }
  function advance() {
    if (mode === 'typing') { clearInterval(typing); typing = null; $('rwT').textContent = $('rwT')._full; $('rpt').classList.remove('talk'); setMode('wait'); return; }
    if (mode === 'wait') { sfx('msg'); nextLine(); }
  }
  function ctxData(todos, evs) {
    const t = D.today(), now = new Date();
    return {
      who:duty, now:`${D.ymd(t)}（${D.dow(t)}）${p2(now.getHours())}:${p2(now.getMinutes())}`,
      todos:todos.filter(x => !x.done && x.list === 'do').sort((a, b) => (a.due || '9').localeCompare(b.due || '9')).slice(0, 10).map(x => ({ title:x.title, due:x.due || '' })),
      events:evs.filter(e => e.date >= t && e.date <= D.add(t, 7)).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))).slice(0, 10).map(e => ({ date:e.date, time:e.time || '', title:e.title })),
    };
  }
  async function openTalk(kind) {
    if (!active || mode !== 'off') return;
    talkLog = await chatRec(); talkLog.who = duty;
    showWin(); sfx('msg');
    if (kind === 'open') dutyVoice();
    if (viewOnly()) { await sayLines([SLEEP[duty]]); return endTalk(false); }
    let lines;
    if (kind === 'open' && api && api.url) {
      setMode('think');
      try {
        const [todos, evs] = await Promise.all([DB.all('todos'), DB.all('events').catch(() => [])]);
        const r = await call('room', Object.assign({ mode:'open', log:talkLog.log.slice(-12) }, ctxData(todos, evs)), true);
        lines = (r.lines || []).filter(Boolean);
      } catch(e) {}
    }
    if (kind !== 'open') {   // 取材の途中なら、続きから
      const r0 = await ivRec();
      if (r0.status === 'active' && api && api.url) { iv = r0; ivMode = true; await sayLines(['先生、取材の続きをしよう！']); return toInput(); }
    }
    if (!lines || !lines.length) { const L = LINES[duty]; lines = [kind === 'open' ? L[0] : L[1 + Math.floor(Math.random() * (L.length - 1))]]; }
    talkLog.greeted = true;
    lines.forEach(t => talkLog.log.push({ who:'duty', text:t }));
    await saveChat();
    await sayLines(lines);
    if (await maybeInterview()) return;
    toInput();
  }
  function toInput() {
    if (mode === 'off') return;
    setMode('input');
    const i = $('rIn'); i.disabled = !(api && api.url);
    const turns = ivMode && iv ? iv.log.filter(m => m.who === 'me').length : 0;
    i.placeholder = !(api && api.url) ? 'AIの設定をすると、話しかけられます' : ivMode ? (turns ? `取材に答える（${turns + 1}/3）` : '話題を教えて（例：おいしいラーメン屋さん）') : `${NAME[duty]}に話しかける…`;
  }
  async function sendTalk() {
    const i = $('rIn'), t = i.value.trim(); if (!t || mode !== 'input') return;
    i.value = ''; i.blur();
    if (ivMode) return ivSend(t);
    talkLog.log.push({ who:'me', text:t });
    $('rwT').textContent = ''; setMode('think');
    let r;
    try {
      const [todos, evs] = await Promise.all([DB.all('todos'), DB.all('events').catch(() => [])]);
      r = await call('room', Object.assign({ mode:'talk', text:t, log:talkLog.log.slice(-16) }, ctxData(todos, evs)));
    } catch(e) { r = { lines:['……ごめんね、先生。今ちょっと、うまく聞き取れなかったみたい'] }; }
    const lines = (r.lines || []).filter(Boolean);
    lines.forEach(x => talkLog.log.push({ who:'duty', text:x }));
    await saveChat();
    if (mode === 'off') return;
    await sayLines(lines.length ? lines : ['……うん']);
    if (r.todo && r.todo.title) return offer('todo', r.todo);
    if (r.event && r.event.title && r.event.date) return offer('event', r.event);
    toInput();
  }
  function offer(kind, x) {
    pendingAct = { kind, x };
    const label = kind === 'todo' ? `Todoに追加：「${x.title}」${x.due ? `（${D.md(x.due)}まで）` : ''}` : `予定に追加：${D.md(x.date)} ${x.time || ''} 「${x.title}」`;
    $('rch').innerHTML = `<button data-c="yes">${esc(label)}</button><button data-c="no">追加しない</button>`;
    setMode('choice');
    $('rch').onclick = async e => {
      const b = e.target.closest('[data-c]'); if (!b) return;
      const ok = b.dataset.c === 'yes', a = pendingAct; pendingAct = null; $('rch').innerHTML = '';
      if (ok && a.kind === 'todo') {
        await DB.put('todos', { id:newId(), list:'do', title:a.x.title.slice(0, 80), memo:`自室で${NAME[duty]}にお願いした`, due:a.x.due || '', repeat:'none', done:false, doneAt:null, createdAt:Date.now(), order:0 });
        if (typeof Todo !== 'undefined') Todo.reload();
      }
      if (ok && a.kind === 'event') await DB.put('events', { id:newId(), date:a.x.date, time:a.x.time || '', title:a.x.title.slice(0, 60), createdAt:Date.now() });
      showWin(); setMode('typing');
      await sayLines([ok ? (a.kind === 'todo' ? 'Todoに書いておいたよ、先生' : 'カレンダーに書いておいたよ、先生') : 'わかった。必要になったら言ってね']);
      toInput();
    };
  }
  function endTalk(bye) {
    if (mode === 'off') return;
    ivMode = false;   // 取材の途中で閉じても、次に話しかけたら続きから
    clearInterval(typing); typing = null; queue = [];
    $('rmw').className = ''; mode = 'off'; $('rch').innerHTML = '';
  }
  // 当番のボイス（鳴っている間は口が動く絵に）
  function dutyVoice() {
    const k = typeof Games !== 'undefined' && Games.VOICE[duty]; if (!k) return;
    const on = v => { const d = $('rduty'); if (d) d.classList.toggle('talk', v && !d.classList.contains('sleepy')); const pt = $('rpt'); if (pt && v) pt.classList.add('talk'); };
    playVoice(k, { start:() => on(true), end:() => on(false) });
  }
  function tapDuty() {
    sfx('tap'); haptic(); dutyVoice();
    const d = $('rduty'); d.animate([{ transform:'translateX(-50%) translateY(0)' }, { transform:'translateX(-50%) translateY(-6%)' }, { transform:'translateX(-50%) translateY(0)' }], { duration:320, easing:'ease-out' });
    setTimeout(() => openTalk('tap'), 200);
  }
  function showLog() {
    if (!talkLog || !talkLog.log.length) return toast('まだ会話はありません');
    const body = h(`<div class="oplog">${talkLog.log.map(m => m.who === 'me' ? `<p class="me">${esc(m.text)}</p>` : `<p><b>${NAME[talkLog.who] || ''}</b>${esc(m.text)}</p>`).join('')}</div>`);
    Editor.open({ title:`${D.md(talkLog.date)}の会話`, body, theme:{ '--accent':'#3d86d6', '--title':'#3d6fa8', '--soft':'#eef5ff', '--line':'#d6e4f5' } });
  }

  // ===== GAS（AI）との通信：作戦室と同じ設定を使う =====
  async function loadApi() { api = await DB.get('settings', 'opsApi').catch(() => null); return api; }
  let lastBudget = null;
  const TAGNAME = { classify:'作戦室（分類）', discuss:'作戦室（会議）', room:'当番との会話', interview:'取材', article:'記事の仕上げ', report:'日報', other:'その他' };
  function budgetDetail() {
    if (!lastBudget) return toast('AIの設定をすると見られます');
    const by = lastBudget.by || {}, keys = Object.keys(by).sort((a, b) => by[b] - by[a]);
    Menu.open(`今月のAI ¥${Math.round(lastBudget.spent)} / ¥${lastBudget.limit}`, keys.length ? keys.map(k => ({ label:`${TAGNAME[k] || k}　¥${by[k] < 1 ? by[k].toFixed(1) : Math.round(by[k])}`, fn:() => {} }))
      : [{ label:'内訳は、GASを更新したあとの分から記録されます', fn:() => {} }]);
  }
  function showBudget(b) { Stats.noteAI(b); const e = $('rBudget'); if (e) e.textContent = `AI 今月 ¥${Math.round(b.spent)} / ¥${b.limit}`; }
  function opsSettings() {
    const body = h('<div></div>');
    const fU = F.text('サーバーのURL（GASのウェブアプリURL）', api && api.url, 'https://script.google.com/macros/s/…/exec', 'url');
    const fK = F.text('合言葉（GASに設定したACCESS_KEY）', api && api.key, '', 'password');
    fU.input.autocapitalize = 'off'; fK.input.autocapitalize = 'off';
    body.append(fU.el, fK.el, h('<p class="hint">作戦室と同じ設定です。当番との会話・取材・日報に使います。</p>'));
    Editor.open({ title:'AIの設定', body, theme:{ '--accent':'#3d86d6', '--title':'#3d6fa8', '--soft':'#eef5ff', '--line':'#d6e4f5' },
      save:async () => { api = { id:'opsApi', url:fU.get(), key:fK.input.value }; await DB.put('settings', api); toast('保存しました'); } });
  }
  async function call(action, body, quiet = false) {
    if (!api || !api.url) throw new Error('noapi');
    let j, last;
    // 記事・日報は時間がかかって高いので、自動ではつなぎ直さない（GAS側でも同じ日は二度作らない）
    const once = action === 'article' || action === 'report';
    for (let n = 0; n < (once ? 1 : 3); n++) {
      if (n) await sleep(1500 * n);
      const ac = new AbortController(), to = setTimeout(() => ac.abort(), once ? 300000 : 90000);
      try {
        const r = await fetch(api.url, { method:'POST', body:JSON.stringify(Object.assign({ key:api.key, action }, body)), signal:ac.signal, cache:'no-store' });
        const tx = await r.text();
        try { j = JSON.parse(tx); } catch(e) { throw new Error('parse'); }
        break;
      } catch(e) { last = e; } finally { clearTimeout(to); }
    }
    if (!j) { if (!quiet) toast('通信できませんでした。少し待ってからもう一度どうぞ', 2600); throw last || new Error('net'); }
    if (j.budget) { showBudget(j.budget); lastBudget = j.budget; }
    if (j.error) {
      const M = { key:'合言葉が違います（設定を確認してください）', budget:'今月のAIの予算を使い切りました', ai:'AIの応答でエラーが出ました。少し待ってからもう一度', bad:'サーバーのコードが古いかもしれません（GASを更新してください）' };
      if (!quiet) toast(M[j.error] || j.error, 2800); throw new Error(j.error);
    }
    return j;
  }

  return {
    makeDoor, setDoor,
    isDoor:() => onDoor,
    active:() => active,
    async todayDuty() { return pickDuty(); },   // ロック画面の「本日の当番」用
    nameOf:k => NAME[k] || '',
    bgm:() => active ? (typeof Games !== 'undefined' && Games.bgm()) || roomBgm() : null,
    paintDoor,
    // アプリを開いて少ししたら：前日の日報を裏で用意する
    async warmup() {
      await loadApi(); if (!api || !api.url) return;
      checkReport();
    },
  };
})();
