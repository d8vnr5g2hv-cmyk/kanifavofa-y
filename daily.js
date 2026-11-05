// Yohei Support — 朝の流れ（日付めくり → 乃亜の睡眠レポート → ミカの天気 → ホシノの電話）と、夜の記録（乃亜 → スクラッチ）
// その日はじめて開いたときに1回だけ。どこでもスキップできる
'use strict';
const Daily = (() => {
  let ov = null, busy = false;
  const today = () => D.today();
  // 夜の「1日」は午前3時まで前の日
  const nightDay = () => new Date().getHours() < 3 ? D.add(D.today(), -1) : D.today();
  const hr = () => new Date().getHours();
  const wantMorning = () => Feat.on('morning') && LS.get('ys-morning') !== today() && hr() >= 4 && hr() < 22;
  const wantNight = () => Feat.on('night') && LS.get('ys-night') !== nightDay() && (hr() >= 22 || hr() < 3);

  // アプリに入ったとき・戻ってきたときに呼ぶ
  async function check() {
    if (busy || ov || phase !== 'app' || document.hidden) return;
    if (typeof Talk !== 'undefined' && Talk.active()) return;
    try {
      const force = LS.get('ys-force'); if (force) { LS.set('ys-force', ''); return force === 'night' ? await night() : await morning(); }
      if (wantMorning()) return await morning();
      if (wantNight()) return await night();
    } catch (e) { console.warn(e); close(); }
  }

  // ===== 全画面の入れ物 =====
  function frame(cls) {
    ov = h(`<div id="daily" class="${cls}"><div class="dl-track"></div><div class="dl-dots"></div><button class="dl-skip">SKIP</button></div>`);
    document.body.appendChild(ov); document.body.classList.add('dailyOn');
    ov.querySelector('.dl-skip').onclick = e => { e.stopPropagation(); haptic(); finish(cls); };
    return ov;
  }
  function close() {
    if (!ov) return;
    const o = ov; ov = null; o.remove(); document.body.classList.remove('dailyOn'); busy = false;
    syncBgm(200);
  }
  async function finish(kind) {
    if (!ov) return;
    if (kind === 'morning') { LS.set('ys-morning', today()); LS.set('ys-morningN', (+LS.get('ys-morningN') || 0) + 1); } else LS.set('ys-night', nightDay());
    try { if (typeof Talk !== 'undefined') Talk.close(); } catch (e) {}
    await Wipe.play(() => close(), kind === 'morning' ? 'GOOD MORNING' : 'GOOD NIGHT');
    if (typeof Progress !== 'undefined') Progress.paintHud();
    if (kind === 'morning' && typeof Chat !== 'undefined') setTimeout(() => Chat.tick('morning'), 2500);
    setTimeout(check, 1200);
  }
  // カードを横に並べる（スワイプで次へ。ボタンでも次へ）
  function cards(list) {
    const tr = ov.querySelector('.dl-track'), dots = ov.querySelector('.dl-dots');
    tr.innerHTML = list.map((_, i) => `<section class="dl-card" data-i="${i}"></section>`).join('');
    dots.innerHTML = list.map(() => '<i></i>').join('');
    let cur = -1;
    const mark = () => { const i = Math.round(tr.scrollLeft / tr.clientWidth); if (i === cur) return; cur = i; [...dots.children].forEach((d, k) => d.classList.toggle('on', k === i)); if (list[i] && list[i].enter) list[i].enter(tr.children[i]); };
    tr.addEventListener('scroll', () => { clearTimeout(tr._t); tr._t = setTimeout(mark, 90); }, { passive:true });
    list.forEach((c, i) => c.draw(tr.children[i], () => go(i + 1)));
    function go(i) { if (i >= list.length) return; tr.scrollTo({ left:i * tr.clientWidth, behavior:'smooth' }); setTimeout(mark, 450); }
    mark();
    return { go };
  }

  // ===== 朝 =====
  async function morning() {
    busy = true;
    frame('morning');
    await flip();
    const w = await Wx.get().catch(() => null);
    cards([
      { draw:(box, next) => sleepCard(box, next) },
      { draw:(box, next) => weatherCard(box, w, next), enter:() => Cast.note('mika') },
      { draw:(box) => callCard(box), enter:box => ring(box) },
    ]);
    ov.querySelector('.dl-flip').classList.add('gone');
    setTimeout(() => { const f = ov && ov.querySelector('.dl-flip'); if (f) f.remove(); }, 500);
  }
  // 日付めくり（約1秒）
  async function flip() {
    const t = today(), y = D.add(t, -1), d = D.parse(t), W = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const card = (s, cls) => { const x = D.parse(s); return `<div class="fc ${cls}"><small>${x.getFullYear()}</small><b>${x.getMonth() + 1}<i>/</i>${x.getDate()}</b><em>${W[x.getDay()]}</em></div>`; };
    const el = h(`<div class="dl-flip"><i class="band"></i><i class="band b2"></i><div class="fwrap">${card(y, 'old')}${card(t, 'new')}</div>
      <div class="fmsg">${hr() < 11 ? 'GOOD MORNING' : hr() < 17 ? 'GOOD AFTERNOON' : 'GOOD EVENING'}<small>${D.dow(t)}曜日</small></div></div>`);
    ov.appendChild(el);
    Sfx.play('page');
    await sleep(80); el.classList.add('go');
    await sleep(520); Sfx.play('ok'); haptic();
    await sleep(700);
  }

  // ① 乃亜の睡眠レポート
  async function sleepCard(box, next) {
    const td = await Life.day(), s = td.sleep;
    const draw = async () => {
      const td2 = await Life.day(), s2 = td2.sleep, hh = Life.sleepH(s2);
      const ds = await Life.days(7), mx = 9;
      const avg = (() => { const v = ds.map(x => Life.sleepH(x.sleep)).filter(x => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10 : null; })();
      const late = s2 && s2.bed && +s2.bed.slice(0, 2) >= 2 && +s2.bed.slice(0, 2) < 12;
      const [line, face] = hh == null ? ['', 'normal'] : hh < 5 ? [`……${hh}時間。それ、寝たって言わない。今日は絶対早く寝て`, 'worry'] : hh < 6 ? [`……${hh}時間でしょ。顔に出てる。今夜は24時まで`, 'worry']
        : hh < 7 ? [`ん、${hh}時間。……まあ、悪くないんじゃない`, 'normal'] : [`${hh}時間。……ちゃんと寝れたじゃん。えらい`, 'happy'];
      box.querySelector('.sr-bg').src = face === 'worry' ? 'nurse_worry.webp' : face === 'happy' ? 'nurse_happy.webp' : 'nurse_normal.webp';
      box.querySelector('.sr-panel').innerHTML = hh == null ? inputHTML() : `
        <div class="sr-big"><b>${hh}</b><span>時間</span><em>${esc(s2.bed)} → ${esc(s2.wake)}</em></div>
        <div class="sr-bars">${ds.map(x => { const v = Life.sleepH(x.sleep); return `<div><i style="height:${v ? Math.min(100, v / mx * 100) : 0}%" class="${v && v < 6 ? 'lo' : ''}${x.date === today() ? ' td' : ''}"></i><span>${D.dow(x.date)}</span></div>`; }).join('')}</div>
        <div class="sr-avg">7日の平均 <b>${avg ?? '—'}</b>時間</div>
        <p class="sr-say"><b>乃亜</b>${esc(line)}${late ? `<br>……寝たの${esc(s2.bed)}。遅い` : ''}</p>
        <div class="sr-act"><button class="dl-btn" data-n>つぎへ</button></div>`;
      const nb = box.querySelector('[data-n]'); if (nb) nb.onclick = () => { haptic(); next(); };
      bindInput();
    };
    const inputHTML = () => {
      const now = new Date(), m = Math.floor(now.getMinutes() / 5) * 5, wake = `${p2(now.getHours())}:${p2(m)}`;
      return `<p class="sr-q"><b>乃亜</b>……おはよ。ゆうべ、何時に寝たの</p>
        <div class="sr-chips">${['23:00', '00:00', '01:00', '02:00', '03:00'].map(t => `<button data-bed="${t}">${t === '00:00' ? '0:00' : t.replace(/^0/, '')}</button>`).join('')}</div>
        <div class="sr-in"><label>寝た<input type="time" id="srBed" value=""></label><label>起きた<input type="time" id="srWake" value="${hr() < 12 ? wake : '07:30'}"></label></div>
        <div class="sr-act"><button class="dl-btn sub" data-skipin>あとで</button><button class="dl-btn" data-save>記録する</button></div>`;
    };
    const bindInput = () => {
      box.querySelectorAll('[data-bed]').forEach(b => b.onclick = () => { haptic(); $('srBed').value = b.dataset.bed; box.querySelectorAll('[data-bed]').forEach(x => x.classList.toggle('on', x === b)); });
      const sv = box.querySelector('[data-save]'); if (sv) sv.onclick = async () => {
        const bed = $('srBed').value, wake = $('srWake').value; if (!bed || !wake) return toast('寝た時刻を選んでね');
        await Life.setDay(today(), { sleep:{ bed, wake } }); Wipe.slash(); Sfx.play('ok'); Cast.note('noa'); draw();
      };
      const sk = box.querySelector('[data-skipin]'); if (sk) sk.onclick = () => { haptic(); next(); };
    };
    box.innerHTML = `<div class="sr"><img class="sr-bg" src="nurse_normal.webp" alt=""><div class="sr-shade"></div>
      <div class="dl-hd"><em>SLEEP REPORT</em><b>睡眠レポート</b><span>担当：乃亜</span></div>
      <div class="sr-panel"></div></div>`;
    draw();
  }

  // ② ミカの天気
  function weatherCard(box, w, next) {
    if (!w) {
      box.innerHTML = `<div class="wx"><div class="wx-bg"></div><div class="wx-top"><div><em>WEATHER</em><b>今日の天気</b></div></div>
        <div class="wx-bubble" style="top:120px;bottom:auto"><b>MIKA</b>ごめんね先生、いま天気が取れなかったの……。電波のいいところで、また見てみて☆</div>
        <img class="wx-mika" src="wx_shirt_w.webp" alt=""><div class="wx-desk"><i class="tp"></i><i class="fr"></i><div class="lbl">MORNING WEATHER</div><button class="wx-go">つぎへ</button></div></div>`;
      box.querySelector('.wx-go').onclick = () => { haptic(); next(); };
      return;
    }
    Wx.render(box, w, { btn:'つぎへ', onBtn:next });
  }

  // ③ ホシノのモーニングコール
  async function callLines() {
    const t = today(), L = [];
    L.push(['もしもし〜、先生？ おはよ〜……ふぁ〜あ', 's']);
    const evs = (await DB.all('events').catch(() => [])).filter(e => e.date === t).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    if (evs.length) L.push([`今日は${evs.slice(0, 2).map(e => `${e.time ? e.time + 'から' : ''}「${e.title}」`).join('と、')}があるよ〜${evs.length > 2 ? `。ほかにも${evs.length - 2}件` : ''}`, 's']);
    else L.push(['今日は、予定は入ってないみたい〜。のんびりいけるね〜', 's']);
    const todos = (await DB.all('todos').catch(() => [])).filter(x => !x.done && x.list === 'do');
    const late = todos.filter(x => x.due && x.due < t), due = todos.filter(x => x.due === t);
    if (late.length) L.push([`やることは${late.length + due.length}件。期限切れの「${late[0].title}」から、片付けよっか〜`, 's']);
    else if (due.length) L.push([`今日が期限のやることが${due.length}件あるよ〜。「${due[0].title}」とかね〜`, 's']);
    else L.push(['期限がきてるやることは、なし〜。えらいね、先生〜', 's']);
    try {
      const m = typeof Office !== 'undefined' ? await Office.summary() : null, pd = m && m['給料日まで1日あたり'];
      if (typeof pd === 'number') L.push([pd < 300 ? `お金は……給料日まで1日${Math.max(0, pd)}円。ちょっと、がまんの日だね〜` : `お金は、給料日まで1日${pd.toLocaleString()}円まで使えるよ〜`, 's']);
    } catch (e) {}
    const wb = await Wx.brief().catch(() => null);
    if (wb && wb.umbrella) L.push(['あと、傘ね〜。ミカちゃんも言ってたでしょ〜', 's']);
    L.push([hr() < 12 ? 'じゃあ、いってらっしゃい、先生〜。おじさんも、もうちょっとだけ寝よっかな〜' : 'じゃあ、今日もほどほどにね、先生〜。おじさんはいつでも秘書室にいるよ〜', 'm']);
    return L;
  }
  async function callCard(box) {
    const L = await callLines();
    LS.set('ys-call', JSON.stringify({ date:today(), lines:L }));
    box.innerHTML = `<div class="call ring"><div class="cl-bg"></div>
      <div class="cl-in"><div class="cl-top"><small>MORNING CALL</small><b>ホシノ</b><span class="cl-st">着信中…</span></div>
        <div class="cl-av"><i></i><i></i><img src="av_hoshino.webp" alt=""></div>
        <div class="cl-btns"><button class="cl-no" aria-label="あとで">${PH.down}<small>あとで</small></button><button class="cl-yes" aria-label="出る">${PH.up}<small>出る</small></button></div></div>
      <div class="cl-talk"><img class="cl-pt s" src="call_hoshino_s.webp" alt=""><img class="cl-pt m" src="call_hoshino_m.webp" alt="">
        <div class="cl-top2"><b>ホシノ</b><span class="cl-tm">00:00</span></div>
        <div class="cl-sub"><p></p><i class="nx"></i></div>
        <button class="cl-end" aria-label="切る">${PH.down}</button></div></div>`;
    const root = box.querySelector('.call');
    root.querySelector('.cl-no').onclick = e => { e.stopPropagation(); haptic(); stopRing(); finish('morning'); };
    root.querySelector('.cl-yes').onclick = e => { e.stopPropagation(); haptic(); answer(root, L); };
    root._end = () => finish('morning');
    root.querySelector('.cl-end').onclick = e => { e.stopPropagation(); haptic(); stopRing(); root._end(); };
  }
  const PH = {
    up:'<svg viewBox="0 0 24 24"><path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>',
    down:'<svg viewBox="0 0 24 24"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1a1 1 0 0 1-.56.9 11.5 11.5 0 0 0-2.66 1.85 1 1 0 0 1-1.41 0L.29 13.08a1 1 0 0 1 0-1.41A16.9 16.9 0 0 1 12 7c4.57 0 8.72 1.8 11.71 4.67a1 1 0 0 1 0 1.41l-2.48 2.48a1 1 0 0 1-1.41 0 11.3 11.3 0 0 0-2.67-1.85 1 1 0 0 1-.56-.9v-3.1A15 15 0 0 0 12 9z"/></svg>',
  };
  let ringT = 0;
  function ring(box) {
    const root = box.querySelector('.call.ring'); if (!root) return;
    clearInterval(ringT);
    const buzz = () => { if (!ov || !root.classList.contains('ring')) return clearInterval(ringT); Sfx.play('msg'); setTimeout(() => Sfx.play('msg'), 180); haptic(); };
    buzz(); ringT = setInterval(buzz, 1600);
  }
  const stopRing = () => clearInterval(ringT);
  async function answer(root, L) {
    stopRing(); root.classList.remove('ring'); root.classList.add('talk');
    Cast.note('hoshino'); Sfx.play('ok');
    try { playVoice('hoshino'); } catch (e) {}
    const t0 = Date.now(), tm = root.querySelector('.cl-tm');
    const tick = setInterval(() => { if (!ov) return clearInterval(tick); const s = Math.floor((Date.now() - t0) / 1000); tm.textContent = `${p2(Math.floor(s / 60))}:${p2(s % 60)}`; }, 500);
    const p = root.querySelector('.cl-sub p'); let i = 0, typing = 0;
    const show = () => {
      const [text, face] = L[i]; root.classList.toggle('smile', face === 'm');
      clearInterval(typing); p.textContent = ''; let k = 0; p._full = text;
      typing = setInterval(() => { k += 2; p.textContent = text.slice(0, k); if (k >= text.length) { clearInterval(typing); typing = 0; } }, 34);
      root.classList.toggle('last', i === L.length - 1);
    };
    root.querySelector('.cl-sub').onclick = () => {
      if (typing) { clearInterval(typing); typing = 0; p.textContent = p._full; return; }
      if (i < L.length - 1) { i++; Sfx.play('msg'); show(); } else { clearInterval(tick); root._end(); }
    };
    show();
  }
  // 秘書室から：朝の電話を聞き直す
  async function replayCall() {
    let c = null; try { c = JSON.parse(LS.get('ys-call') || 'null'); } catch (e) {}
    const L = c && c.date === today() ? c.lines : await callLines();
    if (ov) return;
    frame('replay'); ov.querySelector('.dl-skip').textContent = 'CLOSE';
    ov.querySelector('.dl-skip').onclick = e => { e.stopPropagation(); haptic(); Wipe.mid(() => close()); };
    const tr = ov.querySelector('.dl-track'); tr.innerHTML = '<section class="dl-card"></section>';
    const box = tr.firstChild; await callCard(box);
    const root = box.querySelector('.call');
    root._end = () => Wipe.mid(() => close());
    answer(root, L);
  }
  // ===== 夜 =====
  async function night() {
    busy = true;
    frame('night');
    const c = cards([
      { draw:(box, next) => recordCard(box, next), enter:() => Cast.note('noa') },
      { draw:(box) => scratchCard(box) },
    ]);
  }
  const MOOD = [[1, 'しんどい', '#8fa3c9'], [2, 'いまいち', '#a7b8e0'], [3, 'ふつう', '#c7c2e6'], [4, 'いい', '#ffb3cf'], [5, 'さいこう', '#ff7fb0']];
  const FACE_SVG = v => {
    const m = { 1:'M8 17q4-3 8 0', 2:'M8 16.5q4-1.5 8 0', 3:'M8 16h8', 4:'M8 15q4 3 8 0', 5:'M7.5 14.5q4.5 4.5 9 0' }[v];
    return `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="9" cy="10" r="1.2" class="e"/><circle cx="15" cy="10" r="1.2" class="e"/><path d="${m}"/></svg>`;
  };
  async function recordCard(box, next) {
    const d = nightDay();
    const draw = async () => {
      const td = await Life.day(d), f = await Life.food(d), sh = Life.sleepH(td.sleep);
      const meals = Object.entries(f.meals || {}), nm = meals.filter(([, m]) => m.st !== 'skip').length;
      const jl = Cast.jealousLine();
      const say = jl && !td.mood ? jl
        : !td.mood ? '……おつかれ。今日のこと、ちょっとだけ教えて'
        : td.mood <= 2 ? '……そっか。しんどい日もあるよ。今日はもう寝な'
        : (td.drink || 0) >= 3 ? `……${td.drink}缶。飲みすぎ。お水飲んでから寝て`
        : nm < 2 ? 'ご飯、ちゃんと食べてないでしょ。……明日は朝なにか食べて'
        : td.mood >= 4 ? '……ふーん。いい日だったんだ。よかったじゃん' : 'ん。今日もおつかれ。……えらいよ';
      box.innerHTML = `<div class="nr"><div class="nr-bg"></div><img class="nr-noa" src="night_noa.webp" alt="">
        <div class="dl-hd"><em>NIGHT RECORD</em><b>今日の記録</b><span>${D.md(d)}（${D.dow(d)}）・担当：乃亜</span></div>
        <div class="nr-say"><b>乃亜</b>${esc(say)}</div>
        <div class="nr-panel">
          <div class="nr-row"><small>気分</small><div class="nr-mood">${MOOD.map(([v, n, c]) => `<button data-md="${v}" class="${+td.mood === v ? 'on' : ''}" style="--c:${c}">${FACE_SVG(v)}<span>${n}</span></button>`).join('')}</div></div>
          <div class="nr-row two"><div><small>睡眠（ゆうべ）</small><b>${sh != null ? sh + '<i>h</i>' : '<em>未記録</em>'}</b></div><div><small>ご飯</small><b>${nm}<i>/3回</i></b></div></div>
          <div class="nr-row two"><div class="cnt"><small>お酒</small><button data-c="drink" data-v="-1">−</button><b>${td.drink || 0}<i>缶</i></b><button data-c="drink" data-v="1">＋</button></div>
            <div class="cnt"><small>タバコ</small><button data-c="smoke" data-v="-1">−</button><b>${td.smoke || 0}<i>本</i></b><button data-c="smoke" data-v="1">＋</button></div></div>
          <div class="sr-act"><button class="dl-btn" data-n ${td.mood ? '' : 'disabled'}>${td.mood ? 'スクラッチへ' : '気分を選んでね'}</button></div>
        </div></div>`;
      box.querySelectorAll('[data-md]').forEach(b => b.onclick = async () => { haptic(); await Life.setDay(d, { mood:+b.dataset.md }); Wipe.slash(); draw(); });
      box.querySelectorAll('[data-c]').forEach(b => b.onclick = async () => { haptic(); await Life.count(b.dataset.c, +b.dataset.v, d); draw(); });
      const nb = box.querySelector('[data-n]'); if (nb) nb.onclick = () => { if (nb.disabled) return; haptic(); next(); };
    };
    draw();
  }
  // スクラッチ：銀色を指でけずる。半分以上けずれたら景品
  async function scratchCard(box) {
    const prize = typeof Progress !== 'undefined' ? await Progress.drawPrize() : { kind:'msg', title:'おつかれさま', sub:'今日もよくがんばりました' };
    box.innerHTML = `<div class="scr"><div class="scr-bg"></div>
      <div class="dl-hd"><em>DAILY SCRATCH</em><b>今日のスクラッチ</b><span>指でけずってね</span></div>
      <div class="scr-card"><div class="scr-prize"><small>${esc(prize.label || 'PRIZE')}</small><b>${esc(prize.title)}</b><span>${esc(prize.sub || '')}</span></div><canvas></canvas><i class="scr-hint">SCRATCH</i></div>
      <div class="sr-act scr-act"><button class="dl-btn" data-end disabled>おやすみ</button></div></div>`;
    const card = box.querySelector('.scr-card'), cv = card.querySelector('canvas'), g = cv.getContext('2d');
    const fit = () => {
      const r = card.getBoundingClientRect(); if (!r.width) return;
      cv.width = r.width * devicePixelRatio; cv.height = r.height * devicePixelRatio; cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px';
      g.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      const gr = g.createLinearGradient(0, 0, r.width, r.height); gr.addColorStop(0, '#d9dde6'); gr.addColorStop(.45, '#f6f7fb'); gr.addColorStop(.55, '#c9ced9'); gr.addColorStop(1, '#e8eaf0');
      g.fillStyle = gr; g.fillRect(0, 0, r.width, r.height);
      g.fillStyle = 'rgba(120,130,160,.35)'; g.font = "italic 700 22px Barlow, sans-serif"; g.textAlign = 'center';
      for (let y = 26; y < r.height; y += 40) for (let x = (y / 40 % 2) * 50; x < r.width + 60; x += 100) g.fillText('YS', x, y);
      g.globalCompositeOperation = 'destination-out';
    };
    requestAnimationFrame(fit);
    let done = false, last = null;
    const scr = (x, y) => {
      const r = cv.getBoundingClientRect(), px = x - r.left, py = y - r.top;
      g.lineWidth = 46; g.lineCap = 'round'; g.beginPath();
      if (last) g.moveTo(last[0], last[1]); else g.moveTo(px - .1, py);
      g.lineTo(px, py); g.stroke(); last = [px, py];
    };
    const ratio = () => { const d = g.getImageData(0, 0, cv.width, cv.height).data; let n = 0, k = 0; for (let i = 3; i < d.length; i += 64) { k++; if (d[i] === 0) n++; } return n / k; };
    cv.addEventListener('pointerdown', e => { e.preventDefault(); last = null; scr(e.clientX, e.clientY); card.querySelector('.scr-hint').classList.add('gone'); try { cv.setPointerCapture(e.pointerId); } catch (er) {} });
    cv.addEventListener('pointermove', e => { if (e.buttons === 0 && e.pointerType === 'mouse') return; scr(e.clientX, e.clientY); if (Math.random() < .12) Sfx.play('soft'); });
    cv.addEventListener('pointerup', async () => {
      last = null; if (done || ratio() < .5) return;
      done = true; cv.classList.add('clear'); Sfx.play('done'); haptic(); Wipe.slash();
      if (typeof Progress !== 'undefined') await Progress.givePrize(prize);
      box.querySelector('.scr-card').classList.add('won');
      const b = box.querySelector('[data-end]'); b.disabled = false;
    });
    box.querySelector('[data-end]').onclick = () => { haptic(); finish('night'); };
  }

  function init() {
    document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(check, 900); });
    setInterval(check, 5 * 60e3);   // 開きっぱなしで22時をまたいだとき
  }
  return { init, check, replayCall, again:k => { LS.set('ys-force', k); return check(); } };
})();
App.modules.push(Daily);
