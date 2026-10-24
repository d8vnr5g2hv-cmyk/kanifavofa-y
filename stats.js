// Kani Favorite — 分析（自室PCの Analytics）。記録は settings の 'stats' に1件だけ持つ
'use strict';
const Stats = (() => {
  const ID = 'stats';
  const ME_RATE = [['stamina', '体力'], ['focus', '集中力'], ['social', '社交性'], ['plan', '計画性'], ['keep', '継続力'], ['self', '自己肯定']];
  const NAME = { hoshino:'ホシノ', mika:'ミカ', miyako:'ミヤコ', mari:'マリー', serina:'セリナ', kisaki:'キサキ', hina:'ヒナ', seia:'セイア', noa:'ノア', yuuka:'ユウカ', hikari:'ヒカリ', nico:'ニコ' };
  const TAG = { classify:'分類', discuss:'会議', room:'会話', interview:'取材', article:'記事', report:'日報', other:'その他' };
  const C = ['#7fe0ff', '#ffd27a', '#ff9fb6', '#9ff0b8', '#c9a7ff', '#ffb27a'];
  let S = null, tab = 'todo', saveT = 0;

  async function load() {
    if (S) return S;
    S = (await DB.get('settings', ID).catch(() => null)) || { id:ID, days:{}, self:[], ai:{} };
    S.days = S.days || {}; S.self = S.self || []; S.ai = S.ai || {};
    return S;
  }
  function save() { clearTimeout(saveT); saveT = setTimeout(() => S && DB.put('settings', S).catch(() => {}), 400); }
  const day = k => S.days[k] = S.days[k] || {};
  const month = () => D.today().slice(0, 7);

  // Todoは完了から30日で消えるので、今あるTodoから日ごとの数を数えて「大きいほう」を残していく
  async function syncTodos() {
    const todos = await DB.all('todos').catch(() => []), cnt = {};
    const c = k => cnt[k] = cnt[k] || { made:0, done:0, ontime:0, due:0 };
    todos.forEach(t => {
      if (t.createdAt) c(D.key(new Date(t.createdAt))).made++;
      if (t.done && t.doneAt) { const k = D.key(new Date(t.doneAt)), x = c(k); x.done++; if (t.due) { x.due++; if (k <= t.due) x.ontime++; } }
    });
    Object.entries(cnt).forEach(([k, v]) => { const d = day(k); ['made', 'done', 'ontime', 'due'].forEach(f => d[f] = Math.max(d[f] || 0, v[f])); });
  }

  // ===== 外から呼ぶ記録 =====
  async function noteOpen() { await load(); const d = day(D.today()); d.open = (d.open || 0) + 1; await syncTodos(); save(); }
  async function noteSelf(rate) {
    await load(); const t = D.today(), r = {}; ME_RATE.forEach(([k]) => { if (rate[k]) r[k] = rate[k]; });
    S.self = S.self.filter(x => x.d !== t).concat([{ d:t, r }]).slice(-120); save();
  }
  async function noteAI(b) {
    if (!b) return; await load();
    S.ai[month()] = { spent:+b.spent || 0, limit:+b.limit || 0, by:b.by || {} }; save();
  }

  // ===== グラフ（SVG・軽量） =====
  const W = 300, H = 120, PL = 24, PR = 8, PT = 10, PB = 20;
  const niceMax = v => { if (v <= 4) return 4; const p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p; return (m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; };
  function grid(max, fmt) {
    let g = ''; for (let i = 0; i <= 2; i++) { const y = PT + (H - PT - PB) * i / 2, v = max * (1 - i / 2);
      g += `<line x1="${PL}" x2="${W - PR}" y1="${y}" y2="${y}" class="sg"/><text x="${PL - 4}" y="${y + 3}" class="sy">${fmt ? fmt(v) : Math.round(v)}</text>`; }
    return g;
  }
  function xlab(labels) {
    const n = labels.length, step = Math.ceil(n / 6);
    return labels.map((l, i) => ((i % step === 0 && n - 1 - i >= step / 2) || i === n - 1) && l ? `<text x="${PL + (W - PL - PR) * (n === 1 ? .5 : i / (n - 1))}" y="${H - 5}" class="sx">${l}</text>` : '').join('');
  }
  function line(series, labels, fmt) {
    const n = labels.length, max = niceMax(Math.max(1, ...series.flatMap(s => s.v.filter(v => v != null))));
    const X = i => PL + (W - PL - PR) * (n === 1 ? .5 : i / (n - 1)), Y = v => PT + (H - PT - PB) * (1 - v / max);
    const body = series.map((s, si) => {
      const pts = s.v.map((v, i) => v == null ? null : [X(i), Y(v)]).filter(Boolean);
      if (!pts.length) return '';
      const col = s.c || C[si];
      return `<polyline points="${pts.map(p => p.join(',')).join(' ')}" style="stroke:${col}" class="sl"/>` + (n <= 31 ? pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="2.2" style="fill:${col}"/>`).join('') : '');
    }).join('');
    return `<svg class="sch" viewBox="0 0 ${W} ${H}">${grid(max, fmt)}${body}${xlab(labels)}</svg>` + legend(series);
  }
  function legend(series) { return series.length > 1 ? `<div class="slg">${series.map((s, i) => `<span><i style="background:${s.c || C[i]}"></i>${s.n}</span>`).join('')}</div>` : ''; }
  function bars(items, fmt) {   // 横棒（名前つき）
    const max = Math.max(1, ...items.map(x => x.v));
    return `<div class="sbars">${items.map((x, i) => `<div><span>${esc(x.n)}</span><b><i style="width:${x.v / max * 100}%;background:${x.c || C[i % C.length]}"></i></b><em>${fmt ? fmt(x.v) : x.v}</em></div>`).join('')}</div>`;
  }
  function heat(days, weeks) {   // GitHubの草みたいな表（列＝週、行＝曜日）
    const t = D.parse(D.today()), start = new Date(t); start.setDate(t.getDate() - t.getDay() - (weeks - 1) * 7);
    let cells = '';
    for (let w = 0; w < weeks; w++) for (let d = 0; d < 7; d++) {
      const x = new Date(start); x.setDate(start.getDate() + w * 7 + d); const k = D.key(x), v = (days[k] || 0), fut = x > t;
      cells += `<i style="grid-column:${w + 1};grid-row:${d + 1}" class="${fut ? 'fu' : v >= 3 ? 'l3' : v === 2 ? 'l2' : v ? 'l1' : ''}"></i>`;
    }
    return `<div class="sheat" style="grid-template-columns:repeat(${weeks},1fr)">${cells}</div><div class="slg sm"><span>少</span><span><i class="hl l1"></i><i class="hl l2"></i><i class="hl l3"></i></span><span>多</span></div>`;
  }
  const kpi = list => `<div class="skpi">${list.map(([l, v, s]) => `<div><small>${l}</small><b>${v}</b>${s ? `<span>${s}</span>` : ''}</div>`).join('')}</div>`;
  const card = (t, body, note) => `<div class="scd"><h6>${t}${note ? `<em>${note}</em>` : ''}</h6>${body}</div>`;
  const emp = s => `<p class="sem">${s}</p>`;
  const lastDays = n => Array.from({ length:n }, (_, i) => D.add(D.today(), i - n + 1));
  const lastMonths = n => { const t = new Date(); return Array.from({ length:n }, (_, i) => { const d = new Date(t.getFullYear(), t.getMonth() - n + 1 + i, 1); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}`; }); };
  const md = k => `${+k.slice(5, 7)}/${+k.slice(8, 10)}`;

  // ===== ページ =====
  async function pTodo() {
    await syncTodos(); save();
    const ds = lastDays(14), get = (k, f) => (S.days[k] || {})[f] || 0;
    const d30 = lastDays(30), done30 = d30.reduce((a, k) => a + get(k, 'done'), 0), due30 = d30.reduce((a, k) => a + get(k, 'due'), 0), on30 = d30.reduce((a, k) => a + get(k, 'ontime'), 0);
    const week = lastDays(7).reduce((a, k) => a + get(k, 'done'), 0);
    let streak = 0; for (let i = 0; ; i++) { const k = D.add(D.today(), -i); if (get(k, 'done')) streak++; else if (i > 0) break; if (i > 400) break; }
    const todos = await DB.all('todos').catch(() => []), open = todos.filter(t => !t.done && t.list === 'do'), late = open.filter(t => t.due && t.due < D.today()).length;
    const ws = Array.from({ length:8 }, (_, i) => lastDays(56).slice(i * 7, i * 7 + 7));
    return kpi([['今週の完了', week, '件'], ['期限内', due30 ? Math.round(on30 / due30 * 100) + '%' : '—', '30日'], ['連続', streak, '日'], ['残り', open.length, late ? `期限切れ${late}` : '件']])
      + card('作った数と終わった数', line([{ n:'作った', v:ds.map(k => get(k, 'made')) }, { n:'終わった', v:ds.map(k => get(k, 'done')) }], ds.map(md)), '14日')
      + card('週ごとの完了', line([{ n:'完了', v:ws.map(w => w.reduce((a, k) => a + get(k, 'done'), 0)), c:C[2] }], ws.map(w => md(w[0]))), '8週')
      + `<p class="snote">30日間で完了 ${done30}件。完了から30日で消えるTodoも、ここには残り続けます</p>`;
  }
  async function pLife() {
    const opens = {}; Object.entries(S.days).forEach(([k, v]) => { if (v.open) opens[k] = v.open; });
    const m = month(), nOpen = Object.keys(opens).filter(k => k.startsWith(m)).length;
    const [evs, loves] = await Promise.all([DB.all('events').catch(() => []), DB.all('loves').catch(() => [])]);
    const ms = lastMonths(6), byM = (arr, f) => ms.map(x => arr.filter(a => f(a) && f(a).startsWith(x)).length);
    return kpi([['今月開いた日', nOpen, '日'], ['予定', evs.filter(e => e.date && e.date.startsWith(m)).length, '今月'], ['Love', loves.length, '枚']])
      + card('アプリを開いた日', heat(opens, 12), '12週')
      + card('月ごとの予定とLove', line([{ n:'予定', v:byM(evs, e => e.date) }, { n:'Love', v:byM(loves, l => l.createdAt && D.key(new Date(l.createdAt))), c:C[2] }], ms.map(x => +x.slice(5) + '月')), '6か月');
  }
  async function pSelf() {
    const h = S.self.slice(-30);
    if (!h.length) return card('自己評価の移り変わり', emp('Profile の MY PROFILE で自己評価をつけると、ここに線が引かれます'));
    const avg = x => { const v = Object.values(x.r); return v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) : null; };
    const last = h[h.length - 1], first = h[0], diff = (avg(last) - avg(first)).toFixed(1);
    return kpi([['いまの平均', avg(last) ?? '—', '/ 5'], ['はじめから', (diff > 0 ? '+' : '') + diff, `${h.length}回`]])
      + card('平均の移り変わり', line([{ n:'平均', v:h.map(avg), c:C[0] }], h.map(x => md(x.d)), v => v.toFixed(0)), '最大30回')
      + card('項目ごと', line(ME_RATE.map(([k, n], i) => ({ n, v:h.map(x => x.r[k] ?? null), c:C[i] })), h.map(x => md(x.d))))
      + card('いまの値', bars(ME_RATE.map(([k, n], i) => ({ n, v:last.r[k] || 0, c:C[i] }))));
  }
  async function pPlay() {
    const room = await DB.all('room').catch(() => []);
    const duty = {}; room.filter(r => r.id.startsWith('duty-')).forEach(r => duty[r.who] = (duty[r.who] || 0) + 1);
    const mem = room.find(r => r.id === 'game-memory') || {}, puz = room.find(r => r.id === 'game-puzzle') || {};
    const vs = mem.vs || {}, tot = Object.values(vs).reduce((a, v) => ({ w:a.w + v.w, l:a.l + v.l, d:a.d + v.d }), { w:0, l:0, d:0 });
    const games = tot.w + tot.l + tot.d, arts = room.filter(r => r.id.startsWith('art-')).length, reps = room.filter(r => r.id.startsWith('report-')).length;
    const dl = Object.entries(duty).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ n:NAME[k] || k, v }));
    const vl = Object.entries(vs).map(([k, v]) => ({ n:NAME[k] || k, v:v.l, s:v })).sort((a, b) => b.v - a.v);   // l＝当番の負け＝先生の勝ち
    return kpi([['当番の日', Object.values(duty).reduce((a, b) => a + b, 0), '日'], ['記事', arts, '本'], ['日報', reps, '通'], ['神経衰弱', games ? Math.round(tot.l / games * 100) + '%' : '—', '勝率']])
      + card('当番になった回数', dl.length ? bars(dl) : emp('まだ記録がありません'))
      + card('神経衰弱 対戦（先生の勝ち数）', vl.length ? bars(vl.map(x => ({ n:x.n, v:x.v })), v => v + '勝') + `<p class="snote">全体 ${tot.l}勝 ${tot.w}敗 ${tot.d}分</p>` : emp('対戦するとここに出ます'))
      + card('パズル', `<p class="snum">クリアした絵 <b>${Object.keys(puz.best || {}).length}</b> 種類（サイズ別）</p>`);
  }
  async function pAI() {
    const ms = lastMonths(6), cur = S.ai[month()];
    const by = cur && cur.by || {}, keys = Object.keys(by).sort((a, b) => by[b] - by[a]);
    const yen = v => '¥' + (v < 1 ? v.toFixed(1) : Math.round(v));
    return kpi([['今月', cur ? yen(cur.spent) : '—', cur ? `上限 ¥${cur.limit}` : '未取得'], ['使った割合', cur && cur.limit ? Math.round(cur.spent / cur.limit * 100) + '%' : '—', '']])
      + card('月ごとの金額', line([{ n:'金額', v:ms.map(x => S.ai[x] ? S.ai[x].spent : null), c:C[1] }], ms.map(x => +x.slice(5) + '月'), v => '¥' + Math.round(v)), '6か月')
      + card('今月の使いみち', keys.length ? bars(keys.map(k => ({ n:TAG[k] || k, v:by[k] })), yen) : emp('自室か作戦室を開くと、最新の金額を取りにいきます'));
  }
  const TABS = [['todo', 'Todo', pTodo], ['life', '生活', pLife], ['self', '先生', pSelf], ['play', 'あそび', pPlay], ['ai', 'AI', pAI]];
  async function html() {
    await load();
    const t = TABS.find(x => x[0] === tab) || TABS[0];
    return `<div class="stabs">${TABS.map(([k, n]) => `<button data-st="${k}" class="${k === t[0] ? 'on' : ''}">${n}</button>`).join('')}</div><div class="sbody">${await t[2]()}</div>`;
  }

  return {
    noteOpen, noteSelf, noteAI, html,
    setTab(k) { tab = k; },
    init() { setTimeout(() => noteOpen().catch(() => {}), 3000); },
  };
})();
App.modules.push(Stats);
