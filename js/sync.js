const CLOUD_CONFIG_KEY = "importSystemCloudConfig";
const CLOUD_SCHEMA_VERSION = "LL-IMPORT-2026-08-CANONICAL-4";
const CLOUD_BOOTSTRAP_KEY = "importSystemCloudBootstrapV50";
const CLOUD_QUEUE_KEY = "importSystemCloudQueueV2";
const CLOUD_PREVIOUS_REVISION_KEY_V185 = "importSystemPreviousRevisionV185";
const DEFAULT_GOOGLE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxWKdEC7vy_7pZ2_CPie-9L5DeIofPggZlLuwB7gW-31HqWXEOxshtCR-HB-m5qLYS6/exec";

let cloudSyncBusy = false;
let cloudApplyingRemote = false;
let cloudInitialSyncComplete = false;
let cloudSyncTimer = null;
let cloudSyncRequestedWhileBusy = false;
let cloudRefreshingViewsV338 = false;
// V36.3: remember whether a real unsynced queue already existed before any
// DOMContentLoaded setup code runs. Startup-only housekeeping must never turn a
// clean launch into a Push before the first read-only cloud check completes.
const cloudQueueWasDirtyAtScriptLoadV337 = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem(CLOUD_QUEUE_KEY) || "{}");
    return Boolean(saved && saved.dirty);
  } catch (_) {
    return false;
  }
})();
let cloudLastForegroundCheckAt = 0;
let cloudForegroundCheckTimer = null;
let cloudLastErrorMessage = "";
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
  const previousConfig = loadJSON(CLOUD_CONFIG_KEY, {});
  const previousRevision = Number(previousConfig.revision);
  const nextRevision = Number(config.revision) || 0;
  if (Number.isFinite(previousRevision) && previousRevision > 0 && previousRevision !== nextRevision) {
    localStorage.setItem(CLOUD_PREVIOUS_REVISION_KEY_V185, String(previousRevision));
  }
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
      batches: Array.isArray(saved.deleted?.batches) ? saved.deleted.batches : [],
      importNumbers: Array.isArray(saved.deleted?.importNumbers) ? saved.deleted.importNumbers : [],
      batchIds: Array.isArray(saved.deleted?.batchIds) ? saved.deleted.batchIds : []
    },
    dirtyCollections: saved.dirtyCollections && typeof saved.dirtyCollections === "object" ? {
      products:Boolean(saved.dirtyCollections.products), imports:Boolean(saved.dirtyCollections.imports), batches:Boolean(saved.dirtyCollections.batches), settings:Boolean(saved.dirtyCollections.settings)
    } : {products:false,imports:false,batches:false,settings:false}
  };
}

function saveCloudQueue(queue) {
  localStorage.setItem(CLOUD_QUEUE_KEY, JSON.stringify(queue));
}

function isCloudBootstrapComplete() {
  const saved = loadJSON(CLOUD_BOOTSTRAP_KEY, {});
  return saved && saved.schemaVersion === CLOUD_SCHEMA_VERSION && saved.completed === true;
}

function isCloudWriteCredentialCurrentV341() {
  const saved = loadJSON(CLOUD_BOOTSTRAP_KEY, {});
  const config = getCloudConfig();
  return Boolean(saved && saved.completed === true && saved.schemaVersion === CLOUD_SCHEMA_VERSION &&
    String(saved.version || "") === String(APP_VERSION || "") &&
    config.bootstrapToken && Number(config.bootstrapRevision) > 0 &&
    Number(config.bootstrapRevision) === Number(config.revision));
}

function hydrateRemoteProductManualFlagsV341(products, settings) {
  const overrides = settings && settings.minimumPriceManualOverrides && typeof settings.minimumPriceManualOverrides === "object"
    ? settings.minimumPriceManualOverrides : {};
  const normalized = new Map(Object.entries(overrides).map(([key,value]) => [String(key || "").trim().toUpperCase(), Boolean(value)]));
  return (Array.isArray(products) ? products : []).map(product => {
    if (typeof product?.minimumPriceManual === "boolean") return product;
    const key = String(product?.id || "").trim().toUpperCase();
    return { ...product, minimumPriceManual: normalized.has(key) ? normalized.get(key) : false };
  });
}

function clearLegacyPendingCloudState() {
  window.clearTimeout(cloudSyncTimer);
  saveCloudQueue({
    dirty: false,
    changedAt: "",
    deleted: { products: [], imports: [], batches: [], importNumbers: [], batchIds: [] },
    dirtyCollections:{products:false,imports:false,batches:false,settings:false}
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
  const startupConfigV338 = getCloudConfig();
  renderCloudMeta(startupConfigV338);
  // V36.5 repairs a stale PZ+BS local cache before deciding whether Local-First is safe.
  repairLocalBsCanonicalCacheV365();
  const startupSnapshotV338 = makeLocalSnapshot();
  const cachedCanonicalV365 = isCanonicalBsSnapshotV365(startupSnapshotV338.products || []);
  const hasCachedCoreV338 =
    (startupSnapshotV338.products || []).length > 0 ||
    (startupSnapshotV338.imports || []).length > 0 ||
    (startupSnapshotV338.batches || []).length > 0;
  // V36.4 Local-First: when a valid V32.5-style bootstrap and cached core data
  // already exist, show the last successful state immediately while the
  // revision check runs silently in the background.
  if (isCloudBootstrapComplete() && Number(startupConfigV338.revision) > 0 && hasCachedCoreV338 && cachedCanonicalV365 && !getCloudQueue().dirty) {
    setCloudState("synced");
  } else {
    setCloudState("syncing");
  }

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

function markCloudImportNumberDeletedV232(importNumber, batchId = "") {
  if (cloudApplyingRemote || !isCloudBootstrapComplete()) return;
  const queue = getCloudQueue();
  const importNumbers = new Set(queue.deleted.importNumbers || []);
  const batchIds = new Set(queue.deleted.batchIds || []);
  const normalizedImportNumber = String(importNumber || "").trim();
  const normalizedBatchId = String(batchId || "").trim();
  if (normalizedImportNumber) importNumbers.add(normalizedImportNumber);
  if (normalizedBatchId) batchIds.add(normalizedBatchId);
  queue.deleted.importNumbers = [...importNumbers];
  queue.deleted.batchIds = [...batchIds];
  queue.dirtyCollections = {...(queue.dirtyCollections||{}), products:true, imports:true, batches:true, settings:true};
  queue.dirty = true;
  queue.changedAt = new Date().toISOString();
  saveCloudQueue(queue);
}
window.markCloudImportNumberDeletedV232 = markCloudImportNumberDeletedV232;

function cancelCloudImportNumberDeletionV232(importNumber, batchId = "") {
  const queue = getCloudQueue();
  const normalizedImportNumber = String(importNumber || "").trim().toLowerCase();
  const normalizedBatchId = String(batchId || "").trim();
  queue.deleted.importNumbers = (queue.deleted.importNumbers || []).filter(value => String(value || "").trim().toLowerCase() !== normalizedImportNumber);
  queue.deleted.batchIds = (queue.deleted.batchIds || []).filter(value => String(value || "").trim() !== normalizedBatchId);
  saveCloudQueue(queue);
}
window.cancelCloudImportNumberDeletionV232 = cancelCloudImportNumberDeletionV232;

function markCloudCollectionSaved(collection, previousItems, nextItems) {
  if (cloudApplyingRemote || cloudRefreshingViewsV338 || !isCloudBootstrapComplete() || !cloudInitialSyncComplete) return;
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
  queue.dirtyCollections = {...(queue.dirtyCollections||{}), [collection]:true};
  queue.dirty = true;
  queue.changedAt = new Date().toISOString();
  saveCloudQueue(queue);
  scheduleGoogleSync(25);
}

function markCloudSettingsSaved() {
  if (cloudApplyingRemote || cloudRefreshingViewsV338 || !isCloudBootstrapComplete() || !cloudInitialSyncComplete) return;
  const queue = getCloudQueue();
  queue.dirtyCollections = {...(queue.dirtyCollections||{}), settings:true};
  queue.dirty = true;
  queue.changedAt = new Date().toISOString();
  saveCloudQueue(queue);
  scheduleGoogleSync(25);
}

function scheduleGoogleSync(delay = 25) {
  if (cloudApplyingRemote || cloudRefreshingViewsV338 || !isCloudBootstrapComplete() || !cloudInitialSyncComplete) return;

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

window.flushCloudQueueStrictV228 = flushCloudQueueStrictV83;

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
      updatedBy: "System V36.5 Stable",
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
    if (forceBootstrap || !isCloudWriteCredentialCurrentV341()) saveCloudBootstrap(data);
    renderCloudMeta(config);
    setCloudState("synced");
    return data;
  } catch (error) {
    setCloudState("failed");
    throw error;
  }
}
window.commitSalesInventoryToCloudV83 = commitSalesInventoryToCloudV83;

async function commitSalesInventoryBatchToCloudV125(payload) {
  await flushCloudQueueStrictV83();
  const config = getCloudConfig();
  setCloudState("syncing");
  try {
    const data = await callGoogleApi({
      action: "commitSalesInventoryBatchV125",
      clientVersion: APP_VERSION,
      schemaVersion: CLOUD_SCHEMA_VERSION,
      baseRevision: Number(config.revision) || 0,
      bootstrapToken: String(config.bootstrapToken || ""),
      bootstrapRevision: Number(config.bootstrapRevision) || 0,
      updatedBy: "System V36.5 Stable",
      ...payload
    });
    if (data.conflict || data.stockChanged) {
      throw new Error(data.message || "Google Sheet 资料已改变，整张销售卡库存没有处理。请同步后重试。");
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
window.commitSalesInventoryBatchToCloudV125 = commitSalesInventoryBatchToCloudV125;

async function commitSalesCorrectionBatchToCloudV110(payload) {
  await flushCloudQueueStrictV83(); const config=getCloudConfig(); setCloudState("syncing");
  try { const data=await callGoogleApi({action:"commitSalesCorrectionBatchV110",clientVersion:APP_VERSION,schemaVersion:CLOUD_SCHEMA_VERSION,baseRevision:Number(config.revision)||0,bootstrapToken:String(config.bootstrapToken||""),bootstrapRevision:Number(config.bootstrapRevision)||0,updatedBy:"System V36.5 Stable",...payload});
    if(data.conflict||data.stockChanged) throw new Error(data.message||"Google Sheet 资料已改变，全部库存差异没有处理。请同步后重试。");
    config.revision=Number(data.revision)||Number(config.revision)||0; config.lastSyncAt=new Date().toISOString(); config.bootstrapToken=String(data.bootstrapToken||config.bootstrapToken||""); config.bootstrapRevision=Number(data.revision)||Number(config.bootstrapRevision)||0; saveCloudConfig(config); renderCloudMeta(config); setCloudState("synced"); return data;
  } catch(error){setCloudState("failed");throw error;}
}
window.commitSalesCorrectionBatchToCloudV110=commitSalesCorrectionBatchToCloudV110;

async function migrateProductPrefixesV164() {
  await flushCloudQueueStrictV83();
  const config = getCloudConfig();
  const data = await callGoogleApi({
    action: "migrateProductPrefixesV164", clientVersion: APP_VERSION,
    schemaVersion: CLOUD_SCHEMA_VERSION, baseRevision: Number(config.revision) || 0,
    bootstrapToken: String(config.bootstrapToken || ""), bootstrapRevision: Number(config.bootstrapRevision) || 0,
    updatedBy: "System V36.5 Stable"
  });
  if (data.conflict) throw new Error(data.message || "资料已改变，请同步后重试。");
  config.revision = Number(data.revision) || Number(config.revision) || 0;
  config.bootstrapToken = String(data.bootstrapToken || config.bootstrapToken || "");
  config.bootstrapRevision = Number(data.revision) || Number(config.bootstrapRevision) || 0;
  config.lastSyncAt = new Date().toISOString(); saveCloudConfig(config);
  await pullLatestSnapshot(true);
  return data;
}
window.migrateProductPrefixesV164 = migrateProductPrefixesV164;

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

  try {
    let queue = getCloudQueue();
    // V36.3: if the queue was clean before this page loaded but became dirty while
    // setup/render code was running, that dirtiness is startup housekeeping, not
    // a user edit. Clear it before the first cloud operation so V32.5's fast
    // read-first path is preserved. A queue that was already dirty before page
    // load is left untouched to protect genuine unsynced work.
    if (!cloudInitialSyncComplete && !cloudQueueWasDirtyAtScriptLoadV337 && queue.dirty) {
      saveCloudQueue({
        dirty: false,
        changedAt: "",
        deleted: { products: [], imports: [], batches: [], importNumbers: [], batchIds: [] }
      });
      queue = getCloudQueue();
    }
    // V36.3: after one successful bootstrap, read-only revision checks stay in the
    // background and must not put the dashboard back into a long "同步中..." state.
    // Real local writes/pushes still show syncing.
    if (!cloudInitialSyncComplete || queue.dirty || !isCloudBootstrapComplete()) {
      setCloudState("syncing");
    }
    const snapshot = makeLocalSnapshot();
    const localHasCoreData =
      (snapshot.products || []).length > 0 ||
      (snapshot.imports || []).length > 0 ||
      (snapshot.batches || []).length > 0;

    // V8.7 hard bootstrap: this version's first successful sync is ALWAYS a full Pull.
    // Legacy V4.20/V4.25/V4.26 dirty flags are discarded before any write can happen.
    // No Push is allowed until the canonical Sheet has been pulled successfully.
    let remoteUpdated = false;

    // V36.3: a bootstrap record from an older cached frontend may be complete but
    // its write credential is not current. Refresh it with a read-only Pull before
    // any Push is allowed. This prevents the mobile V8.7 red-flash loop.
    let credentialRefreshedV342 = false;
    if (isCloudBootstrapComplete() && !isCloudWriteCredentialCurrentV341() && !queue.dirty) {
      remoteUpdated = await pullLatestSnapshot(false);
      queue = getCloudQueue();
      credentialRefreshedV342 = true;
    }

    if (!isCloudBootstrapComplete()) {
      clearLegacyPendingCloudState();
      remoteUpdated = await pullLatestSnapshot(true);
    } else if (queue.dirty && !localHasCoreData) {
      saveCloudQueue({
        dirty: false,
        changedAt: "",
        deleted: { products: [], imports: [], batches: [], importNumbers: [], batchIds: [] }
      });
      remoteUpdated = await pullLatestSnapshot();
    } else if (queue.dirty) {
      // push 本身会以 baseRevision 做服务器端检查；
      // 若电脑已经更新，服务器返回 conflict 后自动合并再重试，
      // 不额外增加一次网络请求。
      await pushPendingSnapshot(queue);
    } else if (!credentialRefreshedV342) {
      remoteUpdated = await pullLatestSnapshot();
    }

    if (remoteUpdated) {
      showLatestDataSyncedToast();
    }

    cloudInitialSyncComplete = true;
    if (!getCloudQueue().dirty) setCloudState("synced");
  } catch (error) {
    cloudInitialSyncComplete = true;
    setCloudState("failed", error);
    console.error("Google sync failed:", error);
  } finally {
    cloudSyncBusy = false;
    const finalQueueV338 = getCloudQueue();
    if (cloudInitialSyncComplete && !finalQueueV338.dirty && navigator.onLine) {
      setCloudState("synced");
      if (getMinimumPricePendingV345()?.productId) window.setTimeout(retryPendingMinimumPriceV345, 250);
    }
    if (cloudSyncRequestedWhileBusy || finalQueueV338.dirty) {
      cloudSyncTimer = window.setTimeout(() => runCloudSync(), 40);
    }
  }
}

function hasBsLegacyIdsV364(products = []) {
  const ids = new Set((products || []).map(p => String(p?.id || "").trim().toUpperCase()));
  return ["PZ0001","PZ0036","PZ0175","PZ0176","PZ0192"].some(oldId => ids.has(oldId));
}

// V36.5: canonical BS guard used before the first UI paint and before every cloud apply.
// A device may still carry the temporary V36.3 snapshot that contained both PZ and BS rows.
// Repair that cache locally without marking it dirty: BS stays authoritative, PZ is only an alias.
const BS_CANONICAL_ALIASES_V365 = {
  PZ0001:"BS0001", PZ0036:"BS0036", PZ0175:"BS0175", PZ0176:"BS0176", PZ0192:"BS0192"
};

function isCanonicalBsSnapshotV365(products = []) {
  const ids = (Array.isArray(products) ? products : []).map(p => String(p?.id || "").trim().toUpperCase()).filter(Boolean);
  if (ids.length !== new Set(ids).size) return false;
  return !Object.keys(BS_CANONICAL_ALIASES_V365).some(oldId => ids.includes(oldId));
}

function mergeLocalAdjustmentsV365(primary, legacy) {
  const rows = [];
  const seen = new Set();
  [primary, legacy].forEach(product => {
    let list = [];
    try {
      list = Array.isArray(product?.stockAdjustments)
        ? product.stockAdjustments
        : JSON.parse(String(product?.stockAdjustmentsJson || "[]"));
    } catch (_) { list = []; }
    (Array.isArray(list) ? list : []).forEach(row => {
      const fixed = replaceProductIdsDeepV364(row, BS_CANONICAL_ALIASES_V365);
      const key = String(fixed?.id || fixed?.key || fixed?.salesKey || JSON.stringify(fixed));
      if (!seen.has(key)) { seen.add(key); rows.push(fixed); }
    });
  });
  return rows;
}

function repairLocalBsCanonicalCacheV365() {
  try {
    const products = loadJSON("importSystemProducts", []);
    if (!Array.isArray(products) || !products.length) return false;
    const byId = new Map(products.map(p => [String(p?.id || "").trim().toUpperCase(), p]));
    const hasLegacy = Object.keys(BS_CANONICAL_ALIASES_V365).some(oldId => byId.has(oldId));
    if (!hasLegacy && isCanonicalBsSnapshotV365(products)) return false;

    const nextProducts = [];
    products.forEach(product => {
      const id = String(product?.id || "").trim().toUpperCase();
      const targetId = BS_CANONICAL_ALIASES_V365[id];
      if (targetId) {
        // If canonical BS already exists, the PZ row is stale and must not add stock again.
        if (byId.has(targetId)) return;
        const adjustments = mergeLocalAdjustmentsV365(product, null);
        nextProducts.push({
          ...product, id:targetId,
          ...(adjustments.length ? {stockAdjustments:adjustments, stockAdjustmentsJson:JSON.stringify(adjustments)} : {})
        });
        return;
      }
      const legacyId = Object.keys(BS_CANONICAL_ALIASES_V365).find(oldId => BS_CANONICAL_ALIASES_V365[oldId] === id);
      if (legacyId && byId.has(legacyId)) {
        const adjustments = mergeLocalAdjustmentsV365(product, byId.get(legacyId));
        nextProducts.push({
          ...product,
          ...(adjustments.length ? {stockAdjustments:adjustments, stockAdjustmentsJson:JSON.stringify(adjustments)} : {})
        });
        return;
      }
      nextProducts.push(product);
    });

    const nextImports = replaceProductIdsDeepV364(loadJSON("importSystemImports", []), BS_CANONICAL_ALIASES_V365);
    const nextBatches = replaceProductIdsDeepV364(loadJSON("importSystemBatches", []), BS_CANONICAL_ALIASES_V365);
    const nextSettings = replaceProductIdsDeepV364(loadJSON("importSystemSettings", {}), BS_CANONICAL_ALIASES_V365);
    nextSettings.productIdAliases = { ...(nextSettings.productIdAliases || {}), ...BS_CANONICAL_ALIASES_V365 };

    localStorage.setItem("importSystemProducts", JSON.stringify(nextProducts));
    localStorage.setItem("importSystemImports", JSON.stringify(nextImports));
    localStorage.setItem("importSystemBatches", JSON.stringify(nextBatches));
    localStorage.setItem("importSystemSettings", JSON.stringify(nextSettings));
    return true;
  } catch (error) {
    console.warn("V36.5 local BS canonical cache repair skipped", error);
    return false;
  }
}
window.repairLocalBsCanonicalCacheV365 = repairLocalBsCanonicalCacheV365;

async function pullLatestSnapshot(forceBootstrap = false) {
  const config = getCloudConfig();
  const local = makeLocalSnapshot();
  const localHasCoreData =
    (local.products || []).length > 0 ||
    (local.imports || []).length > 0 ||
    (local.batches || []).length > 0;

  let data = await callGoogleApi({
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
    // V36.3: even an unchanged Pull can return a fresh bootstrap token. Persist
    // the current-version credential so mobile caches do not keep using V34.0/V34.1 tokens.
    if (!isCloudWriteCredentialCurrentV341() && data.bootstrapToken) saveCloudBootstrap(data);
    renderCloudMeta(config);
    setCloudState("synced");
    return false;
  }

  if (!Array.isArray(data.products) || !Array.isArray(data.imports) || !Array.isArray(data.batches)) {
    throw new Error("Google Sheet返回资料不完整");
  }

  // V36.4: if the cloud contains both old PZ and new BS copies, repair the cloud
  // BEFORE applying it locally. This prevents the +57 duplicate stock from becoming
  // a new local authoritative snapshot or being pushed from another device.
  if (hasBsLegacyIdsV364(data.products)) {
    const repair = await callGoogleApi({
      action:"repairBsCanonicalV364", clientVersion:APP_VERSION, schemaVersion:CLOUD_SCHEMA_VERSION,
      baseRevision:Number(data.revision)||0, bootstrapToken:String(data.bootstrapToken||""),
      bootstrapRevision:Number(data.revision)||0, updatedBy:"System V36.5 Stable"
    });
    if (!repair?.ok || repair?.conflict || repair?.writeBlocked) throw new Error(repair?.message || "BS 编号修复失败，已停止载入重复库存。");
    data = await callGoogleApi({
      action:"pull", clientVersion:APP_VERSION, schemaVersion:CLOUD_SCHEMA_VERSION,
      knownRevision:0, hasLocalData:false, forceFull:true
    });
    if (!Array.isArray(data.products) || hasBsLegacyIdsV364(data.products)) throw new Error("BS 编号修复后仍检测到旧 PZ 资料，已停止覆盖本机库存。");
  }

  // V36.5: never paint an intermediate/legacy snapshot as authoritative inventory.
  if (!isCanonicalBsSnapshotV365(data.products)) {
    throw new Error("云端产品编号仍处于迁移中间状态，已停止显示，等待下一次完整同步。");
  }

  // 正常启动拉取以Google Sheet为准；只有明确dirty的本地修改才可推送。
  applyRemoteData(data);
  config.revision = Number(data.revision) || 0;
  config.lastSyncAt = new Date().toISOString();
  config.bootstrapToken = String(data.bootstrapToken || "");
  config.bootstrapRevision = Number(data.revision) || 0;
  saveCloudConfig(config);
  if (forceBootstrap || !isCloudWriteCredentialCurrentV341()) saveCloudBootstrap(data);
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



const MINIMUM_PRICE_PENDING_KEY_V345 = "minimumPricePendingV345";
function getMinimumPricePendingV345(){try{return JSON.parse(localStorage.getItem(MINIMUM_PRICE_PENDING_KEY_V345)||"null")}catch(_){return null}}
function setMinimumPricePendingV345(value){if(value)localStorage.setItem(MINIMUM_PRICE_PENDING_KEY_V345,JSON.stringify(value));else localStorage.removeItem(MINIMUM_PRICE_PENDING_KEY_V345)}
function reapplyPendingMinimumPriceLocalV345(){
  const pending=getMinimumPricePendingV345(); if(!pending?.productId)return false;
  try{
    const products=loadJSON("importSystemProducts",[]); const i=products.findIndex(p=>String(p?.id||"")===String(pending.productId));
    if(i>=0){products[i]={...products[i],minimumPrice:Number(pending.minimumPrice)||0,minimumPriceManual:Boolean(pending.minimumPriceManual),updatedAt:String(pending.updatedAt||new Date().toISOString())};localStorage.setItem("importSystemProducts",JSON.stringify(products));}
    const settings=loadJSON("importSystemSettings",{}), overrides={...(settings.minimumPriceManualOverrides||{})}; overrides[String(pending.productId)]=Boolean(pending.minimumPriceManual); localStorage.setItem("importSystemSettings",JSON.stringify({...settings,minimumPriceManualOverrides:overrides}));
    return true;
  }catch(_){return false}
}
window.hasPendingMinimumPriceV345=()=>Boolean(getMinimumPricePendingV345()?.productId);
window.addEventListener("beforeunload",event=>{if(!getMinimumPricePendingV345()?.productId)return;event.preventDefault();event.returnValue="";});
let minimumPricePendingRetryBusyV345=false;
function retryPendingMinimumPriceV345(){
  const pending=getMinimumPricePendingV345();
  if(!pending?.productId||minimumPricePendingRetryBusyV345||!navigator.onLine||!isCloudBootstrapComplete())return;
  minimumPricePendingRetryBusyV345=true;
  Promise.resolve(updateProductMinimumPriceFast(pending.productId,pending.minimumPrice,pending.updatedAt,pending.minimumPriceManual))
    .catch(error=>console.warn("V36.5 pending minimum-price retry kept for next sync",error))
    .finally(()=>{minimumPricePendingRetryBusyV345=false;});
}
window.retryPendingMinimumPriceV345=retryPendingMinimumPriceV345;
async function updateProductMinimumPriceFast(productId, minimumPrice, updatedAt, minimumPriceManual = true, retryCountV341 = 0) {
  if (!isCloudWriteCredentialCurrentV341()) {
    await pullLatestSnapshot(false);
  }
  const config = getCloudConfig();

  if (!navigator.onLine) {
    throw new Error("目前离线，最低售价尚未同步到 Google Sheet。");
  }
  if (!isCloudBootstrapComplete()) {
    throw new Error("首次同步尚未完成，请等显示「已同步」后再修改最低售价。");
  }

  setMinimumPricePendingV345({productId:String(productId||""),minimumPrice:Number(minimumPrice)||0,minimumPriceManual:Boolean(minimumPriceManual),updatedAt:String(updatedAt||new Date().toISOString())});
  setCloudState("syncing");

  const data = await callGoogleApi({
    action: "updateMinimumPrice",
    clientVersion: APP_VERSION,
    schemaVersion: CLOUD_SCHEMA_VERSION,
    baseRevision: Number(config.revision) || 0,
    bootstrapToken: String(config.bootstrapToken || ""),
    bootstrapRevision: Number(config.bootstrapRevision) || 0,
    updatedBy: "System V36.5 Stable",
    productId: String(productId || ""),
    minimumPrice: Number(minimumPrice),
    minimumPriceManual: Boolean(minimumPriceManual),
    updatedAt: String(updatedAt || new Date().toISOString())
  });

  if (data.conflict) {
    config.revision = Number(data.revision) || Number(config.revision) || 0;
    if (data.bootstrapToken) {
      config.bootstrapToken = String(data.bootstrapToken);
      config.bootstrapRevision = Number(data.revision) || 0;
    }
    saveCloudConfig(config);
    if (retryCountV341 < 2) {
      await pullLatestSnapshot(false);
      reapplyPendingMinimumPriceLocalV345();
      return updateProductMinimumPriceFast(productId, minimumPrice, updatedAt, minimumPriceManual, retryCountV341 + 1);
    }
    reapplyPendingMinimumPriceLocalV345();
    setCloudState("syncing");
    window.setTimeout(retryPendingMinimumPriceV345, 500);
    const pendingErrorV351 = new Error("资料版本刚刚发生变化，本次最低售价已保留，系统会自动重试同步。");
    pendingErrorV351.minimumPricePending = true;
    throw pendingErrorV351;
  }

  config.revision = Number(data.revision) || 0;
  config.lastSyncAt = new Date().toISOString();
  config.bootstrapToken = String(data.bootstrapToken || "");
  config.bootstrapRevision = Number(data.revision) || 0;
  saveCloudConfig(config);

  // V36.3: keep this single-product change authoritative locally as well.
  // A credential-refresh Pull may have happened immediately before the write;
  // re-apply only this product so other protected products never lose their flags.
  try {
    const localProductsV341 = loadJSON("importSystemProducts", []);
    const localIndexV341 = Array.isArray(localProductsV341)
      ? localProductsV341.findIndex(item => String(item?.id || "").trim() === String(productId || "").trim())
      : -1;
    if (localIndexV341 >= 0) {
      localProductsV341[localIndexV341] = {
        ...localProductsV341[localIndexV341],
        minimumPrice: Number(minimumPrice) || 0,
        minimumPriceManual: Boolean(minimumPriceManual),
        updatedAt: String(updatedAt || new Date().toISOString())
      };
      localStorage.setItem("importSystemProducts", JSON.stringify(localProductsV341));
    }
    const localSettingsV341 = loadJSON("importSystemSettings", {});
    const localOverridesV341 = { ...(localSettingsV341.minimumPriceManualOverrides || {}) };
    localOverridesV341[String(productId || "").trim()] = Boolean(minimumPriceManual);
    localStorage.setItem("importSystemSettings", JSON.stringify({ ...localSettingsV341, minimumPriceManualOverrides: localOverridesV341 }));
    if (typeof inventoryPreparedRowsCacheV321 !== "undefined") {
      inventoryPreparedRowsCacheV321 = { rawProducts:null, settings:null, imports:null, batches:null, sales:null, rows:[] };
    }
  } catch (localErrorV341) {
    console.warn("V36.5 minimum-price local refresh skipped", localErrorV341);
  }

  setMinimumPricePendingV345(null);
  renderCloudMeta(config);
  setCloudState("synced");
  window.setTimeout(()=>{try{if(typeof refreshSystemViewsAfterSync==="function")refreshSystemViewsAfterSync()}catch(refreshErrorV343){console.warn("V36.5 deferred minimum-price refresh skipped",refreshErrorV343)}},0);
  return data;
}

window.updateProductMinimumPriceFast = updateProductMinimumPriceFast;


async function updateProductAverageCostFastV358(productId, averageCost, minimumPrice, updatedAt, reason, retryCountV358 = 0) {
  if (!isCloudWriteCredentialCurrentV341()) await pullLatestSnapshot(false);
  const config = getCloudConfig();
  if (!navigator.onLine) throw new Error("目前离线，平均成本尚未同步到 Google Sheet。");
  if (!isCloudBootstrapComplete()) throw new Error("首次同步尚未完成，请等显示「已同步」后再修改平均成本。");

  setCloudState("syncing");
  const data = await callGoogleApi({
    action:"updateAverageCostV358",
    clientVersion:APP_VERSION, schemaVersion:CLOUD_SCHEMA_VERSION,
    baseRevision:Number(config.revision)||0,
    bootstrapToken:String(config.bootstrapToken||""), bootstrapRevision:Number(config.bootstrapRevision)||0,
    updatedBy:"System V36.5 Stable",
    productId:String(productId||"").trim(),
    averageCost:Number(averageCost),
    minimumPrice:Number(minimumPrice),
    updatedAt:String(updatedAt||new Date().toISOString()),
    reason:String(reason||"").trim()
  });

  if (data.conflict) {
    config.revision = Number(data.revision) || Number(config.revision) || 0;
    if (data.bootstrapToken) {
      config.bootstrapToken = String(data.bootstrapToken);
      config.bootstrapRevision = Number(data.revision) || 0;
    }
    saveCloudConfig(config);
    if (retryCountV358 < 1) {
      await pullLatestSnapshot(false);
      return updateProductAverageCostFastV358(productId, averageCost, minimumPrice, updatedAt, reason, retryCountV358 + 1);
    }
    setCloudState("error");
    throw new Error("资料版本刚刚发生变化，系统已重新同步；平均成本尚未保存，请再试一次。");
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
window.updateProductAverageCostFastV358 = updateProductAverageCostFastV358;

async function fetchAverageCostManualHistoryV359(limit = 500) {
  if (!navigator.onLine) return { ok:true, entries:[] };
  return callGoogleApi({
    action:"getAverageCostManualHistoryV359",
    clientVersion:APP_VERSION, schemaVersion:CLOUD_SCHEMA_VERSION,
    limit:Math.max(1, Math.min(500, Number(limit) || 500))
  });
}
window.fetchAverageCostManualHistoryV359 = fetchAverageCostManualHistoryV359;

async function updatePromotionSettingsFastV185(promotion) {
  if (!navigator.onLine) throw new Error("目前离线，促销设置尚未同步。");
  if (!isCloudBootstrapComplete()) throw new Error("首次同步尚未完成，请稍后再试。");
  await waitForCloudIdleV83();
  const config = getCloudConfig();
  setCloudState("syncing");
  const data = await callGoogleApi({
    action: "updatePromotionSettingsV185",
    clientVersion: APP_VERSION,
    schemaVersion: CLOUD_SCHEMA_VERSION,
    baseRevision: Number(config.revision) || 0,
    bootstrapToken: String(config.bootstrapToken || ""),
    bootstrapRevision: Number(config.bootstrapRevision) || 0,
    updatedBy: "System V36.5 Stable",
    promotion: promotion || null
  });
  if (data.conflict) {
    // V36.3: preserve the cloud's currently active promotion. A failed update is
    // not a request to close promotion. Refresh the latest authoritative state,
    // keep the user's draft untouched, and ask for one deliberate retry.
    config.revision = Number(data.revision) || Number(config.revision) || 0;
    config.bootstrapToken = String(data.bootstrapToken || config.bootstrapToken || "");
    config.bootstrapRevision = Number(data.revision) || Number(config.bootstrapRevision) || 0;
    saveCloudConfig(config);
    try { await pullLatestSnapshot(false); } catch (pullErrorV350) { console.warn("V36.5 promotion conflict refresh skipped", pullErrorV350); }
    try { setCloudState("synced"); } catch (_) {}
    throw new Error("资料版本刚刚发生变化，系统已重新同步；原本已开启的促销保持不变。本次修改尚未保存，请再试一次。");
  }
  config.revision = Number(data.revision) || Number(config.revision) || 0;
  config.lastSyncAt = new Date().toISOString();
  config.bootstrapToken = String(data.bootstrapToken || config.bootstrapToken || "");
  config.bootstrapRevision = Number(data.revision) || Number(config.bootstrapRevision) || 0;
  saveCloudConfig(config); renderCloudMeta(config); setCloudState("synced");
  return data;
}
window.updatePromotionSettingsFastV185 = updatePromotionSettingsFastV185;


async function pushPendingSnapshot(queue, retryCount = 0) {
  const config = getCloudConfig();
  // V36.5: a stale device must canonicalize the five IDs before it is allowed to build a write snapshot.
  repairLocalBsCanonicalCacheV365();
  const snapshot = makeLocalSnapshot();
  if (!isCanonicalBsSnapshotV365(snapshot.products || [])) throw new Error("本机仍有旧 PZ 编号，已阻止写入以保护库存。请重新同步。");
  const sentChangedAt = queue.changedAt || "";

  const dirty=queue.dirtyCollections||{};
  const hasTracked=Boolean(dirty.products||dirty.imports||dirty.batches||dirty.settings);
  const collections=hasTracked?Object.keys(dirty).filter(k=>dirty[k]):["products","imports","batches","settings"];
  const data = await callGoogleApi({
    action: "pushDeltaV346",
    clientVersion: APP_VERSION, schemaVersion: CLOUD_SCHEMA_VERSION, force:false,
    baseRevision:Number(config.revision)||0, bootstrapToken:String(config.bootstrapToken||""), bootstrapRevision:Number(config.bootstrapRevision)||0,
    updatedBy:"System V36.5 Stable", collections,
    ...(collections.includes("settings")?{settings:snapshot.settings,productIds:(snapshot.products||[]).map(item=>String(item?.id||"").trim()).filter(Boolean)}:{}),
    ...(collections.includes("products")?{products:snapshot.products}:{}),
    ...(collections.includes("imports")?{imports:snapshot.imports}:{}),
    ...(collections.includes("batches")?{batches:snapshot.batches}:{}),
    deleted:queue.deleted||{products:[],imports:[],batches:[],importNumbers:[],batchIds:[]}
  });

  if (data.conflict) {
    if (retryCount >= 1) throw new Error("资料冲突仍未解决，请重新打开系统再同步");

    const merged = mergeSnapshots(data, snapshot, queue);
    if (!isCanonicalBsSnapshotV365(merged.products || [])) throw new Error("冲突合并仍含旧 PZ 编号，已阻止覆盖库存。");
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
      deleted: { products: [], imports: [], batches: [], importNumbers: [], batchIds: [] },
      dirtyCollections:{products:false,imports:false,batches:false,settings:false}
    });
  }

  renderCloudMeta(config);
  setCloudState("synced");
}

function sanitizeLegacySettingsV323(settings = {}, products = []) {
  const validIds = new Set((Array.isArray(products) ? products : []).map(p => String(p?.id || "").trim().toUpperCase()).filter(Boolean));
  const out = { ...(settings || {}) };
  ["invoiceRecognitionDraftsV259","invoiceRecognitionHistoryV259","warehousePublicCatalogV275","supplierDirectoryV261",
   "testSupplierCleanupV268","twoWarehouseMigrationV270","twoWarehouseMigrationAddedV270","warehouseRepairV276",
   "warehouseRepairAddedV276","invoiceRecognitionSharedStatusV277"].forEach(k => delete out[k]);
  const prune = key => {
    const src = out[key];
    if (!src || typeof src !== "object" || Array.isArray(src)) return;
    out[key] = Object.fromEntries(Object.entries(src).filter(([id]) => validIds.has(String(id || "").trim().toUpperCase())));
  };
  prune("minimumPriceManualOverrides");
  prune("productLanguageMetaV262");
  prune("productMediaLinksV229");
  if (Array.isArray(out.importDraftsV242)) {
    out.importDraftsV242 = out.importDraftsV242.filter(draft => {
      const rows = Array.isArray(draft?.rows) ? draft.rows : [];
      const legacyRow = rows.some(row => {
        const id = String(row?.productId || "").trim().toUpperCase();
        const category = String(row?.category || "").trim();
        const warehouse = String(row?.warehouseV270 || row?.warehouse || "").trim().toLowerCase();
        return category === "杂花杂木" || /^ZZ\d+$/i.test(id) || warehouse === "wood";
      });
      const legacySource = /^AIR|invoice/i.test(String(draft?.source || draft?.type || "")) || Boolean(draft?.invoiceRecognitionId || draft?.linkedInvoiceRecognitionId);
      return !(legacyRow || legacySource);
    });
  }
  // V36.3: promotion is live business state, not legacy residue. Preserve a valid
  // active promotion across normal Pull/merge operations so revision conflicts or
  // another device's write can never silently switch an active promotion off.
  const promo = out.promotionV183;
  if (promo && promo.active === true) {
    const commissionRate = Number(promo.commissionRate);
    const targetMarginRate = Number(promo.targetMarginRate);
    if (Number.isFinite(commissionRate) && commissionRate >= 0 && commissionRate < 100 &&
        Number.isFinite(targetMarginRate) && targetMarginRate > -100 && targetMarginRate < 100 &&
        1 - commissionRate / 100 - targetMarginRate / 100 > 0) {
      out.promotionV183 = {
        active: true,
        name: String(promo.name || "年尾清货").trim().slice(0, 30) || "年尾清货",
        commissionRate, targetMarginRate,
        excludedProductIds: [...new Set((Array.isArray(promo.excludedProductIds) ? promo.excludedProductIds : [])
          .map(id => String(id || "").trim().toUpperCase())
          .filter(id => id && validIds.has(id)))],
        priceOverrides: Object.fromEntries(Object.entries(promo.priceOverrides && typeof promo.priceOverrides === "object" ? promo.priceOverrides : {})
          .map(([id, price]) => [String(id || "").trim().toUpperCase(), Number(price)])
          .filter(([id, price]) => id && validIds.has(id) && Number.isFinite(price) && price > 0)
          .map(([id, price]) => [id, Math.round(price * 100) / 100])),
        createdAt: String(promo.createdAt || ""),
        updatedAt: String(promo.updatedAt || "")
      };
    } else {
      delete out.promotionV183;
    }
  } else {
    delete out.promotionV183;
  }
  return out;
}

function markCloudExplicitDeletedIdsV323({ products = [], imports = [], batches = [] } = {}) {
  if (cloudApplyingRemote || !isCloudBootstrapComplete()) return;
  const queue = getCloudQueue();
  [["products", products],["imports", imports],["batches", batches]].forEach(([key, values]) => {
    const set = new Set(queue.deleted[key] || []);
    (values || []).map(String).filter(Boolean).forEach(id => set.add(id));
    queue.deleted[key] = [...set];
    if ((values || []).length) queue.dirtyCollections = {...(queue.dirtyCollections||{}), [key]:true};
  });
  queue.dirty = true;
  queue.changedAt = new Date().toISOString();
  saveCloudQueue(queue);
}
window.markCloudExplicitDeletedIdsV323 = markCloudExplicitDeletedIdsV323;

function replaceProductIdsDeepV364(value, aliases = {}) {
  if (typeof value === "string") {
    let next = aliases[value] || value;
    Object.keys(aliases).forEach(oldId => { if (next.includes(oldId)) next = next.split(oldId).join(aliases[oldId]); });
    return next;
  }
  if (Array.isArray(value)) return value.map(item => replaceProductIdsDeepV364(item, aliases));
  if (value && typeof value === "object") {
    const out = {};
    Object.keys(value).forEach(key => { out[replaceProductIdsDeepV364(key, aliases)] = replaceProductIdsDeepV364(value[key], aliases); });
    return out;
  }
  return value;
}
function canonicalizeCollectionsV364(snapshot, aliases = {}) {
  const out = { ...(snapshot || {}) };
  out.products = (snapshot?.products || []).map(p => ({ ...p, id: aliases[String(p?.id||"")] || String(p?.id||"") }));
  out.imports = replaceProductIdsDeepV364(snapshot?.imports || [], aliases);
  out.batches = replaceProductIdsDeepV364(snapshot?.batches || [], aliases);
  out.settings = replaceProductIdsDeepV364(snapshot?.settings || {}, aliases);
  return out;
}

function mergeSnapshots(remote, local, queue) {
  // V36.4: stale PZ copies must never reappear beside their canonical BS IDs.
  const fixedAliasesV364 = {PZ0001:"BS0001",PZ0036:"BS0036",PZ0175:"BS0175",PZ0176:"BS0176",PZ0192:"BS0192"};
  const aliasSourceV364 = { ...fixedAliasesV364, ...(remote?.settings?.productIdAliases || {}), ...(local?.settings?.productIdAliases || {}) };
  remote = canonicalizeCollectionsV364(remote, aliasSourceV364);
  const remoteCanonicalIdsV364 = new Set((remote.products || []).map(p => String(p?.id || "")));
  // If cloud already has the canonical target, an old cached alias is stale and must
  // not win by updatedAt during conflict merge. This is the exact +57 prevention rule.
  local = { ...(local || {}), products:(local?.products || []).filter(p => {
    const oldId=String(p?.id||""); const target=aliasSourceV364[oldId];
    return !(target && remoteCanonicalIdsV364.has(target));
  }) };
  local = canonicalizeCollectionsV364(local, aliasSourceV364);
  const deletedImportNumbers = new Set((queue.deleted?.importNumbers || []).map(value => String(value || "").trim().toLowerCase()).filter(Boolean));
  const deletedBatchIds = new Set((queue.deleted?.batchIds || []).map(value => String(value || "").trim()).filter(Boolean));
  const keepImport = item => {
    const importNumber = String(item?.importNumber || "").trim().toLowerCase();
    const batchId = String(item?.batchId || "").trim();
    return !(deletedImportNumbers.has(importNumber) || deletedBatchIds.has(batchId));
  };
  const keepBatch = item => {
    const importNumber = String(item?.importNumber || "").trim().toLowerCase();
    const batchId = String(item?.id || "").trim();
    return !(deletedImportNumbers.has(importNumber) || deletedBatchIds.has(batchId));
  };
  const remoteSettings = remote.settings || {};
  const localSettings = local.settings || {};
  const draftDeletedIdsV250 = [...new Set([
    ...(Array.isArray(remoteSettings.importDraftDeletedIdsV250) ? remoteSettings.importDraftDeletedIdsV250 : []),
    ...(Array.isArray(localSettings.importDraftDeletedIdsV250) ? localSettings.importDraftDeletedIdsV250 : [])
  ].map(String).filter(Boolean))].slice(0, 100);
  const mergedDraftsV242 = mergeImportDraftsV242(
    remoteSettings.importDraftsV242,
    localSettings.importDraftsV242,
    draftDeletedIdsV250
  );
  const mergedProductsV323 = mergeCollection(remote.products, local.products, queue.deleted.products);
  const mergedSettingsV323 = sanitizeLegacySettingsV323(
    { ...remoteSettings, ...localSettings, importDraftsV242: mergedDraftsV242, importDraftDeletedIdsV250: draftDeletedIdsV250 },
    mergedProductsV323
  );
  return {
    settings: mergedSettingsV323,
    products: mergedProductsV323,
    imports: mergeCollection((remote.imports || []).filter(keepImport), (local.imports || []).filter(keepImport), queue.deleted.imports),
    batches: mergeCollection((remote.batches || []).filter(keepBatch), (local.batches || []).filter(keepBatch), queue.deleted.batches)
  };
}

function mergeImportDraftsV242(remoteDrafts = [], localDrafts = [], deletedIdsV250 = []) {
  const deleted = new Set((Array.isArray(deletedIdsV250) ? deletedIdsV250 : []).map(String));
  const merged = new Map();
  [...(Array.isArray(remoteDrafts) ? remoteDrafts : []), ...(Array.isArray(localDrafts) ? localDrafts : [])].forEach(draft => {
    const id = String(draft?.id || "").trim();
    if (!id || deleted.has(id)) return;
    const current = merged.get(id);
    const nextTime = Date.parse(draft?.updatedAt || draft?.createdAt || "") || 0;
    const currentTime = Date.parse(current?.updatedAt || current?.createdAt || "") || 0;
    if (!current || nextTime >= currentTime) merged.set(id, draft);
  });
  return [...merged.values()].sort((a, b) => (Date.parse(b?.updatedAt || "") || 0) - (Date.parse(a?.updatedAt || "") || 0)).slice(0, 30);
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
    // V36.3: keep the proven V32.5 Pull/apply path, but promotionV183 is now
    // authoritative live state. Never strip it during a Pull: doing so can
    // falsely turn an active promotion off after a revision conflict.
    const safeRemoteSettingsV336 = sanitizeLegacySettingsV323(data.settings || {}, data.products || []);
    localStorage.setItem("importSystemSettings", JSON.stringify(safeRemoteSettingsV336));
    const hydratedProductsV341 = hydrateRemoteProductManualFlagsV341(data.products, safeRemoteSettingsV336);
    localStorage.setItem("importSystemProducts", JSON.stringify(hydratedProductsV341));
    reapplyPendingMinimumPriceLocalV345();
    if (typeof invalidateMinimumPriceOriginIndexV160 === "function") {
      invalidateMinimumPriceOriginIndexV160();
    }
    localStorage.setItem("importSystemImports", JSON.stringify(data.imports));
    localStorage.setItem("importSystemBatches", JSON.stringify(data.batches));
    // V36.3: direct cloud writes must invalidate the prepared inventory join.
    // Otherwise a previously prepared empty/filtered array can survive the Pull
    // and leave the card area blank even though totals already show live stock.
    if (typeof inventoryPreparedRowsCacheV321 !== "undefined") {
      inventoryPreparedRowsCacheV321 = { rawProducts:null, settings:null, imports:null, batches:null, sales:null, rows:[] };
    }
    if (typeof inventoryLastRenderedPreparedRowsV321 !== "undefined") inventoryLastRenderedPreparedRowsV321 = null;
    if (typeof inventorySalesAnalyticsCacheV146 !== "undefined") inventorySalesAnalyticsCacheV146 = { signature:"", value:null };
  } finally {
    cloudApplyingRemote = false;
  }

  // V36.3: a cloud Pull is read-only. Do not auto-repair/write cost snapshots
  // during startup or revision checks; this prevents a successful Pull from
  // immediately creating a dirty queue and starting another Push.
  cloudRefreshingViewsV338 = true;
  try {
    refreshSystemViewsAfterSync();
  } finally {
    cloudRefreshingViewsV338 = false;
  }
}

function refreshSystemViewsAfterSync() {
  [
    "renderDashboard",
    "renderProductList",
    "renderBatchSuggestions",
    "renderBatchList",
    "renderInventoryManagementList",
    "renderImportDraftsV242",
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
  const revisionEl = document.getElementById("settingsRevisionV185");
  if (revisionEl) {
    const currentRevision = Number(config.revision) || 0;
    const previousRevision = Number(localStorage.getItem(CLOUD_PREVIOUS_REVISION_KEY_V185));
    revisionEl.textContent = currentRevision > 0
      ? `${previousRevision > 0 && previousRevision !== currentRevision ? previousRevision : "—"} → ${currentRevision}`
      : "尚未同步";
  }
  if (typeof renderSystemInformationV203 === "function") renderSystemInformationV203();
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

function setCloudState(state, error = null) {
  const element = document.getElementById("googleSyncStatus");
  if (!element) return;

  const icon = element.querySelector(".dashboard-sync-icon");
  const text = element.querySelector(".dashboard-sync-text");
  element.classList.remove("syncing", "synced", "failed");

  if (state === "synced") {
    cloudLastErrorMessage = "";
    element.classList.add("synced");
    if (icon) icon.textContent = "✓";
    if (text) text.textContent = "已同步";
  } else if (state === "failed") {
    if (error) cloudLastErrorMessage = String(error?.message || error || "").trim();
    element.classList.add("failed");
    if (icon) icon.textContent = "!";
    if (text) {
      text.textContent = navigator.onLine
        ? `同步失败${cloudLastErrorMessage ? `：${cloudLastErrorMessage.slice(0, 160)}` : "，请稍后重试"}`
        : "离线，资料已保存在本机";
    }
  } else {
    element.classList.add("syncing");
    if (icon) icon.textContent = "↻";
    if (text) text.textContent = "同步中...";
  }
}
