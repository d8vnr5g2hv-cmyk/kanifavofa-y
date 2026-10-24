// Kani Favorite — Yohei's Coffee（自室の扉のさらに左。先生が作って、当番が運ぶカフェ）
'use strict';
const Cafe = (() => {
  // ===== 人 =====
  const NAME = { hoshino:'ホシノ', mika:'ミカ', miyako:'ミヤコ', mari:'マリー', serina:'セリナ', kisaki:'キサキ', hina:'ヒナ', seia:'セイア', noa:'ノア', yuuka:'ユウカ', hikari:'ヒカリ', nico:'ニコ' };
  const KEYS = Object.keys(NAME);
  const HEIGHT = { hoshino:145, mika:157, hina:142, miyako:156, mari:151, serina:156, yuuka:156, noa:161, seia:149, kisaki:142, hikari:147, nico:160 };
  const img = (k, p) => { if (k === 'hikari' && p === 'stand') p = 'sit'; return `o_${k}_${p}.webp`; };
  const FAV = { hoshino:'cocoa', mika:'roll', hina:'blend', miyako:'strmilk', mari:'pudding', serina:'pancake', kisaki:'matcha', seia:'icetea', noa:'macaron', yuuka:'cheese', hikari:'hotdog', nico:'omurice' };

  // ===== メニュー =====
  // kind：drink＝抽出ゲージ／food＝焼き加減リング／sweet＝材料を順番に
  const ING = ['', '豆', 'ミルク', '砂糖', 'クリーム', 'いちご', '抹茶', 'チョコ', 'たまご'];
  const M = (id, n, kind, pic, price, cost, x) => ({ id, n, kind, pic, price, cost, ...x });
  const MENU = [
    M('blend', 'ブレンドコーヒー', 'drink', 'cf_drink1', 10, 0, { steps:['抽出'] }),
    M('latte', 'カフェラテ', 'drink', 'cf_drink2', 12, 0, { steps:['抽出', 'ミルク'] }),
    M('capp', 'カプチーノ', 'drink', 'cf_drink3', 13, 40, { steps:['抽出', 'フォーム'] }),
    M('matcha', '抹茶ラテ', 'drink', 'cf_drink4', 14, 60, { steps:['抹茶', 'ミルク'] }),
    M('cocoa', 'ホットココア', 'drink', 'cf_drink5', 13, 50, { steps:['ココア', 'マシュマロ'] }),
    M('icetea', 'アイスティー', 'drink', 'cf_drink6', 12, 40, { steps:['紅茶'] }),
    M('melon', 'クリームソーダ', 'drink', 'cf_drink7', 15, 80, { steps:['ソーダ', 'アイス'] }),
    M('strmilk', 'いちごミルク', 'drink', 'cf_drink8', 14, 70, { steps:['いちご', 'ミルク'] }),
    M('eggsand', 'たまごサンド', 'food', 'cf_food1', 18, 0, { steps:['焼く'] }),
    M('napo', 'ナポリタン', 'food', 'cf_food2', 22, 90, { steps:['炒める', '仕上げ'] }),
    M('omurice', 'オムライス', 'food', 'cf_food3', 24, 110, { steps:['炒める', '包む'] }),
    M('hotdog', 'ホットドッグ', 'food', 'cf_food4', 18, 70, { steps:['焼く'] }),
    M('pizza', 'ピザトースト', 'food', 'cf_food5', 20, 80, { steps:['焼く', 'チーズ'] }),
    M('curry', 'カレーライス', 'food', 'cf_food6', 22, 100, { steps:['煮込む', '盛る'] }),
    M('club', 'クラブサンド', 'food', 'cf_food7', 21, 90, { steps:['焼く', '重ねる'] }),
    M('inari', 'いなり寿司', 'food', 'cf_food8', 19, 120, { steps:['煮る'] }),
    M('short', 'ショートケーキ', 'sweet', 'cf_sweet1', 16, 0, { rec:[4, 5, 3] }),
    M('pudding', 'プリン', 'sweet', 'cf_sweet2', 15, 60, { rec:[8, 2, 3] }),
    M('pancake', 'パンケーキ', 'sweet', 'cf_sweet3', 18, 80, { rec:[8, 2, 4] }),
    M('cheese', 'チーズケーキ', 'sweet', 'cf_sweet4', 17, 70, { rec:[4, 8, 3] }),
    M('parfait', 'いちごパフェ', 'sweet', 'cf_sweet5', 22, 120, { rec:[4, 5, 7] }),
    M('roll', 'ロールケーキ', 'sweet', 'cf_sweet6', 18, 90, { rec:[8, 4, 5] }),
    M('donut', 'ドーナツ', 'sweet', 'cf_sweet7', 16, 70, { rec:[7, 3, 2] }),
    M('macaron', 'マカロン', 'sweet', 'cf_sweet8', 20, 110, { rec:[6, 5, 3] }),
  ];
  const MID = Object.fromEntries(MENU.map(m => [m.id, m]));
  const KIND_NAME = { drink:'ドリンク', food:'フード', sweet:'スイーツ' };

  // ===== 家具 =====
  // type：seat（客席）／top（上の壁）／wall（壁）／counter（台の上）／floor（床）
  const I = (id, n, type, pic, cost, x) => ({ id, n, type, pic, cost, ...x });
  const ITEMS = [
    I('t1', '丸テーブル', 'seat', 'cf_table1', 0), I('t2', '四角テーブル', 'seat', 'cf_table2', 0), I('t3', '窓ぎわカウンター', 'seat', 'cf_table3', 140),
    I('t4', '大理石テーブル', 'seat', 'cf_table4', 120), I('t5', 'パステルテーブル', 'seat', 'cf_table5', 110), I('t6', 'ちゃぶ台', 'seat', 'cf_table6', 90),
    I('t7', 'ハイテーブル', 'seat', 'cf_table7', 100), I('t8', '4人がけテーブル', 'seat', 'cf_table8', 150),
    I('s1', 'クリームソファ', 'seat', 'cf_sofa1', 160), I('s2', 'ミントソファ', 'seat', 'cf_sofa2', 150), I('s3', 'ピンクのソファ', 'seat', 'cf_sofa3', 150),
    I('s4', '木のベンチ', 'seat', 'cf_sofa4', 110), I('s5', 'ひとりがけソファ', 'seat', 'cf_sofa5', 130), I('s6', 'ボックス席', 'seat', 'cf_sofa6', 180),
    I('s7', 'ハンギングチェア', 'seat', 'cf_sofa7', 170), I('s8', '革のソファ', 'seat', 'cf_sofa8', 180),
    I('clock', '壁かけ時計', 'wall', 'cf_deco_a1', 50), I('frame', '花の額縁', 'wall', 'cf_deco_a2', 40), I('bunting', 'ガーランド', 'top', 'cf_deco_a3', 40),
    I('jars', '瓶の棚', 'wall', 'cf_deco_a4', 70), I('record', 'レコードプレーヤー', 'counter', 'cf_deco_a5', 120), I('whale', 'クジラのぬいぐるみ', 'counter', 'cf_deco_a6', 80),
    I('fish', '金魚鉢', 'counter', 'cf_deco_a7', 90), I('lantern', 'ペンダントライト', 'top', 'cf_deco_a8', 100),
    I('monstera', 'モンステラ', 'floor', 'cf_deco_b1', 60), I('lamp', 'フロアランプ', 'floor', 'cf_deco_b2', 80), I('vase', '花びん', 'counter', 'cf_deco_b3', 40),
    I('books', '本と猫のブックエンド', 'counter', 'cf_deco_b4', 60), I('penguin', 'ペンギンのぬいぐるみ', 'floor', 'cf_deco_b5', 90), I('board', '黒板スタンド', 'floor', 'cf_deco_b6', 50),
    I('cat', 'ねこクッション', 'floor', 'cf_deco_b7', 70), I('globe', '地球儀', 'counter', 'cf_deco_b8', 80),
    I('xmas', 'クリスマスツリー', 'floor', 'cf_season1', 120, { season:[11, 12] }), I('pumpkin', 'ハロウィンかぼちゃ', 'counter', 'cf_season2', 100, { season:[9, 10] }),
    I('sakura', '桜の花びん', 'counter', 'cf_season3', 100, { season:[3, 4] }), I('chime', '風鈴', 'top', 'cf_season4', 100, { season:[6, 7, 8] }),
    I('snowman', '雪だるま', 'floor', 'cf_season5', 110, { season:[12, 1, 2] }), I('mikan', 'みかんのかご', 'counter', 'cf_season6', 80, { season:[11, 12, 1] }),
    I('sunflower', 'ひまわり', 'floor', 'cf_season7', 100, { season:[7, 8] }), I('maple', '紅葉のガーランド', 'top', 'cf_season8', 100, { season:[10, 11] }),
  ];
  const IID = Object.fromEntries(ITEMS.map(x => [x.id, x]));
  const TYPE_NAME = { seat:'テーブル・ソファ', top:'上の壁', wall:'壁', counter:'台の上', floor:'床' };
  const inSeason = x => !x.season || x.season.includes(new Date().getMonth() + 1);

  // ===== 置き場（背景 941×1672 の中の%）=====
  // p：0＝カウンター／1＝客席。cx・by＝中心x・足元y、w＝幅、lv＝使えるようになるレベル
  const SLOTS = [
    { id:'A', p:1, type:'seat', cx:31, by:67, w:31, lv:1 },
    { id:'D', p:1, type:'seat', cx:61, by:86, w:35, lv:1 },
    { id:'B', p:1, type:'seat', cx:70, by:68, w:31, lv:2 },
    { id:'C', p:1, type:'seat', cx:31, by:86, w:35, lv:3 },
    { id:'T1', p:1, type:'top', cx:57, by:21, w:32, lv:1 },
    { id:'W1', p:1, type:'wall', cx:15, by:35, w:10, lv:1 },
    { id:'F1', p:1, type:'floor', cx:19, by:56, w:13, lv:1 },
    { id:'F2', p:1, type:'floor', cx:85, by:60, w:13, lv:2 },
    { id:'K1', p:0, type:'counter', cx:29, by:30.6, w:10, lv:1 },
    { id:'K2', p:0, type:'counter', cx:70, by:44.5, w:8, lv:2 },
    { id:'W2', p:0, type:'wall', cx:15, by:31, w:9, lv:3 },
    { id:'F3', p:0, type:'floor', cx:75, by:77, w:15, lv:3 },
  ];
  const SID = Object.fromEntries(SLOTS.map(s => [s.id, s]));
  const MAXH = { seat:15, top:13, wall:9, counter:7, floor:15 };   // 縦に長い家具が大きくなりすぎないように（背景の高さに対する%）
  const LV_AT = [0, 0, 30, 100];   // このレベルになる累計の皿数
  const DUTY_AT = { cx:50, by:73, h:31 };   // 当番の立ち位置（カウンターの前）

  // ===== セリフ =====
  const L = (o) => o;
  const LINES = {
    hoshino:L({ in:'うへ〜、来ちゃった〜。先生のお店、落ち着くねぇ', order:'おじさんは、あったかいのがいいなぁ〜', eat:'ん〜、しみる〜……', fav:'ココアだぁ〜。先生、わかってるねぇ〜', bye:'ごちそうさま〜。先生も、ちゃんと休憩してね〜', sad:'うへ〜……おじさん、ちょっと待ちくたびれちゃった〜', tap:['ふぁ〜……ここ、お昼寝にちょうどいいねぇ', '先生、働きすぎてない〜？ おじさんの目はごまかせないよ〜'] }),
    mika:L({ in:'先生☆ 来ちゃった！ ねえ、今日のおすすめは？', order:'ん〜、これにする！ 先生が作ってくれるんだよね？', eat:'おいしい〜！ 先生、天才じゃん☆', fav:'ロールケーキ！ えへへ、覚えててくれたの？', bye:'ごちそうさま☆ また来るね、先生！', sad:'もう、先生ったら……私のこと忘れてたでしょ', tap:['今日の当番、ずるいなぁ。私も先生と一緒に働きたかった☆', '先生のエプロン姿、ちょっと見てみたいかも☆'] }),
    hina:L({ in:'……少し、休憩しに来たわ', order:'これをお願い。急がなくていいから', eat:'……ん。おいしい', fav:'ブレンド……。ちょうど飲みたかったの', bye:'ごちそうさま。……また、来てもいいかしら', sad:'……今日は時間切れね。また来るわ', tap:['書類のことは、今は考えないことにしたの', '先生も、たまには座ったら？'] }),
    miyako:L({ in:'RABBIT1、入店しました。……周囲に異常なし', order:'こちらを注文します。了解です、待機します', eat:'……おいしいです。任務の疲れが取れます', fav:'いちごミルク……！ 先生、どうしてそれを', bye:'ごちそうさまでした。RABBIT1、帰投します', sad:'……撤退します。また出直します', tap:['店内の警戒は、私に任せてください', 'うさぎの付箋、レジの横に貼っておきました'] }),
    mari:L({ in:'先生、こんにちは。お邪魔してもよろしいですか？', order:'では、こちらをお願いしてもいいでしょうか', eat:'とてもおいしいです……。心まで温かくなります', fav:'プリン……！ ふふ、嬉しいです', bye:'ごちそうさまでした。先生に、良いことがありますように', sad:'お忙しいようですね。また改めて伺います', tap:['このお店、皆さんの笑顔であふれていますね', '先生、どうか無理はなさらないでくださいね'] }),
    serina:L({ in:'先生、お疲れさまです。少しだけ寄らせてください', order:'こちらをお願いします。ゆっくりで大丈夫ですよ', eat:'おいしいです。元気が出ますね', fav:'パンケーキ……！ ご褒美みたいです', bye:'ごちそうさまでした。先生も、ちゃんと休んでくださいね', sad:'すみません、救護の呼び出しが……また来ますね', tap:['火傷には気をつけてくださいね、先生', '何かあったら、すぐに呼んでくださいね'] }),
    kisaki:L({ in:'ふむ、ここが先生の店か。悪くない', order:'これを所望する。ゆるりと作るがよい', eat:'……うむ。見事じゃ', fav:'抹茶か。先生、妾の好みをよう知っておるな', bye:'馳走になった。また寄らせてもらうぞ', sad:'待たせすぎじゃ、先生。今日は帰るとしよう', tap:['この店の茶、もう少し研究の余地があるのう', '妾が通う店じゃ。誇ってよいぞ'] }),
    seia:L({ in:'やあ、先生。この時間に来ると、夢で見ていたよ', order:'これを頼むよ。……うん、それでいい', eat:'穏やかな味だ。悪くない', fav:'アイスティーか。先生には、やはり見えているのかな', bye:'ごちそうさま。今日の夢は、きっと良いものになる', sad:'……そういう未来だったようだね。また来るよ', tap:['こうして座っていると、時間を忘れてしまうね', 'ミカも来ていたのかい？ ……ふふ、そうだろうね'] }),
    noa:L({ in:'先生♪ 今日の来店も、記録しておきますね', order:'こちらをお願いします。先生の手際、拝見しますね', eat:'ふふ、おいしいです♪', fav:'マカロン……！ 記録に「満点」とつけておきます♪', bye:'ごちそうさまでした♪ ユウカちゃんには内緒ですよ', sad:'あら、時間切れですね。今日の記録はここまでです', tap:['先生のお店の売り上げ、ちゃんと記録していますよ♪', 'ユウカちゃんも、あとで来るかもしれません'] }),
    yuuka:L({ in:'先生、売り上げはどうですか？ 確認しに来ました', order:'これをお願いします。……原価率、ちゃんと計算してますか？', eat:'……おいしいです。悔しいけど、おいしいです', fav:'チーズケーキ！ ……べ、別に嬉しくなんか', bye:'ごちそうさまでした。レシートはちゃんと保管してくださいね', sad:'もう、先生！ お客さんを待たせすぎです！', tap:['仕入れの帳簿、あとで見せてくださいね', '先生、また変なものを経費で買ってませんよね？'] }),
    hikari:L({ in:'おみせだーー！ はいってもいいーー？', order:'これーー！ これがいいーー！', eat:'おいしーーー！', fav:'ホットドッグーー！ やったーーー！', bye:'ごちそうさまーー！ またくるーー！', sad:'まちくたびれたーー……かえるーー', tap:['せんせーー、エプロンにあってるーー', 'でんしゃのじかんまで、ここにいるーー'] }),
    nico:L({ in:'先生、こんにちは〜。いい匂いがしますね〜', order:'これをお願いします〜。楽しみですね〜', eat:'ん〜、おいしいです〜', fav:'オムライス〜！ ケチャップのハート、かわいいですね〜', bye:'ごちそうさまでした〜。また来ますね〜', sad:'お店、忙しそうですね〜。また来ます〜', tap:['今度、私にも厨房を手伝わせてくださいね〜', 'このお店、ずっと続いてほしいですね〜'] }),
  };
  // 当番（店員）のセリフ
  const DUTY = {
    hoshino:{ hi:'うへ〜、今日はおじさんが店員さんだよ〜。先生、よろしくね〜', take:'ご注文、いただきました〜', serve:'お待たせ〜。ゆっくりしていってね〜', idle:['先生〜、休憩もお仕事のうちだよ〜', 'お客さん、来るかなぁ〜'], night:'先生〜、こんな時間までお店開けてて大丈夫〜？ ほどほどにしようね〜' },
    mika:{ hi:'今日は私が店員さんだよ☆ 先生、いっぱい作ってね！', take:'ご注文入りました☆', serve:'お待たせしました〜☆', idle:['先生とお店やるの、楽しいね☆', 'ねえ先生、看板娘って私のことだよね？'] },
    hina:{ hi:'今日は私が店員。……接客は、なんとかするわ', take:'注文、入ったわ', serve:'……お待たせしました', idle:['……忙しいほうが、落ち着くわね', '先生、手が止まってるわよ'] },
    miyako:{ hi:'本日の店員はRABBIT1です。任務、開始します', take:'注文を受領しました', serve:'お待たせしました。ご注文の品です', idle:['店内、異常ありません', '配膳ルート、確認済みです'] },
    mari:{ hi:'今日は私がお手伝いします。先生、よろしくお願いします', take:'ご注文をいただきました', serve:'お待たせいたしました', idle:['皆さんに喜んでいただけると嬉しいですね', '先生、お水をどうぞ'] },
    serina:{ hi:'今日は私が店員です。火傷には気をつけてくださいね', take:'ご注文です、先生', serve:'お待たせしました。熱いのでお気をつけて', idle:['先生、手は大丈夫ですか？', '救急箱、カウンターの下に置いておきました'] },
    kisaki:{ hi:'今日は妾が給仕をしてやろう。光栄に思うがよい', take:'注文じゃ、先生', serve:'待たせたな。味わうがよい', idle:['ふむ、接客というのも面白いものじゃ', '先生、手際が良くなってきたのう'] },
    seia:{ hi:'今日は私が店員だよ。……給仕の夢も、見たことがある', take:'注文が入ったよ、先生', serve:'お待たせ。どうぞ', idle:['次のお客さんは、もうすぐ来るよ', '先生、少し肩の力を抜くといい'] },
    noa:{ hi:'今日の店員はノアです♪ 先生の働きぶり、記録しますね', take:'ご注文、承りました♪', serve:'お待たせしました♪', idle:['本日の売り上げ、順調ですよ♪', '先生のエプロン姿も、記録しておきますね'] },
    yuuka:{ hi:'今日は私が店員です！ 売り上げ、しっかり管理しますからね', take:'注文入りました！ 先生、急いで！', serve:'お待たせしました！', idle:['原価と売り上げ、計算しておきますね', '先生、レシピのメモ取ってますか？'] },
    hikari:{ hi:'きょうは、ひかりがてんいんーー！', take:'ちゅうもん、はいったーー！', serve:'おまたせーーー！', idle:['おきゃくさん、まだかなーー', 'ひかり、はこぶのとくいーー'] },
    nico:{ hi:'今日は私が店員さんですよ〜。先生、一緒に頑張りましょうね〜', take:'ご注文いただきました〜', serve:'お待たせしました〜', idle:['いい匂いですね〜', '先生、味見してもいいですか〜？'] },
  };

  // ===== 状態 =====
  const ST_ID = 'cafe-state';
  let S = null, el = null, active = false, onDoor = false, duty = 'hoshino', per = 'day', page = 0;
  let guests = [], orders = [], tick = null, spawnAt = 0, uid = 0, cooking = false, editing = false, busyServe = false;
  const fresh = () => ({ id:ST_ID, coins:60, served:0, lv:1, owned:{ t1:true, t2:true }, place:{ A:'t1', D:'t2' }, menu:{ blend:true, latte:true, eggsand:true, short:true },
    dex:{ menu:{}, guest:{} }, today:{ date:'', coins:0, served:0 }, best:{ coins:0 } });
  async function load() {
    if (S) return S;
    S = Object.assign(fresh(), await DB.get('room', ST_ID).catch(() => null) || {});
    S.dex = Object.assign({ menu:{}, guest:{} }, S.dex);
    return S;
  }
  let saveT = 0;
  function save() { clearTimeout(saveT); saveT = setTimeout(() => DB.put('room', S).catch(() => {}), 300); }
  const lvOf = n => n >= LV_AT[3] ? 3 : n >= LV_AT[2] ? 2 : 1;
  const isDay = (d = new Date()) => d.getHours() >= 6 && d.getHours() < 18;
  const dutyDay = (d = new Date()) => d.getHours() < 6 ? D.add(D.key(d), -1) : D.key(d);

  // ===== 音 =====
  function sfx(kind) {
    try {
      const t = ctx.currentTime, g = ctx.createGain(); g.gain.value = .35; g.connect(ctx.destination);
      const tone = (f, a, d, at = 0, type = 'sine') => { const o = ctx.createOscillator(), gg = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t + at);
        gg.gain.setValueAtTime(0, t + at); gg.gain.linearRampToValueAtTime(a, t + at + .01); gg.gain.exponentialRampToValueAtTime(.0001, t + at + d); o.connect(gg); gg.connect(g); o.start(t + at); o.stop(t + at + d + .05); };
      if (kind === 'bell') { tone(1568, .2, .5); tone(2093, .14, .6, .12); }
      if (kind === 'tap') tone(1175, .12, .1, 0, 'triangle');
      if (kind === 'order') { tone(880, .14, .12, 0, 'triangle'); tone(1320, .14, .18, .08, 'triangle'); }
      if (kind === 'stop') tone(660, .16, .1, 0, 'square');
      if (kind === 'good') { tone(1047, .16, .15); tone(1319, .16, .2, .08); }
      if (kind === 'perfect') { tone(1047, .18, .15); tone(1319, .18, .15, .07); tone(1568, .18, .3, .14); tone(2093, .12, .4, .21); }
      if (kind === 'miss') tone(220, .18, .25, 0, 'sawtooth');
      if (kind === 'coin') { tone(1976, .14, .08, 0, 'square'); tone(2637, .14, .25, .06, 'square'); }
      if (kind === 'lv') [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, .16, .35, i * .09, 'triangle'));
      if (kind === 'sad') { tone(440, .12, .2, 0, 'triangle'); tone(370, .12, .3, .15, 'triangle'); }
    } catch(e) {}
  }

  // ===== 入口（メモロビの左端のさらに先）=====
  function makeDoor() {
    const s = h(`<div class="slide cdoor"><div class="cdbox"><img class="cc" alt=""><img class="co" alt="">
      <div class="csign">Yohei's Coffee</div><div class="cboard"><b>OPEN</b><span id="cfRec"></span></div></div>
      <div class="rhint">TAP TO ENTER</div><div class="rflash"></div></div>`);
    slidesEl.insertBefore(s, slidesEl.firstChild);
    const box = s.querySelector('.cdbox'), fit = () => { fitBox(box, 1024, 1536, 800); const sc = parseFloat(box.style.width) / 1024, l = parseFloat(box.style.left) || 0; s.querySelector('.cboard').style.visibility = l + 70 * sc < 0 ? 'hidden' : ''; };
    fit(); addEventListener('resize', fit);
    let tx = 0, ty = 0;
    s.addEventListener('pointerdown', e => { tx = e.clientX; ty = e.clientY; });
    s.addEventListener('pointerup', e => { if (Math.hypot(e.clientX - tx, e.clientY - ty) < 10) openDoor(s); });
    paintDoor(s);
    return s;
  }
  function fitBox(box, w, hh, keepX) {
    const p = box.parentNode, PW = p.clientWidth, PH = p.clientHeight; if (!PW) return;
    const s = Math.max(PW / w, PH / hh);
    let left = (PW - w * s) / 2;
    if (keepX && left + keepX * s > PW - 6) left = Math.max(PW - w * s, PW - 6 - keepX * s);
    Object.assign(box.style, { width:w * s + 'px', height:hh * s + 'px', left:left + 'px', top:(PH - hh * s) / 2 + 'px' });
    box.style.setProperty('--u', s + 'px');
  }
  function paintDoor(s = slidesEl.querySelector('.cdoor')) {
    if (!s) return;
    const p = isDay() ? 'd' : 'n';
    const c = s.querySelector('.cc'), o = s.querySelector('.co');
    if (!c.src.endsWith(`cafe_door_${p}.jpg`)) { c.src = `cafe_door_${p}.jpg`; o.src = `cafe_door_open_${p}.jpg`; }
    s.classList.toggle('night', p === 'n');
    load().then(() => { const r = $('cfRec'); if (!r) return; const on = MENU.filter(m => S.menu[m.id]); const m = on[(new Date().getDate()) % on.length]; r.textContent = m ? `本日のおすすめ\n${m.n}` : ''; });
  }
  async function openDoor(s) {
    if (s.classList.contains('opening')) return;
    ctx.resume(); haptic(); paintDoor(s);
    s.classList.add('opening'); preload(); sfx('bell');
    s.classList.add('opened');
    await sleep(750); s.classList.add('flash');
    await sleep(380); await enter();
    setTimeout(() => s.classList.remove('opening', 'opened', 'flash'), 600);
  }
  function setDoor(v) {
    if (onDoor === v) return;
    onDoor = v; document.body.classList.toggle('atCafeDoor', v);
    if (v) { paintDoor(); preload(); }
  }
  let pre = false;
  function preload() {
    if (pre) return; pre = true;
    const p = isDay() ? 'd' : 'n';
    load().then(() => [`cafe_door_open_${p}.jpg`, `cafe_counter${S.lv}_${p}.jpg`, `cafe_seat${S.lv}_${p}.jpg`, img(duty, 'stand')].forEach(x => { const i = new Image(); i.src = x; }));
  }

  // ===== 店内 =====
  const pctBox = (s, extra = '') => `left:${s.cx}%;bottom:${100 - s.by}%;width:${s.w}%;${extra}`;
  function build() {
    el = h(`<div id="cafe">
      <div class="cfs" id="cfs">
        <div class="cfp" data-p="0"><div class="cfbx"><img class="bg" id="cfBg0" alt=""><div class="cfmb" id="cfMB"></div><div class="lay" id="cfL0"></div>
          <div class="cfduty" id="cfDuty"><div class="dw"><img class="s" alt=""><img class="t" alt=""></div></div></div>
          <div class="cfrail" id="cfRail"><div class="rh"><b>ORDER</b><span>注文票をタップして作る</span></div><div class="tk" id="cfTk"></div></div></div>
        <div class="cfp" data-p="1"><div class="cfbx"><img class="bg" id="cfBg1" alt=""><div class="lay" id="cfL1"></div></div></div>
      </div>
      <div class="cfhud"><button class="cfback" id="cfBack">‹ 出る</button>
        <div class="cfttl"><b>Yohei's Coffee</b><span id="cfLv"></span></div>
        <div class="cfcoin" id="cfCoin"><img src="cf_ui1.webp" alt=""><b id="cfCoinN">0</b></div></div>
      <div class="cfbar"><button data-x="menu"><img src="cf_menu_board1.webp" alt=""><span>メニュー</span></button><button data-x="edit"><img src="cf_deco_b1.webp" alt=""><span>模様替え</span></button>
        <button data-x="book"><img src="cf_ui7.webp" alt=""><span>図鑑</span></button></div>
      <div class="cfnav"><button data-go="0" class="on">カウンター<i id="cfBadge"></i></button><button data-go="1">客席<i id="cfBadge2"></i></button></div>
      <div class="cfbub" id="cfSay"></div>
      <div id="cfOv"></div>
    </div>`);
    document.body.appendChild(el);
    const cfs = $('cfs');
    cfs.addEventListener('scroll', () => {
      const i = Math.round(cfs.scrollLeft / cfs.clientWidth);
      if (i !== page) { page = i; el.querySelectorAll('.cfnav button').forEach((b, k) => b.classList.toggle('on', k === i)); hideSay(); }
    }, { passive:true });
    el.addEventListener('click', onClick);
    $('cfBack').onclick = exit;
    addEventListener('resize', fit);
  }
  function fit() { if (el) el.querySelectorAll('.cfbx').forEach(b => fitBox(b, 941, 1672)); }
  const go = (p, smooth = true) => { const cfs = $('cfs'); cfs.scrollTo({ left:cfs.clientWidth * p, behavior:smooth ? 'smooth' : 'auto' }); };

  function paint() {
    per = isDay() ? 'day' : 'night'; const p = per === 'day' ? 'd' : 'n';
    el.classList.toggle('night', per !== 'day');
    $('cfBg0').src = `cafe_counter${S.lv}_${p}.jpg`; $('cfBg1').src = `cafe_seat${S.lv}_${p}.jpg`;
    $('cfLv').textContent = `Lv.${S.lv}`;
    drawCoins(); drawMenuBoard(); drawLayout(); drawDuty(); drawTickets();
  }
  function drawCoins(add) {
    const n = $('cfCoinN'); if (!n) return;
    n.textContent = S.coins;
    if (add) { const c = $('cfCoin'); c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); }
  }
  // 黒板のメニュー（カウンターの壁）
  function drawMenuBoard() {
    const on = MENU.filter(m => S.menu[m.id]);
    const list = ['drink', 'food', 'sweet'].flatMap(k => on.filter(m => m.kind === k).slice(0, 2)).slice(0, 5);
    $('cfMB').innerHTML = `<h6>MENU</h6>${list.map(m => `<p><span>${esc(m.n)}</span><i>${m.price}</i></p>`).join('')}`;
  }
  // 家具と席
  function drawLayout() {
    [0, 1].forEach(p => {
      const L0 = $('cfL' + p); L0.querySelectorAll('.it,.slot').forEach(x => x.remove());
      SLOTS.filter(s => s.p === p).forEach(s => {
        const open = S.lv >= s.lv, it = IID[S.place[s.id]];
        if (it && open) {
          const z = s.type === 'seat' ? Math.round(s.by) * 10 + 5 : s.type === 'floor' ? Math.round(s.by) * 10 : 5;
          L0.insertAdjacentHTML('beforeend', `<img class="it ${s.type}" data-slot="${s.id}" src="${it.pic}.webp" style="${pctBox(s, `z-index:${z}`)}" alt="">`);
          const im = L0.lastElementChild, sizeIt = () => { if (im.naturalWidth) im.style.width = Math.min(s.w, MAXH[s.type] * im.naturalWidth / im.naturalHeight * 1672 / 941) + '%'; };
          if (im.complete) sizeIt(); else im.addEventListener('load', () => { sizeIt(); guests.forEach(placeGuest); }, { once:true });
        }
        if (editing) L0.insertAdjacentHTML('beforeend', `<button class="slot ${open ? '' : 'lock'} ${it ? 'has' : ''}" data-edit="${s.id}" style="left:${s.cx}%;top:${s.by - (s.type === 'seat' ? 6 : s.type === 'floor' ? 5 : 3)}%">${open ? (it ? '✎' : '＋') : `Lv${s.lv}`}</button>`);
      });
    });
    // 置いた家具の高さが決まってから、お客さんの位置を合わせる
    el.querySelectorAll('.it.seat').forEach(i => { if (!i.complete) i.onload = () => guests.forEach(placeGuest); });
    requestAnimationFrame(() => guests.forEach(placeGuest));
  }
  function drawDuty() {
    const d = $('cfDuty'), a = DUTY_AT, hh = duty === 'hikari' ? a.h * .5 : a.h * HEIGHT[duty] / 156;
    Object.assign(d.style, { left:a.cx + '%', bottom:(100 - a.by) + '%', height:hh + '%' });
    d.querySelector('.s').src = img(duty, 'stand'); d.querySelector('.t').src = img(duty, 'talk');
  }
  // 吹き出し（画面の下側に出す、当番やお客さんのひとこと）
  let sayT = 0;
  function say(who, text, ms = 2600) {
    const b = $('cfSay'); if (!b) return;
    b.innerHTML = `<b>${esc(NAME[who] || '')}</b><span>${esc(text)}</span>`;
    b.classList.add('on'); clearTimeout(sayT); sayT = setTimeout(hideSay, ms);
  }
  function hideSay() { const b = $('cfSay'); if (b) b.classList.remove('on'); }
  function dutyTalk(text, ms) {
    const d = $('cfDuty'); if (d) { d.classList.add('talk'); setTimeout(() => d.classList.remove('talk'), 1400); }
    say(duty, text, ms);
  }

  // ===== お客さん =====
  const seatsOpen = () => SLOTS.filter(s => s.type === 'seat' && S.lv >= s.lv && S.place[s.id]);
  const freeSeat = () => { const used = new Set(guests.map(g => g.slot)); const f = seatsOpen().filter(s => !used.has(s.id)); return f[Math.floor(Math.random() * f.length)]; };
  function pickWho() {
    const here = new Set(guests.map(g => g.who)); here.add(duty);
    const hr = new Date().getHours(), dow = new Date().getDay();
    // 来やすさ：時間帯・曜日・その子らしさ（重み）
    const W = k => {
      let w = 1;
      if (k === 'hoshino' && (hr >= 13 && hr < 16)) w += 1.5;            // お昼寝前後
      if (k === 'hina' && hr >= 20) w += 1;                               // 仕事終わり
      if (k === 'yuuka' && (dow === 5 || hr >= 17 && hr < 19)) w += 1;    // 締めの確認
      if (k === 'noa' && guests.some(g => g.who === 'yuuka')) w += 1.5;   // ユウカちゃんがいるなら
      if (k === 'seia' && guests.some(g => g.who === 'mika')) w += 1;
      if (k === 'mika' && guests.some(g => g.who === 'seia')) w += 1;
      if (k === 'hikari' && (hr < 9 || hr >= 21)) w -= .7;
      if (k === 'serina' && hr >= 22) w += .8;                            // 夜の見回り
      if (k === 'kisaki' && (dow === 0 || dow === 6)) w += .8;
      if ((k === 'mari' || k === 'nico') && hr < 12) w += .8;
      return Math.max(.1, w);
    };
    const cand = KEYS.filter(k => !here.has(k)); if (!cand.length) return null;
    let sum = cand.reduce((a, k) => a + W(k), 0), r = Math.random() * sum;
    for (const k of cand) { r -= W(k); if (r <= 0) return k; }
    return cand[0];
  }
  function chooseItem(who) {
    const on = MENU.filter(m => S.menu[m.id]);
    if (S.menu[FAV[who]] && Math.random() < .4) return FAV[who];
    return on[Math.floor(Math.random() * on.length)].id;
  }
  function spawn() {
    const s = freeSeat(); if (!s) return;
    const who = pickWho(); if (!who) return;
    const g = { id:++uid, who, slot:s.id, state:'walk', item:chooseItem(who), t:Date.now() };
    guests.push(g);
    const L1 = $('cfL1');
    const e = h(`<div class="gst walk" data-g="${g.id}"><div class="gw"><img class="s" src="${img(who, 'stand')}" alt=""><img class="t" src="${img(who, 'talk')}" alt=""></div><div class="gb"></div></div>`);
    L1.appendChild(e); g.el = e;
    // 入口（左）から歩いてくる
    const sh = guestH(who, s);
    Object.assign(e.style, { left:'-12%', bottom:(100 - 74) + '%', height:sh + '%', zIndex:Math.round(s.by) * 10 + 2 });
    sfx('bell');
    requestAnimationFrame(() => requestAnimationFrame(() => { placeGuest(g); }));
    setTimeout(() => { if (!g.el) return; e.classList.remove('walk'); g.state = 'call'; g.t = Date.now(); drawBubble(g); }, 1900);
    S.dex.guest[who] = S.dex.guest[who] || { n:0, fav:false }; S.dex.guest[who].n++; save();
  }
  // テーブルの高さから背の高さを決める（天板がちょうど腰のあたりに来るように）
  function tableH(s) {
    const t = el.querySelector(`.it[data-slot="${s.id}"]`), L1 = $('cfL1');
    if (t && t.complete && t.naturalWidth && L1.clientHeight) return t.getBoundingClientRect().height / L1.getBoundingClientRect().height * 100;
    return s.w * .72 * 941 / 1672;
  }
  const nomH = s => s.w * .72 * 941 / 1672;   // その席の、ふつうのテーブルの高さ
  const guestH = (who, s, th = tableH(s)) => { const b = Math.max(th, nomH(s) * .85); return who === 'hikari' ? b * .95 : b * 1.42 * HEIGHT[who] / 156; };
  // 背もたれ・天板の高さ（家具の高さに対する割合）。この高さが腰のあたりに来るように立つ
  const TOPLINE = { s1:.78, s2:.8, s3:.8, s4:.75, s5:.85, s6:.72, s7:.6, s8:.78 };
  // 席の向こう側に立つ（下半身はテーブルで隠れる）
  function placeGuest(g) {
    const e = g.el, s = SID[g.slot]; if (!e || !s) return;
    const th = tableH(s), gh = guestH(g.who, s, th), top = TOPLINE[S.place[s.id]] || .62;
    const off = g.who === 'hikari' ? th * Math.max(.45, top - .2) : Math.max(th * .12, top * th - .45 * gh);   // 天板・背もたれが腰のあたり
    Object.assign(e.style, { left:s.cx + '%', bottom:(100 - s.by + off) + '%', height:gh + '%' });
  }
  function drawBubble(g) {
    const b = g.el && g.el.querySelector('.gb'); if (!b) return;
    const m = MID[g.item];
    if (g.state === 'call') b.innerHTML = '<div class="bb call"><b>!</b></div>';
    else if (g.state === 'ordered' || g.state === 'cooking') b.innerHTML = `<div class="bb"><img src="${m.pic}.webp" alt=""><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="16"/></svg></div>`;
    else if (g.state === 'eating') b.innerHTML = '<div class="bb heart"><img src="cf_ui8.webp" alt=""></div>';
    else if (g.state === 'pay') b.innerHTML = `<div class="bb coin"><img src="cf_ui2.webp" alt=""><b>+${g.pay}</b></div>`;
    else b.innerHTML = '';
  }
  function talk(g, text, ms = 2600) {
    if (!g.el) return;
    g.el.classList.add('talk'); setTimeout(() => g.el && g.el.classList.remove('talk'), 1500);
    say(g.who, text, ms);
  }
  function takeOrder(g) {
    g.state = 'ordered'; g.t = Date.now(); g.patience = 75000;
    orders.push({ gid:g.id, item:g.item, who:g.who });
    sfx('order'); haptic();
    talk(g, LINES[g.who].order + `（${MID[g.item].n}）`);
    drawBubble(g); drawTickets();
    setTimeout(() => active && !cooking && dutyTalk(DUTY[duty].take, 1600), 2700);
  }
  function leave(g, sad) {
    if (!g.el || g.state === 'leave') return;
    g.state = 'leave'; drawBubble(g);
    orders = orders.filter(o => o.gid !== g.id); drawTickets();
    if (sad) { sfx('sad'); say(g.who, LINES[g.who].sad); }
    const e = g.el; e.classList.add('walk', 'out');
    e.style.left = '-14%';
    const dish = el.querySelector(`.dish[data-g="${g.id}"]`); if (dish) dish.remove();
    setTimeout(() => { e.remove(); guests = guests.filter(x => x !== g); g.el = null; }, 1700);
  }
  // 毎秒の見回り：待ちくたびれ・食べ終わり・次のお客さん
  function loop() {
    if (!active || document.hidden) return;
    const now = Date.now();
    const b2 = $('cfBadge2'), nCall = guests.filter(g => g.state === 'call' || g.state === 'pay').length;
    if (b2) { b2.textContent = nCall || ''; b2.classList.toggle('on', !!nCall && page !== 1); }
    guests.slice().forEach(g => {
      if (g.state === 'call' && now - g.t > 45000) leave(g, true);
      if (g.state === 'ordered') {
        const left = 1 - (now - g.t) / g.patience, c = g.el && g.el.querySelector('.bb circle');
        if (c) { c.style.strokeDashoffset = (100.5 * (1 - Math.max(0, left))).toFixed(1); c.classList.toggle('hurry', left < .3); }
        if (left <= 0) leave(g, true);
      }
      if (g.state === 'eating' && now - g.t > 7000) pay(g);
      if (g.state === 'pay' && now - g.t > 9000) collect(g, true);
    });
    if (!editing && now > spawnAt && guests.filter(g => g.state !== 'leave').length < seatsOpen().length) {
      spawn(); spawnAt = now + 10000 + Math.random() * 10000;
    }
    // ときどき当番がひとこと
    if (Math.random() < .012 && page === 0 && !cooking && !$('cfSay').classList.contains('on')) dutyTalk(DUTY[duty].idle[Math.floor(Math.random() * DUTY[duty].idle.length)]);
  }

  // ===== 注文票 =====
  function drawTickets() {
    const tk = $('cfTk'); if (!tk) return;
    const notes = ['dc_note1', 'dc_note2', 'dc_note3', 'dc_note4'];
    tk.innerHTML = orders.length ? orders.map((o, i) => { const m = MID[o.item], g = guests.find(x => x.id === o.gid);
      return `<button class="tkt ${g && g.state === 'cooking' ? 'busy' : ''}" data-tk="${o.gid}" style="--n:url(${notes[i % 4]}.webp);--r:${[-4, 3, -2, 5][i % 4]}deg"><img class="pin" src="dc_note6.webp" alt=""><img class="fd" src="${m.pic}.webp" alt=""><span>${esc(m.n)}</span><small>${esc(NAME[o.who])}</small></button>`; }).join('')
      : '<p class="none">客席の「！」をタップして注文を聞こう</p>';
    const b = $('cfBadge'); if (b) { b.textContent = orders.length || ''; b.classList.toggle('on', !!orders.length); }
  }

  // ===== 調理（ミニゲーム）=====
  function cook(gid) {
    const o = orders.find(x => x.gid === gid), g = guests.find(x => x.id === gid); if (!o || !g || cooking) return;
    cooking = true; g.state = 'cooking'; drawTickets();
    const m = MID[o.item], p = per === 'day' ? 'd' : 'n';
    const ov = $('cfOv');
    ov.innerHTML = `<div class="cfk" style="background-image:url(cafe_kitchen_${p}.jpg)"><div class="kh"><b>${esc(m.n)}</b><span>${KIND_NAME[m.kind]}</span><button class="kx" data-kx="1">あとで</button></div>
      <div class="kd"><img class="dishp" src="${m.pic}.webp" alt=""></div><div class="kg" id="cfKG"></div><div class="kt" id="cfKT"></div></div>`;
    ov.className = 'on';
    ov.querySelector('[data-kx]').onclick = () => { stopGame(); ov.className = ''; ov.innerHTML = ''; cooking = false; if (g.state === 'cooking') g.state = 'ordered'; drawTickets(); };
    const done = stars => finishCook(o, g, m, stars);
    if (m.kind === 'drink') gaugeGame(m, done); else if (m.kind === 'food') ringGame(m, done); else recipeGame(m, done);
  }
  let gameRaf = 0, gameTimer = 0;
  function stopGame() { cancelAnimationFrame(gameRaf); clearTimeout(gameTimer); }
  // ドリンク：ゆれる針を、色のついたところで止める（1〜2回）
  function gaugeGame(m, done) {
    const box = $('cfKG'); let step = 0, scores = [];
    const run = () => {
      const zone = 34 + Math.random() * 32, wide = 16 - step * 2, sp = .9 + step * .35 + Math.random() * .2;
      box.innerHTML = `<div class="gg"><p class="gl">${esc(m.steps[step])}　<small>${step + 1}/${m.steps.length}</small></p><div class="bar"><i class="z" style="left:${zone - wide / 2}%;width:${wide}%"></i><i class="pz" style="left:${zone - 2.5}%;width:5%"></i><b class="nd"></b></div><p class="gh">いいところでタップ！</p></div>`;
      const nd = box.querySelector('.nd'); let x = 0, dir = 1, last = performance.now(), stopped = false;
      const f = now => { const dt = (now - last) / 16.7; last = now; x += dir * sp * dt; if (x > 100) { x = 100; dir = -1; } if (x < 0) { x = 0; dir = 1; } nd.style.left = x + '%'; gameRaf = requestAnimationFrame(f); };
      gameRaf = requestAnimationFrame(f);
      box.onpointerdown = e => {
        if (stopped) return; stopped = true; e.preventDefault(); stopGame(); sfx('stop'); haptic();
        const d = Math.abs(x - zone), sc = d <= 2.5 ? 3 : d <= wide / 2 ? 2 : 1; scores.push(sc);
        judge(box, sc);
        gameTimer = setTimeout(() => { step++; if (step < m.steps.length) run(); else done(Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)); }, 650);
      };
    };
    run();
  }
  // フード：ぐるっと回る針を、焼き色のところで止める
  function ringGame(m, done) {
    const box = $('cfKG'); let step = 0, scores = [];
    const run = () => {
      const at = 200 + Math.random() * 110, wide = 40 - step * 6, sp = 3.2 + step * 1.2 + Math.random() * .6;
      const arc = (a0, a1) => { const r = 44, p = a => [50 + r * Math.sin(a * Math.PI / 180), 50 - r * Math.cos(a * Math.PI / 180)]; const [x0, y0] = p(a0), [x1, y1] = p(a1); return `M${x0} ${y0} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`; };
      box.innerHTML = `<div class="rg"><p class="gl">${esc(m.steps[step])}　<small>${step + 1}/${m.steps.length}</small></p><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" class="bk"/>
        <path d="${arc(at - wide / 2, at + wide / 2)}" class="z"/><path d="${arc(at - 6, at + 6)}" class="pz"/><line x1="50" y1="50" x2="50" y2="10" class="nd"/><circle cx="50" cy="50" r="6" class="hub"/></svg><p class="gh">焼き色のところでタップ！</p></div>`;
      const nd = box.querySelector('.nd'); let a = 0, last = performance.now(), stopped = false;
      const f = now => { const dt = (now - last) / 16.7; last = now; a += sp * dt; if (a >= 360) { a = 360; stopped = true; scores.push(1); judge(box, 1); gameTimer = setTimeout(next, 650); return; } nd.setAttribute('transform', `rotate(${a} 50 50)`); gameRaf = requestAnimationFrame(f); };
      gameRaf = requestAnimationFrame(f);
      box.onpointerdown = e => {
        if (stopped) return; stopped = true; e.preventDefault(); stopGame(); sfx('stop'); haptic();
        const d = Math.abs(a - at), sc = d <= 6 ? 3 : d <= wide / 2 ? 2 : 1; scores.push(sc); judge(box, sc);
        gameTimer = setTimeout(next, 650);
      };
    };
    const next = () => { step++; if (step < m.steps.length) run(); else done(Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)); };
    run();
  }
  // スイーツ：レシピの順に材料をタップ（5秒）
  function recipeGame(m, done) {
    const box = $('cfKG'), rec = m.rec, others = shuffle([1, 2, 3, 4, 5, 6, 7, 8].filter(i => !rec.includes(i))).slice(0, 3);
    const pool = shuffle([...rec, ...others]);
    let k = 0, miss = 0, over = false;
    box.innerHTML = `<div class="rc"><p class="gl">レシピの順にタップ！</p><div class="rcp">${rec.map((i, n) => `<span data-r="${n}"><img src="cf_ing${i}.webp" alt=""><small>${n + 1}</small></span>`).join('<i>›</i>')}</div>
      <div class="tm"><b id="cfTm"></b></div><div class="ings">${pool.map(i => `<button data-ing="${i}"><img src="cf_ing${i}.webp" alt=""><small>${ING[i]}</small></button>`).join('')}</div></div>`;
    const tm = $('cfTm'), T = 5200, t0 = performance.now();
    const f = now => { const left = 1 - (now - t0) / T; tm.style.width = Math.max(0, left * 100) + '%'; if (left <= 0) return end(); gameRaf = requestAnimationFrame(f); };
    gameRaf = requestAnimationFrame(f);
    const end = () => { if (over) return; over = true; stopGame(); const sc = k < rec.length ? 1 : miss === 0 && (performance.now() - t0) < T * .7 ? 3 : miss <= 1 ? 2 : 1; judge(box, sc); gameTimer = setTimeout(() => done(sc), 650); };
    box.querySelector('.ings').onpointerdown = e => {
      const b = e.target.closest('[data-ing]'); if (!b || over) return; e.preventDefault();
      if (+b.dataset.ing === rec[k]) { sfx('tap'); haptic(); b.classList.add('ok'); box.querySelector(`[data-r="${k}"]`).classList.add('ok'); k++; if (k >= rec.length) end(); }
      else { sfx('miss'); miss++; b.classList.remove('ng'); void b.offsetWidth; b.classList.add('ng'); }
    };
  }
  function judge(box, sc) {
    const w = sc === 3 ? 'PERFECT!' : sc === 2 ? 'GOOD!' : 'OK…';
    box.insertAdjacentHTML('beforeend', `<div class="jd s${sc}">${w}</div>`);
    sfx(sc === 3 ? 'perfect' : sc === 2 ? 'good' : 'miss');
  }
  async function finishCook(o, g, m, stars) {
    const ov = $('cfOv'), kd = ov.querySelector('.kd'), kg = $('cfKG');
    kg.innerHTML = `<div class="done"><p>できあがり！</p><div class="st">${[1, 2, 3].map(i => `<img src="cf_ui6.webp" class="${i <= stars ? 'on' : ''}" style="animation-delay:${i * .12}s" alt="">`).join('')}</div></div>`;
    kd.classList.add('up');
    sfx(stars === 3 ? 'perfect' : 'good');
    const rec = S.dex.menu[m.id] = S.dex.menu[m.id] || { n:0, best:0 };
    rec.best = Math.max(rec.best, stars); save();
    g.stars = stars;
    await sleep(1300);
    ov.className = ''; ov.innerHTML = ''; cooking = false;
    orders = orders.filter(x => x !== o); drawTickets();
    if (!g.el || g.state === 'leave') return;
    serve(g);
  }
  // 当番が運ぶ
  async function serve(g) {
    g.state = 'serving'; drawBubble(g);
    if (page !== 1) { go(1); await sleep(450); }
    const L1 = $('cfL1'), s = SID[g.slot], m = MID[g.item];
    const w = h(`<div class="waiter"><div class="dw"><img src="${img(duty, 'stand')}" alt=""></div><img class="tray" src="cf_ui4.webp" alt=""><img class="tdish" src="${m.pic}.webp" alt=""></div>`);
    const hh = guestH(duty, s);
    Object.assign(w.style, { left:'112%', bottom:(100 - Math.min(s.by + 4, 97)) + '%', height:hh + '%', zIndex:Math.round(s.by) * 10 + 8 });
    L1.appendChild(w);
    requestAnimationFrame(() => requestAnimationFrame(() => { w.style.left = Math.min(s.cx + s.w * .45, 88) + '%'; }));
    await sleep(1150);
    if (!g.el) { w.remove(); return; }
    // テーブルに置く
    const th = tableH(s);
    L1.insertAdjacentHTML('beforeend', `<img class="dish" data-g="${g.id}" src="${m.pic}.webp" style="left:${s.cx}%;bottom:${100 - s.by + th * .55}%;width:${Math.max(7, s.w * .26)}%;z-index:${Math.round(s.by) * 10 + 6}" alt="">`);
    w.classList.add('put'); say(duty, DUTY[duty].serve, 1500);
    await sleep(500);
    w.style.left = '112%';
    setTimeout(() => w.remove(), 1200);
    // 食べる
    const fav = FAV[g.who] === g.item;
    g.state = 'eating'; g.t = Date.now(); drawBubble(g);
    setTimeout(() => {
      if (!g.el) return;
      if (fav) { const d = S.dex.guest[g.who]; if (d && !d.fav) { d.fav = true; save(); } talk(g, LINES[g.who].fav, 3000); hearts(g.el, 6); }
      else { talk(g, LINES[g.who].eat); hearts(g.el, 3); }
    }, 900);
  }
  function hearts(e, n) {
    for (let i = 0; i < n; i++) {
      const x = h(`<img class="fh" src="${i % 2 ? 'cf_ui8' : 'dc_stk7'}.webp" alt="">`);
      x.style.left = 20 + Math.random() * 60 + '%'; x.style.animationDelay = i * .15 + 's'; e.appendChild(x);
      setTimeout(() => x.remove(), 1800 + i * 150);
    }
  }
  function pay(g) {
    const m = MID[g.item], fav = FAV[g.who] === g.item, st = g.stars || 2;
    g.pay = Math.round(m.price * (1 + (st - 1) * .3) * (fav ? 1.5 : 1) * (1 + (S.lv - 1) * .1));
    g.state = 'pay'; g.t = Date.now(); drawBubble(g);
    const dish = el.querySelector(`.dish[data-g="${g.id}"]`); if (dish) dish.classList.add('eaten');
    const rec = S.dex.menu[g.item] = S.dex.menu[g.item] || { n:0, best:st }; rec.n++;
    S.served++; S.today.served++; save();
    if (typeof Stats !== 'undefined' && Stats.noteCafe) Stats.noteCafe(1, 0);
    checkLv();
  }
  // コインを受け取る（タップ、または少し待つと自動で）
  function collect(g, auto) {
    if (g.state !== 'pay') return;
    const n = g.pay; g.state = 'paid';
    const b = g.el && g.el.querySelector('.bb.coin');
    if (b) {
      const r = b.getBoundingClientRect(), c = $('cfCoin').getBoundingClientRect();
      for (let i = 0; i < Math.min(6, 2 + Math.floor(n / 8)); i++) {
        const f = h('<img class="fcoin" src="cf_ui1.webp" alt="">'); document.body.appendChild(f);
        f.style.left = r.left + r.width / 2 + 'px'; f.style.top = r.top + r.height / 2 + 'px';
        f.animate([{ transform:'translate(-50%,-50%) scale(.8)' }, { transform:`translate(${c.left - r.left - r.width / 2 + 10}px,${c.top - r.top - r.height / 2 + 10}px) scale(.5)`, opacity:.6 }],
          { duration:520 + i * 70, easing:'cubic-bezier(.5,0,.6,1)', fill:'forwards' }).onfinish = () => f.remove();
      }
    }
    sfx('coin'); if (!auto) haptic();
    S.coins += n; S.today.coins += n; save();
    if (typeof Stats !== 'undefined' && Stats.noteCafe) Stats.noteCafe(0, n);
    setTimeout(() => drawCoins(true), 500);
    setTimeout(() => { if (!g.el) return; say(g.who, LINES[g.who].bye, 2200); leave(g, false); }, 700);
  }
  function checkLv() {
    const nl = lvOf(S.served); if (nl <= S.lv) return;
    S.lv = nl; save();
    setTimeout(() => levelUp(nl), 1600);
  }
  function levelUp(nl) {
    sfx('lv'); haptic();
    const ov = $('cfOv');
    const opened = SLOTS.filter(s => s.lv === nl);
    ov.innerHTML = `<div class="cflv"><div class="rb"><img src="cf_ui7.webp" alt=""><b>LEVEL UP!</b></div><p class="lv">Lv.${nl - 1} → <b>Lv.${nl}</b></p>
      <p class="tx">お店がひろくなりました！<br>${opened.map(s => TYPE_NAME[s.type]).join('・')}の置き場がふえたよ</p><button data-lv="1">やったー！</button></div>`;
    ov.className = 'on lvup';
    ov.querySelector('[data-lv]').onclick = () => { ov.className = ''; ov.innerHTML = ''; paint(); dutyTalk(nl === 2 ? 'お店、ちょっと豪華になったね！' : 'すごい……！ 素敵なお店になりましたね', 2400); };
  }

  // ===== クリック =====
  function onClick(e) {
    const t = e.target;
    const nav = t.closest('[data-go]'); if (nav) { sfx('tap'); return go(+nav.dataset.go); }
    const bar = t.closest('.cfbar [data-x]'); if (bar) { sfx('tap'); const x = bar.dataset.x; return x === 'menu' ? openMenu() : x === 'edit' ? toggleEdit() : openBook(); }
    const ed = t.closest('[data-edit]'); if (ed) return pickFor(ed.dataset.edit);
    const tk = t.closest('[data-tk]'); if (tk) { sfx('tap'); return cook(+tk.dataset.tk); }
    if (t.closest('#cfDuty')) { sfx('tap'); return tapDuty(); }
    const ge = t.closest('.gst'); if (ge) {
      const g = guests.find(x => x.id === +ge.dataset.g); if (!g) return;
      if (g.state === 'call') return takeOrder(g);
      if (g.state === 'pay') return collect(g, false);
      if (g.state === 'ordered' || g.state === 'cooking') { sfx('tap'); return talk(g, LINES[g.who].tap[Math.floor(Math.random() * 2)]); }
      if (g.state === 'eating' || g.state === 'walk') { sfx('tap'); return talk(g, LINES[g.who].tap[Math.floor(Math.random() * 2)]); }
    }
    if (t.closest('#cfSay')) hideSay();
  }
  function tapDuty() {
    const k = typeof Games !== 'undefined' && Games.VOICE[duty];
    const d = $('cfDuty');
    if (k) playVoice(k, { start:() => d.classList.add('talk'), end:() => d.classList.remove('talk') });
    say(duty, DUTY[duty].idle[Math.floor(Math.random() * DUTY[duty].idle.length)]);
  }

  // ===== メニュー（解放）=====
  function openMenu(kind = 'drink') {
    const ov = $('cfOv');
    const row = m => { const on = S.menu[m.id], fav = KEYS.filter(k => FAV[k] === m.id && S.dex.guest[k] && S.dex.guest[k].fav);
      return `<div class="mr ${on ? 'on' : ''}"><img src="${m.pic}.webp" alt=""><div><b>${esc(m.n)}</b><small>${on ? `${m.price}コイン` : `お店に出すと ${m.price}コイン`}${fav.length ? `　♡${fav.map(k => NAME[k]).join('・')}` : ''}</small></div>
        ${on ? '<em>提供中</em>' : `<button data-buy="${m.id}" ${S.coins < m.cost ? 'disabled' : ''}><img src="cf_ui1.webp" alt="">${m.cost}</button>`}</div>`; };
    ov.innerHTML = `<div class="cfsh menu"><div class="sh"><b>メニュー</b><span><img src="cf_ui1.webp" alt="">${S.coins}</span><button data-close="1">×</button></div>
      <div class="cftabs">${Object.entries(KIND_NAME).map(([k, n]) => `<button data-kind="${k}" class="${k === kind ? 'on' : ''}">${n}</button>`).join('')}</div>
      <div class="lst">${MENU.filter(m => m.kind === kind).map(row).join('')}</div>
      <p class="hint">お店に出したメニューを、お客さんが注文するようになります。好物を出すと、喜んでコインを多めにくれるよ</p></div>`;
    ov.className = 'on sheet';
    ov.onclick = e => {
      const c = e.target.closest('[data-close]'); if (c || e.target === ov) { ov.className = ''; ov.innerHTML = ''; ov.onclick = null; return; }
      const k = e.target.closest('[data-kind]'); if (k) { sfx('tap'); return openMenu(k.dataset.kind); }
      const b = e.target.closest('[data-buy]'); if (b && !b.disabled) {
        const m = MID[b.dataset.buy]; if (S.coins < m.cost) return;
        S.coins -= m.cost; S.menu[m.id] = true; save(); sfx('coin'); haptic(); drawCoins(true); drawMenuBoard(); paintDoor();
        toast(`「${m.n}」をメニューに加えました`); openMenu(kind);
      }
    };
  }

  // ===== 模様替え =====
  function toggleEdit(v = !editing) {
    editing = v; el.classList.toggle('editing', v);
    el.querySelector('.cfbar [data-x="edit"] span').textContent = v ? 'おわる' : '模様替え';
    drawLayout();
    if (v) toast('置き場の ＋ をタップして家具を選んでね', 2000);
  }
  function pickFor(sid) {
    const s = SID[sid]; if (S.lv < s.lv) return toast(`Lv.${s.lv}で使えるようになります`);
    sfx('tap');
    const used = new Set(Object.entries(S.place).filter(([k]) => k !== sid).map(([, v]) => v));
    const list = ITEMS.filter(x => x.type === s.type || (s.type === 'counter' && x.type === 'counter') );
    const seated = guests.some(g => g.slot === sid && g.state !== 'leave');
    const ov = $('cfOv');
    const cell = x => { const own = S.owned[x.id], cur = S.place[sid] === x.id, other = used.has(x.id), ok = inSeason(x);
      return `<button class="ic ${cur ? 'cur' : ''} ${own ? 'own' : ''} ${!own && !ok ? 'off' : ''}" data-put="${x.id}" ${other || (!own && !ok) ? 'disabled' : ''}>
        <img src="${x.pic}.webp" alt=""><b>${esc(x.n)}</b><small>${cur ? '置いています' : other ? 'ほかで使用中' : own ? '置く' : ok ? `<img src="cf_ui1.webp" alt="">${x.cost}` : `${x.season.join('・')}月の限定`}</small>${x.season ? '<i>季節</i>' : ''}</button>`; };
    ov.innerHTML = `<div class="cfsh pick"><div class="sh"><b>${TYPE_NAME[s.type]}</b><span><img src="cf_ui1.webp" alt="">${S.coins}</span><button data-close="1">×</button></div>
      <div class="grid">${list.map(cell).join('')}</div>
      ${S.place[sid] && s.type !== 'seat' || S.place[sid] && !seated ? '<button class="rm" data-rm="1">ここを空ける</button>' : ''}</div>`;
    ov.className = 'on sheet';
    ov.onclick = e => {
      if (e.target.closest('[data-close]') || e.target === ov) { ov.className = ''; ov.innerHTML = ''; ov.onclick = null; return; }
      if (e.target.closest('[data-rm]')) { delete S.place[sid]; save(); ov.className = ''; ov.innerHTML = ''; drawLayout(); return; }
      const b = e.target.closest('[data-put]'); if (!b || b.disabled) return;
      const x = IID[b.dataset.put];
      if (!S.owned[x.id]) {
        if (S.coins < x.cost) return toast('コインが足りません');
        S.coins -= x.cost; S.owned[x.id] = true; sfx('coin'); drawCoins(true); toast(`「${x.n}」を買いました`);
      } else sfx('tap');
      if (seated && s.type === 'seat') { toast('お客さんが座っているので、帰ってから替えてね'); save(); return pickFor(sid); }
      S.place[sid] = x.id; save(); haptic();
      ov.className = ''; ov.innerHTML = ''; drawLayout();
    };
  }

  // ===== 図鑑 =====
  function openBook(tab = 'menu') {
    const ov = $('cfOv');
    let body = '';
    if (tab === 'menu') body = `<div class="bg3">${MENU.map(m => { const d = S.dex.menu[m.id]; return `<div class="bc ${d && d.n ? '' : 'un'}"><img src="${m.pic}.webp" alt=""><b>${d && d.n ? esc(m.n) : '？？？'}</b><small>${d && d.n ? `${d.n}皿　${'★'.repeat(d.best || 0)}` : ''}</small></div>`; }).join('')}</div>`;
    if (tab === 'guest') body = `<div class="bg3 g">${KEYS.map(k => { const d = S.dex.guest[k]; const lvl = !d ? 0 : d.n >= 20 ? 3 : d.n >= 8 ? 2 : 1;
      return `<div class="bc ${d ? '' : 'un'}"><img src="${img(k, 'stand')}" alt=""><b>${d ? NAME[k] : '？？？'}</b><small>${d ? `来店${d.n}回　${['', 'はじめまして', 'なじみ', '常連さん'][lvl]}` : ''}</small>
        <em>${d && d.fav ? `好物：${MID[FAV[k]].n}` : d ? '好物：？？？' : ''}</em></div>`; }).join('')}</div>`;
    if (tab === 'item') body = `<div class="bg3">${ITEMS.map(x => `<div class="bc ${S.owned[x.id] ? '' : 'un'}"><img src="${x.pic}.webp" alt=""><b>${S.owned[x.id] ? esc(x.n) : '？？？'}</b><small>${x.season ? `季節 ${x.season.join('・')}月` : TYPE_NAME[x.type]}</small></div>`).join('')}</div>`;
    const cnt = { menu:[Object.values(S.dex.menu).filter(d => d.n).length, MENU.length], guest:[Object.keys(S.dex.guest).length, KEYS.length], item:[Object.keys(S.owned).length, ITEMS.length] };
    ov.innerHTML = `<div class="cfbook"><div class="bh"><b>カフェ図鑑</b><span>Lv.${S.lv}　累計${S.served}皿${S.lv < 3 ? `　次のLvまで${LV_AT[S.lv + 1] - S.served}皿` : ''}</span><button data-close="1">×</button></div>
      <div class="cftabs">${[['menu', 'メニュー'], ['guest', 'お客さん'], ['item', '家具']].map(([k, n]) => `<button data-bt="${k}" class="${k === tab ? 'on' : ''}">${n}<small>${cnt[k][0]}/${cnt[k][1]}</small></button>`).join('')}</div>
      <div class="pg">${body}</div></div>`;
    ov.className = 'on sheet book';
    ov.onclick = e => {
      if (e.target.closest('[data-close]') || e.target === ov) { ov.className = ''; ov.innerHTML = ''; ov.onclick = null; return; }
      const b = e.target.closest('[data-bt]'); if (b) { sfx('tap'); openBook(b.dataset.bt); }
    };
  }

  // ===== 入退店 =====
  async function enter() {
    clearTimeout(saveT); if (S) await DB.put('room', S).catch(() => {});
    S = null; await load();   // 読み込み（データの取り込み）後でも最新に
    duty = await Room.todayDuty().catch(() => 'hoshino');
    if (!el) build();
    S.lv = Math.max(S.lv, lvOf(S.served));
    const today = D.today();
    let gift = 0;
    if (S.today.date !== today) { S.today = { date:today, coins:0, served:0 }; gift = 20; S.coins += gift; save(); }
    guests = []; orders = []; editing = false; el.classList.remove('editing');
    el.querySelectorAll('.gst,.waiter,.dish').forEach(x => x.remove());
    el.querySelector('.cfbar [data-x="edit"] span').textContent = '模様替え';
    paint();
    document.body.classList.add('cafeOn');
    el.className = 'show' + (per !== 'day' ? ' night' : '');
    fit(); requestAnimationFrame(() => { fit(); drawLayout(); });
    go(0, false); page = 0;
    active = true;
    syncBgm(0, .8);
    spawnAt = Date.now() + 2500;
    clearInterval(tick); tick = setInterval(loop, 500);
    setTimeout(() => {
      if (!active) return;
      const night = !isDay() && DUTY[duty].night;
      dutyTalk(night || DUTY[duty].hi, 3200);
      if (gift) setTimeout(() => { if (active) { toast(`今日のお手当 +${gift}コイン`, 1800); drawCoins(true); } }, 3400);
    }, 700);
  }
  function exit() {
    if (!active) return;
    stopGame(); clearInterval(tick);
    $('cfOv').className = ''; $('cfOv').innerHTML = ''; cooking = false;
    el.classList.add('out');
    setTimeout(() => { el.className = ''; document.body.classList.remove('cafeOn'); el.querySelectorAll('.gst,.waiter,.dish').forEach(x => x.remove()); guests = []; orders = []; }, 350);
    active = false; clearTimeout(saveT); DB.put('room', S).catch(() => {}); syncBgm(200);
  }
  // 昼：Lemonade Diary／夜：待機室の曲
  const CAFE_BGM = { src:'cafe_bgm.mp3', loopStart:2.0, loopEnd:77.9993 };
  const nightBgm = () => (typeof Ops !== 'undefined' && Ops.allBgm().find(b => b.src === 'ops_lounge_bgm.mp3')) || CAFE_BGM;

  // アプリを裏に回している間は、お店の時間を止める
  let hidAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (!active) return;
    if (document.hidden) { hidAt = Date.now(); return; }
    if (!hidAt) return;
    const d = Date.now() - hidAt; hidAt = 0;
    guests.forEach(g => { g.t += d; }); spawnAt += d;
  });

  return {
    makeDoor, setDoor, paintDoor,
    isDoor:() => onDoor,
    active:() => active,
    bgm:() => active ? (isDay() ? CAFE_BGM : nightBgm()) : null,
    allBgm:() => [CAFE_BGM],
    async stats() { await load(); return { coins:S.coins, served:S.served, lv:S.lv, menu:Object.keys(S.menu).length, items:Object.keys(S.owned).length, guests:S.dex.guest, dex:S.dex.menu }; },
    MENU, ITEMS, NAME,
  };
})();
