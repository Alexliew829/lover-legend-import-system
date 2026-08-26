(() => {
  const RELOAD_FLAG = "lover_sales_sw_reloaded_v129";
  const REFRESH_COOLDOWN_MS = 5000;
  const AUTO_REFRESH_MS = 300000;
  let lastCloudRefresh = 0;
  let refreshPromise = null;
  let initialSyncReady = typeof isInitialCloudSyncFinished === "function" && isInitialCloudSyncFinished();
  let autoRefreshStartTimer = null;
  let autoRefreshInterval = null;
  let hiddenAt = 0;
  let resumePromise = null;
  let lastResumeAt = 0;

  function activeLoadPromise() {
    return typeof getActiveCloudLoadPromise === "function"
      ? getActiveCloudLoadPromise()
      : null;
  }

  async function refreshCloudData(reason = "resume", force = false) {
    if (typeof loadFromSheet !== "function") return { ok:false, error:new Error("同步模块尚未载入") };

    const manual = reason === "pull-down";

    // 手动下拉刷新必须在现有同步结束后，再执行一次真正的强制云端读取。
    // 自动触发则直接共用正在执行的 Promise，避免重复请求。
    const running = activeLoadPromise() || refreshPromise;
    if (running) {
      if (!manual) return running;
      try { await running; } catch (err) {}
    }

    if (!initialSyncReady) {
      const initial = typeof waitForInitialCloudSync === "function"
        ? waitForInitialCloudSync()
        : null;
      if (initial) {
        try { await initial; } catch (err) {}
      }
      initialSyncReady = true;
    }

    const now = Date.now();
    if (!manual && now - lastCloudRefresh < REFRESH_COOLDOWN_MS) {
      return { ok:true, skipped:true };
    }

    lastCloudRefresh = now;
    refreshPromise = loadFromSheet({
      force: manual || force === true,
      bypassCooldown: reason.includes("reopen") || reason.includes("resume"),
      skipLocalCache: true,
      loadYear: false,
      silent: false,
      revisionTimeoutMs: reason.includes("reopen") || reason.includes("resume") ? 3500 : undefined,
      statusText: manual ? "正在刷新云端资料..." : "正在检查云端更新...",
      refreshFairInputs: false
    }).then(result => {
      if (result && result.cooldown && typeof setSync === "function") setSync("已同步", true);
      return result;
    }).catch(err => {
      console.warn("Cloud refresh failed:", reason, err);
      return { ok:false, error:err };
    }).finally(() => {
      refreshPromise = null;
    });

    return refreshPromise;
  }

  function startAutomaticRefreshAfterInitialSync() {
    if (autoRefreshStartTimer || autoRefreshInterval) return;
    // V21.1: do not fire a second check 5 seconds after startup.
    // The first automatic check starts only after a full interval from the
    // completed startup sync, preventing duplicate requests and UI flicker.
    autoRefreshStartTimer = setTimeout(() => {
      autoRefreshStartTimer = null;
      if (document.visibilityState === "visible") {
        refreshCloudData("interval", false);
      }
      autoRefreshInterval = setInterval(() => {
        if (document.visibilityState === "visible") {
          refreshCloudData("interval", false);
        }
      }, AUTO_REFRESH_MS);
    }, AUTO_REFRESH_MS);
  }

  function markInitialSyncReady() {
    if (initialSyncReady) return;
    initialSyncReady = true;
    lastCloudRefresh = Date.now();
    startAutomaticRefreshAfterInitialSync();
  }

  if (initialSyncReady) {
    startAutomaticRefreshAfterInitialSync();
  } else {
    window.addEventListener("lover-sales-initial-sync-complete", markInitialSyncReady, { once: true });
  }

  async function activateWaitingWorker(registration) {
    if (registration && registration.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
  }

  async function registerAndCheckForUpdates() {
    if (!("serviceWorker" in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" });
      await registration.update();
      await activateWaitingWorker(registration);
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) worker.postMessage({ type: "SKIP_WAITING" });
        });
      });
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (sessionStorage.getItem(RELOAD_FLAG) === "1") return;
        sessionStorage.setItem(RELOAD_FLAG, "1");
        window.location.reload();
      });
      setTimeout(() => sessionStorage.removeItem(RELOAD_FLAG), 10000);
    } catch (err) {
      console.warn("Service worker update check failed:", err);
    }
  }

  function scheduleServiceWorkerCheckAfterStartup() {
    const run = () => setTimeout(registerAndCheckForUpdates, 5000);

    if (initialSyncReady) {
      run();
      return;
    }

    window.addEventListener(
      "lover-sales-initial-sync-complete",
      run,
      { once: true }
    );
  }

  window.addEventListener("load", scheduleServiceWorkerCheckAfterStartup, { once:true });

  const RESUME_DEBOUNCE_MS = 320;
  const RESUME_RECENT_SYNC_MS = 30000;
  let resumeTimer = null;

  function dispatchResumeReady(detail = {}) {
    try { window.dispatchEvent(new CustomEvent("lover-sales-resume-ready", { detail })); } catch (e) {}
  }

  function refreshAfterReopen(reason = "resume") {
    if (!initialSyncReady) {
      return typeof waitForInitialCloudSync === "function"
        ? waitForInitialCloudSync()
        : Promise.resolve({ ok:true, skipped:true });
    }

    const now = Date.now();
    const running = activeLoadPromise() || refreshPromise || resumePromise;
    if (running) return running;

    // V32.5: if the page was synced very recently, returning from another app
    // must not turn the status yellow or start another Apps Script request.
    if (now - lastCloudRefresh < RESUME_RECENT_SYNC_MS) {
      dispatchResumeReady({ reason, skipped:true, recent:true });
      return Promise.resolve({ ok:true, skipped:true, recent:true });
    }
    if (now - lastResumeAt < 1200) return Promise.resolve({ ok:true, skipped:true });
    lastResumeAt = now;

    if (typeof markCloudCheckPending === "function") {
      markCloudCheckPending("正在快速确认云端...");
    }

    resumePromise = refreshCloudData(reason, false).then(result => {
      if (result && result.ok && !result.revisionUnconfirmed) lastCloudRefresh = Date.now();
      if (result && result.revisionUnconfirmed) {
        // One quiet retry after mobile wake-up. Do not stack focus/pageshow requests.
        setTimeout(() => {
          if (document.visibilityState === "visible" && !activeLoadPromise() && !refreshPromise && !resumePromise) {
            refreshCloudData("resume-retry", false).then(retry => {
              if (retry && retry.ok && !retry.revisionUnconfirmed) lastCloudRefresh = Date.now();
              dispatchResumeReady({ reason:"resume-retry", result:retry });
            });
          }
        }, 2200);
      }
      dispatchResumeReady({ reason, result });
      return result;
    }).finally(() => {
      resumePromise = null;
    });
    return resumePromise;
  }

  function scheduleResume(reason) {
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => {
      resumeTimer = null;
      refreshAfterReopen(reason);
    }, RESUME_DEBOUNCE_MS);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      hiddenAt = Date.now();
      return;
    }
    if (hiddenAt && Date.now() - hiddenAt >= 300) {
      hiddenAt = 0;
      scheduleResume("visibility-reopen");
    }
  });

  window.addEventListener("focus", () => {
    if (hiddenAt && Date.now() - hiddenAt >= 300) {
      hiddenAt = 0;
      scheduleResume("focus-reopen");
    }
  });
  window.addEventListener("pagehide", () => { hiddenAt = Date.now(); });
  window.addEventListener("pageshow", event => {
    if (event.persisted) scheduleResume("pageshow-cache");
  });
  window.addEventListener("online", () => refreshCloudData("online", false));

  // V21.1: mobile pull-down-to-refresh. Horizontal dragging never triggers it.
  function setupPullToRefresh() {
    if (!("ontouchstart" in window)) return;

    const indicator = document.createElement("div");
    indicator.className = "pull-refresh-indicator";
    indicator.textContent = "下拉刷新";
    document.body.appendChild(indicator);

    let startX = 0;
    let startY = 0;
    let distance = 0;
    let tracking = false;
    let verticalGesture = false;
    const threshold = 78;

    document.addEventListener("touchstart", event => {
      const running = activeLoadPromise();
      if (refreshPromise || running || window.scrollY > 1 || !event.touches || event.touches.length !== 1) return;
      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      distance = 0;
      tracking = true;
      verticalGesture = false;
    }, { passive: true });

    document.addEventListener("touchmove", event => {
      if (!tracking || !event.touches || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      if (!verticalGesture) {
        if (Math.abs(dx) > 10 && Math.abs(dx) >= Math.abs(dy)) {
          tracking = false;
          indicator.classList.remove("visible", "ready");
          return;
        }
        if (dy > 8 && Math.abs(dy) > Math.abs(dx) * 1.25) verticalGesture = true;
      }

      if (!verticalGesture || dy <= 0 || window.scrollY > 0) return;
      event.preventDefault();
      distance = Math.min(dy, 130);
      indicator.classList.add("visible");
      indicator.classList.toggle("ready", distance >= threshold);
      indicator.textContent = distance >= threshold ? "松开刷新" : "下拉刷新";
      indicator.style.transform = `translate(-50%, ${Math.min(distance * 0.55, 58)}px)`;
    }, { passive: false });

    document.addEventListener("touchend", async () => {
      if (!tracking) return;
      const shouldRefresh = verticalGesture && distance >= threshold;
      tracking = false;
      verticalGesture = false;

      if (!shouldRefresh) {
        indicator.classList.remove("visible", "ready");
        indicator.style.transform = "translate(-50%, -70px)";
        return;
      }

      indicator.classList.add("visible", "refreshing");
      indicator.classList.remove("ready");
      indicator.textContent = "正在刷新…";
      indicator.style.transform = "translate(-50%, 48px)";
      if (navigator.vibrate) navigator.vibrate(25);

      const result = await refreshCloudData("pull-down", true);

      if (result && result.ok) {
        if (typeof window.clearUnsavedSalesCardEditorsV224 === "function") window.clearUnsavedSalesCardEditorsV224();
        indicator.textContent = "刷新完成";
      } else {
        indicator.textContent = "刷新失败，请稍后重试";
      }
      setTimeout(() => {
        indicator.classList.remove("visible", "refreshing");
        indicator.style.transform = "translate(-50%, -70px)";
      }, result && result.ok ? 650 : 1200);
    }, { passive: true });

    document.addEventListener("touchcancel", () => {
      tracking = false;
      verticalGesture = false;
      indicator.classList.remove("visible", "ready", "refreshing");
      indicator.style.transform = "translate(-50%, -70px)";
    }, { passive: true });
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", setupPullToRefresh, { once: true });
  } else {
    setupPullToRefresh();
  }

})();
