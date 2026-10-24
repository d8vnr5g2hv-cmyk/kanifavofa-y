// Kani Favorite — 飾り（Todo・Love・Profileの枠のテープと落書き、入力画面の落書き）
'use strict';
const Deco = (() => {
  // 落書きステッカー（画像）
  const D = { whale:1, wing:2, cross:3, bunny:4, cloud:5, star:6, heart:7, flower:8, note:9, swirl:10, spark:11, arrow:12 };
  const svg = (k, cls, style) => `<img class="dd ${cls || ''}" src="dc_stk${D[k]}.webp" style="${style}" alt="">`;
  const PAGES = {
    todo:{ tape:'THINGS TO DO　✦　ホシノの当番表　✦　のんびりいこ〜　✦　', set:['whale', 'star', 'cloud', 'swirl', 'spark', 'heart'] },
    love:{ tape:'MY FAVORITE　✦　ミカの宝物ばこ　✦　だいすき☆　✦　', set:['heart', 'wing', 'star', 'spark', 'heart', 'flower'] },
    profile:{ tape:'ABOUT ME　✦　マリーの記録帳　✦　PEOPLE NOTE　✦　', set:['cross', 'flower', 'star', 'note', 'heart', 'bunny'] },
  };
  // 落書きを置く場所（枠の四隅・ふち。中身にかぶりにくいところ）
  const SPOTS = [['right:8px;top:40px;width:38px;transform:rotate(12deg)'], ['left:4px;bottom:66px;width:32px;transform:rotate(-14deg)'], ['right:72px;bottom:16px;width:30px;transform:rotate(8deg)'],
                 ['left:42%;bottom:6px;width:26px;transform:rotate(-6deg)'], ['right:2px;top:44%;width:24px;transform:rotate(20deg)'], ['left:2px;top:36%;width:24px;transform:rotate(-10deg)']];
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
