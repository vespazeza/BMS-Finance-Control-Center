"use strict";

const BMS_SESSION_PARAM = "bms-session-id";
const BMS_SESSION_COOKIE = "bms-session-id";
const BMS_SESSION_COOKIE_DAYS = 7;
const HOSXP_PASTE_JSON_URL = "https://hosxp.net/phapi/PasteJSON";
const SQL_TIMEOUT_MS = 30000;
const APP_ID = "BMS.Unbilled";

function getSessionIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get(BMS_SESSION_PARAM);
}

function removeSessionIdFromUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete(BMS_SESSION_PARAM);
  const clean = url.pathname + (url.search ? url.search : "") + url.hash;
  window.history.replaceState({}, document.title, clean);
}

function setSessionCookie(sessionId) {
  const expires = new Date(Date.now() + BMS_SESSION_COOKIE_DAYS * 24 * 60 * 60 * 1000).toUTCString();
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${BMS_SESSION_COOKIE}=${encodeURIComponent(sessionId)}; expires=${expires}; path=/; SameSite=Lax${secure}`;
}

function getSessionCookie() {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${BMS_SESSION_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function removeSessionCookie() {
  document.cookie = `${BMS_SESSION_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

/** Extract session id from the URL (if present), persist it to a cookie, and
 * strip it from the address bar. Returns the id, or null if none was present. */
function handleUrlSession() {
  const fromUrl = getSessionIdFromUrl();
  if (!fromUrl) return null;
  setSessionCookie(fromUrl);
  removeSessionIdFromUrl();
  return fromUrl;
}

async function retrieveBmsSession(sessionId) {
  const url = `${HOSXP_PASTE_JSON_URL}?Action=GET&code=${encodeURIComponent(sessionId)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`PasteJSON HTTP ${res.status}`);
  return res.json();
}

/** Fallback chain confirmed against a working reference implementation
 * (D:\thai_traditional\bms-session.js — a shipped app already using this same
 * BMS/HOSxP bridge): key_value's hosxp.* keys win when present, otherwise
 * fall back to user_info's own hosxp.* keys, then user_info.bms_url /
 * bms_session_code. Note: `result.auth_key` (a separate long token sometimes
 * present on the live response) is NOT part of this chain — the reference
 * app never reads it, and bms_session_code (the session id itself) is the
 * real bearer token. `key_value` is sometimes a bare string rather than an
 * object; indexing a string for these keys just yields undefined, which is
 * fine — the chain falls through correctly either way. */
function extractConnectionConfig(sessionData) {
  const result = (sessionData && sessionData.result) || {};
  const keyValue = result.key_value || {};
  const userInfo = result.user_info || {};

  const apiUrl =
    keyValue["hosxp.api_url"] ||
    userInfo["hosxp.api_url"] ||
    userInfo.bms_url ||
    null;

  const apiAuthKey =
    keyValue["hosxp.api_auth_key"] ||
    userInfo["hosxp.api_auth_key"] ||
    userInfo.bms_session_code ||
    null;

  return { apiUrl, apiAuthKey, userInfo };
}

async function connectSession(sessionId) {
  let sessionData;
  try {
    sessionData = await retrieveBmsSession(sessionId);
  } catch (e) {
    return { ok: false, error: "network_error", message: e.message };
  }

  if (sessionData.MessageCode === 500) {
    return { ok: false, error: "session_expired", message: sessionData.Message || "Session expired" };
  }
  if (sessionData.MessageCode !== 200) {
    return { ok: false, error: "session_error", message: sessionData.Message || `Unexpected MessageCode ${sessionData.MessageCode}` };
  }

  const config = extractConnectionConfig(sessionData);
  if (!config.apiUrl || !config.apiAuthKey) {
    return { ok: false, error: "missing_config", message: "Session response is missing hosxp.api_url / hosxp.api_auth_key" };
  }

  return { ok: true, sessionId, config, userInfo: config.userInfo };
}

function minifySql(sql) {
  return sql
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeSqlStr(s) {
  return String(s == null ? "" : s).replace(/'/g, "''");
}

async function executeSqlViaApiRaw(sql, config) {
  const minified = minifySql(sql);
  const base = config.apiUrl.replace(/\/$/, "");
  const url = `${base}/api/sql?sql=${encodeURIComponent(minified)}&app=${encodeURIComponent(APP_ID)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SQL_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${config.apiAuthKey}` },
      signal: controller.signal
    });
  } catch (e) {
    if (e.name === "AbortError") {
      return { ok: false, error: "timeout", message: `Query timed out after ${SQL_TIMEOUT_MS / 1000}s` };
    }
    return { ok: false, error: "network_error", message: e.message };
  } finally {
    clearTimeout(timer);
  }

  // The tunnel can wrap its real status inside the JSON body's MessageCode
  // rather than the HTTP status line — observed in practice: HTTP 501
  // carrying {"MessageCode":401,"Message":"Invalid authorization"}. Parse
  // the body first and trust MessageCode over the raw HTTP status when
  // both are present.
  let body = null;
  try {
    body = await res.json();
  } catch {
    // not JSON — fall through to raw HTTP status handling below
  }

  if (body && typeof body.MessageCode === "number") {
    if (body.MessageCode === 200) return { ok: true, data: body.data || [] };
    if (body.MessageCode === 401) return { ok: false, error: "unauthorized", message: body.Message || "Invalid authorization" };
    if (body.MessageCode === 409) return { ok: false, error: "conflict", message: body.Message || "HOSxP is busy" };
    return { ok: false, error: "query_error", message: body.Message || `MessageCode ${body.MessageCode}` };
  }

  if (res.status === 401) return { ok: false, error: "unauthorized", message: "Invalid or expired API key" };
  if (res.status === 409) return { ok: false, error: "conflict", message: "HOSxP is busy" };
  if (res.status === 502) return { ok: false, error: "bad_gateway", message: "HOSxP tunnel is unreachable (502)" };
  if (!res.ok) return { ok: false, error: "http_error", message: `HTTP ${res.status}` };

  return { ok: false, error: "empty_response", message: "Response was not valid JSON" };
}

// The HOSxP bridge serves one request at a time per session — a second
// request arriving while one is in flight (elsewhere in HOSxP, e.g. someone
// using the same HOSxP desktop client concurrently) comes back as 409.
// Queuing every call in this app serializes our own side of that; the
// retry-with-backoff in executeSqlViaApi covers 409s coming from outside it.
let sqlQueueTail = Promise.resolve();
const CONFLICT_BACKOFF_MS = [1200, 2000, 3200, 5000];

async function executeSqlViaApi(sql, config, retry = 0) {
  const prevTail = sqlQueueTail;
  let releaseTail;
  sqlQueueTail = new Promise((resolve) => { releaseTail = resolve; });
  let result;
  try {
    await prevTail;
    result = await executeSqlViaApiRaw(sql, config);
  } finally {
    releaseTail();
  }

  if (!result.ok && result.error === "conflict" && retry < CONFLICT_BACKOFF_MS.length) {
    await new Promise((resolve) => setTimeout(resolve, CONFLICT_BACKOFF_MS[retry]));
    return executeSqlViaApi(sql, config, retry + 1);
  }
  return result;
}

window.BmsSession = {
  handleUrlSession,
  getSessionCookie,
  setSessionCookie,
  removeSessionCookie,
  connectSession,
  executeSqlViaApi,
  escapeSqlStr
};
