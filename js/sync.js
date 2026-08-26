const CLOUD_CONFIG_KEY = "importSystemCloudConfig";
const CLOUD_SCHEMA_VERSION = "LL-IMPORT-2026-08-CANONICAL-4";
const CLOUD_BOOTSTRAP_KEY = "importSystemCloudBootstrapV50";
const CLOUD_QUEUE_KEY = "importSystemCloudQueueV2";
const DEFAULT_GOOGLE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxWKdEC7vy_7pZ2_CPie-9L5DeIofPggZlLuwB7gW-31HqWXEOxshtCR-HB-m5qLYS6/exec";

let cloudSyncBusy = false;
let cloudApplyingRemote = false;
let cloudInitialSyncComplete = false;
let cloudSyncTimer = null;
let cloudSyncRequestedWhileBusy = false;
let cloudLastForegroundCheckAt = 0;
let cloudForegroundCheckTimer = null;
const CLOUD_FOREGROUND_CHECK_GAP = 1500;

function getCloudConfig() {
  const saved = loadJSON(CLOUD_CONFIG_KEY, {});
  return {
    url: DEFAULT_GOOGLE_SCRIPT_URL,
    revision: Number(saved.revision) || 0,
    lastSyncAt: saved.lastSyncAt || "",
    bootstrapToken: saved.bootstrapToken || "",
    bootstrapRevision: Number(saved.bootstrapRevision) || 0
  };
}

function saveCloudConfig(config) {
  localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify({
    url: DEFAULT_GOOGLE_SCRIPT_URL,
    revision: Number(config.revision) || 0,
    lastSyncAt: config.lastSyncAt || "",
    bootstrapToken: config.bootstrapToken || "",
    bootstrapRevision: Number(config.bootstrapRevision) || 0
  }));
}

function getCloudQueue() {
  const saved = loadJSON(CLOUD_QUEUE_KEY, {});
  return {
    dirty: Boolean(saved.dirty),
    changedAt: saved.changedAt || "",
    deleted: {
      products: Array.isArray(saved.deleted?.products) ? saved.deleted.products : [],
      imports: Array.isArray(saved.deleted?.imports) ? saved.deleted.imports : [],
      batches: Array.isArray(saved.deleted?.batches) ? saved.deleted.batches : []
    }
  };
}

function saveCloudQueue(queue) {
  localStorage.setItem(CLOUD_QUEUE_KEY, JSON.stringify(queue));
}

function isCloudBootstrapComplete() {
  const saved = loadJSON(CLOUD_BOOTSTRAP_KEY, {});
  return saved && saved.version === APP_VERSION && saved.schemaVersion === CLOUD_SCHEMA_VERSION && saved.completed === true;
}

function clearLegacyPendingCloudState() {
  window.clearTimeout(cloudSyncTimer);
  saveCloudQueue({
    dirty: false,
    changedAt: "",
    deleted: { products: [], imports: [], batches: [] }
  });
}

function saveCloudBootstrap(data) {
  const config = getCloudConfig();
  config.bootstrapToken = String(data.bootstrapToken || "");
  config.bootstrapRevision = Number(data.revision) || 0;
  saveCloudConfig(config);
  localStorage.setItem(CLOUD_BOOTSTRAP_KEY, JSON.stringify({
    version: APP_VERSION,
    schemaVersion: CLOUD_SCHEMA_VERSION,
    completed: true,
    revision: Number(data.revision) || 0,
    completedAt: new Date().toISOString()
  }));
}

function isApplyingGoogleData() {
  return cloudApplyingRemote;
}

function setupCloudSync() {
  renderCloudMeta(getCloudConfig());
  setCloudState("syncing");

  window.addEventListener("online", () => {
    // 如果首次打开时处于离线状态，恢复网络后执行首次同步；
    // 否则才使用前景检查，避免重复同步。
    if (!cloudInitialSyncComplete) {
      runCloudSync();
      return;
    }

    scheduleForegroundCloudCheck(10);
  });

  document.addEventListener("visibilitychange", () => {
    if (
      !document.hidden &&
      cloudInitialSyncComplete
    ) {
      scheduleForegroundCloudCheck(10);
    }
  });

  window.addEventListener("pageshow", event => {
    // 首次载入页面时 pageshow 会自动触发。
    // 初次同步未完成前忽略，避免打开 App 后同步两次。
    if (!cloudInitialSyncComplete) return;

    scheduleForegroundCloudCheck(
      event.persisted ? 10 : 80
    );
  });

  // 首次开启只由这里执行一次同步。
  window.setTimeout(() => runCloudSync(), 0);
}

function scheduleForegroundCloudCheck(delay = 10) {
  if (!navigator.onLine || cloudApplyingRemote) return;

  const now = Date.now();
  const elapsed = now - cloudLastForegroundCheckAt;

  window.clearTimeout(cloudForegroundCheckTimer);

  cloudForegroundCheckTimer = window.setTimeout(() => {
    cloudLastForegroundCheckAt = Date.now();
    runCloudSync();
  }, Math.max(delay, elapsed >= CLOUD_FOREGROUND_CHECK_GAP
    ? 0
    : CLOUD_FOREGROUND_CHECK_GAP - elapsed));
}

function showLatestDataSyncedToast() {
  let toast = document.getElementById("latestDataSyncedToast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "latestDataSyncedToast";
    toast.className = "latest-data-synced-toast";
    document.body.appendChild(toast);
  }

  toast.textContent = "✓ 已同步最新资料";
  toast.classList.add("show");

  window.clearTimeout(toast._hideTimer);
  toast._hideTimer = window.setTimeout(() => {
    toast.classList.remove("show");
  }, 800);
}

async function refreshLatestCloudData() {
  const beforeRevision = Number(getCloudConfig().revision) || 0;

  if (!navigator.onLine) {
    setCloudState("failed");
    return {
      ok: false,
      updated: false,
      offline: true
    };
  }

  await runCloudSync();

  const afterRevision = Number(getCloudConfig().revision) || 0;

  return {
    ok: true,
    updated: afterRevision > beforeRevision,
    revision: afterRevision
  };
}

window.refreshLatestCloudData = refreshLatestCloudData;

async function callGoogleApi(payload, attempt = 0) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(DEFAULT_GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Google connection failed (${response.status})`);
    }

    const data = await response.json();
    if (!data.ok) throw new Error(data.error || "Google sync failed");
    return data;
  } catch (error) {
    const retryable =
      navigator.onLine &&
      attempt < 2 &&
      (error?.name === "AbortError" || error instanceof TypeError || /connection failed/i.test(String(error?.message || error)));

    if (retryable) {
      await new Promise(resolve => window.setTimeout(resolve, attempt === 0 ? 150 : 450));
      return callGoogleApi(payload, attempt + 1);
    }

    if (error?.name === "AbortError") {
      throw new Error("Google sync timeout");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function makeLocalSnapshot() {
  return {
    settings: loadJSON("importSystemSettings", {}),
    products: getProducts(),
    imports: getImports(),
    batches: getBatches()
  };
}

function markCloudCollectionSaved(collection, previousItems, nextItems) {
  if (cloudApplyingRemote || !isCloudBootstrapComplete()) return;
  if (JSON.stringify(previousItems || []) === JSON.stringify(nextItems || [])) return;

  const queue = getCloudQueue();
  const oldIds = new Set((previousItems || []).map(item => String(item?.id || "")).filter(Boolean));
  const newIds = new Set((nextItems || []).map(item => String(item?.id || "")).filter(Boolean));
  const deleted = new Set(queue.deleted[collection] || []);

  oldIds.forEach(id => {
    if (!newIds.has(id)) deleted.add(id);
  });
  newIds.forEach(id => deleted.delete(id));

  queue.deleted[collection] = [...deleted];
  queue.dirty = true;
  queue.changedAt = new Date().toISOString();
  saveCloudQueue(queue);
  scheduleGoogleSync(25);
}

function markCloudSettingsSaved() {
  if (cloudApplyingRemote || !isCloudBootstrapComplete()) return;
  const queue = getCloudQueue();
  queue.dirty = true;
  queue.changedAt = new Date().toISOString();
  saveCloudQueue(queue);
  scheduleGoogleSync(25);
}

function scheduleGoogleSync(delay = 25) {
  if (cloudApplyingRemote || !isCloudBootstrapComplete()) return;

  const queue = getCloudQueue();
  if (!queue.dirty) {
    queue.dirty = true;
    queue.changedAt = new Date().toISOString();
    saveCloudQueue(queue);
  }

  setCloudState("syncing");
  window.clearTimeout(cloudSyncTimer);
  cloudSyncTimer = window.setTimeout(() => runCloudSync(), delay);
}

async function waitForCloudIdleV83(timeoutMs = 30000) {
  const started = Date.now();
  while (cloudSyncBusy) {
    if (Date.now() - started > timeoutMs) {
      throw new Error("云端同步仍在进行，超过安全等待时间。请稍后再试。");
    }
    await new Promise(resolve => window.setTimeout(resolve, 100));
  }
}

async function flushCloudQueueStrictV83() {
  if (!navigator.onLine) throw new Error("目前离线，库存没有扣除。");
  if (!isCloudBootstrapComplete()) {
    throw new Error("首次同步尚未完成，请等显示「已同步」后再确认销售库存。");
  }

  window.clearTimeout(cloudSyncTimer);
  await waitForCloudIdleV83();

  const queue = getCloudQueue();
  if (!queue?.dirty) return getCloudConfig();

  cloudSyncBusy = true;
  setCloudState("syncing");
  try {
    await pushPendingSnapshot(queue);
    if (getCloudQueue()?.dirty) {
      throw new Error("仍有资料等待同步，已停止销售库存扣除。");
    }
    return getCloudConfig();
  } catch (error) {
    setCloudState("failed");
    throw error;
  } finally {
    cloudSyncBusy = false;
  }
}

async function commitSalesInventoryToCloudV83(payload) {
  await flushCloudQueueStrictV83();
  const config = getCloudConfig();
  setCloudState("syncing");

  try {
    const data = await callGoogleApi({
      action: "commitSalesInventoryV83",
      clientVersion: APP_VERSION,
      schemaVersion: CLOUD_SCHEMA_VERSION,
      baseRevision: Number(config.revision) || 0,
      bootstrapToken: String(config.bootstrapToken || ""),
      bootstrapRevision: Number(config.bootstrapRevision) || 0,
      updatedBy: "System V11.1 Stable",
      ...payload
    });

    if (data.conflict || data.stockChanged) {
      throw new Error(data.message || "Google Sheet 资料已改变，库存没有扣除。请同步后重试。");
    }

    config.revision = Number(data.revision) || Number(config.revision) || 0;
    config.lastSyncAt = new Date().toISOString();
    config.bootstrapToken = String(data.bootstrapToken || config.bootstrapToken || "");
    config.bootstrapRevision = Number(data.revision) || Number(config.bootstrapRevision) || 0;
    saveCloudConfig(config);
    renderCloudMeta(config);
    setCloudState("synced");
    return data;
  } catch (error) {
    setCloudState("failed");
    throw error;
  }
}
window.commitSalesInventoryToCloudV83 = commitSalesInventoryToCloudV83;

async function commitSalesCorrectionBatchToCloudV110(payload) {
  await flushCloudQueueStrictV83(); const config=getCloudConfig(); setCloudState("syncing");
  try { const data=await callGoogleApi({action:"commitSalesCorrectionBatchV110",clientVersion:APP_VERSION,schemaVersion:CLOUD_SCHEMA_VERSION,baseRevision:Number(config.revision)||0,bootstrapToken:String(config.bootstrapToken||""),bootstrapRevision:Number(config.bootstrapRevision)||0,updatedBy:"System V11.1 Stable",...payload});
    if(data.conflict||data.stockChanged) throw new Error(data.message||"Google Sheet 资料已改变，全部库存差异没有处理。请同步后重试。");
    config.revision=Number(data.revision)||Number(config.revision)||0; config.lastSyncAt=new Date().toISOString(); config.bootstrapToken=String(data.bootstrapToken||config.bootstrapToken||""); config.bootstrapRevision=Number(data.revision)||Number(config.bootstrapRevision)||0; saveCloudConfig(config); renderCloudMeta(config); setCloudState("synced"); return data;
  } catch(error){setCloudState("failed");throw error;}
}
window.commitSalesCorrectionBatchToCloudV110=commitSalesCorrectionBatchToCloudV110;

async function pullLatestAfterSalesCommitV83(forceFull = false) {
  await waitForCloudIdleV83();
  return pullLatestSnapshot(Boolean(forceFull));
}
window.pullLatestAfterSalesCommitV83 = pullLatestAfterSalesCommitV83;

async function runCloudSync() {
  if (!navigator.onLine) {
    setCloudState("failed");
    return;
  }

  if (cloudSyncBusy) {
    cloudSyncRequestedWhileBusy = true;
    return;
  }

  cloudSyncBusy = true;
  cloudSyncRequestedWhileBusy = false;
  setCloudState("syncing");

  try {
    const queue = getCloudQueue();
    const snapshot = makeLocalSnapshot();
    const localHasCoreData =
      (snapshot.products || []).length > 0 ||
      (snapshot.imports || []).length > 0 ||
      (snapshot.batches || []).length > 0;

    // V8.7 hard bootstrap: this version's first successful sync is ALWAYS a full Pull.
    // Legacy V4.20/V4.25/V4.26 dirty flags are discarded before any write can happen.
    // No Push is allowed until the canonical Sheet has been pulled successfully.
    let remoteUpdated = false;

    if (!isCloudBootstrapComplete()) {
      clearLegacyPendingCloudState();
      remoteUpdated = await pullLatestSnapshot(true);
    } else if (queue.dirty && !localHasCoreData) {
      saveCloudQueue({
        dirty: false,
        changedAt: "",
        deleted: { products: [], imports: [], batches: [] }
      });
      remoteUpdated = await pullLatestSnapshot();
    } else if (queue.dirty) {
      // push 本身会以 baseRevision 做服务器端检查；
      // 若电脑已经更新，服务器返回 conflict 后自动合并再重试，
      // 不额外增加一次网络请求。
      await pushPendingSnapshot(queue);
    } else {
      remoteUpdated = await pullLatestSnapshot();
    }

    if (remoteUpdated) {
      showLatestDataSyncedToast();
    }

    cloudInitialSyncComplete = true;
  } catch (error) {
    cloudInitialSyncComplete = true;
    setCloudState("failed");
    console.error("Google sync failed:", error);
  } finally {
    cloudSyncBusy = false;
    if (cloudSyncRequestedWhileBusy || getCloudQueue().dirty) {
      cloudSyncTimer = window.setTimeout(() => runCloudSync(), 40);
    }
  }
}

async function pullLatestSnapshot(forceBootstrap = false) {
  const config = getCloudConfig();
  const local = makeLocalSnapshot();
  const localHasCoreData =
    (local.products || []).length > 0 ||
    (local.imports || []).length > 0 ||
    (local.batches || []).length > 0;

  const data = await callGoogleApi({
    action: "pull",
    clientVersion: APP_VERSION,
    schemaVersion: CLOUD_SCHEMA_VERSION,
    knownRevision: forceBootstrap ? 0 : (Number(config.revision) || 0),
    hasLocalData: forceBootstrap ? false : localHasCoreData,
    forceFull: forceBootstrap || !localHasCoreData
  });

  if (data.unchanged) {
    if (!localHasCoreData) {
      throw new Error("Google Sheet未返回完整资料，已停止显示空库存");
    }
    config.revision = Number(data.revision) || 0;
    config.lastSyncAt = new Date().toISOString();
    if (data.bootstrapToken) {
      config.bootstrapToken = String(data.bootstrapToken);
      config.bootstrapRevision = Number(data.revision) || 0;
    }
    saveCloudConfig(config);
    renderCloudMeta(config);
    setCloudState("synced");
    return false;
  }

  if (!Array.isArray(data.products) || !Array.isArray(data.imports) || !Array.isArray(data.batches)) {
    throw new Error("Google Sheet返回资料不完整");
  }

  // 正常启动拉取以Google Sheet为准；只有明确dirty的本地修改才可推送。
  applyRemoteData(data);
  config.revision = Number(data.revision) || 0;
  config.lastSyncAt = new Date().toISOString();
  config.bootstrapToken = String(data.bootstrapToken || "");
  config.bootstrapRevision = Number(data.revision) || 0;
  saveCloudConfig(config);
  if (forceBootstrap) saveCloudBootstrap(data);
  renderCloudMeta(config);
  setCloudState("synced");
  return true;
}

function hasUnsyncedLocalChanges(local, remote, config) {
  const localHasData =
    (local.products || []).length || (local.imports || []).length || (local.batches || []).length;
  const remoteHasData =
    (remote.products || []).length || (remote.imports || []).length || (remote.batches || []).length;

  if (localHasData && !remoteHasData) return true;
  if (!config.lastSyncAt) return false;

  const lastSync = Date.parse(config.lastSyncAt) || 0;
  const remoteIds = {
    products: new Set((remote.products || []).map(item => String(item.id || ""))),
    imports: new Set((remote.imports || []).map(item => String(item.id || ""))),
    batches: new Set((remote.batches || []).map(item => String(item.id || "")))
  };

  return ["products", "imports", "batches"].some(collection =>
    (local[collection] || []).some(item => {
      const id = String(item?.id || "");
      const changedAt = getItemTime(item);
      return changedAt > lastSync && (!remoteIds[collection].has(id) || changedAt > 0);
    })
  );
}


async function updateProductMinimumPriceFast(productId, minimumPrice, updatedAt) {
  const config = getCloudConfig();

  if (!navigator.onLine) {
    throw new Error("目前离线，最低售价尚未同步到 Google Sheet。");
  }
  if (!isCloudBootstrapComplete()) {
    throw new Error("首次同步尚未完成，请等显示「已同步」后再修改最低售价。");
  }

  setCloudState("syncing");

  const data = await callGoogleApi({
    action: "updateMinimumPrice",
    clientVersion: APP_VERSION,
    schemaVersion: CLOUD_SCHEMA_VERSION,
    baseRevision: Number(config.revision) || 0,
    bootstrapToken: String(config.bootstrapToken || ""),
    bootstrapRevision: Number(config.bootstrapRevision) || 0,
    updatedBy: "System V11.1 Stable",
    productId: String(productId || ""),
    minimumPrice: Number(minimumPrice),
    updatedAt: String(updatedAt || new Date().toISOString())
  });

  if (data.conflict) {
    config.revision = Number(data.revision) || Number(config.revision) || 0;
    if (data.bootstrapToken) {
      config.bootstrapToken = String(data.bootstrapToken);
      config.bootstrapRevision = Number(data.revision) || 0;
    }
    saveCloudConfig(config);
    throw new Error("资料已在其他设备更新，请同步最新资料后再修改最低售价。");
  }

  config.revision = Number(data.revision) || 0;
  config.lastSyncAt = new Date().toISOString();
  config.bootstrapToken = String(data.bootstrapToken || "");
  config.bootstrapRevision = Number(data.revision) || 0;
  saveCloudConfig(config);

  renderCloudMeta(config);
  setCloudState("synced");
  return data;
}

window.updateProductMinimumPriceFast = updateProductMinimumPriceFast;

async function pushPendingSnapshot(queue, retryCount = 0) {
  const config = getCloudConfig();
  const snapshot = makeLocalSnapshot();
  const sentChangedAt = queue.changedAt || "";

  const data = await callGoogleApi({
    action: "push",
    clientVersion: APP_VERSION,
    schemaVersion: CLOUD_SCHEMA_VERSION,
    force: false,
    baseRevision: Number(config.revision) || 0,
    bootstrapToken: String(config.bootstrapToken || ""),
    bootstrapRevision: Number(config.bootstrapRevision) || 0,
    updatedBy: "System V11.1 Stable",
    settings: snapshot.settings,
    products: snapshot.products,
    imports: snapshot.imports,
    batches: snapshot.batches
  });

  if (data.conflict) {
    if (retryCount >= 1) throw new Error("资料冲突仍未解决，请重新打开系统再同步");

    const merged = mergeSnapshots(data, snapshot, queue);
    applyRemoteData(merged);

    config.revision = Number(data.revision) || 0;
    config.bootstrapToken = String(data.bootstrapToken || "");
    config.bootstrapRevision = Number(data.revision) || 0;
    saveCloudConfig(config);

    // Keep dirty state and retry exactly once with the merged snapshot.
    return pushPendingSnapshot(queue, retryCount + 1);
  }

  config.revision = Number(data.revision) || 0;
  config.lastSyncAt = new Date().toISOString();
  config.bootstrapToken = String(data.bootstrapToken || "");
  config.bootstrapRevision = Number(data.revision) || 0;
  saveCloudConfig(config);

  const latestQueue = getCloudQueue();
  if (latestQueue.changedAt === sentChangedAt) {
    saveCloudQueue({
      dirty: false,
      changedAt: "",
      deleted: { products: [], imports: [], batches: [] }
    });
  }

  renderCloudMeta(config);
  setCloudState("synced");
}

function mergeSnapshots(remote, local, queue) {
  return {
    settings: { ...(remote.settings || {}), ...(local.settings || {}) },
    products: mergeCollection(remote.products, local.products, queue.deleted.products),
    imports: mergeCollection(remote.imports, local.imports, queue.deleted.imports),
    batches: mergeCollection(remote.batches, local.batches, queue.deleted.batches)
  };
}

function mergeCollection(remoteItems = [], localItems = [], deletedIds = []) {
  const deleted = new Set((deletedIds || []).map(String));
  const merged = new Map();

  (remoteItems || []).forEach(item => {
    const id = String(item?.id || "");
    if (id && !deleted.has(id)) merged.set(id, item);
  });

  (localItems || []).forEach(item => {
    const id = String(item?.id || "");
    if (!id || deleted.has(id)) return;

    const remoteItem = merged.get(id);
    if (!remoteItem || getItemTime(item) >= getItemTime(remoteItem)) {
      merged.set(id, item);
    }
  });

  return [...merged.values()];
}

function getItemTime(item) {
  const value = item?.updatedAt || item?.createdAt || "";
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function applyRemoteData(data) {
  if (!Array.isArray(data.products) || !Array.isArray(data.imports) || !Array.isArray(data.batches)) {
    throw new Error("云端资料不完整，已停止覆盖本机资料");
  }

  cloudApplyingRemote = true;
  try {
    localStorage.setItem("importSystemSettings", JSON.stringify(data.settings || {}));
    localStorage.setItem("importSystemProducts", JSON.stringify(data.products));
    localStorage.setItem("importSystemImports", JSON.stringify(data.imports));
    localStorage.setItem("importSystemBatches", JSON.stringify(data.batches));
  } finally {
    cloudApplyingRemote = false;
  }

  // 云端拉取后只刷新画面，不自动重建或上传，避免同步循环与Restore后反向覆盖。
  refreshSystemViewsAfterSync();
}

function refreshSystemViewsAfterSync() {
  [
    "renderDashboard",
    "renderProductList",
    "renderBatchSuggestions",
    "renderBatchList",
    "renderInventoryManagementList",
    "updatePasswordHintDisplays"
  ].forEach(name => {
    try {
      if (typeof window[name] === "function") window[name]();
    } catch (error) {
      console.warn(`${name} refresh skipped:`, error);
    }
  });
}

function renderCloudMeta(config = getCloudConfig()) {
  const lastSyncEl = document.getElementById("googleLastSync");
  if (!lastSyncEl) return;

  if (!config.lastSyncAt) {
    lastSyncEl.textContent = "尚未同步";
    return;
  }

  const date = new Date(config.lastSyncAt);
  lastSyncEl.textContent = date.toLocaleString("en-GB", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  }).replaceAll("/", "-");
}

function setCloudState(state) {
  const element = document.getElementById("googleSyncStatus");
  if (!element) return;

  const icon = element.querySelector(".dashboard-sync-icon");
  const text = element.querySelector(".dashboard-sync-text");
  element.classList.remove("syncing", "synced", "failed");

  if (state === "synced") {
    element.classList.add("synced");
    if (icon) icon.textContent = "✓";
    if (text) text.textContent = "已同步";
  } else if (state === "failed") {
    element.classList.add("failed");
    if (icon) icon.textContent = "!";
    if (text) text.textContent = navigator.onLine ? "同步失败，请稍后重试" : "离线，资料已保存在本机";
  } else {
    element.classList.add("syncing");
    if (icon) icon.textContent = "↻";
    if (text) text.textContent = "同步中...";
  }
}
