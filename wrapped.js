// Yohei Support — 月と年のまとめ（スライド）。月初・元日に初めて開いたとき1回だけ。自室のPCからいつでも見返せる
'use strict';
const Wrapped = (() => {
  const MOODC = { 1:'#8fa3c9', 2:'#a7b8e0', 3:'#c7c2e6', 4:'#ffb3cf', 5:'#ff7fb0' };
  const MOODN = { 1:'しんどい', 2:'いまいち', 3:'ふつう', 4:'いい', 5:'さいこう' };
  const lastMonth = () => { const d = D.parse(D.today()); d.setDate(1); d.setMonth(d.getMonth() - 1); return D.key(d).slice(0, 7); };
  const daysOf = m => { const [y, mo] = m.split('-').map(Number), n = new Date(y, mo, 0).getDate(); return Array.from({ length:n }, (_, i) => `${m}-${p2(i + 1)}`); };

  // ===== 集計（月 'YYYY-MM' または 年 'YYYY'） =====
  async function collect(key) {
    const year = key.length === 4, days = year ? Array.from({ length:12 }, (_, i) => daysOf(`${key}-${p2(i + 1)}`)).flat() : daysOf(key);
    const t = D.today(), range = days.filter(d => d < t);
    const room = await DB.all('room').catch(() => []), todos = await DB.all('todos').catch(() => []);
    const map = Object.fromEntries(room.map(r => [r.id, r]));
    const ds = range.map(d => map['day-' + d] || { date:d });
    const sl = ds.map(x => ({ d:x.date, h:Life.sleepH(x.sleep) })).filter(x => x.h != null);
    const avg = sl.length ? Math.round(sl.reduce((a, x) => a + x.h, 0) / sl.length * 10) / 10 : null;
    const best = sl.slice().sort((a, b) => b.h - a.h)[0], worst = sl.slice().sort((a, b) => a.h - b.h)[0];
    const moods = ds.filter(x => x.mood).map(x => ({ d:x.date, v:x.mood }));
    const mc = {}; moods.forEach(m => mc[m.v] = (mc[m.v] || 0) + 1);
    const topMood = Object.entries(mc).sort((a, b) => b[1] - a[1])[0];
    const inR = d => d && range.includes(d);
    const todoN = todos.filter(z => z.done && z.doneAt && inR(D.key(new Date(z.doneAt)))).length;
    const chores = range.reduce((a, d) => a + ((map['act-' + d] || {}).chores || 0), 0);
    const meals = range.reduce((a, d) => a + Object.values((map['food-' + d] || {}).meals || {}).filter(m => m && m.st !== 'skip').length, 0);
    const cash = room.filter(r => r.id.startsWith('cash-') && inR(r.date));
    const spent = cash.filter(e => e.kind !== 'in').reduce((a, e) => a + (+e.amt || 0), 0);
    const byCat = {}; cash.filter(e => e.kind !== 'in').forEach(e => byCat[e.cat] = (byCat[e.cat] || 0) + (+e.amt || 0));
    const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
    const cashDays = new Set(cash.map(e => e.date)).size;
    const talk = {}; range.forEach(d => { try { Object.entries(JSON.parse(LS.get('ys-talk-' + d) || '{}')).forEach(([w, n]) => talk[w] = (talk[w] || 0) + n); } catch (e) {} });
    const topTalk = Object.entries(talk).filter(([w]) => Cast.C[w]).sort((a, b) => b[1] - a[1])[0];
    const focus = range.reduce((a, d) => a + (+LS.get('ys-focus-' + d) || 0), 0);
    const drink = ds.reduce((a, x) => a + (x.drink || 0), 0), smoke = ds.reduce((a, x) => a + (x.smoke || 0), 0);
    const byMonth = year ? Array.from({ length:12 }, (_, i) => { const m = `${key}-${p2(i + 1)}`, s = sl.filter(x => x.d.startsWith(m)); return { m:i + 1, sleep:s.length ? s.reduce((a, x) => a + x.h, 0) / s.length : 0, spent:cash.filter(e => e.date.startsWith(m) && e.kind !== 'in').reduce((a, e) => a + (+e.amt || 0), 0) }; }) : null;
    return { key, year, n:range.length, avg, best, worst, sleepDays:sl.length, moods, topMood, todoN, chores, meals, spent, topCat, cashDays, talk, topTalk, focus, drink, smoke, byMonth };
  }

  // ===== スライド =====
  const yen = n => '¥' + Math.round(n).toLocaleString();
  function slides(s) {
    const label = s.year ? `${s.key}年` : `${+s.key.slice(5, 7)}月`, en = s.year ? 'YOUR YEAR' : ['', 'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'][+s.key.slice(5, 7)];
    const say = (w, t) => `<div class="wr-say"><img src="${Cast.av(w)}" alt=""><p><b>${Cast.name(w)}</b>${esc(t)}</p></div>`;
    const L = [];
    L.push({ c:'c1', html:`<small>YOHEI SUPPORT WRAPPED</small><h1>${label}の<br>まとめ</h1><em>${en}</em>
      <div class="wr-avs">${Cast.ORDER.map((w, i) => `<img src="${Cast.av(w)}" style="--i:${i}" alt="">`).join('')}</div><p class="wr-tap">タップで次へ</p>` });
    L.push({ c:'c2', html:`<small>SLEEP</small><h2>平均睡眠</h2><div class="wr-big"><b>${s.avg ?? '—'}</b><span>時間</span></div>
      <p class="wr-sub">記録した日 ${s.sleepDays}日${s.best ? `<br>いちばん寝た日 ${D.md(s.best.d)}（${s.best.h}時間）` : ''}${s.worst ? `<br>いちばん短かった日 ${D.md(s.worst.d)}（${s.worst.h}時間）` : ''}</p>
      ${say('noa', s.avg == null ? '……記録、ほとんどないじゃん。来月はちゃんと教えて' : s.avg < 6 ? `……平均${s.avg}時間。少ない。来月は24時に寝る、約束ね` : `平均${s.avg}時間。……まあ、よく寝れたほうじゃない`)}` });
    L.push({ c:'c3', html:`<small>MONEY</small><h2>使ったお金</h2><div class="wr-big"><b>${s.spent ? yen(s.spent) : '—'}</b></div>
      <p class="wr-sub">家計簿をつけた日 ${s.cashDays}日${s.topCat ? `<br>いちばん多かったのは「${esc(s.topCat[0])}」${yen(s.topCat[1])}` : ''}</p>
      ${say('yuuka', !s.cashDays ? '先生！ 家計簿、ほとんどつけてないじゃないですか！ 来月こそ毎日ですよ？' : s.topCat && /タバコ|飲み会|なぜか/.test(s.topCat[0]) ? `「${s.topCat[0]}」が一番って……先生、来月はここを減らしましょうね？` : `記録、ちゃんと続きましたね。この調子でいきましょう！`)}` });
    L.push({ c:'c4', html:`<small>THINGS DONE</small><h2>終えたこと</h2><div class="wr-two"><div><b>${s.todoN}</b><span>やること</span></div><div><b>${s.chores}</b><span>家事</span></div><div><b>${s.meals}</b><span>ご飯の記録</span></div></div>
      ${s.focus ? `<p class="wr-sub">集中した時間 ${Math.floor(s.focus / 60)}時間${s.focus % 60}分</p>` : ''}
      ${say('hoshino', s.todoN >= 20 ? `うへ〜、${s.todoN}件も片付けたの？ 先生、がんばりすぎ〜。えらいえらい〜` : s.todoN ? `${s.todoN}件、ちゃんと進んだね〜。のんびりでいいんだよ〜` : 'うへ〜、のんびりした月だったね〜。来月は、ちょっとずつ片付けていこっか〜')}` });
    L.push({ c:'c5', html:`<small>MOOD</small><h2>こころの${s.year ? '1年' : 'ひと月'}</h2>
      <div class="wr-mood ${s.year ? 'y' : ''}">${(s.year ? s.moods : daysOfKey(s.key)).map(x => s.year ? `<i style="background:${MOODC[x.v]}"></i>` : `<i style="background:${(s.moods.find(m => m.d === x) || {}).v ? MOODC[s.moods.find(m => m.d === x).v] : 'rgba(255,255,255,.18)'}"><span>${+x.slice(8)}</span></i>`).join('')}</div>
      <p class="wr-sub">${s.topMood ? `いちばん多かった気分は「${MOODN[s.topMood[0]]}」（${s.topMood[1]}日）` : '気分の記録はまだありません'}</p>
      ${say('mari', s.topMood && +s.topMood[0] <= 2 ? '先生、つらい日が多かったのですね……。来月は、少しでも心が休まりますように' : '先生のこころが、穏やかな日が多かったようで、私も嬉しいです')}` });
    if (s.topTalk) L.push({ c:'c6', html:`<small>BEST PARTNER</small><h2>いちばん話した子</h2><div class="wr-who"><img src="${Cast.av(s.topTalk[0])}" alt=""><b>${Cast.name(s.topTalk[0])}</b><span>${s.topTalk[1]}回</span></div>
      ${say(s.topTalk[0], Cast.of(s.topTalk[0]).thanks)}${s.topTalk[0] !== 'noa' ? `<p class="wr-noa">乃亜「……ふーん。${Cast.name(s.topTalk[0])}なんだ。……別にいいけど」</p>` : ''}` });
    if (s.byMonth) L.push({ c:'c7', html:`<small>12 MONTHS</small><h2>月ごとの睡眠</h2><div class="wr-bars">${s.byMonth.map(x => `<div><i style="height:${Math.min(100, x.sleep / 9 * 100)}%"></i><span>${x.m}</span></div>`).join('')}</div>
      <p class="wr-sub">お酒 ${s.drink}缶 ／ タバコ ${s.smoke}本</p>` });
    L.push({ c:'c8', html:`<small>SEE YOU NEXT ${s.year ? 'YEAR' : 'MONTH'}</small><h1>${s.year ? '来年も' : '来月も'}<br>いっしょに</h1>
      <div class="wr-avs end">${Cast.ORDER.map((w, i) => `<img src="${Cast.av(w)}" style="--i:${i}" alt="">`).join('')}</div><button class="wr-end">とじる</button>` });
    return L;
  }
  const daysOfKey = k => daysOf(k);
  async function show(key) {
    const s = await collect(key), L = slides(s);
    const ov = h(`<div class="wrov"><div class="wr-prog">${L.map(() => '<i><u></u></i>').join('')}</div><button class="wr-x" aria-label="閉じる">×</button>
      <div class="wr-st">${L.map((x, i) => `<section class="wr-s ${x.c}" data-i="${i}">${x.html}</section>`).join('')}</div></div>`);
    document.body.appendChild(ov);
    let i = 0, auto = 0;
    const go = n => {
      i = Math.max(0, Math.min(L.length - 1, n));
      ov.querySelectorAll('.wr-s').forEach((s, k) => s.classList.toggle('on', k === i));
      ov.querySelectorAll('.wr-prog i').forEach((p, k) => { p.className = k < i ? 'done' : k === i ? 'now' : ''; });
      Sfx.play('page'); clearTimeout(auto); auto = setTimeout(() => { if (i < L.length - 1) go(i + 1); }, 7000);
    };
    const close = () => { clearTimeout(auto); Wipe.play(() => ov.remove(), 'SEE YOU'); };
    ov.addEventListener('click', e => {
      if (e.target.closest('.wr-x') || e.target.closest('.wr-end')) return close();
      haptic(); if (e.clientX < innerWidth * .3) go(i - 1); else if (i < L.length - 1) go(i + 1);
    });
    await Wipe.play(() => { ov.classList.add('on'); go(0); }, s.year ? 'YEAR WRAPPED' : 'MONTHLY WRAPPED');
    const id = 'ys-wrap-' + key, arch = await Life.getS('ys-wraps', { id:'ys-wraps', list:[] });
    if (!arch.list.includes(key)) { arch.list.push(key); await Life.putS(arch); }
  }
  // 月初・元日に1回（朝の流れのあとで）
  async function check() {
    if (!Feat.on('wrapped') || phase !== 'app' || document.body.classList.contains('dailyOn')) return;
    const t = D.today(), first = LS.get('ys-first') || t;
    const m = lastMonth();
    if (t.slice(5) === '01-01' && LS.get('ys-wrapY') !== t.slice(0, 4)) { LS.set('ys-wrapY', t.slice(0, 4)); if (first < `${+t.slice(0, 4) - 1}-12-01`) return show(String(+t.slice(0, 4) - 1)); }
    if (LS.get('ys-wrapM') !== m && first <= `${m}-15`) { LS.set('ys-wrapM', m); return show(m); }
  }
  async function archiveHTML() {
    const arch = await Life.getS('ys-wraps', { id:'ys-wraps', list:[] }), m = lastMonth(), t = D.today();
    const keys = [...new Set([...arch.list, m, t.slice(0, 7)])].sort().reverse().slice(0, 14);
    return `<div class="ttl">Wrapped</div><div class="ps-wr">${keys.map(k => `<button data-wrap="${k}"><b>${k.length === 4 ? k + '年' : +k.slice(5) + '月'}</b><span>${k.length === 4 ? 'YEAR' : k === t.slice(0, 7) ? 'いま途中' : k.slice(0, 4)}</span></button>`).join('')}${t.slice(5, 7) === '12' || arch.list.some(k => k.length === 4) ? `<button data-wrap="${t.slice(0, 4)}"><b>${t.slice(0, 4)}年</b><span>YEAR</span></button>` : ''}</div>`;
  }
  return { show, check, archiveHTML, collect };
})();
