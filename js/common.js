const APP_VERSION = "46.0";

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


// V36.4: read-only JSON cache. It compares the raw localStorage string on every
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

// V44.9: historical product-ID compatibility is read-only. These aliases
// resolve old PZ/PS identifiers to the current canonical Product ID without
// rewriting historical Sales keys, FIFO rows, costs or inventory snapshots.
const LEGACY_PRODUCT_ID_ALIASES_V449 = Object.freeze({
  PZ0001:"BS0001",
  PS0001:"BX0001",
  PS0002:"AS0002",
  PZ0006:"BX0006",
  PZ0023:"JL0023",
  PZ0027:"SK0027",
  PZ0034:"BX0034",
  PZ0036:"BS0036",
  PZ0038:"BX0038",
  PZ0041:"BX0041",
  PZ0042:"BX0042",
  PZ0043:"BX0043",
  PZ0044:"BX0044",
  PZ0045:"BX0045",
  PZ0046:"BB0046",
  PZ0047:"BB0047",
  PZ0054:"BB0054",
  PZ0061:"BX0061",
  PZ0099:"PD0099",
  PZ0150:"BX0150",
  PZ0168:"BB0168",
  PZ0175:"BS0175",
  PZ0176:"BS0176",
  PZ0178:"BB0178",
  PZ0185:"IX0185",
  PZ0188:"BX0188",
  PZ0192:"BS0192"
});

let productIdAliasCacheV449 = { savedRef:null, value:null };
function getProductIdAliasesV449(settingsOverride = null) {
  const settings = settingsOverride && typeof settingsOverride === "object"
    ? settingsOverride
    : loadJSONReadOnlyV317("importSystemSettings", {});
  const saved = settings?.productIdAliases && typeof settings.productIdAliases === "object"
    ? settings.productIdAliases
    : {};
  if (!settingsOverride && productIdAliasCacheV449.savedRef === saved && productIdAliasCacheV449.value) {
    return productIdAliasCacheV449.value;
  }
  const output = {};
  Object.entries(LEGACY_PRODUCT_ID_ALIASES_V449).forEach(([from, to]) => {
    const source = String(from || "").trim().toUpperCase();
    const target = String(to || "").trim().toUpperCase();
    if (source && target && source !== target) output[source] = target;
  });
  Object.entries(saved).forEach(([from, to]) => {
    const source = String(from || "").trim().toUpperCase();
    const target = String(to || "").trim().toUpperCase();
    // Old backups may contain identity entries such as PZ0036→PZ0036. They
    // must not suppress a confirmed static migration alias.
    if (source && target && source !== target) output[source] = target;
  });
  if (!settingsOverride) productIdAliasCacheV449 = { savedRef:saved, value:output };
  return output;
}

function canonicalizeProductIdV449(value, aliasesOverride = null) {
  let current = String(value || "").trim().toUpperCase();
  if (!current) return "";
  const aliases = aliasesOverride && typeof aliasesOverride === "object"
    ? aliasesOverride
    : getProductIdAliasesV449();
  const visited = new Set();
  for (let step = 0; step < 16; step += 1) {
    if (visited.has(current)) break;
    visited.add(current);
    const next = String(aliases[current] || "").trim().toUpperCase();
    if (!next || next === current) break;
    current = next;
  }
  return current;
}

function productIdsMatchV449(left, right, aliasesOverride = null) {
  const a = canonicalizeProductIdV449(left, aliasesOverride);
  const b = canonicalizeProductIdV449(right, aliasesOverride);
  return Boolean(a && b && a === b);
}

function canonicalizeSalesKeyV449(value, aliasesOverride = null) {
  const aliases = aliasesOverride && typeof aliasesOverride === "object"
    ? aliasesOverride
    : getProductIdAliasesV449();
  return String(value || "").replace(/(^|\|)([A-Za-z]{2}\d{4})(?=\||$)/g, (match, prefix, id) => {
    const canonical = canonicalizeProductIdV449(id, aliases);
    return `${prefix}${canonical || String(id || "").toUpperCase()}`;
  });
}

function parseAmount(value) {
  return Number(String(value ?? "").replace(/,/g, "")) || 0;
}

function formatInputAmount(input) {
  input.value = formatMoney(parseAmount(input.value));
}
