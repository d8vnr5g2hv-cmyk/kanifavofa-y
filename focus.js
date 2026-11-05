// Yohei Support — 執務室の集中タイマー（ユウカ）と、保健室の「こころの1年」モザイク・睡眠の30日
'use strict';
const Focus = (() => {
  const RUN = 'ys-focus-run';
  const run = () => { try { return JSON.parse(LS.get(RUN) || 'null'); } catch (e) { return null; } };
  const todayMin = (d = D.today()) => +LS.get('ys-focus-' + d) || 0;
  let tickT = 0, box = null;
  function start(min) { LS.set(RUN, JSON.stringify({ end:Date.now() + min * 60e3, min, at:Date.now() })); Sfx.play('ok'); Wipe.slash(); paint(); }
  function stop(done) {
    const r = run(); if (!r) return;
    LS.set(RUN, 'null');
    const used = done ? r.min : Math.floor((Date.now() - r.at) / 60e3);
    if (used > 0) { const k = 'ys-focus-' + D.today(); LS.set(k, todayMin() + used); }
    if (done) { Sfx.play('done'); haptic(); toast(`集中おつかれさまでした！（${r.min}分）`, 2600); Wipe.slash(); if (typeof Progress !== 'undefined') Progress.checkAch(); }
    else if (used > 0) toast(`${used}分ぶん記録しました`);
    paint();
  }
  // 時間がきたか（執務室の外にいても数える）
  function poll() { const r = run(); if (r && Date.now() >= r.end) stop(true); else if (box && box.isConnected) paintClock(); }
  function paintClock() {
    const r = run(), el = box && box.querySelector('.fc-time'); if (!el) return;
    const left = r ? Math.max(0, r.end - Date.now()) : 0, s = Math.ceil(left / 1000);
    el.innerHTML = r ? `${p2(Math.floor(s / 60))}<i>:</i>${p2(s % 60)}` : '00<i>:</i>00';
    const ring = box.querySelector('.fc-ring circle.v'); if (ring && r) { const L = 2 * Math.PI * 86; ring.style.strokeDasharray = `${L * (left / (r.min * 60e3))} ${L}`; }
  }
  function html() {
    const r = run(), wk = Array.from({ length:7 }, (_, i) => { const d = D.add(D.today(), i - 6); return { d, m:todayMin(d) }; }), mx = Math.max(60, ...wk.map(x => x.m));
    return `<div class="ofocus"><div class="fc-ring"><svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="86" class="g"/><circle cx="100" cy="100" r="86" class="v" transform="rotate(-90 100 100)"/></svg>
        <div class="fc-c"><small>${r ? 'FOCUS' : 'READY'}</small><b class="fc-time"></b><span>${r ? `${r.min}分の集中` : '時間を選んでね'}</span></div></div>
      ${r ? '<div class="fc-btns"><button class="fc-stop" data-fc="stop">やめる</button></div>'
        : `<div class="fc-btns">${[15, 25, 50].map(m => `<button data-fc="${m}"><b>${m}</b>分</button>`).join('')}</div>`}
      <div class="fc-sum"><div><small>今日</small><b>${todayMin()}</b><span>分</span></div><div class="fc-wk">${wk.map(x => `<i style="height:${x.m / mx * 100}%" class="${x.d === D.today() ? 'td' : ''}"><span>${D.dow(x.d)}</span></i>`).join('')}</div></div>
      <p class="fc-note">ユウカ「集中するときは、スマホは伏せておいてくださいね。終わったら、ちゃんと休憩ですよ？」</p></div>`;
  }
  function paint() {
    if (box && box.isConnected) { box.innerHTML = html(); paintClock(); }
  }
  // 執務室のタブに描く
  function mount(el) {
    box = el; el.innerHTML = html(); paintClock();
    el.onclick = e => { const b = e.target.closest('[data-fc]'); if (!b) return; haptic(); const v = b.dataset.fc; if (v === 'stop') stop(false); else start(+v); };
  }
  function init() { clearInterval(tickT); tickT = setInterval(poll, 1000); }
  return { init, mount, run, todayMin };
})();
App.modules.push(Focus);

// ===== 保健室：こころの1年（気分のモザイク）と、睡眠の30日 =====
const MoodYear = (() => {
  const C = { 1:'#8fa3c9', 2:'#a7b8e0', 3:'#c7c2e6', 4:'#ffb3cf', 5:'#ff7fb0' };
  async function html() {
    const t = D.today(), y = t.slice(0, 4), start = D.parse(`${y}-01-01`), off = start.getDay();
    const room = await DB.all('room').catch(() => []), map = Object.fromEntries(room.filter(r => r.id.startsWith('day-')).map(r => [r.date || r.id.slice(4), r]));
    const n = (new Date(+y, 11, 31) - start) / 86400000 + 1, cells = [];
    for (let i = 0; i < off; i++) cells.push('<i class="pad"></i>');
    for (let i = 0; i < n; i++) { const d = D.add(`${y}-01-01`, i), r = map[d], v = r && (r.mood || null); cells.push(`<i class="${d > t ? 'fut' : ''}${d === t ? ' td' : ''}" ${v ? `style="background:${C[v]}"` : ''}></i>`); }
    const months = Array.from({ length:12 }, (_, m) => { const d = new Date(+y, m, 1), col = Math.floor(((d - start) / 86400000 + off) / 7); return `<span style="left:${col / 53 * 100}%">${m + 1}</span>`; }).join('');
    const ds = Array.from({ length:30 }, (_, i) => D.add(t, i - 29)), sl = ds.map(d => Life.sleepH((map[d] || {}).sleep));
    const got = sl.filter(v => v != null), avg = got.length ? Math.round(got.reduce((a, b) => a + b, 0) / got.length * 10) / 10 : null;
    return `<div class="kc my"><h6>こころの1年<em>${y}</em></h6><div class="my-m">${months}</div><div class="my-g">${cells.join('')}</div>
        <div class="my-lg"><span>しんどい</span>${[1, 2, 3, 4, 5].map(v => `<i style="background:${C[v]}"></i>`).join('')}<span>さいこう</span></div>
        <p class="mu">夜の記録で選んだ気分が、1日1マスずつ埋まっていきます</p></div>
      <div class="kc sl30"><h6>睡眠の30日<em>平均 ${avg ?? '—'}時間</em></h6><div class="s30">${sl.map((v, i) => `<i style="height:${v ? Math.min(100, v / 9 * 100) : 0}%" class="${v != null && v < 6 ? 'lo' : ''}"></i>`).join('')}<u style="bottom:${6 / 9 * 100}%"></u></div>
        <div class="s30l"><span>${D.md(ds[0])}</span><span>6時間ライン</span><span>今日</span></div></div>`;
  }
  return { html };
})();
