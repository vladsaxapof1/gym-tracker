'use strict';
/* Дневник тренировок — одностраничное приложение без зависимостей.
   Данные хранятся в localStorage (ключ KEY), бэкап — экспорт/импорт JSON. */

const KEY = 'gymlog.v1';
const TIMER_KEY = 'gymlog.timer';

// ───────────────────────── Утилиты ─────────────────────────
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clone = (o) => JSON.parse(JSON.stringify(o));
const pad = (n) => String(n).padStart(2, '0');
const num = (v) => {
  if (v === '' || v == null) return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const r1 = (x) => Math.round(x * 10) / 10;
const fmtW = (w) => (w == null || w === '' ? '—' : String(Math.round(w * 100) / 100).replace('.', ','));
const fmtInt = (n) => Math.round(n).toLocaleString('ru-RU');
const fmtRest = (sec) => `${Math.floor(sec / 60)}:${pad(sec % 60)}`;
const plural = (n, a, b, c) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return a;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return b;
  return c;
};
const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const WD = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const dayStart = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const weekStart = (d) => { const x = dayStart(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const dkey = (d) => { d = new Date(d); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const daysBetween = (a, b) => Math.round((dayStart(b) - dayStart(a)) / 864e5);
const fmtD = (iso) => {
  const d = new Date(iso);
  return `${d.getDate()} ${MON[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''}`;
};
const agoStr = (iso) => {
  const n = daysBetween(iso, new Date());
  if (n <= 0) return 'сегодня';
  if (n === 1) return 'вчера';
  return `${n} ${plural(n, 'день', 'дня', 'дней')} назад`;
};
const roundTo = (x, step) => Math.round(x / step) * step;

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('on'), 2400);
}

const IC = {
  workout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6.5 6v12M17.5 6v12M3 9v6M21 9v6M6.5 12h11"/></svg>',
  program: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/></svg>',
  stats: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 20h18M6 16v-4M11 16V6M16 16v-7M21 16v-2"/></svg>',
  body: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4.5" r="2.2"/><path d="M5 9h14M12 9v6M8.5 21.5L12 15l3.5 6.5"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  chev: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  up: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg>',
  x: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};

// ───────────────────────── Состояние ─────────────────────────
function fresh() {
  return {
    version: 1,
    settings: {
      theme: 'auto', rest: 90, sound: true, wake: true,
      inc: { barbell: 2.5, dumbbell: 2, machine: 5, cable: 2.5, bodyweight: 2.5 },
    },
    program: clone(DEFAULT_PROGRAM),
    custom: {},
    sessions: [],
    active: null,
    next: 0,
    body: [],
    lastBackup: null,
    ui: { tab: 'workout', statEx: null, bodyMetric: 'weight', volWin: 7, histN: 15 },
  };
}

function migrate(s) {
  const f = fresh();
  s.settings = { ...f.settings, ...(s.settings || {}), inc: { ...f.settings.inc, ...((s.settings || {}).inc || {}) } };
  for (const k of ['program', 'custom', 'sessions', 'active', 'next', 'body', 'lastBackup']) if (s[k] === undefined) s[k] = f[k];
  s.ui = { ...f.ui, ...(s.ui || {}) };
  s.sessions.sort((a, b) => a.start.localeCompare(b.start));
  s.body.sort((a, b) => a.date.localeCompare(b.date));
  return s;
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.version) return migrate(s);
  } catch (e) { /* повреждённые данные — начнём заново */ }
  return fresh();
}

let S = load();

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast('Не удалось сохранить: ' + e.message); }
}

// ───────────────────────── Упражнения ─────────────────────────
const getEx = (id) => S.custom[id] || EXERCISES[id] || { name: `${id} (удалено)`, equip: 'machine', p: [], s: [], tips: [] };
const isCardio = (id) => getEx(id).equip === 'cardio';
const allExIds = () => [...Object.keys(EXERCISES), ...Object.keys(S.custom)];
const incFor = (ex) => ex.inc ?? S.settings.inc[ex.equip] ?? 2.5;
const repsKind = (ex) => ex.equip === 'bodyweight' || ex.unit === 'sec';
const unitLbl = (ex) => (ex.unit === 'sec' ? ' с' : '');
const musclesShort = (ex) => ex.p.map((m) => MUSCLES[m]).join(', ');
const e1rm = (w, r) => (r <= 0 ? 0 : r === 1 ? w : w * (1 + r / 30));

// История упражнения (хронологически): [{s: session, e: entry}]
function exHistory(id) {
  const out = [];
  for (const s of S.sessions) for (const e of s.entries) if (e.ex === id && e.sets && e.sets.length) out.push({ s, e });
  return out;
}

// Главная метрика прогресса: расчётный 1ПМ, а для упражнений с собственным весом — лучший подход (повторы/сек)
function entryMetric(ex, e) {
  if (!e.sets || !e.sets.length) return null;
  if (repsKind(ex)) return Math.max(...e.sets.map((s) => s.r + (s.w > 0 ? s.w / 2.5 : 0)));
  return Math.max(...e.sets.map((s) => e1rm(s.w, s.r)));
}
const metricName = (ex) => (repsKind(ex) ? (ex.unit === 'sec' ? 'Лучший подход, с' : 'Лучший подход, повт.') : 'Расчётный 1ПМ, кг');

function setsStr(ex, sets) {
  if (!sets.length) return '—';
  const ws = [...new Set(sets.map((s) => s.w))];
  const u = ex.unit === 'sec' ? ' с' : '';
  if (ws.length === 1) {
    const w = ws[0];
    const reps = sets.map((s) => s.r).join(', ');
    if (!w && ex.equip === 'bodyweight') return `${reps}${u}`;
    return `${fmtW(w)} кг × ${reps}${u}`;
  }
  return sets.map((s) => `${fmtW(s.w)}×${s.r}`).join(', ');
}

// Двойная прогрессия: закрыл верх диапазона во всех рабочих подходах → прибавляем вес
function suggest(id, t) {
  const ex = getEx(id);
  const h = exHistory(id);
  if (!h.length) {
    return { kind: 'new', w: null, r: t.min, text: 'Первый раз: подбери вес, при котором последние 1–2 повтора даются тяжело, но без поломки техники.' };
  }
  const last = h[h.length - 1].e.sets;
  const topW = Math.max(...last.map((s) => s.w || 0));
  const atTop = last.filter((s) => (s.w || 0) === topW);
  const inc = incFor(ex);
  const lastStr = setsStr(ex, last);
  const u = ex.unit === 'sec' ? ' с' : '';
  const bw = ex.equip === 'bodyweight';

  if (atTop.length >= t.sets && atTop.filter((s) => s.r >= t.max).length >= t.sets) {
    const nw = Math.round((topW + inc) * 4) / 4;
    const wTxt = bw ? `+${fmtW(nw)} кг` : `${fmtW(nw)} кг`;
    return { kind: 'up', w: nw, r: t.min, text: `<b>↑ ${wTxt}</b> × ${t.min}–${t.max}${u}. Прошлый раз: ${lastStr} — диапазон закрыт.` };
  }
  if (h.length >= 3) {
    const l3 = h.slice(-3).map((x) => {
      const tw = Math.max(...x.e.sets.map((s) => s.w || 0));
      return { tw, reps: x.e.sets.filter((s) => (s.w || 0) === tw).reduce((a, s) => a + s.r, 0) };
    });
    if (l3.every((x) => x.tw === topW) && l3[2].reps <= l3[0].reps && topW > 0) {
      const dw = Math.max(0, roundTo(topW * 0.9, inc));
      return { kind: 'stall', w: topW, r: t.min, text: `Застой 3 тренировки на ${fmtW(topW)} кг. Вариант: разгрузка <b>${fmtW(dw)} кг</b> и снова набирать повторы. Прошлый раз: ${lastStr}.` };
    }
  }
  const minR = Math.min(...atTop.map((s) => s.r));
  const goal = Math.min(t.max, Math.max(t.min, minR + 1));
  const wTxt = bw ? (topW ? `+${fmtW(topW)} кг` : 'свой вес') : `${fmtW(topW)} кг`;
  const heavy = atTop.every((s) => s.r < t.min);
  return {
    kind: heavy ? 'stall' : 'keep', w: topW, r: goal,
    text: heavy
      ? `Вес тяжеловат: не набрал ${t.min}${u} ни в одном подходе. Оставь <b>${wTxt}</b> или сбавь на шаг. Прошлый раз: ${lastStr}.`
      : `<b>${wTxt}</b> — добей до ${t.max}${u} во всех подходах. Прошлый раз: ${lastStr}.`,
  };
}

function warmupStr(w) {
  if (!w || w < 40) return '';
  const steps = [[0.5, 6], [0.7, 3], [0.85, 1]].map(([p, r]) => [roundTo(w * p, 2.5), r]).filter(([x]) => x > 20);
  return ['20 кг × 10', ...steps.map(([x, r]) => `${fmtW(x)} × ${r}`)].join(' → ');
}

// ───────────────────────── Схема мышц ─────────────────────────
function bodyMap(p = [], s = [], small = false) {
  const cls = (m) => (m === 'base' ? 'm-b' : p.includes(m) ? 'm-p' : s.includes(m) ? 'm-s' : 'm-n');
  const fig = (shapes) => {
    const inner = shapes.map(([m, el]) => el.replace(/^<(\w+)/, `<$1 class="${cls(m)}"`)).join('');
    return `<g>${inner}</g><g transform="matrix(-1 0 0 1 100 0)">${inner}</g>`;
  };
  const label = [...p.map((m) => MUSCLES[m])].join(', ');
  return `<svg class="body-map" viewBox="0 0 210 176" ${small ? 'style="max-width:200px"' : ''} role="img" aria-label="Мышцы: ${esc(label)}">
    ${fig(BODY_SHAPES.front)}<g transform="translate(110 0)">${fig(BODY_SHAPES.back)}</g>
    <text x="50" y="174">спереди</text><text x="160" y="174">сзади</text></svg>`;
}
const mapLegend = () => `<div class="legend"><span><i style="background:var(--accent)"></i>основные</span><span><i style="background:var(--m-sec)"></i>вспомогательные</span></div>`;

function dayMuscles(day) {
  const p = new Set(), s = new Set();
  for (const it of day.items) { const ex = getEx(it.ex); ex.p.forEach((m) => p.add(m)); ex.s.forEach((m) => s.add(m)); }
  return { p: [...p], s: [...s].filter((m) => !p.has(m)) };
}

// ───────────────────────── Графики ─────────────────────────
let pendingCharts = [];
let chartSeq = 0;
function chartSlot(spec) {
  const id = 'ch' + ++chartSeq;
  pendingCharts.push({ id, ...spec });
  return `<div class="chart" id="${id}"></div>`;
}
function drawCharts() {
  const list = pendingCharts;
  pendingCharts = [];
  for (const c of list) {
    const el = document.getElementById(c.id);
    if (!el) continue;
    if (c.type === 'line') drawLine(el, c);
    else drawBars(el, c);
  }
}
function niceTicks(min, max, n = 4) {
  const range = max - min || Math.abs(max) || 1;
  const raw = range / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
  const st = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
  const a = Math.floor(min / st) * st, b = Math.ceil(max / st) * st;
  const out = [];
  for (let v = a; v <= b + st / 2; v += st) out.push(+v.toFixed(6));
  if (out.length < 2) out.push(a + st);
  return out;
}
const tickLbl = (v) => (Math.abs(v) >= 1000 ? fmtInt(v) : String(+v.toFixed(1)).replace('.', ','));

function attachTip(el, W, points, show) {
  const tip = document.createElement('div');
  tip.className = 'tip';
  el.appendChild(tip);
  const move = (ev) => {
    const r = el.getBoundingClientRect();
    const x = ev.clientX - r.left;
    let best = 0, bd = Infinity;
    points.forEach((p, i) => { const d = Math.abs(p.px - x); if (d < bd) { bd = d; best = i; } });
    const p = points[best];
    show(p);
    tip.innerHTML = p.tip;
    tip.style.left = Math.min(Math.max(p.px, 70), W - 70) + 'px';
    tip.style.top = p.py - 12 + 'px';
    tip.classList.add('on');
  };
  el.addEventListener('pointerdown', move);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerleave', (ev) => { if (ev.pointerType === 'mouse') { tip.classList.remove('on'); show(null); } });
  el._hide = () => { tip.classList.remove('on'); show(null); };
}
document.addEventListener('pointerdown', (ev) => {
  document.querySelectorAll('.chart').forEach((c) => { if (!c.contains(ev.target) && c._hide) c._hide(); });
});

function drawLine(el, c) {
  const pts = [...c.pts].sort((a, b) => a.x - b.x);
  if (!pts.length) { el.innerHTML = `<div class="empty">${c.empty || 'Пока нет данных'}</div>`; return; }
  const W = el.clientWidth || 320, H = c.h || 190, P = { l: 40, r: 16, t: 16, b: 26 };
  let x0 = pts[0].x, x1 = pts[pts.length - 1].x;
  if (x0 === x1) { x0 -= 3 * 864e5; x1 += 3 * 864e5; }
  let ymin = Math.min(...pts.map((p) => p.y)), ymax = Math.max(...pts.map((p) => p.y));
  const padY = (ymax - ymin) * 0.12 || Math.max(1, ymax * 0.05);
  const yt = niceTicks(Math.max(0, ymin - padY), ymax + padY, 4);
  const y0 = yt[0], y1 = yt[yt.length - 1];
  const X = (v) => P.l + ((v - x0) / (x1 - x0)) * (W - P.l - P.r);
  const Y = (v) => P.t + (1 - (v - y0) / (y1 - y0)) * (H - P.t - P.b);
  let g = '';
  for (const t of yt) g += `<line class="grid" x1="${P.l}" x2="${W - P.r}" y1="${Y(t)}" y2="${Y(t)}"/><text class="tick" x="${P.l - 6}" y="${Y(t) + 4}" text-anchor="end">${tickLbl(t)}</text>`;
  const nx = W < 340 ? 3 : 4;
  for (let i = 0; i < nx; i++) {
    const v = x0 + ((x1 - x0) * i) / (nx - 1);
    g += `<text class="tick" x="${X(v)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === nx - 1 ? 'end' : 'middle'}">${fmtD(new Date(v))}</text>`;
  }
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
  const area = `${line}L${X(pts[pts.length - 1].x)},${Y(y0)}L${X(pts[0].x)},${Y(y0)}Z`;
  const dots = (pts.length <= 30 ? pts : [pts[pts.length - 1]])
    .map((p) => `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="4" fill="var(--s1)" stroke="var(--card)" stroke-width="2"/>`).join('');
  const lp = pts[pts.length - 1];
  const endLbl = `<text class="endlbl" x="${Math.min(X(lp.x), W - 2)}" y="${Y(lp.y) - 10}" text-anchor="${X(lp.x) > W - 40 ? 'end' : 'middle'}">${tickLbl(lp.y)}${c.unit || ''}</text>`;
  el.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${g}
    <path d="${area}" fill="var(--s1-soft)"/>
    <path d="${line}" fill="none" stroke="var(--s1)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <line class="xhair" y1="${P.t}" y2="${H - P.b}" style="display:none"/>
    ${dots}${endLbl}
    <circle class="focus" r="6" fill="var(--s1)" stroke="var(--card)" stroke-width="2" style="display:none"/></svg>`;
  const xh = el.querySelector('.xhair'), fc = el.querySelector('.focus');
  attachTip(el, W, pts.map((p) => ({ ...p, px: X(p.x), py: Y(p.y) })), (p) => {
    if (!p) { xh.style.display = fc.style.display = 'none'; return; }
    xh.style.display = fc.style.display = '';
    xh.setAttribute('x1', p.px); xh.setAttribute('x2', p.px);
    fc.setAttribute('cx', p.px); fc.setAttribute('cy', p.py);
  });
}

function drawBars(el, c) {
  const bars = c.bars;
  const W = el.clientWidth || 320, H = c.h || 160, P = { l: 28, r: 6, t: 14, b: 22 };
  const maxV = Math.max(...bars.map((b) => b.v), 0);
  const yt = niceTicks(0, Math.max(maxV, 2), 3).filter((v) => Number.isInteger(v) || !c.int);
  const y1 = yt[yt.length - 1];
  const Y = (v) => P.t + (1 - v / y1) * (H - P.t - P.b);
  const slot = (W - P.l - P.r) / bars.length;
  const bw = Math.min(24, slot * 0.62);
  let g = '';
  for (const t of yt) g += `<line class="${t === 0 ? 'base' : 'grid'}" x1="${P.l}" x2="${W - P.r}" y1="${Y(t)}" y2="${Y(t)}"/><text class="tick" x="${P.l - 6}" y="${Y(t) + 4}" text-anchor="end">${tickLbl(t)}</text>`;
  const step = Math.ceil(bars.length / (W < 360 ? 5 : 7));
  const pts = [];
  bars.forEach((b, i) => {
    const x = P.l + slot * i + (slot - bw) / 2;
    const y = Y(b.v), h = Y(0) - y;
    if (b.v > 0) {
      const r = Math.min(4, h, bw / 2);
      g += `<path d="M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + bw - r}Q${x + bw},${y} ${x + bw},${y + r}V${y + h}Z" fill="var(--s1)"/>`;
    }
    if ((bars.length - 1 - i) % step === 0) g += `<text class="tick" x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${b.label}</text>`;
    pts.push({ px: x + bw / 2, py: y, tip: b.tip });
  });
  el.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${g}<rect class="hl" y="${P.t}" height="${H - P.t - P.b}" fill="var(--text)" fill-opacity=".06" rx="4" style="display:none"/></svg>`;
  const hl = el.querySelector('.hl');
  attachTip(el, W, pts, (p) => {
    if (!p) { hl.style.display = 'none'; return; }
    hl.style.display = '';
    hl.setAttribute('x', p.px - slot / 2 + 1); hl.setAttribute('width', slot - 2);
  });
}

// ───────────────────────── Экран «Тренировка» ─────────────────────────
function nextDayId() {
  const cyc = S.program.cycle;
  return cyc[((S.next % cyc.length) + cyc.length) % cyc.length];
}
function lastSessionOf(dayId) {
  for (let i = S.sessions.length - 1; i >= 0; i--) if (S.sessions[i].day === dayId) return S.sessions[i];
  return null;
}
function itemLine(it) {
  const ex = getEx(it.ex);
  if (isCardio(it.ex)) return `${it.minutes} мин`;
  return `${it.sets} × ${it.min}–${it.max}${unitLbl(ex)}`;
}

function viewWorkout() {
  if (S.active) return viewActive();
  const cyc = S.program.cycle;
  const nid = nextDayId();
  const day = S.program.days[nid];
  const now = new Date();
  const last = S.sessions[S.sessions.length - 1];
  const mm = dayMuscles(day);
  const needBackup = S.sessions.length >= 5 && (!S.lastBackup || daysBetween(S.lastBackup, now) > 14);

  const preview = day.items.map((it) => {
    const ex = getEx(it.ex);
    let w = '';
    if (!isCardio(it.ex)) {
      const sg = suggest(it.ex, it);
      if (sg.w != null && !(ex.equip === 'bodyweight' && !sg.w)) w = `<span class="badge ${sg.kind === 'up' ? 'good' : ''}">${sg.kind === 'up' ? '↑ ' : ''}${ex.equip === 'bodyweight' ? '+' : ''}${fmtW(sg.w)} кг</span>`;
    }
    return `<button data-action="ex-info" data-id="${it.ex}"><div class="grow"><div class="t">${esc(ex.name)}</div><div class="d">${itemLine(it)}</div></div>${w}</button>`;
  }).join('');

  const others = cyc.map((id, i) => {
    const d = S.program.days[id];
    const ls = lastSessionOf(id);
    return `<button class="day-btn" data-action="start" data-day="${id}"><b>${esc(d.name)}</b><span>${ls ? agoStr(ls.start) : 'ещё не было'}</span></button>`;
  }).join('');

  const recent = S.sessions.slice(-3).reverse().map(sessionRow).join('');

  return `
  <header class="top"><div><div class="eyebrow">${WD[now.getDay()]}, ${now.getDate()} ${MON[now.getMonth()]}</div><h1>Тренировка</h1></div></header>
  ${needBackup ? `<div class="note" style="margin-bottom:12px">Давно не было бэкапа. <button class="btn ghost sm" data-action="export">Сохранить копию</button></div>` : ''}
  <section class="card hero">
    <div class="row"><span class="badge accent">Следующая по циклу · ${cyc.indexOf(nid) + 1}/${cyc.length}</span><span class="grow"></span>${last ? `<span class="small muted">последняя ${agoStr(last.start)}</span>` : ''}</div>
    <h2 style="margin-top:10px">${esc(day.name)}</h2>
    <div class="sub">${esc(day.sub || '')}</div>
    ${mm.p.length ? bodyMap(mm.p, mm.s, true) : ''}
  </section>
  <div class="card flat"><div class="list">${preview}</div></div>
  <button class="btn primary big block" data-action="start" data-day="${nid}">Начать ${esc(day.name)}</button>
  <h3>Другая тренировка</h3>
  <div class="days">${others}</div>
  ${recent ? `<h3>Недавние</h3><div class="card flat"><div class="list">${recent}</div></div>` : ''}`;
}

function sessionRow(s) {
  const sets = s.entries.reduce((a, e) => a + (e.sets ? e.sets.length : 0), 0);
  const dur = s.end ? Math.round((new Date(s.end) - new Date(s.start)) / 60000) : 0;
  const cardioMin = s.entries.reduce((a, e) => a + (e.cardio && e.cardio.min ? e.cardio.min : 0), 0);
  const info = [fmtD(s.start), dur ? `${dur} мин` : '', sets ? `${sets} ${plural(sets, 'подход', 'подхода', 'подходов')}` : '', cardioMin ? `кардио ${cardioMin} мин` : ''].filter(Boolean).join(' · ');
  return `<button data-action="session" data-id="${s.id}"><span class="num-dot" style="background:${s.kind === 'cardio' ? 'var(--s2)' : 'var(--s1)'};color:#fff">${esc(s.name.replace(/^(\S)\S*\s*(\S?).*$/, '$1$2'))}</span><div class="grow"><div class="t">${esc(s.name)}</div><div class="d">${info}</div></div><span class="chev">${IC.chev}</span></button>`;
}

function makeEntry(it) {
  if (isCardio(it.ex)) {
    const prev = [...S.sessions].reverse().flatMap((s) => s.entries).find((e) => e.cardio && e.cardio.machine);
    return { ex: it.ex, cardio: { target: it.minutes || 20, min: '', km: '', hr: '', machine: prev ? prev.cardio.machine : '', done: false } };
  }
  const t = { sets: it.sets, min: it.min, max: it.max, rest: it.rest || S.settings.rest };
  const sg = suggest(it.ex, t);
  const ex = getEx(it.ex);
  const h = exHistory(it.ex);
  const prevSets = h.length ? h[h.length - 1].e.sets : [];
  const w0 = sg.w != null ? String(sg.w).replace('.', ',') : ex.equip === 'bodyweight' ? '0' : '';
  return {
    ex: it.ex, target: t, sug: sg, open: false,
    prev: prevSets.map((s) => ({ w: s.w, r: s.r })),
    sets: Array.from({ length: t.sets }, () => ({ w: w0, r: '', done: false })),
  };
}

function startSession(dayId) {
  const day = S.program.days[dayId];
  S.active = { id: uid(), day: dayId, name: day.name, kind: day.kind, start: new Date().toISOString(), notes: '', entries: day.items.map(makeEntry) };
  if (S.active.entries[0] && !S.active.entries[0].cardio) S.active.entries[0].open = true;
  save();
  wake(true);
  unlockAudio();
  window.scrollTo(0, 0);
  render();
}

function activeCounts() {
  let total = 0, done = 0;
  for (const e of S.active.entries) {
    if (e.cardio) { total++; if (e.cardio.done) done++; continue; }
    total += e.sets.length;
    done += e.sets.filter((s) => s.done).length;
  }
  return { total, done };
}

function viewActive() {
  const a = S.active;
  const { total, done } = activeCounts();
  const cards = a.entries.map((e, i) => (e.cardio ? cardioCard(e, i) : exCard(e, i))).join('');
  return `
  <header class="top sticky-top"><div class="grow"><div class="eyebrow"><span id="elapsed">${elapsedStr()}</span> · ${done}/${total} подходов</div><h1>${esc(a.name)}</h1>
    <div class="progress"><i style="width:${total ? (done / total) * 100 : 0}%"></i></div></div>
    <button class="btn primary sm" data-action="finish">Готово</button></header>
  ${cards}
  <button class="btn block" data-action="pick" data-mode="session" style="margin-bottom:12px">+ Добавить упражнение</button>
  <label class="field"><span>Заметка к тренировке</span><textarea class="inp" data-f="notes" placeholder="Самочувствие, сон, что заметил…">${esc(a.notes)}</textarea></label>
  <button class="btn primary big block" data-action="finish">Завершить тренировку</button>
  <div class="spacer"></div>
  <button class="btn block danger" data-action="cancel-workout">Отменить тренировку</button>`;
}

function phW(e, j) {
  const p = e.prev[j] || e.prev[e.prev.length - 1];
  return p ? fmtW(p.w) : '';
}
function phR(e, j) {
  return String(e.sug?.r ?? e.target.min);
}

function exCard(e, i) {
  const ex = getEx(e.ex), t = e.target;
  const doneN = e.sets.filter((s) => s.done).length;
  const complete = e.sets.length > 0 && doneN === e.sets.length;
  const wu = ex.compound && e.sug ? warmupStr(e.sug.w) : '';
  const details = e.open ? `<div class="details">
      ${ex.p.length ? bodyMap(ex.p, ex.s, true) + mapLegend() : ''}
      <ul class="tips">${ex.tips.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      ${wu ? `<div class="warmup"><b>Разминка:</b> ${wu}</div>` : ''}
    </div>` : '';
  const rows = e.sets.map((s, j) => `
    <div class="set-row ${s.done ? 'done' : ''}">
      <span class="set-n">${j + 1}</span>
      <input class="set-in" data-f="w" data-i="${i}" data-j="${j}" inputmode="decimal" enterkeyhint="next" autocomplete="off" value="${esc(s.w)}" placeholder="${phW(e, j)}">
      <input class="set-in" data-f="r" data-i="${i}" data-j="${j}" inputmode="numeric" enterkeyhint="done" autocomplete="off" value="${esc(s.r)}" placeholder="${phR(e, j)}">
      <button class="chk" data-action="check" data-i="${i}" data-j="${j}" aria-label="Подход ${j + 1} выполнен">${IC.check}</button>
    </div>`).join('');
  return `
  <article class="card ex ${complete ? 'complete' : ''}" id="ex${i}">
    <button class="ex-head" data-action="toggle-ex" data-i="${i}">
      <span class="num-dot ${complete ? 'done' : ''}">${complete ? '✓' : i + 1}</span>
      <span class="grow"><div class="ex-name">${esc(ex.name)}</div>
      <div class="ex-meta">${t.sets} × ${t.min}–${t.max}${unitLbl(ex)} · отдых ${fmtRest(t.rest)} · ${esc(musclesShort(ex))}</div></span>
      <span class="chev">${e.open ? IC.up : IC.down}</span>
    </button>
    ${e.sug ? `<div class="sug ${e.sug.kind}">${e.sug.text}</div>` : ''}
    ${details}
    <div class="sets">
      <div class="set-row head"><span>#</span><span>${ex.equip === 'bodyweight' ? '+ кг' : 'кг'}</span><span>${ex.unit === 'sec' ? 'сек' : 'повт'}</span><span></span></div>
      ${rows}
    </div>
    <div class="ex-foot">
      <button class="btn sm" data-action="add-set" data-i="${i}">+ подход</button>
      <button class="btn sm" data-action="del-set" data-i="${i}">− подход</button>
      <span class="grow"></span>
      <button class="btn sm ghost" data-action="ex-info" data-id="${e.ex}">История</button>
      <button class="btn sm ghost" data-action="del-entry" data-i="${i}" aria-label="Убрать упражнение">${IC.x}</button>
    </div>
  </article>`;
}

function cardioCard(e, i) {
  const ex = getEx(e.ex), c = e.cardio;
  return `
  <article class="card ex ${c.done ? 'complete' : ''}" id="ex${i}">
    <button class="ex-head" data-action="toggle-ex" data-i="${i}">
      <span class="num-dot ${c.done ? 'done' : ''}">${c.done ? '✓' : i + 1}</span>
      <span class="grow"><div class="ex-name">${esc(ex.name)}</div><div class="ex-meta">${c.target} мин</div></span>
      <span class="chev">${e.open ? IC.up : IC.down}</span>
    </button>
    ${e.open ? `<div class="details"><ul class="tips">${ex.tips.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
    <div style="padding:4px 16px 0">
      <div class="chips">${CARDIO_MACHINES.map((m) => `<button class="chip ${c.machine === m ? 'on' : ''}" data-action="cardio-machine" data-i="${i}" data-v="${m}">${m}</button>`).join('')}</div>
      <div class="grid3" style="margin-top:10px">
        <label class="field"><span>Минуты</span><input class="inp" data-f="cmin" data-i="${i}" inputmode="decimal" value="${esc(c.min)}" placeholder="${c.target}"></label>
        <label class="field"><span>Км</span><input class="inp" data-f="ckm" data-i="${i}" inputmode="decimal" value="${esc(c.km)}" placeholder="—"></label>
        <label class="field"><span>Пульс ср.</span><input class="inp" data-f="chr" data-i="${i}" inputmode="numeric" value="${esc(c.hr)}" placeholder="—"></label>
      </div>
    </div>
    <div class="ex-foot"><button class="btn sm ${c.done ? '' : 'primary'}" data-action="cardio-done" data-i="${i}">${c.done ? 'Снять отметку' : 'Выполнено'}</button>
      <span class="grow"></span><button class="btn sm ghost" data-action="del-entry" data-i="${i}" aria-label="Убрать упражнение">${IC.x}</button></div>
  </article>`;
}

function elapsedStr() {
  if (!S.active) return '';
  const sec = Math.max(0, Math.floor((Date.now() - new Date(S.active.start)) / 1000));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function finishWorkout() {
  const a = S.active;
  const { total, done } = activeCounts();
  if (!done) {
    if (confirm('Ни один подход не отмечен. Отменить тренировку без сохранения?')) { S.active = null; save(); stopTimer(); wake(false); render(); }
    return;
  }
  if (done < total && !confirm(`Отмечено ${done} из ${total}. Завершить тренировку?`)) return;

  const entries = [];
  const prs = [];
  for (const e of a.entries) {
    if (e.cardio) {
      const c = e.cardio;
      const min = num(c.min) ?? (c.done ? c.target : null);
      if (!c.done && min == null) continue;
      entries.push({ ex: e.ex, cardio: { min: min || 0, km: num(c.km), hr: num(c.hr), machine: c.machine || '' } });
      continue;
    }
    const sets = e.sets.filter((s) => s.done).map((s) => ({ w: num(s.w) || 0, r: num(s.r) || 0 }));
    const entry = { ex: e.ex, target: { sets: e.target.sets, min: e.target.min, max: e.target.max }, sets };
    if (sets.length) {
      const ex = getEx(e.ex);
      const prevBest = Math.max(0, ...exHistory(e.ex).map((x) => entryMetric(ex, x.e) || 0));
      const m = entryMetric(ex, entry);
      if (prevBest > 0 && m > prevBest * 1.001) prs.push({ ex, m, prev: prevBest });
    }
    entries.push(entry);
  }
  const sess = { id: a.id, day: a.day, name: a.name, kind: a.kind, start: a.start, end: new Date().toISOString(), notes: a.notes.trim(), entries };
  S.sessions.push(sess);
  const idx = S.program.cycle.indexOf(a.day);
  if (idx >= 0) S.next = (idx + 1) % S.program.cycle.length;
  S.active = null;
  save();
  stopTimer();
  wake(false);
  render();
  window.scrollTo(0, 0);

  const sets = entries.reduce((x, e) => x + (e.sets ? e.sets.length : 0), 0);
  const ton = entries.reduce((x, e) => x + (e.sets ? e.sets.reduce((y, s) => y + s.w * s.r, 0) : 0), 0);
  const dur = Math.round((new Date(sess.end) - new Date(sess.start)) / 60000);
  const nd = S.program.days[nextDayId()];
  openSheet(`
    <div class="sheet-head"><h2>Тренировка сохранена 💪</h2><button class="x" data-action="close-sheet">${IC.x}</button></div>
    <div class="tiles">
      <div class="tile"><div class="l">Длительность</div><div class="v">${dur} <small>мин</small></div></div>
      <div class="tile"><div class="l">Подходов</div><div class="v">${sets}</div></div>
      <div class="tile"><div class="l">Тоннаж</div><div class="v">${fmtInt(ton)} <small>кг</small></div></div>
      <div class="tile"><div class="l">Рекордов</div><div class="v">${prs.length}</div></div>
    </div>
    ${prs.length ? `<div class="card"><b>Новые рекорды</b>${prs.map((p) => `<div class="pr"><span class="grow">${esc(p.ex.name)}</span><span class="flag ok">${tickLbl(r1(p.m))}${repsKind(p.ex) ? '' : ' кг'} (было ${tickLbl(r1(p.prev))})</span></div>`).join('')}</div>` : ''}
    <p class="sub">Следующая по циклу: <b>${esc(nd.name)}</b></p>
    <button class="btn primary block big" data-action="close-sheet">Отлично</button>`);
}

// ───────────────────────── Экран «Программа» ─────────────────────────
function viewProgram() {
  const cyc = S.program.cycle;
  const nIdx = ((S.next % cyc.length) + cyc.length) % cyc.length;
  const days = cyc.map((id, idx) => {
    const d = S.program.days[id];
    const items = d.items.map((it, k) => {
      const ex = getEx(it.ex);
      const extra = isCardio(it.ex) ? '' : ` · отдых ${fmtRest(it.rest)} · ${EQUIP[ex.equip]}`;
      return `<button data-action="edit-item" data-day="${id}" data-k="${k}"><div class="grow"><div class="t">${esc(ex.name)}</div><div class="d">${itemLine(it)}${extra}</div></div><span class="chev">${IC.chev}</span></button>`;
    }).join('');
    return `<div class="card flat">
      <div class="row" style="padding:14px 16px 10px">
        <span class="num-dot">${idx + 1}</span>
        <button class="grow" style="text-align:left" data-action="edit-day" data-day="${id}"><div class="ex-name">${esc(d.name)}</div><div class="small muted">${esc(d.sub || '')}</div></button>
        ${idx === nIdx ? '<span class="badge accent">Следующая</span>' : `<button class="btn sm" data-action="set-next" data-idx="${idx}">Сделать след.</button>`}
      </div>
      <div class="list" style="border-top:1px solid var(--line)">${items}
        <button data-action="pick" data-mode="day" data-day="${id}" style="color:var(--accent);font-weight:600">+ Добавить упражнение</button></div>
    </div>`;
  }).join('');
  return `
  <header class="top"><div><div class="eyebrow">${esc(S.program.name)}</div><h1>Программа</h1></div></header>
  <p class="sub" style="margin:-6px 4px 14px">Тренировки идут по кругу, без привязки к дням недели. Нажми на упражнение, чтобы изменить подходы, повторения, отдых или заменить его.</p>
  ${days}
  <button class="btn block" data-action="pick" data-mode="browse">Библиотека упражнений</button>
  <div class="spacer"></div>
  <button class="btn block danger" data-action="reset-program">Вернуть исходную программу</button>`;
}

function editItemSheet(dayId, k) {
  const it = S.program.days[dayId].items[k];
  const ex = getEx(it.ex);
  const n = S.program.days[dayId].items.length;
  const rests = [45, 60, 75, 90, 120, 150, 180, 240];
  const body = isCardio(it.ex)
    ? `<label class="field"><span>Длительность, мин</span><input class="inp" id="ed-min" inputmode="numeric" value="${it.minutes}"></label>`
    : `<label class="field"><span>Подходы</span><div class="stepper"><button data-action="step" data-t="ed-sets" data-v="-1">−</button><input class="inp" id="ed-sets" inputmode="numeric" value="${it.sets}"><button data-action="step" data-t="ed-sets" data-v="1">+</button></div></label>
       <div class="grid2">
         <label class="field"><span>${ex.unit === 'sec' ? 'Секунд' : 'Повторов'} от</span><input class="inp" id="ed-min" inputmode="numeric" value="${it.min}"></label>
         <label class="field"><span>до</span><input class="inp" id="ed-max" inputmode="numeric" value="${it.max}"></label>
       </div>
       <label class="field"><span>Отдых между подходами</span>
         <select class="inp" id="ed-rest">${rests.map((r) => `<option value="${r}" ${r === it.rest ? 'selected' : ''}>${fmtRest(r)}</option>`).join('')}</select></label>`;
  openSheet(`
    <div class="sheet-head"><h2>${esc(ex.name)}</h2><button class="x" data-action="close-sheet">${IC.x}</button></div>
    <p class="sub" style="margin-top:-6px">${esc(S.program.days[dayId].name)} · ${EQUIP[ex.equip]}</p>
    ${body}
    <div class="row wrap" style="margin-bottom:12px">
      <button class="btn sm" data-action="move-item" data-v="-1" ${k === 0 ? 'disabled style="opacity:.4"' : ''}>↑ Выше</button>
      <button class="btn sm" data-action="move-item" data-v="1" ${k === n - 1 ? 'disabled style="opacity:.4"' : ''}>↓ Ниже</button>
      <button class="btn sm" data-action="pick" data-mode="replace" data-day="${dayId}" data-k="${k}">Заменить</button>
      <button class="btn sm" data-action="ex-info" data-id="${it.ex}">Техника</button>
      <span class="grow"></span>
      <button class="btn sm danger" data-action="del-item">Удалить</button>
    </div>
    <button class="btn primary block big" data-action="save-item">Сохранить</button>`, { dayId, k });
}

function saveItem() {
  const { dayId, k } = SC;
  const it = S.program.days[dayId].items[k];
  const v = (id) => num($('#' + id)?.value);
  if (isCardio(it.ex)) {
    it.minutes = Math.max(1, Math.round(v('ed-min') || it.minutes));
  } else {
    it.sets = Math.min(10, Math.max(1, Math.round(v('ed-sets') || it.sets)));
    let mn = Math.max(1, Math.round(v('ed-min') || it.min)), mx = Math.max(1, Math.round(v('ed-max') || it.max));
    if (mn > mx) [mn, mx] = [mx, mn];
    it.min = mn; it.max = mx;
    it.rest = +$('#ed-rest').value;
  }
  save(); closeSheet(); render(); toast('Сохранено');
}

// ───────────────────────── Выбор упражнения ─────────────────────────
function pickerSheet(ctx) {
  openSheet(`
    <div class="sheet-head"><h2>${ctx.mode === 'browse' ? 'Библиотека' : ctx.mode === 'replace' ? 'Заменить на…' : 'Добавить упражнение'}</h2><button class="x" data-action="close-sheet">${IC.x}</button></div>
    <input class="inp" id="pick-q" data-f="pickq" type="search" placeholder="Поиск" autocomplete="off" value="${esc(ctx.q || '')}">
    <div class="chips" id="pick-m" style="margin:10px 0">${pickChips(ctx)}</div>
    <div class="card flat"><div class="list" id="pick-list">${pickList(ctx)}</div></div>
    <button class="btn block" data-action="custom-ex">+ Создать своё упражнение</button>`, ctx);
}
function pickChips(ctx) {
  const opts = [['', 'Все'], ...MUSCLE_GROUPS.map((g) => [g.id, g.name]), ['cardio', 'Кардио']];
  return opts.map(([id, n]) => `<button class="chip ${(ctx.m || '') === id ? 'on' : ''}" data-action="pick-m" data-v="${id}">${n}</button>`).join('');
}
function pickList(ctx) {
  const q = (ctx.q || '').trim().toLowerCase();
  const grp = MUSCLE_GROUPS.find((g) => g.id === ctx.m);
  const ids = allExIds().filter((id) => {
    const ex = getEx(id);
    if (q && !ex.name.toLowerCase().includes(q)) return false;
    if (ctx.m === 'cardio') return ex.equip === 'cardio';
    if (grp) return ex.p.some((m) => grp.m.includes(m));
    return true;
  }).sort((a, b) => getEx(a).name.localeCompare(getEx(b).name, 'ru'));
  if (!ids.length) return '<div class="empty">Ничего не найдено</div>';
  return ids.map((id) => {
    const ex = getEx(id);
    return `<button data-action="pick-ex" data-id="${id}"><div class="grow"><div class="t">${esc(ex.name)}${S.custom[id] ? ' <span class="badge">своё</span>' : ''}</div><div class="d">${EQUIP[ex.equip]}${ex.p.length ? ' · ' + esc(musclesShort(ex)) : ''}</div></div><span class="chev">${IC.chev}</span></button>`;
  }).join('');
}
function pickExercise(id) {
  const ctx = SC;
  const cardio = isCardio(id);
  const base = cardio ? { ex: id, minutes: 20 } : { ex: id, sets: 3, min: 8, max: 12, rest: S.settings.rest };
  if (ctx.mode === 'browse') return exInfoSheet(id);
  if (ctx.mode === 'session') {
    S.active.entries.push(makeEntry(base));
    S.active.entries[S.active.entries.length - 1].open = true;
    toast('Добавлено в тренировку');
  } else if (ctx.mode === 'day') {
    S.program.days[ctx.day].items.push(base);
    toast('Добавлено в ' + S.program.days[ctx.day].name);
  } else if (ctx.mode === 'replace') {
    const items = S.program.days[ctx.day].items;
    const old = items[+ctx.k];
    items[+ctx.k] = cardio ? base : isCardio(old.ex) ? base : { ...old, ex: id };
    toast('Заменено');
  }
  save(); closeSheet(); render();
}

function customExSheet(prevCtx) {
  const ms = Object.entries(MUSCLES);
  openSheet(`
    <div class="sheet-head"><h2>Своё упражнение</h2><button class="x" data-action="close-sheet">${IC.x}</button></div>
    <label class="field"><span>Название</span><input class="inp" id="cx-name" autocomplete="off"></label>
    <label class="field"><span>Снаряд</span><select class="inp" id="cx-equip">${Object.entries(EQUIP).map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></label>
    <label class="field"><span>Повторы или секунды</span><div class="seg" id="cx-unit"><button class="on" data-action="seg" data-v="reps">Повторы</button><button data-action="seg" data-v="sec">Секунды</button></div></label>
    <div class="field"><span>Основные мышцы</span><div class="chips" id="cx-p">${ms.map(([k, n]) => `<button class="chip" data-action="toggle-chip" data-v="${k}">${n}</button>`).join('')}</div></div>
    <div class="field"><span>Вспомогательные</span><div class="chips" id="cx-s">${ms.map(([k, n]) => `<button class="chip" data-action="toggle-chip" data-v="${k}">${n}</button>`).join('')}</div></div>
    <label class="field"><span>Подсказки по технике (каждая с новой строки)</span><textarea class="inp" id="cx-tips"></textarea></label>
    <button class="btn primary block big" data-action="save-custom">Создать</button>`, { ...prevCtx, custom: true });
}
function saveCustom() {
  const name = $('#cx-name').value.trim();
  if (!name) { toast('Укажи название'); return; }
  const chips = (id) => [...document.querySelectorAll(`#${id} .chip.on`)].map((b) => b.dataset.v);
  const id = 'c_' + uid();
  const unit = $('#cx-unit .on').dataset.v;
  S.custom[id] = {
    name, equip: $('#cx-equip').value, p: chips('cx-p'), s: chips('cx-s').filter((m) => !chips('cx-p').includes(m)),
    tips: $('#cx-tips').value.split('\n').map((x) => x.trim()).filter(Boolean), ...(unit === 'sec' ? { unit: 'sec' } : {}),
  };
  save();
  toast('Упражнение создано');
  if (SC.mode && SC.mode !== 'browse') pickExercise(id);
  else pickerSheet({ mode: 'browse', q: name });
}

function exInfoSheet(id) {
  const ex = getEx(id);
  const h = exHistory(id);
  let hist = '';
  if (ex.equip === 'cardio') {
    const c = S.sessions.flatMap((s) => s.entries.filter((e) => e.ex === id && e.cardio).map((e) => ({ s, c: e.cardio }))).slice(-6).reverse();
    hist = c.length ? `<table class="t"><tr><th>Дата</th><th>Тип</th><th class="r">Мин</th><th class="r">Км</th><th class="r">Пульс</th></tr>${c.map((x) => `<tr><td>${fmtD(x.s.start)}</td><td>${esc(x.c.machine || '—')}</td><td class="r">${x.c.min || '—'}</td><td class="r">${x.c.km ? fmtW(x.c.km) : '—'}</td><td class="r">${x.c.hr || '—'}</td></tr>`).join('')}</table>` : '';
  } else if (h.length) {
    const best = h.reduce((b, x) => { const m = entryMetric(ex, x.e); return m > b.m ? { m, x } : b; }, { m: 0, x: null });
    hist = `<div class="tiles" style="margin-top:4px">
        <div class="tile"><div class="l">${metricName(ex).replace(', кг', '')}</div><div class="v">${tickLbl(r1(best.m))}${repsKind(ex) ? '' : ' <small>кг</small>'}</div></div>
        <div class="tile"><div class="l">Тренировок</div><div class="v">${h.length}</div></div></div>
      ${h.length > 1 ? chartSlot({ type: 'line', h: 160, pts: h.map((x) => ({ x: +new Date(x.s.start), y: r1(entryMetric(ex, x.e)), tip: `<b>${fmtD(x.s.start)}</b><br>${setsStr(ex, x.e.sets)}` })) }) : ''}
      <table class="t" style="margin-top:8px"><tr><th>Дата</th><th>Подходы</th></tr>${h.slice(-6).reverse().map((x) => `<tr><td>${fmtD(x.s.start)}</td><td>${setsStr(ex, x.e.sets)}</td></tr>`).join('')}</table>`;
  }
  openSheet(`
    <div class="sheet-head"><h2>${esc(ex.name)}</h2><button class="x" data-action="close-sheet">${IC.x}</button></div>
    <div class="row wrap" style="margin-top:-4px"><span class="badge">${EQUIP[ex.equip]}</span>${ex.p.map((m) => `<span class="badge accent">${MUSCLES[m]}</span>`).join('')}${ex.s.map((m) => `<span class="badge">${MUSCLES[m]}</span>`).join('')}</div>
    ${ex.p.length ? `<div class="card" style="margin-top:12px">${bodyMap(ex.p, ex.s)}${mapLegend()}</div>` : ''}
    ${ex.tips.length ? `<h3>Техника</h3><div class="card"><ul class="tips" style="margin:0">${ex.tips.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
    ${hist ? `<h3>Мой прогресс</h3><div class="card">${hist}</div>` : ''}
    ${S.custom[id] ? `<button class="btn block danger" data-action="del-custom" data-id="${id}">Удалить упражнение</button>` : ''}`, { infoId: id });
}

// ───────────────────────── Экран «Статистика» ─────────────────────────
function viewStats() {
  const ss = S.sessions;
  if (!ss.length) {
    return `<header class="top"><h1>Статистика</h1></header>
      <div class="card empty">Здесь появятся частота тренировок, прогресс по упражнениям, объём по группам мышц и отстающие упражнения.<br><br>Проведи первую тренировку 💪</div>`;
  }
  const now = new Date();
  const d30 = ss.filter((s) => daysBetween(s.start, now) < 30);
  const ws8 = weekStart(now); ws8.setDate(ws8.getDate() - 7 * 7);
  const n8 = ss.filter((s) => new Date(s.start) >= ws8).length;
  const gap = daysBetween(ss[ss.length - 1].start, now);
  const cardio30 = d30.reduce((a, s) => a + s.entries.reduce((b, e) => b + (e.cardio ? e.cardio.min || 0 : 0), 0), 0);

  // Недели
  const bars = [];
  for (let i = 11; i >= 0; i--) {
    const w0 = weekStart(now); w0.setDate(w0.getDate() - 7 * i);
    const w1 = new Date(w0); w1.setDate(w1.getDate() + 7);
    const inW = ss.filter((s) => { const d = new Date(s.start); return d >= w0 && d < w1; });
    const st = inW.filter((s) => s.kind !== 'cardio').length, ca = inW.length - st;
    bars.push({ label: `${w0.getDate()}.${pad(w0.getMonth() + 1)}`, v: inW.length, tip: `<b>Неделя с ${fmtD(w0)}</b><br>${inW.length} ${plural(inW.length, 'тренировка', 'тренировки', 'тренировок')}${inW.length ? ` (силовых ${st}, кардио ${ca})` : ''}` });
  }

  // Тепловая карта
  const byDay = {};
  for (const s of ss) { const k = dkey(s.start); byDay[k] = byDay[k] || { s: 0, c: 0, names: [] }; byDay[k][s.kind === 'cardio' ? 'c' : 's']++; byDay[k].names.push(s.name); }
  const WEEKS = 18;
  const hs = weekStart(now); hs.setDate(hs.getDate() - 7 * (WEEKS - 1));
  let cells = '';
  for (let i = 0; i < WEEKS * 7; i++) {
    const d = new Date(hs); d.setDate(d.getDate() + i);
    const k = dkey(d), v = byDay[k];
    const future = d > now;
    const cl = v ? (v.s && v.c ? 'sc' : v.s ? 's' : 'c') : '';
    cells += `<i class="${cl} ${k === dkey(now) ? 'today' : ''}" ${future ? 'style="visibility:hidden"' : `data-action="heat" data-k="${k}"`}></i>`;
  }

  // Упражнения с историей
  const used = [];
  for (let i = ss.length - 1; i >= 0; i--) for (const e of ss[i].entries) if (e.sets && e.sets.length && !used.includes(e.ex)) used.push(e.ex);
  let sel = S.ui.statEx && used.includes(S.ui.statEx) ? S.ui.statEx : used.includes('bench') ? 'bench' : used[0];
  let exBlock = '<div class="empty">Нет силовых упражнений</div>';
  if (sel) {
    const ex = getEx(sel), h = exHistory(sel);
    const pts = h.map((x) => ({ x: +new Date(x.s.start), y: r1(entryMetric(ex, x.e)), tip: `<b>${fmtD(x.s.start)}</b><br>${metricName(ex).split(',')[0]}: ${tickLbl(r1(entryMetric(ex, x.e)))}<br>${setsStr(ex, x.e.sets)}` }));
    const best = Math.max(...pts.map((p) => p.y));
    const maxW = Math.max(...h.flatMap((x) => x.e.sets.map((s) => s.w)));
    const first = pts[0].y, lastV = pts[pts.length - 1].y;
    const ch = first ? ((lastV - first) / first) * 100 : 0;
    exBlock = `
      <select class="inp" data-f="statEx">${used.map((id) => `<option value="${id}" ${id === sel ? 'selected' : ''}>${esc(getEx(id).name)}</option>`).join('')}</select>
      <div class="small muted" style="margin:10px 0 2px">${metricName(ex)}</div>
      ${chartSlot({ type: 'line', pts, unit: '', empty: 'Нужна хотя бы одна тренировка' })}
      <div class="grid3" style="margin-top:10px">
        <div><div class="small muted">Рекорд</div><b>${tickLbl(best)}</b></div>
        <div><div class="small muted">Макс. вес</div><b>${fmtW(maxW)} кг</b></div>
        <div><div class="small muted">С начала</div><b style="color:${ch >= 0 ? 'var(--good-text)' : 'var(--danger)'}">${ch >= 0 ? '+' : ''}${Math.round(ch)}%</b></div>
      </div>`;
  }

  // Объём по группам
  const win = S.ui.volWin;
  const vol = muscleVolume(win);
  const vmax = Math.max(22, ...vol.map((v) => v.sets));
  const volRows = vol.map((v) => `<div class="hbar"><span>${v.name}</span><span class="track"><span class="zone" style="left:${(10 / vmax) * 100}%;width:${(10 / vmax) * 100}%"></span><span class="fill" style="width:${(v.sets / vmax) * 100}%"></span></span><span class="val">${tickLbl(r1(v.sets))}</span></div>`).join('');

  // Отстающие / лидеры
  const an = analysis();
  const lag = an.filter((x) => x.stagn || x.compl < 0.9 || x.change < 0).sort((a, b) => b.score - a.score || a.change - b.change).slice(0, 6);
  const lead = an.filter((x) => x.change > 0).sort((a, b) => b.change - a.change).slice(0, 3);
  const lagHtml = lag.length ? lag.map((x) => `<button class="pr" style="width:100%;text-align:left" data-action="ex-info" data-id="${x.id}"><div class="grow"><div class="t">${esc(getEx(x.id).name)}</div>
      <div class="row wrap" style="gap:4px;margin-top:4px">${x.stagn ? `<span class="flag bad">нет роста ${x.stagnN} трен.</span>` : ''}${x.compl < 0.9 ? `<span class="flag mid">план выполнен на ${Math.round(x.compl * 100)}%</span>` : ''}${x.change < 0 ? `<span class="flag bad">${Math.round(x.change)}%</span>` : ''}</div></div><span class="chev">${IC.chev}</span></button>`).join('')
    : `<div class="empty">${an.length ? 'Всё растёт — отстающих нет 🔥' : 'Нужно минимум 3 тренировки с упражнением, чтобы оценить динамику'}</div>`;
  const leadHtml = lead.map((x) => `<div class="pr"><span class="grow">${esc(getEx(x.id).name)}</span><span class="flag ok">+${Math.round(x.change)}%</span></div>`).join('');

  // Рекорды
  const recs = used.map((id) => {
    const ex = getEx(id);
    let best = { m: 0 };
    for (const x of exHistory(id)) for (const st of x.e.sets) { const m = repsKind(ex) ? st.r + (st.w > 0 ? st.w / 2.5 : 0) : e1rm(st.w, st.r); if (m > best.m) best = { m, st, d: x.s.start }; }
    return { id, ex, ...best };
  }).filter((x) => x.m > 0);

  const hist = [...ss].reverse();
  const histN = S.ui.histN;

  return `
  <header class="top"><div><div class="eyebrow">Всего ${ss.length} ${plural(ss.length, 'тренировка', 'тренировки', 'тренировок')}</div><h1>Статистика</h1></div></header>
  <div class="tiles">
    <div class="tile"><div class="l">За 30 дней</div><div class="v">${d30.length}</div></div>
    <div class="tile"><div class="l">В неделю (8 нед.)</div><div class="v">${tickLbl(r1(n8 / 8))}</div></div>
    <div class="tile"><div class="l">С последней</div><div class="v">${gap} <small>${plural(gap, 'день', 'дня', 'дней')}</small></div></div>
    <div class="tile"><div class="l">Кардио за 30 дней</div><div class="v">${fmtInt(cardio30)} <small>мин</small></div></div>
  </div>

  <h3>Частота</h3>
  <div class="card">
    <div class="small muted" style="margin-bottom:6px">Тренировок в неделю</div>
    ${chartSlot({ type: 'bars', bars, int: true })}
    <div class="small muted" style="margin:14px 0 6px">Последние ${WEEKS} недель</div>
    <div class="heat">${cells}</div>
    <div class="legend" style="justify-content:flex-start;margin-top:8px"><span><i style="background:var(--s1)"></i>силовая</span><span><i style="background:var(--s2)"></i>кардио</span><span><i style="background:var(--heat0)"></i>отдых</span></div>
  </div>

  <h3>Прогресс по упражнению</h3>
  <div class="card">${exBlock}</div>

  <h3>Объём на группу мышц</h3>
  <div class="card">
    <div class="seg" style="margin-bottom:10px"><button class="${win === 7 ? 'on' : ''}" data-action="vol-win" data-v="7">Последние 7 дней</button><button class="${win === 28 ? 'on' : ''}" data-action="vol-win" data-v="28">Среднее за 4 нед.</button></div>
    ${volRows}
    <div class="small muted" style="margin-top:8px">Рабочих подходов в неделю (вспомогательная мышца = ½ подхода). Зелёная зона 10–20 — ориентир для роста массы.</div>
  </div>

  <h3>Что отстаёт</h3>
  <div class="card">${lagHtml}
    ${lag.some((x) => x.stagn) ? '<div class="note" style="margin-top:8px">При застое: разгрузка −10% на 1 тренировку, затем снова набирай повторы. Или поменяй упражнение на вариацию (штанга ↔ гантели).</div>' : ''}
  </div>
  ${leadHtml ? `<h3>Лучший прогресс</h3><div class="card">${leadHtml}</div>` : ''}

  <h3>Рекорды</h3>
  <div class="card">${recs.map((x) => `<div class="pr"><span class="grow">${esc(x.ex.name)}<div class="small muted">${x.st.w ? fmtW(x.st.w) + ' кг × ' : ''}${x.st.r}${x.ex.unit === 'sec' ? ' с' : ''} · ${fmtD(x.d)}</div></span><b>${repsKind(x.ex) ? '' : '≈ ' + tickLbl(r1(x.m)) + ' кг'}</b></div>`).join('') || '<div class="empty">Пока нет</div>'}</div>

  <h3>История</h3>
  <div class="card flat"><div class="list">${hist.slice(0, histN).map(sessionRow).join('')}</div></div>
  ${hist.length > histN ? '<button class="btn block" data-action="more-hist">Показать ещё</button>' : ''}`;
}

function muscleVolume(days) {
  const now = new Date();
  const from = dayStart(now); from.setDate(from.getDate() - days + 1);
  const acc = Object.fromEntries(MUSCLE_GROUPS.map((g) => [g.id, 0]));
  for (const s of S.sessions) {
    if (new Date(s.start) < from) continue;
    for (const e of s.entries) {
      if (!e.sets) continue;
      const ex = getEx(e.ex), n = e.sets.length;
      for (const g of MUSCLE_GROUPS) {
        if (ex.p.some((m) => g.m.includes(m))) acc[g.id] += n;
        else if (ex.s.some((m) => g.m.includes(m))) acc[g.id] += n / 2;
      }
    }
  }
  const k = days / 7;
  return MUSCLE_GROUPS.map((g) => ({ name: g.name, sets: acc[g.id] / k }));
}

function analysis() {
  const now = new Date();
  const ids = [...new Set(S.sessions.flatMap((s) => s.entries.filter((e) => e.sets && e.sets.length).map((e) => e.ex)))];
  const out = [];
  for (const id of ids) {
    const ex = getEx(id), h = exHistory(id);
    if (h.length < 3 || daysBetween(h[h.length - 1].s.start, now) > 45) continue;
    const ms = h.map((x) => entryMetric(ex, x.e));
    // Сколько последних тренировок без нового максимума
    let best = -Infinity, sinceBest = 0;
    ms.forEach((m) => { if (m > best * 1.005) { best = m; sinceBest = 0; } else sinceBest++; });
    const stagn = sinceBest >= 3;
    const last4 = h.slice(-4);
    let plan = 0, got = 0;
    for (const x of last4) {
      const t = x.e.target;
      if (!t) continue;
      plan += t.sets * t.min;
      got += x.e.sets.reduce((a, s) => a + Math.min(s.r, t.min), 0);
    }
    const compl = plan ? got / plan : 1;
    const base = ms[Math.max(0, ms.length - 6)];
    const change = base ? ((ms[ms.length - 1] - base) / base) * 100 : 0;
    out.push({ id, stagn, stagnN: sinceBest, compl, change, score: (stagn ? 2 : 0) + (compl < 0.9 ? 1 : 0) + (change < 0 ? 1 : 0) });
  }
  return out;
}

function sessionSheet(id) {
  const s = S.sessions.find((x) => x.id === id);
  if (!s) return;
  const dur = s.end ? Math.round((new Date(s.end) - new Date(s.start)) / 60000) : 0;
  const d = new Date(s.start);
  const rows = s.entries.map((e) => {
    const ex = getEx(e.ex);
    if (e.cardio) return `<tr><td>${esc(ex.name)}</td><td>${[e.cardio.machine, e.cardio.min ? e.cardio.min + ' мин' : '', e.cardio.km ? fmtW(e.cardio.km) + ' км' : '', e.cardio.hr ? '♥ ' + e.cardio.hr : ''].filter(Boolean).join(' · ')}</td></tr>`;
    return `<tr><td>${esc(ex.name)}</td><td>${e.sets.length ? setsStr(ex, e.sets) : '<span class="muted">пропущено</span>'}</td></tr>`;
  }).join('');
  openSheet(`
    <div class="sheet-head"><h2>${esc(s.name)}</h2><button class="x" data-action="close-sheet">${IC.x}</button></div>
    <p class="sub" style="margin-top:-6px">${WD[d.getDay()]}, ${fmtD(s.start)}, ${pad(d.getHours())}:${pad(d.getMinutes())}${dur ? ` · ${dur} мин` : ''}</p>
    <div class="card"><table class="t">${rows}</table></div>
    ${s.notes ? `<div class="note" style="margin-bottom:12px">${esc(s.notes)}</div>` : ''}
    <button class="btn block danger" data-action="del-session" data-id="${s.id}">Удалить тренировку</button>`);
}

// ───────────────────────── Экран «Тело» ─────────────────────────
const BODY_F = [['weight', 'Вес', 'кг'], ['chest', 'Грудь', 'см'], ['arm', 'Рука', 'см'], ['waist', 'Талия', 'см'], ['thigh', 'Бедро', 'см']];

function viewBody() {
  const b = S.body;
  const m = S.ui.bodyMetric;
  const [, mName, mUnit] = BODY_F.find((f) => f[0] === m);
  const pts = b.filter((x) => x[m] != null).map((x) => ({ x: +new Date(x.date + 'T12:00'), y: x[m], tip: `<b>${fmtD(x.date + 'T12:00')}</b><br>${mName}: ${fmtW(x[m])} ${mUnit}` }));
  const lastW = [...b].reverse().find((x) => x.weight != null);
  const ago30 = new Date(); ago30.setDate(ago30.getDate() - 30);
  const prevW = [...b].reverse().find((x) => x.weight != null && new Date(x.date) <= ago30) || b.find((x) => x.weight != null);
  const dW = lastW && prevW && prevW !== lastW ? lastW.weight - prevW.weight : null;
  const lastWaist = [...b].reverse().find((x) => x.waist != null);
  return `
  <header class="top"><h1>Тело</h1></header>
  ${lastW ? `<div class="tiles"><div class="tile"><div class="l">Вес</div><div class="v">${fmtW(lastW.weight)} <small>кг</small></div>${dW != null ? `<div class="small" style="color:var(--text2)">${dW > 0 ? '+' : ''}${fmtW(r1(dW))} кг с ${fmtD(prevW.date + 'T12:00')}</div>` : ''}</div>
    <div class="tile"><div class="l">Талия</div><div class="v">${lastWaist ? fmtW(lastWaist.waist) + ' <small>см</small>' : '—'}</div></div></div>` : ''}
  <div class="card">
    <div class="chips" style="margin-bottom:10px">${BODY_F.map(([k, n]) => `<button class="chip ${k === m ? 'on' : ''}" data-action="body-metric" data-v="${k}">${n}</button>`).join('')}</div>
    ${chartSlot({ type: 'line', pts, empty: 'Добавь замеры, чтобы увидеть график' })}
  </div>
  <h3>Новый замер</h3>
  <div class="card">
    <label class="field"><span>Дата</span><input class="inp" type="date" id="b-date" value="${dkey(new Date())}"></label>
    <div class="grid2">${BODY_F.map(([k, n, u]) => `<label class="field"><span>${n}, ${u}</span><input class="inp" id="b-${k}" inputmode="decimal" autocomplete="off"></label>`).join('')}</div>
    <div class="small muted" style="margin:-4px 0 12px">Взвешивайся утром натощак. Обхваты — раз в 2–4 недели, в одно и то же время.</div>
    <button class="btn primary block" data-action="save-body">Сохранить</button>
  </div>
  ${b.length ? `<h3>История</h3><div class="card"><table class="t"><tr><th>Дата</th>${BODY_F.map(([, n]) => `<th class="r">${n}</th>`).join('')}<th></th></tr>
    ${[...b].reverse().map((x) => `<tr><td>${fmtD(x.date + 'T12:00')}</td>${BODY_F.map(([k]) => `<td class="r">${x[k] != null ? fmtW(x[k]) : '—'}</td>`).join('')}<td class="r"><button class="muted" data-action="del-body" data-d="${x.date}" aria-label="Удалить">${IC.x}</button></td></tr>`).join('')}</table></div>` : ''}`;
}

// ───────────────────────── Экран «Ещё» ─────────────────────────
function viewMore() {
  const st = S.settings;
  const seg = (key, opts, cur) => `<div class="seg">${opts.map(([v, n]) => `<button class="${String(cur) === String(v) ? 'on' : ''}" data-action="set" data-k="${key}" data-v="${v}">${n}</button>`).join('')}</div>`;
  return `
  <header class="top"><h1>Настройки</h1></header>
  <div class="card">
    <label class="field"><span>Тема</span>${seg('theme', [['auto', 'Авто'], ['dark', 'Тёмная'], ['light', 'Светлая']], st.theme)}</label>
    <label class="field"><span>Отдых для новых упражнений</span>${seg('rest', [[60, '1:00'], [90, '1:30'], [120, '2:00'], [180, '3:00']], st.rest)}</label>
    <label class="field"><span>Сигнал по окончании отдыха</span>${seg('sound', [[true, 'Вкл'], [false, 'Выкл']], st.sound)}</label>
    <label class="field" style="margin:0"><span>Не гасить экран во время тренировки</span>${seg('wake', [[true, 'Вкл'], [false, 'Выкл']], st.wake)}</label>
  </div>
  <h3>Шаг прибавки веса, кг</h3>
  <div class="card">
    <div class="grid2">${Object.entries(st.inc).map(([k, v]) => `<label class="field"><span>${EQUIP[k]}</span><input class="inp" data-f="inc" data-k="${k}" inputmode="decimal" value="${fmtW(v)}"></label>`).join('')}</div>
    <div class="small muted">Для присяда, становой, жима ногами и некоторых других упражнений шаг задан отдельно (5–10 кг).</div>
  </div>
  <h3>Данные</h3>
  <div class="card">
    <p class="sub" style="margin-top:0">Всё хранится только на этом телефоне. Делай копию раз в пару недель — сохрани файл в «Файлы» или iCloud.</p>
    <div class="small muted" style="margin-bottom:10px">Последний бэкап: ${S.lastBackup ? fmtD(S.lastBackup) : 'не было'} · тренировок: ${S.sessions.length}</div>
    <div class="row"><button class="btn primary grow" data-action="export">Экспорт</button><label class="btn grow">Импорт<input type="file" id="imp" accept=".json,application/json" hidden></label></div>
    <div class="small muted" style="margin-top:10px" id="persist-st"></div>
  </div>
  <h3>Установка на iPhone</h3>
  <div class="card"><ol class="tips" style="margin:0">
    <li>Открой эту страницу в Safari.</li>
    <li>Нажми «Поделиться» → «На экран Домой».</li>
    <li>Запускай с иконки: приложение работает офлайн, а данные не удаляются системой.</li>
    <li>Звук таймера не слышен в беззвучном режиме — это ограничение iOS. Вибрация в веб-приложениях на iPhone недоступна.</li>
  </ol></div>
  <h3>Сброс</h3>
  <div class="card">
    <button class="btn block danger" data-action="reset-program">Вернуть исходную программу</button>
    <div class="spacer"></div>
    <button class="btn block danger" data-action="wipe">Удалить все данные</button>
  </div>
  <p class="small muted" style="text-align:center">Дневник тренировок · v1</p>`;
}

async function exportData() {
  const data = JSON.stringify({ ...S, exportedAt: new Date().toISOString() });
  const name = `trenirovki-${dkey(new Date())}.json`;
  const file = new File([data], name, { type: 'application/json' });
  const done = () => { S.lastBackup = new Date().toISOString(); save(); render(); };
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Бэкап тренировок' }); done(); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  done();
}

function importData(file) {
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const d = JSON.parse(rd.result);
      if (!d || !Array.isArray(d.sessions) || !d.program) throw new Error('не похоже на бэкап');
      if (!confirm(`Заменить текущие данные бэкапом? В нём ${d.sessions.length} тренировок.`)) return;
      const ui = S.ui;
      S = migrate(d);
      S.ui = { ...S.ui, tab: ui.tab };
      save(); applyTheme(); render(); toast('Данные восстановлены');
    } catch (e) { toast('Ошибка импорта: ' + e.message); }
  };
  rd.readAsText(file);
}

// ───────────────────────── Таймер отдыха ─────────────────────────
let T = null;
try { T = JSON.parse(localStorage.getItem(TIMER_KEY)); } catch (e) { T = null; }
let AC = null;

function unlockAudio() {
  try {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
  } catch (e) { /* без звука */ }
}
function beep() {
  if (!S.settings.sound || !AC) return;
  try {
    const t0 = AC.currentTime;
    [0, 0.28, 0.56].forEach((d) => {
      const o = AC.createOscillator(), g = AC.createGain();
      o.frequency.value = d === 0.56 ? 1175 : 880;
      g.gain.setValueAtTime(0.0001, t0 + d);
      g.gain.exponentialRampToValueAtTime(0.35, t0 + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.2);
      o.connect(g).connect(AC.destination);
      o.start(t0 + d); o.stop(t0 + d + 0.22);
    });
  } catch (e) { /* без звука */ }
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}
function startTimer(sec) {
  T = { end: Date.now() + sec * 1000, total: sec, fired: false };
  localStorage.setItem(TIMER_KEY, JSON.stringify(T));
  buildTimer();
  tick();
}
function stopTimer() {
  T = null;
  localStorage.removeItem(TIMER_KEY);
  $('#timer').className = '';
  $('#app').classList.remove('with-timer');
}
function buildTimer() {
  $('#timer').innerHTML = `<div><div class="tt" id="t-tt"></div><div class="tl" id="t-tl">Отдых</div></div><span class="grow"></span>
    <button data-action="timer-add" data-v="-15">−15</button><button data-action="timer-add" data-v="15">+15</button><button data-action="timer-stop">Готов</button>
    <div class="tbar"><i id="t-bar"></i></div>`;
}
function tick() {
  const el = $('#elapsed');
  if (el) el.textContent = elapsedStr();
  if (!T) return;
  const tm = $('#timer');
  if (!tm.firstChild) buildTimer();
  const rem = Math.ceil((T.end - Date.now()) / 1000);
  tm.classList.add('on');
  $('#app').classList.add('with-timer');
  if (rem <= 0) {
    if (!T.fired) { T.fired = true; localStorage.setItem(TIMER_KEY, JSON.stringify(T)); if (rem > -5) beep(); }
    tm.classList.add('over');
    $('#t-tt').textContent = 'Подход!';
    $('#t-tl').textContent = `отдых ${fmtRest(T.total)}`;
    $('#t-bar').style.width = '100%';
    if (rem < -45) stopTimer();
    return;
  }
  tm.classList.remove('over');
  $('#t-tt').textContent = fmtRest(rem);
  $('#t-tl').textContent = 'Отдых';
  $('#t-bar').style.width = `${(1 - rem / T.total) * 100}%`;
}
setInterval(tick, 250);

// ───────────────────────── Экран не гаснет ─────────────────────────
let WL = null;
async function wake(on) {
  try {
    if (on && S.settings.wake && 'wakeLock' in navigator && !WL) {
      WL = await navigator.wakeLock.request('screen');
      WL.addEventListener('release', () => { WL = null; });
    } else if (!on && WL) { await WL.release(); WL = null; }
  } catch (e) { WL = null; }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { if (S.active) wake(true); tick(); }
});

// ───────────────────────── Шторка ─────────────────────────
let SC = {};
function openSheet(html, ctx = {}) {
  SC = ctx;
  const p = $('#sheet .pane');
  p.innerHTML = '<div class="grab"></div>' + html;
  $('#sheet').classList.add('on');
  p.scrollTop = 0;
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(drawCharts);
}
function closeSheet() {
  $('#sheet').classList.remove('on');
  document.body.style.overflow = '';
  SC = {};
}

// ───────────────────────── Рендер ─────────────────────────
const VIEWS = { workout: viewWorkout, program: viewProgram, stats: viewStats, body: viewBody, more: viewMore };
const TABS = [['workout', 'Тренировка'], ['program', 'Программа'], ['stats', 'Статистика'], ['body', 'Тело'], ['more', 'Ещё']];

function render() {
  pendingCharts = [];
  const v = VIEWS[S.ui.tab] || viewWorkout;
  $('#app').innerHTML = v();
  $('#tabs').innerHTML = TABS.map(([id, n]) => `<button class="${S.ui.tab === id ? 'on' : ''}" data-action="tab" data-v="${id}">${IC[id]}<span>${n}</span></button>`).join('');
  drawCharts();
  if (S.ui.tab === 'more') persistStatus();
}
function applyTheme() {
  const t = S.settings.theme;
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
}
async function persistStatus() {
  const el = $('#persist-st');
  if (!el || !navigator.storage || !navigator.storage.persisted) return;
  const p = await navigator.storage.persisted();
  el.textContent = p ? 'Хранилище защищено от автоочистки ✓' : 'Запусти приложение с экрана «Домой», чтобы iOS не очищала данные.';
}

// ───────────────────────── Действия ─────────────────────────
const A = {
  tab: (d) => { S.ui.tab = d.v; save(); closeSheet(); render(); window.scrollTo(0, 0); },
  start: (d) => startSession(d.day),
  'toggle-ex': (d) => { const e = S.active.entries[+d.i]; e.open = !e.open; save(); render(); },
  check: (d) => {
    unlockAudio();
    const e = S.active.entries[+d.i], s = e.sets[+d.j];
    const ex = getEx(e.ex);
    if (!s.done) {
      if (s.w === '') {
        const ph = phW(e, +d.j);
        if (ex.equip === 'bodyweight') s.w = '0';
        else if (ph) s.w = ph;
        else { toast('Укажи вес'); document.querySelector(`[data-f="w"][data-i="${d.i}"][data-j="${d.j}"]`)?.focus(); return; }
      }
      if (s.r === '') s.r = phR(e, +d.j);
      s.done = true;
      const allDone = S.active.entries.every((x) => (x.cardio ? x.cardio.done : x.sets.every((y) => y.done)));
      if (!allDone) startTimer(e.target.rest);
      if (e.sets.every((y) => y.done)) e.open = false;
    } else s.done = false;
    save(); render();
  },
  'add-set': (d) => {
    const e = S.active.entries[+d.i];
    const last = e.sets[e.sets.length - 1];
    e.sets.push({ w: last ? last.w : '', r: '', done: false });
    save(); render();
  },
  'del-set': (d) => {
    const e = S.active.entries[+d.i];
    if (e.sets.length <= 1) return;
    const k = [...e.sets].reverse().findIndex((s) => !s.done);
    e.sets.splice(k >= 0 ? e.sets.length - 1 - k : e.sets.length - 1, 1);
    save(); render();
  },
  'del-entry': (d) => {
    if (!confirm('Убрать упражнение из этой тренировки?')) return;
    S.active.entries.splice(+d.i, 1); save(); render();
  },
  'cardio-machine': (d) => { const c = S.active.entries[+d.i].cardio; c.machine = c.machine === d.v ? '' : d.v; save(); render(); },
  'cardio-done': (d) => { const c = S.active.entries[+d.i].cardio; c.done = !c.done; if (c.done && c.min === '') c.min = String(c.target); save(); render(); },
  finish: () => finishWorkout(),
  'cancel-workout': () => {
    if (!confirm('Отменить тренировку? Отмеченные подходы не сохранятся.')) return;
    S.active = null; save(); stopTimer(); wake(false); render(); window.scrollTo(0, 0);
  },
  'timer-add': (d) => { if (!T) return; T.end = Math.max(Date.now() + 1000, T.end + +d.v * 1000); T.total = Math.max(1, T.total + +d.v); T.fired = false; localStorage.setItem(TIMER_KEY, JSON.stringify(T)); tick(); },
  'timer-stop': () => stopTimer(),
  'close-sheet': () => closeSheet(),
  'ex-info': (d) => exInfoSheet(d.id),
  session: (d) => sessionSheet(d.id),
  'del-session': (d) => {
    if (!confirm('Удалить тренировку из истории?')) return;
    S.sessions = S.sessions.filter((s) => s.id !== d.id); save(); closeSheet(); render(); toast('Удалено');
  },
  'more-hist': () => { S.ui.histN += 20; save(); render(); },
  'vol-win': (d) => { S.ui.volWin = +d.v; save(); render(); },
  heat: (d) => {
    const ss = S.sessions.filter((s) => dkey(s.start) === d.k);
    toast(`${fmtD(d.k + 'T12:00')}: ${ss.length ? ss.map((s) => s.name).join(', ') : 'отдых'}`);
  },
  // Программа
  'edit-item': (d) => editItemSheet(d.day, +d.k),
  'save-item': () => saveItem(),
  'move-item': (d) => {
    const items = S.program.days[SC.dayId].items, k = SC.k, nk = k + +d.v;
    if (nk < 0 || nk >= items.length) return;
    [items[k], items[nk]] = [items[nk], items[k]];
    save(); render(); editItemSheet(SC.dayId, nk);
  },
  'del-item': () => {
    if (!confirm('Удалить упражнение из программы?')) return;
    S.program.days[SC.dayId].items.splice(SC.k, 1); save(); closeSheet(); render();
  },
  step: (d) => { const el = $('#' + d.t); el.value = Math.max(1, (num(el.value) || 0) + +d.v); },
  'set-next': (d) => { S.next = +d.idx; save(); render(); toast('Следующая: ' + S.program.days[S.program.cycle[+d.idx]].name); },
  'edit-day': (d) => {
    const day = S.program.days[d.day];
    openSheet(`<div class="sheet-head"><h2>Тренировка</h2><button class="x" data-action="close-sheet">${IC.x}</button></div>
      <label class="field"><span>Название</span><input class="inp" id="dy-name" value="${esc(day.name)}"></label>
      <label class="field"><span>Описание</span><input class="inp" id="dy-sub" value="${esc(day.sub || '')}"></label>
      <button class="btn primary block big" data-action="save-day">Сохранить</button>`, { dayId: d.day });
  },
  'save-day': () => {
    const day = S.program.days[SC.dayId];
    day.name = $('#dy-name').value.trim() || day.name;
    day.sub = $('#dy-sub').value.trim();
    save(); closeSheet(); render();
  },
  'reset-program': () => {
    if (!confirm('Вернуть исходную программу? Твои изменения в программе пропадут, история тренировок останется.')) return;
    S.program = clone(DEFAULT_PROGRAM); S.next = 0; save(); render(); toast('Программа сброшена');
  },
  pick: (d) => pickerSheet({ mode: d.mode, day: d.day, k: d.k, q: '', m: '' }),
  'pick-m': (d) => { SC.m = d.v; $('#pick-m').innerHTML = pickChips(SC); $('#pick-list').innerHTML = pickList(SC); },
  'pick-ex': (d) => pickExercise(d.id),
  'custom-ex': () => customExSheet({ mode: SC.mode, day: SC.day, k: SC.k }),
  'toggle-chip': (d, el) => el.classList.toggle('on'),
  seg: (d, el) => { el.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === el)); },
  'save-custom': () => saveCustom(),
  'del-custom': (d) => {
    if (!confirm('Удалить своё упражнение? Оно пропадёт из программы, история останется.')) return;
    delete S.custom[d.id];
    for (const day of Object.values(S.program.days)) day.items = day.items.filter((x) => x.ex !== d.id);
    save(); closeSheet(); render();
  },
  // Тело
  'body-metric': (d) => { S.ui.bodyMetric = d.v; save(); render(); },
  'save-body': () => {
    const date = $('#b-date').value || dkey(new Date());
    const rec = { date };
    let any = false;
    for (const [k] of BODY_F) { const v = num($('#b-' + k).value); if (v != null) { rec[k] = v; any = true; } }
    if (!any) { toast('Введи хотя бы одно значение'); return; }
    const ex = S.body.find((x) => x.date === date);
    if (ex) Object.assign(ex, rec); else S.body.push(rec);
    S.body.sort((a, b) => a.date.localeCompare(b.date));
    save(); render(); toast('Замер сохранён');
  },
  'del-body': (d) => {
    if (!confirm('Удалить замер?')) return;
    S.body = S.body.filter((x) => x.date !== d.d); save(); render();
  },
  // Настройки
  set: (d) => {
    const v = d.v === 'true' ? true : d.v === 'false' ? false : /^\d+$/.test(d.v) ? +d.v : d.v;
    S.settings[d.k] = v;
    if (d.k === 'theme') applyTheme();
    save(); render();
  },
  export: () => exportData(),
  wipe: () => {
    if (!confirm('Удалить ВСЕ данные: тренировки, замеры, программу? Сначала лучше сделать экспорт.')) return;
    if (!confirm('Точно? Это действие не отменить.')) return;
    stopTimer(); S = fresh(); save(); applyTheme(); render(); toast('Данные удалены');
  },
};

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = A[el.dataset.action];
  if (fn) fn(el.dataset, el, ev);
});

// Поля ввода: сохраняем без перерисовки, чтобы не терять фокус
const F = {
  w: (el) => {
    const e = S.active.entries[+el.dataset.i], j = +el.dataset.j;
    const old = e.sets[j].w;
    e.sets[j].w = el.value;
    // Протягиваем вес в следующие незаполненные подходы
    for (let k = j + 1; k < e.sets.length; k++) {
      const s = e.sets[k];
      if (s.done || (s.w !== old && s.w !== '')) break;
      s.w = el.value;
      const inp = document.querySelector(`[data-f="w"][data-i="${el.dataset.i}"][data-j="${k}"]`);
      if (inp) inp.value = el.value;
    }
  },
  r: (el) => { S.active.entries[+el.dataset.i].sets[+el.dataset.j].r = el.value; },
  notes: (el) => { S.active.notes = el.value; },
  cmin: (el) => { S.active.entries[+el.dataset.i].cardio.min = el.value; },
  ckm: (el) => { S.active.entries[+el.dataset.i].cardio.km = el.value; },
  chr: (el) => { S.active.entries[+el.dataset.i].cardio.hr = el.value; },
  inc: (el) => { const v = num(el.value); if (v && v > 0) S.settings.inc[el.dataset.k] = v; },
  pickq: (el) => { SC.q = el.value; $('#pick-list').innerHTML = pickList(SC); return true; },
};
document.addEventListener('input', (ev) => {
  const f = ev.target.dataset && ev.target.dataset.f;
  if (!f || !F[f]) return;
  if (!F[f](ev.target)) save();
});
document.addEventListener('change', (ev) => {
  const el = ev.target;
  if (el.dataset.f === 'statEx') { S.ui.statEx = el.value; save(); render(); }
  if (el.id === 'imp' && el.files[0]) { importData(el.files[0]); el.value = ''; }
});
// Enter в поле веса → к повторам; в поле повторов — закрыть клавиатуру
document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter' || !ev.target.classList.contains('set-in')) return;
  ev.preventDefault();
  const el = ev.target;
  if (el.dataset.f === 'w') document.querySelector(`[data-f="r"][data-i="${el.dataset.i}"][data-j="${el.dataset.j}"]`)?.focus();
  else el.blur();
});

// Перерисовываем графики только при смене ширины (клавиатура iOS меняет высоту)
let rsT, lastW = window.innerWidth;
window.addEventListener('resize', () => {
  clearTimeout(rsT);
  rsT = setTimeout(() => { if (window.innerWidth !== lastW && !document.activeElement?.matches('input,textarea')) { lastW = window.innerWidth; render(); } }, 200);
});

// ───────────────────────── Старт ─────────────────────────
applyTheme();
render();
if (T && !S.active) stopTimer();
if (T) { buildTimer(); tick(); }
if (S.active) wake(true);
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
