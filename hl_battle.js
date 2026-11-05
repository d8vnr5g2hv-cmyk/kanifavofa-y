// HALO LINK（Card Shop 版）— バトル
// 3人パーティ（前列が攻撃を受ける・交代・EX）、自作カードの効果、敵の妨害（散らかり・エネルギー減・毒）、ボスのシールド・カウント・第2形態・激怒
'use strict';
const Battle = (() => {
  let B = null, uid = 0;
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const has = id => HL.save.passive && HL.save.passive[id];
  const cardOf = id => id === 'x_junk' ? JUNK : HL.card(id);

  // ---------- 開始：enc＝敵の並び、run＝挑戦中の状態、done＝終わったら呼ぶ ----------
  function start(enc, run, done) {
    const sg = HL.stageMod(run);
    B = { run, sg, done, enemies:[], block:0, energy:3, maxE:3, st:{weak:0, vuln:0}, atkup:[], pp:0, drain:0,
          draw:shuffle(run.deck.filter(id => cardOf(id)).map(id => ({id, u:++uid}))), hand:[], disc:[], chain:0, turn:0, busy:true, sel:null, target:null, swapFree:true };
    B.enemies = enc.map((k, i) => {
      const e = ENEMIES[k], hp = Math.round(e.hp * sg.hp * (run.node && run.node.type === 'elite' ? 1.45 : 1)), sh = Math.round((e.shield || 0) * sg.hp);
      return {...e, key:k, i, hp, max:hp, block:0, shield:sh, maxShield:sh, st:{str:run.node && run.node.type === 'elite' ? 1 : 0, weak:null, vuln:0, poison:[]},
              step:0, broken:0, cntDmg:e.cnt || 0, cnt:e.boss ? sg.count : 0, p2:false, el:null};
    });
    $('bStage').textContent = `STAGE ${run.stage}${run.hard ? ' HARD' : ''}　${run.layer + 1}層`;
    $('bWave').textContent = run.node.type === 'boss' ? 'BOSS' : run.node.type === 'elite' ? 'ELITE' : 'BATTLE';
    buildEnemies(); buildParty(); paintAll();
    begin();
  }
  async function begin() {
    const boss = B.enemies.some(e => e.boss);
    await banner(boss ? 'WARNING' : 'BATTLE START', boss);
    if (has('p_block')) gainBlock(6);
    if (has('p_ex')) B.run.party.forEach(m => m.ex = Math.min(EX_GAUGE, m.ex + 1));
    paintParty();
    startTurn();
  }
  const mem = id => B.run.party.find(m => m.id === id);
  const alivePt = () => B.run.party.filter(m => m.hp > 0);
  const front = () => B.run.party[0];
  // カードを使う子：その子が編成にいればその子、いなければ前列の子
  function actorOf(c) { const m = mem(c.who); return m || front(); }
  function attrOf(c) { const w = YCard.WHO[c.who]; return w ? w.attr : 'none'; }
  const upRate = () => 1 + B.atkup.reduce((a, x) => a + x.v, 0) / 100;

  // ---------- 自分のターン ----------
  async function startTurn() {
    B.turn++; B.busy = true; B.block = 0; B.chain = 0; B.swapFree = true;
    B.energy = Math.max(1, B.maxE + (B.turn === 1 && has('p_cost') ? 1 : 0) - B.drain);
    if (B.drain) { floatText($('bEnergy'), `エネルギー-${B.drain}`, '#ff8fa3', 'st'); B.drain = 0; }
    B.enemies.forEach(e => { if (e.hp > 0) e.intent = e.pat[e.step % e.pat.length]; });
    paintEnemies(); paintStatus(); paintParty();
    $('bEnd').classList.remove('on');
    await turnBanner('YOUR TURN');
    // こちらの毒（前列が受ける）
    if (B.pp > 0 && front().hp > 0) { hitMember(front(), B.pp, true); B.pp--; paintStatus(); await sleep(300); if (!alivePt().length) return lose(); }
    await drawCards(5);
    B.busy = false; paintHand(); $('bEnd').classList.add('on');
  }
  async function drawCards(n) {
    for (let i = 0; i < n; i++) {
      if (!B.draw.length) { if (!B.disc.length) break; B.draw = shuffle(B.disc); B.disc = []; }
      if (B.hand.length >= 10) break;
      B.hand.push(B.draw.pop()); Sfx.play('draw'); paintHand(true); await sleep(80);
    }
    paintPiles();
  }

  // ---------- 倍率 ----------
  function synergy(ch) {
    const t = PARTY_DEF[ch] && PARTY_DEF[ch].tag; if (!t) return 1;
    const n = alivePt().filter(m => PARTY_DEF[m.id].tag === t).length;
    return n >= 3 ? 1.3 : n === 2 ? 1.15 : 1;
  }
  function mults(ch, attr, e) {
    const list = [];
    if (STRONG[attr] === e.attr) list.push(['属性', 1.5]); else if (STRONG[e.attr] === attr && !['light', 'dark'].includes(attr)) list.push(['属性', .75]);
    if (B.chain > 1) list.push(['連携', +(1 + (B.chain - 1) * (has('p_chain') ? .15 : .1)).toFixed(2)]);
    const sy = synergy(ch); if (sy > 1) list.push(['シナジー', sy]);
    const up = upRate(); if (up > 1) list.push(['攻撃UP', +up.toFixed(2)]);
    if (e.broken) list.push(['BREAK', 1.5]);
    if (e.st.vuln) list.push(['脆弱', 1.5]);
    if (B.st.weak) list.push(['弱体', .75]);
    return list;
  }

  // ---------- カードを使う ----------
  async function play(u, targetEnemy) {
    const k = B.hand.findIndex(x => x.u === u); if (k < 0) return;
    const c = cardOf(B.hand[k].id), m = actorOf(c);
    if (mem(c.who) && mem(c.who).hp <= 0) { toast(`${CHARS[c.who].n}は戦闘不能です`); Sfx.play('back'); return; }
    if (c.cost > B.energy) { toast('エネルギーが足りません'); Sfx.play('back'); return; }
    B.busy = true; B.sel = null; closePreview();
    const tg = targetEnemy && targetEnemy.hp > 0 ? targetEnemy : pickTarget();
    B.energy -= c.cost;
    const [it] = B.hand.splice(k, 1);
    if (c.junk) {   // 散らかり：何も起きずに消える
      Sfx.play('back'); toast('散らかりを片付けた'); paintHand(); paintStatus(); paintPiles();
      if (has('p_clean')) await drawCards(1);
      B.busy = false; paintHand(); return;
    }
    B.chain++;
    actor(m.id, 'aim');
    await flyCard(it, c, tg);
    paintHand(); paintStatus();
    await applyFx(c.fx, tg, m.id, attrOf(c));
    m.ex = Math.min(EX_GAUGE, m.ex + 1); paintParty();
    B.disc.push(it); paintPiles();
    if (await checkEnd()) return;
    B.busy = false; paintHand();
  }
  async function applyFx(fx, tg, ch, attr) {
    for (const f of fx || []) {
      const one = () => tg && tg.hp > 0 ? tg : pickTarget();
      if (f.k === 'dmg') for (let i = 0; i < (f.n || 1); i++) {
        if (f.all) { const al = aliveE(); al.forEach((e, j) => hitEnemy(e, f.v, ch, attr, i === 0 && j === 0)); await sleep(260); }
        else { const t = one(); if (!t) break; hitEnemy(t, f.v, ch, attr, i === 0); await sleep(140); }
      }
      if (f.k === 'heal') { if (f.all) alivePt().forEach(m => healMem(m, f.v)); else { const al = alivePt(); if (al.length) healMem(al.slice().sort((a, b) => a.hp / a.max - b.hp / b.max)[0], f.v); } Sfx.play('heal'); paintParty(); }
      if (f.k === 'guard') gainBlock(f.v);
      if (f.k === 'atkup') { B.atkup.push({v:f.v, t:f.t}); floatText(memEl(ch), `攻撃+${f.v}%`, '#ffb24a', 'st'); }
      if (f.k === 'weak' || f.k === 'vuln' || f.k === 'poison') (f.all ? aliveE() : [one()].filter(Boolean)).forEach(e => addSt(e, f));
      if (f.k === 'draw') await drawCards(f.v);
      if (f.k === 'redraw') { B.disc.push(...B.hand); B.hand = []; paintHand(); await drawCards(f.v); }
      if (f.k === 'energy') { B.energy += f.v; pulse($('bEnergy')); floatText($('bEnergy'), `+${f.v}`, '#5ff2ff', 'st'); }
      paintStatus(); paintEnemies(); await sleep(70);
    }
  }
  function healMem(m, v) { const x = Math.min(m.max - m.hp, v); m.hp += x; floatText(memEl(m.id), `+${x}`, '#7dffb0'); }
  function hitEnemy(e, base, ch, attr, showMult) {
    if (e.hp <= 0) return;
    const list = mults(ch, attr, e);
    let v = base; list.forEach(([, x]) => v *= x); v = Math.max(0, Math.floor(v));
    const img = e.el.querySelector('.e-img');
    if (showMult && list.length) multStack(img, list);
    // シールド → ガード → HP の順に削る
    let left = v;
    if (e.shield > 0) { const u = Math.min(e.shield, left); e.shield -= u; left -= u; if (e.shield <= 0) breakEnemy(e); }
    if (left > 0 && e.block) { const u = Math.min(e.block, left); e.block -= u; left -= u; }
    e.hp = Math.max(0, e.hp - left);
    const r = img.getBoundingClientRect(); slash(r, ATTR[attr].c);
    e.el.classList.remove('hit'); void e.el.offsetWidth; e.el.classList.add('hit');
    const total = list.reduce((a, [, x]) => a * x, 1);
    floatText(img, v, total >= 1.5 ? '#ffd76a' : ATTR[attr].c, total >= 1.5 ? 'big' : '');
    Sfx.play('hit'); vib(10);
    if (e.hp <= 0) kill(e); else if (e.boss && !e.p2 && e.hp <= e.max / 2) phase2(e);
    paintEnemies();
  }
  // ボスの第2形態：力+3、弱体と脆弱が消え、シールドが半分もどる
  function phase2(e) {
    e.p2 = true; e.st.str += 3; e.st.weak = null; e.st.vuln = 0; e.broken = 0; e.el.classList.remove('broken');
    e.maxShield = Math.round(e.maxShield * .6); e.shield = e.maxShield; e.cnt = Math.min(e.cnt, B.sg.count);
    e.el.classList.add('p2'); floatText(e.el.querySelector('.e-img'), '第2形態', '#ff5a6e', 'big');
    banner('PHASE 2', true); Sfx.play('warn'); vib(50);
  }
  function breakEnemy(e) {
    e.broken = 2; e.cnt = e.boss ? B.sg.count + 1 : 0;
    floatText(e.el.querySelector('.e-img'), 'BREAK!', '#5ff2ff', 'big');
    Sfx.play('rare', 3); vib(40);
    e.el.classList.add('broken');
  }
  function kill(e) {
    e.el.classList.add('dead');
    const r = e.el.querySelector('.e-img').getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, ATTR[e.attr].c, 24, 120);
    if (B.target === e) B.target = null;
  }
  function multStack(el, list) {
    const r = el.getBoundingClientRect(), box = document.createElement('div');
    box.className = 'mstack';
    box.innerHTML = list.map(([n, x], i) => `<span class="${x < 1 ? 'down' : ''}" style="animation-delay:${i * 90}ms">${n}<b>×${x}</b></span>`).join('');
    box.style.left = (r.left + r.width / 2) + 'px'; box.style.top = (r.top + r.height * .1) + 'px';
    document.body.appendChild(box); setTimeout(() => box.remove(), 1300);
  }
  function gainBlock(v) { B.block += v; Sfx.play('guard'); floatText(memEl(front().id), `ガード+${v}`, '#7cc4ff', 'st'); pulse($('bBlock')); paintStatus(); }
  function addSt(e, f) {
    const img = e.el.querySelector('.e-img');
    if (f.k === 'weak') { e.st.weak = { v:Math.max(f.v, e.st.weak ? e.st.weak.v : 0), t:Math.max(f.t, e.st.weak ? e.st.weak.t : 0) }; floatText(img, `攻撃-${f.v}%`, '#d0a8ff', 'st'); }
    if (f.k === 'vuln') { e.st.vuln = Math.max(e.st.vuln, f.t); floatText(img, '脆弱', '#ff9ad5', 'st'); }
    if (f.k === 'poison') { e.st.poison.push({ v:f.v, t:f.t }); floatText(img, `毒${f.v}`, '#9dff6a', 'st'); }
  }
  const aliveE = () => B.enemies.filter(e => e.hp > 0);
  function pickTarget() { const al = aliveE(); return al.includes(B.target) ? B.target : al[0]; }
  const poisonOf = e => e.st.poison.reduce((a, p) => a + p.v, 0);

  // ---------- 交代とEX ----------
  function onMember(i) {
    if (B.busy) return;
    const m = B.run.party[i];
    if (m.ex >= EX_GAUGE && m.hp > 0) { useEx(m); return; }
    if (i === 0) { toast(`${CHARS[m.id].n}：前列（攻撃を受ける）・EX ${m.ex}/${EX_GAUGE}`); return; }
    if (m.hp <= 0) { toast('戦闘不能の子とは交代できません'); return; }
    if (!B.swapFree && B.energy < 1) { toast('2回目の交代にはエネルギー1が必要です'); Sfx.play('back'); return; }
    if (!B.swapFree) B.energy--; B.swapFree = false;
    [B.run.party[0], B.run.party[i]] = [B.run.party[i], B.run.party[0]];
    Sfx.play('guard'); vib(15); buildParty(); paintParty(); paintStatus(); paintHand();
    toast(`${CHARS[B.run.party[0].id].n}が前列に出ました`);
  }
  async function useEx(m) {
    B.busy = true; B.sel = null; closePreview();
    await cutin(m.id);
    m.ex = 0; paintParty(); actor(m.id, 'joy');
    B.chain++;
    await applyFx(CHARS[m.id].ex.fx, pickTarget(), m.id, CHARS[m.id].attr);
    if (await checkEnd()) return;
    toast('EXスキルを使ったので、ターン終了'); await sleep(500);
    B.busy = false; endTurn(true);
  }
  function cutin(ch) {
    const c = $('cut'), pc = CHARS[ch], col = ATTR[pc.attr].c;
    c.style.setProperty('--c', col);
    c.querySelector('img').src = 'hl_x_' + ch + '.webp';
    c.querySelector('.cn').textContent = pc.n; c.querySelector('.cs').textContent = pc.ex.n; c.querySelector('.cd').textContent = pc.ex.txt;
    c.className = 'on'; Sfx.play('skill'); vib(30);
    return new Promise(res => { const done = () => { clearTimeout(t); c.onclick = null; c.className = 'on out'; setTimeout(() => { c.className = ''; res(); }, 280); }; const t = setTimeout(done, 2000); c.onclick = done; });
  }

  // ---------- 敵の番 ----------
  async function endTurn(force) {
    if (B.busy && !force) return;
    B.busy = true; B.sel = null; closePreview(); $('bEnd').classList.remove('on');
    B.disc.push(...B.hand); B.hand = []; paintHand(); paintPiles();
    ['weak', 'vuln'].forEach(k => { if (B.st[k]) B.st[k]--; });
    B.atkup.forEach(x => x.t--); B.atkup = B.atkup.filter(x => x.t > 0);
    paintStatus();
    await sleep(200);
    await turnBanner('ENEMY TURN', true);
    for (const e of B.enemies) {
      if (e.hp <= 0) continue;
      e.block = 0;
      const img = e.el.querySelector('.e-img');
      const pz = poisonOf(e);
      if (pz) { e.hp = Math.max(0, e.hp - pz); floatText(img, pz, '#9dff6a'); e.st.poison.forEach(p => p.t--); e.st.poison = e.st.poison.filter(p => p.t > 0); paintEnemies(); if (e.hp <= 0) { kill(e); continue; } if (e.boss && !e.p2 && e.hp <= e.max / 2) phase2(e); await sleep(220); }
      if (e.boss && B.turn >= RAGE_TURN) { e.st.str += 2; floatText(img, '激怒 力+2', '#ff5a6e', 'st'); await sleep(260); }
      if (e.broken) { e.broken--; floatText(img, 'ダウン中', '#5ff2ff', 'st'); if (!e.broken) e.el.classList.remove('broken'); e.step++; await sleep(300); continue; }
      if (e.boss) {
        e.cnt--;
        if (e.cnt <= 0) { await bigAttack(e); e.cnt = B.sg.count; if (!alivePt().length) return lose(); e.step++; paintEnemies(); continue; }
      }
      await enemyAct(e);
      if (!alivePt().length) return lose();
      if (e.st.weak) { e.st.weak.t--; if (e.st.weak.t <= 0) e.st.weak = null; }
      if (e.st.vuln) e.st.vuln--;
      e.step++; paintEnemies(); await sleep(160);
    }
    if (await checkEnd()) return;
    startTurn();
  }
  const atkOf = (e, v) => { let x = (v + e.st.str) * B.sg.atk; if (e.st.weak) x *= 1 - Math.min(75, e.st.weak.v) / 100; if (B.st.vuln) x *= 1.5; return Math.max(0, Math.floor(x)); };
  async function enemyAct(e) {
    const it = e.intent; if (!it) return;
    e.el.classList.remove('act'); void e.el.offsetWidth; e.el.classList.add('act');
    await sleep(240);
    const img = e.el.querySelector('.e-img');
    if (it.block) { const v = Math.round(it.block * B.sg.hp); e.block += v; floatText(img, `ガード${v}`, '#7cc4ff', 'st'); }
    if (it.shield) { const v = Math.round(it.shield * B.sg.hp); e.shield = Math.min(e.maxShield || v, e.shield + v); if (!e.maxShield) e.maxShield = v; floatText(img, `シールド+${v}`, '#5ff2ff', 'st'); }
    if (it.heal) { const v = Math.round(it.heal * B.sg.hp), x = Math.min(e.max - e.hp, v); e.hp += x; floatText(img, `+${x}`, '#7dffb0', 'st'); }
    if (it.str) { e.st.str += it.str; floatText(img, `力+${it.str}`, '#ffb24a', 'st'); }
    if (it.weak) { B.st.weak += it.weak; floatText(memEl(front().id), `弱体${it.weak}`, '#d0a8ff', 'st'); }
    if (it.vuln) { B.st.vuln += it.vuln; floatText(memEl(front().id), `脆弱${it.vuln}`, '#ff9ad5', 'st'); }
    if (it.poison) { B.pp += it.poison; floatText(memEl(front().id), `毒${it.poison}`, '#9dff6a', 'st'); }
    if (it.drain) { B.drain += it.drain; floatText($('bEnergy'), `次のターン エネルギー-${it.drain}`, '#ff8fa3', 'st'); }
    if (it.junk) { for (let i = 0; i < it.junk; i++) B.disc.push({ id:'x_junk', u:++uid }); floatText(img, `散らかり+${it.junk}`, '#c9b08a', 'st'); paintPiles(); }
    const hits = async (who, [v, n]) => { for (let i = 0; i < n; i++) { who().forEach(m => hitMember(m, atkOf(e, v))); await sleep(220); } };
    if (it.atk) await hits(() => [front()].filter(m => m.hp > 0), it.atk);
    if (it.atkBack) await hits(() => { const bk = B.run.party.slice(1).filter(m => m.hp > 0); return bk.length ? [bk[Math.floor(Math.random() * bk.length)]] : [front()]; }, it.atkBack);
    if (it.atkAll) await hits(alivePt, it.atkAll);
    paintStatus(); paintEnemies();
  }
  async function bigAttack(e) {
    e.el.classList.remove('act'); void e.el.offsetWidth; e.el.classList.add('act');
    await banner('全体攻撃', true);
    alivePt().forEach(m => hitMember(m, atkOf(e, e.cntDmg)));
    await sleep(600);
  }
  function hitMember(m, v, pierce) {
    if (m.hp <= 0) return;
    let left = v;
    if (B.block && !pierce) { const u = Math.min(B.block, left); B.block -= u; left -= u; if (u) { Sfx.play('guard'); pulse($('bBlock')); } }
    m.hp = Math.max(0, m.hp - left);
    const el = memEl(m.id);
    el.classList.remove('hurt'); void el.offsetWidth; el.classList.add('hurt');
    floatText(el, left > 0 ? `-${left}` : 'BLOCK', left > 0 ? (pierce ? '#9dff6a' : '#ff6a6a') : '#7cc4ff', 'big');
    if (left > 0) { const sc = $('battle'); sc.classList.remove('shake'); void sc.offsetWidth; sc.classList.add('shake'); $('bFlash').classList.remove('on'); void $('bFlash').offsetWidth; $('bFlash').classList.add('on'); Sfx.play('enemy'); vib(35); }
    if (m.hp <= 0) { B.run.downs++; toast(`${CHARS[m.id].n}が倒れた`); autoFront(); }
    paintParty(); paintStatus(); paintHand();
  }
  function autoFront() {
    if (front().hp > 0) return;
    const i = B.run.party.findIndex(m => m.hp > 0); if (i <= 0) return;
    [B.run.party[0], B.run.party[i]] = [B.run.party[i], B.run.party[0]]; buildParty();
  }

  // ---------- 終わり ----------
  async function checkEnd() {
    if (aliveE().length) return false;
    B.busy = true; await sleep(700);
    alivePt().forEach(m => actor(m.id, 'joy'));
    if (has('p_heal')) alivePt().forEach(m => m.hp = Math.min(m.max, m.hp + 4));
    Sfx.play('win'); await banner('VICTORY', false);
    B.run.turns += B.turn;
    B.done(true);
    return true;
  }
  function lose() { B.busy = true; Sfx.play('lose'); B.run.turns += B.turn; B.done(false); }

  // ---------- 表示 ----------
  function buildEnemies() {
    const box = $('bEnemies'); box.innerHTML = '';
    box.className = B.enemies.some(e => e.boss) ? 'boss' : 'n' + B.enemies.length;
    B.enemies.forEach(e => {
      const el = h(`<div class="en${e.boss ? ' big' : ''}"><div class="e-cnt"></div><div class="e-int"></div>
        <img class="e-img" src="${e.img}.webp" alt=""><div class="e-sh"></div>
        <div class="e-bar"><i class="e-attr" style="background:${ATTR[e.attr].c}"></i><div class="e-hp"><i></i><em></em><b></b></div><span class="e-blk"></span></div>
        <div class="e-st"></div><div class="e-nm">${e.n}</div></div>`);
      el.addEventListener('click', () => { if (e.hp <= 0) return; B.target = e; paintEnemies(); Sfx.play('tap'); });
      e.el = el; box.appendChild(el);
      el.animate([{opacity:0, transform:'translateY(-24px) scale(.92)'}, {opacity:1, transform:'none'}], {duration:500, delay:100 + e.i * 90, easing:'cubic-bezier(.2,.8,.2,1)', fill:'backwards'});
    });
  }
  const ICON = {
    atk:'<svg viewBox="0 0 24 24"><path d="M14 2h8v8L11 21l-3-3-3 3-2-2 3-3-3-3z" fill="currentColor"/></svg>',
    block:'<svg viewBox="0 0 24 24"><path d="M12 2l9 3v6c0 6-4 10-9 11C7 21 3 17 3 11V5z" fill="currentColor"/></svg>',
    buff:'<svg viewBox="0 0 24 24"><path d="M12 3l8 9h-5v9H9v-9H4z" fill="currentColor"/></svg>',
    debuff:'<svg viewBox="0 0 24 24"><path d="M12 21l8-9h-5V3H9v9H4z" fill="currentColor"/></svg>',
  };
  function intentHTML(e) {
    const it = e.intent; if (!it || e.broken) return e.broken ? '<span class="i-brk">DOWN</span>' : '';
    const p = [], at = (lab, a) => p.push(`<span class="i-atk">${ICON.atk}<b>${atkOf(e, a[0])}${a[1] > 1 ? '×' + a[1] : ''}</b><small>${lab}</small></span>`);
    if (it.atk) at('前列', it.atk);
    if (it.atkBack) at('後列', it.atkBack);
    if (it.atkAll) at('全員', it.atkAll);
    if (it.block || it.shield) p.push(`<span class="i-blk">${ICON.block}<b>${Math.round((it.block || it.shield) * B.sg.hp)}</b></span>`);
    if (it.heal) p.push(`<span class="i-heal">${ICON.buff}<small>回復</small></span>`);
    if (it.str) p.push(`<span class="i-buf">${ICON.buff}</span>`);
    if (it.weak || it.vuln || it.poison) p.push(`<span class="i-deb">${ICON.debuff}<small>${it.poison ? '毒' : '弱体'}</small></span>`);
    if (it.drain) p.push(`<span class="i-deb">${ICON.debuff}<small>EN-${it.drain}</small></span>`);
    if (it.junk) p.push(`<span class="i-junk"><small>散らかり${it.junk}</small></span>`);
    return p.join('');
  }
  function paintEnemies() {
    B.enemies.forEach(e => {
      const el = e.el; if (!el) return;
      el.querySelector('.e-int').innerHTML = e.hp > 0 ? intentHTML(e) : '';
      el.querySelector('.e-hp i').style.transform = `scaleX(${e.hp / e.max})`;
      el.querySelector('.e-hp em').style.transform = `scaleX(${e.maxShield ? e.shield / e.maxShield : 0})`;
      el.querySelector('.e-hp b').textContent = `${e.hp}${e.shield > 0 ? ` +${e.shield}` : ''}`;
      const bk = el.querySelector('.e-blk'); bk.textContent = e.block || ''; bk.classList.toggle('on', e.block > 0);
      const pz = poisonOf(e);
      el.querySelector('.e-st').innerHTML = [e.st.weak ? `<span class="s-weak">弱${e.st.weak.v}%·${e.st.weak.t}</span>` : '', e.st.vuln ? `<span class="s-vuln">脆${e.st.vuln}</span>` : '',
        pz ? `<span class="s-poison">毒${pz}</span>` : '', e.st.str ? `<span class="s-str">力${e.st.str}</span>` : ''].join('');
      const cn = el.querySelector('.e-cnt');
      cn.innerHTML = e.boss && e.hp > 0 ? `<b>${e.cnt}</b><span>全体攻撃まで<br>シールドを割ると止まる</span>` : '';
      cn.classList.toggle('warn', e.boss && e.cnt <= 1);
      el.classList.toggle('tgt', e === pickTarget() && aliveE().length > 1);
      el.classList.toggle('rage', !!(e.boss && B.turn >= RAGE_TURN));
    });
  }
  function buildParty() {
    $('bParty').innerHTML = B.run.party.map((m, i) => `<button class="pm ${i === 0 ? 'front' : 'back b' + i}" data-i="${i}" data-id="${m.id}" style="--c:${TAG[PARTY_DEF[m.id].tag].c}">
      <div class="pm-ex"></div><img class="pm-img" alt=""><div class="pm-info"><span class="pm-tag">${TAG[PARTY_DEF[m.id].tag].n}</span><b>${CHARS[m.id].n}</b>
      <div class="pm-hp"><i></i><em></em></div></div>${i === 0 ? '<span class="pm-front">前列</span>' : ''}</button>`).join('');
    paintParty();
  }
  function paintParty() {
    B.run.party.forEach(m => {
      const el = $('bParty').querySelector(`[data-id="${m.id}"]`); if (!el) return;
      const img = el.querySelector('.pm-img');
      if (!img.dataset.lock) img.src = `hl_s_${m.id}_${m.hp <= 0 ? 'down' : 'aim'}.webp`;
      el.classList.toggle('down', m.hp <= 0);
      el.querySelector('.pm-hp i').style.transform = `scaleX(${m.hp / m.max})`;
      el.querySelector('.pm-hp em').textContent = `${m.hp}/${m.max}`;
      el.querySelector('.pm-ex').innerHTML = Array.from({length:EX_GAUGE}, (_, k) => `<i class="${k < m.ex ? 'on' : ''}"></i>`).join('');
      el.classList.toggle('ready', m.ex >= EX_GAUGE && m.hp > 0);
    });
    const syn = {}; alivePt().forEach(m => { const t = PARTY_DEF[m.id].tag; syn[t] = (syn[t] || 0) + 1; });
    $('bSyn').innerHTML = Object.entries(syn).filter(([, n]) => n >= 2).map(([t, n]) => `<span style="--c:${TAG[t].c}">${TAG[t].n}×${n} <b>+${n >= 3 ? 30 : 15}%</b></span>`).join('');
  }
  function actor(id, pose) {
    const el = $('bParty').querySelector(`[data-id="${id}"] .pm-img`); if (!el || !mem(id) || mem(id).hp <= 0) return;
    el.dataset.lock = 1; el.src = `hl_s_${id}_${pose}.webp`;
    const p = el.parentElement; p.classList.remove('act'); void p.offsetWidth; p.classList.add('act');
    clearTimeout(el._t); el._t = setTimeout(() => { delete el.dataset.lock; if (mem(id) && mem(id).hp > 0) el.src = `hl_s_${id}_aim.webp`; }, 900);
  }
  const memEl = id => $('bParty').querySelector(`[data-id="${id}"]`) || $('bParty');
  function paintStatus() {
    const bk = $('bBlock'); bk.querySelector('b').textContent = B.block; bk.classList.toggle('on', B.block > 0);
    $('bEnergy').querySelector('b').textContent = B.energy; $('bEnergy').querySelector('small').textContent = '/' + B.maxE;
    $('bEnergy').classList.toggle('empty', B.energy <= 0);
    $('bChain').innerHTML = B.chain > 1 ? `連携 <b>×${(1 + (B.chain - 1) * (has('p_chain') ? .15 : .1)).toFixed(2)}</b>` : '';
    const up = upRate();
    $('bSt').innerHTML = [up > 1 ? `<span class="s-str">攻撃+${Math.round((up - 1) * 100)}%</span>` : '', B.st.weak ? `<span class="s-weak">弱体${B.st.weak}</span>` : '',
      B.st.vuln ? `<span class="s-vuln">脆弱${B.st.vuln}</span>` : '', B.pp ? `<span class="s-poison">毒${B.pp}</span>` : '', B.drain ? `<span class="s-weak">EN-${B.drain}</span>` : ''].join('');
  }
  function paintPiles() { $('bDraw').textContent = B.draw.length; $('bDisc').textContent = B.disc.length; }
  function paintAll() { paintStatus(); paintPiles(); paintHand(); paintEnemies(); }
  const modNow = () => ({ up:upRate(), weak:!!B.st.weak });

  function paintHand(anim) {
    const box = $('hand'), n = B.hand.length, W = box.clientWidth || innerWidth;
    const cw = Math.min(112, W * .29), ch = cw * 1.5, step = n > 1 ? Math.min(cw * .86, (W - cw - 16) / (n - 1)) : 0;
    const x0 = (W - (cw + step * (n - 1))) / 2;
    const prev = new Set([...box.querySelectorAll('.card')].map(e => e.dataset.u));
    box.innerHTML = B.hand.map(it => {
      const c = cardOf(it.id), m = mem(c.who), dead = !!(m && m.hp <= 0), ok = !dead && c.cost <= B.energy && !B.busy, sel = B.sel === it.u;
      return YCard.html(c, { mod:modNow(), cls:`${ok ? 'ok' : 'no'}${dead ? ' dn' : ''}${sel ? ' sel' : ''}${c.junk ? ' junk' : ''}${anim && !prev.has(String(it.u)) ? ' drawn' : ''}` });
    }).join('');
    [...box.children].forEach((el, i) => {
      const mid = (n - 1) / 2, rot = (i - mid) * 3.2, y = Math.abs(i - mid) ** 2 * 2.2, sel = B.sel === B.hand[i].u;
      el.dataset.u = B.hand[i].u;
      Object.assign(el.style, { left:x0 + step * i + 'px', width:cw + 'px', height:ch + 'px', zIndex:sel ? 50 : i + 1 });
      el.style.setProperty('--r', rot + 'deg'); el.style.setProperty('--y', y + 'px');
    });
  }

  // 手札の操作：タップで選ぶ → もう一度タップ or 上にドラッグで使う
  let drag = null;
  function onDown(e) { const el = e.target.closest('#hand .card'); if (!el || B.busy) return; drag = {u:+el.dataset.u, el, x0:e.clientX, y0:e.clientY, moved:false}; el.setPointerCapture(e.pointerId); }
  function onMove(e) {
    if (!drag) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.moved && Math.hypot(dx, dy) > 12) { drag.moved = true; drag.el.classList.add('drag'); B.sel = drag.u; showPreview(drag.u); }
    if (!drag.moved) return;
    drag.el.style.transform = `translate(${dx}px,${dy}px) scale(1.08)`;
    const up = e.clientY < $('hand').getBoundingClientRect().top - 30; drag.el.classList.toggle('arm', up);
    let over = null;
    B.enemies.forEach(en => { if (en.hp > 0) { const r = en.el.getBoundingClientRect(); const hit = e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom; en.el.classList.toggle('hover', hit); if (hit) over = en; } });
    drag.over = over; drag.up = up;
  }
  function onUp() {
    if (!drag) return; const d = drag; drag = null;
    B.enemies.forEach(en => en.el && en.el.classList.remove('hover'));
    if (d.moved) { d.el.classList.remove('drag', 'arm'); d.el.style.transform = ''; if (d.up) { play(d.u, d.over); return; } B.sel = null; closePreview(); paintHand(); return; }
    if (B.sel === d.u) { play(d.u); return; }
    B.sel = d.u; Sfx.play('tap'); showPreview(d.u); paintHand();
  }
  // 選んだ1枚：大きく出して、動画も動かす
  function showPreview(u) {
    const it = B.hand.find(x => x.u === u); if (!it) return;
    const c = cardOf(it.id), m = mem(c.who), pv = $('preview');
    const who = m ? '' : c.junk ? '' : `（${CHARS[front().id].n}が使う）`;
    const tip = m && m.hp <= 0 ? `${CHARS[c.who].n}は戦闘不能です` : c.cost > B.energy ? 'エネルギーが足りません' : c.junk ? '使うと消えます（効果なし）' : `もう一度タップ、または上へドラッグで使う${who}`;
    pv.innerHTML = YCard.html(c, { mod:modNow(), cls:'big', live:true }) + `<p class="pv-hint">${tip}</p>`;
    pv.classList.add('on');
  }
  function closePreview() { const pv = $('preview'); pv.classList.remove('on'); setTimeout(() => { if (!pv.classList.contains('on')) pv.innerHTML = ''; }, 250); }

  async function flyCard(it, c, tg) {
    const src = document.querySelector(`#hand .card[data-u="${it.u}"]`);
    const r = src ? src.getBoundingClientRect() : {left:innerWidth / 2 - 50, top:innerHeight - 200, width:100, height:150};
    const W = Math.min(innerWidth * .52, 230), H = W * 1.5, fr = $('bField').getBoundingClientRect();
    const cx = innerWidth / 2, cy = fr.top + fr.height * .46;
    const f = h(`<div class="flycard">${YCard.html(c, { live:true, mod:modNow() })}</div>`);
    f.style.cssText = `left:${cx - W / 2}px;top:${cy - H / 2}px;width:${W}px;height:${H}px;--tc:${YCard.TYPE[YCard.typeOf(c)].c}`;
    document.body.appendChild(f); if (src) src.style.visibility = 'hidden';
    Sfx.play('play'); vib(12);
    const k = r.width / W, sx = r.left + r.width / 2 - cx, sy = r.top + r.height / 2 - cy;
    await f.animate([{transform:`translate(${sx}px,${sy}px) scale(${k}) rotate(-4deg)`}, {transform:'translateY(-6px) scale(1)'}], {duration:280, easing:'cubic-bezier(.2,.9,.25,1)', fill:'forwards'}).finished;
    f.classList.add('glow'); await sleep(c.art && (c.art.kind === 'lobby' || c.art.kind === 'video') ? 650 : 260);   // 動くカードは少し長めに見せる
    let end = [{transform:'translateY(-6px) scale(1)', opacity:1}, {transform:'translateY(-40px) scale(.9)', opacity:0}];
    if (YCard.typeOf(c) === 'atk' && tg && tg.el) { const er = tg.el.querySelector('.e-img').getBoundingClientRect(); end = [{transform:'translateY(-6px) scale(1)', opacity:1}, {transform:`translate(${er.left + er.width / 2 - cx}px,${er.top + er.height / 2 - cy}px) scale(.35) rotate(8deg)`, opacity:0}]; }
    await f.animate(end, {duration:220, easing:'cubic-bezier(.6,0,.9,.5)', fill:'forwards'}).finished;
    f.remove();
  }
  function slash(r, col) {
    const s = document.createElement('i'); s.className = 'slash'; s.style.setProperty('--c', col);
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    s.style.left = x + 'px'; s.style.top = y + 'px'; s.style.transform = `translate(-50%,-50%) rotate(${-35 + Math.random() * 70}deg)`;
    document.body.appendChild(s); setTimeout(() => s.remove(), 420); burst(x, y, col, 8, 50);
  }
  async function banner(t, warn) { const b = $('bBanner'); b.innerHTML = `<span>${t}</span>`; b.className = warn ? 'warn on' : 'on'; Sfx.play(warn ? 'warn' : 'floor'); await sleep(warn ? 1300 : 900); b.className = ''; }
  async function turnBanner(t, en) { const b = $('bTurn'); b.textContent = t; b.className = en ? 'en on' : 'on'; Sfx.play('turn'); await sleep(650); b.className = ''; }
  function floatText(el, txt, col, cls = '') {
    const r = el.getBoundingClientRect(), p = document.createElement('div');
    p.className = 'ft ' + cls; p.style.color = col; p.textContent = txt;
    p.style.left = (r.left + r.width / 2 + (Math.random() - .5) * 30) + 'px'; p.style.top = (r.top + r.height * .3) + 'px';
    document.body.appendChild(p); setTimeout(() => p.remove(), 1100);
  }
  function pulse(el) { el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); }

  function init() {
    const hand = $('hand');
    hand.addEventListener('pointerdown', onDown); hand.addEventListener('pointermove', onMove);
    hand.addEventListener('pointerup', onUp); hand.addEventListener('pointercancel', onUp);
    $('bEnd').onclick = () => { Sfx.play('ok'); endTurn(); };
    $('bParty').addEventListener('click', e => { const b = e.target.closest('.pm'); if (b) onMember(+b.dataset.i); });
    $('bField').addEventListener('click', e => { if (!e.target.closest('.en') && !e.target.closest('.pm') && B && B.sel != null) { B.sel = null; closePreview(); paintHand(); } });
    $('bRetreat').onclick = () => { if (!B || B.busy) return; Run.menu(); };
    $('bPileD').onclick = () => toast(`山札 ${B.draw.length}枚`);
    $('bPileX').onclick = () => toast(`捨て札 ${B.disc.length}枚（散らかり ${B.disc.filter(x => x.id === 'x_junk').length}枚）`);
    addEventListener('resize', () => { if (B && $('battle').classList.contains('on')) paintHand(); });
  }
  return { init, start, dbg:() => B };
})();
