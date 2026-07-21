const CLOUD_CONFIG_KEY = "importSystemCloudConfig";
const DEFAULT_GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyQ75Ug_K0bS9Wq_CHxr6XBhuLgRlokvDsSGH_Wzip9wYyIKA2HYVea3ZSv5vmjzrdr/exec";
let cloudSyncBusy = false;

function getCloudConfig() {
  const saved = loadJSON(CLOUD_CONFIG_KEY, {});

  // V2.30：旧部署网址自动迁移到正式 Web App URL。
  if (!saved.url || saved.url === "https://script.google.com/macros/s/AKfycbw9ZviEXzHY8dZ4ExmsTghsZbqVNj6Rg826DvrndnbMverQQupcbEn0Al_uKn6adbXw/exec") {
    saved.url = DEFAULT_GOOGLE_SCRIPT_URL;
  }

  return {
    url: saved.url || DEFAULT_GOOGLE_SCRIPT_URL,
    user: saved.user || "Alex",
    revision: Number(saved.revision) || 0,
    lastSyncAt: saved.lastSyncAt || ""
  };
}

function saveCloudConfig(config) {
  saveJSON(CLOUD_CONFIG_KEY, config);
}

function setupCloudSync() {
  const urlInput = document.getElementById("googleScriptUrl");
  const userSelect = document.getElementById("syncUser");
  const pullBtn = document.getElementById("pullGoogleBtn");
  const pushBtn = document.getElementById("pushGoogleBtn");
  const testBtn = document.getElementById("testGoogleBtn");
  const config = getCloudConfig();

  // 第一次打开 V2.30 时，自动保存已预设的 Web App URL。
  if (!loadJSON(CLOUD_CONFIG_KEY, {}).url) {
    saveCloudConfig(config);
  }

  if (urlInput) urlInput.value = config.url;
  if (userSelect) userSelect.value = config.user;
  renderCloudMeta(config);

  document.getElementById("saveGoogleConfigBtn")?.addEventListener("click", () => {
    const next = {
      ...getCloudConfig(),
      url: urlInput.value.trim(),
      user: userSelect.value
    };
    saveCloudConfig(next);
    renderCloudMeta(next);
    showCloudStatus("Google 同步设置已保存");
  });

  userSelect?.addEventListener("change", () => {
    const next = { ...getCloudConfig(), user: userSelect.value };
    saveCloudConfig(next);
    renderCloudMeta(next);
  });

  testBtn?.addEventListener("click", testGoogleConnection);
  pullBtn?.addEventListener("click", pullFromGoogle);
  pushBtn?.addEventListener("click", () => pushToGoogle(true));
}

async function callGoogleApi(payload) {
  const config = getCloudConfig();
  if (!config.url) throw new Error("请先填写 Apps Script Web App URL");

  const response = await fetch(config.url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Google 连线失败 (${response.status})`);
  }

  const data = await response.json();
  if (!data.ok) throw new Error(data.error || "Google 同步失败");
  return data;
}

async function testGoogleConnection() {
  if (cloudSyncBusy) return;
  cloudSyncBusy = true;
  showCloudStatus("正在检查 Google 连线...");

  try {
    const data = await callGoogleApi({ action: "pull" });
    const config = getCloudConfig();
    config.revision = Number(data.revision) || 0;
    config.lastSyncAt = new Date().toISOString();
    saveCloudConfig(config);
    renderCloudMeta(config);
    showCloudStatus(`Google 已连接 · Revision ${config.revision}`);
  } catch (error) {
    showCloudStatus(error.message, true);
  } finally {
    cloudSyncBusy = false;
  }
}

async function pullFromGoogle() {
  if (cloudSyncBusy) return;

  const localHasData =
    getProducts().length > 0 ||
    getImports().length > 0 ||
    getBatches().length > 0;

  if (localHasData) {
    const confirmed = confirm(
      "同步最新资料会以 Google Sheet 覆盖这台设备目前的本机资料。\n\n确定继续？"
    );
    if (!confirmed) return;
  }

  cloudSyncBusy = true;
  showCloudStatus("正在下载 Google 最新资料...");

  try {
    const data = await callGoogleApi({ action: "pull" });
    saveJSON("importSystemSettings", data.settings || {});
    saveProducts(data.products || []);
    saveImports(data.imports || []);
    saveBatches(data.batches || []);

    const config = getCloudConfig();
    config.revision = Number(data.revision) || 0;
    config.lastSyncAt = new Date().toISOString();
    saveCloudConfig(config);
    renderCloudMeta(config);

    showCloudStatus(`同步完成 · Revision ${config.revision}`);
    setTimeout(() => window.location.reload(), 700);
  } catch (error) {
    showCloudStatus(error.message, true);
  } finally {
    cloudSyncBusy = false;
  }
}

async function pushToGoogle(force = false) {
  if (cloudSyncBusy) return;

  const products = getProducts();
  const imports = getImports();
  const batches = getBatches();

  if (!products.length && !imports.length && !batches.length) {
    showCloudStatus("本机没有资料，已阻止上传空白资料。", true);
    return;
  }

  const confirmed = force
    ? confirm(
        `确定把这台设备的全部资料上传到 Google Sheet？\n\n产品：${products.length} 项\n进口记录：${imports.length} 项\n批次：${batches.length} 批`
      )
    : true;

  if (!confirmed) return;

  cloudSyncBusy = true;
  showCloudStatus("正在上传到 Google Sheet...");

  try {
    const config = getCloudConfig();
    const data = await callGoogleApi({
      action: "push",
      force,
      baseRevision: Number(config.revision) || 0,
      updatedBy: config.user || "Alex",
      settings: loadJSON("importSystemSettings", {}),
      products,
      imports,
      batches
    });

    config.revision = Number(data.revision) || 0;
    config.lastSyncAt = new Date().toISOString();
    saveCloudConfig(config);
    renderCloudMeta(config);
    showCloudStatus(`已上传 Google · Revision ${config.revision}`);
  } catch (error) {
    showCloudStatus(error.message, true);
  } finally {
    cloudSyncBusy = false;
  }
}

function renderCloudMeta(config = getCloudConfig()) {
  const revisionEl = document.getElementById("googleRevision");
  const lastSyncEl = document.getElementById("googleLastSync");
  const userEl = document.getElementById("googleCurrentUser");

  if (revisionEl) revisionEl.textContent = String(config.revision || 0);
  if (userEl) userEl.textContent = config.user || "Alex";

  if (lastSyncEl) {
    if (!config.lastSyncAt) {
      lastSyncEl.textContent = "尚未同步";
    } else {
      const date = new Date(config.lastSyncAt);
      lastSyncEl.textContent = date.toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      }).replaceAll("/", "-");
    }
  }
}

function showCloudStatus(message, isError = false) {
  const el = document.getElementById("googleSyncStatus");
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("error-status", isError);
}
