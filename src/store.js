// Everything kept on the device lives here. Nothing is ever sent anywhere.
const LEDGER = "ak_ledger_v1";
const HISTORY = "ak_history_v1";
const PIN = "ak_pin_v1";

const read = (k, fallback) => { try { const x = JSON.parse(localStorage.getItem(k) || "null"); return x ?? fallback; } catch { return fallback; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

export const loadLedger = () => { const x = read(LEDGER, []); return Array.isArray(x) ? x : []; };
export const saveLedger = (l) => write(LEDGER, l);
export const loadHistory = () => { const x = read(HISTORY, {}); return x && typeof x === "object" && !Array.isArray(x) ? x : {}; };
export const saveHistory = (h) => write(HISTORY, h);
export const loadPin = () => read(PIN, null);
export const savePin = (p) => (p ? write(PIN, p) : (() => { try { localStorage.removeItem(PIN); return true; } catch { return false; } })());

// Ask the browser not to clear our data when space is short.
export async function keepData() {
  try { if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch { /* ignore */ }
  return false;
}

export async function hashPin(pin, salt) {
  const data = new TextEncoder().encode(salt + ":" + pin);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
export const newSalt = () => Array.from(crypto.getRandomValues(new Uint8Array(12))).map((b) => b.toString(16).padStart(2, "0")).join("");
