// Yohei Support — ウサギ飼育ルーム（ミヤコ）：本格的な育成。放っておくと病気になる（死なない）。生活の記録がにんじんになる
'use strict';
const Rabbit = (() => {
  const ID = 'ys-rabbit';
  const BREED = { nd:['ネザーランドドワーフ', 'none'], hl:['ホーランドロップ', 'sepia(.35) saturate(1.4) brightness(1.02)'], li:['ライオンラビット', 'sepia(.7) saturate(1.6) hue-rotate(-12deg) brightness(.92)'], mr:['ミニレッキス', 'grayscale(.4) brightness(.86) contrast(1.05)'] };
  const PERS = { calm:'おっとり', play:'やんちゃ', shy:'人見知り', glut:'くいしんぼう' };
  const SHOP = [['pellet', 'ペレット×3', 3, 3], ['veg', '野菜×3', 4, 3], ['med', 'お薬', 5, 1], ['toy', 'おもちゃ（トンネル）', 15, 1], ['house', 'ふかふかハウス', 25, 1], ['new', '新しい子をお迎え', 30, 1]];
  // にんじんがもらえる生活の記録（1日1回ずつ）
  const REWARD = [['sleep', '睡眠を記録', 2], ['chk', '今日の3問', 2], ['meal', '食事を記録', 1], ['cash', '家計簿をつけた', 1], ['cook', '自炊した', 3], ['todo', 'やることを完了', 1], ['chore', '家事をした', 1], ['k6', '週のK6', 3]];
  let S = null, el = null, stageEl = null, sel = 0, timer = 0, walkT = 0, poseT = {};
  const fresh = () => ({ id:ID, rabbits:[], carrots:10, items:{ pellet:3, veg:2, med:0 }, toy:false, house:false, claimed:{}, log:[] });
  async function load() { if (!S) S = Object.assign(fresh(), await DB.get('settings', ID).catch(() => null) || {}); return S; }
  const save = () => DB.put('settings', S).catch(() => {});
  const clamp = v => Math.max(0, Math.min(100, v));
  const night = () => { const h = new Date().getHours(); return h < 6 || h >= 23; };

  // ===== 時間の経過（閉じていても進む） =====
  function tick(r, now = Date.now()) {
    let hrs = Math.min(72, (now - (r.at || now)) / 3600e3); r.at = now; if (hrs <= 0) return;
    const glut = r.pers === 'glut' ? 1.3 : 1, toy = S.toy ? .7 : 1, house = S.house ? .8 : 1;
    r.hunger = clamp(r.hunger - 4 * glut * hrs); r.clean = clamp(r.clean - 2.2 * hrs); r.mood = clamp(r.mood - 2.5 * toy * hrs);
    r.energy = clamp(r.energy + (night() ? 9 : 2) * house * hrs);
    if (r.clean < 40) r.poop = Math.min(6, (r.poop || 0) + Math.floor(hrs / 3));
    // ごはんか清潔が15を下回った時間がたまると、病気になる
    if (r.hunger < 15 || r.clean < 15) r.bad = (r.bad || 0) + hrs; else r.bad = Math.max(0, (r.bad || 0) - hrs / 2);
    if (!r.sick && r.bad >= 12) { r.sick = true; r.sickAt = Date.now(); S.log.unshift({ at:Date.now(), t:`${r.name}が具合を悪くした` }); }
    if (r.sick) r.mood = Math.min(r.mood, 35);
    if (r.stage === 'baby' && Date.now() - r.born > 7 * 86400e3 && r.bond >= 30) { r.stage = 'adult'; S.log.unshift({ at:Date.now(), t:`${r.name}が大人になった` }); }
  }
  function newRabbit(name, breed, pers) { return { id:newId(), name, breed, pers, stage:'baby', born:Date.now(), at:Date.now(), hunger:80, mood:80, clean:90, energy:80, bond:5, sick:false, poop:0, pets:{}, x:30 + Math.random() * 40 }; }

  // ===== 生活の記録 → にんじん =====
  async function earned() {
    const t = D.today(), td = await Life.day(), f = await Life.food(t), all = await DB.all('room').catch(() => []);
    const todos = (await DB.all('todos').catch(() => [])).filter(x => x.done && x.doneAt && D.key(new Date(x.doneAt)) === t).length;
    const ch = (await Life.chores()).filter(c => c.last === t).length, k6 = (await Life.checks()).k6[Life.k6Key(t)] != null;
    const has = { sleep:!!td.sleep, chk:!!td.chk, meal:Object.keys(f.meals || {}).length > 0, cash:all.some(r => r.id.startsWith('cash-') && r.date === t), cook:all.some(r => r.id.startsWith('cook-') && r.date === t), todo:Math.min(5, todos), chore:Math.min(3, ch), k6 };
    const cl = S.claimed[t] || {};
    return REWARD.map(([k, n, c]) => { const got = typeof has[k] === 'number' ? has[k] : has[k] ? 1 : 0, done = cl[k] || 0, key = k === 'k6' ? 'k6-' + Life.k6Key(t) : k; return { k, key, n, c, got, done:k === 'k6' ? (S.claimed[key] ? 1 : 0) : done }; });
  }
  async function harvest() {
    const t = D.today(), list = await earned(); let sum = 0; S.claimed[t] = S.claimed[t] || {};
    list.forEach(x => { const n = x.got - x.done; if (n > 0) { sum += n * x.c; if (x.k === 'k6') S.claimed[x.key] = 1; else S.claimed[t][x.k] = x.got; } });
    Object.keys(S.claimed).filter(k => /^\d{4}-/.test(k) && k < D.add(t, -14)).forEach(k => delete S.claimed[k]);
    S.carrots += sum; await save(); return sum;
  }

  // ===== 画面 =====
  function spriteOf(r) {
    if (poseT[r.id] && poseT[r.id].until > Date.now()) return poseT[r.id].p;
    if (night() || r.energy < 20) return 'sleep';
    if (r.sick) return 'sleep';
    if (r.hunger < 30 || r.clean < 30) return 'what';
    return r.walking ? 'hop' : 'sit';
  }
  function drawStage() {
    if (!stageEl) return;
    stageEl.innerHTML = S.rabbits.map((r, i) => {
      const sp = spriteOf(r), sz = (r.stage === 'baby' ? 24 : 33) * (sp === 'sleep' ? 1.25 : 1);
      return `<div class="rbb ${i === sel ? 'sel' : ''} ${r.sick ? 'sick' : ''} ${r.dir ? 'flip' : ''}" data-r="${i}" style="left:${r.x}%;width:${sz}%;--f:${BREED[r.breed][1]}"><img src="usagi_${sp}.webp" alt=""><span>${esc(r.name)}</span>${r.sick ? '<em>具合が悪い</em>' : ''}</div>`;
    }).join('') + Array.from({ length:Math.max(0, ...S.rabbits.map(r => r.poop || 0)) }, (_, k) => `<i class="rbp" style="left:${10 + (k * 37) % 80}%;bottom:${4 + (k * 13) % 14}%"></i>`).join('')
      + (S.toy ? '<div class="rbtoy"></div>' : '') + (S.house ? '<div class="rbhouse"></div>' : '');
  }
  const bar = (n, v, c) => `<div class="rbs"><small>${n}</small><b><i style="width:${v}%;background:${c}"></i></b><em>${Math.round(v)}</em></div>`;
  async function draw() {
    await load(); S.rabbits.forEach(r => tick(r)); save();
    $('rbWall').src = night() || new Date().getHours() >= 18 ? 'room_sofa_n.jpg' : 'room_sofa_d.jpg';
    stageEl = $('rbStage'); drawStage();
    const ui = $('rbUI'), r = S.rabbits[sel];
    if (!r) { ui.innerHTML = `<div class="rbcard first"><img class="mc" src="miyako_chibi.webp" alt=""><p>ここはRABBIT小隊の飼育ルームです。<br>先生、一緒にウサギを育てませんか？</p><button class="rbgo" data-a="adopt">お迎えする</button></div>`; return; }
    const age = Math.floor((Date.now() - r.born) / 86400e3), ear = await earned(), can = ear.reduce((a, x) => a + Math.max(0, x.got - x.done) * x.c, 0);
    ui.innerHTML = `<div class="rbtop"><div class="rbname"><b>${esc(r.name)}</b><span>${BREED[r.breed][0]}・${PERS[r.pers]}・${r.stage === 'baby' ? '子ども' : '大人'}・${age}日目</span></div>
        <div class="rbcar"><i></i><b>${S.carrots}</b></div></div>
      ${S.rabbits.length > 1 ? `<div class="rbtabs">${S.rabbits.map((x, i) => `<button data-sel="${i}" class="${i === sel ? 'on' : ''}">${esc(x.name)}</button>`).join('')}</div>` : ''}
      <div class="rbcard">${bar('おなか', r.hunger, '#ffb26b')}${bar('きげん', r.mood, '#ff8fb6')}${bar('きれい', r.clean, '#7cc4ff')}${bar('げんき', r.energy, '#8fd6b4')}${bar('なつき', r.bond, '#c9a7ff')}
        ${r.sick ? `<p class="rbwarn">具合が悪いみたいです。お薬で治してあげてください（お薬 ${S.items.med || 0}個）</p>` : ''}</div>
      <div class="rbact">
        <button data-a="hay"><b>牧草</b><small>いつでも</small></button><button data-a="pellet"><b>ペレット</b><small>のこり${S.items.pellet || 0}</small></button><button data-a="veg"><b>野菜</b><small>のこり${S.items.veg || 0}</small></button>
        <button data-a="clean"><b>そうじ</b><small>${r.poop ? 'フン' + r.poop : 'きれい'}</small></button><button data-a="brush"><b>ブラシ</b><small>毛並み</small></button><button data-a="play"><b>あそぶ</b><small>げんき−15</small></button>
        ${r.sick ? '<button data-a="med" class="hot"><b>お薬</b><small>治療する</small></button>' : '<button data-a="check"><b>健康チェック</b><small>ミヤコ</small></button>'}
        <button data-a="shop"><b>おみせ</b><small>にんじん</small></button><button data-a="harvest" class="${can ? 'hot' : ''}"><b>しゅうかく</b><small>${can ? '+' + can : '生活の記録で'}</small></button></div>
      <p class="rbhint">ウサギをなでると、なつきます（1日10回まで）</p>`;
  }
  function pose(r, p, ms = 1600) { poseT[r.id] = { p, until:Date.now() + ms }; drawStage(); setTimeout(drawStage, ms + 30); }
  function hearts(i) {
    const b = stageEl.querySelector(`[data-r="${i}"]`); if (!b) return;
    for (let k = 0; k < 5; k++) { const hh = document.createElement('i'); hh.className = 'rbh'; hh.style.left = (30 + Math.random() * 40) + '%'; hh.style.animationDelay = k * .08 + 's'; b.appendChild(hh); setTimeout(() => hh.remove(), 1300); }
  }
  async function act(a) {
    const r = S.rabbits[sel];
    if (a === 'adopt') return adopt();
    if (!r) return;
    if (a === 'shop') return shop();
    if (a === 'harvest') { const n = await harvest(); if (!n) toast('今日の記録で、まだもらえるにんじんはありません。睡眠や食事を記録してみて', 3000); else { toast(`にんじん +${n}`); sfx(1); } return draw(); }
    if (a === 'check') return check(r);
    if (night() && ['play', 'brush'].includes(a)) return toast(`${r.name}は寝ています。そっとしておこう`);
    const F = {
      hay:() => { r.hunger = clamp(r.hunger + 22); r.mood = clamp(r.mood + 2); pose(r, 'sit'); },
      pellet:() => { if (!(S.items.pellet > 0)) return toast('ペレットがありません（おみせで買えます）'), false; S.items.pellet--; r.hunger = clamp(r.hunger + 38); r.mood = clamp(r.mood + 6); pose(r, 'happy'); },
      veg:() => { if (!(S.items.veg > 0)) return toast('野菜がありません（おみせで買えます）'), false; S.items.veg--; r.hunger = clamp(r.hunger + 20); r.mood = clamp(r.mood + 15); r.bond = clamp(r.bond + 1); pose(r, 'happy'); },
      clean:() => { r.clean = 100; r.poop = 0; r.mood = clamp(r.mood + 4); pose(r, 'happy', 1000); },
      brush:() => { r.clean = clamp(r.clean + 10); r.mood = clamp(r.mood + 8); r.bond = clamp(r.bond + (r.pers === 'shy' ? 1 : 2)); pose(r, 'happy'); },
      play:() => { if (r.energy < 15) return toast(`${r.name}は疲れているみたい`), false; r.energy = clamp(r.energy - 15); r.mood = clamp(r.mood + (r.pers === 'play' ? 28 : 18)); r.bond = clamp(r.bond + 2); hop(r); },
      med:() => { if (!(S.items.med > 0)) return toast('お薬がありません（おみせで買えます）'), false; S.items.med--; r.sick = false; r.bad = 0; r.mood = clamp(r.mood + 20); pose(r, 'happy', 2000); Talk.say('miyako', [`${r.name}、元気になりました`, '……先生。次は、こうならないように気をつけましょう']).then(Talk.close); },
    };
    haptic(); if (F[a]() === false) return; sfx(0); hearts(sel); await save(); draw();
  }
  function hop(r) { r.walking = true; const to = 12 + Math.random() * 70; r.dir = to < r.x; r.x = to; pose(r, 'hop', 900); setTimeout(() => { r.walking = false; drawStage(); }, 950); }
  async function pet(i) {
    const r = S.rabbits[i]; sel = i; const t = D.today(); r.pets = r.pets || {};
    if ((r.pets[t] || 0) >= 10) { pose(r, 'what', 900); return; }
    r.pets = { [t]:(r.pets[t] || 0) + 1 };
    r.bond = clamp(r.bond + (r.pers === 'shy' ? .5 : 1)); r.mood = clamp(r.mood + 5);
    haptic(); hearts(i); pose(r, night() ? 'sleep' : 'happy', 1200); await save(); draw();
  }
  async function check(r) {
    const L = [];
    L.push(r.sick ? `${r.name}は具合が悪いです。お薬が必要です` : `${r.name}の健康状態、異常ありません`);
    if (r.hunger < 40) L.push('おなかが空いています。牧草かペレットを'); if (r.clean < 40) L.push('ケージが汚れています。そうじをお願いします'); if (r.mood < 40) L.push('少し退屈そうです。遊んであげてください');
    if (r.stage === 'baby') L.push(`大人になるまで：${Math.max(0, 7 - Math.floor((Date.now() - r.born) / 86400e3))}日、なつき${Math.max(0, 30 - Math.round(r.bond))}`);
    L.push('……先生の生活の記録が、この子のにんじんになります。先生も、ちゃんと寝てくださいね');
    await Talk.say('miyako', L); Talk.close();
  }
  async function adopt() {
    const name = await Talk.ask('miyako', S.rabbits.length ? '新しい子を迎えます。名前を決めてください' : '先生、この子の名前を決めてください', { ph:'例：もち', chips:['もち', 'しろ', 'うさまる'] });
    if (!name) return Talk.close();
    const breed = await Talk.choose('miyako', '品種はどうしますか？', Object.entries(BREED).map(([k, [n]]) => ({ label:n, v:k })));
    const pers = Object.keys(PERS)[Math.floor(Math.random() * 4)];
    S.rabbits.push(newRabbit(name.slice(0, 8), breed, pers)); sel = S.rabbits.length - 1; await save(); draw();
    await Talk.say('miyako', [`「${name}」、確認しました。性格は……${PERS[pers]}みたいです`, 'ごはん・そうじ・なでなで。毎日少しずつで大丈夫です', '放っておくと病気になります。……でも、ちゃんと治せますから'], 'smile'); Talk.close();
  }
  function shop() {
    Menu.open(`おみせ（にんじん ${S.carrots}本）`, SHOP.filter(([k]) => !(k === 'toy' && S.toy) && !(k === 'house' && S.house) && !(k === 'new' && S.rabbits.length >= 3)).map(([k, n, c, q]) => ({ label:`${n}　にんじん${c}本`, sub:k === 'new' ? 'いまいる子のなつきが全員60以上で、お迎えできます' : k === 'toy' ? 'きげんが下がりにくくなります' : k === 'house' ? '夜によく眠れて、げんきが回復しやすくなります' : '',
      fn:async () => {
        if (S.carrots < c) return toast('にんじんが足りません。生活の記録で増やせます');
        if (k === 'new') { if (S.rabbits.some(r => r.bond < 60)) return toast('いまいる子のなつきが、全員60以上になってから'); S.carrots -= c; await save(); return adopt(); }
        S.carrots -= c; if (k === 'toy') S.toy = true; else if (k === 'house') S.house = true; else S.items[k] = (S.items[k] || 0) + q;
        sfx(1); await save(); draw(); toast(`${n}を買いました`);
      } })));
  }
  function sfx(k) { try { const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(k ? 1320 : 990, t); o.frequency.exponentialRampToValueAtTime(k ? 1980 : 1180, t + .08); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.14, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + .2); o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + .22); } catch (e) {} }
  // ときどき勝手に動く
  function wander() {
    clearTimeout(walkT); if (tab !== 'rabbit') return;
    const awake = S.rabbits.filter(r => !night() && r.energy >= 20 && !r.sick);
    if (awake.length) hop(awake[Math.floor(Math.random() * awake.length)]);
    walkT = setTimeout(wander, 3500 + Math.random() * 4000);
  }
  function init() {
    $('page-rabbit').addEventListener('click', e => {
      const b = e.target.closest('[data-a]'); if (b) return act(b.dataset.a);
      const s = e.target.closest('[data-sel]'); if (s) { haptic(); sel = +s.dataset.sel; return draw(); }
      const r = e.target.closest('[data-r]'); if (r) return pet(+r.dataset.r);
    });
    TabHooks.rabbit = { enter:() => { draw(); clearInterval(timer); timer = setInterval(() => { if (tab === 'rabbit') draw(); }, 60e3); walkT = setTimeout(wander, 2500); }, leave:() => { clearInterval(timer); clearTimeout(walkT); } };
  }
  return {
    init, reload:() => { S = null; if (tab === 'rabbit') draw(); },
    async brief() { await load(); S.rabbits.forEach(r => tick(r)); return S.rabbits.length ? S.rabbits.map(r => `${r.name}（${r.sick ? '病気' : 'げんき'}・おなか${Math.round(r.hunger)}）`).join('、') + `／にんじん${S.carrots}本` : null; },
    async doorBadge() { await load(); S.rabbits.forEach(r => tick(r)); const r = S.rabbits.find(x => x.sick || x.hunger < 30); return r ? `<i>${esc(r.name)}${r.sick ? '具合悪い' : 'おなか空いた'}</i>` : ''; },
    async importSeed(d) { await load(); Object.assign(S, d); await save(); },
  };
})();
App.modules.push(Rabbit);
