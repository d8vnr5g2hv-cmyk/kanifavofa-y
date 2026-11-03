// Yohei Support — 衣食住：ミカ（衣・食）／マリー（住）
'use strict';
// 生活DBの1件を編集するシート（どのページからも使う）
function lifeEdit(x, dm, cats, theme, done) {
  const isNew = !x; x = x || { dm, cat:cats[0] || '', name:'', val:'' };
  const body = h('<div></div>');
  const fC = cats.length ? F.suggest('分類', x.cat, cats) : null, fN = F.text('名前', x.name, '例：白シャツ'), fV = F.area('中身・メモ', x.val, '例：仕事用。2枚');
  [fC, fN, fV].filter(Boolean).forEach(f => body.appendChild(f.el));
  Editor.open({ title:isNew ? '追加' : x.name, body, theme, focus:isNew ? fN.input : null,
    del:isNew ? null : async () => { await Life.del(x.id); done && done(); },
    save:async () => { if (!fN.get()) return false; await Life.put(Object.assign(x, { cat:fC ? fC.get() : x.cat, name:fN.get(), val:fV.get(), state:'sure', at:new Date().toISOString() })); done && done(); } });
}
const groupBy = (list, k) => list.reduce((o, x) => ((o[x[k] || 'その他'] = o[x[k] || 'その他'] || []).push(x), o), {});

const Wear = (() => {
  const TH = { '--accent':'#f27ea7', '--title':'#e7779f', '--soft':'#fff3f7', '--line':'#f9d3e0' };
  const CATS = ['仕事', 'トップス', 'ボトムス', 'アウター', '靴', 'パジャマ', '小物', 'メモ'];
  async function suggest() {
    const w = await Life.weather().catch(() => null), t = D.today(), dow = new Date().getDay(), work = dow >= 1 && dow <= 5;
    const cl = await Life.items('clothes'), td = await Life.day();
    const tmax = w ? w.days[0].max : 18, tmin = w ? w.days[0].min : 12;
    const lines = [];
    if (work) {
      const shirts = cl.filter(x => x.cat === '仕事' && /シャツ/.test(x.name));
      const hist = (await Life.days(6)).map(d => d.wear).filter(Boolean);
      const pick = shirts.map(s => ({ s, n:hist.lastIndexOf(s.name) })).sort((a, b) => a.n - b.n)[0];
      lines.push(['仕事', 'ネイビーのスーツ' + (pick ? `＋${pick.s.name}` : '') ]);
      if (tmin <= 10) lines.push(['上着', cl.find(x => x.cat === 'アウター') ? cl.filter(x => x.cat === 'アウター')[0].name : 'コート']);
    } else {
      const tops = cl.filter(x => x.cat === 'トップス'), outs = cl.filter(x => x.cat === 'アウター');
      const warm = tmax >= 22;
      const top = tops.find(x => warm ? /T|半袖/.test(x.name + x.val) : /長袖|スウェット|ニット|パーカー/.test(x.name + x.val)) || tops[0];
      if (top) lines.push(['トップス', top.name]);
      if (tmin <= 14 && outs.length) lines.push(['上着', outs[0].name]);
    }
    if (w && w.days[0].rain >= 50) lines.push(['持ち物', '傘']);
    return { lines, work, tmax, tmin, worn:td.wear };
  }
  async function render() {
    const box = $('wearList'); if (!box) return;
    const sg = await suggest(), ch = (await Life.chores()).find(c => /洗濯/.test(c.name));
    const w = await Life.weather().catch(() => null), cl = await Life.items('clothes');
    const lnd = ch ? (ch.last ? D.diff(D.today(), ch.last) : 99) : null, st = await Life.getS('ys-laundry', { id:'ys-laundry', st:'' });
    $('wearHead').innerHTML = `<div class="ytabsum"><b>${sg.work ? '仕事の日' : 'おやすみの日'}</b><span>${sg.tmax}℃ / ${sg.tmin}℃</span></div>`;
    box.innerHTML = `
      <div class="yc ytoday"><h6>今日の服<em>ミカのおすすめ</em></h6>${sg.lines.map(([k, v]) => `<div class="ywear"><small>${k}</small><b>${esc(v)}</b></div>`).join('')}
        <div class="yrowb"><button class="ybtn" data-x="worn">${sg.worn ? `「${esc(sg.worn)}」を着た` : 'これ着た！'}</button><button class="ylink" data-x="askMika">ミカに相談</button></div></div>
      ${ch ? `<div class="yc lnd"><h6>洗濯<em>${ch.every}日に1回</em></h6>
        <div class="ylnd ${lnd >= ch.every ? 'due' : ''}"><b>${st.st === 'dry' ? '干し中' : lnd >= 99 ? '記録なし' : lnd === 0 ? '今日やった' : lnd + '日前'}</b><span>${st.st === 'dry' ? (w && w.code >= 51 ? '雨なので、部屋干しのままで' : '乾いたら取りこもう') : lnd >= ch.every ? (w && w.days[0].rain >= 50 ? '今日は雨。部屋干しにしよう' : '今日は洗濯日和かも') : 'まだ大丈夫'}</span></div>
        <div class="yrowb"><button class="ybtn" data-x="wash">洗濯した</button>${st.st === 'dry' ? '<button class="ybtn sub" data-x="dried">乾いた・しまった</button>' : ''}</div></div>` : ''}
      <div class="yc"><h6>クローゼット<em>${cl.length}点</em></h6>
        ${Object.entries(groupBy(cl, 'cat')).sort((a, b) => CATS.indexOf(a[0]) - CATS.indexOf(b[0])).map(([c, l]) => `<div class="ygrp"><small>${esc(c)}</small>${l.map(x => `<button class="yitem" data-it="${x.id}"><b>${esc(x.name)}</b>${x.val ? `<span>${esc(x.val)}</span>` : ''}</button>`).join('')}</div>`).join('') || '<p class="mu">＋から服を登録できるよ</p>'}</div>`;
  }
  async function onClick(e) {
    const b = e.target.closest('[data-x],[data-it]'); if (!b) return; haptic();
    const x = b.dataset.x;
    if (x === 'worn') { const sg = await suggest(); const v = sg.lines.map(l => l[1]).join('／'); await Life.setDay(D.today(), { wear:(sg.lines.find(l => l[0] === '仕事') || sg.lines[0] || ['', ''])[1].replace(/^.*＋/, '') }); toast('今日の服を記録したよ☆'); return render(); }
    if (x === 'wash') { const cs = await Life.chores(); const c = cs.find(c => /洗濯/.test(c.name)); if (c) { c.last = D.today(); await Life.setChores(cs); } await Life.putS({ id:'ys-laundry', st:'dry' }); toast('洗濯、おつかれさま☆'); return render(); }
    if (x === 'dried') { await Life.putS({ id:'ys-laundry', st:'' }); return render(); }
    if (x === 'askMika') return Talk.chat('mika', { first:'今日の服？ まかせて☆ 何を着ようか迷ってるの？' });
    if (b.dataset.it) { const it = (await Life.items('clothes')).find(i => i.id === b.dataset.it); return lifeEdit(it, 'clothes', CATS, TH, render); }
  }
  function init() {
    $('wearList').addEventListener('click', onClick);
    $('wearListAdd').onclick = () => { haptic(); lifeEdit(null, 'clothes', CATS, TH, render); };
    TabHooks.wear = { enter:() => { Motion.preload('mika'); render(); } };
  }
  return { init, reload:render };
})();
App.modules.push(Wear);

const Food = (() => {
  const SL = [['b', '朝', 'MORNING'], ['l', '昼', 'LUNCH'], ['d', '夜', 'DINNER'], ['s', '間食', 'SNACK']];
  let day = null;
  async function body() { return Life.getS('ys-body', { id:'ys-body', w:90, h:177, age:25, act:1.4, cut:true }); }
  async function target() { const f = await body(), bmr = 10 * f.w + 6.25 * f.h - 5 * f.age + 5; return Math.round((bmr * f.act - (f.cut ? 400 : 0)) / 10) * 10; }
  const tot = r => Object.values(r.meals || {}).reduce((a, m) => a + (m.kcal || 0), 0);
  async function render() {
    const box = $('foodList'); if (!box) return;
    const d = day || D.today(), r = await Life.food(d), dr = await Life.day(d), T = await target(), k = tot(r);
    const wk = await Life.days(7, d), cooks = (await DB.all('room')).filter(x => x.id.startsWith('cook-')).sort((a, b) => b.at - a.at);
    const saved = cooks.reduce((a, c) => a + Math.max(0, (c.deli || 1500) - (c.cost || 0)), 0), us = await Life.usual();
    $('foodHead').innerHTML = `<div class="ydnav"><button data-d="-1">‹</button><b>${D.md(d)}<small>${D.dow(d)}</small></b><button data-d="1" ${d >= D.today() ? 'disabled' : ''}>›</button></div>`;
    const bar = (v, mx) => `<i style="height:${Math.min(100, v / Math.max(1, mx) * 100)}%"></i>`;
    box.innerHTML = `
      <div class="yc kcal"><div class="ykc"><b>${k.toLocaleString()}</b><span>/ ${T.toLocaleString()} kcal</span></div><div class="ybar"><i style="width:${Math.min(100, k / T * 100)}%" class="${k > T * 1.05 ? 'over' : ''}"></i></div></div>
      <div class="ymeals">${SL.map(([s, n, en]) => { const m = r.meals[s]; return `<button class="ymeal ${m ? m.st : ''}" data-m="${s}"><small>${n}<i>${en}</i></small><span>${!m ? '＋ 記録' : m.st === 'skip' ? '食べなかった' : esc(m.text)}</span>${m && m.kcal ? `<em>${m.kcal}kcal</em>` : ''}</button>`; }).join('')}</div>
      <div class="yc vice"><h6>お酒とタバコ<em>今日</em></h6>
        <div class="yvc">${[['drink', 'お酒', '缶'], ['smoke', 'タバコ', '本']].map(([k2, n, u]) => `<div class="yv"><small>${n}</small><div><button data-c="${k2}" data-v="-1">−</button><b>${dr[k2] || 0}<span>${u}</span></b><button data-c="${k2}" data-v="1">＋</button></div>
          <div class="yspark">${wk.map(x => bar(x[k2] || 0, Math.max(3, ...wk.map(y => y[k2] || 0)))).join('')}</div></div>`).join('')}</div>
        <p class="mu">記録すると、在庫と保健室のカルテにも反映されるよ</p></div>
      <div class="yc cook"><h6>自炊ノート<em>出前より ${saved.toLocaleString()}円 おトク</em><button class="ylink" data-x="cook">＋ 作った</button></h6>
        ${cooks.slice(0, 6).map(c => `<div class="ycook" data-ck="${c.id}"><b>${esc(c.name)}</b><span>${D.md(c.date)}・材料 ${(c.cost || 0).toLocaleString()}円</span></div>`).join('') || '<p class="mu">料理したら記録してね。出前（1回1,500円）と比べて、浮いた分を貯めていくよ☆</p>'}
        <div class="yrowb"><button class="ylink" data-x="fridge">冷蔵庫にあるもので何作れる？</button></div></div>
      ${us.length ? `<div class="yc"><h6>いつもの</h6><div class="ychips">${us.map(u => `<span>${esc(u.text)}</span>`).join('')}</div></div>` : ''}`;
  }
  async function meal(s) {
    const d = day || D.today(), r = await Life.food(d), m = r.meals[s], nm = SL.find(x => x[0] === s)[1];
    const body = h('<div></div>'), fT = F.area(`${nm}に食べたもの`, m && m.st !== 'skip' ? m.text : '', '例：辛ラーメンとチーズ');
    body.appendChild(fT.el);
    Editor.open({ title:`${nm}ごはん（${D.md(d)}）`, body, theme:{ '--accent':'#f27ea7', '--title':'#e7779f', '--soft':'#fff3f7', '--line':'#f9d3e0' }, focus:m ? null : fT.input, saveLabel:'記録',
      del:m ? async () => { delete r.meals[s]; await DB.put('room', r); Life.changed('food'); render(); } : null, delLabel:'この記録を消す',
      save:async () => {
        const text = fT.get();
        r.meals[s] = text ? { st:'ate', text:text.slice(0, 200), at:Date.now(), kcal:null } : { st:'skip', at:Date.now() };
        await DB.put('room', r); Life.changed('food'); render();
        if (!text) return;
        if (!(await Api.load())) return;
        setTimeout(async () => {
          Talk.open('mika'); Talk.think('カロリー計算中☆');
          try {
            const f = await body2(), T = await target(), day0 = Object.fromEntries(Object.entries(r.meals).filter(([k]) => k !== s).map(([k, x]) => [SL.find(y => y[0] === k)[1], x.st === 'skip' ? '抜いた' : x.text]));
            const res = await Api.call('food', { now:Api.now(), body:`男性・${f.age}歳・${f.w}kg・${f.h}cm`, target:T, tp:Math.round(T * .22 / 4), tf:Math.round(T * .25 / 9), tc:Math.round(T * .53 / 4), slot:nm, text, day:day0, who:'mika' });
            const it = res.items || []; Object.assign(r.meals[s], { items:it, kcal:it.reduce((a, x) => a + x.kcal, 0) });
            await DB.put('room', r); render();
            await Talk.say('mika', res.lines, res.face);
          } catch (e) { await Talk.say('mika', ['ごめん、計算うまくいかなかった。記録は残してあるよ']); }
          Talk.close();
        }, 350);
      } });
  }
  const body2 = body;
  async function onClick(e) {
    const b = e.target.closest('button'); if (!b) return; haptic();
    if (b.dataset.d) { day = D.add(day || D.today(), +b.dataset.d); return render(); }
    if (b.dataset.m) return meal(b.dataset.m);
    if (b.dataset.c) {
      const k = b.dataset.c, v = +b.dataset.v, d = day || D.today();
      await Life.count(k, v, d);
      if (d === D.today()) {   // 在庫も減らす（タバコ・お酒）
        const st = await Life.stock(), re = k === 'smoke' ? /タバコ|ピース|煙草/ : /酒|缶|ハイ|ゼロ|ビール/, s = st.find(x => re.test(x.name));
        if (s && s.left != null && s.left !== '') { s.left = Math.max(0, s.left - v); await Life.setStock(st); }
      }
      return render();
    }
    if (b.dataset.x === 'cook') {
      const n = await Talk.ask('mika', 'なに作ったの？☆', { ph:'例：豚肉とほうれん草の炒めもの' }); if (!n) return Talk.close();
      const c = Math.round(+String(await Talk.ask('mika', '材料、だいたいいくらだった？', { type:'number', ph:'例：400', chips:['300', '500', '800'] }) || '').replace(/[^\d]/g, ''));
      await DB.put('room', { id:'cook-' + newId(), name:n.slice(0, 30), cost:c || 0, deli:1500, date:D.today(), at:Date.now() });
      await Talk.say('mika', [`すごーい！ 出前より ${Math.max(0, 1500 - (c || 0)).toLocaleString()}円 浮いたね☆`, 'この調子で、同棲資金も貯めちゃお！'], 'smile'); Talk.close(); return render();
    }
    if (b.dataset.x === 'fridge') {
      const v = await Talk.ask('mika', '冷蔵庫に何がある？ 書いてくれたら考えるよ☆', { ph:'例：豚肉、ほうれん草、卵' }); if (!v) return Talk.close();
      Talk.think('考え中☆');
      try { const r = await Api.call('chat', { who:'mika', now:Api.now(), text:`冷蔵庫に「${v}」がある。料理初心者でも作れる晩ごはんを2つ、材料と手順を短く教えて`, log:[], snap:await Life.snapshot() }); await Talk.say('mika', r.lines, r.face); }
      catch (e) { await Talk.say('mika', ['AIの設定をしてくれたら、レシピも考えられるよ☆']); }
      return Talk.close();
    }
  }
  function init() { $('foodList').addEventListener('click', onClick); $('foodHead').addEventListener('click', onClick); TabHooks.food = { enter:() => { day = null; Motion.preload('mika'); render(); } }; }
  return { init, reload:render };
})();
App.modules.push(Food);

const Home = (() => {
  const TH = { '--accent':'#e8a640', '--title':'#c7832a', '--soft':'#fff8e6', '--line':'#f5e3b8' };
  const SEC = [['home', '部屋'], ['bed', '寝具'], ['appl', '家電'], ['habit', 'いつもの一日'], ['work', '仕事'], ['play', '遊び'], ['body', 'からだ']];
  let open = { home:true, habit:true };
  async function render() {
    const box = $('homeList'); if (!box) return;
    const t = D.today(), ch = await Life.chores(), st = await Life.stock(), buy = (await Life.getS('ys-buy', { list:[] })).list, all = await Life.items();
    $('homeHead').innerHTML = `<div class="ytabsum"><b>${esc((await Life.area()).name)}</b><span>${all.length}件の生活データ</span></div>`;
    box.innerHTML = `
      <div class="yc"><h6>家事<em>マリーが見ています</em><button class="ylink" data-x="chAdd">＋</button></h6>
        ${ch.map(c => { const n = c.last ? D.diff(t, c.last) : null; return `<div class="ychore ${n == null || n >= c.every ? 'due' : ''}" data-ch="${c.id}"><b>${esc(c.name)}</b><span>${n == null ? '記録なし' : n === 0 ? '今日やった' : n + '日前'}<small>${c.every}日ごと</small></span><button data-done="${c.id}">やった</button></div>`; }).join('') || '<p class="mu">家事を登録すると、間隔を見てお知らせします</p>'}</div>
      <div class="yc"><h6>在庫<em>なくなる前に</em><button class="ylink" data-x="stAdd">＋</button></h6>
        ${st.map(s => { const d = Life.stockDays(s); return `<div class="ystock ${d != null && d <= 2 ? 'low' : ''}" data-st="${s.id}"><b>${esc(s.name)}</b><span>${s.left == null || s.left === '' ? '残りを入れてね' : `残り ${s.left}${esc(s.unit || '')}`}${d != null ? `・あと${d}日` : ''}</span><i style="width:${d == null ? 0 : Math.min(100, d / 14 * 100)}%"></i></div>`; }).join('') || '<p class="mu">タバコ・お酒・洗剤など。1日に減る量を入れると、なくなる日がわかります</p>'}</div>
      <div class="yc"><h6>買い物リスト<button class="ylink" data-x="buyAdd">＋</button></h6>
        ${buy.map(b => `<label class="ybuy ${b.done ? 'done' : ''}"><input type="checkbox" data-buy="${b.id}" ${b.done ? 'checked' : ''}><span>${esc(b.name)}</span></label>`).join('') || '<p class="mu">在庫が少なくなったら、ここに入れておくね</p>'}
        ${buy.some(b => b.done) ? '<div class="yrowb"><button class="ylink" data-x="buyClear">買ったものを消す</button></div>' : ''}</div>
      ${SEC.map(([dm, n]) => { const l = all.filter(x => x.dm === dm); return `<div class="yc ysec ${open[dm] ? 'open' : ''}"><h6 data-tg="${dm}">${n}<em>${l.length}件</em><button class="ylink" data-add="${dm}">＋</button></h6>
        ${open[dm] ? (dm === 'habit' ? `<div class="ytl">${l.map(x => `<button class="yitem" data-it="${x.id}"><b>${esc(x.name)}</b><span>${esc(x.val)}</span></button>`).join('')}</div>` : l.map(x => `<button class="yitem" data-it="${x.id}"><b>${esc(x.name)}</b>${x.val ? `<span>${esc(x.val)}</span>` : ''}</button>`).join('')) : ''}</div>`; }).join('')}`;
  }
  async function editStock(s) {
    const isNew = !s; s = s || { id:newId(), name:'', left:0, unit:'', perDay:0 };
    const body = h('<div></div>'), fN = F.text('名前', s.name, '例：ピースライト'), fL = F.text('今の残り', s.left ?? '', '例：40', 'number'), fU = F.suggest('単位', s.unit, ['本', '缶', '個', '回分', 'ロール']), fP = F.text('1日に減る量', s.perDay || '', '例：15', 'number');
    body.append(fN.el, fL.el, fU.el, fP.el);
    Editor.open({ title:isNew ? '在庫を追加' : s.name, body, theme:TH, focus:isNew ? fN.input : null,
      del:isNew ? null : async () => { await Life.setStock((await Life.stock()).filter(x => x.id !== s.id)); render(); },
      save:async () => { if (!fN.get()) return false; const l = await Life.stock(); Object.assign(s, { name:fN.get(), left:fL.get() === '' ? null : +fL.get(), unit:fU.get(), perDay:+fP.get() || 0 }); const i = l.findIndex(x => x.id === s.id); if (i >= 0) l[i] = s; else l.push(s); await Life.setStock(l); render(); } });
  }
  async function editChore(c) {
    const isNew = !c; c = c || { id:newId(), name:'', every:2, last:null };
    const body = h('<div></div>'), fN = F.text('家事', c.name, '例：ゴミ出し'), fE = F.text('何日ごと', c.every, '2', 'number');
    body.append(fN.el, fE.el);
    Editor.open({ title:isNew ? '家事を追加' : c.name, body, theme:TH, focus:isNew ? fN.input : null,
      del:isNew ? null : async () => { await Life.setChores((await Life.chores()).filter(x => x.id !== c.id)); render(); },
      save:async () => { if (!fN.get()) return false; const l = await Life.chores(); Object.assign(c, { name:fN.get(), every:+fE.get() || 2 }); const i = l.findIndex(x => x.id === c.id); if (i >= 0) l[i] = c; else l.push(c); await Life.setChores(l); render(); } });
  }
  async function onClick(e) {
    const t = e.target;
    const cb = t.closest('[data-buy]'); if (cb) { const b = await Life.getS('ys-buy', { id:'ys-buy', list:[] }); const x = b.list.find(i => i.id === cb.dataset.buy); if (x) { x.done = cb.checked; b.id = 'ys-buy'; await Life.putS(b); } haptic(); return render(); }
    const b = t.closest('button,[data-tg],[data-ch],[data-st]'); if (!b) return; haptic();
    if (b.dataset.done) { const l = await Life.chores(), c = l.find(x => x.id === b.dataset.done); c.last = D.today(); await Life.setChores(l); toast(`${c.name}、おつかれさまでした`); Motion.play('mari', 'tap'); return render(); }
    if (b.dataset.ch) return editChore((await Life.chores()).find(x => x.id === b.dataset.ch));
    if (b.dataset.st) return editStock((await Life.stock()).find(x => x.id === b.dataset.st));
    if (b.dataset.tg && !t.closest('[data-add]')) { open[b.dataset.tg] = !open[b.dataset.tg]; return render(); }
    if (b.dataset.add) return lifeEdit(null, b.dataset.add, [], TH, render);
    if (b.dataset.it) { const it = (await Life.items()).find(i => i.id === b.dataset.it); return lifeEdit(it, it.dm, [], TH, render); }
    const x = b.dataset.x;
    if (x === 'chAdd') return editChore(null);
    if (x === 'stAdd') return editStock(null);
    if (x === 'buyAdd') { const body = h('<div></div>'), f = F.text('買うもの', '', '例：洗剤'); body.appendChild(f.el); return Editor.open({ title:'買い物リスト', body, theme:TH, focus:f.input, save:async () => { if (!f.get()) return false; const bl = await Life.getS('ys-buy', { id:'ys-buy', list:[] }); bl.id = 'ys-buy'; bl.list.push({ id:newId(), name:f.get(), done:false }); await Life.putS(bl); render(); } }); }
    if (x === 'buyClear') { const bl = await Life.getS('ys-buy', { id:'ys-buy', list:[] }); bl.id = 'ys-buy'; bl.list = bl.list.filter(i => !i.done); await Life.putS(bl); return render(); }
  }
  function init() {
    $('homeList').addEventListener('click', onClick);
    $('homeListAdd').onclick = () => { haptic(); Menu.open('追加する', [{ label:'家事', fn:() => editChore(null) }, { label:'在庫', fn:() => editStock(null) }, ...SEC.map(([dm, n]) => ({ label:n, fn:() => lifeEdit(null, dm, [], TH, render) }))]); };
    TabHooks.home = { enter:() => { Motion.preload('mari'); render(); } };
    Life.onChange(w => { if (tab === 'home') render(); if (tab === 'wear') Wear.reload(); if (tab === 'food' && w !== 'day') Food.reload(); });
  }
  return { init, reload:render };
})();
App.modules.push(Home);
