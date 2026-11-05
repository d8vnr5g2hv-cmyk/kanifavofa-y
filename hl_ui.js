// HALO LINK（Card Shop 版）— 画面：タイトル・作戦（ステージ1〜12とHARD）・編成・結果・閉じる
'use strict';
const UI = (() => {
  let cur = 'title', sel = 1, hard = false, slotSel = 0;
  const ORDER = ['hoshino', 'noa', 'mika', 'yuuka', 'kisaki', 'hina', 'miyako', 'mari'];

  async function go(id, arg) {
    if (id === cur && id !== 'battle') { if (id === 'map') Run.paintMap(); return; }
    await Wipe.play(() => {
      document.querySelectorAll('.scr').forEach(s => s.classList.toggle('on', s.id === id));
      cur = id; document.body.dataset.scr = id;
      if (id === 'stage') { stage(); $('stage').querySelector('.st-scroll').scrollTop = 0; }
      if (id === 'team') team();
      if (id === 'map') Run.paintMap();
      if (id === 'battle' && typeof arg === 'function') arg();
      enter(document.getElementById(id));
    });
  }
  function enter(root) {
    [...root.querySelectorAll('.in')].slice(0, 14).forEach((e, i) =>
      e.animate([{opacity:0, transform:'translateY(14px)'}, {opacity:1, transform:'none'}], {duration:460, delay:60 + i * 45, easing:'cubic-bezier(.2,.8,.2,1)', fill:'backwards'}));
  }

  // ---------- タイトル ----------
  function title() {
    let started = false;
    const start = () => { if (started) return; started = true; try { Sfx.play('ok'); } catch (e) {} go(HL.save.run ? 'map' : 'stage'); };
    $('title').addEventListener('click', start);
    const show = () => $('tStart').classList.add('on');
    setTimeout(show, 2000);
    const list = ['hl_bg_sand', 'hl_bg_battle', 'hl_g_atk'];
    let done = 0;
    list.forEach(n => { const i = new Image(); i.onload = i.onerror = () => { done++; $('tBar').style.transform = `scaleX(${done / list.length})`; if (done === list.length) show(); }; i.src = n + '.webp'; });
  }

  // ---------- 作戦 ----------
  const open = n => n === 1 || HL.save.cleared.includes(n - 1);
  function stage() {
    const s = HL.save;
    if (!open(sel)) sel = 1;
    $('stBadge').textContent = s.badge || 0;
    $('stClear').textContent = `${s.cleared.length}/12`;
    $('sgList').innerHTML = STAGES.map(st => {
      const op = open(st.no), cl = s.cleared.includes(st.no), hd = s.hard.includes(st.no), bs = ENEMIES[st.boss];
      const rk = s.best['n' + st.no], rh = s.best['h' + st.no];
      return `<button class="sg ${st.no === sel ? 'on' : ''} ${op ? '' : 'lock'}" data-sg="${st.no}" ${op ? '' : 'disabled'}>
        <img src="${bs.img}.webp" alt="" loading="lazy"><em>${String(st.no).padStart(2, '0')}</em>
        ${cl ? `<span class="sg-cl">${rk || 'CLEAR'}${hd ? `<i>H ${rh || ''}</i>` : ''}</span>` : ''}${op ? '' : '<span class="sg-lock">LOCK</span>'}</button>`;
    }).join('');
    const st = STAGES[sel - 1], bs = ENEMIES[st.boss], canHard = s.cleared.includes(sel);
    if (!canHard) hard = false;
    const mul = hard ? HARD : { hp:1, atk:1 };
    $('stInfo').innerHTML = `<div class="sg-head"><img src="${bs.img}.webp" alt=""><div><small>STAGE ${sel}${hard ? ' ・ HARD' : ''}</small><b>${bs.n}</b>
        <p>敵HP×${(st.hp * mul.hp).toFixed(2)} ・ 攻撃×${(st.atk * mul.atk).toFixed(2)} ・ カウント${Math.max(2, st.count + (hard ? HARD.count : 0))}</p></div></div>
      <div class="sg-en">${st.pool.map(i => `<img src="hl_en${String(i + 1).padStart(2, '0')}a.webp" alt="" title="${SPECIES[i].n}">`).join('')}</div>
      <p class="sg-tip">ボスはシールドを割らないと、カウント0で全員に大ダメージ。HPが半分を切ると第2形態、${RAGE_TURN}ターンを越えると激怒します。</p>`;
    $('stParty').innerHTML = `<div class="tms">${s.team.map((id, i) => `<div class="tm"><img src="hl_s_${id}_aim.webp" alt=""><span style="--c:${TAG[PARTY_DEF[id].tag].c}">${i === 0 ? '前列' : TAG[PARTY_DEF[id].tag].n}</span><b>${CHARS[id].n}</b></div>`).join('')}</div>`;
    const d = HL.deck(), okD = d.length >= YCard.DECK.min, mine = d.filter(id => id.startsWith('u_')).length;
    $('stDeck').innerHTML = `<b class="${okD ? '' : 'ng'}">${d.length}</b><span>枚のデッキ（自作 ${mine}枚）</span><small>${okD ? 'デッキはショーケースで組みかえられます' : `${YCard.DECK.min}枚以上必要です。ショーケースで組んでください`}</small>`;
    $('stGo').innerHTML = s.run ? `<b>続きから</b><small>STAGE ${s.run.stage}${s.run.hard ? ' HARD' : ''}・${s.run.layer + 2}層目</small>` : `<b>出撃</b><small>STAGE ${sel}${hard ? ' HARD' : ''}</small>`;
    $('stHard').classList.toggle('on', hard); $('stHard').disabled = !canHard || !!s.run;
    $('stHard').innerHTML = `<b>HARD</b><small>${canHard ? (hard ? 'ON' : 'OFF') : 'クリアで解放'}</small>`;
    s.passive = s.passive || {};
    $('stPass').innerHTML = PASSIVES.map(p => `<button class="ps ${s.passive[p.id] ? 'on' : ''}" data-ps="${p.id}"><b>${p.n}</b><small>${p.txt}</small><em>${s.passive[p.id] ? '解放済み' : `記章 ${p.cost}`}</em></button>`).join('');
  }

  // ---------- 編成（3人。左が前列） ----------
  function team() {
    const s = HL.save, d = HL.deck(), cnt = {};
    d.forEach(id => { const c = HL.card(id); if (c && CHARS[c.who]) cnt[c.who] = (cnt[c.who] || 0) + 1; });
    $('dkTeam').innerHTML = [0, 1, 2].map(i => { const id = s.team[i];
      return id ? `<button class="tslot ${i === 0 ? 'f' : ''} ${i === slotSel ? 'pick' : ''}" data-ts="${i}" style="--c:${TAG[PARTY_DEF[id].tag].c}"><em>${i === 0 ? '前列' : '後列'}</em><img src="hl_s_${id}_aim.webp" alt=""><b>${CHARS[id].n}</b><span>${TAG[PARTY_DEF[id].tag].n}</span></button>`
        : `<button class="tslot empty ${i === slotSel ? 'pick' : ''}" data-ts="${i}">＋</button>`; }).join('');
    const syn = {}; s.team.forEach(id => { const t = PARTY_DEF[id].tag; syn[t] = (syn[t] || 0) + 1; });
    $('dkSyn').innerHTML = Object.keys(TAG).map(t => `<span class="${syn[t] >= 2 ? 'on' : ''}" style="--c:${TAG[t].c}">${TAG[t].n} ${syn[t] || 0}人${syn[t] >= 3 ? ' +30%' : syn[t] === 2 ? ' +15%' : ''}</span>`).join('');
    $('dkPool').innerHTML = ORDER.map(id => `<button class="tp ${s.team.includes(id) ? 'in' : ''}" data-pool="${id}" style="--c:${ATTR[CHARS[id].attr].c}">
      <img src="hl_ic_${id}.webp" alt=""><div><b>${CHARS[id].n}</b><small>${TAG[PARTY_DEF[id].tag].n}・${ATTR[CHARS[id].attr].n}・HP${PARTY_DEF[id].hp}</small><p>EX ${CHARS[id].ex.n}：${CHARS[id].ex.txt}</p></div>
      <em>${cnt[id] ? `カード${cnt[id]}` : ''}</em></button>`).join('');
  }
  function poolTap(id) {
    const s = HL.save, t = s.team.slice(), at = t.indexOf(id);
    if (at >= 0) { [t[at], t[slotSel]] = [t[slotSel], t[at]]; }
    else t[slotSel] = id;
    s.team = t.filter(Boolean).slice(0, 3); HL.put(); Sfx.play('ok');
    slotSel = (slotSel + 1) % 3; team();
  }

  // ---------- 結果 ----------
  function runResult(r) {
    const o = $('over');
    o.innerHTML = `<div class="ov ${r.win ? 'win' : 'lose'}"><h2>${r.win ? 'CLEAR' : r.settled ? 'SETTLE' : 'FAILED'}</h2>
      ${r.win ? `<div class="rk-big r${r.rank}">${r.rank}<small>RANK</small></div>${r.first ? `<p class="ov-first">STAGE ${r.stage}${r.hard ? ' HARD' : ''} 初クリア${!r.hard && r.stage < 12 ? `<br>STAGE ${r.stage + 1} が開きました` : ''}${!r.hard ? '<br>このステージの HARD も選べます' : ''}</p>` : ''}`
        : `<p>${r.settled ? 'ここまでの記章を受け取りました' : '全員倒れてしまった（記章は半分）'}</p>`}
      <div class="rw"><span>記章</span><b>+${r.badge}</b></div>
      <div class="ov-btns"><button class="btn main" data-h>作戦へ</button></div></div>`;
    o.classList.add('on'); Sfx.play(r.win ? 'win' : 'lose');
    if (r.win && !r.hard && r.stage < 12) sel = r.stage + 1;
    o.querySelector('[data-h]').onclick = () => { o.classList.remove('on'); go('stage'); };
  }

  function close() { try { parent.postMessage('hl:close', location.origin); } catch (e) {} }
  async function init() {
    await HL.load();
    title();
    const safe = fn => { try { fn(); } catch (e) { console.warn(e); } };
    safe(() => Battle.init());
    safe(() => Run.init());
    safe(bind);
  }
  function bind() {
    $('hlClose').onclick = () => { Sfx.play('back'); close(); };
    $('sgList').addEventListener('click', e => { const b = e.target.closest('[data-sg]'); if (!b) return; sel = +b.dataset.sg; Sfx.play('tap'); stage(); });
    $('stGo').onclick = () => { const s = HL.save; if (s.run) { Sfx.play('ok'); go('map'); return; } if (s.team.length < 3) { toast('3人を編成してください'); go('team'); return; } Sfx.play('ok'); Run.begin(sel, hard); };
    $('stHard').onclick = () => { if (!HL.save.cleared.includes(sel)) return; hard = !hard; Sfx.play(hard ? 'warn' : 'tap'); stage(); };
    $('stEdit').onclick = () => { if (HL.save.run) { toast('挑戦中は編成を変えられません（精算すると変えられます）'); return; } go('team'); };
    $('tmBack').onclick = () => { if (HL.save.team.length < 3) { toast('3人を編成してください'); return; } go('stage'); };
    $('stPass').addEventListener('click', e => {
      const b = e.target.closest('[data-ps]'); if (!b) return; const s = HL.save, p = PASSIVES.find(x => x.id === b.dataset.ps);
      if (s.passive[p.id]) return; if ((s.badge || 0) < p.cost) { toast('記章が足りません'); Sfx.play('back'); return; }
      s.badge -= p.cost; s.passive[p.id] = true; HL.put(); Sfx.play('rare', 3); toast(`特性「${p.n}」を解放しました`); stage();
    });
    $('dkTeam').addEventListener('click', e => { const b = e.target.closest('[data-ts]'); if (!b) return; slotSel = +b.dataset.ts; Sfx.play('tap'); team(); toast(slotSel === 0 ? '前列に入れる子を選んでください' : '後列に入れる子を選んでください'); });
    $('dkPool').addEventListener('click', e => { const b = e.target.closest('[data-pool]'); if (b) poolTap(b.dataset.pool); });
    document.addEventListener('pointerdown', e => { const b = e.target.closest('button'); if (b && !b.disabled) { b.classList.add('prs'); setTimeout(() => b.classList.remove('prs'), 140); } }, {passive:true});
  }
  return { init, go, runResult, close };
})();
UI.init();
