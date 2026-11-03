// Yohei Support — 廊下（メモロビの右どなり）。掲示板にカレンダーと新聞が貼ってある
'use strict';
const Hall = (() => {
  let s = null, on = false;
  function makeSlide() {
    s = h(`<div class="slide yhall"><img class="hbg" alt="">
      <div class="hboard"><div class="hpin a"></div><div class="hpin b"></div>
        <div class="hcap">掲示板<small>BULLETIN BOARD</small></div>
        <button class="hcal" data-k="cal"><div class="hc-h"><b id="hcM"></b><span id="hcY"></span></div><div class="hc-g" id="hcG"></div><div class="hc-n" id="hcN"></div></button>
        <button class="hnp" data-k="paper"><div class="hn-t">シャーレ週報<small id="hnNo"></small></div><div class="hn-h" id="hnH"></div><div class="hn-b" id="hnB"></div><div class="hn-new" id="hnNew"></div></button>
        <div class="hiv" id="hIv"></div>
      </div><div class="rhint">TAP THE BOARD</div></div>`);
    slidesEl.appendChild(s);
    s.addEventListener('click', e => {
      const b = e.target.closest('[data-k]'); if (!b) return;
      ctx.resume(); haptic();
      const r = b.getBoundingClientRect();
      Room.openBoard(b.dataset.k, { fx:(r.left + r.width / 2 - innerWidth / 2) + 'px', fy:(r.top + r.height / 2 - innerHeight / 2) + 'px' }).then(() => setTimeout(paint, 400));
    });
    paint();
  }
  async function paint() {
    if (!s) return;
    const night = Room.period() !== 'day';
    s.querySelector('.hbg').src = night ? 'dm_hall_n.jpg' : 'dm_hall_d.jpg';
    s.classList.toggle('night', night);
    // カレンダー（今月の小さな表と、近い予定）
    const t = D.today(), [y, m] = t.split('-').map(Number), first = new Date(y, m - 1, 1).getDay(), n = new Date(y, m, 0).getDate();
    const evs = await DB.all('events').catch(() => []), todos = (await DB.all('todos').catch(() => [])).filter(x => !x.done && x.due);
    const has = new Set([...evs.map(e => e.date), ...todos.map(x => x.due)]);
    $('hcM').textContent = m + '月'; $('hcY').textContent = y;
    let g = '日月火水木金土'.split('').map((w, i) => `<i class="w ${i === 0 ? 's' : i === 6 ? 'a' : ''}">${w}</i>`).join('') + '<i></i>'.repeat(first);
    for (let d = 1; d <= n; d++) { const k = `${y}-${p2(m)}-${p2(d)}`; g += `<i class="${k === t ? 't' : ''} ${has.has(k) ? 'e' : ''}">${d}</i>`; }
    $('hcG').innerHTML = g;
    const next = [...evs.filter(e => e.date >= t).map(e => ({ d:e.date, x:(e.time ? e.time + ' ' : '') + e.title })), ...todos.filter(x => x.due >= t).map(x => ({ d:x.due, x:x.title, td:1 }))]
      .sort((a, b) => a.d.localeCompare(b.d)).slice(0, 3);
    $('hcN').innerHTML = next.length ? next.map(e => `<p><b>${D.md(e.d)}</b>${esc(e.x)}</p>`).join('') : '<p class="mu">近い予定はありません</p>';
    // 新聞（今週の一面）
    const wk = Room.monday(), arts = await Room.weekArts(wk), no = Math.max(1, Math.round((D.parse(wk) - D.parse('2026-10-19')) / 604800000) + 1);
    const pick = (await DB.get('room', 'front-' + wk).catch(() => null) || {}).art;
    const front = arts.find(a => a.id === pick) || arts.slice().sort((a, b) => (b.score || 3) - (a.score || 3))[0];
    $('hnNo').textContent = `第${no}号`;
    $('hnH').textContent = front ? front.head : '今週はまだ記事がありません';
    $('hnB').innerHTML = front ? `<img src="${Room.img(front.who, 'stand')}" alt=""><span>${esc(front.body).slice(0, 60)}…</span>` : '<span>曜日の担当が、その日はじめて会ったときに取材に来ます</span>';
    $('hnNew').textContent = arts.some(a => a.read === false) ? 'NEW' : '';
    const w = Interview.whoToday(), done = await DB.get('room', 'art-' + t).catch(() => null);
    $('hIv').innerHTML = `<img src="${w === 'noa' ? 'noa_face.webp' : w + '_chibi.webp'}" alt=""><span>今日の取材<b>${WHO[w].name}</b>${done ? '<em>取材ずみ</em>' : ''}</span>`;
  }
  function setOn(v) { if (on === v) return; on = v; document.body.classList.toggle('atHall', v); if (v) paint(); }
  return { makeSlide, paint, setOn, isOn:() => on };
})();
