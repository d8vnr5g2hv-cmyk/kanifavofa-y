// Kani Favorite — アプリのロック（開くときに Face ID／マスターパスワード。Accountsと同じ鍵を使う）
'use strict';
const AppLock = (() => {
  const RELOCK = 10 * 60 * 1000;   // 裏に回して10分たったら、戻ったときにもう一度ロック
  const enabled = () => LS.get('kf-lock') === '1';
  // 出迎えてくれる子（タブの壁紙と、その子のひとこと）
  const GUARD = [
    { n:'hoshino', wall:'todo_wall.jpg', name:'ホシノ', line:'先生〜、おかえり〜。ここ開けてね〜、おじさん待ってるよ〜' },
    { n:'mika', wall:'love_wall.jpg', name:'ミカ', line:'先生☆ おかえり！ 開けてくれたら、いっしょに遊ぼ？' },
    { n:'hina', wall:'accounts_wall.jpg', name:'ヒナ', line:'……おかえり、先生。念のため、確認させて' },
    { n:'mari', wall:'profile_wall.jpg', name:'マリー', line:'おかえりなさい、先生。どうぞ、お入りください' },
  ];
  const FACE = '<svg viewBox="0 0 24 24"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M9 9.5v1M15 9.5v1M12 9.5v3.5h-1M9.5 16c1.5 1.2 3.5 1.2 5 0"/></svg>';
  let el = null, done = null, locked = false, hiddenAt = 0, busy = false, lastGuard = -1;

  function clock() { const d = new Date(); return { t:`${p2(d.getHours())}:${p2(d.getMinutes())}`, d:`${d.getMonth() + 1}月${d.getDate()}日（${'日月火水木金土'[d.getDay()]}）` }; }
  // ロック画面を出す。開けたら cb（ロック解除のタップ＝ユーザー操作の中で呼ぶ）
  async function show(cb, opt = {}) {
    if (!(await Accounts.gate.ready())) { LS.set('kf-lock', '0'); return cb && cb(); }   // マスターパスワードがない（消えた）ときは、ロックを解除
    done = cb; locked = true;
    let gi; do { gi = Math.floor(Math.random() * GUARD.length); } while (gi === lastGuard && GUARD.length > 1);
    lastGuard = gi; const g = GUARD[gi], c = clock(), face = Accounts.gate.face();
    if (el) el.remove();
    el = h(`<div id="gate"><img class="gw" src="${g.wall}" alt=""><div class="gsh"></div>
      <div class="gclock"><b>${c.t}</b><span>${c.d}</span></div>
      <div class="lkcard">
        <div class="gtitle">Kani Favorite<small>${opt.cancel ? 'ロックの確認' : 'LOCKED'}</small></div>
        ${face ? `<button class="gface" id="gFace">${FACE}<span>Face IDで開く</span></button><div class="gor"><span>または</span></div>` : ''}
        <div class="gpw"><input id="gPw" type="password" placeholder="マスターパスワード" autocomplete="current-password" enterkeyhint="go"><button id="gGo">開く</button></div>
        ${opt.cancel ? '<button class="gcancel" id="gCancel">やめる</button>' : ''}
      </div>
      <div class="gguard"><div class="gbub"><b>${g.name}</b>${esc(g.line)}</div><img src="${g.n}_chibi.webp" alt=""></div></div>`);
    document.body.appendChild(el);
    if (face) $('gFace').onclick = tryFace;
    $('gGo').onclick = tryPw;
    $('gPw').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); tryPw(); } });
    if (opt.cancel) $('gCancel').onclick = () => { locked = false; done = null; close(); if (opt.onCancel) opt.onCancel(); };
    if (!face) setTimeout(() => { const i = $('gPw'); if (i) i.focus(); }, 400);
  }
  function close() { if (!el) return; const e = el; el = null; e.classList.add('out'); setTimeout(() => e.remove(), 450); }
  function opened() {
    locked = false; haptic(); el.classList.add('ok');
    const f = done; done = null;
    if (f) f();   // タップの流れの中で呼ぶ（BGMを鳴らせるように）
    setTimeout(close, 380);
  }
  async function tryFace() {
    if (busy) return; busy = true;
    try { ctx.resume(); } catch(e) {}
    try { await Accounts.gate.tryFace(); opened(); }
    catch(e) { toast('Face IDで開けませんでした。パスワードでどうぞ'); el && el.classList.add('pwmode'); const i = $('gPw'); if (i) i.focus(); }
    finally { busy = false; }
  }
  async function tryPw() {
    const i = $('gPw'), pw = i && i.value; if (!pw) return i && i.focus();
    if (busy) return; busy = true;
    try { ctx.resume(); } catch(e) {}
    $('gGo').disabled = true;
    try { await Accounts.gate.tryPw(pw); i.blur(); opened(); }
    catch(e) { i.value = ''; i.classList.add('shake'); setTimeout(() => i.classList.remove('shake'), 400); toast('パスワードが違います'); }
    finally { busy = false; const b = $('gGo'); if (b) b.disabled = false; }
  }

  // 設定（タイトル画面の歯車）にスイッチを置く
  function settingRow() {
    const after = $('importBtn'); if (!after || $('lockBtn')) return;
    const b = h(`<button class="row" id="lockBtn"><span class="ic"><svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg></span>
      <span>アプリのロック<small id="lockSub"></small></span><i class="tg" id="lockTg"></i></button>`);
    after.after(b);
    const paint = () => { $('lockTg').classList.toggle('on', enabled()); $('lockSub').textContent = enabled() ? 'オン：開くときにFace ID／マスターパスワード' : 'オフ：Accountsのマスターパスワードで使えます'; };
    paint();
    b.onclick = async () => {
      if (enabled()) { if (!confirm('アプリのロックをオフにしますか？')) return; LS.set('kf-lock', '0'); paint(); return toast('ロックをオフにしました'); }
      if (!(await Accounts.gate.ready())) return toast('先にAccountsで、マスターパスワードを設定してください', 2800);
      // 本当に開けるかを一度確かめてからオンにする（締め出し防止）
      show(() => { LS.set('kf-lock', '1'); paint(); toast('ロックをオンにしました'); }, { cancel:true });
    };
  }

  return {
    needAtBoot:enabled,
    show,
    locked:() => locked,
    init() {
      settingRow();
      document.addEventListener('visibilitychange', () => {
        if (!enabled() || phase !== 'app') return;
        if (document.hidden) { hiddenAt = Date.now(); return; }
        if (!locked && hiddenAt && Date.now() - hiddenAt > RELOCK) show(() => { ctx.resume(); syncBgm(0, .6); updateVideos(); });
      });
    },
  };
})();
