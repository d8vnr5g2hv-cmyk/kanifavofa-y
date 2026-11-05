// Yohei Support — チャット（どこにいても右上から）。みんなからのメッセージ・スタンプ・返事の候補
// 話し方は Cast（cast.js）とGASの人格設定をそのまま使う。自由入力はGASのAI、つながらないときは決まったセリフ
'use strict';
const Chat = (() => {
  const STAMP_TXT = ['おはよう', 'いいね', 'えらい', 'おやすみ', 'ありがとう', 'ごめん', 'がんばれ', '!?'];
  const HAS_ST = { noa:1, hoshino:1, mika:1, mari:1, hina:1, miyako:1, kisaki:1 };   // スタンプがある子（ユウカは絵ができたら足す）
  const stSrc = (w, i) => `st_${w}_${i}.webp`;
  let btn = null, ov = null, cur = null, sending = false, banner = null;
  const T = {};   // スレッドのキャッシュ

  // ===== 保存 =====
  async function th(w) {
    if (!T[w]) T[w] = (await DB.get('room', 'chat-' + w).catch(() => null)) || { id:'chat-' + w, who:w, msgs:[], unread:0, last:0 };
    return T[w];
  }
  const put = t => DB.put('room', t).catch(() => {});
  async function unread() { let n = 0; for (const w of Cast.ORDER) n += (await th(w)).unread || 0; return n; }
  async function badge() {
    if (!btn) return;
    const n = Feat.on('chat') ? await unread() : 0;
    btn.querySelector('b').textContent = n > 99 ? '99+' : n || '';
    btn.classList.toggle('has', n > 0); btn.hidden = !Feat.on('chat');
  }

  // ===== 相手からのメッセージを足す =====
  async function push(w, lines, o = {}) {
    const t = await th(w), at = Date.now();
    (Array.isArray(lines) ? lines : [lines]).filter(Boolean).forEach((x, i) => t.msgs.push({ from:'them', text:x, at:at + i }));
    if (o.stamp) t.msgs.push({ from:'them', st:o.stamp, at:at + 9 });
    if (o.replies && o.replies.length) t.msgs[t.msgs.length - 1].replies = o.replies.slice(0, 3);
    while (t.msgs.length > 200) t.msgs.shift();
    t.last = at;
    if (!(ov && cur === w)) t.unread = (t.unread || 0) + 1;
    await put(t); badge();
    if (ov && cur === w) drawThread(true);
    else if (ov && !cur) drawList();
    else if (!o.silent) notify(w, (Array.isArray(lines) ? lines[0] : lines) || STAMP_TXT[(o.stamp || 1) - 1]);
  }
  // 画面の上に出るおしらせ
  function notify(w, text) {
    if (!banner) { banner = h('<button class="ch-ban"><img alt=""><span><b></b><em></em></span></button>'); document.body.appendChild(banner); banner.onclick = () => { banner.classList.remove('on'); open(banner.dataset.w); }; }
    banner.dataset.w = w; banner.querySelector('img').src = Cast.av(w); banner.querySelector('b').textContent = Cast.name(w); banner.querySelector('em').textContent = text;
    banner.classList.remove('on'); void banner.offsetWidth; banner.classList.add('on'); Sfx.play('pop'); haptic();
    clearTimeout(notify._t); notify._t = setTimeout(() => banner.classList.remove('on'), 4200);
  }

  // ===== 一覧 =====
  function build() {
    ov = h(`<div id="chat" class="ui2"><div class="ch-hd"><button class="ch-bk" aria-label="もどる">‹</button><div class="ch-tt"><small>MESSAGE</small><b>チャット</b></div><button class="ch-x" aria-label="閉じる">×</button></div>
      <div class="ch-list"></div><div class="ch-th"><div class="ch-msgs"></div><div class="ch-reply"></div>
      <div class="ch-st"></div><div class="ch-in"><button class="ch-stb" aria-label="スタンプ"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5q3.5 3 7 0"/><circle cx="9" cy="10" r=".9"/><circle cx="15" cy="10" r=".9"/></svg></button><input class="ch-i" placeholder="メッセージ" enterkeyhint="send" autocomplete="off"><button class="ch-send">送信</button></div></div></div>`);
    document.body.appendChild(ov);
    ov.querySelector('.ch-x').onclick = () => close();
    ov.querySelector('.ch-bk').onclick = () => { if (cur) { cur = null; ov.classList.remove('th'); drawList(); } else close(); };
    ov.querySelector('.ch-list').addEventListener('click', e => { const r = e.target.closest('[data-w]'); if (r) { haptic(); thread(r.dataset.w); } });
    ov.querySelector('.ch-send').onclick = () => sendText();
    ov.querySelector('.ch-i').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); sendText(); } });
    ov.querySelector('.ch-stb').onclick = () => { haptic(); ov.classList.toggle('stOpen'); drawStamps(); };
    ov.querySelector('.ch-st').addEventListener('click', e => { const b = e.target.closest('[data-sw]'); if (b) { haptic(); drawStamps(b.dataset.sw); return; } const s = e.target.closest('[data-st]'); if (s) { haptic(); ov.classList.remove('stOpen'); send({ st:+s.dataset.st, sw:s.dataset.w }); } });
    ov.querySelector('.ch-reply').addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (b) { haptic(); send({ text:b.textContent }); } });
  }
  async function open(w) {
    if (!Feat.on('chat')) return;
    if (!ov) build();
    if (!ov.classList.contains('on')) { await Wipe.mid(() => { ov.classList.add('on'); document.body.classList.add('chatOn'); }); }
    if (w) thread(w); else { cur = null; ov.classList.remove('th'); drawList(); }
  }
  function close() {
    if (!ov) return;
    Wipe.mid(() => { ov.classList.remove('on', 'th', 'stOpen'); document.body.classList.remove('chatOn'); cur = null; });
  }
  const hm = at => { const d = new Date(at), t = D.key(d); return t === D.today() ? `${p2(d.getHours())}:${p2(d.getMinutes())}` : D.diff(D.today(), t) === 1 ? '昨日' : D.md(t); };
  async function drawList() {
    const L = ov.querySelector('.ch-list'); ov.querySelector('.ch-tt b').textContent = 'チャット'; ov.querySelector('.ch-tt small').textContent = 'MESSAGE';
    const rows = [];
    for (const w of Cast.ORDER) { const t = await th(w), m = t.msgs[t.msgs.length - 1]; rows.push({ w, t, m }); }
    rows.sort((a, b) => (b.t.last || 0) - (a.t.last || 0) || Cast.ORDER.indexOf(a.w) - Cast.ORDER.indexOf(b.w));
    L.innerHTML = rows.map(({ w, t, m }, i) => `<button class="ch-row" data-w="${w}" style="--c:${Cast.of(w).color};animation-delay:${i * .03}s"><img src="${Cast.av(w)}" alt="">
      <span><b>${Cast.name(w)}<small>${esc(Cast.of(w).club)}</small></b><em>${m ? esc(m.st ? `[スタンプ] ${STAMP_TXT[m.st - 1]}` : (m.from === 'me' ? 'あなた：' : '') + m.text) : 'まだメッセージはありません'}</em></span>
      <i>${m ? hm(m.at) : ''}${t.unread ? `<u>${t.unread}</u>` : ''}</i></button>`).join('');
  }

  // ===== スレッド =====
  async function thread(w) {
    cur = w; ov.classList.add('th'); ov.classList.remove('stOpen');
    ov.querySelector('.ch-tt b').textContent = Cast.name(w); ov.querySelector('.ch-tt small').textContent = Cast.of(w).club.toUpperCase ? Cast.of(w).club : '';
    ov.style.setProperty('--tc', Cast.of(w).color);
    const t = await th(w); t.unread = 0; await put(t); badge();
    await drawThread();
    // 乃亜：やきもち（1日1回）
    if (w === 'noa' && Cast.jealousy() && LS.get('ys-jl') !== D.today()) { LS.set('ys-jl', D.today()); setTimeout(() => typingThen(w, () => push(w, [Cast.jealousLine()], { replies:['ごめんって', '乃亜とも話したかった', 'やきもち？'] })), 600); }
  }
  async function drawThread(scroll = true) {
    if (!cur) return;
    const w = cur, t = await th(w), box = ov.querySelector('.ch-msgs');
    let lastDay = '';
    box.innerHTML = t.msgs.map(m => {
      const d = D.key(new Date(m.at)), sep = d !== lastDay ? `<div class="ch-day">${d === D.today() ? '今日' : D.md(d) + '（' + D.dow(d) + '）'}</div>` : ''; lastDay = d;
      const body = m.st ? `<img class="ch-stamp" src="${stSrc(m.sw || w, m.st)}" alt="${STAMP_TXT[m.st - 1]}">` : `<p>${esc(m.text)}</p>`;
      return sep + (m.from === 'me' ? `<div class="ch-m me ${m.st ? 'st' : ''}"><time>${hm(m.at)}</time>${body}</div>`
        : `<div class="ch-m ${m.st ? 'st' : ''}"><img class="av" src="${Cast.av(w)}" alt="">${body}<time>${hm(m.at)}</time></div>`);
    }).join('') + (t.msgs.length ? '' : `<div class="ch-empty"><img src="${Cast.av(w)}" alt=""><p>${esc(Cast.of(w).greet)}</p></div>`);
    const last = t.msgs[t.msgs.length - 1];
    ov.querySelector('.ch-reply').innerHTML = last && last.from === 'them' && last.replies ? last.replies.map(r => `<button data-r>${esc(r)}</button>`).join('') : '';
    if (scroll) requestAnimationFrame(() => { box.scrollTop = box.scrollHeight; });
  }
  function drawStamps(sw) {
    const box = ov.querySelector('.ch-st'), who = Object.keys(HAS_ST);
    sw = sw || (HAS_ST[cur] ? cur : 'noa');
    box.innerHTML = `<div class="ch-stt">${who.map(w => `<button data-sw="${w}" class="${w === sw ? 'on' : ''}"><img src="${Cast.av(w)}" alt=""></button>`).join('')}</div>
      <div class="ch-stg">${STAMP_TXT.map((_, i) => `<button data-st="${i + 1}" data-w="${sw}"><img src="${stSrc(sw, i + 1)}" alt="" loading="lazy"></button>`).join('')}</div>`;
  }
  // 「入力中…」のあとで
  async function typingThen(w, fn, ms = 900) {
    const box = ov && cur === w ? ov.querySelector('.ch-msgs') : null;
    let dot = null;
    if (box) { dot = h(`<div class="ch-m typing"><img class="av" src="${Cast.av(w)}" alt=""><p><i></i><i></i><i></i></p></div>`); box.appendChild(dot); box.scrollTop = box.scrollHeight; }
    await sleep(ms); if (dot) dot.remove(); await fn();
  }

  // ===== 送る =====
  function sendText() { const i = ov.querySelector('.ch-i'), v = i.value.trim(); if (!v) return; i.value = ''; send({ text:v }); }
  async function send(o) {
    if (!cur || sending) return;
    const w = cur, t = await th(w);
    const last = t.msgs[t.msgs.length - 1]; if (last && last.replies) delete last.replies;
    t.msgs.push(Object.assign({ from:'me', at:Date.now() }, o.st ? { st:o.st, sw:o.sw } : { text:o.text })); t.last = Date.now();
    await put(t); drawThread(); Sfx.play('msg');
    const k = 'ys-chat-' + D.today(); LS.set(k, (+LS.get(k) || 0) + 1); Cast.note(w);
    try { const s = new Set(JSON.parse(LS.get('ys-chatWho') || '[]')); s.add(w); LS.set('ys-chatWho', JSON.stringify([...s])); } catch (e) {}
    if (typeof Progress !== 'undefined') Progress.checkAch();
    sending = true;
    try { await answer(w, o); } finally { sending = false; }
  }
  // 決まったセリフで返す（AIがないとき・スタンプのとき）
  function local(w, o) {
    const C = Cast.of(w);
    const kind = o.st ? ['greet', 'ok', 'thanks', 'night', 'thanks', 'sorry', 'cheer', 'greet'][o.st - 1]
      : /ありがと|感謝|助か/.test(o.text) ? 'thanks' : /ごめん|すまん|すみません/.test(o.text) ? 'sorry' : /がんば|疲れ|つかれ|しんど|眠い|ねむ/.test(o.text) ? 'cheer'
      : /おやすみ|寝る|ねる/.test(o.text) ? 'night' : /おはよ/.test(o.text) ? 'greet' : 'ok';
    const line = kind === 'ok' ? Cast.pick(C.ok) : C[kind] || Cast.pick(C.ok);
    const stamp = HAS_ST[w] && Math.random() < .35 ? { greet:1, ok:2, thanks:5, night:4, sorry:5, cheer:7 }[kind] || 2 : null;
    return { lines:[line], stamp };
  }
  async function answer(w, o) {
    let r = null;
    const t = await th(w);
    if (!o.st && (await Api.load())) {
      try {
        const log = t.msgs.slice(-14, -1).map(m => ({ who:m.from === 'me' ? 'me' : w, text:m.st ? `（スタンプ：${STAMP_TXT[m.st - 1]}）` : m.text }));
        r = await Api.call('chat', { who:w, mode:'line', now:Api.now(), text:o.text, log, note:Cast.aiNote(w), snap:await Life.snapshot() }, 30000);
        if (r && r.memo) Life.put({ dm:r.memo.dm || 'habit', cat:'', name:r.memo.name, val:r.memo.val, state:'heard' });
      } catch (e) { r = null; }
    }
    // 乃亜：やきもちのあとに話しかけたら、機嫌が直る
    const madeUp = w === 'noa' && t.msgs.some(m => m.from === 'them' && /ふーん|私には|遅い|知ってるから/.test(m.text || '') && Date.now() - m.at < 3 * 3600e3);
    const res = r && r.lines && r.lines.length ? { lines:r.lines.slice(0, 2), stamp:null } : local(w, o);
    if (madeUp && !(r && r.lines && r.lines.length)) res.lines = [Cast.makeUp()];
    await typingThen(w, () => push(w, res.lines, { stamp:res.stamp, silent:true }), 700 + Math.random() * 600);
  }

  // ===== みんなから話しかける（1日に1人1回、全体で1日4回まで） =====
  const pinged = () => { try { const o = JSON.parse(LS.get('ys-pinged') || '{}'); return o.d === D.today() ? o : { d:D.today(), w:[] }; } catch (e) { return { d:D.today(), w:[] }; } };
  async function ping(w, topic, line, replies) {
    const pg = pinged(); if (pg.w.includes(w) || pg.w.length >= 4) return false;
    pg.w.push(w); LS.set('ys-pinged', JSON.stringify(pg));
    let r = null;
    if (await Api.load()) { try { r = await Api.call('ping', { who:w, now:Api.now(), topic, note:Cast.aiNote(w), snap:await Life.snapshot() }, 25000); } catch (e) {} }
    await push(w, r && r.lines && r.lines.length ? r.lines : [line], { replies:r && r.replies && r.replies.length ? r.replies : replies });
    return true;
  }
  let ticking = false;
  async function tick(reason) {
    if (ticking || !Feat.on('chat') || phase !== 'app' || document.body.classList.contains('dailyOn')) return;
    ticking = true;
    try {
      const t = D.today(), hr = new Date().getHours(), pg = pinged(); if (pg.w.length >= 4) return;
      const todos = (await DB.all('todos').catch(() => [])).filter(x => !x.done && x.list === 'do' && x.due && x.due < t);
      if (hr >= 11 && hr < 15 && todos[0]) { if (await ping('hoshino', `期限切れのやること「${todos[0].title}」がある`, `先生〜、「${todos[0].title}」の期限すぎてるよ〜。お昼のうちにやっちゃう？`, ['やる', 'あとでやる', 'もう終わった'])) return; }
      const td = await Life.day(), sh = Life.sleepH(td.sleep);
      if (hr >= 10 && hr < 17 && sh != null && sh < 6) { if (await ping('noa', `ゆうべの睡眠が${sh}時間しかない`, `……ねむくない？ 昨日${sh}時間でしょ。今日は早く寝て`, ['ねむい', '大丈夫', '早く寝る'])) return; }
      const f = await Life.food(t);
      if (hr >= 20 && hr < 23 && !Object.keys(f.meals || {}).length) { if (await ping('mika', '今日のご飯の記録がまだない', '先生、今日のご飯まだ記録してないじゃんね？ なに食べたの？☆', ['あとで書く', '食べてない', 'ラーメン'])) return; }
      try { const m = typeof Office !== 'undefined' ? await Office.summary() : null;
        if (m && hr >= 18 && typeof m['今日使った'] === 'number' && typeof m['一日あたり'] === 'number' && m['今日使った'] > Math.max(0, m['一日あたり']) && m['今日使った'] > 0) {
          if (await ping('yuuka', `今日の出費が${m['今日使った']}円で、1日の予算${m['一日あたり']}円をこえている`, `先生！ 今日もう${m['今日使った'].toLocaleString()}円使ってますよ？ 1日の予算は${Math.max(0, m['一日あたり']).toLocaleString()}円です！`, ['ごめん', '明日がまんする', '必要だった'])) return; } } catch (e) {}
      const low = (await Life.stock()).filter(s => { const d = Life.stockDays(s); return d != null && d <= 2; });
      if (hr >= 9 && hr < 21 && low[0]) { if (await ping('mari', `在庫の「${low[0].name}」がもうすぐなくなる`, `先生、${low[0].name}がそろそろなくなりそうです。お買い物のときに、いかがでしょうか`, ['買っておく', 'まだある', 'ありがとう'])) return; }
      if (typeof Rabbit !== 'undefined' && hr >= 8 && hr < 22) { const b = String(await Rabbit.doorBadge().catch(() => '')).replace(/<[^>]+>/g, ''); if (b) { if (await ping('miyako', `ウサギが「${b}」`, `先生、屋外エリアより報告です。${b}。お世話をお願いします`, ['すぐ行く', 'あとで行く', '了解'])) return; } }
      if ((hr >= 1 && hr < 4)) { if (await ping('hina', '深夜なのに先生がまだ起きている', '……先生、まだ起きてるの？ 私も人のこと言えないけど。もう寝て', ['寝る', 'もう少し', 'ヒナも寝て'])) return; }
      if (hr >= 19 && hr < 23 && Cast.jealousy()) { if (await ping('noa', 'ようへいが今日ほかの子とばかり話している', Cast.jealousLine(), ['ごめんって', '乃亜とも話したかった', 'やきもち？'])) return; }
      if (hr >= 15 && hr < 18 && hashN(t, 3) === 0) { if (await ping('kisaki', '午後のお茶の時間。先生に一息つかせたい', '先生、茶の時間じゃ。少し手を止めて、一息つかぬか？', ['休む', 'あとで', 'お茶にする'])) return; }
    } catch (e) { console.warn(e); } finally { ticking = false; }
  }
  // スクラッチの景品
  async function prize(w) {
    const L = { hoshino:'うへ〜、先生。今日もおつかれさま〜。おじさん、ちゃんと見てたよ〜', mika:'先生、今日もがんばったじゃんね☆ えらいえらい！', mari:'先生、今日も一日お疲れさまでした。先生のために、お祈りしていますね',
      hina:'……今日もおつかれ、先生。ちゃんと休んでね', miyako:'先生、本日の任務、お疲れさまでした。よく遂行されました', yuuka:'先生、今日もお疲れさまでした。……えっと、その、明日もがんばりましょうね', kisaki:'先生、今日もよう頑張ったのう。妾がほめてつかわす' };
    let r = null;
    if (await Api.load()) { try { r = await Api.call('ping', { who:w, now:Api.now(), topic:'一日の終わりに、先生をねぎらう', snap:await Life.snapshot() }, 25000); } catch (e) {} }
    push(w, r && r.lines && r.lines.length ? r.lines : [L[w] || L.hoshino], { replies:r && r.replies && r.replies.length ? r.replies : ['ありがとう', 'おやすみ', 'うれしい'], stamp:!r && HAS_ST[w] ? 3 : null });
  }

  function init() {
    btn = h('<button id="chatBtn" aria-label="チャット"><svg viewBox="0 0 24 24"><path d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5V17.5H4A1.5 1.5 0 0 1 2.5 16V7A1.5 1.5 0 0 1 4 5.5z"/></svg><b></b></button>');
    document.body.appendChild(btn);
    ['pointerdown', 'pointerup'].forEach(ev => btn.addEventListener(ev, e => e.stopPropagation()));
    btn.addEventListener('click', e => { e.stopPropagation(); haptic(); open(); });
    badge();
    setInterval(() => tick('timer'), 10 * 60e3);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(() => tick('resume'), 4000); });
    setTimeout(() => tick('boot'), 12000);
  }
  return { init, open, close, push, tick, prize, unread, badge, active:() => !!(ov && ov.classList.contains('on')) };
})();
App.modules.push(Chat);
