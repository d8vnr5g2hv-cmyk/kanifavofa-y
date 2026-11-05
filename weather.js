// Yohei Support — 天気予報（ミカのお天気スタジオ）。場所は大阪固定、データは Open-Meteo（キー不要・3時間キャッシュ）
'use strict';
const Wx = (() => {
  const LAT = 34.69, LON = 135.50, KEY = 'ys-wx3', TTL = 3 * 3600e3;
  const WMO = c => c == null ? '' : c === 0 ? '快晴' : c === 1 ? '晴れ' : c === 2 ? '晴れ時々くもり' : c === 3 ? 'くもり' : c <= 48 ? '霧' : c <= 57 ? '霧雨' : c <= 67 ? '雨' : c <= 77 ? '雪' : c <= 82 ? 'にわか雨' : c <= 86 ? 'にわか雪' : '雷雨';
  const wet = c => c >= 51 && c <= 99 && !(c >= 71 && c <= 77) && !(c >= 85 && c <= 86);
  const snowy = c => (c >= 71 && c <= 77) || c === 85 || c === 86;
  let mem = null;

  function load() { try { return JSON.parse(LS.get(KEY) || 'null'); } catch (e) { return null; } }
  async function fetchRaw() {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,apparent_temperature,weather_code` +
      `&hourly=temperature_2m,weather_code,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&timezone=Asia%2FTokyo&past_days=1&forecast_days=2`;
    const ac = new AbortController(), to = setTimeout(() => ac.abort(), 8000);
    try { const r = await fetch(u, { cache:'no-store', signal:ac.signal }); if (!r.ok) throw new Error('http'); return await r.json(); }
    finally { clearTimeout(to); }
  }
  // 生のデータ → 画面で使う形
  function shape(j, at) {
    const t = D.today(), di = j.daily.time.indexOf(t), dy = j.daily.time.indexOf(D.add(t, -1)), dt = j.daily.time.indexOf(D.add(t, 1));
    const day = i => i < 0 ? null : { date:j.daily.time[i], code:j.daily.weather_code[i], text:WMO(j.daily.weather_code[i]), max:Math.round(j.daily.temperature_2m_max[i]), min:Math.round(j.daily.temperature_2m_min[i]), rain:j.daily.precipitation_probability_max[i] ?? 0 };
    const H = j.hourly.time.map((s, i) => ({ s, date:s.slice(0, 10), h:+s.slice(11, 13), t:Math.round(j.hourly.temperature_2m[i]), code:j.hourly.weather_code[i], p:j.hourly.precipitation_probability[i] ?? 0 }));
    return { at, now:{ t:Math.round(j.current.temperature_2m), feel:Math.round(j.current.apparent_temperature ?? j.current.temperature_2m), code:j.current.weather_code, text:WMO(j.current.weather_code) },
      today:day(di), yday:day(dy), tomorrow:day(dt), H };
  }
  async function get(force) {
    if (!mem) mem = load();
    if (!force && mem && Date.now() - mem.at < TTL && mem.j) return shape(mem.j, mem.at);
    try { const j = await fetchRaw(); mem = { at:Date.now(), j }; LS.set(KEY, JSON.stringify(mem)); }
    catch (e) { if (!mem || !mem.j) return null; }   // 通信できないときは前回のデータ
    try { return shape(mem.j, mem.at); } catch (e) { return null; }
  }
  // これからの6コマ（3時間ごと）
  function slots(w) {
    const now = new Date(), t = D.today(), cur = now.getHours();
    const first = Math.ceil((cur + 1) / 3) * 3, out = [];
    for (let k = 0; k < 6; k++) {
      const hh = first + k * 3, date = hh >= 24 ? D.add(t, Math.floor(hh / 24)) : t, h = hh % 24;
      const x = w.H.find(r => r.date === date && r.h === h); if (x) out.push(Object.assign({ label:h === 0 ? '24時' : h + '時' }, x));
    }
    return out;
  }
  // これから雨が降りだす時刻（今日のうち）
  function rainFrom(w) {
    const t = D.today(), cur = new Date().getHours();
    const r = w.H.find(x => x.date === t && x.h >= cur && (x.p >= 50 || wet(x.code)));
    return r ? r.h : null;
  }

  // ===== 絵（コードで描くアイコン） =====
  function icon(code, night, big) {
    const sun = '<circle cx="24" cy="24" r="11" fill="#ffc94d"/><g stroke="#ffc94d" stroke-width="3" stroke-linecap="round"><path d="M24 4v5M24 39v5M4 24h5M39 24h5M10 10l3.5 3.5M34.5 34.5L38 38M10 38l3.5-3.5M34.5 13.5L38 10"/></g>';
    const moon = '<path d="M30 8a15 15 0 1 0 12 22A12 12 0 0 1 30 8z" fill="#ffe08a"/>';
    const cloud = (x = 0, y = 0, f = '#fff', s = '#bcd4ee') => `<path transform="translate(${x} ${y})" d="M18 50h30a10 10 0 0 0 0-20 14 14 0 0 0-27 4 8 8 0 0 0-3 16z" fill="${f}" stroke="${s}" stroke-width="2"/>`;
    const drops = '<g stroke="#3a8be0" stroke-width="3" stroke-linecap="round"><path d="M24 54l-2 6M33 54l-2 6M42 54l-2 6"/></g>';
    const flakes = '<g fill="#8cc4ff"><circle cx="23" cy="57" r="2.4"/><circle cx="33" cy="59" r="2.4"/><circle cx="43" cy="57" r="2.4"/></g>';
    const bolt = '<path d="M34 50l-6 9h5l-3 7 9-11h-5l3-5z" fill="#ffc94d"/>';
    const lit = night ? moon : sun;
    let g;
    if (code <= 1) g = lit;
    else if (code === 2) g = `<g transform="translate(-4 -6) scale(.85)">${lit}</g>` + cloud(4, -2);
    else if (code === 3 || code <= 48) g = cloud(-6, -10, '#eef3fa') + cloud(4, -2);
    else if (snowy(code)) g = cloud(2, -8, '#e6edf6', '#a9bfd8') + flakes;
    else if (code >= 95) g = cloud(2, -8, '#d5dfeb', '#93a9c4') + bolt + drops;
    else g = cloud(2, -8, '#dfe8f3', '#a9bfd8') + drops;
    return `<svg viewBox="0 0 64 64" class="${big ? 'big' : ''}">${g}</svg>`;
  }

  // ===== その日の服（ユーザー向けのチップ） =====
  function chips(w) {
    const d = w.today || { max:w.now.t, min:w.now.t, rain:0 }, out = [];
    const rf = rainFrom(w), rain = Math.max(d.rain || 0, ...slots(w).map(s => s.p));
    if (d.min <= 5) out.push(['コートとマフラー', 'o']); else if (d.min <= 10) out.push(['コート', 'o']); else if (d.min <= 15) out.push(['薄手のコート', 'o']); else if (d.max <= 22) out.push(['カーディガン', 'o']);
    out.push([d.max >= 26 ? '半袖' : d.max >= 12 ? '長袖シャツ' : 'あったかいインナー', 'o']);
    if (d.max - d.min >= 10) out.push(['脱ぎ着しやすい服', 'o']);
    if (rain >= 70 || (w.today && wet(w.today.code) && rain >= 50)) out.push(['傘', 'u']); else if (rain >= 40 || rf != null) out.push(['折りたたみ傘', 'u']);
    if (d.max >= 30) out.push(['水分補給', 'u']);
    return out.slice(0, 4);
  }

  // ===== ミカ：服は日替わり（最低気温5°以下の日だけ冬コート）、表情は天気で =====
  const ROT = ['shirt', 'layer', 'knit', 'blouse', 'tweed'];
  const HAS_HAPPY = { shirt:1 };   // 笑顔の絵がある服（ファイルを足したらここに足す）
  function mika(w) {
    const d = w.today || { max:w.now.t, min:w.now.t, rain:0, code:w.now.code };
    const n = Math.floor(D.parse(D.today()).getTime() / 86400000);
    const outfit = d.min <= 5 ? 'coat' : ROT[((n % ROT.length) + ROT.length) % ROT.length];
    const jump = w.yday ? d.max - w.yday.max : 0, rf = rainFrom(w);
    const worry = wet(d.code) || snowy(d.code) || d.rain >= 50 || d.max >= 33 || d.min <= 0 || Math.abs(jump) >= 7;
    const happy = !worry && d.code <= 1 && d.rain <= 20;
    const face = worry ? 'w' : happy && HAS_HAPPY[outfit] ? 'h' : 'n';
    const hr = new Date().getHours();
    const L = [];
    L.push(`${hr < 11 ? 'おはよう' : hr < 17 ? 'こんにちは' : 'こんばんは'}、先生☆ 今日は${d.text}、最高${d.max}°・最低${d.min}°だよ。`);
    const ch = chips(w), umb = (ch.find(c => /傘/.test(c[0])) || [])[0];
    if (rf != null && rf > hr) L.push(`${rf}時ごろから雨っぽいから、${umb || '折りたたみ傘'}は忘れないでね☆`);
    else if (umb) L.push(`雨の確率が高めだから、${umb}を持っていってね☆`);
    if (Math.abs(jump) >= 7) L.push(`昨日より${Math.abs(jump)}°も${jump > 0 ? '暑い' : '寒い'}から、服で調整してね！`);
    else if (d.min <= 5) L.push('朝と夜はかなり冷えるから、マフラーもあると安心だよ');
    else if (d.max >= 30) L.push('あついから、お水ちゃんと飲んでね☆');
    if (L.length === 1) L.push(d.code <= 2 ? '気持ちいい一日になりそう☆ 先生も楽しんでね！' : 'すっきりしない空だけど、私がついてるじゃんね☆');
    return { outfit, face, src:`wx_${outfit}_${face}.webp`, line:L.slice(0, 3).join(''), chips:ch };
  }

  // ===== 画面（お天気スタジオ）：box の中に描く =====
  // o.btn：ボタンの文字／o.onBtn：押したとき
  function render(box, w, o = {}) {
    const now = new Date(), M = mika(w), d = w.today || { max:w.now.t, min:w.now.t, rain:0, code:w.now.code, text:w.now.text };
    const night = h => h >= 18 || h < 5;
    const sl = slots(w), rain = Math.max(d.rain || 0, 0);
    box.innerHTML = `<div class="wx">
      <div class="wx-bg"></div>
      <div class="wx-top"><div><em>WEATHER</em><b>今日の天気</b></div><span>${now.getMonth() + 1}月${now.getDate()}日（${D.dow(D.today())}）・大阪</span></div>
      <div class="wx-board">
        <div class="wx-now">${icon(d.code, false, true)}
          <div class="wx-temp"><b>${d.max}°</b><i>${d.min}°</i><small>${esc(d.text)}${rainFrom(w) != null && rainFrom(w) > now.getHours() && !wet(d.code) ? ' ・ ' + rainFrom(w) + '時ごろから雨' : ''}</small></div>
          <div class="wx-rain"><small>降水確率</small><b>${rain}%</b></div></div>
        <div class="wx-hours">${sl.map(s => `<div class="wx-h">${s.label}${icon(s.code, night(s.h))}<b>${s.t}°</b>${s.p >= 30 ? `<u>${s.p}%</u>` : '<u></u>'}</div>`).join('')}</div>
        <div class="wx-wear">${M.chips.map(([t, k]) => `<span class="${k}">${esc(t)}</span>`).join('')}</div>
        <div class="wx-feel">いまの気温 <b>${w.now.t}°</b>　体感 <b>${w.now.feel}°</b></div>
      </div>
      <div class="wx-bubble"><b>MIKA</b>${esc(M.line)}</div>
      <img class="wx-mika" src="${M.src}" alt="" onerror="this.onerror=null;this.src='wx_${M.outfit}_n.webp'">
      <div class="wx-desk"><i class="tp"></i><i class="fr"></i><div class="lbl">MORNING WEATHER</div>
        <button class="wx-go">${esc(o.btn || '今日をはじめる')}</button></div>
    </div>`;
    const go = box.querySelector('.wx-go');
    go.onclick = e => { e.stopPropagation(); haptic(); if (o.onBtn) o.onBtn(); };
    const im = box.querySelector('.wx-mika'); im.decode && im.decode().catch(() => {});
    return M;
  }
  // 単体で開く（秘書室から）
  async function open() {
    const w = await get(); if (!w) return toast('天気を取得できませんでした');
    const ov = h('<div class="wxov"><button class="wxx" aria-label="閉じる">×</button><div class="wxbox"></div></div>');
    document.body.appendChild(ov);
    const close = () => Wipe.mid(() => ov.remove());
    render(ov.querySelector('.wxbox'), w, { btn:'とじる', onBtn:close });
    ov.querySelector('.wxx').onclick = close;
    Wipe.mid(() => ov.classList.add('on'));
    Cast.note('mika');
  }
  // ほかの部屋に渡す短い要約
  async function brief() {
    const w = await get().catch(() => null); if (!w || !w.today) return null;
    const rf = rainFrom(w);
    return { text:w.today.text, max:w.today.max, min:w.today.min, rain:w.today.rain, rainFrom:rf, wet:wet(w.now.code), umbrella:chips(w).some(c => /傘/.test(c[0])) };
  }
  return { get, render, open, mika, chips, brief, icon, WMO, wet };
})();
