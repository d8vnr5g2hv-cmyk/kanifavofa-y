// Yohei Support — 保健室（乃亜）：からだ・こころ・カルテ
'use strict';
const Clinic = (() => {
  const FACE = { normal:'nurse_normal.webp', smile:'nurse_normal.webp', happy:'nurse_happy.webp', shy:'nurse_happy.webp', fluster:'nurse_worry.webp', worry:'nurse_worry.webp', sad:'nurse_sad.webp', surprise:'nurse_surprise.webp', pout:'nurse_pout.webp', think:'nurse_think.webp' };
  // パネルのデフォルメ：表情に合わせて替える
  const CHIBI = { normal:'hug', smile:'peace', happy:'open', shy:'hug', fluster:'sweat', worry:'sweat', sad:'sweat', surprise:'what', pout:'what', think:'what' };
  const COND = [['1', 'つらい', '#ff8a9a'], ['2', 'いまいち', '#ffb38a'], ['3', 'ふつう', '#c9c9d6'], ['4', 'いい', '#8fd6b4'], ['5', 'すごくいい', '#5cc8a8']];
  const K6 = ['神経過敏に感じましたか', '絶望的だと感じましたか', 'そわそわ、落ち着かなく感じましたか', '気分が沈み込んで、何が起こっても気が晴れないように感じましたか', '何をするのも骨折りだと感じましたか', '自分は価値のない人間だと感じましたか'];
  const K6A = ['全くない', '少しだけ', 'ときどき', 'たいてい', 'いつも'];
  // 職業性ストレス簡易調査票（23項目）
  const BJ = [
    ['A', '非常にたくさんの仕事をしなければならない', 0], ['A', '時間内に仕事が処理しきれない', 0], ['A', '一生懸命働かなければならない', 0],
    ['A', '自分のペースで仕事ができる', 1], ['A', '自分で仕事の順番・やり方を決めることができる', 1], ['A', '職場の仕事の方針に自分の意見を反映できる', 1],
    ['B', 'ひどく疲れた', 0], ['B', 'へとへとだ', 0], ['B', 'だるい', 0], ['B', '気がはりつめている', 0], ['B', '不安だ', 0], ['B', '落着かない', 0],
    ['B', 'ゆううつだ', 0], ['B', '何をするのも面倒だ', 0], ['B', '気分が晴れない', 0], ['B', '食欲がない', 0], ['B', 'よく眠れない', 0],
    ['C', '上司と、どのくらい気軽に話ができますか', 1], ['C', '職場の同僚と、どのくらい気軽に話ができますか', 1], ['C', '困った時、上司はどのくらい頼りになりますか', 1],
    ['C', '困った時、職場の同僚はどのくらい頼りになりますか', 1], ['C', '個人的な問題を相談したら、上司はどのくらいきいてくれますか', 1], ['C', '個人的な問題を相談したら、職場の同僚はどのくらいきいてくれますか', 1],
  ];
  const BJA = { A:['そうだ', 'まあそうだ', 'ややちがう', 'ちがう'], B:['ほとんどなかった', 'ときどきあった', 'しばしばあった', 'ほとんどいつもあった'], C:['非常に', 'かなり', '多少', '全くない'] };
  const HELP = 'こころの健康相談統一ダイヤル 0570-064-556';
  let blinkT = 0;

  // ===== 表情とまばたき =====
  // 昼休み（12〜13時）と夜（22時〜5時）は、白衣で休憩中の乃亜
  const resting = () => { const h = new Date().getHours(); return h === 12 || h >= 22 || h < 5; };
  function sceneEnter() {
    const pg = $('page-sc_clinic'), nb = pg.querySelector('.nb'), r = resting();
    pg.classList.toggle('rest', r); nb.src = r ? 'noa_rest.webp' : 'nurse_normal.webp'; face(null);
  }
  function face(f) {
    const nf = document.querySelector('#page-sc_clinic .nf');
    if (nf && resting()) { nf.classList.remove('on'); f = f || null; }
    else if (nf) { if (!f || f === 'normal' || f === 'smile') nf.classList.remove('on'); else { nf.src = FACE[f] || FACE.normal; nf.classList.add('on'); } }
    const c = 'noa_c_' + (f ? CHIBI[f] || 'hug' : idleChibi()) + '.webp';
    document.querySelectorAll('.clinicp .noac').forEach(i => { if (!i.src.endsWith(c)) { i.classList.remove('pop'); void i.offsetWidth; i.src = c; i.classList.add('pop'); } });
  }
  const idleChibi = () => { const h = new Date().getHours(); return h >= 23 || h < 5 ? 'sleep' : 'hug'; };
  function blinkLoop() {}

  // ===== からだ =====
  async function body() {
    const box = $('bodyList'), t = D.today(), td = await Life.day(), ws = await Life.days(7), f = await Life.food(t);
    const sh = Life.sleepH(td.sleep), s = td.sleep || {};
    const mx = 9, bars = ws.map(x => { const v = Life.sleepH(x.sleep); return `<div><i style="height:${v ? Math.min(100, v / mx * 100) : 0}%" class="${v && v < 6 ? 'lo' : ''}"></i><span>${D.dow(x.date)}</span></div>`; }).join('');
    const rx = await Life.getS('ys-rx-' + t, null);
    $('bodyHead').innerHTML = `<div class="kh"><b>問診票</b><span>${D.ymd(t)}（${D.dow(t)}）</span></div>`;
    box.innerHTML = `
      <div class="kc"><h6>ゆうべの睡眠<em>${sh != null ? `${sh}時間` : '未記入'}</em></h6>
        <div class="ksl"><label>寝た<input type="time" id="kBed" value="${s.bed || ''}"></label><label>起きた<input type="time" id="kWake" value="${s.wake || ''}"></label><button data-x="sleep">記入</button></div>
        <div class="kq"><button data-sl="01:00">1時に寝た</button><button data-sl="02:00">2時に寝た</button><button data-sl="00:00">0時に寝た</button></div>
        <div class="kbars">${bars}</div></div>
      <div class="kc"><h6>今日の体調</h6><div class="kcond">${COND.map(([v, n, c]) => `<button data-cd="${v}" class="${+td.cond === +v ? 'on' : ''}" style="--c:${c}"><i></i>${n}</button>`).join('')}</div></div>
      <div class="kc"><h6>今日の記録<em>ミカのページから</em></h6>
        <div class="ksum"><div><small>食事</small><b>${Object.keys(f.meals || {}).length}<span>/4</span></b></div><div><small>お酒</small><b>${td.drink || 0}<span>缶</span></b></div><div><small>タバコ</small><b>${td.smoke || 0}<span>本</span></b></div><div><small>体重</small><b>${td.weight || '—'}<span>${td.weight ? 'kg' : ''}</span></b></div></div>
        <div class="kwt"><input id="kWt" inputmode="decimal" placeholder="体重（kg）" value="${td.weight || ''}"><button data-x="wt">記入</button></div></div>
      <div class="kc rx"><h6>処方箋<button class="ylink" data-x="rx">${rx ? '書き直してもらう' : '乃亜に書いてもらう'}</button></h6>
        ${rx ? `<div class="krx">${rx.lines.map(l => `<p>${esc(l)}</p>`).join('')}<i class="kst">乃亜</i></div>` : '<p class="mu">睡眠・食事・お酒・タバコ・ストレスを見て、今日のおすすめを書いてくれます</p>'}</div>`;
  }
  async function bodyClick(e) {
    const b = e.target.closest('button'); if (!b) return; haptic();
    const t = D.today();
    if (b.dataset.sl) { $('kBed').value = b.dataset.sl; if (!$('kWake').value) $('kWake').value = '07:45'; return; }
    if (b.dataset.x === 'sleep') { const bed = $('kBed').value, wake = $('kWake').value; if (!bed || !wake) return toast('寝た時刻と起きた時刻を入れてね'); await Life.setDay(t, { sleep:{ bed, wake } }); const h = Life.sleepH({ bed, wake }); body(); return react(h < 6 ? ['……' + h + '時間しか寝てないの？', '今日は早めに布団に入ってね。約束だよ'] : ['うん、' + h + '時間。ちゃんと寝られたね'], h < 6 ? 'worry' : 'smile'); }
    if (b.dataset.cd) { await Life.setDay(t, { cond:+b.dataset.cd }); body(); return react(+b.dataset.cd <= 2 ? ['しんどいんだね……無理しないで。何かあったら、すぐ言ってね'] : ['よかった。その調子だよ'], +b.dataset.cd <= 2 ? 'worry' : 'smile'); }
    if (b.dataset.x === 'wt') { const v = parseFloat($('kWt').value); if (!v || v < 30) return toast('体重を数字で入れてね'); await Life.setDay(t, { weight:v }); const bd = await Life.getS('ys-body', { id:'ys-body', w:90, h:177, age:25, act:1.4, cut:true }); bd.id = 'ys-body'; bd.w = v; await Life.putS(bd); toast('記入しました'); return body(); }
    if (b.dataset.x === 'rx') return writeRx();
  }
  async function react(lines, f) { await Talk.say('noa', lines, f); Talk.close(); }
  async function writeRx() {
    const t = D.today(), snap = await Life.snapshot();
    let lines = null;
    if (await Api.load()) { Talk.open('noa', { onFace:face }); Talk.think('処方箋を書いてるね……'); try { const r = await Api.call('rx', { now:Api.now(), snap }); lines = r.lines; } catch (e) {} }
    if (!lines || !lines.length) {   // 手元のルール
      const td = await Life.day(), y = await Life.day(D.add(t, -1)), sh = Life.sleepH(td.sleep || y.sleep); lines = [];
      if (sh != null && sh < 6) lines.push('睡眠：今夜は24時までに布団へ。スマホは枕元に置かない');
      if ((td.drink || 0) >= 3) lines.push('お酒：今日はもうおしまい。お水をコップ1杯');
      if ((td.smoke || 0) >= 15) lines.push('タバコ：次の1本は、10分だけ待ってみる');
      if (!Object.keys((await Life.food(t)).meals || {}).length) lines.push('食事：何か1品でもいいから、ちゃんと食べる');
      lines.push('おまけ：寝る前に、乃亜に一言だけ報告すること');
    }
    await Life.putS({ id:'ys-rx-' + t, lines:lines.slice(0, 6) });
    if (tab === 'body') body();
    await Talk.say('noa', ['はい、処方箋。ちゃんと守ってね？'], 'smile'); Talk.close();
  }

  // ===== こころ =====
  async function mind() {
    const box = $('mindList'), t = D.today(), td = await Life.day(), c = await Life.checks();
    const k6 = c.k6[Life.k6Key(t)], bj = c.bj[Life.bjKey(t)];
    $('mindHead').innerHTML = `<div class="kh"><b>こころの問診</b><span>いつでもできます</span></div>`;
    box.innerHTML = `
      <div class="kc"><h6>今日の3問<em>毎日</em></h6>${td.chk ? `<div class="k3">${['気分', '疲れ', '眠気'].map((n, i) => `<div><small>${n}</small><b>${td.chk[i]}</b><span>/4</span></div>`).join('')}</div>` : '<p class="mu">乃亜が3つだけ聞きます。1分で終わるよ</p>'}<button class="kbtn" data-x="daily">${td.chk ? 'もう一度' : '乃亜と3問'}</button></div>
      <div class="kc"><h6>K6<em>週に1回・6問</em></h6>${k6 != null ? `<div class="kres ${k6 >= 13 ? 'hi' : k6 >= 10 ? 'mid' : ''}"><b>${k6}</b><span>/24点　${k6 >= 13 ? '高い' : k6 >= 10 ? 'やや高い' : k6 >= 5 ? '少しあり' : '低い'}</span></div>` : '<p class="mu">この1か月の気持ちについて、6つの質問に答えます</p>'}<button class="kbtn" data-x="k6">${k6 != null ? 'やり直す' : '始める'}</button></div>
      <div class="kc"><h6>職業性ストレス簡易調査<em>月に1回・23問</em></h6>${bj ? `<div class="kres ${bj.high ? 'hi' : ''}"><b>${bj.high ? '高ストレス' : '問題なし'}</b><span>反応 ${bj.b}点／要因＋支援 ${bj.ac}点</span></div>` : '<p class="mu">仕事のストレスを、国の基準でチェックします</p>'}<button class="kbtn" data-x="bj">${bj ? 'やり直す' : '始める'}</button></div>
      <div class="kc"><h6>ひと休み</h6><div class="krow"><button class="kbtn" data-x="breath">1分の呼吸</button><button class="kbtn" data-x="talk">乃亜に話を聞いてもらう</button></div></div>
      ${(k6 != null && k6 >= 10) || (bj && bj.high) ? `<div class="kc help"><p>つらい状態が続くときは、ひとりで抱えずに相談してね。</p><b>${HELP}</b></div>` : ''}`;
  }
  async function daily() {
    const qs = [['今日の気分はどう？', ['いい', 'まあまあ', 'ふつう', 'いまいち', 'しんどい']], ['疲れはどのくらい？', ['ない', '少し', 'ふつう', 'けっこう', 'へとへと']], ['ゆうべは眠れた？', ['ぐっすり', 'まあまあ', 'ふつう', 'あまり', '全然']]];
    Talk.open('noa', { onFace:face }); const ans = [];
    for (const [q, o] of qs) { const v = await Talk.choose('noa', q, o.map((l, i) => ({ label:l, v:i }))); ans.push(v); }
    await Life.setDay(D.today(), { chk:ans });
    const s = ans.reduce((a, b) => a + b, 0);
    await Talk.say('noa', s >= 9 ? ['……けっこうしんどそう。今日はがんばらなくていいよ', '話したくなったら、いつでもここに来て'] : s >= 5 ? ['ちょっと疲れてるね。今夜は早めに休もう'] : ['うん、元気そうでよかった'], s >= 9 ? 'worry' : 'smile');
    Talk.close(); mind();
  }
  // 質問用紙（カルテ風のシート）
  function paper(title, items, answers, done) {
    const ov = h(`<div class="kpaper"><div class="kpi"><div class="kph"><b>${title}</b><button class="x">×</button></div><div class="kpb">${items.map(([q, a], i) => `<div class="kpq" data-i="${i}"><p><i>${i + 1}</i>${esc(q)}</p><div>${a.map((l, j) => `<button data-v="${j}">${l}</button>`).join('')}</div></div>`).join('')}</div><button class="kgo" disabled>回答する</button></div></div>`);
    document.body.appendChild(ov); requestAnimationFrame(() => ov.classList.add('on'));
    const res = Array(items.length).fill(null);
    ov.addEventListener('click', e => {
      if (e.target.closest('.x')) return close();
      const b = e.target.closest('[data-v]'); if (b) { haptic(); const q = b.closest('.kpq'), i = +q.dataset.i; res[i] = +b.dataset.v; q.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); q.classList.add('ok'); ov.querySelector('.kgo').disabled = res.some(v => v == null); const n = q.nextElementSibling; if (n && res[i + 1] == null) n.scrollIntoView({ behavior:'smooth', block:'center' }); return; }
      if (e.target.closest('.kgo')) { close(); done(res); }
    });
    function close() { ov.classList.remove('on'); setTimeout(() => ov.remove(), 300); }
  }
  async function doK6() {
    paper('K6（この30日の気持ち）', K6.map(q => [q, K6A]), null, async r => {
      const v = r.reduce((a, b) => a + b, 0); await Life.saveCheck('k6', Life.k6Key(D.today()), v); mind();
      await Talk.say('noa', v >= 13 ? ['……正直に答えてくれてありがとう。点数、高めだよ', 'ひとりで抱えこまないでね。' + HELP + ' にも相談できるよ'] : v >= 10 ? ['少し、こころが疲れてるみたい', '今週は、やることを減らそう。ホシノにも伝えておくね'] : ['うん、大丈夫そう。でも無理はしないでね'], v >= 10 ? 'worry' : 'smile');
      Talk.close();
    });
  }
  async function doBJ() {
    paper('職業性ストレス簡易調査（23問）', BJ.map(([g, q]) => [q, BJA[g]]), null, async r => {
      // 点数：1〜4。高いほどストレスが高い向きにそろえる
      const sc = BJ.map(([g, , rev], i) => { const v = r[i] + 1; return g === 'A' ? (rev ? v : 5 - v) : g === 'B' ? v : v; });
      const a = sc.slice(0, 6).reduce((x, y) => x + y, 0), b = sc.slice(6, 17).reduce((x, y) => x + y, 0), c = sc.slice(17).reduce((x, y) => x + y, 0);
      const high = b >= 31 || (b >= 23 && a + c >= 39);
      await Life.saveCheck('bj', Life.bjKey(D.today()), { a, b, c, ac:a + c, high, at:D.today() }); mind();
      await Talk.say('noa', high ? ['結果は「高ストレス」だったよ', 'お医者さんに相談するのも、ちゃんとした選択肢だからね', HELP] : ['結果は「問題なし」。よかった', 'でも、しんどい日はちゃんと言ってね'], high ? 'worry' : 'smile');
      Talk.close();
    });
  }
  function breath() {
    const ov = h('<div class="kbreath"><div class="kbc"><i></i><b>吸って</b></div><p>4秒吸って、7秒止めて、8秒はく</p><button>おわる</button></div>');
    document.body.appendChild(ov); requestAnimationFrame(() => ov.classList.add('on'));
    const c = ov.querySelector('.kbc'), tx = c.querySelector('b'); let alive = true, n = 0;
    const cyc = async () => { while (alive && n++ < 4) { tx.textContent = '吸って'; c.className = 'kbc in'; await sleep(4000); if (!alive) break; tx.textContent = '止めて'; c.className = 'kbc hold'; await sleep(7000); if (!alive) break; tx.textContent = 'はいて'; c.className = 'kbc out'; await sleep(8000); } if (alive) end(); };
    const end = () => { alive = false; ov.classList.remove('on'); setTimeout(() => ov.remove(), 300); };
    ov.querySelector('button').onclick = end; cyc();
  }
  async function mindClick(e) {
    const b = e.target.closest('button'); if (!b) return; haptic();
    const x = b.dataset.x;
    if (x === 'daily') return daily(); if (x === 'k6') return doK6(); if (x === 'bj') return doBJ(); if (x === 'breath') return breath();
    if (x === 'talk') return Talk.chat('noa', { first:'うん、聞くよ。なんでも話して', onFace:face });
  }

  // ===== カルテ =====
  async function karte() {
    const box = $('karteList'), ds = await Life.days(14), c = await Life.checks(), t = D.today();
    const weeks = Array.from({ length:8 }, (_, i) => Life.k6Key(D.add(t, -7 * (7 - i))));
    const avg = k => { const v = ds.map(k).filter(x => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10 : null; };
    const sl = avg(d => Life.sleepH(d.sleep)), dr = avg(d => d.drink), sm = avg(d => d.smoke), cd = avg(d => d.cond);
    const find = [];
    if (sl != null) find.push(sl < 6 ? `平均睡眠${sl}時間。睡眠不足の傾向あり` : `平均睡眠${sl}時間`);
    if (dr != null) find.push(`お酒 1日平均${dr}缶${dr >= 2 ? '（多め）' : ''}`);
    if (sm != null) find.push(`タバコ 1日平均${sm}本`);
    if (cd != null) find.push(`体調の平均 ${cd}/5`);
    const lastK = weeks.map(w => c.k6[w]).filter(v => v != null).pop();
    if (lastK != null) find.push(`K6 ${lastK}点${lastK >= 10 ? '（要観察）' : ''}`);
    const me = await Life.me();
    $('karteHead').innerHTML = `<div class="kh"><b>カルテ</b><span>患者：${esc(me.name || 'ようへい')}　担当：乃亜</span></div>`;
    box.innerHTML = `
      <div class="kc kt"><table><tr><th></th><th>睡眠</th><th>体調</th><th>酒</th><th>煙</th><th>3問</th></tr>
        ${ds.slice().reverse().map(d => { const h = Life.sleepH(d.sleep); return `<tr><td>${D.md(d.date)}<small>${D.dow(d.date)}</small></td><td class="${h != null && h < 6 ? 'r' : ''}">${h ?? '·'}</td><td>${d.cond || '·'}</td><td>${d.drink ?? '·'}</td><td>${d.smoke ?? '·'}</td><td>${d.chk ? d.chk.reduce((a, b) => a + b, 0) : '·'}</td></tr>`; }).join('')}</table></div>
      <div class="kc"><h6>K6の推移<em>8週</em></h6><div class="kk6">${weeks.map(w => { const v = c.k6[w]; return `<div><i style="height:${v != null ? Math.max(4, v / 24 * 100) : 0}%" class="${v >= 13 ? 'hi' : v >= 10 ? 'mid' : ''}"></i><span>${D.md(w)}</span></div>`; }).join('')}<u style="bottom:${10 / 24 * 100}%"></u></div></div>
      <div class="kc kf"><h6>所見</h6>${find.length ? find.map(f => `<p>${esc(f)}</p>`).join('') : '<p>記録が増えると、ここに所見を書きます</p>'}<i class="kst">乃亜</i></div>`;
  }

  function init() {
    $('bodyList').addEventListener('click', bodyClick); $('mindList').addEventListener('click', mindClick);
    const enter = f => () => { f(); face(null); blinkLoop(); };
    TabHooks.body = { enter:enter(body), leave:() => clearTimeout(blinkT) };
    TabHooks.mind = { enter:enter(mind), leave:() => clearTimeout(blinkT) };
    TabHooks.karte = { enter:enter(karte), leave:() => clearTimeout(blinkT) };
    document.querySelectorAll('.clinicp .noac').forEach(i => i.addEventListener('click', () => { haptic(); tapNoa(); }));
  }
  // 乃亜をタップ：ひとこと
  function tapNoa() {
    const hr = new Date().getHours();
    const L = resting() && tab === 'sc_clinic' ? [['……あ、ようへい。今ちょっと休憩中', 'normal'], ['ふぁ……保健室、今日はひまだったよ', 'normal']] : hr >= 23 || hr < 4 ? [['ようへい、もう寝る時間だよ？', 'pout']] : [['どうしたの？ 体調、大丈夫？', 'think'], ['ふふ、来てくれたんだ', 'happy'], ['ちゃんとご飯食べた？', 'surprise'], ['……あんまり見られると、照れるんだけど', 'worry']];
    const [l, f] = L[Math.floor(Math.random() * L.length)]; react([l], f);
  }
  return { init, face, tapNoa, sceneEnter, reload:() => { if (tab === 'body') body(); if (tab === 'mind') mind(); if (tab === 'karte') karte(); } };
})();
App.modules.push(Clinic);
