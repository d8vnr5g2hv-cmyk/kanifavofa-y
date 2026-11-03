// Yohei Support — 友好関係（マリー）：ようへいを中心にした関係図と、ひとりずつのカード
'use strict';
const Friends = (() => {
  const TH = { '--accent':'#e8a640', '--title':'#c7832a', '--soft':'#fff8e6', '--line':'#f5e3b8' };
  const TIERS = [['family', '家族', '#ff9ec4'], ['best', '親友', '#ffb347'], ['friend', '友達', '#7cc4ff'], ['work', '職場', '#8fd6b4'], ['known', '知り合い', '#b9b4d6']];
  const TC = Object.fromEntries(TIERS.map(([k, , c]) => [k, c])), TN = Object.fromEntries(TIERS.map(([k, n]) => [k, n]));
  const RING = { family:72, best:72, friend:116, work:150, known:150 };
  // 関係をはかる質問（0〜5）
  const Q = [['freq', '会う・連絡する頻度', 'ほぼない', 'よくある'], ['ease', '気楽に話せる', '気をつかう', 'なんでも話せる'], ['trust', '困ったとき頼れる', '頼れない', 'すごく頼れる'],
             ['fun', '一緒にいて楽しい', 'ふつう', 'すごく楽しい'], ['grow', '刺激・尊敬', 'あまりない', 'すごくある'], ['now', '最近の距離感', '離れてる', '近い']];
  const score = p => { const v = Q.map(([k]) => p.params && p.params[k]).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 2.5; };
  let list = [], sel = null, mode = 'map';
  function place() {   // 輪ごとに等間隔（グループが同じ人は並ぶように）
    const pos = {};
    const rings = {}; list.forEach(p => { const r = RING[p.tier] || 150; (rings[r] = rings[r] || []).push(p); });
    Object.entries(rings).forEach(([r, ps], ri) => {
      ps.sort((a, b) => (a.tier + a.group).localeCompare(b.tier + b.group) || a.name.localeCompare(b.name));
      const off = ri * .7 - Math.PI / 2;
      ps.forEach((p, i) => { const a = off + i / ps.length * Math.PI * 2; pos[p.id] = [170 + Math.cos(a) * r, 170 + Math.sin(a) * r]; });
    });
    return pos;
  }
  function mapSVG() {
    const pos = place(), me = [170, 170];
    const ln = [];
    list.forEach(p => { const [x, y] = pos[p.id], s = score(p); ln.push(`<line x1="${me[0]}" y1="${me[1]}" x2="${x}" y2="${y}" stroke="${TC[p.tier]}" stroke-width="${(.6 + s * .55).toFixed(1)}" stroke-opacity="${(.25 + s * .1).toFixed(2)}"/>`); });
    const seen = new Set();
    list.forEach(p => (p.links || []).forEach(id => { const k = [p.id, id].sort().join(); if (seen.has(k) || !pos[id]) return; seen.add(k); const [a, b] = [pos[p.id], pos[id]], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, qx = mx + (mx - 170) * .45, qy = my + (my - 170) * .45; ln.push(`<path d="M${a[0]},${a[1]} Q${qx.toFixed(1)},${qy.toFixed(1)} ${b[0]},${b[1]}" fill="none" stroke="#b48cff" stroke-width="1.6" stroke-dasharray="4 3" stroke-opacity=".85"/>`); }));
    const nodes = list.map(p => { const [x, y] = pos[p.id], s = score(p), r = 13 + s * 2.2; return `<g class="fn ${sel === p.id ? 'sel' : ''}" data-p="${p.id}" transform="translate(${x},${y})"><circle r="${r + 3}" fill="#fff" opacity=".9"/><circle r="${r}" fill="${TC[p.tier]}"/><text y="4" text-anchor="middle">${esc([...p.name][0])}</text><text class="nm" y="${r + 14}" text-anchor="middle">${esc(p.name)}</text></g>`; }).join('');
    return `<svg viewBox="0 0 340 340" class="fmap">${[72, 116, 150].map(r => `<circle cx="170" cy="170" r="${r}" fill="none" stroke="#e8c98a" stroke-opacity=".45" stroke-dasharray="2 5"/>`).join('')}
      ${ln.join('')}${nodes}<g class="fme" data-me="1"><circle cx="170" cy="170" r="25" fill="#fff"/><circle cx="170" cy="170" r="21" fill="#20999C"/><text x="170" y="175" text-anchor="middle">ようへい</text></g></svg>`;
  }
  async function render() {
    list = await Life.friends();
    const box = $('frList'); if (!box) return;
    $('frHead').innerHTML = `<div class="yseg"><button data-md="map" class="${mode === 'map' ? 'on' : ''}">関係図</button><button data-md="list" class="${mode === 'list' ? 'on' : ''}">一覧</button></div>`;
    const t = D.today(), far = list.filter(p => ['best', 'friend'].includes(p.tier) && p.lastMet && D.diff(t, p.lastMet) >= 60);
    box.innerHTML = mode === 'map' ? `<div class="yc fmapc">${mapSVG()}<div class="flg">${TIERS.map(([k, n, c]) => `<span><i style="background:${c}"></i>${n}</span>`).join('')}<span><i class="dl"></i>知り合い同士</span></div><p class="mu">丸が大きいほど関係が深い人。タップでカードが開きます</p></div>
        ${far.length ? `<div class="yc"><h6>しばらく会っていない人</h6>${far.map(p => `<button class="yitem" data-card="${p.id}"><b>${esc(p.name)}</b><span>${D.diff(t, p.lastMet)}日前に会った</span></button>`).join('')}</div>` : ''}`
      : TIERS.map(([k, n, c]) => { const l = list.filter(p => p.tier === k).sort((a, b) => score(b) - score(a)); return l.length ? `<div class="yc"><h6><i class="dot" style="background:${c}"></i>${n}<em>${l.length}人</em></h6>${l.map(p => `<button class="fpr" data-card="${p.id}"><i style="background:${c}">${esc([...p.name][0])}</i><b>${esc(p.name)}<small>${esc(p.rel || '')}</small></b><span class="hearts">${'<u></u>'.repeat(Math.round(score(p)))}</span></button>`).join('')}</div>` : ''; }).join('');
  }
  function card(p) {
    const isNew = !p; p = p || { id:'fr-' + newId(), name:'', tier:'friend', rel:'', group:'', memo:'', birthday:'', lastMet:'', params:{}, links:[] };
    const body = h('<div class="fcard"></div>');
    const fN = F.text('名前', p.name, '例：山下さん'), fT = F.seg('関係', TIERS.map(([k, n]) => [k, n]), p.tier), fR = F.text('どんな人', p.rel, '例：SCSK時代の元同僚'), fG = F.suggest('グループ', p.group, [...new Set(list.map(x => x.group).filter(Boolean))]);
    body.append(fN.el, fT.el, fR.el, fG.el);
    const qs = h(`<div class="fq"><label>関係のものさし</label>${Q.map(([k, n, lo, hi]) => `<div class="fqr"><span>${n}</span><input type="range" min="0" max="5" step="1" value="${p.params && p.params[k] != null ? p.params[k] : 3}" data-q="${k}"><small><i>${lo}</i><i>${hi}</i></small></div>`).join('')}</div>`);
    body.appendChild(qs);
    const others = list.filter(x => x.id !== p.id);
    const lk = h(`<div class="fl"><label>知り合い同士（相関図の線）</label><div class="qk">${others.map(o => `<button type="button" data-l="${o.id}" class="${(p.links || []).includes(o.id) ? 'on' : ''}">${esc(o.name)}</button>`).join('') || '<small>ほかの人を登録すると選べます</small>'}</div></div>`);
    lk.addEventListener('click', e => { const b = e.target.closest('[data-l]'); if (b) b.classList.toggle('on'); });
    body.appendChild(lk);
    const fB = F.text('誕生日', p.birthday, '例：3/14'), fM = F.date('最後に会った日', p.lastMet, false), fMemo = F.area('メモ', p.memo, '好きなもの、最近の話、次に話したいことなど');
    body.append(fB.el, fM.el, fMemo.el);
    Editor.open({ title:isNew ? '人を追加' : p.name, body, theme:TH, focus:isNew ? fN.input : null,
      del:isNew ? null : async () => { await DB.del('room', p.id); for (const o of list) if ((o.links || []).includes(p.id)) { o.links = o.links.filter(x => x !== p.id); await DB.put('room', o); } render(); },
      save:async () => {
        if (!fN.get()) return false;
        const params = {}; qs.querySelectorAll('[data-q]').forEach(r => params[r.dataset.q] = +r.value);
        const links = [...lk.querySelectorAll('[data-l].on')].map(b => b.dataset.l);
        Object.assign(p, { name:fN.get(), tier:fT.get(), rel:fR.get(), group:fG.get(), birthday:fB.get(), lastMet:fM.get(), memo:fMemo.get(), params, links, at:Date.now() });
        await DB.put('room', p);
        for (const o of list) { if (o.id === p.id) continue; const has = (o.links || []).includes(p.id), want = links.includes(o.id); if (has !== want) { o.links = want ? [...(o.links || []), p.id] : o.links.filter(x => x !== p.id); await DB.put('room', o); } }
        sel = p.id; render(); Life.changed('friends');
      } });
  }
  async function onClick(e) {
    const md = e.target.closest('[data-md]'); if (md) { haptic(); mode = md.dataset.md; return render(); }
    const n = e.target.closest('[data-p],[data-card]'); if (n) { haptic(); const id = n.dataset.p || n.dataset.card; sel = id; return card(list.find(p => p.id === id)); }
    if (e.target.closest('[data-me]')) { haptic(); return Talk.chat('mari', { first:'先生のまわりには、すてきな方がたくさんいらっしゃいますね。どなたのお話をしましょうか？' }); }
  }
  function init() {
    $('frList').addEventListener('click', onClick); $('frHead').addEventListener('click', onClick);
    $('frListAdd').onclick = () => { haptic(); card(null); };
    TabHooks.friends = { enter:() => { Motion.preload('mari'); render(); } };
  }
  return { init, reload:render };
})();
App.modules.push(Friends);
