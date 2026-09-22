"use strict";

/* Presentation layer. Data/state/HOSxP logic lives in app.js and hosxp-queries.js;
 * every colour comes from CSS variables in styles.css so light/dark is one switch. */

const baht = (n) => Math.round(n).toLocaleString("en-US");
const shortBaht = (n) => (n >= 1000000 ? (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M" : n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "K" : String(Math.round(n)));
const dm = (iso) => iso.slice(8, 10) + "/" + iso.slice(5, 7);
const SAMPLE = `<span class="badge" title="ข้อมูลตัวอย่างตามแบบ — ยังไม่มีกฎดึงจาก HOSxP">ตัวอย่าง</span>`;
const TONE = { red: "var(--red)", amber: "var(--amber)", teal: "var(--teal)", primary: "var(--primary)", ink: "var(--ink)" };
const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

const ICON_SUN = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`;
const ICON_MOON = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`;

/* ---------- header controls ---------- */

function rangeSeg() {
  return `<div class="seg">${Object.keys(RANGE_LABELS).map(k => `<button class="${k === state.range ? "on" : ""}" onclick="setRange('${k}')">${RANGE_LABELS[k]}</button>`).join("")}</div>`;
}

const ICON_SPINNER = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" class="spin"><path d="M12 2a10 10 0 0 1 10 10"/></svg>`;

function processingNote() {
  return `<div class="processing-note">${ICON_SPINNER}<span>กำลังประมวลผลข้อมูล…</span></div>`;
}

// Native <input type=date> follows the browser locale (month/day/year, Gregorian) — a
// small custom calendar instead keeps the Buddhist year and stays consistent everywhere.
const DOW_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

function thaiShortDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return String(d).padStart(2, "0") + "/" + String(m).padStart(2, "0") + "/" + (y + 543);
}

function calendarPopover(key) {
  const view = state.calView[key] || state[key].slice(0, 7);
  const [vy, vm] = view.split("-").map(Number);
  const daysInMonth = new Date(vy, vm, 0).getDate();
  const startDow = new Date(vy, vm - 1, 1).getDay();
  const prevDays = new Date(vy, vm - 1, 0).getDate();
  const selected = state[key], todayS = todayIso();

  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push({ n: prevDays - startDow + 1 + i, iso: null });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ n: d, iso: `${vy}-${String(vm).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
  while (cells.length % 7 !== 0) cells.push({ n: null, iso: null });

  const cellsHtml = cells.map(c => {
    if (!c.iso) return `<span class="cal-day muted">${c.n || ""}</span>`;
    const cls = ["cal-day"];
    if (c.iso === selected) cls.push("sel");
    if (c.iso === todayS) cls.push("today");
    return `<button type="button" class="${cls.join(" ")}" onclick="pickCal('${key}','${c.iso}')">${c.n}</button>`;
  }).join("");

  return `
      <div class="cal-pop" onclick="event.stopPropagation()">
        <div class="cal-hd">
          <button type="button" class="cal-nav" onclick="navCal('${key}',-1)" aria-label="เดือนก่อนหน้า">‹</button>
          <span>${TH_MONTHS[vm - 1]} ${vy + 543}</span>
          <button type="button" class="cal-nav" onclick="navCal('${key}',1)" aria-label="เดือนถัดไป">›</button>
        </div>
        <div class="cal-dow">${DOW_TH.map(d => `<span>${d}</span>`).join("")}</div>
        <div class="cal-grid">${cellsHtml}</div>
      </div>`;
}

function customRangeInputs() {
  const field = (key, label) => `
      <div class="cal-field">
        <button type="button" class="cal-trigger ${state.calOpen === key ? "open" : ""}" onclick="toggleCal('${key}')">
          <span class="cal-field-lbl">${label}</span>${thaiShortDate(state[key])}
        </button>
        ${state.calOpen === key ? calendarPopover(key) : ""}
      </div>`;
  return `<div class="datesel">${field("customFrom", "จาก")}${field("customTo", "ถึง")}</div>`;
}

function themeButton() {
  const dark = state.theme === "dark";
  return `<button class="iconbtn" onclick="toggleTheme()" title="${dark ? "สลับเป็นโหมดสว่าง" : "สลับเป็นโหมดมืด"}" aria-label="สลับธีม">${dark ? ICON_SUN : ICON_MOON}</button>`;
}

/* ---------- small building blocks ---------- */

function kpi({ label, value, note, tone, onclick, hero, meter, spark }) {
  return `
    <div class="kpi ${hero ? "hero" : ""} ${onclick ? "clickable" : ""}" ${onclick ? `onclick="${onclick}" title="คลิกดูรายการ"` : ""} style="--tone: ${TONE[tone]};">
      <div class="lbl">${label}</div>
      <div style="display: flex; align-items: baseline; gap: 7px;">
        <span class="val head num">${value}</span>
        <span class="unit">${meter ? "%" : "บาท"}</span>
      </div>
      ${meter ? `<div class="meter"><i style="width: ${Math.min(100, Number(value) || 0)}%"></i></div>` : ""}
      <div class="note">${note}</div>
      ${onclick ? `<div class="kpi-hint" style="color: ${TONE[tone]};">คลิกดูรายการ →</div>` : ""}
      ${spark ? `<div class="spark">${spark}</div>` : ""}
    </div>`;
}

function funnelCard(s) {
  const tone = s.focusKey === "pending" ? "red" : s.focusKey === "partial" ? "amber" : s.focusKey === "void" ? "red" : s.label.indexOf("ออก Invoice แล้ว") >= 0 ? "teal" : "ink";
  const active = s.focusKey && s.focusKey === state.focus && state.drillOpen;
  return `
    <div class="fcard ${s.focusKey ? "clickable" : ""} ${active ? "active" : ""}" ${s.focusKey ? `onclick="setFocus('${s.focusKey}')" title="คลิกดูรายการ"` : ""} style="--tone: ${TONE[tone]};">
      <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 8px;">
        <span style="font-size: 12.5px; font-weight: 600;">${s.label}</span>
        <span class="num" style="font-size: 11px; color: var(--muted2);">${s.value === "—" ? "" : s.value}</span>
      </div>
      <div class="n head num">${s.count}</div>
      <div class="thin"><i style="width: ${s.pct}%; background: var(--tone);"></i></div>
      <div style="font-size: 12px; color: var(--tone); font-weight: 500; min-height: 17px;">${s.hint ? "คลิกดูรายการ →" : ""}</div>
    </div>`;
}

/* ---------- trend ---------- */

function isoAddDays(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d + n).toLocaleDateString("sv-SE");
}

// The trend always shows daily points: "today" falls back to the last 7 days.
function trendDays() {
  const today = todayIso();
  let from, to = today;
  if (state.range === "month") from = today.slice(0, 8) + "01";
  else if (state.range === "custom") { from = state.customFrom; to = state.customTo; }
  else from = isoAddDays(today, -6);
  const days = [];
  for (let d = from; d <= to && days.length < 92; d = isoAddDays(d, 1)) days.push(d);
  return days;
}

function trendSeries(vm) {
  const t = vm.raw.trend;
  if (!t) return null;
  return trendDays().map(d => ({ d, rev: (t[d] || {}).rev || 0, pend: (t[d] || {}).pend || 0, pc: (t[d] || {}).pc || 0 }));
}

function niceMax(v) {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(v, 1))));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

function sparkline(vm) {
  const s = trendSeries(vm);
  if (!s || s.length < 2) return "";
  const W = 120, H = 34, max = Math.max(1, ...s.map(p => p.pend));
  const pts = s.map((p, i) => [(i / (s.length - 1)) * W, H - 3 - (p.pend / max) * (H - 8)]);
  const line = pts.map(([x, y]) => x.toFixed(1) + "," + y.toFixed(1)).join(" ");
  const last = pts[pts.length - 1];
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><polyline points="${line}" fill="none" style="stroke: var(--gold);" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" /><circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="2.8" fill="#F8FAFC" /></svg>`;
}

function trendSection(vm) {
  const s = trendSeries(vm);
  if (!s || s.length === 0) return "";
  const W = 1000, H = 250, pl = 54, pr = 14, pt = 16, pb = 30;
  const iw = W - pl - pr, ih = H - pt - pb, n = s.length, slot = iw / n;
  const max = niceMax(Math.max(1, ...s.map(p => p.rev)));
  const y = (v) => pt + ih - (v / max) * ih;
  const cx = (i) => pl + (i + 0.5) * slot;
  const grid = [0, 1, 2, 3, 4].map(k => {
    const v = (max / 4) * k;
    return `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" style="stroke: var(--line);" stroke-width="1" /><text x="${pl - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" style="fill: var(--muted2);">${shortBaht(v)}</text>`;
  }).join("");
  const bw = Math.max(2, Math.min(28, slot * 0.6));
  const bars = s.map((p, i) => `<rect x="${(cx(i) - bw / 2).toFixed(1)}" y="${y(p.rev).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0, pt + ih - y(p.rev)).toFixed(1)}" rx="3" style="fill: var(--primary); opacity: 0.28;"><title>${dm(p.d)} · ยอดบริการรวม ${baht(p.rev)} บาท</title></rect>`).join("");
  const line = s.map((p, i) => cx(i).toFixed(1) + "," + y(p.pend).toFixed(1)).join(" ");
  const area = `${cx(0).toFixed(1)},${pt + ih} ${line} ${cx(n - 1).toFixed(1)},${pt + ih}`;
  const dots = s.map((p, i) => `<circle cx="${cx(i).toFixed(1)}" cy="${y(p.pend).toFixed(1)}" r="${n > 40 ? 2 : 3.6}" style="fill: var(--red); stroke: var(--card);" stroke-width="1.6"><title>${dm(p.d)} · ยังไม่ออกใบแจ้งหนี้ ${baht(p.pend)} บาท (${fmt(p.pc)} ราย)</title></circle>`).join("");
  const step = Math.max(1, Math.ceil(n / 9));
  const xl = s.map((p, i) => (i % step === 0 || i === n - 1) ? `<text x="${cx(i).toFixed(1)}" y="${H - 9}" text-anchor="middle" font-size="11" style="fill: var(--muted2);">${dm(p.d)}</text>` : "").join("");
  const totalPend = s.reduce((a, p) => a + p.pend, 0);
  const peak = s.reduce((a, p) => (p.pend > a.pend ? p : a), s[0]);
  const note = state.range === "today" ? "วันนี้ · แสดงย้อนหลัง 7 วัน" : "รายวันตามช่วงที่เลือก";
  return `
      <section class="card">
        <div style="display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 14px; margin-bottom: 8px;">
          <div>
            <h2>แนวโน้มรายวัน</h2>
            <div class="hint" style="margin-top: 2px;">${note} · ผ่านเมาส์ที่แท่งหรือจุดเพื่อดูตัวเลข</div>
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 22px; align-items: flex-end;">
            <div><div style="font-size: 11.5px; color: var(--muted2);">ยังไม่ออกใบแจ้งหนี้รวม</div><div class="head num" style="font-size: 20px; font-weight: 600; color: var(--red);">${baht(totalPend)} <span style="font-size: 12px; color: var(--muted2); font-weight: 400;">บาท</span></div></div>
            <div><div style="font-size: 11.5px; color: var(--muted2);">วันที่ค้างสูงสุด</div><div class="head num" style="font-size: 20px; font-weight: 600;">${peak.pend > 0 ? dm(peak.d) : "—"}</div></div>
            <div style="display: flex; gap: 14px; font-size: 12px; color: var(--text2); padding-bottom: 3px;">
              <span style="display: inline-flex; align-items: center; gap: 6px;"><span style="width: 10px; height: 10px; border-radius: 3px; background: var(--primary); opacity: 0.35; display: inline-block;"></span>ยอดบริการรวม</span>
              <span style="display: inline-flex; align-items: center; gap: 6px;"><span style="width: 14px; height: 3px; background: var(--red); display: inline-block; border-radius: 2px;"></span>ยังไม่ออกใบแจ้งหนี้</span>
            </div>
          </div>
        </div>
        <svg viewBox="0 0 ${W} ${H}" width="100%" style="display: block;" role="img" aria-label="แนวโน้มรายวัน">
          ${grid}${bars}
          <polygon points="${area}" style="fill: var(--red);" opacity="0.10" />
          <polyline points="${line}" fill="none" style="stroke: var(--red);" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" />
          ${dots}${xl}
        </svg>
      </section>`;
}

/* ---------- flow + actions ---------- */

function flowAndActions(vm) {
  const r = vm.raw;
  const revenue = r.revenue;
  const invoiced = Math.max(0, revenue - r.pendingValue);
  const at = r.arTransfer;
  const debted = at ? at.yAmt : invoiced * 0.958;
  const gap3 = at ? Math.max(0, at.amt - at.yAmt) : Math.max(0, invoiced - debted);
  const steps = [
    { label: "1 · ให้บริการแล้ว", count: fmt(r.totalCases) + " ราย", amount: revenue, gap: 0, gapText: "ยอดตั้งต้นของช่วงนี้", neutral: true },
    { label: "2 · เรียกเก็บแล้ว", count: fmt(at ? at.n : r.billedCases) + " ใบแจ้งหนี้", amount: at ? at.amt : invoiced, gap: r.pendingValue, gapText: `ยังไม่ออกใบแจ้งหนี้ ${baht(r.pendingValue)} บาท (${fmt(r.pendingCases)} ราย)`, sample: !at },
    { label: "3 · ตั้งเป็นลูกหนี้", count: at ? fmt(at.yN) + " ใบลูกหนี้" : fmt(Math.round(r.billedCases * 0.968)) + " ราย", amount: debted, gap: gap3, gapText: `มีใบแจ้งหนี้แต่ยังไม่ตั้งลูกหนี้ ${baht(gap3)} บาท`, sample: !at }
  ];
  const pct = (v) => (revenue > 0 ? Math.min(100, Math.round((v / revenue) * 100)) : 0);
  const flowRows = steps.map(f => `
        <div class="flowrow">
          <div>
            <div style="font-size: 13.5px; font-weight: 600;">${f.label}${f.sample ? SAMPLE : ""}</div>
            <div class="num" style="font-size: 11.5px; color: var(--muted2);">${f.count}</div>
          </div>
          <div>
            <div class="bar"><i class="a" style="width: ${pct(f.amount)}%"></i><i class="g" style="width: ${pct(f.gap)}%"></i></div>
            <div style="font-size: 12px; color: ${f.neutral ? "var(--muted2)" : "var(--red)"}; margin-top: 4px; font-weight: 500;">${f.gapText}</div>
          </div>
          <div style="text-align: right;">
            <div class="head num" style="font-size: 19px; font-weight: 600;">${baht(f.amount)}</div>
            <div style="font-size: 11.5px; color: var(--muted2);">บาท</div>
          </div>
        </div>`).join("");

  const actions = [
    { text: `ปิดยอดผู้รับบริการ ${fmt(r.pendingCases)} รายที่ยังไม่ออกใบแจ้งหนี้`, owner: "งานการเงิน / เวชระเบียน", amount: r.pendingValue, unit: "บาท", tone: "red" },
    { text: `ตั้งลูกหนี้ให้ใบเรียกเก็บที่ค้างอยู่ ${at ? fmt(at.nulN) : fmt(Math.round(r.billedCases * 0.034))} ใบ`, owner: "งานบัญชีลูกหนี้", amount: at ? at.nulAmt : gap3, unit: "บาท", tone: "red", sample: !at }
  ];
  const recover = actions.reduce((sum, a) => sum + a.amount, 0);
  const actionRows = actions.map(a => `
        <div class="action" style="--tone: ${TONE[a.tone]};">
          <div style="min-width: 0;">
            <div style="font-size: 13.5px; font-weight: 500; line-height: 1.45;">${a.text}${a.sample ? SAMPLE : ""}</div>
            <div style="font-size: 11.5px; color: var(--muted2); margin-top: 3px;">ผู้รับผิดชอบ: ${a.owner}</div>
          </div>
          <div style="text-align: right; white-space: nowrap;">
            <div class="head num" style="font-size: 17px; font-weight: 600; color: var(--tone);">${baht(a.amount)}</div>
            <div style="font-size: 11px; color: var(--muted2);">${a.unit}</div>
          </div>
        </div>`).join("");

  return `
      <section class="split">
        <div class="card">
          <div class="card-head"><h2>เงินไหลไปถึงขั้นไหนแล้ว</h2><span class="hint">ให้บริการ → เรียกเก็บ → ตั้งลูกหนี้</span></div>
          <div style="display: flex; flex-direction: column; gap: 14px;">${flowRows}</div>
        </div>
        <div class="card" style="display: flex; flex-direction: column;">
          <div class="card-head" style="margin-bottom: 12px;"><h2>สิ่งที่ต้องสั่งการวันนี้</h2><span class="hint">เรียงตามเงินที่จะได้คืน</span></div>
          <div style="display: flex; flex-direction: column; gap: 10px;">${actionRows}</div>
          <div style="margin-top: auto; padding-top: 14px; font-size: 12px; color: var(--muted); line-height: 1.6;">รวมเงินที่มีโอกาสกู้คืนในช่วงนี้ <strong class="num" style="color: var(--red);">${baht(recover)} บาท</strong>${actions.some(x => x.sample) ? SAMPLE : ""}</div>
        </div>
      </section>`;
}

/* ---------- summary cards (AR aging, payer donut, data quality) ---------- */

const DONUT_COLORS = ["var(--primary)", "var(--teal)", "var(--amber)", "var(--red)", "var(--muted2)"];

function donut(items, total) {
  const R = 46, C = 2 * Math.PI * R;
  let off = 0;
  const segs = items.map((it, i) => {
    const len = total > 0 ? (it.value / total) * C : 0;
    const el = `<circle cx="60" cy="60" r="${R}" fill="none" stroke-width="16" style="stroke: ${DONUT_COLORS[i % DONUT_COLORS.length]};" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 60 60)"><title>${it.name} · ${baht(it.value)} บาท (${total > 0 ? Math.round((it.value / total) * 100) : 0}%)</title></circle>`;
    off += len;
    return el;
  }).join("");
  return `<svg width="128" height="128" viewBox="0 0 120 120" role="img" aria-label="สัดส่วนสิทธิ" style="flex-shrink: 0;">
      <circle cx="60" cy="60" r="${R}" fill="none" stroke-width="16" style="stroke: var(--track);" />
      ${segs}
      <text x="60" y="56" text-anchor="middle" font-size="10.5" style="fill: var(--muted2);">รวม</text>
      <text x="60" y="73" text-anchor="middle" font-size="15" font-weight="600" style="fill: var(--ink);">${shortBaht(total)}</text>
    </svg>`;
}

function miniCards(vm) {
  const r = vm.raw;
  const cardOf = (title, body, note, sample) => `
        <div class="card" style="padding: 16px 18px 16px;">
          <div style="font-size: 13px; color: var(--muted); margin-bottom: 10px; font-weight: 500;">${title}${sample ? SAMPLE : ""}</div>
          ${body}
          <div style="font-size: 11.5px; color: var(--muted2); margin-top: 10px;">${note}</div>
        </div>`;

  // AR aging (live: days from visit-open date to today, active invoices)
  const sampleAging = [["ยังไม่ครบกำหนด", "2,703,200", 31, "teal"], ["0–30 วัน", "2,267,200", 26, "teal"], ["31–60 วัน", "1,482,400", 17, "amber"], ["61–90 วัน", "1,046,400", 12, "amber"], ["เกิน 90 วัน", "1,220,800", 14, "red"]];
  const arDefs = [["d30", "0–30 วัน", "teal"], ["d60", "31–60 วัน", "amber"], ["d90", "61–90 วัน", "amber"], ["d91", "เกิน 90 วัน", "red"]];
  const arTotal = r.ar ? r.ar.reduce((sum, x) => sum + num(x.value), 0) : 0;
  const aging = r.ar
    ? arDefs.map(([key, label, tone]) => { const row = r.ar.find(x => x.bucket === key); const v = num(row && row.value); return [label, baht(v), arTotal > 0 ? Math.round((v / arTotal) * 100) : 0, tone]; })
    : sampleAging;
  const agingBody = `<div style="display: flex; flex-direction: column; gap: 10px;">${aging.map(([l, amt, p, tone]) => `
          <div style="display: grid; grid-template-columns: 82px minmax(0, 1fr) auto; gap: 10px; align-items: center;">
            <span style="font-size: 12.5px; color: var(--text2);">${l}</span>
            <span class="thin"><i style="width: ${p}%; background: ${TONE[tone]};"></i></span>
            <span class="num" style="font-size: 12.5px; font-weight: 600; text-align: right; white-space: nowrap;">${amt}</span>
          </div>`).join("")}</div>`;

  // payers (live: charges by visit right) as a donut + legend
  const samplePayers = [{ name: "UC (บัตรทอง)", value: 3662400 }, { name: "ประกันสังคม", value: 1656800 }, { name: "ข้าราชการ", value: 1395200 }, { name: "อปท.", value: 697600 }];
  const payerRows = r.payers ? r.payers.rows : samplePayers;
  const payerTotal = r.payers ? r.payers.total : payerRows.reduce((s, p) => s + p.value, 0) / 0.85;
  const topSum = payerRows.reduce((s, p) => s + p.value, 0);
  const items = payerRows.slice();
  if (payerTotal - topSum > 0.5) items.push({ name: "อื่น ๆ", value: payerTotal - topSum });
  const legend = items.map((p, i) => `
          <div style="display: grid; grid-template-columns: 10px minmax(0, 1fr) auto auto; gap: 8px; align-items: baseline;">
            <span style="width: 9px; height: 9px; border-radius: 3px; background: ${DONUT_COLORS[i % DONUT_COLORS.length]}; align-self: center;"></span>
            <span style="font-size: 12.5px; color: var(--text2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${p.name}">${p.name}</span>
            <span class="num" style="font-size: 12.5px; font-weight: 600;">${baht(p.value)}</span>
            <span class="num" style="font-size: 12px; color: var(--muted2); min-width: 30px; text-align: right;">${payerTotal > 0 ? Math.round((p.value / payerTotal) * 100) : 0}%</span>
          </div>`).join("");
  const payerBody = `<div style="display: flex; align-items: center; gap: 14px;">${donut(items, payerTotal)}<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px;">${legend}</div></div>`;

  // data quality
  const sampleQ = !r.qualityLive;
  const quality = [["ใบเรียกเก็บซ้ำ", fmt(r.dupCount), baht(r.dupValue)], ["ยอดไม่ตรงกับบริการ", fmt(r.mismatchCount), baht(r.mismatchValue)], ["มีบริการแต่ไม่มีใบเรียกเก็บ", fmt(r.pendingCases), baht(r.pendingValue)], ["มีลูกหนี้แต่ไม่มีใบเสร็จ", fmt(r.noReceiptCount), baht(r.noReceiptValue)]];
  const qualityBody = `<div style="display: flex; flex-direction: column; gap: 9px;">${quality.map(([l, n, amt]) => `
          <div style="display: grid; grid-template-columns: minmax(0, 1fr) 54px 86px; gap: 9px; align-items: baseline;">
            <span style="font-size: 12.5px; color: var(--text2);">${l}</span>
            <span class="num" style="font-size: 12.5px; font-weight: 600; text-align: right;">${n}</span>
            <span class="num" style="font-size: 12px; text-align: right; color: var(--muted2);">${amt}</span>
          </div>`).join("")}</div>`;

  return `
      <section class="cards4">
        ${cardOf("ลูกหนี้แยกตามอายุหนี้", agingBody, r.ar ? "หน่วย: บาท · นับจากวันที่เปิด visit ถึงปัจจุบัน" : "หน่วย: บาท", !r.ar)}
        ${cardOf("สิทธิรักษามียอดค่าใช้จ่ายสูงสุด", payerBody, r.payers ? "ยอดค่าใช้จ่าย (บาท) · % = สัดส่วนของค่าใช้จ่ายรวมในช่วงที่เลือก" : "% = สัดส่วนของค่าใช้จ่ายรวม", !r.payers)}
        ${cardOf("ข้อมูลที่ต้องแก้ก่อนปิดบัญชี", qualityBody, "หน่วย: รายการ / บาท", sampleQ)}
      </section>`;
}

function deptsCard(vm) {
  const rows = vm.depts.map(d => `
        <div style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(60px, 32%) 84px 56px; gap: 10px; align-items: center;">
          <span style="font-size: 12.5px; color: var(--text2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${d.name}">${d.name}</span>
          <span class="thin"><i style="width: ${d.pct}%; background: var(--primary);"></i></span>
          <span class="num" style="font-size: 12.5px; font-weight: 600; text-align: right;">${d.value}</span>
          <span class="num" style="font-size: 12px; color: var(--muted2); text-align: right;">${d.cases} ราย</span>
        </div>`).join("");
  return `
      <section class="card">
        <h2 style="margin-bottom: 12px;">${vm.deptTitle}</h2>
        <div style="display: flex; flex-direction: column; gap: 11px;">${rows || `<div class="hint">ไม่มีรายการค้างในช่วงนี้</div>`}</div>
      </section>`;
}

/* ---------- drill-down (inline panel) ---------- */

function drillPanel(vm) {
  if (!state.drillOpen) return "";
  const active = vm.focuses.find(f => f.key === state.focus) || vm.focuses[0];
  const maxAge = state.focus === "pending" ? Math.max(0, ...vm.rows.map(r => parseFloat(r.age) || 0)) : null;
  const shown = vm.rows.slice(0, 40);
  const focusTabs = vm.focuses.map(f => `<button class="chipbtn ${f.key === state.focus ? "on" : ""}" onclick="setFocus('${f.key}')">${f.label} <span class="num" style="opacity: 0.75;">${f.count}</span></button>`).join("");
  const sortBtns = vm.sorts.map(s => {
    const on = s.key === state.sort || (!vm.sorts.some(x => x.key === state.sort) && s.key === "amount");
    return `<button class="pill ${on ? "on" : ""}" style="padding: 5px 13px; font-size: 12.5px;" onclick="setSort('${s.key}')">${s.label}</button>`;
  }).join("");
  const rowsHtml = shown.length
    ? shown.map(row => `
          <tr>
            <td class="num" style="font-weight: 500; padding-left: 20px;">${row.id}</td>
            <td>${row.name}</td>
            <td style="color: var(--text2);">${row.unit}</td>
            <td class="num" style="color: var(--text2); white-space: nowrap;">${row.time}</td>
            <td class="num" style="text-align: right; font-weight: 600; color: ${row.ageInk};">${row.age}</td>
            <td class="num" style="text-align: right; font-weight: 600;">${row.amount}</td>
            <td style="padding-right: 20px;"><span class="tag">${row.reason}</span></td>
          </tr>`).join("")
    : `<tr><td colspan="7" style="padding: 28px 20px; text-align: center; color: var(--muted2);">ไม่พบรายการในช่วงเวลานี้</td></tr>`;
  return `
      <section id="drill-panel" class="card" style="padding: 0; overflow: hidden;">
        <div class="drill-head">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;">
            <div>
              <div style="font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--gold); font-weight: 600;">Drill-down · ${vm.view === "OPD" ? "HN → VN" : "HN → AN"} → หน่วยบริการ → จำนวนเงิน</div>
              <h3 style="font-size: 19px; font-weight: 600; margin-top: 4px;">${vm.focusTitle} — ${vm.view}</h3>
              <div style="font-size: 12.5px; color: var(--hdr-muted); margin-top: 3px;">ช่วงข้อมูล: ${vm.rangeLabel} · ${vm.hospital}</div>
            </div>
            <button class="chipbtn" onclick="closeDrill()">ปิด</button>
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 24px;">
            <div><div style="font-size: 11.5px; color: var(--hdr-muted);">มูลค่ารวม</div><div class="head num" style="font-size: 21px; font-weight: 600; color: #FF9A8F;">${active.value} <span style="font-size: 12px; color: var(--hdr-muted); font-weight: 400;">บาท</span></div></div>
            <div><div style="font-size: 11.5px; color: var(--hdr-muted);">จำนวนรายการ</div><div class="head num" style="font-size: 21px; font-weight: 600;">${vm.rowCount}</div></div>
            ${maxAge === null ? "" : `<div><div style="font-size: 11.5px; color: var(--hdr-muted);">ค้างนานสุด</div><div class="head num" style="font-size: 21px; font-weight: 600; color: var(--gold);">${maxAge.toFixed(1)} <span style="font-size: 12px; color: var(--hdr-muted); font-weight: 400;">ชม.</span></div></div>`}
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">${focusTabs}</div>
        </div>
        <div style="padding: 12px 20px; background: var(--soft); border-bottom: 1px solid var(--border); display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">
          <span class="hint">เรียงตาม</span>${sortBtns}
        </div>
        <div style="overflow-x: auto;">
          <table>
            <thead><tr>
              <th style="padding-left: 20px;">${vm.cols.c1}</th><th>ผู้รับบริการ</th><th>${vm.cols.c3}</th><th>${vm.cols.c4}</th>
              <th style="text-align: right;">${vm.cols.c5}</th><th style="text-align: right;">${vm.cols.c6}</th><th style="padding-right: 20px;">${vm.cols.c7}</th>
            </tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
        <div class="hint" style="padding: 13px 20px 16px; background: var(--soft); border-top: 1px solid var(--border); display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
          <span>แสดง ${shown.length} จาก ${vm.rowCount} รายการ · เรียงตาม${vm.sortLabel}</span><span>ช่วงข้อมูล: ${vm.rangeLabel}</span>
        </div>
      </section>`;
}

/* ---------- skeleton (no live numbers yet — still connecting, or no session at all) ---------- */

// Box titles are fixed text, not query results, so they're safe to show even
// with nothing connected — only the numbers underneath are placeholders.
const SK_KPIS = [
  ["ยังไม่ออก Invoice — มูลค่ารวม", "จำนวนราย (OPD/IPD)"],
  ["Invoice ไม่ครบยอด — ส่วนต่างที่ยังขาด", "จำนวนใบ"],
  ["ยกเลิก Invoice (ต้องออกใหม่)", "จำนวนใบ"],
  ["อัตราการออก Invoice", "ของผู้รับบริการที่มีค่าใช้จ่าย · เป้า 99%"]
];
const SK_FUNNEL = {
  OPD: ["Visit ทั้งหมด", "Visit ที่มีค่าใช้จ่าย", "ออก Invoice แล้ว", "ยังไม่ออก Invoice", "Invoice ไม่ครบยอด", "ยกเลิก Invoice"],
  IPD: ["Admit", "Discharge", "มีค่าใช้จ่าย", "ออก Invoice แล้ว", "ยังไม่ออก Invoice", "Invoice ไม่ครบยอด", "ยกเลิก Invoice"]
};
const SK_MINI = ["ลูกหนี้แยกตามอายุหนี้", "สิทธิรักษามียอดค่าใช้จ่ายสูงสุด", "ข้อมูลที่ต้องแก้ก่อนปิดบัญชี"];

function skeleton() {
  const block = (h, w) => `<div class="sk" style="height: ${h}px; ${w ? `width: ${w};` : ""}"></div>`;
  const kpiSk = ([label, note]) => `
        <div class="kpi" style="--tone: var(--muted2);">
          <div class="lbl">${label}</div>
          ${block(34, "55%")}
          <div class="note">${note}</div>
        </div>`;
  const fcardSk = (label) => `
        <div class="fcard">
          <div style="font-size: 12.5px; font-weight: 600;">${label}</div>
          ${block(26, "45%")}
          ${block(8)}
        </div>`;
  const miniSk = (label) => `
        <div class="card" style="padding: 16px 18px 16px;">
          <div style="font-size: 13px; color: var(--muted); margin-bottom: 10px; font-weight: 500;">${label}</div>
          ${block(90)}
        </div>`;
  const deptLabel = state.view === "IPD" ? "หอผู้ป่วยที่ค้างเรียกเก็บสูงสุด" : "หน่วยบริการที่ค้างเรียกเก็บสูงสุด";

  return `
      <section class="kpis">${SK_KPIS.map(kpiSk).join("")}</section>
      <section class="card" style="display: flex; flex-direction: column; gap: 14px;">
        <h2>แนวโน้มรายวัน</h2>
        ${block(230)}
      </section>
      <section>
        <h2 style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">ลำดับการเรียกเก็บ</h2>
        <div class="fgrid">${SK_FUNNEL[state.view === "IPD" ? "IPD" : "OPD"].map(fcardSk).join("")}</div>
      </section>
      <section class="split">
        <div class="card" style="display: flex; flex-direction: column; gap: 16px;">
          <h2>เงินไหลไปถึงขั้นไหนแล้ว</h2>
          ${block(30)}${block(30)}${block(30)}
        </div>
        <div class="card" style="display: flex; flex-direction: column; gap: 14px;">
          <h2>สิ่งที่ต้องสั่งการวันนี้</h2>
          ${block(56)}${block(56)}
        </div>
      </section>
      <section class="cards4">${SK_MINI.map(miniSk).join("")}</section>
      <section class="card">
        <h2 style="margin-bottom: 12px;">${deptLabel}</h2>
        ${block(120)}
      </section>`;
}

/* ---------- page ---------- */

function template(vm, ctx) {
  // Entrance animation plays once, when real content first appears (not on every re-render).
  const animate = !ctx.skeleton && !window.__contentPainted;
  if (!ctx.skeleton) window.__contentPainted = true;
  const tabs = vm.tabs.map(t => `<button class="pill ${t.key === state.view ? "on" : ""}" onclick="setView('${t.key}')">${t.label}</button>`).join("");
  const body = ctx.skeleton
    ? skeleton()
    : `
      <section class="kpis">
        ${kpi({ label: "ยังไม่ออก Invoice — มูลค่ารวม", value: vm.hero.value, note: `${vm.hero.cases} ราย (${vm.hero.opdCases} OPD / ${vm.hero.ipdCases} IPD)`, tone: "red", hero: true, onclick: "setFocus('pending')", spark: sparkline(vm) })}
        ${kpi({ label: "Invoice ไม่ครบยอด — ส่วนต่างที่ยังขาด", value: vm.hero.partialValue, note: `${vm.hero.partialCases} ใบ`, tone: "amber", onclick: "setFocus('partial')" })}
        ${kpi({ label: "ยกเลิก Invoice (ต้องออกใหม่)", value: vm.hero.voidValue, note: `${vm.hero.voidCases} ใบ`, tone: "red", onclick: "setFocus('void')" })}
        ${kpi({ label: "อัตราการออก Invoice", value: vm.hero.rate, note: "ของผู้รับบริการที่มีค่าใช้จ่าย · เป้า 99%", tone: "teal", meter: true })}
      </section>

      ${trendSection(vm)}

      <section>
        <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 11px; margin-bottom: 12px;">
          <h2 style="font-size: 16px; font-weight: 600;">ลำดับการเรียกเก็บ</h2>
          <span class="hint">${vm.funnelTitle.replace("เส้นทางการเรียกเก็บ — ", "")} · จำนวนราย · มูลค่า</span>
          <div class="pills" style="margin-left: auto;">${tabs}</div>
        </div>
        <div class="fgrid">${vm.funnel.map(funnelCard).join("")}</div>
      </section>

      ${flowAndActions(vm)}

      ${miniCards(vm)}

      ${deptsCard(vm)}

      ${drillPanel(vm)}

      <footer class="hint" style="line-height: 1.6;">ที่มา: HOSxP — ${vm.hospital}</footer>`;

  return `
  <div class="page ${ctx.refreshing ? "refreshing" : ""}">
    ${ctx.refreshing ? `<div class="topbar"></div>` : ""}
    ${state.calOpen ? `<div class="cal-backdrop" onclick="closeCal()"></div>` : ""}
    <header class="hdr">
      <div class="banner">
        <div class="banner-text">
          <div>
            <div class="kicker">BMS Finance Control Center</div>
            <h1>Unbilled Service${ctx.demo ? `<span class="demo-tag" title="${ctx.bmsError ? "เชื่อมต่อ HOSxP ไม่สำเร็จ: " + ctx.bmsError : "ยังไม่ได้เชื่อมต่อ HOSxP"}">ยังไม่ได้เชื่อมต่อ</span>` : ""}</h1>
            ${ctx.bmsError ? `<div class="bms-error">เชื่อมต่อ HOSxP ไม่สำเร็จ: ${ctx.bmsError}</div>` : ""}
            <div class="sub">ให้บริการแล้ว แต่ยังไม่ได้เรียกเก็บเงินกี่บาท?</div>
          </div>
        </div>
      </div>
      <div class="hdr-bar">
        <div class="hdr-hospital"><div class="name">${vm.hospital}</div>${ctx.skeleton ? "" : `<div class="stamp">ข้อมูล ณ ${vm.stamp}</div>`}<div class="version">version 1.2</div></div>
        ${ctx.refreshing ? processingNote() : ""}
        ${rangeSeg()}
        ${state.range === "custom" ? customRangeInputs() : ""}
        ${themeButton()}
      </div>
    </header>
    <main class="main ${animate ? "enter" : ""}">${body}</main>
  </div>`;
}
