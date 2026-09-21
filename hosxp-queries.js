"use strict";

/* Query builders for the Unbilled Service Dashboard against a live HOSxP
 * (PostgreSQL) database via the BMS session bridge.
 *
 * Business rules encoded here come directly from the hospital's own
 * definitions (not guessed):
 *   - OPD visit  = ovst row where ovst.an IS NULL
 *   - IPD stay   = ipt row (ipt.an is the admission number)
 *   - A visit/stay's billing "key" is ovst.vn (OPD) or ipt.an (IPD).
 *   - rcpt_debt.vn holds that same key for BOTH OPD and IPD (an IPD debt's
 *     "vn" column is actually the AN). rcpt_debt.status IS NULL => active
 *     invoice, 'ABORT' => voided.
 *   - opitemrece holds line-item charges (sum_price) for a key; a line is
 *     "already invoiced" once opitemrece.finance_number IS NOT NULL.
 *   - A key with no rcpt_debt row at all => pending (unbilled).
 *   - A key with an active rcpt_debt row where some lines are invoiced
 *     (finance_number NOT NULL) and some are not (finance_number NULL)
 *     => partial; shortfall = SUM(sum_price) of the uninvoiced lines.
 *   - A key with rcpt_debt.status = 'ABORT' => void.
 *   - IPD invoice-status classification (pending/partial/void/invoiced)
 *     only applies to discharged stays (ipt.confirm_discharge = 'Y'); "has
 *     charges" for still-admitted stays is a separate figure
 *     (confirm_discharge = 'N').
 *
 * Two open assumptions (not explicitly given, flagged for confirmation):
 *   - IPD aging/row time basis uses discharge time (dchdate+dchtime),
 *     since IPD billing happens post-discharge.
 *   - IPD "void" row detail reuses rcpt_debt_cancel like the OPD case
 *     (rule 11), filtered to AN-shaped keys instead of 12-digit VNs.
 *
 * Transport constraints of the BMS bridge (found empirically):
 *   - The SQL travels in the URL query string and the bridge rejects
 *     requests once the URL passes ~2000 characters (instant "Failed to
 *     fetch", not a timeout). Keep every generated query well under that:
 *     short aliases, no redundant "AS", no COALESCE (the client treats
 *     NULL as 0).
 *   - A literal `+` is decoded as a space; never use it in SQL.
 */

/** The hospital's own name, as configured in HOSxP itself (opdconfig) — used for the
 * header instead of the BMS session's user_info.location, which can be a generic
 * label like "โรงพยาบาลทดสอบ BMS" rather than the real hospital name. */
function buildHospitalNameQuery() {
  return "SELECT hospitalname FROM opdconfig LIMIT 1;";
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
let customRange = { from: null, to: null };

/** Custom range bounds are interpolated into SQL, so only strict YYYY-MM-DD is accepted. */
function setCustomRange(from, to) {
  customRange = ISO_DATE.test(from) && ISO_DATE.test(to) ? { from, to } : { from: null, to: null };
}

function dateRangeCond(col, range) {
  if (range === "custom") {
    if (!customRange.from) throw new Error("invalid custom date range");
    return `${col} BETWEEN '${customRange.from}' AND '${customRange.to}'`;
  }
  if (range === "today") return `${col} = CURRENT_DATE`;
  if (range === "week") return `${col} BETWEEN CURRENT_DATE - INTERVAL '6 days' AND CURRENT_DATE`;
  return `${col} BETWEEN date_trunc('month', CURRENT_DATE)::date AND CURRENT_DATE`;
}

/** Full patient name (title + first + last); CONCAT_WS skips NULL parts. */
const NAME = "CONCAT_WS(' ',p.pname,p.fname,p.lname)";

/** Per-key classification for one view ('OPD' or 'IPD'). Output columns of
 * `classified`: k (VN/AN), tp (total price), up (uninvoiced price), state.
 * IPD lines are restricted to discharged stays (rules 15-18). */
function classifiedCte(range, view, withA, withDate) {
  const a = withA ? `WITH a AS (SELECT an,confirm_discharge FROM ipt WHERE ${dateRangeCond("regdate", range)}),
g AS` : "WITH g AS";
  const src = view === "OPD"
    ? `FROM opitemrece o JOIN ovst v ON v.vn=o.vn WHERE v.an IS NULL AND ${dateRangeCond("v.vstdate", range)} GROUP BY o.vn${withDate ? ",v.vstdate" : ""}`
    : withA
      ? "FROM opitemrece o JOIN a ON a.an=o.an WHERE a.confirm_discharge='Y' GROUP BY o.an"
      : `FROM opitemrece o JOIN ipt i ON i.an=o.an WHERE ${dateRangeCond("i.regdate", range)} AND i.confirm_discharge='Y' GROUP BY o.an${withDate ? ",i.regdate" : ""}`;
  const key = view === "OPD" ? "o.vn" : "o.an";
  const dt = withDate ? (view === "OPD" ? "v.vstdate" : "i.regdate") + " dt," : "";
  return `${a} (SELECT ${key} k,${dt}SUM(o.sum_price) tp,SUM(CASE WHEN o.finance_number IS NULL THEN o.sum_price ELSE 0 END) up,BOOL_OR(o.finance_number IS NULL) hu,BOOL_OR(o.finance_number IS NOT NULL) hb ${src}),
classified AS (SELECT g.k,g.tp,g.up,${withDate ? "g.dt," : ""}CASE WHEN d.debt_id IS NULL THEN 'pending' WHEN d.status='ABORT' THEN 'void' WHEN d.status IS NULL AND g.hu AND g.hb THEN 'partial' ELSE 'invoiced' END state FROM g LEFT JOIN rcpt_debt d ON d.vn=g.k)`;
}

const STATE_AGGS = `COUNT(*) FILTER (WHERE state='pending') pending_cases,
SUM(tp) FILTER (WHERE state='pending') pending_value,
COUNT(*) FILTER (WHERE state='partial') partial_cases,
SUM(up) FILTER (WHERE state='partial') partial_value,
COUNT(*) FILTER (WHERE state='void') void_cases,
SUM(tp) FILTER (WHERE state='void') void_value`;

/** Hero card figures for ONE view (OPD or IPD). A single query unioning
 * both views together failed through the bridge (URL length limit), so the
 * combined hero card calls this once per view and sums the results in JS. */
function buildHeroPartQuery(range, view) {
  return `${classifiedCte(range, view)}
SELECT ${STATE_AGGS},
SUM(tp) AS revenue,
COUNT(*) FILTER (WHERE state IN ('invoiced','partial')) billed_cases,
COUNT(*) total_cases
FROM classified;`;
}

/** Funnel step figures for one view. */
function buildFunnelQuery(range, view) {
  const c = classifiedCte(range, view, view === "IPD");
  if (view === "OPD") {
    return `${c}
SELECT (SELECT COUNT(*) FROM ovst v WHERE v.an IS NULL AND ${dateRangeCond("v.vstdate", range)}) visits_total,
COUNT(*) charged_total,
COUNT(*) FILTER (WHERE state='invoiced') invoiced_cases,
${STATE_AGGS}
FROM classified;`;
  }
  return `${c}
SELECT (SELECT COUNT(*) FROM a) admit_total,
(SELECT COUNT(*) FROM a WHERE confirm_discharge='Y') discharge_total,
(SELECT COUNT(DISTINCT a.an) FROM a JOIN opitemrece o ON o.an=a.an WHERE a.confirm_discharge='N') charged_active_total,
COUNT(*) FILTER (WHERE state='invoiced') invoiced_cases,
${STATE_AGGS}
FROM classified;`;
}

/** Duplicate invoices: a VN with more than one active rcpt_debt row on the same
 * debt_date (the design's rule). Value = total of those invoices. */
function buildQualityQuery(range) {
  return `SELECT COUNT(*) AS dup_vns,SUM(t) AS dup_value FROM (SELECT SUM(amount) t FROM rcpt_debt WHERE status IS NULL AND ${dateRangeCond("debt_date", range)} GROUP BY vn,debt_date HAVING COUNT(*)>1) x;`;
}

/** Invoice-vs-service mismatch: per VN, total of active invoices (rcpt_debt.amount)
 * differs from the total of the service lines already invoiced (opitemrece lines
 * with finance_number NOT NULL). OPD only (IPD debts hold the AN in vn). */
function buildMismatchQuery(range) {
  return `SELECT COUNT(*) AS n,SUM(ABS(dv-COALESCE(ov,0))) AS diff FROM (SELECT d.vn,SUM(d.amount) AS dv,(SELECT SUM(o.sum_price) FROM opitemrece o WHERE o.vn=d.vn AND o.finance_number IS NOT NULL) AS ov FROM rcpt_debt d WHERE d.status IS NULL AND ${dateRangeCond("d.debt_date", range)} AND EXISTS (SELECT 1 FROM ovst v WHERE v.vn=d.vn) GROUP BY d.vn) t WHERE ABS(dv-COALESCE(ov,0))>0.01;`;
}

/** Debts without a receipt: active invoices with no rcpt_print_detail row for the VN. */
function buildNoReceiptQuery(range) {
  return `SELECT COUNT(*) AS n,SUM(d.amount) AS value FROM rcpt_debt d WHERE d.status IS NULL AND ${dateRangeCond("d.debt_date", range)} AND NOT EXISTS (SELECT 1 FROM rcpt_print_detail p WHERE p.vn=d.vn);`;
}

/** Debts transferred to AR (rcpt_debt.ar_transfer = 'Y') among the active invoices of
 * the range's visits (OPD: ovst.an IS NULL; IPD: discharged, rcpt_debt.vn holds the AN).
 * Returns transferred ('Y') and not-yet-transferred (NULL) count/amount, and the totals. */
function buildArTransferQuery(range, view) {
  const from = view === "OPD"
    ? `rcpt_debt d JOIN ovst v ON v.vn=d.vn WHERE d.status IS NULL AND v.an IS NULL AND ${dateRangeCond("v.vstdate", range)}`
    : `rcpt_debt d JOIN ipt i ON i.an=d.vn WHERE d.status IS NULL AND i.confirm_discharge='Y' AND ${dateRangeCond("i.regdate", range)}`;
  return `SELECT COUNT(*) FILTER (WHERE d.ar_transfer='Y') AS y_n,SUM(d.amount) FILTER (WHERE d.ar_transfer='Y') AS y_amt,COUNT(*) FILTER (WHERE d.ar_transfer IS NULL) AS nul_n,SUM(d.amount) FILTER (WHERE d.ar_transfer IS NULL) AS nul_amt,COUNT(*) AS n,SUM(d.amount) AS amt FROM ${from};`;
}

/** Daily series for the trend chart (one view): service total and unbilled (pending)
 * value/cases per visit date. */
function buildTrendQuery(range, view) {
  return `${classifiedCte(range, view, false, true)}
SELECT to_char(dt,'YYYY-MM-DD') AS d,SUM(tp) AS rev,SUM(tp) FILTER (WHERE state='pending') AS pend,COUNT(*) FILTER (WHERE state='pending') AS pc FROM classified GROUP BY dt ORDER BY dt;`;
}

/** Charges by patient right (pttype) for one view: SUM(opitemrece.sum_price) per
 * visit right in the range (ovst.pttype for OPD, ipt.pttype for IPD), top 8, plus
 * the grand total for share-of-total. */
function buildPayerQuery(range, view) {
  const src = view === "OPD"
    ? `v.pttype AS code,t.name AS name,SUM(o.sum_price) AS value,SUM(SUM(o.sum_price)) OVER () AS total FROM opitemrece o JOIN ovst v ON v.vn=o.vn LEFT JOIN pttype t ON t.pttype=v.pttype WHERE v.an IS NULL AND ${dateRangeCond("v.vstdate", range)} GROUP BY v.pttype,t.name`
    : `i.pttype AS code,t.name AS name,SUM(o.sum_price) AS value,SUM(SUM(o.sum_price)) OVER () AS total FROM opitemrece o JOIN ipt i ON i.an=o.an LEFT JOIN pttype t ON t.pttype=i.pttype WHERE ${dateRangeCond("i.regdate", range)} GROUP BY i.pttype,t.name`;
  return `SELECT ${src} ORDER BY value DESC LIMIT 8;`;
}

/** AR aging: active debts (rcpt_debt.status IS NULL) bucketed by days from the
 * visit-open date (ovst.vstdate, or ipt.regdate for IPD where rcpt_debt.vn holds
 * the AN) to today. Independent of the range filter (a snapshot). */
function buildArAgingQuery() {
  return `SELECT CASE WHEN a<=30 THEN 'd30' WHEN a<=60 THEN 'd60' WHEN a<=90 THEN 'd90' ELSE 'd91' END AS bucket,COUNT(*) AS cnt,SUM(amount) AS value FROM (SELECT d.amount,CURRENT_DATE - COALESCE(v.vstdate,i.regdate) AS a FROM rcpt_debt d LEFT JOIN ovst v ON v.vn=d.vn LEFT JOIN ipt i ON i.an=d.vn WHERE d.status IS NULL) t WHERE a IS NOT NULL GROUP BY bucket;`;
}

/** Combines a date column and a time column into a timestamp without using
 * the `+` operator (see transport constraints above); `||` concatenation
 * avoids the character entirely. */
function dtExpr(dateCol, timeCol) {
  return `(${dateCol}::text || ' ' || ${timeCol}::text)::timestamp`;
}

/** Top departments (OPD) / wards (IPD) by outstanding pending value. */
function buildDeptsQuery(range, view) {
  const c = classifiedCte(range, view);
  if (view === "OPD") {
    return `${c}
SELECT d.department AS name,COUNT(*) cases,SUM(c.tp) AS value
FROM classified c JOIN ovst v ON v.vn=c.k JOIN kskdepartment d ON d.depcode=v.main_dep
WHERE c.state='pending' GROUP BY d.department ORDER BY value DESC LIMIT 5;`;
  }
  return `${c}
SELECT w.name AS name,COUNT(*) cases,SUM(c.tp) AS value
FROM classified c JOIN ipt i ON i.an=c.k JOIN ward w ON w.ward=i.ward
WHERE c.state='pending' GROUP BY w.name ORDER BY value DESC LIMIT 5;`;
}

/** Row-level detail table for the active focus (pending/partial/void). */
function buildRowsQuery(range, view, focus, sort) {
  if (focus === "void") {
    // Rule 11: OPD void detail comes from rcpt_debt_cancel, keyed by a
    // 12-digit VN. IPD equivalent (not given explicitly) mirrors it with
    // non-12-digit keys — flagged as an assumption.
    const vnLenCond = view === "OPD" ? "length(rc.vn)=12" : "length(rc.vn)<>12";
    const orderBy = sort === "age" ? "rc.cancel_datetime DESC" : "rc.total_amount DESC";
    const deptJoin = view === "OPD"
      ? "LEFT JOIN ovst v2 ON v2.vn=rc.vn LEFT JOIN kskdepartment d ON d.depcode=v2.main_dep"
      : "LEFT JOIN ipt i2 ON i2.an=rc.vn LEFT JOIN ward d ON d.ward=i2.ward";
    const unitCol = view === "OPD" ? "d.department" : "d.name";
    return `SELECT rc.vn id,${NAME} AS name,${unitCol} unit,to_char(rc.cancel_datetime,'HH24:MI') time_str,rc.cancel_computer canceller,rc.total_amount amount,rc.reason reason
FROM rcpt_debt_cancel rc LEFT JOIN patient p ON p.hn=rc.hn ${deptJoin}
WHERE ${vnLenCond} AND ${dateRangeCond("rc.debt_date", range)}
ORDER BY ${orderBy} LIMIT 100;`;
  }

  const c = classifiedCte(range, view);
  const join = view === "OPD"
    ? "JOIN ovst v ON v.vn=c.k LEFT JOIN kskdepartment d ON d.depcode=v.main_dep"
    : "JOIN ipt v ON v.an=c.k LEFT JOIN ward d ON d.ward=v.ward";
  const unitCol = view === "OPD" ? "d.department" : "d.name";
  const timeExpr = view === "OPD" ? dtExpr("v.vstdate", "v.vsttime") : dtExpr("v.dchdate", "v.dchtime");
  const timeFmt = view === "OPD" ? "to_char(v.vsttime,'HH24:MI')" : "to_char(v.dchdate,'DD Mon') || ' ' || to_char(v.dchtime,'HH24:MI')";

  if (focus === "pending") {
    const orderBy = sort === "age" ? "age_hours DESC" : "c.tp DESC";
    return `${c}
SELECT c.k id,${NAME} AS name,${unitCol} unit,${timeFmt} time_str,
ROUND((EXTRACT(EPOCH FROM (NOW() - ${timeExpr}))/3600.0)::numeric,1) age_hours,c.tp amount
FROM classified c ${join} LEFT JOIN patient p ON p.hn=v.hn
WHERE c.state='pending' ORDER BY ${orderBy} LIMIT 100;`;
  }

  // partial
  const orderBy = sort === "age" ? "c.tp DESC" : "c.up DESC";
  return `${c}
SELECT c.k id,${NAME} AS name,${unitCol} unit,c.tp should_bill,(c.tp - c.up) already_invoiced,c.up shortfall
FROM classified c ${join} LEFT JOIN patient p ON p.hn=v.hn
WHERE c.state='partial' ORDER BY ${orderBy} LIMIT 100;`;
}

window.HosxpQueries = {
  setCustomRange,
  dateRangeCond,
  buildHospitalNameQuery,
  buildHeroPartQuery,
  buildFunnelQuery,
  buildDeptsQuery,
  buildRowsQuery,
  buildQualityQuery,
  buildArAgingQuery,
  buildPayerQuery,
  buildTrendQuery,
  buildArTransferQuery,
  buildMismatchQuery,
  buildNoReceiptQuery
};
