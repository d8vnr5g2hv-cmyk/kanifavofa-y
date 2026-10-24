// Kani Favorite — 飾り（Todo・Love・Profileの枠のテープと落書き、入力画面の落書き）
'use strict';
const Deco = (() => {
  // マーカーで描いたような落書き（線だけのSVG）
  const D = {
    star:'<path d="M12 3l2.4 5.6 6 .6-4.6 4 1.4 6-5.2-3.2-5.2 3.2 1.4-6-4.6-4 6-.6z"/>',
    heart:'<path d="M12 20s-7-4.4-8.6-8.4C2 8 4.4 5 7.4 5.6 9.4 6 11 7.6 12 9c1-1.4 2.6-3 4.6-3.4 3-.6 5.4 2.4 4 6-1.6 4-8.6 8.4-8.6 8.4z"/>',
    spark:'<path d="M12 2v6M12 16v6M2 12h6M16 12h6M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3"/>',
    swirl:'<path d="M12 12c0-1.5 1.8-2 2.6-1 1.2 1.4-.2 3.6-2.2 3.6-2.6 0-4-2.6-3-5 1.4-3 5.6-3.4 7.6-1 2.6 3 .6 8.2-4 8.4"/>',
    arrow:'<path d="M3 16c4-8 10-10 17-8"/><path d="M15 4l5 4-5 3"/>',
    cloud:'<path d="M6 18h11a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6-1A4.5 4.5 0 0 0 6 18z"/>',
    flower:'<circle cx="12" cy="12" r="2.2"/><path d="M12 9.8c-1.8-3.6 1.8-6.4 2.6-3.4.5 1.8-1 3-2.6 3.4zM14.2 12c3.6-1.8 6.4 1.8 3.4 2.6-1.8.5-3-1-3.4-2.6zM12 14.2c1.8 3.6-1.8 6.4-2.6 3.4-.5-1.8 1-3 2.6-3.4zM9.8 12C6.2 13.8 3.4 10.2 6.4 9.4c1.8-.5 3 1 3.4 2.6z"/>',
    note:'<path d="M9 18V6l10-2v11"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="15" r="2.5"/>',
    whale:'<path d="M3 13c0 4 4 6 9 6 6 0 9-3.5 9-7 0 0 2-1 2-3-2 0-3 1.5-3 1.5C18 7 15 6 12 6 7 6 3 9 3 13z"/><circle cx="8" cy="12" r=".6"/><path d="M9 4c0-1 1-2 2-2M11 5c.5-1.5 2-2 3-1.5"/>',
    wing:'<path d="M3 8c3-1 6 0 8 3 0-4 3-7 9-7-1 4-2 7-5 9 2 0 4 1 5 3-4 1-7 0-9-2-2 2-5 3-8 2 1-2 2-3 4-4-2-1-3-2-4-4z"/>',
    cross:'<path d="M12 3v18M6 9h12"/>',
    bunny:'<path d="M8 10c-2-6 0-8 1.5-7.5S11 7 10.5 10M16 10c2-6 0-8-1.5-7.5S13 7 13.5 10"/><circle cx="12" cy="15" r="6"/><path d="M10 15h.01M14 15h.01M11 17.5c.6.5 1.4.5 2 0"/>',
  };
  const svg = (k, cls, style) => `<svg class="dd ${cls || ''}" viewBox="0 0 24 24" style="${style}">${D[k]}</svg>`;
  const PAGES = {
    todo:{ tape:'THINGS TO DO　✦　ホシノの当番表　✦　のんびりいこ〜　✦　', set:['whale', 'star', 'cloud', 'swirl', 'spark', 'heart'] },
    love:{ tape:'MY FAVORITE　✦　ミカの宝物ばこ　✦　だいすき☆　✦　', set:['heart', 'wing', 'star', 'spark', 'heart', 'flower'] },
    profile:{ tape:'ABOUT ME　✦　マリーの記録帳　✦　PEOPLE NOTE　✦　', set:['cross', 'flower', 'star', 'note', 'heart', 'bunny'] },
  };
  // 落書きを置く場所（枠の四隅・ふち。中身にかぶりにくいところ）
  const SPOTS = [['right:10px;top:46px;width:30px;transform:rotate(12deg)'], ['left:8px;bottom:70px;width:26px;transform:rotate(-14deg)'], ['right:72px;bottom:22px;width:22px;transform:rotate(8deg)'],
                 ['left:44%;bottom:10px;width:20px;transform:rotate(-6deg)'], ['right:6px;top:42%;width:18px;transform:rotate(20deg)'], ['left:6px;top:38%;width:18px;transform:rotate(-10deg)']];
  function decorate(tab) {
    const pg = $('page-' + tab), f = pg && pg.querySelector('.frame'), P = PAGES[tab]; if (!f || f.querySelector('.ftape')) return;
    f.insertAdjacentHTML('afterbegin', `<div class="ftape"><span>${P.tape.repeat(4)}</span></div><div class="fdood">${P.set.map((k, i) => svg(k, '', SPOTS[i][0])).join('')}</div>`);
  }
  function init() {
    Object.keys(PAGES).forEach(decorate);
    // 入力画面の隅の落書き
    const ed = $('ed');
    if (ed && !ed.querySelector('.eddood')) ed.insertAdjacentHTML('beforeend', `<div class="eddood">${svg('star', 'a', '')}${svg('heart', 'b', '')}${svg('swirl', 'c', '')}</div>`);
  }
  return { init };
})();
App.modules.push(Deco);
