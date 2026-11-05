// Yohei Support — スマホの通知（Cloudflare Workers・1日最大3回）とホーム画面のウィジェット（Scriptable）
// アプリを開くたびに「これから24時間の通知の予定」と「ウィジェットに出す要約」をWorkerに送っておく。Workerが時間になったら通知を出す
'use strict';
const Push = (() => {
  const SID = 'ys-push';
  const cfg = async () => (await DB.get('settings', SID).catch(() => null)) || { id:SID, url:'', key:'', on:false };
  const base = c => String(c.url || '').replace(/\/+$/, '');
  async function call(c, path, body) {
    const r = await fetch(base(c) + path, { method:body ? 'POST' : 'GET', headers:body ? { 'content-type':'application/json' } : {}, body:body ? JSON.stringify(Object.assign({ key:c.key }, body)) : undefined, cache:'no-store' });
    const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error(j.error || 'http ' + r.status); return j;
  }
  const b64 = s => { const p = '='.repeat((4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, c => c.charCodeAt(0)); };

  // ===== 通知をオンにする（設定から。ボタンを押した流れの中で許可をとる） =====
  async function enable(url, key) {
    const c = await cfg(); c.url = url.trim(); c.key = key.trim();
    if (!c.url || !c.key) throw new Error('URLと合言葉を入れてください');
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('ホーム画面に追加したアプリから開いてください（iPhoneはiOS 16.4以上）');
    const perm = await Notification.requestPermission(); if (perm !== 'granted') throw new Error('通知が許可されませんでした（設定アプリ → 通知 から許可できます）');
    const { pub } = await call(c, '/vapid');
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (sub) { try { await sub.unsubscribe(); } catch (e) {} }
    sub = await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey:b64(pub) });
    await call(c, '/subscribe', { sub:sub.toJSON() });
    c.on = true; await DB.put('settings', c);
    await sync(true);
    return true;
  }
  async function disable() { const c = await cfg(); c.on = false; await DB.put('settings', c); try { const s = await (await navigator.serviceWorker.ready).pushManager.getSubscription(); if (s) await s.unsubscribe(); } catch (e) {} }
  async function test() { const c = await cfg(); if (!c.url) throw new Error('まだ設定されていません'); await call(c, '/test', {}); }

  // ===== これから24時間の予定（最大3回／日）と、ウィジェットの要約 =====
  const at = (d, hm) => { const [h, m] = hm.split(':').map(Number), x = D.parse(d); x.setHours(h, m, 0, 0); return x.getTime(); };
  async function plan() {
    const t = D.today(), tm = D.add(t, 1), now = Date.now(), out = [];
    const w = await Wx.get().catch(() => null);
    const todos = (await DB.all('todos').catch(() => [])).filter(x => !x.done && x.list === 'do' && x.due);
    const days = [t, tm];
    for (const d of days) {
      const dw = w && (d === t ? w.today : w.tomorrow);
      if (Feat.on('morning') && dw) {
        const rain = dw.rain >= 50 ? '傘を忘れないでね☆' : dw.rain >= 30 ? '折りたたみ傘があると安心だよ' : '今日もいってらっしゃい☆';
        out.push({ at:at(d, '07:30'), who:'mika', title:'ミカ', body:`おはよう、先生☆ 今日は${dw.text}、${dw.max}°/${dw.min}°だよ。${rain}`, tag:'morning-' + d });
      }
      const due = todos.filter(x => x.due === d);
      if (due.length) out.push({ at:at(d, '12:15'), who:'hoshino', title:'ホシノ', body:`先生〜、今日が期限の「${due[0].title}」${due.length > 1 ? `ほか${due.length - 1}件` : ''}があるよ〜。お昼のうちにどう〜？`, tag:'due-' + d });
      if (Feat.on('night')) out.push({ at:at(d, '22:30'), who:'noa', title:'乃亜', body:'……今日の記録、まだでしょ。ちょっとだけ来て', tag:'night-' + d });
    }
    // 今日の夜の記録がすんでいれば、今日の夜の通知は出さない
    const done = LS.get('ys-night') === t;
    return out.filter(x => x.at > now && !(done && x.tag === 'night-' + t)).slice(0, 6);
  }
  async function widget() {
    const r = typeof Progress !== 'undefined' ? await Progress.rings().catch(() => null) : null;
    const s = typeof Progress !== 'undefined' ? await Progress.streak().catch(() => null) : null;
    const m = typeof Progress !== 'undefined' && Feat.on('missions') ? await Progress.missions().catch(() => null) : null;
    const wb = await Wx.brief().catch(() => null), un = typeof Chat !== 'undefined' ? await Chat.unread().catch(() => 0) : 0;
    const t = D.today(), now = new Date(), hm = `${p2(now.getHours())}:${p2(now.getMinutes())}`;
    const ev = (await DB.all('events').catch(() => [])).filter(e => e.date === t).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    const todos = (await DB.all('todos').catch(() => [])).filter(x => !x.done && x.list === 'do' && x.due && x.due <= t);
    const sh = Life.sleepH((await Life.day()).sleep);
    return { at:Date.now(), date:t, rings:r ? { body:+r.body.toFixed(2), home:+r.home.toFixed(2), money:+r.money.toFixed(2) } : null,
      streak:s ? s.n : 0, missions:m ? { n:m.n, total:m.list.length } : null, unread:un,
      weather:wb ? { text:wb.text, max:wb.max, min:wb.min, rain:wb.rain } : null,
      next:(ev.find(e => !e.time || e.time >= hm) || {}).title ? `${(ev.find(e => !e.time || e.time >= hm)).time || '今日'} ${(ev.find(e => !e.time || e.time >= hm)).title}` : todos[0] ? `${todos[0].due < t ? '期限切れ' : '今日'}：${todos[0].title}` : '',
      todo:todos.length, noa:sh == null ? '……睡眠、まだ記録してないでしょ' : sh < 6 ? `……${sh}時間しか寝てない。今日は早く寝て` : `${sh}時間。……まあ、寝れたんじゃない` };
  }
  let lastSync = 0;
  async function sync(force) {
    const c = await cfg(); if (!c.url || !c.key) return;
    if (!force && Date.now() - lastSync < 10 * 60e3) return; lastSync = Date.now();
    try { await call(c, '/plan', { plan:c.on ? await plan() : [], widget:await widget() }); LS.set('ys-pushSync', Date.now()); } catch (e) { console.warn('push sync', e.message); }
  }

  // ===== 設定画面（タイトルの歯車の中） =====
  async function settingsHTML() {
    const c = await cfg(), last = +LS.get('ys-pushSync') || 0;
    return `<div class="fs-sec"><h4>通知とウィジェット<small>Cloudflare Workers</small></h4>
      <p class="note2">朝の天気（ミカ）・期限の日（ホシノ）・夜の記録（乃亜）を、1日最大3回スマホに通知します。ウィジェットにも同じ要約が出ます。設定のしかたは手順書を見てください。</p>
      <label class="fs-in"><span>WorkerのURL</span><input id="psUrl" placeholder="https://yohei-push.○○.workers.dev" value="${esc(c.url)}" autocomplete="off"></label>
      <label class="fs-in"><span>合言葉</span><input id="psKey" placeholder="Workerに入れた KEY" value="${esc(c.key)}" autocomplete="off"></label>
      <div class="fs-row"><button class="fs-btn" data-ps="on">${c.on ? '通知を設定しなおす' : '通知をオンにする'}</button>${c.on ? '<button class="fs-btn sub" data-ps="test">テスト通知</button><button class="fs-btn sub" data-ps="off">オフ</button>' : ''}</div>
      <p class="fs-st">${c.on ? '通知：オン' : '通知：オフ'}${last ? `　最後に送った予定：${new Date(last).toLocaleString('ja-JP', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' })}` : ''}</p></div>`;
  }
  async function onSettings(e) {
    const b = e.target.closest('[data-ps]'); if (!b) return; haptic();
    try {
      if (b.dataset.ps === 'on') { b.disabled = true; b.textContent = '設定中…'; await enable($('psUrl').value, $('psKey').value); toast('通知をオンにしました', 2400); }
      if (b.dataset.ps === 'test') { await test(); toast('テスト通知を送りました（数秒で届きます）', 2600); }
      if (b.dataset.ps === 'off') { await disable(); toast('通知をオフにしました'); }
    } catch (err) { toast(err.message || '設定できませんでした', 3200); }
    Setup.paint();
  }
  function init() {
    document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(() => sync(), 6000); });
    setTimeout(() => sync(true), 20000);
    Life.onChange(() => { lastSync = Math.min(lastSync, Date.now() - 9 * 60e3); setTimeout(() => sync(), 60e3); });
  }
  return { init, enable, disable, test, sync, plan, widget, settingsHTML, onSettings };
})();
App.modules.push(Push);

// ===== 設定画面：機能のオン・オフ／もう一度見る／通知 =====
const Setup = (() => {
  async function paint() {
    const box = $('featBox'); if (!box) return;
    const f = Feat.get(), day = Feat.day();
    box.innerHTML = `<div class="fs-sec"><h4>機能<small>使いはじめて${day}日目</small></h4>
      ${Feat.LIST.map(([k, n, sub, d]) => { const un = Feat.unlocked(k); return `<button class="fs-tg ${Feat.on(k) ? 'on' : ''} ${un ? '' : 'lock'}" data-ft="${k}"><span>${n}<small>${un ? sub : `${d}日目に解放（あと${d - day}日）`}</small></span><i></i></button>`; }).join('')}
      <button class="fs-tg ${f.all ? 'on' : ''}" data-ft="all"><span>すべての機能をすぐ使う<small>少しずつの解放をやめて、全部を今すぐ使えるようにします</small></span><i></i></button>
      <div class="fs-row"><button class="fs-btn sub" data-again="morning">朝の流れをもう一度</button><button class="fs-btn sub" data-again="night">夜の記録をもう一度</button></div></div>
      ${await Push.settingsHTML()}`;
  }
  function init() {
    const box = $('featBox'); if (!box) return;
    box.addEventListener('click', async e => {
      const t = e.target.closest('[data-ft]');
      if (t) { haptic(); const k = t.dataset.ft; if (k === 'all') Feat.set('all', !Feat.get().all); else if (Feat.unlocked(k)) Feat.set(k, !Feat.on(k)); else return toast('まだ解放されていません（「すべての機能をすぐ使う」で解放できます）', 2600); paint(); if (typeof Chat !== 'undefined') Chat.badge(); if (typeof Progress !== 'undefined') Progress.paintHud(); return; }
      const a = e.target.closest('[data-again]');
      if (a) { haptic(); $('sheet').classList.remove('show'); $('sheetBg').classList.remove('show'); LS.set('ys-force', a.dataset.again); if (phase !== 'app') return toast('アプリに入ると始まります', 2200); return Daily.check(); }
      Push.onSettings(e);
    });
  }
  return { init, paint };
})();
App.modules.push(Setup);
