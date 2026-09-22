const APP_VERSION = "33.0";

function formatMoney(value, prefix = "") {
  const number = Number(value) || 0;
  return `${prefix}${number.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function formatNumber(value) {
  return (Number(value) || 0).toLocaleString("en-MY");
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.error("Unable to read local data:", error);
    return fallback;
  }
}


// V32.7: read-only JSON cache. It compares the raw localStorage string on every
// read, so direct writes from sync/restore are picked up immediately while
// repeated settings reads during large renders avoid repeated JSON.parse work.
const readOnlyJsonCacheV317 = new Map();
function loadJSONReadOnlyV317(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const cached = readOnlyJsonCacheV317.get(key);
    if (cached && cached.raw === raw) return cached.value;
    const value = JSON.parse(raw);
    readOnlyJsonCacheV317.set(key, { raw, value });
    return value;
  } catch (error) {
    console.error("Unable to read cached local data:", error);
    return fallback;
  }
}

function parseAmount(value) {
  return Number(String(value ?? "").replace(/,/g, "")) || 0;
}

function formatInputAmount(input) {
  input.value = formatMoney(parseAmount(input.value));
}
