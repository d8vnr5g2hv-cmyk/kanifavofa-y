// Kani Favorite — 作戦室（メモロビの右端のドア → 待機室 → 立候補 → 会議室）
'use strict';
const Ops = (() => {
  // ===== 12人 =====
  // side：L＝画面右を向く（会議室の左側に立つ）／R＝画面左を向く（右側に立つ）
  // fields：得意分野（work 仕事・money お金・feelings 気持ち・life 生活・fun 楽しみ）
  const MEM = {
    hoshino:{ name:'ホシノ', side:'L', voice:'hoshino',   fields:['feelings','money','life'], hi:'うへ〜、おじさんが行こっか' },
    mika:   { name:'ミカ',   side:'L', voice:'mika',      fields:['feelings','fun'],          hi:'はーい！私が行くよ☆' },
    miyako: { name:'ミヤコ', side:'L', voice:'miyako',    fields:['work','money'],            hi:'RABBIT1、出撃します' },
    mari:   { name:'マリー', side:'L', voice:'mari',      fields:['feelings'],                hi:'私でよろしければ……！' },
    serina: { name:'セリナ', side:'L', voice:'christmas', fields:['feelings','life'],         hi:'先生、私もお供します' },
    kisaki: { name:'キサキ', side:'L', voice:'sofa',      fields:['work','money'],            hi:'ふむ、妾が出るとしよう' },
    hina:   { name:'ヒナ',   side:'R', voice:'hina',      fields:['work','life'],             hi:'……私が行くわ' },
    seia:   { name:'セイア', side:'R', voice:'drive',     fields:['work','feelings'],         hi:'これも定めというものだろう' },
    noa:    { name:'ノア',   side:'R', voice:'bedtime',   fields:['money','work','life'],     hi:'記録係はお任せください♪' },
    yuuka:  { name:'ユウカ', side:'R', voice:'office',    fields:['money','work'],            hi:'計算なら任せてください！' },
    hikari: { name:'ヒカリ', side:'R', voice:'conductor', fields:['fun','life'],              hi:'はいはーい！わたしも行くーー！' },
    nico:   { name:'ニコ',   side:'R', voice:'kitchen',   fields:['life','feelings','fun'],   hi:'ふふ、私も行きますね〜' },
  };
  const LINES = {   // 待機室でタップしたときのひとこと
    hoshino:['うへ〜、先生だ〜','おじさん、ちょっとお昼寝中〜','先生、無理してない？'],
    mika:['先生☆ 来てくれたんだ！','ねえねえ、何して遊ぶ？','えへへ、ケーキあるよ☆'],
    miyako:['先生、異常ありません','待機中です。いつでも出られます','……うさぎ、かわいいですよね'],
    mari:['先生、お疲れさまです','先生に主のお恵みがありますように','お茶、いかがですか？'],
    serina:['先生、お怪我はありませんか？','ちゃんと眠れていますか？','救急箱は準備できています'],
    kisaki:['よく来たのう、先生','妾は少し休んでおるだけじゃ','ふむ、今日の顔色は悪くないのう'],
    hina:['……先生。少しだけ、休ませて','今日は仕事、片付いたの','先生も座ったら？'],
    seia:['先生か。待っていたよ','夢で見た通りの時間だね','少し、話をしようか'],
    noa:['先生、今日の来訪も記録しておきますね♪','ふふ、ユウカちゃんには内緒ですよ','先生とのこと、ぜんぶ覚えていますよ'],
    yuuka:['先生！今月の出費、大丈夫ですか？','計算、手伝いましょうか？','もう、だらしないんですから'],
    hikari:['先生だーー！あそぼーー！','ひまだよーーー','いいねーー、なにするーー？'],
    nico:['先生、お腹すいてませんか〜？','いなり寿司、ありますよ〜','今日もお疲れさまです〜'],
  };
  // 待機室の配置（部屋1・部屋2）：cx＝中心x%、by＝足元y%、h＝高さ%（背景の画像に対して）
  const SEATS = [   // 左の部屋 → 右の部屋（横につながっている）
    [ ['yuuka', 58, 26.5, 8.5], ['hina', 80, 26.5, 8.5], ['mari', 27, 30, 9.5], ['serina', 87, 37, 11], ['miyako', 54, 58, 12.5], ['nico', 22, 81.5, 15] ],
    [ ['mika', 63, 31, 9.5], ['seia', 32, 48, 9], ['hikari', 62, 56, 9.5], ['hoshino', 27, 65, 13], ['noa', 70, 73, 10.5], ['kisaki', 89, 73.5, 11] ],
  ];
  const img = (k, p) => {
    if (k === 'hikari' && p === 'stand') p = 'sit';
    return `o_${k}_${p}.webp`;
  };
  const OPS_BGM = { door:L('ops_door_bgm.mp3', 96), lounge:L('ops_lounge_bgm.mp3', 60.5),
                    a:L('meet_a_bgm.mp3', 118), b:L('meet_b_bgm.mp3', 117), result:L('ops_result_bgm.mp3', 76.0026) };
  const TYPES = { todo:'Todo', task:'課題', feel:'気持ちの整理' };

  let scene = null, onDoor = false, api = null;
  let op = null;   // 今の作戦 { id, type, agenda, title, cat, weight, members, log, proposal, votes, result }
  let busy = false;

  // ===== 画像を「画面いっぱいに切り抜き」で置くための箱 =====
  function cover(box, w, h) {
    const p = box.parentNode, W = p.clientWidth, H = p.clientHeight, s = Math.max(W / w, H / h);
    Object.assign(box.style, { width:w * s + 'px', height:h * s + 'px', left:(W - w * s) / 2 + 'px', top:(H - h * s) / 2 + 'px' });
  }

  // ===== ドア（メモロビの右端） =====
  function makeDoor() {
    const s = h(`<div class="slide door"><div class="dbox">
      <img class="dc" src="ops_door.jpg" alt=""><img class="do" src="ops_door_open.jpg" alt="">
      <div class="dsign">SCHALE<b>OPERATION ROOM</b></div>
      <div class="plate"><span>作戦中</span><small>KEEP OUT</small></div>
      <i class="lamp"></i>
      <i class="tp t1"></i><i class="tp t2"></i>
      <div class="granted">ACCESS GRANTED</div>
    </div><div class="dhint">TAP TO ENTER</div><div class="dflash"></div></div>`);
    slidesEl.appendChild(s);
    const box = s.querySelector('.dbox'), fit = () => cover(box, 863, 1822);
    fit(); addEventListener('resize', fit);
    let tx = 0, ty = 0;
    s.addEventListener('pointerdown', e => { tx = e.clientX; ty = e.clientY; });
    s.addEventListener('pointerup', e => { if (Math.hypot(e.clientX - tx, e.clientY - ty) < 10) openDoor(s); });
    return s;
  }
  async function openDoor(s) {
    if (s.classList.contains('opening')) return;
    ctx.resume(); haptic();
    s.classList.add('opening');
    preloadLounge();
    sfx('unlock');
    await sleep(650); sfx('open');
    s.classList.add('opened');
    await sleep(900);
    s.classList.add('flash');
    await sleep(380);
    enter();
    setTimeout(() => s.classList.remove('opening', 'opened', 'flash'), 600);
  }
  function setDoor(v) {
    if (onDoor === v) return;
    onDoor = v; document.body.classList.toggle('atDoor', v);
    syncBgm(250);
    if (v) { preloadLounge(); loadBuf(OPS_BGM.lounge.src).catch(() => {}); }
  }

  // ===== 効果音（コードでつくる） =====
  function sfx(kind) {
    const t = ctx.currentTime, g = ctx.createGain(); g.connect(ctx.destination);
    const tone = (f, a, d, type = 'sine', at = 0) => { const o = ctx.createOscillator(), gg = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t + at);
      gg.gain.setValueAtTime(0, t + at); gg.gain.linearRampToValueAtTime(a, t + at + .01); gg.gain.exponentialRampToValueAtTime(.0001, t + at + d); o.connect(gg); gg.connect(g); o.start(t + at); o.stop(t + at + d + .05); };
    g.gain.value = .5;
    if (kind === 'unlock') { tone(1318, .25, .12, 'square'); tone(1760, .25, .18, 'square', .12); }
    if (kind === 'open') {   // シュッ（ノイズ）
      const n = ctx.createBufferSource(), b = ctx.createBuffer(1, ctx.sampleRate * .7, ctx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(600, t); f.frequency.exponentialRampToValueAtTime(3000, t + .6);
      n.buffer = b; n.connect(f); f.connect(g); n.start(t);
    }
    if (kind === 'pop') tone(880, .18, .12, 'triangle');
    if (kind === 'go') { tone(523, .2, .18, 'triangle'); tone(659, .2, .18, 'triangle', .1); tone(784, .22, .3, 'triangle', .2); }
    if (kind === 'stamp') { tone(196, .4, .25, 'square'); tone(98, .4, .35, 'sine'); }
    if (kind === 'vote') tone(1046, .15, .1, 'sine');
  }

  // ===== 画面 =====
  function build() {
    const o = h(`<div id="ops">
      <section class="lounge">
        <div class="rooms" id="rooms">
          <div class="room"><div class="rbox" data-w="1170" data-h="2455"><img src="ops_lounge2.jpg" alt=""></div></div>
          <div class="room"><div class="rbox" data-w="1170" data-h="2529"><img src="ops_lounge1.jpg" alt=""></div></div>
        </div>
        <div class="ohud">
          <button class="oback" id="opsBack">‹ 出る</button>
          <div class="otitle">STANDBY ROOM<small id="opsBudget"></small></div>
          <button class="oico" id="opsLog" aria-label="作戦書"><svg viewBox="0 0 24 24"><path d="M6 3h9l3 3v15H6z"/><path d="M9 9h6M9 13h6M9 17h4"/></svg></button>
          <button class="oico" id="opsSet" aria-label="設定"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/></svg></button>
        </div>
        <div class="rdots"><i class="on"></i><i></i></div>
        <button class="ostart" id="opsStart"><span>作戦を立てる</span></button>
        <div class="vbar" id="vbar"></div>
      </section>
      <section class="meet">
        <div class="mbox"><img src="ops_meeting.jpg" alt="">
          <div class="mon" id="mon"><div class="tag">OPERATION BRIEFING</div><h1 id="mAg"></h1><div class="st"><span id="mSt"></span></div><div class="names" id="mNames"></div><div class="stamp" id="mStamp"></div></div>
        </div>
        <div class="chat" id="chat"><div class="hd"><b></b>TACTICAL CHAT<span id="mBudget"></span></div><div class="log" id="mLog"></div>
          <div class="acts" id="mActs"></div>
          <div class="inp"><input id="mIn" type="text" placeholder="先生として発言する…" autocomplete="off"><button id="mSend">送信</button></div></div>
        <div class="mem" id="mMem"></div>
        <button class="oback mback" id="meetBack">‹ 待機室</button>
      </section>
      <div class="ocover" id="ocover"><b>OPERATION START</b></div>
    </div>`);
    document.body.appendChild(o);
    // 待機室：12人を置く
    o.querySelectorAll('.room').forEach((r, ri) => {
      const box = r.querySelector('.rbox');
      SEATS[ri].forEach(([k, cx, by, hh]) => {
        const c = h(`<div class="oc" data-k="${k}" style="left:${cx}%;bottom:${100 - by}%;height:${(hh * HEIGHT[k] / 152).toFixed(2)}%"><img src="${img(k, 'sit')}" alt=""><i class="obub"></i></div>`);
        box.appendChild(c);
      });
    });
    const fit = () => { o.querySelectorAll('.rbox').forEach(b => cover(b, +b.dataset.w, +b.dataset.h)); cover(o.querySelector('.mbox'), 853, 1844); };
    addEventListener('resize', fit); o._fit = fit;
    // 部屋の切り替え（横スワイプ）
    const rooms = $('rooms');
    rooms.addEventListener('scroll', () => { const i = Math.round(rooms.scrollLeft / rooms.clientWidth); o.querySelectorAll('.rdots i').forEach((d, k) => d.classList.toggle('on', k === i)); }, { passive:true });
    // タップでひとこと
    o.querySelector('.lounge').addEventListener('click', e => {
      const c = e.target.closest('.oc'); if (!c || busy) return;
      const k = c.dataset.k, L = LINES[k]; bubble(c, L[Math.floor(Math.random() * L.length)]);
      c.animate([{ transform:'translateX(-50%) translateY(0)' }, { transform:'translateX(-50%) translateY(-8%)' }, { transform:'translateX(-50%) translateY(0)' }], { duration:320, easing:'ease-out' });
      sfx('pop');
    });
    $('opsBack').onclick = exit;
    $('opsStart').onclick = brief;
    $('opsLog').onclick = history;
    $('opsSet').onclick = settings;
    $('meetBack').onclick = () => { if (busy) return; if (op && !op.result && op.log.length > 1 && !confirm('会議を終えて待機室に戻りますか？（ここまでの会話は作戦書に残ります）')) return; if (op && op.log.length > 1) save(); toLounge(); };
    $('mSend').onclick = send;
    $('mIn').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); send(); } });
    // 会議中に下へ引くと会話を広げる
    const chat = $('chat');
    chat.querySelector('.hd').addEventListener('click', () => chat.classList.toggle('big'));
  }
  function bubble(c, text, ms = 2200) {
    const b = c.querySelector('.obub'); b.textContent = text; b.style.setProperty('--bx', '0px'); b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
    const r = b.getBoundingClientRect(), W = c.closest('.room, .lounge').getBoundingClientRect();   // 画面からはみ出さないように寄せる
    const dx = r.right > W.right - 8 ? W.right - 8 - r.right : r.left < W.left + 8 ? W.left + 8 - r.left : 0;
    if (dx) b.style.setProperty('--bx', dx + 'px');
    clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove('on'), ms);
  }
  let pre = false;
  function preloadLounge() {
    if (pre) return; pre = true;
    ['ops_lounge1.jpg', 'ops_lounge2.jpg', 'ops_meeting.jpg', 'ops_door_open.jpg'].concat(Object.keys(MEM).map(k => img(k, 'sit'))).forEach(s => { const i = new Image(); i.src = s; });
  }

  // ===== 出入り =====
  function enter() {
    if (!$('ops')) build();
    document.body.classList.add('opsOn');
    $('ops').className = 'show lounge-on';
    $('ops')._fit();
    $('rooms').scrollLeft = 0;
    scene = 'lounge'; op = null;
    syncBgm(0, .8);
    loadApi().then(updBudget);
    ['a', 'b', 'result'].forEach(k => setTimeout(() => loadBuf(OPS_BGM[k].src).catch(() => {}), 2500));
  }
  function exit() {
    if (busy) return;
    $('ops').classList.add('out');
    setTimeout(() => { $('ops').className = ''; document.body.classList.remove('opsOn'); }, 400);
    scene = null; syncBgm(200);
  }
  function toLounge() {
    $('ops').className = 'show lounge-on'; scene = 'lounge'; op = null; busy = false;
    $('ops').querySelectorAll('.oc').forEach(c => c.classList.remove('picked', 'dim'));
    $('vbar').innerHTML = ''; $('vbar').classList.remove('on');
    syncBgm(0, .8);
  }

  // ===== GAS（AI）との通信 =====
  async function loadApi() { api = await DB.get('settings', 'opsApi').catch(() => null); return api; }
  async function call(action, body) {
    if (!api || !api.url) { settings(); throw new Error('noapi'); }
    let r;
    try {
      r = await fetch(api.url, { method:'POST', body:JSON.stringify(Object.assign({ key:api.key, action }, body)) });
    } catch(e) { toast('通信できませんでした（電波を確認してください）', 2200); throw e; }
    let j; try { j = await r.json(); } catch(e) { toast('作戦室サーバーの応答が読めませんでした', 2200); throw e; }
    if (j.budget) budgetShow(j.budget);
    if (j.error) {
      const M = { key:'合言葉が違います（設定を確認してください）', budget:'今月の予算を使い切りました。来月まで作戦室はお休みです', ai:'AIの応答でエラーが出ました。少し待ってからもう一度' };
      toast(M[j.error] || j.error, 2800); throw new Error(j.error);
    }
    return j;
  }
  function budgetShow(b) {
    const t = `今月 ¥${Math.round(b.spent)} / ¥${b.limit}`;
    if ($('opsBudget')) $('opsBudget').textContent = t;
    if ($('mBudget')) $('mBudget').textContent = t;
  }
  async function updBudget() { if (!api || !api.url) return; try { await call('budget', {}); } catch(e) {} }
  function settings() {
    const body = h('<div></div>');
    const fU = F.text('作戦室サーバーのURL（GASのウェブアプリURL）', api && api.url, 'https://script.google.com/macros/s/…/exec', 'url');
    const fK = F.text('合言葉（GASに設定したACCESS_KEY）', api && api.key, '', 'password');
    fU.input.autocapitalize = 'off'; fK.input.autocapitalize = 'off';
    body.append(fU.el, fK.el, h('<p class="hint">作戦室の会話は、このURLのGASを通してClaudeが考えます。月の予算を超えると自動で止まります。</p>'));
    Editor.open({ title:'作戦室の設定', body, theme:{ '--accent':'#1d8fd6', '--title':'#1d8fd6', '--soft':'#eef7fd', '--line':'#d3e7f4' },
      save:async () => { api = { id:'opsApi', url:fU.get(), key:fK.input.value }; await DB.put('settings', api); updBudget(); toast('保存しました'); } });
  }

  // ===== 議題を出す =====
  function brief() {
    if (busy) return;
    Menu.open('どんな作戦にしますか？', [
      { label:'Todoから選ぶ', sub:'やること・考えることを会議にかける', fn:pickTodo },
      { label:'新しい課題', sub:'悩んでいること、決めたいことを書く', fn:() => writeAgenda('task') },
      { label:'気持ちの整理', sub:'思っていることを聞いてもらう（投票なし）', fn:() => writeAgenda('feel') },
    ]);
  }
  async function pickTodo() {
    const todos = (await DB.all('todos')).filter(t => !t.done);
    if (!todos.length) return toast('Todoがまだありません');
    Menu.open('どれを会議にかけますか？', todos.slice(0, 12).map(t => ({ label:t.title, sub:(t.list === 'think' ? '考える' : 'やる') + (t.memo ? '・' + t.memo.slice(0, 30) : ''),
      fn:() => writeAgenda('todo', t.title + (t.memo ? `\n（メモ：${t.memo}）` : ''), t.id) })));
  }
  function writeAgenda(type, text = '', todoId = null) {
    const body = h('<div></div>');
    const f = F.area(type === 'feel' ? '今の気持ち' : '議題', text, type === 'feel' ? '思っていること、モヤモヤしていることをそのまま' : '例：週末の過ごし方をどうする？');
    body.append(f.el, h(`<p class="hint">${type === 'feel' ? '4人が順番に受け止めて、最後に「今日のまとめ」を出します。' : '4人が話し合い、提案して、賛否をとります。3人以上の賛成で可決です。'}</p>`));
    Editor.open({ title:TYPES[type], body, saveLabel:'作戦室へ', focus:f.input, theme:{ '--accent':'#1d8fd6', '--title':'#1d8fd6', '--soft':'#eef7fd', '--line':'#d3e7f4' },
      save:async () => { const a = f.get(); if (!a) return false; setTimeout(() => recruit(type, a, todoId), 350); } });
  }

  // ===== 立候補（左向き2人・右向き2人。得意分野に合う子ほど手を挙げやすい） =====
  function pick(cat) {
    const w = k => (MEM[k].fields.includes(cat) ? 3.2 : 1) * (0.6 + Math.random());
    const side = s => Object.keys(MEM).filter(k => MEM[k].side === s).map(k => [k, w(k)]).sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => x[0]);
    return [...side('L'), ...side('R')];   // [左, 左, 右, 右]
  }
  async function recruit(type, agenda, todoId) {
    if (busy) return; busy = true;
    const bar = $('vbar'); bar.classList.add('on'); bar.innerHTML = '<span class="ld">作戦を分析中…</span>';
    let c;
    try { c = await call('classify', { agenda, type }); }
    catch(e) { bar.classList.remove('on'); busy = false; return; }
    const cat = c.category || 'life', weight = type === 'feel' ? 'b' : (c.weight === 'heavy' ? 'b' : 'a');
    const members = pick(type === 'feel' ? 'feelings' : cat);
    op = { id:newId(), date:Date.now(), type, agenda, todoId, title:c.title || agenda.slice(0, 24), cat, weight, members, log:[], proposal:null, votes:null, result:null };
    bar.innerHTML = `<span class="ld">「${esc(op.title)}」　立候補を募集中…</span>`;
    $('ops').querySelectorAll('.oc').forEach(x => x.classList.add('dim'));
    const rooms = $('rooms');
    for (const k of shuffle(members.slice())) {
      const el = $('ops').querySelector(`.oc[data-k="${k}"]`), ri = SEATS.findIndex(r => r.some(s => s[0] === k));
      if (Math.round(rooms.scrollLeft / rooms.clientWidth) !== ri) { rooms.scrollTo({ left:ri * rooms.clientWidth, behavior:'smooth' }); await sleep(450); }
      el.classList.remove('dim'); el.classList.add('picked'); sfx('pop'); haptic();
      el.animate([{ transform:'translateX(-50%) translateY(0)' }, { transform:'translateX(-50%) translateY(-14%)' }, { transform:'translateX(-50%) translateY(0)' }], { duration:420, easing:'cubic-bezier(.3,1.6,.5,1)' });
      bubble(el, MEM[k].hi, 2600);
      await sleep(1100);
    }
    bar.innerHTML = `<div class="team">${members.map(k => `<i style="background-image:url(${img(k, 'stand')})"></i>`).join('')}</div><button id="goMeet">作戦開始</button>`;
    $('goMeet').onclick = () => { sfx('go'); toMeeting(); };
    busy = false;
  }

  // ===== 会議室 =====
  const POS = [ { l:-2, b:2 }, { l:22, b:8 }, { r:22, b:8 }, { r:-2, b:2 } ];
  const BASE = 21;   // 身長156cmの子の「頭から足まで」が画面の高さの何%か
  // 公式の身長（cm）
  const HEIGHT = { hoshino:145, mika:157, hina:142, miyako:156, mari:151, serina:156, yuuka:156, noa:161, seia:149, kisaki:142, hikari:147, nico:160 };
  // 立ち絵の上にある、頭より上の飾り（ヘイロー・耳・帽子）の割合
  const TOP = { hoshino:.06, mika:.08, hina:.12, miyako:.13, mari:.10, serina:.08, yuuka:.06, noa:.07, seia:.12, kisaki:.10, nico:.13 };
  async function toMeeting() {
    busy = true;
    const cv = $('ocover'); cv.classList.add('on');
    await sleep(700);
    $('ops').className = 'show meet-on'; $('ops')._fit(); scene = 'meeting';
    $('mAg').textContent = op.title;
    $('mNames').innerHTML = op.members.map(k => `<i data-k="${k}">${MEM[k].name}<b>―</b></i>`).join('');
    $('mStamp').className = 'stamp'; stage('話し合い中');
    $('mLog').innerHTML = ''; $('chat').classList.remove('big');
    $('mMem').innerHTML = op.members.map((k, i) => { const p = POS[i];
      // 身長（cm）に合わせる。画像の上の余白（ヘイロー・耳など）の分はTOPで差し引く
      const d = i === 1 || i === 2 ? .94 : 1;   // 奥の2人は少しだけ小さく（遠近）
      const hh = d * (k === 'hikari' ? BASE * HEIGHT.hikari / 156 / 1.26 : BASE * HEIGHT[k] / 156 / (1 - TOP[k])), ar = k === 'hikari' ? 1.4 : .62;
      return `<div class="mc" data-k="${k}" style="${p.l != null ? 'left:' + p.l + '%' : 'right:' + p.r + '%'};bottom:${p.b}%;height:${hh}%;aspect-ratio:${ar}"><img class="s" src="${img(k, 'stand')}" alt=""><img class="t" src="${img(k, 'talk')}" alt=""></div>`; }).join('');
    syncBgm(0, .8);
    setTimeout(() => cv.classList.remove('on'), 200);
    sysMsg(`${TYPES[op.type]}「${op.title}」`);
    acts([]);
    await round('open');
  }
  function stage(t) { $('mSt').textContent = t; }
  const avatar = k => `<div class="av" style="background-image:url(${img(k, 'stand')})"></div>`;
  function add(html) { const l = $('mLog'); l.insertAdjacentHTML('beforeend', html); l.scrollTop = l.scrollHeight; }
  function sysMsg(t) { add(`<div class="m sys"><div class="bb">${esc(t)}</div></div>`); }
  function talking(k) {
    $('mMem').querySelectorAll('.mc').forEach(c => {
      const on = c.dataset.k === k; c.classList.toggle('talk', on);
      if (on && k === 'hina') c.querySelector('.t').src = img('hina', Math.random() < .5 ? 'talk' : 'talk2');
    });
  }
  async function say(m, cls = '') {
    const k = m.who; if (!MEM[k]) return;
    add(`<div class="m typing" id="ty">${avatar(k)}<div><div class="nm">${MEM[k].name}</div><div class="bb"><i></i><i></i><i></i></div></div></div>`);
    talking(k);
    await sleep(650 + Math.random() * 400);
    const t = $('ty'); if (t) t.remove();
    add(`<div class="m ${cls}">${avatar(k)}<div><div class="nm">${MEM[k].name}</div><div class="bb">${esc(m.text)}</div></div></div>`);
    op.log.push({ who:k, text:m.text });
    await sleep(Math.min(3600, 900 + m.text.length * 45));
  }
  function acts(list) {   // 下のボタン
    $('mActs').innerHTML = list.map((a, i) => `<button data-i="${i}" class="${a.pri ? 'pri' : ''}">${a.label}</button>`).join('');
    $('mActs').querySelectorAll('button').forEach(b => b.onclick = () => { if (!busy) list[+b.dataset.i].fn(); });
  }
  function normalActs() {
    acts(op.type === 'feel'
      ? [{ label:'もう少し話す', fn:() => round('more') }, { label:'まとめてもらう', pri:true, fn:() => round('summary') }]
      : [{ label:'もう少し話す', fn:() => round('more') }, { label:'提案して決をとる', pri:true, fn:() => round('propose') }]);
  }
  async function send() {
    const i = $('mIn'), t = i.value.trim(); if (!t || busy || !op || op.result === 'pass' || op.result === 'summary') return;
    i.value = ''; i.blur(); talking(null);
    add(`<div class="m me"><div class="bb">${esc(t)}</div></div>`);
    op.log.push({ who:'me', text:t });
    await round('reply');
  }
  async function round(phase) {
    if (busy && phase !== 'open') return;
    busy = true; acts([]);
    add('<div class="m sys" id="thinking"><div class="bb">…考え中…</div></div>');
    let r;
    try { r = await call('discuss', { phase, type:op.type, weight:op.weight, agenda:op.agenda, title:op.title, members:op.members, log:op.log.slice(-24) }); }
    catch(e) { const t = $('thinking'); if (t) t.remove(); busy = false; normalActs(); return; }
    const t = $('thinking'); if (t) t.remove();
    for (const m of (r.messages || [])) await say(m);
    if (phase === 'propose' && r.proposal) await vote(r);
    else if (phase === 'summary') await summary(r);
    talking(null);
    busy = false;
    if (!op.result || op.result === 'reject') normalActs();
  }
  async function vote(r) {
    stage('提案');
    await say(r.proposal, 'prop');
    op.proposal = r.proposal.text;
    stage('採決中'); talking(null);
    const v = r.votes || {}; let yes = 0;
    for (const k of op.members) {
      await sleep(550);
      const ok = v[k] !== false; if (ok) yes++;
      const el = $('mNames').querySelector(`[data-k="${k}"]`); el.className = ok ? 'y' : 'n'; el.querySelector('b').textContent = ok ? '賛成' : '反対';
      sfx('vote');
    }
    op.votes = v;
    await sleep(500);
    const pass = yes >= 3;
    $('mStamp').textContent = pass ? '可決' : '否決'; $('mStamp').className = 'stamp on ' + (pass ? 'ok' : 'ng'); sfx('stamp'); haptic();
    stage(pass ? '可決' : '否決');
    if (pass) {
      op.result = 'pass'; scene = 'result'; syncBgm(0, .6);
      sysMsg(`可決（${yes}対${4 - yes}）。作戦書に保存しました`);
      await save();
      acts([{ label:'Todoに追加', pri:true, fn:addTodo }, { label:'待機室へ', fn:() => toLounge() }]);
    } else {
      op.result = 'reject';
      sysMsg(`否決（${yes}対${4 - yes}）。反対意見をふまえて、もう一度話し合えます`);
      for (const k of op.members) if (r.reasons && r.reasons[k] && v[k] === false) await say({ who:k, text:r.reasons[k] });
      $('mNames').querySelectorAll('i').forEach(el => { el.className = ''; el.querySelector('b').textContent = '―'; });
      $('mStamp').className = 'stamp'; stage('話し合い中'); op.result = null;
    }
  }
  async function summary(r) {
    op.result = 'summary'; op.proposal = r.summary || ''; scene = 'result'; syncBgm(0, .6);
    stage('まとめ');
    if (r.summary) add(`<div class="m prop sum"><div class="bb"><b>今日のまとめ</b><br>${esc(r.summary)}</div></div>`);
    $('mStamp').textContent = 'おつかれさま'; $('mStamp').className = 'stamp on ok';
    await save();
    acts([{ label:'待機室へ', pri:true, fn:() => toLounge() }]);
  }
  async function save() { if (!op) return; await DB.put('ops', JSON.parse(JSON.stringify(op))).catch(() => {}); }
  async function addTodo() {
    if (!op || !op.proposal) return;
    const t = { id:newId(), list:'do', title:op.proposal.replace(/^【提案】/, '').slice(0, 80), memo:`作戦室で可決：「${op.title}」`, due:'', repeat:'none', done:false, doneAt:null, createdAt:Date.now(), order:0 };
    await DB.put('todos', t); if (typeof Todo !== 'undefined') Todo.reload();
    toast('Todoに追加しました'); acts([{ label:'待機室へ', pri:true, fn:() => toLounge() }]);
  }

  // ===== 作戦書（これまでの会議） =====
  async function history() {
    const list = (await DB.all('ops')).sort((a, b) => b.date - a.date);
    if (!list.length) return toast('まだ作戦書はありません');
    const R = { pass:'可決', summary:'まとめ', reject:'否決', null:'途中' };
    Menu.open('作戦書', list.slice(0, 20).map(o => ({ label:`${o.title}`, sub:`${new Date(o.date).toLocaleDateString('ja-JP')}・${TYPES[o.type]}・${R[o.result] || '途中'}・${o.members.map(k => MEM[k].name).join(' ')}`, fn:() => showLog(o) })));
  }
  function showLog(o) {
    const body = h(`<div class="oplog">${o.proposal ? `<div class="opprop"><b>${o.type === 'feel' ? '今日のまとめ' : '可決した提案'}</b>${esc(o.proposal)}</div>` : ''}
      ${o.log.map(m => m.who === 'me' ? `<p class="me">${esc(m.text)}</p>` : `<p><b>${MEM[m.who] ? MEM[m.who].name : ''}</b>${esc(m.text)}</p>`).join('')}</div>`);
    Editor.open({ title:o.title, body, theme:{ '--accent':'#1d8fd6', '--title':'#1d8fd6', '--soft':'#eef7fd', '--line':'#d3e7f4' },
      del:async () => { await DB.del('ops', o.id); toast('削除しました'); }, delLabel:'この作戦書を削除する' });
  }

  return {
    makeDoor, setDoor, enter,
    isDoor:() => onDoor,
    bgm:() => {
      if (scene === 'lounge') return OPS_BGM.lounge;
      if (scene === 'meeting') return OPS_BGM[op && op.weight === 'b' ? 'b' : 'a'];
      if (scene === 'result') return OPS_BGM.result;
      if (onDoor && tab === 'favorite') return OPS_BGM.door;
      return null;
    },
    active:() => !!scene,
    allBgm:() => Object.values(OPS_BGM),
  };
})();
