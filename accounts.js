// Kani Favorite — Accounts（ヒナ＋ミヤコ）
// しくみ：中身はすべて「データ鍵」で暗号化。データ鍵は「マスターパスワード」と「Face ID（パスキーのPRF）」の2通りで包んで保存。
'use strict';
const Accounts = (() => {
  let vault = null, key = null, raw = null, list = [], state = 'setup', q = '', onlyIssues = false, leftAt = 0, lockTimer = null, busyUnlock = false;
  const head = () => $('accHead'), box = () => $('accList');
  const THEME = { '--accent':'#4cb3e4', '--title':'#2f9fd6', '--soft':'#eef8fd', '--line':'#d3ebf6' };
  const AUTO_LOCK = 60000, ITER = 310000;

  // ===== 暗号の道具 =====
  const te = new TextEncoder(), td = new TextDecoder();
  const b64 = buf => { const a = new Uint8Array(buf); let s = ''; for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const rnd = n => crypto.getRandomValues(new Uint8Array(n));
  async function pwKey(pw, salt, iter) {
    const base = await crypto.subtle.importKey('raw', te.encode(pw), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name:'PBKDF2', salt, iterations:iter, hash:'SHA-256' }, base, { name:'AES-GCM', length:256 }, false, ['encrypt', 'decrypt']);
  }
  async function prfKey(out) {
    const base = await crypto.subtle.importKey('raw', out, 'HKDF', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name:'HKDF', hash:'SHA-256', salt:te.encode('kani-favorite'), info:te.encode('vault-v1') }, base, { name:'AES-GCM', length:256 }, false, ['encrypt', 'decrypt']);
  }
  async function seal(k, bytes) { const iv = rnd(12); return { iv:b64(iv), ct:b64(await crypto.subtle.encrypt({ name:'AES-GCM', iv }, k, bytes)) }; }
  async function unseal(k, b) { return new Uint8Array(await crypto.subtle.decrypt({ name:'AES-GCM', iv:unb64(b.iv) }, k, unb64(b.ct))); }
  async function useRaw(r) { raw = r; key = await crypto.subtle.importKey('raw', r, 'AES-GCM', false, ['encrypt', 'decrypt']); }

  // ===== Face ID（パスキー＋PRF） =====
  const canPasskey = () => !!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.create);
  async function assertPrf(credId, salt) {
    const a = await navigator.credentials.get({ publicKey:{ challenge:rnd(32), rpId:location.hostname, allowCredentials:[{ type:'public-key', id:credId }],
      userVerification:'required', timeout:60000, extensions:{ prf:{ eval:{ first:salt } } } } });
    const r = a.getClientExtensionResults(), out = r.prf && r.prf.results && r.prf.results.first;
    if (!out) throw new Error('noprf');
    return out;
  }
  async function registerFace() {
    const salt = rnd(32);
    const cred = await navigator.credentials.create({ publicKey:{
      challenge:rnd(32), rp:{ name:'Kani Favorite', id:location.hostname }, user:{ id:rnd(16), name:'Kani Favorite', displayName:'Kani Favorite（Accounts）' },
      pubKeyCredParams:[{ type:'public-key', alg:-7 }, { type:'public-key', alg:-257 }],
      authenticatorSelection:{ authenticatorAttachment:'platform', residentKey:'required', userVerification:'required' },
      timeout:60000, extensions:{ prf:{ eval:{ first:salt } } } } });
    const ext = cred.getClientExtensionResults();
    let out = ext.prf && ext.prf.results && ext.prf.results.first;
    if (!out) { if (ext.prf && ext.prf.enabled === false) throw new Error('noprf'); out = await assertPrf(cred.rawId, salt); }
    const k = await prfKey(out);
    return { credId:b64(cred.rawId), salt:b64(salt), box:await seal(k, raw) };
  }

  // ===== 保存 =====
  const saveVault = () => DB.put('settings', Object.assign({ id:'vault' }, vault));
  async function saveEntry(e) { await DB.put('accounts', Object.assign({ id:e.id }, await seal(key, te.encode(JSON.stringify(e))))); }
  async function loadEntries() {
    const rows = await DB.all('accounts'); list = [];
    for (const r of rows) { try { list.push(JSON.parse(td.decode(await unseal(key, r)))); } catch(e) { console.warn('skip', r.id); } }
  }

  // ===== パスワードの強さ・点検 =====
  function strength(p) {
    if (!p) return 0;
    const cls = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(r => r.test(p)).length;
    let s = (p.length >= 8) + (p.length >= 12) + (p.length >= 16) + Math.max(0, cls - 1);
    if (/^(.)\1+$/.test(p) || /password|qwerty|1234|abcd|1111|0000/i.test(p)) s = Math.min(s, 1);
    return Math.min(4, s);
  }
  const SL = [['弱い', '#ff6b81'], ['弱い', '#ff6b81'], ['ふつう', '#f7b267'], ['強い', '#4cc38a'], ['とても強い', '#2fa36b']];
  const isWeak = p => !!p && strength(p) <= 1;
  function audit() {
    const cnt = {}; list.forEach(e => { if (e.pass) cnt[e.pass] = (cnt[e.pass] || 0) + 1; });
    const weak = list.filter(e => isWeak(e.pass)).map(e => e.id), reused = list.filter(e => e.pass && cnt[e.pass] > 1).map(e => e.id);
    return { weak, reused, ids:new Set([...weak, ...reused]) };
  }
  function gen(len = 16, sym = true) {
    const sets = ['abcdefghijkmnopqrstuvwxyz', 'ABCDEFGHJKLMNPQRSTUVWXYZ', '23456789'].concat(sym ? ['!@#$%&*?-_+='] : []);
    const all = sets.join(''), r = n => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
    let p; do { p = Array.from({ length:len }, () => all[r(all.length)]).join(''); } while (!sets.every(s => [...p].some(c => s.includes(c))));
    return p;
  }

  // ===== 画面 =====
  const LOCK_SVG = '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  function render() {
    $('accAdd').hidden = state !== 'open';
    if (state === 'setup') return renderSetup();
    if (state === 'locked') return renderLocked();
    head().innerHTML = `<div class="abar"><input class="inp" id="accQ" type="search" placeholder="さがす" value="${esc(q)}" autocomplete="off"><button class="more" id="accMore" aria-label="メニュー">⋯</button></div>
      ${onlyIssues ? '<button class="filterTag" id="accIss">要チェックだけ表示中 ✕</button>' : ''}`;
    $('accQ').oninput = e => { q = e.target.value; renderList(); };
    $('accMore').onclick = menu;
    if (onlyIssues) $('accIss').onclick = () => { onlyIssues = false; render(); };
    renderList();
  }
  function renderList() {
    const a = audit(), qq = q.trim().toLowerCase();
    const rows = list.filter(e => (!qq || [e.name, e.user, e.url].some(s => (s || '').toLowerCase().includes(qq))) && (!onlyIssues || a.ids.has(e.id)))
      .sort((x, y) => (x.name || '').localeCompare(y.name || '', 'ja'));
    const COL = ['#4cb3e4', '#7aa7f0', '#5cc6c0', '#9b8cf0', '#f39bbd', '#f2b05e', '#6cc28f'];
    box().innerHTML = rows.length ? rows.map(e => `<div class="arow" data-id="${e.id}"><div class="ic" style="background:${COL[hashN(e.name, COL.length)]}">${esc(([...(e.name || '?')][0] || '?').toUpperCase())}</div>
        <div class="tx">${esc(e.name)}<small>${esc(e.user || '　')}</small></div>${a.ids.has(e.id) ? '<i class="warn" title="要チェック"></i>' : ''}</div>`).join('')
      : `<div class="empty"><img class="emc" src="m_miyako_scopeL.webp" alt="">${list.length ? '見つかりませんでした' : 'まだ何も登録されていません。<br>＋からアカウントを追加してください'}</div>`;
  }
  // 検問所ふうの見た目（斜めのテープ・回るリング・Face IDの印）
  const FACE_SVG = '<svg viewBox="0 0 24 24"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M9 9.5v1M15 9.5v1M12 9.5v3.5h-1M9.5 15.5c1.4 1.2 3.6 1.2 5 0"/></svg>';
  const TAPE = '<div class="tape"><span>SECURITY CHECKPOINT　✦　検問中　✦　SECURITY CHECKPOINT　✦　検問中　✦　SECURITY CHECKPOINT　✦　検問中　✦　</span></div>';
  const badge = ico => `<div class="gbadge"><i class="ring"></i><i class="ring r2"></i><div class="gcore">${ico}</div></div>`;
  function renderSetup() {
    head().innerHTML = '';
    const pk = canPasskey();
    box().innerHTML = `<div class="gate">${TAPE}<div class="gcard">${badge(LOCK_SVG)}
      <div class="gt">CREATE VAULT</div><h3>パスワード金庫をつくる</h3>
      <p>入れたパスワードは、すべて暗号化して<br>このiPhoneの中だけに保存します。</p>
      <input class="inp" id="pw1" type="password" placeholder="マスターパスワード（8文字以上）" autocomplete="new-password">
      <input class="inp" id="pw2" type="password" placeholder="もう一度" autocomplete="new-password">
      ${pk ? '<label class="chkline"><input type="checkbox" id="useFace" checked>Face IDで開けるようにする</label>' : ''}
      <div class="note"><b>⚠ 大事なこと</b><br>マスターパスワードを忘れて、Face IDも使えなくなる（機種変更など）と、中身は取り出せません。紙に書くなどして、なくさないようにしてください。</div>
      <button class="btnP" id="mk">はじめる</button></div></div>`;
    $('mk').onclick = setup;
  }
  function renderLocked() {
    head().innerHTML = '';
    box().innerHTML = `<div class="gate">${TAPE}<div class="gcard">${badge(LOCK_SVG)}
      <div class="gt">ACCOUNTS LOCKED</div><h3>検問中</h3><p>ヒナが見張っています。</p>
      ${vault.prf ? `<button class="faceBtn" id="faceBtn">${FACE_SVG}<span>Face IDで開く</span></button><div class="orl"><span>または</span></div>` : ''}
      <div class="pwin"><input class="inp" id="mpw" type="password" placeholder="マスターパスワード" autocomplete="current-password"><button class="btnP" id="pwBtn">開く</button></div></div></div>`;
    if (vault.prf) $('faceBtn').onclick = () => unlockFace(true);
    $('pwBtn').onclick = unlockPw;
    $('mpw').onkeydown = e => { if (e.key === 'Enter') unlockPw(); };
  }

  // ===== はじめる・開く・閉じる =====
  async function setup() {
    const p1 = $('pw1').value, p2v = $('pw2').value;
    if (p1.length < 8) { toast('8文字以上にしてください'); $('pw1').classList.add('shake'); return setTimeout(() => $('pw1').classList.remove('shake'), 400); }
    if (p1 !== p2v) { toast('2つのパスワードが違います'); $('pw2').classList.add('shake'); return setTimeout(() => $('pw2').classList.remove('shake'), 400); }
    const wantFace = $('useFace') && $('useFace').checked;
    $('mk').disabled = true;
    try {
      await useRaw(rnd(32));
      const salt = rnd(16);
      vault = { v:1, iter:ITER, salt:b64(salt), pw:await seal(await pwKey(p1, salt, ITER), raw), prf:null };
      if (wantFace) {
        try { vault.prf = await registerFace(); }
        catch(e) { toast(e.message === 'noprf' ? 'このiPhoneではFace IDの鍵が使えないため、パスワードで開きます' : 'Face IDの登録をスキップしました', 2600); }
      }
      await saveVault();
      list = []; state = 'open'; render();
      Motion.stopLoop('hina', 'unlock');
      toast('金庫をつくりました');
    } catch(e) { console.warn(e); toast('つくれませんでした'); $('mk').disabled = false; }
  }
  async function opened() {
    await loadEntries(); state = 'open'; onlyIssues = false; q = ''; render();
    Motion.stopLoop('hina', 'unlock');
  }
  async function unlockFace(fromButton) {
    if (!vault || !vault.prf || busyUnlock) return;
    busyUnlock = true;
    try {
      const out = await assertPrf(unb64(vault.prf.credId), unb64(vault.prf.salt));
      await useRaw(await unseal(await prfKey(out), vault.prf.box));
      haptic(); await opened();
    } catch(e) {
      console.warn(e);
      if (fromButton || e.name !== 'NotAllowedError') { toast('Face IDで開けませんでした'); Motion.pout('hina'); }
    } finally { busyUnlock = false; }
  }
  async function unlockPw() {
    const i = $('mpw'), pw = i.value; if (!pw) return i.focus();
    $('pwBtn').disabled = true;
    try {
      await useRaw(await unseal(await pwKey(pw, unb64(vault.salt), vault.iter), vault.pw));
      i.blur(); haptic(); await opened();
    } catch(e) {
      i.value = ''; i.classList.add('shake'); setTimeout(() => i.classList.remove('shake'), 400);
      toast('パスワードが違います'); Motion.pout('hina');
    } finally { const b = $('pwBtn'); if (b) b.disabled = false; }
  }
  function lock(silent) {
    if (state !== 'open') return;
    key = raw = null; list = []; q = ''; onlyIssues = false; state = 'locked';
    Editor.close(); render();
    if (tab === 'accounts') Motion.guardLoop();
    if (!silent) toast('ロックしました');
  }

  // ===== 追加・編集 =====
  function edit(e) {
    const isNew = !e; e = e || { name:'', user:'', pass:'', url:'', memo:'' };
    const body = h('<div></div>');
    const fN = F.text('サービス名', e.name, '例：Google'), fU = F.text('ID・メールアドレス', e.user, '例：kani@example.com', 'email');
    fU.input.autocapitalize = 'off'; fU.input.spellcheck = false;
    if (!isNew) { const c = h('<button class="cpy" type="button">コピー</button>'); c.onclick = () => copy(fU.input.value, 'IDをコピーしました'); wrapRow(fU.input, c); }
    // パスワード欄
    const pw = h(`<div class="fl"><label>パスワード</label><div class="pwf"><input class="inp" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="パスワード"><button type="button" class="eye">表示</button><button type="button" class="gb">生成</button>${isNew ? '' : '<button type="button" class="cp">コピー</button>'}</div>
      <div class="meter"><i></i></div><div class="meterT"></div>
      <div class="gen"><div class="gl">長さ <input type="range" min="8" max="32" value="16"><b>16</b></div><label class="chkline"><input type="checkbox" checked>記号を入れる</label><div class="gl"><button type="button" class="btnL rg">もう一度つくる</button></div></div></div>`);
    const pi = pw.querySelector('input'), meter = pw.querySelector('.meter i'), mt = pw.querySelector('.meterT'), gp = pw.querySelector('.gen');
    const rg = gp.querySelector('input[type=range]'), sy = gp.querySelector('input[type=checkbox]');
    pi.value = e.pass || '';
    const paint = () => { const s = strength(pi.value), [l, c] = SL[s]; meter.style.width = pi.value ? (s + 1) * 20 + '%' : 0; meter.style.background = c; mt.textContent = pi.value ? `強さ：${l}` : ''; mt.style.color = c; };
    const make = () => { pi.value = gen(+rg.value, sy.checked); pi.type = 'text'; pw.querySelector('.eye').textContent = '隠す'; paint(); };
    pi.oninput = paint; paint();
    pw.querySelector('.eye').onclick = ev => { pi.type = pi.type === 'password' ? 'text' : 'password'; ev.target.textContent = pi.type === 'password' ? '表示' : '隠す'; };
    pw.querySelector('.gb').onclick = () => { gp.classList.add('show'); make(); };
    rg.oninput = () => { gp.querySelector('b').textContent = rg.value; make(); }; sy.onchange = make; gp.querySelector('.rg').onclick = make;
    if (!isNew) pw.querySelector('.cp').onclick = () => copy(pi.value, 'パスワードをコピーしました');
    const fL = F.text('URL', e.url, 'https://', 'url'); fL.input.autocapitalize = 'off';
    if (!isNew && e.url) { const o = h('<button class="cpy" type="button">開く</button>'); o.onclick = () => window.open(/^https?:/.test(e.url) ? e.url : 'https://' + e.url, '_blank'); wrapRow(fL.input, o); }
    const fM = F.area('メモ', e.memo, '秘密の質問、2段階認証のことなど');
    body.append(fN.el, fU.el, pw, fL.el, fM.el);
    if (!isNew && e.updated) body.appendChild(h(`<p class="hint">最終更新：${new Date(e.updated).toLocaleDateString('ja-JP')}</p>`));
    Editor.open({ title:isNew ? 'アカウントを追加' : e.name, body, theme:THEME, focus:isNew ? fN.input : null,
      save:async () => {
        if (!fN.get()) { fN.input.classList.add('shake'); setTimeout(() => fN.input.classList.remove('shake'), 400); return false; }
        if (state !== 'open') return true;
        const obj = Object.assign({}, e, { name:fN.get(), user:fU.get(), pass:pi.value, url:fL.get(), memo:fM.get(), updated:Date.now() }, isNew ? { id:newId(), created:Date.now() } : {});
        const i = list.findIndex(x => x.id === obj.id); if (i >= 0) list[i] = obj; else list.push(obj);
        await saveEntry(obj); renderList();
        const a = audit();
        if (obj.pass && (isWeak(obj.pass) || a.reused.includes(obj.id)))   // ミヤコが見張っている
          setTimeout(() => Motion.play('miyako', 'weak', { text:isWeak(obj.pass) ? 'そのパスワード、弱いです' : 'パスワードの使い回しです', sub:'変更をおすすめします' }), 450);
      },
      del:isNew ? null : async () => {
        list = list.filter(x => x.id !== e.id); await DB.del('accounts', e.id); renderList();
        Snack.show(`${e.name}を削除しました`, '元に戻す', async () => { if (state !== 'open') return; list.push(e); await saveEntry(e); renderList(); });
      },
    });
  }
  function wrapRow(input, btn) { const r = h('<div class="pwf"></div>'); input.parentNode.insertBefore(r, input); r.append(input, btn); }
  async function copy(text, msg) {
    if (!text) return;
    try { await navigator.clipboard.writeText(text); toast(msg); } catch(e) { toast('コピーできませんでした'); }
  }

  // ===== メニュー（⋯） =====
  function menu() {
    const items = [{ label:'今すぐロックする', fn:() => lock() }];
    if (canPasskey()) items.push({ label:vault.prf ? 'Face IDを登録し直す' : 'Face IDで開けるようにする', sub:'機種変更したときなど', fn:async () => {
      try { vault.prf = await registerFace(); await saveVault(); toast('Face IDを登録しました'); }
      catch(e) { toast(e.message === 'noprf' ? 'このiPhoneではFace IDの鍵が使えません' : '登録できませんでした'); } } });
    items.push({ label:'マスターパスワードを変更', fn:changePw });
    Menu.open('Accounts', items);
  }
  function changePw() {
    const f1 = F.text('新しいマスターパスワード（8文字以上）', '', '', 'password'), f2 = F.text('もう一度', '', '', 'password');
    const body = h('<div></div>'); body.append(f1.el, f2.el, h('<p class="hint">変えたあとは、新しいパスワードで開きます。Face IDはそのまま使えます。</p>'));
    Editor.open({ title:'マスターパスワードを変更', body, theme:THEME, focus:f1.input, save:async () => {
      const a = f1.input.value, b = f2.input.value;
      if (a.length < 8) { toast('8文字以上にしてください'); return false; }
      if (a !== b) { toast('2つのパスワードが違います'); return false; }
      const salt = rnd(16); vault.salt = b64(salt); vault.iter = ITER; vault.pw = await seal(await pwKey(a, salt, ITER), raw);
      await saveVault(); toast('変更しました');
    } });
  }

  // ===== タブの出入り（1分たつと自動でロック） =====
  async function load() {
    const v = await DB.get('settings', 'vault');
    key = raw = null; list = [];
    vault = v || null; state = vault ? 'locked' : 'setup';
    render();
    if (tab === 'accounts' && state === 'locked') Motion.guardLoop(); else Motion.stopLoop('hina');
  }
  function enter() {
    clearTimeout(lockTimer);
    if (state === 'open' && leftAt && Date.now() - leftAt > AUTO_LOCK) lock(true);
    Motion.preload('hina'); Motion.preload('miyako');
    Motion.rappel();
    if (state !== 'open') Motion.guardLoop();
    if (state === 'locked' && vault.prf) unlockFace(false);   // タブを開いたらすぐFace ID
  }
  function leave() {
    leftAt = Date.now(); clearTimeout(lockTimer); lockTimer = setTimeout(() => lock(true), AUTO_LOCK);
    Motion.stopLoop('hina');
  }
  function init() {
    $('accAdd').onclick = () => { if (state === 'open') edit(null); };
    box().addEventListener('click', e => { const r = e.target.closest('.arow'); if (r) edit(list.find(x => x.id === r.dataset.id)); });
    // ミヤコ：開いているときはパトロール（点検）
    Motion.handlers.miyako = () => {
      if (state !== 'open' || !list.length) return Motion.play('miyako', 'tap');
      const a = audit();
      if (!a.ids.size) return Motion.play('miyako', 'tap', { issues:false });
      Motion.play('miyako', 'tap', { issues:true, text:`弱いPW ${a.weak.length}件・使い回し ${a.reused.length}件`, sub:'タップで確認', onTap:() => { onlyIssues = true; render(); } });
    };
    TabHooks.accounts = { enter, leave, visibility:hidden => {
      if (tab !== 'accounts') return;
      if (hidden) leftAt = Date.now(); else if (state === 'open' && Date.now() - leftAt > AUTO_LOCK) lock(true);
    } };
    load();
  }
  // アプリのロック用：Accountsは開かずに、本人かどうかだけ確かめる（同じマスターパスワード・Face IDを使う）
  const gate = {
    async ready() { if (!vault) vault = await DB.get('settings', 'vault').catch(() => null) || null; return !!vault; },
    face:() => !!(vault && vault.prf && canPasskey()),
    async tryFace() { const out = await assertPrf(unb64(vault.prf.credId), unb64(vault.prf.salt)); await unseal(await prfKey(out), vault.prf.box); return true; },
    async tryPw(pw) { await unseal(await pwKey(pw, unb64(vault.salt), vault.iter), vault.pw); return true; },
  };
  return { init, reload:load, gate };
})();
App.modules.push(Accounts);
