// Kani Favorite — 実戦（作戦室の待機室 →「実戦」）。4人編成のターン制カードバトル
// 保存：room ストアの 'bt-state' 1件（育成・所持品・AP・クリア状況）。戦闘中の状態は保存しない
'use strict';
const Battle = (() => {
  // ===== キャラ =====
  // role：H ヒーラー／B バランス／A アタック。set：a＝攻撃型（通常・速攻・バリア・EXアタック）／h＝回復型（通常・強化・回復・EX回復）
  const ROLE = { H:['ヒーラー', 'heal'], B:['バランス', 'bal'], A:['アタック', 'atk'] };
  // head：[顔の中心x, 頭のてっぺんy, あごy]（立ち絵に対する割合）。味方枠で頭の高さをそろえるのに使う。col：演出の色
  const CH = {
    hoshino:{ name:'ホシノ', role:'B', hp:64, set:'a', face:[.41, .136], head:[.46, .06, .146], col:'#ff8fc8' },
    mika:   { name:'ミカ',   role:'A', hp:50, set:'a', face:[.557, .208], head:[.57, .11, .20], col:'#ffb0dc' },
    mari:   { name:'マリー', role:'H', hp:46, set:'h', face:[.55, .2], head:[.58, .07, .19], col:'#ffb347' },
    hina:   { name:'ヒナ',   role:'A', hp:52, set:'a', face:[.47, .202], head:[.58, .11, .19], col:'#c08cff' },
    yuuka:  { name:'ユウカ', role:'B', hp:56, set:'a', face:[.45, .16], head:[.46, .08, .21], col:'#6f8cff' },
    miyako: { name:'ミヤコ', role:'B', hp:50, set:'a', face:[.49, .136], head:[.47, .08, .20], col:'#8fd8ff' },
    nico:   { name:'ニコ',   role:'H', hp:48, set:'h', face:[.43, .177], head:[.44, .10, .21], col:'#ff9ec7' },
    kisaki: { name:'キサキ', role:'B', hp:52, set:'a', face:[.47, .115], head:[.47, .08, .16], col:'#b58cff' },
  };
  const KEYS = Object.keys(CH);
  const SETS = { a:['atk', 'spd', 'bar', 'exa'], h:['atk', 'buf', 'heal', 'exh'] };
  const EVO_TY = { bar:1, heal:1, exa:2, exh:2 };   // 進化できるカード（1＝Lv10・結晶3／2＝Lv20・結晶5）
  // カード画像（届いている分）。ないものは立ち絵を使う
  const ART = {
    hoshino:['atk', 'spd', 'bar', 'bar_evo', 'exa', 'exa_evo', 'ex'],
    mika:['atk', 'spd', 'bar', 'bar_evo', 'exa', 'exa_evo', 'ex'],
    mari:['atk', 'buf', 'heal', 'heal_evo', 'exh', 'exh_evo', 'ex'],
    hina:['exa', 'exa_evo', 'ex'], yuuka:['ex'], miyako:['ex'], nico:['ex'], kisaki:['ex'],
  };
  // 効果は op の並び。数値は育成で伸びる（ダメージは攻撃力、回復・シールドはレベル）
  const C = (n, c, o, evo) => ({ n, c, o, evo });
  const ATK = n => C('通常射撃', 1, [['dmg', n]]);
  const CARD = {
    hoshino:{ atk:ATK(6), spd:C('寝ぼけまなこの一発', 0, [['dmg', 4], ['draw', 1]]),
      bar:C('おじさんシールド', 1, [['shieldSelf', 12], ['taunt', 1]], C('アビドスの砦', 1, [['shieldSelf', 14], ['taunt', 1], ['shieldAll', 5]])),
      exa:C('ゼロ距離ショット', 2, [['dmg', 16]], C('本気のおじさん', 2, [['dmg', 18], ['weak', 2]])),
      ex:C('先生には触れさせないよ', 0, [['shieldAll', 12], ['taunt', 1]]) },
    mika:{ atk:ATK(7), spd:C('ちょっとだけ本気', 0, [['dmg', 3, 2]]),
      bar:C('星くずのヴェール', 1, [['shield', 10]], C('お姫さまの聖域', 1, [['shield', 10], ['cleanse'], ['draw', 1]])),
      exa:C('全力ぱーんち', 2, [['dmg', 22]], C('流星ぱーんち', 2, [['dmg', 26], ['refund']])),
      ex:C('お星さまにお願い', 0, [['dmg', 45]]) },
    mari:{ atk:ATK(5), buf:C('主の祝福を', 1, [['atkUp', 2]]),
      heal:C('癒やしの祈り', 1, [['heal', 14]], C('慈しみの手', 1, [['heal', 14], ['regen', 4, 2], ['cleanse']])),
      exh:C('シスターの聖歌', 2, [['healAll', 9]], C('奇跡の聖歌', 2, [['healAll', 11], ['revive', 30]])),
      ex:C('祈りよ、届いて', 0, [['healAll', 18], ['cleanseAll']]) },
    hina:{ atk:ATK(7), spd:C('委員長の威嚇射撃', 1, [['dmgAll', 4]]),
      bar:C('風紀の防衛線', 1, [['shieldSelf', 10]], C('ゲヘナの鉄壁', 1, [['shieldSelf', 12], ['atkUpSelf', 1]])),
      exa:C('終幕の掃射', 2, [['dmgAll', 9]], C('殲滅の終幕', 2, [['dmgAll', 11], ['weakAll', 1]])),
      ex:C('風紀、執行します', 0, [['dmgAll', 20]]) },
    yuuka:{ atk:ATK(6), spd:C('計算通りです', 0, [['draw', 2]]),
      bar:C('予算内の障壁', 1, [['shieldAll', 6]], C('完全演算障壁', 1, [['shieldAll', 8], ['draw', 1]])),
      exa:C('最適解、算出', 2, [['dmg', 13], ['weak', 2]], C('最適解・確定', 2, [['dmg', 15], ['weak', 2], ['energy', 1]])),
      ex:C('全部、計算済みです', 0, [['shieldAll', 14], ['draw', 2]]) },
    miyako:{ atk:ATK(6), spd:C('RABBIT1、偵察開始', 0, [['dmg', 3], ['weak', 1]]),
      bar:C('遮蔽確保', 1, [['shield', 9]], C('完全遮蔽', 1, [['shield', 12], ['draw', 1]])),
      exa:C('制圧射撃', 2, [['dmg', 10], ['stun']], C('包囲制圧', 2, [['dmg', 12], ['stun'], ['weak', 2]])),
      ex:C('RABBIT小隊、突入', 0, [['dmgAll', 8], ['stunAll']]) },
    nico:{ atk:ATK(5), buf:C('狐火のおまもり', 1, [['regen', 5, 3]]),
      heal:C('こんこん手当て', 1, [['heal', 11], ['shield', 5]], C('九尾のおまじない', 1, [['heal', 13], ['shield', 8], ['cleanse']])),
      exh:C('狐火の宴', 2, [['healAll', 8]], C('千年狐火', 2, [['healAll', 10], ['regenAll', 3, 2]])),
      ex:C('化かして、守って', 0, [['healAll', 14], ['regenAll', 4, 3]]) },
    kisaki:{ atk:ATK(6), spd:C('玄龍門の采配', 1, [['atkUpAll', 1]]),
      bar:C('龍の結界', 1, [['shieldAll', 6]], C('天龍結界', 1, [['shieldAll', 8], ['cleanseAll']])),
      exa:C('龍の号令', 2, [['atkUpAll', 2], ['energy', 1]], C('天子の号令', 2, [['atkUpAll', 2], ['energy', 1], ['draw', 2]])),
      ex:C('紫煙、天に昇る', 0, [['energy', 2], ['exAll', 25]]) },
  };
  // ===== 敵 =====
  const FOE = {
    drone:{ name:'偵察ドローン', img:'bt_e_drone', hp:16, h:24, fly:1, pat:[['atk', 5], ['atk', 3, 2], ['weakT', 2]] },
    thug: { name:'覆面の不良生徒', img:'bt_e_thug', hp:26, h:70, pat:[['atk', 4, 2], ['buff'], ['atk', 9]] },
    robot:{ name:'警備ロボット', img:'bt_e_robot', hp:44, h:70, pat:[['atk', 8], ['shield', 12], ['atk', 6], ['aoe', 4]] },
    dummy:{ name:'訓練用標的', img:'bt_e_heavy', hp:9999, h:72, dummy:1, pat:[['atk', 6], ['aoe', 4], ['atk', 3, 2]] },
    heavy:{ name:'重装オートマタ', img:'bt_e_heavy', hp:120, h:76, boss:1, pat:[['atk', 12], ['charge'], ['aoe', 13], ['shield', 14], ['atk', 8, 2]] },
  };
  // waves：ウェーブごとの敵／t3：★3になるクリア秒数
  const STAGES = [
    { id:'p1', name:'ドローン迎撃', waves:[['drone'], ['drone', 'drone']], m:1.0, ap:10, exp:60, t3:50, drop:[['note1', 2]], first:[['star', 1], ['note2', 1]] },
    { id:'p2', name:'不良生徒の鎮圧', waves:[['thug'], ['thug', 'thug']], m:1.1, ap:10, exp:90, t3:60, drop:[['note1', 3]], first:[['star', 1], ['chipA', 1]] },
    { id:'p3', name:'警備ロボット', waves:[['drone', 'drone'], ['robot', 'drone']], m:1.2, ap:10, exp:130, t3:70, drop:[['note1', 2], ['note2', 1]], first:[['star', 2], ['chipD', 1]] },
    { id:'p4', name:'混成部隊', waves:[['thug', 'drone'], ['robot', 'thug', 'drone']], m:1.35, ap:10, exp:180, t3:85, drop:[['note2', 2], ['chipA', 1]], first:[['star', 2], ['chipD', 1]] },
    { id:'p5', name:'重装オートマタ', waves:[['drone', 'thug'], ['heavy']], m:1.5, ap:15, exp:260, t3:100, drop:[['note2', 2], ['chipD', 1], ['star', 1]], first:[['star', 3], ['note3', 1]] },
    { id:'p6', name:'総力戦', waves:[['drone', 'robot'], ['thug', 'thug', 'drone'], ['heavy', 'drone']], m:1.8, ap:15, exp:360, t3:140, drop:[['note2', 3], ['chipA', 1], ['star', 1]], first:[['star', 3], ['note3', 2]] },
  ];
  const ITEM = {
    note1:{ name:'訓練ノート（小）', img:'it_note1', exp:100 }, note2:{ name:'訓練ノート（中）', img:'it_note2', exp:400 }, note3:{ name:'訓練ノート（大）', img:'it_note3', exp:1500 },
    chipA:{ name:'強化チップ（攻撃）', img:'it_chipA' }, chipD:{ name:'強化チップ（防御）', img:'it_chipD' }, star:{ name:'星の結晶', img:'it_star' },
  };
  const AP_MAX = 100, LV_MAX = 30, CHIP_MAX = 10, PARTY = 3;
  const BGM = { hub:L('ops_lounge_bgm.mp3', 60.5), fight:L('meet_a_bgm.mp3', 118), win:L('ops_result_bgm.mp3', 76.0026) };

  // ===== 保存データ =====
  let S = null, scr = null, B = null, lastWin = false;
  const fresh = () => ({ id:'bt-state', ap:60, apLog:{}, party:['hoshino', 'mika', 'mari'], spd:1, auto:false,
    ch:Object.fromEntries(KEYS.map(k => [k, { lv:1, exp:0, ca:0, cd:0, evo:{} }])),
    it:{ note1:6, note2:2, note3:0, chipA:0, chipD:0, star:0 }, clr:{} });
  async function load() {
    if (S) return S;
    const r = await DB.get('room', 'bt-state').catch(() => null);
    S = r || fresh();
    KEYS.forEach(k => { if (!S.ch[k]) S.ch[k] = { lv:1, exp:0, ca:0, cd:0, evo:{} }; });
    if (S.party.length > PARTY) S.party = S.party.slice(0, PARTY);   // v27から3人編成
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
    // リアルタイム戦闘の数値で表示（bt_rt.js の K と合わせる）
    const D = (n, k = 8) => Math.round(n * k * a), P = n => Math.round(n * 4 * s);
    const tx = { dmg:o => `敵1体に${D(o[1])}ダメージ${o[2] > 1 ? `×${o[2]}` : ''}`, dmgAll:o => `敵全体に${D(o[1], 6)}ダメージ`,
      shield:o => `味方1人にシールド${P(o[1])}`, shieldSelf:o => `自分にシールド${P(o[1])}`, shieldAll:o => `味方全員にシールド${P(o[1])}`,
      heal:o => `いちばん弱った味方のHPを${P(o[1])}回復`, healAll:o => `味方全員のHPを${P(o[1])}回復`,
      taunt:o => `${6 * o[1]}秒間、敵の攻撃を引きつける`, atkUp:o => `味方1人の攻撃UP（${8 * o[1]}秒）`, atkUpSelf:o => `自分の攻撃UP（${8 * o[1]}秒）`, atkUpAll:o => `味方全員の攻撃UP（${8 * o[1]}秒）`,
      weak:o => `脆弱（${8 * o[1]}秒）`, weakAll:o => `敵全体に脆弱（${8 * o[1]}秒）`, stun:() => '2.5秒動きを止める（ボスは1秒）', stunAll:() => '敵全体の動きを止める',
      draw:o => `コスト+${o[1]}`, energy:o => `コスト+${o[1] * 2}`,
      regen:o => `味方1人を${o[2] * 3}秒間、毎秒${Math.round(o[1] * 1.5 * s)}回復`, regenAll:o => `味方全員を${o[2] * 3}秒間、毎秒${Math.round(o[1] * 1.5 * s)}回復`,
      cleanse:() => '弱体を解除', cleanseAll:() => '味方全員の弱体を解除', revive:o => `倒れた味方をHP${o[1]}%で復活`,
      exAll:o => `ほかの味方のEXゲージ+${o[1]}`, refund:() => '倒したらコスト+2' };
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
         pop:() => { noise(.08, .18, 0, 3000); tone(420, .07, .16, 'triangle', 0, 880); },
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
        <div class="bt-top"><button class="bt-back" data-act="out">‹ 出る</button><div class="bt-ttl">実戦<small>SIMULATION ROOM</small></div><div class="bt-ap" id="btAp"></div></div>
        <div class="bt-stage-floor" id="btParty"></div>
        <div class="bt-menu">
          <button class="bt-go" data-act="stages"><b>出撃</b><small>SORTIE</small></button>
          <div class="bt-row"><button class="bt-sub" data-act="form"><b>編成</b><small>FORMATION</small></button><button class="bt-sub" data-act="train"><b>育成</b><small>TRAINING</small></button></div>
          <div class="bt-row"><button class="bt-sub bt-drill" data-act="drill"><b>演習部屋</b><small>DRILL ROOM</small></button><button class="bt-sub bt-dis" data-act="story"><b>ストーリー</b><small>COMING SOON</small></button></div>
        </div>
        <div class="bt-hint">AP回復：Todoを完了 <b>+10</b>／ごはんを記録 <b>+5</b></div>
      </section>
      <section class="bt-sc bt-stg">
        <div class="bt-top"><button class="bt-back" data-act="hub">‹ 戻る</button><div class="bt-ttl">出撃<small>SELECT STAGE</small></div><div class="bt-ap" id="btAp2"></div></div>
        <div class="bt-list" id="btStages"></div>
      </section>
      <section class="bt-sc bt-trn">
        <div class="bt-top"><button class="bt-back" data-act="hub">‹ 戻る</button><div class="bt-ttl">育成<small>TRAINING</small></div><div class="bt-ap"></div></div>
        <div class="bt-faces" id="btFaces"></div>
        <div class="bt-tview" id="btTrain"></div>
      </section>
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
    const pos = [[22, 0], [50, 4], [78, 0]];
    $('btParty').innerHTML = S.party.map((k, i) => {
      const r = ROLE[CH[k].role];
      return `<div class="bt-pm" style="left:${pos[i][0]}%;z-index:${i === 1 ? 2 : 1};--d:${i * .08}s" data-act="form">
        <img src="${tachie(k, 2)}" alt=""><div class="bt-plate"><b>${CH[k].name}</b><span class="bt-role ${r[1]}">${r[0]}</span><em>Lv.${S.ch[k].lv}</em></div></div>`;
    }).join('');
  }

  // ===== 編成 =====
  function formation() {
    let pick = S.party.slice();
    const draw = () => {
      $('btModal').innerHTML = `<div class="bt-sheet"><div class="bt-sh-h"><b>編成</b><small>3人を選んでください（タップした順）</small></div>
        <div class="bt-fgrid">${KEYS.map(k => { const i = pick.indexOf(k), r = ROLE[CH[k].role];
          return `<button class="bt-fc${i >= 0 ? ' on' : ''}" data-k="${k}"><img src="${faceImg(k)}" alt="">${i >= 0 ? `<i>${i + 1}</i>` : ''}
            <b>${CH[k].name}</b><span class="bt-role ${r[1]}">${r[0]}</span><em>Lv.${S.ch[k].lv}</em></button>`; }).join('')}</div>
        <div class="bt-sh-b"><button class="bt-ghost" data-m="x">やめる</button><button class="bt-ok" data-m="ok" ${pick.length === PARTY ? '' : 'disabled'}>決定</button></div></div>`;
    };
    draw(); $('btModal').className = 'bt-modal on';
    $('btModal').onclick = e => {
      const c = e.target.closest('.bt-fc');
      if (c) { const k = c.dataset.k, i = pick.indexOf(k); if (i >= 0) pick.splice(i, 1); else if (pick.length < PARTY) pick.push(k); else { sfx('ng'); return; } sfx('tap'); draw(); return; }
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
      const lock = i > 0 && !S.clr[STAGES[i - 1].id], stars = S.clr[st.id] || 0, fs = foesOf(st), boss = fs.some(f => FOE[f].boss);
      return `<button class="bt-stc${lock ? ' lock' : ''}${boss ? ' boss' : ''}" data-st="${i}">
        <div class="bt-stn"><small>STAGE ${i + 1}</small><b>${st.name}</b><span>${'★'.repeat(stars)}<i>${'★'.repeat(3 - stars)}</i></span></div>
        <div class="bt-ste">${[...new Set(fs)].map(f => `<img src="${FOE[f].img}.webp" alt="">`).join('')}</div>
        <div class="bt-stap">${lock ? '🔒' : `AP <b>${st.ap}</b>`}</div></button>`;
    }).join('') + `<div class="bt-note">★1 クリア　★2 誰も倒れずにクリア　★3 規定の秒数以内にクリア<br>初回クリアで星の結晶がもらえます</div>`;
    $('btStages').onclick = e => {
      const b = e.target.closest('.bt-stc'); if (!b) return;
      const i = +b.dataset.st, st = STAGES[i];
      if (b.classList.contains('lock')) { sfx('ng'); return toast('前のステージをクリアすると挑戦できます'); }
      sfx('tap'); stageInfo(i);
    };
  }
  function stageInfo(i) {
    const st = STAGES[i], first = !S.clr[st.id];
    $('btModal').innerHTML = `<div class="bt-sheet"><div class="bt-sh-h"><b>ステージ${i + 1}　${st.name}</b><small>${st.waves.length}ウェーブ　／　★3：${st.t3}秒以内　／　消費AP ${st.ap}</small></div>
      <div class="bt-foe-info">${[...new Set(foesOf(st))].map(f => { const F = FOE[f];
        return `<div><img src="${F.img}.webp" alt=""><b>${F.name}</b><small>${F.boss ? 'ボス' : '　'}</small></div>`; }).join('')}</div>
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

  // ===== 演習部屋（APを使わない練習。報酬・記録なし） =====
  const DRILL = { counter:false, inf:true, ex:true };
  function drillRoom() {
    const opt = (k, t, d) => `<button class="bt-opt${DRILL[k] ? ' on' : ''}" data-o="${k}"><b>${t}</b><small>${d}</small><i></i></button>`;
    $('btModal').innerHTML = `<div class="bt-sheet"><div class="bt-sh-h"><b>演習部屋</b><small>APを使わずに練習できます（報酬・経験値はありません）</small></div>
      <div class="bt-drl">
        <div class="bt-drc on"><div><b>木人</b><small>倒れない的に好きなだけ攻撃。ダメージを数字で確認できます</small></div></div>
        ${opt('counter', '反撃してくる', '被弾の確認用。味方はHP1で止まります')}${opt('inf', 'コスト無制限', '何枚でもカードを使えます')}${opt('ex', 'EXいつでも', 'EXゲージが常に満タン（顔アイコンをタップ）')}
        <div class="bt-drc off"><div><b>基本演習</b><small>準備中</small></div></div>
        <div class="bt-drc off"><div><b>自由演習</b><small>準備中</small></div></div>
      </div>
      <div class="bt-sh-team">${S.party.map(k => `<img src="${faceImg(k)}" alt="">`).join('')}<button class="bt-ghost" data-m="form">編成</button></div>
      <div class="bt-sh-b"><button class="bt-ghost" data-m="x">やめる</button><button class="bt-ok" data-m="go">木人で練習</button></div></div>`;
    $('btModal').className = 'bt-modal on';
    $('btModal').onclick = e => {
      const o = e.target.closest('[data-o]'); if (o) { DRILL[o.dataset.o] = !DRILL[o.dataset.o]; o.classList.toggle('on'); sfx('tap'); return; }
      const m = e.target.closest('[data-m]'); if (!m && e.target !== $('btModal')) return;
      if (m && m.dataset.m === 'form') { modalClose(); return formation(); }
      modalClose();
      if (m && m.dataset.m === 'go') start({ id:'dummy', name:'木人', waves:[['dummy']], m:1, dummy:true, t3:999 }, { ...DRILL });
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
    const cards = SETS[CH[tk].set].filter(ty => ty !== 'atk').map(ty => {
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
      <div class="bt-tcs"><div class="bt-tc">${cardHTML(tk, 'ex', false, false, 'data-card="ex"')}<span class="bt-evn">EX</span></div>${cards}</div>`;
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
      <p class="bt-evt"><b>${c.n}（コスト${rtCost(c)}）</b>${cardText(tk, c)}</p>${nx ? `<p class="bt-evt nx"><b>進化後：${nx.n}</b>${cardText(tk, nx)}</p>` : ''}
      <div class="bt-sh-b"><button class="bt-ghost" data-m="x">閉じる</button></div></div>`;
    $('btModal').className = 'bt-modal on';
    $('btModal').onclick = e => { if (e.target.closest('[data-m]') || e.target === $('btModal')) modalClose(); };
  }
  function flashEvo() { const f = h('<div class="bt-evflash"></div>'); $('bt').appendChild(f); setTimeout(() => f.remove(), 900); }

  // リアルタイムのコスト（ターン制の 0／1／2 を 2／3／5〜6 に）
  const rtCost = c => c.c === 0 ? 2 : c.c === 1 ? 3 : kindOf(c) === 'heal' ? 5 : 6;
  // ===== カードの見た目 =====
  function cardHTML(k, ty, evo, big = false, extra = '') {
    const c = ty === 'ex' ? CARD[k].ex : cardOf(k, ty, evo), art = artOf(k, ty, evo), kind = ty === 'ex' ? 'ex' : kindOf(c);
    const frame = ty === 'ex' ? ' dia' : evo ? (ty === 'exa' || ty === 'exh' ? ' rain' : ' gold') : '';
    const img = art ? `<img class="bt-ca" src="${art}" alt="">` : `<img class="bt-ca bt-cat" src="${tachie(k, 1)}" alt="" style="--fx:${CH[k].face[0]};--fy:${CH[k].face[1]}">`;
    return `<div class="bt-card k-${kind}${evo ? ' evo' : ''}${frame}${big ? ' big' : ''}" ${extra}>${img}${frame ? '<i class="bt-sh"></i>' : ''}
      ${ty === 'ex' ? '' : `<i class="bt-cc">${rtCost(c)}</i>`}<img class="bt-cf" src="${faceImg(k)}" alt=""><div class="bt-cn">${evo ? '<em>★</em>' : ''}${c.n}</div>${big ? `<div class="bt-ct">${cardText(k, c)}</div>` : ''}</div>`;
  }

  // ===== 戦闘（リアルタイム。中身は bt_rt.js） =====
  // si：ステージ番号、またはステージ定義そのもの（演習部屋・ストーリー用）。opt：演習部屋の設定
  const foesOf = st => st.waves.flat();
  const API = {
    CH, CARD, FOE, SETS, cardOf, kindOf, faceImg,
    cardHTML:(k, ty, evo, big) => cardHTML(k, ty, evo, big),
    isEvo:(k, ty) => !!S.ch[k].evo[ty],
    statOf:k => ({ hp:maxHp(k) * 4, atk:atkMul(k), sup:supMul(k) }),
  };
  async function start(si, opt = null) {
    const st = typeof si === 'object' ? si : STAGES[si];
    B = { si, st };
    show('rt');
    const res = await BtRT.start(st, { party:S.party.slice(), spd:S.spd || 1, auto:!!S.auto, counter:!!(opt && opt.counter), inf:!!(opt && opt.inf), exInf:!!(opt && opt.ex),
      onPref:p => { S.spd = p.spd; S.auto = p.auto; save(); } }, API);
    BtRT.stop();
    if (res.quit || st.dummy) { B = null; return show(st.dummy ? 'hub' : 'stages'); }
    B.res = res;
    finish(res.win);
  }

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
      if (a === 'drill') { sfx('tap'); return drillRoom(); }
    }
    if (scr === 'train') {
      const f = t.closest('[data-tk]'); if (f) { tk = f.dataset.tk; sfx('tap'); return paintTrain(); }
      const u = t.closest('[data-use]'); if (u) return useItem(u.dataset.use);
      const v = t.closest('[data-evo]'); if (v) return evolve(v.dataset.evo);
      const cc = t.closest('[data-card]'); if (cc) return cardInfo(cc.dataset.card);
      return;
    }
  }

  // ----- 結果 -----
  async function finish(win) {
    const st = B.st, prev = S.clr[st.id] || 0, first = win && !prev;
    let stars = 0, gained = [], ups = [];
    const mvp = (Object.entries(B.res.dmg || {}).sort((a, b) => b[1] - a[1])[0] || [])[0];
    if (win) {
      stars = 1 + (B.res.downed === 0 ? 1 : 0) + (B.res.time <= st.t3 ? 1 : 0);
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
    lastWin = win; scr = 'result'; syncBgm(0, .6);
    $('btModal').innerHTML = `<div class="bt-res ${win ? 'win' : 'lose'}">
      <div class="bt-rt">${win ? 'VICTORY' : 'DEFEAT'}</div>
      ${win ? `<div class="bt-rs">${[1, 2, 3].map(i => `<i class="${i <= stars ? 'on' : ''}" style="--d:${i * .18}s">★</i>`).join('')}</div>
        <div class="bt-rc"><span class="${B.res.downed === 0 ? 'ok' : ''}">誰も倒れずにクリア</span><span class="${B.res.time <= st.t3 ? 'ok' : ''}">${st.t3}秒以内にクリア（${Math.ceil(B.res.time)}秒）</span></div>
        <div class="bt-rx">${S.party.map(k => `<div class="${mvp === k ? 'mvp' : ''}"><img src="${faceImg(k)}" alt=""><b>Lv.${S.ch[k].lv}</b>${ups.includes(k) ? '<em>LEVEL UP</em>' : ''}${mvp === k ? '<i>MVP</i>' : ''}</div>`).join('')}</div>
        <div class="bt-drop">${first ? '<small>初回クリア報酬つき</small>' : ''}${gained.map(([k, n]) => `<span><img src="${itemImg(k)}" alt="">×${n}</span>`).join('')}<span class="exp">EXP ${st.exp}</span></div>`
      : `<p class="bt-rl">全員が戦闘不能になりました。<br>APを半分（${Math.floor(st.ap / 2)}）返しました。<br>編成やカードの使い方を変えてみましょう。</p>`}
      <div class="bt-sh-b"><button class="bt-ghost" data-m="list">ステージ一覧</button><button class="bt-ok" data-m="again" ${S.ap < st.ap ? 'disabled' : ''}>もう一度（AP${st.ap}）</button></div></div>`;
    $('btModal').className = 'bt-modal on res';
    $('btModal').onclick = e => {
      const m = e.target.closest('[data-m]'); if (!m) return;
      const si = B.si; modalClose(); B = null;
      if (m.dataset.m === 'again' && S.ap >= st.ap) { S.ap -= st.ap; save(); start(si); }
      else show('stages');
    };
  }

  // ===== ドア（作戦室の右・いちばん右端） =====
  let onDoor = false;
  function makeDoor() {
    const s = h(`<div class="slide btdoor tmp"><div class="btdbox"><img class="btdc" src="ops_door.jpg" alt=""><img class="btdo" src="ops_door_open.jpg" alt="">
      <div class="btsign">実戦<small>SIMULATION</small></div><div class="btap" id="btDoorAp"></div></div><div class="bthint">TAP TO ENTER</div><div class="btflash"></div></div>`);
    slidesEl.appendChild(s);
    const box = s.querySelector('.btdbox');
    let W = 863, H = 1822;
    const fit = () => { const p = box.parentNode, PW = p.clientWidth, PH = p.clientHeight; if (!PW) return; const k = Math.max(PW / W, PH / H);
      Object.assign(box.style, { width:W * k + 'px', height:H * k + 'px', left:(PW - W * k) / 2 + 'px', top:(PH - H * k) / 2 + 'px' }); box.style.setProperty('--u', k + 'px'); };
    fit(); addEventListener('resize', fit);
    // 専用のドア画像（bt_door.jpg / bt_door_open.jpg）を置けば、自動でそちらに切り替わる
    const t = new Image(); t.onload = () => { W = t.naturalWidth; H = t.naturalHeight; s.classList.remove('tmp'); box.querySelector('.btdc').src = 'bt_door.jpg'; box.querySelector('.btdo').src = 'bt_door_open.jpg'; fit(); }; t.src = 'bt_door.jpg';
    let tx = 0, ty = 0;
    s.addEventListener('pointerdown', e => { tx = e.clientX; ty = e.clientY; });
    s.addEventListener('pointerup', async e => {
      if (Math.hypot(e.clientX - tx, e.clientY - ty) >= 10 || s.classList.contains('opening')) return;
      ctx.resume(); haptic(); s.classList.add('opening', 'opened'); sfx('turn');
      await sleep(800); s.classList.add('flash'); await sleep(380); await open();
      setTimeout(() => s.classList.remove('opening', 'opened', 'flash'), 600);
    });
    return s;
  }
  async function paintDoor() { const b = $('btDoorAp'); if (!b) return; await load(); b.innerHTML = `<i>AP</i>${S.ap}/${AP_MAX}`; }
  function setDoor(v) { if (onDoor === v) return; onDoor = v; document.body.classList.toggle('atBtDoor', v); if (v) paintDoor(); }

  return {
    open, gainAP, makeDoor, setDoor, paintDoor,
    isDoor:() => onDoor,
    active:() => !!scr,
    bgm:() => scr === 'rt' ? BGM.fight : scr === 'result' ? (lastWin ? BGM.win : null) : scr ? BGM.hub : null,
    allBgm:() => Object.values(BGM),
    _dbg:() => ({ S, B }),
  };
})();
