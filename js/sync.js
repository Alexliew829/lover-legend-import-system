const CLOUD_CONFIG_KEY = "importSystemCloudConfig";
const CLOUD_QUEUE_KEY = "importSystemCloudQueueV2";
const DEFAULT_GOOGLE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyQ75Ug_K0bS9Wq_CHxr6XBhuLgRlokvDsSGH_Wzip9wYyIKA2HYVea3ZSv5vmjzrdr/exec";

let cloudSyncBusy = false;
let cloudApplyingRemote = false;
let cloudInitialSyncComplete = false;
let cloudSyncTimer = null;
let cloudSyncRequestedWhileBusy = false;

function getCloudConfig() {
  const saved = loadJSON(CLOUD_CONFIG_KEY, {});
  return {
    url: DEFAULT_GOOGLE_SCRIPT_URL,
    revision: Number(saved.revision) || 0,
    lastSyncAt: saved.lastSyncAt || ""
  };
}

function saveCloudConfig(config) {
  localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify({
    url: DEFAULT_GOOGLE_SCRIPT_URL,
    revision: Number(config.revision) || 0,
    lastSyncAt: config.lastSyncAt || ""
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

function isApplyingGoogleData() {
  return cloudApplyingRemote;
}

function setupCloudSync() {
  renderCloudMeta(getCloudConfig());
  setCloudState("syncing");

  window.addEventListener("online", () => scheduleGoogleSync(20));
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && getCloudQueue().dirty) scheduleGoogleSync(20);
  });

  // Pending local work is pushed first; otherwise pull once.
  window.setTimeout(() => runCloudSync(), 0);
}

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
      await new Promise(resolve => window.setTimeout(resolve, attempt === 0 ? 300 : 900));
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
  if (cloudApplyingRemote) return;
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
  scheduleGoogleSync(80);
}

function markCloudSettingsSaved() {
  if (cloudApplyingRemote) return;
  const queue = getCloudQueue();
  queue.dirty = true;
  queue.changedAt = new Date().toISOString();
  saveCloudQueue(queue);
  scheduleGoogleSync(80);
}

function scheduleGoogleSync(delay = 80) {
  if (cloudApplyingRemote) return;

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
    if (queue.dirty) {
      await pushPendingSnapshot(queue);
    } else {
      await pullLatestSnapshot();
    }
    cloudInitialSyncComplete = true;
  } catch (error) {
    cloudInitialSyncComplete = true;
    setCloudState("failed");
    console.error("Google sync failed:", error);
  } finally {
    cloudSyncBusy = false;
    if (cloudSyncRequestedWhileBusy || getCloudQueue().dirty) {
      cloudSyncTimer = window.setTimeout(() => runCloudSync(), 100);
    }
  }
}

async function pullLatestSnapshot() {
  const config = getCloudConfig();
  const data = await callGoogleApi({
    action: "pull",
    knownRevision: Number(config.revision) || 0
  });
  if (data.unchanged) {
    config.revision = Number(data.revision) || 0;
    config.lastSyncAt = new Date().toISOString();
    saveCloudConfig(config);
    renderCloudMeta(config);
    setCloudState("synced");
    return;
  }

  const local = makeLocalSnapshot();

  // Migration protection: V1.9 did not persist its dirty state.
  // If local records are newer than the last successful sync, merge and push
  // instead of allowing the first V2.0 pull to erase them.
  if (hasUnsyncedLocalChanges(local, data, config)) {
    const queue = getCloudQueue();
    queue.dirty = true;
    queue.changedAt = queue.changedAt || new Date().toISOString();
    saveCloudQueue(queue);

    const merged = mergeSnapshots(data, local, queue);
    applyRemoteData(merged);
    config.revision = Number(data.revision) || 0;
    saveCloudConfig(config);
    await pushPendingSnapshot(queue);
    return;
  }

  if (Number(data.revision) !== Number(config.revision) || !config.lastSyncAt) {
    applyRemoteData(data);
  }

  config.revision = Number(data.revision) || 0;
  config.lastSyncAt = new Date().toISOString();
  saveCloudConfig(config);
  renderCloudMeta(config);
  setCloudState("synced");
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

async function pushPendingSnapshot(queue, retryCount = 0) {
  const config = getCloudConfig();
  const snapshot = makeLocalSnapshot();
  const sentChangedAt = queue.changedAt || "";

  const data = await callGoogleApi({
    action: "push",
    force: false,
    baseRevision: Number(config.revision) || 0,
    updatedBy: "System V2.52 Fast Sync",
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
    saveCloudConfig(config);

    // Keep dirty state and retry exactly once with the merged snapshot.
    return pushPendingSnapshot(queue, retryCount + 1);
  }

  config.revision = Number(data.revision) || 0;
  config.lastSyncAt = new Date().toISOString();
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
  cloudApplyingRemote = true;
  try {
    localStorage.setItem("importSystemSettings", JSON.stringify(data.settings || {}));
    localStorage.setItem("importSystemProducts", JSON.stringify(data.products || []));
    localStorage.setItem("importSystemImports", JSON.stringify(data.imports || []));
    localStorage.setItem("importSystemBatches", JSON.stringify(data.batches || []));
  } finally {
    cloudApplyingRemote = false;
  }
  refreshSystemViewsAfterSync();
}

function refreshSystemViewsAfterSync() {
  [
    "renderDashboard",
    "renderProductList",
    "renderBatchSuggestions",
    "renderBatchList",
    "renderInventoryManagementList"
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
