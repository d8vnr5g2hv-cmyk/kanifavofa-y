// Yohei Support — みんなで共有する生活データ（どの部屋からも同じものを読み書きする）
// 保存先：DB 'room' ストア（life-…＝生活DB／day-日付＝その日の記録／fr-…＝友好関係／rabbit＝ウサギ）と 'settings'
'use strict';
const Life = (() => {
  const DM = { home:'住まい', bed:'寝具', appl:'家電', clothes:'服', food:'食', vice:'お酒・タバコ', habit:'いつもの一日', work:'仕事', play:'遊び', body:'からだ', money:'お金' };
  const subs = [];
  const onChange = f => subs.push(f);
  const changed = what => subs.forEach(f => { try { f(what); } catch (e) {} });
  const all = async pre => (await DB.all('room').catch(() => [])).filter(r => r.id.startsWith(pre));
  const getS = async (id, def) => (await DB.get('settings', id).catch(() => null)) || def;
  const putS = o => DB.put('settings', o).catch(() => {});

  // ===== 生活DB =====
  async function items(dm) { const l = await all('life-'); return dm ? l.filter(x => x.dm === dm) : l; }
  async function put(x) { x.id = x.id || 'life-' + newId(); x.at = x.at || new Date().toISOString(); await DB.put('room', x); changed('life'); return x; }
  async function del(id) { await DB.del('room', id); changed('life'); }

  // ===== その日の記録 =====
  const dayId = d => 'day-' + d;
  async function day(d = D.today()) { return (await DB.get('room', dayId(d)).catch(() => null)) || { id:dayId(d), date:d }; }
  async function setDay(d, patch) { const r = await day(d); Object.assign(r, patch); await DB.put('room', r); changed('day'); return r; }
  async function days(n, end = D.today()) { return Promise.all(Array.from({ length:n }, (_, i) => day(D.add(end, i - n + 1)))); }
  // 数えるもの（お酒・タバコなど）
  async function count(k, add, d = D.today()) { const r = await day(d); r[k] = Math.max(0, (r[k] || 0) + add); await DB.put('room', r); changed('day'); return r[k]; }
  // 睡眠時間（時間）：bed '01:30' → wake '07:45'
  function sleepH(s) {
    if (!s || !s.bed || !s.wake) return null;
    const m = t => { const [h, mi] = t.split(':').map(Number); return h * 60 + mi; };
    let v = m(s.wake) - m(s.bed); if (v <= 0) v += 1440; return Math.round(v / 6) / 10;
  }

  // ===== 食事（執務室から移した記録をそのまま使う：room 'food-日付'） =====
  async function food(d = D.today()) { return (await DB.get('room', 'food-' + d).catch(() => null)) || { id:'food-' + d, date:d, meals:{} }; }

  // ===== 友好関係 =====
  async function friends() {
    let l = await all('fr-');
    if (!l.length && !(await getS('ys-frMigrated', null))) {   // 前のProfileの人物を一度だけ引っ越す
      const old = (await DB.all('profile').catch(() => [])).filter(p => p.kind === 'person' && p.name);
      for (const p of old) await DB.put('room', { id:'fr-' + newId(), name:p.name, tier:'friend', rel:'', group:'', memo:'', params:{}, links:[], at:Date.now() });
      await putS({ id:'ys-frMigrated', v:1 });
      l = await all('fr-');
    }
    return l;
  }

  // ===== 家事と在庫 =====
  async function chores() { return (await getS('ys-chores', { id:'ys-chores', list:[] })).list; }
  async function setChores(list) { await putS({ id:'ys-chores', list }); changed('chores'); }
  async function stock() { return (await getS('ys-stock', { id:'ys-stock', list:[] })).list; }
  async function setStock(list) { await putS({ id:'ys-stock', list }); changed('stock'); }
  // 在庫の残り日数：残り ÷ 1日に減る量
  const stockDays = s => s.perDay > 0 && s.left != null && s.left !== '' ? Math.floor(s.left / s.perDay) : null;

  // ===== プロフィールと場所 =====
  async function me() { return getS('ys-me', { id:'ys-me', name:'ようへい', call:'ようへい' }); }
  async function area() { return getS('ys-area', { id:'ys-area', name:'大阪（北浜）', lat:34.69, lon:135.51 }); }

  // ===== 天気（open-meteo、1時間ごと） =====
  let wx = null;
  const WMO = c => c == null ? '' : c === 0 ? '晴れ' : c <= 2 ? '晴れ時々くもり' : c === 3 ? 'くもり' : c <= 48 ? '霧' : c <= 67 ? '雨' : c <= 77 ? '雪' : c <= 82 ? 'にわか雨' : c <= 86 ? 'にわか雪' : '雷雨';
  async function weather() {
    if (wx && Date.now() - wx.at < 3600e3) return wx;
    const a = await area();
    try {
      const u = `https://api.open-meteo.com/v1/forecast?latitude=${a.lat}&longitude=${a.lon}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FTokyo&forecast_days=2`;
      const j = await (await fetch(u, { cache:'no-store' })).json();
      wx = { at:Date.now(), now:Math.round(j.current.temperature_2m), code:j.current.weather_code, text:WMO(j.current.weather_code),
        days:j.daily.time.map((t, i) => ({ date:t, code:j.daily.weather_code[i], text:WMO(j.daily.weather_code[i]), max:Math.round(j.daily.temperature_2m_max[i]), min:Math.round(j.daily.temperature_2m_min[i]), rain:j.daily.precipitation_probability_max[i] })) };
    } catch (e) { wx = wx || null; }
    return wx;
  }

  // ===== ストレスチェック =====
  const k6Key = d => { const x = D.parse(d), dow = (x.getDay() + 6) % 7; return D.add(d, -dow); };   // 週の月曜
  const bjKey = d => d.slice(0, 7);
  async function checks() { return getS('ys-checks', { id:'ys-checks', k6:{}, bj:{} }); }
  async function saveCheck(kind, key, v) { const c = await checks(); c[kind][key] = v; await putS(c); changed('check'); }

  // ===== ほかの部屋に見せる「いまの状態」（AIにも渡す） =====
  async function snapshot() {
    const t = D.today(), ds = await days(7), td = ds[6], f = await food(t);
    const todos = (await DB.all('todos').catch(() => [])).filter(x => !x.done);
    const evs = (await DB.all('events').catch(() => [])).filter(e => e.date >= t && e.date <= D.add(t, 7)).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
    const st = await stock(), ch = await chores(), w = await weather();
    const money = typeof Office !== 'undefined' && Office.summary ? await Office.summary().catch(() => null) : null;
    const c = await checks(), k6 = c.k6[k6Key(t)];
    const fr = (await friends()).map(p => `${p.name}（${p.rel || TIER[p.tier] || ''}）`).slice(0, 20);
    const rb = typeof Rabbit !== 'undefined' ? await Rabbit.brief().catch(() => null) : null;
    const life = (await items()).filter(x => ['habit', 'food', 'vice', 'work', 'body'].includes(x.dm)).map(x => `${x.name}：${x.val}`).slice(0, 40);
    return {
      今日:`${D.ymd(t)}（${D.dow(t)}）`,
      天気:w ? `${w.text} ${w.now}℃（今日 ${w.days[0].max}/${w.days[0].min}℃ 降水${w.days[0].rain}%／明日 ${w.days[1] ? w.days[1].text : ''}）` : '不明',
      睡眠:ds.map(x => `${x.date.slice(5)} ${sleepH(x.sleep) ?? '-'}h`).join(' '),
      今日の体調:td.cond || '未記録', お酒:`今日${td.drink || 0}缶`, タバコ:`今日${td.smoke || 0}本`,
      食事:Object.entries(f.meals || {}).map(([k, m]) => `${{ b:'朝', l:'昼', d:'夜', s:'間食' }[k]}:${m.st === 'skip' ? '抜き' : m.text}`).join('／') || '未記録',
      お金:money || '未設定',
      やること:todos.slice(0, 15).map(x => x.title + (x.due ? `（${D.md(x.due)}まで）` : '')),
      予定:evs.slice(0, 10).map(e => `${D.md(e.date)} ${e.time || ''} ${e.title}`),
      在庫:st.map(s => `${s.name} 残り${stockDays(s) ?? '?'}日`),
      家事:ch.map(x => `${x.name} 前回から${x.last ? D.diff(t, x.last) : '?'}日（${x.every}日ごと）`),
      ストレス:k6 != null ? `今週のK6 ${k6}点` : '今週は未実施', 毎日の3問:td.chk ? td.chk.join('/') : '未実施',
      ひと:fr, ウサギ:rb || 'なし', いつもの生活:life,
    };
  }
  const TIER = { family:'家族', best:'親友', friend:'友達', known:'知り合い', work:'職場' };

  // ===== 初期データの読み込み（秘書アプリの初期データ／書き出したファイル） =====
  async function importSeed(d) {
    const iso = new Date().toISOString();
    if (Array.isArray(d.life)) {
      for (const x of await items()) await DB.del('room', x.id);
      for (const x of d.life) await DB.put('room', { id:'life-' + (x.id || newId()), dm:x.dm, cat:x.cat || '', name:x.name, val:x.val, state:x.state || 'sure', at:x.at || iso });
    }
    if (Array.isArray(d.people)) {
      for (const x of await all('fr-')) await DB.del('room', x.id);
      for (const p of d.people) await DB.put('room', { id:'fr-' + (p.id || newId()), name:p.name, tier:p.tier || (p.rel === '家族' ? 'family' : 'friend'), rel:p.rel || '', group:p.group || '', memo:p.memo || '', birthday:p.birthday || '', lastMet:p.lastMet || '', params:p.params || {}, links:(p.links || []).map(x => String(x).startsWith('fr-') ? x : 'fr-' + x), at:Date.now() });
      await putS({ id:'ys-frMigrated', v:1 });
    }
    if (Array.isArray(d.chores)) await setChores(d.chores.map(c => ({ id:c.id || newId(), name:c.name, every:c.every || 2, last:c.last || null })));
    if (Array.isArray(d.stock)) await setStock(d.stock);
    if (Array.isArray(d.usual)) await putS({ id:'ys-usual', list:d.usual });
    if (d.profile) await putS(Object.assign({ id:'ys-me' }, d.profile));
    if (d.area) await putS(Object.assign({ id:'ys-area' }, d.area));
    if (d.money && typeof Office !== 'undefined') await Office.importMoney(d.money);
    if (d.rabbit && typeof Rabbit !== 'undefined') await Rabbit.importSeed(d.rabbit);
    changed('all');
  }
  async function usual() { return (await getS('ys-usual', { list:[] })).list; }

  return { DM, TIER, onChange, changed, items, put, del, day, setDay, days, count, sleepH, food, friends, chores, setChores, stock, setStock, stockDays,
    me, area, weather, checks, saveCheck, k6Key, bjKey, snapshot, importSeed, usual, getS, putS };
})();
