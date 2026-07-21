const APP_VERSION = "1.0.0";

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

function parseAmount(value) {
  return Number(String(value ?? "").replace(/,/g, "")) || 0;
}

function formatInputAmount(input) {
  input.value = formatMoney(parseAmount(input.value));
}
