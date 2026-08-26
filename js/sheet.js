const API_URL = window.LOVER_API_URL;
let rows = [];
let pendingRows = [];
let pendingSyncRunning = false;
let cloudLoadPromise = null;
const cloudLoadPromisesByMonth = new Map();
let lastCloudLoadAt = 0;
let initialCloudSyncFinished = false;
let initialCloudSyncPromise = null;
let localDataRevision = 0;
let revisionCheckPromise = null;
let settingsWritePromise = null;
let settingsWriteDepth = 0;
let yearLoadPromises = new Map();
let loadedCloudYears = new Set();
const localRowMutationAt = new Map();

const LOCAL_DATA_CACHE_KEY = "lover_sales_data_cache";
const LEGACY_LOCAL_DATA_CACHE_KEYS = [
  "lover_sales_data_cache_v95",
  "lover_sales_data_cache_v94",
  "lover_sales_data_cache_v93",
  "lover_sales_data_cache_v92"
];
const CLOUD_LOAD_COOLDOWN_MS = 20000;
const REVISION_CHECK_TIMEOUT_MS = 2500;
// V29.9: notification dispatch uses the existing keepalive transport.
// It is fire-and-forget after a successful business save, so OneSignal never
// blocks the Sales/Fair/Live save or cloud-sync path on mobile or desktop.
function getSalesLaunchUrlV194(){
  try{
    const url=new URL(window.location.href);
    url.hash="";
    url.search="";
    if(/\/index\.html$/i.test(url.pathname))url.pathname=url.pathname.replace(/index\.html$/i,"");
    else if(!url.pathname.endsWith("/"))url.pathname=url.pathname.replace(/[^/]+$/,"");
    return url.href;
  }catch(e){return "";}
}

function setLastNotificationDispatchStatus(result){
  try{
    const payload={
      at:new Date().toISOString(),
      ok:Boolean(result&&result.ok),
      result:result||null
    };
    localStorage.setItem("lover_sales_last_notification_dispatch_v180",JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent("lover-sales-notification-status",{detail:payload}));
  }catch(e){}
}

function dispatchSalesNotificationAsync(envelope){
  if(!envelope||!envelope.payload||!envelope.signature){
    setLastNotificationDispatchStatus({ok:true,skipped:true,message:"没有新的营业额变化，无需重复通知"});
    return;
  }

  const submitted=dispatchKeepalive({
    action:"dispatchSalesNotification",
    payload:envelope.payload,
    signature:envelope.signature,
    clientVersion:"24.1",
    launchUrl:getSalesLaunchUrlV194()
  });

  if(submitted){
    setLastNotificationDispatchStatus({ok:true,queued:true,attempted:1,sent:1,message:"通知已提交后台发送"});
  }else{
    setLastNotificationDispatchStatus({ok:false,message:"通知后台提交失败"});
  }
}



function applyLocalDataRevision(value) {
  const revision = Number(value || 0);
  if (Number.isFinite(revision) && revision >= 0) localDataRevision = revision;
  return localDataRevision;
}

function getLocalDataRevision() {
  return Number(localDataRevision || 0);
}

const PRIORITY_SYNC_CACHE_KEY_V315="lover_priority_sync_v315";
function getPrioritySyncLocalV315(){try{return JSON.parse(localStorage.getItem(PRIORITY_SYNC_CACHE_KEY_V315)||"{}")}catch(_){return{}}}
function setPrioritySyncLocalV315(v){try{localStorage.setItem(PRIORITY_SYNC_CACHE_KEY_V315,JSON.stringify(v||{}))}catch(_){}}
async function checkPriorityRevisionV315(timeoutMs=4500){return jsonp({action:"priorityRevisionV315"},{timeoutMs});}
function invalidateSalesCardCachesV315(){
  // V32.5: a newer sales-card revision must invalidate only in-memory/session data.
  // Keep the exact-context persistent cache as the last-known-good snapshot so
  // Sales/Fair/Live never flashes a fake blank/new card while cloud verification
  // is still running. loadProductLinksIntoEditorV206() paints this snapshot first
  // and then force-loads the authoritative cloud cards for the same context.
  try{salesProductLinksCacheV216.clear()}catch(_){}
  try{allSalesProductLinksCacheV216={links:null,at:0}}catch(_){}
}

async function checkCloudRevisionShared(timeoutMs = REVISION_CHECK_TIMEOUT_MS) {
  if (revisionCheckPromise) return revisionCheckPromise;
  revisionCheckPromise = jsonp(
    { action: "revisionCheck" },
    { timeoutMs: Number(timeoutMs || REVISION_CHECK_TIMEOUT_MS) }
  ).finally(() => { revisionCheckPromise = null; });
  return revisionCheckPromise;
}

async function loadMonthCloudShared(month, timeoutMs = 15000) {
  const key = /^\d{4}-\d{2}$/.test(String(month || "")) ? String(month) : new Date().toISOString().slice(0, 7);
  if (cloudLoadPromisesByMonth.has(key)) return cloudLoadPromisesByMonth.get(key);

  const request = jsonp(
    { action: "loadMonth", month: key },
    { timeoutMs: Number(timeoutMs || 15000) }
  ).finally(() => {
    if (cloudLoadPromisesByMonth.get(key) === request) cloudLoadPromisesByMonth.delete(key);
  });

  cloudLoadPromisesByMonth.set(key, request);
  return request;
}

/* V29.9: first paint must not wait for the full system render. */
let localCacheRenderedOnce = false;
let deferredFullRenderTimer = null;

function renderHomeFirst() {
  // V29.9: first paint must stay lightweight. Cloud merge performs dedupe later.
  if (typeof renderDashboard === "function") {
    renderDashboard();
  }

  if (typeof updateReadOnlyMode === "function") {
    updateReadOnlyMode();
  }
}

function scheduleDeferredFullRender(delay = 0) {
  if (deferredFullRenderTimer) return;

  const run = () => {
    deferredFullRenderTimer = null;
    if (typeof renderAll === "function") renderAll();
  };

  if (typeof requestIdleCallback === "function") {
    deferredFullRenderTimer = requestIdleCallback(run, { timeout: Math.max(300, delay + 300) });
  } else {
    deferredFullRenderTimer = setTimeout(run, Math.max(0, delay));
  }
}

function readLocalDataCacheRaw() {
  let raw = localStorage.getItem(LOCAL_DATA_CACHE_KEY);
  if (!raw) {
    for (const key of LEGACY_LOCAL_DATA_CACHE_KEYS) {
      raw = localStorage.getItem(key);
      if (raw) {
        localStorage.setItem(LOCAL_DATA_CACHE_KEY, raw);
        break;
      }
    }
  }
  return raw;
}

function loadLocalDataCache() {
  try {
    const raw = readLocalDataCacheRaw();
    if (!raw) return false;

    const cached = JSON.parse(raw);
    if (!cached || !Array.isArray(cached.rows)) {
      localStorage.removeItem(LOCAL_DATA_CACHE_KEY);
      return false;
    }

    rows = cached.rows;
    applyLocalDataRevision(cached.dataRevision);

    if (
      cached.commissionSettings &&
      typeof applyCommissionSettings === "function"
    ) {
      applyCommissionSettings(
        cached.commissionSettings
      );
    }

    if (
      cached.accessSettings &&
      typeof applyAccessPasswordSettings === "function"
    ) {
      applyAccessPasswordSettings(
        cached.accessSettings
      );
    }

    renderHomeFirst();
    localCacheRenderedOnce = true;
    scheduleDeferredFullRender(50);
    return true;
  } catch (err) {
    // V29.9: damaged/partial cache must never trap startup.
    try { localStorage.removeItem(LOCAL_DATA_CACHE_KEY); } catch (e) {}
    rows = [];
    return false;
  }
}

function loadLocalDataCacheAsync() {
  return new Promise(resolve => {
    const run = () => {
      let loaded = false;
      try { loaded = loadLocalDataCache(); } catch (err) { loaded = false; }
      resolve(loaded);
    };
    // Give the unlocked Home and logo one paint before reading/parsing cache.
    setTimeout(run, 0);
  });
}

function saveLocalDataCache(
  commissionSettings = null,
  accessSettings = null
) {
  try {
    localStorage.setItem(
      LOCAL_DATA_CACHE_KEY,
      JSON.stringify({
        rows,
        commissionSettings:
          commissionSettings ||
          (
            typeof getCommissionSettings === "function"
              ? getCommissionSettings()
              : null
          ),
        accessSettings:
          accessSettings ||
          (
            typeof getAccessPasswordSettings === "function"
              ? getAccessPasswordSettings()
              : null
          ),
        dataRevision: getLocalDataRevision(),
        savedAt: Date.now()
      })
    );
  } catch (err) {}
}

function loadPendingRows() {
  try {
    pendingRows = JSON.parse(localStorage.getItem("lover_pending_rows") || "[]");
  } catch (err) {
    pendingRows = [];
  }
}

function savePendingRows() {
  localStorage.setItem("lover_pending_rows", JSON.stringify(pendingRows));
}

function setPendingRetrySyncStatus() {
  loadPendingRows();
  if (pendingRows.length > 0) {
    setSync(`有 ${pendingRows.length} 笔未同步资料，系统会自动重试`, false, true);
  } else {
    setSync("已同步", true);
  }
}

function addPendingRow(row) {
  const key = syncKey(row);
  const index = pendingRows.findIndex(r => syncKey(r) === key);
  if (index >= 0) pendingRows[index] = row;
  else pendingRows.push(row);
  savePendingRows();
}

function clearPendingRow(row) {
  const key = syncKey(row);
  pendingRows = pendingRows.filter(r => syncKey(r) !== key);
  savePendingRows();
}

function setSync(text, good = false, error = false) {
  const el = document.getElementById("syncStatus");
  if (!el) return;

  if (error) {
    el.textContent = "🔴 " + text;
    return;
  }

  el.textContent = (good ? "🟢 " : "🟡 ") + text;

  if (good) {
    const last = document.getElementById("lastSync");
    if (last) last.textContent = "最后同步：" + nowText();
  }
}


function markCloudCheckPending(text = "本机资料已显示 · 云端后台同步中") {
  const el = document.getElementById("syncStatus");
  if (el) el.textContent = "🟡 " + text;
}

// V29.9: best-effort immediate cloud dispatch for mobile saves.
// The row stays in pendingRows until a normal JSONP confirmation succeeds, so
// closing/suspending the page cannot silently lose the user's entry.
function dispatchKeepalive(params) {
  try {
    const payload = {...params, _ts: Date.now()};
    const url = API_URL + "?" + new URLSearchParams(payload).toString();
    fetch(url, {method:"GET", mode:"no-cors", cache:"no-store", keepalive:true}).catch(()=>{});
    return true;
  } catch (err) {
    return false;
  }
}

function flushPendingRowsKeepalive() {
  try {
    loadPendingRows();

    const fairGroups=new Map();

    pendingRows.forEach(row => {
      if (row.type === "daily") {
        dispatchKeepalive({
          action:"saveDaily",
          date:row.date,
          company:row.company,
          amount:row.amount,
          clientUpdatedAt:row.clientUpdatedAt||"",
          notifyInline:"1",
          clientVersion:"24.1",
          launchUrl:getSalesLaunchUrlV194()
        });
      } else if (row.type === "live") {
        dispatchKeepalive({
          action:"saveLive",
          date:row.date,
          host:row.location,
          amount:row.amount,
          clientUpdatedAt:row.clientUpdatedAt||"",
          notifyInline:"1",
          clientVersion:"24.1",
          launchUrl:getSalesLaunchUrlV194()
        });
      } else if (row.type === "fair") {
        const loc=canonicalLocation(row.location);
        if(!fairGroups.has(loc))fairGroups.set(loc,[]);
        fairGroups.get(loc).push({
          date:row.date,
          amount:Number(row.amount||0),
          clientUpdatedAt:row.clientUpdatedAt||""
        });
      }
    });

    fairGroups.forEach((records,location)=>{
      dispatchKeepalive({
        action:"saveFairBatch",
        location,
        records:JSON.stringify(records),
        notifyInline:"1",
        clientVersion:"24.1",
        launchUrl:getSalesLaunchUrlV194()
      });
    });
  } catch (err) {}
}

window.addEventListener("pagehide", flushPendingRowsKeepalive);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flushPendingRowsKeepalive();
});

function jsonp(params, options = {}) {
  const timeoutMs = Number(options.timeoutMs || 15000);
  return new Promise((resolve, reject) => {
    const callback = "ll_cb_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
    params.callback = callback;
    params._ts = Date.now();

    const script = document.createElement("script");
    const query = new URLSearchParams(params).toString();

    const timer = setTimeout(() => {
      delete window[callback];
      script.remove();
      reject(new Error("连接 Google Apps Script 超时"));
    }, timeoutMs);

    window[callback] = data => {
      clearTimeout(timer);
      delete window[callback];
      script.remove();
      resolve(data);
    };

    script.onerror = () => {
      clearTimeout(timer);
      delete window[callback];
      script.remove();
      reject(new Error("无法连接 Google Apps Script"));
    };

    script.async = true;
    script.defer = true;
    script.src = API_URL + "?" + query;
    (document.head || document.body || document.documentElement).appendChild(script);
  });
}

function beginSettingsWrite() {
  settingsWriteDepth += 1;
}

function endSettingsWrite() {
  settingsWriteDepth = Math.max(0, settingsWriteDepth - 1);
}

function isSettingsWriteRunning() {
  return settingsWriteDepth > 0 || !!settingsWritePromise;
}

function runSettingsWrite(task) {
  const previous = settingsWritePromise || Promise.resolve();
  beginSettingsWrite();
  const current = previous
    .catch(() => {})
    .then(task)
    .finally(() => {
      endSettingsWrite();
      if (settingsWritePromise === current) settingsWritePromise = null;
    });
  settingsWritePromise = current;
  return current;
}

function rowMonthKey(row) {
  const iso = typeof displayToISO === "function" ? displayToISO(row && row.date) : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.slice(0, 7) : "";
}

function markLocalRowMutation(row, timestamp = Date.now()) {
  localRowMutationAt.set(syncKey(row), Number(timestamp) || Date.now());
}

function mergeCloudRowsSafely(existingRows, cloudRows, pending, requestStartedAt) {
  const protectedLocal = (existingRows || []).filter(row =>
    Number(localRowMutationAt.get(syncKey(row)) || 0) > Number(requestStartedAt || 0)
  );
  const combined = [...(cloudRows || []), ...protectedLocal, ...(pending || [])];
  return typeof dedupeRows === "function" ? dedupeRows(combined) : combined;
}

function mergeCloudMonthRows(month, cloudRows, requestStartedAt = 0) {
  const keep = rows.filter(row => rowMonthKey(row) !== month);
  const localForMonth = rows.filter(row => rowMonthKey(row) === month);
  const pendingForMonth = pendingRows.filter(row => rowMonthKey(row) === month);
  rows = [...keep, ...mergeCloudRowsSafely(localForMonth, cloudRows, pendingForMonth, requestStartedAt)];
}

function mergeCloudYearRows(year, cloudRows, requestStartedAt = 0) {
  const keep = rows.filter(row => !rowMonthKey(row).startsWith(year + "-"));
  const localForYear = rows.filter(row => rowMonthKey(row).startsWith(year + "-"));
  const pendingForYear = pendingRows.filter(row => rowMonthKey(row).startsWith(year + "-"));
  rows = [...keep, ...mergeCloudRowsSafely(localForYear, cloudRows, pendingForYear, requestStartedAt)];
}

async function loadYearInBackground(year) {
  const y = /^\d{4}$/.test(String(year || "")) ? String(year) : new Date().getFullYear().toString();
  if (loadedCloudYears.has(y)) return { ok:true, year:y, cached:true };
  if (yearLoadPromises.has(y)) return yearLoadPromises.get(y);

  const task = (async () => {
    const requestStartedAt = Date.now();
    if (isSettingsWriteRunning()) {
      if (settingsWritePromise) await settingsWritePromise.catch(() => {});
    }

    try {
      const json = await jsonp({ action: "loadYear", year: y }, { timeoutMs: 20000 });
      if (!json.ok) throw new Error(json.message || "读取全年资料失败");
      const fairDraftDirtyBeforeCloud = typeof fairInputsHaveUnsavedChanges === "function"
        ? fairInputsHaveUnsavedChanges()
        : false;
      loadPendingRows();
      mergeCloudYearRows(y, json.rows || [], requestStartedAt);
      if (json.systemState && typeof applySystemState === "function") applySystemState(json.systemState);
      if (json.commissionSettings) {
        if (typeof applyCloudCommissionSettings === "function") applyCloudCommissionSettings(json.commissionSettings);
        else if (typeof applyCommissionSettings === "function") applyCommissionSettings(json.commissionSettings);
      }
      if (json.accessSettings && typeof applyAccessPasswordSettings === "function") applyAccessPasswordSettings(json.accessSettings);
      renderHomeFirst();
      scheduleDeferredFullRender(0);
      // V29.9: if Fair is currently open, repaint its date inputs from the
      // newly merged cloud rows, unless the user has an unsaved Fair draft.
      const fairPageActive = !!document.getElementById("page-fair")?.classList.contains("active");
      if (fairPageActive && !fairDraftDirtyBeforeCloud && typeof refreshFairInputsFromRows === "function") {
        refreshFairInputsFromRows(true);
      }
      saveLocalDataCache(json.commissionSettings || null, json.accessSettings || null);
      loadedCloudYears.add(y);
      setSync("已同步", true);
      return { ok:true, year:y, rows:(json.rows || []).length };
    } catch (err) {
      console.warn("Full-year background refresh failed", err);
      return { ok:false, year:y, error:err };
    }
  })().finally(() => {
    yearLoadPromises.delete(y);
  });

  yearLoadPromises.set(y, task);
  return task;
}

function getActiveCloudLoadPromise() {
  return cloudLoadPromise;
}

function isInitialCloudSyncFinished() {
  return initialCloudSyncFinished;
}

function waitForInitialCloudSync() {
  return initialCloudSyncPromise || cloudLoadPromise || Promise.resolve();
}

function salesSyncDelay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function loadFromSheet(options = {}) {
  if (settingsWritePromise) {
    await settingsWritePromise.catch(() => {});
  }
  const force = options.force === true;
  const silent = options.silent === true;
  const suppressStartStatus = options.suppressStartStatus === true;
  const statusText = String(options.statusText || "").trim();
  const now = Date.now();
  if (cloudLoadPromise) return cloudLoadPromise;
  if (!force && options.bypassCooldown !== true && now - lastCloudLoadAt < CLOUD_LOAD_COOLDOWN_MS) {
    return initialCloudSyncPromise || Promise.resolve({ ok:true, skipped:true, cooldown:true });
  }
  lastCloudLoadAt = now;

  let completedSuccessfully = false;
  cloudLoadPromise = (async () => {
    loadPendingRows();
    const pendingCountAtStart = pendingRows.length;

    const hasLocalData = rows.length > 0
      ? true
      : loadLocalDataCache();
    if (!silent && !suppressStartStatus) {
      setSync(statusText || (hasLocalData ? "本机资料已显示 · 云端后台同步中" : "正在读取本月云端资料"));
    }

    try {
      const requestedMonth = /^\d{4}-\d{2}$/.test(String(options.month || ""))
        ? String(options.month)
        : "";
      const month = requestedMonth ||
        ((typeof selectedMonth === "function" && selectedMonth()) || new Date().toISOString().slice(0, 7));

      // V32.5: foreground priority sync checks ONLY turnover and sales-card revisions.
      // Profit/Top5/Report/old-month changes never delay normal Sales/Fair/Live work.
      if (!force && hasLocalData && options.skipRevisionCheck !== true) {
        try {
          const pr = await checkPriorityRevisionV315(Number(options.revisionTimeoutMs || 4500));
          if (pr && pr.ok) {
            const localPr=getPrioritySyncLocalV315();
            const cloudTurn=Number(pr.turnoverRevision||0), cloudCard=Number(pr.salesCardRevision||0);
            const localTurn=Number(localPr.turnoverRevision||0), localCard=Number(localPr.salesCardRevision||0);
            if(cloudCard!==localCard){ invalidateSalesCardCachesV315(); }
            setPrioritySyncLocalV315({turnoverRevision:cloudTurn,salesCardRevision:cloudCard,at:Date.now()});
            if(cloudTurn===localTurn){
              setSync("已同步", true);
              completedSuccessfully = true;
              return {ok:true,month,priorityOnly:true,turnoverRevision:cloudTurn,salesCardRevision:cloudCard};
            }
            // Turnover changed on another device: continue immediately to current-month load.
          } else {
            setSync("云端确认稍慢 · 可继续使用", false, false);
            completedSuccessfully = true;
            return {ok:true,month,revisionUnconfirmed:true};
          }
        } catch (revisionError) {
          setSync("云端确认稍慢 · 可继续使用", false, false);
          completedSuccessfully = true;
          return {ok:true,month,revisionUnconfirmed:true,error:revisionError};
        }
      }
      let json = null;
      let lastError = null;
      const requestStartedAt = Date.now();

      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          json = await loadMonthCloudShared(month, Number(options.timeoutMs || 15000));
          if (!json || !json.ok) throw new Error((json && json.message) || "读取失败");
          lastError = null;
          break;
        } catch (err) {
          lastError = err;
          if (attempt === 1) {
            if (!silent) setSync("首次连接较慢，正在重新连接云端...");
            await salesSyncDelay(1200);
          }
        }
      }

      if (lastError) throw lastError;

      const fairDraftDirtyBeforeCloud = typeof fairInputsHaveUnsavedChanges === "function"
        ? fairInputsHaveUnsavedChanges()
        : false;
      loadPendingRows();
      mergeCloudMonthRows(month, json.rows || [], requestStartedAt);
      applyLocalDataRevision(json.dataRevision);
      if (json.systemState && typeof applySystemState === "function") applySystemState(json.systemState);
      if (json.commissionSettings) {
        if (typeof applyCloudCommissionSettings === "function") applyCloudCommissionSettings(json.commissionSettings);
        else if (typeof applyCommissionSettings === "function") applyCommissionSettings(json.commissionSettings);
      }
      if (json.accessSettings && typeof applyAccessPasswordSettings === "function") applyAccessPasswordSettings(json.accessSettings);

      renderHomeFirst();
      scheduleDeferredFullRender(0);
      // V29.9: keep Fair's visible daily amount inputs consistent with rows after
      // cloud refresh. Do not overwrite any unsaved Fair edits.
      const fairPageActive = !!document.getElementById("page-fair")?.classList.contains("active");
      if (typeof refreshFairInputsFromRows === "function" && !fairDraftDirtyBeforeCloud && (fairPageActive || options.refreshFairInputs === true)) {
        refreshFairInputsFromRows(true);
      }
      saveLocalDataCache(json.commissionSettings || null, json.accessSettings || null);
      if(typeof refreshFairSessionsV281==="function"){try{await refreshFairSessionsV281({applyLatest:true,forceApply:false})}catch(_){}}
      setSync("已同步", true);
      completedSuccessfully = true;

      // Initial read has priority. Retry pending writes only after the latest
      // cloud month is visible, avoiding two simultaneous Apps Script calls.
      if (pendingCountAtStart > 0) {
        setTimeout(() => syncPendingRows().catch(() => {}), 50);
      }

      const year = month.slice(0, 4);

      // V29.9 mobile performance: startup loads only the selected month.
      // Full-year data is requested only when the user opens Monthly Summary.
      if (options.loadYear === true) {
        setTimeout(() => {
          loadYearInBackground(year).catch(() => {});
        }, 1400);
      }

      return { ok:true, month, refreshedAt:Date.now() };
    } catch (err) {
      if (!silent) {
        setSync(hasLocalData ? "已显示本机资料，云端稍后重试" : "同步失败：" + err.message, false, true);
      }
      return { ok:false, error:err };
    }
  })();

  if (!initialCloudSyncPromise) initialCloudSyncPromise = cloudLoadPromise;

  try {
    return await cloudLoadPromise;
  } finally {
    cloudLoadPromise = null;
    if (!initialCloudSyncFinished) {
      initialCloudSyncFinished = true;
      window.dispatchEvent(new CustomEvent("lover-sales-initial-sync-complete", {
        detail: { success: completedSuccessfully }
      }));
    }
  }
}

async function syncPendingRows() {
  if (pendingSyncRunning) return;
  pendingSyncRunning = true;

  try {
    loadPendingRows();

    if (pendingRows.length === 0) {
      if (initialCloudSyncFinished && !cloudLoadPromise) {
        setSync("已同步", true);
      }
      return;
    }

    setSync(`正在自动同步 ${pendingRows.length} 笔资料...`);

    const dailyRows = pendingRows.filter(r => r.type === "daily");
    const fairRows = pendingRows.filter(r => r.type === "fair");
    const liveRows = pendingRows.filter(r => r.type === "live");

    for (const row of dailyRows) {
      const saved = await saveDailyToSheet(
        row.date,
        row.company,
        row.amount,
        row.clientUpdatedAt || ""
      );
      if (saved) upsertLocalRow(saved);
      clearPendingRow(row);
    }

    const fairGroups = new Map();

    fairRows.forEach(row => {
      const loc = canonicalLocation(row.location);
      if (!fairGroups.has(loc)) fairGroups.set(loc, []);
      fairGroups.get(loc).push({
        date: row.date,
        amount: Number(row.amount || 0),
        clientUpdatedAt: row.clientUpdatedAt || ""
      });
    });

    for (const row of liveRows) {
      const saved = await saveLiveToSheet(
        row.date,
        row.location,
        row.amount,
        row.clientUpdatedAt || ""
      );
      if (saved && Number(saved.amount) > 0) upsertLocalRow(saved);
      else rows = rows.filter(x => syncKey(x) !== syncKey(row));
      clearPendingRow(row);
    }

    for (const [location, records] of fairGroups.entries()) {
      const result = await saveFairBatchToSheet(location, records);

      if (result && Array.isArray(result.rows)) {
        result.rows.forEach(r => {
          if (Number(r.amount) <= 0) {
            rows = rows.filter(x => syncKey(x) !== syncKey(r));
          } else {
            upsertLocalRow(r);
          }
        });
      }

      records.forEach(item => {
        clearPendingRow({
          type: "fair",
          date: item.date,
          company: "belimbing",
          location
        });
      });
    }

    renderAll();
    saveLocalDataCache();
    setSync("已同步", true);
  } catch (err) {
    setPendingRetrySyncStatus();
  } finally {
    pendingSyncRunning = false;
  }
}

async function saveSalesProductLinkV203(payload) {
  const json = await jsonp({
    action: "saveSalesProductLink",
    ...payload
  }, { timeoutMs: 20000 });
  if (!json.ok) throw new Error(json.message || "盆栽资料保存失败");
  return json.link || null;
}

async function loadPendingInventorySalesCardsV250() {
  const json = await jsonp({ action:"getPendingInventorySalesCardsV250" }, { timeoutMs:20000 });
  if (!json.ok) throw new Error(json.message || "读取库存待处理记录失败");
  return Array.isArray(json.items) ? json.items : [];
}

async function confirmSalesCardInventoryV249(payload) {
  const json = await jsonp({ action:"confirmSalesCardInventoryV249", ...payload }, { timeoutMs:20000 });
  if (!json.ok) throw new Error(json.message || "库存确认状态保存失败");
  return json;
}

async function saveSalesProductLinksV206(items, saveMode="confirm") {
  const json = await jsonp({ action:"saveSalesProductLinks", itemsJson:JSON.stringify(items||[]), saveMode:String(saveMode||"confirm") }, { timeoutMs:30000 });
  if (!json.ok) throw new Error(json.message || "盆栽资料保存失败");
  if(json.salesCardRevision!==undefined){const p=getPrioritySyncLocalV315();setPrioritySyncLocalV315({...p,salesCardRevision:Number(json.salesCardRevision||0),at:Date.now()})}
  const first=Array.isArray(items)&&items.length?items[0]:null;
  if(first&&first.type&&first.date&&first.location){
    mergeDailyProfitContextCacheV237(first.type,first.date,first.location,Array.isArray(json.links)?json.links:items);
  }
  return json;
}



/* ================= V29.9 Profit / Change Log persistent cache ================= */
const PROFIT_CACHE_KEY_V237="lover_daily_profit_cache_v237";
const CHANGE_LOG_CACHE_KEY_V237="lover_sales_change_log_cache_v237";
const VIEW_CACHE_MAX_AGE_V237=30*24*60*60*1000;

function readViewCacheMapV237(key){
  try{
    const raw=localStorage.getItem(key);
    const obj=raw?JSON.parse(raw):{};
    return obj&&typeof obj==="object"?obj:{};
  }catch(e){return{}}
}
function writeViewCacheMapV237(key,obj){
  try{localStorage.setItem(key,JSON.stringify(obj||{}))}catch(e){}
}
function viewCacheKeyV237(type,date){
  return [String(type||""),String(date||"")].join("|");
}
function getDailyProfitCacheV237(type,date){
  const all=readViewCacheMapV237(PROFIT_CACHE_KEY_V237),rec=all[viewCacheKeyV237(type,date)];
  if(!rec||!Array.isArray(rec.links))return null;
  if(rec.at&&Date.now()-Number(rec.at)>VIEW_CACHE_MAX_AGE_V237)return null;
  return rec.links;
}
function setDailyProfitCacheV237(type,date,links){
  const all=readViewCacheMapV237(PROFIT_CACHE_KEY_V237);
  all[viewCacheKeyV237(type,date)]={at:Date.now(),links:Array.isArray(links)?links:[]};
  writeViewCacheMapV237(PROFIT_CACHE_KEY_V237,all);
}
function mergeDailyProfitContextCacheV237(type,date,location,links){
  const current=getDailyProfitCacheV237(type,date)||[];
  const key=String(location||"").trim().toLowerCase();
  const merged=current.filter(x=>String(x.location||"").trim().toLowerCase()!==key)
    .concat(Array.isArray(links)?links:[]);
  setDailyProfitCacheV237(type,date,merged);
}
function clearDailyProfitCacheV237(type,date){
  const all=readViewCacheMapV237(PROFIT_CACHE_KEY_V237);
  if(type&&date)delete all[viewCacheKeyV237(type,date)];
  else Object.keys(all).forEach(k=>delete all[k]);
  writeViewCacheMapV237(PROFIT_CACHE_KEY_V237,all);
}
function getSalesChangeLogCacheV237(type,date){
  const all=readViewCacheMapV237(CHANGE_LOG_CACHE_KEY_V237),rec=all[viewCacheKeyV237(type,date)];
  if(!rec||!Array.isArray(rec.logs))return null;
  if(rec.at&&Date.now()-Number(rec.at)>VIEW_CACHE_MAX_AGE_V237)return null;
  return rec.logs;
}
function setSalesChangeLogCacheV237(type,date,logs){
  const all=readViewCacheMapV237(CHANGE_LOG_CACHE_KEY_V237);
  all[viewCacheKeyV237(type,date)]={at:Date.now(),logs:Array.isArray(logs)?logs:[]};
  writeViewCacheMapV237(CHANGE_LOG_CACHE_KEY_V237,all);
}
function clearSalesChangeLogCacheV237(type,date){
  const all=readViewCacheMapV237(CHANGE_LOG_CACHE_KEY_V237);
  if(type&&date)delete all[viewCacheKeyV237(type,date)];
  else Object.keys(all).forEach(k=>delete all[k]);
  writeViewCacheMapV237(CHANGE_LOG_CACHE_KEY_V237,all);
}

const SALES_CARD_PERSIST_CACHE_KEY_V232="lover_sales_card_links_cache_v232";
const SALES_CARD_PERSIST_CACHE_MAX_AGE_V232=30*24*60*60*1000;

function readSalesCardPersistentCacheV232(){
  try{
    const raw=localStorage.getItem(SALES_CARD_PERSIST_CACHE_KEY_V232);
    const obj=raw?JSON.parse(raw):{};
    return obj&&typeof obj==="object"?obj:{};
  }catch(e){ return {}; }
}
function writeSalesCardPersistentCacheV232(obj){
  try{ localStorage.setItem(SALES_CARD_PERSIST_CACHE_KEY_V232,JSON.stringify(obj||{})); }catch(e){}
}
function salesCardPersistentKeyV232(type,date,location){
  return [String(type||""),String(date||""),String(location||"").trim().toLowerCase()].join("|");
}
function getSalesCardPersistentCacheV232(type,date,location){
  const all=readSalesCardPersistentCacheV232();
  const rec=all[salesCardPersistentKeyV232(type,date,location)];
  if(!rec||!Array.isArray(rec.links))return null;
  if(rec.at&&Date.now()-Number(rec.at)>SALES_CARD_PERSIST_CACHE_MAX_AGE_V232)return null;
  return rec.links;
}
function setSalesCardPersistentCacheV232(type,date,location,links){
  const all=readSalesCardPersistentCacheV232();
  all[salesCardPersistentKeyV232(type,date,location)]={at:Date.now(),links:Array.isArray(links)?links:[]};
  writeSalesCardPersistentCacheV232(all);
}
function clearSalesCardPersistentCacheV232(type,date,location){
  const all=readSalesCardPersistentCacheV232();
  if(type&&date&&location)delete all[salesCardPersistentKeyV232(type,date,location)];
  else Object.keys(all).forEach(k=>delete all[k]);
  writeSalesCardPersistentCacheV232(all);
}

const salesProductLinksCacheV216 = new Map();
const salesProductLinksPendingV216 = new Map();
function salesProductLinksCacheKeyV216(type,date,location){
  return [String(type||""),String(date||""),String(location||"").trim().toLowerCase()].join("|");
}
function getCachedSalesProductLinksV216(type,date,location){
  const key=salesProductLinksCacheKeyV216(type,date,location);
  const rec=salesProductLinksCacheV216.get(key);
  if(rec)return rec.links;
  const persistent=getSalesCardPersistentCacheV232(type,date,location);
  if(Array.isArray(persistent)){
    salesProductLinksCacheV216.set(key,{links:persistent,at:Date.now(),source:"persistent"});
    return persistent;
  }
  return null;
}
function getSessionSalesProductLinksCacheV244(type,date,location){
  const rec=salesProductLinksCacheV216.get(salesProductLinksCacheKeyV216(type,date,location));
  if(!rec||rec.source==="persistent")return null;
  return Array.isArray(rec.links)?rec.links:null;
}
function setCachedSalesProductLinksV216(type,date,location,links){
  const safe=Array.isArray(links)?links:[];
  salesProductLinksCacheV216.set(salesProductLinksCacheKeyV216(type,date,location),{links:safe,at:Date.now(),source:"session"});
  setSalesCardPersistentCacheV232(type,date,location,safe);
  return safe;
}
async function loadSalesProductLinksV206(type,date,location,options={}) {
  const key=salesProductLinksCacheKeyV216(type,date,location);
  const cached=salesProductLinksCacheV216.get(key);
  const maxAge=Number(options.maxAgeMs??120000);
  if(!options.force&&cached&&Date.now()-cached.at<maxAge)return cached.links;
  if(salesProductLinksPendingV216.has(key))return salesProductLinksPendingV216.get(key);
  const pending=(async()=>{
    const json=await jsonp({action:"getSalesProductLinks",type,date,location},{timeoutMs:12000});
    if(!json.ok)throw new Error(json.message||"读取盆栽关联资料失败");
    return setCachedSalesProductLinksV216(type,date,location,Array.isArray(json.links)?json.links:[]);
  })().finally(()=>salesProductLinksPendingV216.delete(key));
  salesProductLinksPendingV216.set(key,pending);
  return pending;
}

async function deleteSalesProductLinkV206(linkId) {
  const json = await jsonp({ action:"deleteSalesProductLink", linkId }, { timeoutMs:20000 });
  if (!json.ok) throw new Error(json.message || "删除盆栽关联失败");
  salesProductLinksCacheV216.clear();
  allSalesProductLinksCacheV216={links:null,at:0};
  clearDailyProfitCacheV237();
  if(Array.isArray(json.links)&&json.links.length){
    const first=json.links[0];
    setSalesCardPersistentCacheV232(first.type,first.date,first.location,json.links);
  }else{
    clearSalesCardPersistentCacheV232();
  }
  return json;
}

let allSalesProductLinksCacheV216={links:null,at:0};
let allSalesProductLinksPendingV216=null;

// V32.5: keep already-loaded profit rollup data current when a Draft is saved.
// Only patch the cache when it already represents a complete getAll result; if it
// has never been loaded, leave it null so the next profit query still fetches all rows.
function mergeAllSalesProductLinksCacheV321(savedLinks, replaceTransactionIds=[]){
  if(!Array.isArray(allSalesProductLinksCacheV216.links))return null;
  const incoming=(Array.isArray(savedLinks)?savedLinks:[]).filter(x=>!['deleted','cancelled'].includes(String(x?.status||'active').toLowerCase()));
  const txnIds=new Set((Array.isArray(replaceTransactionIds)?replaceTransactionIds:[]).map(String).filter(Boolean));
  incoming.forEach(x=>{const id=String(x?.transactionId||'').trim();if(id)txnIds.add(id)});
  const linkIds=new Set(incoming.map(x=>String(x?.linkId||'').trim()).filter(Boolean));
  const kept=allSalesProductLinksCacheV216.links.filter(x=>{
    const txn=String(x?.transactionId||'').trim(),link=String(x?.linkId||'').trim();
    if(txn&&txnIds.has(txn))return false;
    if(link&&linkIds.has(link))return false;
    return !['deleted','cancelled'].includes(String(x?.status||'active').toLowerCase());
  });
  allSalesProductLinksCacheV216={links:[...kept,...incoming],at:Date.now()};
  return allSalesProductLinksCacheV216.links;
}
window.mergeAllSalesProductLinksCacheV321=mergeAllSalesProductLinksCacheV321;

async function loadAllSalesProductLinksV203(options={}) {
  const maxAge=Number(options.maxAgeMs??120000);
  if(!options.force&&Array.isArray(allSalesProductLinksCacheV216.links)&&Date.now()-allSalesProductLinksCacheV216.at<maxAge)return allSalesProductLinksCacheV216.links;
  if(allSalesProductLinksPendingV216)return allSalesProductLinksPendingV216;
  allSalesProductLinksPendingV216=(async()=>{
    const json=await jsonp({action:"getAllSalesProductLinks"},{timeoutMs:12000});
    if(!json.ok)throw new Error(json.message||"读取盆栽关联资料失败");
    const links=Array.isArray(json.links)?json.links:[];
    allSalesProductLinksCacheV216={links,at:Date.now()};
    return links;
  })().finally(()=>{allSalesProductLinksPendingV216=null;});
  return allSalesProductLinksPendingV216;
}

async function loadSalesChangeLogFromSheetV200(type, date, options={}) {
  if(!options.force){
    const cached=getSalesChangeLogCacheV237(type,date);
    if(Array.isArray(cached))return{ok:true,logs:cached,fromCache:true};
  }
  const json = await jsonp({
    action: "getSalesChangeLog",
    type,
    date
  }, { timeoutMs: 15000 });
  if (!json.ok) throw new Error(json.message || "读取新增 / 修改记录失败");
  setSalesChangeLogCacheV237(type,date,Array.isArray(json.logs)?json.logs:[]);
  return json;
}

async function loadAllSalesChangeLogsV236() {
  const json = await jsonp({ action:"getAllSalesChangeLogs" }, { timeoutMs:30000 });
  if (!json.ok) throw new Error(json.message || "读取新增 / 修改历史失败");
  return Array.isArray(json.logs) ? json.logs : [];
}

async function saveDailyToSheet(date, company, amount, clientUpdatedAt = "") {
  const json = await jsonp({
    action: "saveDaily",
    date,
    company,
    amount,
    clientUpdatedAt
  });

  if (!json.ok) throw new Error(json.message || "储存失败");
  applyLocalDataRevision(json.dataRevision);
  if(json.turnoverRevision!==undefined){const p=getPrioritySyncLocalV315();setPrioritySyncLocalV315({...p,turnoverRevision:Number(json.turnoverRevision||0),at:Date.now()})}
  dispatchSalesNotificationAsync(json.notificationEnvelope);
  return json.row || null;
}

async function saveFairSessionToSheetV281(location,start,end){
  const json=await jsonp({action:"saveFairSessionV281",location,start,end});
  if(!json.ok)throw new Error(json.message||"Fair 活动资料储存失败");
  applyLocalDataRevision(json.dataRevision);
  return json;
}
async function loadFairSessionsFromSheetV281(){
  const json=await jsonp({action:"getFairSessionsV281"});
  if(!json.ok)throw new Error(json.message||"读取 Fair 活动资料失败");
  if(json.dataRevision!==undefined)applyLocalDataRevision(json.dataRevision);
  return json;
}

async function saveFairBatchToSheet(location, records) {
  const json = await jsonp({
    action: "saveFairBatch",
    location,
    records: JSON.stringify(records)
  });

  if (!json.ok) throw new Error(json.message || "Fair 储存失败");
  applyLocalDataRevision(json.dataRevision);
  if(json.turnoverRevision!==undefined){const p=getPrioritySyncLocalV315();setPrioritySyncLocalV315({...p,turnoverRevision:Number(json.turnoverRevision||0),at:Date.now()})}
  dispatchSalesNotificationAsync(json.notificationEnvelope);
  (Array.isArray(records)?records:[]).forEach(r=>{
    if(r&&r.date)Promise.resolve(loadSalesChangeLogFromSheetV200("fair",r.date,{force:true})).catch(()=>{});
  });
  return json;
}

async function saveFairSingleToSheet(date, location, amount, clientUpdatedAt = "") {
  return saveFairBatchToSheet(location, [{
    date,
    amount,
    clientUpdatedAt
  }]);
}

async function saveFairToSheet(location, records) {
  return saveFairBatchToSheet(location, records);
}


async function saveLiveToSheet(date, host, amount, clientUpdatedAt = "") {
  const json = await jsonp({
    action: "saveLive",
    date,
    host,
    amount,
    clientUpdatedAt
  });
  if (!json.ok) throw new Error(json.message || "Live 储存失败");
  applyLocalDataRevision(json.dataRevision);
  if(json.turnoverRevision!==undefined){const p=getPrioritySyncLocalV315();setPrioritySyncLocalV315({...p,turnoverRevision:Number(json.turnoverRevision||0),at:Date.now()})}
  dispatchSalesNotificationAsync(json.notificationEnvelope);
  Promise.resolve(loadSalesChangeLogFromSheetV200("live",date,{force:true})).catch(()=>{});
  return json.row || null;
}

async function saveCommissionSettingsToSheet(settings, targetMonth = "") {
  return runSettingsWrite(async () => {
    const json = await jsonp({
      action: "saveCommissionSettings",
      rate1: settings.rate1,
      rate2: settings.rate2,
      rate3: settings.rate3,
      liveHostRates: JSON.stringify(settings.liveHostRates || {}),
      liveHosts: JSON.stringify(settings.liveHosts || {}),
      inactiveLiveHosts: JSON.stringify(settings.inactiveLiveHosts || {}),
      liveRateSchedules: JSON.stringify(settings.liveRateSchedules || []),
      fairRevision: Number(settings.fairRevision || 0),
      liveRevision: Number(settings.liveRevision || 0),
      targetMonth: targetMonth || ""
    }, { timeoutMs: 20000 });
    if (!json.ok) throw new Error(json.message || "佣金设置储存失败");
    applyLocalDataRevision(json.dataRevision);
    return json.commissionSettings || null;
  });
}

async function saveCommissionFastRequest_(action, settings, targetMonth = "") {
  const params = {
    action,
    rate1: settings.rate1,
    rate2: settings.rate2,
    rate3: settings.rate3,
    liveHostRates: JSON.stringify(settings.liveHostRates || {}),
    liveHosts: JSON.stringify(settings.liveHosts || {}),
    inactiveLiveHosts: JSON.stringify(settings.inactiveLiveHosts || {}),
    liveRateSchedules: JSON.stringify(settings.liveRateSchedules || []),
    fairRevision: Number(settings.fairRevision || 0),
    liveRevision: Number(settings.liveRevision || 0),
    targetMonth: targetMonth || ""
  };

  try {
    const json = await jsonp(params, { timeoutMs: 4500 });
    if (!json.ok) throw new Error(json.message || "佣金设置储存失败");
    applyLocalDataRevision(json.dataRevision);
    return json.commissionSettings || null;
  } catch (firstError) {
    await new Promise(resolve => setTimeout(resolve, 350));
    const json = await jsonp(params, { timeoutMs: 5500 });
    if (!json.ok) throw new Error(json.message || firstError.message || "佣金设置储存失败");
    applyLocalDataRevision(json.dataRevision);
    return json.commissionSettings || null;
  }
}

async function saveFairCommissionSettingsToSheet(settings, targetMonth = "") {
  return runSettingsWrite(() =>
    saveCommissionFastRequest_("saveFairCommissionFast", settings, targetMonth)
  );
}

async function saveLiveCommissionSettingsToSheet(settings, targetMonth = "") {
  return runSettingsWrite(() =>
    saveCommissionFastRequest_("saveLiveCommissionFast", settings, targetMonth)
  );
}

async function resetCommissionSettingsInSheet() {
  const json = await jsonp({ action: "resetCommissionSettings" });
  if (!json.ok) throw new Error(json.message || "恢复默认值失败");
  applyLocalDataRevision(json.dataRevision);
  return json.commissionSettings || null;
}

setInterval(() => {
  loadPendingRows();
  if (pendingRows.length > 0) syncPendingRows();
}, 30000);

window.addEventListener("online", () => {
  loadPendingRows();
  if (pendingRows.length > 0) syncPendingRows();
});


async function closeMonthInSheet(month){const json=await jsonp({action:"closeMonth",month});if(!json.ok)throw new Error(json.message||"月底结算失败");return json}
async function closeYearInSheet(year){const json=await jsonp({action:"closeYear",year},{timeoutMs:180000});if(!json.ok)throw new Error(json.message||"年底结算失败");return json}
async function restoreBackupToSheet(payload,onProgress=()=>{}){
  const raw=JSON.stringify(payload);
  const id="restore_"+Date.now()+"_"+Math.floor(Math.random()*100000);
  const chunkSize=3200,total=Math.ceil(raw.length/chunkSize);

  onProgress({stage:"upload",message:"正在准备 Restore...",restoreId:id});
  let result=await jsonp({action:"restoreBegin",restoreId:id,totalChunks:total},{timeoutMs:45000});
  if(!result.ok)throw new Error(result.message||"无法开始恢复");

  for(let i=0;i<total;i++){
    onProgress({stage:"upload",message:`正在上传 Backup ${i+1}/${total}...`,restoreId:id});
    result=await jsonp({action:"restoreChunk",restoreId:id,index:i,data:raw.slice(i*chunkSize,(i+1)*chunkSize)},{timeoutMs:45000});
    if(!result.ok)throw new Error(result.message||`恢复区块 ${i+1} 失败`);
  }

  onProgress({stage:"start",message:"正在建立 Restore 工作...",restoreId:id});
  result=await jsonp({action:"restoreJobStart",restoreId:id},{timeoutMs:90000});
  if(!result.ok)throw new Error(result.message||"无法建立 Restore 工作");

  const jobId=String(result.jobId||id);
  onProgress({stage:"job",message:result.message||"Restore 已开始",restoreId:id,jobId,status:result});

  for(let safety=0;safety<500;safety++){
    await new Promise(resolve=>setTimeout(resolve,1200));
    let status=await jsonp({action:"restoreJobStatus",jobId},{timeoutMs:30000});
    if(!status.ok)throw new Error(status.message||"无法读取 Restore 状态");
    onProgress({stage:"job",message:status.message||"Restore 进行中",restoreId:id,jobId,status});

    if(status.state==="success")return status;
    if(status.state==="failed")throw new Error(status.error||status.message||"Restore 失败");

    // Each step is deliberately small. If this request times out, status remains on server
    // and the next page open can continue/resume safely.
    try{
      const step=await jsonp({action:"restoreJobStep",jobId},{timeoutMs:90000});
      if(step&&step.ok){
        onProgress({stage:"job",message:step.message||"Restore 进行中",restoreId:id,jobId,status:step});
        if(step.state==="success")return step;
        if(step.state==="failed")throw new Error(step.error||step.message||"Restore 失败");
      }
    }catch(e){
      // Do not declare failure on one transient timeout; query persisted status next loop.
      console.warn("Restore step temporary error",e);
    }
  }
  throw new Error("Restore 工作未在预期时间内完成，请重新打开系统查看 Restore 状态。");
}

async function getRestoreJobStatusV234(jobId){
  return jsonp({action:"restoreJobStatus",jobId},{timeoutMs:30000});
}
async function continueRestoreJobV234(jobId){
  return jsonp({action:"restoreJobStep",jobId},{timeoutMs:90000});
}


async function loadAccessSettingsFromSheet() {
  const json = await jsonp({ action: "loadAccessSettings" });
  if (!json.ok) throw new Error(json.message || "读取密码设置失败");
  return json.accessSettings || null;
}

async function saveAccessSettingsToSheet(settings) {
  return runSettingsWrite(async () => {
    const json = await jsonp({
      action: "saveAccessSettings",
      accessPasswordHash: settings.accessPasswordHash,
      accessPasswordHint: settings.accessPasswordHint
    }, { timeoutMs: 20000 });
    if (!json.ok) throw new Error(json.message || "密码设置同步失败");
    return json.accessSettings || null;
  });
}


async function verifyAccessBackendVersion() {
  const json = await jsonp({
    action: "accessVersion"
  });

  if (!json.ok ||
      json.accessSettingsSupported !== true) {
    throw new Error(
      "Google Apps Script 密码功能未部署"
    );
  }

  return json;
}
// V29.9 stable API alias: UI save function must never shadow the transport function.
async function deleteSalesTransactionV256(saleId){
  const json=await jsonp({action:"deleteSalesTransaction",saleId:String(saleId||"")},{timeoutMs:20000});
  if(!json.ok)throw new Error(json.error||"删除销售卡失败");
  // V29.9: deleted cards must disappear from profit/editor caches immediately.
  salesProductLinksCacheV216.clear();
  allSalesProductLinksCacheV216={links:null,at:0};
  clearDailyProfitCacheV237();
  clearSalesCardPersistentCacheV232();
  return json;
}
window.deleteSalesTransactionV256=deleteSalesTransactionV256;

window.saveSalesProductLinksApiV241=saveSalesProductLinksV206;
