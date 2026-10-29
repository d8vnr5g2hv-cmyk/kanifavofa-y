// Kani Favorite — 実戦（作戦室の待機室 →「実戦」）。4人編成のターン制カードバトル
// 保存：room ストアの 'bt-state' 1件（育成・所持品・AP・クリア状況）。戦闘中の状態は保存しない
'use strict';
const Battle = (() => {
  // ===== キャラ =====
  // role：H ヒーラー／B バランス／A アタック。set：a＝攻撃型（通常・速攻・バリア・EXアタック）／h＝回復型（通常・強化・回復・EX回復）
  const ROLE = { H:['ヒーラー', 'heal'], B:['バランス', 'bal'], A:['アタック', 'atk'] };
  const CH = {
    hoshino:{ name:'ホシノ', role:'B', hp:64, set:'a', face:[.41, .136] },
    mika:   { name:'ミカ',   role:'A', hp:50, set:'a', face:[.557, .208] },
    mari:   { name:'マリー', role:'H', hp:46, set:'h', face:[.55, .2] },
    hina:   { name:'ヒナ',   role:'A', hp:52, set:'a', face:[.47, .202] },
    yuuka:  { name:'ユウカ', role:'B', hp:56, set:'a', face:[.45, .16] },
    miyako: { name:'ミヤコ', role:'B', hp:50, set:'a', face:[.49, .136] },
    nico:   { name:'ニコ',   role:'H', hp:48, set:'h', face:[.43, .177] },
    kisaki: { name:'キサキ', role:'B', hp:52, set:'a', face:[.47, .115] },
  };
  const KEYS = Object.keys(CH);
  const SETS = { a:['atk', 'spd', 'bar', 'exa'], h:['atk', 'buf', 'heal', 'exh'] };
  const DECK_OF = { a:['atk', 'atk', 'spd', 'bar', 'exa'], h:['atk', 'atk', 'buf', 'heal', 'exh'] };
  const EVO_TY = { bar:1, heal:1, exa:2, exh:2 };   // 進化できるカード（1＝Lv10・結晶3／2＝Lv20・結晶5）
  // カード画像（届いている分）。ないものは立ち絵を使う
  const ART = {
    hoshino:['atk', 'spd', 'bar', 'bar_evo', 'exa', 'exa_evo', 'ex'],
    mika:['atk', 'spd', 'bar', 'bar_evo', 'exa', 'exa_evo', 'ex'],
    mari:['atk', 'buf', 'heal', 'heal_evo', 'exh', 'exh_evo', 'ex'],
    hina:['exa', 'exa_evo'],
  };
  // 効果は op の並び。数値は育成で伸びる（ダメージは攻撃力、回復・シールドはレベル）
  const C = (n, c, o, evo) => ({ n, c, o, evo });
  const ATK = n => C('通常射撃', 1, [['dmg', n]]);
  const CARD = {
    hoshino:{ atk:ATK(6), spd:C('先手の一発', 0, [['dmg', 4], ['draw', 1]]),
      bar:C('盾の構え', 1, [['shieldSelf', 12], ['taunt', 1]], C('鉄壁の盾', 1, [['shieldSelf', 14], ['taunt', 1], ['shieldAll', 5]])),
      exa:C('至近距離射撃', 2, [['dmg', 16]], C('零距離射撃', 2, [['dmg', 18], ['weak', 2]])),
      ex:C('守りの誓い', 0, [['shieldAll', 12], ['taunt', 1]]) },
    mika:{ atk:ATK(7), spd:C('軽やかな連射', 0, [['dmg', 3, 2]]),
      bar:C('星のヴェール', 1, [['shield', 10]], C('星の聖域', 1, [['shield', 10], ['cleanse'], ['draw', 1]])),
      exa:C('全力の一撃', 2, [['dmg', 22]], C('流星の一撃', 2, [['dmg', 26], ['refund']])),
      ex:C('流れ星のお願い', 0, [['dmg', 45]]) },
    mari:{ atk:ATK(5), buf:C('祝福の祈り', 1, [['atkUp', 2]]),
      heal:C('癒しの手', 1, [['heal', 14]], C('慈愛の手', 1, [['heal', 14], ['regen', 4, 2], ['cleanse']])),
      exh:C('聖歌の光', 2, [['healAll', 9]], C('奇跡の聖歌', 2, [['healAll', 11], ['revive', 30]])),
      ex:C('天上の祈り', 0, [['healAll', 18], ['cleanseAll']]) },
    hina:{ atk:ATK(7), spd:C('威嚇射撃', 1, [['dmgAll', 4]]),
      bar:C('防衛線', 1, [['shieldSelf', 10]], C('鉄の防衛線', 1, [['shieldSelf', 12], ['atkUpSelf', 1]])),
      exa:C('一斉掃射', 2, [['dmgAll', 9]], C('殲滅掃射', 2, [['dmgAll', 11], ['weakAll', 1]])),
      ex:C('風紀執行', 0, [['dmgAll', 20]]) },
    yuuka:{ atk:ATK(6), spd:C('精密計算', 0, [['draw', 2]]),
      bar:C('演算障壁', 1, [['shieldAll', 6]], C('完全障壁', 1, [['shieldAll', 8], ['draw', 1]])),
      exa:C('最適解', 2, [['dmg', 13], ['weak', 2]], C('最適解・改', 2, [['dmg', 15], ['weak', 2], ['energy', 1]])),
      ex:C('完全演算', 0, [['shieldAll', 14], ['draw', 2]]) },
    miyako:{ atk:ATK(6), spd:C('偵察射撃', 0, [['dmg', 3], ['weak', 1]]),
      bar:C('遮蔽確保', 1, [['shield', 9]], C('遮蔽確保・改', 1, [['shield', 12], ['draw', 1]])),
      exa:C('制圧作戦', 2, [['dmg', 10], ['stun']], C('包囲制圧', 2, [['dmg', 12], ['stun'], ['weak', 2]])),
      ex:C('制圧完了', 0, [['dmgAll', 8], ['stunAll']]) },
    nico:{ atk:ATK(5), buf:C('狐火の加護', 1, [['regen', 5, 3]]),
      heal:C('おまじない手当', 1, [['heal', 11], ['shield', 5]], C('狐のおまじない', 1, [['heal', 13], ['shield', 8], ['cleanse']])),
      exh:C('狐火の宴', 2, [['healAll', 8]], C('九つの灯', 2, [['healAll', 10], ['regenAll', 3, 2]])),
      ex:C('妖狐の灯', 0, [['healAll', 14], ['regenAll', 4, 3]]) },
    kisaki:{ atk:ATK(6), spd:C('采配', 1, [['atkUpAll', 1]]),
      bar:C('結界', 1, [['shieldAll', 6]], C('龍の結界', 1, [['shieldAll', 8], ['cleanseAll']])),
      exa:C('龍の号令', 2, [['atkUpAll', 2], ['energy', 1]], C('天子の号令', 2, [['atkUpAll', 2], ['energy', 1], ['draw', 2]])),
      ex:C('紫煙の采配', 0, [['energy', 2], ['exAll', 25]]) },
  };
  // ===== 敵 =====
  const FOE = {
    drone:{ name:'偵察ドローン', img:'bt_e_drone', hp:16, h:24, fly:1, pat:[['atk', 5], ['atk', 3, 2], ['weakT', 2]] },
    thug: { name:'覆面の不良生徒', img:'bt_e_thug', hp:26, h:70, pat:[['atk', 4, 2], ['buff'], ['atk', 9]] },
    robot:{ name:'警備ロボット', img:'bt_e_robot', hp:44, h:70, pat:[['atk', 8], ['shield', 12], ['atk', 6], ['aoe', 4]] },
    heavy:{ name:'重装オートマタ', img:'bt_e_heavy', hp:120, h:76, boss:1, pat:[['atk', 12], ['charge'], ['aoe', 13], ['shield', 14], ['atk', 8, 2]] },
  };
  const STAGES = [
    { id:'p1', name:'ドローン迎撃', foes:['drone', 'drone'], m:1.0, ap:10, exp:60, t3:3, drop:[['note1', 2]], first:[['star', 1], ['note2', 1]] },
    { id:'p2', name:'不良生徒の鎮圧', foes:['thug', 'thug'], m:1.1, ap:10, exp:90, t3:4, drop:[['note1', 3]], first:[['star', 1], ['chipA', 1]] },
    { id:'p3', name:'警備ロボット', foes:['drone', 'robot'], m:1.2, ap:10, exp:130, t3:5, drop:[['note1', 2], ['note2', 1]], first:[['star', 2], ['chipD', 1]] },
    { id:'p4', name:'混成部隊', foes:['thug', 'robot', 'drone'], m:1.35, ap:10, exp:180, t3:6, drop:[['note2', 2], ['chipA', 1]], first:[['star', 2], ['chipD', 1]] },
    { id:'p5', name:'重装オートマタ', foes:['heavy'], m:1.5, ap:15, exp:260, t3:7, drop:[['note2', 2], ['chipD', 1], ['star', 1]], first:[['star', 3], ['note3', 1]] },
    { id:'p6', name:'総力戦', foes:['drone', 'heavy', 'drone'], m:1.8, ap:15, exp:360, t3:9, drop:[['note2', 3], ['chipA', 1], ['star', 1]], first:[['star', 3], ['note3', 2]] },
  ];
  const ITEM = {
    note1:{ name:'訓練ノート（小）', img:'it_note1', exp:100 }, note2:{ name:'訓練ノート（中）', img:'it_note2', exp:400 }, note3:{ name:'訓練ノート（大）', img:'it_note3', exp:1500 },
    chipA:{ name:'強化チップ（攻撃）', img:'it_chipA' }, chipD:{ name:'強化チップ（防御）', img:'it_chipD' }, star:{ name:'星の結晶', img:'it_star' },
  };
  const AP_MAX = 100, LV_MAX = 30, CHIP_MAX = 10, HAND = 5, ENERGY = 3;
  const BGM = { fight:L('meet_a_bgm.mp3', 118), win:L('ops_result_bgm.mp3', 76.0026) };

  // ===== 保存データ =====
  let S = null, scr = null, B = null, lastWin = false;
  const fresh = () => ({ id:'bt-state', ap:60, apLog:{}, party:['hoshino', 'mika', 'mari', 'hina'],
    ch:Object.fromEntries(KEYS.map(k => [k, { lv:1, exp:0, ca:0, cd:0, evo:{} }])),
    it:{ note1:6, note2:2, note3:0, chipA:0, chipD:0, star:0 }, clr:{} });
  async function load() {
    if (S) return S;
    const r = await DB.get('room', 'bt-state').catch(() => null);
    S = r || fresh();
    KEYS.forEach(k => { if (!S.ch[k]) S.ch[k] = { lv:1, exp:0, ca:0, cd:0, evo:{} }; });
    return S;
  }
  const save = () => DB.put('room', S).catch(() => {});
  // AP回復（Todo完了・ごはん記録から呼ばれる。同じものでは1回だけ）
  async function gainAP(key, n) {
    await load();
    if (S.apLog[key]) return;
    const lim = Date.now() - 60 * 86400000;
    Object.keys(S.apLog).forEach(k => { if (S.apLog[k] < lim) delete S.apLog[k]; });
    S.apLog[key] = Date.now();
    S.ap = Math.min(AP_MAX, S.ap + n);
    await save();
    if (scr === 'hub') paintHub();
  }

  // ===== 数値 =====
  const needExp = lv => 60 + lv * 40;
  const atkMul = k => 1 + .06 * (S.ch[k].lv - 1) + .05 * S.ch[k].ca;
  const supMul = k => 1 + .04 * (S.ch[k].lv - 1);
  const maxHp = k => Math.round(CH[k].hp * (1 + .07 * (S.ch[k].lv - 1)) + S.ch[k].cd * 5);
  const cardOf = (k, ty, evo) => { const c = CARD[k][ty]; return evo && c.evo ? c.evo : c; };
  const artOf = (k, ty, evo) => {
    const a = ART[k] || [];
    if (evo && a.includes(ty + '_evo')) return `bt_c_${k}_${ty}_evo.webp`;
    if (a.includes(ty)) return `bt_c_${k}_${ty}.webp`;
    return null;
  };
  // カードの説明文（数値は今の育成状況で計算）
  function cardText(k, c, fx = null) {
    const a = fx ? fx.atk : atkMul(k), s = fx ? fx.sup : supMul(k);
    const D = n => Math.round(n * a), P = n => Math.round(n * s);
    const tx = { dmg:o => `敵1体に${D(o[1])}ダメージ${o[2] > 1 ? `×${o[2]}` : ''}`, dmgAll:o => `敵全体に${D(o[1])}ダメージ`,
      shield:o => `味方1人にシールド${P(o[1])}`, shieldSelf:o => `自分にシールド${P(o[1])}`, shieldAll:o => `味方全員にシールド${P(o[1])}`,
      heal:o => `味方1人のHPを${P(o[1])}回復`, healAll:o => `味方全員のHPを${P(o[1])}回復`,
      taunt:o => `自分に挑発（敵の攻撃を引きつける）`, atkUp:o => `味方1人に攻撃UP（${o[1]}ターン）`, atkUpSelf:o => `自分に攻撃UP（${o[1]}ターン）`, atkUpAll:o => `味方全員に攻撃UP（${o[1]}ターン）`,
      weak:o => `脆弱（${o[1]}ターン）`, weakAll:o => `敵全体に脆弱（${o[1]}ターン）`, stun:() => 'スタン（次の行動を止める）', stunAll:() => '敵全体をスタン',
      draw:o => `カードを${o[1]}枚引く`, energy:o => `コスト+${o[1]}`,
      regen:o => `味方1人に継続回復${P(o[1])}（${o[2]}ターン）`, regenAll:o => `味方全員に継続回復${P(o[1])}（${o[2]}ターン）`,
      cleanse:() => '弱体を解除', cleanseAll:() => '味方全員の弱体を解除', revive:o => `戦闘不能の味方をHP${o[1]}%で復活`,
      exAll:o => `ほかの味方のEXゲージ+${o[1]}`, refund:() => '倒したらコスト+1' };
    return c.o.map(o => tx[o[0]](o)).join('。');
  }
  const tgtOf = c => c.o.some(o => ['dmg', 'weak', 'stun'].includes(o[0])) ? 'foe'
    : c.o.some(o => ['shield', 'heal', 'atkUp', 'regen', 'cleanse'].includes(o[0])) ? 'ally' : 'none';
  const kindOf = c => { const t = c.o.map(o => o[0]).join(' ');
    return /dmg/.test(t) ? 'atk' : /heal|regen|revive/.test(t) ? 'heal' : /shield/.test(t) ? 'def' : 'sup'; };

  // ===== 小物 =====
  const icon = {
    atk:'<svg viewBox="0 0 24 24"><path d="M4 20l9-9M14 4l6 6-8 8-6-6z" /></svg>',
    aoe:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3"/></svg>',
    shield:'<svg viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/></svg>',
    buff:'<svg viewBox="0 0 24 24"><path d="M12 4l7 8h-4v8H9v-8H5z"/></svg>',
    charge:'<svg viewBox="0 0 24 24"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>',
    weakT:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M8 8l8 8M16 8l-8 8"/></svg>',
    stun:'<svg viewBox="0 0 24 24"><path d="M12 3v3M12 18v3M4 12H3M21 12h-1M6 6l1 1M17 17l1 1M6 18l1-1M17 7l1-1"/><circle cx="12" cy="12" r="4"/></svg>',
  };
  function sfx(kind) {
    try {
      const t = ctx.currentTime, g = ctx.createGain(); g.connect(ctx.destination);
      const tone = (f, a, d, type = 'sine', at = 0, f2 = null) => { const o = ctx.createOscillator(), gg = ctx.createGain(); o.type = type;
        o.frequency.setValueAtTime(f, t + at); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + at + d);
        gg.gain.setValueAtTime(a, t + at); gg.gain.exponentialRampToValueAtTime(.001, t + at + d); o.connect(gg); gg.connect(g); o.start(t + at); o.stop(t + at + d + .05); };
      const noise = (a, d, at = 0, hp = 800) => { const n = ctx.createBufferSource(), len = Math.floor(ctx.sampleRate * d), b = ctx.createBuffer(1, len, ctx.sampleRate), ch = b.getChannelData(0);
        for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len); n.buffer = b; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
        const gg = ctx.createGain(); gg.gain.value = a; n.connect(f); f.connect(gg); gg.connect(g); n.start(t + at); };
      ({ tap:() => tone(880, .05, .06, 'triangle'),
         card:() => { tone(520, .06, .08, 'triangle'); tone(780, .05, .1, 'triangle', .04); },
         hit:() => { noise(.22, .14, 0, 1200); tone(140, .18, .12, 'square', 0, 60); },
         big:() => { noise(.3, .3, 0, 400); tone(90, .3, .35, 'sawtooth', 0, 40); },
         shield:() => { tone(660, .06, .25, 'sine', 0, 990); tone(990, .04, .3, 'sine', .05); },
         heal:() => [523, 659, 784].forEach((f, i) => tone(f, .05, .3, 'sine', i * .06)),
         hurt:() => { noise(.18, .16, 0, 600); tone(220, .12, .15, 'sawtooth', 0, 110); },
         ex:() => { noise(.12, .6, 0, 2000); tone(300, .1, .6, 'sawtooth', 0, 1200); },
         turn:() => { tone(660, .06, .1, 'square'); tone(990, .05, .12, 'square', .09); },
         win:() => [523, 659, 784, 1046].forEach((f, i) => tone(f, .08, .4, 'triangle', i * .11)),
         lose:() => [392, 330, 262].forEach((f, i) => tone(f, .08, .45, 'triangle', i * .18)),
         down:() => tone(300, .12, .5, 'sawtooth', 0, 80),
         ng:() => tone(180, .08, .15, 'square'),
       })[kind]();
    } catch(e) {}
  }
  const faceImg = k => `bt_f_${k}.webp`;
  const tachie = (k, n = 1) => `bt_t_${k}${k === 'kisaki' ? 1 : n}.webp`;
  const itemImg = k => ITEM[k].img + '.webp';

  // ===== 画面の骨組み =====
  function build() {
    const o = h(`<div id="bt">
      <div class="bt-grid"><i></i></div>
      <section class="bt-sc bt-hub">
        <div class="bt-top"><button class="bt-back" data-act="out">‹ 作戦室</button><div class="bt-ttl">実戦<small>SIMULATION ROOM</small></div><div class="bt-ap" id="btAp"></div></div>
        <div class="bt-stage-floor" id="btParty"></div>
        <div class="bt-menu">
          <button class="bt-go" data-act="stages"><b>演習に出撃</b><small>SORTIE</small></button>
          <div class="bt-row"><button class="bt-sub" data-act="form"><b>編成</b><small>FORMATION</small></button><button class="bt-sub" data-act="train"><b>育成</b><small>TRAINING</small></button></div>
          <button class="bt-sub bt-dis" data-act="story"><b>ストーリー</b><small>COMING SOON</small></button>
        </div>
        <div class="bt-hint">AP回復：Todoを完了 <b>+10</b>／ごはんを記録 <b>+5</b></div>
      </section>
      <section class="bt-sc bt-stg">
        <div class="bt-top"><button class="bt-back" data-act="hub">‹ 戻る</button><div class="bt-ttl">演習<small>SELECT STAGE</small></div><div class="bt-ap" id="btAp2"></div></div>
        <div class="bt-list" id="btStages"></div>
      </section>
      <section class="bt-sc bt-trn">
        <div class="bt-top"><button class="bt-back" data-act="hub">‹ 戻る</button><div class="bt-ttl">育成<small>TRAINING</small></div><div class="bt-ap"></div></div>
        <div class="bt-faces" id="btFaces"></div>
        <div class="bt-tview" id="btTrain"></div>
      </section>
      <section class="bt-sc bt-fight">
        <div class="bt-ftop"><button class="bt-back" data-act="retreat">撤退</button><div class="bt-turn" id="btTurn"></div><div class="bt-pile" id="btPile"></div></div>
        <div class="bt-foes" id="btFoes"></div>
        <div class="bt-allies" id="btAllies"></div>
        <div class="bt-hand-zone">
          <div class="bt-energy" id="btEnergy"></div>
          <div class="bt-hand" id="btHand"></div>
          <button class="bt-end" id="btEnd" data-act="end">ターン<br>終了</button>
        </div>
        <div class="bt-peek" id="btPeek"></div>
        <div class="bt-banner" id="btBanner"></div>
        <div class="bt-fx" id="btFx"></div>
      </section>
      <div class="bt-cut" id="btCut"></div>
      <div class="bt-modal" id="btModal"></div>
    </div>`);
    document.body.appendChild(o);
    o.addEventListener('click', onClick);
  }

  // ===== 出入り =====
  async function open() {
    await load();
    if (!$('bt')) build();
    ctx.resume();
    $('bt').className = 'show';
    show('hub');
  }
  function close() {
    $('bt').classList.add('out');
    setTimeout(() => { $('bt').className = ''; scr = null; syncBgm(0, .8); }, 350);
  }
  function show(s) {
    scr = s;
    const el = $('bt'); el.dataset.scr = s;
    if (s === 'hub') paintHub();
    if (s === 'stages') paintStages();
    if (s === 'train') paintTrain();
    syncBgm(0, .8);
  }
  const apHTML = () => `<i>AP</i><b>${S.ap}</b><span>/${AP_MAX}</span>`;

  // ===== ロビー（編成の4人が並ぶ） =====
  function paintHub() {
    $('btAp').innerHTML = apHTML();
    const pos = [[16, 0], [38, 3], [62, 3], [84, 0]];
    $('btParty').innerHTML = S.party.map((k, i) => {
      const r = ROLE[CH[k].role];
      return `<div class="bt-pm" style="left:${pos[i][0]}%;z-index:${i === 1 || i === 2 ? 2 : 1};--d:${i * .08}s" data-act="form">
        <img src="${tachie(k, 2)}" alt=""><div class="bt-plate"><b>${CH[k].name}</b><span class="bt-role ${r[1]}">${r[0]}</span><em>Lv.${S.ch[k].lv}</em></div></div>`;
    }).join('');
  }

  // ===== 編成 =====
  function formation() {
    let pick = S.party.slice();
    const draw = () => {
      $('btModal').innerHTML = `<div class="bt-sheet"><div class="bt-sh-h"><b>編成</b><small>4人を選んでください（タップした順）</small></div>
        <div class="bt-fgrid">${KEYS.map(k => { const i = pick.indexOf(k), r = ROLE[CH[k].role];
          return `<button class="bt-fc${i >= 0 ? ' on' : ''}" data-k="${k}"><img src="${faceImg(k)}" alt="">${i >= 0 ? `<i>${i + 1}</i>` : ''}
            <b>${CH[k].name}</b><span class="bt-role ${r[1]}">${r[0]}</span><em>Lv.${S.ch[k].lv}</em></button>`; }).join('')}</div>
        <div class="bt-sh-b"><button class="bt-ghost" data-m="x">やめる</button><button class="bt-ok" data-m="ok" ${pick.length === 4 ? '' : 'disabled'}>決定</button></div></div>`;
    };
    draw(); $('btModal').className = 'bt-modal on';
    $('btModal').onclick = e => {
      const c = e.target.closest('.bt-fc');
      if (c) { const k = c.dataset.k, i = pick.indexOf(k); if (i >= 0) pick.splice(i, 1); else if (pick.length < 4) pick.push(k); else { sfx('ng'); return; } sfx('tap'); draw(); return; }
      const m = e.target.closest('[data-m]'); if (!m && e.target !== $('btModal')) return;
      if (m && m.dataset.m === 'ok') { S.party = pick; save(); paintHub(); sfx('card'); }
      modalClose();
    };
  }
  function modalClose() { $('btModal').className = 'bt-modal'; $('btModal').innerHTML = ''; $('btModal').onclick = null; }

  // ===== ステージ選択 =====
  function paintStages() {
    $('btAp2').innerHTML = apHTML();
    $('btStages').innerHTML = STAGES.map((st, i) => {
      const lock = i > 0 && !S.clr[STAGES[i - 1].id], stars = S.clr[st.id] || 0, boss = st.foes.some(f => FOE[f].boss);
      return `<button class="bt-stc${lock ? ' lock' : ''}${boss ? ' boss' : ''}" data-st="${i}">
        <div class="bt-stn"><small>PRACTICE ${i + 1}</small><b>${st.name}</b><span>${'★'.repeat(stars)}<i>${'★'.repeat(3 - stars)}</i></span></div>
        <div class="bt-ste">${st.foes.map(f => `<img src="${FOE[f].img}.webp" alt="">`).join('')}</div>
        <div class="bt-stap">${lock ? '🔒' : `AP <b>${st.ap}</b>`}</div></button>`;
    }).join('') + `<div class="bt-note">★1 クリア　★2 誰も倒れずにクリア　★3 規定ターン以内にクリア<br>初回クリアで星の結晶がもらえます</div>`;
    $('btStages').onclick = e => {
      const b = e.target.closest('.bt-stc'); if (!b) return;
      const i = +b.dataset.st, st = STAGES[i];
      if (b.classList.contains('lock')) { sfx('ng'); return toast('前の演習をクリアすると挑戦できます'); }
      sfx('tap'); stageInfo(i);
    };
  }
  function stageInfo(i) {
    const st = STAGES[i], first = !S.clr[st.id];
    $('btModal').innerHTML = `<div class="bt-sheet"><div class="bt-sh-h"><b>演習${i + 1}　${st.name}</b><small>★3：${st.t3}ターン以内　／　消費AP ${st.ap}</small></div>
      <div class="bt-foe-info">${[...new Set(st.foes)].map(f => { const F = FOE[f];
        return `<div><img src="${F.img}.webp" alt=""><b>${F.name}</b><small>HP ${Math.round(F.hp * st.m)}${F.boss ? '・ボス' : ''}</small></div>`; }).join('')}</div>
      <div class="bt-drop"><small>報酬</small>${(first ? st.first.concat(st.drop) : st.drop).map(([k, n]) => `<span><img src="${itemImg(k)}" alt="">×${n}</span>`).join('')}<span class="exp">EXP ${st.exp}</span></div>
      <div class="bt-sh-team">${S.party.map(k => `<img src="${faceImg(k)}" alt="">`).join('')}<button class="bt-ghost" data-m="form">編成</button></div>
      <div class="bt-sh-b"><button class="bt-ghost" data-m="x">やめる</button><button class="bt-ok" data-m="go" ${S.ap < st.ap ? 'disabled' : ''}>${S.ap < st.ap ? 'APが足りません' : '出撃'}</button></div></div>`;
    $('btModal').className = 'bt-modal on';
    $('btModal').onclick = e => {
      const m = e.target.closest('[data-m]'); if (!m && e.target !== $('btModal')) return;
      if (m && m.dataset.m === 'form') { modalClose(); return formation(); }
      modalClose();
      if (m && m.dataset.m === 'go') { S.ap -= st.ap; save(); start(i); }
    };
  }

  // ===== 育成 =====
  let tk = 'hoshino';
  function paintTrain() {
    $('bt').querySelector('.bt-trn .bt-ap').innerHTML = apHTML();
    $('btFaces').innerHTML = KEYS.map(k => `<button class="${k === tk ? 'on' : ''}" data-tk="${k}"><img src="${faceImg(k)}" alt=""><em>${S.ch[k].lv}</em></button>`).join('');
    const c = S.ch[tk], r = ROLE[CH[tk].role], need = needExp(c.lv);
    const its = ['note1', 'note2', 'note3'].map(k => `<button class="bt-it" data-use="${k}" ${S.it[k] && c.lv < LV_MAX ? '' : 'disabled'}><img src="${itemImg(k)}" alt=""><small>EXP+${ITEM[k].exp}</small><i>×${S.it[k]}</i></button>`).join('')
      + `<button class="bt-it" data-use="chipA" ${S.it.chipA && c.ca < CHIP_MAX ? '' : 'disabled'}><img src="${itemImg('chipA')}" alt=""><small>攻撃 ${c.ca}/${CHIP_MAX}</small><i>×${S.it.chipA}</i></button>`
      + `<button class="bt-it" data-use="chipD" ${S.it.chipD && c.cd < CHIP_MAX ? '' : 'disabled'}><img src="${itemImg('chipD')}" alt=""><small>防御 ${c.cd}/${CHIP_MAX}</small><i>×${S.it.chipD}</i></button>`;
    const cards = SETS[CH[tk].set].map(ty => {
      const evo = !!c.evo[ty], ev = EVO_TY[ty];
      return `<div class="bt-tc">${cardHTML(tk, ty, evo, false, `data-card="${ty}"`)}
        ${ev ? (evo ? '<span class="bt-evd">進化済み</span>' : `<button class="bt-evo" data-evo="${ty}">進化<small>Lv${ev === 1 ? 10 : 20}・結晶${ev === 1 ? 3 : 5}</small></button>`) : '<span class="bt-evn">　</span>'}</div>`;
    }).join('');
    const exc = CARD[tk].ex;
    $('btTrain').innerHTML = `<div class="bt-thero"><img src="${tachie(tk, 2)}" alt=""></div>
      <div class="bt-tinfo"><div class="bt-tname"><b>${CH[tk].name}</b><span class="bt-role ${r[1]}">${r[0]}</span></div>
        <div class="bt-lv">Lv.<b>${c.lv}</b><span>/${LV_MAX}</span><div class="bt-xp"><i style="width:${c.lv >= LV_MAX ? 100 : c.exp / need * 100}%"></i></div><small>${c.lv >= LV_MAX ? 'MAX' : `${c.exp}/${need}`}</small></div>
        <div class="bt-st"><span>HP<b>${maxHp(tk)}</b></span><span>攻撃<b>${Math.round(atkMul(tk) * 100)}%</b></span><span>回復・防御<b>${Math.round(supMul(tk) * 100)}%</b></span></div>
        <div class="bt-exs"><small>EXスキル</small><b>${exc.n}</b><p>${cardText(tk, exc)}</p></div>
      </div>
      <div class="bt-its">${its}<div class="bt-star"><img src="${itemImg('star')}" alt="">星の結晶 ×${S.it.star}</div></div>
      <div class="bt-tcs">${cards}</div>`;
  }
  function useItem(k) {
    const c = S.ch[tk];
    if (!S.it[k]) return;
    if (ITEM[k].exp) {
      if (c.lv >= LV_MAX) return;
      S.it[k]--; c.exp += ITEM[k].exp;
      let up = 0; while (c.lv < LV_MAX && c.exp >= needExp(c.lv)) { c.exp -= needExp(c.lv); c.lv++; up++; }
      if (c.lv >= LV_MAX) c.exp = 0;
      sfx(up ? 'win' : 'heal'); if (up) toast(`${CH[tk].name} Lv.${c.lv} にアップ！`);
    } else if (k === 'chipA' && c.ca < CHIP_MAX) { S.it[k]--; c.ca++; sfx('shield'); }
    else if (k === 'chipD' && c.cd < CHIP_MAX) { S.it[k]--; c.cd++; sfx('shield'); }
    save(); paintTrain();
  }
  function evolve(ty) {
    const c = S.ch[tk], ev = EVO_TY[ty], lv = ev === 1 ? 10 : 20, cost = ev === 1 ? 3 : 5;
    if (c.lv < lv) { sfx('ng'); return toast(`Lv.${lv}になると進化できます`); }
    if (S.it.star < cost) { sfx('ng'); return toast(`星の結晶が${cost}個必要です`); }
    const a = CARD[tk][ty], b = a.evo;
    $('btModal').innerHTML = `<div class="bt-sheet"><div class="bt-sh-h"><b>カード進化</b><small>星の結晶を${cost}個使います</small></div>
      <div class="bt-evv">${cardHTML(tk, ty, false, true)}<i>›</i>${cardHTML(tk, ty, true, true)}</div>
      <p class="bt-evt"><b>${b.n}</b>${cardText(tk, b)}</p>
      <div class="bt-sh-b"><button class="bt-ghost" data-m="x">やめる</button><button class="bt-ok" data-m="ok">進化する</button></div></div>`;
    $('btModal').className = 'bt-modal on';
    $('btModal').onclick = e => {
      const m = e.target.closest('[data-m]'); if (!m && e.target !== $('btModal')) return;
      modalClose();
      if (m && m.dataset.m === 'ok') { S.it.star -= cost; c.evo[ty] = 1; save(); sfx('ex'); flashEvo(); paintTrain(); }
    };
  }
  function cardInfo(ty) {
    sfx('tap');
    const evo = !!S.ch[tk].evo[ty], c = cardOf(tk, ty, evo), nx = !evo && CARD[tk][ty].evo;
    $('btModal').innerHTML = `<div class="bt-sheet"><div class="bt-evv">${cardHTML(tk, ty, evo, true)}${nx ? `<i>›</i>${cardHTML(tk, ty, true, true)}` : ''}</div>
      <p class="bt-evt"><b>${c.n}（コスト${c.c}）</b>${cardText(tk, c)}</p>${nx ? `<p class="bt-evt nx"><b>進化後：${nx.n}</b>${cardText(tk, nx)}</p>` : ''}
      <div class="bt-sh-b"><button class="bt-ghost" data-m="x">閉じる</button></div></div>`;
    $('btModal').className = 'bt-modal on';
    $('btModal').onclick = e => { if (e.target.closest('[data-m]') || e.target === $('btModal')) modalClose(); };
  }
  function flashEvo() { const f = h('<div class="bt-evflash"></div>'); $('bt').appendChild(f); setTimeout(() => f.remove(), 900); }

  // ===== カードの見た目 =====
  function cardHTML(k, ty, evo, big = false, extra = '') {
    const c = cardOf(k, ty, evo), art = artOf(k, ty, evo), kind = ty === 'ex' ? 'ex' : kindOf(c);
    const img = art ? `<img class="bt-ca" src="${art}" alt="">` : `<img class="bt-ca bt-cat" src="${tachie(k, 1)}" alt="" style="--fx:${CH[k].face[0]};--fy:${CH[k].face[1]}">`;
    return `<div class="bt-card k-${kind}${evo ? ' evo' : ''}${big ? ' big' : ''}" ${extra}>${img}
      <i class="bt-cc">${c.c}</i><img class="bt-cf" src="${faceImg(k)}" alt=""><div class="bt-cn">${evo ? '<em>★</em>' : ''}${c.n}</div>${big ? `<div class="bt-ct">${cardText(k, c)}</div>` : ''}</div>`;
  }

  // ===== 戦闘 =====
  function start(si) {
    const st = STAGES[si], dm = 1 + (st.m - 1) * .8;
    B = { si, st, dm, round:0, energy:ENERGY, sel:null, busy:true, over:false,
      allies:S.party.map(k => ({ k, max:maxHp(k), hp:maxHp(k), sh:0, st:{}, ex:0, down:false, atk:atkMul(k), sup:supMul(k) })),
      foes:st.foes.map((t, i) => { const F = FOE[t], hp = Math.round(F.hp * st.m); return { t, i, hp, max:hp, sh:0, st:{}, pi:Math.floor(Math.random() * F.pat.length), it:null, tgt:-1, dead:false }; }),
      deck:[], hand:[], disc:[], uid:0, downed:0 };
    S.party.forEach(k => DECK_OF[CH[k].set].forEach(ty => B.deck.push({ u:++B.uid, k, ty, evo:!!S.ch[k].evo[ty] })));
    shuffle(B.deck);
    show('fight');
    $('btFoes').innerHTML = ''; $('btAllies').innerHTML = '';
    paintFoes(); paintAllies(); paintHand();
    setTimeout(playerTurn, 400);
  }
  const alive = () => B.allies.filter(a => !a.down);
  const liveFoes = () => B.foes.filter(f => !f.dead);
  const on = (o, key) => o.st[key] && o.st[key] >= B.round;
  function draw(n) {
    for (let i = 0; i < n; i++) {
      if (!B.deck.length) { if (!B.disc.length) break; B.deck = shuffle(B.disc); B.disc = []; }
      if (B.hand.length >= 8) break;
      B.hand.push(B.deck.pop());
    }
  }
  async function playerTurn() {
    if (B.over) return;
    B.round++;
    B.energy = ENERGY;
    B.allies.forEach(a => { a.sh = 0; });
    // 継続回復
    for (const a of alive()) if (a.st.regen && a.st.regen.u >= B.round) { heal(a, a.st.regen.n); }
    liveFoes().forEach(f => decide(f));
    draw(HAND);
    paintAll();
    await banner(`TURN ${B.round}`, 'PLAYER PHASE');
    B.busy = false; paintHand();
  }
  // 敵の次の行動を決める（予告として表示）
  function decide(f) {
    const F = FOE[f.t];
    f.it = F.pat[f.pi % F.pat.length]; f.pi++;
    f.tgt = ['atk', 'weakT'].includes(f.it[0]) ? pickTarget() : -1;
  }
  function pickTarget() {
    const t = B.allies.findIndex(a => !a.down && on(a, 'taunt'));
    if (t >= 0) return t;
    const al = B.allies.map((a, i) => i).filter(i => !B.allies[i].down);
    return al[Math.floor(Math.random() * al.length)];
  }
  function retarget() {   // 挑発が付いたら、単体攻撃の狙いを変える
    const t = B.allies.findIndex(a => !a.down && on(a, 'taunt')); if (t < 0) return;
    liveFoes().forEach(f => { if (f.tgt >= 0) f.tgt = t; });
  }
  // 予告ダメージ（味方ごと）
  function incoming() {
    const inc = B.allies.map(() => 0);
    liveFoes().forEach(f => {
      if (!f.it) return;
      const m = B.dm * (on(f, 'atkUp') ? 1.3 : 1);
      if (f.it[0] === 'atk' && f.tgt >= 0) inc[f.tgt] += Math.round(f.it[1] * m * (on(B.allies[f.tgt], 'weak') ? 1.3 : 1)) * (f.it[2] || 1);
      if (f.it[0] === 'aoe') B.allies.forEach((a, i) => { if (!a.down) inc[i] += Math.round(f.it[1] * m * (on(a, 'weak') ? 1.3 : 1)); });
    });
    return inc;
  }

  // ----- 描画 -----
  function paintAll() { paintFoes(); paintAllies(); paintHand(); }
  function paintFoes() {
    const n = B.foes.length, el = $('btFoes');
    if (!el.children.length || el.children.length !== n) {
      el.innerHTML = B.foes.map((f, i) => { const F = FOE[f.t];
        return `<div class="bt-foe${F.fly ? ' fly' : ''}${F.boss ? ' boss' : ''}" data-fi="${i}" style="left:${(i + .5) / n * 100}%;--h:${F.h}%;--w:${100 / n}%">
          <div class="bt-int"></div><img src="${F.img}.webp" alt=""><div class="bt-fhp"><b>${F.name}</b><div class="bt-bar"><i></i><s></s></div><span></span><div class="bt-sts"></div></div></div>`; }).join('');
    }
    B.foes.forEach((f, i) => {
      const e = el.children[i];
      e.classList.toggle('dead', f.dead);
      e.querySelector('.bt-bar i').style.width = f.hp / f.max * 100 + '%';
      e.querySelector('.bt-bar s').style.width = Math.min(100, f.sh / f.max * 100) + '%';
      e.querySelector('.bt-fhp span').innerHTML = `${f.hp}/${f.max}${f.sh ? ` <em>🛡${f.sh}</em>` : ''}`;
      e.querySelector('.bt-sts').innerHTML = (on(f, 'weak') ? '<i class="w">脆弱</i>' : '') + (on(f, 'atkUp') ? '<i class="u">攻↑</i>' : '');
      e.querySelector('.bt-int').innerHTML = f.dead || !f.it ? '' : intentHTML(f);
    });
  }
  function intentHTML(f) {
    const it = f.it, m = B.dm * (on(f, 'atkUp') ? 1.3 : 1), ty = it[0];
    if (ty === 'stunned') return `<div class="bt-ic stn">${icon.stun}<b>スタン</b></div>`;
    const tg = f.tgt >= 0 ? `<img src="${faceImg(B.allies[f.tgt].k)}" alt="">` : '';
    if (ty === 'atk') return `<div class="bt-ic atk">${icon.atk}<b>${Math.round(it[1] * m)}${it[2] > 1 ? `×${it[2]}` : ''}</b>${tg}</div>`;
    if (ty === 'aoe') return `<div class="bt-ic aoe">${icon.aoe}<b>${Math.round(it[1] * m)}</b><small>全体</small></div>`;
    if (ty === 'shield') return `<div class="bt-ic def">${icon.shield}<b>${Math.round(it[1] * B.dm)}</b></div>`;
    if (ty === 'buff') return `<div class="bt-ic buf">${icon.buff}<small>攻撃UP</small></div>`;
    if (ty === 'charge') return `<div class="bt-ic chg">${icon.charge}<small>力をためている</small></div>`;
    if (ty === 'weakT') return `<div class="bt-ic deb">${icon.weakT}<small>脆弱</small>${tg}</div>`;
    return '';
  }
  function paintAllies() {
    const el = $('btAllies'), inc = B.over ? [] : incoming();
    if (!el.children.length) {
      el.innerHTML = B.allies.map((a, i) => { const [fx, fy] = CH[a.k].face;
        return `<div class="bt-al" data-ai="${i}" style="--fx:${fx};--fy:${fy}"><div class="bt-alv"><img src="${tachie(a.k, 1)}" alt=""></div>
          <div class="bt-inc"></div><div class="bt-exr"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15"/><circle class="v" cx="18" cy="18" r="15"/></svg><b>EX</b></div>
          <div class="bt-ast"></div><div class="bt-ahp"><div class="bt-bar"><i></i><s></s></div><span></span></div></div>`; }).join('');
    }
    B.allies.forEach((a, i) => {
      const e = el.children[i];
      e.classList.toggle('down', a.down);
      e.classList.toggle('exok', !a.down && a.ex >= 100);
      e.querySelector('.bt-bar i').style.width = a.hp / a.max * 100 + '%';
      e.querySelector('.bt-bar s').style.width = Math.min(100, a.sh / a.max * 100) + '%';
      e.querySelector('.bt-ahp span').innerHTML = a.down ? '戦闘不能' : `${a.hp}/${a.max}${a.sh ? ` <em>🛡${a.sh}</em>` : ''}`;
      e.querySelector('.bt-exr .v').style.strokeDashoffset = 94.25 * (1 - a.ex / 100);
      const d = inc[i] ? Math.max(0, inc[i] - a.sh) : 0;
      e.querySelector('.bt-inc').innerHTML = !a.down && inc[i] ? `<b class="${d ? '' : 'safe'}">${d ? '-' + d : '防御OK'}</b>` : '';
      e.querySelector('.bt-ast').innerHTML = (on(a, 'taunt') ? '<i class="t">挑発</i>' : '') + (on(a, 'atkUp') ? '<i class="u">攻↑</i>' : '')
        + (on(a, 'weak') ? '<i class="w">脆弱</i>' : '') + (a.st.regen && a.st.regen.u >= B.round ? '<i class="r">再生</i>' : '');
    });
  }
  function paintHand() {
    $('btTurn').innerHTML = `TURN <b>${B.round}</b>`;
    $('btPile').innerHTML = `<span>山札 ${B.deck.length}</span><span>捨札 ${B.disc.length}</span>`;
    $('btEnergy').innerHTML = `<b>${B.energy}</b><small>/${ENERGY}</small>`;
    const n = B.hand.length, W = $('btHand').clientWidth || 300, cw = Math.min(94, W / 4.1), step = n > 1 ? Math.min(cw * .92, (W - cw) / (n - 1)) : 0, x0 = (W - cw - step * (n - 1)) / 2;
    $('btHand').innerHTML = B.hand.map((c, i) => {
      const a = B.allies.find(x => x.k === c.k), cd = cardOf(c.k, c.ty, c.evo), ok = !a.down && cd.c <= B.energy && !B.busy;
      const rot = n > 1 ? (i - (n - 1) / 2) * 3 : 0, y = Math.abs(i - (n - 1) / 2) * 3;
      return cardHTML(c.k, c.ty, c.evo, false, `data-hi="${i}" style="left:${x0 + step * i}px;width:${cw}px;--r:${rot}deg;--y:${y}px"`)
        .replace('class="bt-card', `class="bt-card${ok ? '' : ' no'}${a.down ? ' dn' : ''}${B.sel && B.sel.u === c.u ? ' sel' : ''}`);
    }).join('');
    $('btEnd').disabled = B.busy;
    $('bt').classList.toggle('bt-tf', !!(B.sel && B.selT === 'foe'));
    $('bt').classList.toggle('bt-ta', !!(B.sel && B.selT === 'ally'));
    paintPeek();
  }
  function paintPeek() {
    const p = $('btPeek');
    if (!B.sel) { p.className = 'bt-peek'; p.innerHTML = ''; return; }
    const c = B.sel, cd = c.ty === 'ex' ? CARD[c.k].ex : cardOf(c.k, c.ty, c.evo), a = B.allies.find(x => x.k === c.k);
    const fx = { atk:a.atk * (on(a, 'atkUp') ? 1.3 : 1), sup:a.sup };
    const hint = B.selT === 'foe' ? '攻撃する敵をタップ' : B.selT === 'ally' ? '対象の味方をタップ' : '';
    p.innerHTML = `<div class="bt-pk ${c.ty === 'ex' ? 'k-ex' : 'k-' + kindOf(cd)}"><b>${c.ty === 'ex' ? 'EX　' : ''}${cd.n}</b><p>${cardText(c.k, cd, fx)}</p>
      ${hint ? `<small>${hint}</small>` : `<button class="bt-use" data-act="use">使う</button>`}</div>`;
    p.className = 'bt-peek on';
  }

  // ----- 入力 -----
  function onClick(e) {
    const t = e.target;
    const act = t.closest('[data-act]');
    if (act) {
      const a = act.dataset.act;
      if (a === 'out') { sfx('tap'); return close(); }
      if (a === 'hub') { sfx('tap'); return show('hub'); }
      if (a === 'stages') { sfx('tap'); return show('stages'); }
      if (a === 'form') { sfx('tap'); return formation(); }
      if (a === 'train') { sfx('tap'); return show('train'); }
      if (a === 'story') { sfx('ng'); return toast('ストーリーは準備中です'); }
      if (a === 'retreat') return retreat();
      if (a === 'end') return endTurn();
      if (a === 'use') return useSel(null);
    }
    if (scr === 'train') {
      const f = t.closest('[data-tk]'); if (f) { tk = f.dataset.tk; sfx('tap'); return paintTrain(); }
      const u = t.closest('[data-use]'); if (u) return useItem(u.dataset.use);
      const v = t.closest('[data-evo]'); if (v) return evolve(v.dataset.evo);
      const cc = t.closest('[data-card]'); if (cc) return cardInfo(cc.dataset.card);
      return;
    }
    if (scr !== 'fight' || !B || B.busy) return;
    const hc = t.closest('[data-hi]');
    if (hc) return pickCard(B.hand[+hc.dataset.hi]);
    const fo = t.closest('[data-fi]');
    if (fo && B.sel && B.selT === 'foe') { const f = B.foes[+fo.dataset.fi]; if (!f.dead) return useSel({ foe:f }); }
    const al = t.closest('[data-ai]');
    if (al) {
      const a = B.allies[+al.dataset.ai];
      if (B.sel && B.selT === 'ally') { if (a.down) { sfx('ng'); return toast('戦闘不能の味方には使えません'); } return useSel({ ally:a }); }
      if (!a.down && a.ex >= 100) return pickEx(a);
      if (!B.sel) { sfx('tap'); return allyInfo(a); }
    }
    if (B.sel && !t.closest('.bt-peek')) { B.sel = null; paintHand(); }
  }
  function pickCard(c) {
    const a = B.allies.find(x => x.k === c.k), cd = cardOf(c.k, c.ty, c.evo);
    if (B.sel && B.sel.u === c.u) { if (B.selT === 'none') return useSel(null); B.sel = null; return paintHand(); }
    if (a.down) { sfx('ng'); return toast(`${CH[c.k].name}は戦闘不能です`); }
    if (cd.c > B.energy) { sfx('ng'); return toast('コストが足りません'); }
    sfx('tap'); B.sel = c; B.selT = tgtOf(cd); paintHand();
  }
  function pickEx(a) {
    sfx('tap');
    const cd = CARD[a.k].ex;
    B.sel = { u:-1, k:a.k, ty:'ex' }; B.selT = tgtOf(cd); paintHand();
  }
  function allyInfo(a) {
    const msg = `${CH[a.k].name}　HP ${a.hp}/${a.max}　EX ${Math.floor(a.ex)}%`;
    toast(msg, 1800);
  }
  async function useSel(tg) {
    const c = B.sel; if (!c) return;
    const isEx = c.ty === 'ex', cd = isEx ? CARD[c.k].ex : cardOf(c.k, c.ty, c.evo), a = B.allies.find(x => x.k === c.k);
    if (!isEx && cd.c > B.energy) { sfx('ng'); return; }
    B.busy = true; B.sel = null;
    if (isEx) { a.ex = 0; paintAllies(); paintHand(); await cutIn(a.k, cd.n); }
    else {
      B.energy -= cd.c;
      const i = B.hand.findIndex(x => x.u === c.u), el = $('btHand').querySelector(`[data-hi="${i}"]`);
      if (el) { el.classList.add('fly'); }
      sfx('card');
      await sleep(180);
      B.hand.splice(i, 1); B.disc.push(c);
      a.ex = Math.min(100, a.ex + 20);
    }
    paintHand();
    await run(a, cd, tg || {});
    retarget();
    paintAll();
    if (checkEnd()) return;
    B.busy = false; paintHand();
  }
  // ----- 効果 -----
  async function run(src, cd, tg) {
    const am = src.atk * (on(src, 'atkUp') ? 1.3 : 1), P = n => Math.round(n * src.sup);
    let killed = false;
    for (const o of cd.o) {
      const ty = o[0];
      if (ty === 'dmg') { for (let h = 0; h < (o[2] || 1); h++) { if (tg.foe.dead) break; if (await hitFoe(tg.foe, o[1] * am)) killed = true; } }
      else if (ty === 'dmgAll') { const fs = liveFoes(); fs.forEach(f => hitFoe(f, o[1] * am, true)); await sleep(380); }
      else if (ty === 'shield') addShield(tg.ally, P(o[1]));
      else if (ty === 'shieldSelf') addShield(src, P(o[1]));
      else if (ty === 'shieldAll') alive().forEach(a => addShield(a, P(o[1])));
      else if (ty === 'heal') heal(tg.ally, P(o[1]));
      else if (ty === 'healAll') alive().forEach(a => heal(a, P(o[1])));
      else if (ty === 'taunt') { src.st.taunt = B.round + o[1] - 1; }
      else if (ty === 'atkUp') { tg.ally.st.atkUp = B.round + o[1] - 1; pop(tg.ally, '攻撃UP', 'u'); }
      else if (ty === 'atkUpSelf') { src.st.atkUp = B.round + o[1] - 1; pop(src, '攻撃UP', 'u'); }
      else if (ty === 'atkUpAll') alive().forEach(a => { a.st.atkUp = B.round + o[1] - 1; pop(a, '攻撃UP', 'u'); });
      else if (ty === 'weak') { if (!tg.foe.dead) { tg.foe.st.weak = B.round + o[1] - 1; popFoe(tg.foe, '脆弱', 'w'); } }
      else if (ty === 'weakAll') liveFoes().forEach(f => { f.st.weak = B.round + o[1] - 1; popFoe(f, '脆弱', 'w'); });
      else if (ty === 'stun') { if (!tg.foe.dead) stun(tg.foe); }
      else if (ty === 'stunAll') liveFoes().forEach(stun);
      else if (ty === 'draw') draw(o[1]);
      else if (ty === 'energy') { B.energy += o[1]; }
      else if (ty === 'regen') { tg.ally.st.regen = { n:P(o[1]), u:B.round + o[2] }; pop(tg.ally, '再生', 'r'); }
      else if (ty === 'regenAll') alive().forEach(a => { a.st.regen = { n:P(o[1]), u:B.round + o[2] }; });
      else if (ty === 'cleanse') { if (tg.ally) delete tg.ally.st.weak; }
      else if (ty === 'cleanseAll') alive().forEach(a => delete a.st.weak);
      else if (ty === 'revive') B.allies.filter(a => a.down).forEach(a => { a.down = false; a.hp = Math.round(a.max * o[1] / 100); a.st = {}; pop(a, '復活', 'r'); sfx('heal'); });
      else if (ty === 'exAll') alive().forEach(a => { if (a !== src) a.ex = Math.min(100, a.ex + o[1]); });
      else if (ty === 'refund') { if (killed) { B.energy += 1; pop(src, 'コスト+1', 'u'); } }
      paintAllies(); paintFoes();
    }
    await sleep(160);
  }
  function stun(f) {
    if (f.st.si && f.st.si >= B.round) { popFoe(f, '効かない', 'n'); return; }
    f.it = ['stunned']; f.tgt = -1; f.st.si = B.round + 1;   // 連続スタンは1ターン空ける
    popFoe(f, 'スタン', 'w');
  }
  async function hitFoe(f, raw, quiet = false) {
    let d = Math.round(raw * (on(f, 'weak') ? 1.3 : 1));
    const ab = Math.min(f.sh, d); f.sh -= ab; d -= ab;
    f.hp = Math.max(0, f.hp - d);
    const el = $('btFoes').children[f.i];
    el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit');
    floatNum(el, ab && !d ? `🛡${ab}` : d, 'dmg', raw >= 18);
    sfx(raw >= 18 ? 'big' : 'hit');
    paintFoes();
    let dead = false;
    if (f.hp <= 0) { f.dead = true; dead = true; sfx('down'); setTimeout(paintFoes, 200); }
    if (!quiet) await sleep(260);
    return dead;
  }
  function addShield(a, n) { if (!a || a.down) return; a.sh += n; pop(a, `🛡+${n}`, 's'); sfx('shield'); }
  function heal(a, n) { if (!a || a.down) return; const v = Math.min(n, a.max - a.hp); a.hp += v; pop(a, `+${v}`, 'h'); sfx('heal'); }
  function pop(a, txt, cls) { const el = $('btAllies').children[B.allies.indexOf(a)]; if (el) floatNum(el, txt, cls); }
  function popFoe(f, txt, cls) { floatNum($('btFoes').children[f.i], txt, cls); }
  function floatNum(el, txt, cls, big) {
    const r = el.getBoundingClientRect(), R = $('bt').getBoundingClientRect();
    const n = h(`<div class="bt-num ${cls}${big ? ' big' : ''}">${txt}</div>`);
    n.style.left = (r.left + r.width / 2 - R.left + (Math.random() * 30 - 15)) + 'px'; n.style.top = (r.top + r.height * .35 - R.top) + 'px';
    $('btFx').appendChild(n); setTimeout(() => n.remove(), 1100);
  }

  // ----- ターン終了 → 敵の行動 -----
  async function endTurn() {
    if (B.busy) return;
    B.busy = true; B.sel = null; sfx('tap');
    B.disc.push(...B.hand); B.hand = [];
    paintHand();
    await banner('ENEMY PHASE', '', 'en');
    liveFoes().forEach(f => { f.sh = 0; });
    paintFoes();
    for (const f of B.foes) {
      if (f.dead || B.over) continue;
      await foeAct(f);
      if (checkEnd()) return;
    }
    await sleep(250);
    playerTurn();
  }
  async function foeAct(f) {
    const it = f.it, F = FOE[f.t], el = $('btFoes').children[f.i];
    if (!it || it[0] === 'stunned') { popFoe(f, 'スタン中', 'n'); await sleep(380); return; }
    el.classList.remove('act'); void el.offsetWidth; el.classList.add('act');
    await sleep(240);
    const m = B.dm * (on(f, 'atkUp') ? 1.3 : 1);
    if (it[0] === 'atk') {
      for (let h = 0; h < (it[2] || 1); h++) {
        let t = B.allies[f.tgt];
        if (!t || t.down) { const i = pickTarget(); if (i == null) break; f.tgt = i; t = B.allies[i]; }
        hurt(t, it[1] * m); await sleep(300);
      }
    } else if (it[0] === 'aoe') { alive().forEach(a => hurt(a, it[1] * m)); sfx('big'); await sleep(420); }
    else if (it[0] === 'shield') { f.sh += Math.round(it[1] * B.dm); popFoe(f, `🛡+${Math.round(it[1] * B.dm)}`, 's'); sfx('shield'); }
    else if (it[0] === 'buff') { f.st.atkUp = B.round + 1; popFoe(f, '攻撃UP', 'u'); }
    else if (it[0] === 'charge') { popFoe(f, '……', 'n'); }
    else if (it[0] === 'weakT') { const t = B.allies[f.tgt]; if (t && !t.down) { t.st.weak = B.round + 1; pop(t, '脆弱', 'w'); } }
    f.it = null; paintAll();
    await sleep(320);
  }
  function hurt(a, raw) {
    if (a.down) return;
    let d = Math.round(raw * (on(a, 'weak') ? 1.3 : 1));
    const ab = Math.min(a.sh, d); a.sh -= ab; d -= ab;
    a.hp = Math.max(0, a.hp - d);
    if (d > 0) a.ex = Math.min(100, a.ex + 10);
    const el = $('btAllies').children[B.allies.indexOf(a)];
    el.classList.remove('hurt'); void el.offsetWidth; el.classList.add('hurt');
    floatNum(el, d ? '-' + d : `🛡${ab}`, d ? 'dmg' : 's');
    sfx(d ? 'hurt' : 'shield');
    if (a.hp <= 0) { a.down = true; a.st = {}; a.sh = 0; B.downed++; sfx('down'); }
    paintAllies();
  }
  function checkEnd() {
    if (B.over) return true;
    if (!liveFoes().length) { finish(true); return true; }
    if (!alive().length) { finish(false); return true; }
    return false;
  }
  async function retreat() {
    if (!B || B.over) return;
    $('btModal').innerHTML = `<div class="bt-sheet"><div class="bt-sh-h"><b>撤退しますか？</b><small>使ったAPは戻りません</small></div>
      <div class="bt-sh-b"><button class="bt-ghost" data-m="x">続ける</button><button class="bt-ok red" data-m="ok">撤退</button></div></div>`;
    $('btModal').className = 'bt-modal on';
    $('btModal').onclick = e => { const m = e.target.closest('[data-m]'); if (!m && e.target !== $('btModal')) return; modalClose();
      if (m && m.dataset.m === 'ok') { B.over = true; B = null; show('stages'); } };
  }

  // ----- 演出 -----
  async function banner(t, sub = '', cls = '') {
    const b = $('btBanner'); b.className = 'bt-banner'; b.innerHTML = `<b>${t}</b>${sub ? `<small>${sub}</small>` : ''}`;
    void b.offsetWidth; b.className = 'bt-banner on ' + cls; sfx('turn');
    await sleep(900); b.className = 'bt-banner';
  }
  async function cutIn(k, name) {
    const art = artOf(k, 'ex', false) || tachie(k, 1), el = $('btCut');
    el.innerHTML = `<div class="bt-cutband"><img src="${art}" alt="" class="${artOf(k, 'ex', false) ? '' : 'tc'}"></div><div class="bt-cutlines"></div>
      <div class="bt-cutname"><small>EX SKILL</small><b>${name}</b><span>${CH[k].name}</span></div>`;
    el.className = 'bt-cut on'; sfx('ex');
    await sleep(1250);
    el.className = 'bt-cut on out'; await sleep(250);
    el.className = 'bt-cut'; el.innerHTML = '';
  }

  // ----- 結果 -----
  async function finish(win) {
    B.over = true; B.busy = true; paintAll();
    await sleep(500);
    const st = B.st, prev = S.clr[st.id] || 0, first = win && !prev;
    let stars = 0, gained = [], ups = [];
    if (win) {
      stars = 1 + (B.downed === 0 ? 1 : 0) + (B.round <= st.t3 ? 1 : 0);
      S.clr[st.id] = Math.max(prev, stars);
      gained = (first ? st.first : []).concat(st.drop);
      gained.forEach(([k, n]) => { S.it[k] = (S.it[k] || 0) + n; });
      S.party.forEach(k => {
        const c = S.ch[k], lv0 = c.lv; if (c.lv >= LV_MAX) return;
        c.exp += st.exp; while (c.lv < LV_MAX && c.exp >= needExp(c.lv)) { c.exp -= needExp(c.lv); c.lv++; }
        if (c.lv > lv0) ups.push(k);
      });
    } else {
      S.ap = Math.min(AP_MAX, S.ap + Math.floor(st.ap / 2));   // 負けたら半分返す
    }
    await save();
    sfx(win ? 'win' : 'lose');
    B.win = win; lastWin = win; scr = 'result'; syncBgm(0, .6);
    $('btModal').innerHTML = `<div class="bt-res ${win ? 'win' : 'lose'}">
      <div class="bt-rt">${win ? 'VICTORY' : 'DEFEAT'}</div>
      ${win ? `<div class="bt-rs">${[1, 2, 3].map(i => `<i class="${i <= stars ? 'on' : ''}" style="--d:${i * .18}s">★</i>`).join('')}</div>
        <div class="bt-rc"><span class="${B.downed === 0 ? 'ok' : ''}">誰も倒れずにクリア</span><span class="${B.round <= st.t3 ? 'ok' : ''}">${st.t3}ターン以内にクリア（${B.round}ターン）</span></div>
        <div class="bt-rx">${S.party.map(k => `<div><img src="${faceImg(k)}" alt=""><b>Lv.${S.ch[k].lv}</b>${ups.includes(k) ? '<em>LEVEL UP</em>' : ''}</div>`).join('')}</div>
        <div class="bt-drop">${first ? '<small>初回クリア報酬つき</small>' : ''}${gained.map(([k, n]) => `<span><img src="${itemImg(k)}" alt="">×${n}</span>`).join('')}<span class="exp">EXP ${st.exp}</span></div>`
      : `<p class="bt-rl">全員が戦闘不能になりました。<br>APを半分（${Math.floor(st.ap / 2)}）返しました。<br>編成やカードの使い方を変えてみましょう。</p>`}
      <div class="bt-sh-b"><button class="bt-ghost" data-m="list">演習一覧</button><button class="bt-ok" data-m="again" ${S.ap < st.ap ? 'disabled' : ''}>もう一度（AP${st.ap}）</button></div></div>`;
    $('btModal').className = 'bt-modal on res';
    $('btModal').onclick = e => {
      const m = e.target.closest('[data-m]'); if (!m) return;
      const si = B.si; modalClose(); B = null;
      if (m.dataset.m === 'again' && S.ap >= st.ap) { S.ap -= st.ap; save(); start(si); }
      else show('stages');
    };
  }

  return {
    open, gainAP,
    active:() => !!scr,
    bgm:() => scr === 'fight' ? BGM.fight : scr === 'result' && lastWin ? BGM.win : null,
    allBgm:() => Object.values(BGM),
    _dbg:() => ({ S, B }),
  };
})();
