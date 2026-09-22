"use strict";

const HOSPITAL_NOT_CONNECTED = "ยังไม่ได้เชื่อมต่อฐานข้อมูล";
const fmt = (n) => n.toLocaleString('en-US');

const DATA = {
  today: {
    label: "วันนี้", stamp: "18 ก.ย. 2569 14:32",
    OPD: { visits: 1250, charged: 1180, invoiced: 1120, pending: 60, pendingValue: 145800, partial: 14, partialValue: 23400, void: 8, voidValue: 11250 },
    IPD: { admit: 42, discharge: 31, charged: 31, invoiced: 27, pending: 4, pendingValue: 312500, partial: 2, partialValue: 48200, void: 1, voidValue: 26400 }
  },
  week: {
    label: "7 วัน", stamp: "12–18 ก.ย. 2569",
    OPD: { visits: 8420, charged: 7960, invoiced: 7742, pending: 218, pendingValue: 512300, partial: 61, partialValue: 98700, void: 29, voidValue: 44100 },
    IPD: { admit: 264, discharge: 241, charged: 241, invoiced: 223, pending: 18, pendingValue: 1284000, partial: 9, partialValue: 187500, void: 4, voidValue: 96300 }
  },
  month: {
    label: "เดือนนี้", stamp: "1–18 ก.ย. 2569",
    OPD: { visits: 21860, charged: 20510, invoiced: 20012, pending: 498, pendingValue: 1182400, partial: 143, partialValue: 241900, void: 67, voidValue: 103800 },
    IPD: { admit: 688, discharge: 631, charged: 631, invoiced: 589, pending: 42, pendingValue: 2946000, partial: 21, partialValue: 412700, void: 11, voidValue: 238500 }
  }
};

const DEPTS = {
  OPD: [["ห้องฉุกเฉิน (ER)", 18, 41200], ["คลินิกกระดูกและข้อ", 11, 32800], ["ทันตกรรม", 13, 26500], ["คลินิกอายุรกรรม", 9, 24100], ["เวชศาสตร์ฟื้นฟู", 9, 21200]],
  IPD: [["หอผู้ป่วยศัลยกรรมชาย", 1, 128500], ["หอผู้ป่วย ICU", 1, 96000], ["หอผู้ป่วยสูติกรรม", 1, 52000], ["หอผู้ป่วยกุมารเวช", 1, 36000]]
};

const ROWS = {
  OPD: [
    ["VN 690918-0412", "น.ส. ก. ศรีสุวรรณ", "ห้องฉุกเฉิน (ER)", "02:14", 12.3, 18400, "รอสรุปเวชระเบียน"],
    ["VN 690918-0388", "นาย บ. ทองอินทร์", "คลินิกกระดูกและข้อ", "08:05", 6.4, 15200, "ยังไม่ลงสิทธิการรักษา"],
    ["VN 690918-0507", "นาง ค. พิมพ์ใจ", "ทันตกรรม", "09:22", 5.2, 12800, "รอผลแลป/ค่าบริการเพิ่ม"],
    ["VN 690918-0561", "นาย ง. เจริญผล", "คลินิกอายุรกรรม", "10:41", 3.9, 9600, "ยังไม่ลงสิทธิการรักษา"],
    ["VN 690918-0603", "นาง จ. แก้วประเสริฐ", "เวชศาสตร์ฟื้นฟู", "11:18", 3.2, 8400, "รอสรุปเวชระเบียน"],
    ["VN 690918-0644", "นาย ฉ. ภู่ระหงษ์", "ห้องฉุกเฉิน (ER)", "11:55", 2.6, 7900, "ค้างเวชภัณฑ์ยังไม่ตัดจ่าย"],
    ["VN 690918-0689", "น.ส. ช. วรรณดี", "คลินิกกระดูกและข้อ", "12:30", 2.0, 6300, "รอผลแลป/ค่าบริการเพิ่ม"],
    ["VN 690918-0721", "นาย ซ. อุดมทรัพย์", "ทันตกรรม", "13:10", 1.4, 5100, "ค้างเวชภัณฑ์ยังไม่ตัดจ่าย"]
  ],
  IPD: [
    ["AN 69-004182", "นาย ญ. สมบูรณ์ศรี", "หอผู้ป่วยศัลยกรรมชาย", "16 ก.ย. 09:40", 52.1, 128500, "รอสรุปค่ารักษาหลัง Discharge"],
    ["AN 69-004205", "นาง ฎ. บุญมาก", "หอผู้ป่วย ICU", "17 ก.ย. 02:15", 36.3, 96000, "ค้างเวชภัณฑ์ยังไม่ตัดจ่าย"],
    ["AN 69-004231", "น.ส. ฏ. เรืองวิทย์", "หอผู้ป่วยสูติกรรม", "17 ก.ย. 22:05", 16.5, 52000, "ยังไม่ลงสิทธิการรักษา"],
    ["AN 69-004240", "ด.ช. ฐ. ปานทอง", "หอผู้ป่วยกุมารเวช", "18 ก.ย. 06:50", 7.7, 36000, "รอสรุปค่ารักษาหลัง Discharge"]
  ]
};

const TAG = {
  "รอสรุปเวชระเบียน": ["#F3E2C7", "#7A4A06"],
  "ยังไม่ลงสิทธิการรักษา": ["#F6D8D4", "#8C241A"],
  "รอผลแลป/ค่าบริการเพิ่ม": ["#DDE6EF", "#1F3A5F"],
  "ค้างเวชภัณฑ์ยังไม่ตัดจ่าย": ["#E2E6DE", "#2E6B4F"],
  "รอสรุปค่ารักษาหลัง Discharge": ["#F3E2C7", "#7A4A06"],
  "เวชภัณฑ์ตัดจ่ายหลังออกใบแจ้งหนี้": ["#F3E2C7", "#7A4A06"],
  "ค่าหัตถการยังไม่ผ่านการคิดค่า": ["#DDE6EF", "#1F3A5F"],
  "ค่าแลปเข้าระบบภายหลัง": ["#DDE6EF", "#1F3A5F"],
  "ราคาสิทธิต่างจากที่บันทึก": ["#F6D8D4", "#8C241A"],
  "บันทึกสิทธิผิด ต้องออกใหม่": ["#F6D8D4", "#8C241A"],
  "คิดค่ารักษาซ้ำ": ["#F3E2C7", "#7A4A06"],
  "แก้ชื่อผู้รับบริการ": ["#E2E6DE", "#2E6B4F"],
  "โอนบิลเป็นผู้ป่วยใน": ["#DDE6EF", "#1F3A5F"]
};

const PARTIAL = {
  OPD: [
    ["INV-OP-690918-0271", "นาย ต. ชัยมงคล", "ห้องฉุกเฉิน (ER)", 21600, 16800, 4800, "เวชภัณฑ์ตัดจ่ายหลังออกใบแจ้งหนี้"],
    ["INV-OP-690918-0288", "นาง ถ. สุขเกษม", "คลินิกกระดูกและข้อ", 15400, 11500, 3900, "ค่าหัตถการยังไม่ผ่านการคิดค่า"],
    ["INV-OP-690918-0304", "น.ส. ท. ปิ่นแก้ว", "ทันตกรรม", 9800, 6600, 3200, "ค่าแลปเข้าระบบภายหลัง"],
    ["INV-OP-690918-0319", "นาย ธ. อินทรโชติ", "คลินิกอายุรกรรม", 12300, 9700, 2600, "ราคาสิทธิต่างจากที่บันทึก"],
    ["INV-OP-690918-0333", "นาง น. บุญเรือง", "เวชศาสตร์ฟื้นฟู", 7400, 5300, 2100, "ค่าหัตถการยังไม่ผ่านการคิดค่า"],
    ["INV-OP-690918-0347", "นาย บ. เพ็ญศรี", "ห้องฉุกเฉิน (ER)", 6900, 5100, 1800, "เวชภัณฑ์ตัดจ่ายหลังออกใบแจ้งหนี้"]
  ],
  IPD: [
    ["INV-IP-69-004166", "นาย ป. ธีรวัฒน์", "หอผู้ป่วยศัลยกรรมชาย", 214000, 182300, 31700, "เวชภัณฑ์ตัดจ่ายหลังออกใบแจ้งหนี้"],
    ["INV-IP-69-004171", "นาง ผ. วงศ์สุวรรณ", "หอผู้ป่วย ICU", 168500, 152000, 16500, "ค่าแลปเข้าระบบภายหลัง"]
  ]
};

const VOID = {
  OPD: [
    ["INV-OP-690918-0166", "นาย ฝ. ประสงค์ดี", "ห้องฉุกเฉิน (ER)", "13:48", "การเงิน OPD", 2150, "บันทึกสิทธิผิด ต้องออกใหม่"],
    ["INV-OP-690918-0158", "นาง พ. ศรีทองคำ", "ทันตกรรม", "12:31", "การเงิน OPD", 1900, "คิดค่ารักษาซ้ำ"],
    ["INV-OP-690918-0149", "นาย ฟ. ขจรเดช", "คลินิกอายุรกรรม", "11:59", "เวชระเบียน", 1750, "แก้ชื่อผู้รับบริการ"],
    ["INV-OP-690918-0141", "น.ส. ภ. สายทอง", "คลินิกกระดูกและข้อ", "11:12", "การเงิน OPD", 1500, "บันทึกสิทธิผิด ต้องออกใหม่"],
    ["INV-OP-690918-0133", "นาย ม. รุ่งเรือง", "เวชศาสตร์ฟื้นฟู", "10:40", "การเงิน OPD", 1350, "คิดค่ารักษาซ้ำ"],
    ["INV-OP-690918-0124", "นาง ย. เกตุแก้ว", "ทันตกรรม", "09:55", "เวชระเบียน", 1100, "แก้ชื่อผู้รับบริการ"],
    ["INV-OP-690918-0117", "นาย ร. จันทร์ฉาย", "ห้องฉุกเฉิน (ER)", "09:20", "การเงิน OPD", 850, "โอนบิลเป็นผู้ป่วยใน"],
    ["INV-OP-690918-0108", "นาง ล. พูนสิน", "คลินิกอายุรกรรม", "08:35", "การเงิน OPD", 650, "คิดค่ารักษาซ้ำ"]
  ],
  IPD: [
    ["INV-IP-69-004158", "นาย ว. สถาพร", "หอผู้ป่วยศัลยกรรมชาย", "10:05", "การเงิน IPD", 26400, "บันทึกสิทธิผิด ต้องออกใหม่"]
  ]
};

const AMBER = "#B67A0C", RED = "#B3271E", GREEN = "#0F6B5F", NAVY = "#1F3A5F", INK = "#13191E";

function initialTheme() {
  try {
    const saved = localStorage.getItem("unbilled-theme");
    if (saved === "dark" || saved === "light") return saved;
  } catch (e) { /* storage blocked */ }
  return "dark";
}

function todayIso() {
  return new Date().toLocaleDateString("sv-SE");
}

const state = { range: "today", view: "OPD", sort: "amount", focus: "pending", drillOpen: false, customFrom: todayIso(), customTo: todayIso(), theme: initialTheme(), calOpen: null, calView: {} };

const bms = { status: "idle", sessionId: null, config: null, userInfo: null, error: null, hospitalName: null, hospitalNameLoading: false };

/** Real hospital name from HOSxP's own config (opdconfig) for the connected session.
 * With no session at all (or one that failed), this says so plainly rather than
 * naming any particular hospital — showing a fixed hospital name here has caused
 * confusion before (it read as the connected hospital's real name). */
function currentHospitalName() {
  if (bms.hospitalName) return bms.hospitalName;
  if (bms.status === "idle" || bms.status === "error") return HOSPITAL_NOT_CONNECTED;
  if (bms.hospitalNameLoading) return "กำลังโหลดชื่อโรงพยาบาล…";
  return (bms.userInfo && bms.userInfo.location) || "";
}

const live = { loading: false, error: null, hero: null, funnel: null, depts: null, rows: null, quality: null, ar: null, payers: null, arTransfer: null, trend: null };

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tagOf(reason) {
  return TAG[reason] || ["#E6E4DD", "#3F444C"];
}

function inkOf(hours) {
  return hours > 24 ? RED : hours > 4 ? AMBER : GREEN;
}

function computeViewModel() {
  const { view, sort, focus } = state;
  const range = DATA[state.range] ? state.range : "month";
  const d = DATA[range];
  const o = d.OPD, i = d.IPD;
  const charged = o.charged + i.charged;
  const invoiced = o.invoiced + i.invoiced;

  const ranges = Object.keys(DATA).map((k) => ({
    key: k,
    label: DATA[k].label,
    bg: k === range ? "#16181C" : "transparent",
    fg: k === range ? "#F7F6F2" : "#3F444C"
  }));

  const tabs = ["OPD", "IPD"].map((k) => ({
    key: k,
    label: k === "OPD" ? "ผู้ป่วยนอก (OPD)" : "ผู้ป่วยใน (IPD)",
    underline: k === view ? "#16181C" : "transparent",
    fg: k === view ? "#16181C" : "#6B6F76"
  }));

  const src = view === "OPD" ? o : i;
  const base = view === "OPD" ? o.visits : i.admit;
  const steps = view === "OPD"
    ? [["Visit ทั้งหมด", o.visits, null, INK, INK],
       ["Visit ที่มีค่าใช้จ่าย", o.charged, null, INK, INK],
       ["ออก Invoice แล้ว", o.invoiced, null, GREEN, GREEN],
       ["ยังไม่ออก Invoice", o.pending, o.pendingValue, AMBER, RED],
       ["Invoice ไม่ครบยอด", o.partial, o.partialValue, AMBER, AMBER],
       ["ยกเลิก Invoice", o.void, o.voidValue, RED, RED]]
    : [["Admit", i.admit, null, INK, INK],
       ["Discharge", i.discharge, null, INK, INK],
       ["มีค่าใช้จ่าย", i.charged, null, INK, INK],
       ["ออก Invoice แล้ว", i.invoiced, null, GREEN, GREEN],
       ["ยังไม่ออก Invoice", i.pending, i.pendingValue, AMBER, RED],
       ["Invoice ไม่ครบยอด", i.partial, i.partialValue, AMBER, AMBER],
       ["ยกเลิก Invoice", i.void, i.voidValue, RED, RED]];

  const FOCUS_OF = { "ยังไม่ออก Invoice": "pending", "Invoice ไม่ครบยอด": "partial", "ยกเลิก Invoice": "void" };
  const funnel = steps.map(([label, count, value, ink, bar]) => {
    const f = FOCUS_OF[label];
    const active = f && f === focus;
    return {
      label, ink, bar,
      count: fmt(count),
      value: value == null ? "—" : fmt(value) + " ฿",
      pct: Math.max(1.5, Math.round((count / base) * 100)),
      hint: f ? "คลิกดูรายละเอียด" : "",
      cursor: f ? "pointer" : "default",
      border: active ? "#16181C" : "#DCDAD3",
      shadow: active ? "inset 0 0 0 1px #16181C" : "none",
      focusKey: f || ""
    };
  });

  const deptList = DEPTS[view];
  const deptMax = Math.max(...deptList.map((x) => x[2]));
  const depts = deptList.map(([name, cases, value]) => ({
    name, cases: fmt(cases), value: fmt(value),
    pct: Math.round((value / deptMax) * 100)
  }));

  let rows, cols, sortOpts;
  if (focus === "pending") {
    cols = { c1: view === "OPD" ? "VN" : "AN", c3: view === "OPD" ? "หน่วยบริการ" : "หอผู้ป่วย", c4: view === "OPD" ? "เวลารับบริการ" : "Discharge", c5: "ค้าง (ชม.)", c6: "ยอด (บาท)", c7: "สาเหตุ" };
    sortOpts = [["amount", "ยอดสูงสุด"], ["age", "ค้างนานสุด"]];
    rows = ROWS[view].slice()
      .sort((a, b) => sort === "age" ? b[4] - a[4] : b[5] - a[5])
      .map((r) => ({
        id: r[0], name: r[1], unit: r[2], time: r[3],
        age: r[4].toFixed(1), amount: fmt(r[5]), reason: r[6],
        ageInk: inkOf(r[4]), tagBg: tagOf(r[6])[0], tagFg: tagOf(r[6])[1]
      }));
  } else if (focus === "partial") {
    cols = { c1: "เลขที่ Invoice", c3: view === "OPD" ? "หน่วยบริการ" : "หอผู้ป่วย", c4: "ยอดที่ควรเรียกเก็บ", c5: "ออก Invoice แล้ว", c6: "ส่วนต่างที่ขาด", c7: "สาเหตุ" };
    sortOpts = [["amount", "ส่วนต่างสูงสุด"], ["age", "ยอดรวมสูงสุด"]];
    rows = PARTIAL[view].slice()
      .sort((a, b) => sort === "age" ? b[3] - a[3] : b[5] - a[5])
      .map((r) => ({
        id: r[0], name: r[1], unit: r[2], time: fmt(r[3]),
        age: fmt(r[4]), amount: fmt(r[5]), reason: r[6],
        ageInk: "#3F444C", tagBg: tagOf(r[6])[0], tagFg: tagOf(r[6])[1]
      }));
  } else {
    cols = { c1: "เลขที่ Invoice", c3: view === "OPD" ? "หน่วยบริการ" : "หอผู้ป่วย", c4: "เวลายกเลิก", c5: "ผู้ยกเลิก", c6: "ยอด (บาท)", c7: "เหตุผล" };
    sortOpts = [["amount", "ยอดสูงสุด"], ["age", "ยกเลิกล่าสุด"]];
    rows = VOID[view].slice()
      .sort((a, b) => sort === "age" ? b[4].localeCompare(a[4]) : b[5] - a[5])
      .map((r) => ({
        id: r[0], name: r[1], unit: r[2], time: r[3],
        age: r[4], amount: fmt(r[5]), reason: r[6],
        ageInk: "#3F444C", tagBg: tagOf(r[6])[0], tagFg: tagOf(r[6])[1]
      }));
  }

  const sortKeys = sortOpts.map((x) => x[0]);
  const activeSort = sortKeys.indexOf(sort) >= 0 ? sort : "amount";
  const sorts = sortOpts.map(([k, label]) => ({
    key: k,
    label,
    bg: k === activeSort ? "#16181C" : "#FBFAF7",
    fg: k === activeSort ? "#F7F6F2" : "#3F444C"
  }));

  const FOCUS_META = [
    ["pending", "ยังไม่ออก Invoice", src.pending, src.pendingValue, RED, "#16181C"],
    ["partial", "Invoice ไม่ครบยอด", src.partial, src.partialValue, AMBER, "#FFFFFF"],
    ["void", "ยกเลิก Invoice", src.void, src.voidValue, RED, "#FFFFFF"]
  ];
  const focuses = FOCUS_META.map(([k, label, c, v, bg, fg]) => ({
    key: k,
    label, count: fmt(c), value: fmt(v),
    bg: k === focus ? bg : "#FBFAF7",
    fg: k === focus ? fg : "#3F444C",
    border: k === focus ? bg : "#C9C5BA"
  }));
  const focusTitle = { pending: "รายการค้างเรียกเก็บ", partial: "Invoice ที่เรียกเก็บไม่ครบยอด", void: "Invoice ที่ถูกยกเลิก" }[focus];
  const focusTotal = { pending: src.pending, partial: src.partial, void: src.void }[focus];

  return {
    hospital: currentHospitalName(),
    stamp: d.stamp,
    ranges, tabs, funnel, depts, rows, sorts, view, cols, focuses, focusTitle,
    rangeLabel: d.label,
    sortLabel: (sortOpts.find((x) => x[0] === activeSort) || sortOpts[0])[1],
    rowCount: fmt(focusTotal),
    shownCount: fmt(rows.length),
    funnelTitle: view === "OPD" ? "เส้นทางการเรียกเก็บ — ผู้ป่วยนอก" : "เส้นทางการเรียกเก็บ — ผู้ป่วยใน",
    deptTitle: view === "OPD" ? "หน่วยบริการที่ค้างเรียกเก็บสูงสุด" : "หอผู้ป่วยที่ค้างเรียกเก็บสูงสุด",
    raw: { revenue: 2450000, pendingValue: o.pendingValue + i.pendingValue, pendingCases: o.pending + i.pending, billedCases: o.invoiced + i.invoiced, totalCases: o.charged + i.charged, dupCount: 12, dupValue: 185500, mismatchCount: 26, mismatchValue: 118200, noReceiptCount: 31, noReceiptValue: 86600, qualityLive: false, ar: null, payers: null, arTransfer: null, trend: null },
    hero: {
      value: fmt(o.pendingValue + i.pendingValue),
      cases: fmt(o.pending + i.pending),
      opdCases: fmt(o.pending), ipdCases: fmt(i.pending),
      partialValue: fmt(o.partialValue + i.partialValue),
      partialCases: fmt(o.partial + i.partial),
      voidValue: fmt(o.voidValue + i.voidValue),
      voidCases: fmt(o.void + i.void),
      rate: ((invoiced / charged) * 100).toFixed(1)
    }
  };
}

const RANGE_LABELS = { today: "วันนี้", week: "7 วัน", month: "เดือนนี้", custom: "กำหนดเอง" };
const RANGE_TITLE = { today: "วันนี้", week: "7 วันล่าสุด", month: "เดือนนี้" };

function thaiDate(iso) {
  const [y, m, d] = iso.split("-");
  return d + "/" + m + "/" + (Number(y) + 543);
}

function rangeTitle(range) {
  return range === "custom" ? thaiDate(state.customFrom) + " – " + thaiDate(state.customTo) : RANGE_TITLE[range];
}

function customRangeValid() {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  return iso.test(state.customFrom) && iso.test(state.customTo) && state.customFrom <= state.customTo;
}

/** Same shape as computeViewModel(), sourced from live.* (populated by
 * refreshLiveData() via hosxp-queries.js) instead of the mock DATA/
 * DEPTS/ROWS/PARTIAL/VOID tables. Row-level text fields (patient name,
 * department, reason) come from real HOSxP data, so they're HTML-escaped
 * before going into the innerHTML template. */
function computeLiveViewModel() {
  const { range, view, sort, focus } = state;
  const hero = live.hero || {};
  const funnel = live.funnel || {};
  const deptRows = live.depts || [];
  const rowsRaw = live.rows || [];

  const ranges = Object.keys(RANGE_LABELS).map((k) => ({
    key: k, label: RANGE_LABELS[k],
    bg: k === range ? "#16181C" : "transparent",
    fg: k === range ? "#F7F6F2" : "#3F444C"
  }));

  const tabs = ["OPD", "IPD"].map((k) => ({
    key: k,
    label: k === "OPD" ? "ผู้ป่วยนอก (OPD)" : "ผู้ป่วยใน (IPD)",
    underline: k === view ? "#16181C" : "transparent",
    fg: k === view ? "#16181C" : "#6B6F76"
  }));

  const FOCUS_OF = { "ยังไม่ออก Invoice": "pending", "Invoice ไม่ครบยอด": "partial", "ยกเลิก Invoice": "void" };

  let steps, base;
  if (view === "OPD") {
    base = num(funnel.visits_total);
    steps = [
      ["Visit ทั้งหมด", num(funnel.visits_total), null, INK, INK],
      ["Visit ที่มีค่าใช้จ่าย", num(funnel.charged_total), null, INK, INK],
      ["ออก Invoice แล้ว", num(funnel.invoiced_cases), null, GREEN, GREEN],
      ["ยังไม่ออก Invoice", num(funnel.pending_cases), num(funnel.pending_value), AMBER, RED],
      ["Invoice ไม่ครบยอด", num(funnel.partial_cases), num(funnel.partial_value), AMBER, AMBER],
      ["ยกเลิก Invoice", num(funnel.void_cases), num(funnel.void_value), RED, RED]
    ];
  } else {
    base = num(funnel.admit_total);
    steps = [
      ["Admit", num(funnel.admit_total), null, INK, INK],
      ["Discharge", num(funnel.discharge_total), null, INK, INK],
      ["มีค่าใช้จ่าย", num(funnel.charged_active_total), null, INK, INK],
      ["ออก Invoice แล้ว", num(funnel.invoiced_cases), null, GREEN, GREEN],
      ["ยังไม่ออก Invoice", num(funnel.pending_cases), num(funnel.pending_value), AMBER, RED],
      ["Invoice ไม่ครบยอด", num(funnel.partial_cases), num(funnel.partial_value), AMBER, AMBER],
      ["ยกเลิก Invoice", num(funnel.void_cases), num(funnel.void_value), RED, RED]
    ];
  }

  const funnelVm = steps.map(([label, count, value, ink, bar]) => {
    const f = FOCUS_OF[label];
    const active = f && f === focus;
    return {
      label, ink, bar,
      count: fmt(count),
      value: value == null ? "—" : fmt(value) + " ฿",
      pct: Math.max(1.5, base > 0 ? Math.round((count / base) * 100) : 1.5),
      hint: f ? "คลิกดูรายละเอียด" : "",
      cursor: f ? "pointer" : "default",
      border: active ? "#16181C" : "#DCDAD3",
      shadow: active ? "inset 0 0 0 1px #16181C" : "none",
      focusKey: f || ""
    };
  });

  const deptMax = Math.max(1, ...deptRows.map((d) => num(d.value)), 1);
  const depts = deptRows.map((d) => ({
    name: escapeHtml(d.name || "-"), cases: fmt(num(d.cases)), value: fmt(num(d.value)),
    pct: Math.round((num(d.value) / deptMax) * 100)
  }));

  let rows, cols, sortOpts;
  if (focus === "pending") {
    cols = { c1: view === "OPD" ? "VN" : "AN", c3: view === "OPD" ? "หน่วยบริการ" : "หอผู้ป่วย", c4: view === "OPD" ? "เวลารับบริการ" : "Discharge", c5: "ค้าง (ชม.)", c6: "ยอด (บาท)", c7: "สาเหตุ" };
    sortOpts = [["amount", "ยอดสูงสุด"], ["age", "ค้างนานสุด"]];
    rows = rowsRaw.map((r) => {
      const ageH = num(r.age_hours);
      return {
        id: escapeHtml(r.id), name: escapeHtml(r.name || "-"), unit: escapeHtml(r.unit || "-"), time: escapeHtml(r.time_str || "-"),
        age: ageH.toFixed(1), amount: fmt(num(r.amount)), reason: "-",
        ageInk: inkOf(ageH), tagBg: "#E6E4DD", tagFg: "#3F444C"
      };
    });
  } else if (focus === "partial") {
    cols = { c1: "เลขที่ Invoice", c3: view === "OPD" ? "หน่วยบริการ" : "หอผู้ป่วย", c4: "ยอดที่ควรเรียกเก็บ", c5: "ออก Invoice แล้ว", c6: "ส่วนต่างที่ขาด", c7: "สาเหตุ" };
    sortOpts = [["amount", "ส่วนต่างสูงสุด"], ["age", "ยอดรวมสูงสุด"]];
    rows = rowsRaw.map((r) => ({
      id: escapeHtml(r.id), name: escapeHtml(r.name || "-"), unit: escapeHtml(r.unit || "-"), time: fmt(num(r.should_bill)),
      age: fmt(num(r.already_invoiced)), amount: fmt(num(r.shortfall)), reason: "-",
      ageInk: "#3F444C", tagBg: "#E6E4DD", tagFg: "#3F444C"
    }));
  } else {
    cols = { c1: "เลขที่ Invoice", c3: view === "OPD" ? "หน่วยบริการ" : "หอผู้ป่วย", c4: "เวลายกเลิก", c5: "ผู้ยกเลิก", c6: "ยอด (บาท)", c7: "เหตุผล" };
    sortOpts = [["amount", "ยอดสูงสุด"], ["age", "ยกเลิกล่าสุด"]];
    rows = rowsRaw.map((r) => ({
      id: escapeHtml(r.id), name: escapeHtml(r.name || "-"), unit: escapeHtml(r.unit || "-"), time: escapeHtml(r.time_str || "-"),
      age: escapeHtml(r.canceller || "-"), amount: fmt(num(r.amount)), reason: escapeHtml(r.reason || "-"),
      ageInk: "#3F444C", tagBg: tagOf(r.reason)[0], tagFg: tagOf(r.reason)[1]
    }));
  }

  const sortKeys = sortOpts.map((x) => x[0]);
  const activeSort = sortKeys.indexOf(sort) >= 0 ? sort : "amount";
  const sorts = sortOpts.map(([k, label]) => ({
    key: k, label,
    bg: k === activeSort ? "#16181C" : "#FBFAF7",
    fg: k === activeSort ? "#F7F6F2" : "#3F444C"
  }));

  const FOCUS_META = [
    ["pending", "ยังไม่ออก Invoice", num(funnel.pending_cases), num(funnel.pending_value), RED, "#16181C"],
    ["partial", "Invoice ไม่ครบยอด", num(funnel.partial_cases), num(funnel.partial_value), AMBER, "#FFFFFF"],
    ["void", "ยกเลิก Invoice", num(funnel.void_cases), num(funnel.void_value), RED, "#FFFFFF"]
  ];
  const focuses = FOCUS_META.map(([k, label, c, v, bg, fg]) => ({
    key: k, label, count: fmt(c), value: fmt(v),
    bg: k === focus ? bg : "#FBFAF7",
    fg: k === focus ? fg : "#3F444C",
    border: k === focus ? bg : "#C9C5BA"
  }));
  const focusTitle = { pending: "รายการค้างเรียกเก็บ", partial: "Invoice ที่เรียกเก็บไม่ครบยอด", void: "Invoice ที่ถูกยกเลิก" }[focus];
  const focusTotal = { pending: num(funnel.pending_cases), partial: num(funnel.partial_cases), void: num(funnel.void_cases) }[focus];

  return {
    hospital: currentHospitalName(),
    stamp: new Date().toLocaleString("th-TH"),
    ranges, tabs, funnel: funnelVm, depts, rows, sorts, view, cols, focuses, focusTitle,
    rangeLabel: rangeTitle(range),
    sortLabel: (sortOpts.find((x) => x[0] === activeSort) || sortOpts[0])[1],
    rowCount: fmt(focusTotal),
    shownCount: fmt(rows.length),
    funnelTitle: view === "OPD" ? "เส้นทางการเรียกเก็บ — ผู้ป่วยนอก" : "เส้นทางการเรียกเก็บ — ผู้ป่วยใน",
    deptTitle: view === "OPD" ? "หน่วยบริการที่ค้างเรียกเก็บสูงสุด" : "หอผู้ป่วยที่ค้างเรียกเก็บสูงสุด",
    raw: { revenue: num(hero.revenue), pendingValue: num(hero.pending_value), pendingCases: num(hero.pending_cases), billedCases: num(hero.billed_cases), totalCases: num(hero.total_cases), dupCount: num((live.quality || {}).dup_vns), dupValue: num((live.quality || {}).dup_value), mismatchCount: num(((live.quality || {}).mm || {}).n), mismatchValue: num(((live.quality || {}).mm || {}).diff), noReceiptCount: num(((live.quality || {}).nr || {}).n), noReceiptValue: num(((live.quality || {}).nr || {}).value), qualityLive: true, ar: live.ar, payers: live.payers, arTransfer: live.arTransfer, trend: live.trend },
    hero: {
      value: fmt(num(hero.pending_value)),
      cases: fmt(num(hero.pending_cases)),
      opdCases: fmt(num(hero.pending_opd_cases)), ipdCases: fmt(num(hero.pending_ipd_cases)),
      partialValue: fmt(num(hero.partial_value)),
      partialCases: fmt(num(hero.partial_cases)),
      voidValue: fmt(num(hero.void_value)),
      voidCases: fmt(num(hero.void_cases)),
      rate: num(hero.total_cases) > 0 ? ((num(hero.billed_cases) / num(hero.total_cases)) * 100).toFixed(1) : "0.0"
    }
  };
}

function mergePayers(opd, ipd) {
  const byCode = {};
  for (const r of [...opd, ...ipd]) {
    const key = r.code == null ? "-" : r.code;
    byCode[key] = byCode[key] || { name: String(r.name || "ไม่ระบุสิทธิ").replace(/s+/g, " ").trim(), value: 0 };
    byCode[key].value += num(r.value);
  }
  const total = (opd[0] ? num(opd[0].total) : 0) + (ipd[0] ? num(ipd[0].total) : 0);
  const rows = Object.values(byCode).sort((x, y) => y.value - x.value).slice(0, 4);
  return { rows, total };
}

async function refreshLiveData() {
  if (bms.status !== "connected") return;
  const { range, view, focus, sort } = state;
  if (range === "custom") {
    if (!customRangeValid()) return;
    window.HosxpQueries.setCustomRange(state.customFrom, state.customTo);
  }
  live.loading = true;
  live.error = null;
  render();

  const heroOpdSql = window.HosxpQueries.buildHeroPartQuery(range, "OPD");
  const heroIpdSql = window.HosxpQueries.buildHeroPartQuery(range, "IPD");
  const funnelSql = window.HosxpQueries.buildFunnelQuery(range, view);
  const deptsSql = window.HosxpQueries.buildDeptsQuery(range, view);
  const rowsSql = window.HosxpQueries.buildRowsQuery(range, view, focus, sort);
  const qualitySql = window.HosxpQueries.buildQualityQuery(range);
  const mismatchSql = window.HosxpQueries.buildMismatchQuery(range);
  const noReceiptSql = window.HosxpQueries.buildNoReceiptQuery(range);
  const payerOpdSql = window.HosxpQueries.buildPayerQuery(range, "OPD");
  const payerIpdSql = window.HosxpQueries.buildPayerQuery(range, "IPD");
  const arTransferOpdSql = window.HosxpQueries.buildArTransferQuery(range, "OPD");
  const arTransferIpdSql = window.HosxpQueries.buildArTransferQuery(range, "IPD");
  const trendRange = range === "today" ? "week" : range;
  const trendOpdSql = window.HosxpQueries.buildTrendQuery(trendRange, "OPD");
  const trendIpdSql = window.HosxpQueries.buildTrendQuery(trendRange, "IPD");
  const arPromise = live.ar
    ? Promise.resolve({ ok: true, data: live.ar })
    : window.BmsSession.executeSqlViaApi(window.HosxpQueries.buildArAgingQuery(), bms.config);

  const [heroOpdRes, heroIpdRes, funnelRes, deptsRes, rowsRes, qualityRes, mismatchRes, noReceiptRes, arRes, payerOpdRes, payerIpdRes, atOpdRes, atIpdRes, trendOpdRes, trendIpdRes] = await Promise.all([
    window.BmsSession.executeSqlViaApi(heroOpdSql, bms.config),
    window.BmsSession.executeSqlViaApi(heroIpdSql, bms.config),
    window.BmsSession.executeSqlViaApi(funnelSql, bms.config),
    window.BmsSession.executeSqlViaApi(deptsSql, bms.config),
    window.BmsSession.executeSqlViaApi(rowsSql, bms.config),
    window.BmsSession.executeSqlViaApi(qualitySql, bms.config),
    window.BmsSession.executeSqlViaApi(mismatchSql, bms.config),
    window.BmsSession.executeSqlViaApi(noReceiptSql, bms.config),
    arPromise,
    window.BmsSession.executeSqlViaApi(payerOpdSql, bms.config),
    window.BmsSession.executeSqlViaApi(payerIpdSql, bms.config),
    window.BmsSession.executeSqlViaApi(arTransferOpdSql, bms.config),
    window.BmsSession.executeSqlViaApi(arTransferIpdSql, bms.config),
    window.BmsSession.executeSqlViaApi(trendOpdSql, bms.config),
    window.BmsSession.executeSqlViaApi(trendIpdSql, bms.config)
  ]);

  const failed = [heroOpdRes, heroIpdRes, funnelRes, deptsRes, rowsRes, qualityRes, mismatchRes, noReceiptRes, arRes, payerOpdRes, payerIpdRes, atOpdRes, atIpdRes, trendOpdRes, trendIpdRes].find((r) => !r.ok);
  if (failed) {
    live.error = `${failed.error}: ${failed.message}`;
    live.loading = false;
    render();
    return;
  }

  const hOpd = heroOpdRes.data[0] || {};
  const hIpd = heroIpdRes.data[0] || {};
  live.hero = {
    pending_cases: num(hOpd.pending_cases) + num(hIpd.pending_cases),
    pending_opd_cases: num(hOpd.pending_cases),
    pending_ipd_cases: num(hIpd.pending_cases),
    pending_value: num(hOpd.pending_value) + num(hIpd.pending_value),
    partial_cases: num(hOpd.partial_cases) + num(hIpd.partial_cases),
    partial_value: num(hOpd.partial_value) + num(hIpd.partial_value),
    void_cases: num(hOpd.void_cases) + num(hIpd.void_cases),
    void_value: num(hOpd.void_value) + num(hIpd.void_value),
    billed_cases: num(hOpd.billed_cases) + num(hIpd.billed_cases),
    total_cases: num(hOpd.total_cases) + num(hIpd.total_cases),
    revenue: num(hOpd.revenue) + num(hIpd.revenue)
  };
  live.funnel = funnelRes.data[0] || {};
  live.depts = deptsRes.data || [];
  live.rows = rowsRes.data || [];
  live.quality = { ...(qualityRes.data[0] || {}), mm: mismatchRes.data[0] || {}, nr: noReceiptRes.data[0] || {} };
  live.ar = arRes.data;
  live.payers = mergePayers(payerOpdRes.data, payerIpdRes.data);
  const atO = atOpdRes.data[0] || {}, atI = atIpdRes.data[0] || {};
  live.trend = {};
  for (const r of [...trendOpdRes.data, ...trendIpdRes.data]) {
    const t = live.trend[r.d] || (live.trend[r.d] = { rev: 0, pend: 0, pc: 0 });
    t.rev += num(r.rev); t.pend += num(r.pend); t.pc += num(r.pc);
  }
  live.arTransfer = { yN: num(atO.y_n) + num(atI.y_n), yAmt: num(atO.y_amt) + num(atI.y_amt), n: num(atO.n) + num(atI.n), amt: num(atO.amt) + num(atI.amt), nulN: num(atO.nul_n) + num(atI.nul_n), nulAmt: num(atO.nul_amt) + num(atI.nul_amt) };
  live.loading = false;
  render();
}

const TH_STYLE = "font-weight: 600; font-size: 11.5px; letter-spacing: 0.06em; text-transform: uppercase; color: #6B7280; border-bottom: 1px solid #E4E0D6;";
const NUM = "font-variant-numeric: tabular-nums;";
const HEAD_FONT = "font-family: Anuphan, sans-serif;";

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
}

function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  try { localStorage.setItem("unbilled-theme", state.theme); } catch (e) { /* storage blocked */ }
  applyTheme();
  render();
}

function render() {
  const app = document.getElementById("app");
  const liveReady = bms.status === "connected" && !!live.hero;
  const vm = liveReady ? computeLiveViewModel() : computeViewModel();
  // "idle" (opened with no session at all, e.g. the bare URL pasted directly rather
  // than launched from the marketplace) and "error" (the last connect attempt
  // failed) both get a login form instead of empty placeholder boxes, so someone
  // without a marketplace launch link can still paste a session id in by hand.
  // "connecting" (URL/cookie session already found, or just submitted via that
  // form) keeps the loading-skeleton boxes — something is genuinely in flight.
  const showLogin = bms.status === "idle" || bms.status === "error";
  const skeleton = !liveReady && !showLogin;
  const bmsError = bms.status === "error" ? bms.error : (bms.status === "connected" && live.error ? live.error : null);
  app.innerHTML = template(vm, { demo: !liveReady, skeleton, showLogin, connected: bms.status === "connected", refreshing: !!live.loading && !!live.hero, bmsError });
}

/** Clears the session (cookie + in-memory state) and drops back to the login
 * screen — the counterpart to bmsConnect(). Live data is cleared too so a
 * stale dashboard never flashes before the next connect. */
function logout() {
  window.BmsSession.removeSessionCookie();
  bms.status = "idle";
  bms.sessionId = null;
  bms.config = null;
  bms.userInfo = null;
  bms.error = null;
  bms.hospitalName = null;
  bms.hospitalNameLoading = false;
  Object.assign(live, { loading: false, error: null, hero: null, funnel: null, depts: null, rows: null, quality: null, ar: null, payers: null, arTransfer: null, trend: null });
  render();
}

function submitSessionLogin(e) {
  e.preventDefault();
  const input = document.getElementById("session-login-input");
  const id = input && input.value.trim();
  if (!id) return;
  bmsConnect(id);
}

function setRange(k) { state.range = k; render(); refreshLiveData(); }
function setView(k) { state.view = k; render(); refreshLiveData(); }
function setSort(k) { state.sort = k; render(); refreshLiveData(); }
function setFocus(k) { state.focus = k; state.sort = 'amount'; state.drillOpen = true; render(); scrollToDrill(); refreshLiveData(); }
function scrollToDrill() {
  const el = document.getElementById("drill-panel");
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}
function setCustomDate(key, value) {
  if (!value) return;
  state[key] = value;
  if (state.customFrom > state.customTo) { if (key === "customFrom") state.customTo = value; else state.customFrom = value; }
  render();
  refreshLiveData();
}
function closeDrill() { state.drillOpen = false; render(); }

/* ---------- custom-range calendar popover ---------- */

function toggleCal(key) {
  state.calOpen = state.calOpen === key ? null : key;
  if (state.calOpen && !state.calView[key]) state.calView[key] = state[key].slice(0, 7);
  render();
}
function closeCal() {
  if (!state.calOpen) return;
  state.calOpen = null;
  render();
}
function navCal(key, delta) {
  const [y, m] = (state.calView[key] || state[key].slice(0, 7)).split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  state.calView[key] = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  render();
}
function pickCal(key, iso) {
  state.calOpen = null;
  setCustomDate(key, iso);
}

/** Runs on its own, outside the main data batch, so the header shows the real
 * hospital name as soon as this single lightweight query resolves — not only
 * after the user triggers a range change that happens to complete first. */
async function fetchHospitalName() {
  try {
    const res = await window.BmsSession.executeSqlViaApi(window.HosxpQueries.buildHospitalNameQuery(), bms.config);
    if (res.ok && res.data[0] && res.data[0].hospitalname) bms.hospitalName = res.data[0].hospitalname;
  } finally {
    bms.hospitalNameLoading = false;
    render();
  }
}

async function bmsConnect(sessionId) {
  bms.status = "connecting";
  bms.sessionId = sessionId;
  bms.error = null;
  bms.hospitalName = null;
  bms.hospitalNameLoading = true;
  render();

  const result = await window.BmsSession.connectSession(sessionId);
  if (result.ok) {
    bms.status = "connected";
    bms.config = result.config;
    bms.userInfo = result.userInfo;
    window.BmsSession.setSessionCookie(sessionId);
    fetchHospitalName();
    refreshLiveData();
  } else {
    bms.status = "error";
    bms.error = result.message;
    bms.hospitalNameLoading = false;
  }
  render();
}

function initBmsSession() {
  const fromUrl = window.BmsSession.handleUrlSession();
  const sessionId = fromUrl || window.BmsSession.getSessionCookie();
  if (sessionId) { bmsConnect(sessionId); return true; }
  return false;
}

window.setRange = setRange;
window.setView = setView;
window.setSort = setSort;
window.setFocus = setFocus;
window.closeDrill = closeDrill;
window.setCustomDate = setCustomDate;
window.toggleTheme = toggleTheme;
window.toggleCal = toggleCal;
window.closeCal = closeCal;
window.navCal = navCal;
window.pickCal = pickCal;
window.submitSessionLogin = submitSessionLogin;
window.logout = logout;
applyTheme();
if (!initBmsSession()) render();
