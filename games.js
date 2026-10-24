// Kani Favorite — ゲーム機（メモロビパズル・神経衰弱）
'use strict';
const Games = (() => {
  let root = null, ctxG = null, scene = null, timer = null;
  const RESULT = () => Ops.allBgm().find(b => b.src === 'ops_result_bgm.mp3');
  // メモロビのキャラ（CHARSのキー）→ デフォルメ画像の名前
  const CHIBI = { hoshino:'hoshino', christmas:'serina', mika:'mika', office:'yuuka', hina:'hina', drive:'seia', miyako:'miyako', kitchen:'nico', mari:'mari', conductor:'hikari', sofa:'kisaki', bedtime:'noa' };
  // 自室のキー → CHARS（ボイス）のキー
  const VOICE = { hoshino:'hoshino', mika:'mika', hina:'hina', miyako:'miyako', mari:'mari', nico:'kitchen', serina:'christmas', hikari:'conductor', seia:'drive', kisaki:'sofa', noa:'bedtime', yuuka:'office' };
  // 子ごとのイメージカラー（カードの枠）
  const COLOR = { hoshino:'#ff9ec4', mika:'#f2a2d6', miyako:'#8fb8ff', mari:'#ffb26b', serina:'#ff8f9a', kisaki:'#e6b24f', hina:'#b48cff', seia:'#f5c95c', noa:'#aab8f0', yuuka:'#5c9cff', hikari:'#86d86a', nico:'#ffa98f' };
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
  const safeTop = () => parseFloat(getComputedStyle(probe).paddingTop) || 0;
  async function rec(id) { return (await DB.get('room', id).catch(() => null)) || { id }; }

  function tone(f, a, d, at = 0, type = 'triangle') {
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t + at);
    g.gain.setValueAtTime(0, t + at); g.gain.linearRampToValueAtTime(a, t + at + .01); g.gain.exponentialRampToValueAtTime(.0001, t + at + d);
    o.connect(g); g.connect(ctx.destination); o.start(t + at); o.stop(t + at + d + .05);
  }
  const SE = {
    slide:() => { tone(520, .05, .05, 0, 'sine'); tone(780, .03, .04, .015, 'sine'); },
    flip:() => tone(990, .06, .07), ok:() => { tone(784, .1, .12); tone(1175, .1, .18, .07); tone(1568, .06, .25, .14, 'sine'); },
    ng:() => tone(330, .07, .14, 0, 'sine'), turn:() => { tone(660, .06, .08); tone(880, .06, .1, .06); },
    clear:() => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, .11, .4, i * .08)),
    lose:() => [523, 466, 392].forEach((f, i) => tone(f, .09, .35, i * .14, 'sine')),
  };

  // ===== 枠（全画面）=====
  function open(kind, c) {
    ctxG = c; close(true);
    root = h(`<div id="game"><div class="gbg"></div><div class="gbar"><button class="gx" data-a="exit">‹</button><div class="gt"></div><div class="gs"></div></div><div class="gprog"><i></i></div><div class="gbody"></div></div>`);
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
  function setBg(src) { root.classList.toggle('withbg', !!src); root.querySelector('.gbg').style.backgroundImage = src ? `url(${src})` : ''; }
  function prog(v) { root.classList.toggle('hasprog', v != null); if (v != null) root.querySelector('.gprog i').style.width = (v * 100).toFixed(1) + '%'; }
  const body = () => root.querySelector('.gbody');
  // 横切る帯（YOUR TURN など）
  function banner(text, cls = '') {
    const b = h(`<div class="gband ${cls}"><span>${esc(text)}</span></div>`); root.appendChild(b);
    setTimeout(() => b.remove(), 1300);
  }
  // きらきら
  function burst(x, y, color = '#fff') {
    for (let k = 0; k < 10; k++) {
      const s = document.createElement('i'); s.className = 'gspk'; s.style.left = x + 'px'; s.style.top = y + 'px'; s.style.background = color;
      root.appendChild(s);
      const a = Math.PI * 2 * k / 10 + Math.random() * .4, d = 40 + Math.random() * 40;
      s.animate([{ transform:'translate(-50%,-50%) scale(1)', opacity:1 }, { transform:`translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(.2)`, opacity:0 }],
        { duration:600 + Math.random() * 200, easing:'cubic-bezier(.2,.8,.3,1)' }).finished.then(() => s.remove());
    }
  }

  // ===== メモロビパズル =====
  const Puzzle = (() => {
    let n = 3, st = null;
    const lobbies = () => chars.map((c, i) => ({ i, who:c.who, poster:c.tallPoster }));
    async function menu() {
      clearInterval(timer); setScene(null); setBg(null); prog(null);
      const R = await rec('game-puzzle'); n = R.size || n;
      bar('MEMOLOBBY PUZZLE', '', null);
      const medal = i => [3, 4, 5].map(k => (R.best || {})[i + '-' + k] ? `<i class="md m${k}"></i>` : '').join('');
      body().innerHTML = `<div class="gmenu2"><div class="gseg">${[3, 4, 5].map(k => `<button data-n="${k}" class="${k === n ? 'on' : ''}">${k}×${k}</button>`).join('')}</div>
        <div class="pgrid">${lobbies().map(l => { const b = (R.best || {})[l.i + '-' + n]; return `<button class="pth" data-i="${l.i}" style="background-image:url(${l.poster})">
          <span class="mds">${medal(l.i)}</span>${b ? `<em>BEST ${b.moves}手</em>` : ''}<b>${CHARS[l.who].name}</b></button>`; }).join('')}</div>
        <div class="mlegend"><i class="md m3"></i>3×3 <i class="md m4"></i>4×4 <i class="md m5"></i>5×5 をクリア</div>
        <button class="gbig" data-a="rand"><span>おまかせで始める</span></button></div>`;
      body().onclick = async e => {
        const s = e.target.closest('[data-n]'); if (s) { n = +s.dataset.n; R.size = n; await DB.put('room', R); return menu(); }
        const t = e.target.closest('[data-i]'); if (t) return start(+t.dataset.i);
        if (e.target.closest('[data-a="rand"]')) start(Math.floor(Math.random() * chars.length));
      };
    }
    function size() {
      const im = st.im, a = im && im.naturalWidth ? im.naturalWidth / im.naturalHeight : 1170 / 2534;
      const W = innerWidth - 40, Hh = innerHeight - 214 - safeTop();
      const bw = Math.floor(Math.min(W, Hh * a)); return { bw, bh:Math.floor(bw / a) };
    }
    function shuffled() {
      const N = n * n, tiles = [...Array(N).keys()];   // tiles[位置] = 番号（N-1が空き）
      let e = N - 1, prev = -1;
      for (let k = 0; k < 120 * N; k++) {   // 正解からランダムに動かして崩す（必ず解ける）
        const r = Math.floor(e / n), c = e % n, nb = [];
        if (r > 0) nb.push(e - n); if (r < n - 1) nb.push(e + n); if (c > 0) nb.push(e - 1); if (c < n - 1) nb.push(e + 1);
        const pick = nb.filter(x => x !== prev), m = pick[Math.floor(Math.random() * pick.length)];
        [tiles[e], tiles[m]] = [tiles[m], tiles[e]]; prev = e; e = m;
      }
      const ok = tiles.filter((t, k) => t === k).length;
      return ok > N * .4 ? shuffled() : tiles;   // ほとんど揃っている崩れ方はやり直す
    }
    async function start(i) {
      const L = lobbies()[i];
      const im = new Image(); im.src = L.poster; try { await im.decode(); } catch(e) {}
      st = { L, im, tiles:shuffled(), moves:0, t0:0, sec:0, done:false, ready:false, nums:st && st.nums };
      setBg(L.poster);
      draw(true);
      clearInterval(timer);
      // 完成した絵を見せてから、パネルに割れて混ざる
      await sleep(1400);
      if (!st || st.L !== L) return;
      const board = body().querySelector('.pboard'); board.classList.remove('intro'); board.classList.add('go');
      SE.slide(); await sleep(520);
      board.classList.remove('go'); st.ready = true; st.t0 = Date.now();
      timer = setInterval(() => { if (!st || st.done || !st.ready) return; st.sec = Math.floor((Date.now() - st.t0) / 1000); stat(); }, 500);
    }
    function stat() {
      if (!root) return;
      root.querySelector('.gs').innerHTML = `<span>${st.moves}<small>手</small></span><span>${fmt(st.sec)}</span>`;
      prog(st.tiles.filter((t, k) => t === k && t !== n * n - 1).length / (n * n - 1));
    }
    function place(el, pos, tw, th) { el.style.transform = `translate(${(pos % n) * tw}px,${Math.floor(pos / n) * th}px)`; el.classList.toggle('ok', +el.dataset.t === pos); }
    function draw(intro) {
      const { bw, bh } = size(), tw = bw / n, th = bh / n, N = n * n;
      bar(`<small>${n}×${n}</small> ${CHARS[st.L.who].name}`, '', menu); stat();
      body().innerHTML = `<div class="pwrap"><div class="pframe"><span class="ptag">SCHALE</span><i class="cn a"></i><i class="cn b"></i><i class="cn c"></i><i class="cn d"></i>
        <div class="pboard ${intro ? 'intro' : ''} ${st.nums ? 'nums' : ''}" style="width:${bw}px;height:${bh}px"><img class="pref" src="${st.L.poster}" alt="">
        ${st.tiles.map((t, pos) => t === N - 1 ? '' : `<div class="pt" data-t="${t}" style="width:${tw}px;height:${th}px;--d:${(Math.random() * .25).toFixed(2)}s">
          <i style="background-image:url(${st.L.poster});background-size:${bw}px ${bh}px;background-position:${-(t % n) * tw}px ${-Math.floor(t / n) * th}px"><b>${t + 1}</b></i></div>`).join('')}
        <div class="plast" style="width:${tw}px;height:${th}px;transform:translate(${(n - 1) * tw}px,${(n - 1) * th}px);background-image:url(${st.L.poster});background-size:${bw}px ${bh}px;background-position:${-(n - 1) * tw}px ${-(n - 1) * th}px"></div></div></div>
        <div class="pbtns"><button data-a="peek">見本</button><button data-a="nums" class="${st.nums ? 'on' : ''}">番号</button><button data-a="retry">やり直し</button></div></div>`;
      body().querySelectorAll('.pt').forEach(el => place(el, st.tiles.indexOf(+el.dataset.t), tw, th));
      const board = body().querySelector('.pboard');
      board.onpointerdown = e => { const t = e.target.closest('.pt'); if (t) move(+t.dataset.t); };
      const pk = body().querySelector('[data-a="peek"]');
      pk.addEventListener('pointerdown', () => board.classList.add('peek'));
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => pk.addEventListener(ev, () => board.classList.remove('peek')));
      body().querySelector('[data-a="nums"]').onclick = e => { st.nums = !st.nums; board.classList.toggle('nums', st.nums); e.currentTarget.classList.toggle('on', st.nums); };
      body().querySelector('[data-a="retry"]').onclick = () => start(st.L.i);
      body().onclick = null;
    }
    function move(t) {
      if (!st || st.done || !st.ready) return;
      const N = n * n, pos = st.tiles.indexOf(t), e = st.tiles.indexOf(N - 1);
      const pr = Math.floor(pos / n), pc = pos % n, er = Math.floor(e / n), ec = e % n;
      if (pr !== er && pc !== ec) return;
      // 同じ列・行なら、空きまでまとめてずらす
      const step = pr === er ? (pc < ec ? -1 : 1) : (pr < er ? -n : n);
      let cur = e;
      while (cur !== pos) { const nx = cur + step; st.tiles[cur] = st.tiles[nx]; cur = nx; }
      st.tiles[pos] = N - 1;
      st.moves++; SE.slide(); haptic();
      const { bw, bh } = size(), tw = bw / n, th = bh / n;
      body().querySelectorAll('.pt').forEach(el => place(el, st.tiles.indexOf(+el.dataset.t), tw, th));
      stat();
      if (st.tiles.every((x, k) => x === k)) clear();
    }
    async function clear() {
      st.done = true; clearInterval(timer);
      st.sec = Math.max(1, Math.round((Date.now() - st.t0) / 1000)); stat();
      const board = body().querySelector('.pboard');
      await sleep(240); board.classList.add('done'); SE.clear();
      const r = board.getBoundingClientRect(); burst(r.right - r.width / n / 2, r.bottom - r.height / n / 2, '#fff7c2');
      const R = await rec('game-puzzle'); R.best = R.best || {};
      const key = st.L.i + '-' + n, old = R.best[key], better = !old || st.moves < old.moves || (st.moves === old.moves && st.sec < old.sec);
      if (better) { R.best[key] = { moves:st.moves, sec:st.sec }; await DB.put('room', R); }
      await sleep(1100);
      setScene('clear');
      const who = st.L.who;
      result('CLEAR', 'clear', `<img class="rc" src="${CHIBI[who]}_chibi.webp" alt="">`, CHARS[who].name, CLEAR_LINE[who],
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
      draw:{ hoshino:'引き分け〜。仲良しだね〜', mika:'引き分けー！もう一回やろ☆', yuuka:'引き分け……次は勝ちます！' },
    };
    const line = (k, who) => (TALK[k][who] || TALK[k].hoshino || '');
    let mode = 'solo', pairs = 8, st = null;
    async function menu() {
      clearInterval(timer); setScene(null); setBg(null); prog(null);
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
        <div class="mprev"><div class="mc2 demo"><div class="in"><div class="bk"><i></i></div></div></div></div>
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
      clearInterval(timer); timer = setInterval(() => { if (!st || st.done) return; st.sec = Math.floor((Date.now() - st.t0) / 1000); if (mode === 'solo') stat(); }, 500);
      if (mode === 'vs') { setTimeout(() => say(line('start', ctxG.duty)), 300); setTimeout(() => banner('YOUR TURN', 'me'), 900); }
    }
    function stat() {
      if (!root) return;
      if (mode === 'vs') {
        root.querySelector('.gs').innerHTML = '';
        const sc = root.querySelector('.msc'); if (!sc) return;
        const tot = Math.max(1, st.score.me + st.score.cpu);
        sc.innerHTML = `<div class="sme ${st.turn === 'me' ? 'on' : ''}"><small>先生</small><b>${st.score.me}</b></div><div class="sbar"><i style="width:${st.score.me / tot * 100}%"></i></div><div class="scpu ${st.turn === 'cpu' ? 'on' : ''}"><b>${st.score.cpu}</b><small>${ctxG.name[ctxG.duty]}</small></div>`;
        if (!st.score.me && !st.score.cpu) sc.querySelector('.sbar i').style.width = '50%';
      } else root.querySelector('.gs').innerHTML = `<span>${st.moves}<small>手</small></span><span>${fmt(st.sec)}</span><span class="pr">${st.score.me}<small>/${pairs}</small></span>`;
    }
    function draw() {
      bar('MEMORY', '', menu);
      const cols = 4, rows = pairs * 2 / cols, top = mode === 'vs' ? 134 : 0;
      const W = innerWidth - 24, Hh = innerHeight - 120 - top - safeTop();
      const cw = Math.floor(Math.min((W - (cols - 1) * 9) / cols, (Hh - (rows - 1) * 9) / rows * .72));
      const duty = ctxG.duty;
      body().innerHTML = `${mode === 'vs' ? `<div class="mhud"><div class="mpt" style="--c:${COLOR[duty]}"><img class="s" src="${ctxG.img(duty, 'stand')}" alt=""><img class="t" src="${ctxG.img(duty, 'talk')}" alt=""></div>
          <div class="mright"><div class="mname" style="--c:${COLOR[duty]}">${ctxG.name[duty]}</div><p id="mSay"></p></div></div><div class="msc"></div>` : ''}
        <div class="mgrid" style="grid-template-columns:repeat(${cols},${cw}px)">${st.deck.map(c => `<div class="mc2" data-i="${c.i}" style="width:${cw}px;height:${Math.round(cw / .72)}px;--c:${COLOR[c.k]}">
          <div class="in"><div class="bk"><i></i></div><div class="fr"><img src="${ctxG.img(c.k, 'stand')}" alt=""><b>${ctxG.name[c.k]}</b></div></div></div>`).join('')}</div>`;
      stat();
      body().onclick = e => { const c = e.target.closest('.mc2'); if (c && st.turn === 'me') flip(+c.dataset.i, 'me'); };
      body().querySelectorAll('.mc2').forEach((c, k) => c.animate([{ transform:'translateY(14px) scale(.9)', opacity:0 }, { transform:'none', opacity:1 }], { duration:380, delay:k * 22, easing:'cubic-bezier(.2,.9,.3,1)', fill:'backwards' }));
    }
    function say(t) {
      const p = root && root.querySelector('#mSay'); if (!p) return;
      p.textContent = t; p.classList.remove('pop'); void p.offsetWidth; p.classList.add('pop');
      const pt = root.querySelector('.mpt'); if (pt) { pt.classList.add('talk'); clearTimeout(pt._t); pt._t = setTimeout(() => pt.classList.remove('talk'), Math.min(2600, 500 + t.length * 70)); }
    }
    function cardEl(i) { return body().querySelector(`.mc2[data-i="${i}"]`); }
    function remember(c) { if (mode === 'vs' && Math.random() < (MEMORY[ctxG.duty] || .5)) st.mem[c.i] = c.k; }
    // そろったカードが、取った人の得点へ飛んでいく
    function fly(el, who) {
      const target = root.querySelector(mode === 'vs' ? (who === 'me' ? '.sme b' : '.scpu b') : '.gs .pr'); if (!target) return;
      const a = el.getBoundingClientRect(), b = target.getBoundingClientRect(), cl = el.cloneNode(true); cl.classList.add('fly');
      Object.assign(cl.style, { position:'fixed', left:a.left + 'px', top:a.top + 'px', width:a.width + 'px', height:a.height + 'px', margin:0, zIndex:30 });
      document.body.appendChild(cl);
      cl.animate([{ transform:'none', opacity:1 }, { transform:`translate(${b.left + b.width / 2 - a.left - a.width / 2}px,${b.top + b.height / 2 - a.top - a.height / 2}px) scale(.18) rotate(${who === 'me' ? -12 : 12}deg)`, opacity:.2 }],
        { duration:560, easing:'cubic-bezier(.5,0,.7,.4)' }).finished.then(() => { cl.remove(); target.animate([{ transform:'scale(1.5)' }, { transform:'scale(1)' }], { duration:260 }); });
    }
    async function flip(i, who) {
      const c = st.deck[i]; if (st.lock || st.done || c.up || c.got) return;
      c.up = true; cardEl(i).classList.add('up'); SE.flip();
      st.open.push(c); remember(c);
      if (st.open.length < 2) return;
      st.lock = true; st.moves++; if (mode === 'solo') stat();
      const [a, b] = st.open; st.open = [];
      await sleep(who === 'cpu' ? 650 : 520);
      if (a.k === b.k) {
        a.got = b.got = who; SE.ok(); haptic();
        st.score[who]++;
        [a, b].forEach(x => { const el = cardEl(x.i), r = el.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, COLOR[x.k]); delete st.mem[x.i]; });
        await sleep(260);
        [a, b].forEach(x => { const el = cardEl(x.i); fly(el, who); el.classList.add('got', who); });
        if (mode === 'vs') say(line(who === 'cpu' ? 'hit' : 'you', ctxG.duty));
        await sleep(300);
        stat(); st.lock = false;
        if (st.deck.every(x => x.got)) return end();
        if (who === 'cpu') cpu();   // そろえたら続けてめくる
      } else {
        SE.ng();
        [a, b].forEach(x => cardEl(x.i).classList.add('ng'));
        await sleep(450);
        [a, b].forEach(x => { x.up = false; const el = cardEl(x.i); el.classList.remove('up', 'ng'); });
        st.lock = false;
        if (mode === 'vs') {
          if (who === 'cpu') say(line('miss', ctxG.duty));
          st.turn = who === 'me' ? 'cpu' : 'me'; stat();
          SE.turn(); banner(st.turn === 'me' ? 'YOUR TURN' : `${ctxG.name[ctxG.duty]}のターン`, st.turn);
          if (st.turn === 'cpu') cpu();
        }
      }
    }
    async function cpu() {
      if (st.done) return;
      st.turn = 'cpu'; stat();
      await sleep(1000);
      const left = st.deck.filter(x => !x.got), known = left.filter(x => st.mem[x.i]);
      const byK = {}; known.forEach(x => (byK[x.k] = byK[x.k] || []).push(x));
      const pair = Object.values(byK).find(v => v.length >= 2);
      const unknown = left.filter(x => !st.mem[x.i]);
      const pool1 = unknown.length ? unknown : left;
      const first = pair ? pair[0] : pool1[Math.floor(Math.random() * pool1.length)];
      await flip(first.i, 'cpu');
      if (st.done) return;
      await sleep(600);
      let second = pair ? pair[1] : left.find(x => x !== first && st.mem[x.i] === first.k);
      if (!second) { const pool = left.filter(x => x !== first && !st.mem[x.i]), p2l = pool.length ? pool : left.filter(x => x !== first); second = p2l[Math.floor(Math.random() * p2l.length)]; }
      if (second) await flip(second.i, 'cpu');
    }
    async function end() {
      st.done = true; clearInterval(timer); st.sec = Math.max(1, Math.round((Date.now() - st.t0) / 1000));
      await sleep(500);
      const R = await rec('game-memory'), duty = ctxG.duty;
      let html, msg, label = 'CLEAR', cls = 'clear';
      if (mode === 'solo') {
        R.solo = R.solo || {}; const old = R.solo[pairs], better = !old || st.moves < old.moves || (st.moves === old.moves && st.sec < old.sec);
        if (better) R.solo[pairs] = { moves:st.moves, sec:st.sec };
        msg = line('you', duty) + '。' + (better ? '新記録だね、先生！' : 'また挑戦しようね');
        html = `<div class="gst"><div><small>手数</small><b>${st.moves}</b></div><div><small>タイム</small><b>${fmt(st.sec)}</b></div><div><small>${pairs}組</small><b>${better ? 'NEW BEST' : `BEST ${old.moves}手`}</b></div></div>`;
        SE.clear();
      } else {
        R.vs = R.vs || {}; const v = R.vs[duty] = R.vs[duty] || { w:0, l:0, d:0 };
        const r = st.score.me > st.score.cpu ? 'l' : st.score.me < st.score.cpu ? 'w' : 'd'; v[r]++;   // w／l は当番から見た勝ち負け
        msg = r === 'w' ? line('win', duty) : r === 'l' ? line('lose', duty) : line('draw', duty);
        label = r === 'l' ? 'WIN' : r === 'w' ? 'LOSE' : 'DRAW'; cls = r === 'l' ? 'win' : r === 'w' ? 'lose' : 'draw';
        html = `<div class="gst"><div><small>先生</small><b>${st.score.me}</b></div><div><small>${ctxG.name[duty]}</small><b>${st.score.cpu}</b></div><div><small>通算</small><b>${v.l}勝${v.w}敗</b></div></div>`;
        (r === 'w' ? SE.lose : SE.clear)();
      }
      await DB.put('room', R);
      setScene('clear');
      result(label, cls, `<img class="rc" src="${ctxG.img(duty, 'stand')}" alt="">`, ctxG.name[duty], msg, html,
        [{ label:'もう一度', fn:() => { setScene(null); start(); } }, { label:'メニュー', fn:() => { setScene(null); menu(); } }]);
      if (VOICE[duty]) playVoice(VOICE[duty]);
    }
    return { menu };
  })();

  // ===== 結果（ブルアカ風） =====
  function result(label, cls, chibi, name, text, stats, btns) {
    const r = h(`<div class="gres ${cls}"><div class="gclear"><span>${label}</span></div>${chibi}
      <div class="gwin"><div class="who"><b>${esc(name)}</b></div><div class="tx"></div></div>${stats}<div class="gbtn">${btns.map((b, i) => `<button data-b="${i}">${b.label}</button>`).join('')}</div></div>`);
    body().appendChild(r);
    const tx = r.querySelector('.tx'); let i = 0;
    const tt = setInterval(() => { tx.textContent = text.slice(0, ++i); if (i >= text.length) clearInterval(tt); }, 40);
    r.querySelector('.gbtn').onclick = e => { const b = e.target.closest('[data-b]'); if (b) { clearInterval(tt); r.remove(); btns[+b.dataset.b].fn(); } };
  }

  return { open, close, bgm:() => scene === 'clear' ? RESULT() : null, active:() => !!root, VOICE };
})();
