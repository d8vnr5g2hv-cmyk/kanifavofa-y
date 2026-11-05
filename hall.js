// Yohei Support — 廊下（メモロビの右どなり）。カレンダーと週報を、そのままの見た目で壁に貼っておく
'use strict';
const Hall = (() => {
  let s = null, on = false;
  function makeSlide() {
    s = h(`<div class="slide yhall"><img class="hbg" alt="">
      <div class="hwall"><div class="hpost cal" data-k="cal"><i class="pin"></i><div class="hbox" id="hCal"></div></div>
        <div class="hpost np" data-k="paper"><i class="pin b"></i><div class="hbox" id="hNp"></div><b class="hnew" id="hNew"></b></div>
        <div class="hrow"><div class="hiv" id="hIv"></div><div class="hms" id="hMs" data-k="today" hidden></div></div></div><div class="rhint">TAP TO OPEN</div></div>`);
    slidesEl.appendChild(s);
    s.addEventListener('click', e => {
      const b = e.target.closest('[data-k]'); if (!b) return;
      ctx.resume(); haptic();
      if (b.dataset.k === 'today') return Progress.openToday();
      const r = b.getBoundingClientRect();
      Room.openBoard(b.dataset.k, { fx:(r.left + r.width / 2 - innerWidth / 2) + 'px', fy:(r.top + r.height / 2 - innerHeight / 2) + 'px' }).then(() => setTimeout(paint, 400));
    });
    addEventListener('resize', () => Room.fitQuads($('hNp')));
    paint();
  }
  async function paint() {
    if (!s) return;
    const night = Room.period() !== 'day';
    s.querySelector('.hbg').src = night ? 'dm_hall_n.jpg' : 'dm_hall_d.jpg';
    try { await Room.boardCal($('hCal')); } catch (e) {}
    let arts = []; try { arts = await Room.boardPaper($('hNp')); } catch (e) {}
    $('hNew').textContent = arts.some(a => a.read === false) ? 'NEW' : '';
    const w = Interview.whoToday(), done = await DB.get('room', 'art-' + D.today()).catch(() => null);
    if (typeof Progress !== 'undefined') Progress.hallChip($('hMs')).catch(() => {});
    $('hIv').innerHTML = `<img src="${w === 'noa' ? 'noa_face.webp' : w + '_chibi.webp'}" alt=""><span>今日の取材<b>${WHO[w].name}</b>${done ? '<em>取材ずみ</em>' : ''}</span>`;
  }
  function setOn(v) { if (on === v) return; on = v; document.body.classList.toggle('atHall', v); if (v) paint(); }
  return { makeSlide, paint, setOn, isOn:() => on };
})();
