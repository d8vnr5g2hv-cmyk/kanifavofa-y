// Kani Favorite — ゲーム機（メモロビパズル・神経衰弱）
'use strict';
const Games = (() => {
  let root = null, ctxG = null, scene = null, timer = null;
  const RESULT = () => Ops.allBgm().find(b => b.src === 'ops_result_bgm.mp3');
  // メモロビのキャラ（CHARSのキー）→ デフォルメ画像の名前
  const CHIBI = { hoshino:'hoshino', christmas:'serina', mika:'mika', office:'yuuka', hina:'hina', drive:'seia', miyako:'miyako', kitchen:'nico', mari:'mari', conductor:'hikari', sofa:'kisaki', bedtime:'noa' };
  const CLEAR_LINE = {
    hoshino:'うへ〜、先生すごいね〜。おじさんの絵、きれいに直してくれてありがと〜',
    christmas:'完成ですね、先生！ ……ふふ、こういう時間も大切ですね',
    mika:'わーい、完成☆ 先生、私の絵をいちばんきれいにしてくれたね！',
    office:'計算どおり……いえ、それ以上の手際ですね。さすがです、先生',
    hina:'……最後まで、ちゃんとやりきったのね。えらいわ、先生',
    drive:'見事だね、先生。欠けたものが元に戻る瞬間は、いつ見ても美しい',
    miyako:'任務完了です、先生。……見事な手際でした',
    kitchen:'完成ですね〜。ご褒美に、なにか作りましょうか〜？',
    mari:'完成おめでとうございます、先生。主もきっと微笑んでいらっしゃいます',
    conductor:'できたーー！先生すごーーい！',
    sofa:'ふむ、見事じゃ。妾の絵を任せた甲斐があったのう',
    bedtime:'完成の瞬間、しっかり記録しました♪ 先生、お見事です',
  };
  const fmt = s => `${Math.floor(s / 60)}:${p2(s % 60)}`;
  async function rec(id) { return (await DB.get('room', id).catch(() => null)) || { id }; }

  function tone(f, a, d, at = 0, type = 'triangle') {
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t + at);
    g.gain.setValueAtTime(0, t + at); g.gain.linearRampToValueAtTime(a, t + at + .01); g.gain.exponentialRampToValueAtTime(.0001, t + at + d);
    o.connect(g); g.connect(ctx.destination); o.start(t + at); o.stop(t + at + d + .05);
  }
  const SE = {
    slide:() => tone(660, .06, .06), flip:() => tone(990, .07, .07), ok:() => { tone(784, .1, .12); tone(1175, .1, .18, .07); },
    ng:() => tone(330, .07, .14, 0, 'sine'), clear:() => [523, 659, 784, 1047].forEach((f, i) => tone(f, .12, .35, i * .09)),
  };

  // ===== 枠（全画面）=====
  function open(kind, c) {
    ctxG = c; close(true);
    root = h(`<div id="game"><div class="gbar"><button class="gx" data-a="exit">‹</button><div class="gt"></div><div class="gs"></div></div><div class="gbody"></div></div>`);
    c.host.appendChild(root);
    // ゲーム機の画面から広がって、縁が消える
    const r = c.rect;
    if (r) root.animate([{ clipPath:`inset(${r.top}px ${innerWidth - r.right}px ${innerHeight - r.bottom}px ${r.left}px round 10px)`, opacity:.6 }, { clipPath:'inset(0 0 0 0 round 0)', opacity:1 }], { duration:480, easing:'cubic-bezier(.2,.9,.3,1)' });
    root.querySelector('[data-a="exit"]').onclick = () => (root._back ? root._back() : close());
    (kind === 'puzzle' ? Puzzle : Memory).menu();
  }
  function close(silent) {
    clearInterval(timer); timer = null;
    if (root) { const r = root; root = null; if (silent) r.remove(); else { r.classList.add('out'); setTimeout(() => r.remove(), 280); } }
    setScene(null);
  }
  function setScene(s) { if (scene === s) return; scene = s; syncBgm(0, .6); }
  function bar(title, stat, back) { root.querySelector('.gt').innerHTML = title; root.querySelector('.gs').innerHTML = stat || ''; root._back = back || null; }
  const body = () => root.querySelector('.gbody');

  // ===== メモロビパズル =====
  const Puzzle = (() => {
    let n = 3, st = null;
    const lobbies = () => chars.map((c, i) => ({ i, who:c.who, poster:c.tallPoster }));
    async function menu() {
      clearInterval(timer); setScene(null);
      const R = await rec('game-puzzle'); n = R.size || n;
      bar('MEMOLOBBY PUZZLE', '', null);
      body().innerHTML = `<div class="gmenu2"><div class="gseg">${[3, 4, 5].map(k => `<button data-n="${k}" class="${k === n ? 'on' : ''}">${k}×${k}</button>`).join('')}</div>
        <div class="pgrid">${lobbies().map(l => { const b = (R.best || {})[l.i + '-' + n]; return `<button class="pth" data-i="${l.i}" style="background-image:url(${l.poster})">${b ? `<i>★ ${b.moves}手</i>` : ''}<b>${CHARS[l.who].name}</b></button>`; }).join('')}</div>
        <button class="gbig" data-a="rand"><span>おまかせで始める</span></button></div>`;
      body().onclick = async e => {
        const s = e.target.closest('[data-n]'); if (s) { n = +s.dataset.n; R.size = n; await DB.put('room', R); return menu(); }
        const t = e.target.closest('[data-i]'); if (t) return start(+t.dataset.i);
        if (e.target.closest('[data-a="rand"]')) start(Math.floor(Math.random() * chars.length));
      };
    }
    function fitBoard() {
      const a = 1170 / 2534, W = innerWidth - 24, Hh = innerHeight - 190 - (parseFloat(getComputedStyle(probe).paddingTop) || 0);
      const bw = Math.floor(Math.min(W, Hh * a)); return { bw, bh:Math.floor(bw / a) };
    }
    function start(i) {
      const L = lobbies()[i];
      const N = n * n, tiles = [...Array(N).keys()];   // tiles[位置] = 番号（N-1が空き）
      // 正解からランダムに動かして崩す（必ず解ける）
      let e = N - 1, prev = -1;
      for (let k = 0; k < 120 * n * n; k++) {
        const r = Math.floor(e / n), c = e % n, nb = [];
        if (r > 0) nb.push(e - n); if (r < n - 1) nb.push(e + n); if (c > 0) nb.push(e - 1); if (c < n - 1) nb.push(e + 1);
        const pick = nb.filter(x => x !== prev); const m = pick[Math.floor(Math.random() * pick.length)];
        [tiles[e], tiles[m]] = [tiles[m], tiles[e]]; prev = e; e = m;
      }
      if (tiles.every((t, k) => t === k)) return start(i);
      st = { L, tiles, moves:0, t0:Date.now(), sec:0, done:false };
      draw();
      clearInterval(timer); timer = setInterval(() => { if (!st || st.done) return; st.sec = Math.floor((Date.now() - st.t0) / 1000); stat(); }, 500);
    }
    function stat() { root && (root.querySelector('.gs').innerHTML = `<span>${st.moves}<small>手</small></span><span>${fmt(st.sec)}</span>`); }
    function draw() {
      const { bw, bh } = fitBoard(), tw = bw / n, th = bh / n, N = n * n;
      bar(CHARS[st.L.who].name, '', menu); stat();
      body().innerHTML = `<div class="pwrap"><div class="pboard" style="width:${bw}px;height:${bh}px"><img class="pref" src="${st.L.poster}" alt="">
        ${st.tiles.map((t, pos) => t === N - 1 ? '' : `<div class="pt" data-t="${t}" style="width:${tw}px;height:${th}px;transform:translate(${(pos % n) * tw}px,${Math.floor(pos / n) * th}px)">
          <i style="background-image:url(${st.L.poster});background-size:${bw}px ${bh}px;background-position:${-(t % n) * tw}px ${-Math.floor(t / n) * th}px"></i></div>`).join('')}
        <div class="plast" style="width:${tw}px;height:${th}px;transform:translate(${(n - 1) * tw}px,${(n - 1) * th}px);background-image:url(${st.L.poster});background-size:${bw}px ${bh}px;background-position:${-(n - 1) * tw}px ${-(n - 1) * th}px"></div></div>
        <div class="pbtns"><button data-a="peek">見本（押している間）</button><button data-a="retry">やり直し</button></div></div>`;
      const board = body().querySelector('.pboard');
      board.onpointerdown = e => { const t = e.target.closest('.pt'); if (t) move(+t.dataset.t); };
      const pk = body().querySelector('[data-a="peek"]');
      ['pointerdown'].forEach(ev => pk.addEventListener(ev, () => board.classList.add('peek')));
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => pk.addEventListener(ev, () => board.classList.remove('peek')));
      body().querySelector('[data-a="retry"]').onclick = () => start(st.L.i);
      body().onclick = null;
    }
    function move(t) {
      if (!st || st.done) return;
      const N = n * n, pos = st.tiles.indexOf(t), e = st.tiles.indexOf(N - 1);
      const pr = Math.floor(pos / n), pc = pos % n, er = Math.floor(e / n), ec = e % n;
      if (pr !== er && pc !== ec) return;
      // 同じ列・行なら、空きまでまとめてずらす
      const step = pr === er ? (pc < ec ? -1 : 1) : (pr < er ? -n : n);
      let cur = e;
      while (cur !== pos) { const nx = cur + step; st.tiles[cur] = st.tiles[nx]; cur = nx; }
      st.tiles[pos] = N - 1;
      st.moves++; SE.slide(); haptic();
      const { bw, bh } = fitBoard(), tw = bw / n, th = bh / n;
      body().querySelectorAll('.pt').forEach(el => { const p = st.tiles.indexOf(+el.dataset.t); el.style.transform = `translate(${(p % n) * tw}px,${Math.floor(p / n) * th}px)`; });
      stat();
      if (st.tiles.every((x, k) => x === k)) clear();
    }
    async function clear() {
      st.done = true; clearInterval(timer);
      st.sec = Math.max(1, Math.round((Date.now() - st.t0) / 1000)); stat();
      const board = body().querySelector('.pboard');
      await sleep(260); board.classList.add('done'); SE.clear();
      const R = await rec('game-puzzle'); R.best = R.best || {};
      const key = st.L.i + '-' + n, old = R.best[key], better = !old || st.moves < old.moves || (st.moves === old.moves && st.sec < old.sec);
      if (better) { R.best[key] = { moves:st.moves, sec:st.sec }; await DB.put('room', R); }
      await sleep(900);
      setScene('clear');
      const who = st.L.who;
      result(`<img class="rc" src="${CHIBI[who]}_chibi.webp" alt="">`, CHARS[who].name, CLEAR_LINE[who],
        `<div class="gst"><div><small>手数</small><b>${st.moves}</b></div><div><small>タイム</small><b>${fmt(st.sec)}</b></div><div><small>${n}×${n}</small><b>${better ? 'NEW BEST' : `BEST ${old.moves}手`}</b></div></div>`,
        [{ label:'もう一度', fn:() => { setScene(null); start(st.L.i); } }, { label:'ほかの絵', fn:() => { setScene(null); menu(); } }]);
      playVoice(st.L.i);
    }
    return { menu };
  })();

  // ===== 神経衰弱 =====
  const Memory = (() => {
    // 当番の記憶力（めくったカードを覚えている確率）
    const MEMORY = { seia:.92, noa:.9, yuuka:.85, hina:.78, miyako:.78, kisaki:.72, mari:.62, serina:.62, nico:.55, mika:.5, hoshino:.48, hikari:.28 };
    const TALK = {
      start:{ hoshino:'うへ〜、おじさん本気出しちゃおっかな〜', mika:'えへへ、負けないからね☆', miyako:'作戦開始です。手加減はしません', mari:'よろしくお願いします、先生', serina:'お手柔らかにお願いしますね', kisaki:'ふふ、妾に挑むとはのう', hina:'……やるからには、勝つわ', seia:'結末は、もう見えているかもしれないよ', noa:'全部、覚えちゃいますね♪', yuuka:'記憶力なら自信があります！', hikari:'あそぼーー！', nico:'楽しみましょうね〜' },
      hit:{ hoshino:'お、そろった〜', mika:'やった☆', miyako:'確保しました', mari:'ありがとうございます……！', serina:'あっ、そろいました', kisaki:'当然じゃ', hina:'……ふふ', seia:'思ったとおりだ', noa:'記録どおりです♪', yuuka:'計算どおりです！', hikari:'そろったーー！', nico:'あらあら〜' },
      miss:{ hoshino:'うへ〜、はずれちゃった', mika:'えー、ちがったー！', miyako:'……誤認です', mari:'あら……', serina:'ちがいましたね', kisaki:'む……', hina:'……', seia:'ふむ、霧が深いね', noa:'あら、忘れちゃいました', yuuka:'そんなはずは……！', hikari:'どこだっけーー', nico:'むずかしいですね〜' },
      you:{ hoshino:'先生やるね〜', mika:'先生ずるーい！', miyako:'お見事です', mari:'さすがです、先生', serina:'先生、すごいです！', kisaki:'ほう、やるのう', hina:'……やるわね', seia:'見事だよ、先生', noa:'しっかり記録しました♪', yuuka:'くっ……やりますね', hikari:'先生すごーーい！', nico:'お上手ですね〜' },
      win:{ hoshino:'うへ〜、おじさんの勝ち〜。たまには、ね', mika:'やったー！私の勝ち☆ ごほうび、くれるよね？', miyako:'勝利しました。……楽しかったです', mari:'私の勝ちです。またお相手してくださいね', serina:'勝っちゃいました。先生、また遊びましょうね', kisaki:'妾の勝ちじゃ。また挑むがよい', hina:'……勝ったわ。でも、楽しかった', seia:'予知どおりだね。でも、楽しい時間だった', noa:'私の勝ちです♪ 全部、覚えていましたから', yuuka:'勝ちました！記憶力も計算のうちです', hikari:'かったーー！', nico:'あら、勝っちゃいました〜' },
      lose:{ hoshino:'うへ〜、負けちゃった。先生つよいね〜', mika:'えー負けたー！もう一回！', miyako:'敗北です……次は負けません', mari:'先生の勝ちです。おめでとうございます', serina:'先生の勝ちです！ さすがですね', kisaki:'む……見事じゃ、先生', hina:'……負けたわ。先生、すごいのね', seia:'これは予想外だね。見事だよ、先生', noa:'負けちゃいました。この記録は大切にしますね', yuuka:'うう……もう一回お願いします！', hikari:'まけたーー！', nico:'先生、お上手でした〜' },
      draw:{ hoshino:'引き分け〜。仲良しだね〜' },
    };
    const line = (k, who) => (TALK[k][who] || TALK[k].hoshino || '');
    let mode = 'solo', pairs = 8, st = null;
    async function menu() {
      clearInterval(timer); setScene(null);
      const R = await rec('game-memory'), duty = ctxG.duty, vs = (R.vs || {})[duty] || { w:0, l:0, d:0 };
      pairs = R.pairs || pairs; mode = R.mode || mode;
      bar('MEMORY', '', null);
      const sb = R.solo || {};
      body().innerHTML = `<div class="gmenu2 mm">
        <div class="mlab">あそびかた</div><div class="gseg" data-k="mode"><button data-v="solo" class="${mode === 'solo' ? 'on' : ''}">ひとりで</button><button data-v="vs" class="${mode === 'vs' ? 'on' : ''}">${ctxG.name[duty]}と対戦</button></div>
        <div class="mlab">カードの数</div><div class="gseg" data-k="pairs"><button data-v="8" class="${pairs === 8 ? 'on' : ''}">8組</button><button data-v="12" class="${pairs === 12 ? 'on' : ''}">12組</button></div>
        <div class="mrec"><div><small>ひとりで 8組</small><b>${sb[8] ? `${sb[8].moves}手 ${fmt(sb[8].sec)}` : '―'}</b></div><div><small>ひとりで 12組</small><b>${sb[12] ? `${sb[12].moves}手 ${fmt(sb[12].sec)}` : '―'}</b></div>
          <div><small>${ctxG.name[duty]}との対戦</small><b>${vs.w}勝 ${vs.l}敗${vs.d ? ` ${vs.d}分` : ''}</b></div></div>
        ${mode === 'vs' ? `<div class="mvs"><img src="${ctxG.img(duty, 'stand')}" alt=""><p>${esc(line('start', duty))}</p></div>` : ''}
        <button class="gbig" data-a="go"><span>はじめる</span></button></div>`;
      body().onclick = async e => {
        const s = e.target.closest('[data-v]');
        if (s) { const k = s.parentNode.dataset.k; if (k === 'mode') mode = s.dataset.v; else pairs = +s.dataset.v; R.mode = mode; R.pairs = pairs; await DB.put('room', R); return menu(); }
        if (e.target.closest('[data-a="go"]')) start();
      };
    }
    function start() {
      const keys = shuffle(Object.keys(ctxG.name)).slice(0, pairs);
      const deck = shuffle(keys.concat(keys)).map((k, i) => ({ i, k, up:false, got:null }));
      st = { deck, open:[], moves:0, t0:Date.now(), sec:0, turn:'me', score:{ me:0, cpu:0 }, mem:{}, lock:false, done:false };
      draw();
      clearInterval(timer); timer = setInterval(() => { if (!st || st.done) return; st.sec = Math.floor((Date.now() - st.t0) / 1000); stat(); }, 500);
      if (mode === 'vs') say(line('start', ctxG.duty));
    }
    function stat() {
      if (!root) return;
      const s = root.querySelector('.gs');
      s.innerHTML = mode === 'vs' ? `<span class="${st.turn === 'me' ? 'on' : ''}">先生 ${st.score.me}</span><span class="${st.turn === 'cpu' ? 'on' : ''}">${ctxG.name[ctxG.duty]} ${st.score.cpu}</span>`
        : `<span>${st.moves}<small>手</small></span><span>${fmt(st.sec)}</span>`;
    }
    function draw() {
      bar('MEMORY', '', menu); stat();
      const cols = 4, rows = pairs * 2 / cols, top = mode === 'vs' ? 92 : 0;
      const W = innerWidth - 24, Hh = innerHeight - 130 - top - (parseFloat(getComputedStyle(probe).paddingTop) || 0);
      const cw = Math.floor(Math.min((W - (cols - 1) * 8) / cols, (Hh - (rows - 1) * 8) / rows * .72));
      body().innerHTML = `${mode === 'vs' ? `<div class="mvs on"><img src="${ctxG.img(ctxG.duty, 'stand')}" alt=""><p id="mSay"></p></div>` : ''}
        <div class="mgrid" style="grid-template-columns:repeat(${cols},${cw}px)">${st.deck.map(c => `<div class="mc2" data-i="${c.i}" style="width:${cw}px;height:${Math.round(cw / .72)}px">
          <div class="in"><div class="bk"><i></i></div><div class="fr"><img src="${ctxG.img(c.k, 'stand')}" alt=""><b>${ctxG.name[c.k]}</b></div></div></div>`).join('')}</div>`;
      body().onclick = e => { const c = e.target.closest('.mc2'); if (c && st.turn === 'me') flip(+c.dataset.i, 'me'); };
    }
    function say(t) { const p = root && root.querySelector('#mSay'); if (!p) return; p.textContent = t; p.classList.remove('pop'); void p.offsetWidth; p.classList.add('pop'); }
    function cardEl(i) { return body().querySelector(`.mc2[data-i="${i}"]`); }
    function remember(c) { if (mode === 'vs' && Math.random() < (MEMORY[ctxG.duty] || .5)) st.mem[c.i] = c.k; }
    async function flip(i, who) {
      const c = st.deck[i]; if (st.lock || st.done || c.up || c.got) return;
      c.up = true; cardEl(i).classList.add('up'); SE.flip();
      st.open.push(c); remember(c);
      if (st.open.length < 2) return;
      st.lock = true; st.moves++; stat();
      const [a, b] = st.open; st.open = [];
      await sleep(who === 'cpu' ? 650 : 520);
      if (a.k === b.k) {
        a.got = b.got = who; SE.ok(); haptic();
        [a, b].forEach(x => { cardEl(x.i).classList.add('got', who); delete st.mem[x.i]; });
        if (mode === 'vs') { st.score[who]++; say(line(who === 'cpu' ? 'hit' : 'you', ctxG.duty)); }
        stat(); st.lock = false;
        if (st.deck.every(x => x.got)) return end();
        if (who === 'cpu') cpu();   // そろえたら続けてめくる
      } else {
        SE.ng();
        await sleep(450);
        [a, b].forEach(x => { x.up = false; cardEl(x.i).classList.remove('up'); });
        st.lock = false;
        if (mode === 'vs') {
          if (who === 'cpu') say(line('miss', ctxG.duty));
          st.turn = who === 'me' ? 'cpu' : 'me'; stat();
          if (st.turn === 'cpu') cpu();
        }
      }
    }
    async function cpu() {
      if (st.done) return;
      st.turn = 'cpu'; stat();
      await sleep(700);
      const left = st.deck.filter(x => !x.got), known = left.filter(x => st.mem[x.i]);
      const byK = {}; known.forEach(x => (byK[x.k] = byK[x.k] || []).push(x));
      const pair = Object.values(byK).find(v => v.length >= 2);
      const unknown = left.filter(x => !st.mem[x.i]);
      const first = pair ? pair[0] : (unknown.length ? unknown : left)[Math.floor(Math.random() * (unknown.length || left.length))];
      await flip(first.i, 'cpu');
      if (st.done) return;
      await sleep(600);
      let second = pair ? pair[1] : left.find(x => x !== first && st.mem[x.i] === first.k);
      if (!second) { const pool = left.filter(x => x !== first && !st.mem[x.i]); second = (pool.length ? pool : left.filter(x => x !== first))[Math.floor(Math.random() * Math.max(1, (pool.length || left.length - 1)))]; }
      if (second) await flip(second.i, 'cpu');
    }
    async function end() {
      st.done = true; clearInterval(timer); st.sec = Math.max(1, Math.round((Date.now() - st.t0) / 1000));
      SE.clear(); await sleep(700);
      const R = await rec('game-memory'), duty = ctxG.duty;
      let html, who = duty, msg;
      if (mode === 'solo') {
        R.solo = R.solo || {}; const old = R.solo[pairs], better = !old || st.moves < old.moves || (st.moves === old.moves && st.sec < old.sec);
        if (better) R.solo[pairs] = { moves:st.moves, sec:st.sec };
        msg = line('you', duty) + '。' + (better ? '新記録だね、先生！' : 'また挑戦しようね');
        html = `<div class="gst"><div><small>手数</small><b>${st.moves}</b></div><div><small>タイム</small><b>${fmt(st.sec)}</b></div><div><small>${pairs}組</small><b>${better ? 'NEW BEST' : `BEST ${old.moves}手`}</b></div></div>`;
      } else {
        R.vs = R.vs || {}; const v = R.vs[duty] = R.vs[duty] || { w:0, l:0, d:0 };
        const r = st.score.me > st.score.cpu ? 'l' : st.score.me < st.score.cpu ? 'w' : 'd'; v[r]++;   // w／l は当番から見た勝ち負け
        msg = r === 'w' ? line('win', duty) : r === 'l' ? line('lose', duty) : line('draw', duty);
        html = `<div class="gst"><div><small>先生</small><b>${st.score.me}</b></div><div><small>${ctxG.name[duty]}</small><b>${st.score.cpu}</b></div><div><small>結果</small><b>${r === 'l' ? 'WIN' : r === 'w' ? 'LOSE' : 'DRAW'}</b></div></div>`;
      }
      await DB.put('room', R);
      setScene('clear');
      result(`<img class="rc" src="${ctxG.img(who, 'stand')}" alt="">`, ctxG.name[who], msg, html,
        [{ label:'もう一度', fn:() => { setScene(null); start(); } }, { label:'メニュー', fn:() => { setScene(null); menu(); } }]);
    }
    return { menu };
  })();

  // ===== 結果（ブルアカ風） =====
  function result(chibi, name, text, stats, btns) {
    const r = h(`<div class="gres"><div class="gclear"><span>CLEAR</span></div>${chibi}
      <div class="gwin"><div class="who"><b>${esc(name)}</b></div><div class="tx"></div></div>${stats}<div class="gbtn">${btns.map((b, i) => `<button data-b="${i}">${b.label}</button>`).join('')}</div></div>`);
    body().appendChild(r);
    const tx = r.querySelector('.tx'); let i = 0;
    const tt = setInterval(() => { tx.textContent = text.slice(0, ++i); if (i >= text.length) clearInterval(tt); }, 40);
    r.querySelector('.gbtn').onclick = e => { const b = e.target.closest('[data-b]'); if (b) { clearInterval(tt); r.remove(); btns[+b.dataset.b].fn(); } };
  }

  return { open, close, bgm:() => scene === 'clear' ? RESULT() : null, active:() => !!root };
})();
