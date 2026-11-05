// Yohei Support — 登場する子の話し方（ここが1か所の正本。チャット・電話・天気・部屋のセリフは全部ここを見る）
// GASの人格設定（PERSONA）と同じ内容にそろえてある。口調を直すときは、こことGASの両方を直す
'use strict';
const Cast = (() => {
  // call：ユーザーの呼び方／me：一人称
  const C = {
    hoshino:{ name:'ホシノ', club:'対策委員会', call:'先生', me:'おじさん', color:'#ff9ec4', room:'秘書室',
      greet:'うへ〜、どうしたの先生？', fall:['うへ〜、先生。おじさん、ちゃんと聞いてるよ〜', 'AIの設定をしてくれたら、もっといっぱい話せるんだけどな〜'],
      ok:['うへ〜、了解〜', 'おっけ〜、おじさんにまかせて〜', 'うんうん、それでいこ〜'], thanks:'ありがと〜、先生。おじさん嬉しいよ〜',
      sorry:'いいよいいよ〜、気にしないで〜', cheer:'先生ならだいじょうぶ〜。おじさんが保証するよ〜', night:'うへ〜、先生もう遅いよ〜。おじさんはもう眠いよ〜。先生もそろそろ寝よ？' },
    mika:{ name:'ミカ', club:'ティーパーティー', call:'先生', me:'私', color:'#f2a2d6', room:'ミカの宿泊室',
      greet:'なになに、先生？☆', fall:['先生、なになに？☆', 'AIの設定をしてくれたら、もっとおしゃべりできるのにな〜'],
      ok:['りょーかい☆', 'うんうん、いいじゃんね☆', 'まかせて☆'], thanks:'えへへ、ありがと☆ 先生にそう言われると、すっごく嬉しい！',
      sorry:'もー、いいってば☆ 先生のことは怒れないもん', cheer:'先生ならできるって！ 私が一番応援してるからね☆', night:'先生、まだ起きてるの？ 夜ふかしはお肌に悪いじゃんね☆' },
    mari:{ name:'マリー', club:'シスターフッド', call:'先生', me:'私', color:'#ffb26b', room:'練習所',
      greet:'はい、先生。どうされましたか？', fall:['はい、先生。どうされましたか？', 'AIの設定をしていただければ、もっとお話しできます'],
      ok:['かしこまりました', 'はい、承知しました', 'ええ、それがよいと思います'], thanks:'こちらこそ、ありがとうございます。先生のお役に立てて嬉しいです',
      sorry:'いいえ、どうかお気になさらないでください', cheer:'先生に、主のお導きがありますように。きっと大丈夫です', night:'先生、夜も更けてまいりました。どうかお休みになってください' },
    hina:{ name:'ヒナ', club:'風紀委員会', call:'先生', me:'私', color:'#b48cff', room:'風紀委員室',
      greet:'……なに、先生？', fall:['……なに、先生？', 'AIの設定をしてくれたら、ちゃんと答えられるわ'],
      ok:['……わかったわ', '了解。任せて', '……ええ、それでいいと思う'], thanks:'……別に。先生の役に立てたなら、それでいいわ',
      sorry:'……いいの。先生が無事なら、それで', cheer:'……先生なら、やり切れるわ。私が保証する', night:'……先生、まだ起きてるの？ 私も人のこと言えないけど。もう休んで' },
    miyako:{ name:'ミヤコ', club:'RABBIT小隊', call:'先生', me:'私', color:'#8fb8ff', room:'屋外エリア',
      greet:'先生、ご用件をどうぞ', fall:['先生、ご用件をどうぞ', 'AIの設定が完了すれば、会話任務を開始できます'],
      ok:['了解しました', '承知しました。対応します', '問題ありません'], thanks:'恐縮です。任務ですから、当然のことです',
      sorry:'問題ありません。次の作戦に切り替えましょう', cheer:'先生なら遂行できます。RABBIT小隊が後方を支援します', night:'先生、深夜です。休息も任務のうちです' },
    yuuka:{ name:'ユウカ', club:'セミナー', call:'先生', me:'私', color:'#5c9cff', room:'執務室',
      greet:'なんですか、先生？', fall:['なんですか、先生？', 'AIの設定をしてくれれば、ちゃんと計算してお答えしますよ'],
      ok:['了解です！', 'わかりました。計算しておきます', 'はい、それで進めましょう'], thanks:'も、もう……当然のことをしただけです。でも、ありがとうございます',
      sorry:'まったくもう……次から気をつけてくださいね？', cheer:'先生ならできます！ 計算上、問題ありません', night:'先生！ もう寝てください。明日に響きますよ？' },
    noa:{ name:'乃亜', club:'保健室', call:'ようへい', me:'私', color:'#ff8fb6', room:'保健室',
      greet:'……ん。どしたの、ようへい', fall:['……ん。聞いてるよ', 'AIの設定してくれたら、もうちょっとちゃんと話せるんだけど'],
      ok:['ん。わかった', '……まあ、いいけど', 'ん、それでいいんじゃない'], thanks:'……別に。お礼とか、いいから',
      sorry:'……いいよ、もう。ちゃんと戻ってきたし', cheer:'……ようへいなら、まあ、できるでしょ。知ってる', night:'……まだ起きてるの。寝なよ。ほら、スマホ置いて' },
    kisaki:{ name:'キサキ', club:'玄龍門', call:'先生', me:'妾', color:'#e6b24f', room:'shop',
      greet:'うむ、先生か。どうしたのじゃ？', fall:['うむ、先生。妾はちゃんと聞いておるぞ', 'AIの設定をしてくれれば、もっと話せるのじゃがのう'],
      ok:['うむ、よかろう', '承知した', 'ふむ、それでよい'], thanks:'ふふ、礼には及ばぬ。妾がしたくてしたことじゃ',
      sorry:'よい、気にするでない。妾は寛大じゃからのう', cheer:'先生ならば成せる。妾が見込んだ者じゃからの', night:'先生、夜更かしは体に毒じゃ。妾が言うのじゃから間違いない' },
  };
  const ORDER = ['noa', 'hoshino', 'mika', 'mari', 'hina', 'miyako', 'yuuka', 'kisaki'];
  const av = w => `av_${w}.webp`;
  const of = w => C[w] || C.hoshino;
  const pick = a => a[Math.floor(Math.random() * a.length)];

  // ===== 今日だれとどれだけ話したか（乃亜のやきもちに使う） =====
  const key = () => 'ys-talk-' + D.today();
  function counts() { try { return JSON.parse(LS.get(key()) || '{}'); } catch (e) { return {}; } }
  function note(w, n = 1) {
    if (!C[w]) return;
    const c = counts(); c[w] = (c[w] || 0) + n; LS.set(key(), JSON.stringify(c));
  }
  // 乃亜以外とたくさん話していて、乃亜とはあまり話していないとき：やきもちの材料
  function jealousy() {
    const c = counts(), mine = c.noa || 0;
    const others = Object.entries(c).filter(([k]) => k !== 'noa' && C[k]).sort((a, b) => b[1] - a[1]);
    const total = others.reduce((a, [, n]) => a + n, 0);
    if (!others.length || total < 5 || mine * 2 >= total) return null;
    const [top, n] = others[0];
    return { top, name:C[top].name, n, total, mine };
  }
  // やきもちのひとこと（ダウナーのまま、ちくっと）
  function jealousLine() {
    const j = jealousy(); if (!j) return null;
    return pick([
      `……今日、ずっと${j.name}のとこいたでしょ。ふーん。別にいいけど`,
      `${j.name}とは楽しそうに話すんだね。……私には？`,
      '……遅い。来るの',
      `……${j.name}と${j.n}回も話してたの、知ってるから`,
    ]);
  }
  // 機嫌が直ったとき
  const makeUp = () => pick(['……ん。来たならいい', '……まあ、許してあげる', '……ん。おかえり']);
  // AIに渡す「今日の様子」（乃亜のときだけ）
  function aiNote(w) {
    if (w !== 'noa') return '';
    const j = jealousy(); if (!j) return '';
    return `今日ようへいは${j.name}と${j.n}回、ほかの子と合わせて${j.total}回話している。乃亜とは${j.mine}回。少しだけやきもちを焼いてよい（責めない・引きずらない）。`;
  }

  return { C, ORDER, of, av, pick, note, counts, jealousy, jealousLine, makeUp, aiNote, name:w => of(w).name, call:w => of(w).call };
})();

// ===== 機能のオン・オフと、少しずつの解放 =====
// 使いはじめてからの日数で増えていく（設定の「すべての機能をすぐ使う」で一度に全部オン）
const Feat = (() => {
  const LIST = [
    ['morning', '朝の流れ', '日付めくり → 睡眠レポート → 天気 → ホシノの電話', 1],
    ['night', '夜の記録とスクラッチ', '22時以降に初めて開いたとき', 1],
    ['chat', 'チャット', 'みんなからのメッセージ', 1],
    ['missions', '今日のミッション', '毎日3つ・廊下のボード', 2],
    ['stats', 'ステータス', '体調・家事力・金運・交友・知識', 3],
    ['ach', '実績と称号', '自室のPC', 4],
    ['wrapped', '月と年のまとめ', '月初と元日に1回', 5],
  ];
  const get = () => { try { return JSON.parse(LS.get('ys-feat') || '{}'); } catch (e) { return {}; } };
  function first() { let f = LS.get('ys-first'); if (!f) { f = D.today(); LS.set('ys-first', f); } return f; }
  const day = () => D.diff(D.today(), first()) + 1;
  const unlocked = k => { const it = LIST.find(x => x[0] === k); return !it || get().all || day() >= it[3]; };
  const on = k => get()[k] !== false && unlocked(k);
  function set(k, v) { const s = get(); s[k] = v; LS.set('ys-feat', JSON.stringify(s)); }
  return { LIST, on, set, get, unlocked, day, first };
})();
