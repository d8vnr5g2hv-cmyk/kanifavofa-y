// HALO LINK（Card Shop 版）— データ：キャラ・敵36体・ボス12体・ステージ・特性・事件。調整はこのファイルだけで済む
'use strict';
// 属性：弱点を突くとダメージ1.5倍（火→木→水→火、光⇔闇）
const ATTR = {
  fire:{n:'火', c:'#ff6a4d'}, water:{n:'水', c:'#47a8ff'}, wood:{n:'木', c:'#4fdc86'},
  light:{n:'光', c:'#ffd85a'}, dark:{n:'闇', c:'#b46bff'}, none:{n:'無', c:'#c9d3e8'},
};
const STRONG = { fire:'wood', wood:'water', water:'fire', light:'dark', dark:'light' };

// ===== 出撃できる8人（EXはその子のカードを使うとたまる） =====
// ex.fx は自作カードと同じ形 { k, v, n, t, all }。redraw だけEX専用（手札を引き直す）
const CHARS = {
  noa:    { n:'乃亜',   attr:'light', ex:{ n:'ねこの手ルーレット', txt:'手札をすべて引き直し（5枚）、エネルギー+2', fx:[{k:'redraw', v:5}, {k:'energy', v:2}] } },
  mika:   { n:'ミカ',   attr:'light', ex:{ n:'星降りの祈り',       txt:'敵全体に30ダメージ', fx:[{k:'dmg', v:30, n:1, all:true}] } },
  yuuka:  { n:'ユウカ', attr:'water', ex:{ n:'完全予算管理',       txt:'ガード20、エネルギー+1、2枚引く', fx:[{k:'guard', v:20}, {k:'energy', v:1}, {k:'draw', v:2}] } },
  hoshino:{ n:'ホシノ', attr:'fire',  ex:{ n:'鉄壁の構え',         txt:'ガード30、敵全体の攻撃-25%（2ターン）', fx:[{k:'guard', v:30}, {k:'weak', v:25, t:2, all:true}] } },
  kisaki: { n:'キサキ', attr:'wood',  ex:{ n:'皇帝の号令',         txt:'味方全員のHP12回復、攻撃+30%（3ターン）', fx:[{k:'heal', v:12, all:true}, {k:'atkup', v:30, t:3}] } },
  hina:   { n:'ヒナ',   attr:'dark',  ex:{ n:'終幕の一斉射',       txt:'敵全体に10×3ダメージ', fx:[{k:'dmg', v:10, n:3, all:true}] } },
  miyako: { n:'ミヤコ', attr:'water', ex:{ n:'包囲制圧',           txt:'敵全体に脆弱（3ターン）、3枚引く', fx:[{k:'vuln', t:3, all:true}, {k:'draw', v:3}] } },
  mari:   { n:'マリー', attr:'wood',  ex:{ n:'祝福の聖歌',         txt:'HP30回復、ガード10', fx:[{k:'heal', v:30}, {k:'guard', v:10}] } },
};
// タグ（シナジー）：同じタグが2人で×1.15、3人で×1.3（その子たちが使うカードに乗る）
const TAG = { guard:{n:'守護', c:'#5fb4ff'}, shoot:{n:'射撃', c:'#ff7a6a'}, pray:{n:'祈り', c:'#ffd76a'} };
const PARTY_DEF = {
  noa:{tag:'pray', hp:42}, hoshino:{tag:'guard', hp:62}, mika:{tag:'shoot', hp:46}, yuuka:{tag:'guard', hp:54},
  kisaki:{tag:'pray', hp:44}, hina:{tag:'shoot', hp:52}, miyako:{tag:'shoot', hp:46}, mari:{tag:'pray', hp:40},
};
const EX_GAUGE = 4;

// ===== 敵：12種 × 3色（a＝元の色／b＝緑：木／c＝青：水）。数字はステージ1の基準 =====
// 行動：atk[量,回数] 前列 / atkBack 後列 / atkAll 全員 / block / shield / str（力） / heal
//       weak・vuln（こちらに付与、ターン数） / poison（前列に毒） / drain（次のターンのエネルギー-1） / junk（散らかりカードを捨て札に入れる）
const SPECIES = [
  { k:'ghost',   n:'寝不足ゴースト',     a:'dark',  hp:26, pat:[{atk:[6, 1]}, {weak:1, atk:[4, 1]}, {drain:1, atk:[3, 1]}] },
  { k:'slime',   n:'散らかりスライム',   a:'dark',  hp:30, pat:[{junk:2}, {atk:[7, 1]}, {block:6, atk:[3, 1]}] },
  { k:'bat',     n:'浪費コウモリ',       a:'fire',  hp:22, pat:[{atk:[3, 3]}, {atkBack:[6, 1]}, {drain:1, atk:[3, 1]}] },
  { k:'clock',   n:'締切時計',           a:'fire',  hp:34, pat:[{atk:[5, 1]}, {atk:[8, 1]}, {atk:[12, 1], str:1}] },
  { k:'junk',    n:'ジャンクフードの箱', a:'fire',  hp:36, pat:[{poison:3}, {atk:[8, 1]}, {heal:6, block:4}] },
  { k:'pillow',  n:'まどろみ枕',         a:'light', hp:40, pat:[{block:10}, {weak:2}, {atk:[10, 1]}] },
  { k:'knight',  n:'月曜の騎士',         a:'light', hp:48, pat:[{block:10, atk:[6, 1]}, {atk:[14, 1]}, {vuln:1, atk:[6, 1]}] },
  { k:'phantom', n:'給料日前の亡霊',     a:'dark',  hp:38, pat:[{drain:1, atk:[5, 1]}, {atkAll:[5, 1]}, {weak:1, vuln:1}] },
  { k:'octo',    n:'二日酔いのタコ',     a:'dark',  hp:44, pat:[{atk:[4, 3]}, {poison:4}, {junk:1, atk:[6, 1]}] },
  { k:'tree',    n:'怠けの大樹',         a:'light', hp:64, pat:[{block:14}, {atk:[9, 1], str:1}, {atkAll:[6, 1]}] },
  { k:'golem',   n:'積読ゴーレム',       a:'dark',  hp:58, pat:[{junk:3}, {atk:[16, 1]}, {block:12}] },
  { k:'train',   n:'終電機関車',         a:'dark',  hp:52, pat:[{atk:[8, 1]}, {atk:[8, 2]}, {atkAll:[10, 1]}, {drain:1}] },
];
const VAR = { a:{ s:'', hp:1 }, b:{ s:'・翠', a:'wood', hp:1.1 }, c:{ s:'・蒼', a:'water', hp:1.05 } };
const ENEMIES = {};
SPECIES.forEach((sp, i) => ['a', 'b', 'c'].forEach(v => {
  const V = VAR[v], id = `${sp.k}_${v}`;
  ENEMIES[id] = { id, sp:i, n:sp.n + V.s, img:`hl_en${String(i + 1).padStart(2, '0')}${v}`, attr:V.a || sp.a, hp:Math.round(sp.hp * V.hp), pat:sp.pat };
}));

// ===== ボス12体（控えめのサイズ）。シールドを割らないと、カウント0で全員に大ダメージ。HP半分で第2形態 =====
const BOSSES = [
  { n:'夜更かしの王',       attr:'dark',  hp:150, shield:30, cnt:18, pat:[{atk:[10, 1]}, {drain:1, atkBack:[7, 1]}, {shield:20, str:1}, {atk:[5, 3]}] },
  { n:'浪費の魔王',         attr:'fire',  hp:165, shield:32, cnt:19, pat:[{atk:[4, 4]}, {drain:1, junk:2}, {shield:22}, {atkAll:[8, 1]}] },
  { n:'締切の巨人',         attr:'light', hp:180, shield:36, cnt:20, pat:[{atk:[12, 1]}, {atk:[16, 1]}, {shield:24, str:2}, {vuln:2, atk:[8, 1]}] },
  { n:'ガラクタ城',         attr:'dark',  hp:200, shield:44, cnt:20, pat:[{junk:3, block:12}, {atk:[14, 1]}, {shield:26}, {atkAll:[9, 1]}] },
  { n:'深夜の冷蔵庫竜',     attr:'water', hp:200, shield:40, cnt:22, pat:[{poison:5}, {atk:[7, 2]}, {shield:26, heal:12}, {atkAll:[10, 1]}] },
  { n:'スマホの魔眼',       attr:'dark',  hp:210, shield:42, cnt:22, pat:[{weak:2, vuln:1}, {atk:[6, 3]}, {drain:1, shield:26}, {atkBack:[12, 1]}, {atkAll:[9, 1]}] },
  { n:'月曜の騎士王',       attr:'light', hp:230, shield:48, cnt:24, pat:[{block:16, atk:[10, 1]}, {atk:[20, 1]}, {shield:28, str:2}, {vuln:2, atkAll:[8, 1]}] },
  { n:'給料日前の亡霊王',   attr:'dark',  hp:230, shield:46, cnt:24, pat:[{drain:2}, {atkAll:[9, 1]}, {shield:28, weak:2}, {atk:[7, 3]}] },
  { n:'二日酔いの大ダコ',   attr:'water', hp:245, shield:48, cnt:25, pat:[{atk:[5, 4]}, {poison:6, junk:2}, {shield:30}, {atkAll:[11, 1]}] },
  { n:'怠けの大樹王',       attr:'wood',  hp:270, shield:54, cnt:26, pat:[{block:20, heal:15}, {atkAll:[10, 1]}, {shield:32, str:2}, {weak:2, atk:[16, 1]}] },
  { n:'積読の大ゴーレム',   attr:'light', hp:270, shield:56, cnt:27, pat:[{junk:4}, {atk:[24, 1]}, {shield:34, block:14}, {atkAll:[12, 1]}] },
  { n:'終電の魔機関車',     attr:'fire',  hp:300, shield:60, cnt:28, pat:[{atk:[10, 2]}, {drain:2, atkBack:[14, 1]}, {shield:36, str:2}, {atkAll:[12, 1]}, {atk:[6, 4]}] },
];
BOSSES.forEach((b, i) => { b.id = 'boss' + (i + 1); b.img = `hl_boss${String(i + 1).padStart(2, '0')}`; b.boss = true; ENEMIES[b.id] = b; });

// ===== ステージ（1〜12）。ボスは同じ番号。HP・攻撃の倍率は少しずつ上がる =====
const STAGES = BOSSES.map((b, i) => {
  const no = i + 1, lo = Math.max(0, i - 3), hi = Math.min(11, i + 1);
  return { no, n:b.n, boss:b.id, pool:SPECIES.slice(lo, hi + 1).map((_, j) => lo + j), hp:1.1 + no * .12, atk:1.05 + no * .08, count:no >= 9 ? 3 : 4 };
});
// HARD：クリア後に開く。さらに強く、カウントも早い
const HARD = { hp:1.5, atk:1.3, count:-1 };
const LAYERS = 8;   // 7層＋ボス
const RAGE_TURN = 9;   // ボス戦がこのターンを越えると、毎ターン力+2

// ===== 散らかりカード（敵が混ぜてくる。効果なし、使うと消える） =====
const JUNK = { id:'x_junk', name:'散らかり', who:'yohei', rank:1, cost:1, fx:[], junk:true, art:{ kind:'basic', static:'hl_g_def.webp' } };

// ===== 特性（永続のパッシブ）：記章で解放 =====
const PASSIVES = [
  {id:'p_block', n:'前列の構え', cost:10, txt:'戦闘開始時、ガード6'},
  {id:'p_heal',  n:'応急処置',   cost:15, txt:'戦闘に勝つたび、全員のHP+4'},
  {id:'p_ex',    n:'EX準備',     cost:20, txt:'戦闘開始時、全員のEXゲージ+1'},
  {id:'p_chain', n:'連携強化',   cost:25, txt:'連携の倍率が1枚ごと+0.15（通常+0.1）'},
  {id:'p_clean', n:'片付け上手', cost:25, txt:'散らかりカードを使うと、1枚引く'},
  {id:'p_cost',  n:'先手必勝',   cost:30, txt:'各戦闘の1ターン目、エネルギー+1'},
];
// ===== 事件マス =====
const EVENTS = [
  {n:'差し入れ', txt:'誰かが差し入れを置いていった。', opts:[{t:'食べる（全員HP+10）', fx:'healAll10'}, {t:'持って帰る（記章+3）', fx:'badge3'}]},
  {n:'特訓',     txt:'少し時間がある。何をしよう？',   opts:[{t:'走り込み（全員の最大HP+4）', fx:'maxhp4'}, {t:'作戦会議（カードを1枚得る）', fx:'card'}]},
  {n:'怪しい箱', txt:'封をされた箱が落ちている。',     opts:[{t:'開ける（★以上のカード、または前列が10ダメージ）', fx:'gamble'}, {t:'放っておく', fx:'none'}]},
  {n:'自販機',   txt:'動いている自販機を見つけた。',   opts:[{t:'記章5でカードを1枚外す', fx:'remove5'}, {t:'通り過ぎる', fx:'none'}]},
  {n:'片付け',   txt:'部屋が散らかっている……',        opts:[{t:'片付ける（カードを1枚外す、前列HP-5）', fx:'clean'}, {t:'見なかったことにする', fx:'none'}]},
];
