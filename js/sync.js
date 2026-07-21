const CLOUD_CONFIG_KEY = "importSystemCloudConfig";
const DEFAULT_GOOGLE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyQ75Ug_K0bS9Wq_CHxr6XBhuLgRlokvDsSGH_Wzip9wYyIKA2HYVea3ZSv5vmjzrdr/exec";

let cloudSyncBusy = false;
let cloudApplyingRemote = false;
let cloudInitialPullComplete = false;
let cloudLocalDirty = false;
let cloudSyncTimer = null;

function getCloudConfig() {
  const saved = loadJSON(CLOUD_CONFIG_KEY, {});

  return {
    url: DEFAULT_GOOGLE_SCRIPT_URL,
    revision: Number(saved.revision) || 0,
    lastSyncAt: saved.lastSyncAt || ""
  };
}

function saveCloudConfig(config) {
  saveJSON(CLOUD_CONFIG_KEY, {
    url: DEFAULT_GOOGLE_SCRIPT_URL,
    revision: Number(config.revision) || 0,
    lastSyncAt: config.lastSyncAt || ""
  });
}

function isApplyingGoogleData() {
  return cloudApplyingRemote;
}

function setupCloudSync() {
  renderCloudMeta(getCloudConfig());
  setCloudState("syncing");

  // Open the system: read Google once so every device starts with current data.
  // After that, idle use does not repeatedly sync.
  window.setTimeout(() => {
    pullFromGoogleAutomatically({ reloadWhenChanged: true });
  }, 20);

  // Network recovery only retries an unsaved local change.
  window.addEventListener("online", () => {
    if (cloudLocalDirty) {
      scheduleGoogleSync(20);
    }
  });
}

async function callGoogleApi(payload) {
  const response = await fetch(DEFAULT_GOOGLE_SCRIPT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Google connection failed (${response.status})`);
  }

  const data = await response.json();

  if (!data.ok) {
    throw new Error(data.error || "Google sync failed");
  }

  return data;
}

function makeLocalSnapshot() {
  return {
    settings: loadJSON("importSystemSettings", {}),
    products: getProducts(),
    imports: getImports(),
    batches: getBatches()
  };
}

function normalizeForComparison(value) {
  return JSON.stringify(value ?? null);
}

function remoteDiffersFromLocal(data) {
  const local = makeLocalSnapshot();

  return (
    normalizeForComparison(data.settings || {}) !==
      normalizeForComparison(local.settings || {}) ||
    normalizeForComparison(data.products || []) !==
      normalizeForComparison(local.products || []) ||
    normalizeForComparison(data.imports || []) !==
      normalizeForComparison(local.imports || []) ||
    normalizeForComparison(data.batches || []) !==
      normalizeForComparison(local.batches || [])
  );
}

function applyRemoteData(data) {
  cloudApplyingRemote = true;

  try {
    saveJSON("importSystemSettings", data.settings || {});
    saveProducts(data.products || []);
    saveImports(data.imports || []);
    saveBatches(data.batches || []);
  } finally {
    cloudApplyingRemote = false;
  }
}

async function pullFromGoogleAutomatically(options = {}) {
  if (cloudSyncBusy || cloudLocalDirty) return;

  const { reloadWhenChanged = false } = options;

  cloudSyncBusy = true;
  setCloudState("syncing");

  try {
    const data = await callGoogleApi({ action: "pull" });
    const changed = remoteDiffersFromLocal(data);

    if (changed) {
      applyRemoteData(data);
    }

    const config = getCloudConfig();
    config.revision = Number(data.revision) || 0;
    config.lastSyncAt = new Date().toISOString();
    saveCloudConfig(config);

    cloudInitialPullComplete = true;
    cloudLocalDirty = false;
    renderCloudMeta(config);
    setCloudState("synced");

    if (changed && reloadWhenChanged) {
      window.setTimeout(() => window.location.reload(), 50);
    }
  } catch (error) {
    cloudInitialPullComplete = true;
    setCloudState("failed");
    console.error("Automatic Google pull failed:", error);
  } finally {
    cloudSyncBusy = false;
  }
}

function scheduleGoogleSync(delay = 40) {
  if (cloudApplyingRemote) return;

  cloudLocalDirty = true;
  setCloudState("syncing");

  if (!cloudInitialPullComplete) {
    return;
  }

  window.clearTimeout(cloudSyncTimer);
  cloudSyncTimer = window.setTimeout(() => {
    pushToGoogleAutomatically();
  }, delay);
}

async function pushToGoogleAutomatically() {
  if (cloudSyncBusy || !cloudLocalDirty) return;

  cloudSyncBusy = true;
  setCloudState("syncing");

  try {
    const config = getCloudConfig();
    const snapshot = makeLocalSnapshot();

    const data = await callGoogleApi({
      action: "push",
      force: false,
      baseRevision: Number(config.revision) || 0,
      updatedBy: "System",
      settings: snapshot.settings,
      products: snapshot.products,
      imports: snapshot.imports,
      batches: snapshot.batches
    });

    config.revision = Number(data.revision) || 0;
    config.lastSyncAt = new Date().toISOString();
    saveCloudConfig(config);

    cloudLocalDirty = false;
    renderCloudMeta(config);
    setCloudState("synced");
  } catch (error) {
    // Revision protection remains active in the backend.
    // On conflict or network failure, Google data is never force-overwritten.
    setCloudState("failed");
    console.error("Automatic Google push failed:", error);
  } finally {
    cloudSyncBusy = false;
  }
}

function renderCloudMeta(config = getCloudConfig()) {
  const lastSyncEl = document.getElementById("googleLastSync");

  if (!lastSyncEl) return;

  if (!config.lastSyncAt) {
    lastSyncEl.textContent = "尚未同步";
    return;
  }

  const date = new Date(config.lastSyncAt);

  lastSyncEl.textContent = date
    .toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    })
    .replaceAll("/", "-");
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
    return;
  }

  if (state === "failed") {
    element.classList.add("failed");
    if (icon) icon.textContent = "!";
    if (text) text.textContent = "同步失败，请检查网络";
    return;
  }

  element.classList.add("syncing");
  if (icon) icon.textContent = "↻";
  if (text) text.textContent = "同步中...";
}
