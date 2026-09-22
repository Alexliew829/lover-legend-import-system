function isPageReloadV304() {
  try {
    const nav = performance.getEntriesByType?.("navigation")?.[0];
    if (nav?.type) return nav.type === "reload";
    return Number(performance.navigation?.type) === 1;
  } catch (_) { return false; }
}

function clearTransientSearchInputsOnReloadV304() {
  if (!isPageReloadV304()) return;
  [
    "inventorySearch",
    "batchSearch",
    "batchLookupInput",
    "historyLookupInput",
    "batchProductStockSearch",
    "inventoryMasterSearchV261",
    "costRevisionHistorySearch"
  ].forEach(id => {
    const field = document.getElementById(id);
    if (field) field.value = "";
  });
}

window.addEventListener("pageshow", () => {
  if (!isPageReloadV304()) return;
  window.setTimeout(() => {
    const ids = ["inventorySearch","batchSearch","batchLookupInput","historyLookupInput","batchProductStockSearch","inventoryMasterSearchV261","costRevisionHistorySearch"];
    const hadRestoredValue = ids.some(id => String(document.getElementById(id)?.value || "").length > 0);
    clearTransientSearchInputsOnReloadV304();
    if (!hadRestoredValue) return;
    // Local repaint only; no cloud/sync request. This catches Safari/iOS form-state
    // restoration that can occur after DOMContentLoaded on a true refresh.
    if (typeof renderInventoryManagementList === "function") renderInventoryManagementList();
    if (typeof renderBatchProductStockResults === "function") renderBatchProductStockResults();
    if (typeof renderInventoryMasterV261 === "function" && document.getElementById("inventoryMasterPanelV264")?.open) renderInventoryMasterV261();
  }, 0);
});

// V33.9 one-time live-settings cleanup: remove obsolete ZZ / 杂花杂木 / invoice-recognition / two-warehouse residue.
// Current Products / Imports / Batches are never deleted here. Only settings/drafts that are not part of the
// current authoritative product collection are pruned, so a restored formal inventory cannot be polluted again.
function cleanupLegacySettingsResidueV323() {
  // V33.9 hard cleanup. These legacy feature stores must never participate in the current system again.
  ["invoiceRecognitionDraftsV259","invoiceRecognitionHistoryV259","warehousePublicCatalogV275","supplierDirectoryV261",
   "testSupplierCleanupV268","twoWarehouseMigrationV270","twoWarehouseMigrationAddedV270","warehouseRepairV276",
   "warehouseRepairAddedV276","invoiceRecognitionSharedStatusV277"].forEach(key => {
    try { localStorage.removeItem(key); } catch (_) {}
  });
  const settings = loadJSON("importSystemSettings", {});
  const rawProducts = loadJSON("importSystemProducts", []);
  const validIds = new Set((Array.isArray(rawProducts) ? rawProducts : [])
    .map(p => String(p?.id || "").trim().toUpperCase()).filter(Boolean));
  let changed = false;
  const next = { ...settings };

  ["invoiceRecognitionDraftsV259","invoiceRecognitionHistoryV259","warehousePublicCatalogV275",
   "supplierDirectoryV261","testSupplierCleanupV268","twoWarehouseMigrationV270","twoWarehouseMigrationAddedV270",
   "warehouseRepairV276","warehouseRepairAddedV276","invoiceRecognitionSharedStatusV277"].forEach(key => {
    if (Object.prototype.hasOwnProperty.call(next, key)) { delete next[key]; changed = true; }
  });

  const pruneByLiveProductId = key => {
    const source = next[key];
    if (!source || typeof source !== "object" || Array.isArray(source)) return;
    const pruned = {};
    Object.entries(source).forEach(([id, value]) => {
      const upper = String(id || "").trim().toUpperCase();
      if (upper && validIds.has(upper)) pruned[id] = value;
    });
    if (Object.keys(pruned).length !== Object.keys(source).length) { next[key] = pruned; changed = true; }
  };
  if (validIds.size) {
    pruneByLiveProductId("minimumPriceManualOverrides");
    pruneByLiveProductId("productLanguageMetaV262");
    pruneByLiveProductId("productMediaLinksV229");
  }

  const isLegacyDraft = draft => {
    const rows = Array.isArray(draft?.rows) ? draft.rows : [];
    return rows.some(row => {
      const id = String(row?.productId || "").trim().toUpperCase();
      const category = String(row?.category || "").trim();
      const warehouse = String(row?.warehouseV270 || row?.warehouse || "").trim().toLowerCase();
      return category === "杂花杂木" || /^ZZ\d+$/i.test(id) || warehouse === "wood";
    }) || /^AIR|invoice/i.test(String(draft?.source || draft?.type || ""));
  };
  if (Array.isArray(next.importDraftsV242)) {
    const cleanDrafts = next.importDraftsV242.filter(draft => !isLegacyDraft(draft));
    if (cleanDrafts.length !== next.importDraftsV242.length) { next.importDraftsV242 = cleanDrafts; changed = true; }
  }

  if (changed) {
    // V33.9: startup residue cleanup is local-only. Never create a cloud dirty
    // queue before the first V32.5-style read check has completed.
    saveJSON("importSystemSettings", next);
  }
  return changed;
}

document.addEventListener("DOMContentLoaded", () => {
  clearTransientSearchInputsOnReloadV304();
  setupAccessLock();
  cleanupLegacySettingsResidueV323();
  repairLegacyImportDates();
  setupNavigation();
  setupSettings();
  setupInventoryMasterV299();
  const requestedPageV210 = String(new URLSearchParams(window.location.search).get("page") || "").trim().toLowerCase();
  const deepLinkPageMapV210 = {
    home: "dashboardPage",
    dashboard: "dashboardPage",
    import: "importPage",
    products: "importPage",
    history: "historyPage",
    settings: "settingsPage",
    supplier: "supplierPage",
    suppliers: "supplierPage"
  };
  const requestedTargetV210 = deepLinkPageMapV210[requestedPageV210];
  if (requestedTargetV210) {
    window.setTimeout(() => document.querySelector(`.nav-btn[data-page="${requestedTargetV210}"]`)?.click(), 0);
  }
  setupDashboard();
  setupImportModule();
  setupImportDraftV247();
  setupImportHistory();
  setupInventoryModule();
  setupGlobalMobilePullDownClear();
  registerServiceWorker();
  setupCloudSync();
  setupSalesInventoryReminder();
  setupDataOperationSafety();
});




// ================= V7.8 Sales System -> Import Inventory Reminder =================
// Read-only integration. Sales System never writes Import inventory automatically.
// A reminder disappears only after this Import System records the matching quantity
// as adjustmentType="sale" and stores the Sales link key in stockAdjustments.
const SALES_INVENTORY_FEED_URL_V77 =
  "https://script.google.com/macros/s/AKfycby1OwDIiVf5quXKiD9AG8s2ppM942sLFdJSfyePp--yZtDjYY8jBtkOYLwD9c3WiC_KNw/exec";
const SALES_SYSTEM_APP_URL_V118 = "https://alexliew829.github.io/lover-legend-sales/";
function salesSystemAssociatedCardUrlV118(item){
  const saleId=String(item?.saleId||item?.transactionId||"").trim();
  const linkId=String(item?.linkId||"").trim();
  const type=String(getSalesChannelV91(item)||item?.type||"").trim().toLowerCase();
  const date=String(item?.saleDate||"").trim();
  const location=String(getSalesSourceNameV77(item)||item?.location||item?.host||item?.fairLocation||"").trim();
  const p=new URLSearchParams({openSalesCard:"1",salesType:type,salesDate:date,salesLocation:location});
  if(saleId)p.set("salesTxn",saleId);if(linkId)p.set("salesLink",linkId);
  return SALES_SYSTEM_APP_URL_V118+"?"+p.toString();
}
function openAssociatedSalesCardV118(item){
  if(salesInventoryOperationActiveV115){alert("库存处理中，请等待完成后再离开 Import System。");return false;}
  const url=salesSystemAssociatedCardUrlV118(item);
  window.location.href=url;return true;
}
window.openAssociatedSalesCardV118=openAssociatedSalesCardV118;
const SALES_INVENTORY_REFRESH_MS_V77 = 60000;
const SALES_INVENTORY_BACKGROUND_START_DELAY_V103 = 250;
const SALES_INVENTORY_RESUME_DELAY_V103 = 600;
let salesInventoryFeedV77 = [];
let salesInventoryPendingV77 = [];
let salesInventoryFeedLoadedV77 = false;
let salesInventoryFeedBusyV77 = false;
let salesInventoryRefreshTimerV77 = null;
let preferredSalesInventoryKeyV77 = "";
let preferredSalesInventoryTxnV85 = "";
let salesInventoryOperationActiveV115 = false;
let salesInventoryOperationRestoreGenerationV117 = null;
let salesInventoryOperationStageV117 = "";
const historySalesDetailsByLinkV134 = new Map();
const historySalesContextLoadedV134 = new Set();
const historySalesContextLoadingV134 = new Map();
let historyLookupRenderTokenV134 = 0;
// V33.9: keep keystroke painting separate from expensive filtering/rendering.
// No network request is added; only the latest pending local render is executed.
const searchRenderTimersV302 = new Map();
function scheduleSearchRenderV302(key, fn, delay = 70) {
  const id = String(key || "search");
  const old = searchRenderTimersV302.get(id);
  if (old) window.clearTimeout(old);
  const timer = window.setTimeout(() => {
    searchRenderTimersV302.delete(id);
    try { fn(); } catch (error) { console.warn("Search render failed", id, error); }
  }, Math.max(0, Number(delay) || 0));
  searchRenderTimersV302.set(id, timer);
}

let historyAllSalesLinksLoadedV136 = false;
let historyAllSalesLinksLoadingV136 = null;
let inventorySalesAnalyticsCacheV146 = { signature: "", value: null };
const HISTORY_SALES_CACHE_KEY_V179 = "lover_import_history_sales_financial_v179";
let historySalesCacheHydratedV179 = false;
let historySalesCacheHasDataV179 = false;

function setSalesInventoryOperationLockV117(active, stage = "") {
  salesInventoryOperationActiveV115 = Boolean(active);
  salesInventoryOperationStageV117 = String(stage || "");
  if (!active) salesInventoryOperationRestoreGenerationV117 = null;
  document.body.classList.toggle("sales-inventory-operation-locked-v117", Boolean(active));
  const overlay = document.getElementById("salesInventoryStartupOverlayV81");
  if (!overlay) return;
  overlay.classList.toggle("operation-locked-v117", Boolean(active));
  let status = overlay.querySelector(".sales-operation-status-v117");
  if (!status) {
    status = document.createElement("div");
    status.className = "sales-operation-status-v117";
    const body = overlay.querySelector(".sales-startup-body-v81");
    if (body) body.parentNode.insertBefore(status, body);
  }
  if (status) {
    status.hidden = !active;
    status.textContent = active ? (salesInventoryOperationStageV117 || "正在处理，请勿关闭页面…") : "";
  }
  overlay.querySelectorAll(".sales-startup-close-v81,.sales-startup-later-v81").forEach(btn => {
    btn.disabled = Boolean(active);
  });
}

function updateSalesInventoryOperationStageV117(stage) {
  setSalesInventoryOperationLockV117(true, stage);
}

async function prepareSalesInventoryOperationV117() {
  updateSalesInventoryOperationStageV117("🔒 正在检查 Sales Restore 状态，请勿关闭页面…");
  // V13.7 reuses the recent maintenance token; a forced second network round
  // trip before every card caused most of the visible processing delay.
  salesInventoryOperationRestoreGenerationV117 = await getSalesRestoreGenerationV116(false);
  return salesInventoryOperationRestoreGenerationV117;
}

function blockSalesInventoryNavigationV117(event) {
  if (!salesInventoryOperationActiveV115) return;
  const target = event.target?.closest?.("a,button,.nav-btn,[data-page]");
  if (!target) return;
  if (target.closest("#salesInventoryStartupOverlayV81") && !target.matches(".sales-startup-close-v81,.sales-startup-later-v81")) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
}

function getSalesInventoryDeepLinkTargetV85(){
  const params=new URLSearchParams(window.location.search||"");
  return {
    transactionId:String(params.get("salesTxn")||"").trim(),
    linkId:String(params.get("salesLink")||"").trim(),
    type:String(params.get("salesType")||"").trim().toLowerCase(),
    date:String(params.get("salesDate")||"").trim(),
    location:String(params.get("salesLocation")||"").trim()
  };
}

function salesInventoryAgeDaysV85(item){
  const d=parseDateDDMMYYYY(String(item?.saleDate||""));
  if(!d)return 0;
  const today=new Date();
  const a=new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();
  const b=new Date(today.getFullYear(),today.getMonth(),today.getDate()).getTime();
  return Math.max(0,Math.floor((b-a)/86400000));
}

function isPreferredSalesInventoryItemV85(item,target){
  if(!target)return false;
  const saleId=String(item?.saleId||item?.transactionId||"").trim();
  const linkId=String(item?.linkId||"").trim();
  if(target.transactionId && saleId===target.transactionId)return true;
  if(target.linkId && linkId===target.linkId)return true;
  return false;
}

function normalizeSalesInventoryTextV77(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "");
}

function isSalesManualCorrectionTaskV102(item) {
  const taskType = String(item?.taskType || item?.inventoryTaskType || "").trim().toUpperCase();
  const status = String(item?.manualCorrectionStatus || item?.importSyncStatus || "").trim().toUpperCase();
  return taskType === "MANUAL_CORRECTION" || status === "MANUAL_CORRECTION_PENDING";
}

function getSalesInventoryItemKeyV77(item) {
  if (isSalesManualCorrectionTaskV102(item)) {
    return [
      "manual",
      String(item?.saleId || item?.transactionId || "").trim(),
      String(item?.cardRevision || item?.updatedAt || "").trim()
    ].join("|");
  }
  return [
    String(item?.linkId || "").trim(),
    String(item?.productId || "").trim() || normalizeSalesInventoryTextV77(item?.productName)
  ].join("|");
}

function getSalesInventoryCommitKeyV122(item, processedQty, commitQty) {
  // V12.3: the accounting line key (linkId|productId) must stay stable so net
  // processed quantity can be reconciled across edits, but every NEW inventory
  // deduction for the same Sales line needs its own idempotency key. Otherwise a
  // later 1→2 edit reuses the original key, the server correctly says
  // alreadyProcessed, and the second unit never reaches inventory.
  const baseKey = String(item?.key || getSalesInventoryItemKeyV77(item)).trim();
  const before = Math.max(0, Math.trunc(Number(processedQty) || 0));
  const qty = Math.max(0, Math.trunc(Number(commitQty) || 0));
  const after = before + qty;
  const revision = String(
    item?.cardRevision || item?.updatedAt || item?.saleUpdatedAt || item?.modifiedAt || ""
  ).trim();
  // Keep the first legacy commit key compatible when no revision metadata exists.
  // Any subsequent deduction is versioned by the net transition.
  if (before === 0 && !revision) return baseKey;
  return [baseKey, "commit", revision || "legacy", `${before}->${after}`].join("|");
}

function findImportProductForSalesItemV77(item) {
  const products = getProducts();
  const productId = String(item?.productId || "").trim();
  if (productId) {
    const exact = products.find(product => String(product?.id || "").trim() === productId);
    if (exact) return exact;
  }
  const targetName = normalizeSalesInventoryTextV77(item?.productName);
  if (!targetName) return null;
  return products.find(product => normalizeSalesInventoryTextV77(product?.name) === targetName) || null;
}

function getProcessedSalesInventoryQuantitiesV77() {
  // V11.4: processed quantity means NET quantity still consumed by this exact
  // Sales line. Initial actual-sale deductions add to the net; later +stock
  // corrections for the same linkId subtract from it. This is the authoritative
  // baseline for 3→2 (+1), 3→5 (-2), delete (+all), and product replacement.
  const processed = new Map();
  getProducts().forEach(product => {
    getProductStockAdjustments(product).forEach(adjustment => {
      const links = Array.isArray(adjustment?.salesLinks) ? adjustment.salesLinks : [];
      if (!links.length) return;
      const delta = Number(adjustment?.delta || 0);
      const adjustmentType = String(adjustment?.adjustmentType || "").toLowerCase();
      links.forEach(link => {
        const linkId = String(link?.linkId || "").trim();
        const productId = String(link?.productId || product?.id || "").trim();
        const key = linkId
          ? [linkId, productId || normalizeSalesInventoryTextV77(link?.productName || product?.name)].join("|")
          : String(link?.key || "").trim();
        const qty = Math.max(0, Math.trunc(Number(link?.processedQty) || 0));
        if (!key || !qty) return;
        const correctionAction = String(link?.correctionAction || "").toLowerCase();
        const isRestore = correctionAction === "restore" || (delta > 0 && adjustmentType !== "sale");
        const sign = isRestore ? -1 : 1;
        processed.set(key, Math.max(0, (processed.get(key) || 0) + sign * qty));
      });
    });
  });
  return processed;
}

function getSalesFeedDesiredQtyV121(manualItem, change) {
  const saleId = String(manualItem?.saleId || manualItem?.transactionId || "").trim();
  const linkId = String(change?.linkId || manualItem?.linkId || "").trim();
  const productId = String(change?.importProductId || change?.productId || "").trim();
  const productName = normalizeSalesInventoryTextV77(change?.productName || change?.name || "");
  const rows = salesInventoryFeedV77.filter(row => {
    if (isSalesManualCorrectionTaskV102(row)) return false;
    const rowSaleId = String(row?.saleId || row?.transactionId || "").trim();
    if (saleId && rowSaleId !== saleId) return false;
    const rowProductId = String(row?.productId || "").trim();
    const rowProductName = normalizeSalesInventoryTextV77(row?.productName);
    if (productId ? rowProductId !== productId : (productName && rowProductName !== productName)) return false;
    if (linkId && String(row?.linkId || "").trim() !== linkId) return false;
    return true;
  });
  if (!rows.length) return { known:false, desiredQty:0, rows:[] };
  const desiredQty = rows.reduce((sum,row) => {
    const status = String(row?.status || "active").toLowerCase();
    if (status === "cancelled" || status === "deleted") return sum;
    return sum + Math.max(0, Math.trunc(Number(row?.quantity) || 0));
  }, 0);
  return { known:true, desiredQty, rows };
}

function getProcessedQtyForManualChangeV121(processed, manualItem, change) {
  const productId = String(change?.importProductId || change?.productId || "").trim();
  const productName = normalizeSalesInventoryTextV77(change?.productName || change?.name || "");
  const linkId = String(change?.linkId || manualItem?.linkId || "").trim();
  if (linkId) {
    const exact = Math.max(0, Math.trunc(Number(processed.get([linkId, productId || productName].join("|"))) || 0));
    if (exact > 0) return exact;
  }
  // V12.3 fallback for a removed/replaced legacy line whose current Sales feed no
  // longer carries the old Line ID: recover the net actually-processed quantity
  // from Import History by Sale ID + product.  Restore corrections subtract from
  // the net, so this can never intentionally restore more than Import still shows
  // as consumed by that sale/product.
  const saleId = String(manualItem?.saleId || manualItem?.transactionId || "").trim();
  if (!saleId || (!productId && !productName)) return 0;
  let net = 0;
  getProducts().forEach(product => {
    const pid = String(product?.id || "").trim();
    const pname = normalizeSalesInventoryTextV77(product?.name);
    if (productId ? pid !== productId : pname !== productName) return;
    getProductStockAdjustments(product).forEach(adjustment => {
      const delta = Number(adjustment?.delta || 0);
      const adjustmentType = String(adjustment?.adjustmentType || "").toLowerCase();
      (Array.isArray(adjustment?.salesLinks) ? adjustment.salesLinks : []).forEach(link => {
        if (String(link?.saleId || "").trim() !== saleId) return;
        const lpid = String(link?.productId || pid || "").trim();
        const lpname = normalizeSalesInventoryTextV77(link?.productName || product?.name);
        if (productId ? lpid !== productId : lpname !== productName) return;
        const qty = Math.max(0, Math.trunc(Number(link?.processedQty) || 0));
        if (!qty) return;
        const correctionAction = String(link?.correctionAction || "").toLowerCase();
        const isRestore = correctionAction === "restore" || (delta > 0 && adjustmentType !== "sale");
        net += isRestore ? -qty : qty;
      });
    });
  });
  return Math.max(0, Math.trunc(net));
}

function sanitizeSalesManualChangesV121(item, processed) {
  const raw = Array.isArray(item?.inventoryChanges) ? item.inventoryChanges : (Array.isArray(item?.manualChanges) ? item.manualChanges : []);
  const kept = [];
  for (const change of raw) {
    const desired = getSalesFeedDesiredQtyV121(item, change);
    if (desired.known) {
      // Current Sales line exists (active OR deleted): the normal reconciliation
      // path below owns this line and will calculate desired - processed exactly.
      // Never also apply a Sales-generated manual correction for the same line.
      continue;
    }
    const row = salesManualChangeTextV102(change);
    // If the product is absent from the current Sales card, a new deduction is
    // never authoritative.  Only a restore of inventory previously consumed by
    // this sale can be valid for an absent old/replaced line.
    if (row.direction !== "restore") continue;
    const processedQty = getProcessedQtyForManualChangeV121(processed, item, change);
    if (processedQty <= 0) continue;
    const qty = Math.min(row.qty, processedQty);
    if (!Number.isFinite(Number(qty)) || qty <= 0) continue;
    kept.push({ ...change, inventoryAdjustment: qty, delta: -qty });
  }
  return kept;
}

function recomputeSalesInventoryPendingV77() {
  const processed = getProcessedSalesInventoryQuantitiesV77();
  const pending = [];
  salesInventoryFeedV77.forEach(item => {
    // V13.7: Sales integration is deduction-only. Returns, cancellations and
    // exchanges are handled manually in Import with an operator remark.
    if (isSalesManualCorrectionTaskV102(item)) return;
    const rowStatus=String(item?.status||"active").toLowerCase();
    if(rowStatus!=="active")return;
    const product=findImportProductForSalesItemV77(item); if(!product)return;
    const baseKey=getSalesInventoryItemKeyV77(item);
    const desiredQty=Math.max(0,Math.trunc(Number(item?.quantity)||0));
    const processedQty=Math.max(0,Math.trunc(Number(processed.get(baseKey))||0));
    const importStatus=String(item?.importSyncStatus||"").toUpperCase();
    // V13.7: Sales completion state is authoritative for whether a CURRENT line
    // still needs Import work.  After an Import Backup/Restore, local History can
    // legitimately be older than Sales.  Never recreate a ghost pending card only
    // because restored Import History no longer contains an already-ACKed line.
    // A real inventory-affecting edit (qty/product/delete) resets Sales back to a
    // pending state; only then do we reconcile desiredQty against Import History.
    if(importStatus==="INVENTORY_CONFIRMED") return;
    if(processedQty>desiredQty)return;
    const remainingQty=Math.max(0,desiredQty-processedQty);
    if(!remainingQty){
      const locallyCommitted=salesItemAlreadyProcessedLocallyV104({...item,key:baseKey},product);
      if(!locallyCommitted)return;
      pending.push({...item,key:baseKey,importProductId:String(product.id||""),importProductName:String(product.name||""),processedQty,remainingQty:0,legacyAckOnlyV105:true});
      return;
    }
    pending.push({...item,key:baseKey,importProductId:String(product.id||""),importProductName:String(product.name||""),processedQty,remainingQty});
  });
  /* V13.7: legacy automatic restore synthesis is intentionally disabled.
     Manual stock adjustment remains available in Import itself. */
  if(false){
  // V12.3: if an already-processed Sales line was removed/replaced, the current
  // Sales feed may no longer contain the old product row. Reconcile Import History
  // against the current card and synthesize the missing restore task.
  const feedBySale = new Map();
  salesInventoryFeedV77.forEach(row => {
    if (isSalesManualCorrectionTaskV102(row)) return;
    const saleId=String(row?.saleId||row?.transactionId||"").trim();
    if(!saleId)return;
    if(!feedBySale.has(saleId))feedBySale.set(saleId,[]);
    feedBySale.get(saleId).push(row);
  });
  const historyNet = new Map();
  getProducts().forEach(product => {
    getProductStockAdjustments(product).forEach(adjustment => {
      const delta=Number(adjustment?.delta||0);
      const adjustmentType=String(adjustment?.adjustmentType||"").toLowerCase();
      (Array.isArray(adjustment?.salesLinks)?adjustment.salesLinks:[]).forEach(link => {
        const saleId=String(link?.saleId||"").trim();
        const linkId=String(link?.linkId||"").trim();
        const productId=String(link?.productId||product?.id||"").trim();
        const qty=Math.max(0,Math.trunc(Number(link?.processedQty)||0));
        if(!saleId||!productId||!qty)return;
        const correctionAction=String(link?.correctionAction||"").toLowerCase();
        const isRestore=correctionAction==="restore"||(delta>0&&adjustmentType!=="sale");
        const k=[saleId,linkId,productId].join("|");
        const old=historyNet.get(k)||{saleId,linkId,productId,productName:String(link?.productName||product?.name||""),net:0};
        old.net+=isRestore?-qty:qty; historyNet.set(k,old);
      });
    });
  });
  historyNet.forEach(h => {
    const processedQty=Math.max(0,Math.trunc(Number(h.net)||0));
    if(!processedQty||!feedBySale.has(h.saleId))return;
    const rows=feedBySale.get(h.saleId);
    // V13.7: synthesize a replacement/deletion restore only when this Sales card
    // itself currently says inventory work is pending.  This preserves the V12.3
    // replacement fix while preventing completed historical cards from being
    // resurrected after Import Restore.
    const cardNeedsInventory=rows.some(row=>{
      const status=String(row?.status||"active").toLowerCase();
      const importStatus=String(row?.importSyncStatus||"").toUpperCase();
      return status!=="cancelled" && importStatus!=="INVENTORY_CONFIRMED";
    });
    if(!cardNeedsInventory)return;
    const desiredQty=rows.reduce((sum,row)=>{
      const sameProduct=String(row?.productId||"").trim()===h.productId;
      const sameLink=!h.linkId||String(row?.linkId||"").trim()===h.linkId;
      const status=String(row?.status||"active").toLowerCase();
      return sum+(sameProduct&&sameLink&&status!=="deleted"&&status!=="cancelled"?Math.max(0,Math.trunc(Number(row?.quantity)||0)):0);
    },0);
    if(processedQty<=desiredQty)return;
    const already=pending.some(x=>isSalesManualCorrectionTaskV102(x)&&(Array.isArray(x.inventoryChanges)?x.inventoryChanges:[]).some(c=>String(c?.productId||c?.importProductId||"").trim()===h.productId&&String(c?.linkId||"").trim()===h.linkId));
    if(already)return;
    const template=rows[0]||{};
    const restoreQty=processedQty-desiredQty;
    pending.push({...template,saleId:h.saleId,transactionId:h.saleId,linkId:h.linkId,key:`manual|${h.saleId}|${h.linkId}|replacement-restore|${processedQty}|${desiredQty}`,taskType:"MANUAL_CORRECTION",manualCorrection:true,manualCorrectionStatus:"MANUAL_CORRECTION_PENDING",remainingQty:0,inventoryChanges:[{action:"RESTORE",delta:-restoreQty,inventoryAdjustment:restoreQty,productId:h.productId,importProductId:h.productId,productName:h.productName,linkId:h.linkId}]});
  });
  }
  salesInventoryPendingV77=pending;
  return salesInventoryPendingV77;
}

function callSalesInventoryFeedV77(attempt = 0) {
  return new Promise((resolve, reject) => {
    const callbackName = `loverLegendSalesFeedV77_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const cleanup = () => {
      window.clearTimeout(timeoutId);
      try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
      script.remove();
    };
    window[callbackName] = data => {
      cleanup();
      if (!data?.ok) reject(new Error(data?.error || "Sales Inventory Feed 读取失败"));
      else resolve(data);
    };
    const params = new URLSearchParams({ action: "getSalesInventoryFeed", callback: callbackName, _: String(Date.now()) });
    script.src = `${SALES_INVENTORY_FEED_URL_V77}?${params.toString()}`;
    script.async = true;
    script.onerror = () => { cleanup(); reject(new Error("无法连接 Sales System")); };
    const timeoutId = window.setTimeout(() => { cleanup(); reject(new Error("Sales System 提醒读取超时")); }, attempt===0?15000:20000);
    document.head.appendChild(script);
  }).catch(async error=>{if(attempt<1&&navigator.onLine){await new Promise(r=>setTimeout(r,500));return callSalesInventoryFeedV77(attempt+1)}throw error});
}

async function refreshSalesInventoryFeedV77({ silent = true } = {}) {
  if (salesInventoryFeedBusyV77 || !navigator.onLine) return salesInventoryPendingV77;
  salesInventoryFeedBusyV77 = true;
  try {
    const data = await callSalesInventoryFeedV77();
    salesInventoryFeedV77 = Array.isArray(data?.items) ? data.items : [];
    salesInventoryFeedLoadedV77 = true;
    salesInventoryFeedLastErrorV203 = "";
    salesInventoryFeedFailureCountV226 = 0;
    recomputeSalesInventoryPendingV77();
    renderSalesInventoryReminderV77();
    renderImportAnomalyCenterV201();
    if (document.getElementById("batchProductStockSearch")?.value?.trim()) renderBatchProductStockResults();
  } catch (error) {
    salesInventoryFeedLastErrorV203 = String(error?.message || error);
    salesInventoryFeedFailureCountV226 += 1;
    if (!silent) alert(salesInventoryFeedLastErrorV203);
  } finally {
    salesInventoryFeedBusyV77 = false;
  }
  return salesInventoryPendingV77;
}

function formatSalesTimeV77(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : text;
}

function getSalesChannelV91(item) {
  const type = String(item?.type || "").trim().toLowerCase();
  if (type === "live") return "Live";
  if (type === "fair") return "Fair";
  return "Sales";
}

function getSalesSourceNameV77(item) {
  const channel = getSalesChannelV91(item);
  if (channel === "Live") return String(item?.host || item?.location || "Live").trim();
  if (channel === "Fair") return String(item?.fairLocation || item?.location || "Fair").trim();
  return String(item?.location || item?.fairLocation || item?.host || "Sales").trim();
}

function buildSalesInventoryMessageV77(item) {
  const source = getSalesSourceNameV77(item);
  const time = formatSalesTimeV77(item?.saleTime);
  const when = [String(item?.saleDate || "").trim(), time].filter(Boolean).join(" ");
  return `${source} 于${when}卖出 ${item.importProductName || item.productName} -${formatNumber(item.remainingQty)}，请修改库存数量`;
}

function renderSalesInventoryReminderV77() {
  // V8.7: no persistent/page-level Sales reminder UI.
  const panel = document.getElementById("salesInventoryReminderPanel");
  const list = document.getElementById("salesInventoryReminderList");
  if (panel) panel.hidden = true;
  if (list) list.innerHTML = "";
}

function buildSalesInventoryAutoNoteV81(item) {
  const channel = getSalesChannelV91(item);
  const source = getSalesSourceNameV77(item);
  const when = [String(item?.saleDate || "").trim(), formatSalesTimeV77(item?.saleTime)].filter(Boolean).join(" ");
  return `${channel} · ${source} · ${when}`.trim();
}


let salesRestoreGenerationCacheV116 = { value: 0, at: 0 };

function callSalesMaintenanceStatusV116() {
  return new Promise((resolve, reject) => {
    const callbackName = `loverLegendSalesMaintenanceV116_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    let finished = false;
    const cleanup = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeoutId);
      try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
      script.remove();
    };
    window[callbackName] = data => {
      cleanup();
      if (!data?.ok) {
        const msg = String(data?.error || data?.message || "");
        // Compatibility with older Sales deployments that predate maintenanceStatusV345.
        if (/unknown action/i.test(msg)) { resolve({ ok:true, restoreGeneration:0, legacy:true }); return; }
        reject(new Error(msg || "无法读取 Sales Restore 状态"));
        return;
      }
      resolve(data);
    };
    const params = new URLSearchParams({ action:"maintenanceStatusV345", callback:callbackName, _:String(Date.now()) });
    script.src = `${SALES_INVENTORY_FEED_URL_V77}?${params.toString()}`;
    script.async = true;
    script.onerror = () => { cleanup(); reject(new Error("无法连接 Sales System 读取 Restore 状态")); };
    const timeoutId = window.setTimeout(() => { cleanup(); reject(new Error("Sales Restore 状态读取超时")); }, 12000);
    document.head.appendChild(script);
  });
}

async function getSalesRestoreGenerationV116(force = false) {
  const now = Date.now();
  if (!force && now - Number(salesRestoreGenerationCacheV116.at || 0) < 10000) {
    return Math.max(0, Number(salesRestoreGenerationCacheV116.value || 0));
  }
  const data = await callSalesMaintenanceStatusV116();
  if (data?.active) throw new Error(data?.message || "Sales System 正在 Restore，请等待完成后再回写库存状态。");
  const value = Math.max(0, Number(data?.restoreGeneration || 0));
  salesRestoreGenerationCacheV116 = { value, at: Date.now() };
  return value;
}

function sendSalesInventoryAckV116(item, restoreGeneration, manual = false) {
  return new Promise((resolve,reject)=>{
    const saleId=String(item?.saleId||item?.transactionId||"").trim(),linkId=String(item?.linkId||"").trim();
    if(!saleId||!linkId){reject(new Error("销售卡缺少 Card ID / Line ID，不能标记库存已处理。"));return;}
    const callbackName=`loverLegendSalesAckV116_${Date.now()}_${Math.random().toString(36).slice(2)}`,script=document.createElement("script"); let finished=false;
    const cleanup=()=>{if(finished)return;finished=true;window.clearTimeout(timeoutId);try{delete window[callbackName]}catch(_){window[callbackName]=undefined}script.remove();};
    window[callbackName]=data=>{cleanup();if(!data?.ok){const err=new Error(data?.error||data?.message||(manual?"Sales 库存差异状态回写失败":"Sales 库存状态回写失败"));err.salesResponse=data||{};reject(err);}else resolve(data);};
    const params=new URLSearchParams({action:"confirmSalesCardInventoryV249",callback:callbackName,type:String(item?.type||""),date:String(item?.saleDate||""),location:String(item?.location||item?.host||item?.fairLocation||""),transactionId:saleId,linkId,restoreGeneration:String(Math.max(0,Number(restoreGeneration||0))),_:String(Date.now())});
    script.src=`${SALES_INVENTORY_FEED_URL_V77}?${params.toString()}`;script.async=true;script.onerror=()=>{cleanup();reject(new Error(manual?"无法回写 Sales System 库存差异完成状态":"无法回写 Sales System 库存状态"));};
    const timeoutId=window.setTimeout(()=>{cleanup();reject(new Error(manual?"Sales System 库存差异完成状态回写超时":"Sales System 库存状态回写超时"));},15000);document.head.appendChild(script);
  });
}

async function confirmSalesAckWithRestoreGenerationV117(item, manual = false) {
  let generation = Number.isFinite(Number(salesInventoryOperationRestoreGenerationV117))
    ? Math.max(0, Number(salesInventoryOperationRestoreGenerationV117))
    : await getSalesRestoreGenerationV116(false);
  try {
    updateSalesInventoryOperationStageV117(manual ? "🔄 正在回写 Sales 库存差异完成状态…" : "🔄 Import 库存已确认，正在回写 Sales 完成状态…");
    return await sendSalesInventoryAckV116(item, generation, manual);
  } catch (error) {
    const response = error?.salesResponse || {};
    const message = String(response?.message || response?.error || error?.message || "");
    if (response?.maintenance) throw new Error(message || "Sales System 正在 Restore；已提交库存不会重复扣除，稍后只需补回完成状态。");
    if (response?.staleRestore || /Restore 已更新云端资料|旧保存队列/i.test(message)) {
      updateSalesInventoryOperationStageV117("🔄 Restore 版本已变化，正在刷新并只重试 Sales 回写…");
      generation = await getSalesRestoreGenerationV116(true);
      salesInventoryOperationRestoreGenerationV117 = generation;
      return await sendSalesInventoryAckV116(item, generation, manual);
    }
    throw error;
  }
}

function completeSalesManualCorrectionRemoteV102(item) {
  return confirmSalesAckWithRestoreGenerationV117(item, true);
}

function openImportManualInventoryEditorV102(item) {
  // V11.4: navigation only; close the modal/grey mask before opening editor.
  closeStartupSalesInventoryReminderV81();
  const nav = document.querySelector('.nav-btn[data-page="importPage"]');
  if (nav) nav.click();

  window.setTimeout(() => {
    const input = document.getElementById("batchProductStockSearch");
    if (input) {
      input.value = "";
      input.focus({ preventScroll: true });
      input.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      document.getElementById("importPage")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, 80);
}
window.openImportManualInventoryEditorV102 = openImportManualInventoryEditorV102;

function salesManualChangeTextV102(change) {
  const name = String(change?.productName || change?.name || "未命名产品").trim();
  const delta = Number(change?.delta || 0);
  const adjustment = Number(change?.inventoryAdjustment || 0);
  const action = String(change?.action || "").trim().toUpperCase();

  if (action === "RESTORE" || delta < 0) {
    const qty = Math.abs(adjustment || delta || 0);
    return { name, label: `恢复 +${formatNumber(qty)}`, actionClass: "restore-v102", qty, direction: "restore" };
  }
  const qty = Math.abs(adjustment || delta || 0);
  return { name, label: `扣除 -${formatNumber(qty)}`, actionClass: "deduct-v102", qty, direction: "deduct" };
}


function copySalesCorrectionProductNameV108(name) {
  const text = String(name || "").trim();
  if (!text) return;
  const done = () => {
    const old = document.getElementById("salesCopyToastV108"); if (old) old.remove();
    const toast = document.createElement("div"); toast.id="salesCopyToastV108"; toast.className="sales-copy-toast-v108"; toast.textContent="已复制产品名";
    document.body.appendChild(toast); setTimeout(()=>toast.remove(),1200);
  };
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done).catch(()=>{});
  else { const ta=document.createElement("textarea"); ta.value=text; document.body.appendChild(ta); ta.select(); try{document.execCommand("copy");done();}finally{ta.remove();} }
}

function findCorrectionProductV108(change){
  const pid=String(change?.importProductId||change?.productId||change?.id||"").trim();
  const name=String(change?.productName||change?.name||"").trim().toLowerCase();
  return getProducts().find(p => (pid && String(p?.id||"").trim()===pid) || (!pid && name && String(p?.name||"").trim().toLowerCase()===name)) ||
    getProducts().find(p => name && String(p?.name||"").trim().toLowerCase()===name);
}

function openSalesCorrectionConfirmV110(item){
  return new Promise(resolve=>{
    const parent=document.getElementById("salesInventoryStartupOverlayV81");
    if(parent) parent.classList.add("sales-startup-hidden-v108");
    const old=document.getElementById("salesCorrectionConfirmOverlayV108"); if(old)old.remove();
    const changes=(Array.isArray(item?.inventoryChanges)?item.inventoryChanges:[]).map(c=>({change:c,row:salesManualChangeTextV102(c),product:findCorrectionProductV108(c)}));
    const channel=getSalesChannelV91(item), source=getSalesSourceNameV77(item), date=String(item?.saleDate||"");
    const defaultNote=`Sales · ${channel} · ${source} · ${date} · 销售卡修改`;
    const overlay=document.createElement("div"); overlay.id="salesCorrectionConfirmOverlayV108"; overlay.className="sales-correction-overlay-v108";
    overlay.innerHTML=`<div class="sales-correction-dialog-v108"><div class="sales-correction-head-v108"><strong>销售卡库存差异自动处理</strong><button type="button" data-x aria-label="关闭">×</button></div>
      <div class="sales-correction-list-v108">${changes.map((x,i)=>{const stock=x.product?Math.max(0,Math.trunc(Number(x.product.stock)||0)):null;const after=stock==null?null:stock+(x.row.direction==="restore"?x.row.qty:-x.row.qty);const nature=x.row.direction==="restore"?"撤销原实际卖出":"新增实际卖出（FIFO）";return `<div class="sales-correction-row-v108"><div>产品 ${i+1}</div><button type="button" class="sales-copy-name-v108" data-copy="${escapeHTML(x.row.name)}">${escapeHTML(x.row.name)}</button><div>当前库存：<b>${stock==null?"找不到产品":formatNumber(stock)}</b></div><div>调整数量：<b>${escapeHTML(x.row.label)}</b></div><div>调整后库存：<b>${after==null?"—":formatNumber(after)}</b></div><div>调整性质：<b>${nature}</b></div></div>`}).join("")}</div>
      <label class="sales-correction-note-v108">备注<input type="text" maxlength="120" value="${escapeHTML(defaultNote)}"></label>
      <div class="sales-correction-warning-v108">系统会先检查全部项目、库存、FIFO / Batch、Sales Key，并防止重复处理。任何一项失败，整张销售卡全部停止。</div>
      <div class="sales-correction-error-v108" hidden></div>
      <button type="button" class="sales-correction-confirm-v108">确认处理全部 ${changes.length} 项</button><button type="button" class="sales-correction-cancel-v108">取消</button></div>`;
    let settled=false;
    const restoreParent=()=>{if(parent&&document.body.contains(parent))parent.classList.remove("sales-startup-hidden-v108");};
    const cancel=()=>{if(settled)return; settled=true; overlay.remove(); restoreParent(); resolve(null);};
    overlay.querySelector('[data-x]').onclick=cancel;
    overlay.querySelector('.sales-correction-cancel-v108').onclick=cancel;
    overlay.querySelectorAll('.sales-copy-name-v108').forEach(b=>b.onclick=()=>copySalesCorrectionProductNameV108(b.dataset.copy));
    overlay.querySelector('.sales-correction-confirm-v108').onclick=()=>{
      if(settled)return; settled=true;
      const confirmBtn=overlay.querySelector('.sales-correction-confirm-v108');
      const cancelBtn=overlay.querySelector('.sales-correction-cancel-v108');
      const xBtn=overlay.querySelector('[data-x]');
      confirmBtn.disabled=true; cancelBtn.disabled=true; xBtn.disabled=true;
      confirmBtn.innerHTML='<span class="button-loading-spinner-v108" aria-hidden="true"></span> 处理中…';
      resolve({
        note:overlay.querySelector('input').value.trim()||defaultNote,
        success(){
          const confirmBtn=overlay.querySelector('.sales-correction-confirm-v108');
          const cancelBtn=overlay.querySelector('.sales-correction-cancel-v108');
          const xBtn=overlay.querySelector('[data-x]');
          confirmBtn.disabled=true; cancelBtn.disabled=true; xBtn.disabled=true;
          confirmBtn.textContent="✓ 全部库存差异处理完成";
          window.setTimeout(()=>overlay.remove(),700);
        },
        fail(message){
          settled=false; confirmBtn.disabled=false; cancelBtn.disabled=false; xBtn.disabled=false;
          confirmBtn.textContent=`确认处理全部 ${changes.length} 项`;
          const box=overlay.querySelector('.sales-correction-error-v108'); box.hidden=false; box.textContent=String(message||"处理失败，请检查后重试。");
        },
        restoreParent
      });
    };
    document.body.appendChild(overlay);
  });
}

async function executeSalesCorrectionBatchV110(item,note){
  const changes=Array.isArray(item?.inventoryChanges)?item.inventoryChanges:[];
  if(!changes.length) throw new Error("没有库存差异可处理。");
  const saleId=String(item?.saleId||item?.transactionId||"").trim();
  const taskKey=String(item?.key||"").trim();
  if(!saleId||!taskKey) throw new Error("Sales Key / Line ID 不完整，已停止整张处理。");

  // V11.4 preflight: validate every line before mutating the browser staging snapshot.
  const preflight=changes.map((c,i)=>{
    const row=salesManualChangeTextV102(c);
    const product=findCorrectionProductV108(c);
    if(!product) throw new Error(`找不到产品：${row.name}`);
    if(!Number.isFinite(Number(row.qty))||row.qty<=0) throw new Error(`${row.name} 的调整数量不正确。`);
    const current=Math.max(0,Math.trunc(Number(product.stock)||0));
    const next=current+(row.direction==="restore"?row.qty:-row.qty);
    if(next<0) throw new Error(`库存不足：${row.name}，当前 ${current}，需要扣除 ${row.qty}`);
    return {c,row,product,current,next,index:i};
  });

  const original={products:localStorage.getItem("importSystemProducts"),imports:localStorage.getItem("importSystemImports"),batches:localStorage.getItem("importSystemBatches")};
  const expected=[];
  const correctionKey=`sales-correction:${saleId}:${taskKey}`;
  try{
    for(const pf of preflight){
      const {row,product,index:i}=pf;
      const products=getProducts().map(p=>({...p}));
      const idx=products.findIndex(p=>String(p.id||"")===String(product.id||""));
      if(idx<0) throw new Error(`Products 找不到产品：${product.id||row.name}`);
      const current=Math.max(0,Math.trunc(Number(products[idx].stock)||0));
      const next=current+(row.direction==="restore"?row.qty:-row.qty);
      const adjustmentType=row.direction==="restore"?"modify":"sale";
      const adjustmentReason=row.direction==="restore"?"撤销销售":"实际卖出";
      const allocation=allocateProductRemainingFIFO(product.id,product.name,next,adjustmentType,adjustmentReason,note);
      if(!allocation.ok) throw new Error(`${row.name}：${allocation.message||"FIFO / Batch 库存计算失败"}`);
      const link={key:`${correctionKey}:${i}`,saleId,taskKey,linkId:String(pf.c?.linkId||item?.linkId||""),productId:String(product.id||""),productName:product.name,processedQty:row.qty,saleDate:String(item?.saleDate||""),type:String(item?.type||""),location:String(item?.location||item?.host||item?.fairLocation||""),source:getSalesSourceNameV77(item),correctionAction:row.direction};
      const adjustmentData=appendProductStockAdjustments(products[idx],allocation.changes,allocation.changedAt,current,next,[link]);
      products[idx]={...products[idx],...adjustmentData,stock:next,inventoryArchived:next>0?false:products[idx].inventoryArchived,updatedAt:allocation.changedAt};
      localStorage.setItem("importSystemProducts",JSON.stringify(products));
      localStorage.setItem("importSystemImports",JSON.stringify(allocation.nextImports));
      localStorage.setItem("importSystemBatches",JSON.stringify(allocation.nextBatches));
      expected.push({productId:String(product.id),before:current,after:next,action:row.direction,qty:row.qty,lineKey:`${correctionKey}:${i}`});
    }
    const finalProducts=getProducts(), finalImports=getImports(), finalBatches=getBatches();
    const expectedMap=new Map(); expected.forEach(e=>{const prev=expectedMap.get(e.productId); expectedMap.set(e.productId,prev?{...e,before:prev.before,after:e.after}:e);}); expected.splice(0,expected.length,...expectedMap.values());
    const touchedIds=new Set(expected.map(x=>x.productId)); const touchedProducts=finalProducts.filter(p=>touchedIds.has(String(p.id||"")));
    const originalImports=JSON.parse(original.imports||"[]"), originalBatches=JSON.parse(original.batches||"[]");
    const originalImportMap=new Map(originalImports.map(r=>[String(r.id||""),JSON.stringify(r)]));
    const originalBatchMap=new Map(originalBatches.map(r=>[String(r.id||""),JSON.stringify(r)]));
    const touchedImports=finalImports.filter(r=>originalImportMap.get(String(r.id||""))!==JSON.stringify(r));
    const touchedBatches=finalBatches.filter(r=>originalBatchMap.get(String(r.id||""))!==JSON.stringify(r));
    // Restore browser state until the cloud confirms the whole batch.
    if(original.products===null)localStorage.removeItem("importSystemProducts");else localStorage.setItem("importSystemProducts",original.products);
    if(original.imports===null)localStorage.removeItem("importSystemImports");else localStorage.setItem("importSystemImports",original.imports);
    if(original.batches===null)localStorage.removeItem("importSystemBatches");else localStorage.setItem("importSystemBatches",original.batches);
    const result=await commitSalesCorrectionBatchToCloudV110({correctionKey,saleId,taskKey,expected,products:touchedProducts,imports:touchedImports,batches:touchedBatches});
    if(!result?.ok) throw new Error(result?.message||result?.error||"整张库存差异处理失败。");
    if(result?.partialProcessed) throw new Error(result?.message||"检测到部分库存差异已处理，Sales 状态不会回写。请先检查 History。");

    // V11.4: the correction commit already advances config.revision. A normal pull would
    // therefore return `unchanged` and leave the browser on the pre-commit snapshot.
    // Force a canonical full pull before validating stock / Line Key.
    await pullLatestAfterSalesCommitV83(true);

    // V11.4 final client verification: canonical data pulled back from Google Sheet
    // must contain every expected AFTER stock and exact Line Key before Sales is marked done.
    const verifiedProducts=getProducts();
    for(const e of expected){
      const p=verifiedProducts.find(x=>String(x.id||"").trim()===String(e.productId||"").trim());
      if(!p) throw new Error(`云端验证失败：找不到产品 ${e.productId}。Sales 提醒不会关闭。`);
      const actual=Math.max(0,Math.trunc(Number(p.stock)||0));
      if(actual!==Math.max(0,Math.trunc(Number(e.after)||0))) throw new Error(`云端验证失败：${p.name||e.productId} 当前库存 ${actual}，预期 ${e.after}。Sales 提醒不会关闭。`);
      const rows=getProductStockAdjustments(p);
      const hasLine=rows.some(a=>(Array.isArray(a?.salesLinks)?a.salesLinks:[]).some(l=>String(l?.key||"").trim()===String(e.lineKey||"").trim()));
      if(!hasLine) throw new Error(`云端验证失败：${p.name||e.productId} 没有本次 History / Line Key。Sales 提醒不会关闭。`);
    }

    await completeSalesManualCorrectionRemoteV102(item);
    return result;
  } catch(e){
    if(original.products===null)localStorage.removeItem("importSystemProducts");else localStorage.setItem("importSystemProducts",original.products);
    if(original.imports===null)localStorage.removeItem("importSystemImports");else localStorage.setItem("importSystemImports",original.imports);
    if(original.batches===null)localStorage.removeItem("importSystemBatches");else localStorage.setItem("importSystemBatches",original.batches);
    throw e;
  }
}

function confirmSalesInventoryLinkRemoteV81(item) {
  // V11.7: Sales Restore generation is reused per locked card operation.
  // Retry only the Sales acknowledgement; inventory is never deducted here.
  return confirmSalesAckWithRestoreGenerationV117(item, false);
}

async function executeSalesInventoryDeductionV81(item) {
  const key = String(item?.key || getSalesInventoryItemKeyV77(item));
  recomputeSalesInventoryPendingV77();
  const currentPending = salesInventoryPendingV77.find(row => row.key === key);
  if (!currentPending) {
    return { ok: false, message: "这项 Sales 库存已经处理或不再需要处理。" };
  }

  if (typeof commitSalesInventoryToCloudV83 !== "function") {
    return { ok: false, message: "V8.7 云端库存确认模块未载入，请强制刷新网页后再试。" };
  }

  const previousProducts = getProducts();
  const products = previousProducts.map(product => ({ ...product }));
  const productIndex = products.findIndex(
    product => String(product?.id || "") === String(currentPending.importProductId || "")
  );
  if (productIndex < 0) {
    return { ok: false, message: "Import Cost System 找不到对应产品，无法自动扣库存。" };
  }

  const product = products[productIndex];
    if(item.englishName&&!product.englishName)products[productIndex]={...product,englishName:item.englishName};
  const currentStock = Math.max(0, Math.trunc(Number(product.stock) || 0));
  const qty = Math.max(1, Math.trunc(Number(currentPending.remainingQty) || 0));
  const commitSalesKeyV122 = getSalesInventoryCommitKeyV122(
    currentPending,
    currentPending.processedQty,
    qty
  );

  if (currentStock < qty) {
    return {
      ok: false,
      message:
        `库存不足，已阻止自动扣除。\n\n` +
        `产品：${product.name}\n` +
        `当前库存：${formatNumber(currentStock)}\n` +
        `Sales 待扣：${formatNumber(qty)}`
    };
  }

  const nextStock = currentStock - qty;
  const note = buildSalesInventoryAutoNoteV81(currentPending);
  const confirmed = window.confirm(
    `确认销售并扣库存？\n\n` +
    `产品：${product.name}\n` +
    `销售数量：${formatNumber(qty)} 棵\n` +
    `库存：${formatNumber(currentStock)} → ${formatNumber(nextStock)}\n` +
    `记录类型：实际卖出\n` +
    `备注：${note}\n\n` +
    `V8.7 会等 Google Sheet 真正保存成功后才显示完成。`
  );
  if (!confirmed) return { ok: false, cancelled: true };

  const previousImports = getImports();
  const previousBatches = getBatches();

  // V8.7 continues to reuse the existing FIFO + actual-sale accounting logic.
  // Calculation happens locally first, but NOTHING is committed locally until
  // Google Sheet confirms the transaction.
  const allocation = allocateProductRemainingFIFO(
    product.id,
    product.name,
    nextStock,
    "sale",
    "实际卖出",
    note
  );

  if (!allocation.ok) {
    return { ok: false, message: allocation.message || "库存扣除失败。" };
  }

  const salesLinks = [{
    key: commitSalesKeyV122,
    accountingKey: String(currentPending.key || getSalesInventoryItemKeyV77(currentPending)),
    linkId: String(currentPending.linkId || ""),
    saleId: String(currentPending.saleId || ""),
    productId: String(currentPending.productId || ""),
    productName: String(currentPending.productName || currentPending.importProductName || ""),
    processedQty: qty,
    saleDate: String(currentPending.saleDate || ""),
    saleTime: String(currentPending.saleTime || ""),
    type: String(currentPending.type || ""),
    location: String(currentPending.location || ""),
    source: getSalesSourceNameV77(currentPending)
  }];

  const adjustmentData = appendProductStockAdjustments(
    product,
    allocation.changes,
    allocation.changedAt,
    currentStock,
    nextStock,
    salesLinks
  );

  const nextProduct = {
    ...product,
    ...adjustmentData,
    stock: nextStock,
    inventoryArchived: nextStock > 0 ? false : product.inventoryArchived,
    updatedAt: allocation.changedAt || new Date().toISOString()
  };
  products[productIndex] = nextProduct;

  const changedImports = allocation.nextImports.filter((row, index) =>
    JSON.stringify(row) !== JSON.stringify(previousImports[index])
  );
  const changedBatches = allocation.nextBatches.filter((row, index) =>
    JSON.stringify(row) !== JSON.stringify(previousBatches[index])
  );

  let cloudResult;
  try {
    cloudResult = await commitSalesInventoryToCloudV83({
      salesKey: commitSalesKeyV122,
      expectedStockBefore: currentStock,
      expectedStockAfter: nextStock,
      product: nextProduct,
      imports: changedImports,
      batches: changedBatches
    });
  } catch (error) {
    // V8.7 hard safety: the browser stays at the ORIGINAL inventory when cloud
    // commit fails. No fake 33→32 success, no Sales confirmation, no local queue.
    return {
      ok: false,
      cloudFailed: true,
      message:
        `❌ 扣库存失败，Google Sheet 未确认保存。\n\n` +
        `产品：${product.name}\n` +
        `库存仍视为：${formatNumber(currentStock)}\n\n` +
        `${String(error?.message || error || "云端保存失败")}\n\n` +
        `请不要手动重复扣库存；同步正常后再按一次确认。`
    };
  }

  if (cloudResult?.alreadyProcessed) {
    // The server had committed this salesKey before the response reached this
    // browser. Pull the canonical data; this is idempotent and never deducts twice.
    if (typeof pullLatestAfterSalesCommitV83 === "function") {
      await pullLatestAfterSalesCommitV83();
    }
  } else {
    // Only AFTER server confirmation do we mirror the committed canonical state
    // into localStorage. Do not mark the generic full-snapshot queue dirty.
    localStorage.setItem("importSystemProducts", JSON.stringify(products));
    localStorage.setItem("importSystemImports", JSON.stringify(allocation.nextImports));
    localStorage.setItem("importSystemBatches", JSON.stringify(allocation.nextBatches));
  }

  // Only after Import cloud commit succeeds do we mark the Sales link confirmed.
  let remoteConfirmed = true;
  let remoteError = "";
  try {
    await confirmSalesInventoryLinkRemoteV81(currentPending);
  } catch (error) {
    remoteConfirmed = false;
    remoteError = String(error?.message || error || "");
  }

  recomputeSalesInventoryPendingV77();
  renderDashboard();
  renderInventoryManagementList();
  renderBatchList();
  if (document.getElementById("batchProductStockSearch")?.value?.trim()) {
    renderBatchProductStockResults();
  }

  return {
    ok: true,
    productName: product.name,
    qty,
    currentStock,
    nextStock,
    note,
    remoteConfirmed,
    remoteError,
    alreadyProcessed: Boolean(cloudResult?.alreadyProcessed)
  };
}

async function executeSalesInventoryCardBatchV125(lines) {
  const freshLines = (Array.isArray(lines) ? lines : []).filter(x => x && !x.legacy);
  if (!freshLines.length) return { ok: true, qty: 0, lineCount: 0, alreadyProcessed: false };
  if (typeof commitSalesInventoryBatchToCloudV125 !== "function") {
    throw new Error("V24.6 整张销售卡批量库存模块未载入，请强制刷新网页后再试。");
  }

  const saleId = String(freshLines[0]?.item?.saleId || freshLines[0]?.item?.transactionId || "").trim();
  if (!saleId) throw new Error("销售卡缺少 Sale ID，已停止整张处理。");

  const original = {
    products: localStorage.getItem("importSystemProducts"),
    imports: localStorage.getItem("importSystemImports"),
    batches: localStorage.getItem("importSystemBatches")
  };
  const restoreOriginal = () => {
    if (original.products === null) localStorage.removeItem("importSystemProducts"); else localStorage.setItem("importSystemProducts", original.products);
    if (original.imports === null) localStorage.removeItem("importSystemImports"); else localStorage.setItem("importSystemImports", original.imports);
    if (original.batches === null) localStorage.removeItem("importSystemBatches"); else localStorage.setItem("importSystemBatches", original.batches);
  };

  const expectedMap = new Map();
  let totalQty = 0;
  try {
    for (let i = 0; i < freshLines.length; i += 1) {
      const x = freshLines[i];
      const currentPending = x.item;
      const productId = String(x.product?.id || currentPending?.importProductId || "").trim();
      const products = getProducts().map(p => ({ ...p }));
      const productIndex = products.findIndex(p => String(p?.id || "").trim() === productId);
      if (productIndex < 0) throw new Error(`Import 找不到对应产品：${x.product?.name || currentPending?.productName || productId}`);

      const product = products[productIndex];
      const currentStock = Math.max(0, Math.trunc(Number(product.stock) || 0));
      const qty = Math.max(1, Math.trunc(Number(x.qty || currentPending?.remainingQty || currentPending?.quantity || 1)));
      if (currentStock < qty) throw new Error(`库存不足：${product.name}，当前 ${currentStock}，需要扣除 ${qty}`);

      const nextStock = currentStock - qty;
      const commitKey = getSalesInventoryCommitKeyV122(currentPending, currentPending.processedQty, qty);
      const note = buildSalesInventoryAutoNoteV81(currentPending);
      const allocation = allocateProductRemainingFIFO(product.id, product.name, nextStock, "sale", "实际卖出", note);
      if (!allocation.ok) throw new Error(`${product.name}：${allocation.message || "FIFO / Batch 库存计算失败"}`);

      const salesLinks = [{
        key: commitKey,
        accountingKey: String(currentPending.key || getSalesInventoryItemKeyV77(currentPending)),
        linkId: String(currentPending.linkId || ""),
        saleId: String(currentPending.saleId || ""),
        productId: String(currentPending.productId || ""),
        productName: String(currentPending.productName || currentPending.importProductName || ""),
        processedQty: qty,
        saleDate: String(currentPending.saleDate || ""),
        saleTime: String(currentPending.saleTime || ""),
        type: String(currentPending.type || ""),
        location: String(currentPending.location || ""),
        source: getSalesSourceNameV77(currentPending)
      }];
      const adjustmentData = appendProductStockAdjustments(product, allocation.changes, allocation.changedAt, currentStock, nextStock, salesLinks);
      products[productIndex] = {
        ...product,
        ...adjustmentData,
        stock: nextStock,
        inventoryArchived: nextStock > 0 ? false : product.inventoryArchived,
        updatedAt: allocation.changedAt || new Date().toISOString()
      };

      localStorage.setItem("importSystemProducts", JSON.stringify(products));
      localStorage.setItem("importSystemImports", JSON.stringify(allocation.nextImports));
      localStorage.setItem("importSystemBatches", JSON.stringify(allocation.nextBatches));

      const prev = expectedMap.get(productId);
      if (prev) {
        prev.after = nextStock;
        prev.qty += qty;
        prev.lineKeys.push(commitKey);
      } else {
        expectedMap.set(productId, { productId, before: currentStock, after: nextStock, qty, lineKeys: [commitKey] });
      }
      totalQty += qty;
    }

    const expected = [...expectedMap.values()];
    const finalProducts = getProducts();
    const finalImports = getImports();
    const finalBatches = getBatches();
    const touchedIds = new Set(expected.map(e => String(e.productId || "")));
    const touchedProducts = finalProducts.filter(p => touchedIds.has(String(p.id || "")));

    const originalImports = JSON.parse(original.imports || "[]");
    const originalBatches = JSON.parse(original.batches || "[]");
    const originalImportMap = new Map(originalImports.map(r => [String(r.id || ""), JSON.stringify(r)]));
    const originalBatchMap = new Map(originalBatches.map(r => [String(r.id || ""), JSON.stringify(r)]));
    const touchedImports = finalImports.filter(r => originalImportMap.get(String(r.id || "")) !== JSON.stringify(r));
    const touchedBatches = finalBatches.filter(r => originalBatchMap.get(String(r.id || "")) !== JSON.stringify(r));

    // Do not expose staged browser values until Google Sheet confirms the whole card.
    restoreOriginal();
    const result = await commitSalesInventoryBatchToCloudV125({
      saleId,
      cardKey: `sales-card:${saleId}`,
      expected,
      products: touchedProducts,
      imports: touchedImports,
      batches: touchedBatches
    });
    if (!result?.ok) throw new Error(result?.message || result?.error || "整张销售卡库存处理失败。");
    if (result?.partialProcessed) throw new Error(result?.message || "检测到销售卡只有部分库存项目曾被处理，已停止整张写入。");

    // V19.8: the batch endpoint has already flushed and verified Products,
    // Imports, Batches, History and Sales Keys atomically. Apply the exact staged
    // canonical rows immediately; the ordinary background sync can refresh the
    // rest later without holding this inventory operation open.
    if(result?.alreadyProcessed&&typeof pullLatestAfterSalesCommitV83==="function"){
      restoreOriginal();
      await pullLatestAfterSalesCommitV83();
    }else{
      localStorage.setItem("importSystemProducts", JSON.stringify(finalProducts));
      localStorage.setItem("importSystemImports", JSON.stringify(finalImports));
      localStorage.setItem("importSystemBatches", JSON.stringify(finalBatches));
      if(typeof refreshSystemViewsAfterSync==="function")refreshSystemViewsAfterSync();
    }

    const verifiedProducts = getProducts();
    for (const e of expected) {
      const p = verifiedProducts.find(row => String(row.id || "").trim() === String(e.productId || "").trim());
      if (!p) throw new Error(`云端验证失败：找不到产品 ${e.productId}`);
      const actual = Math.max(0, Math.trunc(Number(p.stock) || 0));
      if (actual !== Math.max(0, Math.trunc(Number(e.after) || 0))) throw new Error(`云端验证失败：${p.name || e.productId} 当前库存 ${actual}，预期 ${e.after}`);
      const rows = getProductStockAdjustments(p);
      for (const lineKey of e.lineKeys) {
        const hasLine = rows.some(adj => (Array.isArray(adj?.salesLinks) ? adj.salesLinks : []).some(link => String(link?.key || "").trim() === String(lineKey || "").trim()));
        if (!hasLine) throw new Error(`云端验证失败：${p.name || e.productId} History 缺少 Sales Key`);
      }
    }

    return { ok: true, qty: totalQty, lineCount: freshLines.length, alreadyProcessed: Boolean(result?.alreadyProcessed) };
  } catch (error) {
    restoreOriginal();
    throw error;
  }
}

async function executeSalesInventoryDeductionV104NoPrompt(item) {
  const key = String(item?.key || getSalesInventoryItemKeyV77(item));
  recomputeSalesInventoryPendingV77();
  const currentPending = salesInventoryPendingV77.find(row => row.key === key);
  if (!currentPending) {
    return { ok: false, message: "这项 Sales 库存已经处理或不再需要处理。" };
  }

  if (typeof commitSalesInventoryToCloudV83 !== "function") {
    return { ok: false, message: "V8.7 云端库存确认模块未载入，请强制刷新网页后再试。" };
  }

  const previousProducts = getProducts();
  const products = previousProducts.map(product => ({ ...product }));
  const productIndex = products.findIndex(
    product => String(product?.id || "") === String(currentPending.importProductId || "")
  );
  if (productIndex < 0) {
    return { ok: false, message: "Import Cost System 找不到对应产品，无法自动扣库存。" };
  }

  const product = products[productIndex];
  const currentStock = Math.max(0, Math.trunc(Number(product.stock) || 0));
  const qty = Math.max(1, Math.trunc(Number(currentPending.remainingQty) || 0));
  const commitSalesKeyV122 = getSalesInventoryCommitKeyV122(
    currentPending,
    currentPending.processedQty,
    qty
  );

  if (currentStock < qty) {
    return {
      ok: false,
      message:
        `库存不足，已阻止自动扣除。\n\n` +
        `产品：${product.name}\n` +
        `当前库存：${formatNumber(currentStock)}\n` +
        `Sales 待扣：${formatNumber(qty)}`
    };
  }

  const nextStock = currentStock - qty;
  const note = buildSalesInventoryAutoNoteV81(currentPending);
  // V11.4 card-level confirmation already completed; do not prompt per product.

  const previousImports = getImports();
  const previousBatches = getBatches();

  // V8.7 continues to reuse the existing FIFO + actual-sale accounting logic.
  // Calculation happens locally first, but NOTHING is committed locally until
  // Google Sheet confirms the transaction.
  const allocation = allocateProductRemainingFIFO(
    product.id,
    product.name,
    nextStock,
    "sale",
    "实际卖出",
    note
  );

  if (!allocation.ok) {
    return { ok: false, message: allocation.message || "库存扣除失败。" };
  }

  const salesLinks = [{
    key: commitSalesKeyV122,
    accountingKey: String(currentPending.key || getSalesInventoryItemKeyV77(currentPending)),
    linkId: String(currentPending.linkId || ""),
    saleId: String(currentPending.saleId || ""),
    productId: String(currentPending.productId || ""),
    productName: String(currentPending.productName || currentPending.importProductName || ""),
    processedQty: qty,
    saleDate: String(currentPending.saleDate || ""),
    saleTime: String(currentPending.saleTime || ""),
    type: String(currentPending.type || ""),
    location: String(currentPending.location || ""),
    source: getSalesSourceNameV77(currentPending)
  }];

  const adjustmentData = appendProductStockAdjustments(
    product,
    allocation.changes,
    allocation.changedAt,
    currentStock,
    nextStock,
    salesLinks
  );

  const nextProduct = {
    ...product,
    ...adjustmentData,
    stock: nextStock,
    inventoryArchived: nextStock > 0 ? false : product.inventoryArchived,
    updatedAt: allocation.changedAt || new Date().toISOString()
  };
  products[productIndex] = nextProduct;

  const changedImports = allocation.nextImports.filter((row, index) =>
    JSON.stringify(row) !== JSON.stringify(previousImports[index])
  );
  const changedBatches = allocation.nextBatches.filter((row, index) =>
    JSON.stringify(row) !== JSON.stringify(previousBatches[index])
  );

  let cloudResult;
  try {
    cloudResult = await commitSalesInventoryToCloudV83({
      salesKey: commitSalesKeyV122,
      expectedStockBefore: currentStock,
      expectedStockAfter: nextStock,
      product: nextProduct,
      imports: changedImports,
      batches: changedBatches
    });
  } catch (error) {
    // V8.7 hard safety: the browser stays at the ORIGINAL inventory when cloud
    // commit fails. No fake 33→32 success, no Sales confirmation, no local queue.
    return {
      ok: false,
      cloudFailed: true,
      message:
        `❌ 扣库存失败，Google Sheet 未确认保存。\n\n` +
        `产品：${product.name}\n` +
        `库存仍视为：${formatNumber(currentStock)}\n\n` +
        `${String(error?.message || error || "云端保存失败")}\n\n` +
        `请不要手动重复扣库存；同步正常后再按一次确认。`
    };
  }

  if (cloudResult?.alreadyProcessed) {
    // The server had committed this salesKey before the response reached this
    // browser. Pull the canonical data; this is idempotent and never deducts twice.
    if (typeof pullLatestAfterSalesCommitV83 === "function") {
      await pullLatestAfterSalesCommitV83();
    }
  } else {
    // Only AFTER server confirmation do we mirror the committed canonical state
    // into localStorage. Do not mark the generic full-snapshot queue dirty.
    localStorage.setItem("importSystemProducts", JSON.stringify(products));
    localStorage.setItem("importSystemImports", JSON.stringify(allocation.nextImports));
    localStorage.setItem("importSystemBatches", JSON.stringify(allocation.nextBatches));
  }

  // Only after Import cloud commit succeeds do we mark the Sales link confirmed.
  let remoteConfirmed = true;
  let remoteError = "";
  try {
    await confirmSalesInventoryLinkRemoteV81(currentPending);
  } catch (error) {
    remoteConfirmed = false;
    remoteError = String(error?.message || error || "");
  }

  recomputeSalesInventoryPendingV77();
  renderDashboard();
  renderInventoryManagementList();
  renderBatchList();
  if (document.getElementById("batchProductStockSearch")?.value?.trim()) {
    renderBatchProductStockResults();
  }

  return {
    ok: true,
    productName: product.name,
    qty,
    currentStock,
    nextStock,
    note,
    remoteConfirmed,
    remoteError,
    alreadyProcessed: Boolean(cloudResult?.alreadyProcessed)
  };
}

let salesStartupSessionItemsV82 = [];

function copySalesStartupProductNameV82(name, element) {
  const text = String(name || "").trim();
  if (!text) return;
  const original = element?.textContent || text;
  const done = () => {
    if (element) {
      element.textContent = "已复制";
      element.classList.add("copied-v82");
      window.setTimeout(() => {
        element.textContent = original;
        element.classList.remove("copied-v82");
      }, 900);
    }
  };
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(done).catch(() => {});
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); done(); } catch (_) {}
  ta.remove();
}
window.copySalesStartupProductNameV82 = copySalesStartupProductNameV82;

function closeStartupSalesInventoryReminderV81(force = false) {
  if (salesInventoryOperationActiveV115 && !force) return false;
  document.getElementById("salesInventoryStartupOverlayV81")?.remove();
  return true;
}

function getSalesStartupSessionItemV82(key) {
  return salesStartupSessionItemsV82.find(item => String(item.key || "") === String(key || ""));
}

function salesItemAlreadyProcessedLocallyV104(item, product) {
  const key = String(item?.key || getSalesInventoryItemKeyV77(item)).trim();
  if (!key || !product) return false;

  let rows = [];
  if (Array.isArray(product.stockAdjustments)) {
    rows = product.stockAdjustments;
  } else {
    try {
      const parsed = JSON.parse(String(product.stockAdjustmentsJson || "[]"));
      rows = Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      rows = [];
    }
  }

  // V24.6: batch commits store a unique commit key plus the stable Sales
  // accounting key.  Either one proves that inventory was already committed.
  // This keeps a still-pending Sales card visible as ACK-only after a timeout
  // instead of silently dropping it and risking a later duplicate deduction.
  return rows.some(adj =>
    Array.isArray(adj?.salesLinks) &&
    adj.salesLinks.some(link => {
      const commitKey = String(link?.key || "").trim();
      const accountingKey = String(link?.accountingKey || "").trim();
      return commitKey === key || accountingKey === key;
    })
  );
}

function salesReminderDateTimeV113(item){
  const d=String(item?.saleDate||item?.date||"").trim();
  let t=String(item?.saleTime||"").trim();
  if(!t){const raw=String(item?.createdAt||item?.updatedAt||"");const m=raw.match(/(?:T|\s)(\d{1,2}):(\d{2})/);if(m)t=`${m[1].padStart(2,"0")}:${m[2]}`;}
  if(t)t=t.slice(0,5);return [d,t].filter(Boolean).join(" ");
}

function salesCardGroupsV104(items){
  const map=new Map();
  (items||[]).forEach(item=>{
    const manual=isSalesManualCorrectionTaskV102(item);
    const id=manual?`manual:${item.key}`:String(item.saleId||item.transactionId||item.key||"");
    if(!map.has(id))map.set(id,[]);map.get(id).push(item);
  });
  return [...map.values()];
}

function renderStartupSalesInventoryReminderV81() {
  const overlay = document.getElementById("salesInventoryStartupOverlayV81");
  if (!overlay) return;
  const body = overlay.querySelector(".sales-startup-body-v81");
  const summary = overlay.querySelector(".sales-startup-summary-v81");
  if (!body || !summary) return;

  const groups = salesCardGroupsV104(salesStartupSessionItemsV82);
  const processed = salesStartupSessionItemsV82.filter(x => x.v82Processed).length;
  const pending = Math.max(0, salesStartupSessionItemsV82.length - processed);
  const pendingGroups = salesCardGroupsV104(salesStartupSessionItemsV82.filter(x => !x.v82Processed));
  const adjustmentCount = salesStartupSessionItemsV82.filter(x => !x.v82Processed).reduce((sum,x)=>sum+(isSalesManualCorrectionTaskV102(x)?Math.max(1,(x.inventoryChanges||[]).length):1),0);
  summary.innerHTML = `<div>共有 ${pendingGroups.length} 张销售卡待处理</div><div>涉及 ${adjustmentCount} 项产品库存调整</div>`;

  const cards = [];
  for (const group of groups) {
    try {
      const first = group[0] || {};
      const manual = isSalesManualCorrectionTaskV102(first);
      if (manual) {
        const changes = Array.isArray(first.inventoryChanges) ? first.inventoryChanges : [];
        cards.push(`<div class="sales-startup-item-v81 manual-correction-v102" data-sales-key="${escapeHTML(first.key || "")}">
          <div class="sales-manual-title-v102">⚠️ 已确认销售卡库存差异</div>
          <div class="sales-startup-meta-v81">${escapeHTML(salesReminderDateTimeV113(first))}${salesReminderDateTimeV113(first)?" · ":""}已确认销售后的产品/数量修改</div>
          <div class="sales-card-open-row-v120">
            <button type="button" class="sales-open-card-v118 sales-open-card-v119 sales-open-card-v120" data-sales-key="${escapeHTML(first.key || "")}">↩ 查看这张销售卡</button>
          </div>
          ${changes.map(c => { const r=salesManualChangeTextV102(c); const product=findCorrectionProductV108(c); const stock=product?Math.max(0,Math.trunc(Number(product.stock)||0)):null; const after=stock==null?null:stock+(r.direction==="restore"?r.qty:-r.qty); return `<div class="sales-manual-change-v102 ${r.actionClass}"><button type="button" class="sales-copy-name-v108" data-copy="${escapeHTML(r.name)}">${escapeHTML(r.name)}</button><div>当前库存：<strong>${stock==null?"找不到产品":formatNumber(stock)}</strong> → <strong>${after==null?"—":formatNumber(after)}</strong> <span>（${escapeHTML(r.label)}）</span></div></div>`; }).join("")}
          <button type="button" class="sales-auto-correct-v108" data-sales-key="${escapeHTML(first.key || "")}">自动处理全部库存差异（${changes.length} 项）</button>
        </div>`);
        continue;
      }

      const saleId = String(first.saleId || first.transactionId || "");
      const channel = String(getSalesChannelV91(first) || first.type || "Sales");
      const source = String(getSalesSourceNameV77(first) || first.location || "");
      const saleDate = salesReminderDateTimeV113(first);
      const active = group.filter(x => !x.v82Processed);
      const lineHtml = [];
      let groupBlocked = false;

      group.forEach((item, index) => {
        const product = findImportProductForSalesItemV77(item);
        const name = String(item.importProductName || item.productName || product?.name || "未找到产品");
        const qty = Math.max(1, Math.trunc(Number(item.remainingQty || item.quantity || 1)));
        const stock = product ? Math.max(0, Math.trunc(Number(product.stock) || 0)) : 0;
        const legacy = Boolean(item?.legacyAckOnlyV105);
        const insufficient = !legacy && product && stock < qty;
        if (!product || insufficient) groupBlocked = true;

        let statusHtml = "";
        if (!product) {
          statusHtml = `<div class="sales-card-stock-v106 error-v106">❌ Import 找不到对应产品，整张销售卡禁止处理</div>`;
        } else if (legacy) {
          statusHtml = `<div class="sales-card-stock-v106 legacy-v106">✓ 库存已实际处理 · 仅补回 Sales 完成状态</div>`;
        } else {
          statusHtml = `<div class="sales-card-stock-v106${insufficient ? " error-v106" : ""}">
            <span>销售：<strong>${formatNumber(qty)} 棵</strong></span>
            <span>当前库存：<strong>${formatNumber(stock)}</strong> → <strong>${formatNumber(stock - qty)}</strong></span>
          </div>`;
        }

        lineHtml.push(`<div class="sales-card-line-v106">
          <div class="sales-card-line-no-v106">产品 ${index + 1}</div>
          <button type="button" class="sales-card-product-v106" onclick='copySalesStartupProductNameV82(${JSON.stringify(name)}, this)'>${escapeHTML(name)}</button>
          ${statusHtml}
        </div>`);
      });

      cards.push(`<div class="sales-startup-card-v106" data-sale-id="${escapeHTML(saleId)}">
        <div class="sales-card-head-v106">${escapeHTML(channel)} · ${escapeHTML(source)} · ${escapeHTML(saleDate)}</div>
        <div class="sales-card-open-row-v120">
          <button type="button" class="sales-open-card-v118 sales-open-card-v119 sales-open-card-v120" data-sale-id="${escapeHTML(saleId)}">↩ 查看这张销售卡</button>
        </div>
        ${lineHtml.join("")}
        ${active.length
          ? `<button type="button" class="sales-card-confirm-v104" data-sale-id="${escapeHTML(saleId)}" ${groupBlocked ? "disabled" : ""}>${groupBlocked ? "资料异常，整张销售卡已阻止处理" : `确认处理这张销售卡库存（${active.length} 项）`}</button>`
          : `<button type="button" class="sales-card-confirm-v104" disabled>✓ 整张销售卡已处理</button>`}
        <div class="sales-card-safety-v106">确认前显示的是 Import 当前真实库存。任何一项找不到产品或库存不足，整张销售卡都会停止处理。</div>
      </div>`);
    } catch (error) {
      console.error("V11.4 Sales card render failed", error, group);
      cards.push(`<div class="sales-startup-card-v106 error-card-v106"><strong>❌ 销售卡资料显示失败</strong><div>${escapeHTML(String(error?.message || error))}</div><div>为安全起见，已禁止扣库存。请同步后重试。</div></div>`);
    }
  }

  body.innerHTML = cards.join("");
}
function showStartupSalesInventoryReminderV80() {
  if (window.__salesStartupReminderShownV80) return;
  window.__salesStartupReminderShownV80 = true;

  recomputeSalesInventoryPendingV77();
  if (!salesInventoryPendingV77.length) return;

  // V8.7: freeze the current reminder list for this open popup session.
  // Processed rows stay visible and locked until the user closes the window.
  salesStartupSessionItemsV82 = salesInventoryPendingV77.map(item => ({ ...item, v82Processed: false }));

  document.getElementById("salesInventoryStartupOverlayV81")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "salesInventoryStartupOverlayV81";
  overlay.className = "sales-startup-overlay-v81";
  overlay.innerHTML = `
    <div class="sales-startup-dialog-v81" role="dialog" aria-modal="true" aria-labelledby="salesStartupTitleV81">
      <div class="sales-startup-head-v81">
        <div>
          <strong id="salesStartupTitleV81">⚠️ Sales System 销售库存待处理</strong>
          <div class="sales-startup-summary-v81"></div>
        </div>
        <button type="button" class="sales-startup-close-v81" aria-label="关闭">×</button>
      </div>
      <div class="sales-startup-body-v81"></div>
      <div class="sales-startup-foot-v81">
        <small>Sales销售卡确认后只发送一次扣库存任务。已确认销售卡永久锁定；取消、退货或换货请在 Import 手动调整库存并填写备注。</small>
        <button type="button" class="sales-startup-later-v81">稍后处理</button>
      </div>
    </div>`;

  overlay.querySelector(".sales-startup-close-v81")?.addEventListener("click", closeStartupSalesInventoryReminderV81);
  overlay.querySelector(".sales-startup-later-v81")?.addEventListener("click", closeStartupSalesInventoryReminderV81);

  overlay.addEventListener("click", async event => {
    const copyNameButton = event.target.closest(".sales-copy-name-v108");
    if (copyNameButton) { copySalesCorrectionProductNameV108(copyNameButton.dataset.copy); return; }

    const openCardButton = event.target.closest(".sales-open-card-v118");
    if (openCardButton) {
      const saleId=String(openCardButton.dataset.saleId||"");
      const key=String(openCardButton.dataset.salesKey||"");
      const item= key ? getSalesStartupSessionItemV82(key) : salesStartupSessionItemsV82.find(x=>String(x.saleId||x.transactionId||"")===saleId);
      if(item)openAssociatedSalesCardV118(item);
      return;
    }

    const autoButton = event.target.closest(".sales-auto-correct-v108");
    if (autoButton && !autoButton.disabled) {
      const key=String(autoButton.dataset.salesKey||""); const sessionItem=getSalesStartupSessionItemV82(key); if(!sessionItem||sessionItem.v82Processed)return;
      // V12.3: one click starts the safe transaction directly. The parent reminder
      // remains visible and uses the same locked progress banner as normal Sales cards.
      const channel=getSalesChannelV91(sessionItem), source=getSalesSourceNameV77(sessionItem), date=String(sessionItem?.saleDate||"");
      const note=`Sales · ${channel} · ${source} · ${date} · 销售卡修改`;
      setSalesInventoryOperationLockV117(true,"🔒 正在处理销售卡库存差异，请勿关闭页面…");
      const oldText=autoButton.textContent;
      autoButton.disabled=true;
      autoButton.textContent="⏳ 处理中…";
      try {
        await prepareSalesInventoryOperationV117();
        updateSalesInventoryOperationStageV117("🔄 正在写入 Import 库存差异…");
        await executeSalesCorrectionBatchV110(sessionItem,note);
        sessionItem.v82Processed=true;
        updateSalesInventoryOperationStageV117("🔄 正在核对最终状态…");
        await refreshSalesInventoryFeedV77({silent:true});
        salesStartupSessionItemsV82=salesInventoryPendingV77.map(item=>({...item,v82Processed:false}));
        if(!salesStartupSessionItemsV82.length)closeStartupSalesInventoryReminderV81(true);
        else renderStartupSalesInventoryReminderV81();
        alert("✅ 库存差异处理完成\n\nImport 库存与 Sales 完成状态已核对。");
      } catch(error) {
        autoButton.disabled=false; autoButton.textContent=oldText;
        alert("自动处理失败："+String(error?.message||error)+"。全部库存差异没有部分提交；请同步后再试。");
      } finally { setSalesInventoryOperationLockV117(false); }
      return;
    }

    const button=event.target.closest(".sales-card-confirm-v104");
    if(!button||button.disabled)return;
    const saleId=String(button.dataset.saleId||"");
    const group=salesStartupSessionItemsV82.filter(x=>String(x.saleId||x.transactionId||"")===saleId&&!x.v82Processed&&!isSalesManualCorrectionTaskV102(x));
    if(!group.length)return;
    recomputeSalesInventoryPendingV77();
    const live=group.map(x=>salesInventoryPendingV77.find(r=>String(r.key||"")===String(x.key||""))).filter(Boolean);
    if(!live.length){alert("这张销售卡已经处理，系统不会再次扣库存。");return;}
    const lines=[];let totalQty=0;
    for(const item of live){const product=findImportProductForSalesItemV77(item);if(!product){alert(`找不到对应产品：${item.productName||""}。整张销售卡没有扣库存。`);return;}const legacy=Boolean(item?.legacyAckOnlyV105);const qty=legacy?0:Math.max(1,Math.trunc(Number(item.remainingQty||item.quantity||1)));if(!legacy&&Math.max(0,Math.trunc(Number(product.stock)||0))<qty){alert(`库存不足：${product.name}。整张销售卡没有扣库存。`);return;}lines.push({item,product,qty,legacy});totalQty+=qty;}
    if(!confirm(`确认处理这张销售卡的待处理库存？\n\n${lines.map(x=>x.legacy?`${x.product.name}（库存已处理，仅回写 Sales）`:`${x.product.name} 需再扣 ×${x.qty}`).join("\n")}\n\n本次实际再扣 ${totalQty} 棵。处理期间会锁定窗口；云端确认过的 Sales Key 永远不会重复扣库存。`))return;
    button.disabled=true;
    button.textContent="⏳ 处理中…";
    try{
      await prepareSalesInventoryOperationV117();
      button.textContent="🔒 库存处理中，请勿关闭页面…";
      let completed=0, committedQty=0, ackPendingError="";

      for(const x of lines.filter(x=>x.legacy)){
        updateSalesInventoryOperationStageV117(`🔄 库存已处理，正在补回 Sales 完成状态（${completed+1}/${lines.length}）…`);
        try { await confirmSalesInventoryLinkRemoteV81(x.item); completed++; }
        catch(error){ ackPendingError=String(error?.message||error||"Sales 完成状态回写失败"); break; }
      }

      if(!ackPendingError){
        const fresh=lines.filter(x=>!x.legacy);
        if(fresh.length){
          updateSalesInventoryOperationStageV117(`🔄 正在一次处理整张销售卡库存（${fresh.length} 项）…`);
          const batchResult=await executeSalesInventoryCardBatchV125(fresh);
          committedQty+=Number(batchResult?.qty||0);
          // Inventory is already committed atomically. ACK each Sales line only after
          // canonical Import verification; an ACK failure never re-deducts inventory.
          for(let i=0;i<fresh.length;i++){
            const x=fresh[i];
            updateSalesInventoryOperationStageV117(`🔄 库存已完成，正在回写 Sales 状态（${i+1}/${fresh.length}）…`);
            try { await confirmSalesInventoryLinkRemoteV81(x.item); completed++; }
            catch(error){ ackPendingError=String(error?.message||error||"Import 库存已处理，但 Sales 完成状态尚未回写。"); break; }
          }
        }
      }

      updateSalesInventoryOperationStageV117("🔄 正在核对最终状态…");
      await refreshSalesInventoryFeedV77({silent:true});
      recomputeSalesInventoryPendingV77();
      salesStartupSessionItemsV82=salesInventoryPendingV77.map(item=>({...item,v82Processed:false}));
      if(typeof refreshSystemViewsAfterSync==="function")refreshSystemViewsAfterSync();

      if(ackPendingError){
        setSalesInventoryOperationLockV117(false);
        alert(`⚠️ Import 库存已进入安全等待状态。\n\n${ackPendingError}\n\n已经确认的库存不会再次扣除。下次只会补回 Sales 完成状态。`);
        if(salesStartupSessionItemsV82.length)renderStartupSalesInventoryReminderV81();else closeStartupSalesInventoryReminderV81(true);
        return;
      }

      setSalesInventoryOperationLockV117(false);
      alert(`✅ 库存处理完成\n\n已完成 ${completed} 项，本次实际扣库存 ${committedQty} 棵。Sales 完成状态已回写。`);
      if(!salesStartupSessionItemsV82.length)closeStartupSalesInventoryReminderV81(true);else renderStartupSalesInventoryReminderV81();
    }catch(error){
      setSalesInventoryOperationLockV117(false);
      const message=String(error?.message||error);
      const restorePrecheckFailed=/Sales Restore 状态读取超时|无法连接 Sales System 读取 Restore 状态|无法读取 Sales Restore 状态/i.test(message);

      if(restorePrecheckFailed){
        // V24.6: prepareSalesInventoryOperationV117 runs before any inventory
        // commit.  If that read-only Restore precheck times out, nothing has been
        // deducted yet, so keep the frozen reminder exactly as-is.  Do not replace
        // it with a transient/empty feed result and make the card disappear.
        salesStartupSessionItemsV82=salesStartupSessionItemsV82.map(item=>({...item,v82Processed:false}));
        renderStartupSalesInventoryReminderV81();
        alert("❌ 处理未完成："+message+"\n\n本次尚未开始扣库存，待处理销售卡已保留。请稍后重试；已写入的 Sales Key 仍会防止重复扣库存。");
      }else{
        await refreshSalesInventoryFeedV77({silent:true}).catch(()=>{});
        recomputeSalesInventoryPendingV77();
        salesStartupSessionItemsV82=salesInventoryPendingV77.map(item=>({...item,v82Processed:false}));
        if(salesStartupSessionItemsV82.length)renderStartupSalesInventoryReminderV81();
        alert("❌ 处理未完成："+message+"\n\n系统已重新核对状态。已成功写入的 Sales Key 不会重复扣库存；未写入的项目才会继续等待处理。");
      }
    } finally { setSalesInventoryOperationLockV117(false); }
  });

  document.body.appendChild(overlay);
  renderStartupSalesInventoryReminderV81();
  window.setTimeout(()=>{
    const preferredRow=overlay.querySelector(".sales-startup-item-v81.preferred-v85");
    if(preferredRow)preferredRow.scrollIntoView({block:"center",behavior:"smooth"});
  },120);
}

function getPendingSalesForProductV77(product) {
  recomputeSalesInventoryPendingV77();
  return salesInventoryPendingV77.filter(item => String(item.importProductId || "") === String(product?.id || ""));
}

function buildProductPendingSalesHtmlV77(product) {
  // V8.7: Sales 库存提醒由首次打开 / 回到前台触发。
  // 产品/进口修改页以及其他页面仍不显示嵌入式 Sales 待处理提示。
  return "";
}

function allocatePendingSalesForProductV77(product, quantity) {
  let left = Math.max(0, Math.trunc(Number(quantity) || 0));
  if (!left) return [];
  const pending = getPendingSalesForProductV77(product).slice();
  pending.sort((a, b) => {
    const ap = a.key === preferredSalesInventoryKeyV77 ? 0 : 1;
    const bp = b.key === preferredSalesInventoryKeyV77 ? 0 : 1;
    if (ap !== bp) return ap - bp;
    const da = parseDateDDMMYYYY(a.saleDate)?.getTime() || 0;
    const db = parseDateDDMMYYYY(b.saleDate)?.getTime() || 0;
    return da - db || String(a.saleTime || "").localeCompare(String(b.saleTime || ""));
  });
  const allocations = [];
  pending.forEach(item => {
    if (!left) return;
    const used = Math.min(left, item.remainingQty);
    if (!used) return;
    allocations.push({
      key: item.key,
      linkId: String(item.linkId || ""),
      saleId: String(item.saleId || ""),
      productId: String(item.productId || ""),
      productName: String(item.productName || item.importProductName || ""),
      processedQty: used,
      saleDate: String(item.saleDate || ""),
      saleTime: String(item.saleTime || ""),
      type: String(item.type || ""),
      location: String(item.location || ""),
      source: getSalesSourceNameV77(item)
    });
    left -= used;
  });
  return allocations;
}

function describeSalesAllocationsV77(allocations) {
  return (allocations || []).map(link => {
    const when = [link.saleDate, formatSalesTimeV77(link.saleTime)].filter(Boolean).join(" ");
    return `• ${link.source || link.location || "Sales"} · ${when} · ${link.productName} ×${formatNumber(link.processedQty)}`;
  }).join("\n");
}

let salesInventoryResumeTimerV84 = null;
let salesInventoryLastResumeCheckV84 = 0;
let salesInventoryResumeCheckBusyV84 = false;

async function checkSalesInventoryOnResumeV84(reason = "resume") {
  if (document.hidden || salesInventoryResumeCheckBusyV84) return;

  const now = Date.now();
  // Safari/Chrome may emit visibilitychange + focus + pageshow together.
  // One actual return to the app/tab should cause only one Feed request/reminder.
  if (now - salesInventoryLastResumeCheckV84 < 1200) return;
  salesInventoryLastResumeCheckV84 = now;
  salesInventoryResumeCheckBusyV84 = true;

  try {
    if (typeof cloudInitialSyncComplete !== "undefined" && !cloudInitialSyncComplete) return;

    await refreshSalesInventoryFeedV77({ silent: true });
    recomputeSalesInventoryPendingV77();

    // If the reminder is already open, do not create a duplicate.
    if (document.getElementById("salesInventoryStartupOverlayV81")) return;
    if (!salesInventoryPendingV77.length) return;

    // V8.7: every genuine resume/focus may remind again when pending inventory exists.
    window.__salesStartupReminderShownV80 = false;
    showStartupSalesInventoryReminderV80();
  } catch (error) {
    console.warn(`V8.7 Sales inventory ${reason} check failed`, error);
  } finally {
    salesInventoryResumeCheckBusyV84 = false;
  }
}

function scheduleSalesInventoryResumeCheckV84(reason = "resume") {
  if (document.hidden) return;
  window.clearTimeout(salesInventoryResumeTimerV84);
  salesInventoryResumeTimerV84 = window.setTimeout(
    () => checkSalesInventoryOnResumeV84(reason),
    SALES_INVENTORY_RESUME_DELAY_V103
  );
}

function setupSalesInventoryReminder() {
  if (!window.__salesInventoryOperationGuardsV117) {
    window.__salesInventoryOperationGuardsV117 = true;
    document.addEventListener("click", blockSalesInventoryNavigationV117, true);
    window.addEventListener("beforeunload", event => {
      if (!salesInventoryOperationActiveV115) return;
      event.preventDefault();
      event.returnValue = "库存正在处理，请等待完成。";
      return event.returnValue;
    });
  }
  // V8.7:
  // 1) first page open -> check and remind;
  // 2) iPhone switches away and returns -> check and remind again if still pending;
  // 3) desktop tab/app loses focus and returns -> same behaviour;
  // 4) no pending Sales -> no popup;
  // 5) processed links never reappear because Feed/Import status is the source of truth.
  const panel = document.getElementById("salesInventoryReminderPanel");
  if (panel) panel.hidden = true;

  const start = async () => {
    await refreshSalesInventoryFeedV77({ silent: true });
    window.__salesStartupReminderShownV80 = false;
    showStartupSalesInventoryReminderV80();

    window.clearInterval(salesInventoryRefreshTimerV77);
    salesInventoryRefreshTimerV77 = window.setInterval(() => {
      if (!document.hidden) refreshSalesInventoryFeedV77({ silent: true });
    }, SALES_INVENTORY_REFRESH_MS_V77);
  };

  // V13.7: Sales pending feed is small and starts independently. Full Import
  // sync continues in parallel and never delays the pending-card popup.
  window.setTimeout(start, SALES_INVENTORY_BACKGROUND_START_DELAY_V103);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) scheduleSalesInventoryResumeCheckV84("visibilitychange");
  });

  window.addEventListener("focus", () => {
    scheduleSalesInventoryResumeCheckV84("focus");
  });

  window.addEventListener("pageshow", () => {
    scheduleSalesInventoryResumeCheckV84("pageshow");
  });
}

const DEFAULT_ACCESS_PASSWORD_HASH =
  "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92";
const DEFAULT_ACCESS_PASSWORD_HINT = "6个数字";
const ACCESS_UNLOCK_SESSION_KEY =
  "loverLegendImportSystemUnlocked";
const DESKTOP_SAVED_PASSWORD_KEY =
  "loverLegendDesktopSavedPassword";
const RESTORE_JOB_LOCAL_KEY = "loverLegendRestoreJobV75";
let dataOperationActive = false;
let restoreJobPollTimer = null;

async function hashAccessPassword(value) {
  const bytes = new TextEncoder().encode(String(value || ""));
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

function buildAccessPasswordHint(password) {
  const characters = Array.from(String(password || ""));
  let letters = 0;
  let digits = 0;
  let symbols = 0;

  characters.forEach(character => {
    if (/[A-Za-z]/.test(character)) {
      letters += 1;
    } else if (/[0-9]/.test(character)) {
      digits += 1;
    } else {
      symbols += 1;
    }
  });

  const parts = [];

  if (letters > 0) {
    parts.push(`${letters}个英文字`);
  }

  if (symbols > 0) {
    parts.push(`${symbols}个符号`);
  }

  if (digits > 0) {
    parts.push(`${digits}个数字`);
  }

  return parts.join(" ") || "密码提示暂不可用";
}

function getAccessPasswordSettings() {
  const settings = loadJSON("importSystemSettings", {});

  return {
    hash: String(
      settings.accessPasswordHash ||
      DEFAULT_ACCESS_PASSWORD_HASH
    ),
    hint: String(
      settings.accessPasswordHint ||
      DEFAULT_ACCESS_PASSWORD_HINT
    )
  };
}

function updatePasswordHintDisplays() {
  const hint = getAccessPasswordSettings().hint;

  const lockHint =
    document.getElementById("accessPasswordHint");
  const settingsHint =
    document.getElementById("currentPasswordHint");

  if (lockHint) {
    lockHint.textContent = `密码提示：${hint}`;
  }

  if (settingsHint) {
    settingsHint.textContent = hint;
  }
}


const BIOMETRIC_CREDENTIAL_KEY =
  "loverLegendBiometricCredentialId";
const BIOMETRIC_USER_ID_KEY =
  "loverLegendBiometricUserId";

function bytesToBase64Url(bytes) {
  const binary = Array.from(bytes)
    .map(byte => String.fromCharCode(byte))
    .join("");

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  const normalized = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const padded =
    normalized + "=".repeat((4 - normalized.length % 4) % 4);

  const binary = atob(padded);
  return Uint8Array.from(
    binary,
    character => character.charCodeAt(0)
  );
}

function randomBytes(length = 32) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function getStoredBiometricCredentialId() {
  return String(
    localStorage.getItem(BIOMETRIC_CREDENTIAL_KEY) || ""
  );
}

function isBiometricCredentialStored() {
  return Boolean(getStoredBiometricCredentialId());
}

function isMobileOrTabletDevice() {
  const userAgent = String(navigator.userAgent || "");

  const mobileUserAgent =
    /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);

  const touchAppleDevice =
    /Macintosh/i.test(userAgent) &&
    Number(navigator.maxTouchPoints || 0) > 1;

  return mobileUserAgent || touchAppleDevice;
}

async function isPlatformBiometricAvailable() {
  // 电脑端不启用 WebAuthn / Passkey，避免 Chrome 或
  // Google Password Manager 弹出 Windows PIN 验证。
  // Face ID / Touch ID / Android 指纹只在手机和平板使用。
  if (!isMobileOrTabletDevice()) {
    return false;
  }

  if (
    !window.PublicKeyCredential ||
    !navigator.credentials ||
    !window.isSecureContext
  ) {
    return false;
  }

  try {
    return await PublicKeyCredential
      .isUserVerifyingPlatformAuthenticatorAvailable();
  } catch (error) {
    return false;
  }
}

async function registerDeviceBiometric() {
  if (!(await isPlatformBiometricAvailable())) {
    throw new Error(
      "此设备或浏览器不支持 Face ID / 生物辨识"
    );
  }

  let userId = localStorage.getItem(
    BIOMETRIC_USER_ID_KEY
  );

  if (!userId) {
    userId = bytesToBase64Url(randomBytes(16));
    localStorage.setItem(BIOMETRIC_USER_ID_KEY, userId);
  }

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(32),
      rp: {
        name: "Lover Legend Import System"
      },
      user: {
        id: base64UrlToBytes(userId),
        name: "lover-legend-user",
        displayName: "Lover Legend"
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 }
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "discouraged",
        requireResidentKey: false,
        userVerification: "required"
      },
      timeout: 60000,
      attestation: "none"
    }
  });

  if (!credential?.rawId) {
    throw new Error("无法建立生物辨识凭证");
  }

  const credentialId = bytesToBase64Url(
    new Uint8Array(credential.rawId)
  );

  localStorage.setItem(
    BIOMETRIC_CREDENTIAL_KEY,
    credentialId
  );

  updateDeviceBiometricStatus();
  return true;
}

async function authenticateDeviceBiometric() {
  const credentialId =
    getStoredBiometricCredentialId();

  if (!credentialId) return false;

  if (!(await isPlatformBiometricAvailable())) {
    return false;
  }

  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32),
        allowCredentials: [{
          type: "public-key",
          id: base64UrlToBytes(credentialId),
          transports: ["internal"]
        }],
        userVerification: "required",
        timeout: 60000
      }
    });

    return Boolean(assertion);
  } catch (error) {
    return false;
  }
}

function clearDeviceBiometric() {
  localStorage.removeItem(BIOMETRIC_CREDENTIAL_KEY);
  localStorage.removeItem(BIOMETRIC_USER_ID_KEY);
  updateDeviceBiometricStatus();
}

async function updateDeviceBiometricStatus() {
  const status =
    document.getElementById("deviceBiometricStatus");
  const setupButton =
    document.getElementById("setupBiometricBtn");
  const removeButton =
    document.getElementById("removeBiometricBtn");
  const loginButton =
    document.getElementById("biometricLoginBtn");

  const available =
    await isPlatformBiometricAvailable();
  const registered =
    isBiometricCredentialStored();

  const isMobileDevice =
    isMobileOrTabletDevice();

  if (status) {
    status.textContent = !isMobileDevice
      ? "电脑使用已储存密码登录"
      : !available
        ? "此手机不支持"
        : registered
          ? "已启用"
          : "尚未启用";
  }

  if (setupButton) {
    setupButton.hidden = !isMobileDevice;
    setupButton.disabled = !available;
  }

  if (removeButton) {
    removeButton.hidden = !isMobileDevice;
    removeButton.disabled = !registered;
  }

  if (loginButton) {
    loginButton.hidden =
      !(isMobileDevice && available && registered);
  }
}

function unlockAccessLock(lock, input, status) {
  sessionStorage.setItem(
    ACCESS_UNLOCK_SESSION_KEY,
    "1"
  );

  // V33.9: bind unlock to this exact history entry on both desktop and mobile.
  // Refreshing the same tab stays unlocked; a newly opened page/tab must authenticate again.
  try {
    history.replaceState({
      ...(history.state || {}),
      loverLegendMobileUnlockedV213: isMobileOrTabletDevice() ? 1 : Number(history.state?.loverLegendMobileUnlockedV213 || 0),
      loverLegendDesktopUnlockedV320: !isMobileOrTabletDevice() ? 1 : Number(history.state?.loverLegendDesktopUnlockedV320 || 0)
    }, "");
  } catch (_) {}

  if (status) status.textContent = "";
  if (lock) lock.hidden = true;

  document.body.classList.remove("access-locked");
  document.documentElement.classList.remove("biometric-auto-pending-v304");
  document.documentElement.classList.add("access-lock-ready");
}

function setupDeviceBiometricSettings() {
  const setupButton =
    document.getElementById("setupBiometricBtn");
  const removeButton =
    document.getElementById("removeBiometricBtn");

  setupButton?.addEventListener("click", async () => {
    const status =
      document.getElementById("passwordChangeStatus");

    if (!window.confirm("确认启用或重新设置此设备的 Face ID／生物辨识登录？")) return;

    try {
      if (status) {
        status.textContent =
          "请使用 Face ID / 生物辨识确认...";
        status.classList.remove("error-status");
      }

      await registerDeviceBiometric();

      if (status) {
        status.textContent =
          "此设备已启用 Face ID / 生物辨识";
      }
    } catch (error) {
      if (status) {
        status.textContent =
          error?.name === "NotAllowedError"
            ? "已取消设置生物辨识"
            : String(error?.message || "设置失败");
        status.classList.add("error-status");
      }
    }
  });

  removeButton?.addEventListener("click", () => {
    const confirmed = window.confirm(
      "确认关闭此设备的 Face ID / 生物辨识登录？"
    );

    if (!confirmed) return;

    clearDeviceBiometric();

    const status =
      document.getElementById("passwordChangeStatus");

    if (status) {
      status.textContent =
        "此设备已关闭生物辨识登录";
      status.classList.remove("error-status");
    }
  });

  updateDeviceBiometricStatus();
}

function setupAccessLock() {
  // V21.4: follow the proven V20.8 desktop access flow.
  // Desktop may remember/prefill the saved password, but a new tab must still
  // show the password screen and wait for the user to click “进入系统”.
  if (!isMobileOrTabletDevice()) {
    localStorage.removeItem("loverLegendDesktopTrustedAccess");
    localStorage.removeItem("loverLegendDesktopTrustedAccessV212");
  }

  const lock = document.getElementById("accessLock");
  const form = document.getElementById("accessLockForm");
  const input = document.getElementById("accessPasswordInput");
  const status = document.getElementById("accessLockStatus");
  const hintButton =
    document.getElementById("showPasswordHintBtn");
  const hintBox =
    document.getElementById("accessPasswordHint");
  const biometricButton =
    document.getElementById("biometricLoginBtn");
  const biometricStatus =
    document.getElementById("biometricLoginStatus");

  if (!lock || !form || !input || !status) return;

  updatePasswordHintDisplays();
  updateDeviceBiometricStatus();

  // V33.9 desktop: if a saved password is still valid, verify locally and enter
  // immediately. No network request and no password/logo flash. Invalid saved
  // passwords are cleared and the normal password card is shown.
  let savedDesktopPasswordV316 = "";
  if (!isMobileOrTabletDevice()) {
    savedDesktopPasswordV316 = String(localStorage.getItem(DESKTOP_SAVED_PASSWORD_KEY) || "");
    if (savedDesktopPasswordV316) input.value = savedDesktopPasswordV316;
  }

  hintButton?.addEventListener("click", () => {
    updatePasswordHintDisplays();

    if (hintBox) {
      hintBox.hidden = !hintBox.hidden;
    }

    if (hintButton) {
      hintButton.textContent =
        hintBox && !hintBox.hidden
          ? "隐藏密码提示"
          : "忘记密码？查看提示";
    }
  });

  const tryBiometricLogin = async ({
    automatic = false
  } = {}) => {
    if (
      !isBiometricCredentialStored() ||
      !(await isPlatformBiometricAvailable())
    ) {
      return false;
    }

    if (biometricStatus) {
      biometricStatus.hidden = false;
      biometricStatus.textContent =
        "请使用 Face ID / 生物辨识确认...";
    }

    const verified =
      await authenticateDeviceBiometric();

    if (verified) {
      unlockAccessLock(lock, input, status);

      if (biometricStatus) {
        biometricStatus.textContent = "";
        biometricStatus.hidden = true;
      }

      return true;
    }

    if (biometricStatus) {
      biometricStatus.hidden = false;
      biometricStatus.textContent =
        automatic
          ? "可输入密码进入系统"
          : "生物辨识未完成，请输入密码";
    }

    input.focus();
    return false;
  };

  biometricButton?.addEventListener(
    "click",
    () => tryBiometricLogin()
  );

  const sessionUnlockedV213 =
    sessionStorage.getItem(ACCESS_UNLOCK_SESSION_KEY) === "1";
  const alreadyUnlocked = isMobileOrTabletDevice()
    ? sessionUnlockedV213 && Number(history.state?.loverLegendMobileUnlockedV213 || 0) === 1
    : sessionUnlockedV213 && Number(history.state?.loverLegendDesktopUnlockedV320 || 0) === 1;

  if (alreadyUnlocked) {
    lock.hidden = true;
    document.body.classList.remove("access-locked");
    document.documentElement.classList.remove("biometric-auto-pending-v304", "desktop-auto-pending-v316");
    document.documentElement.classList.add("access-lock-ready");
  } else {
    lock.hidden = false;
    document.body.classList.add("access-locked");
    document.documentElement.classList.remove("access-lock-ready");

    const startAutomaticLoginV319 = async () => {
      if (isMobileOrTabletDevice()) {
        const biometricUsed = await tryBiometricLogin({ automatic: true });
        document.documentElement.classList.remove("biometric-auto-pending-v304");
        if (!biometricUsed) input.focus();
      } else {
        document.documentElement.classList.remove("desktop-auto-pending-v316");
        input.focus();
      }
    };
    void startAutomaticLoginV319();
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const password = String(input.value || "");

    if (!password) {
      status.textContent = "请输入密码";
      return;
    }

    const hash = await hashAccessPassword(password);
    const correctHash = getAccessPasswordSettings().hash;

    if (hash !== correctHash) {
      status.textContent = "密码错误，可查看密码提示";
      input.select();
      return;
    }

    if (!isMobileOrTabletDevice()) {
      localStorage.setItem(DESKTOP_SAVED_PASSWORD_KEY, password);
    }

    unlockAccessLock(lock, input, status);

    // 此设备首次使用正确密码进入后，自动邀请建立
    // Face ID / Touch ID / Android 指纹 / Windows Hello。
    if (
      !isBiometricCredentialStored() &&
      await isPlatformBiometricAvailable()
    ) {
      try {
        await registerDeviceBiometric();
      } catch (error) {
        // 用户取消或设备不允许时保持密码登录，不阻止进入。
        console.info(
          "Biometric enrollment skipped:",
          error?.name || error
        );
      }
    }
  });
}

function setupPasswordChange() {
  const button =
    document.getElementById("changeAccessPasswordBtn");

  if (!button) return;

  updatePasswordHintDisplays();

  button.addEventListener("click", async () => {
    const oldInput =
      document.getElementById("oldAccessPassword");
    const newInput =
      document.getElementById("newAccessPassword");
    const confirmInput =
      document.getElementById("confirmAccessPassword");
    const status =
      document.getElementById("passwordChangeStatus");

    const oldPassword = String(oldInput?.value || "");
    const newPassword = String(newInput?.value || "");
    const confirmPassword = String(confirmInput?.value || "");

    if (!oldPassword || !newPassword || !confirmPassword) {
      status.textContent = "请填写旧密码、新密码和确认密码";
      status.classList.add("error-status");
      return;
    }

    if (
      Array.from(newPassword).length > 12 ||
      Array.from(confirmPassword).length > 12
    ) {
      status.textContent = "密码最多12个字";
      status.classList.add("error-status");
      return;
    }

    if (newPassword !== confirmPassword) {
      status.textContent = "两次输入的新密码不一致";
      status.classList.add("error-status");
      return;
    }

    const oldHash = await hashAccessPassword(oldPassword);

    if (oldHash !== getAccessPasswordSettings().hash) {
      status.textContent = "旧密码不正确";
      status.classList.add("error-status");
      return;
    }

    if (!window.confirm("确认保存新的系统密码？\n\n保存后，下一次登录必须使用新密码。")) {
      status.textContent = "已取消，系统密码没有改变";
      status.classList.remove("error-status");
      return;
    }

    const newHash = await hashAccessPassword(newPassword);
    const newHint = buildAccessPasswordHint(newPassword);
    const settings = loadJSON("importSystemSettings", {});

    saveJSON("importSystemSettings", {
      ...settings,
      accessPasswordHash: newHash,
      accessPasswordHint: newHint
    });

    if (!isMobileOrTabletDevice()) {
      localStorage.setItem(DESKTOP_SAVED_PASSWORD_KEY, newPassword);
    }

    if (typeof markCloudSettingsSaved === "function") {
      markCloudSettingsSaved();
    }

    oldInput.value = "";
    newInput.value = "";
    confirmInput.value = "";

    updatePasswordHintDisplays();

    status.textContent =
      `密码已更改 · 提示：${newHint} · 正在同步`;
    status.classList.remove("error-status");

    window.clearTimeout(status._hideTimer);
    status._hideTimer = window.setTimeout(() => {
      status.textContent = "";
    }, 3000);
  });
}

window.updatePasswordHintDisplays =
  updatePasswordHintDisplays;

function repairLegacyImportDates() {
  const repair = value => {
    const text = String(value || "").trim();

    if (!text) return "";

    if (parseDateDDMMYYYY(text)) {
      const validMatch = text.match(
        /^(\d{2})-(\d{2})-(\d{4})$/
      );

      if (validMatch) {
        const year = Number(validMatch[3]);

        // Previous versions could wrongly store 2026 as 2726.
        if (year >= 2700 && year <= 2799) {
          const corrected =
            `${validMatch[1]}-${validMatch[2]}-20${validMatch[3].slice(-2)}`;

          if (parseDateDDMMYYYY(corrected)) {
            return corrected;
          }
        }
      }

      return text;
    }

    // Old masking bug:
    // 21-07-26 -> 21-00-7726
    const brokenMask = text.match(
      /^(\d{2})-00-(\d)(\d{3})$/
    );

    if (brokenMask) {
      const corrected =
        `${brokenMask[1]}-` +
        `${brokenMask[2].padStart(2, "0")}-` +
        `20${brokenMask[3].slice(-2)}`;

      if (parseDateDDMMYYYY(corrected)) {
        return corrected;
      }
    }

    const shortYear = text.match(
      /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/
    );

    if (shortYear) {
      const corrected =
        `${String(Number(shortYear[1])).padStart(2, "0")}-` +
        `${String(Number(shortYear[2])).padStart(2, "0")}-` +
        `20${shortYear[3]}`;

      if (parseDateDDMMYYYY(corrected)) {
        return corrected;
      }
    }

    return text;
  };

  const products = getProducts();
  const imports = getImports();
  const batches = getBatches();

  let changed = false;

  products.forEach(product => {
    const corrected = repair(product.lastImport);

    if (corrected !== product.lastImport) {
      product.lastImport = corrected;
      changed = true;
    }
  });

  imports.forEach(record => {
    ["date", "containerDate", "arrivalDate"].forEach(key => {
      const corrected = repair(record[key]);

      if (corrected !== record[key]) {
        record[key] = corrected;
        changed = true;
      }
    });
  });

  batches.forEach(batch => {
    ["date", "containerDate", "arrivalDate"].forEach(key => {
      const corrected = repair(batch[key]);

      if (corrected !== batch[key]) {
        batch[key] = corrected;
        changed = true;
      }
    });

    // V6.8: keep V6.8 data model unchanged. Legacy/non-array items are
    // skipped here instead of being parsed or rewritten during startup.
    // This prevents the V4.24 compatibility repair from mutating synced data.
    const batchItems = Array.isArray(batch.items) ? batch.items : [];

    batchItems.forEach(item => {
      if (!item || typeof item !== "object") return;

      ["date", "containerDate", "arrivalDate"].forEach(key => {
        const corrected = repair(item[key]);

        if (corrected !== item[key]) {
          item[key] = corrected;
          changed = true;
        }
      });
    });
  });

  if (changed) {
    // 日期修复只修正日期字段，不得重算库存或 Average Cost。
    saveProducts(products);
    saveImports(imports);
    saveBatches(batches);
  }
}

function setupNavigation() {
  const buttons = document.querySelectorAll(".nav-btn");
  const pages = document.querySelectorAll(".page");
  const mobileNavV212 = isMobileOrTabletDevice();

  // V21.4: on phones/tablets the bottom navigation is app navigation, not a
  // web hyperlink. Remove href so long-press cannot offer Open Link In New Tab.
  if (mobileNavV212) {
    buttons.forEach(button => {
      if (button.tagName === "A") {
        button.dataset.desktopHrefV212 = button.getAttribute("href") || "";
        button.removeAttribute("href");
        button.setAttribute("role", "button");
        button.setAttribute("draggable", "false");
        button.classList.add("mobile-no-new-tab-v212");
        button.addEventListener("contextmenu", event => event.preventDefault());
        button.addEventListener("auxclick", event => event.preventDefault());
      }
    });
  }

  buttons.forEach(button => {
    button.addEventListener("click", event => {
      if (button.tagName === "A" && (event.ctrlKey || event.metaKey || event.shiftKey || event.button === 1)) return;
      if (button.tagName === "A") event.preventDefault();
      const target = button.dataset.page;

      // V13.7: a Restore remains protected until the persisted server job is
      // success/failed, including final verification and polling intervals.
      const current=document.querySelector('.nav-btn.active')?.dataset?.page||'';
      if(target!==current&&typeof isInventoryMediaSaveInProgressV252==="function"&&isInventoryMediaSaveInProgressV252()){
        window.alert("照片／视频正在上传并确认云端状态，请等待显示上传成功或失败后再切换页面。");
        return;
      }
      if(target!==current&&!confirmLeaveOriginalCostEditV219())return;
      if(target!==current&&current==="importPage"&&!confirmDiscardImportDraftChangesV243("切换页面"))return;
      if(target!==current&&current==="dashboardPage"){
        const inventoryQueryV317=String(document.getElementById("inventorySearch")?.value||"").trim();
        if(!inventoryQueryV317) closeOriginalCostPanel();
      }
      if(target!==current&&current==="supplierPage"){const a=document.getElementById("inventoryMasterPanelV264"),qa=String(document.getElementById("inventoryMasterSearchV261")?.value||"").trim();if(a&&!qa)a.open=false;const p=document.querySelector(".product-prefix-settings-v181"),k=String(document.getElementById("newProductPrefixKeyword")?.value||"").trim(),c=String(document.getElementById("newProductPrefixCode")?.value||"").trim();if(p&&!k&&!c&&!editingProductPrefixKeywordV229)p.open=false;}
      if(target!==current&&current==="settingsPage"){
        if(!confirmDiscardStaleZeroStockSelectionV227())return;
        if(!confirmLeaveSettingsV160())return;
        collapseStaleZeroStockPanelV227();
        collapseSettingsPanelsV196();
      }
      if(target!==current&&restoreLeaveProtectionActiveV133()&&!confirmRestoreNavigationV133())return;

      buttons.forEach(item => item.classList.remove("active"));
      pages.forEach(page => page.classList.remove("active"));

      button.classList.add("active");
      document.getElementById(target)?.classList.add("active");

      if (target === "importPage") {
        const batchSearch = document.getElementById("batchSearch");
        const productSearch =
          document.getElementById("batchProductStockSearch");
        const batchList = document.getElementById("batchList");
        const productResults =
          document.getElementById("batchProductStockResults");
        const productStatus =
          document.getElementById("batchProductStockStatus");
        const recentBatchArea =
          document.getElementById("recentBatchResultsArea");
        const toggleButton =
          document.getElementById("toggleBatchListBtn");

        if (batchSearch) batchSearch.value = "";
        if (productSearch) productSearch.value = "";

        batchListExpanded = false;

        if (batchList) batchList.innerHTML = "";
        if (productResults) {
          productResults.hidden = true;
          productResults.innerHTML = "";
        }
        if (productStatus) productStatus.textContent = "";
        if (recentBatchArea) recentBatchArea.hidden = false;
        if (toggleButton) {
          toggleButton.hidden = false;
          toggleButton.textContent = "显示全部";
          toggleButton.setAttribute("aria-expanded", "false");
        }

        renderBatchSuggestions();
      }

      if (target === "dashboardPage") {
        renderInventoryManagementList();
        renderDashboard();
      }

      if (target === "settingsPage") {
        collapseStaleZeroStockPanelV227();
      }

      if (target === "historyPage") {
        // V24.6: entering History must not auto-run a heavy query just because
        // the keyword box still contains text. Query only on 查看历史 / Enter / date action.
      }

      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

const MINIMUM_PRICE_SETTING_FIELDS_V160 = Object.freeze({
  commissionRate: { id: "minimumCommissionRate", label: "主播佣金", suffix: "%", kind: "commission" },
  margin0To300: { id: "minimumMargin0To300", label: "成本 RM0–300 净利率", suffix: "%", kind: "margin" },
  margin300To500: { id: "minimumMargin300To500", label: "成本 RM300.01–500 净利率", suffix: "%", kind: "margin" },
  margin500To800: { id: "minimumMargin500To800", label: "成本 RM500.01–799.99 净利率", suffix: "%", kind: "margin" },
  margin800To5000: { id: "minimumMargin800To5000", label: "成本 RM800–4,999.99 净利率", suffix: "%", kind: "margin" },
  margin5000To8000: { id: "minimumMargin5000To8000", label: "成本 RM5,000–7,999.99 净利率", suffix: "%", kind: "margin" },
  margin8000Plus: { id: "minimumMargin8000Plus", label: "成本 RM8,000以上净利率", suffix: "%", kind: "margin" },
  freightTierA: { id: "minimumFreightTierA", label: "A · 售价低于 RM300 木架＋本地运费", prefix: "RM " },
  freightTierB: { id: "minimumFreightTierB", label: "B · 售价 RM300–500 木架＋本地运费", prefix: "RM " },
  freightTierC: { id: "minimumFreightTierC", label: "C · 售价 RM500.01–1,000 木架＋本地运费", prefix: "RM " },
  freightTierD: { id: "minimumFreightTierD", label: "D · 售价 RM1,000.01–2,000 木架＋本地运费", prefix: "RM " },
  freightTierE: { id: "minimumFreightTierE", label: "E · 售价 RM2,000.01–4,999.99 木架＋本地运费", prefix: "RM " },
  freightTierF: { id: "minimumFreightTierF", label: "F · 售价 RM5,000以上 木架＋本地运费", prefix: "RM " },
  vndPotUnder1m: { id: "minimumVndPotUnder1m", label: "VND 原价低于 1,000,000 花盆成本", prefix: "RM " },
  vndPot1mTo4m: { id: "minimumVndPot1mTo4m", label: "VND 原价 1,000,000–3,999,999 花盆成本", prefix: "RM " },
  vndPot4mTo10m: { id: "minimumVndPot4mTo10m", label: "VND 原价 4,000,000–9,999,999 花盆成本", prefix: "RM " },
  vndPot10mPlus: { id: "minimumVndPot10mPlus", label: "VND 原价 10,000,000以上花盆成本", prefix: "RM " }
});

const DEFAULT_EXCHANGE_RATES_V160 = Object.freeze({
  CNY: 1.60,
  NTD: 7.69,
  VND: 6300.00,
  IDR: 3571.00,
  MYR: 1.00
});

function hasUnsavedSettingsChangesV160() {
  const settingsPage = document.getElementById("settingsPage");
  if (!settingsPage?.classList.contains("active")) return false;
  const saved = loadJSON("importSystemSettings", {});
  const rateIds = { CNY: "rateCNY", NTD: "rateNTD", VND: "rateVND", IDR: "rateIDR" };
  const ratesDirty = Object.entries(rateIds).some(([currency, id]) => {
    const input = document.getElementById(id);
    if (!input) return false;
    const draft = parseAmount(input.value);
    const stored = Number(saved[currency] ?? DEFAULT_EXCHANGE_RATES_V160[currency]);
    return !Number.isFinite(draft) || Math.abs(draft - stored) >= 0.0005;
  });
  if (ratesDirty) return true;

  const passwordDraftIds = ["oldAccessPassword", "newAccessPassword", "confirmAccessPassword"];
  if (passwordDraftIds.some(id => String(document.getElementById(id)?.value || "") !== "")) {
    return true;
  }
  if (["newProductPrefixKeyword", "newProductPrefixCode"].some(id =>
    String(document.getElementById(id)?.value || "").trim() !== "")) return true;

  const storedRules = getMinimumPriceRulesV160();
  return Object.entries(MINIMUM_PRICE_SETTING_FIELDS_V160).some(([key, field]) => {
    const input = document.getElementById(field.id);
    if (!input) return false;
    const draft = parseAmount(input.value);
    return !Number.isFinite(draft) || Math.abs(draft - storedRules[key]) >= 0.005;
  });
}

function discardSettingsDraftV160() {
  const saved = loadJSON("importSystemSettings", {});
  Object.entries({ CNY: "rateCNY", NTD: "rateNTD", VND: "rateVND", IDR: "rateIDR" })
    .forEach(([currency, id]) => {
      const input = document.getElementById(id);
      if (input) input.value = formatMoney(saved[currency] ?? DEFAULT_EXCHANGE_RATES_V160[currency]);
    });
  populateMinimumPriceSettingsV160();
  ["oldAccessPassword", "newAccessPassword", "confirmAccessPassword"].forEach(id => {
    const input = document.getElementById(id);
    if (input) input.value = "";
  });
  ["newProductPrefixKeyword", "newProductPrefixCode"].forEach(id => {
    const input = document.getElementById(id);
    if (input) input.value = "";
  });
}

function collapseSettingsPanelsV196() {
  document.querySelectorAll('#settingsPage details.collapsible-settings-v181').forEach(details => { details.open = false; });
}

function confirmLeaveSettingsV160() {
  if (!hasUnsavedSettingsChangesV160()) return true;
  const confirmed = window.confirm("设置页面还有未保存的修改。\n\n确定离开并放弃这些修改吗？");
  if (!confirmed) return false;
  discardSettingsDraftV160();
  return true;
}

function updateMinimumPriceCustomBadgeV202(rules = getMinimumPriceRulesV160()) {
  const badge = document.getElementById("minimumPriceCustomBadgeV202");
  if (!badge) return;
  const changed = keys => keys.some(key => Math.abs((Number(rules[key]) || 0) - (Number(DEFAULT_MINIMUM_PRICE_RULES_V160[key]) || 0)) >= 0.005);
  const groups = [];
  if (changed(["commissionRate"])) groups.push("佣金");
  if (changed(["margin0To300","margin300To500","margin500To800","margin800To5000","margin5000To8000","margin8000Plus"])) groups.push("净利");
  if (changed(["freightTierA","freightTierB","freightTierC","freightTierD","freightTierE","freightTierF"])) groups.push("运费");
  if (changed(["vndPotUnder1m","vndPot1mTo4m","vndPot4mTo10m","vndPot10mPlus"])) groups.push("VND");
  badge.textContent = groups.length === 0 ? "" : (groups.length === 1 ? `🔴 ${groups[0]}自定义` : "🔴 多项已自定义");
  badge.hidden = groups.length === 0;
}

function populateMinimumPriceSettingsV160() {
  const rules = getMinimumPriceRulesV160();
  Object.entries(MINIMUM_PRICE_SETTING_FIELDS_V160).forEach(([key, field]) => {
    const input = document.getElementById(field.id);
    if (input) input.value = formatMoney(rules[key]);
  });
  updateMinimumPriceCustomBadgeV202(rules);
}

function setupMinimumPriceSettingsV160() {
  populateMinimumPriceSettingsV160();
  Object.values(MINIMUM_PRICE_SETTING_FIELDS_V160).forEach(field => {
    const input = document.getElementById(field.id);
    if (!input) return;
    input.addEventListener("focus", () => input.select());
    input.addEventListener("blur", () => formatInputAmount(input));
    input.addEventListener("drop", event => {
      event.preventDefault();
      const status = document.getElementById("minimumPriceSettingsStatus");
      if (status) status.textContent = "已阻止拖放覆盖设置，请直接输入数值";
    });
  });

  if (!window.minimumPriceSettingsLeaveGuardBoundV160) {
    window.minimumPriceSettingsLeaveGuardBoundV160 = true;
    window.addEventListener("beforeunload", event => {
      if (!hasUnsavedSettingsChangesV160() && !hasSelectedStaleZeroStockProductsV227()) return;
      event.preventDefault();
      event.returnValue = "";
    });
  }

  const button = document.getElementById("saveMinimumPriceSettingsBtn");
  if (!button) return;
  button.addEventListener("click", () => {
    const currentRules = getMinimumPriceRulesV160();
    const nextRules = {};
    const changes = [];

    for (const [key, field] of Object.entries(MINIMUM_PRICE_SETTING_FIELDS_V160)) {
      const input = document.getElementById(field.id);
      const value = parseAmount(input?.value || "");
      const isMargin = field.kind === "margin";
      const isCommission = field.kind === "commission";
      if (!Number.isFinite(value) || value < 0 || ((isMargin || isCommission) && value >= 100)) {
        alert(isMargin
          ? `${field.label}必须是0至99.99之间。`
          : isCommission
            ? `${field.label}必须是0至99.99之间。`
            : `${field.label}必须是0或正数。`);
        input?.focus();
        return;
      }
      nextRules[key] = Math.round((value + Number.EPSILON) * 100) / 100;
      if (Math.abs(nextRules[key] - currentRules[key]) >= 0.005) {
        const oldValue = `${field.prefix || ""}${formatMoney(currentRules[key])}${field.suffix || ""}`;
        const newValue = `${field.prefix || ""}${formatMoney(nextRules[key])}${field.suffix || ""}`;
        changes.push(`${field.label}：${oldValue} → ${newValue}`);
      }
    }

    const marginKeys = ["margin0To300", "margin300To500", "margin500To800", "margin800To5000", "margin5000To8000", "margin8000Plus"];
    const invalidMarginKey = marginKeys.find(key => 1 - nextRules.commissionRate / 100 - nextRules[key] / 100 <= 0);
    if (invalidMarginKey) {
      const field = MINIMUM_PRICE_SETTING_FIELDS_V160[invalidMarginKey];
      alert(`主播佣金 ${formatMoney(nextRules.commissionRate)}% + ${field.label} ${formatMoney(nextRules[invalidMarginKey])}% 必须小于 100%。`);
      document.getElementById(field.id)?.focus();
      return;
    }

    const status = document.getElementById("minimumPriceSettingsStatus");
    if (!changes.length) {
      if (status) status.textContent = "设置没有改变";
      return;
    }

    if (!window.confirm(`确认保存以下最低售价设置？\n\n${changes.join("\n")}\n\n确认后，所有自动最低售价会立即重新计算；手动售价保持不变。`)) {
      if (status) status.textContent = "已取消，设置没有改变";
      return;
    }

    const settings = loadJSON("importSystemSettings", {});
    saveJSON("importSystemSettings", { ...settings, minimumPriceRules: nextRules });
    updateMinimumPriceCustomBadgeV202(nextRules);
    saveProducts(getProducts());
    if (typeof markCloudSettingsSaved === "function") markCloudSettingsSaved();
    renderInventoryManagementList();
    renderDashboard();
    if (status) status.textContent = "最低售价设置已保存，自动售价已重新计算";
    setTimeout(() => { if (status) status.textContent = ""; }, 2600);
  });

  const resetButton = document.getElementById("resetMinimumPriceSettingsBtn");
  if (resetButton && resetButton.dataset.boundV200 !== "1") {
    resetButton.dataset.boundV200 = "1";
    resetButton.addEventListener("click", () => {
      const warning = "Reset to Factory 会把自动最低售价管理的主播佣金、目标净利率、木架＋本地运费和 VND 花盆成本全部恢复为系统默认值。\n\n手动原最低售价不会被覆盖；促销最低售价不会被修改。";
      if (!window.confirm(`${warning}\n\n是否继续？`)) return;
      if (!window.confirm("再次确认：恢复原设置后，所有自动原最低售价会立即按默认参数重新计算。\n\n确定执行 Reset to Factory？")) return;
      const settings = loadJSON("importSystemSettings", {});
      saveJSON("importSystemSettings", { ...settings, minimumPriceRules: { ...DEFAULT_MINIMUM_PRICE_RULES_V160 } });
      populateMinimumPriceSettingsV160();
      updateMinimumPriceCustomBadgeV202(DEFAULT_MINIMUM_PRICE_RULES_V160);
      saveProducts(getProducts());
      if (typeof markCloudSettingsSaved === "function") markCloudSettingsSaved();
      renderInventoryManagementList();
      renderDashboard();
      const status = document.getElementById("minimumPriceSettingsStatus");
      if (status) status.textContent = "已恢复原设置，自动原最低售价已重新计算；手动原最低售价与促销最低售价未改变";
      setTimeout(() => { if (status) status.textContent = ""; }, 3600);
    });
  }
}

function setupSettings() {
  const defaults = DEFAULT_EXCHANGE_RATES_V160;

  const saved = loadJSON("importSystemSettings", defaults);
  const ids = {
    CNY: "rateCNY",
    NTD: "rateNTD",
    VND: "rateVND",
    IDR: "rateIDR"
  };

  document.querySelectorAll('#settingsPage input:not([type="file"])').forEach(input => {
    if (input.dataset.dropProtectionBound === "1") return;
    input.dataset.dropProtectionBound = "1";
    input.addEventListener("drop", event => {
      event.preventDefault();
      const status = document.getElementById("settingsStatus");
      if (status) status.textContent = "已阻止拖放覆盖设置，请直接输入数值或文字";
    });
  });

  Object.entries(ids).forEach(([currency, id]) => {
    const input = document.getElementById(id);
    input.value = formatMoney(saved[currency] ?? defaults[currency]);
    input.addEventListener("focus", () => input.select());
    input.addEventListener("blur", () => formatInputAmount(input));
    input.addEventListener("drop", event => {
      event.preventDefault();
      const status = document.getElementById("settingsStatus");
      if (status) status.textContent = "已阻止拖放覆盖汇率，请直接输入数值";
    });
  });

  document.getElementById("saveSettingsBtn").addEventListener("click", () => {
    const data = {};
    const changes = [];
    const currentSettings = loadJSON("importSystemSettings", {});

    Object.entries(ids).forEach(([currency, id]) => {
      data[currency] = parseAmount(document.getElementById(id).value);
      const oldValue = Number(currentSettings[currency] ?? defaults[currency]);
      if (Math.abs(data[currency] - oldValue) >= 0.0005) {
        changes.push(`${currency}：${formatMoney(oldValue)} → ${formatMoney(data[currency])}`);
      }
    });

    const status = document.getElementById("settingsStatus");
    if (Object.values(data).some(value => !Number.isFinite(value) || value <= 0)) {
      alert("汇率必须是大于0的数字。设置没有保存。");
      return;
    }
    if (!changes.length) {
      status.textContent = "汇率没有改变";
      return;
    }
    if (!window.confirm(`确认保存以下默认汇率？\n\n${changes.join("\n")}\n\n确认后，新进口记录将采用新的默认汇率。`)) {
      status.textContent = "已取消，汇率没有改变";
      return;
    }

    saveJSON("importSystemSettings", {
      ...currentSettings,
      ...data
    });

    if (typeof markCloudSettingsSaved === "function") {
      markCloudSettingsSaved();
    }

    status.textContent = "设置已保存";
    setTimeout(() => {
      status.textContent = "";
    }, 1800);
  });

  setupPasswordChange();
  setupMinimumPriceSettingsV160();
  setupProductPrefixSettingsV181();
  setupDeviceBiometricSettings();
  setupDataTools();
  setupHistoricalSalesRepairTools();
  setupCostRepairTools();
}



const COST_REPAIR_SESSION_MS_V206 = 30 * 60 * 1000;
let costRepairExpiryTimerV206 = 0;
let costRepairCountdownTimerV206 = 0;
let costRepairExpiryPendingV206 = false;

function getCostRepairModeEnabled() {
  const settings = loadJSON("importSystemSettings", {});
  if (settings.costRepairMode !== true) return false;

  const expiresAt = Number(settings.costRepairModeExpiresAt) || 0;
  if (!(expiresAt > Date.now())) {
    if (!costRepairExpiryPendingV206) {
      costRepairExpiryPendingV206 = true;
      window.setTimeout(() => {
        costRepairExpiryPendingV206 = false;
        closeCostRepairModeV206({ rollbackUnsaved: true, expired: true });
      }, 0);
    }
    return false;
  }
  return true;
}

function getCostRepairModeExpiresAtV206() {
  const settings = loadJSON("importSystemSettings", {});
  return Number(settings.costRepairModeExpiresAt) || 0;
}

function setCostRepairModeEnabled(enabled, expiresAt = 0) {
  const settings = loadJSON("importSystemSettings", {});
  saveJSON("importSystemSettings", {
    ...settings,
    costRepairMode: Boolean(enabled),
    costRepairModeExpiresAt: enabled ? Number(expiresAt || (Date.now() + COST_REPAIR_SESSION_MS_V206)) : 0
  });
  if (typeof markCloudSettingsSaved === "function") {
    markCloudSettingsSaved();
  }
}

function clearCostRepairTimersV206() {
  window.clearTimeout(costRepairExpiryTimerV206);
  window.clearInterval(costRepairCountdownTimerV206);
  costRepairExpiryTimerV206 = 0;
  costRepairCountdownTimerV206 = 0;
}

function formatCostRepairRemainingV206(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function reloadCurrentImportFromStoredV206(message = "") {
  const importNumber = String(currentEditingImportNumber || "").trim();
  if (!importNumber) return;
  const lookup = document.getElementById("batchLookupInput");
  if (lookup) lookup.value = importNumber;
  loadBatchByNumber();
  const status = document.getElementById("batchStatusText");
  if (status && message) status.textContent = message;
}

function closeCostRepairModeV206({ rollbackUnsaved = false, expired = false } = {}) {
  costRepairExpiryPendingV206 = false;
  clearCostRepairTimersV206();
  setCostRepairModeEnabled(false, 0);
  renderCostRepairModeStatus();
  if (rollbackUnsaved && currentEditingImportNumber) {
    reloadCurrentImportFromStoredV206(
      expired
        ? "Data Repair 已满30分钟自动关闭；未保存的修改已恢复到上次保存状态。"
        : "Data Repair 已关闭；未保存的修改已恢复到上次保存状态。"
    );
  }
  const status = document.getElementById("costRepairStatus");
  if (status) {
    status.textContent = expired
      ? "Data Repair 已满30分钟自动关闭。未保存修改已回滚；如需继续，请重新开启。"
      : "修改模式已关闭。未保存修改已回滚。";
  }
}

function startCostRepairSessionTimerV206() {
  clearCostRepairTimersV206();
  if (!getCostRepairModeEnabled()) {
    renderCostRepairModeStatus();
    return;
  }

  const expiresAt = getCostRepairModeExpiresAtV206();
  const remaining = expiresAt - Date.now();
  if (!(remaining > 0)) {
    closeCostRepairModeV206({ rollbackUnsaved: true, expired: true });
    return;
  }

  costRepairExpiryTimerV206 = window.setTimeout(() => {
    closeCostRepairModeV206({ rollbackUnsaved: true, expired: true });
  }, remaining);

  costRepairCountdownTimerV206 = window.setInterval(() => {
    if (!getCostRepairModeEnabled()) {
      clearCostRepairTimersV206();
      renderCostRepairModeStatus();
      return;
    }
    renderCostRepairModeStatus();
  }, 1000);
}

function getCostRevisionHistory() {
  const settings = loadJSON("importSystemSettings", {});
  return Array.isArray(settings.costRevisionHistory)
    ? settings.costRevisionHistory
    : [];
}

function appendCostRevisionHistory(entries = []) {
  if (!Array.isArray(entries) || !entries.length) return;
  const settings = loadJSON("importSystemSettings", {});
  const current = Array.isArray(settings.costRevisionHistory)
    ? settings.costRevisionHistory
    : [];
  const next = [...entries, ...current].slice(0, 2000);
  saveJSON("importSystemSettings", {
    ...settings,
    costRevisionHistory: next
  });
  if (typeof markCloudSettingsSaved === "function") {
    markCloudSettingsSaved();
  }
}

function clearCostRevisionHistoryV222() {
  const current = getCostRevisionHistory();
  if (!current.length) {
    const status = document.getElementById("costRepairStatus");
    if (status) status.textContent = "目前没有修改历史可清除。";
    return;
  }
  if (!window.confirm(`⚠️ 清除修改历史？\n\n将清除目前 ${current.length} 条资料 / 成本修改记录。\n\n这只会删除修改日志，不会改变任何进口资料、库存、成本、Sales ACK、Restore 或销售历史。`)) return;
  if (!window.confirm("最后确认：确定永久清除全部修改历史？\n\n清除后无法从系统内恢复这些日志。")) return;
  const settings = loadJSON("importSystemSettings", {});
  saveJSON("importSystemSettings", { ...settings, costRevisionHistory: [] });
  if (typeof markCloudSettingsSaved === "function") markCloudSettingsSaved();
  renderCostRevisionHistory();
  const status = document.getElementById("costRepairStatus");
  if (status) status.textContent = "修改历史已清除；进口资料、库存和成本没有改变。";
}

function updateImportDraftSaveButtonV323() {
  const button = document.getElementById("saveBatchBtn");
  if (!button || currentEditingImportNumber) return;
  const active = getActiveImportDraftV243();
  if (!active) { button.textContent = "保存草稿"; button.classList.remove("draft-saved-button-v323","draft-dirty-button-v323"); return; }
  if (hasUnsavedImportDraftChangesV243()) {
    button.textContent = "资料已修改 · 重新保存草稿";
    button.classList.remove("draft-saved-button-v323");
    button.classList.add("draft-dirty-button-v323");
  } else {
    button.textContent = "✓ 草稿已保存";
    button.classList.remove("draft-dirty-button-v323");
    button.classList.add("draft-saved-button-v323");
  }
}

function applyBatchCostEditability() {
  const isEditing = Boolean(currentEditingImportNumber);
  const repairEnabled = getCostRepairModeEnabled();
  const lockedSaved = isEditing && !repairEnabled;

  // V24.6: China-side/core import facts are immutable once saved, even when
  // Data Repair is ON. If they are wrong, copy the whole import as a new draft,
  // save the corrected new import number, then delete the wrong old import.
  [
    "batchChinaTransportCost",
    "batchPotCost",
    "batchRate"
  ].forEach(id => {
    const field = document.getElementById(id);
    if (!field) return;
    field.readOnly = isEditing;
    field.classList.toggle("cost-field-locked", isEditing);
    field.title = isEditing
      ? "内地核心成本资料保存后永久锁定；如有错误，请复制为新进口后修正，再删除旧进口。"
      : "";
  });

  const currency = document.getElementById("batchCurrency");
  if (currency) {
    currency.disabled = isEditing;
    currency.classList.toggle("cost-field-locked", isEditing);
    currency.title = isEditing ? "已保存进口的币种永久锁定。" : "";
  }

  // Logistics / Malaysia-side fields can only be changed while Data Repair is ON.
  [
    "batchRackQuantity",
    "batchTrackingNumber",
    "batchOverseasTrackingNumber",
    "batchContainerDate",
    "batchArrivalDate",
    "batchShippingMY"
  ].forEach(id => {
    const field = document.getElementById(id);
    if (!field) return;
    field.readOnly = lockedSaved;
    field.classList.toggle("cost-field-locked", lockedSaved);
    field.title = lockedSaved
      ? "Data Repair 未开启。已保存进口资料只读。"
      : (isEditing ? "Data Repair 已开启：允许修正后续物流/马来西亚资料。" : "");
  });

  ["batchContainerDatePicker", "batchArrivalDatePicker"].forEach(id => {
    const field = document.getElementById(id);
    if (!field) return;
    field.disabled = lockedSaved;
    field.classList.toggle("cost-field-locked", lockedSaved);
    field.title = lockedSaved ? "Data Repair 未开启。已保存进口资料只读。" : "";
  });

  // Product identity, category, original quantity and original cost are core facts.
  document.querySelectorAll('#batchRows input[id^="batchName-"], #batchRows input[id^="batchQty-"], #batchRows input[id^="batchPrice-"]').forEach(field => {
    field.readOnly = isEditing;
    field.classList.toggle("cost-field-locked", isEditing);
    field.title = isEditing
      ? "产品、原进口数量和原成本保存后永久锁定。原成本单项修正请使用下方专用入口；其他核心错误请复制重建。"
      : "";
  });
  document.querySelectorAll('#batchRows select[id^="batchCategory-"]').forEach(field => {
    field.disabled = isEditing;
    field.classList.toggle("cost-field-locked", isEditing);
    field.title = isEditing ? "已保存进口的产品类别锁定。" : "";
  });
  document.querySelectorAll('#batchRows .remove-item-btn').forEach(button => {
    button.disabled = isEditing;
    button.title = isEditing ? "已保存进口不能直接新增、删除或更换产品。" : "";
  });
  const addRowButton = document.getElementById("addBatchRowBtn");
  if (addRowButton) {
    addRowButton.disabled = isEditing;
    addRowButton.title = isEditing ? "已保存进口不能直接新增产品。" : "";
  }
  const saveButton = document.getElementById("saveBatchBtn");
  const formalButtonV247 = document.getElementById("confirmFormalImportBtnV247");
  const deleteDraftButtonV247 = document.getElementById("deleteCurrentImportDraftBtnV247");
  if (saveButton) {
    saveButton.disabled = isEditing && !repairEnabled;
    saveButton.textContent = isEditing
      ? (repairEnabled ? "保存 Data Repair 修改" : "已保存 · 只读")
      : "保存草稿";
    saveButton.title = isEditing
      ? (repairEnabled
          ? "只允许保存后续物流/马来西亚资料修改；内地核心资料仍锁定。"
          : "到设置开启 Data Repair 后，才可修改允许的后续资料。")
      : "第一次及后续点击都只保存草稿，不会正式入库。";
  }
  if (formalButtonV247) formalButtonV247.hidden = isEditing;
  if (deleteDraftButtonV247) deleteDraftButtonV247.hidden = isEditing || !getActiveImportDraftV243();
  if (!isEditing) updateImportDraftSaveButtonV323();
}
function renderCostRepairModeStatus() {
  const enabled = getCostRepairModeEnabled();
  const status = document.getElementById("costRepairModeStatus");
  const button = document.getElementById("toggleCostRepairModeBtn");
  if (status) {
    const remaining = Math.max(0, getCostRepairModeExpiresAtV206() - Date.now());
    status.textContent = enabled
      ? `ON · 后续资料可修改 · ${formatCostRepairRemainingV206(remaining)} 后自动关闭`
      : "OFF · 已锁定";
    status.classList.toggle("enabled", enabled);
  }
  if (button) {
    button.textContent = enabled
      ? "关闭修改模式"
      : "开启修改模式";
    button.classList.toggle("danger-action-btn", enabled);
  }
  applyBatchCostEditability();
}

function renderCostRevisionHistory() {
  const list = document.getElementById("costRevisionHistoryList");
  if (!list) return;
  const keyword = String(
    document.getElementById("costRevisionHistorySearch")?.value || ""
  ).trim().toLowerCase();
  const rows = getCostRevisionHistory().filter(entry => {
    if (!keyword) return true;
    return [
      entry.importNumber,
      entry.fieldLabel,
      entry.before,
      entry.after
    ].some(value => String(value ?? "").toLowerCase().includes(keyword));
  });

  if (!rows.length) {
    list.innerHTML = '<div class="empty-state">没有资料 / 成本修改记录。</div>';
    return;
  }

  list.innerHTML = rows.map(entry => `
    <div class="cost-revision-item">
      <div class="cost-revision-title">
        <strong>${escapeHTML(entry.importNumber || "-")}</strong>
        <span>${escapeHTML(entry.fieldLabel || "成本")}</span>
      </div>
      <div class="cost-revision-values">
        <span>修改前：${escapeHTML(String(entry.before ?? ""))}</span>
        <span>修改后：${escapeHTML(String(entry.after ?? ""))}</span>
      </div>
      <small>${escapeHTML(entry.timestamp || "")}</small>
    </div>
  `).join("");
}

function setupCostRepairTools() {
  const toggle = document.getElementById("toggleCostRepairModeBtn");
  const showHistory = document.getElementById("showCostRevisionHistoryBtn");
  const closeHistory = document.getElementById("closeCostRevisionHistoryBtn");
  const clearHistory = document.getElementById("clearCostRevisionHistoryBtn");
  const panel = document.getElementById("costRevisionHistoryPanel");
  const search = document.getElementById("costRevisionHistorySearch");
  const status = document.getElementById("costRepairStatus");

  toggle?.addEventListener("click", () => {
    const next = !getCostRepairModeEnabled();
    if (next) {
      const warningAccepted = confirm(
        "⚠️ Data Repair / 资料修改\n\n" +
        "开启后，只允许修正已保存进口的后续物流/马来西亚资料：木架数量、运输单号、装柜日期、抵达日期、海外到大马运费。\n\n" +
        "【永久锁定】产品、产品类别、原进口数量、原成本、币种、汇率、内地运输＋打木架费用、搭配花盆费用不能在这里修改。\n" +
        "这些内地核心资料如有错误，请先『复制』整张进口成为新草稿，修正并保存新进口，再删除错误旧进口。\n\n" +
        "修改海外到大马运费会按原进口编号既有成本资料，重算该进口编号内受影响产品的单位成本/平均成本；不会重新加入库存。\n\n" +
        "Data Repair 开启30分钟后自动关闭，未保存修改会回滚。\n\n继续？"
      );
      if (!warningAccepted) return;
      const finalAccepted = confirm(
        "⚠️ 最后确认开启 Data Repair\n\n" +
        "请确认只修正后续物流/马来西亚资料。\n" +
        "内地核心资料继续锁定；当前库存与原进口数量不会因此改变。\n\n确定开启？"
      );
      if (!finalAccepted) return;
      setCostRepairModeEnabled(true, Date.now() + COST_REPAIR_SESSION_MS_V206);
      startCostRepairSessionTimerV206();
      renderCostRepairModeStatus();
      if (status) status.textContent = "Data Repair 已开启30分钟。只开放允许的后续资料；内地核心资料继续锁定。";
      return;
    }

    const confirmed = confirm(
      "确认关闭 Data Repair？\n\n尚未保存的进口修改会立即恢复到上次保存状态。"
    );
    if (!confirmed) return;
    closeCostRepairModeV206({ rollbackUnsaved: true, expired: false });
  });

  showHistory?.addEventListener("click", () => {
    if (panel) panel.hidden = false;
    renderCostRevisionHistory();
  });
  closeHistory?.addEventListener("click", () => { if (panel) panel.hidden = true; });
  clearHistory?.addEventListener("click", clearCostRevisionHistoryV222);
  search?.addEventListener("input", () => scheduleSearchRenderV302("cost-revision", renderCostRevisionHistory));

  renderCostRepairModeStatus();
  if (getCostRepairModeEnabled()) startCostRepairSessionTimerV206();
}




function setupDashboard() {
  setupImportAnomalyCenterV201();
  renderDashboard();
}

function renderDashboard() {
  if (typeof migrateLegacyProductCategoriesV227 === "function") migrateLegacyProductCategoriesV227();
  const products = typeof loadJSONReadOnlyV317 === "function" ? loadJSONReadOnlyV317("importSystemProducts", []) : loadJSON("importSystemProducts", []);
  // 库存数量才是首页是否显示的最终依据。
  // 旧版本或删除批次后可能遗留 inventoryArchived=true，
  // 只要库存仍大于 0，就必须继续显示。
  const activeInventoryProducts = products.filter(
    item => (Number(item.stock) || 0) > 0
  );

  const productCount = activeInventoryProducts.length;
  const categoryOrder = typeof getProductCategoriesV227 === "function" ? getProductCategoriesV227() : ["盆栽"];
  const categoryCounts = activeInventoryProducts.reduce((counts, item) => {
    const category = normalizePrimaryProductCategoryV255(item.category || "盆栽");
    counts[category] = (counts[category] || 0) + 1;
    return counts;
  }, {});
  const categorySummary = categoryOrder
    .filter(category => (categoryCounts[category] || 0) > 0)
    .map(category => `${category}：${formatNumber(categoryCounts[category])}`)
    .join("\n");

  const stockCount = activeInventoryProducts.reduce(
    (sum, item) => sum + (Number(item.stock) || 0),
    0
  );
  const inventoryValue = activeInventoryProducts.reduce((sum, item) => {
    return sum + ((Number(item.stock) || 0) * (Number(item.averageCost) || 0));
  }, 0);

  const dates = activeInventoryProducts
    .map(item => item.lastImport)
    .filter(Boolean)
    .sort((a, b) => {
      const parse = value => {
        const [d, m, y] = value.split("-").map(Number);
        return new Date(y, m - 1, d).getTime();
      };
      return parse(b) - parse(a);
    });

  document.getElementById("productCount").textContent = categorySummary || formatNumber(productCount);
  document.getElementById("stockCount").textContent = formatNumber(stockCount);
  document.getElementById("inventoryValue").textContent = formatMoney(inventoryValue, "RM ");
  const batches = getBatches();
  const latestBatchImportDate = batches
    .map(batch => normalizeDateToDDMMYYYY(batch.arrivalDate))
    .filter(value => parseDDMMYYYY(value) > 0)
    .sort((a, b) => parseDDMMYYYY(b) - parseDDMMYYYY(a))[0];

  // V7.3: 首页「最近进口」只显示最新抵达日期；没有抵达日期则留空。
  document.getElementById("lastImport").textContent =
    latestBatchImportDate || "";

  renderImportAnomalyCenterV201();
  renderSystemInformationV203();
}

const SYSTEM_INFO_LAST_BACKUP_KEY_V203 = "loverLegendImportLastBackupV203";
const SYSTEM_INFO_LAST_RESTORE_KEY_V203 = "loverLegendImportLastRestoreV203";
let systemHealthV203 = { checked: false, checking: false, apiOk: null, apiVersion: "", schemaVersion: "", error: "", restoreJob: null };
let salesInventoryFeedLastErrorV203 = "";
let salesInventoryFeedFailureCountV226 = 0;

function formatSystemDateTimeV203(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-GB", {
    day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false
  }).replaceAll("/", "-");
}

function renderSystemInformationV203() {
  const products = getProducts();
  const imports = getImports();
  const active = products.filter(item => (Number(item?.stock) || 0) > 0);
  const stock = active.reduce((sum, item) => sum + (Number(item?.stock) || 0), 0);
  const config = typeof getCloudConfig === "function" ? getCloudConfig() : {};
  const set = (id, text) => { const el=document.getElementById(id); if(el) el.textContent=text; };
  set("systemInfoVersionV203", `正式版 ${APP_VERSION} Stable`);
  set("systemInfoApiVersionV203", systemHealthV203.apiOk === true ? `V${systemHealthV203.apiVersion || APP_VERSION}` : (systemHealthV203.apiOk === false ? "连接异常" : "尚未检查"));
  set("systemInfoGoogleSheetV203", systemHealthV203.apiOk === true ? "已连接 Google Web App" : (systemHealthV203.apiOk === false ? "连接异常" : "尚未检查"));
  set("systemInfoLastSyncV203", formatSystemDateTimeV203(config.lastSyncAt) || "尚未同步");
  const revisionElV336 = document.getElementById("settingsRevisionV185");
  if (revisionElV336) {
    const currentRevisionV336 = Number(config.revision) || 0;
    const previousRevisionV336 = Number(localStorage.getItem("importSystemPreviousRevisionV185"));
    revisionElV336.textContent = currentRevisionV336 > 0
      ? `${previousRevisionV336 > 0 && previousRevisionV336 !== currentRevisionV336 ? previousRevisionV336 : "—"} → ${currentRevisionV336}`
      : "尚未同步";
  }
  set("systemInfoLastBackupV203", formatSystemDateTimeV203(localStorage.getItem(SYSTEM_INFO_LAST_BACKUP_KEY_V203)) || "暂无记录");
  const localRestore = getLocalRestoreJob?.();
  const serverRestore = systemHealthV203.restoreJob;
  const restoreTime = (serverRestore?.state === "success" ? (serverRestore.completedAt || serverRestore.updatedAt || "") : "") || localStorage.getItem(SYSTEM_INFO_LAST_RESTORE_KEY_V203) || (localRestore?.state === "success" ? (localRestore.completedAt || localRestore.updatedAt || "") : "");
  set("systemInfoLastRestoreV203", formatSystemDateTimeV203(restoreTime) || "暂无记录");
  set("systemInfoProductCountV203", formatNumber(products.length));
  set("systemInfoStockCountV203", formatNumber(stock));
  set("systemInfoInventoryItemCountV203", formatNumber(active.length));
  set("systemInfoImportCountV203", formatNumber(imports.length));
}

async function runSystemHealthCheckV203({ refreshSales = true } = {}) {
  if (systemHealthV203.checking) return;
  systemHealthV203.checking = true;
  renderImportAnomalyCenterV201();
  try {
    const data = await callGoogleApi({ action:"healthV206", clientVersion:APP_VERSION, schemaVersion:CLOUD_SCHEMA_VERSION });
    systemHealthV203 = {
      checked:true, checking:true, apiOk:true,
      apiVersion:String(data?.clientVersion || ""),
      schemaVersion:String(data?.schemaVersion || ""),
      error:"", restoreJob:data?.restoreJob || null
    };
    if (refreshSales) await refreshSalesInventoryFeedV77({silent:true});
  } catch (error) {
    systemHealthV203 = { checked:true, checking:true, apiOk:false, apiVersion:"", schemaVersion:"", error:String(error?.message || error), restoreJob:null };
  } finally {
    systemHealthV203.checking = false;
    renderImportAnomalyCenterV201();
    renderSystemInformationV203();
  }
}

function normalizeAnomalyProductKeyV201(value) {
  return String(value || "").trim().toLowerCase();
}

function getRawRemainingQuantityV201(record) {
  const raw = Number(record?.remainingQuantity ?? record?.quantity ?? 0);
  return Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
}

function getBatchRemainingForProductV201(product, batches = getBatches()) {
  const productId = String(product?.id || "").trim();
  const productName = normalizeAnomalyProductKeyV201(product?.name);
  let total = 0;
  (batches || []).forEach(batch => {
    (Array.isArray(batch?.items) ? batch.items : []).forEach(item => {
      const itemId = String(item?.productId || item?.id || "").trim();
      const itemName = normalizeAnomalyProductKeyV201(item?.productName || item?.name);
      const sameId = productId && itemId && itemId === productId;
      const sameName = !sameId && productName && itemName === productName;
      if (sameId || sameName) total += getRawRemainingQuantityV201(item);
    });
  });
  return total;
}

function getImportsRemainingForProductV201(product, imports = getImports()) {
  const productId = String(product?.id || "").trim();
  const productName = normalizeAnomalyProductKeyV201(product?.name);
  return (imports || []).reduce((sum, record) => {
    const recordId = String(record?.productId || "").trim();
    const recordName = normalizeAnomalyProductKeyV201(record?.productName || record?.name);
    const sameId = productId && recordId && recordId === productId;
    const sameName = !sameId && productName && recordName === productName;
    return sum + ((sameId || sameName) ? getRawRemainingQuantityV201(record) : 0);
  }, 0);
}

function getImportAnomaliesV201() {
  const products = getProducts();
  const imports = getImports();
  const batches = getBatches();
  const issues = [];
  const idMap = new Map();

  if (systemHealthV203.checked) {
    if (systemHealthV203.apiOk === false) {
      issues.push({severity:"critical", type:"google-api", title:"Google Web App / Database 连接异常", detail:systemHealthV203.error || "无法读取 Google Web App。", action:"请检查网络、Web App 部署和 Google Sheet 读取权限。"});
    } else if (systemHealthV203.apiOk === true) {
      if (systemHealthV203.apiVersion && systemHealthV203.apiVersion !== APP_VERSION) {
        issues.push({severity:"critical", type:"version-mismatch", title:"Frontend 与 API 版本不一致", detail:`Frontend V${APP_VERSION} · API V${systemHealthV203.apiVersion}`, action:"请确认 Apps Script 已更新并重新 Deploy，然后强制刷新。"});
      }
      if (systemHealthV203.schemaVersion && systemHealthV203.schemaVersion !== CLOUD_SCHEMA_VERSION) {
        issues.push({severity:"critical", type:"schema-mismatch", title:"API Schema 版本不一致", detail:`Frontend ${CLOUD_SCHEMA_VERSION} · API ${systemHealthV203.schemaVersion}`, action:"请停止写入并检查部署版本。"});
      }
    }
  }
  if (cloudLastErrorMessage) {
    issues.push({severity:"critical", type:"sync-error", title:"最近同步失败", detail:String(cloudLastErrorMessage), action:"请先检查网络和 Google Web App，再按重新检查。"});
  }
  if (systemHealthV203.checked && salesInventoryFeedLastErrorV203 && ((salesInventoryFeedV77 || []).length || (salesInventoryPendingV77 || []).length)) {
    const salesFeedErrorV226 = String(salesInventoryFeedLastErrorV203 || "");
    const salesFeedTimeoutV226 = /提醒读取超时/i.test(salesFeedErrorV226);
    const repeatedFailureV226 = salesInventoryFeedFailureCountV226 >= 3;
    if (salesFeedTimeoutV226 && !repeatedFailureV226) {
      issues.push({
        severity:"warning", type:"sales-feed-timeout",
        title:"Sales → Import 提醒读取超时",
        detail:`${salesFeedErrorV226}（本次检查已自动重试 1 次）`,
        action:"Sales 提醒状态暂时未取得；可稍后重新检查。这里只读取状态，不会处理库存，也不会重复扣库存。"
      });
    } else {
      issues.push({
        severity:"critical", type:"sales-feed",
        title:repeatedFailureV226 ? "Sales → Import 连续读取失败" : "Sales → Import 连接异常",
        detail:salesFeedErrorV226,
        action:"请检查 Sales System Web App 连接；重新检查只读取状态，不会处理库存。"
      });
    }
  }
  const restoreJob = systemHealthV203.restoreJob || getLocalRestoreJob?.();
  if (restoreJob?.state === "failed") {
    issues.push({severity:"critical", type:"restore-failed", title:"最近 Restore Job 失败", detail:String(restoreJob.error || restoreJob.step || "Restore 未完成"), action:"请检查 Restore 状态和 Backup 文件；系统检查不会自动修复。"});
  } else if (restoreJob?.state === "running") {
    issues.push({severity:"warning", type:"restore-running", title:"Restore Job 仍在进行", detail:String(restoreJob.step || "服务器正在处理 Restore"), action:"请等待 Restore 完成，不要重复执行。"});
  }
  if (!Array.isArray(products) || !Array.isArray(imports) || !Array.isArray(batches)) {
    issues.push({severity:"critical", type:"data-load", title:"主要资料无法正常载入", detail:"Products / Imports / Batches 资料结构异常。", action:"请停止操作并重新检查云端资料。"});
  }

  products.forEach(product => {
    const id = String(product?.id || "").trim();
    const name = String(product?.name || "未命名产品").trim() || "未命名产品";
    const stockRaw = Number(product?.stock);
    const stock = Number.isFinite(stockRaw) ? Math.floor(stockRaw) : 0;
    const averageCost = Number(product?.averageCost);
    const minimumPrice = Math.max(0, Number(product?.minimumPrice) || 0);

    if (!id) {
      issues.push({severity:"critical", type:"missing-id", title:`${name} 没有产品编号`, detail:"产品编号为空，后续 Sales / Import 配对可能发生错误。", action:"请先到产品资料补上唯一产品编号。"});
    } else {
      const key = id.toUpperCase();
      if (!idMap.has(key)) idMap.set(key, []);
      idMap.get(key).push(product);
    }

    if (Number.isFinite(stockRaw) && stockRaw < 0) {
      issues.push({severity:"critical", type:"negative-stock", productId:id, title:`${name} 库存为负数`, detail:`Products.stock = ${formatNumber(stockRaw)}`, action:"请先停止继续扣库存，并检查最近 Sales / 库存调整记录。"});
    }

    if (stock > 0 && (!Number.isFinite(averageCost) || averageCost <= 0)) {
      issues.push({severity:"critical", type:"invalid-cost", productId:id, title:`${name} 有库存但${getAverageCostLabelV205(product)}异常`, detail:`当前库存 ${formatNumber(stock)}，${getAverageCostLabelV205(product)} ${formatMoney(Number(averageCost) || 0, "RM ")}`, action:"请检查对应进口批次成本与汇率。"});
    }

    if (stock > 0 && minimumPrice <= 0) {
      issues.push({severity:"warning", type:"missing-min-price", productId:id, title:`${name} 没有原最低售价`, detail:`当前库存 ${formatNumber(stock)}，原最低售价为 RM 0.00。`, action:"请检查自动最低售价来源；若属特殊产品，再手动设定原最低售价。"});
    }

    if (stock >= 0 && (id || name)) {
      const importsRemaining = getImportsRemainingForProductV201(product, imports);
      const batchesRemaining = getBatchRemainingForProductV201(product, batches);
      if (importsRemaining !== stock || batchesRemaining !== stock) {
        issues.push({
          severity:"warning", type:"stock-consistency", productId:id,
          title:`${name} 库存资料不一致`,
          detail:`Products ${formatNumber(stock)} · Imports ${formatNumber(importsRemaining)} · Batches ${formatNumber(batchesRemaining)}`,
          action:"以 Products 当前库存为基准，确认后可使用现有库存一致性修复功能同步 Imports / Batches。",
          canRepair:Boolean(id)
        });
      }
    }

    const rawAdjustments = product?.stockAdjustmentsJson;
    if (typeof rawAdjustments === "string" && rawAdjustments.trim()) {
      try { const parsed = JSON.parse(rawAdjustments); if (!Array.isArray(parsed)) throw new Error("not-array"); }
      catch (_) {
        issues.push({severity:"warning", type:"adjustment-data", productId:id, title:`${name} 库存调整记录格式异常`, detail:"stockAdjustmentsJson 无法正常解析。", action:"不要继续手动改库存；先备份并检查该产品 History。"});
      }
    }
  });

  idMap.forEach((rows, id) => {
    if (rows.length > 1) {
      issues.push({severity:"critical", type:"duplicate-id", productId:id, title:`产品编号 ${id} 重复`, detail:`共有 ${rows.length} 个产品使用同一个编号：${rows.map(x=>String(x.name||"未命名")).join("、")}`, action:"请先修正重复编号，再处理 Sales / Import。"});
    }
  });

  batches.forEach(batch => {
    const items = Array.isArray(batch?.items) ? batch.items : [];
    if (!items.length || !batchCostSnapshotIsStaleV206(batch, items)) return;
    const expected = getCanonicalBatchCostSnapshotV206(batch, items);
    const importNumber = String(batch?.importNumber || "未编号批次");
    issues.push({
      severity:"warning", type:"batch-cost-snapshot", importNumber,
      title:`${importNumber} 批次成本换算资料不一致`,
      detail:`按当前汇率与费用应为 ${formatMoney(expected.totalForeignCostsRM, "RM ")} + 海外运费 ${formatMoney(expected.shippingMY, "RM " )} = ${formatMoney(expected.grandTotal, "RM ")}`,
      action:"请到进口记录开启修改模式后保存此进口编号；重新检查本身不会修改资料。"
    });
  });

  if (salesInventoryFeedLoadedV77) {
    const pendingRows = (salesInventoryPendingV77 || []).filter(item => !item?.v82Processed);
    const pendingGroups = salesCardGroupsV104(pendingRows);
    if (pendingGroups.length) {
      const qty = pendingRows.reduce((sum, item) => sum + Math.max(0, Number(item?.remainingQty) || 0), 0);
      issues.unshift({severity:"warning", type:"sales-pending", title:`${pendingGroups.length} 张 Sales 销售卡库存待处理`, detail:`涉及 ${pendingRows.length} 项产品，待处理数量 ${formatNumber(qty)}。`, action:"请先处理 Sales → Import 库存，再继续其他库存调整。"});
    }
  }

  return issues;
}

function getAnomalyCopyItemsV206(issue) {
  const items = [];
  const push = (label, value) => {
    const text = String(value || "").trim();
    if (!text || items.some(item => item.label === label && item.value === text)) return;
    items.push({ label, value:text });
  };
  if (issue?.productId) {
    const product = getProducts().find(p => String(p?.id || "") === String(issue.productId));
    if (product?.name) push("产品", product.name);
    push("产品编号", issue.productId);
    const relatedImports = getImports().filter(record => String(record?.productId || "") === String(issue.productId));
    [...new Set(relatedImports.map(record => String(record?.importNumber || "").trim()).filter(Boolean))].slice(0,6).forEach(value => push("进口编号", value));
    const relatedBatches = getBatches().filter(batch => (Array.isArray(batch?.items) ? batch.items : []).some(item => String(item?.productId || "") === String(issue.productId)));
    relatedBatches.forEach(batch => {
      if (Number(batch?.rackQuantity) > 0) push("木架", String(batch.rackQuantity));
    });
  }
  if (issue?.importNumber) {
    push("进口编号", issue.importNumber);
    const batch = getBatches().find(row => String(row?.importNumber || "") === String(issue.importNumber));
    if (Number(batch?.rackQuantity) > 0) push("木架", String(batch.rackQuantity));
    (Array.isArray(batch?.items) ? batch.items : []).slice(0,6).forEach(item => {
      if (item?.productName) push("产品", item.productName);
      if (item?.productId) push("产品编号", item.productId);
    });
  }
  return items;
}

async function copyAnomalyValueV206(button) {
  const value = String(button?.dataset?.copyValue || "").trim();
  if (!value) return;
  let copied = false;
  try { await navigator.clipboard.writeText(value); copied = true; } catch (_) {}
  if (!copied) {
    const ta = document.createElement("textarea"); ta.value = value; ta.style.position="fixed"; ta.style.opacity="0";
    document.body.appendChild(ta); ta.select();
    try { copied = document.execCommand("copy"); } catch (_) {} finally { ta.remove(); }
  }
  if (!copied) return;
  const old = button.textContent;
  button.textContent = "已复制";
  window.setTimeout(() => { button.textContent = old; }, 900);
}
window.copyAnomalyValueV206 = copyAnomalyValueV206;

function renderImportAnomalyCenterV201() {
  const list = document.getElementById("importAnomalyListV201");
  const dot = document.getElementById("importAnomalyStatusDotV202");
  const countEl = document.getElementById("importAnomalyCountV202");
  const statusButton = document.getElementById("importAnomalyStatusButtonV202");
  const details = document.getElementById("importAnomalyDetailsV202");
  if (!list || !dot || !countEl || !statusButton || !details) return;

  if (systemHealthV203.checking) {
    dot.className = "import-anomaly-status-dot-v202 checking";
    statusButton.classList.remove("has-problem", "has-warning");
    statusButton.setAttribute("aria-label", "系统检查中");
    return;
  }

  const issues = getImportAnomaliesV201();
  const criticalCount = issues.filter(issue => issue.severity === "critical").length;
  const warningCount = issues.filter(issue => issue.severity === "warning").length;
  const state = criticalCount ? "problem" : warningCount ? "warning" : "ok";
  dot.className = `import-anomaly-status-dot-v202 ${state}`;
  countEl.hidden = true;
  statusButton.classList.toggle("has-problem", criticalCount > 0);
  statusButton.classList.toggle("has-warning", criticalCount === 0 && warningCount > 0);
  statusButton.setAttribute("aria-label", criticalCount ? `系统有 ${criticalCount} 项异常，点击查看` : warningCount ? `系统有 ${warningCount} 项提醒，点击查看` : "系统状态正常");

  if (!issues.length) {
    details.hidden = true;
    statusButton.setAttribute("aria-expanded", "false");
    statusButton.classList.remove("is-open");
    list.innerHTML = "";
    return;
  }
  const severityOrder = {critical:0, warning:1};
  issues.sort((a,b)=>(severityOrder[a.severity]??9)-(severityOrder[b.severity]??9));
  list.innerHTML = issues.map(issue => {
    const copyItems = getAnomalyCopyItemsV206(issue);
    const copyHtml = copyItems.length ? `<div class="import-anomaly-copy-row-v206">${copyItems.map(item => `<button type="button" class="import-anomaly-copy-v206" data-copy-value="${escapeHTML(item.value)}" onclick="copyAnomalyValueV206(this)" title="点击复制${escapeHTML(item.label)}"><span>${escapeHTML(item.label)}</span>${escapeHTML(item.value)}</button>`).join("")}</div>` : "";
    return `
    <article class="import-anomaly-item-v201 ${issue.severity}">
      <div class="import-anomaly-icon-v201">${issue.severity === "critical" ? "🔴" : "🟡"}</div>
      <div class="import-anomaly-body-v201">
        <strong>${escapeHTML(issue.title)}</strong>
        <div>${escapeHTML(issue.detail || "")}</div>
        ${copyHtml}
        <small>${escapeHTML(issue.action || "")}</small>
      </div>
    </article>`;
  }).join("");
}

function setupImportAnomalyCenterV201() {
  const refresh = document.getElementById("refreshImportAnomalyV201");
  if (refresh && refresh.dataset.boundV203 !== "1") {
    refresh.dataset.boundV203 = "1";
    refresh.addEventListener("click", async () => {
      if (systemHealthV203.checking) return;
      refresh.disabled = true;
      refresh.classList.add("is-checking");
      refresh.textContent = "检查中…";
      try {
        await runSystemHealthCheckV203({refreshSales:true});
      } finally {
        refresh.disabled = false;
        refresh.classList.remove("is-checking");
        refresh.textContent = "重新检查";
      }
    });
  }
  const statusButton = document.getElementById("importAnomalyStatusButtonV202");
  const details = document.getElementById("importAnomalyDetailsV202");
  if (statusButton && details && statusButton.dataset.boundV203 !== "1") {
    statusButton.dataset.boundV203 = "1";
    statusButton.addEventListener("click", () => {
      if (systemHealthV203.checking || !getImportAnomaliesV201().length) return;
      details.hidden = !details.hidden;
      const open = !details.hidden;
      statusButton.setAttribute("aria-expanded", open ? "true" : "false");
      statusButton.classList.toggle("is-open", open);
      if (open) renderImportAnomalyCenterV201();
    });
  }
  const close = document.getElementById("closeImportAnomalyV202");
  if (close && details && close.dataset.boundV203 !== "1") {
    close.dataset.boundV203 = "1";
    close.addEventListener("click", () => {
      details.hidden = true;
      statusButton?.setAttribute("aria-expanded", "false");
      statusButton?.classList.remove("is-open");
    });
  }
  renderImportAnomalyCenterV201();
  renderSystemInformationV203();
  window.setTimeout(() => runSystemHealthCheckV203({refreshSales:false}), 350);
}

function renderInventoryList(products) {
  const list = document.getElementById("inventoryList");

  if (!products.length) {
    list.innerHTML = '<div class="empty-state">暂无库存资料</div>';
    return;
  }

  list.innerHTML = products.map(item => {
    const stock = Number(item.stock) || 0;
    const averageCost = Number(item.averageCost) || 0;
    const minimumPrice = getEffectiveProductMinimumPriceV333(item);
    const value = stock * averageCost;
    const profitInfo = getProductMinimumProfitV205(item);
    const minimumDisplayV315 = getMinimumPriceDisplayStateV315(item);
    const averageCostLabel = getAverageCostLabelV205(item);

    return `
      <article class="inventory-card">
        <h4>${escapeHTML(item.name || "未命名产品")}</h4>
        <div class="inventory-meta">
          <div><span>库存</span><strong>${formatNumber(stock)}</strong></div>
          <button class="inventory-minimum-price-btn ${minimumDisplayV315.className}" type="button"
            data-product-id="${escapeHTML(item.id || "")}"
            aria-label="长按修改最低售价" title="长按修改最低售价">
            <span>${minimumDisplayV315.label}</span><strong>${formatMoney(minimumPrice, "RM ")}</strong>
          </button>
          <div><span>${averageCostLabel}</span><strong>${formatMoney(averageCost, "RM ")}</strong></div>
          <div class="inventory-profit-value-v207 ${profitInfo.profit < 0 ? "loss" : profitInfo.profit > 0 ? "gain" : "neutral"}"><span>利润</span><strong>${formatMoney(profitInfo.profit, "RM ")}</strong></div>
          <div class="inventory-profit-value-v207 ${profitInfo.profit < 0 ? "loss" : profitInfo.profit > 0 ? "gain" : "neutral"}"><span>利润率</span><strong>${escapeHTML(formatProfitTargetV303(profitInfo.profitRate))}</strong></div>
          <div><span>库存成本</span><strong>${formatMoney(value, "RM ")}</strong></div>
          <div><span>最后进口</span><strong>${escapeHTML(getLatestImportDateByProduct(item.id) || "")}</strong></div>
        </div>
      </article>
    `;
  }).join("");

  bindDashboardMinimumPriceLongPress();
}

function setupProductModule() {
  const form = document.getElementById("productForm");
  const nameInput = document.getElementById("productName");
  const searchInput = document.getElementById("productSearch");

  nameInput.addEventListener("input", () => {
    const chars = Array.from(nameInput.value);

    if (chars.length > 15) {
      nameInput.value = chars.slice(0, 15).join("");
    }

    document.getElementById("nameCounter").textContent =
      `${Array.from(nameInput.value).length} / 15`;
  });

  nameInput.addEventListener("paste", event => {
    event.preventDefault();

    const clipboard = event.clipboardData || window.clipboardData;
    const pastedText = clipboard
      ? clipboard.getData("text").replace(/[\r\n\t]+/g, " ").trim()
      : "";

    const selectionStart = nameInput.selectionStart ?? nameInput.value.length;
    const selectionEnd = nameInput.selectionEnd ?? selectionStart;
    const before = nameInput.value.slice(0, selectionStart);
    const after = nameInput.value.slice(selectionEnd);

    nameInput.value = Array.from(before + pastedText + after)
      .slice(0, 15)
      .join("");

    nameInput.dispatchEvent(new Event("input", { bubbles: true }));

    const caret = nameInput.value.length;
    nameInput.setSelectionRange(caret, caret);
  });

  form.addEventListener("submit", event => {
    event.preventDefault();
    saveProduct();
  });

  document.getElementById("newProductBtn").addEventListener("click", resetProductForm);
  document.getElementById("cancelEditBtn").addEventListener("click", resetProductForm);
  searchInput.addEventListener("input", () => scheduleSearchRenderV302("product-list", renderProductList));

  resetProductForm();
  renderProductList();
}

const DEFAULT_MINIMUM_PRICE_RULES_V160 = Object.freeze({
  commissionRate: 10,
  margin0To300: 30,
  margin300To500: 35,
  margin500To800: 40,
  margin800To5000: 45,
  margin5000To8000: 50,
  margin8000Plus: 60,
  freightTierA: 20,
  freightTierB: 50,
  freightTierC: 80,
  freightTierD: 120,
  freightTierE: 150,
  freightTierF: 180,
  vndPotUnder1m: 35,
  vndPot1mTo4m: 55,
  vndPot4mTo10m: 105,
  vndPot10mPlus: 180
});

function getCachedSettingsV317() {
  return typeof loadJSONReadOnlyV317 === "function"
    ? loadJSONReadOnlyV317("importSystemSettings", {})
    : loadJSON("importSystemSettings", {});
}

function getMinimumPriceRulesV160() {
  const saved = getCachedSettingsV317();
  const rules = saved.minimumPriceRules && typeof saved.minimumPriceRules === "object"
    ? saved.minimumPriceRules
    : {};
  const normalized = {};
  Object.entries(DEFAULT_MINIMUM_PRICE_RULES_V160).forEach(([key, fallback]) => {
    let rawValue = rules[key];
    // V20.6 migration: preserve the closest V19.9 customized value when a range was split.
    if (rawValue == null && key === "margin5000To8000") rawValue = rules.margin5000Plus;
    if (rawValue == null && key === "vndPot4mTo10m") rawValue = rules.vndPot4mPlus;
    const value = Number(rawValue);
    normalized[key] = Number.isFinite(value) && value >= 0 ? value : fallback;
  });
  return normalized;
}

let minimumPriceOriginIndexV160 = {
  importsRaw: null,
  batchesRaw: null,
  checkedAt: 0,
  byId: new Map(),
  byName: new Map()
};

function invalidateMinimumPriceOriginIndexV160() {
  minimumPriceOriginIndexV160.importsRaw = null;
  minimumPriceOriginIndexV160.batchesRaw = null;
  minimumPriceOriginIndexV160.checkedAt = 0;
}

function getMinimumPriceOriginIndexV160() {
  const now = Date.now();
  if (minimumPriceOriginIndexV160.checkedAt > 0 &&
      now - minimumPriceOriginIndexV160.checkedAt < 1000) {
    return minimumPriceOriginIndexV160;
  }
  const importsRaw = localStorage.getItem("importSystemImports") || "[]";
  const batchesRaw = localStorage.getItem("importSystemBatches") || "[]";
  if (minimumPriceOriginIndexV160.importsRaw === importsRaw &&
      minimumPriceOriginIndexV160.batchesRaw === batchesRaw) {
    minimumPriceOriginIndexV160.checkedAt = now;
    return minimumPriceOriginIndexV160;
  }

  let imports = [];
  let batches = [];
  try { imports = JSON.parse(importsRaw) || []; } catch (error) { imports = []; }
  try { batches = JSON.parse(batchesRaw) || []; } catch (error) { batches = []; }
  const batchByNumber = new Map((Array.isArray(batches) ? batches : []).map(batch => [
    String(batch?.importNumber || "").trim().toLowerCase(), batch
  ]));
  const byId = new Map();
  const byName = new Map();

  const isBetter = (candidate, current) => {
    if (!current) return true;
    if (candidate.active !== current.active) return candidate.active > current.active;
    if (candidate.time !== current.time) return candidate.time > current.time;
    return candidate.createdAt > current.createdAt;
  };

  (Array.isArray(imports) ? imports : []).forEach(record => {
    const batch = batchByNumber.get(String(record?.importNumber || "").trim().toLowerCase());
    const currency = String(record?.currency || batch?.currency || "").trim().toUpperCase();
    const unitPrice = Math.max(0, Number(record?.unitPrice) || 0);
    if (!currency || unitPrice <= 0) return;
    const displayDate = getImportDisplayDate(record, batch);
    const candidate = {
      currency,
      unitPrice,
      active: Math.max(0, Number(record?.remainingQuantity ?? record?.quantity) || 0) > 0 ? 1 : 0,
      time: Number(parseDDMMYYYY(displayDate)) || 0,
      createdAt: String(record?.createdAt || "")
    };
    const productId = String(record?.productId || "").trim();
    const productName = String(record?.productName || "").trim().toLowerCase();
    if (productId && isBetter(candidate, byId.get(productId))) byId.set(productId, candidate);
    if (productName && isBetter(candidate, byName.get(productName))) byName.set(productName, candidate);
  });

  minimumPriceOriginIndexV160 = { importsRaw, batchesRaw, checkedAt: now, byId, byName };
  return minimumPriceOriginIndexV160;
}

function getVndPotCostV160(product, rules, originIndex = null) {
  if (!product) return 0;
  const index = originIndex || getMinimumPriceOriginIndexV160();
  const productId = String(product?.id || "").trim();
  const productName = String(product?.name || "").trim().toLowerCase();
  const original = index.byId.get(productId) || index.byName.get(productName);
  if (!original || original.currency !== "VND") return 0;
  if (original.unitPrice >= 10000000) return rules.vndPot10mPlus;
  if (original.unitPrice >= 4000000) return rules.vndPot4mTo10m;
  if (original.unitPrice >= 1000000) return rules.vndPot1mTo4m;
  return rules.vndPotUnder1m;
}

// V20.6: VND plants arrive without the local display pot. Their stored Average Cost
// remains the import/plant cost only; the configured VND pot cost is added only
// when calculating selling price and profit.
function isVndProductV205(product, originIndex = null) {
  if (!product) return false;
  const index = originIndex || getMinimumPriceOriginIndexV160();
  const productId = String(product?.id || "").trim();
  const productName = String(product?.name || "").trim().toLowerCase();
  const original = index.byId.get(productId) || index.byName.get(productName);
  return String(original?.currency || "").toUpperCase() === "VND";
}

function getAverageCostLabelV205(product, originIndex = null) {
  return isVndProductV205(product, originIndex) ? "平均成本（VND不含盆）" : "平均成本";
}

function getEffectiveProductMinimumPriceV333(product, configuredRules = null, originIndex = null) {
  const storedPrice = Math.max(0, Number(product?.minimumPrice) || 0);
  if (isMinimumPriceManualV160(product)) return storedPrice;
  return getAutomaticMinimumPriceV160(product?.averageCost, configuredRules, product, originIndex);
}

function getProductMinimumProfitV205(product, rules = null, originIndex = null) {
  const configuredRules = rules || getMinimumPriceRulesV160();
  const index = originIndex || getMinimumPriceOriginIndexV160();
  const price = getEffectiveProductMinimumPriceV333(product, configuredRules, index);
  const averageCost = Math.max(0, Number(product?.averageCost) || 0);
  const potCost = getVndPotCostV160(product, configuredRules, index);
  const commissionRate = Math.max(0, Number(configuredRules.commissionRate) || 0);
  const freightTier = getMinimumFreightTierV188(price, configuredRules);
  const commission = price * commissionRate / 100;
  const profit = price - averageCost - potCost - freightTier.amount - commission;
  return {
    price, averageCost, potCost, commissionRate, commission,
    freight: freightTier.amount, freightTier: freightTier.code,
    profit, profitRate: price > 0 ? profit / price * 100 : 0
  };
}

function getMinimumFreightTierV188(price, rules) {
  const salePrice = Math.max(0, Number(price) || 0);
  if (salePrice < 300) return { code:"A", amount:rules.freightTierA };
  if (salePrice <= 500) return { code:"B", amount:rules.freightTierB };
  if (salePrice <= 1000) return { code:"C", amount:rules.freightTierC };
  if (salePrice <= 2000) return { code:"D", amount:rules.freightTierD };
  if (salePrice < 5000) return { code:"E", amount:rules.freightTierE };
  return { code:"F", amount:rules.freightTierF };
}

function calculateTieredMinimumPriceV188(cost, denominator, rules) {
  if (cost <= 0 || denominator <= 0) return { price:0, delivery:0, tier:"A" };
  let tier = { code:"A", amount:rules.freightTierA };
  let price = 0;
  for (let i = 0; i < 8; i += 1) {
    price = Math.ceil((((cost + tier.amount) / denominator) - 1e-9) / 10) * 10;
    const nextTier = getMinimumFreightTierV188(price, rules);
    if (nextTier.code === tier.code) return { price, delivery:tier.amount, tier:tier.code };
    tier = nextTier;
  }
  price = Math.ceil((((cost + tier.amount) / denominator) - 1e-9) / 10) * 10;
  return { price, delivery:tier.amount, tier:tier.code };
}

function getAutomaticMinimumPriceV160(averageCost, configuredRules = null, product = null, originIndex = null) {
  const rules = configuredRules || getMinimumPriceRulesV160();
  const cost = Math.max(0, Number(averageCost) || 0) + getVndPotCostV160(product, rules, originIndex);
  if (cost <= 0) return 0;
  const averageCostValue = Math.max(0, Number(averageCost) || 0);
  const targetMarginPercent = averageCostValue <= 300 ? rules.margin0To300
    : averageCostValue <= 500 ? rules.margin300To500
      : averageCostValue < 800 ? rules.margin500To800
        : averageCostValue < 5000 ? rules.margin800To5000
          : averageCostValue < 8000 ? rules.margin5000To8000 : rules.margin8000Plus;
  const denominator = 1 - rules.commissionRate / 100 - targetMarginPercent / 100;
  return calculateTieredMinimumPriceV188(cost, denominator, rules).price;
}

function getMinimumPriceManualOverridesV160() {
  const settings = getCachedSettingsV317();
  return settings.minimumPriceManualOverrides &&
    typeof settings.minimumPriceManualOverrides === "object"
    ? settings.minimumPriceManualOverrides
    : {};
}

function saveMinimumPriceManualOverridesV160(overrides) {
  const settings = loadJSON("importSystemSettings", {});
  saveJSON("importSystemSettings", {
    ...settings,
    minimumPriceManualOverrides: { ...(overrides || {}) }
  });
}

function isMinimumPriceManualV160(product, configuredOverrides = null) {
  const overrides = configuredOverrides || getMinimumPriceManualOverridesV160();
  const productId = String(product?.id || "").trim();
  const productIdUpper = productId.toUpperCase();
  // V33.9: one single manual-price truth for every desktop/mobile/table renderer.
  // Older settings may contain a differently-cased Product ID, so normalize once here
  // instead of letting each page infer protection differently.
  if (productId) {
    if (typeof overrides[productId] === "boolean") return overrides[productId];
    if (typeof overrides[productIdUpper] === "boolean") return overrides[productIdUpper];
    const matchedKey = Object.keys(overrides || {}).find(key => String(key || "").trim().toUpperCase() === productIdUpper);
    if (matchedKey && typeof overrides[matchedKey] === "boolean") return overrides[matchedKey];
  }
  return product?.minimumPriceManual === true;
}

function normalizeProductMinimumPriceV160(product, configuredRules = null, configuredOverrides = null, originIndex = null) {
  const minimumPriceManual = isMinimumPriceManualV160(product, configuredOverrides);
  const storedPrice = Math.max(0, Number(product?.minimumPrice) || 0);
  return {
    ...product,
    minimumPriceManual,
    minimumPrice: minimumPriceManual
      ? storedPrice
      : getAutomaticMinimumPriceV160(product?.averageCost, configuredRules, product, originIndex)
  };
}

// V26.6: legacy Product IDs are historical-reference only. They must never
// participate in live product search, import selection, inventory operations,
// deprecated reference-product conversion, or new business workflows. Historical Import /
// inventory records remain untouched and can still display the original ID.
const HIDDEN_LEGACY_PRODUCT_IDS_V256 = new Set(["PS0001", "PS0002", "PX0006", "PZ0006"]);
function isHiddenLegacyProductIdV256(value) {
  return HIDDEN_LEGACY_PRODUCT_IDS_V256.has(String(value || "").trim().toUpperCase());
}
function getOperationalProductsV256(products = getProducts()) {
  return (Array.isArray(products) ? products : []).filter(product =>
    !isHiddenLegacyProductIdV256(product?.id)
  );
}

// V33.9: obsolete virtual-reference residue sweeper removed. Historical ID migration/safety remains below.

function getProducts() {
  const rules = getMinimumPriceRulesV160();
  const overrides = getMinimumPriceManualOverridesV160();
  const originIndex = getMinimumPriceOriginIndexV160();
  const source = typeof loadJSONReadOnlyV317 === "function"
    ? loadJSONReadOnlyV317("importSystemProducts", [])
    : loadJSON("importSystemProducts", []);
  return (Array.isArray(source) ? source : [])
    .map(product => normalizeProductMinimumPriceV160(product, rules, overrides, originIndex));
}
function saveProducts(products) {
  const previous = getProducts();
  const rules = getMinimumPriceRulesV160();
  const overrides = { ...getMinimumPriceManualOverridesV160() };
  const originIndex = getMinimumPriceOriginIndexV160();
  const normalizedProducts = products
    .map(product => {
      const normalized = normalizeProductMinimumPriceV160(product, rules, overrides, originIndex);
      const productId = String(normalized.id || "").trim();
      if (productId) overrides[productId] = Boolean(normalized.minimumPriceManual);
      return normalized;
    });
  saveMinimumPriceManualOverridesV160(overrides);
  saveJSON("importSystemProducts", normalizedProducts);
  if (typeof historyProductLookupCacheV322 !== "undefined") historyProductLookupCacheV322 = { raw:null, byId:new Map(), byName:new Map() };
  if (typeof historyAdjustmentCacheV322 !== "undefined") historyAdjustmentCacheV322 = { raw:null, rows:[] };
  if (typeof markCloudCollectionSaved === "function") {
    markCloudCollectionSaved("products", previous, normalizedProducts);
  }
}


const PRIMARY_PRODUCT_CATEGORIES_V255 = Object.freeze([
  "盆栽",
  "肥料 / 农药",
  "泥土 / 介质 Soil",
  "花盆 Pot",
  "工具",
  "其他"
]);

const DEFAULT_PRODUCT_CATEGORY_RULES_V228 = Object.freeze([
  { name: "盆栽", prefix: "BS", mode: "name" },
  { name: "肥料 / 农药", prefix: "FL", mode: "category" },
  { name: "泥土 / 介质 Soil", prefix: "NT", mode: "category" },
  { name: "花盆 Pot", prefix: "PT", mode: "category" },
  { name: "工具", prefix: "TL", mode: "category" },
  { name: "其他", prefix: "QT", mode: "category" }
]);

function isPrimaryProductCategoryV255(value) {
  const wanted = normalizeProductCategoryNameV227(value);
  return PRIMARY_PRODUCT_CATEGORIES_V255.includes(wanted);
}

function normalizePrimaryProductCategoryV255(value) {
  const wanted = normalizeProductCategoryNameV227(value);
  if (PRIMARY_PRODUCT_CATEGORIES_V255.includes(wanted)) return wanted;
  return wanted ? "其他" : "盆栽";
}

function normalizeProductCategoryNameV227(value) {
  return String(value || "").normalize("NFKC").replace(/[\s\u3000]+/g, " ").trim();
}

function normalizeCategoryPrefixV228(value) {
  return String(value || "").replace(/[^a-z]/gi, "").toUpperCase().slice(0, 2);
}

function isProductCategoryUsedV229(categoryName) {
  const wanted = normalizeProductCategoryNameV227(categoryName);
  if (!wanted) return false;
  // V24.6: stock=0 alone MUST NOT unlock a category. As long as the product still
  // exists in active Products / Imports / Batches, the rule stays locked. Only the
  // explicit “清理零库存产品” flow removes those active references and can unlock it.
  if (getProducts().some(product => normalizeProductCategoryNameV227(product?.category) === wanted)) return true;
  if (getImports().some(row => normalizeProductCategoryNameV227(row?.category) === wanted)) return true;
  return getBatches().some(batch => (Array.isArray(batch?.items) ? batch.items : [])
    .some(item => normalizeProductCategoryNameV227(item?.category) === wanted));
}

function getProductIdPrefixV229(value) {
  const match = String(value || "").trim().toUpperCase().match(/^([A-Z]{2})/);
  return match ? match[1] : "";
}

function getCategoryPrefixConflictV229(prefix, excludeCategoryName = "") {
  const wanted = normalizeCategoryPrefixV228(prefix);
  if (!wanted) return "";
  const excluded = normalizeProductCategoryNameV227(excludeCategoryName);

  for (const [keyword, rulePrefix] of getProductPrefixRulesV181()) {
    if (String(rulePrefix || "").toUpperCase() === wanted) return `盆栽前缀规则“${keyword}”`;
  }
  for (const rule of getProductCategoryRulesV228()) {
    if (normalizeProductCategoryNameV227(rule.name) === excluded) continue;
    if (normalizeCategoryPrefixV228(rule.prefix) === wanted) return `产品类别“${rule.name}”`;
  }

  const settings = loadJSON("importSystemSettings", {});
  const aliases = settings.productIdAliases || {};
  const ids = [
    ...getProducts().map(p => p?.id),
    ...getImports().map(r => r?.productId),
    ...getBatches().flatMap(batch => (Array.isArray(batch?.items) ? batch.items : []).map(item => item?.productId)),
    ...Object.keys(aliases), ...Object.values(aliases)
  ];
  const conflictingId = ids.map(getProductIdPrefixV229).find(p => p === wanted);
  return conflictingId ? `现有／历史产品编号 ${wanted}xxxx` : "";
}

function getProductCategoryRulesV228() {
  const settings = loadJSON("importSystemSettings", {});
  const savedRules = Array.isArray(settings.productCategoryRulesV228) ? settings.productCategoryRulesV228 : [];
  const legacyNames = Array.isArray(settings.productCategoriesV227) ? settings.productCategoriesV227 : [];
  const source = savedRules.length
    ? savedRules
    : (legacyNames.length
      ? legacyNames.map(name => {
          const normalized = normalizeProductCategoryNameV227(name);
          const preset = DEFAULT_PRODUCT_CATEGORY_RULES_V228.find(rule => rule.name === normalized);
          return preset ? { ...preset } : { name: normalized, prefix: "QT", mode: normalized === "盆栽" ? "name" : "category" };
        })
      : DEFAULT_PRODUCT_CATEGORY_RULES_V228.map(rule => ({ ...rule })));

  const result = [];
  const usedNames = new Set();
  source.forEach(raw => {
    const name = normalizeProductCategoryNameV227(raw?.name ?? raw);
    if (!name || name === "周边产品" || !PRIMARY_PRODUCT_CATEGORIES_V255.includes(name)) return;
    const key = name.toLocaleLowerCase();
    if (usedNames.has(key)) return;
    usedNames.add(key);
    const preset = DEFAULT_PRODUCT_CATEGORY_RULES_V228.find(rule => rule.name === name);
    const mode = name === "盆栽" ? "name" : "category";
    const prefix = mode === "name" ? "BS" : (normalizeCategoryPrefixV228(raw?.prefix) || preset?.prefix || "QT");
    const lockedByUsageV229 = raw?.lockedByUsageV229 === true;
    // V24.6: usage lock is derived from current active data, not a permanent flag.
    // After the user explicitly cleans the last zero-stock product, the rule may unlock.
    const locked = name === "盆栽" ? true : isProductCategoryUsedV229(name);
    result.push({ name, prefix, mode, locked, lockedByUsageV229 });
  });
  if (!result.some(rule => rule.name === "盆栽")) result.unshift({ name: "盆栽", prefix: "BS", mode: "name", locked: true });
  // V26.6: the seven main categories must always be available. This does not
  // change any existing Product ID or historical record.
  PRIMARY_PRODUCT_CATEGORIES_V255.forEach(name => {
    if (result.some(rule => rule.name === name)) return;
    const preset = DEFAULT_PRODUCT_CATEGORY_RULES_V228.find(rule => rule.name === name);
    if (!preset) return;
    result.push({ name, prefix: preset.prefix, mode: preset.mode, locked: name === "盆栽" ? true : isProductCategoryUsedV229(name) });
  });
  return result;
}

function getProductCategoriesV227() {
  // V26.6: UI categories are MAIN categories only. Fine-class rules such as
  // Monstera / Ficus / 虎尾兰 only decide the Product ID prefix.
  return PRIMARY_PRODUCT_CATEGORIES_V255.slice();
}

function productCategoryOptionsHTMLV227(selected = "盆栽") {
  const wanted = normalizePrimaryProductCategoryV255(selected);
  const categories = getProductCategoriesV227();
  return categories.map(name => `<option value="${escapeHTML(name)}"${name === wanted ? " selected" : ""}>${escapeHTML(name)}</option>`).join("");
}

function migrateLegacyProductCategoriesV227() {
  const mappings = new Map([["周边产品", "其他"]]);
  const products = getProducts();
  const imports = getImports();
  const batches = getBatches();
  let pChanged = false, iChanged = false, bChanged = false;
  const nextProducts = products.map(item => {
    const next = mappings.get(String(item?.category || ""));
    if (!next) return item;
    pChanged = true;
    return { ...item, category: next };
  });
  const nextImports = imports.map(item => {
    const next = mappings.get(String(item?.category || ""));
    if (!next) return item;
    iChanged = true;
    return { ...item, category: next };
  });
  const nextBatches = batches.map(batch => {
    let changed = false;
    const items = (Array.isArray(batch?.items) ? batch.items : []).map(item => {
      const next = mappings.get(String(item?.category || ""));
      if (!next) return item;
      changed = true;
      return { ...item, category: next };
    });
    if (!changed) return batch;
    bChanged = true;
    return { ...batch, items };
  });
  if (pChanged) {
    saveJSON("importSystemProducts", nextProducts);
    if (typeof markCloudCollectionSaved === "function") markCloudCollectionSaved("products", products, nextProducts);
  }
  if (iChanged) {
    saveJSON("importSystemImports", nextImports);
    if (typeof markCloudCollectionSaved === "function") markCloudCollectionSaved("imports", imports, nextImports);
  }
  if (bChanged) {
    saveJSON("importSystemBatches", nextBatches);
    if (typeof markCloudCollectionSaved === "function") markCloudCollectionSaved("batches", batches, nextBatches);
  }

  const settings = loadJSON("importSystemSettings", {});
  if (!Array.isArray(settings.productCategoryRulesV228) || !settings.productCategoryRulesV228.length) {
    saveJSON("importSystemSettings", { ...settings, productCategoryRulesV228: getProductCategoryRulesV228() });
    if (typeof markCloudSettingsSaved === "function") markCloudSettingsSaved();
  }
}

async function copyRuleLabelV232(element, value) {
  const text = String(value || "").trim();
  if (!text || !element) return false;
  let copied = false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      copied = true;
    }
  } catch (_) {}
  if (!copied) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { copied = document.execCommand("copy"); } catch (_) {}
    ta.remove();
  }
  if (copied) {
    const original = element.textContent;
    element.textContent = "已复制";
    element.classList.add("copied-v232");
    window.setTimeout(() => {
      element.textContent = original;
      element.classList.remove("copied-v232");
    }, 900);
  }
  return copied;
}

const PRODUCT_PREFIX_RULES_V163 = Object.freeze([
  ["黄杨", "BX"], ["Buxus", "BX"], ["Boxwood", "BX"],
  ["凌珊", "BB"], ["Bluebell", "BB"],
  ["罗汉松", "PD"], ["Podocarpus", "PD"],
  ["李氏樱桃", "SK"], ["Lee Cherry", "SK"], ["Sakura", "SK"],
  ["水梅", "JL"], ["Jeliti", "JL"], ["Anting Puteri", "JL"], ["Water Jasmine", "JL"],
  ["酸豆", "AS"], ["Asam Jawa", "AS"],
  ["寿娘子", "SC"], ["Premna", "SC"], ["Sancang", "SC"], ["Bebuas", "SC"],
  ["三角梅", "BV"], ["Bougainvillea", "BV"],
  ["七里香", "MR"], ["九里香", "MR"], ["Murraya", "MR"],
  ["仙丹", "IX"], ["Ixora", "IX"],
  ["真柏", "JU"], ["Juniperus", "JU"], ["系鱼川", "JU"], ["Itoigawa", "JU"], ["Itoigawa Shimpaku", "JU"],
  ["福建茶", "HK"], ["Ho Kian Tea", "HK"], ["Fujian Tea", "HK"], ["Fukien Tea", "HK"]
]);

function normalizeProductPrefixKeywordV181(value) {
  return String(value || "").normalize("NFKC").replace(/[\s\u3000]+/g, "").toLocaleLowerCase();
}

function getProductPrefixRulesV181() {
  const settings = loadJSON("importSystemSettings", {});
  const overrides = settings.productPrefixOverridesV231 && typeof settings.productPrefixOverridesV231 === "object"
    ? settings.productPrefixOverridesV231 : {};
  const additional = Array.isArray(settings.productPrefixAdditionalRules) ? settings.productPrefixAdditionalRules : [];
  const rules = [];
  const usedKeywords = new Set();

  PRODUCT_PREFIX_RULES_V163.forEach(([baseKeyword, basePrefix]) => {
    const key = normalizeProductPrefixKeywordV181(baseKeyword);
    const override = overrides[key];
    if (override?.deleted === true) return;
    const keyword = String(override?.keyword || baseKeyword).trim();
    const prefix = String(override?.prefix || basePrefix).trim().toUpperCase();
    const normalizedKeyword = normalizeProductPrefixKeywordV181(keyword);
    if (!normalizedKeyword || !/^[A-Z]{2}$/.test(prefix) || usedKeywords.has(normalizedKeyword)) return;
    usedKeywords.add(normalizedKeyword);
    rules.push([keyword, prefix]);
  });

  additional.forEach(rule => {
    const keyword = String(Array.isArray(rule) ? rule[0] : rule?.keyword || "").trim();
    const prefix = String(Array.isArray(rule) ? rule[1] : rule?.prefix || "").trim().toUpperCase();
    const normalizedKeyword = normalizeProductPrefixKeywordV181(keyword);
    if (normalizedKeyword === normalizeProductPrefixKeywordV181("白蜡") && prefix === "BX") return;
    if (!normalizedKeyword || usedKeywords.has(normalizedKeyword) || !/^[A-Z]{2}$/.test(prefix)) return;
    usedKeywords.add(normalizedKeyword);
    rules.push([keyword, prefix]);
  });
  return rules;
}

function isProductPrefixRuleUsedV229(keyword, prefix) {
  const normalizedKeyword = normalizeProductPrefixKeywordV181(keyword);
  const wantedPrefix = String(prefix || "").trim().toUpperCase();
  const matchingProducts = getProducts().filter(product =>
    normalizeProductCategoryNameV227(product?.category) === "盆栽" &&
    normalizeProductPrefixKeywordV181(product?.name).includes(normalizedKeyword) &&
    String(product?.id || "").trim().toUpperCase().startsWith(wantedPrefix)
  );
  // V24.6: product existence itself keeps the rule locked, even at stock 0.
  // Explicit zero-stock cleanup removes the product and can then unlock the rule.
  return matchingProducts.length > 0;
}

let editingProductPrefixKeywordV229 = "";


function getBuiltInPrefixBaseKeyV231(effectiveKeyword) {
  const wanted = normalizeProductPrefixKeywordV181(effectiveKeyword);
  const settings = loadJSON("importSystemSettings", {});
  const overrides = settings.productPrefixOverridesV231 && typeof settings.productPrefixOverridesV231 === "object"
    ? settings.productPrefixOverridesV231 : {};
  for (const [baseKeyword] of PRODUCT_PREFIX_RULES_V163) {
    const baseKey = normalizeProductPrefixKeywordV181(baseKeyword);
    if (baseKey === wanted) return baseKey;
    if (normalizeProductPrefixKeywordV181(overrides[baseKey]?.keyword) === wanted) return baseKey;
  }
  return "";
}
function getAdditionalPrefixRuleMetaV229(keyword) {
  const normalized = normalizeProductPrefixKeywordV181(keyword);
  const settings = loadJSON("importSystemSettings", {});
  const additional = Array.isArray(settings.productPrefixAdditionalRules) ? settings.productPrefixAdditionalRules : [];
  return additional.find(rule => normalizeProductPrefixKeywordV181(Array.isArray(rule) ? rule[0] : rule?.keyword) === normalized) || null;
}

function isProductPrefixRuleLockedV229(keyword, prefix) {
  return isProductPrefixRuleUsedV229(keyword, prefix);
}

function persistUsedPrefixRuleLocksV229() {
  // V24.6: lock is derived from active Products, so cleanup can unlock it.
}


const PRODUCT_PREFIX_CANONICAL_V333 = Object.freeze([
  {cn:"黄杨", en:"Buxus Boxwood", prefix:"BX", aliases:["黄杨","Buxus","Boxwood"]},
  {cn:"水梅", en:"Jeliti Anting Puteri", prefix:"JL", aliases:["水梅","Jeliti","Anting Puteri","Water Jasmine"]},
  {cn:"凌珊", en:"Bluebell", prefix:"BB", aliases:["凌珊","Bluebell"]},
  {cn:"罗汉松", en:"Podocarpus", prefix:"PD", aliases:["罗汉松","Podocarpus"]},
  {cn:"李氏樱桃", en:"Lee Cherry Sakura", prefix:"SK", aliases:["李氏樱桃","Lee Cherry","Sakura"]},
  {cn:"寿娘子", en:"Sancang Bebuas", prefix:"SC", aliases:["寿娘子","Premna","Sancang","Bebuas"]},
  {cn:"酸豆", en:"Asam Jawa", prefix:"AS", aliases:["酸豆","Asam Jawa"]},
  {cn:"三角梅", en:"Bougainvillea", prefix:"BV", aliases:["三角梅","Bougainvillea"]},
  {cn:"七里香", en:"Murraya", prefix:"MR", aliases:["七里香","九里香","Murraya"]},
  {cn:"仙丹", en:"Ixora", prefix:"IX", aliases:["仙丹","Ixora"]},
  {cn:"真柏 / 系鱼川", en:"Juniperus / Itoigawa Shimpaku", prefix:"JU", aliases:["真柏","Juniperus","系鱼川","Itoigawa","Itoigawa Shimpaku"]},
  {cn:"福建茶", en:"HoKian Tea Fujian Tea", prefix:"HK", aliases:["福建茶","Ho Kian Tea","HoKian Tea","Fujian Tea","Fukien Tea"]}
]);

function getPrefixEnglishMetaV319(keyword) {
  const settings = getCachedSettingsV317();
  const map = settings.productPrefixEnglishV319 && typeof settings.productPrefixEnglishV319 === "object" ? settings.productPrefixEnglishV319 : {};
  const key = normalizeProductPrefixKeywordV181(keyword);
  const canonical = PRODUCT_PREFIX_CANONICAL_V333.find(row => row.aliases.some(a => normalizeProductPrefixKeywordV181(a) === key) || normalizeProductPrefixKeywordV181(row.cn) === key);
  return { english:String(map[key] ?? canonical?.en ?? "").trim(), aliases:[] };
}
function savePrefixEnglishMetaV319(keyword, english) {
  const settings = loadJSON("importSystemSettings", {}), key = normalizeProductPrefixKeywordV181(keyword);
  const englishMap = { ...(settings.productPrefixEnglishV319 || {}) };
  englishMap[key] = String(english || "").trim();
  saveJSON("importSystemSettings", { ...settings, productPrefixEnglishV319: englishMap });
  if (typeof markCloudSettingsSaved === "function") markCloudSettingsSaved();
}
function getPrefixEditorRowsV333() {
  const rules = getProductPrefixRulesV181();
  const rows = PRODUCT_PREFIX_CANONICAL_V333.map(base => {
    const present = rules.filter(([keyword,prefix]) => String(prefix||"").toUpperCase() === base.prefix && base.aliases.some(a => normalizeProductPrefixKeywordV181(a) === normalizeProductPrefixKeywordV181(keyword)));
    const locked = present.some(([k,p]) => isProductPrefixRuleLockedV229(k,p));
    const english = getPrefixEnglishMetaV319(base.cn).english || base.en;
    return {keyword:base.cn, english, prefix:base.prefix, locked, builtin:true};
  });
  const canonicalKeywords = new Set(PRODUCT_PREFIX_CANONICAL_V333.flatMap(r => r.aliases.map(normalizeProductPrefixKeywordV181)));
  rules.forEach(([keyword,prefix]) => {
    if (canonicalKeywords.has(normalizeProductPrefixKeywordV181(keyword))) return;
    rows.push({keyword, english:getPrefixEnglishMetaV319(keyword).english, prefix, locked:isProductPrefixRuleLockedV229(keyword,prefix), builtin:false});
  });
  return rows;
}
function renderProductPrefixRulesV181() {
  const list = document.getElementById("productPrefixRulesList"); if (!list) return;
  list.innerHTML = getPrefixEditorRowsV333().map((row, index) => `
    <div class="product-prefix-row-v339" role="row">
      <span class="product-prefix-index-v339">${index + 1}</span>
      <span>${escapeHTML(row.keyword)}</span>
      <span>${escapeHTML(row.english || "—")}</span>
      <strong>${escapeHTML(row.prefix)}</strong>
      <div class="product-prefix-actions-v339">
        <button type="button" class="secondary-btn" data-prefix-edit-v333="${escapeHTML(row.keyword)}">修改</button>
        <button type="button" class="danger-btn" data-prefix-delete-v333="${escapeHTML(row.keyword)}" ${row.locked ? "disabled title=\"已有产品关联，不能删除\"" : ""}>删除</button>
      </div>
    </div>`).join("");
}
let productPrefixEditorModeV333 = "new";
let productPrefixEditorOriginalV333 = null;
function setProductPrefixEditorV333(row = null, mode = "new") {
  const cn=document.getElementById("newProductPrefixKeyword"), en=document.getElementById("newProductPrefixEnglishV319"), pre=document.getElementById("newProductPrefixCode"), status=document.getElementById("productPrefixRulesStatus");
  productPrefixEditorModeV333=mode; productPrefixEditorOriginalV333=row ? {...row} : null;
  if (!cn||!en||!pre) return;
  if (!row) { cn.value=""; en.value=""; pre.value=""; cn.disabled=false; pre.disabled=false; if(status)status.textContent=""; return; }
  cn.value=row.keyword||""; en.value=row.english||""; pre.value=row.prefix||"";
  const lock = row.locked === true || row.builtin === true;
  cn.disabled=lock; pre.disabled=lock;
  if(status) status.textContent = mode === "delete" ? `准备删除：${row.keyword} / ${row.prefix}` : `修改：${row.keyword} / ${row.prefix}`;
  document.querySelector(".product-prefix-editor-v333")?.scrollIntoView({behavior:"smooth",block:"center"});
}
function setupProductPrefixSettingsV181() {
  const cn=document.getElementById("newProductPrefixKeyword"), en=document.getElementById("newProductPrefixEnglishV319"), pre=document.getElementById("newProductPrefixCode"), save=document.getElementById("addProductPrefixRuleBtn"), status=document.getElementById("productPrefixRulesStatus");
  const bonsaiDetailsV339=document.getElementById("productPrefixSettingsV339");
  document.querySelectorAll("[data-open-bonsai-prefix-v339]").forEach(node=>node.addEventListener("click",event=>{event.preventDefault();event.stopPropagation();if(!bonsaiDetailsV339)return;bonsaiDetailsV339.open=true;window.requestAnimationFrame(()=>bonsaiDetailsV339.scrollIntoView({behavior:"smooth",block:"start"}));}));
  if(!cn||!en||!pre||!save)return; removeWhiteWaxTestPrefixV182(); renderProductPrefixRulesV181();
  cn.addEventListener("input",()=>{
    if(productPrefixEditorModeV333!=="new")return;
    const key=normalizeProductPrefixKeywordV181(cn.value);
    const known=PRODUCT_PREFIX_CANONICAL_V333.find(row=>row.aliases.some(a=>normalizeProductPrefixKeywordV181(a)===key) || normalizeProductPrefixKeywordV181(row.cn)===key);
    if(known){ en.value=getPrefixEnglishMetaV319(known.cn).english||known.en; pre.value=known.prefix; cn.disabled=true; pre.disabled=true; productPrefixEditorOriginalV333={keyword:known.cn,english:en.value,prefix:known.prefix,locked:true,builtin:true}; productPrefixEditorModeV333="edit"; if(status)status.textContent=`已识别 ${known.cn}：只允许修改英文`; }
  });
  pre.addEventListener("input",()=>{pre.value=String(pre.value||"").replace(/[^a-z]/gi,"").toUpperCase().slice(0,2)});
  document.getElementById("productPrefixRulesList")?.addEventListener("click",event=>{
    const key=String(event.target.closest("[data-prefix-edit-v333]")?.dataset.prefixEditV333 || event.target.closest("[data-prefix-delete-v333]")?.dataset.prefixDeleteV333 || "").trim(); if(!key)return;
    const row=getPrefixEditorRowsV333().find(r=>r.keyword===key); if(!row)return;
    if(event.target.closest("[data-prefix-delete-v333]")){ if(row.locked){window.alert("这个前缀已有产品使用，只允许修改英文，不能删除。");return;} setProductPrefixEditorV333(row,"delete"); }
    else setProductPrefixEditorV333(row,"edit");
  });
  save.addEventListener("click",()=>{
    const keyword=String(cn.value||"").trim(), english=String(en.value||"").trim(), prefix=String(pre.value||"").trim().toUpperCase();
    if(!keyword){if(status)status.textContent="请输入中文关键词";return;}
    if(english.length>15 && (!productPrefixEditorOriginalV333 || english!==productPrefixEditorOriginalV333.english)){if(status)status.textContent="英文最多15个字；现有较长英文可保留不变";return;}
    if(keyword.length>15 && (!productPrefixEditorOriginalV333 || keyword!==productPrefixEditorOriginalV333.keyword)){if(status)status.textContent="中文最多15个字";return;}
    if(!/^[A-Z]{2}$/.test(prefix)){if(status)status.textContent="前缀必须是2个英文字母";return;}
    if(productPrefixEditorModeV333==="delete"){
      const row=productPrefixEditorOriginalV333; if(!row||row.locked){if(status)status.textContent="已有产品关联，不能删除";return;}
      if(!window.confirm(`确认删除盆栽前缀规则？\n${row.keyword} → ${row.prefix}`))return;
      if(status)status.textContent="删除中..."; save.disabled=true;
      const settings=loadJSON("importSystemSettings",{}), additional=(Array.isArray(settings.productPrefixAdditionalRules)?settings.productPrefixAdditionalRules:[]).filter(item=>normalizeProductPrefixKeywordV181(Array.isArray(item)?item[0]:item?.keyword)!==normalizeProductPrefixKeywordV181(row.keyword));
      saveJSON("importSystemSettings",{...settings,productPrefixAdditionalRules:additional}); if(typeof markCloudSettingsSaved==="function")markCloudSettingsSaved();
      renderProductPrefixRulesV181(); setProductPrefixEditorV333(); if(status)status.textContent="已经删除"; save.disabled=false; return;
    }
    const row=productPrefixEditorOriginalV333;
    if(productPrefixEditorModeV333==="edit" && row){
      const before=`${row.keyword} / ${row.english||"—"} / ${row.prefix}`, after=`${keyword} / ${english||"—"} / ${prefix}`;
      if(!window.confirm(`确认修改盆栽前缀规则？\n\n修改前：${before}\n修改后：${after}`))return;
      if(status)status.textContent="修改保存中..."; save.disabled=true;
      savePrefixEnglishMetaV319(row.keyword,english); renderProductPrefixRulesV181(); setProductPrefixEditorV333(); if(status)status.textContent="修改成功"; save.disabled=false; return;
    }
    if(getProductPrefixRulesV181().some(([k])=>normalizeProductPrefixKeywordV181(k)===normalizeProductPrefixKeywordV181(keyword))){if(status)status.textContent=`“${keyword}”已经存在`;return;}
    if(getCategoryPrefixConflictV229(prefix)){if(status)status.textContent=`前缀 ${prefix} 已被使用`;return;}
    if(status)status.textContent="新增前缀保存中..."; save.disabled=true;
    const settings=loadJSON("importSystemSettings",{}),additional=Array.isArray(settings.productPrefixAdditionalRules)?settings.productPrefixAdditionalRules.slice():[]; additional.push({keyword,prefix});
    saveJSON("importSystemSettings",{...settings,productPrefixAdditionalRules:additional}); savePrefixEnglishMetaV319(keyword,english); if(typeof markCloudSettingsSaved==="function")markCloudSettingsSaved();
    renderProductPrefixRulesV181(); setProductPrefixEditorV333(); if(status)status.textContent="保存成功"; save.disabled=false;
  });
}
function removeWhiteWaxTestPrefixV182() {
  const settings=loadJSON("importSystemSettings",{}), additional=Array.isArray(settings.productPrefixAdditionalRules)?settings.productPrefixAdditionalRules:[];
  const filtered=additional.filter(rule=>{const keyword=String(Array.isArray(rule)?rule[0]:rule?.keyword||""),prefix=String(Array.isArray(rule)?rule[1]:rule?.prefix||"").trim().toUpperCase();return !(normalizeProductPrefixKeywordV181(keyword)===normalizeProductPrefixKeywordV181("白蜡")&&prefix==="BX")});
  if(filtered.length!==additional.length){saveJSON("importSystemSettings",{...settings,productPrefixAdditionalRules:filtered});if(typeof markCloudSettingsSaved==="function")markCloudSettingsSaved()}
}

function getProductPrefix(category, name = "") {
  const normalizedCategory = normalizePrimaryProductCategoryV255(category);
  if (normalizedCategory === "盆栽") {
    const compact = normalizeProductPrefixKeywordV181(name);
    const matched = getProductPrefixRulesV181().find(([keyword]) => compact.includes(normalizeProductPrefixKeywordV181(keyword)));
    return matched ? matched[1] : "BS";
  }
  const rule = getProductCategoryRulesV228().find(item => item.name === normalizedCategory);
  return rule?.prefix || "QT";
}

function generateNextProductIdFromPrefixV240(products, preferredPrefix) {
  const prefix = normalizeCategoryPrefixV228(preferredPrefix || "") || "BS";
  const settings = loadJSON("importSystemSettings", {});
  const aliases = settings.productIdAliases || {};
  const used = new Set([
    ...products.map(p => String(p.id || "").trim()),
    ...getImports().map(row => String(row.productId || "").trim()),
    ...Object.keys(aliases), ...Object.values(aliases)
  ]);
  for (let number = 1; number <= 9999; number += 1) {
    const candidate = `${prefix}${String(number).padStart(4, "0")}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new Error(`${prefix} 编号已经用完，请检查资料。`);
}

function generateNextProductId(products, category = "盆栽", name = "") {
  return generateNextProductIdFromPrefixV240(products, getProductPrefix(category, name));
}

function replaceProductIdDeepV163(value, oldId, nextId) {
  if (typeof value === "string") return value === oldId ? nextId : value;
  if (Array.isArray(value)) return value.map(item => replaceProductIdDeepV163(item, oldId, nextId));
  if (value && typeof value === "object") {
    const out = {};
    Object.entries(value).forEach(([key, item]) => {
      out[key === oldId ? nextId : key] = replaceProductIdDeepV163(item, oldId, nextId);
    });
    return out;
  }
  return value;
}

function saveProduct() {
  const products = getProducts();
  const editingId = document.getElementById("editingProductId").value;
  const name = document.getElementById("productName").value.trim();
  const category = document.getElementById("productCategory").value;
  const status = "启用";
  const remark = document.getElementById("productRemark").value.trim();
  const statusText = document.getElementById("productStatusText");

  if (!name) {
    statusText.textContent = "请输入产品名称";
    return;
  }

  if (Array.from(name).length > 15) {
    statusText.textContent = "产品名称最多15个字";
    return;
  }

  const duplicate = products.find(product =>
    product.name.toLowerCase() === name.toLowerCase() && product.id !== editingId
  );

  if (duplicate) {
    statusText.textContent = "已有相同名称的产品";
    return;
  }

  const pendingProductId = editingId || generateNextProductId(products, category, name);
  const actionLabel = editingId ? "修改并保存产品" : "新增并保存产品";
  if (!window.confirm(
    `⚠️ 确认${actionLabel}？\n\n产品编号：${pendingProductId}\n产品名称：${name}\n类别：${category}\n备注：${remark || "—"}\n\n只有按「确定」后才会写入资料。`
  )) return;

  if (editingId) {
    const index = products.findIndex(product => product.id === editingId);
    if (index === -1) {
      statusText.textContent = "找不到要修改的产品";
      return;
    }

    let finalId = editingId;
    const suffix = String(editingId).match(/^[A-Z]{2}(\d{4})$/)?.[1];
    const desiredPrefix = getProductPrefix(category, name);
    const currentPrefix = String(editingId).slice(0, 2);
    if (suffix && desiredPrefix !== currentPrefix && window.confirm(
      `产品名称对应前缀已改变：${editingId} → ${desiredPrefix}${suffix}\n\n按「确定」同时迁移编号及关联资料；按「取消」只修改名称，编号保持不变。`
    )) {
      const nextId = `${desiredPrefix}${suffix}`;
      if (products.some((product, productIndex) => productIndex !== index && product.id === nextId)) {
        statusText.textContent = `编号 ${nextId} 已存在，产品没有修改`;
        return;
      }
      finalId = nextId;
      saveImports(replaceProductIdDeepV163(getImports(), editingId, nextId));
      saveBatches(replaceProductIdDeepV163(getBatches(), editingId, nextId));
      const settings = replaceProductIdDeepV163(loadJSON("importSystemSettings", {}), editingId, nextId);
      settings.productIdAliases = { ...(settings.productIdAliases || {}), [editingId]: nextId };
      saveJSON("importSystemSettings", settings);
      if (typeof markCloudSettingsSaved === "function") markCloudSettingsSaved();
    }

    products[index] = {
      ...products[index],
      id: finalId,
      name,
      category,
      status,
      remark,
      updatedAt: new Date().toISOString()
    };

    statusText.textContent = "产品已修改";
  } else {
    products.push({
      id: generateNextProductId(products, category, name),
      name,
      category,
      status,
      remark,
      stock: 0,
      averageCost: 0,
      minimumPrice: 0,
      minimumPriceManual: false,
      lastImport: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    statusText.textContent = "产品已新增";
  }

  saveProducts(products);
  renderProductList();
  renderInventoryManagementList();
  renderDashboard();
  resetProductForm(false);

  setTimeout(() => {
    statusText.textContent = "";
  }, 1800);
}


function normalizeSmartSearchText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\s\u3000\-_./\\,，、:：;；()（）[\]【】{}"'`~!！?？@#$%^&*+=|<>]+/g, "");
}

function smartSearchMatches(searchableValue, queryValue) {
  const sourceRaw = String(searchableValue || "").normalize("NFKC");
  const queryRaw = String(queryValue || "").normalize("NFKC").trim();

  if (!queryRaw) return true;

  const source = normalizeSmartSearchText(sourceRaw);
  const query = normalizeSmartSearchText(queryRaw);

  if (!query) return true;

  const normalizedQueryName =
    queryRaw.toLocaleLowerCase();

  const isCompleteStoredProductName =
    typeof getProducts === "function" &&
    getProducts().some(product =>
      String(product?.name || "")
        .normalize("NFKC")
        .trim()
        .toLocaleLowerCase() === normalizedQueryName
    );

  if (isCompleteStoredProductName) {
    const normalizedSourceRaw =
      sourceRaw.toLocaleLowerCase();

    if (normalizedSourceRaw === normalizedQueryName) {
      return true;
    }

    const escapedQuery = normalizedQueryName.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    const exactFieldPattern = new RegExp(
      `(?:^|\\s)${escapedQuery}(?:\\s|$)`,
      "u"
    );

    return exactFieldPattern.test(normalizedSourceRaw);
  }

  if (source.includes(query)) return true;

  const tokens = queryRaw
    .toLocaleLowerCase()
    .split(/[\s\u3000\-_./\\,，、:：;；()（）[\]【】{}"'`~!！?？@#$%^&*+=|<>]+/)
    .map(normalizeSmartSearchText)
    .filter(Boolean);

  if (
    tokens.length > 1 &&
    tokens.every(token => source.includes(token))
  ) {
    return true;
  }

  if (/[\u3400-\u9fff]/.test(query)) {
    const sourceCounts = new Map();

    Array.from(source).forEach(character => {
      sourceCounts.set(
        character,
        (sourceCounts.get(character) || 0) + 1
      );
    });

    return Array.from(query).every(character => {
      const count = sourceCounts.get(character) || 0;
      if (count < 1) return false;
      sourceCounts.set(character, count - 1);
      return true;
    });
  }

  return false;
}


function normalizeSequentialSearchText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\s\u3000]+/g, "");
}

function sequentialSearchMatches(searchableValue, queryValue) {
  const source = normalizeSequentialSearchText(searchableValue);
  const query = normalizeSequentialSearchText(queryValue);

  if (!query) return true;
  return source.includes(query);
}

// V24.6: shared read-only Original Cost matcher for every product-search surface.
// Pure numeric queries (commas/spaces/decimals allowed) match unitPrice exactly,
// regardless of currency. This helper only reads already-loaded local collections.
function parseOriginalCostSearchQueryV216(queryValue) {
  const text = String(queryValue || "")
    .normalize("NFKC")
    .replace(/[,，\s]/g, "");
  if (!/^\d+(?:\.\d+)?$/.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

function originalCostNumberMatchesV216(value, queryValue) {
  const query = parseOriginalCostSearchQueryV216(queryValue);
  if (query === null) return false;
  const cost = Number(value);
  return Number.isFinite(cost) && Math.abs(cost - query) < 0.000001;
}

function originalCostMatchesProductV216(product, queryValue, imports = null) {
  if (parseOriginalCostSearchQueryV216(queryValue) === null) return false;
  const rows = Array.isArray(imports) ? imports : getImports();
  const productId = String(product?.id || product?.productId || "").trim();
  const productName = String(product?.name || product?.productName || "").trim().toLowerCase();
  return rows.some(row => {
    const sameId = productId && String(row?.productId || "").trim() === productId;
    const sameName = productName && String(row?.productName || "").trim().toLowerCase() === productName;
    return (sameId || sameName) && originalCostNumberMatchesV216(row?.unitPrice, queryValue);
  });
}

// V24.6: record/batch-level searches must match the Original Cost stored on
// that exact row. Never fall back to another import row of the same Product ID,
// otherwise a 320 search can incorrectly pull in a 200 batch for the same product.
function originalCostMatchesBatchItemV216(item, queryValue) {
  return originalCostNumberMatchesV216(item?.unitPrice, queryValue);
}

// V24.6: a pure numeric product-search query is reserved exclusively for
// exact Original Cost matching. It must never fall through to product names,
// IDs, import numbers, tracking numbers, dates, quantities, or other numeric text.
function isOriginalCostOnlySearchV218(queryValue) {
  return parseOriginalCostSearchQueryV216(queryValue) !== null;
}

function isProductFuzzySearchReadyV238(queryValue) {
  const text = String(queryValue || "").normalize("NFKC").trim();
  if (!text) return false;
  const chineseCount = (text.match(/[\u3400-\u9fff]/g) || []).length;
  if (chineseCount > 0) return chineseCount >= 2;
  const latinCount = (text.match(/[A-Za-z]/g) || []).length;
  return latinCount >= 3;
}

function getProductSearchPrefixAliasesV238(product) {
  const aliases = new Set();
  const id = String(product?.id || product?.productId || "").trim().toUpperCase();
  const idPrefix = id.match(/^([A-Z]{2})/);
  if (idPrefix) aliases.add(idPrefix[1]);

  const name = String(product?.name || product?.productName || "").trim();
  const category = normalizeProductCategoryNameV227(product?.category || "盆栽");
  if (category === "盆栽") {
    const rule = findNamePrefixRuleV231(name);
    if (rule?.[1]) aliases.add(String(rule[1]).trim().toUpperCase());
  } else {
    const categoryRule = getProductCategoryRulesV228().find(rule =>
      rule?.mode === "category" &&
      normalizeProductCategoryNameV227(rule?.name) === category
    );
    if (categoryRule?.prefix) aliases.add(String(categoryRule.prefix).trim().toUpperCase());
  }
  return [...aliases].filter(Boolean);
}

function productExactOrPrefixSearchMatchesV238(product, queryValue) {
  const raw = String(queryValue || "").normalize("NFKC").trim();
  if (!raw) return true;
  const query = normalizeSmartSearchText(raw);
  if (!query) return true;

  const id = normalizeSmartSearchText(product?.id || product?.productId || "");
  const name = normalizeSmartSearchText(product?.name || product?.productName || "");
  const category = normalizeSmartSearchText(product?.category || "");
  if (name === query || category === query) return true;

  // Product-number searches stay responsive even below the general fuzzy threshold.
  if (id && query.length >= 2 && id.includes(query)) return true;

  const prefixes = getProductSearchPrefixAliasesV238(product)
    .map(normalizeSmartSearchText)
    .filter(Boolean);
  return prefixes.some(prefix => prefix === query);
}

function productSearchMatchesV218(searchableValue, product, queryValue, imports = null) {
  if (!String(queryValue || '').trim()) return true;
  if (isOriginalCostOnlySearchV218(queryValue)) {
    return originalCostMatchesProductV216(product, queryValue, imports);
  }
  if (productExactOrPrefixSearchMatchesV238(product, queryValue)) return true;
  // V24.6 regression fix: real inventory must keep accepting embedded code-like
  // fragments such as BX680 / bx680 / Bx680 even though they contain only two
  // Latin letters. This runs before ordinary product matching and never broadens
  // single-letter queries.
  const compactCodeQueryV241 = normalizeSmartSearchText(queryValue);
  if (/[a-z]/i.test(compactCodeQueryV241) && /\d/.test(compactCodeQueryV241) && compactCodeQueryV241.length >= 3) {
    const codeTargetV241 = `${product?.name || ""} ${product?.id || product?.productId || ""}`;
    if (smartSearchMatches(codeTargetV241, queryValue) || sequentialSearchMatches(codeTargetV241, queryValue)) return true;
  }
  if (!isProductFuzzySearchReadyV238(queryValue)) return false;
  const aliases = getProductSearchPrefixAliasesV238(product).join(" ");
  return smartSearchMatches(`${searchableValue || ""} ${aliases}`.trim(), queryValue);
}

function batchItemSearchMatchesV218(searchableValue, item, queryValue) {
  if (!String(queryValue || '').trim()) return true;
  if (isOriginalCostOnlySearchV218(queryValue)) {
    return originalCostMatchesBatchItemV216(item, queryValue);
  }
  return smartSearchMatches(searchableValue, queryValue);
}

// V24.6: shared read-only shipment/local-number search helper.
// Uses the same stored field (overseasTrackingNumber) but the UI now labels it
// “海外运输单号 / 本地单号”. Symbol-tolerant smart matching means XX-A430
// can be found with A430, xx a430, etc.
function getBatchShipmentLocalNumberV235(batch) {
  return String(batch?.overseasTrackingNumber || batch?.trackingNumber || "").trim();
}

function shipmentLocalNumberMatchesV235(value, queryValue) {
  if (!String(queryValue || "").trim()) return true;
  if (isOriginalCostOnlySearchV218(queryValue)) return false;
  return smartSearchMatches(String(value || ""), queryValue);
}

function getProductShipmentLocalNumbersV235(product, imports = null, batches = null) {
  const rows = Array.isArray(imports) ? imports : getImports();
  const batchRows = Array.isArray(batches) ? batches : getBatches();
  const batchByImportNumber = new Map(batchRows.map(batch => [
    String(batch?.importNumber || "").trim().toLowerCase(), batch
  ]));
  const productId = String(product?.id || product?.productId || "").trim();
  const productName = String(product?.name || product?.productName || "").trim().toLowerCase();
  const values = new Set();
  rows.forEach(row => {
    const sameId = productId && String(row?.productId || "").trim() === productId;
    const sameName = productName && String(row?.productName || "").trim().toLowerCase() === productName;
    if (!sameId && !sameName) return;
    const batch = batchByImportNumber.get(String(row?.importNumber || "").trim().toLowerCase());
    [row?.overseasTrackingNumber, row?.trackingNumber, batch?.overseasTrackingNumber, batch?.trackingNumber]
      .map(value => String(value || "").trim()).filter(Boolean).forEach(value => values.add(value));
  });
  return [...values].join(" ");
}

function productSearchMatchesWithShipmentV235(searchableValue, product, queryValue, imports = null, batches = null) {
  if (productSearchMatchesV218(searchableValue, product, queryValue, imports)) return true;
  if (isOriginalCostOnlySearchV218(queryValue)) return false;
  return shipmentLocalNumberMatchesV235(
    getProductShipmentLocalNumbersV235(product, imports, batches),
    queryValue
  );
}

function renderProductList() {
  const searchNode = document.getElementById("productSearch");
  const list = document.getElementById("productList");
  const count = document.getElementById("productListCount");
  // V33.9: legacy Product List UI was removed; callers may still refresh it.
  // Exit quietly instead of turning a successful Profit Management save into an error.
  if (!searchNode || !list || !count) return;
  const products = getProducts();
  const keyword = String(searchNode.value || "").trim().toLowerCase();
  const filtered = products.filter(product => {
    const target =
      `${product.id} ${product.name} ${productEnglishNameV262(product)} ${product.category}`;
    return productSearchMatchesWithShipmentV235(target, product, keyword);
  });

  count.textContent = `${filtered.length} 项`;
  if (!filtered.length) {
    list.innerHTML = '<div class="empty-state">暂无符合的产品</div>';
    return;
  }

  list.innerHTML = filtered
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(product => `
      <article class="product-card">
        <div class="product-card-head">
          <div>
            <h4>${escapeHTML(product.name)}${productEnglishNameV262(product)?`<small class="product-english-name-v262">${escapeHTML(productEnglishNameV262(product))}</small>`:""}</h4>
            <div class="product-code">${escapeHTML(product.id)}</div>
          </div>
          <div class="product-badges">
            <span class="badge">${escapeHTML(normalizePrimaryProductCategoryV255(product.category))}</span>
          </div>
        </div>
        ${product.remark ? `<p class="product-remark">${escapeHTML(product.remark)}</p>` : ""}
        <div class="product-actions">
          <button class="small-btn edit-btn" type="button" onclick="editProduct('${product.id}')">编辑</button>
          <button class="small-btn delete-btn" type="button" onclick="deleteProduct('${product.id}')">删除</button>
        </div>
      </article>
    `).join("");
}

function editProduct(id) {
  const product = getProducts().find(item => item.id === id);
  if (!product) return;

  document.getElementById("editingProductId").value = product.id;
  document.getElementById("productId").value = product.id;
  document.getElementById("productName").value = product.name;
  document.getElementById("nameCounter").textContent = `${Array.from(product.name).length} / 15`;
  document.getElementById("productCategory").value = normalizePrimaryProductCategoryV255(product.category);
  document.getElementById("productRemark").value = product.remark || "";
  document.getElementById("productStatusText").textContent = `正在编辑 ${product.id}`;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function deleteProduct(id) {
  const products = getProducts();
  const product = products.find(item => item.id === id);
  if (!product) return;

  const hasImportHistory = (Number(product.stock) || 0) > 0 || (Number(product.averageCost) || 0) > 0 || product.lastImport;

  if (hasImportHistory) {
    alert("此产品已有库存或进口记录，不能删除。");
    return;
  }

  const confirmed = confirm(`确定删除 ${product.id} · ${product.name}？`);
  if (!confirmed) return;

  saveProducts(products.filter(item => item.id !== id));
  renderProductList();
  renderDashboard();
  resetProductForm();
}

function resetProductForm(clearStatus = true) {
  document.getElementById("editingProductId").value = "";
  document.getElementById("productId").value = "自动生成";
  document.getElementById("productName").value = "";
  document.getElementById("nameCounter").textContent = "0 / 15";
  document.getElementById("productCategory").value = "盆栽";
  document.getElementById("productRemark").value = "";
  if (clearStatus) {
    document.getElementById("productStatusText").textContent = "";
  }
}



let batchRowSeq = 0;
let batchListExpanded = false;
function bindBatchMoneyInput(id) {
  const input = document.getElementById(id);
  if (!input || input.dataset.batchBound === "1") return;

  input.dataset.batchBound = "1";
  input.addEventListener("focus", () => input.select());
  input.addEventListener("input", calculateBatch);
  input.addEventListener("blur", () => {
    formatInputAmount(input);
    calculateBatch();
  });
}

let currentEditingImportNumber = "";

function setBatchEditMode(importNumber = "") {
  currentEditingImportNumber = importNumber;

  const modeBox = document.getElementById("batchEditMode");
  const label = document.getElementById("currentImportNumberLabel");
  const saveButton = document.getElementById("saveBatchBtn");

  if (!modeBox || !label || !saveButton) return;

  if (importNumber) {
    modeBox.hidden = false;
    label.textContent = importNumber;
    saveButton.textContent = "保存/更新进口记录";
    saveButton.classList.add("update-mode");
  } else {
    modeBox.hidden = true;
    label.textContent = "";
    saveButton.textContent = "保存/更新进口记录";
    saveButton.classList.remove("update-mode");
  }

  applyBatchCostEditability();
}

function setupImportModule(){
  setupDatePickers();

  document.getElementById("addBatchRowBtn").addEventListener("click",()=>addBatchRow());

  const batchLookupInput =
    document.getElementById("batchLookupInput");
  let lastCompletedBatchLookup = "";
  let lastNotFoundBatchLookup = "";
  let batchLookupTimer = 0;

  const notifyBatchLookupNotFoundOnce = () => {
    const value = String(batchLookupInput?.value || "").trim();
    if (!value) return false;

    const normalizedValue = value.toLowerCase();
    const exactMatch = getBatches().some(batch =>
      [batch.importNumber, batch.overseasTrackingNumber].some(candidate =>
        String(candidate || "").trim().toLowerCase() === normalizedValue
      )
    );

    if (exactMatch) {
      lastNotFoundBatchLookup = "";
      return runBatchLookupFromKeyboard({ exactOnly: true });
    }

    if (normalizedValue !== lastNotFoundBatchLookup) {
      lastNotFoundBatchLookup = normalizedValue;
      alert("找不到这个进口编号或海外运输单号 / 本地单号。");
    }

    // V6.8: do not refocus/select the field after the alert.
    // The typed value remains editable, so a wrong entry never becomes trapped.
    return false;
  };

  const runBatchLookupFromKeyboard = ({
    exactOnly = false,
    blurAfter = false
  } = {}) => {
    window.clearTimeout(batchLookupTimer);

    const value = String(batchLookupInput?.value || "").trim();
    if (!value) return false;

    const normalizedValue = value.toLowerCase();

    if (exactOnly) {
      const exactMatch = getBatches().some(batch => {
        return [
          batch.importNumber,
          batch.overseasTrackingNumber
        ].some(candidate =>
          String(candidate || "").trim().toLowerCase() ===
            normalizedValue
        );
      });

      if (!exactMatch) return false;
    }

    if (
      normalizedValue === lastCompletedBatchLookup &&
      document.activeElement !== batchLookupInput
    ) {
      return false;
    }

    lastCompletedBatchLookup = normalizedValue;
    loadBatchByNumber();

    if (blurAfter && document.activeElement === batchLookupInput) {
      batchLookupInput.blur();
    }

    return true;
  };

  batchLookupInput?.addEventListener("keydown", event => {
    if (event.key !== "Enter") return;

    event.preventDefault();
    event.stopPropagation();

    runBatchLookupFromKeyboard({ blurAfter: true });
  });

  // iPhone 键盘工具栏的 ✓ / Done 会先结束输入或令输入框失焦。
  // change 与 blur 都接入同一函数，并以值去重，确保只载入一次。
  // V6.8: change / blur only auto-load when the typed value is an exact
  // saved import number or overseas tracking number. An incomplete or wrong
  // value must remain editable and must never trap the user in an alert loop.
  batchLookupInput?.addEventListener("change", () => {
    notifyBatchLookupNotFoundOnce();
  });

  batchLookupInput?.addEventListener("blur", () => {
    batchLookupTimer = window.setTimeout(() => {
      notifyBatchLookupNotFoundOnce();
    }, 0);
  });

  // 中文/第三方输入法按 ✓ 完成候选字时，若已经是完整编号，
  // 不必再按第二次 Enter。
  batchLookupInput?.addEventListener("compositionend", () => {
    batchLookupTimer = window.setTimeout(() => {
      runBatchLookupFromKeyboard({ exactOnly: true });
    }, 60);
  });

  batchLookupInput?.addEventListener("input", () => {
    const normalizedValue =
      String(batchLookupInput.value || "").trim().toLowerCase();

    if (normalizedValue !== lastCompletedBatchLookup) {
      lastCompletedBatchLookup = "";
    }
    if (normalizedValue !== lastNotFoundBatchLookup) {
      lastNotFoundBatchLookup = "";
    }

    // V26.6 iPhone: the keyboard accessory-bar ✓ can commit/hide the
    // keyboard without emitting Enter and, on some iOS/browser combinations,
    // without a useful blur/change event. As soon as the typed value becomes an
    // exact saved import/tracking number, perform the same lookup after a short
    // debounce. Wrong or incomplete values are never auto-alerted or trapped.
    window.clearTimeout(batchLookupTimer);
    batchLookupTimer = window.setTimeout(() => {
      runBatchLookupFromKeyboard({ exactOnly: true });
    }, 120);
  });
  document.getElementById("resetBatchBtn").addEventListener("click",()=>{
    if(confirm("确定清空本次输入？已保存的草稿和正式资料都不会被删除。")) {
      activeImportDraftIdV242 = "";
      resetBatchForm({ clearLookup: true });
      renderImportDraftsV242();
    }
  });

  const batchForm = document.getElementById("batchImportForm");

  batchForm.addEventListener("submit", event => {
    event.preventDefault();
    if (currentEditingImportNumber) {
      saveBatchImport();
      return;
    }
    saveImportDraftV242();
  });

  batchForm.addEventListener("keydown", event => {
    const target = event.target;

    if (
      !(target instanceof HTMLInputElement) &&
      !(target instanceof HTMLSelectElement)
    ) {
      return;
    }

    const isArrowKey = [
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown"
    ].includes(event.key);

    if (isArrowKey) {
      const row = target.closest("#batchRows tr");

      // 方向键只控制“同批进口产品”表格，不影响下面的批次资料输入框。
      if (row) {
        // 产品名称属于文字输入框：
        // 左右键先正常移动文字光标，只有到达最左或最右才跳格。
        if (
          target instanceof HTMLInputElement &&
          target.classList.contains("batch-name") &&
          (event.key === "ArrowLeft" || event.key === "ArrowRight")
        ) {
          const start = target.selectionStart ?? 0;
          const end = target.selectionEnd ?? start;
          const hasSelection = start !== end;

          if (hasSelection) return;

          if (event.key === "ArrowLeft" && start > 0) return;
          if (event.key === "ArrowRight" && end < target.value.length) return;
        }

        event.preventDefault();
        moveBatchField(target, event.key);
      }

      return;
    }

    if (event.key !== "Enter") return;

    event.preventDefault();

    if (
      target instanceof HTMLInputElement &&
      target.inputMode === "decimal"
    ) {
      formatInputAmount(target);
    }

    calculateBatch();

    const moved = moveToNextBatchField(target);

    if (!moved && target instanceof HTMLElement) {
      target.blur();
    }
  });
  ["batchChinaTransportCost","batchPotCost","batchShippingMY","batchRate"].forEach(id=>{
    const x=document.getElementById(id); x.addEventListener("focus",()=>x.select());
    x.addEventListener("input",()=>{
      if (id === "batchRate") refreshAutoOriginalCostsForBatchV249();
      else calculateBatch();
    });
    x.addEventListener("blur",()=>{
      formatInputAmount(x);
      if (id === "batchRate") refreshAutoOriginalCostsForBatchV249();
      else calculateBatch();
    });
  });
  document.getElementById("batchCurrency").addEventListener("change",()=>{
    batchCurrencyManuallySelectedV229 = true;
    clearAutoArrivalWhenLeavingMYRV230();
    applyBatchRate();
    setTodayArrivalForMYRV229();
    refreshAutoOriginalCostsForBatchV249();
    calculateBatch();
  });

  const batchSearch = document.getElementById("batchSearch");
  const toggleBatchListBtn = document.getElementById("toggleBatchListBtn");
  const productStockSearch =
    document.getElementById("batchProductStockSearch");

  if (batchSearch) {
    batchSearch.addEventListener("input", () => {
      const keyword = String(batchSearch.value || "").trim();

      if (keyword && productStockSearch) {
        productStockSearch.value = "";
      }

      const productResults =
        document.getElementById("batchProductStockResults");
      const productStatus =
        document.getElementById("batchProductStockStatus");
      const recentBatchArea =
        document.getElementById("recentBatchResultsArea");

      if (productResults) {
        productResults.hidden = true;
        productResults.innerHTML = "";
      }

      if (productStatus) productStatus.textContent = "";
      if (recentBatchArea) recentBatchArea.hidden = false;

      batchListExpanded = false;
      scheduleSearchRenderV302("recent-batch", renderBatchList);
    });
  }

  if (productStockSearch) {
    productStockSearch.addEventListener("input", () => {
      const keyword = String(productStockSearch.value || "").trim();

      if (keyword && batchSearch) {
        batchSearch.value = "";
      }

      batchListExpanded = false;
      scheduleSearchRenderV302("product-repair", renderBatchProductStockResults);
    });
  }

  if (toggleBatchListBtn) {
    toggleBatchListBtn.addEventListener("click", () => {
      batchListExpanded = !batchListExpanded;
      renderBatchList();
    });
  }

  renderBatchSuggestions();
  renderBatchList();
  renderBatchProductStockResults();
  resetBatchForm();
}


// ================= V26.6 Two-stage Import Save =================
const IMPORT_DRAFTS_KEY_V242 = "importDraftsV242";
const IMPORT_DRAFT_DELETED_IDS_KEY_V250 = "importDraftDeletedIdsV250";
let activeImportDraftIdV242 = "";
let importDraftCleanFingerprintV244 = "";

function getImportDraftsV242() {
  const settings = loadJSON("importSystemSettings", {});
  return Array.isArray(settings[IMPORT_DRAFTS_KEY_V242]) ? settings[IMPORT_DRAFTS_KEY_V242] : [];
}

function getImportDraftDeletedIdsV250() {
  const settings = loadJSON("importSystemSettings", {});
  return Array.isArray(settings[IMPORT_DRAFT_DELETED_IDS_KEY_V250])
    ? settings[IMPORT_DRAFT_DELETED_IDS_KEY_V250].map(String).filter(Boolean)
    : [];
}

function markImportDraftDeletedV250(draftId) {
  const id = String(draftId || "").trim();
  if (!id) return;
  const settings = loadJSON("importSystemSettings", {});
  const current = getImportDraftDeletedIdsV250();
  const ids = [id, ...current.filter(value => value !== id)].slice(0, 100);
  saveJSON("importSystemSettings", { ...settings, [IMPORT_DRAFT_DELETED_IDS_KEY_V250]: ids });
}

function clearImportDraftDeletedV250(draftId) {
  const id = String(draftId || "").trim();
  if (!id) return;
  const settings = loadJSON("importSystemSettings", {});
  const current = getImportDraftDeletedIdsV250();
  const ids = current.filter(value => value !== id);
  if (ids.length === current.length) return;
  saveJSON("importSystemSettings", { ...settings, [IMPORT_DRAFT_DELETED_IDS_KEY_V250]: ids });
}

function writeImportDraftsV242(drafts) {
  const settings = loadJSON("importSystemSettings", {});
  saveJSON("importSystemSettings", { ...settings, [IMPORT_DRAFTS_KEY_V242]: drafts.slice(0, 30) });
  if (typeof markCloudSettingsSaved === "function") markCloudSettingsSaved();
  renderImportDraftsV242();
}


// V24.6: every NEW import must be saved as a cloud draft first. Any later edit
// closes the formal-save gate until the draft is saved again.
function importDraftFingerprintV243(state) {
  const rows = (Array.isArray(state?.rows) ? state.rows : []).map(row => ({
    name: String(row?.name || "").trim(), productId: String(row?.productId || "").trim(),
    category: String(row?.category || "盆栽"), quantity: Number(row?.quantity) || 0,
    unitPrice: Number(row?.unitPrice) || 0,
    autoOriginalCostV249: String(row?.autoOriginalCostV249 || ""),
    autoOriginalCostSourceValueV249: String(row?.autoOriginalCostSourceValueV249 || ""),
    autoOriginalCostSourceCurrencyV249: String(row?.autoOriginalCostSourceCurrencyV249 || ""),
    priceManuallyEditedV249: String(row?.priceManuallyEditedV249 || "")
  }));
  const common = state?.common || {};
  return JSON.stringify({ rows, common: {
    trackingNumber: String(common.trackingNumber || "").trim(), rackQuantity: String(common.rackQuantity || "").trim(),
    chinaTransportCost: String(common.chinaTransportCost || "").trim(), potCost: String(common.potCost || "").trim(),
    currency: String(common.currency || "CNY"), rate: String(common.rate || "").trim(),
    overseasTrackingNumber: String(common.overseasTrackingNumber || "").trim(), containerDate: String(common.containerDate || "").trim(),
    arrivalDate: String(common.arrivalDate || "").trim(), shippingMY: String(common.shippingMY || "").trim()
  } });
}
function getActiveImportDraftV243() {
  if (!activeImportDraftIdV242) return null;
  return getImportDraftsV242().find(item => String(item?.id || "") === String(activeImportDraftIdV242)) || null;
}
function hasMeaningfulImportDraftInputV243() {
  if (currentEditingImportNumber) return false;
  const state = collectImportDraftStateV242();
  const fingerprint = importDraftFingerprintV243(state);
  if (!importDraftCleanFingerprintV244) {
    importDraftCleanFingerprintV244 = fingerprint;
    return false;
  }
  return fingerprint !== importDraftCleanFingerprintV244;
}
function importDraftStateHasUserDataV246(state) {
  const rows = Array.isArray(state?.rows) ? state.rows : [];
  if (rows.some(row => String(row?.name || "").trim() || String(row?.productId || "").trim() ||
    (Number(row?.quantity) || 0) > 0 || (Number(row?.unitPrice) || 0) > 0 ||
    false)) return true;

  const common = state?.common || {};
  // V24.6: when there is no product row, automatic currency/rate/arrival defaults
  // are not user data. A search that is later cleared must return to a clean page.
  if (!rows.length) {
    return Boolean(
      String(common.trackingNumber || "").trim() ||
      String(common.overseasTrackingNumber || "").trim() ||
      String(common.containerDate || "").trim() ||
      (String(common.arrivalDate || "").trim() && !batchArrivalAutoFilledByMYRV230) ||
      (Number(common.rackQuantity) || 0) > 0 ||
      (Number(common.chinaTransportCost) || 0) > 0 ||
      (Number(common.potCost) || 0) > 0 ||
      (Number(common.shippingMY) || 0) > 0
    );
  }

  return Boolean(
    String(common.trackingNumber || "").trim() ||
    String(common.overseasTrackingNumber || "").trim() ||
    String(common.containerDate || "").trim() ||
    String(common.arrivalDate || "").trim() ||
    (Number(common.rackQuantity) || 0) > 0 ||
    (Number(common.chinaTransportCost) || 0) > 0 ||
    (Number(common.potCost) || 0) > 0 ||
    (Number(common.shippingMY) || 0) > 0 ||
    String(common.currency || "CNY").trim().toUpperCase() !== "CNY"
  );
}
function hasUnsavedImportDraftChangesV243() {
  if (currentEditingImportNumber) return false;
  const current = collectImportDraftStateV242();
  const active = getActiveImportDraftV243();
  if (!active) return importDraftStateHasUserDataV246(current);
  return importDraftFingerprintV243(current) !== importDraftFingerprintV243(active);
}
function confirmDiscardImportDraftChangesV243(actionLabel = "离开") {
  if (!hasUnsavedImportDraftChangesV243()) return true;
  return window.confirm(`⚠️ 当前进口资料有尚未保存到草稿的修改。\n\n${actionLabel}可能造成资料遗失。\n\n按「确定」继续；按「取消」返回先保存草稿。`);
}
window.confirmDiscardImportDraftChangesV243 = confirmDiscardImportDraftChangesV243;
function ensureDraftReadyForFormalSaveV243(status) {
  if (currentEditingImportNumber) return true;
  const active = getActiveImportDraftV243();
  if (!active) {
    if (status) status.textContent = "请先保存草稿，再确认正式进口。";
    alert("请先保存草稿，再确认正式进口。\n\n正式保存会增加库存，所以新进口必须先经过草稿。");
    return false;
  }
  if (importDraftFingerprintV243(collectImportDraftStateV242()) !== importDraftFingerprintV243(active)) {
    if (status) status.textContent = "草稿保存后资料又有修改，请重新保存草稿。";
    alert("草稿保存后资料已经修改。\n\n请重新按「保存草稿」，同步最新资料后再确认正式进口。");
    return false;
  }
  return true;
}
function localDateKeyV243(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth()+1).padStart(2,"0"), String(date.getDate()).padStart(2,"0")].join("-");
}
function openImportDraftFromReminderV246(draftId) {
  const nav = document.querySelector('.nav-btn[data-page="importPage"]');
  if (nav && !nav.classList.contains("active")) nav.click();
  window.setTimeout(() => {
    applyImportDraftV242(draftId);
    document.getElementById("batchImportForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 80);
}

function showImportDraftReminderGuideV246(overdue) {
  document.getElementById("importDraftReminderGuideV246")?.remove();
  if (!overdue.length) return;
  const panel = document.createElement("section");
  panel.id = "importDraftReminderGuideV246";
  panel.className = "import-draft-reminder-guide-v246";
  panel.innerHTML = `
    <div class="import-draft-reminder-card-v246">
      <div class="import-draft-reminder-head-v246">
        <strong>进口草稿未确认</strong>
        <button type="button" class="ghost-btn" data-close-draft-reminder-v246>关闭</button>
      </div>
      <p>以下草稿已保存超过24小时。每天提醒一次，正式保存或删除后停止提醒。</p>
      <div class="import-draft-reminder-list-v246">
        ${overdue.map(draft => {
          const rows = Array.isArray(draft.rows) ? draft.rows : [];
          const first = rows.find(row => row?.name)?.name || "未命名草稿";
          return `<button type="button" class="secondary-btn" data-open-draft-reminder-v246="${escapeHTML(draft.id || "")}">${escapeHTML(first)} · 查看草稿</button>`;
        }).join("")}
      </div>
    </div>`;
  document.body.appendChild(panel);
  panel.addEventListener("click", event => {
    const close = event.target.closest("[data-close-draft-reminder-v246]");
    if (close) { panel.remove(); return; }
    const open = event.target.closest("[data-open-draft-reminder-v246]");
    if (!open) return;
    const id = String(open.dataset.openDraftReminderV246 || "");
    panel.remove();
    openImportDraftFromReminderV246(id);
  });
}


function cleanupKnownLegacyDraftResidueV322() {
  const drafts = getImportDraftsV242();
  if (!drafts.length) return;
  const products = getProducts();
  const imports = getImports();
  const now = Date.now();
  const keep = drafts.filter(draft => {
    const rows = Array.isArray(draft?.rows) ? draft.rows : [];
    const names = rows.map(row => String(row?.name || "").trim()).filter(Boolean);
    const created = Date.parse(draft?.createdAt || "");
    const isOld = Number.isFinite(created) && now - created >= 7 * 86400000;
    const knownResidue = names.length && names.every(name => /^OLN\s*绿萝/i.test(name));
    if (!isOld || !knownResidue) return true;
    const hasRealLink = rows.some(row => {
      const id = String(row?.productId || "").trim();
      const name = String(row?.name || "").trim().toLowerCase();
      return products.some(p => (id && String(p?.id || "").trim() === id) || (name && String(p?.name || "").trim().toLowerCase() === name)) ||
        imports.some(i => (id && String(i?.productId || "").trim() === id) || (name && String(i?.productName || "").trim().toLowerCase() === name));
    });
    if (!hasRealLink) { markImportDraftDeletedV250(draft.id); return false; }
    return true;
  });
  if (keep.length !== drafts.length) writeImportDraftsV242(keep);
}

function checkImportDraftRemindersV243() {
  cleanupKnownLegacyDraftResidueV322();
  const drafts = getImportDraftsV242(); if (!drafts.length) return;
  const now = Date.now(), todayKey = localDateKeyV243();
  const overdue = drafts.filter(draft => {
    const created = Date.parse(draft?.createdAt || "");
    return draft?.status === "draft" && Number.isFinite(created) && now-created >= 86400000 && draft?.lastReminderDateV243 !== todayKey;
  });
  if (!overdue.length) return;
  showImportDraftReminderGuideV246(overdue);
  const ids = new Set(overdue.map(d => String(d.id || "")));
  writeImportDraftsV242(drafts.map(d => ids.has(String(d.id || "")) ? {...d,lastReminderDateV243:todayKey} : d));
}

function collectImportDraftStateV242() {
  const rows = Array.from(document.querySelectorAll("#batchRows tr")).map(tr => {
    const id = Number(tr.dataset.rowId);
    return {
      name: String(document.getElementById(`batchName-${id}`)?.value || "").trim(),
      productId: String(document.getElementById(`batchProductId-${id}`)?.value || "").trim(),
      category: String(document.getElementById(`batchCategory-${id}`)?.value || "\u76c6\u683d"),
      quantity: Math.max(0, Math.floor(parseAmount(document.getElementById(`batchQty-${id}`)?.value))),
      unitPrice: Math.max(0, parseAmount(document.getElementById(`batchPrice-${id}`)?.value)),
      autoOriginalCostV249: String(tr.dataset.autoOriginalCostV249 || ""),
      autoOriginalCostSourceValueV249: String(tr.dataset.autoOriginalCostSourceValueV249 || ""),
      autoOriginalCostSourceCurrencyV249: String(tr.dataset.autoOriginalCostSourceCurrencyV249 || ""),
      priceManuallyEditedV249: String(tr.dataset.priceManuallyEditedV249 || ""),
      recognitionNewV265: String(tr.dataset.recognitionNewV265 || ""),
      englishNameV262: String(tr.dataset.englishNameV262 || "")
    };
  }).filter(row => row.name || row.quantity || row.unitPrice);
  const val = id => String(document.getElementById(id)?.value || "").trim();
  return {
    rows,
    meta: { currencyConflictAcknowledgedV249: Boolean(batchCurrencyConflictAcknowledgedV249) },
    common: {
      trackingNumber: val("batchTrackingNumber"),
      rackQuantity: val("batchRackQuantity"),
      chinaTransportCost: val("batchChinaTransportCost"),
      potCost: val("batchPotCost"),
      currency: val("batchCurrency") || "CNY",
      rate: val("batchRate"),
      overseasTrackingNumber: val("batchOverseasTrackingNumber"),
      containerDate: val("batchContainerDate"),
      arrivalDate: val("batchArrivalDate"),
      shippingMY: val("batchShippingMY")
    }
  };
}

function saveImportDraftV242() {
  if (currentEditingImportNumber) {
    alert("\u5df2\u4fdd\u5b58\u7684\u8fdb\u53e3\u7f16\u53f7\u4e0d\u4f7f\u7528\u8349\u7a3f\u6a21\u5f0f\u3002\u8349\u7a3f\u53ea\u7528\u4e8e\u65b0\u8fdb\u53e3\u3002");
    return;
  }
  const state = collectImportDraftStateV242();
  if (!state.rows.length) {
    alert("请先输入至少一个产品，再保存草稿。");
    return;
  }
  const drafts = getImportDraftsV242();
  const now = new Date().toISOString();
  const id = activeImportDraftIdV242 || `DRF${Date.now()}`;
  const previousDraft = drafts.find(item => item.id === id);
  const entry = {
    id,
    status: "draft",
    createdAt: previousDraft?.createdAt || now,
    updatedAt: now,
    lastReminderDateV243: previousDraft?.lastReminderDateV243 || "",
    ...state
  };
  const next = [entry, ...drafts.filter(item => item.id !== id)].slice(0, 30);
  activeImportDraftIdV242 = id;
  writeImportDraftsV242(next);

  // V26.6: saving a draft must NEVER leave the original import editor.
  // Keep the just-saved draft active and preserve every field in the same input area.
  // Some sync/view refresh paths may redraw the page after settings are queued; if that
  // unexpectedly leaves the import editor blank, restore this exact saved draft.
  const restoreIfUnexpectedlyBlankV248 = () => {
    if (currentEditingImportNumber) return;
    if (String(activeImportDraftIdV242 || "") !== String(id)) return;
    const currentState = collectImportDraftStateV242();
    if (importDraftStateHasUserDataV246(currentState)) return;
    const stillSaved = getImportDraftsV242().some(item => String(item?.id || "") === String(id));
    if (stillSaved) applyImportDraftV242(id);
  };
  window.setTimeout(restoreIfUnexpectedlyBlankV248, 0);
  window.setTimeout(restoreIfUnexpectedlyBlankV248, 120);
  window.setTimeout(restoreIfUnexpectedlyBlankV248, 700);

  const status = document.getElementById("batchStatusText");
  if (status) {
    status.textContent = "✓ 草稿已保存 · 尚未正式确认。当前资料继续保留在原输入区；尚未写入库存、平均成本、最低售价或正式 Import / Batch。";
    status.classList.add("draft-saved-status-v322");
  }
  renderImportDraftsV242();
  updateImportDraftSaveButtonV323();
}

function applyImportDraftV242(draftId) {
  const draft = getImportDraftsV242().find(item => String(item?.id || "") === String(draftId || ""));
  if (!draft) return;
  if (String(draftId || "") !== String(activeImportDraftIdV242 || "") && !confirmDiscardImportDraftChangesV243("载入另一份草稿")) return;
  if (currentEditingImportNumber) setBatchEditMode("");
  resetBatchForm({ clearLookup: true, clearStatus: true });
  const tbody = document.getElementById("batchRows");
  if (tbody) tbody.innerHTML = "";
  batchRowSeq = 0;
  const rows = Array.isArray(draft.rows) && draft.rows.length ? draft.rows : [{}];
  rows.forEach(row => {
    addBatchRow({
      name: row.name || "",
      productId: row.productId || "",
      category: row.category || "\u76c6\u683d",
      quantity: Number(row.quantity) || 0,
      unitPrice: Number(row.unitPrice) || 0
    });
    const tr = document.querySelector("#batchRows tr:last-child");
    if (!tr) return;
    if (row.autoOriginalCostV249) tr.dataset.autoOriginalCostV249 = row.autoOriginalCostV249;
    if (row.autoOriginalCostSourceValueV249) tr.dataset.autoOriginalCostSourceValueV249 = row.autoOriginalCostSourceValueV249;
    if (row.autoOriginalCostSourceCurrencyV249) tr.dataset.autoOriginalCostSourceCurrencyV249 = row.autoOriginalCostSourceCurrencyV249;
    if (row.priceManuallyEditedV249) tr.dataset.priceManuallyEditedV249 = row.priceManuallyEditedV249;
    if (row.recognitionNewV265) { tr.dataset.recognitionNewV265 = row.recognitionNewV265; tr.classList.add("recognition-new-product-v265"); }
    if (row.englishNameV262) tr.dataset.englishNameV262 = row.englishNameV262;
  });
  batchCurrencyConflictAcknowledgedV249 = Boolean(draft?.meta?.currencyConflictAcknowledgedV249);
  const common = draft.common || {};
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.value = value ?? ""; };
  set("batchTrackingNumber", common.trackingNumber);
  set("batchRackQuantity", common.rackQuantity);
  set("batchChinaTransportCost", common.chinaTransportCost);
  set("batchPotCost", common.potCost);
  set("batchCurrency", common.currency || "CNY");
  set("batchRate", common.rate);
  set("batchOverseasTrackingNumber", common.overseasTrackingNumber);
  set("batchContainerDate", common.containerDate);
  set("batchArrivalDate", common.arrivalDate);
  set("batchShippingMY", common.shippingMY);
  activeImportDraftIdV242 = String(draft.id || "");
  batchCurrencyManuallySelectedV229 = Boolean(common.currency);
  refreshAutoOriginalCostsForBatchV249();
  calculateBatch();
  renderImportDraftsV242();
  document.getElementById("batchImportForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function deleteImportDraftV242(draftId) {
  const draft = getImportDraftsV242().find(item => String(item?.id || "") === String(draftId || ""));
  if (!draft) return;
  if (!confirm("⚠️ 确认删除这份草稿？\n\n这会永久删除尚未正式保存的进口草稿资料，删除后无法恢复。\n\n已正式保存的库存资料不会受到影响。")) return;
  const wasActiveV252 = String(activeImportDraftIdV242 || "") === String(draftId || "");
  // V26.6 Local-First: clear active state and persist the tombstone immediately,
  // then clear the editor only when the deleted draft is the one currently open.
  if (wasActiveV252) activeImportDraftIdV242 = "";
  markImportDraftDeletedV250(draftId);
  const next = getImportDraftsV242().filter(item => String(item?.id || "") !== String(draftId || ""));
  writeImportDraftsV242(next);
  document.getElementById("importDraftPickerV248")?.remove();
  document.getElementById("importDraftReminderGuideV246")?.remove();
  if (wasActiveV252 && !currentEditingImportNumber) {
    resetBatchForm({ clearLookup: true, clearStatus: true });
    const statusV252 = document.getElementById("batchStatusText");
    if (statusV252) statusV252.textContent = "草稿已删除，当前进口输入区已清空。";
  }
  renderImportDraftsV242();
}

function consumeActiveImportDraftV242() {
  if (!activeImportDraftIdV242) return;
  const id = activeImportDraftIdV242;
  activeImportDraftIdV242 = "";
  // V26.6: formal save is also a terminal removal of the draft. Without a
  // tombstone, a stale cloud copy can merge back and trigger the 24-hour reminder.
  markImportDraftDeletedV250(id);
  writeImportDraftsV242(getImportDraftsV242().filter(item => item.id !== id));
  document.getElementById("importDraftReminderGuideV246")?.remove();
}

function formatDraftTimeV242(value) {
  const date = new Date(value || "");
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleString("zh-MY", { hour12: false });
}

function renderImportDraftsV242() {
  // V26.6: no large standalone draft module. The original import editor remains the
  // working area; only a lightweight entry is shown so drafts can be reopened after
  // clearing/reloading/leaving the page.
  const label = document.getElementById("activeDraftLabelV242");
  const deleteButton = document.getElementById("deleteCurrentImportDraftBtnV247");
  const openButton = document.getElementById("openImportDraftsBtnV248");
  const active = getActiveImportDraftV243();
  const drafts = getImportDraftsV242().filter(item => item?.status === "draft");
  if (label) {
    const hasData = importDraftStateHasUserDataV246(collectImportDraftStateV242());
    const dirty = active ? hasUnsavedImportDraftChangesV243() : hasData;
    if (currentEditingImportNumber) {
      label.textContent = "已正式保存 · 已锁定";
      label.dataset.draftStateV249 = "formal";
    } else if (active && dirty) {
      label.textContent = `草稿已修改 · 尚未重新保存 · 原草稿 ${formatDraftTimeV242(active.updatedAt)}`;
      label.dataset.draftStateV249 = "dirty";
    } else if (active) {
      label.textContent = `草稿已保存 · 尚未正式确认 · ${formatDraftTimeV242(active.updatedAt)}`;
      label.dataset.draftStateV249 = "saved";
    } else if (hasData) {
      label.textContent = "未保存 · 当前资料尚未保存为草稿";
      label.dataset.draftStateV249 = "unsaved";
    } else {
      label.textContent = "未保存";
      label.dataset.draftStateV249 = "empty";
    }
  }
  if (deleteButton) deleteButton.hidden = !active;
  if (openButton) {
    openButton.hidden = drafts.length === 0;
    openButton.textContent = drafts.length > 1 ? `查看未确认草稿 (${drafts.length})` : "查看未确认草稿";
  }
}
window.renderImportDraftsV242 = renderImportDraftsV242;

function openImportDraftPickerV248() {
  const drafts = getImportDraftsV242().filter(item => item?.status === "draft");
  if (!drafts.length) {
    alert("目前没有未确认草稿。");
    renderImportDraftsV242();
    return;
  }
  if (drafts.length === 1) {
    applyImportDraftV242(drafts[0].id);
    return;
  }

  document.getElementById("importDraftPickerV248")?.remove();
  const panel = document.createElement("section");
  panel.id = "importDraftPickerV248";
  panel.className = "import-draft-reminder-guide-v246";
  panel.innerHTML = `
    <div class="import-draft-reminder-card-v246">
      <div class="import-draft-reminder-head-v246">
        <strong>未确认进口草稿</strong>
        <button type="button" class="ghost-btn" data-close-draft-picker-v248>关闭</button>
      </div>
      <p>选择要继续修改的草稿。载入后仍在原本进口输入区修改，不会进入独立草稿模块。</p>
      <div class="import-draft-reminder-list-v246">
        ${drafts.map(draft => {
          const rows = Array.isArray(draft.rows) ? draft.rows : [];
          const first = rows.find(row => row?.name)?.name || "未命名草稿";
          const count = rows.filter(row => String(row?.name || "").trim()).length;
          return `<button type="button" class="secondary-btn" data-open-draft-picker-v248="${escapeHTML(draft.id || "")}">${escapeHTML(first)}${count > 1 ? ` · ${count}个产品` : ""} · ${escapeHTML(formatDraftTimeV242(draft.updatedAt))}</button>`;
        }).join("")}
      </div>
    </div>`;
  document.body.appendChild(panel);
  panel.addEventListener("click", event => {
    if (event.target.closest("[data-close-draft-picker-v248]")) { panel.remove(); return; }
    const open = event.target.closest("[data-open-draft-picker-v248]");
    if (!open) return;
    const id = String(open.dataset.openDraftPickerV248 || "");
    panel.remove();
    applyImportDraftV242(id);
  });
}
window.openImportDraftPickerV248 = openImportDraftPickerV248;

function confirmFormalImportV247() {
  if (currentEditingImportNumber) {
    saveBatchImport();
    return;
  }
  const status = document.getElementById("batchStatusText");
  if (!ensureDraftReadyForFormalSaveV243(status)) return;
  const active = getActiveImportDraftV243();
  const rows = Array.isArray(active?.rows) ? active.rows.filter(row => String(row?.name || "").trim()) : [];
  const totalQty = rows.reduce((sum, row) => sum + Math.max(0, Number(row?.quantity) || 0), 0);
  const firstNames = rows.slice(0, 4).map(row => String(row.name || "").trim()).filter(Boolean).join("、");
  const summary = `${rows.length} 个产品 / 总数量 ${totalQty}${firstNames ? `\n${firstNames}${rows.length > 4 ? "…" : ""}` : ""}`;
  if (!window.confirm(`⚠️ 确认正式保存这份进口？\n\n${summary}\n\n确认后才会执行 V22.6 原本正式保存逻辑：写入真实库存、成本、Import / Batch、Product ID 与最低售价相关处理。\n\n正式保存成功后，这份进口会锁定。`)) return;
  if (!window.confirm("最后确认：现在正式入库？\n\n这是第二阶段正式保存，不再是草稿。成功后如需修改，只能依 Data Repair 规则处理。")) return;
  saveBatchImport();
}

function deleteCurrentImportDraftV247() {
  if (!activeImportDraftIdV242) return;
  deleteImportDraftV242(activeImportDraftIdV242);
  renderImportDraftsV242();
}

function setupImportDraftV247() {
  document.getElementById("confirmFormalImportBtnV247")?.addEventListener("click", confirmFormalImportV247);
  document.getElementById("deleteCurrentImportDraftBtnV247")?.addEventListener("click", deleteCurrentImportDraftV247);
  document.getElementById("openImportDraftsBtnV248")?.addEventListener("click", openImportDraftPickerV248);
  // V26.6: status follows every edit in the original import form.
  const draftFormV249 = document.getElementById("batchImportForm");
  const refreshDraftStateV249 = () => window.requestAnimationFrame(() => {
    renderImportDraftsV242();
    const statusV322 = document.getElementById("batchStatusText");
    if (statusV322?.classList.contains("draft-saved-status-v322") && hasUnsavedImportDraftChangesV243()) {
      statusV322.classList.remove("draft-saved-status-v322");
      statusV322.textContent = "草稿保存后资料已有修改 · 请重新保存草稿后再确认正式保存。";
    }
    updateImportDraftSaveButtonV323();
  });
  draftFormV249?.addEventListener("input", refreshDraftStateV249);
  draftFormV249?.addEventListener("change", refreshDraftStateV249);
  window.addEventListener("beforeunload", event => {
    if (!hasUnsavedImportDraftChangesV243()) return;
    event.preventDefault();
    event.returnValue = "";
  });
  window.addEventListener("focus", checkImportDraftRemindersV243);
  renderImportDraftsV242();
  updateImportDraftSaveButtonV323();
  window.setTimeout(checkImportDraftRemindersV243, 700);
}

function moveToNextBatchField(currentField) {
  const form = document.getElementById("batchImportForm");

  const fields = Array.from(
    form.querySelectorAll(
      'input:not([type="hidden"]):not([disabled]), select:not([disabled])'
    )
  ).filter(field => {
    return field.offsetParent !== null && !field.closest(".batch-summary");
  });

  const currentIndex = fields.indexOf(currentField);
  if (currentIndex === -1) return;

  const nextField = fields[currentIndex + 1];

  if (!nextField) {
    return false;
  }

  nextField.focus();

  if (nextField instanceof HTMLInputElement) {
    nextField.select();
  }

  return true;
}
function moveBatchField(currentField, key) {
  const row = currentField.closest("#batchRows tr");

  if (!row) return false;

  const rows = Array.from(
    document.querySelectorAll("#batchRows tr")
  );

  const rowIndex = rows.indexOf(row);

  const getRowFields = currentRow => {
    return Array.from(
      currentRow.querySelectorAll(
        'input:not([type="hidden"]):not([disabled]), select:not([disabled])'
      )
    );
  };

  const currentFields = getRowFields(row);
  const columnIndex = currentFields.indexOf(currentField);

  if (columnIndex === -1) return false;

  let targetField = null;

  if (key === "ArrowLeft") {
    targetField = currentFields[columnIndex - 1] || null;
  }

  if (key === "ArrowRight") {
    targetField = currentFields[columnIndex + 1] || null;
  }

  if (key === "ArrowUp" && rowIndex > 0) {
    const previousFields = getRowFields(rows[rowIndex - 1]);
    targetField = previousFields[columnIndex] || null;
  }

  if (key === "ArrowDown") {
    if (rowIndex === rows.length - 1) {
      addBatchRow();

      const updatedRows = Array.from(
        document.querySelectorAll("#batchRows tr")
      );

      const nextRow = updatedRows[rowIndex + 1];
      const nextFields = nextRow ? getRowFields(nextRow) : [];
      targetField = nextFields[columnIndex] || null;
    } else {
      const nextFields = getRowFields(rows[rowIndex + 1]);
      targetField = nextFields[columnIndex] || null;
    }
  }

  if (!targetField) return false;

  targetField.focus();

  if (targetField instanceof HTMLInputElement) {
    targetField.select();
  }

  return true;
}

function generateImportNumber(currency, arrivalDate, batches) {
  const code = String(currency || "IMP").toUpperCase();
  const digits = String(arrivalDate || "").replace(/\D/g, "");
  const dateCode = digits.length === 8
    ? digits
    : formatDateDDMMYYYY(new Date()).replace(/\D/g, "");
  const prefix = `${code}${dateCode}`;

  const maxSequence = batches.reduce((max, batch) => {
    const match = String(batch.importNumber || "").match(
      new RegExp(`^${prefix}(\\d+)$`)
    );
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  let nextSequence = maxSequence + 1;
  let nextImportNumber = `${prefix}${nextSequence}`;
  const usedNumbers = new Set(
    batches.map(batch => String(batch.importNumber || "").toUpperCase())
  );

  while (usedNumbers.has(nextImportNumber.toUpperCase())) {
    nextSequence += 1;
    nextImportNumber = `${prefix}${nextSequence}`;
  }

  return nextImportNumber;
}

function copyBatchNumber(importNumber, button) {
  if (!importNumber) return;

  const showCopied = () => {
    if (!button) return;

    const originalText =
      button.dataset.originalText ||
      button.textContent ||
      "Copy";

    button.dataset.originalText = originalText;
    button.classList.add("copied");
    button.innerHTML =
      `Copy<span class="copy-feedback">已复制</span>`;

    window.setTimeout(() => {
      button.classList.remove("copied");
      button.textContent = originalText;
    }, 1800);
  };

  const fallbackCopy = () => {
    const temp = document.createElement("textarea");
    temp.value = importNumber;
    temp.setAttribute("readonly", "");
    temp.style.position = "fixed";
    temp.style.opacity = "0";
    document.body.appendChild(temp);
    temp.select();
    document.execCommand("copy");
    temp.remove();
    showCopied();
  };

  if (navigator.clipboard?.writeText) {
    navigator.clipboard
      .writeText(importNumber)
      .then(showCopied)
      .catch(fallbackCopy);
    return;
  }

  fallbackCopy();
}


// V11.4: 最近进口记录直接点击进口编号/运输单号复制；运输单号若含说明文字，只复制末尾实际单号。
function extractTrackingNumberForCopy(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const tokens = text.split(/\s+/).filter(Boolean);
  const codeLike = tokens.filter(token => /[A-Za-z]/.test(token) && /\d/.test(token));
  return codeLike.length ? codeLike[codeLike.length - 1] : text;
}

function copyRecentBatchValue(element, label) {
  if (!element) return;
  const value = String(element.dataset.copyValue || "").trim();
  if (!value) return;

  const done = () => {
    element.classList.add("copied");
    if (typeof showHistoryCopyToast === "function") {
      showHistoryCopyToast(`✓ 已复制：${value}`);
    }
    window.clearTimeout(element._recentBatchCopyTimer);
    element._recentBatchCopyTimer = window.setTimeout(() => element.classList.remove("copied"), 1200);
  };

  const fallback = () => {
    const temp = document.createElement("textarea");
    temp.value = value;
    temp.setAttribute("readonly", "");
    temp.style.position = "fixed";
    temp.style.opacity = "0";
    document.body.appendChild(temp);
    temp.select();
    document.execCommand("copy");
    temp.remove();
    done();
  };

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(value).then(done).catch(fallback);
  } else {
    fallback();
  }
}


function getBatchItemsForDisplay(batch) {
  const storedItems = Array.isArray(batch?.items)
    ? batch.items.filter(Boolean)
    : [];

  const batchId = String(batch?.id || "").trim();
  const importNumber = String(batch?.importNumber || "").trim().toLowerCase();

  // V6.8 canonical-data rule:
  // Imports Sheet is the authoritative source for item fields. Batches.items
  // is only a legacy/order fallback. This prevents stale JSON (for example an
  // old test originalQuantity=80) from overriding a corrected Imports row.
  const importItems = getImports().filter(record => {
    const recordBatchId = String(record?.batchId || "").trim();
    const recordImportNumber = String(record?.importNumber || "").trim().toLowerCase();
    return (
      (batchId && recordBatchId === batchId) ||
      (importNumber && recordImportNumber === importNumber)
    );
  });

  if (!importItems.length) {
    return storedItems;
  }

  const itemKey = item => {
    const id = String(item?.id || "").trim();
    if (id) return `id:${id}`;

    const productId = String(item?.productId || "").trim();
    const productName = String(item?.productName || item?.name || "")
      .trim()
      .toLowerCase();
    const category = String(item?.category || "盆栽").trim().toLowerCase();
    return `product:${productId}|${productName}|${category}`;
  };

  const authoritativeByKey = new Map();
  importItems.forEach(record => {
    authoritativeByKey.set(itemKey(record), record);
  });

  const usedKeys = new Set();
  const merged = [];

  // Preserve the old visual row order when possible, but let every matching
  // Imports field overwrite the stale Batches JSON field.
  storedItems.forEach(stored => {
    let authoritative = authoritativeByKey.get(itemKey(stored));

    if (!authoritative) {
      const storedProductId = String(stored?.productId || "").trim();
      const storedName = String(stored?.productName || stored?.name || "")
        .trim()
        .toLowerCase();
      const storedCategory = String(stored?.category || "盆栽").trim().toLowerCase();

      authoritative = importItems.find(record => {
        const sameProductId =
          storedProductId &&
          String(record?.productId || "").trim() === storedProductId;
        const sameName =
          storedName &&
          String(record?.productName || record?.name || "").trim().toLowerCase() === storedName;
        const sameCategory =
          String(record?.category || "盆栽").trim().toLowerCase() === storedCategory;
        return (sameProductId || sameName) && sameCategory;
      });
    }

    if (authoritative) {
      usedKeys.add(itemKey(authoritative));
      merged.push({ ...stored, ...authoritative });
    }
  });

  // Add any canonical Imports rows that did not exist in the legacy JSON.
  // Imports were historically appended, so their natural order is retained.
  importItems.forEach(record => {
    const key = itemKey(record);
    if (!usedKeys.has(key)) {
      usedKeys.add(key);
      merged.push({ ...record });
    }
  });

  return merged.length ? merged : importItems.slice();
}


function getSafeDisplayOriginalQuantity(item) {
  const explicitOriginal = Number(item?.originalQuantity);
  const stockAdded = Number(item?.stockAdded);
  const legacyQuantity = Number(item?.quantity);
  const unitPrice = Number(item?.unitPrice);

  const validNonNegative = value =>
    Number.isFinite(value) && value >= 0;

  const alternateCandidates = [stockAdded, legacyQuantity]
    .filter(validNonNegative)
    .map(value => Math.floor(value));

  const preferredAlternate = alternateCandidates.find(value => {
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) return true;
    return Math.abs(value - unitPrice) > 0.000001;
  });

  if (validNonNegative(explicitOriginal)) {
    const explicitLooksLikeUnitPrice =
      Number.isFinite(unitPrice) &&
      unitPrice > 0 &&
      Math.abs(explicitOriginal - unitPrice) < 0.000001;

    const explicitLooksPolluted =
      preferredAlternate !== undefined &&
      preferredAlternate > 0 &&
      explicitOriginal > preferredAlternate * 10;

    if (
      (explicitLooksLikeUnitPrice || explicitLooksPolluted) &&
      preferredAlternate !== undefined
    ) {
      return preferredAlternate;
    }

    return Math.floor(explicitOriginal);
  }

  if (validNonNegative(stockAdded)) {
    return Math.floor(stockAdded);
  }

  if (
    validNonNegative(legacyQuantity) &&
    !(
      Number.isFinite(unitPrice) &&
      unitPrice > 0 &&
      Math.abs(legacyQuantity - unitPrice) < 0.000001
    )
  ) {
    return Math.floor(legacyQuantity);
  }

  return 0;
}

function getBatchDisplayTotalQuantity(
  importNumber,
  batches = getBatches(),
  imports = getImports()
) {
  const normalizedNumber =
    String(importNumber || "").trim().toLowerCase();

  if (!normalizedNumber) return 0;

  const batch = (batches || []).find(
    item =>
      String(item.importNumber || "").trim().toLowerCase() ===
      normalizedNumber
  );

  const batchItems = batch ? getBatchItemsForDisplay(batch) : [];
  const explicitBatchQuantities = batchItems
    .map(item => {
      const original = Number(item?.originalQuantity);
      const stockAdded = Number(item?.stockAdded);

      if (Number.isFinite(original) && original >= 0) return original;
      if (Number.isFinite(stockAdded) && stockAdded >= 0) return stockAdded;
      return null;
    })
    .filter(value => value !== null);

  if (
    batchItems.length &&
    explicitBatchQuantities.length === batchItems.length
  ) {
    return explicitBatchQuantities.reduce((sum, value) => sum + value, 0);
  }

  const storedTotal = Number(batch?.totalQuantity);
  const storedTotalLooksLikeUnitPrice =
    batchItems.some(item => {
      const unitPrice = Number(item?.unitPrice);
      return (
        Number.isFinite(unitPrice) &&
        unitPrice > 0 &&
        Math.abs(unitPrice - storedTotal) < 0.000001
      );
    });

  if (
    Number.isFinite(storedTotal) &&
    storedTotal >= 0 &&
    !storedTotalLooksLikeUnitPrice
  ) {
    return storedTotal;
  }

  const matchingImports = (imports || []).filter(
    record =>
      String(record.importNumber || "").trim().toLowerCase() ===
      normalizedNumber
  );

  const explicitImportQuantities = matchingImports
    .map(record => {
      const original = Number(record?.originalQuantity);
      const stockAdded = Number(record?.stockAdded);

      if (Number.isFinite(original) && original >= 0) return original;
      if (Number.isFinite(stockAdded) && stockAdded >= 0) return stockAdded;
      return null;
    })
    .filter(value => value !== null);

  if (
    matchingImports.length &&
    explicitImportQuantities.length === matchingImports.length
  ) {
    return explicitImportQuantities.reduce((sum, value) => sum + value, 0);
  }

  const batchItemsTotal = batchItems.reduce(
    (sum, item) => sum + getSafeDisplayOriginalQuantity(item),
    0
  );

  if (batchItemsTotal > 0) return batchItemsTotal;

  return matchingImports.reduce(
    (sum, record) => sum + getSafeDisplayOriginalQuantity(record),
    0
  );
}

function getLockedBatchOriginalQuantity(item) {
  // V20.6 R2: original import quantity is historical source data.
  // Sales must never reduce it. Prefer explicit originalQuantity, then the
  // legacy quantity field; stockAdded is only the final legacy fallback.
  const candidates = [
    Number(item?.originalQuantity),
    Number(item?.quantity),
    Number(item?.stockAdded)
  ];

  const value = candidates.find(
    candidate =>
      Number.isFinite(candidate) &&
      candidate >= 0
  );

  return Math.max(0, Math.floor(value || 0));
}

function getCanonicalBatchCostSnapshotV206(batch, items = []) {
  const safeItems = Array.isArray(items) ? items : [];
  const rate = Number(batch?.rate) > 0
    ? Number(batch.rate)
    : (Number(safeItems.find(item => Number(item?.rate) > 0)?.rate) || 0);
  const totalPurchaseForeign = safeItems.reduce((sum, item) => {
    const storedForeign = Number(item?.foreignTotal);
    if (Number.isFinite(storedForeign) && storedForeign >= 0) return sum + storedForeign;
    return sum + getLockedBatchOriginalQuantity(item) * Math.max(0, Number(item?.unitPrice) || 0);
  }, 0);
  const chinaTransportCost = Number(batch?.inlandTransportCost) || Number(batch?.chinaTransportCost) || 0;
  const potCost = Number(batch?.potCost) || Number(batch?.potCostForeign) || 0;
  const sharedForeign = chinaTransportCost + potCost;
  const foreignGrandTotal = totalPurchaseForeign + sharedForeign;
  const totalForeignCostsRM = rate > 0 ? foreignGrandTotal / rate : 0;
  const shippingMY = Math.max(0, Number(batch?.shippingMY) || 0);
  const shippingRate = totalForeignCostsRM > 0 ? (shippingMY / totalForeignCostsRM) * 100 : 0;
  const grandTotal = totalForeignCostsRM + shippingMY;
  const inlandMiscRate = totalPurchaseForeign > 0 ? (sharedForeign / totalPurchaseForeign) * 100 : 0;
  const itemCosts = safeItems.map(item => {
    const originalQuantity = getLockedBatchOriginalQuantity(item);
    const foreignTotal = Math.max(0, Number(item?.foreignTotal) || originalQuantity * Math.max(0, Number(item?.unitPrice) || 0));
    if (!(originalQuantity > 0) || !(rate > 0) || !(totalPurchaseForeign > 0) || !(foreignTotal >= 0)) {
      return { unitCost: Math.max(0, Number(item?.unitCost) || 0), batchTotal: Math.max(0, Number(item?.batchTotal) || 0), purchaseRM: Math.max(0, Number(item?.purchaseRM) || 0) };
    }
    const purchaseRM = foreignTotal / rate;
    const allocatedSharedRM = (sharedForeign / rate) * (foreignTotal / totalPurchaseForeign);
    const batchTotal = (purchaseRM + allocatedSharedRM) * (1 + shippingRate / 100);
    return { purchaseRM, batchTotal, unitCost: batchTotal / originalQuantity };
  });
  return { rate, totalPurchaseForeign, chinaTransportCost, potCost, sharedForeign, foreignGrandTotal, totalForeignCostsRM, shippingMY, shippingRate, grandTotal, inlandMiscRate, itemCosts };
}

function batchCostSnapshotIsStaleV206(batch, items = []) {
  const expected = getCanonicalBatchCostSnapshotV206(batch, items);
  if (!(expected.rate > 0) || !(expected.totalPurchaseForeign > 0)) return false;
  const diff = (a,b,t=0.02) => Math.abs((Number(a)||0)-(Number(b)||0)) > t;
  if (diff(batch?.totalForeignCostsRM, expected.totalForeignCostsRM) ||
      diff(batch?.grandTotal, expected.grandTotal) ||
      diff(batch?.shippingRate, expected.shippingRate, 0.01)) return true;
  return (items || []).some((item, index) => diff(item?.unitCost, expected.itemCosts[index]?.unitCost));
}

function restoreStoredBatchRMDisplay(batch, items) {
  const safeItems = Array.isArray(items) ? items : [];
  const currency = String(
    batch?.currency ||
    safeItems.find(item => item?.currency)?.currency ||
    document.getElementById("batchCurrency")?.value ||
    ""
  ).trim();

  const originalPurchaseForeign = safeItems.reduce((sum, item) => {
    const storedForeign = Number(item?.foreignTotal);
    if (Number.isFinite(storedForeign) && storedForeign >= 0) {
      return sum + storedForeign;
    }

    const originalQuantity =
      getLockedBatchOriginalQuantity(item);
    const unitPrice = Math.max(0, Number(item?.unitPrice) || 0);
    return sum + (originalQuantity * unitPrice);
  }, 0);

  const originalQuantityTotal = safeItems.reduce(
    (sum, item) =>
      sum + getLockedBatchOriginalQuantity(item),
    0
  );

  const inlandTransport =
    Number(batch?.inlandTransportCost) ||
    Number(batch?.chinaTransportCost) ||
    0;
  const potCost =
    Number(batch?.potCost) ||
    Number(batch?.potCostForeign) ||
    0;
  const inlandMiscForeign = inlandTransport + potCost;

  const storedInlandRate = Number(batch?.inlandMiscRate);
  const lockedInlandRate = Number.isFinite(storedInlandRate)
    ? storedInlandRate
    : (
        originalPurchaseForeign > 0
          ? (inlandMiscForeign / originalPurchaseForeign) * 100
          : 0
      );

  const lockedForeignGrandTotal =
    originalPurchaseForeign + inlandMiscForeign;

  const foreignRM = document.getElementById("batchPurchaseTotalRM");
  const shippingRate = document.getElementById("batchShippingRate");
  const grandTotal = document.getElementById("batchGrandTotalRM");
  const inlandRateField = document.getElementById("batchInlandMiscRate");
  const foreignGrandTotalField =
    document.getElementById("batchForeignGrandTotal");
  const topForeign =
    document.getElementById("batchPurchaseTotalForeignTop");
  const quantityTotal =
    document.getElementById("batchQuantityTotal");
  const quantityTop =
    document.getElementById("batchQuantityTop");
  const itemCount =
    document.getElementById("batchItemCount");

  const canonicalV206 = getCanonicalBatchCostSnapshotV206(batch, safeItems);

  if (foreignRM) {
    foreignRM.textContent = formatMoney(canonicalV206.totalForeignCostsRM, "RM ");
  }

  if (shippingRate) {
    shippingRate.textContent = `${formatMoney(canonicalV206.shippingRate)}%`;
  }

  if (grandTotal) {
    grandTotal.textContent = formatMoney(canonicalV206.grandTotal, "RM ");
  }

  if (inlandRateField) {
    inlandRateField.value = `${lockedInlandRate.toFixed(2)}%`;
  }

  if (foreignGrandTotalField) {
    foreignGrandTotalField.value =
      `${formatMoney(lockedForeignGrandTotal)} ${currency}`;
  }

  if (topForeign) {
    topForeign.textContent =
      `${formatMoney(originalPurchaseForeign)} ${currency}`;
  }

  if (quantityTotal) {
    quantityTotal.textContent = formatNumber(originalQuantityTotal);
  }

  if (quantityTop) {
    quantityTop.textContent = formatNumber(originalQuantityTotal);
  }

  if (itemCount) {
    itemCount.textContent = safeItems.length;
  }

  safeItems.forEach((item, index) => {
    const row = document.querySelectorAll("#batchRows tr")[index];
    if (!row) return;

    const rowId = Number(row.dataset.rowId);
    const foreignField =
      document.getElementById(`batchPurchaseForeign-${rowId}`);
    const unitCostField =
      document.getElementById(`batchUnitCost-${rowId}`);

    const originalForeign = Number(item?.foreignTotal);
    const originalQuantity = Math.max(
      0,
      Number(item?.originalQuantity ?? item?.quantity) || 0
    );
    const fallbackForeign =
      originalQuantity * (Number(item?.unitPrice) || 0);

    if (foreignField) {
      foreignField.value = formatMoney(
        Number.isFinite(originalForeign)
          ? originalForeign
          : fallbackForeign
      );
    }

    if (unitCostField) {
      unitCostField.value = formatMoney(canonicalV206.itemCosts[index]?.unitCost || 0);
    }
  });
}

function recalculateProductLastImport(productId, remainingImports, productName = "", category = "盆栽") {
  const normalizedName = String(productName || "").trim().toLowerCase();
  const normalizedCategory = String(category || "盆栽");

  return remainingImports
    .filter(record => {
      const sameProductId =
        productId && record.productId &&
        String(record.productId) === String(productId);
      const sameProductIdentity =
        normalizedName &&
        String(record.productName || "").trim().toLowerCase() === normalizedName &&
        String(record.category || "盆栽") === normalizedCategory;

      // V7.3: 全系统「最近进口」统一以抵达日期为唯一依据。
      // 未填写抵达日期时保持空白，不使用装柜日期补值。
      return (sameProductId || sameProductIdentity) && record.arrivalDate;
    })
    .sort(
      (a, b) =>
        parseDDMMYYYY(b.arrivalDate) -
        parseDDMMYYYY(a.arrivalDate)
    )[0]?.arrivalDate || "";
}


function getCanonicalInventoryImports(imports = getImports(), batches = getBatches()) {
  const records = new Map();

  const addRecord = record => {
    if (!record || typeof record !== "object") return;
    const id = String(record.id || "").trim();
    const fallbackKey = [
      String(record.batchId || record.importNumber || ""),
      String(record.productId || ""),
      String(record.productName || record.name || "").trim().toLowerCase(),
      String(record.category || "盆栽")
    ].join("::");
    const key = id || fallbackKey;
    if (!key || key === "::::::盆栽") return;

    const existing = records.get(key);
    if (!existing || Date.parse(record.updatedAt || record.createdAt || "") >= Date.parse(existing.updatedAt || existing.createdAt || "")) {
      records.set(key, record);
    }
  };

  const batchMap = new Map(
    (batches || []).map(batch => [String(batch.id || batch.importNumber || ""), batch])
  );

  (imports || []).forEach(record => {
    const parentBatch = batchMap.get(String(record?.batchId || record?.importNumber || ""));
    addRecord({
      ...record,
      // V7.3: 产品的「最近进口」只取抵达日期；旧明细若未复制该字段，
      // 允许从所属批次读取抵达日期，但绝不使用装柜日期代替。
      arrivalDate: record?.arrivalDate || parentBatch?.arrivalDate || "",
      unitCost: resolveImportUnitCost(record, parentBatch)
    });
  });
  (batches || []).forEach(batch => {
    (Array.isArray(batch?.items) ? batch.items : []).forEach(item => addRecord({
      ...item,
      batchId: item.batchId || batch.id,
      importNumber: item.importNumber || batch.importNumber,
      containerDate: item.containerDate || batch.containerDate,
      arrivalDate: item.arrivalDate || batch.arrivalDate || "",
      unitCost: resolveImportUnitCost(item, batch)
    }));
  });

  return [...records.values()];
}

function reconcileProductsFromImportRecords(products, imports = getImports(), batches = getBatches()) {
  const canonicalImports = getCanonicalInventoryImports(imports, batches);
  let changed = false;

  const nextProducts = (products || []).map(product => {
    const rebuilt = rebuildProductInventoryFromImports(product, canonicalImports);
    const currentStock = Math.max(0, Number(product.stock) || 0);
    const currentAverage = Math.max(0, Number(product.averageCost) || 0);
    const stockChanged = Math.abs(currentStock - rebuilt.stock) > 0.000001;
    const averageChanged = Math.abs(currentAverage - rebuilt.averageCost) > 0.005;
    const lastImportChanged = String(product.lastImport || "") !== String(rebuilt.lastImport || "");

    if (!stockChanged && !averageChanged && !lastImportChanged && !(rebuilt.stock > 0 && product.inventoryArchived)) {
      return product;
    }

    changed = true;
    return {
      ...product,
      stock: rebuilt.stock,
      averageCost: rebuilt.averageCost,
      lastImport: rebuilt.lastImport,
      inventoryArchived: rebuilt.stock > 0 ? false : product.inventoryArchived,
      updatedAt: new Date().toISOString()
    };
  });

  return { products: nextProducts, changed };
}

function repairStoredInventoryFromImports({ persistCloud = true } = {}) {
  const currentProducts = getProducts();
  const result = reconcileProductsFromImportRecords(currentProducts, getImports(), getBatches());
  if (!result.changed) return false;

  if (persistCloud) {
    saveProducts(result.products);
  } else {
    localStorage.setItem("importSystemProducts", JSON.stringify(result.products));
  }
  return true;
}

// V20.6 corrected build: repair historical batch-cost snapshots whose stored
// unitCost no longer matches the CURRENT saved batch cost inputs. This is a
// deterministic cost repair only: stock quantities, Sales history, soldUnitCost
// and database structure are untouched. Current inventory Average Cost changes
// only by the still-remaining quantity from the repaired import lot.
function repairStaleBatchUnitCostsV206({ persistCloud = true } = {}) {
  const previousProducts = getProducts();
  const previousImports = getImports();
  const previousBatches = getBatches();
  if (!previousProducts.length || !previousImports.length || !previousBatches.length) return false;

  const products = previousProducts.map(item => ({ ...item }));
  const imports = previousImports.map(item => ({ ...item }));
  const batches = previousBatches.map(batch => ({
    ...batch,
    items: Array.isArray(batch?.items) ? batch.items.map(item => ({ ...item })) : []
  }));

  const productIndexById = new Map(products.map((product, index) => [String(product.id || ""), index]));
  const importIndexById = new Map(imports.map((record, index) => [String(record.id || ""), index]));
  const inventoryValueDeltaByProduct = new Map();
  const now = new Date().toISOString();
  let importsChanged = false;
  let batchesChanged = false;

  const calculateExpected = (record, batch, totalPurchaseForeign, canonicalBatch) => {
    const originalQuantity = Math.max(0, Number(record?.originalQuantity ?? record?.stockAdded ?? record?.quantity) || 0);
    const rate = Number(batch?.rate) > 0 ? Number(batch.rate) : (Number(record?.rate) > 0 ? Number(record.rate) : 0);
    if (!(originalQuantity > 0) || !(rate > 0) || !(totalPurchaseForeign > 0)) return null;

    const foreignTotal = Math.max(0, Number(record?.foreignTotal) || (originalQuantity * (Number(record?.unitPrice) || 0)));
    if (!(foreignTotal > 0)) return null;

    const sharedForeign =
      (Number(batch?.inlandTransportCost) || Number(batch?.chinaTransportCost) || 0) +
      (Number(batch?.potCost) || Number(batch?.potCostForeign) || 0);
    const shippingRate = Math.max(0, Number(canonicalBatch?.shippingRate) || 0);
    const purchaseRM = foreignTotal / rate;
    const sharedRM = sharedForeign / rate;
    const allocatedSharedRM = sharedRM * (foreignTotal / totalPurchaseForeign);
    const batchTotal = (purchaseRM + allocatedSharedRM) * (1 + shippingRate / 100);
    const unitCost = batchTotal / originalQuantity;
    if (!Number.isFinite(unitCost) || unitCost < 0) return null;

    return { unitCost, batchTotal, purchaseRM, rate, shippingRate };
  };

  batches.forEach(batch => {
    const items = Array.isArray(batch.items) ? batch.items : [];
    if (!items.length) return;

    const totalPurchaseForeign = items.reduce((sum, item) => {
      const foreign = Number(item?.foreignTotal);
      if (Number.isFinite(foreign) && foreign > 0) return sum + foreign;
      const qty = Math.max(0, Number(item?.originalQuantity ?? item?.stockAdded ?? item?.quantity) || 0);
      return sum + qty * Math.max(0, Number(item?.unitPrice) || 0);
    }, 0);
    if (!(totalPurchaseForeign > 0)) return;

    const canonicalBatch = getCanonicalBatchCostSnapshotV206(batch, items);
    const aggregateChanged = batchCostSnapshotIsStaleV206(batch, items);
    if (aggregateChanged) {
      batch.rate = canonicalBatch.rate;
      batch.chinaTransportRM = canonicalBatch.rate > 0 ? canonicalBatch.chinaTransportCost / canonicalBatch.rate : 0;
      batch.potRM = canonicalBatch.rate > 0 ? canonicalBatch.potCost / canonicalBatch.rate : 0;
      batch.inlandMiscForeign = canonicalBatch.sharedForeign;
      batch.inlandMiscRate = canonicalBatch.inlandMiscRate;
      batch.inlandMiscPercent = canonicalBatch.inlandMiscRate;
      batch.shippingRate = canonicalBatch.shippingRate;
      batch.totalForeignCostsRM = canonicalBatch.totalForeignCostsRM;
      batch.grandTotal = canonicalBatch.grandTotal;
      batchesChanged = true;
    }

    batch.items = items.map(item => {
      const expected = calculateExpected(item, batch, totalPurchaseForeign, canonicalBatch);
      if (!expected) return item;

      const oldUnitCost = Math.max(0, Number(item?.unitCost) || 0);
      if (Math.abs(expected.unitCost - oldUnitCost) <= 0.005) return item;

      const remainingQuantity = Math.max(0, Number(item?.remainingQuantity ?? item?.stockAdded ?? item?.quantity) || 0);
      const productId = String(item?.productId || "");
      if (remainingQuantity > 0 && productId) {
        inventoryValueDeltaByProduct.set(
          productId,
          (Number(inventoryValueDeltaByProduct.get(productId)) || 0) +
            remainingQuantity * (expected.unitCost - oldUnitCost)
        );
      }

      const repaired = {
        ...item,
        rate: expected.rate,
        purchaseRM: expected.purchaseRM,
        shippingRate: expected.shippingRate,
        unitCost: expected.unitCost,
        batchTotal: expected.batchTotal,
        updatedAt: now
      };
      batchesChanged = true;

      const importIndex = importIndexById.get(String(item?.id || ""));
      if (importIndex !== undefined) {
        imports[importIndex] = { ...imports[importIndex], ...repaired };
        importsChanged = true;
      } else {
        const fallbackIndex = imports.findIndex(record =>
          (String(record?.batchId || "") === String(batch?.id || "") ||
           String(record?.importNumber || "") === String(batch?.importNumber || "")) &&
          String(record?.productId || "") === productId
        );
        if (fallbackIndex >= 0) {
          imports[fallbackIndex] = { ...imports[fallbackIndex], ...repaired, id: imports[fallbackIndex].id };
          importsChanged = true;
        }
      }

      return repaired;
    });

    if (batchesChanged) batch.updatedAt = now;
  });

  let productsChanged = false;
  inventoryValueDeltaByProduct.forEach((delta, productId) => {
    const index = productIndexById.get(String(productId));
    if (index === undefined) return;
    const stock = Math.max(0, Number(products[index]?.stock) || 0);
    const averageCost = Math.max(0, Number(products[index]?.averageCost) || 0);
    if (!(stock > 0) || Math.abs(delta) <= 0.005) return;
    const nextInventoryValue = Math.max(0, stock * averageCost + delta);
    const nextAverageCost = nextInventoryValue / stock;
    if (Math.abs(nextAverageCost - averageCost) <= 0.005) return;
    products[index] = { ...products[index], averageCost: nextAverageCost, updatedAt: now };
    productsChanged = true;
  });

  // V20.6: a few old imports can have valid remaining stock but Products.averageCost = 0.
  // Rebuild only that invalid Average Cost when the remaining import quantities exactly match
  // Products.stock. Stock quantity itself is never changed here.
  products.forEach((product, index) => {
    const stock = Math.max(0, Number(product?.stock) || 0);
    const averageCost = Number(product?.averageCost);
    if (!(stock > 0) || (Number.isFinite(averageCost) && averageCost > 0)) return;
    const productId = String(product?.id || "");
    const productName = String(product?.name || "").trim().toLowerCase();
    const matching = imports.filter(record => {
      const sameId = productId && String(record?.productId || "") === productId;
      const sameName = !sameId && productName && String(record?.productName || "").trim().toLowerCase() === productName;
      return sameId || sameName;
    });
    const totals = matching.reduce((acc, record) => {
      const qty = Math.max(0, Number(record?.remainingQuantity ?? record?.quantity) || 0);
      const cost = Math.max(0, Number(record?.unitCost) || 0);
      if (qty > 0 && cost > 0) { acc.qty += qty; acc.value += qty * cost; }
      return acc;
    }, { qty:0, value:0 });
    if (Math.abs(totals.qty - stock) > 0.000001 || !(totals.value > 0)) return;
    products[index] = { ...product, averageCost: totals.value / stock, updatedAt: now };
    productsChanged = true;
  });

  if (!productsChanged && !importsChanged && !batchesChanged) return false;

  localStorage.setItem("importSystemProducts", JSON.stringify(products));
  localStorage.setItem("importSystemImports", JSON.stringify(imports));
  localStorage.setItem("importSystemBatches", JSON.stringify(batches));
  if (typeof invalidateMinimumPriceOriginIndexV160 === "function") invalidateMinimumPriceOriginIndexV160();

  if (persistCloud && typeof markCloudCollectionSaved === "function") {
    if (productsChanged) markCloudCollectionSaved("products", previousProducts, products);
    if (importsChanged) markCloudCollectionSaved("imports", previousImports, imports);
    if (batchesChanged) markCloudCollectionSaved("batches", previousBatches, batches);
  }

  ["renderDashboard", "renderInventoryManagementList", "renderProductList", "renderBatchList"].forEach(name => {
    try { if (typeof window[name] === "function") window[name](); } catch (error) { console.warn(`${name} refresh skipped:`, error); }
  });
  return true;
}
window.repairStaleBatchUnitCostsV206 = repairStaleBatchUnitCostsV206;


function resolveImportUnitCost(record, batch = null, fallbackProduct = null, fallbackImport = null) {
  const direct = Number(record?.unitCost);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const originalQuantity = Math.max(
    0,
    Number(record?.originalQuantity ?? record?.stockAdded ?? record?.quantity) || 0
  );
  if (originalQuantity <= 0) return 0;

  const batchTotal = Number(record?.batchTotal);
  if (Number.isFinite(batchTotal) && batchTotal > 0) {
    return batchTotal / originalQuantity;
  }

  const fallbackDirect = Number(fallbackImport?.unitCost);
  if (Number.isFinite(fallbackDirect) && fallbackDirect > 0) return fallbackDirect;

  const fallbackBatchTotal = Number(fallbackImport?.batchTotal);
  if (Number.isFinite(fallbackBatchTotal) && fallbackBatchTotal > 0) {
    return fallbackBatchTotal / originalQuantity;
  }

  const productAverage = Number(fallbackProduct?.averageCost);
  if (Number.isFinite(productAverage) && productAverage > 0) return productAverage;

  // 旧版本的进口明细可能没有保存 unitCost / batchTotal。
  // 优先根据该批次原始费用，使用与新增进口完全相同的分摊公式重建。
  if (batch && typeof batch === "object") {
    const items = Array.isArray(batch.items) ? batch.items : [];
    const foreignTotal = Math.max(
      0,
      Number(record?.foreignTotal) ||
      ((Number(record?.quantity) || originalQuantity) * (Number(record?.unitPrice) || 0))
    );
    const totalPurchaseForeign = items.reduce((sum, item) => {
      const itemForeign = Number(item?.foreignTotal);
      if (Number.isFinite(itemForeign) && itemForeign > 0) return sum + itemForeign;
      return sum + ((Number(item?.quantity) || 0) * (Number(item?.unitPrice) || 0));
    }, 0);
    const rate = Number(record?.rate) > 0
      ? Number(record.rate)
      : (Number(batch.rate) > 0 ? Number(batch.rate) : 0);
    const inlandTransport =
      Number(batch.inlandTransportCost) ||
      Number(batch.chinaTransportCost) ||
      0;
    const potCost =
      Number(batch.potCost) ||
      Number(batch.potCostForeign) ||
      0;
    const sharedForeign = inlandTransport + potCost;
    const shippingRate = Number(record?.shippingRate);
    const effectiveShippingRate = Number.isFinite(shippingRate)
      ? shippingRate
      : (Number(batch.shippingRate) || 0);

    if (rate > 0 && foreignTotal > 0 && totalPurchaseForeign > 0) {
      const purchaseRM = foreignTotal / rate;
      const sharedRM = sharedForeign / rate;
      const allocatedSharedRM = sharedRM * (foreignTotal / totalPurchaseForeign);
      const itemTotal = (purchaseRM + allocatedSharedRM) *
        (1 + effectiveShippingRate / 100);
      if (Number.isFinite(itemTotal) && itemTotal > 0) {
        return itemTotal / originalQuantity;
      }
    }

    // 最后备用：按货款比例分配整批总成本。
    const grandTotal = Number(batch.grandTotal);
    if (grandTotal > 0 && foreignTotal > 0 && totalPurchaseForeign > 0) {
      return (grandTotal * (foreignTotal / totalPurchaseForeign)) / originalQuantity;
    }
  }

  const purchaseRM = Number(record?.purchaseRM);
  const shippingRate = Number(record?.shippingRate);
  if (Number.isFinite(purchaseRM) && purchaseRM > 0) {
    const effectiveRate = Number.isFinite(shippingRate) ? shippingRate : 0;
    return (purchaseRM * (1 + effectiveRate / 100)) / originalQuantity;
  }

  return 0;
}

function rebuildProductInventoryFromImports(product, remainingImports) {
  const productId = String(product.id || "");
  const productName = String(product.name || "").trim().toLowerCase();
  const productCategory = String(product.category || "盆栽");

  const matchingImports = remainingImports.filter(record => {
    const sameProductId =
      productId && record.productId &&
      String(record.productId) === productId;
    const sameProductIdentity =
      productName &&
      String(record.productName || "").trim().toLowerCase() === productName &&
      String(record.category || "盆栽") === productCategory;

    return sameProductId || sameProductIdentity;
  });

  let stock = 0;
  let totalCost = 0;

  matchingImports.forEach(record => {
    const remainingRaw = record.remainingQuantity;
    const quantity = Math.max(
      0,
      Number(
        remainingRaw !== undefined && remainingRaw !== null && remainingRaw !== ""
          ? remainingRaw
          : (record.stockAdded ?? record.quantity)
      ) || 0
    );
    const unitCost = resolveImportUnitCost(record);

    stock += quantity;
    totalCost += quantity * unitCost;
  });

  return {
    stock,
    averageCost: stock > 0 ? totalCost / stock : 0,
    lastImport: recalculateProductLastImport(
      product.id,
      matchingImports,
      product.name,
      product.category
    )
  };
}

function reverseBatchInventoryImpact(products, batchItems, remainingImports) {
  const affectedProductIds = new Set();

  (batchItems || []).forEach(record => {
    const recordName = String(record.productName || "").trim().toLowerCase();
    const recordCategory = String(record.category || "盆栽");
    const productIndex = products.findIndex(product => {
      const sameProductId =
        product.id && record.productId &&
        String(product.id) === String(record.productId);
      const sameProductIdentity =
        recordName &&
        String(product.name || "").trim().toLowerCase() === recordName &&
        String(product.category || "盆栽") === recordCategory;

      return sameProductId || sameProductIdentity;
    });

    if (productIndex === -1) return;

    const product = products[productIndex];
    const currentStock = Math.max(0, Number(product.stock) || 0);
    const currentAverage = Math.max(0, Number(product.averageCost) || 0);
    const originalQuantity = Math.max(
      0,
      Number(record.originalQuantity ?? record.quantity ?? record.stockAdded) || 0
    );
    const remainingRaw = Number(record.remainingQuantity);
    const remainingQuantity = Number.isFinite(remainingRaw)
      ? Math.min(originalQuantity, Math.max(0, Math.floor(remainingRaw)))
      : originalQuantity;
    const unitCost = Math.max(0, Number(record.unitCost) || 0);

    const newStock = Math.max(0, currentStock - remainingQuantity);
    const currentTotalCost = currentStock * currentAverage;
    const newTotalCost = Math.max(
      0,
      currentTotalCost - (remainingQuantity * unitCost)
    );

    products[productIndex] = {
      ...product,
      stock: newStock,
      averageCost: newStock > 0 ? newTotalCost / newStock : 0,
      lastImport: recalculateProductLastImport(
        product.id,
        remainingImports,
        product.name,
        product.category
      ),
      updatedAt: new Date().toISOString()
    };

    affectedProductIds.add(product.id);
  });

  return affectedProductIds;
}

function isSameDeletedBatchProductV234(item, product) {
  const productId = String(product?.id || "").trim();
  const itemProductId = String(item?.productId || "").trim();
  if (productId && itemProductId && productId === itemProductId) return true;
  const productName = String(product?.name || "").trim().toLowerCase();
  const itemName = String(item?.productName || item?.name || "").trim().toLowerCase();
  const productCategory = normalizeProductCategoryNameV227(product?.category || "盆栽");
  const itemCategory = normalizeProductCategoryNameV227(item?.category || "盆栽");
  return Boolean(productName && itemName && productName === itemName && productCategory === itemCategory);
}

function productHasProtectedHistoryV234(product) {
  try {
    const adjustments = typeof getProductStockAdjustments === "function"
      ? getProductStockAdjustments(product)
      : [];
    return Array.isArray(adjustments) && adjustments.length > 0;
  } catch (_) {
    return false;
  }
}

function removeOrphanedProductsAfterBatchDeleteV234(products, deletedBatchItems, remainingImports, remainingBatches) {
  const deletedItems = Array.isArray(deletedBatchItems) ? deletedBatchItems : [];
  if (!deletedItems.length) return products;
  return products.filter(product => {
    const belongedToDeletedBatch = deletedItems.some(item => isSameDeletedBatchProductV234(item, product));
    if (!belongedToDeletedBatch) return true;
    if ((Number(product?.stock) || 0) !== 0) return true;
    if (productHasProtectedHistoryV234(product)) return true;
    const stillInImports = (remainingImports || []).some(item => isSameDeletedBatchProductV234(item, product));
    if (stillInImports) return true;
    const stillInBatches = (remainingBatches || []).some(batch =>
      (Array.isArray(batch?.items) ? batch.items : []).some(item => isSameDeletedBatchProductV234(item, product))
    );
    return stillInBatches;
  });
}

function purgeDeletedProductMetadataV249(productIds) {
  const ids = new Set((productIds || []).map(value => String(value || "").trim()).filter(Boolean));
  if (!ids.size) return false;
  const settings = loadJSON("importSystemSettings", {});
  let changed = false;

  const overrides = { ...(settings.minimumPriceManualOverrides || {}) };
  ids.forEach(id => { if (Object.prototype.hasOwnProperty.call(overrides, id)) { delete overrides[id]; changed = true; } });

  const media = { ...(settings.productMediaLinksV229 || {}) };
  ids.forEach(id => { if (Object.prototype.hasOwnProperty.call(media, id)) { delete media[id]; changed = true; } });

  const aliases = { ...(settings.productIdAliases || {}) };
  Object.keys(aliases).forEach(key => {
    if (ids.has(String(key)) || ids.has(String(aliases[key]))) { delete aliases[key]; changed = true; }
  });

  if (changed) {
    saveJSON("importSystemSettings", {
      ...settings,
      minimumPriceManualOverrides: overrides,
      productMediaLinksV229: media,
      productIdAliases: aliases
    });
    if (typeof markCloudSettingsSaved === "function") markCloudSettingsSaved();
  }
  return changed;
}

function getBatchDeleteExpectedStockV249(products, batchItems) {
  const beforeById = new Map((products || []).map(product => [String(product?.id || ""), Math.max(0, Number(product?.stock) || 0)]));
  const removeById = new Map();
  (batchItems || []).forEach(record => {
    const product = (products || []).find(item =>
      (record?.productId && String(item?.id || "") === String(record.productId)) ||
      (!record?.productId && String(item?.name || "").trim().toLowerCase() === String(record?.productName || "").trim().toLowerCase() &&
       String(item?.category || "盆栽") === String(record?.category || "盆栽"))
    );
    if (!product?.id) return;
    const original = Math.max(0, Number(record?.originalQuantity ?? record?.quantity ?? record?.stockAdded) || 0);
    const remainingRaw = Number(record?.remainingQuantity);
    const remaining = Number.isFinite(remainingRaw) ? Math.min(original, Math.max(0, Math.floor(remainingRaw))) : original;
    removeById.set(String(product.id), (removeById.get(String(product.id)) || 0) + remaining);
  });
  const expectedById = new Map();
  beforeById.forEach((before, id) => expectedById.set(id, Math.max(0, before - (removeById.get(id) || 0))));
  return { beforeById, removeById, expectedById };
}

function assertBatchDeleteStockSafetyV249(products, expected) {
  const afterById = new Map((products || []).map(product => [String(product?.id || ""), Math.max(0, Number(product?.stock) || 0)]));
  for (const [id, expectedStock] of expected.expectedById.entries()) {
    const actual = afterById.get(id);
    if (actual === undefined) continue;
    if (Math.abs(actual - expectedStock) > 0.000001) {
      throw new Error(`删除库存安全检查失败：${id} 应为 ${formatNumber(expectedStock)}，实际 ${formatNumber(actual)}`);
    }
  }
}

function clearRecentImportDeleteViewV234(importNumber) {
  const batchSearch = document.getElementById("batchSearch");
  const productSearch = document.getElementById("batchProductStockSearch");
  const productResults = document.getElementById("batchProductStockResults");
  const productStatus = document.getElementById("batchProductStockStatus");
  if (batchSearch) batchSearch.value = "";
  if (productSearch) productSearch.value = "";
  if (productResults) {
    productResults.innerHTML = "";
    productResults.hidden = true;
  }
  if (productStatus) productStatus.textContent = "";
  batchListExpanded = false;
  renderBatchList();
  if (typeof showHistoryCopyToast === "function") {
    showHistoryCopyToast(`✓ 成功删除进口编号：${importNumber}`);
  }
}

function copyBatchAsNewDraftV221(importNumber) {
  const normalized = String(importNumber || "").trim().toLowerCase();
  const batch = getBatches().find(item =>
    String(item?.importNumber || "").trim().toLowerCase() === normalized
  );
  if (!batch) {
    alert("找不到这个进口编号，无法复制。");
    return false;
  }

  const items = getBatchItemsForDisplay(batch);
  if (!items.length) {
    alert("这张进口记录没有产品资料，无法复制。");
    return false;
  }

  if (currentEditingImportNumber || document.querySelectorAll("#batchRows tr").length) {
    const proceed = confirm(
      `复制进口编号 ${batch.importNumber} 为新资料？\n\n` +
      "当前进口输入区会被这张进口记录的副本取代。旧进口不会删除。\n" +
      "副本属于全新未保存资料，保存时会按系统原有逻辑自动生成新的进口编号。\n\n继续？"
    );
    if (!proceed) return false;
  }

  resetBatchForm({ clearLookup: true, clearStatus: true });

  const currency = String(getStoredBatchValue(batch, items, "currency", "CNY")).toUpperCase();
  const rate = Number(getStoredBatchValue(batch, items, "rate", 0)) || getDefaultExchangeRate(currency);
  const values = {
    batchRackQuantity: getStoredBatchValue(batch, items, "rackQuantity", ""),
    batchTrackingNumber: getStoredBatchValue(batch, items, "trackingNumber", ""),
    batchOverseasTrackingNumber: getStoredBatchValue(batch, items, "overseasTrackingNumber", ""),
    batchContainerDate: getStoredBatchValue(batch, items, "containerDate", ""),
    batchArrivalDate: getStoredBatchValue(batch, items, "arrivalDate", ""),
    batchChinaTransportCost: Number(batch.chinaTransportCost) || 0,
    batchPotCost: Number(batch.potCost) || 0,
    batchShippingMY: Number(batch.shippingMY) || 0,
    batchRate: rate
  };
  const currencyField = document.getElementById("batchCurrency");
  if (currencyField) currencyField.value = currency;
  Object.entries(values).forEach(([id, value]) => {
    const field = document.getElementById(id);
    if (!field) return;
    if (["batchChinaTransportCost","batchPotCost","batchShippingMY","batchRate"].includes(id)) {
      field.value = Number(value) ? formatMoney(Number(value)) : "";
    } else {
      field.value = value ?? "";
    }
  });
  const containerPicker = document.getElementById("batchContainerDatePicker");
  if (containerPicker) containerPicker.value = formatDDMMYYYYToNative(values.batchContainerDate);
  const arrivalPicker = document.getElementById("batchArrivalDatePicker");
  if (arrivalPicker) arrivalPicker.value = formatDDMMYYYYToNative(values.batchArrivalDate);

  const rows = document.getElementById("batchRows");
  if (rows) rows.innerHTML = "";
  batchRowSeq = 0;
  items.forEach(item => {
    addBatchRow({
      name: item.productName || item.name || "",
      category: item.category || "盆栽",
      productId: item.productId || "",
      quantity: getLockedBatchOriginalQuantity(item),
      unitPrice: Number(item.unitPrice) || 0
    });
  });

  setBatchEditMode("");
  const lookup = document.getElementById("batchLookupInput");
  if (lookup) lookup.value = "";
  calculateBatch();
  const status = document.getElementById("batchStatusText");
  if (status) {
    status.textContent = `已复制 ${batch.importNumber} 为全新未保存资料。请修正后保存；系统会按原有逻辑生成新的进口编号。旧进口仍保留。`;
  }
  document.getElementById("batchImportForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
  return true;
}

async function deleteBatchByNumber(importNumber) {

  const batches = getBatches();
  const batchIndex = batches.findIndex(
    batch =>
      String(batch.importNumber || "").toLowerCase() ===
      String(importNumber).toLowerCase()
  );

  if (batchIndex === -1) {
    alert("找不到这个进口编号，无法删除。");
    return;
  }

  const batch = batches[batchIndex];
  const imports = getImports();
  const normalizedImportNumber = String(batch.importNumber || "").trim().toLowerCase();
  const batchItems = imports.filter(record =>
    String(record?.batchId || "") === String(batch.id || "") ||
    (normalizedImportNumber && String(record?.importNumber || "").trim().toLowerCase() === normalizedImportNumber)
  );
  const effectiveItems =
    batchItems.length ? batchItems : (batch.items || []);

  // V24.6: “复制”已经是独立按钮，删除按钮只负责删除。
  // 不再使用 confirm 的“确定=复制 / 取消=继续删除”反向流程，
  // 避免用户明确点击删除却实际只复制一份。
  const confirmed = confirm(
    `⚠️ 永久删除整个进口编号 ${batch.importNumber}？\n\n` +
    `产品种类：${Number(batch.itemCount) || effectiveItems.length}\n` +
    `总数量：${Number(batch.totalQuantity) || 0}\n` +
    `整批总成本：${formatMoney(Number(batch.grandTotal) || 0, "RM ")}\n\n` +
    `删除会完整清除这张进口记录，并按现有删除逻辑扣回该批库存影响、重算相关平均成本。\n` +
    `删除后不能撤销；如需保留副本，请先取消并使用旁边的「复制」按钮。\n\n` +
    `按【确定】＝永久删除\n按【取消】＝不做任何更改`
  );

  if (!confirmed) return;

  // V26.6: deletion can take time because cloud flush + pull-back verification
  // are intentionally strict. Give immediate, staged feedback instead of making
  // the user wait with an apparently idle screen.
  const deleteButtonV251 = Array.from(document.querySelectorAll('[data-delete-import-v251]')).find(btn =>
    String(btn.dataset.deleteImportV251 || '').toLowerCase() === String(batch.importNumber || '').toLowerCase()
  );
  const deleteStatusV251 = document.getElementById("batchStatusText");
  if (deleteButtonV251) {
    deleteButtonV251.disabled = true;
    deleteButtonV251.dataset.originalTextV251 = deleteButtonV251.textContent || "删除";
    deleteButtonV251.textContent = "删除中…";
  }
  if (deleteStatusV251) deleteStatusV251.textContent = `正在删除本机记录 ${batch.importNumber}…`;
  await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));

  const remainingImports = imports.filter(record => {
    const sameBatchId = String(record?.batchId || "") === String(batch.id || "");
    const sameImportNumber = normalizedImportNumber &&
      String(record?.importNumber || "").trim().toLowerCase() === normalizedImportNumber;
    return !sameBatchId && !sameImportNumber;
  });
  const products = getProducts();
  const deleteStockSafetyV249 = getBatchDeleteExpectedStockV249(products, effectiveItems);

  reverseBatchInventoryImpact(
    products,
    effectiveItems,
    remainingImports
  );
  try {
    assertBatchDeleteStockSafetyV249(products, deleteStockSafetyV249);
  } catch (safetyError) {
    if (deleteButtonV251) { deleteButtonV251.disabled = false; deleteButtonV251.textContent = deleteButtonV251.dataset.originalTextV251 || "删除"; }
    if (deleteStatusV251) deleteStatusV251.textContent = `删除已停止：${safetyError?.message || safetyError}`;
    alert(`删除已停止，没有写入任何资料。\n\n${safetyError?.message || safetyError}`);
    return;
  }

  // 修复旧资料可能遗留的隐藏标记：有库存就不能被首页隐藏。
  products.forEach(product => {
    if ((Number(product.stock) || 0) > 0) {
      product.inventoryArchived = false;
    }
  });

  batches.splice(batchIndex, 1);

  // V24.6: deleting the only import for a test/new product should also remove the
  // resulting zero-stock orphan product, so its category/prefix can unlock. A
  // product with any protected stock-adjustment/sales history is kept.
  const nextProductsV234 = removeOrphanedProductsAfterBatchDeleteV234(
    products,
    effectiveItems,
    remainingImports,
    batches
  );
  const removedOrphanProductIdsV249 = products
    .filter(product => !nextProductsV234.some(next => String(next?.id || "") === String(product?.id || "")))
    .map(product => String(product?.id || "")).filter(Boolean);

  const beforeDeleteProductsV228 = getProducts().map(item => ({ ...item }));
  const beforeDeleteImportsV228 = getImports().map(item => ({ ...item }));
  const beforeDeleteBatchesV228 = getBatches().map(batchItem => ({ ...batchItem, items: Array.isArray(batchItem.items) ? batchItem.items.map(item => ({ ...item })) : [] }));

  if (typeof window.markCloudImportNumberDeletedV232 === "function") {
    window.markCloudImportNumberDeletedV232(batch.importNumber, batch.id);
  }
  // V33.9: also tombstone concrete row IDs so a later Pull cannot resurrect a deleted test import/product.
  if (typeof window.markCloudExplicitDeletedIdsV323 === "function") {
    window.markCloudExplicitDeletedIdsV323({
      imports: batchItems.map(item => String(item?.id || "")).filter(Boolean),
      batches: [String(batch?.id || "")].filter(Boolean),
      products: removedOrphanProductIdsV249
    });
  }
  saveProducts(nextProductsV234);
  purgeDeletedProductMetadataV249(removedOrphanProductIdsV249);
  saveImports(remainingImports);
  saveBatches(batches);

  const deleteStatusV228 = document.getElementById("batchStatusText");
  if (deleteStatusV228) deleteStatusV228.textContent = `正在同步云端删除 ${batch.importNumber}…`;
  await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
  try {
    if (typeof window.flushCloudQueueStrictV228 === "function") {
      await window.flushCloudQueueStrictV228();
    }
    if (typeof getCloudQueue === "function" && getCloudQueue()?.dirty) {
      throw new Error("云端仍有资料等待同步");
    }
    // V33.9: pushAll_ writes the exact canonical Imports/Batches snapshot when an
    // explicit import-number tombstone is present. A successful strict flush is the
    // server-side confirmation; do not block the UI with one or two full Pulls.
    if (deleteStatusV228) deleteStatusV228.textContent = `云端已确认删除 ${batch.importNumber}，正在整理画面…`;
    const stillHasBatchV231 = getBatches().some(item =>
      String(item?.id || "") === String(batch.id || "") ||
      String(item?.importNumber || "").trim().toLowerCase() === normalizedImportNumber
    );
    const stillHasImportV231 = getImports().some(item =>
      String(item?.batchId || "") === String(batch.id || "") ||
      String(item?.importNumber || "").trim().toLowerCase() === normalizedImportNumber
    );
    const orphanStillExistsV249 = removedOrphanProductIdsV249.some(id => getProducts().some(product => String(product?.id || "") === id));
    if (stillHasBatchV231 || stillHasImportV231) throw new Error("本机删除验证失败：仍存在这个进口编号");
    if (orphanStillExistsV249) throw new Error("本机删除验证失败：零库存测试产品仍残留在 Products");
    // A non-blocking background Pull keeps revision/cache fresh without delaying the user.
    if (typeof window.pullLatestAfterSalesCommitV83 === "function") {
      window.setTimeout(() => Promise.resolve(window.pullLatestAfterSalesCommitV83(false)).catch(() => {}), 1200);
    }
  } catch (error) {
    if (typeof window.cancelCloudImportNumberDeletionV232 === "function") {
      window.cancelCloudImportNumberDeletionV232(batch.importNumber, batch.id);
    }
    saveProducts(beforeDeleteProductsV228);
    saveImports(beforeDeleteImportsV228);
    saveBatches(beforeDeleteBatchesV228);
    if (deleteStatusV228) deleteStatusV228.textContent = `删除未同步成功，已恢复本机资料：${error?.message || error}`;
    alert(`删除 ${batch.importNumber} 未成功同步到 Google Sheet。

系统已恢复本机资料，不会假装删除成功。

原因：${error?.message || error}`);
    renderBatchSuggestions();
    renderBatchList();
    renderInventoryManagementList();
    renderDashboard();
    return;
  }

  if (
    String(currentEditingImportNumber || "").toLowerCase() ===
    String(batch.importNumber || "").toLowerCase()
  ) {
    resetBatchForm();
  }

  renderBatchSuggestions();
  clearRecentImportDeleteViewV234(batch.importNumber);
  renderInventoryManagementList();
  renderDashboard();
  renderProductPrefixRulesV181();

  const successStatusV234 = document.getElementById("batchStatusText");
  if (successStatusV234) {
    successStatusV234.textContent =
      `成功删除进口编号 ${batch.importNumber}，并已确认同步到 Google Sheet。${removedOrphanProductIdsV249.length ? ` 已清理 ${removedOrphanProductIdsV249.length} 个零库存孤立产品。` : ""} 对应产品如已无其他进口／库存／历史占用，产品前缀与类别已自动重新检查并解锁。`;
  }
  window.alert(`✓ 成功删除进口编号 ${batch.importNumber}。\n\n已确认云端删除完成；其他进口编号及产品既有买卖／库存进出历史记录均保留。`);
}


function getStoredBatchValue(batch, items, key, fallback = "") {
  const direct = batch?.[key];

  if (direct !== undefined && direct !== null && direct !== "") {
    return direct;
  }

  const itemValue = (items || []).find(
    item => item?.[key] !== undefined && item?.[key] !== null && item?.[key] !== ""
  )?.[key];

  return itemValue !== undefined && itemValue !== null && itemValue !== ""
    ? itemValue
    : fallback;
}

function getDefaultExchangeRate(currency) {
  if (String(currency || "").toUpperCase() === "MYR") return 1.00;
  const defaults = {
    CNY: 1.60,
    NTD: 7.69,
    VND: 6300.00,
    IDR: 3571.00,
    MYR: 1.00
  };

  const saved = loadJSON("importSystemSettings", {});
  const value = Number(saved?.[currency]);

  return Number.isFinite(value) && value > 0
    ? value
    : defaults[currency] || 0;
}

function getCumulativeOriginalQuantity(productId, productName, category, imports = getImports()) {
  const normalizedName = String(productName || "").trim().toLowerCase();
  const normalizedCategory = String(category || "盆栽");

  return imports.reduce((sum, item) => {
    const sameProduct = productId
      ? String(item.productId || "") === String(productId)
      : (
          String(item.productName || "").trim().toLowerCase() === normalizedName &&
          String(item.category || "盆栽") === normalizedCategory
        );

    if (!sameProduct) return sum;

    return sum + Math.max(
      0,
      Number(item.originalQuantity ?? item.quantity) || 0
    );
  }, 0);
}

function getCurrentProductStock(productId, productName, category, products = getProducts()) {
  const normalizedName = String(productName || "").trim().toLowerCase();
  const normalizedCategory = String(category || "盆栽");

  const product = products.find(item =>
    (productId && String(item.id || "") === String(productId)) ||
    (
      String(item.name || "").trim().toLowerCase() === normalizedName &&
      String(item.category || "盆栽") === normalizedCategory
    )
  );

  return Math.max(0, Number(product?.stock) || 0);
}

function loadBatchByNumber() {
  const input = document.getElementById("batchLookupInput");
  const query = input.value.trim();

  if (!query) {
    alert("请输入进口编号或海外运输单号 / 本地单号。");
    input.focus();
    return;
  }

  const normalizedQuery = query.toLowerCase();
  const batches = getBatches();

  let batch = batches.find(
    item =>
      String(item.importNumber || "").trim().toLowerCase() ===
        normalizedQuery ||
      String(item.overseasTrackingNumber || "").trim().toLowerCase() ===
        normalizedQuery
  );

  if (!batch) {
    const partialMatches = batches.filter(item =>
      sequentialSearchMatches(item.importNumber, normalizedQuery) ||
      sequentialSearchMatches(item.overseasTrackingNumber, normalizedQuery)
    );

    if (partialMatches.length === 1) {
      batch = partialMatches[0];
    } else if (partialMatches.length > 1) {
      alert("找到多个符合的进口记录，请输入更完整的进口编号或海外运输单号 / 本地单号。");
      // V6.8: do not force focus/select after closing the alert.
      // The user can tap back into the field and correct the value normally.
      return;
    }
  }

  if (!batch) {
    alert("找不到这个进口编号或海外运输单号 / 本地单号。");
    // V6.8: never force focus/select here. On iPhone this previously caused
    // the invalid value to immediately trigger lookup again and appear "locked".
    return;
  }

  resetBatchForm(true);

  const batchItems = getBatchItemsForDisplay(batch);
  const currency = String(
    getStoredBatchValue(batch, batchItems, "currency", "CNY")
  ).toUpperCase();
  const storedRate = Number(
    getStoredBatchValue(batch, batchItems, "rate", 0)
  );
  const effectiveRate =
    Number.isFinite(storedRate) && storedRate > 0
      ? storedRate
      : getDefaultExchangeRate(currency);

  const rackQuantity = getStoredBatchValue(batch, batchItems, "rackQuantity", "");
  const trackingNumber = getStoredBatchValue(batch, batchItems, "trackingNumber", "");
  const overseasTrackingNumber = getStoredBatchValue(
    batch,
    batchItems,
    "overseasTrackingNumber",
    ""
  );
  const containerDate = getStoredBatchValue(batch, batchItems, "containerDate", "");
  const arrivalDate = getStoredBatchValue(batch, batchItems, "arrivalDate", "");
  const storedPotCost = Number(batch.potCost);
  const storedPotRM = Number(batch.potRM);
  const potCost =
    Number.isFinite(storedPotCost) && storedPotCost > 0
      ? storedPotCost
      : (
          Number.isFinite(storedPotRM) &&
          storedPotRM > 0 &&
          effectiveRate > 0
            ? storedPotRM * effectiveRate
            : 0
        );

  const shippingMY = Number(batch.shippingMY) || 0;

  const storedChinaTransportCost = Number(batch.chinaTransportCost);
  const storedChinaTransportRM = Number(batch.chinaTransportRM);

  const totalProductForeign = batchItems.reduce(
    (sum, item) => {
      const storedForeignTotal = Number(item.foreignTotal);

      if (Number.isFinite(storedForeignTotal) && storedForeignTotal > 0) {
        return sum + storedForeignTotal;
      }

      return sum +
        ((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0));
    },
    0
  );

  const storedForeignCostsRM = Number(batch.totalForeignCostsRM);
  const storedGrandTotal = Number(batch.grandTotal);

  const recoverableForeignCostsRM =
    Number.isFinite(storedForeignCostsRM) && storedForeignCostsRM > 0
      ? storedForeignCostsRM
      : (
          Number.isFinite(storedGrandTotal) &&
          storedGrandTotal > shippingMY
            ? storedGrandTotal - shippingMY
            : 0
        );

  // V6.8: never reconstruct inland cost from total cost.
  // Only use values explicitly saved in this import record.
  // This prevents old VND/CNY batches from inheriting incorrect costs.
  const recoveredChinaTransportCost = 0;

  const chinaTransportCost =
    Number.isFinite(storedChinaTransportCost) && storedChinaTransportCost > 0
      ? storedChinaTransportCost
      : (
          Number.isFinite(storedChinaTransportRM) &&
          storedChinaTransportRM > 0 &&
          effectiveRate > 0
            ? storedChinaTransportRM * effectiveRate
            : recoveredChinaTransportCost
        );

  document.getElementById("batchRackQuantity").value = rackQuantity;
  document.getElementById("batchTrackingNumber").value = trackingNumber;
  document.getElementById("batchChinaTransportCost").value =
    chinaTransportCost ? formatMoney(chinaTransportCost) : "";

  // V6.8: old batches without explicit inland cost stay empty.
  // Do not show recovery warning because it is not reliable.
  if (document.getElementById("batchStatusText")) {
    document.getElementById("batchStatusText").textContent = "";
  }
  document.getElementById("batchPotCost").value =
    potCost ? formatMoney(potCost) : "";
  document.getElementById("batchCurrency").value = currency;
  document.getElementById("batchRate").value = formatMoney(effectiveRate);
  document.getElementById("batchContainerDate").value = containerDate;
  document.getElementById("batchArrivalDate").value = arrivalDate;
  document.getElementById("batchShippingMY").value =
    shippingMY ? formatMoney(shippingMY) : "";

  document.getElementById("batchOverseasTrackingNumber").value =
    overseasTrackingNumber;
  document.getElementById("batchContainerDatePicker").value =
    formatDDMMYYYYToNative(containerDate);
  document.getElementById("batchArrivalDatePicker").value =
    formatDDMMYYYYToNative(arrivalDate);
  batchArrivalAutoFilledByMYRV230 = false;

  document.getElementById("batchRows").innerHTML = "";
  batchRowSeq = 0;

  batchItems.forEach(item => {
    const originalQuantity = getLockedBatchOriginalQuantity(item);
    const storedRemainingQuantity = Number(
      item.remainingQuantity ?? item.quantity
    );
    const remainingQuantity = Number.isFinite(storedRemainingQuantity)
      ? Math.min(
          originalQuantity,
          Math.max(0, Math.floor(storedRemainingQuantity))
        )
      : originalQuantity;

    addBatchRow({
      name: item.productName || "",
      category: item.category || "盆栽",
      productId: item.productId || "",
      originalQuantity,
      remainingQuantity,
      // Historical original quantity is permanently locked on saved imports.
      // Sales/current-stock corrections only change remainingQuantity/Products.stock
      // through the dedicated stock quantity tool.
      quantity: originalQuantity,
      lockOriginalQuantity: true,
      unitPrice: Number(item.unitPrice) || 0,
      unitCost: Number(item.unitCost) || 0
    });
  });

  if (!batchItems.length) addBatchRow();

  calculateBatch();
  restoreStoredBatchRMDisplay(batch, batchItems);

  const currentStatus =
    document.getElementById("batchStatusText").textContent.trim();

  if (!currentStatus) {
    document.getElementById("batchStatusText").textContent =
      getCostRepairModeEnabled()
        ? `已载入进口编号 ${batch.importNumber}。Data Repair 已开启：只允许修改后续物流/马来西亚资料；内地核心资料仍锁定。`
        : `已载入进口编号 ${batch.importNumber}。此进口记录已锁定，只能阅读；原成本修正请使用下方专用入口。`;
  }

  input.value = batch.importNumber;
  setBatchEditMode(batch.importNumber);
  applyBatchCostEditability();
}



function showHistoryCopyToast(message) {
  let toast =
    document.getElementById("historyCopyToast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "historyCopyToast";
    toast.className = "history-copy-toast";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add("show");

  window.clearTimeout(
    window.historyCopyToastTimer
  );

  window.historyCopyToastTimer =
    window.setTimeout(() => {
      toast.classList.remove("show");
    }, 1800);
}

async function copyHistoryText(text, successMessage) {
  const value = String(text || "").trim();
  if (!value) return false;

  try {
    if (
      navigator.clipboard?.writeText &&
      window.isSecureContext
    ) {
      await navigator.clipboard.writeText(value);
    } else {
      const textarea =
        document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();

      const copied =
        document.execCommand("copy");
      textarea.remove();

      if (!copied) {
        throw new Error("Copy command failed");
      }
    }

    showHistoryCopyToast(successMessage);
    return true;
  } catch (error) {
    console.error("History copy failed:", error);
    showHistoryCopyToast("复制失败，请再试一次");
    return false;
  }
}

function showHistoryProductCopied(button, productName) {
  if (!button) return;

  const original = String(productName || button.dataset.historyProduct || button.textContent || "").trim();
  if (!original) return;

  button.textContent = "已复制";
  button.classList.add("copied");

  window.clearTimeout(button._historyCopyTimer);
  button._historyCopyTimer = window.setTimeout(() => {
    button.textContent = original;
    button.classList.remove("copied");
  }, 1200);
}

function buildProductIdCopyButtonV166(productId, extraClass = "") {
  const value = String(productId || "").trim();
  if (!value) return "";
  return `<button type="button"
                  class="product-id-copy-v166 ${escapeHTML(extraClass)}"
                  data-product-id-copy="${escapeHTML(value)}"
                  onclick="copyProductIdV166(this)"
                  title="点击复制产品编号">${escapeHTML(value)}</button>`;
}

async function copyProductIdV166(button) {
  const value = String(button?.dataset?.productIdCopy || "").trim();
  if (!value) return;
  const copied = await copyHistoryText(value, `✓ 已复制产品编号：${value}`);
  if (!copied || !button) return;
  button.classList.add("copied");
  window.clearTimeout(button._productIdCopyTimerV166);
  button._productIdCopyTimerV166 = window.setTimeout(() => button.classList.remove("copied"), 1200);
}

function buildHistoryProductNameButtons(productNames) {
  return Array.from(productNames || [])
    .map(name => {
      const value = String(name || "").trim();
      if (!value) return "";

      const matchedProduct = getProducts().find(product =>
        String(product?.name || "").trim().toLowerCase() === value.toLowerCase()
      );
      const matchedImport = !matchedProduct ? getImports().find(item =>
        String(item?.productName || item?.name || "").trim().toLowerCase() === value.toLowerCase()
      ) : null;
      const productId = String(matchedProduct?.id || matchedImport?.productId || "").trim();

      return `<span class="product-identity-v167 history-product-identity-v167">
        <button type="button"
                class="history-copy-product"
                data-history-product="${escapeHTML(value)}"
                title="点击复制并查询此产品">${escapeHTML(value)}</button>
        ${buildProductIdCopyButtonV166(productId, "history-product-id-v166")}
      </span>`;
    })
    .filter(Boolean)
    .join("");
}

function buildHistoryImportNumberButton(importNumber) {
  const value = String(importNumber || "").trim();

  if (!value) return "-";

  return `
    <button type="button"
            class="history-copy-import-number"
            data-history-import-number="${escapeHTML(value)}"
            title="点击复制进口编号">
      ${escapeHTML(value)}
    </button>
  `;
}

function clearHistoryPageView() {
  historyManualLookupReadyV246 = false;
  const input =
    document.getElementById("historyLookupInput");
  const startInput =
    document.getElementById("historyStartDateInput");
  const endInput =
    document.getElementById("historyEndDateInput");
  const startPicker =
    document.getElementById("historyStartDatePicker");
  const endPicker =
    document.getElementById("historyEndDatePicker");
  const output =
    document.getElementById("historyResult");

  if (input) {
    input.value = "";
    delete input.dataset.exactHistoryProduct;
  }

  [startInput, endInput].forEach(field => {
    if (!field) return;
    field.value = "";
    field.classList.remove("date-error");
  });

  if (startPicker) startPicker.value = "";
  if (endPicker) endPicker.value = "";

  if (output) {
    output.innerHTML =
      '<div class="empty-state">输入进口编号、海外运输单号 / 本地单号、产品名称、地点、人员，或选择日期范围查看历史资料</div>';
  }

  showHistoryCopyToast("已清空本页");
}

let historyManualLookupReadyV246 = false;

function setupImportHistory() {
  const input = document.getElementById("historyLookupInput");
  const button = document.getElementById("historyLookupBtn");
  const startInput =
    document.getElementById("historyStartDateInput");
  const startPicker =
    document.getElementById("historyStartDatePicker");
  const endInput =
    document.getElementById("historyEndDateInput");
  const endPicker =
    document.getElementById("historyEndDatePicker");
  const dateClearButton =
    document.getElementById("historyDateClearBtn");
  const clearPageButton =
    document.getElementById("historyClearPageBtn");
  const historyResult =
    document.getElementById("historyResult");

  let lastCompletedHistoryLookup = "";
  let historyLookupTimer = 0;

  const normalizeHistoryDateField = (
    textInput,
    picker
  ) => {
    if (!textInput) return "";

    const raw = String(textInput.value || "").trim();

    if (!raw) {
      if (picker) picker.value = "";
      textInput.classList.remove("date-error");
      return "";
    }

    const normalized =
      normalizeFlexibleDateInput(textInput);

    if (!normalized) return "";

    textInput.value = normalized;

    if (picker) {
      picker.value =
        formatDDMMYYYYToNative(normalized);
    }

    return normalized;
  };

  const runHistoryLookup = ({
    blurAfter = false
  } = {}) => {
    window.clearTimeout(historyLookupTimer);

    const keyword = String(input?.value || "").trim();
    const startDate = String(
      startInput?.value || ""
    ).trim();
    const endDate = String(
      endInput?.value || ""
    ).trim();

    if (!keyword && !startDate && !endDate) {
      renderImportHistory();
      return false;
    }

    const lookupKey = [
      keyword.toLowerCase(),
      startDate,
      endDate
    ].join("::");

    if (
      lookupKey === lastCompletedHistoryLookup &&
      document.activeElement !== input
    ) {
      return false;
    }

    lastCompletedHistoryLookup = lookupKey;
    historyManualLookupReadyV246 = true;
    renderImportHistory();

    if (blurAfter && document.activeElement === input) {
      input.blur();
    }

    return true;
  };

  const runDateLookup = (
    textInput,
    picker,
    { copyStartToEnd = false } = {}
  ) => {
    const normalized =
      normalizeHistoryDateField(textInput, picker);

    if (
      normalized &&
      copyStartToEnd &&
      endInput &&
      !String(endInput.value || "").trim()
    ) {
      // 只选第一个日期时，查询当天，不强制在画面填入结束日期。
    }

    lastCompletedHistoryLookup = "";
    historyManualLookupReadyV246 = true;
    renderImportHistory();
  };

  button?.addEventListener("click", () => {
    // V33.9: let the tap/typed text paint first, then run the existing local history scan.
    normalizeHistoryDateField(startInput, startPicker);
    normalizeHistoryDateField(endInput, endPicker);
    lastCompletedHistoryLookup = "";
    scheduleSearchRenderV302("history-lookup", runHistoryLookup, 0);
  });

  input?.addEventListener("input", () => {
    lastCompletedHistoryLookup = "";
    historyManualLookupReadyV246 = false;
    delete input.dataset.exactHistoryProduct;
  });

  input?.addEventListener("keydown", event => {
    if (event.key !== "Enter") return;

    event.preventDefault();
    event.stopPropagation();

    runHistoryLookup({
      blurAfter: true
    });
  });

  input?.addEventListener("change", () => {
    // V24.6: keep typed keyword only. Do not launch history scans automatically.
    lastCompletedHistoryLookup = "";
  });

  input?.addEventListener("blur", () => {
    // V24.6: leaving/switching pages must remain instant even when this field has text.
    window.clearTimeout(historyLookupTimer);
  });

  startPicker?.addEventListener("change", () => {
    startInput.value = formatNativeDateToDDMMYYYY(startPicker.value);
    startInput.classList.remove("date-error");
    lastCompletedHistoryLookup = "";
    historyManualLookupReadyV246 = true;
    // V33.9: let the date paint first; run the existing query only after the UI is free.
    scheduleSearchRenderV302("history-date", renderImportHistory, 60);
  });

  endPicker?.addEventListener("change", () => {
    endInput.value = formatNativeDateToDDMMYYYY(endPicker.value);
    endInput.classList.remove("date-error");
    lastCompletedHistoryLookup = "";
    historyManualLookupReadyV246 = true;
    scheduleSearchRenderV302("history-date", renderImportHistory, 60);
  });

  [
    [startInput, startPicker],
    [endInput, endPicker]
  ].forEach(([textInput, picker]) => {
    textInput?.addEventListener("input", () => {
      lastCompletedHistoryLookup = "";
    });

    textInput?.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;

      event.preventDefault();
      runDateLookup(textInput, picker);
      textInput.blur();
    });

    textInput?.addEventListener("blur", () => {
      runDateLookup(textInput, picker);
    });
  });

  dateClearButton?.addEventListener("click", () => {
    [startInput, endInput].forEach(field => {
      if (!field) return;
      field.value = "";
      field.classList.remove("date-error");
    });

    if (startPicker) startPicker.value = "";
    if (endPicker) endPicker.value = "";

    lastCompletedHistoryLookup = "";
    historyManualLookupReadyV246 = true;
    renderImportHistory();
  });

  clearPageButton?.addEventListener("click", () => {
    lastCompletedHistoryLookup = "";
    historyManualLookupReadyV246 = false;
    clearHistoryPageView();
  });

  historyResult?.addEventListener("click", async event => {
    const sourceButton = event.target.closest(".history-copy-source-v149");
    if (sourceButton) {
      const sourceName = String(sourceButton.dataset.historySource || "").trim();
      if (!sourceName) return;
      const copied = await copyHistoryText(sourceName, "✓ 已复制地点／人员");
      if (copied) showHistoryProductCopied(sourceButton, sourceName);
      return;
    }

    const productButton =
      event.target.closest(".history-copy-product");

    if (productButton) {
      const productName = String(
        productButton.dataset.historyProduct || ""
      ).trim();

      if (!productName) return;

      const copied = await copyHistoryText(
        productName,
        "✓ 已复制产品名称"
      );

      if (copied) {
        showHistoryProductCopied(productButton, productName);
      }

      if (
        productButton.dataset.historyCopyOnly === "true"
      ) {
        return;
      }

      input.value = productName;
      input.dataset.exactHistoryProduct = productName;
      lastCompletedHistoryLookup = "";
      historyManualLookupReadyV246 = true;
      renderImportHistory();
      return;
    }

    const importButton =
      event.target.closest(
        ".history-copy-import-number"
      );

    if (importButton) {
      const importNumber = String(
        importButton.dataset.historyImportNumber || ""
      ).trim();

      await copyHistoryText(
        importNumber,
        "✓ 已复制进口编号"
      );
    }
  });
}

function getHistoryItemQuantities(item) {
  const originalQuantity = Math.max(
    0,
    getSafeDisplayOriginalQuantity(item)
  );
  const storedRemainingQuantity = Number(
    item.remainingQuantity ?? item.quantity
  );
  const remainingQuantity = Number.isFinite(storedRemainingQuantity)
    ? Math.min(
        originalQuantity,
        Math.max(0, Math.floor(storedRemainingQuantity))
      )
    : originalQuantity;

  return {
    originalQuantity,
    remainingQuantity
  };
}

function findHistoryProductForItem(item, products = getProducts()) {
  const productId = String(item?.productId || "").trim();
  const productName = String(item?.productName || item?.name || "").trim().toLowerCase();
  return (products || []).find(product => {
    const sameId = productId && product?.id && String(product.id).trim() === productId;
    const sameName = !sameId && productName && String(product?.name || "").trim().toLowerCase() === productName;
    return sameId || sameName;
  }) || null;
}

function getHistoryProductCurrentStock(item, products = getProducts()) {
  const product = findHistoryProductForItem(item, products);
  return product ? Math.max(0, Math.floor(Number(product.stock) || 0)) : null;
}

function buildHistoryInventoryConsistencyWarning(item, imports = getImports(), products = getProducts()) {
  const product = findHistoryProductForItem(item, products);
  if (!product) return "";
  const productId = String(product.id || "").trim();
  const productName = String(product.name || "").trim().toLowerCase();
  const related = (imports || []).filter(record => {
    const sameId = productId && record?.productId && String(record.productId).trim() === productId;
    const sameName = !sameId && productName && String(record?.productName || record?.name || "").trim().toLowerCase() === productName;
    return sameId || sameName;
  });
  const importsRemaining = related.reduce((sum, record) => sum + getHistoryItemQuantities(record).remainingQuantity, 0);
  const productStock = Math.max(0, Math.floor(Number(product.stock) || 0));
  if (importsRemaining === productStock) return "";
  return `<div class="history-related-notice" style="border-color:#d97706;background:#fff7ed;color:#9a3412">
    <strong>⚠ 库存一致性警告</strong>
    <div>Products 当前库存 ${formatNumber(productStock)}，Imports 当前剩余合计 ${formatNumber(importsRemaining)}。</div>
    <div style="margin-top:8px">这是旧资料的批次剩余数量没有同步，不需要再次修改 Products 库存。</div>
    <button class="small-btn" type="button" style="margin-top:10px" onclick="repairInventoryConsistencyForProduct('${escapeHTML(productId)}')">修复库存一致性</button>
  </div>`;
}

function repairInventoryConsistencyForProduct(productId) {
  const id = String(productId || "").trim();
  const products = getProducts();
  const product = products.find(item => String(item.id || "").trim() === id);

  if (!product) {
    alert("找不到这个产品，无法修复库存一致性。");
    return;
  }

  const previousImports = getImports();
  const previousBatches = getBatches();
  const targetStock = Math.max(0, Math.floor(Number(product.stock) || 0));
  const productName = String(product.name || "").trim();
  const normalizedName = productName.toLowerCase();
  const relatedImports = previousImports.filter(record => {
    const sameId = id && record?.productId && String(record.productId).trim() === id;
    const sameName = !sameId && normalizedName && String(record?.productName || record?.name || "").trim().toLowerCase() === normalizedName;
    return sameId || sameName;
  });
  const beforeRemaining = relatedImports.reduce(
    (sum, record) => sum + getHistoryItemQuantities(record).remainingQuantity,
    0
  );

  if (beforeRemaining === targetStock) {
    alert(`库存已经一致。\n\nProducts：${formatNumber(targetStock)}\nImports：${formatNumber(beforeRemaining)}`);
    return;
  }

  const allocation = allocateProductRemainingFIFO(
    product.id,
    product.name,
    targetStock,
    "repair",
    "库存一致性修复"
  );

  if (!allocation.ok) {
    alert(allocation.message || "无法修复库存一致性。");
    return;
  }

  const afterRemaining = allocation.nextImports
    .filter(record => {
      const sameId = id && record?.productId && String(record.productId).trim() === id;
      const sameName = !sameId && normalizedName && String(record?.productName || record?.name || "").trim().toLowerCase() === normalizedName;
      return sameId || sameName;
    })
    .reduce((sum, record) => sum + getHistoryItemQuantities(record).remainingQuantity, 0);

  if (afterRemaining !== targetStock) {
    alert(
      `修复前检查失败，已停止。\n\nProducts：${formatNumber(targetStock)}\n修复后 Imports：${formatNumber(afterRemaining)}`
    );
    return;
  }

  const confirmed = window.confirm(
    `修复库存一致性？\n\n产品：${product.name}\nProducts 当前库存：${formatNumber(targetStock)}\nImports 当前剩余：${formatNumber(beforeRemaining)} → ${formatNumber(afterRemaining)}\n\n这次只修正 Imports / Batches 的当前剩余数量：\n• 不修改 Products.stock\n• 不修改库存总值\n• 不新增卖出记录\n• 不新增库存调整记录`
  );

  if (!confirmed) return;

  // V6.8: repair only the stale lot-level remaining quantities. Products is the truth
  // and remains untouched; no stock adjustment is created, so sales/history are not duplicated.
  localStorage.setItem("importSystemImports", JSON.stringify(allocation.nextImports));
  localStorage.setItem("importSystemBatches", JSON.stringify(allocation.nextBatches));

  if (typeof markCloudCollectionSaved === "function") {
    markCloudCollectionSaved("imports", previousImports, allocation.nextImports);
    markCloudCollectionSaved("batches", previousBatches, allocation.nextBatches);
  }

  renderBatchProductStockResults();
  renderInventoryManagementList();
  renderDashboard();
  renderBatchList();

  const historyButton = document.getElementById("historyLookupBtn");
  if (historyButton && String(document.getElementById("historyLookupInput")?.value || "").trim()) {
    window.setTimeout(() => historyButton.click(), 30);
  }

  alert(
    `库存一致性修复已完成。\n\n${product.name}\nProducts：${formatNumber(targetStock)}（没有改变）\nImports / Batches 当前剩余：${formatNumber(afterRemaining)}\n\n正在同步 Google Sheet。`
  );
}


function getHistorySalesOverrides() {
  const settings = loadJSON("importSystemSettings", {});
  return settings.historySalesOverrides && typeof settings.historySalesOverrides === "object"
    ? settings.historySalesOverrides : {};
}
function getHistoryAdjustmentKey(adjustment) {
  const id = String(adjustment?.id || "").trim();
  if (id) return id;
  return [
    String(adjustment?.productId || adjustment?.productName || "").trim().toLowerCase(),
    normalizeDateToDDMMYYYY(adjustment?.date || ""),
    String(adjustment?.createdAt || "").trim(),
    String(Math.trunc(Number(adjustment?.delta) || 0)),
    String(adjustment?.importNumber || "").trim().toLowerCase()
  ].join("|");
}
function getHistorySalesOverride(adjustment) {
  const entry = getHistorySalesOverrides()[getHistoryAdjustmentKey(adjustment)];
  const type = String(entry?.classification || "").trim().toLowerCase();
  return ["sale","repair"].includes(type) ? type : "";
}
function saveHistorySalesOverride(adjustment, classification) {
  const settings = loadJSON("importSystemSettings", {});
  const overrides = { ...(settings.historySalesOverrides || {}) };
  const key = getHistoryAdjustmentKey(adjustment);
  if (classification) {
    overrides[key] = {
      classification,
      confirmedAt: new Date().toISOString(),
      productId: adjustment.productId || "",
      productName: adjustment.productName || "",
      date: normalizeDateToDDMMYYYY(adjustment.date || ""),
      delta: Math.trunc(Number(adjustment.delta) || 0),
      importNumber: adjustment.importNumber || ""
    };
  } else {
    delete overrides[key];
  }
  saveJSON("importSystemSettings", {...settings, historySalesOverrides: overrides});
  if (typeof markCloudSettingsSaved === "function") markCloudSettingsSaved();
}
function isLegacyHistoryAdjustment(adjustment) {
  return !String(adjustment?.adjustmentType || adjustment?.type || "").trim();
}
function getLegacyHistoryNegativeAdjustments() {
  return getAllHistoryStockAdjustments()
    .filter(a => isLegacyHistoryAdjustment(a) && Math.trunc(Number(a?.delta)||0) < 0)
    .sort((a,b)=>String(b.createdAt||b.date||"").localeCompare(String(a.createdAt||a.date||"")));
}
function getAutoReversedLegacyKeys() {
  const all = getAllHistoryStockAdjustments()
    .filter(a => Math.trunc(Number(a?.delta)||0) !== 0)
    .slice()
    .sort((a,b)=>String(a.createdAt||a.date||"").localeCompare(String(b.createdAt||b.date||"")));
  const queues=new Map(), done=new Set();
  const keyOf=a=>[
    String(a.productId||a.productName||"").trim().toLowerCase(),
    String(a.importNumber||"").trim().toLowerCase()
  ].join("::");
  all.forEach(a=>{
    const d=Math.trunc(Number(a.delta)||0), k=keyOf(a);
    if(!queues.has(k)) queues.set(k,[]);
    const q=queues.get(k);
    if(d<0 && isLegacyHistoryAdjustment(a)){ q.push({a,remain:Math.abs(d)}); return; }
    if(d<=0) return;
    let plus=d;
    while(plus>0 && q.length){
      const lot=q[0], used=Math.min(plus,lot.remain);
      lot.remain-=used; plus-=used;
      if(lot.remain<=0){ done.add(getHistoryAdjustmentKey(lot.a)); q.shift(); }
    }
  });
  return done;
}
function renderHistoricalSalesRepairPanel() {
  const panel=document.getElementById("historySalesRepairPanel");
  const list=document.getElementById("historySalesRepairList");
  const summary=document.getElementById("historySalesRepairSummary");
  if(!panel||!list||!summary) return;
  const rows=getLegacyHistoryNegativeAdjustments();
  const overrides=getHistorySalesOverrides();
  const auto=getAutoReversedLegacyKeys();
  let pending=0,pendingQty=0,saleQty=0,repairQty=0;
  rows.forEach(a=>{
    const qty=Math.abs(Math.trunc(Number(a.delta)||0));
    const c=String(overrides[getHistoryAdjustmentKey(a)]?.classification||"");
    if(c==="sale") saleQty+=qty;
    else if(c==="repair") repairQty+=qty;
    else {pending++; pendingQty+=qty;}
  });
  const original=getImports().reduce((s,x)=>s+Math.max(0,Number(x.originalQuantity??x.quantity??x.stockAdded)||0),0);
  const stock=getProducts().reduce((s,x)=>s+Math.max(0,Number(x.stock)||0),0);
  summary.innerHTML=`
    <div><span>旧负数记录</span><strong>${rows.length} 笔</strong></div>
    <div><span>待确认</span><strong>${pending} 笔 / ${pendingQty} 棵</strong></div>
    <div><span>已确认卖出</span><strong>${saleQty} 棵</strong></div>
    <div><span>已确认修正</span><strong>${repairQty} 棵</strong></div>
    <div><span>History 净卖出</span><strong>${getHistorySoldQuantityTotal()} 棵</strong></div>
    <div><span>原进口－当前库存</span><strong>${Math.max(0,original-stock)} 棵</strong></div>`;
  list.innerHTML = rows.length ? rows.map(a=>{
    const k=getHistoryAdjustmentKey(a), c=String(overrides[k]?.classification||"");
    const suggested=!c && auto.has(k);
    const qty=Math.abs(Math.trunc(Number(a.delta)||0));
    const status=c==="sale"?"已确认：实际卖出":c==="repair"?"已确认：库存修正":suggested?"建议：后续正数已完全抵消":"待确认";
    return `<div class="history-sales-repair-row">
      <div class="history-sales-repair-info"><strong>${escapeHTML(a.productName||"未命名产品")}</strong>
      <span>${escapeHTML(normalizeDateToDDMMYYYY(a.date)||"-")} · ${escapeHTML(a.importNumber||"无进口编号")} · -${qty}</span><small>${escapeHTML(status)}</small></div>
      <div class="history-sales-repair-actions">
        <button type="button" data-hsr="sale" data-key="${escapeHTML(k)}" class="${c==="sale"?"active":""}">实际卖出</button>
        <button type="button" data-hsr="repair" data-key="${escapeHTML(k)}" class="${c==="repair"?"active":suggested?"suggested":""}">库存修正</button>
        ${c?`<button type="button" data-hsr="clear" data-key="${escapeHTML(k)}">清除确认</button>`:""}
      </div></div>`;
  }).join("") : `<div class="history-sales-repair-empty">没有需要审核的旧负数库存记录。</div>`;
}
function setupHistoricalSalesRepairTools() {
  const show=document.getElementById("showHistorySalesRepairBtn");
  const close=document.getElementById("closeHistorySalesRepairBtn");
  const panel=document.getElementById("historySalesRepairPanel");
  const list=document.getElementById("historySalesRepairList");
  const autoBtn=document.getElementById("autoRepairReversedHistoryBtn");
  if(!show||!panel||!list) return;
  show.addEventListener("click",()=>{panel.hidden=false;renderHistoricalSalesRepairPanel();panel.scrollIntoView({behavior:"smooth",block:"start"});});
  close?.addEventListener("click",()=>panel.hidden=true);
  list.addEventListener("click",e=>{
    const b=e.target.closest("[data-hsr]"); if(!b)return;
    const a=getLegacyHistoryNegativeAdjustments().find(x=>getHistoryAdjustmentKey(x)===(b.dataset.key||"")); if(!a)return;
    const action=b.dataset.hsr;
    if(action==="clear"){
      if(!confirm(`清除这笔旧记录的人工分类？\n\n${a.productName}\n${a.date} · ${a.delta}`))return;
      saveHistorySalesOverride(a,"");
    }else{
      const label=action==="sale"?"实际卖出":"库存修正";
      if(!confirm(`确认把这笔旧记录分类为「${label}」？\n\n${a.productName}\n${a.date} · ${a.delta}\n\n只修复历史统计，不会修改库存、Imports 或 Batches。`))return;
      saveHistorySalesOverride(a,action);
    }
    renderHistoricalSalesRepairPanel();
  });
  autoBtn?.addEventListener("click",()=>{
    const auto=getAutoReversedLegacyKeys(), overrides=getHistorySalesOverrides();
    const candidates=getLegacyHistoryNegativeAdjustments().filter(a=>auto.has(getHistoryAdjustmentKey(a))&&!overrides[getHistoryAdjustmentKey(a)]);
    if(!candidates.length){alert("没有找到可以安全自动识别的完整抵消旧记录。");return;}
    const qty=candidates.reduce((s,a)=>s+Math.abs(Math.trunc(Number(a.delta)||0)),0);
    if(!confirm(`自动把已完全抵消的旧记录标记为「库存修正」？\n\n${candidates.length} 笔，共 ${qty} 棵。\n\n不会改库存、Imports/Batches，也不会删除原记录。`))return;
    candidates.forEach(a=>saveHistorySalesOverride(a,"repair"));
    renderHistoricalSalesRepairPanel();
    alert(`完成：${candidates.length} 笔已标记为库存修正。`);
  });
}
function getHistoryAdjustmentType(adjustment) {
  const type = String(adjustment?.adjustmentType || adjustment?.type || "").trim().toLowerCase();
  if (["sale", "sold", "卖出"].includes(type)) return "sale";
  if (["repair", "correction", "修正", "historyquantityrepair"].includes(type)) return "repair";
  if (["modify", "adjustment", "修改"].includes(type)) return "modify";
  const override = getHistorySalesOverride(adjustment);
  if (override) return override;

  // V6.8 historical-sales rule:
  // legacy records without an explicit type are UNKNOWN, not sales.
  // They must be confirmed in Settings > Historical Sales Repair before they
  // can affect sold quantity / sold cost. This prevents old test entries,
  // stock corrections and naming repairs from inflating yearly sales totals.
  return "pending";
}

function getHistoryAdjustmentLabel(adjustment) {
  const type = getHistoryAdjustmentType(adjustment);
  const reason = String(adjustment?.reason || "").trim();
  if (type === "modify" && reason === "撤销销售") return "撤销销售";
  if (type === "sale") return "卖出";
  if (type === "repair") return "修正";
  if (type === "pending") return "旧记录待确认";
  return "修改";
}

function buildRelatedBatchNotices(batch, items) {
  const allBatches = getBatches();

  return items.map(item => {
    const productId = String(item.productId || "").trim();
    const productName = String(item.productName || "").trim();
    const productNameLower = productName.toLowerCase();
    const currentNumber = String(batch.importNumber || "").trim();
    const uniqueRelated = [];

    allBatches.forEach(otherBatch => {
      const otherNumber = String(otherBatch.importNumber || "").trim();
      if (!otherNumber || otherNumber === currentNumber) return;

      const matchingItems = getBatchItemsForDisplay(otherBatch).filter(otherItem => {
        const sameProductId =
          productId &&
          otherItem.productId &&
          String(otherItem.productId).trim() === productId;
        const sameProductName =
          String(otherItem.productName || "").trim().toLowerCase() ===
          productNameLower;

        return sameProductId || sameProductName;
      });

      matchingItems.forEach(otherItem => {
        const quantities = getHistoryItemQuantities(otherItem);
        uniqueRelated.push({
          importNumber: otherNumber,
          ...quantities
        });
      });
    });

    if (!uniqueRelated.length) return "";

    const currentQuantities = getHistoryItemQuantities(item);
    const totalRemaining = uniqueRelated.reduce(
      (sum, related) => sum + related.remainingQuantity,
      currentQuantities.remainingQuantity
    );

    const relatedRows = uniqueRelated.map(related => `
      <div class="history-related-batch">
        <strong>
          ${buildHistoryImportNumberButton(
            related.importNumber
          )}
        </strong>
        <span>原进口 ${formatNumber(related.originalQuantity)} · 当前剩余 ${formatNumber(related.remainingQuantity)}</span>
      </div>
    `).join("");

    return `
      <div class="history-related-notice">
        <div class="history-related-title">
          此产品还有 ${uniqueRelated.length} 个其他进口编号：${escapeHTML(productName || "未命名产品")}
        </div>
        ${relatedRows}
        <div class="history-related-total">目前同产品总库存：${formatNumber(totalRemaining)}</div>
      </div>
    `;
  }).filter(Boolean).join("");
}


function getHistoryCurrencyAndRate(batch, items = []) {
  const normalizedBatchId = String(batch?.id || "").trim();
  const normalizedImportNumber =
    String(batch?.importNumber || "").trim().toLowerCase();

  const matchingImports = getImports().filter(record => {
    const sameBatchId =
      normalizedBatchId &&
      String(record?.batchId || "").trim() === normalizedBatchId;

    const sameImportNumber =
      normalizedImportNumber &&
      String(record?.importNumber || "").trim().toLowerCase() ===
        normalizedImportNumber;

    return sameBatchId || sameImportNumber;
  });

  const importPrefix = String(batch?.importNumber || "")
    .trim()
    .toUpperCase()
    .match(/^(MYR|CNY|NTD|VND|IDR)/)?.[1] || "";

  const currencyCandidates = [
    batch?.currency,
    ...(items || []).map(item => item?.currency),
    ...matchingImports.map(record => record?.currency),
    importPrefix
  ];

  const currency =
    currencyCandidates
      .map(value => String(value || "").trim().toUpperCase())
      .find(value => ["MYR", "CNY", "NTD", "VND", "IDR"].includes(value)) ||
    "CNY";

  const rateCandidates = [
    batch?.rate,
    ...(items || []).map(item => item?.rate),
    ...matchingImports.map(record => record?.rate)
  ];

  const storedRate = rateCandidates
    .map(value => Number(value))
    .find(value => Number.isFinite(value) && value > 0);

  const rate =
    storedRate ||
    getDefaultExchangeRate(currency);

  return {
    currency,
    rate
  };
}

function buildImportHistoryCard(batch, items, options = {}) {
  const {
    showRelatedBatches = true
  } = options;
  const historyCurrencyRate =
    getHistoryCurrencyAndRate(batch, items);
  const currency = escapeHTML(historyCurrencyRate.currency);
  const exchangeRate = historyCurrencyRate.rate;
  const shippingRate = getBatchShippingRate(batch);

  const rows = items.map(item => {
    const {
      originalQuantity,
      remainingQuantity
    } = getHistoryItemQuantities(item);

    return `
      <tr>
        <td><span class="product-identity-v167 history-product-identity-v167">
          <button type="button"
                  class="history-copy-product history-copy-product-inline"
                  data-history-product="${escapeHTML(
                    item.productName || ""
                  )}"
                  data-history-copy-only="true"
                  title="点击复制产品名称">
            ${escapeHTML(item.productName || "-")}
          </button>
          ${buildProductIdCopyButtonV166(item.productId, "history-product-id-v166")}
        </span></td>
        <td>${escapeHTML(item.category || "-")}</td>
        <td>${formatNumber(originalQuantity)}</td>
        <td>${formatNumber(remainingQuantity)}</td>
        <td>${formatMoney(Number(item.unitPrice) || 0)} ${currency}</td>
        <td>${formatMoney(Number(item.unitCost) || 0, "RM ")}</td>
      </tr>`;
  }).join("");

  const relatedBatchNotices = showRelatedBatches
    ? buildRelatedBatchNotices(batch, items)
    : "";

  return `
    <article class="history-card">
      <div class="history-number">
        ${buildHistoryImportNumberButton(
          batch.importNumber
        )}
      </div>
      <div class="history-meta-grid">
        <div><span>装柜日期</span><strong>${escapeHTML(batch.containerDate || "-")}</strong></div>
        <div><span>抵达日期</span><strong>${escapeHTML(batch.arrivalDate || "-")}</strong></div>
        <div><span>货币 / 汇率</span><strong>${currency} / ${formatMoney(exchangeRate)}</strong></div>
        <div><span>海外运费比例</span><strong>${formatMoney(shippingRate)}%</strong></div>
        <div><span>海外运费</span><strong>${formatMoney(Number(batch.shippingMY) || 0, "RM ")}</strong></div>
        <div><span>整批原总成本</span><strong>${formatMoney(Number(batch.grandTotal) || 0, "RM ")}</strong></div>
        <div><span>内地运输＋木架</span><strong>${formatMoney(Number(batch.chinaTransportCost) || 0)} ${currency}</strong></div>
        <div><span>搭配花盆费用</span><strong>${formatMoney(Number(batch.potCost) || 0)} ${currency}</strong></div>
      </div>
      <div class="history-readonly-note">只读历史资料，不能编辑</div>
      <div class="history-table-wrap">
        <table class="history-table">
          <thead><tr><th>产品</th><th>类别</th><th>原进口</th><th>当前剩余</th><th>原单价</th><th>原每棵成本</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6">暂无产品资料</td></tr>'}</tbody>
        </table>
      </div>
      ${relatedBatchNotices}
    </article>`;
}


function historyProductMatchesKeyword(product, keyword) {
  if (!keyword) return true;

  const productId = String(product?.id || product?.productId || "").trim();
  const productName = String(product?.name || product?.productName || "").trim();
  const canonical = getProducts().find(candidate => {
    const candidateId = String(candidate?.id || "").trim();
    const candidateName = String(candidate?.name || "").trim();
    return (productId && candidateId === productId) ||
      (!productId && productName && candidateName === productName);
  });
  const englishName = canonical ? productEnglishNameV262(canonical) : "";

  const searchable = [
    productName,
    englishName,
    productId,
    product?.category
  ].map(value => String(value || "")).join(" ");

  if (isOriginalCostOnlySearchV218(keyword) && product && product.unitPrice !== undefined) {
    return originalCostMatchesBatchItemV216(product, keyword);
  }

  return productSearchMatchesV218(searchable, {
    id: productId,
    name: productName
  }, keyword);
}

function getDailyStockAdjustments(selectedDate, keyword = "") {
  const normalizedDate =
    normalizeDateToDDMMYYYY(selectedDate);

  // V19.8: restore the proven V15.0 date-query return contract.
  return getProducts()
    .flatMap(product =>
      getProductStockAdjustments(product)
        .filter(adjustment =>
          historyAdjustmentEventDateV134(adjustment) ===
          normalizedDate
        )
        .map(adjustment => {
          const transition = getProductTotalStockTransitionMap(product).get(String(adjustment?.id || ""));
          return {
            ...adjustment,
            productId: product.id || "",
            productName: product.name || "未命名产品",
            category: product.category || "盆栽",
            displayStockBefore: transition?.before,
            displayStockAfter: transition?.after
          };
        })
    )
    .filter(adjustment =>
      historyProductMatchesKeyword(adjustment, keyword)
    )
    .sort((a, b) =>
      String(a.createdAt || "").localeCompare(
        String(b.createdAt || "")
      )
    );
}

// V7.3 History display rule: "修改前 / 修改后" means the PRODUCT'S total stock,
// never the remaining quantity of only one import number. Existing V7.2-and-earlier
// records are reconstructed from the product's current stock + chronological deltas;
// new V7.3 records also persist productStockBefore/productStockAfter explicitly.
function getProductTotalStockTransitionMap(product) {
  const adjustments = getProductStockAdjustments(product)
    .slice()
    .sort((a, b) => {
      const timeA = Date.parse(String(a?.createdAt || ""));
      const timeB = Date.parse(String(b?.createdAt || ""));
      if (Number.isFinite(timeA) && Number.isFinite(timeB) && timeA !== timeB) return timeA - timeB;
      const dateA = parseDDMMYYYY(a?.date) || 0;
      const dateB = parseDDMMYYYY(b?.date) || 0;
      if (dateA !== dateB) return dateA - dateB;
      return String(a?.id || "").localeCompare(String(b?.id || ""));
    });

  const map = new Map();
  const totalDelta = adjustments.reduce((sum, item) => sum + Math.trunc(Number(item?.delta) || 0), 0);
  let runningStock = Math.max(0, Math.trunc(Number(product?.stock) || 0) - totalDelta);

  adjustments.forEach(item => {
    const explicitBefore = Number(item?.productStockBefore);
    const explicitAfter = Number(item?.productStockAfter);
    const hasExplicit = Number.isFinite(explicitBefore) && Number.isFinite(explicitAfter);
    const before = hasExplicit ? Math.max(0, Math.trunc(explicitBefore)) : runningStock;
    const after = hasExplicit
      ? Math.max(0, Math.trunc(explicitAfter))
      : Math.max(0, before + Math.trunc(Number(item?.delta) || 0));
    map.set(String(item?.id || ""), { before, after });
    runningStock = after;
  });

  return map;
}

function isInternalSystemAdjustmentNote(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  return /^system\s+auto\s+repair$/i.test(text);
}

// V11.4: History / 备注 UI only shows genuine user remarks.
// Legacy internal markers such as "System Auto Repair" remain stored untouched
// because they may describe historical repair provenance, but they are not user remarks.
function getUserVisibleAdjustmentNote(adjustment) {
  const remark = String(adjustment?.remark || "").trim();
  if (remark && !isInternalSystemAdjustmentNote(remark)) return cleanHistoryAdjustmentNoteV131(remark);

  const note = String(adjustment?.note || "").trim();
  if (note && !isInternalSystemAdjustmentNote(note)) return cleanHistoryAdjustmentNoteV131(note);

  return "";
}

function normalizeHistorySalesSourceV149(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^(fair|sales|live)\s*[·•:：-]\s*/i, "")
    .replace(/[·•:：–—-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getHistorySalesSourceV149(adjustment) {
  const link = historyAdjustmentSaleLinkV134(adjustment) || {};
  const direct = [link.location, link.host, link.fairLocation]
    .map(value => String(value || "").trim())
    .find(Boolean);
  if (direct) return direct.replace(/^(fair|sales|live)\s*[·•:：-]\s*/i, "").trim();

  const source = String(link.source || "").trim();
  if (source && !/^(fair|sales|live)$/i.test(source)) {
    return source.replace(/^(fair|sales|live)\s*[·•:：-]\s*/i, "").trim();
  }

  const note = getUserVisibleAdjustmentNote(adjustment);
  const matched = note.match(/^(?:fair|sales|live)\s*[·•:：-]\s*(.+)$/i);
  return String(matched?.[1] || "").trim();
}

function historyAdjustmentMatchesSourceV149(adjustment, sourceKeyword) {
  const query = normalizeHistorySalesSourceV149(sourceKeyword);
  const source = normalizeHistorySalesSourceV149(getHistorySalesSourceV149(adjustment));
  return Boolean(query && source && (source.includes(query) || query.includes(source)));
}

function getHistorySalesSourceDisplayV149(adjustment) {
  const source = getHistorySalesSourceV149(adjustment);
  if (!source) return "";
  const visibleNote = getUserVisibleAdjustmentNote(adjustment);
  if (/^(fair|sales|live)\s*[·•:：-]\s*.+$/i.test(visibleNote)) return visibleNote;
  const link = historyAdjustmentSaleLinkV134(adjustment) || {};
  const type = String(link.type || link.channel || link.source || "").trim().toLowerCase();
  const channel = type === "fair" ? "Fair" : type === "live" ? "Live" : "Sales";
  return `${channel} · ${source}`;
}

function buildHistoryAdjustmentNoteContentV149(adjustment) {
  const source = getHistorySalesSourceV149(adjustment);
  if (getHistoryAdjustmentType(adjustment) === "sale" && source) {
    const display = getHistorySalesSourceDisplayV149(adjustment) || source;
    return `<strong>备注：</strong><button type="button" class="history-copy-source-v149" data-history-source="${escapeHTML(source)}" title="点击复制地点或人员名称">${escapeHTML(display)}</button>`;
  }
  return `<strong>备注：</strong>${escapeHTML(getUserVisibleAdjustmentNote(adjustment) || "—")}`;
}

// V13.7: History owns the date/time column. Remove duplicated date/time text
// from remarks while preserving the source, location and operator explanation.
function cleanHistoryAdjustmentNoteV131(value) {
  return String(value || "")
    .replace(/\s*·\s*\d{2}-\d{2}-\d{4}(?:\s+\d{2}:\d{2}(?::\d{2})?)?(?=\s*·|$)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function historyAdjustmentTimeV131(adjustment) {
  const links = Array.isArray(adjustment?.salesLinks) ? adjustment.salesLinks : [];
  const saleTime = links.map(link => String(link?.saleTime || "").trim()).find(Boolean) || "";
  const direct = saleTime.match(/\b(\d{2}:\d{2})(?::\d{2})?\b/);
  if (direct) return direct[1];
  const created = new Date(String(adjustment?.createdAt || ""));
  if (!Number.isFinite(created.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("en-GB", {timeZone:"Asia/Kuala_Lumpur",hour:"2-digit",minute:"2-digit",hour12:false}).format(created);
  } catch (_) {
    return `${String(created.getHours()).padStart(2,"0")}:${String(created.getMinutes()).padStart(2,"0")}`;
  }
}

function historyAdjustmentSaleLinkV134(adjustment) {
  const links = Array.isArray(adjustment?.salesLinks) ? adjustment.salesLinks : [];
  return links.find(link => String(link?.saleDate || link?.linkId || "").trim()) || null;
}

// V13.7: a Sales stock movement belongs to the Sales-card date, not the later
// date on which Import processed the inventory deduction.
function historyAdjustmentEventDateV134(adjustment) {
  if (getHistoryAdjustmentType(adjustment) === "sale") {
    const saleDate = normalizeDateToDDMMYYYY(historyAdjustmentSaleLinkV134(adjustment)?.saleDate || "");
    if (saleDate) return saleDate;
  }
  return normalizeDateToDDMMYYYY(adjustment?.date || "") || String(adjustment?.date || "");
}

function historyAdjustmentDateTimeV131(adjustment) {
  const date = historyAdjustmentEventDateV134(adjustment) || "-";
  const time = historyAdjustmentTimeV131(adjustment);
  return time ? `${date} ${time}` : date;
}

function historySalesContextKeyV134(type, date, location) {
  return [String(type || "").toLowerCase(), normalizeDateToDDMMYYYY(date), String(location || "").trim().toLowerCase()].join("|");
}

function slimHistorySalesLinkV179(link) {
  return {
    linkId:String(link?.linkId||""), quantity:Number(link?.quantity||0),
    averageCost:Number(link?.averageCost), localDelivery:Number(link?.localDelivery),
    extraFee:Number(link?.extraFee), commissionAmount:Number(link?.commissionAmount),
    actualPrice:Number(link?.actualPrice), profit:Number(link?.profit),
    profitRate:Number(link?.profitRate), productId:String(link?.productId||""),
    productName:String(link?.productName||""), transactionId:String(link?.transactionId||link?.saleId||""),
    saleId:String(link?.saleId||link?.transactionId||""), type:String(link?.type||""),
    date:String(link?.date||""), location:String(link?.location||""),
    importSyncStatus:String(link?.importSyncStatus||"")
  };
}

function hydrateHistorySalesCacheV179() {
  if (historySalesCacheHydratedV179) return historySalesCacheHasDataV179;
  historySalesCacheHydratedV179 = true;
  try {
    const cached=JSON.parse(localStorage.getItem(HISTORY_SALES_CACHE_KEY_V179)||"null");
    const links=Array.isArray(cached?.links)?cached.links:[];
    links.forEach(link=>{const id=String(link?.linkId||"").trim();if(id)historySalesDetailsByLinkV134.set(id,link)});
    historySalesCacheHasDataV179=links.length>0;
  } catch (_) { historySalesCacheHasDataV179=false; }
  return historySalesCacheHasDataV179;
}

function persistHistorySalesCacheV179(links) {
  const clean=(Array.isArray(links)?links:[]).map(slimHistorySalesLinkV179).filter(link=>link.linkId);
  try { localStorage.setItem(HISTORY_SALES_CACHE_KEY_V179,JSON.stringify({savedAt:Date.now(),links:clean})); } catch (_) {}
  historySalesCacheHydratedV179=true;historySalesCacheHasDataV179=clean.length>0;
}

function callHistorySalesProductLinksV134(context) {
  return new Promise((resolve, reject) => {
    const callbackName = `loverLegendHistoryLinksV134_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    let finished = false;
    const cleanup = () => { if (finished) return; finished = true; window.clearTimeout(timeoutId); try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; } script.remove(); };
    window[callbackName] = data => { cleanup(); data?.ok ? resolve(Array.isArray(data.links) ? data.links : []) : reject(new Error(data?.error || "读取销售卡失败")); };
    const params = new URLSearchParams({action:"getSalesProductLinks",callback:callbackName,type:context.type,date:context.date,location:context.location,_:String(Date.now())});
    script.src = `${SALES_INVENTORY_FEED_URL_V77}?${params.toString()}`;
    script.async = true;
    script.onerror = () => { cleanup(); reject(new Error("无法读取销售卡")); };
    const timeoutId = window.setTimeout(() => { cleanup(); reject(new Error("读取销售卡超时")); }, 12000);
    document.head.appendChild(script);
  });
}

async function ensureHistorySalesContextV134(context) {
  const key = historySalesContextKeyV134(context.type, context.date, context.location);
  if (historySalesContextLoadedV134.has(key)) return;
  if (historySalesContextLoadingV134.has(key)) return historySalesContextLoadingV134.get(key);
  const request = callHistorySalesProductLinksV134(context).then(links => {
    links.forEach(link => { const id = String(link?.linkId || "").trim(); if (id) historySalesDetailsByLinkV134.set(id, link); });
    historySalesContextLoadedV134.add(key);
  }).catch(() => {}).finally(() => historySalesContextLoadingV134.delete(key));
  historySalesContextLoadingV134.set(key, request);
  return request;
}

async function ensureVisibleHistorySalesDetailsV134() {
  hydrateHistorySalesCacheV179();
  if (!navigator.onLine || historyAllSalesLinksLoadedV136) return;
  if (historyAllSalesLinksLoadingV136) return historyAllSalesLinksLoadingV136;
  historyAllSalesLinksLoadingV136 = new Promise((resolve, reject) => {
    const callbackName = `loverLegendAllHistoryLinksV136_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    let finished = false;
    const cleanup = () => { if (finished) return; finished = true; window.clearTimeout(timeoutId); try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; } script.remove(); };
    window[callbackName] = data => {
      cleanup();
      if (!data?.ok) { reject(new Error(data?.error || "读取完整销售卡失败")); return; }
      const links=Array.isArray(data.links) ? data.links : [];
      links.forEach(link => {
        const id = String(link?.linkId || "").trim();
        if (id) historySalesDetailsByLinkV134.set(id, link);
      });
      persistHistorySalesCacheV179(links);
      historyAllSalesLinksLoadedV136 = true;
      resolve();
    };
    const params = new URLSearchParams({action:"getAllSalesProductLinks",callback:callbackName,_:String(Date.now())});
    script.src = `${SALES_INVENTORY_FEED_URL_V77}?${params.toString()}`;
    script.async = true;
    script.onerror = () => { cleanup(); reject(new Error("无法读取完整销售卡")); };
    const timeoutId = window.setTimeout(() => { cleanup(); reject(new Error("读取完整销售卡超时")); }, 18000);
    document.head.appendChild(script);
  }).catch(() => {}).finally(() => { historyAllSalesLinksLoadingV136 = null; });
  return historyAllSalesLinksLoadingV136;
}

function buildHistorySalesFinancialHtmlV134(adjustment) {
  if (getHistoryAdjustmentType(adjustment) !== "sale") return "";
  const link = historyAdjustmentSaleLinkV134(adjustment);
  const linkId = String(link?.linkId || "").trim();
  if (!linkId) {
    return `<div class="history-sales-financial-v134 history-sales-financial-unavailable-v182">旧记录无销售卡金额资料</div>`;
  }
  const detail = historySalesDetailsByLinkV134.get(linkId) || link;
  const quantity = Math.max(1, Number(detail?.quantity || link?.processedQty || Math.abs(Number(adjustment?.delta) || 0)) || 1);
  const averageCost = Number(detail?.averageCost), delivery = Number(detail?.localDelivery), extra = Number(detail?.extraFee), commission = Number(detail?.commissionAmount);
  const saleAmount = Number(detail?.actualPrice), profit = Number(detail?.profit), profitRate = Number(detail?.profitRate);
  if (![averageCost, delivery, extra, commission, saleAmount, profit, profitRate].every(Number.isFinite)) {
    if (historyAllSalesLinksLoadedV136) {
      return `<div class="history-sales-financial-v134 history-sales-financial-unavailable-v182">旧记录无销售卡金额资料</div>`;
    }
    return `<div class="history-sales-financial-v134 history-sales-financial-loading-v179">销售金额／成本／利润读取中…</div>`;
  }
  const totalCost = averageCost * quantity + delivery + extra + commission;
  const profitRateText = (Number(profitRate) || 0).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `<div class="history-sales-financial-v134"><span>总成本：<strong>${formatMoney(totalCost, "RM ")}</strong></span><span>售价：<strong>${formatMoney(saleAmount, "RM ")}</strong></span><span>利润：<strong>${formatMoney(profit, "RM ")}</strong></span><span>利润率：<strong>${profitRateText}%</strong></span></div>`;
}

function buildHistoryAdjustmentMetaV173(adjustment, fallbackImportNumber = "") {
  const pickStockValue = keys => {
    for (const key of keys) {
      const raw = adjustment?.[key];
      if (raw === null || raw === undefined || raw === "") continue;
      const value = Number(raw);
      if (Number.isFinite(value)) return formatNumber(value);
    }
    return "—";
  };

  const beforeText = pickStockValue(["displayStockBefore", "productStockBefore", "before"]);
  const afterText = pickStockValue(["displayStockAfter", "productStockAfter", "after"]);
  const importNumber = String(adjustment?.importNumber || fallbackImportNumber || "").trim();
  const importNumberHtml = importNumber
    ? buildHistoryImportNumberButton(importNumber)
    : "—";

  return `<div class="history-adjustment-meta history-adjustment-meta-v173"><span>修改前：${beforeText}</span><span>修改后：${afterText}</span><span>进口编号：${importNumberHtml}</span></div>`;
}

function buildDailyStockAdjustmentHtml(adjustments) {
  if (!adjustments.length) {
    return `
      <div class="history-day-empty">
        当天没有符合的库存进出记录
      </div>
    `;
  }

  return adjustments.map(adjustment => {
    const delta = Math.trunc(Number(adjustment.delta) || 0);
    const action = getHistoryAdjustmentLabel(adjustment);
    const deltaText = delta > 0 ? `+${delta}` : String(delta);
    const note = getUserVisibleAdjustmentNote(adjustment);

    return `
      <article class="history-adjustment-card ${delta < 0 ? "out" : "in"}">
        <div class="history-record-main-v170">
          <strong class="product-history-adjustment-date">${escapeHTML(historyAdjustmentDateTimeV131(adjustment))}</strong>
          <span class="product-identity-v167 history-product-identity-v167"><button type="button"
                  class="history-copy-product history-copy-product-inline"
                  data-history-product="${escapeHTML(
                    adjustment.productName || "未命名产品"
                  )}"
                  data-history-copy-only="true"
                  title="点击复制产品名称">
            ${escapeHTML(
              adjustment.productName || "未命名产品"
            )}
          </button>
          ${buildProductIdCopyButtonV166(adjustment.productId, "history-product-id-v166")}
          </span>
          <span class="product-history-adjustment-action">${escapeHTML(action)}</span>
          <strong class="product-history-adjustment-quantity ${delta < 0 ? "is-negative-v170" : "is-positive-v170"}">${escapeHTML(deltaText)}</strong>
        </div>

        ${buildHistorySalesFinancialHtmlV134(adjustment)}

        <div class="history-adjustment-note">${buildHistoryAdjustmentNoteContentV149(adjustment)}</div>

        ${buildHistoryAdjustmentMetaV173(adjustment)}
      </article>
    `;
  }).join("");
}

function getHistoryDateRange(startValue, endValue) {
  const startDate =
    normalizeDateToDDMMYYYY(startValue);
  const endDate =
    normalizeDateToDDMMYYYY(endValue);

  if (!startDate && !endDate) {
    return null;
  }

  // 只填写一个日期时，就查询该日期。
  const effectiveStart = startDate || endDate;
  const effectiveEnd = endDate || startDate;

  const startTime = parseDDMMYYYY(effectiveStart);
  const endTime = parseDDMMYYYY(effectiveEnd);

  if (!startTime || !endTime) {
    return {
      error: "请选择正确的日期"
    };
  }

  if (startTime > endTime) {
    return {
      error: "开始日期不能迟于结束日期"
    };
  }

  return {
    startDate: effectiveStart,
    endDate: effectiveEnd,
    startTime,
    endTime,
    isSingleDay: startTime === endTime
  };
}

function isDateWithinHistoryRange(
  value,
  range
) {
  const time = parseDDMMYYYY(
    normalizeDateToDDMMYYYY(value)
  );

  return Boolean(
    time &&
    time >= range.startTime &&
    time <= range.endTime
  );
}

function getHistoryRangeDates(range) {
  const dates = [];
  const current = new Date(range.startTime);
  const end = range.endTime;

  while (current.getTime() <= end) {
    dates.push(formatDateDDMMYYYY(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

let historyProductLookupCacheV322 = { raw: null, byId: new Map(), byName: new Map() };
let historyAdjustmentCacheV322 = { raw: null, rows: [] };
function getHistoryProductLookupV322() {
  const raw = localStorage.getItem("importSystemProducts") || "[]";
  if (historyProductLookupCacheV322.raw === raw) return historyProductLookupCacheV322;
  const products = getProducts();
  const byId = new Map(), byName = new Map();
  products.forEach(product => {
    const id = String(product?.id || "").trim();
    const name = String(product?.name || "").trim().toLowerCase();
    if (id) byId.set(id, product);
    if (name) byName.set(name, product);
  });
  historyProductLookupCacheV322 = { raw, byId, byName };
  return historyProductLookupCacheV322;
}
function getTrustedHistoryUnitCost(item) {
  const productId = String(item?.productId || "").trim();
  const productName = String(item?.productName || item?.name || "").trim().toLowerCase();
  const lookup = getHistoryProductLookupV322();
  const product = lookup.byId.get(productId) || lookup.byName.get(productName);
  const averageCost = Number(product?.averageCost);
  const validAverage = Number.isFinite(averageCost) && averageCost > 0;

  const directCost = Number(item?.unitCost);
  if (Number.isFinite(directCost) && directCost > 0 && (!validAverage || directCost <= averageCost * 10)) {
    return directCost;
  }
  return validAverage ? averageCost : (Number.isFinite(directCost) && directCost > 0 ? directCost : 0);
}

function getHistorySoldAdjustmentUnitCost(adjustment) {
  // V6.8: new sale records lock the unit cost at the moment of sale.
  const locked = Number(adjustment?.soldUnitCost);
  if (Number.isFinite(locked) && locked > 0) return locked;

  const productId = String(adjustment?.productId || "").trim();
  const productName = String(adjustment?.productName || "").trim().toLowerCase();
  const lookup = getHistoryProductLookupV322();
  const product = lookup.byId.get(productId) || lookup.byName.get(productName);
  const productAverage = Number(product?.averageCost);
  const validAverage = Number.isFinite(productAverage) && productAverage > 0;

  const importNumber = String(adjustment?.importNumber || "").trim();
  if (importNumber) {
    const record = getImports().find(candidate => {
      const sameImport = String(candidate.importNumber || "").trim().toLowerCase() === importNumber.toLowerCase();
      const sameId = productId && String(candidate.productId || "").trim() === productId;
      const sameName = productName && String(candidate.productName || candidate.name || "").trim().toLowerCase() === productName;
      return sameImport && (sameId || sameName);
    });
    const importCost = Number(record?.unitCost);
    if (Number.isFinite(importCost) && importCost > 0 && (!validAverage || importCost <= productAverage * 10)) {
      return importCost;
    }
  }

  // Legacy records may contain a mis-mapped batch field (e.g. Excel date serial 46211).
  // Products.averageCost is safer than displaying a clearly impossible historical cost.
  return validAverage ? productAverage : 0;
}

function getAllHistoryStockAdjustments() {
  const raw = localStorage.getItem("importSystemProducts") || "[]";
  if (historyAdjustmentCacheV322.raw === raw) return historyAdjustmentCacheV322.rows;
  const rows = getProducts().flatMap(product =>
    getProductStockAdjustments(product).map(adjustment => ({
      ...adjustment,
      productId: product.id || adjustment.productId || "",
      productName: product.name || adjustment.productName || "未命名产品",
      category: product.category || adjustment.category || "盆栽"
    }))
  );
  historyAdjustmentCacheV322 = { raw, rows };
  return rows;
}

function getHistoryRelevantAdjustments(options = {}) {
  const {
    range = null,
    keyword = "",
    exactProduct = "",
    productId = "",
    importNumber = ""
  } = options;

  const normalizedKeyword = String(keyword || "").trim();
  const normalizedProductId = String(productId || "").trim().toLowerCase();
  const normalizedExactProduct =
    String(exactProduct || "").trim().toLowerCase();
  const normalizedImportNumber =
    String(importNumber || "").trim().toLowerCase();

  return getAllHistoryStockAdjustments().filter(adjustment => {
    if (
      range &&
      !range.error &&
      !isDateWithinHistoryRange(historyAdjustmentEventDateV134(adjustment), range)
    ) {
      return false;
    }

    if (normalizedImportNumber) {
      return String(adjustment.importNumber || "")
        .trim()
        .toLowerCase() === normalizedImportNumber;
    }

    if (normalizedProductId) {
      return String(adjustment.productId || "")
        .trim()
        .toLowerCase() === normalizedProductId;
    }

    if (normalizedExactProduct) {
      return String(adjustment.productName || "")
        .trim()
        .toLowerCase() === normalizedExactProduct;
    }

    if (normalizedKeyword) {
      const productMatch = historyProductMatchesKeyword(
        adjustment,
        normalizedKeyword
      );
      const importMatch = !isOriginalCostOnlySearchV218(normalizedKeyword) && sequentialSearchMatches(
        adjustment.importNumber,
        normalizedKeyword
      );
      return productMatch || importMatch;
    }

    return true;
  });
}

function getHistoryNetSoldLots(options = {}) {
  // V6.8: first resolve sale/correction pairs against COMPLETE history, then apply
  // the selected date range to the surviving real-sale events. This prevents a
  // correction outside the selected range from making a historical period wrong.
  // Keep non-sale negative repairs and ordinary positive stock changes out of
  // sales totals. Only a linked Sales restore can reverse a confirmed sale.
  const { range = null, source = "", ...lookupOptions } = options;
  const hasExplicitRestoreLink = adjustment =>
    (Array.isArray(adjustment?.salesLinks) ? adjustment.salesLinks : [])
      .some(link => String(link?.correctionAction || "").toLowerCase() === "restore");
  // V19.8: old/manual stock repairs do not always carry a Sales restore link.
  // Treat only an explicitly worded replenishment/cancellation as a reversal;
  // an ordinary positive import or stock increase must never reduce sales.
  const isExplicitManualRestoreV180 = adjustment => {
    const type = getHistoryAdjustmentType(adjustment);
    if (type !== "modify" && type !== "repair") return false;
    const description = [
      adjustment?.reason,
      adjustment?.note,
      adjustment?.remark,
      adjustment?.remarks,
      adjustment?.description
    ].map(value => String(value || "").trim()).filter(Boolean).join(" ");
    return /(?:补回|补还|恢复|还原|撤销|取消|冲销|回补|退回|纠正|更正).{0,12}(?:数量|库存|销售|卖出)?|(?:数量|库存|销售|卖出).{0,12}(?:补回|补还|恢复|还原|撤销|取消|冲销|回补|退回|纠正|更正)/i.test(description);
  };
  const relevant = getHistoryRelevantAdjustments(lookupOptions)
    .filter(adjustment => {
      const delta = Math.trunc(Number(adjustment?.delta) || 0);
      const type = getHistoryAdjustmentType(adjustment);
      // Only confirmed/typed sales enter the sales queue. Legacy unclassified
      // negatives are excluded. Likewise, an unclassified legacy positive must
      // not silently reverse a confirmed sale.
      // V19.8: retain positive changes only as possible reversals. Explicit
      // Sales restores are linked; an unlinked positive may cancel only one
      // recent, exact opposite legacy/test entry below.
      return (delta < 0 && type === "sale") ||
        (delta > 0 && (hasExplicitRestoreLink(adjustment) || type === "modify" || type === "repair"));
    })
    .slice()
    .sort((a, b) => {
      const createdCompare = String(a.createdAt || "")
        .localeCompare(String(b.createdAt || ""));
      if (createdCompare) return createdCompare;

      return String(a.date || "")
        .localeCompare(String(b.date || ""));
    });

  const queues = new Map();
  const unmatchedRestoreCredits = new Map();

  const baseGroupKey = adjustment => [
    String(adjustment.productId || adjustment.productName || "").trim().toLowerCase(),
    String(adjustment.importNumber || "").trim().toLowerCase()
  ].join("::");

  const groupKey = adjustment => {
    const links=Array.isArray(adjustment?.salesLinks)?adjustment.salesLinks:[];
    const exactLink=String(links[0]?.linkId||links[0]?.accountingKey||"").trim().toLowerCase();
    return [
      String(adjustment.productId || adjustment.productName || "").trim().toLowerCase(),
      String(adjustment.importNumber || "").trim().toLowerCase(),
      exactLink||"legacy"
    ].join("::");
  };

  relevant.forEach(adjustment => {
    const delta = Math.trunc(Number(adjustment.delta) || 0);
    if (delta === 0) return;

    // A manual replenishment normally has no Sales link, while the sale being
    // corrected does. Resolve it across every Sales-link queue for the same
    // product/import and consume the most recent outstanding lot(s).
    if (delta > 0 && !hasExplicitRestoreLink(adjustment) && isExplicitManualRestoreV180(adjustment)) {
      let quantityToReverse = delta;
      const baseKey = baseGroupKey(adjustment);
      const candidates = Array.from(queues.entries())
        .filter(([candidateKey]) => candidateKey.startsWith(`${baseKey}::`))
        .flatMap(([candidateKey, candidateQueue]) => candidateQueue.map((lot, lotIndex) => ({candidateKey, candidateQueue, lot, lotIndex})))
        .filter(candidate => candidate.lot.remainingQuantity > 0)
        .sort((a, b) => String(b.lot.adjustment?.createdAt || b.lot.adjustment?.date || "")
          .localeCompare(String(a.lot.adjustment?.createdAt || a.lot.adjustment?.date || "")));
      for (const candidate of candidates) {
        if (quantityToReverse <= 0) break;
        const reversed = Math.min(quantityToReverse, candidate.lot.remainingQuantity);
        candidate.lot.remainingQuantity -= reversed;
        quantityToReverse -= reversed;
      }
      queues.forEach((candidateQueue, candidateKey) => {
        queues.set(candidateKey, candidateQueue.filter(lot => lot.remainingQuantity > 0));
      });
      return;
    }

    const key = groupKey(adjustment);
    if (!queues.has(key)) queues.set(key, []);
    const queue = queues.get(key);

    if (delta < 0) {
      let remainingSale=Math.abs(delta);
      const credit=Math.max(0,Number(unmatchedRestoreCredits.get(key))||0);
      if(credit>0){const used=Math.min(credit,remainingSale);remainingSale-=used;unmatchedRestoreCredits.set(key,credit-used);}
      if(remainingSale>0)queue.push({
        adjustment,
        remainingQuantity: remainingSale,
        unitCost: getHistorySoldAdjustmentUnitCost(adjustment)
      });
      return;
    }

    // A linked Sales restore reverses its matching queue normally.
    if (!hasExplicitRestoreLink(adjustment) && !isExplicitManualRestoreV180(adjustment)) {
      // V19.8: an unlinked +N is a test/manual undo only when it exactly
      // matches one immediately preceding -N for the same product/import and
      // occurs within 15 minutes. It must never consume unrelated sales FIFO.
      const positiveTime = Date.parse(String(adjustment.createdAt || ""));
      let exactIndex = -1;
      for (let index = queue.length - 1; index >= 0; index -= 1) {
        const lot = queue[index];
        const negativeTime = Date.parse(String(lot.adjustment?.createdAt || ""));
        const closeInTime = Number.isFinite(positiveTime) && Number.isFinite(negativeTime) &&
          positiveTime >= negativeTime && positiveTime - negativeTime <= 15 * 60 * 1000;
        if (closeInTime && Number(lot.remainingQuantity) === delta) {
          exactIndex = index;
          break;
        }
      }
      if (exactIndex >= 0) queue.splice(exactIndex, 1);
      return;
    }

    // A later explicitly linked restore reverses earlier negative records.
    let quantityToReverse = delta;

    while (quantityToReverse > 0 && queue.length) {
      const lot = queue[0];
      const reversed = Math.min(
        quantityToReverse,
        lot.remainingQuantity
      );

      lot.remainingQuantity -= reversed;
      quantityToReverse -= reversed;

      if (lot.remainingQuantity <= 0) {
        queue.shift();
      }
    }
    // A linked restore can arrive before its sale during legacy timestamp
    // sorting; carry only that explicit restore, never a normal stock increase.
    if(quantityToReverse>0 && hasExplicitRestoreLink(adjustment))unmatchedRestoreCredits.set(key,(Number(unmatchedRestoreCredits.get(key))||0)+quantityToReverse);
  });

  return Array.from(queues.values())
    .flat()
    .filter(lot => lot.remainingQuantity > 0)
    .filter(lot => {
      if (!range || range.error) return true;
      return isDateWithinHistoryRange(historyAdjustmentEventDateV134(lot.adjustment), range);
    })
    .filter(lot => !source || historyAdjustmentMatchesSourceV149(lot.adjustment, source));
}

function getHistorySoldAdjustments(options = {}) {
  return getHistoryNetSoldLots(options).map(lot => ({
    ...lot.adjustment,
    delta: -lot.remainingQuantity
  }));
}

function getHistorySoldCostTotal(options = {}) {
  return getHistoryNetSoldLots(options).reduce((sum, lot) => {
    return sum +
      (lot.remainingQuantity * (Number(lot.unitCost) || 0));
  }, 0);
}

function getHistorySoldQuantityTotal(options = {}) {
  return getHistoryNetSoldLots(options).reduce((sum, lot) => {
    return sum + (Number(lot.remainingQuantity) || 0);
  }, 0);
}

function getHistorySalesLinkForAdjustmentV137(adjustment, allAdjustments) {
  const direct = historyAdjustmentSaleLinkV134(adjustment);
  if (direct) return direct;
  const productId = String(adjustment?.productId || "").trim();
  const productName = String(adjustment?.productName || "").trim().toLowerCase();
  const createdAt = String(adjustment?.createdAt || "").trim();
  const sibling = allAdjustments.find(candidate => {
    if (candidate === adjustment || String(candidate?.createdAt || "").trim() !== createdAt) return false;
    const sameId = productId && String(candidate?.productId || "").trim() === productId;
    const sameName = productName && String(candidate?.productName || "").trim().toLowerCase() === productName;
    return (sameId || sameName) && getHistoryAdjustmentType(candidate) === "sale" && historyAdjustmentSaleLinkV134(candidate);
  });
  return sibling ? historyAdjustmentSaleLinkV134(sibling) : null;
}

// V19.8: sum Sales-card profit and complete Sales-card cost for the exact
// net-sold lots selected by the current product/import/date filters. Group by
// Link ID so FIFO batch splits do not count the same Sales line more than once.
function getHistorySoldProfitTotalV137(options = {}) {
  const lots = getHistoryNetSoldLots(options);
  const allAdjustments = getAllHistoryStockAdjustments();
  const grouped = new Map();
  lots.forEach(lot => {
    const link = getHistorySalesLinkForAdjustmentV137(lot.adjustment, allAdjustments);
    const linkId = String(link?.linkId || "").trim();
    const detail = historySalesDetailsByLinkV134.get(linkId) || link;
    const profit = Number(detail?.profit), originalQuantity = Math.max(1, Number(detail?.quantity || link?.processedQty || 0) || 1);
    const averageCost = Number(detail?.averageCost), delivery = Number(detail?.localDelivery), extra = Number(detail?.extraFee), commission = Number(detail?.commissionAmount);
    const totalSalesCost = [averageCost, delivery, extra, commission].every(Number.isFinite)
      ? averageCost * originalQuantity + delivery + extra + commission
      : NaN;
    if (!linkId || !Number.isFinite(profit)) return;
    const entry = grouped.get(linkId) || {quantity:0, originalQuantity, profit, totalSalesCost};
    entry.quantity += Math.max(0, Number(lot.remainingQuantity) || 0);
    grouped.set(linkId, entry);
  });
  let matchedQuantity = 0, totalProfit = 0, totalSalesCost = 0;
  grouped.forEach(entry => {
    const quantity = Math.min(entry.originalQuantity, entry.quantity);
    const ratio = quantity / entry.originalQuantity;
    matchedQuantity += quantity;
    totalProfit += entry.profit * ratio;
    if (Number.isFinite(entry.totalSalesCost)) totalSalesCost += entry.totalSalesCost * ratio;
  });
  return {totalProfit, totalSalesCost, matchedQuantity};
}

function getHistoryPendingLegacySalesSummary(options = {}) {
  const pending = getHistoryRelevantAdjustments(options).filter(adjustment => {
    const delta = Math.trunc(Number(adjustment?.delta) || 0);
    return delta < 0 && getHistoryAdjustmentType(adjustment) === "pending";
  });
  return {
    count: pending.length,
    quantity: pending.reduce((sum, adjustment) =>
      sum + Math.abs(Math.trunc(Number(adjustment?.delta) || 0)), 0)
  };
}

function buildHistorySoldCostSummary(options = {}) {
  hydrateHistorySalesCacheV179();
  const forceZero = options?.forceZero === true;
  const range = options?.range && !options.range.error ? options.range : null;
  const periodLabel = range
    ? (range.isSingleDay
        ? `所选日期：${escapeHTML(range.startDate)}`
        : `所选期间：${escapeHTML(range.startDate)} 至 ${escapeHTML(range.endDate)}`)
    : "全部历史";
  const pending = forceZero ? {count:0, quantity:0} : (options?.source ? {count:0, quantity:0} : getHistoryPendingLegacySalesSummary(options));
  const profitSummary = forceZero ? { totalSalesCost:0, totalProfit:0 } : getHistorySoldProfitTotalV137(options);
  const soldQuantity = forceZero ? 0 : getHistorySoldQuantityTotal(options);
  const totalSalesAmount = forceZero ? 0 : Number(profitSummary.totalSalesCost || 0) + Number(profitSummary.totalProfit || 0);
  const salesFinancialReady = historyAllSalesLinksLoadedV136 || historySalesCacheHasDataV179 || soldQuantity <= 0;
  const salesTotalText = salesFinancialReady ? formatMoney(totalSalesAmount, "RM ") : "读取中…";
  const salesCostText = salesFinancialReady ? formatMoney(profitSummary.totalSalesCost, "RM ") : "读取中…";
  const salesProfitText = salesFinancialReady ? formatMoney(profitSummary.totalProfit, "RM ") : "读取中…";
  const periodLayoutClass = "history-selected-period-range-v143";

  return `
    <div class="history-selected-period ${periodLayoutClass}">
      <strong>${periodLabel}</strong>
      <span>卖出所有产品总数量 <b>${formatNumber(soldQuantity, 0)}</b></span>
    </div>
    <div class="history-cost-profit-summary-v137">
      <div class="history-total-sales-amount-summary-v142">
        <span>销售总额</span>
        <strong>${salesTotalText}</strong>
      </div>
      <div class="history-sold-cost-summary">
        <span>卖出成本总值</span>
        <strong>${formatMoney(forceZero ? 0 : getHistorySoldCostTotal(options), "RM ")}</strong>
      </div>
    </div>
    <div class="history-cost-profit-summary-v137">
      <div class="history-total-sales-cost-summary-v138">
        <span>卖出总成本</span>
        <strong>${salesCostText}</strong>
      </div>
      <div class="history-total-profit-summary-v137 ${!salesFinancialReady ? "neutral" : profitSummary.totalProfit > 0 ? "gain" : profitSummary.totalProfit < 0 ? "loss" : "neutral"}">
        <span>销售总利润</span>
        <strong>${salesProfitText}</strong>
      </div>
    </div>
    ${pending.count ? `<div class="history-pending-legacy-note">⚠ 旧记录待确认：${formatNumber(pending.count, 0)} 笔 / ${formatNumber(pending.quantity, 0)} 棵，暂不计入卖出统计。请到「设置 → 历史销售修复」确认。</div>` : ""}
  `;
}

// V6.8 History transaction-date rule:
// Date filtering for an import is based on the date the import record was saved
// into this system (Imports.date / Batches.date), not arrival/container date.
// Arrival/container dates remain logistics metadata only. Legacy records without
// a transaction date fall back to createdAt, then arrival/container date.
function getHistoryImportTransactionDate(batch, item = null) {
  const directCandidates = [
    item?.date,
    batch?.date
  ];

  for (const value of directCandidates) {
    const normalized = normalizeDateToDDMMYYYY(value);
    if (normalized) return normalized;
  }

  const createdCandidates = [
    item?.createdAt,
    batch?.createdAt
  ];

  for (const value of createdCandidates) {
    if (!value) continue;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return formatDateDDMMYYYY(parsed);
    }
  }

  const legacyCandidates = [
    item?.arrivalDate,
    batch?.arrivalDate,
    item?.containerDate,
    batch?.containerDate
  ];

  for (const value of legacyCandidates) {
    const normalized = normalizeDateToDDMMYYYY(value);
    if (normalized) return normalized;
  }

  return "";
}

function getHistorySingleDateEventCount(
  selectedDate,
  keyword = ""
) {
  const normalizedKeyword =
    String(keyword || "").trim();

  const incomingCount = getBatches().filter(batch => {
    if (
      getHistoryImportTransactionDate(batch) !==
      selectedDate
    ) {
      return false;
    }

    const allItems = getBatchItemsForDisplay(batch);

    if (!normalizedKeyword) {
      return allItems.length > 0;
    }

    const importNumberMatch =
      !isOriginalCostOnlySearchV218(normalizedKeyword) && sequentialSearchMatches(
        batch.importNumber,
        normalizedKeyword
      );

    const productMatch = allItems.some(item =>
      historyProductMatchesKeyword(
        item,
        normalizedKeyword
      )
    );

    return importNumberMatch || productMatch;
  }).length;

  const adjustments =
    getDailyStockAdjustments(
      selectedDate,
      normalizedKeyword
    );

  // V26.6: count actual independent movement records. Multiple Import Numbers
  // on the same date must not collapse into one generic incoming event.
  const adjustmentCount = adjustments.filter(
    adjustment => Math.trunc(Number(adjustment.delta) || 0) !== 0
  ).length;

  return incomingCount + adjustmentCount;
}

function renderHistorySingleDateSection(
  selectedDate,
  keyword = ""
) {
  const normalizedKeyword = String(keyword || "").trim();

  const incomingMatches = getBatches()
    .map(batch => {
      if (
        getHistoryImportTransactionDate(batch) !==
        selectedDate
      ) {
        return null;
      }

      const allItems = getBatchItemsForDisplay(batch);

      if (!normalizedKeyword) {
        return {
          batch,
          items: allItems
        };
      }

      const importNumberMatch =
        !isOriginalCostOnlySearchV218(normalizedKeyword) && sequentialSearchMatches(
          batch.importNumber,
          normalizedKeyword
        );

      const matchingItems = allItems.filter(item =>
        historyProductMatchesKeyword(
          item,
          normalizedKeyword
        )
      );

      if (!importNumberMatch && !matchingItems.length) {
        return null;
      }

      return {
        batch,
        items: importNumberMatch
          ? allItems
          : matchingItems
      };
    })
    .filter(Boolean)
    .sort((a, b) =>
      String(b.batch.createdAt || "").localeCompare(
        String(a.batch.createdAt || "")
      )
    );

  const adjustments =
    getDailyStockAdjustments(
      selectedDate,
      normalizedKeyword
    );

  if (!incomingMatches.length && !adjustments.length) {
    return "";
  }

  const incomingTotals = incomingMatches.reduce(
    (summary, match) => {
      summary.batchCount += 1;
      summary.itemCount += match.items.length;
      summary.quantity += match.items.reduce(
        (sum, item) =>
          sum + getSafeDisplayOriginalQuantity(item),
        0
      );
      return summary;
    },
    {
      batchCount: 0,
      itemCount: 0,
      quantity: 0
    }
  );

  const adjustmentTotals = adjustments.reduce(
    (summary, adjustment) => {
      const delta = Math.trunc(
        Number(adjustment.delta) || 0
      );

      if (delta < 0) {
        summary.outQuantity += Math.abs(delta);
      } else if (delta > 0) {
        summary.increaseQuantity += delta;
      }

      return summary;
    },
    {
      outQuantity: 0,
      increaseQuantity: 0
    }
  );

  return `
    <section class="history-range-day">
      <div class="history-range-day-header">
        <strong>${escapeHTML(selectedDate)}</strong>
        <span>
          共 ${formatNumber(
            incomingMatches.length +
            adjustments.filter(adjustment => Math.trunc(Number(adjustment.delta) || 0) !== 0).length
          )} 项进出记录 ·
          进 ${formatNumber(incomingTotals.quantity)} ·
          出 ${formatNumber(adjustmentTotals.outQuantity)} ·
          修改增加 ${formatNumber(adjustmentTotals.increaseQuantity)}
        </span>
      </div>

      ${
        incomingMatches.length
          ? `
            <section class="history-day-section">
              <div class="history-day-section-title">
                <strong>进口记录</strong>
                <span>
                  ${formatNumber(incomingTotals.batchCount)} 批 ·
                  ${formatNumber(incomingTotals.itemCount)} 种产品
                </span>
              </div>

              ${incomingMatches.map(match =>
                buildImportHistoryCard(
                  match.batch,
                  match.items,
                  { showRelatedBatches: false }
                )
              ).join("")}
            </section>
          `
          : ""
      }

      ${
        adjustments.length
          ? `
            <section class="history-day-section">
              <div class="history-day-section-title">
                <strong>出／修改｜库存异动</strong>
                <span>${formatNumber(adjustments.length)} 笔</span>
              </div>

              ${buildDailyStockAdjustmentHtml(adjustments)}
            </section>
          `
          : ""
      }
    </section>
  `;
}


function renderCompactProductHistoryByRange(
  range,
  keyword,
  output
) {
  const normalizedKeyword =
    String(keyword || "").trim();

  if (!normalizedKeyword) return false;

  const allProducts = getProducts();

  const allMatchingEntries = getBatches()
    .flatMap(batch =>
      getBatchItemsForDisplay(batch)
        .filter(item => {
          const historyInput =
            document.getElementById("historyLookupInput");
          const exactHistoryProduct =
            String(
              historyInput?.dataset?.exactHistoryProduct || ""
            ).trim().toLowerCase();
          const itemName =
            String(item.productName || "")
              .trim()
              .toLowerCase();

          if (exactHistoryProduct) {
            return itemName === exactHistoryProduct;
          }

          const searchable = [
            item.productName,
            item.productId,
            item.category
          ].map(value =>
            String(value || "").toLowerCase()
          ).join(" ");

          return batchItemSearchMatchesV218(
            searchable,
            item,
            normalizedKeyword
          );
        })
        .map(item => ({
          batch,
          item
        }))
    );

  if (!allMatchingEntries.length) {
    return false;
  }

  const productMatches = getBatches()
    .map(batch => {
      const matchingItems =
        getBatchItemsForDisplay(batch).filter(item => {
          const searchable = [
            item.productName,
            item.productId,
            item.category
          ].map(value =>
            String(value || "").toLowerCase()
          ).join(" ");

          return batchItemSearchMatchesV218(
            searchable,
            item,
            normalizedKeyword
          );
        });

      if (!matchingItems.length) return null;

      const itemEntries = matchingItems.map(item => {
        const productId =
          String(item.productId || "").trim();
        const productName =
          String(
            item.productName ||
            item.name ||
            ""
          ).trim().toLowerCase();

        const product = allProducts.find(candidate => {
          const sameId =
            productId &&
            candidate.id &&
            String(candidate.id).trim() === productId;

          const sameName =
            !sameId &&
            productName &&
            String(candidate.name || "")
              .trim()
              .toLowerCase() === productName;

          return sameId || sameName;
        });

        const importNumber = String(
          batch.importNumber ||
          item.importNumber ||
          ""
        ).trim();

        const adjustments =
          getProductStockAdjustments(product)
            .filter(adjustment => {
              const sameImportNumber =
                String(
                  adjustment.importNumber || ""
                ).trim().toLowerCase() ===
                importNumber.toLowerCase();

              return (
                sameImportNumber &&
                isDateWithinHistoryRange(
                  historyAdjustmentEventDateV134(adjustment),
                  range
                )
              );
            })
            .sort((a, b) => {
              const dayDiff = parseDDMMYYYY(historyAdjustmentEventDateV134(a)) -
                parseDDMMYYYY(historyAdjustmentEventDateV134(b));
              if (dayDiff) return dayDiff;
              const timeDiff = String(historyAdjustmentTimeV131(a) || "").localeCompare(
                String(historyAdjustmentTimeV131(b) || "")
              );
              if (timeDiff) return timeDiff;
              return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
            });

        const importTransactionInRange =
          isDateWithinHistoryRange(
            getHistoryImportTransactionDate(batch, item),
            range
          );

        return {
          item,
          product,
          importNumber,
          adjustments,
          importTransactionInRange
        };
      }).filter(entry =>
        entry.importTransactionInRange ||
        entry.adjustments.length > 0
      );

      if (!itemEntries.length) return null;

      return {
        batch,
        itemEntries
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const aLatestAdjustment = Math.max(
        0,
        ...a.itemEntries.flatMap(entry =>
          entry.adjustments.map(adjustment =>
            parseDDMMYYYY(historyAdjustmentEventDateV134(adjustment)) || 0
          )
        )
      );

      const bLatestAdjustment = Math.max(
        0,
        ...b.itemEntries.flatMap(entry =>
          entry.adjustments.map(adjustment =>
            parseDDMMYYYY(historyAdjustmentEventDateV134(adjustment)) || 0
          )
        )
      );

      const aImportTransaction =
        parseDDMMYYYY(getHistoryImportTransactionDate(a.batch)) || 0;
      const bImportTransaction =
        parseDDMMYYYY(getHistoryImportTransactionDate(b.batch)) || 0;

      return Math.max(aLatestAdjustment, aImportTransaction) -
        Math.max(bLatestAdjustment, bImportTransaction);
    });

  if (!productMatches.length) {
    return false;
  }

  // V7.6：日期范围存在时，上方产品标签只显示该期间真正发生过
  // 「进口 / 实际卖出 / 库存修改」的产品。累计进口与当前库存仍然
  // 使用这些相关产品的全部历史批次计算，不把日期范围误当成库存范围。
  const historyProductKey = item => {
    const productId = String(item?.productId || "").trim();
    if (productId) return `id:${productId}`;
    return `name:${String(item?.productName || item?.name || "").trim().toLowerCase()}`;
  };

  const activeProductKeys = new Set(
    productMatches.flatMap(match =>
      match.itemEntries.map(entry => historyProductKey(entry.item))
    )
  );

  const summaryEntries = allMatchingEntries.filter(entry =>
    activeProductKeys.has(historyProductKey(entry.item))
  );

  const summary = summaryEntries.reduce(
    (result, entry) => {
      const quantities =
        getHistoryItemQuantities(entry.item);

      result.originalQuantity +=
        quantities.originalQuantity;
      result.remainingQuantity +=
        quantities.remainingQuantity;
      result.productNames.add(
        String(
          entry.item.productName ||
          "未命名产品"
        )
      );

      return result;
    },
    {
      originalQuantity: 0,
      remainingQuantity: 0,
      productNames: new Set()
    }
  );

  const productTitle =
    buildHistoryProductNameButtons(
      summary.productNames
    );

  const dateLabel = range.isSingleDay
    ? range.startDate
    : `${range.startDate} 至 ${range.endDate}`;

  const shipmentKeywordV235 = String(keyword || "").trim();
  if (shipmentKeywordV235 && !isOriginalCostOnlySearchV218(shipmentKeywordV235)) {
    const startTimeV235 = parseDDMMYYYY(range.startDate);
    const endTimeV235 = parseDDMMYYYY(range.endDate);
    const shipmentMatchesV235 = getBatches().filter(batch => {
      if (!shipmentLocalNumberMatchesV235(getBatchShipmentLocalNumberV235(batch), shipmentKeywordV235)) return false;
      const txDate = getHistoryImportTransactionDate(batch, getBatchItemsForDisplay(batch)[0] || null);
      const txTime = parseDDMMYYYY(txDate);
      return txTime && txTime >= startTimeV235 && txTime <= endTimeV235;
    });
    if (shipmentMatchesV235.length) {
      output.innerHTML = shipmentMatchesV235
        .slice()
        .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
        .map(batch => buildImportHistoryCard(batch, getBatchItemsForDisplay(batch), { showRelatedBatches: false }))
        .join("");
      return;
    }
  }

  const summaryBox = `
    <div class="history-related-notice">
      <div class="history-related-title">
        ${productTitle}
      </div>
      <div class="history-related-batch">
        <strong>
          ${escapeHTML(dateLabel)} ·
          相关进口记录：${formatNumber(productMatches.length)}
        </strong>
        <span>
          全部历史累计进口
          ${formatNumber(summary.originalQuantity)}
          · 当前库存
          ${formatNumber(summary.remainingQuantity)}
        </span>
      </div>
    </div>
  `;

  const compactRows = productMatches.flatMap(match =>
    match.itemEntries.map(entry => {
      const item = entry.item;
      const quantities =
        getHistoryItemQuantities(item);

      const arrivalDate =
        normalizeDateToDDMMYYYY(
          item.arrivalDate ||
          match.batch.arrivalDate ||
          ""
        ) || "-";

      const adjustmentRows = entry.adjustments.length
        ? `
          <div class="product-history-adjustments">
            ${entry.adjustments.map(adjustment => {
              const delta = Math.trunc(
                Number(adjustment.delta) || 0
              );
              const signedDelta = delta > 0
                ? `+${formatNumber(delta)}`
                : formatNumber(delta);
              const actionLabel = getHistoryAdjustmentLabel(adjustment);
              // V11.4: every visible stock adjustment carries its own remark,
              // including exact-product + date-range History views.
              const note = getUserVisibleAdjustmentNote(adjustment);

              return `
                <div class="product-history-adjustment ${
                  delta >= 0 ? "increase" : "decrease"
                }">
                  <div class="history-record-main-v170">
                    <strong class="product-history-adjustment-date">
                      ${escapeHTML(historyAdjustmentDateTimeV131(adjustment))}
                    </strong>
                    <span class="product-identity-v167 product-history-identity-v167"><button type="button"
                          class="product-history-adjustment-product history-copy-product history-copy-product-inline"
                          data-history-product="${escapeHTML(
                            adjustment.productName ||
                            item.name ||
                            item.productName ||
                            "未命名产品"
                          )}"
                          data-history-copy-only="true"
                          title="点击复制产品名称">
                    ${escapeHTML(
                      adjustment.productName ||
                      item.name ||
                      item.productName ||
                      "未命名产品"
                    )}
                  </button>
                  ${buildProductIdCopyButtonV166(
                    adjustment.productId || item.productId,
                    "history-product-id-v166"
                  )}
                    </span>
                    <span class="product-history-adjustment-action">
                      ${actionLabel}
                    </span>
                    <strong class="product-history-adjustment-quantity">
                      ${signedDelta}
                    </strong>
                  </div>
                  ${buildHistorySalesFinancialHtmlV134(adjustment)}
                  <span class="product-history-adjustment-note">${buildHistoryAdjustmentNoteContentV149(adjustment)}</span>
                  ${buildHistoryAdjustmentMetaV173(adjustment, entry.importNumber)}
                </div>
              `;
            }).join("")}
          </div>
        `
        : "";

      return `
        <article class="product-history-compact-card">
          <div class="product-history-compact-grid">
            <div class="product-history-import-number">
              <span>进口编号</span>
              <strong>
                ${buildHistoryImportNumberButton(
                  entry.importNumber
                )}
              </strong>
            </div>

            <div class="product-history-arrival-date">
              <span>抵达日期</span>
              <strong>
                ${escapeHTML(arrivalDate)}
              </strong>
            </div>

            <div class="product-history-original-qty">
              <span>原进口数量</span>
              <strong>
                ${formatNumber(
                  quantities.originalQuantity
                )}
              </strong>
            </div>

            <div class="product-history-unit-cost">
              <span>原每棵成本</span>
              <strong>
                ${formatMoney(
                  Number(item.unitCost) || 0,
                  "RM "
                )}
              </strong>
            </div>
          </div>

          ${adjustmentRows}
        </article>
      `;
    })
  ).join("");

  const exactHistoryProduct = String(
    document.getElementById("historyLookupInput")?.dataset?.exactHistoryProduct || ""
  ).trim();

  const consistencyWarnings = productMatches.flatMap(match => match.matchingItems)
    .map(item => buildHistoryInventoryConsistencyWarning(item))
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index)
    .join("");

  output.innerHTML =
    summaryBox +
    consistencyWarnings +
    compactRows +
    buildHistorySoldCostSummary({
      range,
      keyword: normalizedKeyword,
      exactProduct: exactHistoryProduct
    });
  return true;
}

// V19.8: source lookup uses surviving net-sale lots. Cancelled or restored
// sales are excluded from both the displayed records and the totals.
function renderHistorySalesSourceLookupV149(keyword, range, output) {
  const sourceKeyword = String(keyword || "").trim();
  if (!sourceKeyword) return false;
  const allSourceLots = getHistoryNetSoldLots({ source: sourceKeyword });
  if (!allSourceLots.length) return false;
  const sourceName = getHistorySalesSourceV149(allSourceLots[0]?.adjustment) || sourceKeyword;
  const sourceDisplay = getHistorySalesSourceDisplayV149(allSourceLots[0]?.adjustment) || sourceName;
  const lots = range ? getHistoryNetSoldLots({ range, source: sourceKeyword }) : allSourceLots;
  const adjustments = lots
    .map(lot => ({ ...lot.adjustment, delta: -Math.max(0, Number(lot.remainingQuantity) || 0) }))
    .sort((a, b) => {
      const dayDiff = parseDDMMYYYY(historyAdjustmentEventDateV134(a)) - parseDDMMYYYY(historyAdjustmentEventDateV134(b));
      if (dayDiff) return dayDiff;
      const timeDiff = String(historyAdjustmentTimeV131(a) || "").localeCompare(String(historyAdjustmentTimeV131(b) || ""));
      if (timeDiff) return timeDiff;
      return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
    });
  const dateText = range ? (range.isSingleDay ? range.startDate : `${range.startDate} 至 ${range.endDate}`) : "全部历史";
  const groups = new Map();
  adjustments.forEach(adjustment => {
    const date = historyAdjustmentEventDateV134(adjustment) || "-";
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date).push(adjustment);
  });
  const sections = Array.from(groups.entries()).map(([date, rows]) => `
    <section class="history-range-day history-source-results-v149">
      <div class="history-range-day-header">
        <strong>${escapeHTML(date)}</strong>
        <span>销售记录 ${formatNumber(rows.length)} 笔 · 售出 ${formatNumber(rows.reduce((sum, row) => sum + Math.abs(Number(row.delta) || 0), 0))}</span>
      </div>
      ${buildDailyStockAdjustmentHtml(rows)}
    </section>
  `).join("");
  output.innerHTML = `
    <div class="history-related-notice history-source-summary-v149">
      <div class="history-related-title">
        <button type="button" class="history-copy-source-v149" data-history-source="${escapeHTML(sourceName)}" title="点击复制地点或人员名称">${escapeHTML(sourceDisplay)}</button>
      </div>
      <div class="history-related-batch">
        <strong>${escapeHTML(dateText)} · 有效销售记录</strong>
        <span>可配合开始日期与结束日期继续筛选</span>
      </div>
    </div>
    ${sections || '<div class="empty-state">所选日期内没有这个地点或人员的有效销售记录</div>'}
    ${buildHistorySoldCostSummary({ range, source: sourceKeyword })}
  `;
  return true;
}


function renderImportHistoryByRange(
  startValue,
  endValue,
  output,
  keyword = ""
) {
  const range =
    getHistoryDateRange(startValue, endValue);

  if (!range || range.error) {
    output.innerHTML = `
      <div class="empty-state">
        ${escapeHTML(range?.error || "请选择正确的日期")}
      </div>
    `;
    return;
  }

  const dateLabel = range.isSingleDay
    ? range.startDate
    : `${range.startDate} 至 ${range.endDate}`;

  if (String(keyword || "").trim() && renderHistorySalesSourceLookupV149(keyword, range, output)) {
    return;
  }

  if (
    String(keyword || "").trim() &&
    renderCompactProductHistoryByRange(
      range,
      keyword,
      output
    )
  ) {
    return;
  }

  const sections = getHistoryRangeDates(range)
    .map(date =>
      renderHistorySingleDateSection(
        date,
        keyword
      )
    )
    .filter(Boolean);

  const filterText = String(keyword || "").trim()
    ? ` · 产品筛选：${escapeHTML(String(keyword).trim())}`
    : "";

  if (!sections.length) {
    output.innerHTML = `
      <div class="history-date-summary">
        <strong>${escapeHTML(dateLabel)}</strong>
        <span>没有符合的历史资料${filterText}</span>
      </div>
      ${buildHistorySoldCostSummary({
        range,
        keyword,
        exactProduct: String(
          document.getElementById("historyLookupInput")?.dataset?.exactHistoryProduct || ""
        ).trim(),
        forceZero: true
      })}
    `;
    return;
  }

  const eventCount = getHistoryRangeDates(range)
    .reduce(
      (total, date) =>
        total +
        getHistorySingleDateEventCount(
          date,
          keyword
        ),
      0
    );

  output.innerHTML = range.isSingleDay
    ? sections.join("")
    : `
      <div class="history-date-summary">
        <strong>${escapeHTML(dateLabel)}</strong>
        <span>
          共 ${formatNumber(eventCount)} 项进出记录
          ${filterText}
        </span>
      </div>
      ${sections.join("")}
      ${buildHistorySoldCostSummary({
        range,
        keyword,
        exactProduct: String(
          document.getElementById("historyLookupInput")?.dataset?.exactHistoryProduct || ""
        ).trim()
      })}
    `;

  if (range.isSingleDay) {
    output.innerHTML += buildHistorySoldCostSummary({
      range,
      keyword,
      exactProduct: String(
        document.getElementById("historyLookupInput")?.dataset?.exactHistoryProduct || ""
      ).trim()
    });
  }
}


function renderImportHistoryNowV134() {
  const input = document.getElementById("historyLookupInput");
  const startInput =
    document.getElementById("historyStartDateInput");
  const endInput =
    document.getElementById("historyEndDateInput");
  const output = document.getElementById("historyResult");
  if (!input || !output) return;

  const startDate = String(
    startInput?.value || ""
  ).trim();
  const endDate = String(
    endInput?.value || ""
  ).trim();

  if (startDate || endDate) {
    renderImportHistoryByRange(
      startDate,
      endDate,
      output,
      input.value.trim()
    );
    return;
  }

  const keyword = input.value.trim();
  if (!keyword) {
    output.innerHTML = '<div class="empty-state">输入进口编号、海外运输单号 / 本地单号、产品名称、地点、人员，或选择日期范围查看历史资料</div>';
    return;
  }

  const numericOriginalCostOnlyV218 = isOriginalCostOnlySearchV218(keyword);

  if (!numericOriginalCostOnlyV218 && renderHistorySalesSourceLookupV149(keyword, null, output)) {
    return;
  }

  const normalizedKeyword = keyword.toLowerCase();
  const batches = getBatches();
  const exactBatch = numericOriginalCostOnlyV218 ? null : batches.find(item =>
    String(item.importNumber || "").trim().toLowerCase() === normalizedKeyword
  );

  if (exactBatch) {
    output.innerHTML =
      buildImportHistoryCard(
        exactBatch,
        getBatchItemsForDisplay(exactBatch),
        { showRelatedBatches: false }
      ) +
      buildHistorySoldCostSummary({
        importNumber: exactBatch.importNumber
      });
    return;
  }

  const shipmentBatchMatchesV235 = numericOriginalCostOnlyV218 ? [] : batches.filter(batch =>
    shipmentLocalNumberMatchesV235(getBatchShipmentLocalNumberV235(batch), keyword)
  );

  if (shipmentBatchMatchesV235.length === 1) {
    const matchedBatch = shipmentBatchMatchesV235[0];
    output.innerHTML =
      buildImportHistoryCard(
        matchedBatch,
        getBatchItemsForDisplay(matchedBatch),
        { showRelatedBatches: false }
      ) +
      buildHistorySoldCostSummary({ importNumber: matchedBatch.importNumber });
    return;
  }

  if (shipmentBatchMatchesV235.length > 1) {
    output.innerHTML = shipmentBatchMatchesV235
      .slice()
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .map(batch => buildImportHistoryCard(batch, getBatchItemsForDisplay(batch), { showRelatedBatches: false }))
      .join("");
    return;
  }

  const partialBatchMatches = numericOriginalCostOnlyV218 ? [] : batches.filter(batch =>
    sequentialSearchMatches(batch.importNumber, keyword)
  );

  if (partialBatchMatches.length === 1) {
    const matchedBatch = partialBatchMatches[0];

    output.innerHTML =
      buildImportHistoryCard(
        matchedBatch,
        getBatchItemsForDisplay(matchedBatch),
        { showRelatedBatches: false }
      ) +
      buildHistorySoldCostSummary({
        importNumber: matchedBatch.importNumber
      });
    return;
  }

  if (partialBatchMatches.length > 1) {
    output.innerHTML =
      '<div class="empty-state">找到多个符合的进口编号，请输入更完整的编号</div>';
    return;
  }

  // V6.8 History lookup safety: resolve the typed product against the current
  // Products collection first. This keeps product search working even when an
  // older Batches.items snapshot still contains a previous product name.
  const exactHistoryProduct = String(
    input.dataset.exactHistoryProduct || ""
  ).trim().toLowerCase();
  // V24.6: stable Product ID linkage is only for the original text/product search.
  // A numeric Original Cost hit must remain row/batch-specific; it must not turn
  // into a Product ID hit that automatically includes every historical batch.
  const matchedProductIds = new Set(
    getProducts().filter(product => {
      if (numericOriginalCostOnlyV218) return false;
      const name = String(product.name || "").trim().toLowerCase();
      const id = String(product.id || "").trim().toLowerCase();
      const category = String(product.category || "").trim().toLowerCase();
      if (exactHistoryProduct) return name === exactHistoryProduct;
      return smartSearchMatches([name, id, category].join(" "), normalizedKeyword);
    }).map(product => String(product.id || "").trim()).filter(Boolean)
  );

  const productMatches = batches.map(batch => {
    const matchingItems = getBatchItemsForDisplay(batch).filter(item => {
      const itemName = String(item.productName || "").trim().toLowerCase();
      const itemProductId = String(item.productId || "").trim();

      // Prefer stable productId linkage whenever the current Products record matched.
      if (matchedProductIds.size && itemProductId && matchedProductIds.has(itemProductId)) {
        return true;
      }

      if (exactHistoryProduct) {
        return itemName === exactHistoryProduct;
      }

      const searchable = [
        item.productName,
        item.productId,
        item.category
      ].map(value => String(value || "").toLowerCase()).join(" ");

      return batchItemSearchMatchesV218(searchable, item, keyword);
    });

    return { batch, matchingItems };
  }).filter(match => match.matchingItems.length > 0)
    .sort((a, b) => {
      const dateDifference =
        parseDDMMYYYY(b.batch.containerDate) -
        parseDDMMYYYY(a.batch.containerDate);

      if (dateDifference !== 0) return dateDifference;
      return String(b.batch.createdAt || "").localeCompare(
        String(a.batch.createdAt || "")
      );
    });

  if (!productMatches.length) {
    output.innerHTML = `
      <div class="history-date-summary">
        <strong>全部历史</strong>
        <span>没有符合的历史资料 · 产品筛选：${escapeHTML(keyword)}</span>
      </div>
      ${buildHistorySoldCostSummary({ keyword, exactProduct: String(input.dataset.exactHistoryProduct || "").trim(), forceZero:true })}`;
    return;
  }

  const summary = productMatches.reduce((result, match) => {
    match.matchingItems.forEach(item => {
      const quantities = getHistoryItemQuantities(item);
      result.originalQuantity += quantities.originalQuantity;
      result.remainingQuantity += quantities.remainingQuantity;
      result.productNames.add(String(item.productName || "未命名产品"));
    });
    return result;
  }, {
    originalQuantity: 0,
    remainingQuantity: 0,
    productNames: new Set()
  });

  const productTitle =
    buildHistoryProductNameButtons(
      summary.productNames
    );

  // V6.8: product-name History uses Products.stock as the final truth for total remaining.
  // Import-number rows still keep each Imports.remainingQuantity for batch-level history.
  const normalizedHistoryLookup = String(keyword || "").trim().toLowerCase();
  const isExactImportNumberLookup = getBatches().some(batch =>
    String(batch.importNumber || "").trim().toLowerCase() === normalizedHistoryLookup
  );
  const matchedCurrentProducts = getProducts().filter(product =>
    [...summary.productNames].some(name =>
      String(product.name || "").trim().toLowerCase() === String(name || "").trim().toLowerCase()
    )
  );
  if (!isExactImportNumberLookup && matchedCurrentProducts.length) {
    summary.remainingQuantity = matchedCurrentProducts.reduce(
      (sum, product) => sum + Math.max(0, Math.floor(Number(product.stock) || 0)),
      0
    );
  }

  const summaryBox = `
    <div class="history-related-notice">
      <div class="history-related-title">${productTitle}</div>
      <div class="history-related-batch">
        <strong>进口记录：${formatNumber(productMatches.length)}</strong>
        <span>全部历史累计进口 ${formatNumber(summary.originalQuantity)} · 当前库存 ${formatNumber(summary.remainingQuantity)}</span>
      </div>
    </div>
  `;

  const allProducts = getProducts();

  const compactRows = productMatches.flatMap(match =>
    match.matchingItems.map(item => {
      const quantities = getHistoryItemQuantities(item);
      const productId = String(item.productId || "").trim();
      const productName =
        String(item.productName || item.name || "").trim().toLowerCase();

      const product = allProducts.find(candidate => {
        const sameId =
          productId &&
          candidate.id &&
          String(candidate.id).trim() === productId;
        const sameName =
          !sameId &&
          productName &&
          String(candidate.name || "").trim().toLowerCase() ===
            productName;

        return sameId || sameName;
      });

      const importNumber =
        String(match.batch.importNumber || item.importNumber || "").trim();

      const adjustments = getProductStockAdjustments(product)
        .filter(adjustment =>
          String(adjustment.importNumber || "")
            .trim()
            .toLowerCase() === importNumber.toLowerCase()
        )
        .sort((a, b) =>
          String(a.createdAt || "").localeCompare(
            String(b.createdAt || "")
          )
        );

      const adjustmentRows = adjustments.length
        ? `
          <div class="product-history-adjustments">
            ${adjustments.map(adjustment => {
              const delta = Math.trunc(Number(adjustment.delta) || 0);
              const signedDelta = delta > 0
                ? `+${formatNumber(delta)}`
                : formatNumber(delta);

              const actionLabel = getHistoryAdjustmentLabel(adjustment);
              const note = getUserVisibleAdjustmentNote(adjustment);

              return `
                <div class="product-history-adjustment ${delta >= 0 ? "increase" : "decrease"}">
                  <div class="history-record-main-v170">
                    <strong class="product-history-adjustment-date">${escapeHTML(historyAdjustmentDateTimeV131(adjustment))}</strong>
                    <span class="product-identity-v167 product-history-identity-v167"><button type="button"
                          class="product-history-adjustment-product history-copy-product history-copy-product-inline"
                          data-history-product="${escapeHTML(
                            adjustment.productName ||
                            item.name ||
                            item.productName ||
                            "未命名产品"
                          )}"
                          data-history-copy-only="true"
                          title="点击复制产品名称">${escapeHTML(
                    adjustment.productName ||
                    item.name ||
                    item.productName ||
                    "未命名产品"
                  )}</button>
                  ${buildProductIdCopyButtonV166(
                    adjustment.productId || item.productId,
                    "history-product-id-v166"
                  )}
                    </span>
                    <span class="product-history-adjustment-action">${actionLabel}</span>
                    <strong class="product-history-adjustment-quantity">${signedDelta}</strong>
                  </div>
                  ${buildHistorySalesFinancialHtmlV134(adjustment)}
                  <span class="product-history-adjustment-note">${buildHistoryAdjustmentNoteContentV149(adjustment)}</span>
                  ${buildHistoryAdjustmentMetaV173(adjustment, importNumber)}
                </div>
              `;
            }).join("")}
          </div>
        `
        : "";

      return `
        <article class="product-history-compact-card">
          <div class="product-history-compact-grid">
            <div class="product-history-import-number">
              <span>进口编号</span>
              <strong>
                ${buildHistoryImportNumberButton(
                  importNumber
                )}
              </strong>
            </div>
            <div class="product-history-arrival-date">
              <span>抵达日期</span>
              <strong>${escapeHTML(
                normalizeDateToDDMMYYYY(
                  item.arrivalDate ||
                  match.batch.arrivalDate ||
                  ""
                ) || "-"
              )}</strong>
            </div>
            <div class="product-history-original-qty">
              <span>原进口数量</span>
              <strong>${formatNumber(quantities.originalQuantity)}</strong>
            </div>
            <div class="product-history-unit-cost">
              <span>原每棵成本</span>
              <strong>${formatMoney(getTrustedHistoryUnitCost(item), "RM ")}</strong>
            </div>
          </div>
          ${adjustmentRows}
        </article>
      `;
    })
  ).join("");

  const consistencyWarnings = productMatches.flatMap(match => match.matchingItems)
    .map(item => buildHistoryInventoryConsistencyWarning(item))
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index)
    .join("");

  output.innerHTML =
    summaryBox +
    consistencyWarnings +
    compactRows +
    buildHistorySoldCostSummary({
      keyword,
      exactProduct: String(
        input.dataset.exactHistoryProduct || ""
      ).trim()
    });
}

async function renderImportHistory() {
  // V24.6: history is manual-query only. Keeping text in the box must never
  // trigger expensive history scans from blur, navigation, sync refresh, etc.
  if (!historyManualLookupReadyV246) return;
  if (!document.getElementById("historyPage")?.classList.contains("active")) return;
  const token = ++historyLookupRenderTokenV134;
  hydrateHistorySalesCacheV179();
  renderImportHistoryNowV134();
  await ensureVisibleHistorySalesDetailsV134();
  if (token === historyLookupRenderTokenV134) renderImportHistoryNowV134();
}

function getImports(){return typeof loadJSONReadOnlyV317 === "function" ? loadJSONReadOnlyV317("importSystemImports",[]) : loadJSON("importSystemImports",[]);}
function saveImports(v) {
  const previous = getImports();
  invalidateMinimumPriceOriginIndexV160();
  saveJSON("importSystemImports", v);
  if (typeof markCloudCollectionSaved === "function") {
    markCloudCollectionSaved("imports", previous, v);
  }
}
function getBatches(){return typeof loadJSONReadOnlyV317 === "function" ? loadJSONReadOnlyV317("importSystemBatches",[]) : loadJSON("importSystemBatches",[]);}
function saveBatches(v) {
  const previous = getBatches();
  invalidateMinimumPriceOriginIndexV160();
  saveJSON("importSystemBatches", v);
  if (typeof markCloudCollectionSaved === "function") {
    markCloudCollectionSaved("batches", previous, v);
  }
}
function renderBatchSuggestions(keyword = ""){
  const list =
    document.getElementById("batchProductSuggestions");

  if (!list) return;

  const value = String(keyword || "").trim();

  // 没有输入名称时，显示全部已建立产品。
  if (!value) {
    list.innerHTML = getOperationalProductsV256()
      .slice()
      .sort((a, b) =>
        String(a.id || "").localeCompare(
          String(b.id || "")
        )
      )
      .map(product => `
        <option value="${escapeHTML(product.name)}">
          ${escapeHTML(product.id)} ·
          ${escapeHTML(normalizePrimaryProductCategoryV255(product.category))}
        </option>
      `)
      .join("");
    return;
  }

  // 已输入名称时，只显示当前输入内容，
  // 不再混入其他产品建议。
  list.innerHTML = `
    <option value="${escapeHTML(value)}"></option>
  `;
}
function applyBatchRate(){
  const defaults = {
    CNY: 1.60,
    NTD: 7.69,
    VND: 6300.00,
    IDR: 3571.00,
    MYR: 1.00
  };

  const saved = loadJSON("importSystemSettings", {});
  const settings = {
    ...defaults,
    ...(saved && typeof saved === "object" ? saved : {})
  };

  const currency = document.getElementById("batchCurrency").value;
  const rateInput = document.getElementById("batchRate");
  const rate = currency === "MYR" ? 1 : Number(settings[currency]);
  rateInput.value = currency === "MYR" ? "1.00" :
    formatMoney(Number.isFinite(rate) && rate > 0 ? rate : defaults[currency] || 0);
  const savedImportLocked = Boolean(currentEditingImportNumber);
  rateInput.disabled = currency === "MYR" || savedImportLocked;
  rateInput.classList.toggle("cost-field-locked", currency === "MYR" || savedImportLocked);
  rateInput.title = currency === "MYR" ? "MYR 本币无需换算，汇率固定 1.00" : (savedImportLocked ? "已保存进口的汇率永久锁定。" : "");
}

let batchCurrencyManuallySelectedV229 = false;
let batchArrivalAutoFilledByMYRV230 = false;
// V26.6: one currency-conflict acknowledgement per new import/draft.
// It resets only when starting a genuinely new import, not on every row.
let batchCurrencyConflictAcknowledgedV249 = false;

function setTodayArrivalForMYRV229() {
  const currency = document.getElementById("batchCurrency");
  const arrival = document.getElementById("batchArrivalDate");
  const picker = document.getElementById("batchArrivalDatePicker");
  if (!currency || currency.value !== "MYR" || !arrival || String(arrival.value || "").trim()) return;
  const today = formatDateDDMMYYYY(new Date());
  arrival.value = today;
  if (picker) picker.value = formatDDMMYYYYToNative(today);
  batchArrivalAutoFilledByMYRV230 = true;
  updateTransitDays();
}

function clearAutoArrivalWhenLeavingMYRV230() {
  const currency = document.getElementById("batchCurrency");
  if (!currency || currency.value === "MYR" || !batchArrivalAutoFilledByMYRV230) return;
  const arrival = document.getElementById("batchArrivalDate");
  const picker = document.getElementById("batchArrivalDatePicker");
  if (arrival) arrival.value = "";
  if (picker) picker.value = "";
  batchArrivalAutoFilledByMYRV230 = false;
  updateTransitDays();
}

function formatNativeDateToDDMMYYYY(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}-${month}-${year}`;
}

function formatDDMMYYYYToNative(value) {
  const date = parseDateDDMMYYYY(value);
  if (!date) return "";

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0")
  ].join("-");
}

function normalizeFlexibleDateInput(input) {
  const raw = String(input.value || "").trim();

  if (!raw) {
    input.classList.remove("date-error");
    return "";
  }

  const parts = raw.split(/[-/.\s]+/).filter(Boolean);

  if (parts.length !== 3) {
    input.classList.add("date-error");
    return "";
  }

  let [day, month, year] = parts;

  if (
    !/^\d{1,2}$/.test(day) ||
    !/^\d{1,2}$/.test(month) ||
    !/^\d{2}(?:\d{2})?$/.test(year)
  ) {
    input.classList.add("date-error");
    return "";
  }

  day = String(Number(day)).padStart(2, "0");
  month = String(Number(month)).padStart(2, "0");

  if (year.length === 2) {
    year = `20${year}`;
  }

  const normalized = `${day}-${month}-${year}`;
  const validDate = parseDateDDMMYYYY(normalized);

  input.value = normalized;
  input.classList.toggle("date-error", !validDate);

  return validDate ? normalized : "";
}

function setupDatePickers() {
  const pairs = [
    ["batchContainerDate", "batchContainerDatePicker"],
    ["batchArrivalDate", "batchArrivalDatePicker"]
  ];

  pairs.forEach(([textId, pickerId]) => {
    const textInput = document.getElementById(textId);
    const picker = document.getElementById(pickerId);
    if (!textInput || !picker) return;

    picker.addEventListener("change", () => {
      textInput.value = formatNativeDateToDDMMYYYY(picker.value);
      if (textId === "batchArrivalDate") batchArrivalAutoFilledByMYRV230 = false;
      updateTransitDays();
      calculateBatch();
    });

    textInput.addEventListener("input", () => {
      if (textId === "batchArrivalDate") batchArrivalAutoFilledByMYRV230 = false;
    });

    textInput.addEventListener("blur", () => {
      normalizeFlexibleDateInput(textInput);
      picker.value = formatDDMMYYYYToNative(textInput.value);
      updateTransitDays();
      calculateBatch();
    });
  });

  document.querySelectorAll(".calendar-btn").forEach(button => {
    button.addEventListener("click", () => {
      const picker = document.getElementById(button.dataset.dateTarget);
      if (!picker) return;

      if (typeof picker.showPicker === "function") {
        picker.showPicker();
      } else {
        picker.focus();
        picker.click();
      }
    });
  });
}

function parseDateDDMMYYYY(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(Date.UTC(
      value.getFullYear(),
      value.getMonth(),
      value.getDate()
    ));
  }

  const text = String(value ?? "").trim();
  if (!text) return null;

  let day;
  let month;
  let year;

  const dmy = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);

  if (dmy) {
    day = Number(dmy[1]);
    month = Number(dmy[2]);
    year = Number(dmy[3]);
    if (year < 100) year += 2000;
  } else if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function normalizeDateToDDMMYYYY(value) {
  const date = parseDateDDMMYYYY(value);
  if (!date) return "";

  return [
    String(date.getUTCDate()).padStart(2, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    date.getUTCFullYear()
  ].join("-");
}

function getImportDisplayDate(record, batch = null) {
  // V7.3: 「最近进口」只代表抵达日期。
  // 没有抵达日期时留空，绝不回退到装柜日期。
  const candidates = [
    record?.arrivalDate,
    batch?.arrivalDate
  ];

  for (const value of candidates) {
    const normalized = normalizeDateToDDMMYYYY(value);
    if (normalized) return normalized;
  }

  return "";
}
function normalizeDateInput(input) {
  const date=parseDateDDMMYYYY(input.value);
  if(!input.value){input.classList.remove("date-error");return;}
  input.classList.toggle("date-error",!date);
}
function updateTransitDays() {
  const containerInput =
    document.getElementById("batchContainerDate");
  const arrivalInput =
    document.getElementById("batchArrivalDate");
  const output =
    document.getElementById("batchTransitDays");

  if (!containerInput || !arrivalInput || !output) {
    return 0;
  }

  if (containerInput.value) {
    normalizeFlexibleDateInput(containerInput);
  }

  if (arrivalInput.value) {
    normalizeFlexibleDateInput(arrivalInput);
  }

  const containerValue =
    String(containerInput.value || "").trim();
  const arrivalValue =
    String(arrivalInput.value || "").trim();

  if (!containerValue || !arrivalValue) {
    output.value = "-";
    return 0;
  }

  const containerDate =
    parseDateDDMMYYYY(containerValue);
  const arrivalDate =
    parseDateDDMMYYYY(arrivalValue);

  if (!containerDate || !arrivalDate) {
    output.value = "日期错误";
    return 0;
  }

  const days = Math.round(
    (arrivalDate.getTime() - containerDate.getTime()) /
    86400000
  );

  if (days < 0) {
    output.value = "日期错误";
    return 0;
  }

  output.value = String(days);
  return days;
}

function resetBatchForm(options = {}) {
  const {
    clearLookup = true,
    clearStatus = true
  } = options;

  setBatchEditMode("");

  const form = document.getElementById("batchImportForm");
  if (form) form.reset();

  [
    "batchRackQuantity",
    "batchChinaTransportCost",
    "batchPotCost",
    "batchShippingMY"
  ].forEach(id => {
    const field = document.getElementById(id);
    if (field) field.value = "";
  });

  const tracking = document.getElementById("batchTrackingNumber");
  if (tracking) tracking.value = "";

  const overseasTracking =
    document.getElementById("batchOverseasTrackingNumber");
  if (overseasTracking) overseasTracking.value = "";

  const containerDate = document.getElementById("batchContainerDate");
  if (containerDate) containerDate.value = "";

  const arrivalDate = document.getElementById("batchArrivalDate");
  if (arrivalDate) arrivalDate.value = "";

  const containerPicker =
    document.getElementById("batchContainerDatePicker");
  if (containerPicker) containerPicker.value = "";

  const arrivalPicker =
    document.getElementById("batchArrivalDatePicker");
  if (arrivalPicker) arrivalPicker.value = "";

  const transitDays = document.getElementById("batchTransitDays");
  if (transitDays) transitDays.value = "-";

  batchCurrencyManuallySelectedV229 = false;
  batchArrivalAutoFilledByMYRV230 = false;
  batchCurrencyConflictAcknowledgedV249 = false;
  const currency = document.getElementById("batchCurrency");
  if (currency) { currency.value = "CNY"; applyBatchRate(); }

  applyBatchRate();

  if (clearLookup) {
    const lookup = document.getElementById("batchLookupInput");
    if (lookup) lookup.value = "";
  }

  if (clearStatus) {
    const status = document.getElementById("batchStatusText");
    if (status) status.textContent = "";
  }

  batchRowSeq = 0;

  const rows = document.getElementById("batchRows");
  if (rows) rows.innerHTML = "";

  addBatchRow();
  calculateBatch();
  window.setTimeout(() => {
    if (currentEditingImportNumber || getActiveImportDraftV243()) return;
    importDraftCleanFingerprintV244 = importDraftFingerprintV243(collectImportDraftStateV242());
  }, 0);
}

function findExactProductByNameV231(name) {
  const wanted = String(name || "").trim().toLowerCase();
  if (!wanted) return null;
  // V24.6: use raw product storage for identity lookup. Minimum-price
  // normalization is unrelated here and was making the typing path expensive.
  const products = loadJSON("importSystemProducts", []);
  return products.find(product =>
    String(product?.name || "").trim().toLowerCase() === wanted ||
    String(product?.id || "").trim().toLowerCase() === wanted
  ) || null;
}

const AMBIGUOUS_BONSAI_PREFIX_KEYWORDS_V239 = Object.freeze(["仙丹", "ixora"]);
const BONSAI_FORM_KEYWORDS_V239 = Object.freeze(["矮霸", "盆景", "造型", "提根", "双干", "悬崖"]);

function hasExplicitBonsaiFormKeywordV239(name) {
  const compact = normalizeProductPrefixKeywordV181(name);
  return BONSAI_FORM_KEYWORDS_V239.some(keyword =>
    compact.includes(normalizeProductPrefixKeywordV181(keyword))
  );
}

function isAmbiguousBonsaiPrefixRuleV239(keyword) {
  const normalized = normalizeProductPrefixKeywordV181(keyword);
  return AMBIGUOUS_BONSAI_PREFIX_KEYWORDS_V239.some(item =>
    normalized === normalizeProductPrefixKeywordV181(item)
  );
}

function canAutoApplyBonsaiPrefixRuleV239(name, keyword) {
  // V24.6: species such as Ixora / 仙丹 may be either bonsai or ordinary nursery stock.
  // Only auto-classify the ambiguous species as bonsai when the product name carries
  // an explicit bonsai/form cue. Manual category selection remains available.
  if (!isAmbiguousBonsaiPrefixRuleV239(keyword)) return true;
  return hasExplicitBonsaiFormKeywordV239(name);
}

function findNamePrefixRuleV231(name) {
  const compact = normalizeProductPrefixKeywordV181(name);
  if (!compact) return null;
  const rules = getProductPrefixRulesV181();
  // Normal case: the entered product name contains the complete configured keyword.
  const direct = rules.find(([keyword]) =>
    compact.includes(normalizeProductPrefixKeywordV181(keyword)) &&
    canAutoApplyBonsaiPrefixRuleV239(name, keyword)
  );
  if (direct) return direct;
  // V24.6: while entering a NEW product, allow a meaningful partial keyword to
  // resolve a configured rule. Ambiguous bonsai/ordinary species still require
  // a form cue before they are auto-classified as bonsai.
  if (!isProductFuzzySearchReadyV238(name)) return null;
  return rules.find(([keyword]) =>
    normalizeProductPrefixKeywordV181(keyword).includes(compact) &&
    canAutoApplyBonsaiPrefixRuleV239(name, keyword)
  ) || null;
}

function getHistoricalProductCurrenciesV232(product) {
  if (!product) return [];
  const pid = String(product.id || "").trim();
  const pname = String(product.name || "").trim().toLowerCase();
  const batchById = new Map(getBatches().map(batch => [String(batch?.id || ""), batch]));
  const matches = getImports().filter(record => {
    const sameId = pid && String(record?.productId || "").trim() === pid;
    const sameName = !sameId && pname && String(record?.productName || "").trim().toLowerCase() === pname;
    return sameId || sameName;
  }).map(record => {
    const batch = batchById.get(String(record?.batchId || ""));
    const currency = String(record?.currency || batch?.currency || "").trim().toUpperCase();
    const stamp = Math.max(
      Date.parse(String(record?.updatedAt || "")) || 0,
      Date.parse(String(record?.createdAt || "")) || 0,
      parseDDMMYYYY(record?.arrivalDate || batch?.arrivalDate || ""),
      parseDDMMYYYY(record?.date || batch?.date || "")
    );
    return { currency, stamp };
  }).filter(item => item.currency);
  matches.sort((a,b) => b.stamp - a.stamp);
  const seen = new Set();
  return matches.map(item => item.currency).filter(currency => {
    if (seen.has(currency)) return false;
    seen.add(currency);
    return true;
  });
}

function getHistoricalProductCurrencyV231(product) {
  return getHistoricalProductCurrenciesV232(product)[0] || "";
}

function getRowSuggestedCurrencyV231(rowId) {
  const name = document.getElementById(`batchName-${rowId}`)?.value?.trim() || "";
  if (!name) return "";
  const row = document.querySelector(`#batchRows tr[data-row-id="${rowId}"]`);
  const product = findExactProductByNameV231(name);
  if (product) {
    const currencies = getHistoricalProductCurrenciesV232(product);
    if (currencies.length === 1) return currencies[0];
    if (currencies.length > 1) {
      const current = String(document.getElementById("batchCurrency")?.value || "").trim().toUpperCase();
      return currencies.includes(current) ? current : "";
    }
    return "";
  }
  return "";
}

function getOtherPopulatedRowsV231(rowId) {
  return Array.from(document.querySelectorAll("#batchRows tr"))
    .filter(row => Number(row.dataset.rowId) !== Number(rowId))
    .filter(row => String(document.getElementById(`batchName-${row.dataset.rowId}`)?.value || "").trim());
}

function maybeApplySuggestedBatchCurrencyV231(rowId, suggestedCurrency, label = "") {
  const wanted = String(suggestedCurrency || "").trim().toUpperCase();
  if (!wanted) return;
  const currency = document.getElementById("batchCurrency");
  if (!currency) return;
  const otherRows = getOtherPopulatedRowsV231(rowId);
  const otherSuggestions = [...new Set(otherRows.map(row => getRowSuggestedCurrencyV231(row.dataset.rowId)).filter(Boolean))];
  const conflict = otherSuggestions.find(value => value !== wanted);
  if (conflict) {
    const message = `${label || "这个产品"} 的历史／默认进口货币为 ${wanted}，但同批其他产品对应 ${conflict}。\n\n同一个进口编号只能使用一种货币。请统一整批货币，或把不同货币产品分开建立进口编号。`;
    const status = document.getElementById("batchStatusText");
    if (status) status.textContent = message.replace(/\n+/g, " ");
    // V26.6: user has already acknowledged this rule for the current import.
    // Do not interrupt every subsequent product row with the same warning.
    if (!batchCurrencyConflictAcknowledgedV249) {
      batchCurrencyConflictAcknowledgedV249 = true;
      window.alert(message);
    }
    return;
  }
  const currentRow = document.querySelector(`#batchRows tr[data-row-id="${rowId}"]`);
  if (currentRow) currentRow.dataset.lastCurrencyConflictV231 = "";
  if (!otherRows.length || otherSuggestions.every(value => value === wanted)) {
    currency.value = wanted;
    batchCurrencyManuallySelectedV229 = false;
    clearAutoArrivalWhenLeavingMYRV230();
    applyBatchRate();
    setTodayArrivalForMYRV229();
    if (typeof refreshAutoOriginalCostsForBatchV249 === "function") refreshAutoOriginalCostsForBatchV249();
  }
}

function applyExistingProductCurrencyV232(rowId, product, { commitCurrency = false } = {}) {
  // V33.9: historical currency is never scanned/applied during typing or selection.
  // Current purchase currency is decided only by explicit MYR selection or price threshold.
  return;
}

function getBatchCurrencyRateV249(currency) {
  const code = String(currency || "").trim().toUpperCase();
  if (!code || code === "MYR") return 1;
  const currentCurrency = String(document.getElementById("batchCurrency")?.value || "").trim().toUpperCase();
  if (code === currentCurrency) {
    const currentRate = parseAmount(document.getElementById("batchRate")?.value);
    if (Number.isFinite(currentRate) && currentRate > 0) return currentRate;
  }
  const saved = loadJSON("importSystemSettings", {});
  const defaults = { CNY: 1.60, NTD: 7.69, VND: 6300.00, IDR: 3571.00, MYR: 1.00 };
  const value = Number(saved?.[code] ?? defaults[code]);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function convertHistoricalOriginalCostForBatchV249(value, sourceCurrency, targetCurrency) {
  const amount = Math.max(0, Number(value) || 0);
  const source = String(sourceCurrency || "").trim().toUpperCase();
  const target = String(targetCurrency || "").trim().toUpperCase();
  if (!(amount > 0) || !source || !target || source === target) return amount;

  // V26.6 exchange-rate direction: the stored rate is foreign-currency units per
  // MYR. So foreign -> MYR divides, MYR -> foreign multiplies, and foreign ->
  // foreign converts through MYR. Examples: 920 CNY / 1.60 = RM575.00;
  // RM35.00 * 1.60 = CNY56.00.
  const sourceRate = getBatchCurrencyRateV249(source);
  const targetRate = getBatchCurrencyRateV249(target);
  const amountMYR = source === "MYR" ? amount : (sourceRate > 0 ? amount / sourceRate : amount);
  if (target === "MYR") return amountMYR;
  return targetRate > 0 ? amountMYR * targetRate : amount;
}

function setAutoOriginalCostV249(rowId, record, { force = false } = {}) {
  const field = document.getElementById(`batchPrice-${rowId}`);
  const row = document.querySelector(`#batchRows tr[data-row-id="${rowId}"]`);
  if (!field || !row || !record) return false;
  const current = parseAmount(field.value);
  if (!force && row.dataset.priceManuallyEditedV249 === "1") return false;
  if (!force && Number.isFinite(current) && current > 0 && row.dataset.autoOriginalCostV249 !== "1") return false;
  const sourceValue = Math.max(0, Number(record?.unitPrice) || 0);
  const sourceCurrency = String(record?.currency || "").trim().toUpperCase();
  if (!(sourceValue > 0)) return false;

  // V33.9: selecting a real existing product restores its historical unit price
  // exactly as stored. Never convert VND<->CNY amounts. Currency is then chosen
  // by the proven V22.6 price rule, except explicit local MYR purchases stay MYR.
  row.dataset.settingAutoPriceV249 = "1";
  field.value = formatMoney(sourceValue);
  delete row.dataset.settingAutoPriceV249;
  row.dataset.autoOriginalCostV249 = "1";
  row.dataset.autoOriginalCostSourceValueV249 = String(sourceValue);
  row.dataset.autoOriginalCostSourceCurrencyV249 = sourceCurrency;
  row.dataset.priceManuallyEditedV249 = "0";

  const currency = document.getElementById("batchCurrency");
  if (currency) {
    const wanted = sourceCurrency === "MYR" ? "MYR" : (sourceValue >= 100000 ? "VND" : "CNY");
    if (currency.value !== wanted) {
      maybeApplySuggestedBatchCurrencyV231(rowId, wanted, String(record?.productName || "这个产品"));
    } else {
      applyBatchRate();
      setTodayArrivalForMYRV229();
    }
  }
  return true;
}

function refreshAutoOriginalCostsForBatchV249() { calculateBatch(); }
window.refreshAutoOriginalCostsForBatchV249 = refreshAutoOriginalCostsForBatchV249;



function fillExistingProductOriginalCostV244(rowId, product, { force = false } = {}) {
  if (!product) return false;
  const record = getPreferredOriginalCostRecordV219(product);
  if (record) return setAutoOriginalCostV249(rowId, record, { force });
  return false;
}

function applyProductIdentityDefaultsV231(rowId, { fromCategoryChange = false, commitCurrency = false } = {}) {
  const tr = document.querySelector(`#batchRows tr[data-row-id="${rowId}"]`);
  const nameInput = document.getElementById(`batchName-${rowId}`);
  const categoryField = document.getElementById(`batchCategory-${rowId}`);
  const productIdField = document.getElementById(`batchProductId-${rowId}`);
  if (!tr || !nameInput || !categoryField || !productIdField) return;
  let name = String(nameInput.value || "").trim();
  let normalizedName = name.toLowerCase();
  if (!name) {
    const priceField = document.getElementById(`batchPrice-${rowId}`);
    productIdField.value = "";
    if (priceField && !currentEditingImportNumber) priceField.value = "";
    tr.dataset.autoOriginalCostV249 = "0";
    tr.dataset.autoOriginalCostSourceValueV249 = "";
    tr.dataset.autoOriginalCostSourceCurrencyV249 = "";
    tr.dataset.priceManuallyEditedV249 = "0";
    tr.dataset.categoryManualForName = "";
    tr.dataset.lastIdentityNameV231 = "";
    return;
  }

  const product = findExactProductByNameV231(name);
  if (product) {
    const matchedById = String(product?.id || "").trim().toLowerCase() === normalizedName &&
      String(product?.name || "").trim().toLowerCase() !== normalizedName;
    if (matchedById) {
      nameInput.value = String(product.name || name).trim();
      name = String(nameInput.value || "").trim();
      normalizedName = name.toLowerCase();
    }
    const identityChanged = tr.dataset.lastIdentityNameV231 !== normalizedName;
    productIdField.value = product.id || "";
    categoryField.value = normalizePrimaryProductCategoryV255(product.category);
    tr.dataset.categoryManualForName = normalizedName;
    tr.dataset.lastIdentityNameV231 = normalizedName;
    fillExistingProductOriginalCostV244(rowId, product, { force: identityChanged });
    const historicalCurrenciesV250 = getHistoricalProductCurrenciesV232(product);
    if (historicalCurrenciesV250.length) {
      applyExistingProductCurrencyV232(rowId, product, { commitCurrency });
    }
    return;
  }


  if (productIdField.value || tr.dataset.autoOriginalCostV249 === "1") {
    const priceField = document.getElementById(`batchPrice-${rowId}`);
    if (priceField && tr.dataset.priceManuallyEditedV249 !== "1") priceField.value = "";
    tr.dataset.autoOriginalCostV249 = "0";
    tr.dataset.autoOriginalCostSourceValueV249 = "";
    tr.dataset.autoOriginalCostSourceCurrencyV249 = "";
  }
  productIdField.value = "";
  const manualForSameName = tr.dataset.categoryManualForName === normalizedName;
  if (!fromCategoryChange && !manualForSameName) {
    const prefixRule = findNamePrefixRuleV231(name);
    categoryField.value = prefixRule ? "盆栽" : "其他";
  }
  tr.dataset.lastIdentityNameV231 = normalizedName;

  if (!commitCurrency) return;
  // V33.9: prefix rules generate product IDs only; they never decide purchase currency.
}

function addBatchRow(prefill = {}){
  const id=++batchRowSeq,tr=document.createElement("tr");
  tr.dataset.rowId=id;

  const storedOriginalQuantity = Number(prefill.originalQuantity);
  const hasStoredOriginalQuantity = Number.isFinite(storedOriginalQuantity) && storedOriginalQuantity >= 0;
  const storedRemainingQuantity = Number(prefill.remainingQuantity);
  const hasStoredRemainingQuantity = Number.isFinite(storedRemainingQuantity) && storedRemainingQuantity >= 0;
  if (hasStoredOriginalQuantity) {
    tr.dataset.originalQuantity = String(Math.floor(storedOriginalQuantity));
  }
  if (hasStoredRemainingQuantity) {
    tr.dataset.remainingQuantity = String(Math.floor(storedRemainingQuantity));
  }

  tr.innerHTML=`<td class="batch-product-cell">
    <input id="batchName-${id}"
           class="batch-name"
           placeholder="输入或选择产品"
           autocomplete="off"
           value="${escapeHTML(prefill.name || "")}">
    <div id="batchSuggestionBox-${id}"
         class="batch-product-suggestion-box"
         hidden></div>
    <input id="batchProductId-${id}"
           type="hidden"
           value="${escapeHTML(prefill.productId || "")}">
  </td>
  <td><input id="batchQty-${id}" inputmode="numeric" placeholder="0"></td>
  <td><input id="batchPrice-${id}" inputmode="decimal" placeholder="0.00"></td>
  <td><input id="batchPurchaseForeign-${id}" value="0.00" disabled></td>
  <td><select id="batchCategory-${id}">${productCategoryOptionsHTMLV227(prefill.category || "盆栽")}</select></td>
  <td><input id="batchStock-${id}" inputmode="numeric" placeholder="0" disabled></td>
  <td><input id="batchUnitCost-${id}" value="0.00" disabled></td>
  <td><button type="button" class="remove-item-btn" onclick="removeBatchRow(${id})">删除</button></td>`;
  document.getElementById("batchRows").appendChild(tr);
  document.getElementById(`batchCategory-${id}`).value =
    (prefill.category === "周边产品" ? "其他" : (prefill.category === "花盆" ? "花盆 / 配件 / 工具" : (prefill.category || "盆栽")));
  if (Number.isFinite(Number(prefill.quantity))) {
    const quantity = Math.max(0, Math.floor(Number(prefill.quantity)));
    const quantityInput = document.getElementById(`batchQty-${id}`);
    quantityInput.value = quantity;

    const remainingForDisplay = hasStoredRemainingQuantity
      ? Math.max(0, Math.floor(storedRemainingQuantity))
      : quantity;
    document.getElementById(`batchStock-${id}`).value = remainingForDisplay;

    if (hasStoredOriginalQuantity) {
      quantityInput.min = String(remainingForDisplay);
      quantityInput.setAttribute(
        "aria-label",
        `原进口数量；当前剩余 ${remainingForDisplay}。销售不会修改这里。`
      );
      if (prefill.lockOriginalQuantity === true) {
        quantityInput.readOnly = true;
        quantityInput.title = "原进口数量永久锁定；不能通过进口编号或 Data Repair 修改";
      } else {
        quantityInput.title = "原进口数量永久锁定；库存数量请使用页面下方编辑数量功能";
      }
    }
  }
  if (prefill.unitPrice) {
    document.getElementById(`batchPrice-${id}`).value =
      formatMoney(prefill.unitPrice);
  }
  attachBatchRowEvents(id);
  applyBatchCostEditability();
  calculateBatch();

  if (Number.isFinite(Number(prefill.unitCost))) {
    const unitCostField =
      document.getElementById(`batchUnitCost-${id}`);

    if (unitCostField) {
      unitCostField.value =
        formatMoney(Number(prefill.unitCost) || 0);
    }
  }
}

function positionBatchRowSuggestionBox(id) {
  const input = document.getElementById(`batchName-${id}`);
  const box = document.getElementById(`batchSuggestionBox-${id}`);
  if (!input || !box || box.hidden) return;

  // V26.6: keep suggestions in the table row's normal document flow. The row
  // expands while suggestions are visible, so the next product row is never covered.
  box.style.left = "";
  box.style.top = "";
  box.style.width = `${Math.max(input.offsetWidth || 0, 240)}px`;
}

let batchRowSearchBaseCacheV246 = null;
function getBatchRowSearchBaseV246() {
  const productsRaw = localStorage.getItem("importSystemProducts") || "[]";
  const importsRaw = localStorage.getItem("importSystemImports") || "[]";
  const batchesRaw = localStorage.getItem("importSystemBatches") || "[]";
  const cache = batchRowSearchBaseCacheV246;
  if (cache && cache.productsRaw === productsRaw && cache.importsRaw === importsRaw && cache.batchesRaw === batchesRaw) {
    return cache;
  }

  let products = [], imports = [], batches = [];
  try { products = JSON.parse(productsRaw); } catch (_) {}
  try { imports = JSON.parse(importsRaw); } catch (_) {}
  try { batches = JSON.parse(batchesRaw); } catch (_) {}
  if (!Array.isArray(products)) products = [];
  if (!Array.isArray(imports)) imports = [];
  if (!Array.isArray(batches)) batches = [];
  products = products.filter(product => !isHiddenLegacyProductIdV256(product?.id));

  const batchByNumber = new Map(batches.map(batch => [String(batch?.importNumber || "").trim().toLowerCase(), batch]));
  const shipmentByKey = new Map();
  const preferredByKey = new Map();
  const recordsByKey = new Map();
  const scoreRecord = (record, batch) => {
    const active = Math.max(0, Number(record?.remainingQuantity ?? record?.quantity) || 0) > 0 ? 1 : 0;
    const stamp = Date.parse(String(record?.updatedAt || record?.createdAt || "")) || parseDDMMYYYY(record?.arrivalDate || batch?.arrivalDate || record?.date || batch?.date || "") || 0;
    return active * 10**15 + stamp;
  };

  imports.forEach(record => {
    const idKey = String(record?.productId || "").trim().toLowerCase();
    const nameKey = String(record?.productName || "").trim().toLowerCase();
    const keys = [idKey ? `id:${idKey}` : "", nameKey ? `name:${nameKey}` : ""].filter(Boolean);
    const batch = batchByNumber.get(String(record?.importNumber || "").trim().toLowerCase()) || {};
    const shipment = String(record?.overseasTrackingNumber || batch?.overseasTrackingNumber || batch?.trackingNumber || "").trim();
    const score = scoreRecord(record, batch);
    keys.forEach(key => {
      if (!recordsByKey.has(key)) recordsByKey.set(key, []);
      recordsByKey.get(key).push(record);
      if (shipment) shipmentByKey.set(key, `${shipmentByKey.get(key) || ""} ${shipment}`.trim());
      const prev = preferredByKey.get(key);
      if (!prev || score > prev.score) preferredByKey.set(key, { record, batch, score });
    });
  });

  batchRowSearchBaseCacheV246 = { productsRaw, importsRaw, batchesRaw, products, imports, batches, batchByNumber, shipmentByKey, preferredByKey, recordsByKey };
  return batchRowSearchBaseCacheV246;
}

function getBatchRowSearchContextV246(value) {
  const base = getBatchRowSearchBaseV246();
  const originalCostQuery = parseOriginalCostSearchQueryV216(value);
  const costKeys = new Set();
  if (originalCostQuery !== null) {
    for (const [key, records] of base.recordsByKey.entries()) {
      if (records.some(record => originalCostNumberMatchesV216(record?.unitPrice, value))) costKeys.add(key);
    }
  }
  return { ...base, originalCostQuery, costKeys };
}

function renderBatchRowSuggestionBox(id) {
  const input = document.getElementById(`batchName-${id}`);
  const box = document.getElementById(`batchSuggestionBox-${id}`);
  if (!input || !box) return;
  const value = String(input.value || "").trim();
  if (!value) { hideBatchRowSuggestionBox(id); return; }

  const context = getBatchRowSearchContextV246(value);
  const normalizedQuery = normalizeSmartSearchText(value);
  const fuzzyReady = isProductFuzzySearchReadyV238(value);
  const codeQuery = /[a-z]/i.test(normalizedQuery) && /\d/.test(normalizedQuery) && normalizedQuery.length >= 3;
  const prefixQuery = /^[a-z]{2}$/i.test(String(value || "").trim());

  const matchedReal = [];
  for (const product of context.products) {
    const idRaw = String(product?.id || "").trim();
    const nameRaw = String(product?.name || "").trim();
    const categoryRaw = String(product?.category || "").trim();
    const englishRaw = productEnglishNameV262(product);
    const idNorm = normalizeSmartSearchText(idRaw);
    const nameNorm = normalizeSmartSearchText(nameRaw);
    const englishNorm = normalizeSmartSearchText(englishRaw);
    const categoryNorm = normalizeSmartSearchText(categoryRaw);
    const keys = [idRaw ? `id:${idRaw.toLowerCase()}` : "", nameRaw ? `name:${nameRaw.toLowerCase()}` : ""].filter(Boolean);
    let match = false;
    if (context.originalCostQuery !== null) match = keys.some(key => context.costKeys.has(key));
    else {
      if (idNorm && normalizedQuery.length >= 2 && idNorm.includes(normalizedQuery)) match = true;
      if (!match && nameNorm && nameNorm.includes(normalizedQuery)) match = true;
      if (!match && englishNorm && englishNorm.includes(normalizedQuery)) match = true;
      if (!match && prefixQuery && idNorm.slice(0, 2) === normalizedQuery) match = true;
      if (!match && codeQuery && (smartSearchMatches(`${nameRaw} ${englishRaw} ${idRaw}`, value) || sequentialSearchMatches(`${nameRaw} ${englishRaw} ${idRaw}`, value))) match = true;
      if (!match && fuzzyReady && (smartSearchMatches(`${nameRaw} ${englishRaw} ${idRaw} ${categoryRaw}`, value) || categoryNorm.includes(normalizedQuery))) match = true;
      if (!match && (fuzzyReady || codeQuery) && keys.some(key => shipmentLocalNumberMatchesV235(context.shipmentByKey.get(key) || "", value))) match = true;
    }
    if (!match) continue;
    let preferred = null;
    for (const key of keys) {
      const candidate = context.preferredByKey.get(key);
      if (candidate && (!preferred || candidate.score > preferred.score)) preferred = candidate;
    }
    matchedReal.push({ product, preferred });
    if (matchedReal.length >= 40) break;
  }
  matchedReal.sort((a, b) => String(a.product?.id || "").localeCompare(String(b.product?.id || "")));

  const compactQueryV237 = normalizeProductPrefixKeywordV181(value);
  const productNameSetV237 = new Set(matchedReal.map(item => String(item.product?.name || "").trim().toLowerCase()));
  const prefixSuggestionsV237 = (fuzzyReady || prefixQuery)
    ? getProductPrefixRulesV181().filter(([keyword, prefix]) => {
        const normalizedKeyword = normalizeProductPrefixKeywordV181(keyword);
        const normalizedPrefix = normalizeSmartSearchText(prefix);
        return ((fuzzyReady && normalizedKeyword.includes(compactQueryV237)) || normalizedPrefix === normalizedQuery)
          && canAutoApplyBonsaiPrefixRuleV239(value, keyword)
          && !productNameSetV237.has(String(keyword || "").trim().toLowerCase());
      }).slice(0, 12)
    : [];
  const categorySuggestionsV238 = [];
  if (!matchedReal.length && !prefixSuggestionsV237.length && !categorySuggestionsV238.length) {
    box.dataset.emptyV253 = "1";
    box.innerHTML = `<div class="batch-product-suggestion-empty">找不到符合“${escapeHTML(value)}”的产品</div>`;
  } else {
    delete box.dataset.emptyV253;
    box.innerHTML = matchedReal.map(({product, preferred}) => {
      const record = preferred?.record || null;
      const batch = preferred?.batch || {};
      const cost = Math.max(0, Number(record?.unitPrice) || 0);
      const currency = String(record?.currency || batch?.currency || "").trim().toUpperCase();
      const costLabel = cost > 0 ? ` · 原成本 ${formatMoney(cost)}${currency ? ` ${escapeHTML(currency)}` : ""}` : "";
      return `<button type="button" class="batch-product-suggestion-item" data-batch-suggestion="${escapeHTML(product.name)}">
        <strong>${escapeHTML(product.name)}</strong>${productEnglishNameV262(product)?`<span class="product-english-name-v262">${escapeHTML(productEnglishNameV262(product))}</span>`:""}
        <small>${escapeHTML(product.id || "-")} · ${escapeHTML(normalizePrimaryProductCategoryV255(product.category || "盆栽"))}${costLabel}</small>
      </button>`;
    }).join("") + prefixSuggestionsV237.map(([keyword, prefix]) => `
      <button type="button" class="batch-product-suggestion-item batch-prefix-rule-suggestion-v237" data-batch-suggestion="${escapeHTML(keyword)}">
        <strong>${escapeHTML(keyword)}</strong><small>${escapeHTML(prefix)} · 盆栽前缀规则</small>
      </button>`).join("");
  }
  box.hidden = false;
  positionBatchRowSuggestionBox(id);
}


function hideBatchRowSuggestionBox(id) {
  const box =
    document.getElementById(`batchSuggestionBox-${id}`);

  if (!box) return;

  box.hidden = true;
  delete box.dataset.emptyV253;
  box.style.left = "";
  box.style.top = "";
  box.style.width = "";
}

function attachBatchRowEvents(id){
  const n = document.getElementById(`batchName-${id}`);
  const box =
    document.getElementById(`batchSuggestionBox-${id}`);

  const applySelectedProduct = value => {
    n.value = String(value || "").trim();

    const product = getProducts().find(item =>
      String(item.name || "").toLowerCase() ===
      n.value.toLowerCase()
    );

    document.getElementById(`batchProductId-${id}`).value = product?.id || "";
    const tr = document.querySelector(`#batchRows tr[data-row-id="${id}"]`);
    if (tr) tr.dataset.categoryManualForName = "";
    applyProductIdentityDefaultsV231(id, { commitCurrency: true });
    fillExistingProductOriginalCostV244(id, product, { force: true });
    hideBatchRowSuggestionBox(id);
    calculateBatch();
  };

  let batchNameSearchTimerV246 = 0;
  let batchNameComposingV246 = false;
  const scheduleBatchNameSearchV246 = (delay = 90) => {
    window.clearTimeout(batchNameSearchTimerV246);
    batchNameSearchTimerV246 = window.setTimeout(() => {
      if (!String(n.value || "").trim()) { hideBatchRowSuggestionBox(id); calculateBatch(); return; }
      applyProductIdentityDefaultsV231(id, { commitCurrency: false });
      renderBatchRowSuggestionBox(id);
      calculateBatch();
    }, delay);
  };

  n.addEventListener("compositionstart", () => { batchNameComposingV246 = true; window.clearTimeout(batchNameSearchTimerV246); });
  n.addEventListener("compositionend", () => { batchNameComposingV246 = false; scheduleBatchNameSearchV246(20); });

  n.addEventListener("input", () => {
    let chars = Array.from(n.value);
    if (chars.length > 15) n.value = chars.slice(0, 15).join("");

    // V24.6: the keystroke path does no product/import/batch scans. Only clear
    // stale identity metadata synchronously, then search after the user pauses.
    const productIdField = document.getElementById(`batchProductId-${id}`);
    const tr = document.querySelector(`#batchRows tr[data-row-id="${id}"]`);
    if (productIdField && productIdField.value) {
      const rowPrice = document.getElementById(`batchPrice-${id}`);
      if (tr && tr.dataset.autoOriginalCostV249 === "1" && tr.dataset.priceManuallyEditedV249 !== "1" && rowPrice) rowPrice.value = "";
      if (tr) { tr.dataset.autoOriginalCostV249 = "0"; tr.dataset.autoOriginalCostSourceValueV249 = ""; tr.dataset.autoOriginalCostSourceCurrencyV249 = ""; }
    }
    if (productIdField) productIdField.value = "";
    const currentName = n.value.trim().toLowerCase();
    if (tr && tr.dataset.categoryManualForName && tr.dataset.categoryManualForName !== currentName) {
      tr.dataset.categoryManualForName = "";
    }

    if (!currentName) {
      const rowPrice = document.getElementById(`batchPrice-${id}`);
      if (rowPrice && !currentEditingImportNumber) rowPrice.value = "";
      if (tr) {
        tr.dataset.autoOriginalCostV249 = "0";
        tr.dataset.autoOriginalCostSourceValueV249 = "";
        tr.dataset.autoOriginalCostSourceCurrencyV249 = "";
        tr.dataset.priceManuallyEditedV249 = "0";
      }
      hideBatchRowSuggestionBox(id);
      calculateBatch();
      return;
    }
    if (!batchNameComposingV246) scheduleBatchNameSearchV246();
  });

  n.addEventListener("focus", () => {
    if (String(n.value || "").trim()) scheduleBatchNameSearchV246(0);
  });

  n.addEventListener("click", () => {
    if (String(n.value || "").trim()) scheduleBatchNameSearchV246(0);
  });

  const repositionSuggestion = () => {
    if (document.activeElement === n) {
      positionBatchRowSuggestionBox(id);
    }
  };

  window.addEventListener(
    "resize",
    repositionSuggestion
  );

  window.addEventListener(
    "scroll",
    repositionSuggestion,
    true
  );

  box?.addEventListener("mousedown", event => {
    event.preventDefault();
  });

  box?.addEventListener("click", event => {
    const button = event.target.closest(
      ".batch-product-suggestion-item"
    );

    if (!button) return;

    applySelectedProduct(
      button.dataset.batchSuggestion
    );
  });

  n.addEventListener("blur", () => {
    window.clearTimeout(batchNameSearchTimerV246);
    applyProductIdentityDefaultsV231(id, { commitCurrency: true });
    calculateBatch();
    window.setTimeout(() => {
      if (
        !box?.matches(":hover") &&
        !box?.contains(document.activeElement)
      ) {
        hideBatchRowSuggestionBox(id);
      }
    }, 320);
  });
  n.addEventListener("paste",e=>{e.preventDefault();const t=(e.clipboardData||window.clipboardData).getData("text").replace(/[\r\n\t]+/g," ").trim();n.value=Array.from(t).slice(0,15).join("");n.dispatchEvent(new Event("input",{bubbles:true}));});
  [`batchQty-${id}`,`batchPrice-${id}`].forEach(k=>{const x=document.getElementById(k);x.addEventListener("focus",()=>x.select());x.addEventListener("input",calculateBatch);x.addEventListener("blur",()=>{if(!k.includes("Qty")&&!k.includes("Stock"))formatInputAmount(x);calculateBatch();});});
  document.getElementById(`batchPrice-${id}`).addEventListener("input", () => {
    const row = document.querySelector(`#batchRows tr[data-row-id="${id}"]`);
    if (row && row.dataset.settingAutoPriceV249 !== "1") { row.dataset.priceManuallyEditedV249 = "1"; row.dataset.autoOriginalCostV249 = "0"; }
    const price = parseAmount(document.getElementById(`batchPrice-${id}`).value);
    const currency = document.getElementById("batchCurrency");
    if (currency && currency.value !== "MYR") {
      const wanted = price >= 100000 ? "VND" : "CNY";
      if (currency.value !== wanted) { currency.value = wanted; batchCurrencyManuallySelectedV229 = false; clearAutoArrivalWhenLeavingMYRV230(); applyBatchRate(); }
    }
    calculateBatch();
  });
  document.getElementById(`batchQty-${id}`).addEventListener("input", () => {
    // V20.6 R2: while editing an existing import, this field is the ORIGINAL
    // import quantity. Never mirror it into current stock/remaining quantity.
    if (currentEditingImportNumber || tr.dataset.remainingQuantity !== undefined) {
      const remaining = Number(tr.dataset.remainingQuantity);
      document.getElementById(`batchStock-${id}`).value = Number.isFinite(remaining)
        ? Math.max(0, Math.floor(remaining))
        : "";
      return;
    }
    const quantity = Math.max(0, Math.floor(parseAmount(document.getElementById(`batchQty-${id}`).value)));
    document.getElementById(`batchStock-${id}`).value = quantity || "";
  });
  document.getElementById(`batchCategory-${id}`).addEventListener("change", () => {
    const name = document.getElementById(`batchName-${id}`).value.trim().toLowerCase();
    const category = document.getElementById(`batchCategory-${id}`).value;
    const productIdField = document.getElementById(`batchProductId-${id}`);

    // V6.8: when repairing an existing import, category is a correction field,
    // not a product replacement. Keep the original productId so changing
    // 花盆 -> 盆栽 (or vice versa) cannot create a duplicate product/import.
    if (currentEditingImportNumber && getCostRepairModeEnabled()) {
      calculateBatch();
      return;
    }

    const product = getProducts().find(
      item => item.name.toLowerCase() === name && item.category === category
    );

    productIdField.value = product?.id || "";
    const tr = document.querySelector(`#batchRows tr[data-row-id="${id}"]`);
    if (tr) {
      tr.dataset.categoryManualForName = name;
    }
    applyProductIdentityDefaultsV231(id, { fromCategoryChange: true, commitCurrency: true });
    calculateBatch();
  });
}
function removeBatchRow(id){
  const rows=document.querySelectorAll("#batchRows tr");
  if(rows.length<=1){alert("至少保留一行。");return;}
  const row=document.querySelector(`#batchRows tr[data-row-id="${id}"]`);
  if(!row)return;
  const hasData=String(document.getElementById(`batchName-${id}`)?.value||"").trim() || Number(parseAmount(document.getElementById(`batchQty-${id}`)?.value))>0 || Number(parseAmount(document.getElementById(`batchPrice-${id}`)?.value))>0;
  if(hasData&&!window.confirm("⚠️ 删除这一行会丢失当前尚未正式保存的产品资料。\n\n确认删除吗？"))return;
  row.remove();calculateBatch();
}
function collectBatchRows(){
  const rate=parseAmount(document.getElementById("batchRate").value),currency=document.getElementById("batchCurrency").value;
  return Array.from(document.querySelectorAll("#batchRows tr")).map(tr=>{const id=Number(tr.dataset.rowId),name=document.getElementById(`batchName-${id}`).value.trim(),quantity=Math.max(0,Math.floor(parseAmount(document.getElementById(`batchQty-${id}`).value))),unitPrice=parseAmount(document.getElementById(`batchPrice-${id}`).value),stockAdded=quantity,foreignTotal=quantity*unitPrice,purchaseRM=rate>0?foreignTotal/rate:0,productId=document.getElementById(`batchProductId-${id}`).value,existing=getProducts().find(x=>x.id===productId),category=normalizePrimaryProductCategoryV255(document.getElementById(`batchCategory-${id}`).value||"盆栽"),preferredPrefixV240=getProductPrefix(category,name);return{id,name,englishName:String(tr.dataset.englishNameV262||productEnglishNameV262(existing)||inferSimpleBilingualV262(name).englishName||""),category,productId,preferredPrefixV240,quantity,unitPrice,stockAdded,currency,rate,foreignTotal,purchaseRM,oldStock:Number(existing?.stock)||0,oldAverage:Number(existing?.averageCost)||0};});
}
function calculateBatch() {
  updateTransitDays();

  const rows = collectBatchRows();
  const batchCurrenciesV229 = new Set(rows.filter(row => row.name).map(row => String(row.currency || "").trim().toUpperCase()).filter(Boolean));
  if (batchCurrenciesV229.size > 1) {
    const status = document.getElementById("batchStatusText");
    if (status) status.textContent = "同批进口只能使用一种货币；不同货币请分开建立进口编号。";
    return;
  }
  const isInventoryAdjustment = Boolean(currentEditingImportNumber);
  const valid = rows.filter(row =>
    row.name &&
    (isInventoryAdjustment ? row.quantity >= 0 : row.quantity > 0) &&
    row.unitPrice > 0
  );

  const batchRate = parseAmount(
    document.getElementById("batchRate").value
  );

  const totalPurchaseForeign = valid.reduce(
    (sum, row) => sum + row.foreignTotal,
    0
  );

  const chinaForeign = parseAmount(
    document.getElementById("batchChinaTransportCost").value
  );

  const potForeign = parseAmount(
    document.getElementById("batchPotCost").value
  );

  const foreignGrandTotal =
    totalPurchaseForeign +
    chinaForeign +
    potForeign;

  // V6.8 mapping field: inland miscellaneous cost is the two explicit
  // mainland cost items divided by the complete foreign-side batch total.
  // Keep this separate from inventory/Average Cost so stock movements never
  // rewrite the original import-cost mapping.
  const inlandMiscForeign = chinaForeign + potForeign;
  const inlandMiscRate = totalPurchaseForeign > 0
    ? (inlandMiscForeign / totalPurchaseForeign) * 100
    : 0;

  const inlandRateField = document.getElementById("batchInlandMiscRate");
  if (inlandRateField) {
    inlandRateField.value = `${inlandMiscRate.toFixed(2)}%`;
  }

  const allForeignCostsRM = batchRate > 0
    ? foreignGrandTotal / batchRate
    : 0;

  const shippingMY = parseAmount(
    document.getElementById("batchShippingMY").value
  );

  const shippingRate = allForeignCostsRM > 0
    ? (shippingMY / allForeignCostsRM) * 100
    : 0;

  valid.forEach(row => {
    const purchaseRM = batchRate > 0
      ? row.foreignTotal / batchRate
      : 0;

    const potRM = batchRate > 0
      ? (chinaForeign + potForeign) / batchRate : 0;

    const baseCost = purchaseRM + (potRM * (row.foreignTotal / totalPurchaseForeign));

    const itemTotal = baseCost * (1 + (shippingRate / 100));

    const stockAdded = row.quantity;
    const unitCost = stockAdded > 0
      ? itemTotal / stockAdded
      : 0;

    const newStock = row.oldStock + stockAdded;
    const newAverage = newStock > 0
      ? (
          (row.oldStock * row.oldAverage) +
          (stockAdded * unitCost)
        ) / newStock
      : unitCost;

    let direction = "-";
    if (row.oldStock === 0 && stockAdded > 0) {
      direction = "首次进货";
    } else if (unitCost > row.oldAverage) {
      direction = "Average Up";
    } else if (unitCost < row.oldAverage) {
      direction = "Average Down";
    } else if (stockAdded > 0) {
      direction = "持平";
    }

    Object.assign(row, {
      purchaseRM,
      itemTotal,
      stockAdded,
      unitCost,
      newStock,
      newAverage,
      direction
    });

    const foreignCell = document.getElementById(
      `batchPurchaseForeign-${row.id}`
    );
    if (foreignCell) foreignCell.value = formatMoney(row.foreignTotal);

    const unitCostCell = document.getElementById(
      `batchUnitCost-${row.id}`
    );
    if (unitCostCell) unitCostCell.value = formatMoney(unitCost);

    const stockCell = document.getElementById(
      `batchStock-${row.id}`
    );
    if (stockCell) {
      const tr = document.querySelector(`#batchRows tr[data-row-id="${row.id}"]`);
      const storedRemaining = Number(tr?.dataset?.remainingQuantity);
      stockCell.value = currentEditingImportNumber && Number.isFinite(storedRemaining)
        ? Math.max(0, Math.floor(storedRemaining))
        : (stockAdded || "");
    }
  });

  rows.filter(row => !valid.includes(row)).forEach(row => {
    const foreignCell = document.getElementById(
      `batchPurchaseForeign-${row.id}`
    );
    if (foreignCell) foreignCell.value = "0.00";

    const unitCostCell = document.getElementById(
      `batchUnitCost-${row.id}`
    );
    if (unitCostCell) unitCostCell.value = "0.00";

    const stockCell = document.getElementById(
      `batchStock-${row.id}`
    );
    if (stockCell) stockCell.value = "";
  });

  const totalQuantity = valid.reduce(
    (sum, row) => sum + row.quantity,
    0
  );

  const grandTotal = allForeignCostsRM + shippingMY;

  const foreignGrandTotalField =
    document.getElementById("batchForeignGrandTotal");
  if (foreignGrandTotalField) {
    foreignGrandTotalField.value =
      `${formatMoney(foreignGrandTotal)} ` +
      document.getElementById("batchCurrency").value;
  }

  const topForeign =
    document.getElementById("batchPurchaseTotalForeignTop");
  if (topForeign) {
    topForeign.textContent =
      `${formatMoney(totalPurchaseForeign)} ` +
      document.getElementById("batchCurrency").value;
  }

  const itemCount = document.getElementById("batchItemCount");
  if (itemCount) itemCount.textContent = valid.length;

  const quantityTotal =
    document.getElementById("batchQuantityTotal");
  if (quantityTotal) {
    quantityTotal.textContent = formatNumber(totalQuantity);
  }

  const quantityTop =
    document.getElementById("batchQuantityTop");
  if (quantityTop) {
    quantityTop.textContent = formatNumber(totalQuantity);
  }

  const foreignRM =
    document.getElementById("batchPurchaseTotalRM");
  if (foreignRM) {
    foreignRM.textContent =
      formatMoney(allForeignCostsRM, "RM ");
  }

  const shippingRateField =
    document.getElementById("batchShippingRate");
  if (shippingRateField) {
    shippingRateField.textContent =
      `${formatMoney(shippingRate)}%`;
  }

  const grandTotalField =
    document.getElementById("batchGrandTotalRM");
  if (grandTotalField) {
    grandTotalField.textContent =
      formatMoney(grandTotal, "RM ");
  }

  // V20.6 R3: outside Data Repair, editing an old import keeps its saved cost
  // snapshot. In Data Repair, cost inputs may preview corrected batch math.
  // Product name and historical original quantity remain permanently locked.
  if (currentEditingImportNumber && !getCostRepairModeEnabled()) {
    const storedBatch = getBatches().find(
      batch => batch.importNumber === currentEditingImportNumber
    );
    if (storedBatch) {
      restoreStoredBatchRMDisplay(
        storedBatch,
        getBatchItemsForDisplay(storedBatch)
      );
    }
  }

  return {
    valid,
    totalPurchaseForeign,
    foreignGrandTotal,
    totalPurchaseRM: allForeignCostsRM,
    chinaForeign,
    potForeign,
    inlandMiscForeign,
    inlandMiscRate,
    shippingMY,
    shippingRate,
    grandTotal,
    totalQuantity,
    transitDays: updateTransitDays()
  };
}


function clearBatchAfterSuccessfulAction() {
  resetBatchForm({
    clearLookup: true,
    clearStatus: false
  });

  const lookupInput = document.getElementById("batchLookupInput");
  if (lookupInput) lookupInput.value = "";

  setBatchEditMode("");
}

function saveBatchImport() {
  if (currentEditingImportNumber && !getCostRepairModeEnabled()) {
    alert("这个进口编号已经保存并锁定，只能阅读。\n\n如需修改允许的后续物流/马来西亚资料，请到设置开启 Data Repair。\n原成本单项修正请使用页面下方『输入产品或原成本可查询』专用入口。");
    return;
  }
  const status = document.getElementById("batchStatusText");
  if (!currentEditingImportNumber && !ensureDraftReadyForFormalSaveV243(status)) return;
  const result = calculateBatch();

  if (!result.valid.length) {
    status.textContent = "请至少完整输入一行产品。";
    return;
  }

  const names = result.valid.map(item => `${item.name.toLowerCase()}|${item.category}`);
  if (new Set(names).size !== names.length) {
    status.textContent = "同一批不能重复相同产品名称。";
    return;
  }

  const products = getProducts();
  const imports = getImports();
  const batches = getBatches();
  const today = formatDateDDMMYYYY(new Date());
  const isEditing = Boolean(currentEditingImportNumber);
  let pendingCostRevisionLogs = [];

  if (isEditing) {
    const batchIndex = batches.findIndex(
      batch => batch.importNumber === currentEditingImportNumber
    );
    if (batchIndex === -1) {
      status.textContent = "找不到原进口记录，无法更新库存。";
      return;
    }

    const oldBatch = batches[batchIndex];
    const oldItems = getBatchItemsForDisplay(oldBatch);
    const repairEnabled = getCostRepairModeEnabled();
    const stockTotalBeforeRepairV206 = products.reduce(
      (sum, product) => sum + Math.max(0, Number(product?.stock) || 0),
      0
    );
    const remainingByImportIdBeforeV206 = new Map(
      oldItems.map(item => [
        String(item?.id || `${item?.productId || ""}|${item?.productName || ""}`),
        Math.max(0, Number(item?.remainingQuantity ?? item?.quantity) || 0)
      ])
    );

    // V6.8: in Repair Mode, category is allowed to change because it does not
    // alter stock quantity or cost. Product identity remains locked by productId.
    const keyOf = item => {
      const productId = String(item.productId || "").trim();
      if (productId) return `id:${productId}`;
      return `name:${String(item.productName || item.name || "").trim().toLowerCase()}`;
    };
    const oldMap = new Map(oldItems.map(item => [keyOf(item), item]));
    const editedMap = new Map(result.valid.map(item => [keyOf({
      productId: item.productId,
      productName: item.name
    }), item]));

    if (oldMap.size !== editedMap.size || [...oldMap.keys()].some(key => !editedMap.has(key))) {
      status.textContent = repairEnabled
        ? "修改模式只允许修正原进口记录的资料，不能新增、删除或更换产品。"
        : "库存调整只能修改原进口记录内产品的剩余数量；如要修正类别或成本资料，请先到设置开启修改模式。";
      return;
    }

    const updatedItems = [];
    const categoryCorrections = new Map();
    for (const [key, oldItem] of oldMap.entries()) {
      const edited = editedMap.get(key);
      const oldCategory = String(oldItem.category || "盆栽");
      const requestedCategory = String(edited?.category || oldCategory);
      const nextCategory = oldCategory;

      if (requestedCategory !== oldCategory) {
        status.textContent = `${oldItem.productName || edited?.name || "此产品"} 的类别属于已保存核心资料，不能通过 Data Repair 修改。`;
        return;
      }

      const oldOriginalQuantity = getLockedBatchOriginalQuantity(oldItem);
      const oldRemainingRaw = Number(
        oldItem.remainingQuantity ?? oldItem.quantity
      );
      const oldRemaining = Number.isFinite(oldRemainingRaw)
        ? Math.min(
            oldOriginalQuantity,
            Math.max(0, Math.floor(oldRemainingRaw))
          )
        : oldOriginalQuantity;

      // V20.6 R3 HARD RULE: product name/identity and historical original
      // import quantity can NEVER be changed from an import-number edit,
      // including Data Repair. Current stock corrections use the dedicated
      // quantity tool at the bottom of the page.
      const parsedOriginal = Number(edited.quantity);
      if (Number.isFinite(parsedOriginal) && Math.floor(parsedOriginal) !== oldOriginalQuantity) {
        status.textContent = `${oldItem.productName || "此产品"} 的原进口数量已永久锁定，不能通过进口编号修改。`;
        return;
      }
      if (String(edited?.name || "").trim() !== String(oldItem.productName || "").trim()) {
        status.textContent = `${oldItem.productName || "此产品"} 的产品名称已锁定，不能通过进口编号修改。`;
        return;
      }
      const originalQuantity = oldOriginalQuantity;
      const newRemaining = oldRemaining;

      const productIndex = products.findIndex(product =>
        product.id === oldItem.productId ||
        (String(product.name || "").trim().toLowerCase() === String(oldItem.productName || "").trim().toLowerCase() &&
         product.category === oldItem.category)
      );
      const productBeforeEdit = productIndex !== -1 ? products[productIndex] : null;

      if (repairEnabled && nextCategory !== oldCategory && productBeforeEdit) {
        const duplicate = products.find((product, index) =>
          index !== productIndex &&
          String(product.name || "").trim().toLowerCase() === String(productBeforeEdit.name || "").trim().toLowerCase() &&
          String(product.category || "盆栽") === nextCategory
        );
        if (duplicate) {
          status.textContent = `${productBeforeEdit.name} 在「${nextCategory}」类别已经存在（${duplicate.id}），为避免合并错误，已停止保存。`;
          return;
        }
        categoryCorrections.set(String(productBeforeEdit.id || oldItem.productId || ""), nextCategory);
      }

      const matchingStoredImport = imports.find(record =>
        String(record.id || "") === String(oldItem.id || "") ||
        (
          String(record.batchId || record.importNumber || "") === String(oldBatch.id || oldBatch.importNumber || "") &&
          (
            (record.productId && oldItem.productId && String(record.productId) === String(oldItem.productId)) ||
            (
              String(record.productName || "").trim().toLowerCase() === String(oldItem.productName || "").trim().toLowerCase() &&
              String(record.category || "盆栽") === String(oldItem.category || "盆栽")
            )
          )
        )
      );

      const preservedUnitCost = resolveImportUnitCost(
        oldItem,
        oldBatch,
        productBeforeEdit,
        matchingStoredImport
      );

      if (!(preservedUnitCost > 0) && originalQuantity > 0) {
        status.textContent =
          `${oldItem.productName || edited.name || "此产品"} 的原始成本资料不完整，系统已停止保存，避免把Average Cost覆盖成0。请先从原进口费用恢复成本。`;
        return;
      }
      const preservedBatchTotal = [
        Number(oldItem.batchTotal),
        Number(matchingStoredImport?.batchTotal),
        preservedUnitCost > 0 ? preservedUnitCost * originalQuantity : 0
      ].find(value => Number.isFinite(value) && value > 0) || 0;

      // V20.6 R2 HARD RULE: editing/import-cost repair must NEVER move stock.
      // Sales/stock adjustments own Products.stock and remainingQuantity.
      if (productIndex !== -1 && nextCategory !== oldCategory) {
        products[productIndex] = {
          ...products[productIndex],
          category: nextCategory,
          updatedAt: new Date().toISOString()
        };
      }

      const oldUnitPrice = Math.max(0, Number(oldItem.unitPrice) || 0);
      const editedUnitPrice = Math.max(0, Number(edited.unitPrice) || 0);
      const nextUnitPrice = oldUnitPrice;
      if (!(nextUnitPrice > 0) && originalQuantity > 0) {
        status.textContent = `${oldItem.productName || "此产品"} 的原进口单价必须大于0。`;
        return;
      }
      const nextForeignTotal = originalQuantity * nextUnitPrice;
      updatedItems.push({
        ...oldItem,
        productName: oldItem.productName,
        productId: oldItem.productId,
        category: nextCategory,
        originalQuantity,
        quantity: originalQuantity,
        remainingQuantity: newRemaining,
        stockAdded: originalQuantity,
        unitPrice: nextUnitPrice,
        foreignTotal: nextForeignTotal,
        unitCost: preservedUnitCost,
        batchTotal: preservedBatchTotal,
        updatedAt: new Date().toISOString()
      });
    }

    const replacements = new Map(updatedItems.map(item => [String(item.id || ""), item]));
    for (let i = 0; i < imports.length; i += 1) {
      const replacement = replacements.get(String(imports[i].id || ""));
      if (replacement) imports[i] = replacement;
    }
    updatedItems.forEach(item => {
      if (!imports.some(record => String(record.id || "") === String(item.id || ""))) imports.push(item);
    });

    // V6.8: ordinary metadata updates always save. Cost fields only update when
    // Cost Repair Mode is explicitly enabled. This prevents accidental changes
    // while still allowing manual repair of historical batch-cost data.
    const updatedBatchMeta = {
      rackQuantity: Math.max(0, Math.floor(parseAmount(document.getElementById("batchRackQuantity").value))),
      trackingNumber: document.getElementById("batchTrackingNumber").value.trim(),
      overseasTrackingNumber: document.getElementById("batchOverseasTrackingNumber").value.trim(),
      containerDate: document.getElementById("batchContainerDate").value,
      arrivalDate: document.getElementById("batchArrivalDate").value,
      transitDays: updateTransitDays()
    };

    // V24.6: revision history records every allowed Data Repair field, not only costs.
    const repairLogTimeV222 = new Date().toLocaleString("zh-MY", { hour12: false });
    const addRepairLogV222 = (fieldLabel, before, after) => {
      if (String(before ?? "") === String(after ?? "")) return;
      pendingCostRevisionLogs.push({
        id: `REV${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
        timestamp: repairLogTimeV222,
        importNumber: oldBatch.importNumber,
        fieldLabel,
        before: String(before ?? "—"),
        after: String(after ?? "—")
      });
    };
    addRepairLogV222("木架数量", Math.max(0, Number(oldBatch.rackQuantity) || 0), updatedBatchMeta.rackQuantity);
    addRepairLogV222("运输单号", String(oldBatch.trackingNumber || "—"), updatedBatchMeta.trackingNumber || "—");
    addRepairLogV222("海外运输单号 / 本地单号", String(oldBatch.overseasTrackingNumber || "—"), updatedBatchMeta.overseasTrackingNumber || "—");
    addRepairLogV222("装柜日期", String(oldBatch.containerDate || "—"), updatedBatchMeta.containerDate || "—");
    addRepairLogV222("抵达日期", String(oldBatch.arrivalDate || "—"), updatedBatchMeta.arrivalDate || "—");
    addRepairLogV222("运输天数", String(oldBatch.transitDays ?? "—"), String(updatedBatchMeta.transitDays ?? "—"));

    let updatedCostSnapshot = {};
    let repairChangesCostV206 = false;
    if (repairEnabled) {
      // V24.6 Data Repair may change only the Malaysia-side overseas freight
      // among cost-bearing fields. China-side costs, original prices, currency
      // and exchange rate are immutable here.
      const nextChina = Number(oldBatch.chinaTransportCost) || 0;
      const nextPot = Number(oldBatch.potCost) || 0;
      const nextRate = Number(oldBatch.rate) || Number(oldItems.find(item => Number(item?.rate) > 0)?.rate) || 0;
      const nextShippingMY = Number(parseAmount(document.getElementById("batchShippingMY").value)) || 0;
      const oldShippingMY = Number(oldBatch.shippingMY) || 0;
      repairChangesCostV206 = Math.abs(oldShippingMY - nextShippingMY) > 0.000001;

      if (repairChangesCostV206) {
        const totalPurchaseForeign = updatedItems.reduce((sum, item) => {
          const originalQty = getLockedBatchOriginalQuantity(item);
          return sum + originalQty * Math.max(0, Number(item.unitPrice) || 0);
        }, 0);
        const foreignGrandTotal = totalPurchaseForeign + nextChina + nextPot;
        const totalForeignCostsRM = nextRate > 0 ? foreignGrandTotal / nextRate : 0;
        const nextInlandMiscForeign = nextChina + nextPot;
        const nextInlandMiscRate = totalPurchaseForeign > 0
          ? (nextInlandMiscForeign / totalPurchaseForeign) * 100
          : 0;
        const nextShippingRate = totalForeignCostsRM > 0
          ? (nextShippingMY / totalForeignCostsRM) * 100
          : 0;
        const nextGrandTotal = totalForeignCostsRM + nextShippingMY;

        updatedCostSnapshot = {
          shippingMY: nextShippingMY,
          shippingRate: nextShippingRate,
          totalForeignCostsRM,
          grandTotal: nextGrandTotal,
          inlandMiscForeign: Number(oldBatch.inlandMiscForeign ?? nextInlandMiscForeign) || nextInlandMiscForeign,
          inlandMiscRate: Number(oldBatch.inlandMiscRate ?? oldBatch.inlandMiscPercent ?? nextInlandMiscRate) || nextInlandMiscRate,
          inlandMiscPercent: Number(oldBatch.inlandMiscPercent ?? oldBatch.inlandMiscRate ?? nextInlandMiscRate) || nextInlandMiscRate,
          rate: nextRate
        };

        pendingCostRevisionLogs.push({
          id: `COSTREV${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
          timestamp: repairLogTimeV222,
          importNumber: oldBatch.importNumber,
          fieldLabel: "海外到大马运费（RM）",
          before: formatMoney(oldShippingMY),
          after: formatMoney(nextShippingMY)
        });

        const totalPurchaseForeignV205 = updatedItems.reduce((sum, item) =>
          sum + (getLockedBatchOriginalQuantity(item) * Math.max(0, Number(item.unitPrice) || 0)),
          0
        );
        const sharedForeignV205 = nextChina + nextPot;
        const rateV205 = nextRate;
        const shippingRateV205 = Number(updatedCostSnapshot.shippingRate) || 0;

        updatedItems.forEach((item, index) => {
          const originalQuantity = getLockedBatchOriginalQuantity(item);
          const foreignTotal = Number(item.foreignTotal) ||
            (originalQuantity * (Number(item.unitPrice) || 0));
          if (!(originalQuantity > 0) || !(rateV205 > 0) || !(totalPurchaseForeignV205 > 0)) return;

          const purchaseRM = foreignTotal / rateV205;
          const sharedRM = sharedForeignV205 / rateV205;
          const allocatedSharedRM = sharedRM * (foreignTotal / totalPurchaseForeignV205);
          const itemTotal = (purchaseRM + allocatedSharedRM) * (1 + shippingRateV205 / 100);
          const newUnitCost = itemTotal / originalQuantity;
          if (!Number.isFinite(newUnitCost) || newUnitCost < 0) return;

          const oldUnitCost = Math.max(0, Number(item.unitCost) || 0);
          const remainingQuantity = Math.max(0, Number(item.remainingQuantity) || 0);
          const productIndex = products.findIndex(product =>
            String(product.id || "") === String(item.productId || "") ||
            (String(product.name || "").trim().toLowerCase() === String(item.productName || "").trim().toLowerCase() &&
             String(product.category || "盆栽") === String(item.category || "盆栽"))
          );

          if (productIndex !== -1 && Math.abs(newUnitCost - oldUnitCost) > 0.000001 && remainingQuantity > 0) {
            const currentStock = Math.max(0, Number(products[productIndex].stock) || 0);
            const currentAverage = Math.max(0, Number(products[productIndex].averageCost) || 0);
            if (currentStock > 0) {
              const currentInventoryValue = currentStock * currentAverage;
              const adjustedInventoryValue = Math.max(0, currentInventoryValue +
                remainingQuantity * (newUnitCost - oldUnitCost));
              products[productIndex] = {
                ...products[productIndex],
                averageCost: adjustedInventoryValue / currentStock,
                updatedAt: new Date().toISOString()
              };
            }
          }

          updatedItems[index] = {
            ...item,
            rate: rateV205,
            foreignTotal,
            purchaseRM,
            inlandMiscRate: Number(updatedCostSnapshot.inlandMiscRate) || 0,
            inlandMiscPercent: Number(updatedCostSnapshot.inlandMiscPercent) || 0,
            shippingRate: shippingRateV205,
            unitCost: newUnitCost,
            batchTotal: itemTotal,
            updatedAt: new Date().toISOString()
          };
        });
      }
    }

    // V6.8: category correction follows the same productId through the
    // canonical Products / Imports / Batches collections. This changes labels
    // only; stock, remaining quantities, unit cost and Average Cost stay intact.
    if (repairEnabled && categoryCorrections.size) {
      imports.forEach(record => {
        const corrected = categoryCorrections.get(String(record.productId || ""));
        if (corrected) {
          record.category = corrected;
          record.updatedAt = new Date().toISOString();
        }
      });

      batches.forEach(batch => {
        if (!Array.isArray(batch.items)) return;
        batch.items = batch.items.map(item => {
          const corrected = categoryCorrections.get(String(item.productId || ""));
          return corrected
            ? { ...item, category: corrected, updatedAt: new Date().toISOString() }
            : item;
        });
      });
    }

    // V20.6: Cost Repair Mode now keeps item-level unitCost/batchTotal aligned
    // with the corrected batch cost snapshot; quantities and sales history stay unchanged.
    const mergedItems = updatedItems.map(item => ({
      ...item,
      rackQuantity: updatedBatchMeta.rackQuantity,
      trackingNumber: updatedBatchMeta.trackingNumber,
      overseasTrackingNumber: updatedBatchMeta.overseasTrackingNumber,
      containerDate: updatedBatchMeta.containerDate,
      arrivalDate: updatedBatchMeta.arrivalDate,
      transitDays: updatedBatchMeta.transitDays,
      ...(repairEnabled && repairChangesCostV206 ? {
        rate: updatedCostSnapshot.rate,
        inlandMiscRate: updatedCostSnapshot.inlandMiscRate,
        inlandMiscPercent: updatedCostSnapshot.inlandMiscPercent,
        shippingRate: updatedCostSnapshot.shippingRate
      } : {})
    }));

    const mergedItemMap = new Map(mergedItems.map(item => [String(item.id || ""), item]));
    for (let i = 0; i < imports.length; i += 1) {
      const merged = mergedItemMap.get(String(imports[i].id || ""));
      if (merged) imports[i] = merged;
    }

    batches[batchIndex] = {
      ...oldBatch,
      ...updatedBatchMeta,
      ...updatedCostSnapshot,
      items: mergedItems,
      totalQuantity: mergedItems.reduce(
        (sum, item) =>
          sum + getLockedBatchOriginalQuantity(item),
        0
      ),
      totalRemainingQuantity: mergedItems.reduce(
        (sum, item) => sum + (Number(item.remainingQuantity) || 0),
        0
      ),
      updatedAt: new Date().toISOString()
    };

    // V20.6 R2 hard safety gate: repair may change historical quantity/cost,
    // never current inventory. Abort before save if even one remaining quantity
    // or total Products.stock moved.
    for (const item of mergedItems) {
      const key = String(item?.id || `${item?.productId || ""}|${item?.productName || ""}`);
      const beforeRemaining = remainingByImportIdBeforeV206.get(key);
      const afterRemaining = Math.max(0, Number(item?.remainingQuantity) || 0);
      if (beforeRemaining !== undefined && Math.abs(beforeRemaining - afterRemaining) > 0.000001) {
        status.textContent = `安全检查失败：${item.productName || item.productId || "产品"} 当前剩余数量发生变化，已停止保存。`;
        return;
      }
    }
    const stockTotalAfterRepairV206 = products.reduce(
      (sum, product) => sum + Math.max(0, Number(product?.stock) || 0),
      0
    );
    if (Math.abs(stockTotalAfterRepairV206 - stockTotalBeforeRepairV206) > 0.000001) {
      status.textContent = `安全检查失败：修复前库存 ${formatNumber(stockTotalBeforeRepairV206)}，修复后 ${formatNumber(stockTotalAfterRepairV206)}。已停止保存。`;
      return;
    }

    const updateSummary = mergedItems.map(item => {
      const label = item.productName || item.name || item.productId || "产品";
      return `• ${label}：原进口 ${formatNumber(item.originalQuantity)}（锁定） · 当前剩余 ${formatNumber(item.remainingQuantity)}（不变）`;
    }).join("\n");
    if (!window.confirm(
      `⚠️ 最后确认保存 Data Repair 修改？\n\n进口编号：${oldBatch.importNumber}\n${updateSummary}\n\n永久锁：产品/类别、原进口数量、原成本、币种、汇率及内地核心费用不会修改。\n库存安全锁：当前库存总数 ${formatNumber(stockTotalBeforeRepairV206)} 保持不变；不会重复加入库存，Sales 历史与 remainingQuantity 不修改。\n只有按「确定」后才会真正保存。`
    )) {
      status.textContent = "已取消保存，资料没有写入";
      return;
    }

    appendCostRevisionHistory(pendingCostRevisionLogs);
    saveProducts(products);
    saveImports(imports);
    saveBatches(batches);
    renderBatchSuggestions();
    renderBatchList();
    renderInventoryManagementList();
    renderDashboard();
    renderImportHistory();

    clearBatchAfterSuccessfulAction();
    document.getElementById("batchStatusText").textContent =
      `已更新 ${currentEditingImportNumber || oldBatch.importNumber}。内地核心资料保持锁定；当前库存保持 ${formatNumber(stockTotalBeforeRepairV206)} 不变；${repairEnabled && repairChangesCostV206 ? "海外到大马运费已重算该批受影响产品单位成本与当前平均成本；" : "只更新后续物流资料，成本未重算；"}`;
    return;
  }

  const batchId = `BAT${Date.now()}`;
  const importNumber = generateImportNumber(
    document.getElementById("batchCurrency").value,
    document.getElementById("batchArrivalDate").value,
    batches
  );

  const newImportSummary = result.valid.map(item =>
    `• ${item.name}（${item.category}）：${formatNumber(item.quantity)}，单位成本 ${formatMoney(item.unitCost, "RM ")}`
  ).join("\n");
  if (!window.confirm(
    `⚠️ 最后确认保存新进口？\n\n即将生成进口编号：${importNumber}\n产品种类：${result.valid.length}\n总数量：${formatNumber(result.totalQuantity)}\n整批总成本：${formatMoney(result.grandTotal, "RM ")}\n\n${newImportSummary}\n\n保存会增加库存并写入 Products、Imports 与 Batches。\n只有按「确定」后才会真正保存。`
  )) {
    status.textContent = "已取消保存，资料没有写入";
    return;
  }

  const batch = {
    id: batchId,
    importNumber,
    date: today,
    rackQuantity: Math.max(0, Math.floor(parseAmount(document.getElementById("batchRackQuantity").value))),
    trackingNumber: document.getElementById("batchTrackingNumber").value.trim(),
    overseasTrackingNumber: document.getElementById("batchOverseasTrackingNumber").value.trim(),
    // V6.8: batch costs only come from current input. Never inherit from previous currency/product.
    chinaTransportCost: Number(parseAmount(document.getElementById("batchChinaTransportCost").value)) || 0,
    chinaTransportRM: 0,
    potCost: Number(parseAmount(document.getElementById("batchPotCost").value)) || 0,
    potRM: 0,
    // V6.8: explicit mapping fields for Pricing Suite.
    inlandMiscForeign: result.inlandMiscForeign,
    inlandMiscRate: result.inlandMiscRate,
    inlandMiscPercent: result.inlandMiscRate,
    currency: document.getElementById("batchCurrency").value,
    rate: parseAmount(document.getElementById("batchRate").value),
    containerDate: document.getElementById("batchContainerDate").value,
    arrivalDate: document.getElementById("batchArrivalDate").value,
    transitDays: result.transitDays,
    shippingMY: result.shippingMY,
    shippingRate: result.shippingRate,
    totalForeignCostsRM: result.totalPurchaseRM,
    grandTotal: result.grandTotal,
    totalQuantity: result.totalQuantity,
    totalRemainingQuantity: result.totalQuantity,
    itemCount: result.valid.length,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: []
  };

  result.valid.forEach(item => {
    // Prefer the already resolved Product ID so existing products are never duplicated.
    let productIndex = products.findIndex(product => item.productId && String(product.id || "") === String(item.productId || ""));
    if (productIndex === -1) {
      productIndex = products.findIndex(product =>
        product.name.toLowerCase() === item.name.toLowerCase() &&
        normalizePrimaryProductCategoryV255(product.category) === item.category
      );
    }
    if (productIndex === -1) {
      products.push({
        id: item.preferredPrefixV240 ? generateNextProductIdFromPrefixV240(products, item.preferredPrefixV240) : generateNextProductId(products, item.category, item.name), name: item.name,
        category: item.category, status: "启用", remark: "", stock: 0,
        averageCost: 0, englishName: item.englishName||"", lastImport: "", inventoryArchived: false,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      });
      productIndex = products.length - 1;
    }

    const product = products[productIndex];
    if (normalizeProductCategoryNameV227(product.category) !== item.category) {
      products[productIndex] = { ...product, category: item.category, updatedAt: new Date().toISOString() };
    }
    const activeProductV255 = products[productIndex];
    const oldStock = Number(activeProductV255.stock) || 0;
    const oldAverage = Number(activeProductV255.averageCost) || 0;
    const newStock = oldStock + item.stockAdded;
    const newAverage = newStock > 0
      ? ((oldStock * oldAverage) + (item.stockAdded * item.unitCost)) / newStock
      : item.unitCost;

    products[productIndex] = {
      ...activeProductV255, stock: newStock, averageCost: newAverage,
      inventoryArchived: false, lastImport: batch.arrivalDate || "",
      updatedAt: new Date().toISOString()
    };

    const record = {
      id: `IMP${Date.now()}${item.id}`, batchId, importNumber, date: today,
      productId: products[productIndex].id, productName: item.name,
      category: item.category, originalQuantity: item.quantity,
      quantity: item.quantity, remainingQuantity: item.quantity,
      unitPrice: item.unitPrice, currency: item.currency, rate: item.rate,
      foreignTotal: item.foreignTotal, purchaseRM: item.purchaseRM,
      inlandMiscRate: result.inlandMiscRate,
      inlandMiscPercent: result.inlandMiscRate,
      shippingRate: result.shippingRate, unitCost: item.unitCost,
      stockAdded: item.stockAdded, batchTotal: item.itemTotal,
      averageDirection: item.direction, rackQuantity: batch.rackQuantity,
      trackingNumber: batch.trackingNumber,
      overseasTrackingNumber: batch.overseasTrackingNumber,
      containerDate: batch.containerDate, arrivalDate: batch.arrivalDate,
      transitDays: batch.transitDays, createdAt: new Date().toISOString()
    };
    imports.push(record);
    batch.items.push(record);
  });

  batches.unshift(batch);
  {const meta=getProductLanguageMetaV262();result.valid.forEach(item=>{const p=products.find(x=>String(x.name||"").toLowerCase()===String(item.name||"").toLowerCase());if(p?.id&&item.englishName)meta[String(p.id).toUpperCase()]={chineseName:String(p.name||item.name||""),englishName:String(item.englishName||"")};});const st=loadJSON("importSystemSettings",{});saveJSON("importSystemSettings",{...st,[PRODUCT_LANGUAGE_META_KEY_V262]:meta});if(typeof markCloudSettingsSaved==="function")markCloudSettingsSaved();}
  saveProducts(products);
  saveImports(imports);
  saveBatches(batches);
  renderBatchSuggestions();
  renderBatchList();
  renderInventoryManagementList();
  renderDashboard();
  consumeActiveImportDraftV242();
  clearBatchAfterSuccessfulAction();
  const formalStateLabelV249 = document.getElementById("activeDraftLabelV242");
  if (formalStateLabelV249) {
    formalStateLabelV249.textContent = `已正式保存 · 已锁定 · ${importNumber}`;
    formalStateLabelV249.dataset.draftStateV249 = "formal";
  }
  document.getElementById("batchStatusText").textContent =
    `整批已保存，进口编号：${importNumber}。输入资料已自动清空。`;
}


function openBatchForEdit(importNumber) {
  const input = document.getElementById("batchLookupInput");
  input.value = importNumber;
  loadBatchByNumber();
  window.scrollTo({ top: 0, behavior: "smooth" });
}


function getBatchShippingRate(batch) {
  const storedRate = Number(batch?.shippingRate);

  if (Number.isFinite(storedRate) && storedRate > 0) {
    return storedRate;
  }

  const shippingMY = Number(batch?.shippingMY) || 0;

  if (shippingMY <= 0) {
    return 0;
  }

  let allForeignCostsRM =
    Number(batch?.totalForeignCostsRM) || 0;

  if (allForeignCostsRM <= 0) {
    const items = Array.isArray(batch?.items)
      ? batch.items
      : [];

    const currencyRate =
      Number(batch?.rate) ||
      Number(items.find(item => Number(item?.rate) > 0)?.rate) ||
      0;

    const productForeignTotal = items.reduce((sum, item) => {
      const foreignTotal = Number(item?.foreignTotal);

      if (Number.isFinite(foreignTotal) && foreignTotal > 0) {
        return sum + foreignTotal;
      }

      return sum +
        ((Number(item?.quantity) || 0) *
         (Number(item?.unitPrice) || 0));
    }, 0);

    const chinaTransportCost =
      Number(batch?.chinaTransportCost) || 0;

    const potCost =
      Number(batch?.potCost) || 0;

    const foreignGrandTotal =
      productForeignTotal +
      chinaTransportCost +
      potCost;

    if (currencyRate > 0 && foreignGrandTotal > 0) {
      allForeignCostsRM =
        foreignGrandTotal / currencyRate;
    }
  }

  if (allForeignCostsRM <= 0) {
    const grandTotal = Number(batch?.grandTotal) || 0;

    if (grandTotal > shippingMY) {
      allForeignCostsRM =
        grandTotal - shippingMY;
    }
  }

  return allForeignCostsRM > 0
    ? (shippingMY / allForeignCostsRM) * 100
    : 0;
}

function renderBatchList() {
  const allBatches = getBatches().slice().sort((a, b) => {
    const dateDiff =
      parseDDMMYYYY(b.containerDate || b.date || "") -
      parseDDMMYYYY(a.containerDate || a.date || "");

    if (dateDiff) return dateDiff;

    return String(b.createdAt || "")
      .localeCompare(String(a.createdAt || ""));
  });

  const searchInput = document.getElementById("batchSearch");
  const toggleButton = document.getElementById("toggleBatchListBtn");
  const listElement = document.getElementById("batchList");
  const keyword = String(searchInput?.value || "").trim().toLowerCase();

  if (!keyword && !batchListExpanded) {

    if (toggleButton) {
      toggleButton.hidden = !allBatches.length;
      toggleButton.textContent = "显示全部";
      toggleButton.setAttribute("aria-expanded", "false");
    }

    if (listElement) listElement.innerHTML = "";
    return;
  }

  const recentBatchArea =
    document.getElementById("recentBatchResultsArea");
  const productResults =
    document.getElementById("batchProductStockResults");
  const productStatus =
    document.getElementById("batchProductStockStatus");

  if (recentBatchArea) recentBatchArea.hidden = false;

  if (keyword) {
    if (productResults) {
      productResults.hidden = true;
      productResults.innerHTML = "";
    }

    if (productStatus) productStatus.textContent = "";
  }

  const filteredBatches = allBatches.filter(batch => {
    if (!keyword) return true;

    const items = getBatchItemsForDisplay(batch);
    const productText = items
      .map(item =>
        `${item?.productName || item?.name || ""} ` +
        `${item?.productId || ""} ${item?.category || ""}`
      )
      .join(" ");

    const originalCostMatchV216 =
      items.some(item => originalCostMatchesBatchItemV216(item, keyword));

    if (isOriginalCostOnlySearchV218(keyword)) {
      return originalCostMatchV216;
    }

    const numberOrTransportMatch =
      sequentialSearchMatches(batch.importNumber, keyword) ||
      shipmentLocalNumberMatchesV235(batch.trackingNumber, keyword) ||
      shipmentLocalNumberMatchesV235(batch.overseasTrackingNumber, keyword);

    const productMatch =
      smartSearchMatches(productText, keyword);

    return numberOrTransportMatch || productMatch;
  });

  const displayLimit = 10;
  const visibleBatches = batchListExpanded
    ? filteredBatches
    : filteredBatches.slice(0, displayLimit);

  if (toggleButton) {
    const canToggle = filteredBatches.length > displayLimit;
    toggleButton.hidden = !canToggle;
    toggleButton.textContent = batchListExpanded ? "收起" : "显示全部";
    toggleButton.setAttribute("aria-expanded", String(batchListExpanded));
  }

  if (!listElement) return;

  if (!filteredBatches.length) {
    listElement.innerHTML = keyword
      ? '<div class="empty-state">暂无符合的进口记录</div>'
      : '<div class="empty-state">暂无进口记录</div>';
    return;
  }

  listElement.innerHTML = visibleBatches.map(batch => {
    const items = getBatchItemsForDisplay(batch);
    const firstProductName =
      items[0]?.productName || items[0]?.name || "-";
    const firstProductId = String(items[0]?.productId || "").trim();
    const firstProductObj = getProducts().find(p=>String(p.id||"")===firstProductId);
    const firstProductEnglish = productEnglishNameV262(firstProductObj);

    return `<article class="import-card">
      <div class="batch-card-title-row">
        <div>
          <h4>${escapeHTML(batch.containerDate || batch.date || "-")} · ${Number(batch.itemCount) || items.length} 种产品</h4>
          <div class="import-number-line"><span>进口编号</span>${batch.importNumber ? `<button class="recent-batch-copy-value" type="button" data-copy-value="${escapeHTML(batch.importNumber)}" onclick="copyRecentBatchValue(this, '进口编号')" title="点击复制进口编号">${escapeHTML(batch.importNumber)}</button>` : `<strong>-</strong>`}</div>
        </div>
        <div class="batch-card-buttons">
          ${batch.importNumber ? `<button class="small-btn" type="button" onclick="copyBatchAsNewDraftV221('${escapeHTML(batch.importNumber)}')">复制</button>` : ""}
          ${batch.importNumber ? `<button class="small-btn delete-btn" type="button" data-delete-import-v251="${escapeHTML(batch.importNumber)}" onclick="deleteBatchByNumber('${escapeHTML(batch.importNumber)}')">删除</button>` : ""}
        </div>
      </div>
      <div class="product-code recent-import-summary-v167">
        ${Number(batch.totalQuantity) || 0} 件 · ${Number(batch.rackQuantity) || 0} 个木架 ·
        <span class="product-identity-v167 recent-import-identity-v167"><button type="button"
                class="inventory-product-name-copy recent-import-product-copy"
                data-product-name="${escapeHTML(firstProductName)}"
                onclick="copyInventoryProductName(this)"
                title="点击复制产品名称">${escapeHTML(firstProductName)}</button>${firstProductEnglish?`<small class="product-english-name-v262">${escapeHTML(firstProductEnglish)}</small>`:""}
        ${buildProductIdCopyButtonV166(firstProductId, "recent-import-product-id-v166")}
        </span>
      </div>
      <div class="import-card-meta">
        <div><span>运输天数</span><strong>${batch.transitDays ? `${batch.transitDays} 天` : "-"}</strong></div>
        <div><span>海外运费比例</span><strong>${formatMoney(getBatchShippingRate(batch))}%</strong></div>
        <div><span>进口总成本</span><strong>${formatMoney(batch.grandTotal, "RM ")}</strong></div>
        <div><span>运输单号</span>${(batch.overseasTrackingNumber || batch.trackingNumber) ? `<button class="recent-batch-copy-value recent-batch-tracking-copy" type="button" data-copy-value="${escapeHTML(extractTrackingNumberForCopy(batch.overseasTrackingNumber || batch.trackingNumber))}" onclick="copyRecentBatchValue(this, '运输单号')" title="点击只复制运输单号">${escapeHTML(batch.overseasTrackingNumber || batch.trackingNumber)}</button>` : `<strong>-</strong>`}</div>
      </div>
    </article>`;
  }).join("");
}

// ================= V24.6 Dedicated Original Cost Correction =================
let originalCostEditPendingV219 = null;

function getPreferredOriginalCostRecordV219(product, queryValue = "", explicitImportId = "") {
  const productId = String(product?.id || "").trim();
  const productName = String(product?.name || "").trim().toLowerCase();
  const explicitId = String(explicitImportId || "").trim();
  let rows = getImports().filter(record => {
    const sameId = productId && String(record?.productId || "").trim() === productId;
    const sameName = !sameId && productName && String(record?.productName || "").trim().toLowerCase() === productName;
    return sameId || sameName;
  });
  if (explicitId) {
    const exact = rows.find(record => String(record?.id || "").trim() === explicitId);
    if (exact) return exact;
  }
  if (isOriginalCostOnlySearchV218(queryValue)) {
    const numericMatches = rows.filter(record => originalCostNumberMatchesV216(record?.unitPrice, queryValue));
    if (numericMatches.length) rows = numericMatches;
  }
  const batches = getBatches();
  const batchById = new Map(batches.map(batch => [String(batch?.id || ""), batch]));
  const batchByNumber = new Map(batches.map(batch => [String(batch?.importNumber || "").trim().toLowerCase(), batch]));
  return rows.slice().sort((a, b) => {
    const activeA = Math.max(0, Number(a?.remainingQuantity ?? a?.quantity) || 0) > 0 ? 1 : 0;
    const activeB = Math.max(0, Number(b?.remainingQuantity ?? b?.quantity) || 0) > 0 ? 1 : 0;
    if (activeA !== activeB) return activeB - activeA;
    const batchA = batchById.get(String(a?.batchId || "")) || batchByNumber.get(String(a?.importNumber || "").trim().toLowerCase()) || {};
    const batchB = batchById.get(String(b?.batchId || "")) || batchByNumber.get(String(b?.importNumber || "").trim().toLowerCase()) || {};
    const timeA = Number(parseDDMMYYYY(getImportDisplayDate(a, batchA))) || Date.parse(a?.createdAt || "") || 0;
    const timeB = Number(parseDDMMYYYY(getImportDisplayDate(b, batchB))) || Date.parse(b?.createdAt || "") || 0;
    return timeB - timeA;
  })[0] || null;
}

function getIsolatedOriginalCostUnitCostV219(record, batch, nextOriginalCost) {
  const rate = Number(record?.rate) > 0 ? Number(record.rate) : (Number(batch?.rate) > 0 ? Number(batch.rate) : 0);
  if (!(rate > 0)) return null;

  const oldOriginalCost = Math.max(0, Number(record?.unitPrice) || 0);
  const oldUnitCost = Math.max(0, Number(record?.unitCost) || 0);
  const inlandRateCandidates = [record?.inlandMiscRate, record?.inlandMiscPercent, batch?.inlandMiscRate, batch?.inlandMiscPercent];
  const shippingRateCandidates = [record?.shippingRate, batch?.shippingRate];
  const inlandRate = inlandRateCandidates.map(Number).find(Number.isFinite);
  const shippingRate = shippingRateCandidates.map(Number).find(Number.isFinite);

  let multiplier = null;
  if (Number.isFinite(inlandRate) && Number.isFinite(shippingRate)) {
    multiplier = (1 + Math.max(0, inlandRate) / 100) * (1 + Math.max(0, shippingRate) / 100);
  } else if (oldOriginalCost > 0 && oldUnitCost > 0) {
    const oldPurchaseRMPerUnit = oldOriginalCost / rate;
    if (oldPurchaseRMPerUnit > 0) multiplier = oldUnitCost / oldPurchaseRMPerUnit;
  }
  if (!(multiplier > 0)) multiplier = 1;
  const nextUnitCost = (Math.max(0, Number(nextOriginalCost) || 0) / rate) * multiplier;
  return Number.isFinite(nextUnitCost) && nextUnitCost >= 0 ? { nextUnitCost, rate, multiplier } : null;
}

function hasUnsavedOriginalCostEditV219() {
  return Boolean(originalCostEditPendingV219?.dirty);
}

function closeOriginalCostEditorV219({ force = false } = {}) {
  if (!force && hasUnsavedOriginalCostEditV219()) {
    const leave = window.confirm("原成本已经修改但还没有保存。\\n\\n确定放弃这次修改？");
    if (!leave) return false;
  }
  document.getElementById("originalCostEditOverlayV219")?.remove();
  originalCostEditPendingV219 = null;
  return true;
}

function confirmLeaveOriginalCostEditV219() {
  if (!hasUnsavedOriginalCostEditV219()) return true;
  const leave = window.confirm("原成本已经修改但还没有保存。\\n\\n现在离开会丢失这次修改，确定离开？");
  if (!leave) return false;
  closeOriginalCostEditorV219({ force: true });
  return true;
}

function openProductOriginalCostEditorV219(productId, importRecordId = "") {
  const id = String(productId || "").trim();
  const product = getProducts().find(item => String(item?.id || "").trim() === id);
  if (!product) { alert("找不到这个产品。"); return; }
  const keyword = String(document.getElementById("batchProductStockSearch")?.value || "").trim();
  const record = getPreferredOriginalCostRecordV219(product, keyword, importRecordId);
  if (!record) { alert("找不到这个产品对应的进口原成本记录。"); return; }
  const batch = getBatches().find(item =>
    (record?.batchId && String(item?.id || "") === String(record.batchId)) ||
    String(item?.importNumber || "").trim().toLowerCase() === String(record?.importNumber || "").trim().toLowerCase()
  ) || {};
  const current = Math.max(0, Number(record?.unitPrice) || 0);
  const currency = String(record?.currency || batch?.currency || "").trim().toUpperCase();
  const importNumber = String(record?.importNumber || batch?.importNumber || "-").trim();

  document.getElementById("originalCostEditOverlayV219")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "originalCostEditOverlayV219";
  overlay.className = "original-cost-edit-overlay-v219";
  overlay.innerHTML = `
    <div class="original-cost-edit-dialog-v219" role="dialog" aria-modal="true" aria-labelledby="originalCostEditTitleV219">
      <h3 id="originalCostEditTitleV219">修改原成本</h3>
      <div class="original-cost-edit-meta-v219">
        <button type="button" class="original-cost-edit-product-copy-v224 inventory-product-name-copy"
          data-product-name="${escapeHTML(product.name || "未命名产品")}"
          onclick="copyInventoryProductName(this)" title="点击复制产品名称" aria-label="点击复制产品名称">${escapeHTML(product.name || "未命名产品")}</button>${productEnglishNameV262(product)?`<small class="product-english-name-v262">${escapeHTML(productEnglishNameV262(product))}</small>`:""}
        <span>${escapeHTML(product.id || "-")} · ${escapeHTML(importNumber)}</span>
      </div>
      <label>原成本${currency ? ` (${escapeHTML(currency)})` : ""}
        <input id="originalCostEditInputV219" type="text" inputmode="decimal" value="${escapeHTML(formatMoney(current))}" autocomplete="off">
      </label>
      <p>只修正这个产品在上述进口编号的原成本，并按该进口编号原有费用比例重算这个产品的平均成本。不会修改原进口数量、当前库存、进口编号或同批其他产品。</p>
      <div class="original-cost-edit-actions-v219">
        <button id="cancelOriginalCostEditV219" class="ghost-btn" type="button">取消</button>
        <button id="saveOriginalCostEditV219" class="primary-btn" type="button">确认保存</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const input = overlay.querySelector("#originalCostEditInputV219");
  originalCostEditPendingV219 = { productId: id, importRecordId: String(record?.id || ""), originalValue: current, dirty: false };
  input?.addEventListener("input", () => {
    const normalized = String(input.value || "").replace(/[,，\s]/g, "");
    const numeric = /^\d+(?:\.\d{0,6})?$/.test(normalized) ? Number(normalized) : NaN;
    originalCostEditPendingV219.dirty = !Number.isFinite(numeric) || Math.abs(numeric - current) > 0.000001;
  });
  input?.addEventListener("focus", () => input.select());
  overlay.querySelector("#cancelOriginalCostEditV219")?.addEventListener("click", () => closeOriginalCostEditorV219());
  overlay.querySelector("#saveOriginalCostEditV219")?.addEventListener("click", saveOriginalCostEditV219);
  input?.focus();
  input?.select();
}

async function saveOriginalCostEditV219() {
  const pending = originalCostEditPendingV219;
  const input = document.getElementById("originalCostEditInputV219");
  if (!pending || !input) return;
  const normalized = String(input.value || "").replace(/[,，\s]/g, "").trim();
  if (!/^\d+(?:\.\d{1,6})?$/.test(normalized)) {
    alert("原成本必须是0或正数，可输入小数。"); return;
  }
  const nextOriginalCost = Number(normalized);
  if (!Number.isFinite(nextOriginalCost) || nextOriginalCost < 0) { alert("原成本不正确。"); return; }
  if (Math.abs(nextOriginalCost - Number(pending.originalValue || 0)) < 0.000001) {
    closeOriginalCostEditorV219({ force: true }); return;
  }

  const previousProducts = getProducts();
  const previousImports = getImports();
  const previousBatches = getBatches();
  const productIndex = previousProducts.findIndex(item => String(item?.id || "") === String(pending.productId || ""));
  const importIndex = previousImports.findIndex(item => String(item?.id || "") === String(pending.importRecordId || ""));
  if (productIndex < 0 || importIndex < 0) { alert("资料已经改变，请同步后再试。"); return; }
  const product = previousProducts[productIndex];
  const record = previousImports[importIndex];
  const batchIndex = previousBatches.findIndex(item =>
    (record?.batchId && String(item?.id || "") === String(record.batchId)) ||
    String(item?.importNumber || "").trim().toLowerCase() === String(record?.importNumber || "").trim().toLowerCase()
  );
  const batch = batchIndex >= 0 ? previousBatches[batchIndex] : {};
  const recalculated = getIsolatedOriginalCostUnitCostV219(record, batch, nextOriginalCost);
  if (!recalculated) { alert("这个进口记录缺少有效汇率，无法安全重算平均成本。资料没有修改。"); return; }

  const currentOriginalCost = Math.max(0, Number(record?.unitPrice) || 0);
  const oldUnitCost = Math.max(0, Number(record?.unitCost) || 0);
  const newUnitCost = recalculated.nextUnitCost;
  const currentStock = Math.max(0, Number(product?.stock) || 0);
  const currentAverage = Math.max(0, Number(product?.averageCost) || 0);
  const remainingQuantity = Math.max(0, Number(record?.remainingQuantity ?? record?.quantity) || 0);
  const oldInventoryValue = currentStock * currentAverage;
  const costDelta = remainingQuantity * (newUnitCost - oldUnitCost);
  const newInventoryValue = Math.max(0, oldInventoryValue + costDelta);
  const newAverage = currentStock > 0 ? newInventoryValue / currentStock : currentAverage;
  const importNumber = String(record?.importNumber || batch?.importNumber || "-");
  const currency = String(record?.currency || batch?.currency || "").trim().toUpperCase();

  const warning = window.confirm(
    `⚠️ 原成本修正警告\\n\\n产品：${product.name}\\n进口编号：${importNumber}\\n原成本：${formatMoney(currentOriginalCost)} ${currency} → ${formatMoney(nextOriginalCost)} ${currency}\\n平均成本：${formatMoney(currentAverage, "RM ")} → ${formatMoney(newAverage, "RM ")}\\n\\n原进口数量、当前库存、进口编号及同批其他产品都不会改变。\\n\\n继续？`
  );
  if (!warning) return;
  const finalConfirmed = window.confirm(
    `最后确认保存？\\n\\n只会修正 ${product.name} 这一项原成本，并重算这个产品当前剩余库存对应的平均成本。`
  );
  if (!finalConfirmed) return;

  const now = new Date().toISOString();
  const nextProducts = previousProducts.map(item => ({ ...item }));
  const nextImports = previousImports.map(item => ({ ...item }));
  const nextBatches = previousBatches.map(item => ({ ...item, items: Array.isArray(item?.items) ? item.items.map(row => ({ ...row })) : [] }));

  nextProducts[productIndex] = { ...product, averageCost: newAverage, updatedAt: now };
  const correctedRecord = {
    ...record,
    unitPrice: nextOriginalCost,
    unitCost: newUnitCost,
    originalCostIsolatedV219: true,
    originalCostEditedAtV219: now,
    updatedAt: now
  };
  nextImports[importIndex] = correctedRecord;

  if (batchIndex >= 0) {
    const targetBatch = nextBatches[batchIndex];
    targetBatch.items = (targetBatch.items || []).map(item => {
      const sameId = record?.id && String(item?.id || "") === String(record.id);
      const sameProduct = String(item?.productId || "") === String(record?.productId || "");
      return (sameId || (!record?.id && sameProduct))
        ? { ...item, unitPrice: nextOriginalCost, unitCost: newUnitCost, originalCostIsolatedV219: true, originalCostEditedAtV219: now, updatedAt: now }
        : item;
    });
    targetBatch.updatedAt = now;
  }

  saveInventoryConsistencySnapshot(previousProducts, nextProducts, previousImports, nextImports, previousBatches, nextBatches);
  if (typeof invalidateMinimumPriceOriginIndexV160 === "function") invalidateMinimumPriceOriginIndexV160();
  appendCostRevisionHistory([{
    timestamp: now,
    importNumber,
    fieldLabel: `原成本 · ${product.name || "未命名产品"}`,
    before: `${formatMoney(currentOriginalCost)} ${currency}`,
    after: `${formatMoney(nextOriginalCost)} ${currency}`
  }, {
    timestamp: now,
    importNumber,
    fieldLabel: `${getAverageCostLabelV205(product)} · ${product.name || "未命名产品"}`,
    before: formatMoney(currentAverage, "RM "),
    after: formatMoney(newAverage, "RM ")
  }]);

  closeOriginalCostEditorV219({ force: true });
  [renderBatchProductStockResults, renderInventoryManagementList, renderDashboard, renderBatchList].forEach(fn => { try { fn(); } catch (_) {} });
  const status = document.getElementById("batchProductStockStatus");
  if (status) status.textContent = `已更新：${product.name} 原成本 ${formatMoney(nextOriginalCost)} ${currency}；平均成本 ${formatMoney(newAverage, "RM ")}`;
}

window.addEventListener("beforeunload", event => {
  if (!hasUnsavedOriginalCostEditV219()) return;
  event.preventDefault();
  event.returnValue = "";
});


async function promptProductOriginalCostEditorV257(productId, importRecordId = "") {
  const id = String(productId || "").trim();
  const product = getProducts().find(item => String(item?.id || "").trim() === id);
  if (!product) { alert("找不到这个产品。"); return; }
  const keyword = String(document.getElementById("batchProductStockSearch")?.value || "").trim();
  const record = getPreferredOriginalCostRecordV219(product, keyword, importRecordId);
  if (!record) { alert("找不到这个产品对应的进口原成本记录。"); return; }
  const batch = getBatches().find(item =>
    (record?.batchId && String(item?.id || "") === String(record.batchId)) ||
    String(item?.importNumber || "").trim().toLowerCase() === String(record?.importNumber || "").trim().toLowerCase()
  ) || {};
  const current = Math.max(0, Number(record?.unitPrice) || 0);
  const currency = String(record?.currency || batch?.currency || "").trim().toUpperCase();
  const importNumber = String(record?.importNumber || batch?.importNumber || "-").trim();

  const entered = window.prompt(
    `修改原成本：${product.name}\n\n产品编号：${product.id || "-"}\n进口编号：${importNumber}\n目前原成本：${formatMoney(current)}${currency ? ` ${currency}` : ""}\n请输入新的原成本`,
    current.toFixed(2)
  );
  if (entered === null) return;
  const normalized = String(entered).replace(/[,，\s]/g, "").trim();
  if (!/^\d+(?:\.\d{1,6})?$/.test(normalized)) {
    alert("原成本必须是0或正数，可输入小数。");
    return;
  }
  const nextOriginalCost = Number(normalized);
  if (!Number.isFinite(nextOriginalCost) || nextOriginalCost < 0) {
    alert("原成本不正确。");
    return;
  }
  if (Math.abs(nextOriginalCost - current) < 0.000001) {
    const status = document.getElementById("batchProductStockStatus");
    if (status) status.textContent = "原成本没有改变";
    return;
  }

  originalCostEditPendingV219 = {
    productId: id,
    importRecordId: String(record?.id || ""),
    originalValue: current,
    dirty: true
  };
  const tempInput = document.createElement("input");
  tempInput.type = "hidden";
  tempInput.id = "originalCostEditInputV219";
  tempInput.value = normalized;
  document.body.appendChild(tempInput);
  try {
    await saveOriginalCostEditV219();
  } finally {
    tempInput.remove();
    if (originalCostEditPendingV219) originalCostEditPendingV219 = null;
  }
}

function renderBatchProductStockResults() {
  const input = document.getElementById("batchProductStockSearch");
  const output = document.getElementById("batchProductStockResults");
  const status = document.getElementById("batchProductStockStatus");

  if (!input || !output) return;

  const keyword = String(input.value || "").trim().toLowerCase();
  const recentBatchArea =
    document.getElementById("recentBatchResultsArea");
  const toggleButton =
    document.getElementById("toggleBatchListBtn");

  if (status) status.textContent = "";

  if (!keyword) {
    output.hidden = true;
    output.innerHTML = "";

    if (recentBatchArea) recentBatchArea.hidden = false;
    if (toggleButton) toggleButton.hidden = false;

    renderBatchList();
    return;
  }

  if (recentBatchArea) recentBatchArea.hidden = true;
  if (toggleButton) toggleButton.hidden = true;

  const products = getOperationalProductsV256()
    .filter(product =>
      productSearchMatchesWithShipmentV235(
        `${product.id || ""} ${product.name || ""} ${productEnglishNameV262(product)} ${product.category || ""}`,
        product,
        keyword
      )
    )
    .sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "zh")
    );

  output.hidden = false;

  if (!products.length) {
    output.innerHTML =
      '<div class="empty-state">找不到这个产品名称</div>';
    return;
  }

  output.innerHTML = products.map(product => {
    const originalRecordV219 = getPreferredOriginalCostRecordV219(product, keyword);
    const batchV219 = originalRecordV219
      ? (getBatches().find(batch => String(batch?.importNumber || "").trim().toLowerCase() === String(originalRecordV219?.importNumber || "").trim().toLowerCase()) || {})
      : {};
    const currencyV219 = originalRecordV219
      ? String(originalRecordV219?.currency || batchV219?.currency || "").trim().toUpperCase()
      : "";
    const importNumberV256 = String(originalRecordV219?.importNumber || "").trim();
    const productIdV256 = String(product?.id || "").trim();

    return `
    <div class="product-stock-result-row product-stock-card-v256">
      <div class="product-stock-title-row-v256">
        <button
          class="product-stock-name-display product-stock-name-edit-btn product-stock-name-v256"
          type="button"
          data-product-id="${escapeHTML(productIdV256)}"
          aria-label="点击复制产品名称；长按修改产品名称" title="点击复制产品名称；长按修改产品名称">
          ${escapeHTML(product.name || "未命名产品")}
        </button>
        ${productIdV256 ? `<button type="button" class="product-stock-id-copy-v256"
          data-product-id-copy-v256="${escapeHTML(productIdV256)}"
          aria-label="点击复制产品编号；长按安全修改产品编号" title="点击复制产品编号；长按安全修改产品编号">${escapeHTML(productIdV256)}</button>` : ""}
      </div>
      <button type="button" class="product-stock-english-edit-btn-v266" data-product-id="${escapeHTML(productIdV256)}" title="点击复制英文名；长按修改英文名">${escapeHTML(productEnglishNameV262(product)||"英文名：未设置（长按修改）")}</button>

      <div class="product-stock-metrics-v256">
        <button
          class="product-stock-qty-btn product-stock-metric-v256"
          type="button"
          data-product-id="${escapeHTML(productIdV256)}"
          data-edit-type="stock"
          aria-label="长按修改当前库存" title="长按修改当前库存">
          <span>当前库存</span><strong>${formatNumber(Number(product.stock) || 0)}</strong>
        </button>

        ${originalRecordV219 ? `<button class="product-stock-original-cost-btn-v219 product-stock-metric-v256" type="button"
          data-product-id="${escapeHTML(productIdV256)}"
          data-import-record-id="${escapeHTML(originalRecordV219.id || "")}"
          data-edit-type="originalCost"
          aria-label="长按修改原成本" title="长按修改原成本；只重算该产品，不改变原进口数量或同批其他产品">
          <span>原成本</span><strong>${formatMoney(Number(originalRecordV219.unitPrice) || 0)}${currencyV219 ? ` ${escapeHTML(currencyV219)}` : ""}</strong>
        </button>` : `<div class="product-stock-original-cost-empty-v219 product-stock-metric-v256"><span>原成本</span><strong>-</strong></div>`}

        ${(()=>{const state=getMinimumPriceDisplayStateV315(product);const tone=state.state;return `<button
          class="product-stock-minimum-price-btn product-stock-metric-v256 product-stock-minimum-price-${tone}-v268 ${state.className}"
          type="button"
          data-minimum-price-state-v324="${state.state}"
          data-product-id="${escapeHTML(productIdV256)}"
          data-edit-type="minimumPrice"
          aria-label="长按修改最低售价" title="长按修改最低售价">
          <span>${state.label}</span><strong>${formatMoney(state.price, "RM ")}</strong>
        </button>`})()}

        <button
          class="product-stock-cost-btn product-stock-metric-v256"
          type="button"
          data-product-id="${escapeHTML(productIdV256)}"
          data-edit-type="averageCost"
          aria-label="长按修改平均成本" title="长按修改平均成本；VND 为不含盆成本">
          <span>${getAverageCostLabelV205(product)}</span><strong>${formatMoney(Number(product.averageCost) || 0, "RM ")}</strong>
        </button>
      </div>

      ${importNumberV256 ? `<div class="product-stock-import-row-v256"><span>进口编号</span><button type="button"
        class="product-stock-import-copy-v256" data-copy-value="${escapeHTML(importNumberV256)}"
        onclick="copyRecentBatchValue(this, '进口编号')" title="点击复制进口编号">${escapeHTML(importNumberV256)}</button></div>` : ""}

      ${buildProductPendingSalesHtmlV77(product)}
      ${buildProductAdjustmentNotesPanel(product)}
    </div>`;
  }).join("");

  bindProductStockNameEdit();
  bindProductIdSafeRenameV302();
  bindProductEnglishNameEditV266();
  bindProductStockLongPress();
  bindProductAdjustmentNoteEdit();
}


async function copyProductStockIdV256(button) {
  const value = String(button?.dataset?.productIdCopyV256 || button?.textContent || "").trim();
  if (!value) return;
  try { await navigator.clipboard.writeText(value); }
  catch (_) {
    const area = document.createElement("textarea");
    area.value = value; area.style.position = "fixed"; area.style.opacity = "0";
    document.body.appendChild(area); area.select(); document.execCommand("copy"); area.remove();
  }
  const original = button.textContent;
  button.textContent = "已复制";
  button.classList.add("copied");
  window.setTimeout(() => { if (button.isConnected) { button.textContent = original; button.classList.remove("copied"); } }, 900);
}
window.copyProductStockIdV256 = copyProductStockIdV256;


function editProductIdFromManagementV302(productId) {
  const oldId = String(productId || "").trim().toUpperCase();
  const products = getProducts();
  const index = products.findIndex(item => String(item?.id || "").trim().toUpperCase() === oldId);
  if (index < 0) { window.alert("找不到这个产品。"); return; }
  const product = products[index];
  const entered = window.prompt(`安全修改产品编号\n\n产品：${product.name || "未命名产品"}\n目前编号：${oldId}\n\n请输入新编号（例如 JU0036）：`, oldId);
  if (entered === null) return;
  const nextId = String(entered || "").trim().toUpperCase();
  if (!/^[A-Z]{2}\d{4}$/.test(nextId)) { window.alert("产品编号格式必须是2个英文字母＋4位数字，例如 JU0036。"); return; }
  if (nextId === oldId) return;
  if (products.some((item, i) => i !== index && String(item?.id || "").trim().toUpperCase() === nextId)) {
    window.alert(`编号 ${nextId} 已经被其他产品使用，不能修改。`); return;
  }
  const settingsBefore = loadJSON("importSystemSettings", {});
  const aliasesBefore = settingsBefore.productIdAliases || {};
  if (Object.keys(aliasesBefore).some(key => String(key).toUpperCase() === nextId) || Object.values(aliasesBefore).some(value => String(value).toUpperCase() === nextId && String(value).toUpperCase() !== oldId)) {
    window.alert(`编号 ${nextId} 已存在历史兼容映射，请先检查资料，系统没有修改。`); return;
  }
  if (!window.confirm(`⚠️ 产品编号安全迁移\n\n${product.name}\n${oldId} → ${nextId}\n\n系统会同步迁移现有 Import / Batch / 产品关联，并保留 ${oldId} → ${nextId} 的兼容别名。\n库存、平均成本、最低售价不会改变。\n\n继续？`)) return;
  if (!window.confirm(`最后确认：把 ${oldId} 改成 ${nextId}？\n\n旧编号 ${oldId} 仍会保留为历史兼容查询别名。`)) return;

  const importsBefore = getImports();
  const batchesBefore = getBatches();
  const nextProducts = replaceProductIdDeepV163(products, oldId, nextId);
  const nextImports = replaceProductIdDeepV163(importsBefore, oldId, nextId);
  const nextBatches = replaceProductIdDeepV163(batchesBefore, oldId, nextId);
  const nextSettings = replaceProductIdDeepV163(settingsBefore, oldId, nextId);
  nextSettings.productIdAliases = { ...(nextSettings.productIdAliases || {}), [oldId]: nextId };

  saveInventoryConsistencySnapshot(products, nextProducts, importsBefore, nextImports, batchesBefore, nextBatches);
  saveJSON("importSystemSettings", nextSettings);
  if (typeof markCloudSettingsSaved === "function") markCloudSettingsSaved();
  appendCostRevisionHistory([{timestamp:new Date().toLocaleString("zh-MY",{hour12:false}),importNumber:nextId,fieldLabel:`产品编号 · ${product.name || "未命名产品"}`,before:oldId,after:nextId}]);
  [renderBatchProductStockResults, renderInventoryManagementList, renderDashboard, renderBatchList].forEach(fn => { try { fn(); } catch (_) {} });
  if (typeof renderInventoryMasterV261 === "function") { try { renderInventoryMasterV261(); } catch (_) {} }
  const status = document.getElementById("batchProductStockStatus");
  if (status) status.textContent = `产品编号已安全迁移：${oldId} → ${nextId}；旧编号已保留兼容映射`;
}

function bindProductIdSafeRenameV302() {
  const output = document.getElementById("batchProductStockResults");
  if (!output || output.dataset.idRenameBoundV302 === "1") return;
  output.dataset.idRenameBoundV302 = "1";
  let timer = 0, button = null, sx = 0, sy = 0, moved = false, longPressed = false;
  const reset = () => { if (timer) window.clearTimeout(timer); timer = 0; button?.classList.remove("long-press-active"); button = null; moved = false; longPressed = false; };
  output.addEventListener("pointerdown", event => {
    const target = event.target.closest(".product-stock-id-copy-v256");
    if (!target || (event.pointerType === "mouse" && event.button !== 0)) return;
    reset(); button = target; sx = event.clientX; sy = event.clientY; button.classList.add("long-press-active");
    timer = window.setTimeout(() => { if (!button || moved) return; longPressed = true; const id = String(button.dataset.productIdCopyV256 || button.textContent || "").trim(); button.classList.remove("long-press-active"); editProductIdFromManagementV302(id); }, 650);
  });
  output.addEventListener("pointermove", event => { if (!button) return; if (Math.abs(event.clientX-sx)>12 || Math.abs(event.clientY-sy)>12) { moved=true; if(timer)window.clearTimeout(timer); timer=0; button.classList.remove("long-press-active"); } });
  output.addEventListener("pointerup", event => { if (!button) return; const target=button; const doCopy=!moved&&!longPressed; if(timer)window.clearTimeout(timer); timer=0; button=null; target.classList.remove("long-press-active"); moved=false; const wasLong=longPressed; longPressed=false; if(doCopy&&!wasLong) copyProductStockIdV256(target); });
  output.addEventListener("pointercancel", reset);
  output.addEventListener("contextmenu", event => { if (event.target.closest(".product-stock-id-copy-v256")) event.preventDefault(); });
  output.addEventListener("click", event => { if (!event.target.closest(".product-stock-id-copy-v256")) return; event.preventDefault(); event.stopPropagation(); });
}


function buildProductAdjustmentNotesPanel(product) {
  const adjustments = getProductStockAdjustments(product)
    .slice()
    .sort((a, b) => String(b?.createdAt || "").localeCompare(String(a?.createdAt || "")));

  const groups = [];
  const byKey = new Map();
  adjustments.forEach(adjustment => {
    const key = String(adjustment?.createdAt || adjustment?.id || "").trim();
    let group = byKey.get(key);
    if (!group) {
      group = { key, items: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.items.push(adjustment);
  });

  const rows = groups.map(group => {
    const first = group.items[0] || {};
    const totalDelta = group.items.reduce((sum, item) => sum + Math.trunc(Number(item?.delta) || 0), 0);
    const isNoteOnly = String(first?.adjustmentType || "").toLowerCase() === "note" && totalDelta === 0;
    const deltaText = totalDelta > 0 ? `+${formatNumber(totalDelta)}` : formatNumber(totalDelta);
    const notedItem = group.items.find(item => getUserVisibleAdjustmentNote(item));
    const note = getUserVisibleAdjustmentNote(notedItem);
    const importNumbers = [...new Set(group.items.map(item => String(item?.importNumber || "").trim()).filter(Boolean))];
    return `
      <div class="product-stock-note-row">
        <div class="product-stock-note-main">
          <strong>${escapeHTML(first?.date || "-")}</strong>
          <span>${isNoteOnly ? "备注" : `${escapeHTML(getHistoryAdjustmentLabel(first))} ${escapeHTML(deltaText)}`}</span>
          ${!isNoteOnly && importNumbers.length ? `<small>进口编号 ${escapeHTML(importNumbers.join(" / "))}</small>` : ""}
        </div>
        <div class="product-stock-note-text ${note ? "" : "is-empty"}">${note ? escapeHTML(note) : "—"}</div>
        <button type="button"
                class="product-stock-note-edit-btn"
                data-product-id="${escapeHTML(product?.id || "")}"
                data-adjustment-id="${escapeHTML(first?.id || "")}">
          修改
        </button>
      </div>`;
  }).join("");

  return `
    <details class="product-stock-notes-panel">
      <summary class="product-stock-notes-title">📝 备注记录 <span>${formatNumber(groups.length)} 笔 · 查看 / 修改</span></summary>
      <div class="product-stock-notes-list">
        ${rows || `<div class="product-stock-notes-empty">暂无备注记录</div>`}
        <div class="product-stock-note-add-wrap">
          <button type="button" class="product-stock-note-add-btn" data-product-id="${escapeHTML(product?.id || "")}">＋ 新增备注</button>
        </div>
      </div>
    </details>`;
}

function editProductAdjustmentNote(productId, adjustmentId) {
  const id = String(productId || "").trim();
  const adjId = String(adjustmentId || "").trim();
  const products = getProducts();
  const productIndex = products.findIndex(item => String(item?.id || "") === id);
  if (productIndex < 0) { alert("找不到这个产品。"); return; }

  const product = products[productIndex];
  const stockSnapshot = Math.max(0, Math.trunc(Number(product?.stock) || 0));
  const averageCostSnapshot = Number(product?.averageCost) || 0;
  const adjustments = getProductStockAdjustments(product);
  const adjustmentIndex = adjustments.findIndex(item => String(item?.id || "") === adjId);
  if (adjustmentIndex < 0) { alert("找不到这笔记录。"); return; }

  const adjustment = adjustments[adjustmentIndex];
  const currentNote = getUserVisibleAdjustmentNote(adjustment);
  const entered = window.prompt(
    `修改备注（只修改文字，不会改变库存）\n\n产品：${product.name}\n日期：${adjustment.date || "-"}\n\n请输入备注；留空可清除备注。`,
    currentNote
  );
  if (entered === null) return;
  const nextNote = String(entered || "").trim();
  if (nextNote === currentNote) return;

  const eventCreatedAt = String(adjustment?.createdAt || "").trim();
  const now = new Date().toISOString();
  const nextAdjustments = adjustments.map((item, index) => {
    const sameEvent = eventCreatedAt ? String(item?.createdAt || "").trim() === eventCreatedAt : index === adjustmentIndex;
    if (!sameEvent) return item;
    if (isInternalSystemAdjustmentNote(item?.note)) {
      return { ...item, remark: nextNote, updatedAt: now };
    }
    return { ...item, note: nextNote, remark: String(item?.remark || ""), updatedAt: now };
  });

  // V7.8 hard safety: note editing is metadata-only. Preserve inventory/accounting fields exactly.
  const nextProducts = products.map((item, index) => index === productIndex
    ? { ...item, stock: stockSnapshot, averageCost: averageCostSnapshot,
        stockAdjustments: nextAdjustments, stockAdjustmentsJson: JSON.stringify(nextAdjustments), updatedAt: now }
    : item
  );
  saveProducts(nextProducts);
  renderBatchProductStockResults();
  renderInventoryManagementList();
  renderDashboard();
  renderImportHistory();
  const status = document.getElementById("batchProductStockStatus");
  if (status) status.textContent = `已更新备注：${product.name}（库存仍为 ${stockSnapshot}）`;
}

function addStandaloneProductNote(productId) {
  const id = String(productId || "").trim();
  const products = getProducts();
  const productIndex = products.findIndex(item => String(item?.id || "") === id);
  if (productIndex < 0) { alert("找不到这个产品。"); return; }
  const product = products[productIndex];
  const entered = window.prompt(`新增产品备注（不会改变库存）\n\n产品：${product.name}\n\n请输入备注：`, "");
  if (entered === null) return;
  const note = String(entered || "").trim();
  if (!note) { alert("备注不能为空。"); return; }
  const now = new Date();
  const iso = now.toISOString();
  const existing = getProductStockAdjustments(product);
  const noteItem = {
    id: `NOTE${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
    date: formatDateDDMMYYYY(now), createdAt: iso, updatedAt: iso,
    importNumber: "", delta: 0, before: 0, after: 0,
    productStockBefore: Math.max(0, Math.trunc(Number(product.stock) || 0)),
    productStockAfter: Math.max(0, Math.trunc(Number(product.stock) || 0)),
    adjustmentType: "note", reason: "", note, salesLinks: [], soldUnitCost: 0
  };
  const nextAdjustments = [...existing, noteItem];
  const nextProducts = products.map((item, index) => index === productIndex
    ? { ...item, stockAdjustments: nextAdjustments, stockAdjustmentsJson: JSON.stringify(nextAdjustments), updatedAt: iso }
    : item
  );
  saveProducts(nextProducts);
  renderBatchProductStockResults();
  const status = document.getElementById("batchProductStockStatus");
  if (status) status.textContent = `已新增备注：${product.name}（库存数量未改变）`;
}

function bindProductAdjustmentNoteEdit() {
  const output = document.getElementById("batchProductStockResults");
  if (!output || output.dataset.noteEditBound === "1") return;
  output.dataset.noteEditBound = "1";
  output.addEventListener("click", event => {
    const editButton = event.target.closest(".product-stock-note-edit-btn");
    if (editButton) {
      event.preventDefault(); event.stopPropagation();
      editProductAdjustmentNote(editButton.dataset.productId, editButton.dataset.adjustmentId);
      return;
    }
    const addButton = event.target.closest(".product-stock-note-add-btn");
    if (addButton) {
      event.preventDefault(); event.stopPropagation();
      addStandaloneProductNote(addButton.dataset.productId);
    }
  });
}

function bindProductStockNameEdit() {
  // V7.3 Import/Edit bottom product search ONLY:
  // release before 650ms = copy; hold for 650ms = rename.
  // The action is decided on pointer timing itself instead of relying on a
  // synthetic click, which is unreliable after touch/long-press on mobile.
  const output = document.getElementById("batchProductStockResults");
  if (!output || output.dataset.nameEditBound === "1") return;
  output.dataset.nameEditBound = "1";

  let timer = null;
  let activeButton = null;
  let activePointerId = null;
  let startX = 0;
  let startY = 0;
  let moved = false;
  let longPressed = false;

  const clearTimer = () => {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
  };

  const resetPress = () => {
    clearTimer();
    activeButton?.classList.remove("long-press-active");
    activeButton = null;
    activePointerId = null;
    moved = false;
    longPressed = false;
  };

  const copyButtonName = button => {
    if (!button) return;
    const productId = String(button.dataset.productId || "");
    const product = getProducts().find(item => String(item.id || "") === productId);
    const productName = String(product?.name || button.textContent || "").trim();
    if (!productName) return;

    // V7.3: execute the copy directly inside pointerup's user gesture.
    // Mobile browsers can reject an awaited Clipboard API call after the gesture ends.
    let copied = false;
    const textarea = document.createElement("textarea");
    textarea.value = productName;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    document.body.appendChild(textarea);
    textarea.focus({ preventScroll: true });
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    try { copied = document.execCommand("copy"); } catch (error) { copied = false; }
    textarea.remove();

    const showCopied = () => {
      button.textContent = "已复制";
      button.classList.add("copied");
      window.setTimeout(() => {
        if (document.body.contains(button)) {
          const latest = getProducts().find(item => String(item.id || "") === productId);
          button.textContent = String(latest?.name || productName);
          button.classList.remove("copied");
        }
      }, 1200);
    };

    if (copied) {
      showCopied();
      return;
    }

    // Modern Clipboard fallback is still invoked immediately, without awaiting first.
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(productName).then(showCopied).catch(() => {});
    }
  };

  output.addEventListener("pointerdown", event => {
    const button = event.target.closest(".product-stock-name-edit-btn");
    if (!button || (event.pointerType === "mouse" && event.button !== 0)) return;
    resetPress();
    activeButton = button;
    activePointerId = event.pointerId;
    startX = Number(event.clientX) || 0;
    startY = Number(event.clientY) || 0;
    button.classList.add("long-press-active");
    timer = window.setTimeout(() => {
      timer = null;
      if (!activeButton || moved) return;
      longPressed = true;
      const id = String(activeButton.dataset.productId || "");
      activeButton.classList.remove("long-press-active");
      editProductNameFromImportPage(id);
    }, 650);
  });

  output.addEventListener("pointermove", event => {
    if (!activeButton || event.pointerId !== activePointerId) return;
    if (Math.abs((Number(event.clientX) || 0) - startX) > 12 ||
        Math.abs((Number(event.clientY) || 0) - startY) > 12) {
      moved = true;
      clearTimer();
      activeButton.classList.remove("long-press-active");
    }
  });

  output.addEventListener("pointerup", event => {
    if (!activeButton || event.pointerId !== activePointerId) return;
    const button = activeButton;
    const shouldCopy = !moved && !longPressed;
    clearTimer();
    button.classList.remove("long-press-active");
    activeButton = null;
    activePointerId = null;
    moved = false;
    longPressed = false;
    if (shouldCopy) copyButtonName(button);
  });

  output.addEventListener("pointercancel", event => {
    if (activePointerId !== null && event.pointerId !== activePointerId) return;
    resetPress();
  });

  output.addEventListener("contextmenu", event => {
    if (event.target.closest(".product-stock-name-edit-btn")) event.preventDefault();
  });

  // Prevent the browser's follow-up click from becoming a second action.
  output.addEventListener("click", event => {
    if (!event.target.closest(".product-stock-name-edit-btn")) return;
    event.preventDefault();
    event.stopPropagation();
  });
}

function editProductNameFromImportPage(productId) {
  const id = String(productId || "").trim();
  const products = getProducts();
  const productIndex = products.findIndex(product => String(product.id || "") === id);
  if (productIndex === -1) { alert("找不到这个产品。"); return; }
  const product = products[productIndex];
  const oldName = String(product.name || "").trim();
  const entered = window.prompt(`修改产品名称\n\n目前名称：${oldName}\n请输入新的产品名称`, oldName);
  if (entered === null) return;
  const nextName = String(entered).trim();
  if (!nextName) { alert("产品名称不能为空。"); return; }
  if (nextName === oldName) {
    const status = document.getElementById("batchProductStockStatus");
    if (status) status.textContent = "产品名称没有改变";
    return;
  }
  const duplicate = products.some((item, index) => index !== productIndex && String(item.name || "").trim().toLowerCase() === nextName.toLowerCase() && String(item.category || "") === String(product.category || ""));
  if (duplicate) { alert("同一类别已经有相同产品名称，不能修改。"); return; }
  if (!window.confirm(`确认修改产品名称？\n\n${oldName}\n→ ${nextName}\n\n只修改产品名称；进口编号、原成本、平均成本、最低售价及库存数量不会改变。`)) return;

  const imports = getImports();
  const batches = getBatches();
  const now = new Date().toISOString();
  const nextProducts = products.map((item, index) => index === productIndex ? { ...item, name: nextName, updatedAt: now } : item);
  const nextImports = imports.map(record => String(record.productId || "") === id ? { ...record, productName: nextName, updatedAt: now } : record);
  const nextBatches = batches.map(batch => {
    const items = Array.isArray(batch.items) ? batch.items : [];
    let changed = false;
    const nextItems = items.map(item => {
      if (String(item.productId || "") !== id) return item;
      changed = true;
      return { ...item, productName: nextName, ...(item.name !== undefined ? { name: nextName } : {}), updatedAt: now };
    });
    return changed ? { ...batch, items: nextItems, updatedAt: now } : batch;
  });
  saveInventoryConsistencySnapshot(products, nextProducts, imports, nextImports, batches, nextBatches);
  appendCostRevisionHistory([{
    id: `DATAREV${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toLocaleString("zh-MY", { hour12: false }),
    importNumber: id || "-",
    fieldLabel: `产品名称 · ${id || "未编号"}`,
    before: oldName,
    after: nextName
  }]);
  renderCostRevisionHistory();
  renderBatchProductStockResults();
  renderInventoryManagementList();
  renderDashboard();
  renderBatchList();
  renderImportHistory();
  const status = document.getElementById("batchProductStockStatus");
  if (status) status.textContent = `已修改产品名称：${oldName} → ${nextName}，正在同步 Google Sheet`;
}

function editProductEnglishNameFromImportPageV266(productId){
  const id=String(productId||"").trim();const product=getProducts().find(p=>String(p.id||"")===id);if(!product){alert("找不到这个产品。");return}
  const oldName=String(productEnglishNameV262(product)||"").trim();const entered=window.prompt(`修改产品英文名 / 第二栏\n\n目前英文名：${oldName||"（空白）"}\n请输入英文名；留空即可删除英文名。`,oldName);if(entered===null)return;const next=String(entered||"").trim();if(next===oldName)return;
  const meta=getProductLanguageMetaV262(),key=String(id).toUpperCase(),current={...(meta[key]||{})};if(next)current.englishName=next;else delete current.englishName;meta[key]=current;saveProductLanguageMetaV262(meta);renderBatchProductStockResults();renderInventoryManagementList();if(typeof renderInventoryMasterV261==="function")renderInventoryMasterV261();const status=document.getElementById("batchProductStockStatus");if(status)status.textContent=next?`已更新英文名：${product.name} → ${next}`:`已删除英文名：${product.name}`;
}
function bindProductEnglishNameEditV266(){const output=document.getElementById("batchProductStockResults");if(!output||output.dataset.englishEditBoundV266==="1")return;output.dataset.englishEditBoundV266="1";let timer=null,btn=null,moved=false,sx=0,sy=0,long=false;const reset=()=>{if(timer)clearTimeout(timer);timer=null;btn=null;moved=false;long=false};output.addEventListener("pointerdown",e=>{const b=e.target.closest(".product-stock-english-edit-btn-v266");if(!b)return;btn=b;sx=e.clientX;sy=e.clientY;moved=false;long=false;timer=setTimeout(()=>{if(!moved&&btn){long=true;editProductEnglishNameFromImportPageV266(btn.dataset.productId)}},650)});output.addEventListener("pointermove",e=>{if(!btn)return;if(Math.abs(e.clientX-sx)>12||Math.abs(e.clientY-sy)>12){moved=true;if(timer)clearTimeout(timer)}});output.addEventListener("pointerup",async e=>{if(!btn)return;const b=btn;if(timer)clearTimeout(timer);if(!moved&&!long){const p=getProducts().find(x=>String(x.id||"")===String(b.dataset.productId||""));const txt=String(productEnglishNameV262(p)||"").trim();if(txt){try{await navigator.clipboard.writeText(txt)}catch(_){}}}reset()});output.addEventListener("contextmenu",e=>{if(e.target.closest(".product-stock-english-edit-btn-v266"))e.preventDefault()})}

function bindProductStockLongPress() {
  // V6.8: product name uses ordinary click to rename in the Import/Edit search result.
  // Stock / minimum price / average cost continue to require a deliberate 650ms long press.
  // Moving more than 12px cancels the action, and ordinary click/tap never edits.
  const output = document.getElementById("batchProductStockResults");
  if (!output || output.dataset.longPressBound === "1") return;

  output.dataset.longPressBound = "1";

  let timer = null;
  let activeButton = null;
  let startX = 0;
  let startY = 0;
  let triggered = false;

  const cancel = () => {
    if (timer) {
      window.clearTimeout(timer);
      timer = null;
    }

    activeButton?.classList.remove("long-press-active");
    activeButton = null;
  };

  const start = event => {
    const button = event.target.closest(
      ".product-stock-qty-btn, .product-stock-minimum-price-btn, .product-stock-cost-btn, .product-stock-original-cost-btn-v219"
    );
    if (!button) return;

    const point = event.touches?.[0] || event;
    startX = Number(point.clientX) || 0;
    startY = Number(point.clientY) || 0;
    triggered = false;
    activeButton = button;
    button.classList.add("long-press-active");

    timer = window.setTimeout(() => {
      timer = null;
      triggered = true;
      button.classList.remove("long-press-active");

      const productId = String(button.dataset.productId || "");
      const editType = String(button.dataset.editType || "");

      if (editType === "stock") {
        editProductStockFromImportPage(productId);
      } else if (editType === "minimumPrice") {
        editProductMinimumPrice(productId);
      } else if (editType === "averageCost") {
        editProductAverageCostFromImportPage(productId);
      } else if (editType === "originalCost") {
        promptProductOriginalCostEditorV257(productId, String(button.dataset.importRecordId || ""));
      }
    }, 650);
  };

  const move = event => {
    if (!timer) return;

    const point = event.touches?.[0] || event;
    const movedX = Math.abs((Number(point.clientX) || 0) - startX);
    const movedY = Math.abs((Number(point.clientY) || 0) - startY);

    if (movedX > 12 || movedY > 12) cancel();
  };

  output.addEventListener("touchstart", start, { passive: true });
  output.addEventListener("touchmove", move, { passive: true });
  output.addEventListener("touchend", cancel, { passive: true });
  output.addEventListener("touchcancel", cancel, { passive: true });

  output.addEventListener("mousedown", event => {
    if (event.button !== 0) return;
    start(event);
  });
  output.addEventListener("mousemove", move);
  output.addEventListener("mouseup", cancel);
  output.addEventListener("mouseleave", cancel);

  output.addEventListener("contextmenu", event => {
    if (
      event.target.closest(
        ".product-stock-qty-btn, .product-stock-minimum-price-btn, .product-stock-cost-btn, .product-stock-original-cost-btn-v219"
      )
    ) {
      event.preventDefault();
    }
  });

  output.addEventListener("click", event => {
    const button = event.target.closest(
      ".product-stock-qty-btn, .product-stock-minimum-price-btn, .product-stock-cost-btn, .product-stock-original-cost-btn-v219"
    );
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();

    if (triggered) {
      triggered = false;
    }
  });
}


function getProductStockAdjustments(product) {
  const raw =
    product?.stockAdjustments ??
    product?.stockAdjustmentsJson ??
    [];

  if (Array.isArray(raw)) {
    return raw.filter(item => item && typeof item === "object");
  }

  try {
    const parsed = JSON.parse(String(raw || "[]"));
    return Array.isArray(parsed)
      ? parsed.filter(item => item && typeof item === "object")
      : [];
  } catch (error) {
    return [];
  }
}

function appendProductStockAdjustments(product, changes, changedAt, productStockBefore = null, productStockAfter = null, salesLinks = []) {
  const existing = getProductStockAdjustments(product);
  const timestamp = changedAt || new Date().toISOString();
  const date = formatDateDDMMYYYY(new Date(timestamp));
  const normalizedProductStockBefore = Number.isFinite(Number(productStockBefore))
    ? Math.max(0, Math.trunc(Number(productStockBefore)))
    : null;
  const normalizedProductStockAfter = Number.isFinite(Number(productStockAfter))
    ? Math.max(0, Math.trunc(Number(productStockAfter)))
    : null;

  const additions = (changes || [])
    .filter(change => Number(change?.delta) !== 0)
    .map((change, changeIndex) => ({
      id:
        `ADJ${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
      date,
      createdAt: timestamp,
      importNumber: String(change.importNumber || "").trim(),
      delta: Math.trunc(Number(change.delta) || 0),
      // V7.3: before/after remain the FIFO import-batch quantities for accounting.
      // productStockBefore/productStockAfter record the product's TOTAL inventory for History display only.
      before: Math.max(0, Math.trunc(Number(change.before) || 0)),
      after: Math.max(0, Math.trunc(Number(change.after) || 0)),
      productStockBefore: normalizedProductStockBefore,
      productStockAfter: normalizedProductStockAfter,
      adjustmentType: String(change.adjustmentType || "modify").trim().toLowerCase(),
      reason: String(change.reason || "").trim(),
      note: String(change.note || change.remark || "").trim(),
      // V7.8: link Sales System sale quantities only to the first FIFO adjustment row
      // of this inventory event, preventing double counting when one sale spans batches.
      salesLinks: changeIndex === 0 && Array.isArray(salesLinks)
        ? salesLinks.map(link => ({ ...link }))
        : [],
      soldUnitCost: String(change.adjustmentType || "").trim().toLowerCase() === "sale"
        ? Math.max(0, Number(change.soldUnitCost) || 0)
        : 0
    }));

  const next = [...existing, ...additions];

  return {
    stockAdjustments: next,
    stockAdjustmentsJson: JSON.stringify(next)
  };
}

function allocateProductRemainingFIFO(productId, productName, targetStock, adjustmentType = "modify", adjustmentReason = "", adjustmentNote = "") {
  const normalizedProductId = String(productId || "").trim();
  const normalizedProductName =
    String(productName || "").trim().toLowerCase();

  const isSameProduct = item => {
    const sameProductId =
      normalizedProductId &&
      item?.productId &&
      String(item.productId).trim() === normalizedProductId;

    const sameLegacyName =
      !sameProductId &&
      normalizedProductName &&
      String(item?.productName || item?.name || "")
        .trim()
        .toLowerCase() === normalizedProductName;

    return sameProductId || sameLegacyName;
  };

  const originalOf = item =>
    getSafeDisplayOriginalQuantity(item);

  const imports = getImports();
  const batches = getBatches();

  const matchingIndexes = imports
    .map((record, index) => ({ record, index }))
    .filter(entry => isSameProduct(entry.record));

  const cumulativeOriginal = matchingIndexes.reduce(
    (sum, entry) => sum + originalOf(entry.record),
    0
  );

  if (targetStock > cumulativeOriginal) {
    return {
      ok: false,
      message:
        `当前库存不能超过累计原进口数量 ${formatNumber(cumulativeOriginal)}。`
    };
  }

  const batchById = new Map(
    batches.map(batch => [String(batch.id || ""), batch])
  );
  const batchByImportNumber = new Map(
    batches.map(batch => [
      String(batch.importNumber || "").trim().toLowerCase(),
      batch
    ])
  );

  const datedEntries = matchingIndexes.map(entry => {
    const record = entry.record;
    const batch =
      batchById.get(String(record.batchId || "")) ||
      batchByImportNumber.get(
        String(record.importNumber || "").trim().toLowerCase()
      ) ||
      {};

    const arrivalDate =
      record.arrivalDate ||
      batch.arrivalDate ||
      "";
    const containerDate =
      record.containerDate ||
      batch.containerDate ||
      "";

    const arrivalTime = parseDDMMYYYY(arrivalDate);
    const containerTime = parseDDMMYYYY(containerDate);
    const createdTime = Date.parse(
      record.createdAt ||
      batch.createdAt ||
      ""
    );

    return {
      ...entry,
      batch,
      originalQuantity: originalOf(record),
      sortTime:
        arrivalTime ||
        containerTime ||
        (Number.isFinite(createdTime) ? createdTime : 0),
      importNumber:
        String(
          record.importNumber ||
          batch.importNumber ||
          ""
        ).trim()
    };
  }).sort((a, b) => {
    if (a.sortTime !== b.sortTime) return a.sortTime - b.sortTime;

    const createdA = String(
      a.record.createdAt || a.batch.createdAt || ""
    );
    const createdB = String(
      b.record.createdAt || b.batch.createdAt || ""
    );
    const createdCompare = createdA.localeCompare(createdB);
    if (createdCompare) return createdCompare;

    return a.importNumber.localeCompare(b.importNumber);
  });

  let quantityToDeduct = Math.max(
    0,
    cumulativeOriginal - targetStock
  );
  const now = new Date().toISOString();
  const nextImports = imports.slice();
  const remainingByRecord = new Map();
  const changesByImportNumber = new Map();

  datedEntries.forEach(entry => {
    const deducted = Math.min(
      entry.originalQuantity,
      quantityToDeduct
    );
    const remainingQuantity =
      entry.originalQuantity - deducted;
    const storedRemaining = Number(
      entry.record.remainingQuantity ??
      entry.record.quantity
    );
    const previousRemaining = Number.isFinite(storedRemaining)
      ? Math.min(
          entry.originalQuantity,
          Math.max(0, Math.floor(storedRemaining))
        )
      : entry.originalQuantity;

    quantityToDeduct -= deducted;
    remainingByRecord.set(entry.index, remainingQuantity);

    const importKey =
      String(entry.importNumber || "").trim().toLowerCase();
    const currentChange = changesByImportNumber.get(importKey) || {
      importNumber: entry.importNumber,
      before: 0,
      after: 0,
      delta: 0,
      adjustmentType,
      reason: adjustmentReason,
      note: String(adjustmentNote || "").trim(),
      soldUnitCost: 0
    };

    if (adjustmentType === "sale") {
      const importCost = Number(entry.record?.unitCost);
      const productAverage = Number(
        getProducts().find(p => String(p.id || "") === normalizedProductId)?.averageCost
      );
      const validImportCost = Number.isFinite(importCost) && importCost > 0;
      const validAverage = Number.isFinite(productAverage) && productAverage > 0;
      // Protect History from legacy/misaligned values such as Excel date serials.
      currentChange.soldUnitCost = validImportCost && (!validAverage || importCost <= productAverage * 10)
        ? importCost
        : (validAverage ? productAverage : (validImportCost ? importCost : 0));
    }

    currentChange.before += previousRemaining;
    currentChange.after += remainingQuantity;
    currentChange.delta =
      currentChange.after - currentChange.before;
    changesByImportNumber.set(importKey, currentChange);

    nextImports[entry.index] = {
      ...entry.record,
      originalQuantity: entry.originalQuantity,
      remainingQuantity,
      updatedAt: now
    };
  });

  const nextBatches = batches.map(batch => {
    let changed = false;

    const nextItems = (Array.isArray(batch.items) ? batch.items : [])
      .map(item => {
        if (!isSameProduct(item)) return item;

        const matchingEntry = datedEntries.find(entry => {
          const sameBatchId =
            batch.id &&
            entry.record.batchId &&
            String(entry.record.batchId) === String(batch.id);

          const sameImportNumber =
            batch.importNumber &&
            String(
              entry.record.importNumber || ""
            ).trim().toLowerCase() ===
            String(batch.importNumber)
              .trim()
              .toLowerCase();

          return sameBatchId || sameImportNumber;
        });

        if (!matchingEntry) return item;

        changed = true;

        return {
          ...item,
          originalQuantity:
            matchingEntry.originalQuantity,
          remainingQuantity:
            remainingByRecord.get(matchingEntry.index),
          updatedAt: now
        };
      });

    return changed
      ? {
          ...batch,
          items: nextItems,
          updatedAt: now
        }
      : batch;
  });

  return {
    ok: true,
    nextImports,
    nextBatches,
    cumulativeOriginal,
    changedAt: now,
    changes: Array.from(changesByImportNumber.values())
      .filter(change => change.delta !== 0)
  };
}

function saveInventoryConsistencySnapshot(previousProducts, nextProducts, previousImports, nextImports, previousBatches, nextBatches) {
  // V6.8: write the three related collections to localStorage first, then mark one sync snapshot.
  // This prevents the sync timer from observing a half-updated Products / Imports / Batches state.
  localStorage.setItem("importSystemProducts", JSON.stringify(nextProducts));
  localStorage.setItem("importSystemImports", JSON.stringify(nextImports));
  localStorage.setItem("importSystemBatches", JSON.stringify(nextBatches));

  if (typeof markCloudCollectionSaved === "function") {
    markCloudCollectionSaved("products", previousProducts, nextProducts);
    markCloudCollectionSaved("imports", previousImports, nextImports);
    markCloudCollectionSaved("batches", previousBatches, nextBatches);
  }
}

function chooseStockDecreaseType({ productName, currentStock, nextStock }) {
  return new Promise(resolve => {
    const old = document.getElementById("stockDecreaseTypeOverlay");
    if (old) old.remove();

    const decrease = Math.max(0, Number(currentStock || 0) - Number(nextStock || 0));
    const overlay = document.createElement("div");
    overlay.id = "stockDecreaseTypeOverlay";
    overlay.className = "stock-decrease-overlay";
    overlay.innerHTML = `
      <div class="stock-decrease-dialog" role="dialog" aria-modal="true" aria-labelledby="stockDecreaseTitle">
        <div id="stockDecreaseTitle" class="stock-decrease-title">请选择这次库存减少的原因</div>
        <div class="stock-decrease-summary">
          <strong>${escapeHTML(productName || "")}</strong><br>
          当前库存 ${formatNumber(currentStock)} → ${formatNumber(nextStock)}（减少 ${formatNumber(decrease)}）
        </div>
        <div class="stock-decrease-warning">⚠️ 请小心选择：只有「实际卖出」会计入 History 的卖出数量与卖出成本；「库存修正」只修正错误库存。</div>
        <div class="stock-decrease-actions">
          <button type="button" class="stock-decrease-sale">实际卖出</button>
          <button type="button" class="stock-decrease-repair">库存修正</button>
          <button type="button" class="stock-decrease-cancel">取消</button>
        </div>
      </div>`;

    const finish = value => {
      overlay.remove();
      resolve(value);
    };
    // V8.7: choosing the decrease type is not the final save confirmation.
    // The user must be able to enter the remark before the one final confirmation.
    overlay.querySelector(".stock-decrease-sale").addEventListener("click", () => finish("sale"));
    overlay.querySelector(".stock-decrease-repair").addEventListener("click", () => finish("repair"));
    overlay.querySelector(".stock-decrease-cancel").addEventListener("click", () => finish(null));
    overlay.addEventListener("click", event => { if (event.target === overlay) finish(null); });
    document.body.appendChild(overlay);
  });
}

async function editProductStockFromImportPage(productId) {
  const id = String(productId || "").trim();
  const products = getProducts();
  const productIndex = products.findIndex(
    product => String(product.id || "") === id
  );

  if (productIndex === -1) {
    alert("找不到这个产品。");
    return;
  }

  const product = products[productIndex];
  const currentStock = Math.max(0, Number(product.stock) || 0);
  const entered = window.prompt(
    `修改当前库存：${product.name}\n\n请输入新的当前库存数量`,
    String(currentStock)
  );

  if (entered === null) return;

  const normalized = String(entered).replace(/,/g, "").trim();

  if (!/^\d+$/.test(normalized)) {
    alert("库存数量必须是0或正整数。");
    return;
  }

  const nextStock = Number(normalized);

  if (!Number.isSafeInteger(nextStock) || nextStock < 0) {
    alert("库存数量不正确。");
    return;
  }

  if (nextStock === currentStock) {
    const status = document.getElementById("batchProductStockStatus");
    if (status) status.textContent = "库存数量没有改变";
    return;
  }

  // V8.7: do not confirm the quantity before choosing the action / entering the remark.
  // There is one final confirmation after the remark is entered.
  let adjustmentType = "modify";
  let adjustmentReason = nextStock > currentStock ? "库存新增" : "库存修改";

  if (nextStock < currentStock) {
    const classification = await chooseStockDecreaseType({
      productName: product.name,
      currentStock,
      nextStock
    });
    if (!classification) return;
    adjustmentType = classification;
    adjustmentReason = classification === "sale" ? "实际卖出" : "库存修正";
  }

  let matchedSalesLinksV77 = [];
  if (adjustmentType === "sale") {
    if (!salesInventoryFeedLoadedV77) {
      await refreshSalesInventoryFeedV77({ silent: true });
    }
    if (!salesInventoryFeedLoadedV77) {
      const continueWithoutLinkV77 = window.confirm(
        "目前无法读取 Sales System 待处理销售。\n\n继续保存『实际卖出』不会影响库存，但这次记录暂时无法自动核销 Sales 提醒。\n\n是否继续？"
      );
      if (!continueWithoutLinkV77) return;
    }
    const decreaseQtyV77 = Math.max(0, currentStock - nextStock);
    matchedSalesLinksV77 = allocatePendingSalesForProductV77(product, decreaseQtyV77);
    if (matchedSalesLinksV77.length) {
      const matchedQtyV77 = matchedSalesLinksV77.reduce((sum, link) => sum + Math.max(0, Number(link.processedQty) || 0), 0);
      const extraTextV77 = matchedQtyV77 < decreaseQtyV77
        ? `\n\n其中 ${formatNumber(matchedQtyV77)} 棵会核销 Sales System 提醒；另外 ${formatNumber(decreaseQtyV77 - matchedQtyV77)} 棵没有对应 Sales 记录。`
        : "";
      const salesConfirmedV77 = window.confirm(
        `检测到 Sales System 待处理销售：\n\n${describeSalesAllocationsV77(matchedSalesLinksV77)}${extraTextV77}\n\n确认把这次「实际卖出」与以上 Sales 记录对应？`
      );
      if (!salesConfirmedV77) return;
    }
  }

  const noteEntered = window.prompt(
    `备注（可选）\n\n产品：${product.name}\n类型：${adjustmentReason}\n库存：${formatNumber(currentStock)} → ${formatNumber(nextStock)}\n\n可输入：直播卖出、门市、Fair、送礼物给ABC 等。\n留空后按 OK = 不填写备注；Cancel = 取消本次库存修改。`,
    ""
  );
  if (noteEntered === null) return;
  const adjustmentNote = String(noteEntered || "").trim();

  const quantityChange = nextStock - currentStock;
  const actionText = adjustmentType === "sale"
    ? `实际卖出 -${formatNumber(Math.abs(quantityChange))}`
    : adjustmentType === "repair"
      ? `库存修正 -${formatNumber(Math.abs(quantityChange))}`
      : quantityChange > 0
        ? `库存新增 +${formatNumber(quantityChange)}`
        : `库存修改 ${formatNumber(quantityChange)}`;
  const noteText = adjustmentNote || "—";
  const finalConfirmed = window.confirm(
    `确认保存？\n\n产品：${product.name}\n操作：${actionText}\n库存：${formatNumber(currentStock)} → ${formatNumber(nextStock)}\n备注：${noteText}`
  );
  if (!finalConfirmed) return;

  const previousImports = getImports();
  const previousBatches = getBatches();
  const allocation = allocateProductRemainingFIFO(
    product.id,
    product.name,
    nextStock,
    adjustmentType,
    adjustmentReason,
    adjustmentNote
  );

  if (!allocation.ok) {
    alert(allocation.message);
    return;
  }

  const adjustmentData = appendProductStockAdjustments(
    product,
    allocation.changes,
    allocation.changedAt,
    currentStock,
    nextStock,
    matchedSalesLinksV77
  );

  products[productIndex] = {
    ...product,
    ...adjustmentData,
    stock: nextStock,
    inventoryArchived:
      nextStock > 0 ? false : product.inventoryArchived,
    updatedAt: allocation.changedAt || new Date().toISOString()
  };

  saveInventoryConsistencySnapshot(
    getProducts(),
    products,
    previousImports,
    allocation.nextImports,
    previousBatches,
    allocation.nextBatches
  );
  appendCostRevisionHistory([{
    id: `DATAREV${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toLocaleString("zh-MY", { hour12: false }),
    importNumber: product.id || "-",
    fieldLabel: `当前库存 · ${product.name || "未命名产品"}`,
    before: formatNumber(currentStock),
    after: formatNumber(nextStock)
  }]);
  renderCostRevisionHistory();
  renderBatchProductStockResults();
  renderInventoryManagementList();
  renderDashboard();
  renderBatchList();
  recomputeSalesInventoryPendingV77();
  renderSalesInventoryReminderV77();

  const status = document.getElementById("batchProductStockStatus");
  if (status) {
    status.textContent =
      `已更新：${product.name} 当前库存 ${formatNumber(nextStock)}`;
  }
}


function normalizeMinimumPriceInput(value) {
  const normalized = String(value ?? "")
    .replace(/RM/gi, "")
    .replace(/,/g, "")
    .trim();

  if (normalized === "") return 0;
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const number = Number(normalized);
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.round((number + Number.EPSILON) * 100) / 100;
}

async function editDisplayedMinimumPriceV199(productId) {
  // V33.9: direct minimum-price edits are always the product's manual minimum price.
  // Manual prices have highest priority and are never changed by Profit Management.
  return editProductMinimumPrice(String(productId || "").trim());
}


async function editProductMinimumPrice(productId) {
  const id = String(productId || "").trim();
  const products = getProducts();
  const productIndex = products.findIndex(product => String(product.id || "") === id);
  if (productIndex === -1) {
    alert("找不到这个产品。");
    return;
  }

  const product = products[productIndex];
  const currentMinimumPrice = Math.max(0, Number(product.minimumPrice) || 0);
  const currentMinimumPriceManual = isMinimumPriceManualV160(product);
  const entered = window.prompt(
    `修改最低售价：${product.name}\n\n目前最低售价：${formatMoney(currentMinimumPrice, "RM ")}\n请输入新的最低售价（最多2位小数）\n输入0或清空后确认 = 按平均成本自动计算`,
    currentMinimumPrice.toFixed(2)
  );
  if (entered === null) return;

  const enteredMinimumPrice = normalizeMinimumPriceInput(entered);
  if (enteredMinimumPrice === null) {
    alert("最低售价必须是0或正数，最多2位小数。");
    return;
  }
  const restoreAutomatic = enteredMinimumPrice === 0;
  const nextMinimumPrice = restoreAutomatic
    ? getAutomaticMinimumPriceV160(product.averageCost, null, product)
    : enteredMinimumPrice;
  const nextMinimumPriceManual = !restoreAutomatic;
  if (Math.abs(nextMinimumPrice - currentMinimumPrice) < 0.005 &&
      nextMinimumPriceManual === currentMinimumPriceManual) {
    const status = document.getElementById("batchProductStockStatus");
    if (status) status.textContent = "最低售价没有改变";
    return;
  }

  const confirmed = window.confirm(
    `确认修改最低售价？\n\n产品：${product.name}\n目前：${formatMoney(currentMinimumPrice, "RM ")}\n修改为：${formatMoney(nextMinimumPrice, "RM ")}\n\n${restoreAutomatic ? "保存后按平均成本自动计算；VND 产品会按原进口单价加入花盆成本。" : "保存后采用本次手动价格。"}\n最低售价不会改变库存数量、平均成本或库存总值。`
  );
  if (!confirmed) return;

  if (typeof updateProductMinimumPriceFast !== "function") {
    alert("最低售价快速同步功能尚未载入，请刷新网页后再试。");
    return;
  }

  const updatedAt = new Date().toISOString();
  products[productIndex] = {
    ...product,
    minimumPrice: nextMinimumPrice,
    minimumPriceManual: nextMinimumPriceManual,
    updatedAt
  };
  const minimumPriceOverrides = { ...getMinimumPriceManualOverridesV160() };
  minimumPriceOverrides[id] = nextMinimumPriceManual;
  saveMinimumPriceManualOverridesV160(minimumPriceOverrides);

  // V6.8 fast path: save one local Products value without marking
  // the whole database snapshot dirty. Server writes only two cells.
  saveJSON("importSystemProducts", products);
  renderBatchProductStockResults();
  renderInventoryManagementList();
  renderDashboard();

  const status = document.getElementById("batchProductStockStatus");
  if (status) status.textContent = `同步中：${product.name} 最低售价 ${formatMoney(nextMinimumPrice, "RM ")}`;

  try {
    await updateProductMinimumPriceFast(id, nextMinimumPrice, updatedAt, nextMinimumPriceManual);
    appendCostRevisionHistory([{
      id: `DATAREV${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toLocaleString("zh-MY", { hour12: false }),
      importNumber: product.id || "-",
      fieldLabel: `最低售价 · ${product.name || "未命名产品"}`,
      before: formatMoney(currentMinimumPrice, "RM "),
      after: formatMoney(nextMinimumPrice, "RM ")
    }]);
    renderCostRevisionHistory();
    if (status) status.textContent = `已更新：${product.name} 最低售价 ${formatMoney(nextMinimumPrice, "RM ")}`;
  } catch (error) {
    const latestProducts = getProducts();
    const rollbackIndex = latestProducts.findIndex(item => String(item.id || "") === id);
    if (rollbackIndex !== -1) {
      latestProducts[rollbackIndex] = {
        ...latestProducts[rollbackIndex],
        minimumPrice: currentMinimumPrice,
        minimumPriceManual: currentMinimumPriceManual,
        updatedAt: product.updatedAt || ""
      };
      saveJSON("importSystemProducts", latestProducts);
    }
    const rollbackOverrides = { ...getMinimumPriceManualOverridesV160() };
    rollbackOverrides[id] = currentMinimumPriceManual;
    saveMinimumPriceManualOverridesV160(rollbackOverrides);

    renderBatchProductStockResults();
    renderInventoryManagementList();
    renderDashboard();
    if (status) status.textContent = "最低售价同步失败，已恢复原价";

    try {
      if (navigator.onLine && typeof pullLatestSnapshot === "function") {
        await pullLatestSnapshot();
      }
    } catch (pullError) {
      console.error("Minimum price recovery pull failed:", pullError);
    }

    alert(String(error?.message || error || "最低售价同步失败"));
  }
}

function bindDashboardMinimumPriceLongPress() {
  const list = document.getElementById("inventoryList");
  if (!list || list.dataset.minimumPriceLongPressBound === "1") return;
  list.dataset.minimumPriceLongPressBound = "1";

  let timer = null;
  let activeButton = null;
  let startX = 0;
  let startY = 0;

  const cancel = () => {
    if (timer) window.clearTimeout(timer);
    timer = null;
    activeButton?.classList.remove("long-press-active");
    activeButton = null;
  };

  const start = event => {
    const button = event.target.closest(".inventory-minimum-price-btn");
    if (!button) return;
    const point = event.touches?.[0] || event;
    startX = Number(point.clientX) || 0;
    startY = Number(point.clientY) || 0;
    activeButton = button;
    button.classList.add("long-press-active");
    timer = window.setTimeout(() => {
      timer = null;
      button.classList.remove("long-press-active");
      editDisplayedMinimumPriceV199(String(button.dataset.productId || ""));
    }, 650);
  };

  const move = event => {
    if (!timer) return;
    const point = event.touches?.[0] || event;
    if (Math.abs((Number(point.clientX) || 0) - startX) > 12 || Math.abs((Number(point.clientY) || 0) - startY) > 12) cancel();
  };

  list.addEventListener("touchstart", start, { passive: true });
  list.addEventListener("touchmove", move, { passive: true });
  list.addEventListener("touchend", cancel, { passive: true });
  list.addEventListener("touchcancel", cancel, { passive: true });
  list.addEventListener("mousedown", event => { if (event.button === 0) start(event); });
  list.addEventListener("mousemove", move);
  list.addEventListener("mouseup", cancel);
  list.addEventListener("mouseleave", cancel);
  list.addEventListener("contextmenu", event => {
    if (event.target.closest(".inventory-minimum-price-btn")) event.preventDefault();
  });
}

function editProductAverageCostFromImportPage(productId) {
  const id = String(productId || "").trim();
  const products = getProducts();
  const productIndex = products.findIndex(
    product => String(product.id || "") === id
  );

  if (productIndex === -1) {
    alert("找不到这个产品。");
    return;
  }

  const product = products[productIndex];
  const currentStock = Math.max(0, Number(product.stock) || 0);
  const currentAverageCost = Math.max(
    0,
    Number(product.averageCost) || 0
  );

  const entered = window.prompt(
    `修改${getAverageCostLabelV205(product)}：${product.name}\n\n目前${getAverageCostLabelV205(product)}：${formatMoney(currentAverageCost, "RM ")}\n请输入新的${getAverageCostLabelV205(product)}`,
    currentAverageCost.toFixed(2)
  );

  if (entered === null) return;

  const normalized = String(entered)
    .replace(/RM/gi, "")
    .replace(/,/g, "")
    .trim();

  if (
    normalized === "" ||
    !/^\d+(?:\.\d{1,2})?$/.test(normalized)
  ) {
    alert(`${getAverageCostLabelV205(product)}必须是0或正数，最多2位小数。`);
    return;
  }

  const nextAverageCost = Number(normalized);

  if (
    !Number.isFinite(nextAverageCost) ||
    nextAverageCost < 0
  ) {
    alert(`${getAverageCostLabelV205(product)}不正确。`);
    return;
  }

  if (Math.abs(nextAverageCost - currentAverageCost) < 0.005) {
    const status = document.getElementById("batchProductStockStatus");
    if (status) status.textContent = `${getAverageCostLabelV205(product)}没有改变`;
    return;
  }

  const beforeValue = currentStock * currentAverageCost;
  const afterValue = currentStock * nextAverageCost;
  const difference = afterValue - beforeValue;

  const confirmed = window.confirm(
    `确认修改${getAverageCostLabelV205(product)}？\n\n` +
    `产品：${product.name}\n` +
    `当前库存：${formatNumber(currentStock)}\n` +
    `目前${getAverageCostLabelV205(product)}：${formatMoney(currentAverageCost, "RM ")}\n` +
    `修改为：${formatMoney(nextAverageCost, "RM ")}\n\n` +
    `这项修改会直接影响库存总值：\n` +
    `${formatMoney(beforeValue, "RM ")} → ${formatMoney(afterValue, "RM ")}\n` +
    `变化：${difference >= 0 ? "+" : "-"}${formatMoney(Math.abs(difference), "RM ")}\n\n` +
    `是否确定继续？`
  );

  if (!confirmed) return;

  const now = new Date().toISOString();

  products[productIndex] = {
    ...product,
    averageCost: nextAverageCost,
    updatedAt: now
  };

  saveProducts(products);

  appendCostRevisionHistory([{
    timestamp: now,
    importNumber: product.id || "-",
    fieldLabel: `${getAverageCostLabelV205(product)} · ${product.name || "未命名产品"}`,
    before: formatMoney(currentAverageCost, "RM "),
    after: formatMoney(nextAverageCost, "RM ")
  }]);

  renderBatchProductStockResults();
  renderInventoryManagementList();
  renderDashboard();
  renderBatchList();
  renderCostRevisionHistory();

  const status = document.getElementById("batchProductStockStatus");
  if (status) {
    status.textContent =
      `已更新：${product.name} ${getAverageCostLabelV205(product)} ${formatMoney(nextAverageCost, "RM ")}`;
  }
}

async function copyInventoryProductName(button) {
  const productName =
    String(button?.dataset?.productName || button?.textContent || "").trim();

  if (!productName) return;

  const showCopied = () => {
    const original = productName;
    button.textContent = "已复制";
    button.classList.add("copied");

    window.clearTimeout(button._copyNameTimer);
    button._copyNameTimer = window.setTimeout(() => {
      button.textContent = original;
      button.classList.remove("copied");
    }, 1200);

    showCopiedSyncMessage(productName);
  };

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(productName);
      showCopied();
      return;
    }
  } catch (error) {
    console.warn("Clipboard unavailable:", error);
  }

  const temp = document.createElement("textarea");
  temp.value = productName;
  temp.setAttribute("readonly", "");
  temp.style.position = "fixed";
  temp.style.opacity = "0";
  document.body.appendChild(temp);
  temp.select();
  document.execCommand("copy");
  temp.remove();
  showCopied();
}

function clearCurrentPageUnsavedInputs() {
  const activePage = document.querySelector(".page.active");
  const pageId = activePage?.id || "";

  if (pageId === "dashboardPage") {
    const search = document.getElementById("inventorySearch");
    const sort = document.getElementById("inventorySort");
    if (search) search.value = "";
    if (sort) sort.value = "latest";
    renderInventoryManagementList();
    return "已清空首页搜索";
  }

  if (pageId === "importPage") {
    resetBatchForm({ clearLookup: true, clearStatus: true });

    const batchSearch = document.getElementById("batchSearch");
    const productSearch =
      document.getElementById("batchProductStockSearch");

    if (batchSearch) batchSearch.value = "";
    if (productSearch) productSearch.value = "";

    batchListExpanded = false;
    renderBatchList();
    renderBatchProductStockResults();
    return "已清空产品/进口页未保存输入";
  }

  if (pageId === "historyPage") {
    const input = document.getElementById("historyLookupInput");
    const startInput =
      document.getElementById("historyStartDateInput");
    const endInput =
      document.getElementById("historyEndDateInput");
    const startPicker =
      document.getElementById("historyStartDatePicker");
    const endPicker =
      document.getElementById("historyEndDatePicker");
    const output = document.getElementById("historyResult");

    if (input) input.value = "";

    [startInput, endInput].forEach(field => {
      if (!field) return;
      field.value = "";
      field.classList.remove("date-error");
    });

    if (startPicker) startPicker.value = "";
    if (endPicker) endPicker.value = "";

    if (output) {
      output.innerHTML =
        '<div class="empty-state">输入进口编号、海外运输单号 / 本地单号、产品名称、地点、人员，或选择日期范围查看历史资料</div>';
    }

    return "已清空历史查询";
  }

  if (pageId === "settingsPage") {
    if (hasUnsavedSettingsChangesV160() &&
        !window.confirm("设置页面还有未保存的修改。\n\n确定放弃并恢复上次保存的内容吗？")) {
      return "已取消，未保存的设置仍然保留";
    }
    discardSettingsDraftV160();

    const settingsStatus = document.getElementById("settingsStatus");
    const minimumPriceSettingsStatus = document.getElementById("minimumPriceSettingsStatus");
    const toolsStatus = document.getElementById("dataToolsStatus");
    const restoreInput = document.getElementById("restoreFileInput");

    if (settingsStatus) settingsStatus.textContent = "";
    if (minimumPriceSettingsStatus) minimumPriceSettingsStatus.textContent = "";
    if (toolsStatus) toolsStatus.textContent = "";
    if (restoreInput) restoreInput.value = "";

    return "已恢复设置页未保存输入";
  }

  return "当前页面没有需要清空的输入";
}

function setupGlobalMobilePullDownClear() {
  if (!("ontouchstart" in window)) return;
  if (window.globalPullDownClearBound) return;
  window.globalPullDownClearBound = true;

  let startX = 0;
  let startY = 0;
  let tracking = false;
  let verticalGesture = false;
  let readyToClear = false;
  let indicator = null;

  const getIndicator = () => {
    if (indicator) return indicator;

    indicator = document.createElement("div");
    indicator.className = "pull-clear-indicator";
    indicator.textContent = "松开即可刷新当前页面";
    document.body.appendChild(indicator);
    return indicator;
  };

  const resetGesture = () => {
    tracking = false;
    verticalGesture = false;
    readyToClear = false;
  };

  const hideIndicator = () => {
    const box = getIndicator();
    box.classList.remove("show", "ready");
    box.textContent = "松开即可刷新当前页面";
  };

  document.addEventListener(
    "touchstart",
    event => {
      if (window.scrollY > 2) return;
      if (event.target.closest("input, select, textarea, button, a")) return;

      const point = event.touches?.[0];
      startX = Number(point?.clientX) || 0;
      startY = Number(point?.clientY) || 0;
      tracking = true;
      verticalGesture = false;
      readyToClear = false;
    },
    { passive: true }
  );

  document.addEventListener(
    "touchmove",
    event => {
      if (!tracking) return;

      const point = event.touches?.[0];
      const currentX = Number(point?.clientX) || 0;
      const currentY = Number(point?.clientY) || 0;
      const distanceX = currentX - startX;
      const distanceY = currentY - startY;
      const horizontalDistance = Math.abs(distanceX);
      const box = getIndicator();

      // 只接受明显向下的手势。
      // 向左、向右或斜向滑动不会触发刷新。
      if (!verticalGesture) {
        if (horizontalDistance >= 8 && horizontalDistance >= Math.abs(distanceY)) {
          resetGesture();
          hideIndicator();
          return;
        }

        verticalGesture =
          distanceY > 0 &&
          distanceY > horizontalDistance;
      }

      readyToClear =
        verticalGesture &&
        distanceY >= 10 &&
        distanceY > horizontalDistance;

      if (!readyToClear) {
        box.classList.remove("show", "ready");
        return;
      }

      event.preventDefault();
      box.textContent = "松开即可刷新当前页面";
      box.classList.add("show", "ready");
    },
    { passive: false }
  );

  document.addEventListener(
    "touchend",
    async () => {
      if (!tracking) return;

      const shouldRefresh = readyToClear && verticalGesture;
      resetGesture();

      if (!shouldRefresh) {
        hideIndicator();
        return;
      }

      const box = getIndicator();
      clearCurrentPageUnsavedInputs();

      box.textContent = "正在刷新并检查最新资料...";
      box.classList.add("show", "ready");

      try {
        const result =
          typeof window.refreshLatestCloudData === "function"
            ? await window.refreshLatestCloudData()
            : null;

        if (result?.offline) {
          box.textContent = "已清空当前页面 · 当前离线";
        } else if (result?.updated) {
          box.textContent = "✓ 已同步最新资料";
        } else {
          box.textContent = "✓ 页面已刷新";
        }
      } catch (error) {
        console.error("Pull refresh failed:", error);
        box.textContent = "页面已清空 · 同步检查失败";
      }

      window.setTimeout(() => {
        hideIndicator();
      }, 800);
    },
    { passive: true }
  );

  document.addEventListener(
    "touchcancel",
    () => {
      resetGesture();
      hideIndicator();
    },
    { passive: true }
  );
}

function formatDateDDMMYYYY(d){
  const date = parseDateDDMMYYYY(d);
  return date ? normalizeDateToDDMMYYYY(date) : "";
}
function formatDateFromInput(v){if(!v)return"";const[y,m,d]=v.split("-");return`${d}-${m}-${y}`;}


function getLatestImportDateByProduct(productId) {
  const batches = getBatches();
  const batchByImportNumber = new Map(
    batches.map(batch => [
      String(batch.importNumber || "").trim().toLowerCase(),
      batch
    ])
  );

  const imports = getImports()
    .filter(record => record.productId === productId)
    .map(record => {
      const batch = batchByImportNumber.get(
        String(record.importNumber || "").trim().toLowerCase()
      );

      return {
        record,
        displayDate: getImportDisplayDate(record, batch)
      };
    })
    .filter(item => parseDDMMYYYY(item.displayDate) > 0)
    .sort((a, b) =>
      parseDDMMYYYY(b.displayDate) -
      parseDDMMYYYY(a.displayDate)
    );

  return imports[0]?.displayDate || "";
}

function setupInventoryModule() {
  document
    .getElementById("inventorySearch")
    .addEventListener("input", () => scheduleSearchRenderV302("inventory", renderInventoryManagementList, 80));
  document
    .getElementById("inventorySort")
    .addEventListener("change", event => {
      const mode = String(event.target.value || "");
      const needsSales = ["latest-sold","bestseller-desc","profit-desc"].includes(mode);
      if (needsSales && !historyAllSalesLinksLoadedV136 && navigator.onLine) {
        const list = document.getElementById("inventoryManagementList");
        if (list) list.innerHTML = '<div class="empty-state">正在读取销售分析…</div>';
        Promise.resolve(ensureVisibleHistorySalesDetailsV134()).then(() => {
          inventorySalesAnalyticsCacheV146 = { signature: "", value: null };
          inventoryPreparedRowsCacheV321 = { rawProducts:null, settings:null, imports:null, batches:null, sales:null, rows:[] };
          if (String(document.getElementById("inventorySort")?.value || "") === mode) renderInventoryManagementList();
        }).catch(error => {
          console.warn("Sales analytics load failed:", error);
          renderInventoryManagementList();
        });
        return;
      }
      renderInventoryManagementList();
    });

  const inventoryList = document.getElementById("inventoryManagementList");

  inventoryList.addEventListener("click", event => {
    const importButton =
      event.target.closest(".inventory-import-number");

    if (importButton) {
      copyInventoryImportNumber(importButton);
      return;
    }

    const originalCostButton =
      event.target.closest(".inventory-original-cost-toggle");

    if (originalCostButton) {
      toggleOriginalCostPanel();
    }
  });

  const exportOriginalCostButton = document.getElementById("exportOriginalCostExcelBtn");
  if (exportOriginalCostButton) {
    exportOriginalCostButton.addEventListener("click", exportOriginalCostExcel);
  }

  const closeOriginalCostButton = document.getElementById("closeOriginalCostPanelBtn");
  if (closeOriginalCostButton) {
    closeOriginalCostButton.addEventListener("click", closeOriginalCostPanel);
  }

  bindInventoryMinimumPriceLongPress();
  renderInventoryManagementList();
  // V33.9 performance: do NOT preload the complete Sales history in the background.
  // The persisted local analytics are enough for normal browsing; full Sales links are
  // fetched only when the user explicitly chooses Profit Highest or runs History.
}

function bindInventoryMinimumPriceLongPress() {
  const list = document.getElementById("inventoryManagementList");
  if (!list || list.dataset.minimumPriceLongPressBound === "1") return;
  list.dataset.minimumPriceLongPressBound = "1";

  let timer = null;
  let activeButton = null;
  let startX = 0;
  let startY = 0;
  let triggered = false;

  const cancel = () => {
    if (timer) window.clearTimeout(timer);
    timer = null;
    activeButton?.classList.remove("long-press-active");
    activeButton = null;
  };

  const start = event => {
    const button = event.target.closest(".inventory-manage-minimum-price-btn");
    if (!button) return;
    const point = event.touches?.[0] || event;
    startX = Number(point.clientX) || 0;
    startY = Number(point.clientY) || 0;
    triggered = false;
    activeButton = button;
    button.classList.add("long-press-active");
    timer = window.setTimeout(() => {
      timer = null;
      triggered = true;
      button.classList.remove("long-press-active");
      editDisplayedMinimumPriceV199(String(button.dataset.productId || ""));
    }, 650);
  };

  const move = event => {
    if (!timer) return;
    const point = event.touches?.[0] || event;
    if (Math.abs((Number(point.clientX) || 0) - startX) > 12 || Math.abs((Number(point.clientY) || 0) - startY) > 12) cancel();
  };

  list.addEventListener("touchstart", start, { passive: true });
  list.addEventListener("touchmove", move, { passive: true });
  list.addEventListener("touchend", cancel, { passive: true });
  list.addEventListener("touchcancel", cancel, { passive: true });
  list.addEventListener("mousedown", event => { if (event.button === 0) start(event); });
  list.addEventListener("mousemove", move);
  list.addEventListener("mouseup", cancel);
  list.addEventListener("mouseleave", cancel);
  list.addEventListener("contextmenu", event => {
    if (event.target.closest(".inventory-manage-minimum-price-btn")) event.preventDefault();
  });
  list.addEventListener("click", event => {
    if (!event.target.closest(".inventory-manage-minimum-price-btn")) return;
    event.preventDefault();
    event.stopPropagation();
    if (triggered) triggered = false;
  });
}

async function copyInventoryImportNumber(button) {
  const importNumber = String(button.dataset.importNumber || "").trim();
  if (!importNumber) return;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(importNumber);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = importNumber;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      if (!copied) throw new Error("Copy command failed");
    }

    const originalText = button.dataset.originalText || importNumber;
    button.dataset.originalText = originalText;
    button.textContent = "已复制";
    button.classList.add("copied");

    showCopiedSyncMessage(importNumber);

    window.clearTimeout(button._copyResetTimer);
    button._copyResetTimer = window.setTimeout(() => {
      button.textContent = originalText;
      button.classList.remove("copied");
    }, 1200);
  } catch (error) {
    console.error("Copy import number failed:", error);
    alert(`复制失败，请手动复制：${importNumber}`);
  }
}

function showCopiedSyncMessage(importNumber) {
  const element = document.getElementById("googleSyncStatus");
  if (!element) return;

  const icon = element.querySelector(".dashboard-sync-icon");
  const text = element.querySelector(".dashboard-sync-text");

  element.classList.remove("syncing", "failed");
  element.classList.add("synced");
  if (icon) icon.textContent = "✓";
  if (text) text.textContent = `已复制：${importNumber}`;

  window.clearTimeout(window.inventoryCopyStatusTimer);
  window.inventoryCopyStatusTimer = window.setTimeout(() => {
    setCloudState("synced");
  }, 2000);
}

// V19.8: 一次扫描 History，同时建立售出数量、累计利润及最近售出索引。
// 缓存以 Products 原始资料及已载入销售明细数量为签名；资料改变后自动重算。
function getInventorySalesAnalyticsV146() {
  const productsSnapshot = String(localStorage.getItem("importSystemProducts") || "");
  const signature = `${productsSnapshot}|links:${historySalesDetailsByLinkV134.size}|all:${historyAllSalesLinksLoadedV136 ? 1 : 0}`;
  if (inventorySalesAnalyticsCacheV146.signature === signature && inventorySalesAnalyticsCacheV146.value) {
    return inventorySalesAnalyticsCacheV146.value;
  }

  const quantityById = new Map(), quantityByName = new Map();
  const profitById = new Map(), profitByName = new Map();
  const latestById = new Map(), latestByName = new Map();
  const profitGroups = new Map();
  const allAdjustments = getAllHistoryStockAdjustments();

  getHistoryNetSoldLots().forEach(lot => {
    const adjustment = lot?.adjustment || {};
    const quantity = Math.max(0, Number(lot.remainingQuantity) || 0);
    const productId = String(adjustment.productId || "").trim();
    const productName = String(adjustment.productName || "").trim().toLowerCase();

    if (productId) quantityById.set(productId, (Number(quantityById.get(productId)) || 0) + quantity);
    if (productName) quantityByName.set(productName, (Number(quantityByName.get(productName)) || 0) + quantity);

    const dayTime = parseDDMMYYYY(historyAdjustmentEventDateV134(adjustment));
    if (dayTime) {
      const match = String(historyAdjustmentTimeV131(adjustment) || "").match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
      const offset = match ? ((Number(match[1]) * 60 + Number(match[2])) * 60 + Number(match[3] || 0)) * 1000 : 0;
      const stamp = dayTime + offset;
      if (productId) latestById.set(productId, Math.max(Number(latestById.get(productId)) || 0, stamp));
      if (productName) latestByName.set(productName, Math.max(Number(latestByName.get(productName)) || 0, stamp));
    }

    const link = getHistorySalesLinkForAdjustmentV137(adjustment, allAdjustments);
    const linkId = String(link?.linkId || "").trim();
    const detail = historySalesDetailsByLinkV134.get(linkId) || link;
    const profit = Number(detail?.profit);
    const originalQuantity = Math.max(1, Number(detail?.quantity || link?.processedQty || 0) || 1);
    if (!linkId || !Number.isFinite(profit)) return;
    const productKey = productId ? `id:${productId}` : `name:${productName}`;
    const key = `${productKey}::${linkId}`;
    const entry = profitGroups.get(key) || { productId, productName, originalQuantity, profit, quantity: 0 };
    entry.quantity += quantity;
    profitGroups.set(key, entry);
  });

  profitGroups.forEach(entry => {
    const quantity = Math.min(entry.originalQuantity, entry.quantity);
    const netProfit = entry.profit * (quantity / entry.originalQuantity);
    if (entry.productId) profitById.set(entry.productId, (Number(profitById.get(entry.productId)) || 0) + netProfit);
    if (entry.productName) profitByName.set(entry.productName, (Number(profitByName.get(entry.productName)) || 0) + netProfit);
  });

  const value = { quantityById, quantityByName, profitById, profitByName, latestById, latestByName };
  inventorySalesAnalyticsCacheV146 = { signature, value };
  return value;
}

let inventoryVisibleProductsV153 = [];


// V33.9: prepare the expensive inventory/import joins once per unchanged data snapshot.
// Search and sort now operate on these prepared rows without rebuilding all import maps.
let inventoryPreparedRowsCacheV321 = {
  rawProducts: null, settings: null, imports: null, batches: null, sales: null,
  rows: []
};
function getInventoryPreparedRowsV321() {
  const rawProducts = typeof loadJSONReadOnlyV317 === "function"
    ? loadJSONReadOnlyV317("importSystemProducts", [])
    : loadJSON("importSystemProducts", []);
  const settings = getCachedSettingsV317();
  const imports = getImports();
  const batches = getBatches();
  const salesAnalyticsV146 = getInventorySalesAnalyticsV146();
  const cache = inventoryPreparedRowsCacheV321;
  if (cache.rawProducts === rawProducts && cache.settings === settings &&
      cache.imports === imports && cache.batches === batches && cache.sales === salesAnalyticsV146 &&
      Array.isArray(cache.rows)) return cache.rows;

  const batchByImportNumber = new Map(
    batches.filter(batch => String(batch.importNumber || "").trim()).map(batch => [
      String(batch.importNumber || "").trim().toLowerCase(), batch
    ])
  );
  const importsByProductIdV317 = new Map();
  const importsByProductNameV317 = new Map();
  imports.forEach(record => {
    const id = String(record?.productId || "").trim();
    const name = String(record?.productName || "").trim().toLowerCase();
    if (id) { if (!importsByProductIdV317.has(id)) importsByProductIdV317.set(id, []); importsByProductIdV317.get(id).push(record); }
    if (name) { if (!importsByProductNameV317.has(name)) importsByProductNameV317.set(name, []); importsByProductNameV317.get(name).push(record); }
  });

  const rows = getOperationalProductsV256()
    .filter(product => (Number(product.stock) || 0) > 0)
    .map(product => {
      const productName = String(product.name || "").trim().toLowerCase();
      const byId = product.id ? (importsByProductIdV317.get(String(product.id).trim()) || []) : [];
      const byName = importsByProductNameV317.get(productName) || [];
      const matchingImports = Array.from(new Set([...byId, ...byName])).sort((a, b) => {
        const batchA = batchByImportNumber.get(String(a.importNumber || "").trim().toLowerCase());
        const batchB = batchByImportNumber.get(String(b.importNumber || "").trim().toLowerCase());
        const dateDiff = parseDDMMYYYY(getImportDisplayDate(b, batchB)) - parseDDMMYYYY(getImportDisplayDate(a, batchA));
        return dateDiff || String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
      });
      const batchStockMap = new Map();
      matchingImports.forEach(record => {
        const importNumber = String(record.importNumber || "").trim();
        if (!importNumber) return;
        const key = importNumber.toLowerCase();
        const originalQuantity = getSafeDisplayOriginalQuantity(record);
        const remainingRaw = Number(record.remainingQuantity ?? record.quantity);
        const remainingQuantity = Number.isFinite(remainingRaw)
          ? Math.min(originalQuantity, Math.max(0, Math.floor(remainingRaw))) : originalQuantity;
        const current = batchStockMap.get(key) || { importNumber, originalQuantity:0, remainingQuantity:0 };
        current.originalQuantity += originalQuantity;
        current.remainingQuantity += remainingQuantity;
        batchStockMap.set(key, current);
      });
      const batchStocks = Array.from(batchStockMap.values()).filter(item => item.remainingQuantity > 0);
      const importNumbers = batchStocks.map(item => item.importNumber).join(" ");
      const overseasTrackingNumbers = Array.from(new Set(matchingImports.flatMap(record => {
        const relatedBatch = batchByImportNumber.get(String(record.importNumber || "").trim().toLowerCase());
        return [record.overseasTrackingNumber, record.trackingNumber, relatedBatch?.overseasTrackingNumber, relatedBatch?.trackingNumber]
          .map(value => String(value || "").trim()).filter(Boolean);
      }))).join(" ");
      const originalCostValuesV216 = matchingImports.map(record => Number(record?.unitPrice)).filter(value => Number.isFinite(value) && value >= 0);
      const latestActiveImportNumber = String(batchStocks[0]?.importNumber || "").trim().toLowerCase();
      const latestOriginalCostRecord = (latestActiveImportNumber
        ? matchingImports.find(record => String(record.importNumber || "").trim().toLowerCase() === latestActiveImportNumber)
        : null) || matchingImports[0] || null;
      const latestOriginalCost = Math.max(0, Number(latestOriginalCostRecord?.unitPrice) || 0);
      const latestOriginalCurrency = String(latestOriginalCostRecord?.currency ||
        batchByImportNumber.get(String(latestOriginalCostRecord?.importNumber || "").trim().toLowerCase())?.currency || "").trim().toUpperCase();
      const latestRecord = matchingImports[0] || null;
      const latestBatch = latestRecord ? batchByImportNumber.get(String(latestRecord.importNumber || "").trim().toLowerCase()) : null;
      return {
        ...product,
        importNumbers, overseasTrackingNumbers, originalCostValuesV216, batchStocks,
        latestOriginalCost, latestOriginalCurrency,
        latestImportNumber: String(batchStocks[0]?.importNumber || matchingImports[0]?.importNumber || "").trim(),
        latestSoldAt: Number(salesAnalyticsV146.latestById.get(String(product.id || "").trim()) || 0) || Number(salesAnalyticsV146.latestByName.get(productName) || 0),
        netSoldQuantity: Number(salesAnalyticsV146.quantityById.get(String(product.id || "").trim()) || 0) || Number(salesAnalyticsV146.quantityByName.get(productName) || 0),
        cumulativeSoldProfit: Number(salesAnalyticsV146.profitById.get(String(product.id || "").trim()) || 0) || Number(salesAnalyticsV146.profitByName.get(productName) || 0),
        displayLastImport: getImportDisplayDate(latestRecord, latestBatch) || normalizeDateToDDMMYYYY(product.lastImport) || ""
      };
    });
  inventoryPreparedRowsCacheV321 = { rawProducts, settings, imports, batches, sales:salesAnalyticsV146, rows };
  return rows;
}

let inventoryLastRenderedPreparedRowsV321 = null;
let inventoryLastRenderedKeywordV321 = "";
let inventoryLastMinimumPriceSignatureV339 = "";
function getMinimumPriceStateSignatureV339(products){
  return (Array.isArray(products)?products:[]).map(product=>{
    let state; try{state=getMinimumPriceDisplayStateV315(product);}catch(_){state=null;}
    const id=String(product?.id||"").trim().toUpperCase();
    const manual=state?.manual===true?1:0;
    const tone=String(state?.state||"");
    const price=Number(state?.price??product?.minimumPrice)||0;
    return `${id}:${manual}:${tone}:${price.toFixed(2)}`;
  }).sort().join("|");
}

// V33.9: one canonical product search/filter/sort path for every inventory-style view.
// Import product entry intentionally does NOT use this helper.
// V33.9: generic signed-percentage formatter retained from V32.5.
// This is shared by inventory profit-rate rendering and is NOT promotion logic.
function formatProfitTargetV303(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  const abs = Math.abs(n);
  const num = Number.isInteger(abs) ? abs.toFixed(0) : abs.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `${n > 0 ? "+" : n < 0 ? "-" : ""}${num}%`;
}

function filterSortInventoryProductsV324(query = "", sortMode = "latest", sourceRows = null) {
  const keyword = String(query || "").trim().toLowerCase();
  const rows = Array.isArray(sourceRows) ? sourceRows : getInventoryPreparedRowsV321();
  const products = rows.filter(product => {
    if (sortMode === "price-control" && !isMinimumPriceManualV160(product)) return false;
    if (!keyword) return true;
    const productTarget = `${product.id || ""} ${product.name || ""} ${productEnglishNameV262(product)} ${product.category || ""}`;
    const productMatch = smartSearchMatches(productTarget, keyword);
    const importNumberMatch = sequentialSearchMatches(product.importNumbers, keyword);
    const overseasTrackingMatch = sequentialSearchMatches(product.overseasTrackingNumbers, keyword);
    const q = keyword.normalize("NFKC").replace(/[,，\s]/g, "");
    const numeric = /^\d+(?:\.\d+)?$/.test(q) ? Number(q) : null;
    const originalCostValues = Array.isArray(product.originalCostValuesV216) ? product.originalCostValuesV216 : [];
    const originalCostMatch = numeric !== null && originalCostValues.some(value => Math.abs(Number(value) - numeric) < 0.000001);
    if (isOriginalCostOnlySearchV218(keyword)) return originalCostMatch;
    return productMatch || importNumberMatch || overseasTrackingMatch;
  }).slice();

  products.sort((a, b) => {
    const stockA = Number(a.stock) || 0, stockB = Number(b.stock) || 0;
    const costA = Number(a.averageCost) || 0, costB = Number(b.averageCost) || 0;
    if (sortMode === "price-control") return parseDDMMYYYY(b.displayLastImport) - parseDDMMYYYY(a.displayLastImport) || String(a.name || "").localeCompare(String(b.name || ""), "zh");
    if (sortMode === "name") return String(a.name || "").localeCompare(String(b.name || ""), "zh");
    if (sortMode === "latest-sold") return (Number(b.latestSoldAt) || 0) - (Number(a.latestSoldAt) || 0) || String(a.name || "").localeCompare(String(b.name || ""), "zh");
    if (sortMode === "bestseller-desc") return (Number(b.netSoldQuantity) || 0) - (Number(a.netSoldQuantity) || 0) || String(a.name || "").localeCompare(String(b.name || ""), "zh");
    if (sortMode === "profit-desc") return (Number(b.cumulativeSoldProfit) || 0) - (Number(a.cumulativeSoldProfit) || 0) || String(a.name || "").localeCompare(String(b.name || ""), "zh");
    if (sortMode === "stock-desc") return stockB - stockA;
    if (sortMode === "stock-asc") return stockA - stockB;
    if (sortMode === "value-desc") return stockB * costB - stockA * costA;
    if (sortMode === "cost-desc") return costB - costA;
    return parseDDMMYYYY(b.displayLastImport) - parseDDMMYYYY(a.displayLastImport);
  });
  return products;
}


// V33.9: build the original full V32.5 inventory card defensively. Optional
// helpers (media, copy button, language metadata, price-state helpers) are
// isolated so one bad optional field can never blank the entire inventory list.
// The fallback is still the SAME full card structure, never a simplified card.
function buildInventoryManageCardV337(product, productMediaLinksV229 = {}) {
  const stock = Math.max(0, Number(product?.stock) || 0);
  const averageCost = Math.max(0, Number(product?.averageCost) || 0);

  let minimumDisplayV315;
  try {
    minimumDisplayV315 = getMinimumPriceDisplayStateV315(product);
  } catch (error) {
    console.warn("Inventory minimum-price state skipped:", product?.id, error);
    const price = Math.max(0, Number(product?.minimumPrice) || 0);
    const manual = product?.minimumPriceManual === true;
    const profit = price - averageCost;
    minimumDisplayV315 = {
      manual,
      state: manual ? "manual" : (profit < -0.005 ? "loss" : profit > 0.005 ? "gain" : "neutral"),
      className: manual ? "minimum-price-manual-v315" : (profit < -0.005 ? "minimum-price-loss-v302" : profit > 0.005 ? "minimum-price-gain-v302" : "minimum-price-neutral-v302"),
      label: "最低售价",
      price,
      profitInfo: { profit, profitRate: price > 0 ? profit / price * 100 : 0 }
    };
  }

  const minimumPrice = Math.max(0, Number(minimumDisplayV315?.price) || 0);
  const originalCost = Math.max(0, Number(product?.latestOriginalCost) || 0);
  const originalCurrency = String(product?.latestOriginalCurrency || "").trim().toUpperCase();
  const originalCostText = originalCost > 0
    ? `${formatMoney(originalCost)}${originalCurrency ? ` ${escapeHTML(originalCurrency)}` : ""}`
    : `0.00${originalCurrency ? ` ${escapeHTML(originalCurrency)}` : ""}`;
  const inventoryValue = stock * averageCost;
  const profitInfoV205 = minimumDisplayV315?.profitInfo || { profit:0, profitRate:0 };

  let averageCostLabelV205 = "平均成本";
  try { averageCostLabelV205 = getAverageCostLabelV205(product); } catch (error) {
    console.warn("Inventory average-cost label skipped:", product?.id, error);
  }

  const soldQuantity = Number(product?.netSoldQuantity) || 0;
  const cumulativeProfit = Number(product?.cumulativeSoldProfit) || 0;
  let englishName = "";
  try { englishName = productEnglishNameV262(product) || ""; } catch (error) {
    console.warn("Inventory English name skipped:", product?.id, error);
  }
  let mediaStatus = "";
  try { mediaStatus = renderProductMediaStatusV236(product?.id, productMediaLinksV229); } catch (error) {
    console.warn("Inventory media status skipped:", product?.id, error);
  }
  let productIdButton = escapeHTML(String(product?.id || ""));
  try { productIdButton = buildProductIdCopyButtonV166(product?.id, "inventory-product-id-v166") || productIdButton; } catch (error) {
    console.warn("Inventory product-id button skipped:", product?.id, error);
  }
  let driveCopyButton = "";
  try { driveCopyButton = buildInventoryProductCopyButtonV306(product?.id) || ""; } catch (error) {
    console.warn("Inventory copy-product button skipped:", product?.id, error);
  }
  let mediaButtons = "";
  try { mediaButtons = renderProductMediaButtonsV229(product?.id, productMediaLinksV229) || ""; } catch (error) {
    console.warn("Inventory media buttons skipped:", product?.id, error);
  }

  return `
      <article class="inventory-manage-card"
               data-product-id="${escapeHTML(product?.id || "")}">
        <div class="inventory-manage-head">
          <div class="inventory-manage-primary-v174">
            <div class="inventory-product-title-row">
              <span class="product-identity-v167 inventory-product-identity-v167"><button
                class="inventory-product-name-copy"
                type="button"
                data-product-name="${escapeHTML(product?.name || "")}" 
                onclick="copyInventoryProductName(this)"
                title="点击复制产品名称">
                ${escapeHTML(product?.name || "未命名产品")}
              </button>
              ${mediaStatus}
              ${productIdButton}
              ${driveCopyButton}
              </span>
            </div>
            <div class="inventory-product-secondary-v314">
              ${englishName ? `<small class="product-english-name-v262 inventory-english-secondline-v265">${escapeHTML(englishName)}</small>` : `<small class="product-english-name-v262 inventory-english-secondline-v265 empty" aria-hidden="true"></small>`}
            </div>
            ${mediaButtons}
          </div>
          <div class="inventory-sold-quantity" title="按 Import History 的实际净售出数量计算">
            <span>售出数量</span>
            <div><strong>${formatNumber(soldQuantity)}</strong><small>棵</small></div>
            <span class="inventory-cumulative-profit-v146">累计利润</span>
            <b>${formatMoney(cumulativeProfit, "RM ")}</b>
          </div>
        </div>

        <div class="inventory-summary-grid">
          <div><span>当前库存</span><strong>${formatNumber(stock)}</strong></div>
          <button class="inventory-original-cost inventory-original-cost-toggle" type="button" title="点击展开 / 收起原成本清单"><span>原成本</span><strong>${originalCostText}</strong></button>
          <button class="inventory-manage-minimum-price-btn ${minimumDisplayV315.className}" data-minimum-price-state-v324="${minimumDisplayV315.state}" type="button"
                  data-product-id="${escapeHTML(product?.id || "")}" 
                  aria-label="长按修改最低售价" title="长按修改最低售价">
            <span>${minimumDisplayV315.label || "最低售价"}</span><strong>${formatMoney(minimumPrice, "RM ")}</strong>
          </button>
          <div><span>${escapeHTML(averageCostLabelV205)}</span><strong>${formatMoney(averageCost, "RM ")}</strong></div>
          <div class="inventory-profit-value-v207 ${profitInfoV205.profit < 0 ? "loss" : profitInfoV205.profit > 0 ? "gain" : "neutral"}"><span>利润</span><strong>${formatMoney(profitInfoV205.profit, "RM ")}</strong></div>
          <div class="inventory-profit-value-v207 ${profitInfoV205.profit < 0 ? "loss" : profitInfoV205.profit > 0 ? "gain" : "neutral"}"><span>利润率</span><strong>${escapeHTML(formatProfitTargetV303(profitInfoV205.profitRate))}</strong></div>
          <div><span>库存成本总值</span><strong>${formatMoney(inventoryValue, "RM ")}</strong></div>
          <div><span>最后进口</span><strong>${escapeHTML(normalizeDateToDDMMYYYY(product?.displayLastImport) || "-")}</strong></div>
        </div>
      </article>
    `;
}

function renderInventoryManagementList() {
  const keyword = document.getElementById("inventorySearch").value.trim().toLowerCase();
  const sortMode = document.getElementById("inventorySort").value;
  const preparedProductsV321 = getInventoryPreparedRowsV321();
  const products = filterSortInventoryProductsV324(keyword, sortMode, preparedProductsV321);

  // V19.8: both views consume this same sorted and filtered product array.
  inventoryVisibleProductsV153 = products.map(product => ({ ...product }));

  document.getElementById("inventoryPageCount").textContent = `${products.length} 项`;

  const normalizedKeyword = keyword.trim().toLowerCase();
  const matchedBatch = normalizedKeyword
    ? getBatches().find(batch =>
        String(batch.importNumber || "").trim().toLowerCase() === normalizedKeyword
      )
    : null;

  const filteredTotalStock = matchedBatch
    ? getBatchItemsForDisplay(matchedBatch).reduce((sum, item) => {
        const originalQuantity = Math.max(
          0,
          Number(item.originalQuantity ?? item.quantity) || 0
        );
        const remainingRaw = Number(
          item.remainingQuantity ?? item.quantity
        );
        const remainingQuantity = Number.isFinite(remainingRaw)
          ? Math.min(
              originalQuantity,
              Math.max(0, Math.floor(remainingRaw))
            )
          : originalQuantity;

        return sum + remainingQuantity;
      }, 0)
    : products.reduce(
        (sum, product) => sum + (Number(product.stock) || 0),
        0
      );

  const filteredInventoryValue = matchedBatch
    ? Number(matchedBatch.grandTotal) || 0
    : products.reduce((sum, product) => {
        const stock = Number(product.stock) || 0;
        const averageCost = Number(product.averageCost) || 0;
        return sum + (stock * averageCost);
      }, 0);

  const filteredStockField = document.getElementById("inventoryFilteredStock");
  if (filteredStockField) {
    filteredStockField.textContent = formatNumber(filteredTotalStock);
  }

  const filteredValueField = document.getElementById("inventoryFilteredValue");
  if (filteredValueField) {
    filteredValueField.textContent = formatMoney(filteredInventoryValue, "RM ");
  }

  const list = document.getElementById("inventoryManagementList");
  const existingCardsV321 = list ? Array.from(list.querySelectorAll(".inventory-manage-card[data-product-id]")) : [];
  const minimumPriceSignatureV339 = getMinimumPriceStateSignatureV339(products);
  const canFastReorderV321 = Boolean(
    list && products.length &&
    inventoryLastRenderedPreparedRowsV321 === preparedProductsV321 &&
    inventoryLastRenderedKeywordV321 === keyword &&
    inventoryLastMinimumPriceSignatureV339 === minimumPriceSignatureV339 &&
    existingCardsV321.length === products.length
  );
  if (canFastReorderV321) {
    const cardByIdV321 = new Map(existingCardsV321.map(card => [String(card.dataset.productId || ""), card]));
    const completeV321 = products.every(product => cardByIdV321.has(String(product.id || "")));
    if (completeV321) {
      products.forEach(product => list.appendChild(cardByIdV321.get(String(product.id || ""))));
      const originalCostPanel = document.getElementById("originalCostPanel");
      if (originalCostPanel && !originalCostPanel.hidden) renderOriginalCostPanel(products);
      return;
    }
  }
  if (!products.length) {
    list.innerHTML = '<div class="empty-state">暂无符合的库存资料</div>';
    inventoryLastRenderedPreparedRowsV321 = null;
    inventoryLastRenderedKeywordV321 = keyword;
    inventoryLastMinimumPriceSignatureV339 = "";
    const originalCostPanel = document.getElementById("originalCostPanel");
    if (originalCostPanel && !originalCostPanel.hidden) renderOriginalCostPanel([]);
    return;
  }

  const productMediaLinksV229 = getProductMediaLinksV229();

  list.innerHTML = products.map(product => {
    const stock = Number(product.stock) || 0;
    const averageCost = Number(product.averageCost) || 0;
    const minimumDisplayV315 = getMinimumPriceDisplayStateV315(product);
    const minimumPrice = minimumDisplayV315.price;
    const originalCost = Math.max(0, Number(product.latestOriginalCost) || 0);
    const originalCurrency = String(product.latestOriginalCurrency || "").trim().toUpperCase();
    const originalCostText = originalCost > 0
      ? `${formatMoney(originalCost)}${originalCurrency ? ` ${escapeHTML(originalCurrency)}` : ""}`
      : `0.00${originalCurrency ? ` ${escapeHTML(originalCurrency)}` : ""}`;
    const inventoryValue = stock * averageCost;
    const profitInfoV205 = minimumDisplayV315.profitInfo;
    const averageCostLabelV205 = getAverageCostLabelV205(product);
    const soldQuantity = Number(product.netSoldQuantity) || 0;
    const cumulativeProfit = Number(product.cumulativeSoldProfit) || 0;

    return `
      <article class="inventory-manage-card"
               data-product-id="${escapeHTML(product.id)}">
        <div class="inventory-manage-head">
          <div class="inventory-manage-primary-v174">
            <div class="inventory-product-title-row">
              <span class="product-identity-v167 inventory-product-identity-v167"><button
                class="inventory-product-name-copy"
                type="button"
                data-product-name="${escapeHTML(product.name)}"
                onclick="copyInventoryProductName(this)"
                title="点击复制产品名称">
                ${escapeHTML(product.name)}
              </button>
              ${renderProductMediaStatusV236(product.id, productMediaLinksV229)}
              ${buildProductIdCopyButtonV166(product.id, "inventory-product-id-v166")}
              ${buildInventoryProductCopyButtonV306(product.id)}
              </span>
            </div>
            <div class="inventory-product-secondary-v314">
              ${productEnglishNameV262(product)?`<small class="product-english-name-v262 inventory-english-secondline-v265">${escapeHTML(productEnglishNameV262(product))}</small>`:`<small class="product-english-name-v262 inventory-english-secondline-v265 empty" aria-hidden="true"></small>`}
            </div>
            ${renderProductMediaButtonsV229(product.id, productMediaLinksV229)}
          </div>
          <div class="inventory-sold-quantity" title="按 Import History 的实际净售出数量计算">
            <span>售出数量</span>
            <div><strong>${formatNumber(soldQuantity)}</strong><small>棵</small></div>
            <span class="inventory-cumulative-profit-v146">累计利润</span>
            <b>${formatMoney(cumulativeProfit, "RM ")}</b>
          </div>
        </div>

        <div class="inventory-summary-grid">
          <div><span>当前库存</span><strong>${formatNumber(stock)}</strong></div>
          <button class="inventory-original-cost inventory-original-cost-toggle" type="button" title="点击展开 / 收起原成本清单"><span>原成本</span><strong>${originalCostText}</strong></button>
          <button class="inventory-manage-minimum-price-btn ${minimumDisplayV315.className}" data-minimum-price-state-v324="${minimumDisplayV315.state}" type="button"
                  data-product-id="${escapeHTML(product.id || "")}"
                  aria-label="长按修改最低售价" title="长按修改最低售价">
            <span>${minimumDisplayV315.label}</span><strong>${formatMoney(minimumPrice, "RM ")}</strong>
          </button>
          <div><span>${averageCostLabelV205}</span><strong>${formatMoney(averageCost, "RM ")}</strong></div>
          <div class="inventory-profit-value-v207 ${profitInfoV205.profit < 0 ? "loss" : profitInfoV205.profit > 0 ? "gain" : "neutral"}"><span>利润</span><strong>${formatMoney(profitInfoV205.profit, "RM ")}</strong></div>
          <div class="inventory-profit-value-v207 ${profitInfoV205.profit < 0 ? "loss" : profitInfoV205.profit > 0 ? "gain" : "neutral"}"><span>利润率</span><strong>${escapeHTML(formatProfitTargetV303(profitInfoV205.profitRate))}</strong></div>
          <div><span>库存成本总值</span><strong>${formatMoney(inventoryValue, "RM ")}</strong></div>
          <div><span>最后进口</span><strong>${escapeHTML(normalizeDateToDDMMYYYY(product.displayLastImport) || "-")}</strong></div>
        </div>
      </article>
    `;
  }).join("");

  inventoryLastRenderedPreparedRowsV321 = preparedProductsV321;
  inventoryLastRenderedKeywordV321 = keyword;
  inventoryLastMinimumPriceSignatureV339 = minimumPriceSignatureV339;
  bindInventoryMediaLinksV229();

  const originalCostPanel = document.getElementById("originalCostPanel");
  if (originalCostPanel && !originalCostPanel.hidden) {
    renderOriginalCostPanel(products);
  }
}








// V32.5: permanent local-only helper for Google Drive media filenames.
// It does not write data or touch the sync queue; it only builds text and copies it.
function buildInventoryProductCopyNameV306(product) {
  const id = String(product?.id || product?.productId || "").trim().toUpperCase();
  let name = String(product?.name || "").normalize("NFKC").trim();
  if (!id || !name) return `${id}${name}`.trim();

  // Remove supplier text by starting at the earliest known bonsai/species keyword.
  // Prefer Chinese/CJK keywords so English aliases never cut a Chinese product name incorrectly.
  const rules = typeof getProductPrefixRulesV181 === "function" ? getProductPrefixRulesV181() : [];
  const chineseKeywords = rules
    .map(row => String(Array.isArray(row) ? row[0] : "").trim())
    .filter(keyword => keyword && /[\u3400-\u9fff]/.test(keyword));
  let start = -1;
  for (const keyword of chineseKeywords) {
    const index = name.indexOf(keyword);
    if (index >= 0 && (start < 0 || index < start)) start = index;
  }
  if (start > 0) name = name.slice(start);

  // Remove the trailing supplier price/model data after the useful species/form name.
  // Examples: 450, 6000, BX1280, SPK1780, 210P, BBM298.
  name = name
    .replace(/[\s\u3000]+/g, "")
    .replace(/(?:[A-Za-z]{1,8})?\d+(?:\.\d+)?[A-Za-z]{0,3}$/u, "")
    .replace(/[\-_\/]+$/g, "")
    .trim();

  return `${id}-${name}`;
}

async function copyInventoryProductForDriveV306(button) {
  const productId = String(button?.dataset?.productIdV306 || "").trim();
  const products = typeof getProducts === "function" ? getProducts() : [];
  const product = products.find(item => String(item?.id || item?.productId || "").trim() === productId);
  if (!product) {
    window.alert("找不到产品资料，无法复制。");
    return;
  }
  const value = buildInventoryProductCopyNameV306(product);
  if (!value) return;
  const copied = await copyHistoryText(value, `✓ 已复制产品：${value}`);
  if (!copied || !button) return;
  const original = button.textContent;
  button.textContent = "已复制";
  button.classList.add("copied");
  window.clearTimeout(button._copyProductV306Timer);
  button._copyProductV306Timer = window.setTimeout(() => {
    button.textContent = original || "复制产品";
    button.classList.remove("copied");
  }, 1200);
}
window.copyInventoryProductForDriveV306 = copyInventoryProductForDriveV306;

function buildInventoryProductCopyButtonV306(productId) {
  const id = String(productId || "").trim();
  if (!id) return "";
  return `<button type="button" class="inventory-product-file-copy-v306" data-product-id-v306="${escapeHTML(id)}" onclick="copyInventoryProductForDriveV306(this)" title="复制 Google Drive 产品文件名">复制产品</button>`;
}

function getProductMediaLinksV229() {
  const settings = loadJSON("importSystemSettings", {});
  return settings.productMediaLinksV229 && typeof settings.productMediaLinksV229 === "object"
    ? settings.productMediaLinksV229 : {};
}

function saveProductMediaLinksV229(links) {
  const settings = loadJSON("importSystemSettings", {});
  saveJSON("importSystemSettings", { ...settings, productMediaLinksV229: links || {} });
  if (typeof markCloudSettingsSaved === "function") markCloudSettingsSaved();
}

function renderProductMediaStatusV236(productId, mediaMap = null) {
  const media = (mediaMap || getProductMediaLinksV229())[String(productId || "")] || {};
  const hasPhoto = Boolean(String(media.photo || "").trim());
  const hasVideo = Boolean(String(media.video || "").trim());
  if (!hasPhoto && !hasVideo) return "";
  return `<span class="inventory-media-status-v236" aria-label="媒体状态">${hasPhoto ? '<i class="inventory-media-dot-v236 photo" title="已有照片链接" aria-label="已有照片链接"></i>' : ''}${hasVideo ? '<i class="inventory-media-dot-v236 video" title="已有视频链接" aria-label="已有视频链接"></i>' : ''}</span>`;
}

let inventoryMediaSaveInProgressV252 = 0;

function isInventoryMediaSaveInProgressV252() {
  return inventoryMediaSaveInProgressV252 > 0;
}
window.isInventoryMediaSaveInProgressV252 = isInventoryMediaSaveInProgressV252;

function showInventoryMediaFeedbackV252(productId, type, message, state = "") {
  const list = document.getElementById("inventoryManagementList");
  if (!list) return;
  const pid = String(productId || "");
  const mediaType = String(type || "");
  const candidates = Array.from(list.querySelectorAll("[data-media-product-v229],[data-media-add-product-v229]"));
  const target = candidates.find(el => {
    const id = String(el.dataset.mediaProductV229 || el.dataset.mediaAddProductV229 || "");
    const t = String(el.dataset.mediaTypeV229 || el.dataset.mediaAddTypeV229 || "");
    return id === pid && t === mediaType;
  });
  if (!target) return;
  const row = target.closest(".inventory-media-links-v229") || target.parentElement;
  if (!row) return;
  row.querySelectorAll(`.inventory-media-feedback-v252[data-media-feedback-type-v252="${mediaType}"]`).forEach(el => el.remove());
  const note = document.createElement("span");
  note.className = `inventory-media-feedback-v252 ${state || ""}`.trim();
  note.dataset.mediaFeedbackTypeV252 = mediaType;
  note.textContent = message;
  row.appendChild(note);
}

async function saveProductMediaLinkWithStatusV252(productId, type, url, triggerButton) {
  const label = type === "video" ? "视频" : "照片";
  const previousLinks = getProductMediaLinksV229();
  const nextLinks = { ...previousLinks };
  nextLinks[productId] = { ...(nextLinks[productId] || {}), [type]: url };
  const originalText = triggerButton?.textContent || `+ ${label}链接`;

  inventoryMediaSaveInProgressV252 += 1;
  if (triggerButton) {
    triggerButton.disabled = true;
    triggerButton.textContent = "上传中…";
  }
  showInventoryMediaFeedbackV252(productId, type, `${label}上传中…`, "pending");

  try {
    saveProductMediaLinksV229(nextLinks);
    if (typeof window.flushCloudQueueStrictV228 !== "function") {
      throw new Error("云端同步功能尚未准备完成");
    }
    await window.flushCloudQueueStrictV228();
    renderInventoryManagementList();
    showInventoryMediaFeedbackV252(productId, type, `${label}上传成功 ✓`, "success");
    window.setTimeout(() => {
      const list = document.getElementById("inventoryManagementList");
      list?.querySelectorAll(`.inventory-media-feedback-v252[data-media-feedback-type-v252="${type}"]`).forEach(el => {
        if (el.textContent.includes("上传成功")) el.remove();
      });
    }, 2200);
    return true;
  } catch (error) {
    // Do not leave a local-only yellow/blue dot when cloud confirmation failed.
    saveProductMediaLinksV229(previousLinks);
    renderInventoryManagementList();
    showInventoryMediaFeedbackV252(productId, type, `${label}上传失败，请重试`, "failed");
    console.warn("Media link cloud save failed", error);
    return false;
  } finally {
    inventoryMediaSaveInProgressV252 = Math.max(0, inventoryMediaSaveInProgressV252 - 1);
    if (triggerButton?.isConnected) {
      triggerButton.disabled = false;
      triggerButton.textContent = originalText;
    }
  }
}

function getGoogleDriveFileIdV305(url) {
  const text = String(url || "").trim();
  if (!text) return "";
  const patterns = [
    /\/file\/d\/([^/?#]+)/i,
    /[?&]id=([^&#]+)/i,
    /\/d\/([^/?#]+)/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return decodeURIComponent(match[1]);
  }
  return "";
}

function getSystemMediaSourceV305(url) {
  const original = String(url || "").trim();
  const fileId = getGoogleDriveFileIdV305(original);
  if (!fileId) return original;
  return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}&confirm=t`;
}

function getGoogleDriveDirectSourcesV310(url) {
  const fileId = getGoogleDriveFileIdV305(url);
  if (!fileId) return [];
  const id = encodeURIComponent(fileId);
  return [
    `https://drive.google.com/uc?export=download&id=${id}&confirm=t`,
    `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`
  ];
}

function getGoogleDrivePreviewSourceV308(url) {
  const fileId = getGoogleDriveFileIdV305(url);
  if (!fileId) return "";
  return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`;
}

function closeSystemMediaPreviewV305() {
  const modal = document.getElementById("systemMediaPreviewV305");
  if (!modal) return;
  if (modal._systemMediaKeyHandlerV305) document.removeEventListener("keydown", modal._systemMediaKeyHandlerV305);
  if (modal._systemMediaCleanupV308) { try { modal._systemMediaCleanupV308(); } catch (_) {} }
  const video = modal.querySelector("video");
  if (video) {
    try { video.pause(); } catch (_) {}
    video.removeAttribute("src");
    try { video.load(); } catch (_) {}
  }
  const image = modal.querySelector("img");
  if (image) image.removeAttribute("src");
  const frame = modal.querySelector("iframe");
  if (frame) frame.removeAttribute("src");
  modal.remove();
  document.body.classList.remove("system-media-preview-open-v305");
}
window.closeSystemMediaPreviewV305 = closeSystemMediaPreviewV305;

function openSystemMediaPreviewV305(type, url, label = "") {
  closeSystemMediaPreviewV305();
  const mediaType = type === "video" ? "video" : "photo";
  const originalUrl = String(url || "").trim();
  const source = getSystemMediaSourceV305(originalUrl);
  const drivePreview = getGoogleDrivePreviewSourceV308(originalUrl);
  const directVideoSources = getGoogleDriveDirectSourcesV310(originalUrl);
  if (!source) { window.alert("尚未上传"); return; }

  // V33.9 desktop: use exactly one layer. Open the original Google Drive link in
  // one browser tab for both photos and videos. Closing that tab returns directly
  // to Import System; no second system modal remains underneath.
  const desktopFinePointer = window.matchMedia("(hover:hover) and (pointer:fine)").matches && window.innerWidth >= 720;
  if (desktopFinePointer && /^https?:\/\/(?:drive\.google\.com|docs\.google\.com)\//i.test(originalUrl)) {
    window.open(originalUrl, "_blank", "noopener");
    return;
  }

  // V33.9 mobile video: try a minimal in-system player first. Only X, one
  // play/pause button and a slim progress bar are rendered by us. If Google
  // blocks the direct stream, silently switch to Drive Preview with no message.
  if (!desktopFinePointer && mediaType === "video") {
    const modal = document.createElement("div");
    modal.id = "systemMediaPreviewV305";
    modal.className = "system-media-preview-v305 system-media-simple-video-v316";
    modal.setAttribute("role", "dialog"); modal.setAttribute("aria-modal", "true");
    modal.innerHTML = `<div class="system-media-shell-v305">
      <button type="button" class="system-media-close-v305" aria-label="关闭预览">×</button>
      <div class="system-media-stage-v305"></div>
    </div>`;
    document.body.appendChild(modal); document.body.classList.add("system-media-preview-open-v305");
    const stage = modal.querySelector(".system-media-stage-v305");
    let disposed = false, timer = 0, sourceIndex = 0;
    const cleanupStage = () => { if(timer)window.clearTimeout(timer); timer=0; const v=stage?.querySelector("video"); if(v){try{v.pause()}catch(_){} v.removeAttribute("src"); try{v.load()}catch(_){}} const f=stage?.querySelector("iframe"); if(f)f.removeAttribute("src"); stage?.replaceChildren(); };
    const useDriveSilently = () => { if(disposed||!stage||!drivePreview)return; cleanupStage(); const frame=document.createElement("iframe"); frame.className="system-media-drive-frame-v308 system-media-drive-minimal-v322"; frame.src=`${drivePreview}${drivePreview.includes("?")?"&":"?"}rm=minimal`; frame.title=label||"视频预览"; frame.allow="autoplay; fullscreen; picture-in-picture"; frame.allowFullscreen=true; frame.referrerPolicy="no-referrer-when-downgrade"; stage.appendChild(frame); };
    const tryDirect = () => {
      if(disposed||!stage)return; cleanupStage();
      const candidate = directVideoSources[sourceIndex++] || source;
      if(!candidate){ useDriveSilently(); return; }
      const wrap=document.createElement("div"); wrap.className="simple-video-wrap-v316";
      const video=document.createElement("video"); video.className="system-media-video-v305 simple-video-element-v316"; video.playsInline=true; video.preload="metadata"; video.src=candidate; video.setAttribute("webkit-playsinline","");
      const play=document.createElement("button"); play.type="button"; play.className="simple-video-play-v316"; play.textContent="▶"; play.setAttribute("aria-label","播放/暂停");
      const progress=document.createElement("input"); progress.type="range"; progress.min="0"; progress.max="1000"; progress.value="0"; progress.className="simple-video-progress-v316"; progress.setAttribute("aria-label","视频进度");
      wrap.append(video,play,progress); stage.appendChild(wrap);
      const update=()=>{ if(Number.isFinite(video.duration)&&video.duration>0)progress.value=String(Math.round(video.currentTime/video.duration*1000)); play.textContent=video.paused?"▶":"❚❚"; };
      play.addEventListener("click",()=>{ if(video.paused){const p=video.play(); if(p?.catch)p.catch(()=>{});} else video.pause(); });
      video.addEventListener("click",()=>play.click()); video.addEventListener("play",update); video.addEventListener("pause",update); video.addEventListener("timeupdate",update); video.addEventListener("ended",()=>{video.currentTime=0;update();});
      progress.addEventListener("input",()=>{ if(Number.isFinite(video.duration)&&video.duration>0)video.currentTime=Number(progress.value)/1000*video.duration; });
      let ready=false; const success=()=>{ready=true;if(timer)window.clearTimeout(timer);timer=0;update();};
      const fail=()=>{ if(disposed||ready)return; if(sourceIndex<directVideoSources.length)tryDirect(); else useDriveSilently(); };
      video.addEventListener("loadedmetadata",success,{once:true}); video.addEventListener("canplay",success,{once:true}); video.addEventListener("error",fail,{once:true}); timer=window.setTimeout(fail,12000);
    };
    tryDirect();
    modal._systemMediaCleanupV308=()=>{disposed=true;cleanupStage();};
    modal.querySelector(".system-media-close-v305")?.addEventListener("click", closeSystemMediaPreviewV305);
    modal.addEventListener("click", event=>{if(event.target===modal)closeSystemMediaPreviewV305();});
    const onKey=event=>{if(event.key==="Escape")closeSystemMediaPreviewV305();}; modal._systemMediaKeyHandlerV305=onKey; document.addEventListener("keydown",onKey);
    return;
  }

  // Mobile photo keeps the lightweight in-system image path that already passed device testing.
  const modal = document.createElement("div");
  modal.id = "systemMediaPreviewV305";
  modal.className = "system-media-preview-v305";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.innerHTML = `<div class="system-media-shell-v305">
    <button type="button" class="system-media-close-v305" aria-label="关闭预览">×</button>
    <div class="system-media-stage-v305"></div>
    <div class="system-media-message-v305" hidden></div>
  </div>`;
  document.body.appendChild(modal);
  document.body.classList.add("system-media-preview-open-v305");

  const stage = modal.querySelector(".system-media-stage-v305");
  const message = modal.querySelector(".system-media-message-v305");
  let directTimer = 0;
  let disposed = false;
  let sourceIndex = 0;

  const clearDirectTimer = () => { if (directTimer) { window.clearTimeout(directTimer); directTimer = 0; } };
  const setMessage = (text, allowDriveOpen = false) => {
    if (!message) return;
    message.hidden = false; message.innerHTML = "";
    const textNode = document.createElement("span"); textNode.textContent = text; message.appendChild(textNode);
    if (allowDriveOpen && originalUrl) {
      const btn = document.createElement("button"); btn.type = "button"; btn.className = "system-media-open-drive-v310"; btn.textContent = "Google Drive 打开";
      btn.addEventListener("click", () => window.open(originalUrl, "_blank", "noopener")); message.appendChild(btn);
    }
  };
  const clearStageMedia = () => {
    clearDirectTimer(); if (!stage) return;
    const video = stage.querySelector("video"); if (video) { try { video.pause(); } catch (_) {} video.removeAttribute("src"); try { video.load(); } catch (_) {} }
    const image = stage.querySelector("img"); if (image) image.removeAttribute("src");
    const frame = stage.querySelector("iframe"); if (frame) frame.removeAttribute("src");
    stage.replaceChildren();
  };
  const useDrivePreview = () => {
    if (disposed || !drivePreview || !stage) { setMessage(`无法显示${mediaType === "video" ? "视频" : "照片"}。`, true); return; }
    clearStageMedia();
    const frame = document.createElement("iframe"); frame.className = "system-media-drive-frame-v308"; frame.src = drivePreview;
    frame.title = label || (mediaType === "video" ? "视频预览" : "照片预览"); frame.allow = "autoplay; fullscreen; picture-in-picture"; frame.allowFullscreen = true;
    frame.referrerPolicy = "no-referrer-when-downgrade"; stage.appendChild(frame); if (message) message.hidden = true;
    
  };
  const tryNextVideoSource = () => {
    if (disposed || !stage) return; clearStageMedia();
    if (sourceIndex >= directVideoSources.length) { useDrivePreview(); return; }
    const candidate = directVideoSources[sourceIndex++];
    const video = document.createElement("video"); video.className = "system-media-video-v305"; video.controls = true; video.playsInline = true; video.preload = "metadata"; video.src = candidate;
    video.setAttribute("aria-label", label || "视频预览");
    const success = () => { clearDirectTimer(); if (message) message.hidden = true; const p = video.play(); if (p?.catch) p.catch(() => {}); };
    const fail = () => { if (disposed || !video.isConnected) return; tryNextVideoSource(); };
    video.addEventListener("loadedmetadata", success, { once:true }); video.addEventListener("canplay", success, { once:true }); video.addEventListener("error", fail, { once:true });
    stage.appendChild(video); directTimer = window.setTimeout(fail, 8000);
  };

  if (mediaType === "video") {
    if (directVideoSources.length) tryNextVideoSource();
    else { const video = document.createElement("video"); video.className="system-media-video-v305"; video.controls=true; video.playsInline=true; video.preload="metadata"; video.src=source; video.addEventListener("error",()=>setMessage("无法播放视频。",true),{once:true}); stage.appendChild(video); }
  } else {
    const image = document.createElement("img"); image.className="system-media-photo-v305"; image.alt=label||"照片预览"; image.decoding="async"; image.src=source;
    image.addEventListener("load", clearDirectTimer, { once:true }); image.addEventListener("error", useDrivePreview, { once:true }); stage.appendChild(image);
    if (drivePreview) directTimer = window.setTimeout(useDrivePreview, 4500);
  }

  modal._systemMediaCleanupV308 = () => { disposed = true; clearDirectTimer(); clearStageMedia(); };
  modal.querySelector(".system-media-close-v305")?.addEventListener("click", closeSystemMediaPreviewV305);
  modal.addEventListener("click", event => { if (event.target === modal) closeSystemMediaPreviewV305(); });
  const onKey = event => { if (event.key === "Escape") closeSystemMediaPreviewV305(); };
  modal._systemMediaKeyHandlerV305 = onKey; document.addEventListener("keydown", onKey);
}
window.openSystemMediaPreviewV305 = openSystemMediaPreviewV305;

function renderProductMediaButtonsV229(productId, mediaMap = null) {
  const media = (mediaMap || getProductMediaLinksV229())[String(productId || "")] || {};
  const item = (type, label) => {
    const url = String(media[type] || "").trim();
    const main = url
      ? `<button type="button" class="inventory-media-open-v230 inventory-media-saved-v254 inventory-media-${type}-v254" data-media-open-product-v305="${escapeHTML(productId)}" data-media-open-type-v305="${type}" data-media-open-url-v305="${escapeHTML(url)}" aria-label="打开${label}">${label}</button>`
      : `<button type="button" class="inventory-media-add-v229" data-media-add-product-v229="${escapeHTML(productId)}" data-media-add-type-v229="${type}">${label}</button>`;
    return `<span class="inventory-media-item-v229 ${url ? "has-media-v302" : "no-media-v302"}">${main}<button type="button" class="inventory-media-copy-v229" data-media-product-v229="${escapeHTML(productId)}" data-media-type-v229="${type}">复制</button><button type="button" class="inventory-media-delete-v229" data-media-delete-product-v229="${escapeHTML(productId)}" data-media-delete-type-v229="${type}" aria-label="删除${label}链接">删除</button></span>`;
  };
  return `<div class="inventory-media-links-v229">${item("photo", "照片")}${item("video", "视频")}</div>`;
}

window.addEventListener("beforeunload", event => {
  if (!isInventoryMediaSaveInProgressV252()) return;
  event.preventDefault();
  event.returnValue = "";
});

function bindInventoryMediaLinksV229() {
  const list = document.getElementById("inventoryManagementList");
  if (!list || list.dataset.mediaBoundV229 === "1") return;
  list.dataset.mediaBoundV229 = "1";
  list.addEventListener("click", async event => {
    const open = event.target.closest("[data-media-open-product-v305]");
    if (open) {
      const type = String(open.dataset.mediaOpenTypeV305 || "").trim();
      const url = String(open.dataset.mediaOpenUrlV305 || "").trim();
      openSystemMediaPreviewV305(type, url, type === "video" ? "视频" : "照片");
      return;
    }
    const add = event.target.closest("[data-media-add-product-v229]");
    if (add) {
      if (isInventoryMediaSaveInProgressV252()) {
        window.alert("上一项照片／视频仍在上传，请等待显示成功或失败后再继续。");
        return;
      }
      const productId = String(add.dataset.mediaAddProductV229 || "").trim();
      const type = String(add.dataset.mediaAddTypeV229 || "").trim();
      const label = type === "video" ? "视频" : "照片";
      const value = window.prompt(`粘贴${label}链接（建议 Google Drive 分享链接）：`, "");
      if (value === null) return;
      const url = String(value || "").trim();
      if (!/^https?:\/\//i.test(url)) { window.alert("请输入完整的 http:// 或 https:// 链接。"); return; }
      await saveProductMediaLinkWithStatusV252(productId, type, url, add);
      return;
    }
    const del = event.target.closest("[data-media-delete-product-v229]");
    if (del) {
      if (isInventoryMediaSaveInProgressV252()) {
        window.alert("照片／视频仍在上传，请等待完成后再删除媒体链接。");
        return;
      }
      const productId = String(del.dataset.mediaDeleteProductV229 || "").trim();
      const type = String(del.dataset.mediaDeleteTypeV229 || "").trim();
      const label = type === "video" ? "视频" : "照片";
      const currentUrl = String(getProductMediaLinksV229()[productId]?.[type] || "").trim();
      if (!currentUrl) { window.alert("尚未上传"); return; }
      if (!window.confirm(`确认删除这个产品的${label}链接？\n\n只删除链接，不会删除 Google Drive 内的照片／视频。`)) return;
      const links = { ...getProductMediaLinksV229() };
      const next = { ...(links[productId] || {}) };
      delete next[type];
      if (next.photo || next.video) links[productId] = next; else delete links[productId];
      saveProductMediaLinksV229(links);
      renderInventoryManagementList();
      return;
    }
    const copy = event.target.closest("[data-media-product-v229]");
    if (copy) {
      const productId = String(copy.dataset.mediaProductV229 || "").trim();
      const type = String(copy.dataset.mediaTypeV229 || "").trim();
      const url = String(getProductMediaLinksV229()[productId]?.[type] || "").trim();
      if (!url) { window.alert("尚未上传"); return; }
      const original = copy.textContent;
      try { await navigator.clipboard.writeText(url); }
      catch (_) {
        const ta = document.createElement("textarea"); ta.value = url; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
      }
      copy.textContent = "已复制";
      window.setTimeout(() => { copy.textContent = original; }, 900);
    }
  });
}

function getOriginalCostSummaryRows() {
  // V19.8: these are the actual objects just rendered by Inventory Management.
  // There is deliberately no second independent filter pass here.
  return inventoryVisibleProductsV153.map(product => {
    const stateV315 = getMinimumPriceDisplayStateV315(product);
    return {
      id: String(product.id || ""),
      name: String(product.name || ""),
      stock: Math.max(0, Number(product.stock) || 0),
      originalCost: Math.max(0, Number(product.latestOriginalCost) || 0),
      originalCurrency: String(product.latestOriginalCurrency || "").trim().toUpperCase(),
      averageCost: Math.max(0, Number(product.averageCost) || 0),
      minimumPrice: stateV315.price,
      profitInfo: stateV315.profitInfo,
      englishName: productEnglishNameV262(product),
      product
    };
  });
}

function getMinimumPriceDisplayStateV315(product) {
  const manual = isMinimumPriceManualV160(product);
  const info = getProductMinimumProfitV205(product);
  const className = manual
    ? "minimum-price-manual-v315"
    : (info.profit < -0.005 ? "minimum-price-loss-v302" : info.profit > 0.005 ? "minimum-price-gain-v302" : "minimum-price-neutral-v302");
  const state = manual ? "manual" : (info.profit < -0.005 ? "loss" : info.profit > 0.005 ? "gain" : "neutral");
  return { manual, state, className, label:"最低售价", price:info.price, profitInfo:info };
}

function renderOriginalCostPanel(visibleProducts = inventoryVisibleProductsV153) {
  const body = document.getElementById("originalCostTableBody");
  const dateField = document.getElementById("originalCostPanelDate");
  if (!body) return;

  if (Array.isArray(visibleProducts) && visibleProducts !== inventoryVisibleProductsV153) {
    inventoryVisibleProductsV153 = visibleProducts.map(product => ({ ...product }));
  }
  const rows = getOriginalCostSummaryRows();
  const originalHeader = document.getElementById("originalCostMinimumHeaderV315");
  if (originalHeader) originalHeader.textContent = "最低售价";
  if (dateField) dateField.textContent = `资料日期：${formatDateDDMMYYYY(new Date())}`;

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="5" class="empty-state">暂无库存资料</td></tr>';
    return;
  }

  body.innerHTML = rows.map(row => {
    const originalCostText = `${formatMoney(row.originalCost)}${row.originalCurrency ? ` ${escapeHTML(row.originalCurrency)}` : ""}`;
    const displayStateV315 = getMinimumPriceDisplayStateV315(row.product || row);
    return `
      <tr>
        <td>
          <button
            class="inventory-product-name-copy original-cost-product-copy"
            type="button"
            data-product-name="${escapeHTML(row.name)}"
            onclick="copyInventoryProductName(this)"
            title="点击复制产品名称">${escapeHTML(row.name)}</button>${row.englishName?`<small class="product-english-name-v262">${escapeHTML(row.englishName)}</small>`:""}
        </td>
        <td class="number-cell">
          <button class="original-cost-stock-edit-v151" type="button"
                  data-product-id="${escapeHTML(row.id)}"
                  aria-label="长按修改 ${escapeHTML(row.name)} 当前库存"
                  title="长按修改当前库存">${formatNumber(row.stock)}</button>
        </td>
        <td class="money-cell original-currency-cell">${originalCostText}</td>
        <td class="money-cell">${formatMoney(row.averageCost, "RM ")}${row.originalCurrency === "VND" ? `<small class="average-cost-vnd-note-v207">（VND不含盆）</small>` : ""}</td>
        <td class="money-cell minimum-price-cell">
          <button class="original-cost-minimum-price-btn ${displayStateV315.className}" data-minimum-price-state-v324="${displayStateV315.state}" type="button"
                  data-product-id="${escapeHTML(row.id)}"
                  aria-label="长按修改最低售价" title="长按修改最低售价">${formatMoney(displayStateV315.price, "RM ")}</button>
        </td>
      </tr>
    `;
  }).join("");
  bindOriginalCostStockLongPressV151();
  bindOriginalCostMinimumPriceLongPress();
}

function bindOriginalCostStockLongPressV151() {
  const body = document.getElementById("originalCostTableBody");
  if (!body || body.dataset.stockLongPressBoundV151 === "1") return;
  body.dataset.stockLongPressBoundV151 = "1";

  let timer = null;
  let activeButton = null;
  let startX = 0;
  let startY = 0;
  let editing = false;

  const cancel = () => {
    if (timer) window.clearTimeout(timer);
    timer = null;
    activeButton?.classList.remove("long-press-active");
    activeButton = null;
  };

  const editSelectedStock = async button => {
    if (!button || button.disabled || editing) return;
    const tableWrap = button.closest(".original-cost-table-wrap");
    const windowScrollX = window.scrollX;
    const windowScrollY = window.scrollY;
    const tableScrollLeft = Number(tableWrap?.scrollLeft) || 0;
    const tableScrollTop = Number(tableWrap?.scrollTop) || 0;
    const productId = String(button.dataset.productId || "").trim();

    editing = true;
    button.disabled = true;
    try {
      await editProductStockFromImportPage(productId);
    } finally {
      editing = false;
      renderOriginalCostPanel();
      window.requestAnimationFrame(() => {
        const refreshedWrap = document.querySelector("#originalCostPanel .original-cost-table-wrap");
        if (refreshedWrap) {
          refreshedWrap.scrollLeft = tableScrollLeft;
          refreshedWrap.scrollTop = tableScrollTop;
        }
        window.scrollTo(windowScrollX, windowScrollY);
        Array.from(document.querySelectorAll(".original-cost-stock-edit-v151"))
          .find(item => String(item.dataset.productId || "") === productId)
          ?.focus({ preventScroll: true });
      });
    }
  };

  const start = event => {
    const button = event.target.closest(".original-cost-stock-edit-v151");
    if (!button || button.disabled || editing) return;
    cancel();
    const point = event.touches?.[0] || event;
    startX = Number(point.clientX) || 0;
    startY = Number(point.clientY) || 0;
    activeButton = button;
    button.classList.add("long-press-active");
    timer = window.setTimeout(() => {
      timer = null;
      button.classList.remove("long-press-active");
      activeButton = null;
      void editSelectedStock(button);
    }, 650);
  };

  const move = event => {
    if (!timer) return;
    const point = event.touches?.[0] || event;
    if (Math.abs((Number(point.clientX) || 0) - startX) > 12 || Math.abs((Number(point.clientY) || 0) - startY) > 12) cancel();
  };

  body.addEventListener("touchstart", start, { passive: true });
  body.addEventListener("touchmove", move, { passive: true });
  body.addEventListener("touchend", cancel, { passive: true });
  body.addEventListener("touchcancel", cancel, { passive: true });
  body.addEventListener("mousedown", event => { if (event.button === 0) start(event); });
  body.addEventListener("mousemove", move);
  body.addEventListener("mouseup", cancel);
  body.addEventListener("mouseleave", cancel);
  body.addEventListener("dragstart", event => {
    if (event.target.closest(".original-cost-stock-edit-v151")) event.preventDefault();
  });
  body.addEventListener("contextmenu", event => {
    if (event.target.closest(".original-cost-stock-edit-v151")) event.preventDefault();
  });
}

function bindOriginalCostMinimumPriceLongPress() {
  const body = document.getElementById("originalCostTableBody");
  if (!body || body.dataset.minimumPriceLongPressBound === "1") return;
  body.dataset.minimumPriceLongPressBound = "1";

  let timer = null;
  let activeButton = null;
  let startX = 0;
  let startY = 0;

  const cancel = () => {
    if (timer) window.clearTimeout(timer);
    timer = null;
    activeButton?.classList.remove("long-press-active");
    activeButton = null;
  };

  const start = event => {
    const button = event.target.closest(".original-cost-minimum-price-btn");
    if (!button) return;
    const point = event.touches?.[0] || event;
    startX = Number(point.clientX) || 0;
    startY = Number(point.clientY) || 0;
    activeButton = button;
    button.classList.add("long-press-active");
    timer = window.setTimeout(() => {
      timer = null;
      button.classList.remove("long-press-active");
      editDisplayedMinimumPriceV199(String(button.dataset.productId || ""));
    }, 650);
  };

  const move = event => {
    if (!timer) return;
    const point = event.touches?.[0] || event;
    if (Math.abs((Number(point.clientX) || 0) - startX) > 12 || Math.abs((Number(point.clientY) || 0) - startY) > 12) cancel();
  };

  body.addEventListener("touchstart", start, { passive: true });
  body.addEventListener("touchmove", move, { passive: true });
  body.addEventListener("touchend", cancel, { passive: true });
  body.addEventListener("touchcancel", cancel, { passive: true });
  body.addEventListener("mousedown", event => { if (event.button === 0) start(event); });
  body.addEventListener("mousemove", move);
  body.addEventListener("mouseup", cancel);
  body.addEventListener("mouseleave", cancel);
  body.addEventListener("contextmenu", event => {
    if (event.target.closest(".original-cost-minimum-price-btn")) event.preventDefault();
  });
}

function toggleOriginalCostPanel() {
  const panel = document.getElementById("originalCostPanel");
  if (!panel) return;

  const opening = panel.hidden;
  panel.hidden = !opening;
  if (opening) {
    renderOriginalCostPanel();
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function closeOriginalCostPanel() {
  const panel = document.getElementById("originalCostPanel");
  if (!panel) return;
  panel.hidden = true;
}

function exportOriginalCostExcel() {
  const rows = getOriginalCostSummaryRows();
  if (!rows.length) {
    alert("暂无库存资料可以导出");
    return;
  }

  const excelRows = rows.map(row => [
    row.name,
    Math.round(row.stock),
    `${Number(row.originalCost || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${row.originalCurrency ? ` ${row.originalCurrency}` : ""}`,
    Number(row.averageCost) || 0,
    Number(row.minimumPrice) || 0
  ]);

  const workbook =
    `<?xml version="1.0"?>` +
    `<?mso-application progid="Excel.Sheet"?>` +
    `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ` +
    `xmlns:o="urn:schemas-microsoft-com:office:office" ` +
    `xmlns:x="urn:schemas-microsoft-com:office:excel" ` +
    `xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">` +
    `<Styles>` +
      `<Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="10"/></Style>` +
      `<Style ss:ID="Header"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="10" ss:Bold="1"/><Interior ss:Color="#D9EAD3" ss:Pattern="Solid"/></Style>` +
      `<Style ss:ID="HeaderRow"><Alignment ss:Vertical="Center"/></Style>` +
      `<Style ss:ID="Integer"><NumberFormat ss:Format="0"/></Style>` +
      `<Style ss:ID="Number2"><NumberFormat ss:Format="#,##0.00"/></Style>` +
      `<Style ss:ID="GeneralNumber"><NumberFormat ss:Format="General"/></Style>` +
    `</Styles>` +
    excelWorksheet(
      "原成本清单",
      ["产品名", "当前库存", "原成本", "平均成本", "最低售价"],
      excelRows,
      ["text", "integer", "text", "money", "money"]
    ) +
    `</Workbook>`;

  downloadTextFile(
    `Original_Cost_List_${formatDateDDMMYYYY(new Date())}.xls`,
    workbook,
    "application/vnd.ms-excel;charset=utf-8"
  );
}

function parseDDMMYYYY(value) {
  const date = parseDateDDMMYYYY(value);
  return date ? date.getTime() : 0;
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function setupDataTools() {
  const exportButton = document.getElementById("exportExcelBtn");
  const backupButton = document.getElementById("backupDataBtn");
  const restoreButton = document.getElementById("restoreDataBtn");
  const restoreInput = document.getElementById("restoreFileInput");
  const findStaleButton =
    document.getElementById("findStaleZeroStockBtn");
  const deleteSelectedButton =
    document.getElementById("deleteSelectedStaleProductsBtn");
  const staleList =
    document.getElementById("staleZeroStockList");

  exportButton?.addEventListener("click", exportSystemExcel);
  backupButton?.addEventListener("click", backupSystemData);
  restoreButton?.addEventListener("click", () => restoreInput?.click());
  restoreInput?.addEventListener("change", restoreSystemData);

  findStaleButton?.addEventListener("click", () => {
    const panel = document.getElementById("staleZeroStockPanel");
    if (!panel) return;
    if (!panel.hidden) {
      if (!confirmDiscardStaleZeroStockSelectionV227()) return;
      collapseStaleZeroStockPanelV227();
      return;
    }
    renderStaleZeroStockProducts();
  });

  staleList?.addEventListener("change", () => {
    updateStaleDeleteButtonState();
  });

  deleteSelectedButton?.addEventListener(
    "click",
    deleteSelectedStaleZeroStockProducts
  );
}




function hasSelectedStaleZeroStockProductsV227() {
  return Boolean(document.querySelector(".stale-zero-stock-checkbox:checked"));
}

function discardStaleZeroStockSelectionV227() {
  document.querySelectorAll(".stale-zero-stock-checkbox:checked").forEach(input => { input.checked = false; });
  updateStaleDeleteButtonState();
}

function confirmDiscardStaleZeroStockSelectionV227() {
  if (!hasSelectedStaleZeroStockProductsV227()) return true;
  const ok = window.confirm("有已选择但尚未删除的零库存产品。\n\n确定离开并放弃这些选择吗？\n不会执行任何删除。");
  if (ok) discardStaleZeroStockSelectionV227();
  return ok;
}

function collapseStaleZeroStockPanelV227() {
  const panel = document.getElementById("staleZeroStockPanel");
  if (panel) panel.hidden = true;
  discardStaleZeroStockSelectionV227();
}

function getStaleProductActivityTime(product, imports, batches) {
  const productId = String(product?.id || "").trim();
  const productName =
    String(product?.name || "").trim().toLowerCase();

  const batchByImportNumber = new Map(
    (batches || []).map(batch => [
      String(batch?.importNumber || "").trim().toLowerCase(),
      batch
    ])
  );

  const times = [];

  (imports || []).forEach(record => {
    const sameProductId =
      productId &&
      record?.productId &&
      String(record.productId).trim() === productId;

    const sameLegacyName =
      !sameProductId &&
      productName &&
      String(record?.productName || "")
        .trim()
        .toLowerCase() === productName;

    if (!sameProductId && !sameLegacyName) return;

    const batch = batchByImportNumber.get(
      String(record?.importNumber || "").trim().toLowerCase()
    );

    [
      record?.arrivalDate,
      batch?.arrivalDate,
      record?.containerDate,
      batch?.containerDate
    ].forEach(value => {
      const time = parseDDMMYYYY(value);
      if (time > 0) times.push(time);
    });

    [record?.updatedAt, record?.createdAt].forEach(value => {
      const time = Date.parse(String(value || ""));
      if (Number.isFinite(time)) times.push(time);
    });
  });

  getProductStockAdjustments(product).forEach(adjustment => {
    const createdTime = Date.parse(
      String(adjustment?.createdAt || "")
    );
    if (Number.isFinite(createdTime)) {
      times.push(createdTime);
      return;
    }

    const dateTime = parseDDMMYYYY(adjustment?.date);
    if (dateTime > 0) times.push(dateTime);
  });

  // 没有任何进出记录的产品，以建立日期为起点，
  // 避免刚建立的零库存产品立即被列入清理。
  if (!times.length) {
    const createdTime = Date.parse(
      String(product?.createdAt || "")
    );
    if (Number.isFinite(createdTime)) times.push(createdTime);
  }

  return times.length ? Math.max(...times) : 0;
}

function getThreeMonthsAgoTime() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setMonth(date.getMonth() - 3);
  return date.getTime();
}

function getStaleZeroStockProducts() {
  // V6.8: user-confirmed cleanup rule. Every product whose canonical
  // Products.stock is exactly 0 is eligible, regardless of age/activity.
  // Nothing is deleted automatically; the user must select rows and type DELETE.
  const imports = getImports();
  const batches = getBatches();

  return getProducts()
    .filter(product => (Number(product?.stock) || 0) === 0)
    .map(product => ({
      product,
      lastActivityTime: getStaleProductActivityTime(product, imports, batches)
    }))
    .sort((a, b) => {
      const ta = Number(a.lastActivityTime) || 0;
      const tb = Number(b.lastActivityTime) || 0;
      if (ta !== tb) return ta - tb;
      return String(a.product?.name || '').localeCompare(String(b.product?.name || ''), 'zh-Hans-CN');
    });
}

function formatActivityDate(time) {
  if (!Number.isFinite(Number(time)) || Number(time) <= 0) {
    return "-";
  }

  const date = new Date(Number(time));
  return [
    String(date.getDate()).padStart(2, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    date.getFullYear()
  ].join("-");
}

function renderStaleZeroStockProducts() {
  const panel =
    document.getElementById("staleZeroStockPanel");
  const list =
    document.getElementById("staleZeroStockList");
  const count =
    document.getElementById("staleZeroStockCount");

  if (!panel || !list || !count) return;

  const staleProducts = getStaleZeroStockProducts();
  panel.hidden = false;
  count.textContent = `${formatNumber(staleProducts.length)} 项`;

  if (!staleProducts.length) {
    list.innerHTML =
      '<div class="empty-state">没有符合条件的零库存产品</div>';
    updateStaleDeleteButtonState();
    showDataToolsStatus("目前没有零库存产品");
    return;
  }

  list.innerHTML = staleProducts.map(item => {
    const product = item.product;

    return `
      <label class="stale-zero-stock-item">
        <input type="checkbox"
               class="stale-zero-stock-checkbox"
               value="${escapeHTML(product.id)}" />
        <span class="stale-zero-stock-main">
          <strong>${escapeHTML(product.name || "未命名产品")}</strong>
          <small>
            ${escapeHTML(product.id || "-")} ·
            ${escapeHTML(product.category || "-")} ·
            最后记录 ${formatActivityDate(item.lastActivityTime)}
          </small>
        </span>
        <span class="stale-zero-stock-value">库存 0</span>
      </label>
    `;
  }).join("");

  updateStaleDeleteButtonState();
  showDataToolsStatus(
    `已找到 ${formatNumber(staleProducts.length)} 个零库存产品可清理`
  );
}

function updateStaleDeleteButtonState() {
  const button =
    document.getElementById("deleteSelectedStaleProductsBtn");
  if (!button) return;

  const selected = document.querySelectorAll(
    ".stale-zero-stock-checkbox:checked"
  );

  button.disabled = selected.length === 0;
  button.textContent = selected.length
    ? `删除已选择（${selected.length}）`
    : "删除已选择";
}

function isSameCleanupProduct(item, product) {
  const productId = String(product?.id || "").trim();
  const productName =
    String(product?.name || "").trim().toLowerCase();

  const sameId =
    productId &&
    item?.productId &&
    String(item.productId).trim() === productId;

  const sameLegacyName =
    !sameId &&
    productName &&
    String(item?.productName || item?.name || "")
      .trim()
      .toLowerCase() === productName;

  return sameId || sameLegacyName;
}

function deleteSelectedStaleZeroStockProducts() {
  const selectedIds = Array.from(
    document.querySelectorAll(".stale-zero-stock-checkbox:checked")
  ).map(input => String(input.value || "").trim());

  if (!selectedIds.length) return;

  const zeroById = new Map(
    getStaleZeroStockProducts().map(item => [String(item.product.id || "").trim(), item.product])
  );
  const selectedProducts = selectedIds.map(id => zeroById.get(id)).filter(Boolean);

  if (!selectedProducts.length) {
    alert("这些产品已经不再是零库存，请重新检查。");
    renderStaleZeroStockProducts();
    return;
  }

  const names = selectedProducts.slice(0, 8).map(p => `• ${p.name || p.id}`).join("\n");
  const more = selectedProducts.length > 8 ? `\n…另有 ${selectedProducts.length - 8} 项` : "";
  const typed = window.prompt(
    `永久删除 ${selectedProducts.length} 个零库存产品？\n\n${names}${more}\n\n将从 Products、Imports、Batches 对应项目及历史销售修复设置中移除。删除后系统会视为公司从未进口过这些产品。\n\n此操作无法还原，请先 Backup。\n\n请输入 DELETE 确认：`
  );
  if (typed === null) return;
  if (String(typed).trim() !== "DELETE") {
    alert("输入不正确，已取消删除。");
    return;
  }

  // Final guard immediately before mutation: only canonical stock=0 may be deleted.
  const latestProducts = getProducts();
  const latestById = new Map(latestProducts.map(p => [String(p.id || "").trim(), p]));
  const invalid = selectedProducts.filter(p => {
    const latest = latestById.get(String(p.id || "").trim());
    return !latest || (Number(latest.stock) || 0) !== 0;
  });
  if (invalid.length) {
    alert("其中有产品库存已经改变，已取消整次删除。请重新同步后再检查。");
    return;
  }

  const products = latestProducts;
  const imports = getImports();
  const batches = getBatches();
  const settings = loadJSON("importSystemSettings", {});
  const now = new Date().toISOString();
  const selectedIdSet = new Set(selectedProducts.map(p => String(p.id || "").trim()));

  const nextProducts = products.filter(p => !selectedIdSet.has(String(p.id || "").trim()));
  const nextImports = imports.filter(record => !selectedProducts.some(product => isSameCleanupProduct(record, product)));
  const nextBatches = batches.map(batch => {
    const currentItems = Array.isArray(batch.items) ? batch.items : [];
    const nextItems = currentItems.filter(item => !selectedProducts.some(product => isSameCleanupProduct(item, product)));
    if (!nextItems.length) return null;
    if (nextItems.length === currentItems.length) return batch;
    return {
      ...batch,
      items: nextItems,
      productTypeCount: new Set(nextItems.map(item => String(item.productId || item.productName || ""))).size,
      totalQuantity: nextItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
      updatedAt: now
    };
  }).filter(Boolean);

  // Remove legacy History Sales Repair overrides belonging to the deleted products.
  const oldOverrides = settings.historySalesOverrides && typeof settings.historySalesOverrides === "object"
    ? settings.historySalesOverrides : {};
  const nextOverrides = Object.fromEntries(Object.entries(oldOverrides).filter(([, entry]) => {
    return !selectedProducts.some(product => isSameCleanupProduct(entry || {}, product));
  }));
  const nextSettings = { ...settings, historySalesOverrides: nextOverrides };

  // V6.8 atomic local snapshot: write all related collections first, then mark one cloud sync set.
  localStorage.setItem("importSystemProducts", JSON.stringify(nextProducts));
  localStorage.setItem("importSystemImports", JSON.stringify(nextImports));
  localStorage.setItem("importSystemBatches", JSON.stringify(nextBatches));
  localStorage.setItem("importSystemSettings", JSON.stringify(nextSettings));

  if (typeof markCloudCollectionSaved === "function") {
    markCloudCollectionSaved("products", products, nextProducts);
    markCloudCollectionSaved("imports", imports, nextImports);
    markCloudCollectionSaved("batches", batches, nextBatches);
  }
  if (JSON.stringify(settings) !== JSON.stringify(nextSettings) && typeof markCloudSettingsSaved === "function") {
    markCloudSettingsSaved();
  }

  renderProductList();
  renderDashboard();
  renderInventoryManagementList();
  renderBatchSuggestions();
  renderBatchList();
  renderBatchProductStockResults();
  renderImportHistory();
  renderProductPrefixRulesV181();
  collapseStaleZeroStockPanelV227();

  showDataToolsStatus(`已永久删除 ${formatNumber(selectedProducts.length)} 个零库存产品及相关进口资料；对应前缀／类别如已无其他产品使用会自动解锁，正在同步 Google Sheet`);
}



function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function xmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function excelCell(value, type = "String", styleId = "") {
  const style = styleId ? ` ss:StyleID="${styleId}"` : "";
  return `<Cell${style}><Data ss:Type="${type}">${xmlEscape(value)}</Data></Cell>`;
}

function excelDisplayLength(value) {
  const text = String(value ?? "");
  let length = 0;
  for (const char of text) {
    length += char.charCodeAt(0) > 255 ? 2 : 1;
  }
  return length;
}

function excelColumnWidth(header, rows, columnIndex) {
  let maxLength = excelDisplayLength(header);
  rows.forEach(row => {
    maxLength = Math.max(maxLength, excelDisplayLength(row[columnIndex]));
  });

  // SpreadsheetML Width uses points. Keep long text readable without creating absurdly wide columns.
  return Math.max(58, Math.min(260, 12 + maxLength * 6.2));
}

function excelWorksheet(name, headers, rows, columnTypes = []) {
  const columnsXml = headers.map((header, index) => {
    const width = excelColumnWidth(header, rows, index).toFixed(1);
    return `<Column ss:AutoFitWidth="1" ss:Width="${width}"/>`;
  }).join("");

  const headerXml = `<Row ss:StyleID="HeaderRow">${headers.map(header => excelCell(header, "String", "Header")).join("")}</Row>`;
  const rowXml = rows.map(row => {
    return `<Row>${row.map((value, index) => {
      const cellType = columnTypes[index] || "auto";
      const isNumber = typeof value === "number" && Number.isFinite(value);

      if (!isNumber) return excelCell(value ?? "", "String");
      if (cellType === "integer") return excelCell(Math.round(value), "Number", "Integer");
      if (cellType === "money" || cellType === "decimal2" || cellType === "rate") {
        return excelCell(Number(value), "Number", "Number2");
      }
      return excelCell(Number(value), "Number", "GeneralNumber");
    }).join("")}</Row>`;
  }).join("");

  return `<Worksheet ss:Name="${xmlEscape(name)}"><Table>${columnsXml}${headerXml}${rowXml}</Table></Worksheet>`;
}

function exportSystemExcel() {
  const products = getProducts();
  const imports = getImports();
  const batches = getBatches();

  // Inventory 工作表只导出真正仍有库存的产品。
  // 删除批次或测试后留下的零库存、已移除产品不会再成为 Excel 垃圾资料。
  const activeInventoryProducts = products.filter(
    product => (Number(product.stock) || 0) > 0
  );

  const inventoryRows = activeInventoryProducts.map(product => [
    product.id || "",
    product.name || "",
    product.category || "",
    Number(product.stock) || 0,
    Number(product.averageCost) || 0,
    getEffectiveProductMinimumPriceV333(product),
    (Number(product.stock) || 0) * (Number(product.averageCost) || 0),
    getLatestImportDateByProduct(product.id) || "",
    "当前库存"
  ]);

  const importRows = imports.map(record => [
    record.importNumber || "",
    record.containerDate || "",
    record.arrivalDate || "",
    record.productId || "",
    record.productName || "",
    record.category || "",
    Number(record.quantity) || 0,
    Number(record.unitPrice) || 0,
    record.currency || "",
    Number(record.rate) || 0,
    Number(record.purchaseRM) || 0,
    Number(record.unitCost) || 0,
    Number(record.stockAdded) || 0,
    record.averageDirection || ""
  ]);

  const batchRows = batches.map(batch => [
    batch.importNumber || "",
    batch.containerDate || "",
    batch.arrivalDate || "",
    Number(batch.transitDays) || 0,
    Number(batch.itemCount) || 0,
    Number(batch.totalQuantity) || 0,
    Number(batch.rackQuantity) || 0,
    batch.overseasTrackingNumber || "",
    batch.currency || "",
    Number(batch.rate) || 0,
    Number(batch.shippingMY) || 0,
    Number(batch.shippingRate) || 0,
    Number(batch.grandTotal) || 0
  ]);

  const workbook =
    `<?xml version="1.0"?>` +
    `<?mso-application progid="Excel.Sheet"?>` +
    `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ` +
    `xmlns:o="urn:schemas-microsoft-com:office:office" ` +
    `xmlns:x="urn:schemas-microsoft-com:office:excel" ` +
    `xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">` +
    `<Styles>` +
      `<Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="10"/></Style>` +
      `<Style ss:ID="Header"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="10" ss:Bold="1"/><Interior ss:Color="#D9EAD3" ss:Pattern="Solid"/></Style>` +
      `<Style ss:ID="HeaderRow"><Alignment ss:Vertical="Center"/></Style>` +
      `<Style ss:ID="Integer"><NumberFormat ss:Format="0"/></Style>` +
      `<Style ss:ID="Number2"><NumberFormat ss:Format="#,##0.00"/></Style>` +
      `<Style ss:ID="GeneralNumber"><NumberFormat ss:Format="General"/></Style>` +
    `</Styles>` +
    excelWorksheet(
      "Inventory",
      ["产品编号", "产品名称", "类别", "当前库存", "平均成本", "最低售价", "库存成本总值", "最后进口", "状态"],
      inventoryRows,
      ["text", "text", "text", "integer", "money", "money", "money", "text", "text"]
    ) +
    excelWorksheet(
      "Imports",
      ["进口编号", "装柜日期", "抵达日期", "产品编号", "产品名称", "类别", "数量", "单价", "货币", "汇率", "货款RM", "每件成本RM", "入库", "成本变化"],
      importRows,
      ["text", "text", "text", "text", "text", "text", "integer", "money", "text", "rate", "money", "money", "integer", "text"]
    ) +
    excelWorksheet(
      "Batches",
      ["进口编号", "装柜日期", "抵达日期", "运输天数", "产品种类", "总数量", "木架总数", "海外运输单号 / 本地单号", "货币", "汇率", "海外运费RM", "海外运费比例", "进口总成本RM"],
      batchRows,
      ["text", "text", "text", "integer", "integer", "integer", "integer", "text", "text", "rate", "money", "decimal2", "money"]
    ) +
    `</Workbook>`;

  downloadTextFile(
    `Import_Inventory_${formatDateDDMMYYYY(new Date())}.xls`,
    workbook,
    "application/vnd.ms-excel;charset=utf-8"
  );

  showDataToolsStatus(`Excel 已导出：${activeInventoryProducts.length} 项当前库存；金额已格式化为 2 位小数`);
}

async function backupSystemData() {
  setDataOperationRunning("Backup", "正在建立 Backup 文件，请勿关闭、刷新或离开页面");
  setDataToolButtonsBusy(true);

  // Allow the visible “进行中” state to paint before building the file.
  await new Promise(resolve => window.requestAnimationFrame(() => resolve()));

  try {
    const backup = {
      app: "Lover Legend Import Cost & Inventory System",
      version: "33.9",
      exportedAt: new Date().toISOString(),
      settings: loadJSON("importSystemSettings", {}),
      products: getProducts(),
      imports: getImports(),
      batches: getBatches(),
      processedSalesKeys: getProducts().flatMap(product=>getProductStockAdjustments(product).flatMap(a=>(Array.isArray(a?.salesLinks)?a.salesLinks:[]).map(link=>String(link?.key||"").trim()).filter(Boolean))),
      inventoryProcessingLogIncluded: true
    };

    downloadTextFile(
      `Import_Inventory_Backup_${formatDateDDMMYYYY(new Date())}.json`,
      JSON.stringify(backup, null, 2),
      "application/json;charset=utf-8"
    );

    localStorage.setItem(SYSTEM_INFO_LAST_BACKUP_KEY_V203, new Date().toISOString());
    renderSystemInformationV203();
    setDataOperationFinal("Backup", true, "Backup 成功", "文件已建立并开始下载");
    showDataToolsStatus("Backup 成功");
  } catch (error) {
    console.error("Backup failed", error);
    setDataOperationFinal("Backup", false, "Backup 失败", error.message || "无法建立 Backup 文件");
    showDataToolsStatus(`Backup 失败：${error.message || "无法建立 Backup 文件"}`, true);
  } finally {
    setDataToolButtonsBusy(false);
    dataOperationActive = false;
  }
}

function normalizeRestoreBackup(rawData) {
  if (!rawData || typeof rawData !== "object") {
    throw new Error("Backup JSON 不是有效对象");
  }

  if (
    !Array.isArray(rawData.products) ||
    !Array.isArray(rawData.imports) ||
    !Array.isArray(rawData.batches)
  ) {
    throw new Error("Backup 缺少 products / imports / batches 数组");
  }

  const idSet = (items, label) => {
    const seen = new Set();
    items.forEach((item, index) => {
      const id = String(item?.id || "").trim();
      if (!id) throw new Error(`${label} 第 ${index + 1} 笔缺少 ID`);
      if (seen.has(id)) throw new Error(`${label} 出现重复 ID：${id}`);
      seen.add(id);
    });
  };

  idSet(rawData.products, "Products");
  idSet(rawData.imports, "Imports");
  idSet(rawData.batches, "Batches");

  if(Array.isArray(rawData.processedSalesKeys)){
    const restoredKeys=new Set(rawData.products.flatMap(product=>getProductStockAdjustments(product).flatMap(a=>(Array.isArray(a?.salesLinks)?a.salesLinks:[]).map(link=>String(link?.key||"").trim()).filter(Boolean))));
    const missing=rawData.processedSalesKeys.map(String).filter(Boolean).filter(key=>!restoredKeys.has(key));
    if(missing.length)throw new Error(`Backup Process Log 不完整，缺少 ${missing.length} 个 Sales Key，已停止 Restore`);
  }

  const batches = rawData.batches.map(batch => {
    const b = { ...batch };

    // 旧 Backup 兼容：旧名称只在新版标准字段不存在时补入。
    if (b.chinaTransportCost == null && b.inlandTransportCost != null) {
      b.chinaTransportCost = Number(b.inlandTransportCost) || 0;
    }
    if (b.chinaTransportRM == null && b.inlandTransportRM != null) {
      b.chinaTransportRM = Number(b.inlandTransportRM) || 0;
    }
    if (b.potCost == null && b.potForeign != null) {
      b.potCost = Number(b.potForeign) || 0;
    }
    if (b.potRM == null && b.potCostRM != null) {
      b.potRM = Number(b.potCostRM) || 0;
    }

    if (!Array.isArray(b.items)) b.items = [];
    return b;
  });

  return {
    settings: rawData.settings && typeof rawData.settings === "object" ? rawData.settings : {},
    products: rawData.products.map(item => ({
      ...item,
      minimumPrice: Math.max(0, Number(item?.minimumPrice) || 0)
    })),
    imports: rawData.imports.map(item => ({ ...item })),
    batches
  };
}

function getDeletedIdsForRestore(previousItems = [], nextItems = []) {
  const nextIds = new Set(nextItems.map(item => String(item?.id || "")).filter(Boolean));
  return previousItems
    .map(item => String(item?.id || ""))
    .filter(id => id && !nextIds.has(id));
}

function applyRestoreSnapshot(restored) {
  if (typeof isCloudBootstrapComplete === "function" && !isCloudBootstrapComplete()) {
    throw new Error("Google Sheet 首次同步尚未完成，请等待显示「已同步」后再 Restore");
  }

  const previous = {
    settings: loadJSON("importSystemSettings", {}),
    products: getProducts(),
    imports: getImports(),
    batches: getBatches()
  };

  const rollback = () => {
    localStorage.setItem("importSystemSettings", JSON.stringify(previous.settings || {}));
    localStorage.setItem("importSystemProducts", JSON.stringify(previous.products || []));
    localStorage.setItem("importSystemImports", JSON.stringify(previous.imports || []));
    localStorage.setItem("importSystemBatches", JSON.stringify(previous.batches || []));
  };

  try {
    if (typeof cloudApplyingRemote !== "undefined") cloudApplyingRemote = true;
    localStorage.setItem("importSystemSettings", JSON.stringify(restored.settings || {}));
    localStorage.setItem("importSystemProducts", JSON.stringify(restored.products || []));
    localStorage.setItem("importSystemImports", JSON.stringify(restored.imports || []));
    localStorage.setItem("importSystemBatches", JSON.stringify(restored.batches || []));
  } catch (error) {
    try { rollback(); } catch (rollbackError) { console.error("Restore rollback failed", rollbackError); }
    throw error;
  } finally {
    if (typeof cloudApplyingRemote !== "undefined") cloudApplyingRemote = false;
  }

  // Restore 是一次完整快照覆盖，只建立一次 dirty queue，避免 products/imports/batches 分三次 Push。
  if (typeof getCloudQueue === "function" && typeof saveCloudQueue === "function") {
    const queue = getCloudQueue();
    queue.dirty = true;
    queue.changedAt = new Date().toISOString();
    queue.deleted = {
      products: getDeletedIdsForRestore(previous.products, restored.products),
      imports: getDeletedIdsForRestore(previous.imports, restored.imports),
      batches: getDeletedIdsForRestore(previous.batches, restored.batches)
    };
    saveCloudQueue(queue);
  }

  if (typeof scheduleGoogleSync === "function") {
    scheduleGoogleSync(120);
  }
}

function createRestoreJobId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `restore-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function saveLocalRestoreJob(job) {
  try {
    if (job) localStorage.setItem(RESTORE_JOB_LOCAL_KEY, JSON.stringify(job));
    else localStorage.removeItem(RESTORE_JOB_LOCAL_KEY);
  } catch (error) {}
}

function getLocalRestoreJob() {
  return loadJSON(RESTORE_JOB_LOCAL_KEY, null);
}

function restoreLeaveProtectionActiveV133() {
  const job=getLocalRestoreJob();
  if(job&&String(job.type||'').toLowerCase()==='restore'&&String(job.state||'').toLowerCase()==='running')return true;
  const title=String(document.getElementById('dataOperationTitle')?.textContent||'');
  return Boolean(dataOperationActive&&/Restore/i.test(title));
}

function confirmRestoreNavigationV133() {
  if(!restoreLeaveProtectionActiveV133())return true;
  return window.confirm('Restore 正在进行，离开或刷新可能无法立即确认恢复结果。\n\n建议等待显示「Restore 完成」。仍要离开？');
}
window.restoreLeaveProtectionActiveV133=restoreLeaveProtectionActiveV133;
window.confirmRestoreNavigationV133=confirmRestoreNavigationV133;

function formatJobTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-GB", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  }).replaceAll("/", "-");
}

function renderRestoreJob(job) {
  if (!job) return;
  saveLocalRestoreJob(job);

  const panel = document.getElementById("dataOperationStatus");
  const title = document.getElementById("dataOperationTitle");
  const step = document.getElementById("dataOperationStep");
  const meta = document.getElementById("dataOperationMeta");
  if (!panel || !title || !step || !meta) return;

  panel.hidden = false;
  panel.classList.remove("is-running", "is-success", "is-failed");
  panel.classList.add(job.state === "success" ? "is-success" : job.state === "failed" ? "is-failed" : "is-running");

  if (job.state === "success") {
    localStorage.setItem(SYSTEM_INFO_LAST_RESTORE_KEY_V203, job.completedAt || job.updatedAt || new Date().toISOString());
    renderSystemInformationV203();
    title.textContent = "✓ Restore 成功";
    step.textContent = job.step || "Restore 已完成";
    meta.textContent = `完成时间：${formatJobTime(job.completedAt || job.updatedAt)}`;
    dataOperationActive = false;
    setDataToolButtonsBusy(false);
  } else if (job.state === "failed") {
    title.textContent = "✕ Restore 失败";
    step.textContent = `${job.step || "Restore"}：${job.error || "未知原因"}`;
    meta.textContent = `失败时间：${formatJobTime(job.completedAt || job.updatedAt)}`;
    dataOperationActive = false;
    setDataToolButtonsBusy(false);
  } else {
    title.textContent = "↻ Restore 进行中，请勿关闭或刷新页面";
    step.textContent = `当前步骤：${job.step || "处理中"}`;
    meta.textContent = `开始时间：${formatJobTime(job.startedAt || job.updatedAt)}`;
    dataOperationActive = true;
    setDataToolButtonsBusy(true);
  }
}

function setDataOperationRunning(type, step) {
  dataOperationActive = true;
  const panel = document.getElementById("dataOperationStatus");
  const title = document.getElementById("dataOperationTitle");
  const stepEl = document.getElementById("dataOperationStep");
  const meta = document.getElementById("dataOperationMeta");
  if (!panel || !title || !stepEl || !meta) return;
  panel.hidden = false;
  panel.classList.remove("is-success", "is-failed");
  panel.classList.add("is-running");
  title.textContent = `↻ ${type} 进行中，请勿关闭或刷新页面`;
  stepEl.textContent = `当前步骤：${step}`;
  meta.textContent = `开始时间：${formatJobTime(new Date().toISOString())}`;
}

function setDataOperationFinal(type, success, titleText, detail) {
  const panel = document.getElementById("dataOperationStatus");
  const title = document.getElementById("dataOperationTitle");
  const step = document.getElementById("dataOperationStep");
  const meta = document.getElementById("dataOperationMeta");
  if (!panel || !title || !step || !meta) return;
  panel.hidden = false;
  panel.classList.remove("is-running", "is-success", "is-failed");
  panel.classList.add(success ? "is-success" : "is-failed");
  title.textContent = `${success ? "✓" : "✕"} ${titleText}`;
  step.textContent = detail || "";
  meta.textContent = `时间：${formatJobTime(new Date().toISOString())}`;
}

function setDataToolButtonsBusy(busy) {
  ["backupDataBtn", "restoreDataBtn"].forEach(id => {
    const button = document.getElementById(id);
    if (button) button.disabled = Boolean(busy);
  });
}

async function fetchRestoreJobStatus() {
  try {
    const data = await callGoogleApi({ action: "restoreJobStatus" });
    if (data && data.job) {
      renderRestoreJob(data.job);
      if (data.job.state === "running") scheduleRestoreJobPoll();
    }
    return data?.job || null;
  } catch (error) {
    console.warn("Unable to read Restore Job status", error);
    return null;
  }
}

function scheduleRestoreJobPoll() {
  window.clearTimeout(restoreJobPollTimer);
  restoreJobPollTimer = window.setTimeout(async () => {
    const job = await fetchRestoreJobStatus();
    if (job && job.state === "running") scheduleRestoreJobPoll();
  }, 2500);
}

function setupDataOperationSafety() {
  const localJob = getLocalRestoreJob();
  if (localJob) renderRestoreJob(localJob);

  window.addEventListener("beforeunload", event => {
    if (!dataOperationActive && !restoreLeaveProtectionActiveV133() && !salesInventoryOperationActiveV115) return;
    event.preventDefault();
    event.returnValue = salesInventoryOperationActiveV115?"库存处理中，请勿关闭或刷新页面。":"Backup / Restore 正在进行，请勿关闭或刷新页面。";
    return event.returnValue;
  });

  // Do not add any request to a normal startup.  Only a browser that already
  // has a Restore Job marker performs the status check after reopen.
  if (localJob) {
    window.setTimeout(() => fetchRestoreJobStatus(), 500);
  }
}

async function restoreSystemData(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;

  let restored;
  try {
    setDataOperationRunning("Restore", "读取并验证 Backup 文件");
    setDataToolButtonsBusy(true);
    const text = String(await file.text()).replace(/^\uFEFF/, "").trim();
    restored = normalizeRestoreBackup(JSON.parse(text));
  } catch (error) {
    console.error("Restore parse/validation failed", error);
    dataOperationActive = false;
    setDataToolButtonsBusy(false);
    setDataOperationFinal("Restore", false, "Restore 失败", error.message || "文件格式不正确");
    showDataToolsStatus(`Restore 失败：${error.message || "文件格式不正确"}`, true);
    return;
  }

  const confirmed = confirm(
    `Restore 会完整覆盖 Google Sheet 当前产品、库存和进口记录。\n\n` +
    `Products：${restored.products.length}\nImports：${restored.imports.length}\nBatches：${restored.batches.length}\n\n` +
    `Restore 进行中请勿关闭、刷新或离开页面；即使意外关闭，重新打开后仍可读取 Restore Job 状态。\n\n确定继续？`
  );
  if (!confirmed) {
    dataOperationActive = false;
    setDataToolButtonsBusy(false);
    setDataOperationFinal("Restore", false, "Restore 已取消", "没有修改任何资料");
    return;
  }

  if (typeof isCloudBootstrapComplete === "function" && !isCloudBootstrapComplete()) {
    dataOperationActive = false;
    setDataToolButtonsBusy(false);
    setDataOperationFinal("Restore", false, "Restore 失败", "Google Sheet 首次同步尚未完成，请等待显示「已同步」后再 Restore");
    return;
  }

  const config = getCloudConfig();
  const jobId = createRestoreJobId();
  const localJob = {
    jobId,
    type: "restore",
    state: "running",
    step: "上传 Restore 快照至 Google Sheet",
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    counts: { products: restored.products.length, imports: restored.imports.length, batches: restored.batches.length }
  };
  renderRestoreJob(localJob);

  try {
    const data = await callGoogleApi({
      action: "restoreSnapshot",
      clientVersion: APP_VERSION,
      schemaVersion: CLOUD_SCHEMA_VERSION,
      baseRevision: Number(config.revision) || 0,
      bootstrapToken: String(config.bootstrapToken || ""),
      bootstrapRevision: Number(config.bootstrapRevision) || 0,
      updatedBy: "System V33.9 Stable",
      jobId,
      settings: restored.settings,
      products: restored.products,
      imports: restored.imports,
      batches: restored.batches
    });

    if (data.job) renderRestoreJob(data.job);

    // Update the browser only after the server confirms the full Restore.
    // Normal cloud formulas/logic are untouched; this is a fresh canonical Pull.
    await pullLatestSnapshot(true);
    saveCloudQueue({
      dirty: false,
      changedAt: "",
      deleted: { products: [], imports: [], batches: [] }
    });
    localStorage.setItem(SYSTEM_INFO_LAST_RESTORE_KEY_V203, data?.job?.completedAt || data?.job?.updatedAt || new Date().toISOString());
    renderSystemInformationV203();
    dataOperationActive = false;
    setDataToolButtonsBusy(false);
    showDataToolsStatus("Restore 成功：Google Sheet 与本机资料已更新");
  } catch (error) {
    console.error("Restore failed", error);
    // The request may have reached Apps Script even if the browser lost the
    // response. Read the persisted server job before declaring a final failure.
    const job = await fetchRestoreJobStatus();
    if (!job || job.state !== "running") {
      dataOperationActive = false;
      setDataToolButtonsBusy(false);
    }
    if (!job) {
      setDataOperationFinal("Restore", false, "Restore 失败", error.message || "无法完成 Restore");
    }
    showDataToolsStatus(`Restore 状态：${job?.state === "running" ? "服务器仍在处理，请勿重复 Restore" : (job?.error || error.message || "失败")}`, true);
  }
}

function showDataToolsStatus(message, isError = false) {
  const status = document.getElementById("dataToolsStatus");
  if (!status) return;

  status.textContent = message;
  status.classList.toggle("error-status", isError);

  window.clearTimeout(status._clearTimer);
  status._clearTimer = window.setTimeout(() => {
    status.textContent = "";
    status.classList.remove("error-status");
  }, 4500);
}


function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(error => {
      console.error("Service Worker registration failed:", error);
    });
  }
}


// V19.8 Shared quick navigation.  It deliberately observes only page/result
// containers; it must never watch or mutate the history filter controls.
(function(){
  function setupHistoryScrollButton(){
    if(document.getElementById("historyScrollToggleV86")) return;
    const btn=document.createElement("button");
    btn.id="historyScrollToggleV86";
    btn.className="history-scroll-toggle-v86";
    btn.type="button";
    btn.textContent="↓ 到底部";
    document.body.appendChild(btn);

    const isNearBottom=()=>window.scrollY+window.innerHeight>=document.documentElement.scrollHeight-80;
    const updateLabel=()=>{const label=isNearBottom()?"↑ 回顶部":"↓ 到底部";if(btn.textContent!==label)btn.textContent=label;};
    btn.onclick=function(){
      if(!isNearBottom()){
        window.scrollTo({top:document.documentElement.scrollHeight,behavior:"smooth"});
      }else{
        window.scrollTo({top:0,behavior:"smooth"});
      }
      window.setTimeout(updateLabel,350);
    };

    const updateVisibility=()=>{
      const history=document.getElementById("historyPage");
      const dashboard=document.getElementById("dashboardPage");
      const historyVisible=history && history.classList.contains("active");
      const dashboardVisible=dashboard && dashboard.classList.contains("active");
      const historyResult=document.getElementById("historyResult");
      const hasResult=historyResult && !historyResult.querySelector(":scope > .empty-state");
      const hasInventory=inventoryVisibleProductsV153.length>0;
      btn.classList.toggle("show",!!((historyVisible&&hasResult)||(dashboardVisible&&hasInventory)));
      updateLabel();
    };

    const historyResult=document.getElementById("historyResult");
    if(historyResult){
      new MutationObserver(updateVisibility).observe(historyResult,{childList:true,subtree:true});
    }
    document.querySelectorAll(".bottom-nav button, .bottom-nav a").forEach(item=>{
      item.addEventListener("click",()=>window.setTimeout(updateVisibility,0));
    });
    window.addEventListener("scroll",updateLabel,{passive:true});
    window.addEventListener("resize",updateLabel,{passive:true});
    updateVisibility();
  }
  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",setupHistoryScrollButton);
  }else setupHistoryScrollButton();
})();


// ================= V26.6 bilingual product master =================
// English/Chinese helper names are species-only. Styling, form, size and price grade stay in the Chinese product name.
const PRODUCT_SPECIES_ALIASES_V262 = Object.freeze([
  {cn:"黄杨", en:"Buxus / Boxwood", keys:["黄杨","buxus","boxwood"], prefix:"BX"},
  {cn:"凌珊", en:"Bluebell", keys:["凌珊","bluebell"], prefix:"BB"},
  {cn:"罗汉松", en:"Podocarpus", keys:["罗汉松","podocarpus"], prefix:"PD"},
  {cn:"李氏樱桃", en:"Lee Cherry / Sakura", keys:["李氏樱桃","lee cherry","sakura"], prefix:"SK"},
  {cn:"水梅", en:"Jeliti / Anting Puteri / Water Jasmine", keys:["水梅","jeliti","anting puteri","water jasmine"], prefix:"JL"},
  {cn:"酸豆", en:"Asam Jawa", keys:["酸豆","asam jawa"], prefix:"AS"},
  {cn:"寿娘子", en:"Premna / Sancang / Bebuas", keys:["寿娘子","premna","sancang","bebuas"], prefix:"SC"},
  {cn:"三角梅", en:"Bougainvillea", keys:["三角梅","bougainvillea"], prefix:"BV"},
  {cn:"七里香 / 九里香", en:"Murraya", keys:["七里香","九里香","murraya"], prefix:"MR"},
  {cn:"仙丹", en:"Ixora", keys:["仙丹","ixora"], prefix:"IX"},
  {cn:"真柏", en:"Juniperus", keys:["真柏","juniperus"], prefix:"JU"},
  {cn:"系鱼川", en:"Itoigawa Shimpaku", keys:["系鱼川","itoigawa","itoigawa shimpaku"], prefix:"JU"},
  {cn:"福建茶", en:"Ho Kian Tea / Fujian Tea", keys:["福建茶","ho kian tea","fujian tea","fukien tea"], prefix:"HK"},
  {cn:"绿萝", en:"Epipremnum Aureum", keys:["绿萝","epipremnum aureum","epipremnum"]},
  {cn:"龟背竹", en:"Monstera", keys:["龟背竹","monstera","monstera deliciosa"], prefix:"MO"},
  {cn:"榕属", en:"Ficus", keys:["榕属","ficus"], prefix:"FI"}
]);
const PRODUCT_LANGUAGE_META_KEY_V262="productLanguageMetaV262";
function normalizeSearchTextV262(v){return String(v||"").normalize("NFKC").toLowerCase().replace(/\s+/g," ").trim()}
function speciesRuleV262(text){const q=normalizeSearchTextV262(text);if(!q)return null;return PRODUCT_SPECIES_ALIASES_V262.find(r=>r.keys.some(k=>q.includes(normalizeSearchTextV262(k))))||null}
function getProductLanguageMetaV262(){const s=getCachedSettingsV317();return s[PRODUCT_LANGUAGE_META_KEY_V262]&&typeof s[PRODUCT_LANGUAGE_META_KEY_V262]==="object"?s[PRODUCT_LANGUAGE_META_KEY_V262]:{}}
function saveProductLanguageMetaV262(meta){const s=loadJSON("importSystemSettings",{});saveJSON("importSystemSettings",{...s,[PRODUCT_LANGUAGE_META_KEY_V262]:meta||{}});if(typeof markCloudSettingsSaved==="function")markCloudSettingsSaved()}
function productEnglishNameV262(product){if(!product)return"";const meta=getProductLanguageMetaV262()[String(product.id||"").toUpperCase()]||{};if(meta.englishName)return String(meta.englishName);if(product.englishName)return String(product.englishName);return speciesRuleV262(product.name)?.en||""}
function productSearchTextV262(product){const sup=typeof inferSupplierFromProductV261==="function"?inferSupplierFromProductV261(product):null;const settings=loadJSON("importSystemSettings",{}),aliases=settings.productIdAliases||{},id=String(product?.id||"").trim().toUpperCase(),oldIds=Object.entries(aliases).filter(([,v])=>String(v||"").trim().toUpperCase()===id).map(([k])=>k);return [product?.id,...oldIds,product?.name,productEnglishNameV262(product),sup?.name,sup?.prefix,...(sup?.aliases||[])].filter(Boolean).join(" ")}
function productNameWithEnglishV262(product){const en=productEnglishNameV262(product);return `${escapeHTML(product?.name||"未命名产品")}${en?`<small class="product-english-name-v262">${escapeHTML(en)}</small>`:""}`}
function rememberProductLanguageV262(productId, chineseName, englishName){const id=String(productId||"").toUpperCase();if(!id)return;const meta=getProductLanguageMetaV262();meta[id]={chineseName:String(chineseName||"").trim(),englishName:String(englishName||"").trim()};saveProductLanguageMetaV262(meta)}
function inferSimpleBilingualV262(text){const raw=String(text||"").trim();const rule=speciesRuleV262(raw);return{chineseName:rule?.cn||(/[\u3400-\u9fff]/.test(raw)?raw:""),englishName:rule?.en||(!/[\u3400-\u9fff]/.test(raw)?raw.replace(/\b(?:P?\d{2,4}|\d+(?:\.\d+)?C|\d+[xX]\d+)\b.*$/i,"").trim():""),prefix:rule?.prefix||""}}

// ================= V33.9 Product Inventory Master =================
const SUPPLIER_ALIASES_V261 = Object.freeze([
  {names:["Ocean Landscaping","Ocean Landscaping Nursery"],prefix:"OLN",currency:"MYR"},{names:["JM Gardening","JM Landscape","JM Nursery"],prefix:"JMG",currency:"MYR"},{names:["Soong Huat Enterprise","Soong Huat Cameron"],prefix:"SHE",currency:"MYR"},{names:["Tan Ah Hwang Nursery"],prefix:"TAH",currency:"MYR"},{names:["Tan Kok Leyong","Tan Kok Leyong Nursery"],prefix:"TKL",currency:"MYR"},{names:["Wong Wan Choi"],prefix:"WWC",currency:"MYR"},{names:["忠盛"],prefix:"忠盛",currency:"CNY"},{names:["大厚"],prefix:"大厚",currency:"CNY"},{names:["游小北"],prefix:"游小北",currency:"CNY"},{names:["昊杨"],prefix:"昊杨",currency:"CNY"},{names:["松美轩"],prefix:"松美轩",currency:"CNY"}
]);
function supplierPrefixV261(prefix){let p=String(prefix||"").normalize("NFKC").trim();if(/^OLS$/i.test(p))p="OLN";if(/[\u3400-\u9fff]/.test(p))return (p.match(/[\u3400-\u9fff]/g)||[]).join("").slice(0,4);return p.toUpperCase().replace(/[^A-Z]/g,"").slice(0,3)}
function inferSupplierFromProductV261(product){const name=String(product?.name||"").trim().toLowerCase();for(const x of SUPPLIER_ALIASES_V261){for(const label of [x.prefix,...x.names].filter(Boolean).sort((a,b)=>b.length-a.length)){if(name.startsWith(String(label).toLowerCase()))return{name:x.names[0],aliases:x.names.slice(1),prefix:x.prefix,currency:x.currency}}}return null}
function inventoryMasterRowsV261(){
  return getInventoryPreparedRowsV321().map(p=>{
    const sup=inferSupplierFromProductV261(p);
    const state=getMinimumPriceDisplayStateV315(p);
    return {
      product:p,productId:p.id||"",cnName:p.name||"",enName:productEnglishNameV262(p),supplierPrefix:supplierPrefixV261(sup?.prefix||""),category:p.category||"",
      stock:Number(p.stock)||0,originalCost:Math.max(0,Number(p.latestOriginalCost)||0),averageCost:Number(p.averageCost)||0,inventoryValue:(Number(p.stock)||0)*(Number(p.averageCost)||0),minimumPrice:state.price,
      lastImportDate:p.displayLastImport||"",lastImportNumber:String(p.latestImportNumber||""),remark:String(p.remark||""),importNumbers:String(p.importNumbers||""),overseasTrackingNumbers:String(p.overseasTrackingNumbers||""),originalCostValuesV216:Array.isArray(p.originalCostValuesV216)?p.originalCostValuesV216:[],
      latestSoldAt:Number(p.latestSoldAt)||0,netSoldQuantity:Number(p.netSoldQuantity)||0,cumulativeSoldProfit:Number(p.cumulativeSoldProfit)||0
    };
  });
}
function renderInventoryMasterV261(){
  const body=document.getElementById("inventoryMasterBodyV261"),count=document.getElementById("inventoryMasterCountV261"),rawQuery=String(document.getElementById("inventoryMasterSearchV261")?.value||"").trim(),keyword=rawQuery.toLowerCase(),sort=String(document.getElementById("inventoryMasterSortV264")?.value||"latest");
  if(!body)return;
  const canonicalRows=filterSortInventoryProductsV324(keyword,sort,getInventoryPreparedRowsV321());
  let rows=canonicalRows.map(p=>{
    const sup=inferSupplierFromProductV261(p),state=getMinimumPriceDisplayStateV315(p);
    return {product:p,productId:p.id||"",cnName:p.name||"",enName:productEnglishNameV262(p),supplierPrefix:supplierPrefixV261(sup?.prefix||""),category:p.category||"",stock:Number(p.stock)||0,originalCost:Math.max(0,Number(p.latestOriginalCost)||0),averageCost:Number(p.averageCost)||0,inventoryValue:(Number(p.stock)||0)*(Number(p.averageCost)||0),minimumPrice:state.price,lastImportDate:p.displayLastImport||"",lastImportNumber:String(p.latestImportNumber||""),remark:String(p.remark||""),importNumbers:String(p.importNumbers||""),overseasTrackingNumbers:String(p.overseasTrackingNumbers||""),originalCostValuesV216:Array.isArray(p.originalCostValuesV216)?p.originalCostValuesV216:[],latestSoldAt:Number(p.latestSoldAt)||0,netSoldQuantity:Number(p.netSoldQuantity)||0,cumulativeSoldProfit:Number(p.cumulativeSoldProfit)||0};
  });
  const matchedBatch=keyword?getBatches().find(b=>String(b.importNumber||"").trim().toLowerCase()===keyword):null;
  const totalStock=matchedBatch?getBatchItemsForDisplay(matchedBatch).reduce((sum,item)=>{const oq=Math.max(0,Number(item.originalQuantity??item.quantity)||0),rr=Number(item.remainingQuantity??item.quantity),rq=Number.isFinite(rr)?Math.min(oq,Math.max(0,Math.floor(rr))):oq;return sum+rq},0):rows.reduce((n,r)=>n+(Number(r.stock)||0),0);
  const totalValue=matchedBatch?(Number(matchedBatch.grandTotal)||0):rows.reduce((n,r)=>n+(Number(r.inventoryValue)||0),0);
  if(count)count.textContent=`${rows.length} 项`;const st=document.getElementById("inventoryMasterStockV264"),val=document.getElementById("inventoryMasterValueV264");if(st)st.textContent=formatNumber(totalStock);if(val)val.textContent=`RM ${formatMoney(totalValue)}`;
  const masterHeaderV315=document.getElementById("inventoryMasterMinimumHeaderV315"); if(masterHeaderV315)masterHeaderV315.textContent="最低售价";
  body.innerHTML=rows.map(r=>{const stateV315=getMinimumPriceDisplayStateV315(r.product);return `<tr><td><button type="button" class="master-copy-v263" data-master-copy-v263="${escapeHTML(r.productId)}">${escapeHTML(r.productId)}</button></td><td><button type="button" class="master-copy-v263 master-name-v262" data-master-copy-v263="${escapeHTML(r.cnName)}">${escapeHTML(r.cnName)}</button></td><td><button type="button" class="master-copy-v263 master-en-v262" data-master-copy-v263="${escapeHTML(r.enName)}">${escapeHTML(r.enName)}</button></td><td class="master-num-v264">${formatNumber(r.stock)}</td><td class="master-num-v264">${formatMoney(r.averageCost)}</td><td class="master-num-v264 ${stateV315.className}" data-minimum-price-state-v324="${stateV315.state}"><span class="master-price-main-v266">${formatMoney(r.minimumPrice)}</span></td></tr>`}).join("")||'<tr><td colspan="6">暂无符合资料</td></tr>';
  body.querySelectorAll("[data-master-copy-v263]").forEach(btn=>btn.addEventListener("click",()=>copyRuleLabelV232(btn,btn.dataset.masterCopyV263||"")));
}
function excelWorkbookV263(worksheets){return `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40"><Styles><Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Bottom"/><Font ss:FontName="Arial" ss:Size="10"/></Style><Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#D9EAD3" ss:Pattern="Solid"/></Style><Style ss:ID="HeaderRow"/><Style ss:ID="Number2"><NumberFormat ss:Format="#,##0.00"/></Style><Style ss:ID="Integer"><NumberFormat ss:Format="#,##0"/></Style><Style ss:ID="GeneralNumber"><NumberFormat ss:Format="#,##0.00"/></Style></Styles>${worksheets}</Workbook>`}
function exportInventoryMasterExcelV261(){
  const rows=inventoryMasterRowsV261().map(r=>[r.productId,r.cnName,r.enName,r.supplierPrefix,r.category,r.stock,r.originalCost,r.averageCost,r.inventoryValue,r.minimumPrice,r.lastImportDate,r.lastImportNumber,r.remark]);
  const sheet=excelWorksheet("Inventory Master",["产品编号","中文名","英文名","供应商前缀","类别 / 细分类","当前库存","原成本","平均成本","库存成本总值","最低售价","最近进口日期","最近进口编号","备注"],rows,["text","text","text","text","text","decimal2","money","money","money","money","text","text","text"]);
  downloadTextFile(`Import_Inventory_Master_${formatDateDDMMYYYY(new Date())}.xls`,excelWorkbookV263(sheet),"application/vnd.ms-excel;charset=utf-8");
}
function setupInventoryMasterV299(){
  const search=document.getElementById("inventoryMasterSearchV261"),exp=document.getElementById("exportInventoryMasterExcelV261"),panel=document.getElementById("inventoryMasterPanelV264");
  const renderIfOpenV318=()=>{if(panel?.open)renderInventoryMasterV261()};
  search?.addEventListener("input",()=>{if(panel?.open)scheduleSearchRenderV302("inventory-master",renderInventoryMasterV261,90)});
  document.getElementById("inventoryMasterSortV264")?.addEventListener("change",event=>{
    const mode=String(event.target.value||"");
    const salesDependent=["latest-sold","bestseller-desc","profit-desc"].includes(mode);
    if(salesDependent&&!historyAllSalesLinksLoadedV136&&navigator.onLine){
      const body=document.getElementById("inventoryMasterBodyV261");
      if(body)body.innerHTML='<tr><td colspan="6">正在读取销售分析…</td></tr>';
      Promise.resolve(ensureVisibleHistorySalesDetailsV134()).then(()=>{
        inventorySalesAnalyticsCacheV146={signature:"",value:null};
        inventoryPreparedRowsCacheV321={rawProducts:null,settings:null,imports:null,batches:null,sales:null,rows:[]};
        if(panel?.open&&String(document.getElementById("inventoryMasterSortV264")?.value||"")===mode)renderInventoryMasterV261();
      });
      return;
    }
    renderIfOpenV318();
  });
  panel?.addEventListener("toggle",e=>{if(e.currentTarget.open)renderInventoryMasterV261()});
  exp?.addEventListener("click",exportInventoryMasterExcelV261);
}

