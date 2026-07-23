document.addEventListener("DOMContentLoaded", () => {
  repairLegacyImportDates();
  setupNavigation();
  setupSettings();
  setupDashboard();
  setupImportModule();
  setupImportHistory();
  setupInventoryModule();
  registerServiceWorker();
  setupCloudSync();
});


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

    (batch.items || []).forEach(item => {
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
    saveProducts(products);
    saveImports(imports);
    saveBatches(batches);
  }
}

function setupNavigation() {
  const buttons = document.querySelectorAll(".nav-btn");
  const pages = document.querySelectorAll(".page");

  buttons.forEach(button => {
    button.addEventListener("click", () => {
      const target = button.dataset.page;

      buttons.forEach(item => item.classList.remove("active"));
      pages.forEach(page => page.classList.remove("active"));

      button.classList.add("active");
      document.getElementById(target)?.classList.add("active");

      if (target === "importPage") {
        renderBatchSuggestions();
        renderBatchList();
      }

      if (target === "dashboardPage") {
        renderInventoryManagementList();
        renderDashboard();
      }

      if (target === "historyPage") {
        renderImportHistory();
      }

      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

function setupSettings() {
  const defaults = {
    CNY: 1.60,
    NTD: 7.69,
    VND: 6300.00,
    IDR: 3571.00
  };

  const saved = loadJSON("importSystemSettings", defaults);
  const ids = {
    CNY: "rateCNY",
    NTD: "rateNTD",
    VND: "rateVND",
    IDR: "rateIDR"
  };

  Object.entries(ids).forEach(([currency, id]) => {
    const input = document.getElementById(id);
    input.value = formatMoney(saved[currency] ?? defaults[currency]);
    input.addEventListener("focus", () => input.select());
    input.addEventListener("blur", () => formatInputAmount(input));
  });

  document.getElementById("saveSettingsBtn").addEventListener("click", () => {
    const data = {};

    Object.entries(ids).forEach(([currency, id]) => {
      data[currency] = parseAmount(document.getElementById(id).value);
    });

    saveJSON("importSystemSettings", data);
    if (typeof markCloudSettingsSaved === "function") {
      markCloudSettingsSaved();
    }

    const status = document.getElementById("settingsStatus");
    status.textContent = "设置已保存";
    setTimeout(() => {
      status.textContent = "";
    }, 1800);
  });

  setupDataTools();
}

function setupDashboard() {
  renderDashboard();
}

function renderDashboard() {
  const products = loadJSON("importSystemProducts", []);
  const activeInventoryProducts = products.filter(
    item =>
      !item.inventoryArchived &&
      (Number(item.stock) || 0) > 0
  );

  const productCount = activeInventoryProducts.length;
  const categoryOrder = ["盆栽", "花盆", "周边产品"];
  const categoryCounts = activeInventoryProducts.reduce((counts, item) => {
    const category = item.category || "盆栽";
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
  const latestBatchContainerDate = batches
    .map(batch => batch.containerDate)
    .filter(value => parseDDMMYYYY(value) > 0)
    .sort((a, b) => parseDDMMYYYY(b) - parseDDMMYYYY(a))[0];

  document.getElementById("lastImport").textContent =
    latestBatchContainerDate || dates[0] || "-";

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
    const value = stock * averageCost;

    return `
      <article class="inventory-card">
        <h4>${escapeHTML(item.name || "未命名产品")}</h4>
        <div class="inventory-meta">
          <div><span>库存</span><strong>${formatNumber(stock)}</strong></div>
          <div><span>平均成本</span><strong>${formatMoney(averageCost, "RM ")}</strong></div>
          <div><span>库存成本</span><strong>${formatMoney(value, "RM ")}</strong></div>
          <div><span>最后进口</span><strong>${escapeHTML(item.lastImport || "-")}</strong></div>
        </div>
      </article>
    `;
  }).join("");
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
  searchInput.addEventListener("input", renderProductList);

  resetProductForm();
  renderProductList();
}

function getProducts() {
  return loadJSON("importSystemProducts", []);
}

function saveProducts(products) {
  const previous = getProducts();
  saveJSON("importSystemProducts", products);
  if (typeof markCloudCollectionSaved === "function") {
    markCloudCollectionSaved("products", previous, products);
  }
}

function getProductPrefix(category) {
  if (category === "盆栽") return "PZ";
  if (category === "花盆") return "PS";
  return "ZB";
}

function generateNextProductId(products, category = "盆栽") {
  const prefix = getProductPrefix(category);

  const maxNumber = products.reduce((max, product) => {
    const match = String(product.id || "").match(
      new RegExp(`^${prefix}(\\d{4})$`)
    );

    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  return `${prefix}${String(maxNumber + 1).padStart(4, "0")}`;
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

  if (editingId) {
    const index = products.findIndex(product => product.id === editingId);
    if (index === -1) {
      statusText.textContent = "找不到要修改的产品";
      return;
    }

    products[index] = {
      ...products[index],
      name,
      category,
      status,
      remark,
      updatedAt: new Date().toISOString()
    };

    statusText.textContent = "产品已修改";
  } else {
    products.push({
      id: generateNextProductId(products, category),
      name,
      category,
      status,
      remark,
      stock: 0,
      averageCost: 0,
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

function renderProductList() {
  const products = getProducts();
  const keyword = document.getElementById("productSearch").value.trim().toLowerCase();
  const filtered = products.filter(product => {
    const target = `${product.id} ${product.name} ${product.category}`.toLowerCase();
    return target.includes(keyword);
  });

  document.getElementById("productListCount").textContent = `${filtered.length} 项`;

  const list = document.getElementById("productList");
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
            <h4>${escapeHTML(product.name)}</h4>
            <div class="product-code">${escapeHTML(product.id)}</div>
          </div>
          <div class="product-badges">
            <span class="badge">${escapeHTML(product.category)}</span>
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
  document.getElementById("productCategory").value = product.category;
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
    saveButton.textContent = "更新此批次";
    saveButton.classList.add("update-mode");
  } else {
    modeBox.hidden = true;
    label.textContent = "";
    saveButton.textContent = "保存新批次";
    saveButton.classList.remove("update-mode");
  }
}

function setupImportModule(){
  setupDatePickers();

  document.getElementById("addBatchRowBtn").addEventListener("click",()=>addBatchRow());
  document.getElementById("batchLookupInput").addEventListener("keydown", event => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    loadBatchByNumber();
  });
  document.getElementById("resetBatchBtn").addEventListener("click",()=>{
    if(confirm("确定清空本次尚未保存的输入？已保存的资料不会被删除。")) resetBatchForm({ clearLookup: true });
  });

  const batchForm = document.getElementById("batchImportForm");

  batchForm.addEventListener("submit", event => {
    event.preventDefault();
    saveBatchImport();
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

      // 方向键只控制“同批产品”表格，不影响下面的批次资料输入框。
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
    x.addEventListener("input",calculateBatch); x.addEventListener("blur",()=>{formatInputAmount(x);calculateBatch();});
  });
  document.getElementById("batchCurrency").addEventListener("change",()=>{applyBatchRate();calculateBatch();});

  const batchSearch = document.getElementById("batchSearch");
  const toggleBatchListBtn = document.getElementById("toggleBatchListBtn");

  if (batchSearch) {
    batchSearch.addEventListener("input", () => {
      batchListExpanded = false;
      renderBatchList();
    });
  }

  if (toggleBatchListBtn) {
    toggleBatchListBtn.addEventListener("click", () => {
      batchListExpanded = !batchListExpanded;
      renderBatchList();
    });
  }

  renderBatchSuggestions(); renderBatchList(); resetBatchForm();
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

function generateImportNumber(currency, containerDate, batches) {
  const code = String(currency || "IMP").toUpperCase();
  const digits = String(containerDate || "").replace(/\D/g, "");
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

  return `${prefix}${maxSequence + 1}`;
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


function getBatchItemsForDisplay(batch) {
  const storedItems = Array.isArray(batch.items)
    ? batch.items.filter(Boolean)
    : [];

  // batch.items is written with push(), so it preserves the user's original
  // top-to-bottom entry order. Prefer it whenever it is complete.
  if (
    storedItems.length &&
    (!Number(batch.itemCount) || storedItems.length >= Number(batch.itemCount))
  ) {
    return storedItems;
  }

  const importItems = getImports().filter(
    record => record.batchId === batch.id
  );

  // Older versions inserted every record with unshift(), which reversed the
  // rows. Reverse those legacy records back to the original entry order.
  return importItems.slice().reverse();
}

function restoreStoredBatchRMDisplay(batch, items) {
  const foreignRM = document.getElementById("batchPurchaseTotalRM");
  const shippingRate = document.getElementById("batchShippingRate");
  const grandTotal = document.getElementById("batchGrandTotalRM");

  if (foreignRM && Number.isFinite(Number(batch.totalForeignCostsRM))) {
    foreignRM.textContent =
      formatMoney(Number(batch.totalForeignCostsRM) || 0, "RM ");
  }

  if (shippingRate && Number.isFinite(Number(batch.shippingRate))) {
    shippingRate.textContent =
      `${formatMoney(Number(batch.shippingRate) || 0)}%`;
  }

  if (grandTotal && Number.isFinite(Number(batch.grandTotal))) {
    grandTotal.textContent =
      formatMoney(Number(batch.grandTotal) || 0, "RM ");
  }

  items.forEach((item, index) => {
    const row = document.querySelectorAll("#batchRows tr")[index];
    if (!row) return;

    const rowId = Number(row.dataset.rowId);
    const unitCostField =
      document.getElementById(`batchUnitCost-${rowId}`);

    if (
      unitCostField &&
      Number.isFinite(Number(item.unitCost))
    ) {
      unitCostField.value = formatMoney(Number(item.unitCost) || 0);
    }
  });
}

function recalculateProductLastImport(productId, remainingImports) {
  return remainingImports
    .filter(record =>
      record.productId === productId &&
      record.containerDate
    )
    .sort(
      (a, b) =>
        parseDDMMYYYY(b.containerDate) -
        parseDDMMYYYY(a.containerDate)
    )[0]?.containerDate || "";
}

function reverseBatchInventoryImpact(products, batchItems, remainingImports) {
  const affectedProductIds = new Set();

  batchItems.forEach(record => {
    const productIndex = products.findIndex(
      product =>
        product.id === record.productId ||
        (
          !record.productId &&
          String(product.name || "").trim().toLowerCase() ===
          String(record.productName || "").trim().toLowerCase()
        )
    );

    if (productIndex === -1) return;

    const product = products[productIndex];
    const stockAdded = Math.max(0, Number(record.stockAdded) || Number(record.quantity) || 0);
    const unitCost = Math.max(0, Number(record.unitCost) || 0);

    const currentStock = Math.max(0, Number(product.stock) || 0);
    const currentAverage = Math.max(0, Number(product.averageCost) || 0);
    const currentTotalCost = currentStock * currentAverage;

    const revertedStock = Math.max(0, currentStock - stockAdded);
    const revertedTotalCost = Math.max(
      0,
      currentTotalCost - (stockAdded * unitCost)
    );

    affectedProductIds.add(product.id);

    products[productIndex] = {
      ...product,
      stock: revertedStock,
      averageCost:
        revertedStock > 0
          ? revertedTotalCost / revertedStock
          : 0,
      lastImport: recalculateProductLastImport(
        product.id,
        remainingImports
      ),
      updatedAt: new Date().toISOString()
    };
  });

  return affectedProductIds;
}

function deleteBatchByNumber(importNumber) {

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
  const batchItems = imports.filter(
    record => record.batchId === batch.id
  );
  const effectiveItems =
    batchItems.length ? batchItems : (batch.items || []);

  const confirmed = confirm(
    `确定删除整张进口编号 ${batch.importNumber}？\n\n` +
    `产品种类：${Number(batch.itemCount) || effectiveItems.length}\n` +
    `总数量：${Number(batch.totalQuantity) || 0}\n` +
    `整批总成本：${formatMoney(Number(batch.grandTotal) || 0, "RM ")}\n\n` +
    `删除后，系统会自动扣回这批入库数量，并重新计算相关产品的平均成本与库存成本总值。\n\n` +
    `这个操作不能撤销。`
  );

  if (!confirmed) return;

  const remainingImports = imports.filter(
    record => record.batchId !== batch.id
  );
  const products = getProducts();

  reverseBatchInventoryImpact(
    products,
    effectiveItems,
    remainingImports
  );

  batches.splice(batchIndex, 1);

  saveProducts(products);
  saveImports(remainingImports);
  saveBatches(batches);

  if (
    String(currentEditingImportNumber || "").toLowerCase() ===
    String(batch.importNumber || "").toLowerCase()
  ) {
    resetBatchForm();
  }

  renderBatchSuggestions();
  renderBatchList();
  renderInventoryManagementList();
  renderDashboard();

  document.getElementById("batchStatusText").textContent =
    `已删除整批进口 ${batch.importNumber}，库存数量、平均成本及库存成本总值已自动调整。`;
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
  const defaults = {
    CNY: 1.60,
    NTD: 7.69,
    VND: 6300.00,
    IDR: 3571.00
  };

  const saved = loadJSON("importSystemSettings", {});
  const value = Number(saved?.[currency]);

  return Number.isFinite(value) && value > 0
    ? value
    : defaults[currency] || 0;
}

function loadBatchByNumber() {
  const input = document.getElementById("batchLookupInput");
  const importNumber = input.value.trim();

  if (!importNumber) {
    alert("请先 Paste 进口编号。");
    input.focus();
    return;
  }

  const batch = getBatches().find(
    item => String(item.importNumber || "").toLowerCase() === importNumber.toLowerCase()
  );

  if (!batch) {
    alert("找不到这个进口编号。");
    input.focus();
    input.select();
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

  const recoveredChinaTransportCost =
    recoverableForeignCostsRM > 0 &&
    effectiveRate > 0
      ? Math.max(
          0,
          (recoverableForeignCostsRM * effectiveRate) -
          totalProductForeign -
          potCost
        )
      : 0;

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

  if (
    !chinaTransportCost &&
    (Number(batch.grandTotal) || Number(batch.shippingRate))
  ) {
    document.getElementById("batchStatusText").textContent =
      `提醒：此批次属于旧版本资料，无法自动恢复当时的内地运输＋打木架费用。如该栏位为空，请按原始单据补回后再更新，不会影响现有库存及Average Cost。`;
  } else if (
    !(Number.isFinite(storedChinaTransportCost) && storedChinaTransportCost > 0) &&
    !(Number.isFinite(storedChinaTransportRM) && storedChinaTransportRM > 0) &&
    recoveredChinaTransportCost > 0
  ) {
    document.getElementById("batchStatusText").textContent =
      `已从该批原有总成本自动恢复内地运输＋打木架费用：${formatMoney(recoveredChinaTransportCost)} ${currency}`;
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

  document.getElementById("batchRows").innerHTML = "";
  batchRowSeq = 0;

  batchItems.forEach(item => {
    addBatchRow({
      name: item.productName || "",
      category: item.category || "盆栽",
      productId: item.productId || "",
      quantity: Number(item.remainingQuantity ?? item.quantity) || 0,
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
      `已载入进口编号 ${batch.importNumber}。资料已按原输入顺序恢复，可继续修改后更新。`;
  }

  input.value = batch.importNumber;
  setBatchEditMode(batch.importNumber);
}


function setupImportHistory() {
  const input = document.getElementById("historyLookupInput");
  const button = document.getElementById("historyLookupBtn");

  if (button) button.addEventListener("click", renderImportHistory);
  if (input) {
    input.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      renderImportHistory();
    });
  }
}

function renderImportHistory() {
  const input = document.getElementById("historyLookupInput");
  const output = document.getElementById("historyResult");
  if (!input || !output) return;

  const importNumber = input.value.trim();
  if (!importNumber) {
    output.innerHTML = '<div class="empty-state">Paste 进口编号后查看原始进口历史</div>';
    return;
  }

  const batch = getBatches().find(item =>
    String(item.importNumber || "").toLowerCase() === importNumber.toLowerCase()
  );

  if (!batch) {
    output.innerHTML = '<div class="empty-state">找不到这个进口编号</div>';
    return;
  }

  const items = getBatchItemsForDisplay(batch);
  const currency = escapeHTML(batch.currency || items[0]?.currency || "-");
  const shippingRate = getBatchShippingRate(batch);

  const rows = items.map(item => {
    const originalQuantity = Number(item.originalQuantity ?? item.quantity) || 0;
    const remainingQuantity = Number(item.remainingQuantity ?? item.quantity) || 0;
    return `
      <tr>
        <td>${escapeHTML(item.productName || "-")}</td>
        <td>${escapeHTML(item.category || "-")}</td>
        <td>${formatNumber(originalQuantity)}</td>
        <td>${formatNumber(remainingQuantity)}</td>
        <td>${formatMoney(Number(item.unitPrice) || 0)} ${currency}</td>
        <td>${formatMoney(Number(item.unitCost) || 0, "RM ")}</td>
      </tr>`;
  }).join("");

  output.innerHTML = `
    <article class="history-card">
      <div class="history-number">${escapeHTML(batch.importNumber || "-")}</div>
      <div class="history-meta-grid">
        <div><span>装柜日期</span><strong>${escapeHTML(batch.containerDate || "-")}</strong></div>
        <div><span>抵达日期</span><strong>${escapeHTML(batch.arrivalDate || "-")}</strong></div>
        <div><span>货币 / 汇率</span><strong>${currency} / ${formatMoney(Number(batch.rate) || 0)}</strong></div>
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
    </article>`;
}

function getImports(){return loadJSON("importSystemImports",[]);}
function saveImports(v) {
  const previous = getImports();
  saveJSON("importSystemImports", v);
  if (typeof markCloudCollectionSaved === "function") {
    markCloudCollectionSaved("imports", previous, v);
  }
}
function getBatches(){return loadJSON("importSystemBatches",[]);}
function saveBatches(v) {
  const previous = getBatches();
  saveJSON("importSystemBatches", v);
  if (typeof markCloudCollectionSaved === "function") {
    markCloudCollectionSaved("batches", previous, v);
  }
}
function renderBatchSuggestions(){
  document.getElementById("batchProductSuggestions").innerHTML=getProducts().sort((a,b)=>a.id.localeCompare(b.id)).map(p=>`<option value="${escapeHTML(p.name)}">${escapeHTML(p.id)} · ${escapeHTML(p.category)}</option>`).join("");
}
function applyBatchRate(){
  const defaults = {
    CNY: 1.60,
    NTD: 7.69,
    VND: 6300.00,
    IDR: 3571.00
  };

  const saved = loadJSON("importSystemSettings", {});
  const settings = {
    ...defaults,
    ...(saved && typeof saved === "object" ? saved : {})
  };

  const currency = document.getElementById("batchCurrency").value;
  const rate = Number(settings[currency]);

  document.getElementById("batchRate").value =
    formatMoney(Number.isFinite(rate) && rate > 0 ? rate : defaults[currency] || 0);
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
      updateTransitDays();
      calculateBatch();
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
  const match = String(value || "")
    .trim()
    .match(/^(\d{2})-(\d{2})-(\d{4})$/);

  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

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

  const currency = document.getElementById("batchCurrency");
  if (currency) currency.value = "CNY";

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
}
function addBatchRow(prefill = {}){
  const id=++batchRowSeq,tr=document.createElement("tr"); tr.dataset.rowId=id;
  tr.innerHTML=`<td><input id="batchName-${id}" class="batch-name" list="batchProductSuggestions" placeholder="输入或选择产品" value="${escapeHTML(prefill.name || "")}"><input id="batchProductId-${id}" type="hidden" value="${escapeHTML(prefill.productId || "")}"></td>
  <td><select id="batchCategory-${id}">
    <option value="盆栽">盆栽</option>
    <option value="花盆">花盆</option>
    <option value="周边产品">周边产品</option>
  </select></td>
  <td><input id="batchQty-${id}" inputmode="numeric" placeholder="0"></td>
  <td><input id="batchPrice-${id}" inputmode="decimal" placeholder="0.00"></td>
  <td><input id="batchPurchaseForeign-${id}" value="0.00" disabled></td>
  <td><input id="batchStock-${id}" inputmode="numeric" placeholder="0" disabled></td>
  <td><input id="batchUnitCost-${id}" value="0.00" disabled></td>
  <td><button type="button" class="remove-item-btn" onclick="removeBatchRow(${id})">删除</button></td>`;
  document.getElementById("batchRows").appendChild(tr);
  document.getElementById(`batchCategory-${id}`).value =
    prefill.category || "盆栽";
  if (prefill.quantity) {
    document.getElementById(`batchQty-${id}`).value = prefill.quantity;
    document.getElementById(`batchStock-${id}`).value = prefill.quantity;
  }
  if (prefill.unitPrice) {
    document.getElementById(`batchPrice-${id}`).value =
      formatMoney(prefill.unitPrice);
  }
  attachBatchRowEvents(id);
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
function attachBatchRowEvents(id){
  const n=document.getElementById(`batchName-${id}`);
  n.addEventListener("input",()=>{let c=Array.from(n.value);if(c.length>15)n.value=c.slice(0,15).join("");const p=getProducts().find(x=>x.name.toLowerCase()===n.value.trim().toLowerCase());document.getElementById(`batchProductId-${id}`).value=p?.id||"";document.getElementById(`batchCategory-${id}`).value=p?.category||document.getElementById(`batchCategory-${id}`).value||"盆栽";calculateBatch();});
  n.addEventListener("paste",e=>{e.preventDefault();const t=(e.clipboardData||window.clipboardData).getData("text").replace(/[\r\n\t]+/g," ").trim();n.value=Array.from(t).slice(0,15).join("");n.dispatchEvent(new Event("input",{bubbles:true}));});
  [`batchQty-${id}`,`batchPrice-${id}`].forEach(k=>{const x=document.getElementById(k);x.addEventListener("focus",()=>x.select());x.addEventListener("input",calculateBatch);x.addEventListener("blur",()=>{if(!k.includes("Qty")&&!k.includes("Stock"))formatInputAmount(x);calculateBatch();});});
  document.getElementById(`batchPrice-${id}`).addEventListener("input", () => {
    const price = parseAmount(
      document.getElementById(`batchPrice-${id}`).value
    );
    const currency = document.getElementById("batchCurrency");

    if (price >= 100000 && currency.value !== "VND") {
      currency.value = "VND";
      applyBatchRate();
    } else if (price < 100000 && currency.value === "VND") {
      currency.value = "CNY";
      applyBatchRate();
    }

    calculateBatch();
  });
  document.getElementById(`batchQty-${id}`).addEventListener("input", () => {
    const quantity = Math.max(0, Math.floor(parseAmount(document.getElementById(`batchQty-${id}`).value)));
    document.getElementById(`batchStock-${id}`).value = quantity || "";
  });
  document.getElementById(`batchCategory-${id}`).addEventListener("change", () => {
    const name = document.getElementById(`batchName-${id}`).value.trim().toLowerCase();
    const category = document.getElementById(`batchCategory-${id}`).value;

    const product = getProducts().find(
      item => item.name.toLowerCase() === name && item.category === category
    );

    document.getElementById(`batchProductId-${id}`).value = product?.id || "";
    calculateBatch();
  });
}
function removeBatchRow(id){const r=document.querySelectorAll("#batchRows tr");if(r.length<=1){alert("至少保留一行。");return;}document.querySelector(`#batchRows tr[data-row-id="${id}"]`)?.remove();calculateBatch();}
function collectBatchRows(){
  const rate=parseAmount(document.getElementById("batchRate").value),currency=document.getElementById("batchCurrency").value;
  return Array.from(document.querySelectorAll("#batchRows tr")).map(tr=>{const id=Number(tr.dataset.rowId),name=document.getElementById(`batchName-${id}`).value.trim(),quantity=Math.max(0,Math.floor(parseAmount(document.getElementById(`batchQty-${id}`).value))),unitPrice=parseAmount(document.getElementById(`batchPrice-${id}`).value),stockAdded=quantity,foreignTotal=quantity*unitPrice,purchaseRM=rate>0?foreignTotal/rate:0,productId=document.getElementById(`batchProductId-${id}`).value,existing=getProducts().find(x=>x.id===productId);return{id,name,category:document.getElementById(`batchCategory-${id}`).value||"盆栽",productId,quantity,unitPrice,stockAdded,currency,rate,foreignTotal,purchaseRM,oldStock:Number(existing?.stock)||0,oldAverage:Number(existing?.averageCost)||0};});
}
function calculateBatch() {
  updateTransitDays();

  const rows = collectBatchRows();
  const valid = rows.filter(row =>
    row.name &&
    row.quantity > 0 &&
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
    if (stockCell) stockCell.value = stockAdded || "";
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

  if (currentEditingImportNumber) {
    const storedBatch = getBatches().find(
      batch => batch.importNumber === currentEditingImportNumber
    );
    if (storedBatch) {
      restoreStoredBatchRMDisplay(storedBatch, getBatchItemsForDisplay(storedBatch));
    }
  }

  return {
    valid,
    totalPurchaseForeign,
    foreignGrandTotal,
    totalPurchaseRM: allForeignCostsRM,
    chinaForeign,
    potForeign,
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
  const status = document.getElementById("batchStatusText");
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

  if (isEditing) {
    const batchIndex = batches.findIndex(
      batch => batch.importNumber === currentEditingImportNumber
    );
    if (batchIndex === -1) {
      status.textContent = "找不到原批次，无法更新库存。";
      return;
    }

    const oldBatch = batches[batchIndex];
    const oldItems = getBatchItemsForDisplay(oldBatch);
    const keyOf = item => `${String(item.productId || "")}::${String(item.productName || item.name || "").trim().toLowerCase()}::${String(item.category || "盆栽")}`;
    const oldMap = new Map(oldItems.map(item => [keyOf(item), item]));
    const editedMap = new Map(result.valid.map(item => [keyOf({
      productId: item.productId,
      productName: item.name,
      category: item.category
    }), item]));

    if (oldMap.size !== editedMap.size || [...oldMap.keys()].some(key => !editedMap.has(key))) {
      status.textContent = "库存调整只能修改原批次产品的剩余数量，不能新增、删除或更换产品。";
      return;
    }

    const updatedItems = [];
    for (const [key, oldItem] of oldMap.entries()) {
      const edited = editedMap.get(key);
      const originalQuantity = Math.max(0, Number(oldItem.originalQuantity ?? oldItem.quantity) || 0);
      const oldRemaining = Math.max(0, Number(oldItem.remainingQuantity ?? oldItem.quantity) || 0);
      const newRemaining = Math.max(0, Math.floor(Number(edited.quantity) || 0));

      if (newRemaining > originalQuantity) {
        status.textContent = `${oldItem.productName} 的当前剩余数量不能超过原进口数量 ${originalQuantity}。`;
        return;
      }

      const productIndex = products.findIndex(product =>
        product.id === oldItem.productId ||
        (String(product.name || "").trim().toLowerCase() === String(oldItem.productName || "").trim().toLowerCase() &&
         product.category === oldItem.category)
      );
      if (productIndex !== -1) {
        const delta = newRemaining - oldRemaining;
        const currentStock = Math.max(0, Number(products[productIndex].stock) || 0);
        products[productIndex] = {
          ...products[productIndex],
          stock: Math.max(0, currentStock + delta),
          // 销售只改变库存，Average Cost 保持不变。
          averageCost: Number(products[productIndex].averageCost) || 0,
          inventoryArchived: newRemaining <= 0 ? products[productIndex].inventoryArchived : false,
          updatedAt: new Date().toISOString()
        };
      }

      updatedItems.push({
        ...oldItem,
        originalQuantity,
        quantity: originalQuantity,
        remainingQuantity: newRemaining,
        stockAdded: originalQuantity,
        updatedAt: new Date().toISOString()
      });
    }

    for (let i = imports.length - 1; i >= 0; i -= 1) {
      if (imports[i].batchId === oldBatch.id) imports.splice(i, 1);
    }
    imports.push(...updatedItems);

    batches[batchIndex] = {
      ...oldBatch,
      items: updatedItems,
      totalQuantity: oldItems.reduce(
        (sum, item) => sum + (Number(item.originalQuantity ?? item.quantity) || 0),
        0
      ),
      totalRemainingQuantity: updatedItems.reduce(
        (sum, item) => sum + (Number(item.remainingQuantity) || 0),
        0
      ),
      updatedAt: new Date().toISOString()
    };

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
      `已更新 ${currentEditingImportNumber || oldBatch.importNumber} 的当前库存；原进口数量、原成本、Average Cost及海外运费比例保持不变。`;
    return;
  }

  const batchId = `BAT${Date.now()}`;
  const importNumber = generateImportNumber(
    document.getElementById("batchCurrency").value,
    document.getElementById("batchContainerDate").value,
    batches
  );

  const batch = {
    id: batchId,
    importNumber,
    date: today,
    rackQuantity: Math.max(0, Math.floor(parseAmount(document.getElementById("batchRackQuantity").value))),
    trackingNumber: document.getElementById("batchTrackingNumber").value.trim(),
    overseasTrackingNumber: document.getElementById("batchOverseasTrackingNumber").value.trim(),
    chinaTransportCost: result.chinaForeign,
    chinaTransportRM: result.totalPurchaseRM > 0 && result.foreignGrandTotal > 0
      ? (result.chinaForeign / result.foreignGrandTotal) * result.totalPurchaseRM : 0,
    potCost: result.potForeign,
    potRM: result.totalPurchaseRM > 0 && result.foreignGrandTotal > 0
      ? (result.potForeign / result.foreignGrandTotal) * result.totalPurchaseRM : 0,
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
    let productIndex = products.findIndex(product =>
      product.name.toLowerCase() === item.name.toLowerCase() && product.category === item.category
    );
    if (productIndex === -1) {
      products.push({
        id: generateNextProductId(products, item.category), name: item.name,
        category: item.category, status: "启用", remark: "", stock: 0,
        averageCost: 0, lastImport: "", inventoryArchived: false,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      });
      productIndex = products.length - 1;
    }

    const product = products[productIndex];
    const oldStock = Number(product.stock) || 0;
    const oldAverage = Number(product.averageCost) || 0;
    const newStock = oldStock + item.stockAdded;
    const newAverage = newStock > 0
      ? ((oldStock * oldAverage) + (item.stockAdded * item.unitCost)) / newStock
      : item.unitCost;

    products[productIndex] = {
      ...product, stock: newStock, averageCost: newAverage,
      inventoryArchived: false, lastImport: batch.containerDate || today,
      updatedAt: new Date().toISOString()
    };

    const record = {
      id: `IMP${Date.now()}${item.id}`, batchId, importNumber, date: today,
      productId: products[productIndex].id, productName: item.name,
      category: item.category, originalQuantity: item.quantity,
      quantity: item.quantity, remainingQuantity: item.quantity,
      unitPrice: item.unitPrice, currency: item.currency, rate: item.rate,
      foreignTotal: item.foreignTotal, purchaseRM: item.purchaseRM,
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
  saveProducts(products);
  saveImports(imports);
  saveBatches(batches);
  renderBatchSuggestions();
  renderBatchList();
  renderInventoryManagementList();
  renderDashboard();
  clearBatchAfterSuccessfulAction();
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
  const countElement = document.getElementById("batchListCount");
  const listElement = document.getElementById("batchList");
  const keyword = String(searchInput?.value || "").trim().toLowerCase();

  const filteredBatches = allBatches.filter(batch => {
    if (!keyword) return true;

    const items = getBatchItemsForDisplay(batch);
    const productText = items
      .map(item => `${item?.productName || item?.name || ""} ${item?.productId || ""} ${item?.category || ""}`)
      .join(" ");

    const searchableText = [
      batch.importNumber,
      batch.containerDate,
      batch.arrivalDate,
      batch.date,
      batch.trackingNumber,
      batch.overseasTrackingNumber,
      batch.currency,
      productText
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchableText.includes(keyword);
  });

  const displayLimit = 10;
  const visibleBatches = batchListExpanded
    ? filteredBatches
    : filteredBatches.slice(0, displayLimit);

  if (countElement) {
    countElement.textContent = keyword
      ? `${visibleBatches.length} / ${filteredBatches.length} 批`
      : `${visibleBatches.length} / ${allBatches.length} 批`;
  }

  if (toggleButton) {
    const canToggle = filteredBatches.length > displayLimit;
    toggleButton.hidden = !canToggle;
    toggleButton.textContent = batchListExpanded ? "收起" : "显示全部";
    toggleButton.setAttribute("aria-expanded", String(batchListExpanded));
  }

  if (!listElement) return;

  if (!filteredBatches.length) {
    listElement.innerHTML = keyword
      ? '<div class="empty-state">暂无符合的进口批次</div>'
      : '<div class="empty-state">暂无进口批次</div>';
    return;
  }

  listElement.innerHTML = visibleBatches.map(batch => {
    const items = getBatchItemsForDisplay(batch);
    const firstProductName =
      items[0]?.productName || items[0]?.name || "-";

    return `<article class="import-card">
      <div class="batch-card-title-row">
        <div>
          <h4>${escapeHTML(batch.containerDate || batch.date || "-")} · ${Number(batch.itemCount) || items.length} 种产品</h4>
          <div class="import-number-line"><span>进口编号</span><strong>${escapeHTML(batch.importNumber || "-")}</strong></div>
        </div>
        <div class="batch-card-buttons">
          ${batch.importNumber ? `<button class="copy-number-btn" type="button" onclick="copyBatchNumber('${escapeHTML(batch.importNumber)}', this)">Copy</button>` : ""}
          ${batch.importNumber ? `<button class="small-btn edit-btn" type="button" onclick="openBatchForEdit('${escapeHTML(batch.importNumber)}')">载入</button>` : ""}
          ${batch.importNumber ? `<button class="small-btn delete-btn" type="button" onclick="deleteBatchByNumber('${escapeHTML(batch.importNumber)}')">删除</button>` : ""}
        </div>
      </div>
      <div class="product-code">
        ${Number(batch.totalQuantity) || 0} 件 · ${Number(batch.rackQuantity) || 0} 个木架 ·
        ${escapeHTML(firstProductName)}
      </div>
      <div class="import-card-meta">
        <div><span>运输天数</span><strong>${batch.transitDays ? `${batch.transitDays} 天` : "-"}</strong></div>
        <div><span>海外运费比例</span><strong>${formatMoney(getBatchShippingRate(batch))}%</strong></div>
        <div><span>批次总成本</span><strong>${formatMoney(batch.grandTotal, "RM ")}</strong></div>
        <div><span>运输单号</span><strong>${escapeHTML(batch.overseasTrackingNumber || batch.trackingNumber || "-")}</strong></div>
      </div>
    </article>`;
  }).join("");
}
function formatDateDDMMYYYY(d){return `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`;}
function formatDateFromInput(v){if(!v)return"";const[y,m,d]=v.split("-");return`${d}-${m}-${y}`;}


function getLatestContainerDateByProduct(productId) {
  const imports = getImports()
    .filter(record => record.productId === productId && record.containerDate)
    .sort((a, b) => parseDDMMYYYY(b.containerDate) - parseDDMMYYYY(a.containerDate));

  return imports[0]?.containerDate || "";
}

function setupInventoryModule() {
  document.getElementById("inventorySearch").addEventListener("input", renderInventoryManagementList);
  document.getElementById("inventorySort").addEventListener("change", renderInventoryManagementList);

  document.getElementById("inventoryManagementList").addEventListener("click", event => {
    const button = event.target.closest(".inventory-import-number");
    if (!button) return;

    copyInventoryImportNumber(button);
  });

  renderInventoryManagementList();
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
    button.textContent = "✓ 已复制";
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

function renderInventoryManagementList() {
  const keyword = document.getElementById("inventorySearch").value.trim().toLowerCase();
  const sortMode = document.getElementById("inventorySort").value;
  const imports = getImports();

  const products = getProducts()
    .filter(
      product =>
        !product.inventoryArchived &&
        (Number(product.stock) || 0) > 0
    )
    .map(product => {
      const productName = String(product.name || "").trim().toLowerCase();
      const matchingImports = imports
        .filter(record => {
          const sameProductId =
            product.id && record.productId && record.productId === product.id;
          const sameProductName =
            String(record.productName || "").trim().toLowerCase() === productName;

          return sameProductId || sameProductName;
        })
        .sort((a, b) => {
          const containerDateDiff =
            parseDDMMYYYY(b.containerDate) - parseDDMMYYYY(a.containerDate);
          if (containerDateDiff) return containerDateDiff;

          return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
        });

      const importNumbers = matchingImports
        .map(record => String(record.importNumber || "").trim())
        .filter(Boolean)
        .join(" ");

      return {
        ...product,
        importNumbers,
        latestImportNumber:
          String(matchingImports[0]?.importNumber || "").trim(),
        displayLastImport:
          matchingImports[0]?.containerDate ||
          getLatestContainerDateByProduct(product.id) ||
          product.lastImport ||
          ""
      };
    })
    .filter(product => {
      const target =
        `${product.id} ${product.name} ${product.category} ${product.importNumbers}`
          .toLowerCase();
      return target.includes(keyword);
    });

  products.sort((a, b) => {
    const stockA = Number(a.stock) || 0;
    const stockB = Number(b.stock) || 0;
    const costA = Number(a.averageCost) || 0;
    const costB = Number(b.averageCost) || 0;
    const valueA = stockA * costA;
    const valueB = stockB * costB;

    if (sortMode === "name") return String(a.name).localeCompare(String(b.name), "zh");
    if (sortMode === "stock-desc") return stockB - stockA;
    if (sortMode === "stock-asc") return stockA - stockB;
    if (sortMode === "value-desc") return valueB - valueA;
    if (sortMode === "cost-desc") return costB - costA;

    return parseDDMMYYYY(b.displayLastImport) - parseDDMMYYYY(a.displayLastImport);
  });

  document.getElementById("inventoryPageCount").textContent = `${products.length} 项`;

  const normalizedKeyword = keyword.trim().toLowerCase();
  const matchedBatch = normalizedKeyword
    ? getBatches().find(batch =>
        String(batch.importNumber || "").trim().toLowerCase() === normalizedKeyword
      )
    : null;

  const filteredInventoryValue = matchedBatch
    ? Number(matchedBatch.grandTotal) || 0
    : products.reduce((sum, product) => {
        const stock = Number(product.stock) || 0;
        const averageCost = Number(product.averageCost) || 0;
        return sum + (stock * averageCost);
      }, 0);

  const filteredValueField = document.getElementById("inventoryFilteredValue");
  if (filteredValueField) {
    filteredValueField.textContent = formatMoney(filteredInventoryValue, "RM ");
  }

  const list = document.getElementById("inventoryManagementList");
  if (!products.length) {
    list.innerHTML = '<div class="empty-state">暂无符合的库存资料</div>';
    return;
  }

  list.innerHTML = products.map(product => {
    const stock = Number(product.stock) || 0;
    const averageCost = Number(product.averageCost) || 0;
    const inventoryValue = stock * averageCost;

    return `
      <article class="inventory-manage-card">
        <div class="inventory-manage-head">
          <div>
            <div class="inventory-product-title-row">
              <h4>${escapeHTML(product.name)}</h4>
              ${product.latestImportNumber ? `<button class="inventory-import-number" type="button" data-import-number="${escapeHTML(product.latestImportNumber)}" title="点击复制进口编号">${escapeHTML(product.latestImportNumber)}</button>` : ""}
            </div>
            <div class="product-code">${escapeHTML(product.id)} · ${escapeHTML(product.category)}</div>
          </div>
        </div>

        <div class="inventory-summary-grid">
          <div><span>当前库存</span><strong>${formatNumber(stock)}</strong></div>
          <div><span>平均成本</span><strong>${formatMoney(averageCost, "RM ")}</strong></div>
          <div><span>库存成本总值</span><strong>${formatMoney(inventoryValue, "RM ")}</strong></div>
          <div><span>最后进口</span><strong>${escapeHTML(product.displayLastImport || "-")}</strong></div>
        </div>
      </article>
    `;
  }).join("");
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

  exportButton?.addEventListener("click", exportSystemExcel);
  backupButton?.addEventListener("click", backupSystemData);
  restoreButton?.addEventListener("click", () => restoreInput?.click());
  restoreInput?.addEventListener("change", restoreSystemData);
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

function excelCell(value, type = "String") {
  return `<Cell><Data ss:Type="${type}">${xmlEscape(value)}</Data></Cell>`;
}

function excelWorksheet(name, headers, rows) {
  const headerXml = `<Row>${headers.map(header => excelCell(header)).join("")}</Row>`;
  const rowXml = rows.map(row => {
    return `<Row>${row.map(value => {
      const isNumber = typeof value === "number" && Number.isFinite(value);
      return excelCell(isNumber ? value : value ?? "", isNumber ? "Number" : "String");
    }).join("")}</Row>`;
  }).join("");

  return `<Worksheet ss:Name="${xmlEscape(name)}"><Table>${headerXml}${rowXml}</Table></Worksheet>`;
}

function exportSystemExcel() {
  const products = getProducts();
  const imports = getImports();
  const batches = getBatches();

  // Inventory 工作表只导出真正仍有库存的产品。
  // 删除批次或测试后留下的零库存、已移除产品不会再成为 Excel 垃圾资料。
  const activeInventoryProducts = products.filter(product =>
    !product.inventoryArchived &&
    (Number(product.stock) || 0) > 0
  );

  const inventoryRows = activeInventoryProducts.map(product => [
    product.id || "",
    product.name || "",
    product.category || "",
    Number(product.stock) || 0,
    Number(product.averageCost) || 0,
    (Number(product.stock) || 0) * (Number(product.averageCost) || 0),
    product.lastImport || "",
    "当前库存"
  ]);

  const importRows = imports.map(record => [
    record.batchId || "",
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
    batch.id || "",
    batch.containerDate || "",
    batch.arrivalDate || "",
    Number(batch.transitDays) || 0,
    Number(batch.itemCount) || 0,
    Number(batch.totalQuantity) || 0,
    Number(batch.rackQuantity) || 0,
    batch.trackingNumber || "",
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
    excelWorksheet(
      "Inventory",
      ["产品编号", "产品名称", "类别", "当前库存", "平均成本", "库存成本总值", "最后进口", "状态"],
      inventoryRows
    ) +
    excelWorksheet(
      "Imports",
      ["批次编号", "装柜日期", "抵达日期", "产品编号", "产品名称", "类别", "数量", "单价", "货币", "汇率", "货款RM", "每件成本RM", "入库", "成本变化"],
      importRows
    ) +
    excelWorksheet(
      "Batches",
      ["批次编号", "装柜日期", "抵达日期", "运输天数", "产品种类", "总数量", "木架总数", "运输单号", "货币", "汇率", "海外运费RM", "海外运费比例", "批次总成本RM"],
      batchRows
    ) +
    `</Workbook>`;

  downloadTextFile(
    `Import_Inventory_${formatDateDDMMYYYY(new Date())}.xls`,
    workbook,
    "application/vnd.ms-excel;charset=utf-8"
  );

  showDataToolsStatus(`Excel 已导出：${activeInventoryProducts.length} 项当前库存`);
}

function backupSystemData() {
  const backup = {
    app: "Lover Legend Import Cost & Inventory System",
    version: "2.5",
    exportedAt: new Date().toISOString(),
    settings: loadJSON("importSystemSettings", {}),
    products: getProducts(),
    imports: getImports(),
    batches: getBatches()
  };

  downloadTextFile(
    `Import_Inventory_Backup_${formatDateDDMMYYYY(new Date())}.json`,
    JSON.stringify(backup, null, 2),
    "application/json;charset=utf-8"
  );

  showDataToolsStatus("Backup 已完成");
}

function restoreSystemData(event) {
  const file = event.target.files?.[0];
  event.target.value = "";

  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result || ""));

      if (
        !Array.isArray(data.products) ||
        !Array.isArray(data.imports) ||
        !Array.isArray(data.batches)
      ) {
        throw new Error("Backup 格式不正确");
      }

      const confirmed = confirm(
        "Restore 会覆盖当前产品、库存和进口记录。\n\n确定继续？"
      );

      if (!confirmed) return;

      saveJSON("importSystemSettings", data.settings || {});
      if (typeof markCloudSettingsSaved === "function") {
        markCloudSettingsSaved();
      }
      saveProducts(data.products);
      saveImports(data.imports);
      saveBatches(data.batches);

      renderBatchSuggestions();
      renderBatchList();
      renderInventoryManagementList();
      renderProductList();
      renderDashboard();
      showDataToolsStatus("Restore 已完成，资料正在同步");
    } catch (error) {
      console.error(error);
      showDataToolsStatus("Restore 失败：文件格式不正确", true);
    }
  };

  reader.readAsText(file);
}

function showDataToolsStatus(message, isError = false) {
  const status = document.getElementById("dataToolsStatus");
  if (!status) return;

  status.textContent = message;
  status.classList.toggle("error-status", isError);

  setTimeout(() => {
    status.textContent = "";
    status.classList.remove("error-status");
  }, 2500);
}


function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(error => {
      console.error("Service Worker registration failed:", error);
    });
  }
}
