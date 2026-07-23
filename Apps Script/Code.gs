const SHEETS = {
  PRODUCTS: "Products",
  IMPORTS: "Imports",
  BATCHES: "Batches",
  SETTINGS: "Settings",
  LOGS: "Logs"
};

// Google Sheet 显示中文表头；程式内部仍使用稳定的英文 key。
const SCHEMAS = {
  Products: [
    ["id", "产品编号"],
    ["name", "产品名称"],
    ["category", "类别"],
    ["status", "状态"],
    ["remark", "备注"],
    ["stock", "当前库存"],
    ["averageCost", "平均成本"],
    ["lastImport", "最后进口日期"],
    ["inventoryArchived", "库存已移除"],
    ["createdAt", "建立时间"],
    ["updatedAt", "更新时间"]
  ],
  Imports: [
    ["id", "记录编号"],
    ["batchId", "批次编号"],
    ["importNumber", "进口编号"],
    ["date", "记录日期"],
    ["productId", "产品编号"],
    ["productName", "产品名称"],
    ["category", "类别"],
    ["originalQuantity", "原进口数量"],
    ["quantity", "数量"],
    ["remainingQuantity", "当前剩余数量"],
    ["unitPrice", "单价"],
    ["currency", "货币"],
    ["rate", "汇率"],
    ["foreignTotal", "货款总额"],
    ["purchaseRM", "采购成本（RM）"],
    ["shippingRate", "海外运费比例"],
    ["unitCost", "每棵成本（RM）"],
    ["stockAdded", "入库数量"],
    ["batchTotal", "本项总成本（RM）"],
    ["averageDirection", "平均成本方向"],
    ["rackQuantity", "木架数量"],
    ["trackingNumber", "国内运输单号"],
    ["overseasTrackingNumber", "海外运输单号"],
    ["containerDate", "装柜日期"],
    ["arrivalDate", "抵达日期"],
    ["transitDays", "运输天数"],
    ["createdAt", "建立时间"]
  ],
  Batches: [
    ["id", "批次编号"],
    ["importNumber", "进口编号"],
    ["date", "记录日期"],
    ["rackQuantity", "木架数量"],
    ["trackingNumber", "国内运输单号"],
    ["overseasTrackingNumber", "海外运输单号"],
    ["chinaTransportCost", "海外仓运输费"],
    ["chinaTransportRM", "海外仓运输费（RM）"],
    ["potCost", "搭配花盆总费用"],
    ["potRM", "搭配花盆费用（RM）"],
    ["currency", "货币"],
    ["rate", "汇率"],
    ["containerDate", "装柜日期"],
    ["arrivalDate", "抵达日期"],
    ["transitDays", "运输天数"],
    ["shippingMY", "海外到大马运费（RM）"],
    ["shippingRate", "海外运费比例"],
    ["totalForeignCostsRM", "整批货款及海外费用（RM）"],
    ["grandTotal", "整批总成本（RM）"],
    ["totalQuantity", "总数量"],
    ["itemCount", "产品种类"],
    ["createdAt", "建立时间"],
    ["updatedAt", "更新时间"],
    ["itemsJson", "产品明细 JSON"]
  ],
  Settings: [
    ["key", "项目"],
    ["value", "数值"]
  ],
  Logs: [
    ["timestamp", "时间"],
    ["user", "使用者"],
    ["action", "动作"],
    ["revision", "资料版本"],
    ["details", "内容"]
  ]
};

function doGet() {
  return json_({
    ok: true,
    message: "Lover Legend Google Sync API"
  });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");

    if (body.action === "init") return json_(initDatabase_());
    if (body.action === "pull") return json_(pullAll_());
    if (body.action === "push") return json_(pushAll_(body));

    throw new Error("Unknown action");
  } catch (err) {
    return json_({
      ok: false,
      error: String(err.message || err)
    });
  }
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// 在 Apps Script 顶部函数选单执行这个函数。
function initializeDatabase() {
  return initDatabase_();
}

function initDatabase_() {
  const ss = SpreadsheetApp.getActive();

  Object.entries(SCHEMAS).forEach(([sheetName, schema]) => {
    prepareSheet_(ss, sheetName, schema);
  });

  if (getSetting_("revision") === "") {
    setSetting_("revision", "0");
  }

  formatAll_();
  SpreadsheetApp.flush();

  return {
    ok: true,
    message: "Database initialized"
  };
}

function prepareSheet_(ss, name, schema) {
  let sh = ss.getSheetByName(name);

  if (!sh) {
    sh = ss.insertSheet(name);
  }

  const chineseHeaders = schema.map(item => item[1]);

  // 只更新表头，不清空已经存在的资料。
  sh.getRange(1, 1, 1, chineseHeaders.length)
    .setValues([chineseHeaders])
    .setFontWeight("bold")
    .setWrap(true)
    .setBackground("#d9ead3")
    .setHorizontalAlignment("center");

  sh.setFrozenRows(1);

  const existingFilter = sh.getFilter();
  if (existingFilter) {
    existingFilter.remove();
  }

  const filterRows = Math.max(1, sh.getLastRow());
  sh.getRange(1, 1, filterRows, chineseHeaders.length).createFilter();

  setColumnWidths_(sh, schema);
}

function pullAll_() {
  initIfNeeded_();

  return {
    ok: true,
    revision: getRevision_(),
    settings: readSettings_(),
    products: readObjects_(SHEETS.PRODUCTS),
    imports: readObjects_(SHEETS.IMPORTS),
    batches: readBatches_()
  };
}

function pushAll_(body) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    initIfNeeded_();

    const current = getRevision_();

    if (!body.force && Number(body.baseRevision) !== current) {
      const latest = pullAll_();
      return {
        ...latest,
        conflict: true,
        message: "资料版本不同，客户端必须合并后再提交"
      };
    }

    writeObjects_(SHEETS.PRODUCTS, body.products || []);
    writeObjects_(SHEETS.IMPORTS, body.imports || []);
    writeBatches_(body.batches || []);
    writeSettingsObject_(body.settings || {});

    const next = current + 1;
    setSetting_("revision", String(next));

    appendLog_(
      body.updatedBy || "Unknown",
      "PUSH",
      next,
      `产品 ${(body.products || []).length}，进口明细 ${(body.imports || []).length}，批次 ${(body.batches || []).length}`
    );

    // 日常同步只写资料，不再每次自动调整整张工作表格式与栏宽。
    // formatAll_() 只在 initializeDatabase() 执行，明显缩短同步时间。

    return {
      ok: true,
      revision: next
    };
  } finally {
    lock.releaseLock();
  }
}

function initIfNeeded_() {
  const ss = SpreadsheetApp.getActive();

  if (!ss.getSheetByName(SHEETS.PRODUCTS)) {
    initDatabase_();
  }
}

function getSchema_(name) {
  const schema = SCHEMAS[name];
  if (!schema) throw new Error(`Unknown sheet schema: ${name}`);
  return schema;
}

function readObjects_(name) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) return [];

  const schema = getSchema_(name);
  const keys = schema.map(item => item[0]);
  const lastRow = sh.getLastRow();

  if (lastRow < 2) return [];

  const values = sh.getRange(2, 1, lastRow - 1, keys.length).getValues();

  return values
    .filter(row => row.some(value => value !== ""))
    .map(row =>
      Object.fromEntries(
        keys.map((key, index) => [key, serialize_(row[index])])
      )
    );
}

function writeObjects_(name, items) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) throw new Error(`Missing sheet: ${name}`);

  const schema = getSchema_(name);
  const keys = schema.map(item => item[0]);

  if (sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, keys.length).clearContent();
  }

  if (!items.length) return;

  sh.getRange(2, 1, items.length, keys.length)
    .setValues(
      items.map(item =>
        keys.map(key => toSheetValue_(key, item[key]))
      )
    );
}

function writeBatches_(items) {
  writeObjects_(
    SHEETS.BATCHES,
    items.map(batch => ({
      ...batch,
      itemsJson: JSON.stringify(batch.items || [])
    }))
  );
}

function readBatches_() {
  return readObjects_(SHEETS.BATCHES).map(batch => {
    try {
      batch.items = JSON.parse(batch.itemsJson || "[]");
    } catch (error) {
      batch.items = [];
    }

    delete batch.itemsJson;
    return batch;
  });
}

function toSheetValue_(key, value) {
  if (value === null || value === undefined) return "";

  if (
    /^(date|lastImport|containerDate|arrivalDate)$/.test(key) &&
    /^\d{2}-\d{2}-\d{4}$/.test(String(value))
  ) {
    const [day, month, year] = String(value).split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  return value;
}

function serialize_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      "dd-MM-yyyy"
    );
  }

  return value;
}

function readSettings_() {
  const rows = readObjects_(SHEETS.SETTINGS);
  const output = {};

  rows.forEach(row => {
    if (row.key !== "revision") {
      output[row.key] = parseSetting_(row.value);
    }
  });

  return output;
}

function writeSettingsObject_(obj) {
  const revision = String(getRevision_());

  const rows = Object.entries(obj).map(([key, value]) => ({
    key,
    value: JSON.stringify(value)
  }));

  rows.push({
    key: "revision",
    value: revision
  });

  writeObjects_(SHEETS.SETTINGS, rows);
}

function parseSetting_(value) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return value;
  }
}

function getRevision_() {
  return Number(getSetting_("revision") || 0);
}

function getSetting_(key) {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.SETTINGS);
  if (!sh || sh.getLastRow() < 2) return "";

  const values = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();

  for (let index = 0; index < values.length; index += 1) {
    if (values[index][0] === key) {
      return values[index][1];
    }
  }

  return "";
}

function setSetting_(key, value) {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.SETTINGS);
  const lastRow = sh.getLastRow();

  if (lastRow >= 2) {
    const values = sh.getRange(2, 1, lastRow - 1, 2).getValues();

    for (let index = 0; index < values.length; index += 1) {
      if (values[index][0] === key) {
        sh.getRange(index + 2, 2).setValue(value);
        return;
      }
    }
  }

  sh.appendRow([key, value]);
}

function appendLog_(user, action, revision, details) {
  SpreadsheetApp.getActive()
    .getSheetByName(SHEETS.LOGS)
    .appendRow([
      new Date(),
      user,
      action,
      revision,
      details
    ]);
}

function formatAll_() {
  const ss = SpreadsheetApp.getActive();

  Object.entries(SCHEMAS).forEach(([name, schema]) => {
    const sh = ss.getSheetByName(name);
    if (!sh) return;

    const keys = schema.map(item => item[0]);
    const dataRows = Math.max(1, sh.getMaxRows() - 1);

    keys.forEach((key, index) => {
      const column = index + 1;

      if (/date|At|timestamp/i.test(key)) {
        sh.getRange(2, column, dataRows, 1)
          .setNumberFormat("dd-MM-yyyy");
      } else if (
        /cost|price|rate|total|average|shipping|purchaseRM|grandTotal/i.test(key)
      ) {
        sh.getRange(2, column, dataRows, 1)
          .setNumberFormat("#,##0.00");
      } else if (/quantity|stock|itemCount|transitDays|revision/i.test(key)) {
        sh.getRange(2, column, dataRows, 1)
          .setNumberFormat("0");
      }
    });

    setColumnWidths_(sh, schema);
  });
}

function setColumnWidths_(sh, schema) {
  const columnCount = schema.length;
  if (columnCount < 1) return;

  sh.autoResizeColumns(1, columnCount);

  schema.forEach(([key], index) => {
    const column = index + 1;

    if (/name|remark|tracking|itemsJson|details/i.test(key)) {
      sh.setColumnWidth(column, 220);
    } else if (/importNumber|productId|batchId|^id$/i.test(key)) {
      sh.setColumnWidth(column, 155);
    } else if (/date|At|timestamp/i.test(key)) {
      sh.setColumnWidth(column, 125);
    } else if (
      /cost|price|rate|total|average|shipping|purchaseRM|grandTotal/i.test(key)
    ) {
      sh.setColumnWidth(column, 145);
    } else {
      sh.setColumnWidth(column, Math.max(sh.getColumnWidth(column), 105));
    }
  });
}
