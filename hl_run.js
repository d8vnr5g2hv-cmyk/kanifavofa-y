// HALO LINK（Card Shop 版）— 保存・自作カードの読み込み・挑戦（マップ・事件・休憩・報酬・精算）
'use strict';
const HL = (() => {
  const KEY = 'hl-save-v1';
  const DEF = () => ({ team:['hoshino', 'noa', 'mika'], cleared:[], hard:[], badge:0, passive:{}, run:null, best:{} });
  let save = DEF();
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s) save = Object.assign(DEF(), s); } catch (e) {}
  const put = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {} };
  // 自作カード（u_ + id）と基本カード
  const map = {}; YCard.BASIC.forEach(c => map[c.id] = c);
  let mine = [];
  async function load() {
    try { mine = await YCard.all(); } catch (e) { mine = []; }
    mine.forEach(c => map['u_' + c.id] = c);
    return mine;
  }
  const card = id => map[id] || null;
  function stageMod(run) {
    const st = STAGES[run.stage - 1], hd = run.hard;
    return { hp:st.hp * (hd ? HARD.hp : 1), atk:st.atk * (hd ? HARD.atk : 1), count:Math.max(2, st.count + (hd ? HARD.count : 0)) };
  }
  // デッキ：ショーケースで組んだもの（無いカードは外す）
  function deck() { return YCard.deck().filter(id => map[id]); }
  return { get save() { return save; }, put, load, card, stageMod, deck, mine:() => mine, reset() { save = DEF(); put(); } };
})();

const Run = (() => {
  const rnd = n => Math.floor(Math.random() * n);
  const pick = a => a[rnd(a.length)];
  const cur = () => HL.save.run;

  function makeMap() {
    const map = [];
    for (let l = 0; l < LAYERS; l++) {
      if (l === LAYERS - 1) { map.push([{type:'boss'}]); continue; }
      const n = l === 0 ? 2 : 2 + rnd(2), row = [];
      for (let i = 0; i < n; i++) {
        let t = 'battle'; const r = Math.random();
        if (l === 0) t = 'battle';
        else if (l === LAYERS - 2) t = r < .5 ? 'rest' : 'elite';
        else if (r < .18) t = 'event'; else if (r < .3) t = 'rest'; else if (r < .52 && l >= 2) t = 'elite';
        row.push({type:t});
      }
      map.push(row);
    }
    return map;
  }
  function begin(stage, hard) {
    const s = HL.save, ids = s.team.slice(0, 3), d = HL.deck();
    if (d.length < YCard.DECK.min) { toast(`デッキが${YCard.DECK.min}枚に足りません（ショーケースで組めます）`); return; }
    s.run = { stage, hard:!!hard, layer:-1, pos:null, map:makeMap(), deck:d, badge:0, turns:0, downs:0, cleared:0,
              party:ids.map(id => ({id, hp:PARTY_DEF[id].hp, max:PARTY_DEF[id].hp, ex:0})) };
    HL.put();
    UI.go('map');
  }

  // ---------- 敵の組み合わせ（層が深いほど多く・強く） ----------
  function encounter(type, layer) {
    const r = cur(), st = STAGES[r.stage - 1], pool = st.pool;
    const one = (hard) => { const sp = hard ? pool[pool.length - 1 - rnd(Math.min(2, pool.length))] : pick(pool); return `${SPECIES[sp].k}_${'abc'[rnd(3)]}`; };
    if (type === 'boss') return r.stage >= 5 ? [one(false), st.boss] : [st.boss];
    if (type === 'elite') return layer >= 5 ? [one(true), one(true)] : [one(true)];
    const n = layer < 2 ? 1 + rnd(2) : layer < 4 ? 2 : 2 + rnd(2);
    return Array.from({length:n}, () => one(false));
  }

  // ---------- マップ ----------
  const ICON = {battle:'⚔', elite:'☠', event:'？', rest:'✚', boss:'♛'};
  const LABEL = {battle:'戦闘', elite:'強敵', event:'事件', rest:'休憩', boss:'ボス'};
  function paintMap() {
    const r = cur(); if (!r) return;
    $('mDiff').textContent = `STAGE ${r.stage}${r.hard ? ' HARD' : ''}`;
    $('mBadge').textContent = r.badge;
    $('mDeck').textContent = r.deck.length;
    $('mParty').innerHTML = r.party.map(m => `<div class="mp ${m.hp <= 0 ? 'down' : ''}"><img src="hl_ic_${m.id}.webp" alt=""><i><i style="transform:scaleX(${m.hp / m.max})"></i></i><span>${m.hp}/${m.max}</span></div>`).join('');
    const next = r.layer + 1;
    $('mMap').innerHTML = r.map.map((row, l) => `<div class="mrow ${l === next ? 'next' : l < next ? 'past' : ''}" data-l="${l}">${row.map((n, i) => {
      const can = l === next && (r.pos == null || Math.abs(i / Math.max(1, row.length - 1) - r.pos) <= .6 || row.length === 1);
      const here = l === r.layer && Math.abs((row.length === 1 ? .5 : i / Math.max(1, row.length - 1)) - r.pos) < .01;
      const bimg = n.type === 'boss' ? `<img class="mn-boss" src="${ENEMIES[STAGES[r.stage - 1].boss].img}.webp" alt="">` : '';
      return `<button class="mn t-${n.type} ${can ? 'can' : ''} ${here ? 'here' : ''} ${n.done ? 'done' : ''}" data-l="${l}" data-i="${i}" ${can ? '' : 'disabled'}>${bimg}<b>${ICON[n.type]}</b><small>${LABEL[n.type]}</small></button>`;
    }).join('')}</div>`).reverse().join('');
    requestAnimationFrame(() => { const el = $('mMap').querySelector('.mrow.next'); if (el) el.scrollIntoView({block:'center'}); });
  }
  function onNode(l, i) {
    const r = cur(), row = r.map[l], n = row[i];
    r.layer = l; r.pos = row.length === 1 ? .5 : i / (row.length - 1); r.node = n; n.done = true; HL.put();
    Sfx.play('ok');
    if (n.type === 'battle' || n.type === 'elite' || n.type === 'boss') {
      const enc = encounter(n.type, l);
      UI.go('battle', () => Battle.start(enc, r, win => afterBattle(win, n.type)));
    } else if (n.type === 'rest') rest();
    else event();
  }

  // ---------- 戦闘のあと ----------
  async function afterBattle(win, type) {
    const r = cur();
    if (!win) { finish(false); return; }
    r.cleared++;
    r.badge += type === 'boss' ? 0 : type === 'elite' ? 4 : 2;
    HL.put();
    if (type === 'boss') { finish(true); return; }
    await cardReward(type === 'elite' ? 4 : 1);
    UI.go('map');
  }
  // 報酬：自分で作ったカード（と基本カード）から3枚。強敵のあとはランクの高いカードが出やすい
  function rewardPool(minRank) {
    const mine = HL.mine().map(c => 'u_' + c.id).filter(id => (HL.card(id).rank || 1) >= (minRank || 1));
    return mine.length >= 3 || minRank ? mine : mine.concat(YCard.BASIC.map(c => c.id));
  }
  function cardReward(weightRare) {
    return new Promise(res => {
      const pool = rewardPool(), opts = [];
      for (let k = 0; k < 3 && pool.length; k++) {
        const w = pool.flatMap(id => { const c = HL.card(id); return Array(c.rank >= 3 ? weightRare : c.rank === 2 ? 2 : 1).fill(id); });
        const id = pick(w); opts.push(id); pool.splice(pool.indexOf(id), 1);
      }
      const ov = $('rv');
      ov.innerHTML = `<div class="rv-box"><h3>REWARD</h3><p>デッキに加えるカードを1枚選ぶ（この挑戦のあいだだけ）</p><div class="rv-cards">${opts.map(id => `<div class="rv-c" data-pick="${id}">${YCard.html(HL.card(id))}</div>`).join('')}</div>
        <button class="btn sub" id="rvSkip">選ばない</button></div>`;
      ov.className = 'on';
      ov.querySelector('.rv-cards').onclick = e => { const c = e.target.closest('[data-pick]'); if (!c) return; cur().deck.push(c.dataset.pick); HL.put(); Sfx.play('ok'); toast(`${HL.card(c.dataset.pick).name} をデッキに入れました`); ov.className = ''; res(); };
      $('rvSkip').onclick = () => { ov.className = ''; Sfx.play('back'); res(); };
    });
  }

  // ---------- 休憩 ----------
  function rest() {
    const r = cur(), ov = $('rv');
    ov.innerHTML = `<div class="rv-box rest"><h3>REST</h3><p>ひと休みしよう</p>
      <button class="rv-opt" data-o="heal"><b>回復する</b><small>全員のHPを最大の25%回復</small></button>
      <button class="rv-opt" data-o="revive"><b>起こす</b><small>倒れた子をHP40%で復活（いなければ全員HP+5）</small></button>
      <button class="rv-opt" data-o="remove"><b>カードを外す</b><small>この挑戦のデッキからカードを1枚取り除く</small></button></div>`;
    ov.className = 'on';
    ov.onclick = async e => {
      const b = e.target.closest('[data-o]'); if (!b) return; ov.onclick = null;
      const o = b.dataset.o;
      if (o === 'heal') r.party.forEach(m => { if (m.hp > 0) m.hp = Math.min(m.max, m.hp + Math.ceil(m.max * .25)); });
      if (o === 'revive') { const dn = r.party.filter(m => m.hp <= 0); if (dn.length) dn.forEach(m => m.hp = Math.ceil(m.max * .4)); else r.party.forEach(m => m.hp = Math.min(m.max, m.hp + 5)); }
      Sfx.play('heal'); ov.className = ''; HL.put();
      if (o === 'remove') await removeCard();
      UI.go('map'); paintMap();
    };
  }
  function removeCard() {
    return new Promise(res => {
      const r = cur(), ov = $('rv'), cnt = {};
      r.deck.forEach(id => cnt[id] = (cnt[id] || 0) + 1);
      ov.innerHTML = `<div class="rv-box"><h3>REMOVE</h3><p>外すカードを選ぶ</p><div class="rv-grid">${Object.keys(cnt).map(id => `<div class="rv-c" data-pick="${id}">${YCard.html(HL.card(id), {n:cnt[id], still:true})}</div>`).join('')}</div><button class="btn sub" id="rvSkip">やめる</button></div>`;
      ov.className = 'on';
      ov.querySelector('.rv-grid').onclick = e => { const c = e.target.closest('[data-pick]'); if (!c) return; r.deck.splice(r.deck.indexOf(c.dataset.pick), 1); HL.put(); Sfx.play('back'); ov.className = ''; res(true); };
      $('rvSkip').onclick = () => { ov.className = ''; res(false); };
    });
  }

  // ---------- 事件 ----------
  function event() {
    const r = cur(), ev = pick(EVENTS), ov = $('rv');
    ov.innerHTML = `<div class="rv-box ev"><h3>EVENT</h3><b class="ev-n">${ev.n}</b><p>${ev.txt}</p>${ev.opts.map((o, i) => `<button class="rv-opt" data-o="${i}"><b>${o.t}</b></button>`).join('')}</div>`;
    ov.className = 'on';
    ov.onclick = async e => {
      const b = e.target.closest('[data-o]'); if (!b) return; ov.onclick = null;
      const fx = ev.opts[+b.dataset.o].fx; ov.className = '';
      if (fx === 'healAll10') { r.party.forEach(m => { if (m.hp > 0) m.hp = Math.min(m.max, m.hp + 10); }); Sfx.play('heal'); }
      if (fx === 'badge3') { r.badge += 3; Sfx.play('ok'); }
      if (fx === 'maxhp4') { r.party.forEach(m => { m.max += 4; if (m.hp > 0) m.hp += 4; }); Sfx.play('ok'); }
      if (fx === 'card') { HL.put(); await cardReward(3); }
      if (fx === 'gamble') {
        if (Math.random() < .5) { const pool = rewardPool(3); if (pool.length) { const id = pick(pool); r.deck.push(id); toast(`${HL.card(id).name} を手に入れた！`); Sfx.play('rare', 3); } else { r.badge += 5; toast('記章+5'); } }
        else { const f = r.party.find(m => m.hp > 0); if (f) f.hp = Math.max(1, f.hp - 10); toast('罠だった……前列が10ダメージ'); Sfx.play('enemy'); }
      }
      if (fx === 'remove5') { if (r.badge >= 5) { if (await removeCard()) r.badge -= 5; } else toast('記章が足りません'); }
      if (fx === 'clean') { if (await removeCard()) { const f = r.party.find(m => m.hp > 0); if (f) f.hp = Math.max(1, f.hp - 5); } }
      HL.put(); UI.go('map'); paintMap();
    };
  }

  // ---------- 終わり（クリア・全滅・精算） ----------
  function finish(win, settled) {
    const s = HL.save, r = cur(), first = win && !(r.hard ? s.hard : s.cleared).includes(r.stage);
    let rank = '', badge = r.badge;
    if (win) {
      rank = r.downs === 0 && r.turns <= 45 ? 'S' : r.downs <= 1 ? 'A' : 'B';
      badge += (6 + r.stage * 2) * (r.hard ? 2 : 1) * (rank === 'S' ? 2 : rank === 'A' ? 1.5 : 1) + (first ? 10 : 0);
      const list = r.hard ? s.hard : s.cleared; if (!list.includes(r.stage)) list.push(r.stage);
      const key = (r.hard ? 'h' : 'n') + r.stage; if (!s.best[key] || 'SAB'.indexOf(rank) < 'SAB'.indexOf(s.best[key])) s.best[key] = rank;
    } else if (!settled) badge = Math.floor(badge * .5);
    badge = Math.round(badge);
    s.badge = (s.badge || 0) + badge;
    s.run = null; HL.put();
    UI.runResult({win, settled, rank, badge, first, stage:r.stage, hard:r.hard});
  }
  function settle() { if (!cur()) return; finish(false, true); }
  function menu() {
    const ov = $('rv');
    ov.innerHTML = `<div class="rv-box"><h3>MENU</h3><button class="rv-opt" data-o="back"><b>戦闘に戻る</b></button><button class="rv-opt" data-o="settle"><b>精算して終わる</b><small>ここまでの記章を受け取って挑戦を終える</small></button></div>`;
    ov.className = 'on';
    ov.onclick = e => { const b = e.target.closest('[data-o]'); if (!b) return; ov.onclick = null; ov.className = ''; if (b.dataset.o === 'settle') settle(); };
  }

  function init() {
    $('mMap').addEventListener('click', e => { const b = e.target.closest('.mn.can'); if (b) onNode(+b.dataset.l, +b.dataset.i); });
    $('mSettle').onclick = () => { const n = Date.now(); if (n - (init.t || 0) < 2000) settle(); else { init.t = n; toast('もう一度押すと精算して終わります'); } };
    $('mDeckBtn').onclick = () => {
      const r = cur(), cnt = {}; r.deck.forEach(id => cnt[id] = (cnt[id] || 0) + 1);
      const ov = $('rv'); ov.innerHTML = `<div class="rv-box"><h3>DECK</h3><p>${r.deck.length}枚</p><div class="rv-grid">${Object.keys(cnt).map(id => `<div class="rv-c">${YCard.html(HL.card(id), {n:cnt[id], still:true})}</div>`).join('')}</div><button class="btn sub" id="rvSkip">閉じる</button></div>`;
      ov.className = 'on'; $('rvSkip').onclick = () => ov.className = '';
    };
  }
  return { init, begin, paintMap, settle, menu, cur };
})();
