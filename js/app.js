document.addEventListener("DOMContentLoaded", () => {
  setupAccessLock();
  repairLegacyImportDates();
  setupNavigation();
  setupSettings();
  setupDashboard();
  setupImportModule();
  setupImportHistory();
  setupInventoryModule();
  setupGlobalMobilePullDownClear();
  registerServiceWorker();
  setupCloudSync();
  publishPricingSuiteImportUnitPrices();
});



const DEFAULT_ACCESS_PASSWORD_HASH =
  "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92";
const DEFAULT_ACCESS_PASSWORD_HINT = "6个数字";
const ACCESS_UNLOCK_SESSION_KEY =
  "loverLegendImportSystemUnlocked";
const DESKTOP_SAVED_PASSWORD_KEY =
  "loverLegendDesktopSavedPassword";

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

  if (status) status.textContent = "";
  if (lock) lock.hidden = true;

  document.body.classList.remove("access-locked");
}

function setupDeviceBiometricSettings() {
  const setupButton =
    document.getElementById("setupBiometricBtn");
  const removeButton =
    document.getElementById("removeBiometricBtn");

  setupButton?.addEventListener("click", async () => {
    const status =
      document.getElementById("passwordChangeStatus");

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
  if (!isMobileOrTabletDevice()) {
    localStorage.removeItem(
      "loverLegendDesktopTrustedAccess"
    );
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

  if (!isMobileOrTabletDevice()) {
    const savedDesktopPassword =
      localStorage.getItem(
        DESKTOP_SAVED_PASSWORD_KEY
      );

    if (savedDesktopPassword) {
      input.value = savedDesktopPassword;
    }
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

  const alreadyUnlocked =
    sessionStorage.getItem(
      ACCESS_UNLOCK_SESSION_KEY
    ) === "1";

  if (alreadyUnlocked) {
    lock.hidden = true;
    document.body.classList.remove("access-locked");
  } else {
    lock.hidden = false;
    document.body.classList.add("access-locked");

    window.setTimeout(async () => {
      const biometricUsed =
        await tryBiometricLogin({
          automatic: true
        });

      if (!biometricUsed) {
        input.focus();
      }
    }, 220);
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
      localStorage.setItem(
        DESKTOP_SAVED_PASSWORD_KEY,
        password
      );
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

    const newHash = await hashAccessPassword(newPassword);
    const newHint = buildAccessPasswordHint(newPassword);
    const settings = loadJSON("importSystemSettings", {});

    saveJSON("importSystemSettings", {
      ...settings,
      accessPasswordHash: newHash,
      accessPasswordHint: newHint
    });

    if (!isMobileOrTabletDevice()) {
      localStorage.setItem(
        DESKTOP_SAVED_PASSWORD_KEY,
        newPassword
      );
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
    // 日期修复只修正日期字段，不得重算库存或 Average Cost。
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
        const countElement =
          document.getElementById("batchListCount");
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
        if (countElement) countElement.textContent = "0 / 0 批";
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

    const currentSettings =
      loadJSON("importSystemSettings", {});

    saveJSON("importSystemSettings", {
      ...currentSettings,
      ...data
    });

    if (typeof markCloudSettingsSaved === "function") {
      markCloudSettingsSaved();
    }

    const status = document.getElementById("settingsStatus");
    status.textContent = "设置已保存";
    setTimeout(() => {
      status.textContent = "";
    }, 1800);
  });

  setupPasswordChange();
  setupDeviceBiometricSettings();
  setupDataTools();
}

function setupDashboard() {
  renderDashboard();
}

function renderDashboard() {
  const products = loadJSON("importSystemProducts", []);
  // 库存数量才是首页是否显示的最终依据。
  // 旧版本或删除批次后可能遗留 inventoryArchived=true，
  // 只要库存仍大于 0，就必须继续显示。
  const activeInventoryProducts = products.filter(
    item => (Number(item.stock) || 0) > 0
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
  const latestBatchImportDate = batches
    .map(batch =>
      normalizeDateToDDMMYYYY(
        batch.arrivalDate || batch.containerDate
      )
    )
    .filter(value => parseDDMMYYYY(value) > 0)
    .sort((a, b) => parseDDMMYYYY(b) - parseDDMMYYYY(a))[0];

  document.getElementById("lastImport").textContent =
    latestBatchImportDate ||
    normalizeDateToDDMMYYYY(dates[0]) ||
    "-";

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

function renderProductList() {
  const products = getProducts();
  const keyword = document.getElementById("productSearch").value.trim().toLowerCase();
  const filtered = products.filter(product => {
    const target =
      `${product.id} ${product.name} ${product.category}`;
    return smartSearchMatches(target, keyword);
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
    saveButton.textContent = "保存/更新进口记录";
    saveButton.classList.add("update-mode");
  } else {
    modeBox.hidden = true;
    label.textContent = "";
    saveButton.textContent = "保存/更新进口记录";
    saveButton.classList.remove("update-mode");
  }
}

function setupImportModule(){
  setupDatePickers();

  document.getElementById("addBatchRowBtn").addEventListener("click",()=>addBatchRow());

  const batchLookupInput =
    document.getElementById("batchLookupInput");
  let lastCompletedBatchLookup = "";
  let batchLookupTimer = 0;

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
  batchLookupInput?.addEventListener("change", () => {
    runBatchLookupFromKeyboard();
  });

  batchLookupInput?.addEventListener("blur", () => {
    batchLookupTimer = window.setTimeout(() => {
      runBatchLookupFromKeyboard();
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
    x.addEventListener("input",calculateBatch); x.addEventListener("blur",()=>{formatInputAmount(x);calculateBatch();});
  });
  document.getElementById("batchCurrency").addEventListener("change",()=>{applyBatchRate();calculateBatch();});

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
      renderBatchList();
    });
  }

  if (productStockSearch) {
    productStockSearch.addEventListener("input", () => {
      const keyword = String(productStockSearch.value || "").trim();

      if (keyword && batchSearch) {
        batchSearch.value = "";
      }

      batchListExpanded = false;
      renderBatchProductStockResults();
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

      return (sameProductId || sameProductIdentity) && record.containerDate;
    })
    .sort(
      (a, b) =>
        parseDDMMYYYY(b.containerDate) -
        parseDDMMYYYY(a.containerDate)
    )[0]?.containerDate || "";
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
      unitCost: resolveImportUnitCost(record, parentBatch)
    });
  });
  (batches || []).forEach(batch => {
    (Array.isArray(batch?.items) ? batch.items : []).forEach(item => addRecord({
      ...item,
      batchId: item.batchId || batch.id,
      importNumber: item.importNumber || batch.importNumber,
      containerDate: item.containerDate || batch.containerDate,
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
    const sharedForeign =
      (Number(batch.chinaTransportCost) || 0) +
      (Number(batch.potCost) || 0);
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

  // 修复旧资料可能遗留的隐藏标记：有库存就不能被首页隐藏。
  products.forEach(product => {
    if ((Number(product.stock) || 0) > 0) {
      product.inventoryArchived = false;
    }
  });

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
    alert("请输入进口编号或海外运输单号。");
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
      alert("找到多个符合的进口记录，请输入更完整的进口编号或海外运输单号。");
      input.focus();
      input.select();
      return;
    }
  }

  if (!batch) {
    alert("找不到这个进口编号或海外运输单号。");
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
      `提醒：这项进口记录属于旧版本资料，无法自动恢复当时的内地运输＋打木架费用。如该栏位为空，请按原始单据补回后再更新，不会影响现有库存及Average Cost。`;
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
    const originalQuantity = Math.max(
      0,
      Number(item.originalQuantity ?? item.quantity) || 0
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

    addBatchRow({
      name: item.productName || "",
      category: item.category || "盆栽",
      productId: item.productId || "",
      originalQuantity,
      quantity: remainingQuantity,
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

function buildHistoryProductNameButtons(productNames) {
  return Array.from(productNames || [])
    .map(name => {
      const value = String(name || "").trim();
      if (!value) return "";

      return `
        <button type="button"
                class="history-copy-product"
                data-history-product="${escapeHTML(value)}"
                title="点击复制并查询此产品">
          ${escapeHTML(value)}
        </button>
      `;
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
      '<div class="empty-state">输入进口编号、产品名称，或选择日期范围查看历史资料</div>';
  }

  showHistoryCopyToast("已清空本页");
}

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
    renderImportHistory();
  };

  button?.addEventListener("click", () => {
    lastCompletedHistoryLookup = "";
    runHistoryLookup();
  });

  input?.addEventListener("input", () => {
    lastCompletedHistoryLookup = "";
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
    runHistoryLookup();
  });

  input?.addEventListener("blur", () => {
    historyLookupTimer = window.setTimeout(() => {
      runHistoryLookup();
    }, 0);
  });

  startPicker?.addEventListener("change", () => {
    startInput.value =
      formatNativeDateToDDMMYYYY(startPicker.value);
    startInput.classList.remove("date-error");
    lastCompletedHistoryLookup = "";
    renderImportHistory();
  });

  endPicker?.addEventListener("change", () => {
    endInput.value =
      formatNativeDateToDDMMYYYY(endPicker.value);
    endInput.classList.remove("date-error");
    lastCompletedHistoryLookup = "";
    renderImportHistory();
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
    renderImportHistory();
  });

  clearPageButton?.addEventListener("click", () => {
    lastCompletedHistoryLookup = "";
    clearHistoryPageView();
  });

  historyResult?.addEventListener("click", async event => {
    const productButton =
      event.target.closest(".history-copy-product");

    if (productButton) {
      const productName = String(
        productButton.dataset.historyProduct || ""
      ).trim();

      if (!productName) return;

      await copyHistoryText(
        productName,
        "✓ 已复制产品名称"
      );

      if (
        productButton.dataset.historyCopyOnly === "true"
      ) {
        return;
      }

      input.value = productName;
      input.dataset.exactHistoryProduct = productName;
      lastCompletedHistoryLookup = "";
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
    .match(/^(CNY|NTD|VND|IDR)/)?.[1] || "";

  const currencyCandidates = [
    batch?.currency,
    ...(items || []).map(item => item?.currency),
    ...matchingImports.map(record => record?.currency),
    importPrefix
  ];

  const currency =
    currencyCandidates
      .map(value => String(value || "").trim().toUpperCase())
      .find(value => ["CNY", "NTD", "VND", "IDR"].includes(value)) ||
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
        <td>
          <button type="button"
                  class="history-copy-product history-copy-product-inline"
                  data-history-product="${escapeHTML(
                    item.productName || ""
                  )}"
                  data-history-copy-only="true"
                  title="点击复制产品名称">
            ${escapeHTML(item.productName || "-")}
          </button>
        </td>
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

  const searchable = [
    product?.name,
    product?.productName,
    product?.id,
    product?.productId,
    product?.category
  ].map(value => String(value || "")).join(" ");

  return smartSearchMatches(searchable, keyword);
}

function getDailyStockAdjustments(selectedDate, keyword = "") {
  const normalizedDate =
    normalizeDateToDDMMYYYY(selectedDate);

  return getProducts()
    .flatMap(product =>
      getProductStockAdjustments(product)
        .filter(adjustment =>
          normalizeDateToDDMMYYYY(adjustment.date) ===
          normalizedDate
        )
        .map(adjustment => ({
          ...adjustment,
          productId: product.id || "",
          productName: product.name || "未命名产品",
          category: product.category || "盆栽"
        }))
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
    const action = delta < 0 ? "卖出" : "修改";
    const deltaText = delta > 0 ? `+${delta}` : String(delta);

    return `
      <article class="history-adjustment-card ${delta < 0 ? "out" : "in"}">
        <div class="history-adjustment-product">
          <button type="button"
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
          <small>${escapeHTML(adjustment.productId || "")}</small>
        </div>

        <div class="history-adjustment-detail">
          <span>${escapeHTML(action)}</span>
          <strong>${escapeHTML(deltaText)}</strong>
        </div>

        <div class="history-adjustment-meta">
          <span>修改前 ${formatNumber(Number(adjustment.before) || 0)}</span>
          <span>修改后 ${formatNumber(Number(adjustment.after) || 0)}</span>
          ${
            adjustment.importNumber
              ? `<span>进口编号 ${escapeHTML(adjustment.importNumber)}</span>`
              : ""
          }
        </div>
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

  return dates.reverse();
}

function getHistorySingleDateEventCount(
  selectedDate,
  keyword = ""
) {
  const normalizedKeyword =
    String(keyword || "").trim();

  const hasIncoming = getBatches().some(batch => {
    if (
      normalizeDateToDDMMYYYY(batch.arrivalDate) !==
      selectedDate
    ) {
      return false;
    }

    const allItems = getBatchItemsForDisplay(batch);

    if (!normalizedKeyword) {
      return allItems.length > 0;
    }

    const importNumberMatch =
      sequentialSearchMatches(
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
  });

  const adjustments =
    getDailyStockAdjustments(
      selectedDate,
      normalizedKeyword
    );

  const hasOutgoing = adjustments.some(
    adjustment =>
      Math.trunc(Number(adjustment.delta) || 0) < 0
  );

  const hasIncrease = adjustments.some(
    adjustment =>
      Math.trunc(Number(adjustment.delta) || 0) > 0
  );

  return (
    (hasIncoming ? 1 : 0) +
    (hasOutgoing ? 1 : 0) +
    (hasIncrease ? 1 : 0)
  );
}

function renderHistorySingleDateSection(
  selectedDate,
  keyword = ""
) {
  const normalizedKeyword = String(keyword || "").trim();

  const incomingMatches = getBatches()
    .map(batch => {
      if (
        normalizeDateToDDMMYYYY(batch.arrivalDate) !==
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
        sequentialSearchMatches(
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
            (incomingMatches.length ? 1 : 0) +
            (adjustmentTotals.outQuantity > 0 ? 1 : 0) +
            (adjustmentTotals.increaseQuantity > 0 ? 1 : 0)
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

          return smartSearchMatches(
            searchable,
            normalizedKeyword.toLowerCase()
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

          return smartSearchMatches(
            searchable,
            normalizedKeyword.toLowerCase()
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
                  adjustment.date,
                  range
                )
              );
            })
            .sort((a, b) =>
              parseDDMMYYYY(a.date) -
              parseDDMMYYYY(b.date)
            );

        const arrivalInRange =
          isDateWithinHistoryRange(
            item.arrivalDate ||
            batch.arrivalDate,
            range
          );

        return {
          item,
          product,
          importNumber,
          adjustments,
          arrivalInRange
        };
      }).filter(entry =>
        entry.arrivalInRange ||
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
            parseDDMMYYYY(adjustment.date) || 0
          )
        )
      );

      const bLatestAdjustment = Math.max(
        0,
        ...b.itemEntries.flatMap(entry =>
          entry.adjustments.map(adjustment =>
            parseDDMMYYYY(adjustment.date) || 0
          )
        )
      );

      const aArrival =
        parseDDMMYYYY(a.batch.arrivalDate) || 0;
      const bArrival =
        parseDDMMYYYY(b.batch.arrivalDate) || 0;

      return Math.max(bLatestAdjustment, bArrival) -
        Math.max(aLatestAdjustment, aArrival);
    });

  if (!productMatches.length) {
    return false;
  }

  // 摘要始终使用该产品全部批次的累计资料，
  // 不会因为日期范围而变成局部数量。
  const summary = allMatchingEntries.reduce(
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
          累计原进口
          ${formatNumber(summary.originalQuantity)}
          · 目前总剩余
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
              const actionLabel =
                delta < 0 ? "卖出" : "修改";

              return `
                <div class="product-history-adjustment ${
                  delta >= 0 ? "increase" : "decrease"
                }">
                  <strong class="product-history-adjustment-date">
                    ${escapeHTML(
                      normalizeDateToDDMMYYYY(
                        adjustment.date
                      ) || "-"
                    )}
                  </strong>
                  <span class="product-history-adjustment-action">
                    ${actionLabel}
                  </span>
                  <strong class="product-history-adjustment-quantity">
                    ${signedDelta}
                  </strong>
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

  output.innerHTML = summaryBox + compactRows;
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
    `;
}


function renderImportHistory() {
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
    output.innerHTML = '<div class="empty-state">输入进口编号、产品名称，或选择日期范围查看历史资料</div>';
    return;
  }

  const normalizedKeyword = keyword.toLowerCase();
  const batches = getBatches();
  const exactBatch = batches.find(item =>
    String(item.importNumber || "").trim().toLowerCase() === normalizedKeyword
  );

  if (exactBatch) {
    output.innerHTML = buildImportHistoryCard(
      exactBatch,
      getBatchItemsForDisplay(exactBatch),
      { showRelatedBatches: false }
    );
    return;
  }

  const partialBatchMatches = batches.filter(batch =>
    sequentialSearchMatches(batch.importNumber, keyword)
  );

  if (partialBatchMatches.length === 1) {
    const matchedBatch = partialBatchMatches[0];

    output.innerHTML = buildImportHistoryCard(
      matchedBatch,
      getBatchItemsForDisplay(matchedBatch),
      { showRelatedBatches: false }
    );
    return;
  }

  if (partialBatchMatches.length > 1) {
    output.innerHTML =
      '<div class="empty-state">找到多个符合的进口编号，请输入更完整的编号</div>';
    return;
  }

  const productMatches = batches.map(batch => {
    const exactHistoryProduct =
      String(
        input.dataset.exactHistoryProduct || ""
      ).trim().toLowerCase();

    const matchingItems = getBatchItemsForDisplay(batch).filter(item => {
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

      return smartSearchMatches(
        searchable,
        normalizedKeyword
      );
    });

    return {
      batch,
      matchingItems
    };
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
    output.innerHTML = '<div class="empty-state">找不到这个进口编号或产品名称</div>';
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

  const summaryBox = `
    <div class="history-related-notice">
      <div class="history-related-title">${productTitle}</div>
      <div class="history-related-batch">
        <strong>进口记录：${formatNumber(productMatches.length)}</strong>
        <span>累计原进口 ${formatNumber(summary.originalQuantity)} · 目前总剩余 ${formatNumber(summary.remainingQuantity)}</span>
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

              const actionLabel =
                delta < 0 ? "卖出" : "修改";

              return `
                <div class="product-history-adjustment ${delta >= 0 ? "increase" : "decrease"}">
                  <strong class="product-history-adjustment-date">${escapeHTML(adjustment.date || "-")}</strong>
                  <span class="product-history-adjustment-action">${actionLabel}</span>
                  <strong class="product-history-adjustment-quantity">${signedDelta}</strong>
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
              <strong>${formatMoney(Number(item.unitCost) || 0, "RM ")}</strong>
            </div>
          </div>
          ${adjustmentRows}
        </article>
      `;
    })
  ).join("");

  output.innerHTML = summaryBox + compactRows;
}

const PRICING_SUITE_IMPORT_PRICES_KEY =
  "loverLegendPricingSuiteImportUnitPrices";

function publishPricingSuiteImportUnitPrices() {
  try {
    const imports = getImports();
    const batches = getBatches();
    const products = getProducts();
    const records = [];
    const seen = new Set();

    const productById = new Map(
      products.map(product => [String(product?.id || ""), product])
    );

    const productByName = new Map(
      products.map(product => [
        String(product?.name || "").trim().toLocaleLowerCase(),
        product
      ])
    );

    const batchByImportNumber = new Map(
      batches.map(batch => [
        String(batch?.importNumber || "").trim().toLocaleLowerCase(),
        batch
      ])
    );

    const addRecord = source => {
      const productName = String(
        source?.productName || source?.name || ""
      ).trim();
      const category = String(source?.category || "盆栽").trim();
      const importNumber = String(source?.importNumber || "").trim();
      const currency = String(source?.currency || "").trim().toUpperCase();
      const unitPrice = Number(source?.unitPrice);
      const rate = Number(source?.rate);
      const matchingProduct =
        productById.get(String(source?.productId || "")) ||
        productByName.get(productName.toLocaleLowerCase()) ||
        null;
      const matchingBatch =
        batchByImportNumber.get(importNumber.toLocaleLowerCase()) ||
        null;
      const averageCostRM = Number(matchingProduct?.averageCost) || 0;
      const shippingRate = matchingBatch
        ? Number(getBatchShippingRate(matchingBatch)) || 0
        : Number(source?.shippingRate) || 0;
      const effectiveRate =
        Number.isFinite(rate) && rate > 0
          ? rate
          : Number(matchingBatch?.rate) || 0;

      // 供 Pricing Suite 使用的外币成本：
      // 原购买单价 + 按货值比例分摊的内地运输与花盆费用，
      // 不包含海外到马来西亚运费。
      let pricingUnitPrice = unitPrice;

      if (matchingBatch && Number.isFinite(unitPrice) && unitPrice > 0) {
        const batchItems = Array.isArray(matchingBatch.items)
          ? matchingBatch.items
          : [];

        const totalPurchaseForeign = batchItems.reduce((sum, item) => {
          const quantity = Math.max(
            0,
            Number(
              item?.originalQuantity ??
              item?.stockAdded ??
              item?.quantity
            ) || 0
          );
          const itemUnitPrice = Number(item?.unitPrice) || 0;
          const storedForeignTotal = Number(item?.foreignTotal);

          return sum + (
            Number.isFinite(storedForeignTotal) && storedForeignTotal > 0
              ? storedForeignTotal
              : quantity * itemUnitPrice
          );
        }, 0);

        const quantity = Math.max(
          0,
          Number(
            source?.originalQuantity ??
            source?.stockAdded ??
            source?.quantity
          ) || 0
        );

        const foreignTotal =
          Number(source?.foreignTotal) > 0
            ? Number(source.foreignTotal)
            : quantity * unitPrice;

        const sharedForeign =
          (Number(matchingBatch.chinaTransportCost) || 0) +
          (Number(matchingBatch.potCost) || 0);

        if (quantity > 0 && foreignTotal > 0 && totalPurchaseForeign > 0) {
          const allocatedSharedForeign =
            sharedForeign * (foreignTotal / totalPurchaseForeign);

          const calculatedPricingUnitPrice =
            (foreignTotal + allocatedSharedForeign) / quantity;

          if (
            Number.isFinite(calculatedPricingUnitPrice) &&
            calculatedPricingUnitPrice > 0
          ) {
            pricingUnitPrice = calculatedPricingUnitPrice;
          }
        }
      }

      const landedUnitCostRM =
        effectiveRate > 0
          ? pricingUnitPrice / effectiveRate *
            (1 + shippingRate / 100)
          : (
              Number(source?.unitCost) > 0
                ? Number(source.unitCost)
                : averageCostRM
            );

      if (
        !productName ||
        category !== "盆栽" ||
        !currency ||
        !Number.isFinite(unitPrice) ||
        unitPrice <= 0
      ) {
        return;
      }

      const key = [
        productName.toLocaleLowerCase(),
        importNumber.toLocaleLowerCase(),
        currency,
        unitPrice
      ].join("|");

      if (seen.has(key)) return;
      seen.add(key);

      records.push({
        id: String(source?.id || key),
        productId: String(source?.productId || ""),
        productName,
        category,
        importNumber,
        unitPrice,
        pricingUnitPrice,
        landedUnitCostRM,
        currency,
        rate: effectiveRate,
        averageCostRM,
        shippingRate,
        date: String(
          source?.arrivalDate ||
          source?.containerDate ||
          source?.date ||
          ""
        ),
        updatedAt: String(
          source?.updatedAt || source?.createdAt || ""
        )
      });
    };

    imports.forEach(addRecord);

    batches.forEach(batch => {
      (Array.isArray(batch?.items) ? batch.items : []).forEach(item => {
        addRecord({
          ...item,
          importNumber: item?.importNumber || batch?.importNumber || "",
          currency: item?.currency || batch?.currency || "",
          rate: item?.rate || batch?.rate || 0,
          arrivalDate: item?.arrivalDate || batch?.arrivalDate || "",
          containerDate: item?.containerDate || batch?.containerDate || ""
        });
      });
    });

    records.sort((a, b) => {
      const nameCompare = a.productName.localeCompare(
        b.productName,
        "zh-Hans-CN",
        { numeric: true, sensitivity: "base" }
      );

      if (nameCompare !== 0) return nameCompare;
      return b.importNumber.localeCompare(a.importNumber, undefined, {
        numeric: true,
        sensitivity: "base"
      });
    });

    localStorage.setItem(
      PRICING_SUITE_IMPORT_PRICES_KEY,
      JSON.stringify({
        version: 4,
        exportedAt: new Date().toISOString(),
        records
      })
    );

    window.dispatchEvent(new CustomEvent(
      "loverLegendImportUnitPricesUpdated",
      { detail: { count: records.length } }
    ));
  } catch (error) {
    console.warn("无法更新 Pricing Suite 原外币单价资料", error);
  }
}

function getImports(){return loadJSON("importSystemImports",[]);}
function saveImports(v) {
  const previous = getImports();
  saveJSON("importSystemImports", v);
  if (typeof markCloudCollectionSaved === "function") {
    markCloudCollectionSaved("imports", previous, v);
  }
  publishPricingSuiteImportUnitPrices();
}
function getBatches(){return loadJSON("importSystemBatches",[]);}
function saveBatches(v) {
  const previous = getBatches();
  saveJSON("importSystemBatches", v);
  if (typeof markCloudCollectionSaved === "function") {
    markCloudCollectionSaved("batches", previous, v);
  }
  publishPricingSuiteImportUnitPrices();
}
function renderBatchSuggestions(keyword = ""){
  const list =
    document.getElementById("batchProductSuggestions");

  if (!list) return;

  const value = String(keyword || "").trim();

  // 没有输入名称时，显示全部已建立产品。
  if (!value) {
    list.innerHTML = getProducts()
      .slice()
      .sort((a, b) =>
        String(a.id || "").localeCompare(
          String(b.id || "")
        )
      )
      .map(product => `
        <option value="${escapeHTML(product.name)}">
          ${escapeHTML(product.id)} ·
          ${escapeHTML(product.category)}
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
  const candidates = [
    record?.arrivalDate,
    batch?.arrivalDate,
    record?.containerDate,
    batch?.containerDate
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
  const id=++batchRowSeq,tr=document.createElement("tr");
  tr.dataset.rowId=id;

  const editableMaximum = Number(prefill.originalQuantity);
  const hasEditableMaximum = Number.isFinite(editableMaximum) && editableMaximum >= 0;
  if (hasEditableMaximum) {
    tr.dataset.originalQuantity = String(Math.floor(editableMaximum));
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
  <td><select id="batchCategory-${id}">
    <option value="盆栽">盆栽</option>
    <option value="花盆">花盆</option>
    <option value="周边产品">周边产品</option>
  </select></td>
  <td><input id="batchStock-${id}" inputmode="numeric" placeholder="0" disabled></td>
  <td><input id="batchUnitCost-${id}" value="0.00" disabled></td>
  <td><button type="button" class="remove-item-btn" onclick="removeBatchRow(${id})">删除</button></td>`;
  document.getElementById("batchRows").appendChild(tr);
  document.getElementById(`batchCategory-${id}`).value =
    prefill.category || "盆栽";
  if (Number.isFinite(Number(prefill.quantity))) {
    const quantity = Math.max(0, Math.floor(Number(prefill.quantity)));
    const quantityInput = document.getElementById(`batchQty-${id}`);
    quantityInput.value = quantity;
    document.getElementById(`batchStock-${id}`).value = quantity;

    if (hasEditableMaximum) {
      quantityInput.max = String(Math.floor(editableMaximum));
      quantityInput.setAttribute(
        "aria-label",
        `此进口编号当前剩余数量，允许 0 至 ${Math.floor(editableMaximum)}`
      );
    }
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

function positionBatchRowSuggestionBox(id) {
  const input =
    document.getElementById(`batchName-${id}`);
  const box =
    document.getElementById(`batchSuggestionBox-${id}`);

  if (!input || !box || box.hidden) return;

  const rect = input.getBoundingClientRect();
  const viewportWidth =
    document.documentElement.clientWidth ||
    window.innerWidth ||
    0;

  const preferredWidth = Math.max(
    rect.width,
    Math.min(360, viewportWidth - 24)
  );

  const left = Math.min(
    Math.max(8, rect.left),
    Math.max(8, viewportWidth - preferredWidth - 8)
  );

  box.style.left = `${left}px`;
  box.style.top = `${rect.bottom + 4}px`;
  box.style.width = `${preferredWidth}px`;
}

function renderBatchRowSuggestionBox(id) {
  const input =
    document.getElementById(`batchName-${id}`);
  const box =
    document.getElementById(`batchSuggestionBox-${id}`);

  if (!input || !box) return;

  const value = String(input.value || "").trim();

  const suggestions = getProducts()
    .slice()
    .filter(product => {
      if (!value) return true;

      const searchable = [
        product.name,
        product.id,
        product.category
      ].join(" ");

      return smartSearchMatches(
        searchable,
        value
      );
    })
    .sort((a, b) =>
      String(a.id || "").localeCompare(
        String(b.id || "")
      )
    );

  if (!suggestions.length) {
    box.innerHTML = `
      <div class="batch-product-suggestion-empty">
        找不到符合“${escapeHTML(value)}”的产品
      </div>
    `;
  } else {
    box.innerHTML = suggestions.map(product => `
      <button type="button"
              class="batch-product-suggestion-item"
              data-batch-suggestion="${escapeHTML(product.name)}">
        <strong>${escapeHTML(product.name)}</strong>
        <small>
          ${escapeHTML(product.id || "-")} ·
          ${escapeHTML(product.category || "盆栽")}
        </small>
      </button>
    `).join("");
  }

  box.hidden = false;
  positionBatchRowSuggestionBox(id);
}


function hideBatchRowSuggestionBox(id) {
  const box =
    document.getElementById(`batchSuggestionBox-${id}`);

  if (!box) return;

  box.hidden = true;
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

    document.getElementById(
      `batchProductId-${id}`
    ).value = product?.id || "";

    document.getElementById(
      `batchCategory-${id}`
    ).value =
      product?.category ||
      document.getElementById(
        `batchCategory-${id}`
      ).value ||
      "盆栽";

    hideBatchRowSuggestionBox(id);
    calculateBatch();
  };

  n.addEventListener("input", () => {
    let chars = Array.from(n.value);

    if (chars.length > 15) {
      n.value = chars.slice(0, 15).join("");
    }

    const product = getProducts().find(item =>
      String(item.name || "").toLowerCase() ===
      n.value.trim().toLowerCase()
    );

    document.getElementById(
      `batchProductId-${id}`
    ).value = product?.id || "";

    document.getElementById(
      `batchCategory-${id}`
    ).value =
      product?.category ||
      document.getElementById(
        `batchCategory-${id}`
      ).value ||
      "盆栽";

    renderBatchRowSuggestionBox(id);
    calculateBatch();
  });

  n.addEventListener("focus", () => {
    renderBatchRowSuggestionBox(id);
  });

  n.addEventListener("click", () => {
    renderBatchRowSuggestionBox(id);
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
      status.textContent = "找不到原进口记录，无法更新库存。";
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
      status.textContent = "库存调整只能修改原进口记录内产品的剩余数量，不能新增、删除或更换产品。";
      return;
    }

    const updatedItems = [];
    for (const [key, oldItem] of oldMap.entries()) {
      const edited = editedMap.get(key);
      const originalQuantity = Math.max(
        0,
        Number(oldItem.originalQuantity ?? oldItem.quantity) || 0
      );
      const oldRemainingRaw = Number(
        oldItem.remainingQuantity ?? oldItem.quantity
      );
      const oldRemaining = Number.isFinite(oldRemainingRaw)
        ? Math.min(
            originalQuantity,
            Math.max(0, Math.floor(oldRemainingRaw))
          )
        : originalQuantity;
      const parsedRemaining = Number(edited.quantity);
      const newRemaining = Number.isFinite(parsedRemaining)
        ? Math.max(0, Math.floor(parsedRemaining))
        : oldRemaining;

      if (newRemaining > originalQuantity) {
        status.textContent =
          `${oldItem.productName || edited.name || "此产品"} 原进口 ${originalQuantity}，此进口编号的当前剩余数量只允许输入 0 至 ${originalQuantity}，不能保存 ${newRemaining}。`;
        return;
      }

      const productIndex = products.findIndex(product =>
        product.id === oldItem.productId ||
        (String(product.name || "").trim().toLowerCase() === String(oldItem.productName || "").trim().toLowerCase() &&
         product.category === oldItem.category)
      );
      const productBeforeEdit = productIndex !== -1 ? products[productIndex] : null;

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

      // 编辑旧批次只按剩余数量差额调整当前库存。
      // 销售或退货不能触发旧 Imports 全量重建，也不能改变 Average Cost。
      if (productIndex !== -1) {
        const stockDifference = newRemaining - oldRemaining;
        const currentStock = Math.max(0, Number(products[productIndex].stock) || 0);

        products[productIndex] = {
          ...products[productIndex],
          stock: Math.max(0, currentStock + stockDifference),
          averageCost: Math.max(0, Number(products[productIndex].averageCost) || 0),
          inventoryArchived: currentStock + stockDifference > 0
            ? false
            : products[productIndex].inventoryArchived,
          updatedAt: new Date().toISOString()
        };
      }

      updatedItems.push({
        ...oldItem,
        originalQuantity,
        quantity: originalQuantity,
        remainingQuantity: newRemaining,
        stockAdded: originalQuantity,
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
      `已更新 ${currentEditingImportNumber || oldBatch.importNumber} 的进口记录剩余数量；库存只按新旧数量差额调整。Average Cost、原进口历史及海外运费比例保持不变。`;
    return;
  }

  const batchId = `BAT${Date.now()}`;
  const importNumber = generateImportNumber(
    document.getElementById("batchCurrency").value,
    document.getElementById("batchArrivalDate").value,
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

  if (!keyword && !batchListExpanded) {
    if (countElement) countElement.textContent = `0 / ${allBatches.length} 批`;

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

    const numberOrTransportMatch = [
      batch.importNumber,
      batch.trackingNumber,
      batch.overseasTrackingNumber
    ].some(value =>
      sequentialSearchMatches(value, keyword)
    );

    const productMatch =
      smartSearchMatches(productText, keyword);

    return numberOrTransportMatch || productMatch;
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
      ? '<div class="empty-state">暂无符合的进口记录</div>'
      : '<div class="empty-state">暂无进口记录</div>';
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
        <div><span>进口总成本</span><strong>${formatMoney(batch.grandTotal, "RM ")}</strong></div>
        <div><span>运输单号</span><strong>${escapeHTML(batch.overseasTrackingNumber || batch.trackingNumber || "-")}</strong></div>
      </div>
    </article>`;
  }).join("");
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
  const countElement =
    document.getElementById("batchListCount");

  if (status) status.textContent = "";

  if (!keyword) {
    output.hidden = true;
    output.innerHTML = "";

    if (recentBatchArea) recentBatchArea.hidden = false;
    if (toggleButton) toggleButton.hidden = false;
    if (countElement) countElement.hidden = false;

    renderBatchList();
    return;
  }

  if (recentBatchArea) recentBatchArea.hidden = true;
  if (toggleButton) toggleButton.hidden = true;
  if (countElement) countElement.hidden = true;

  const products = getProducts()
    .filter(product =>
      smartSearchMatches(
        `${product.id || ""} ${product.name || ""} ${product.category || ""}`,
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

  output.innerHTML = products.map(product => `
    <div class="product-stock-result-row">
      <button
        class="product-stock-name-btn"
        type="button"
        data-product-id="${escapeHTML(product.id || "")}"
        data-edit-type="name"
        aria-label="长按修改产品名称">
        ${escapeHTML(product.name || "未命名产品")}
      </button>

      <button
        class="product-stock-qty-btn"
        type="button"
        data-product-id="${escapeHTML(product.id || "")}"
        data-edit-type="stock"
        aria-label="长按修改当前库存">
        当前库存：<strong>${formatNumber(Number(product.stock) || 0)}</strong>
      </button>
    </div>
  `).join("");

  bindProductStockLongPress();
}


function bindProductStockLongPress() {
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
      ".product-stock-name-btn, .product-stock-qty-btn"
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

      if (editType === "name") {
        editProductNameFromImportPage(productId);
      } else if (editType === "stock") {
        editProductStockFromImportPage(productId);
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
        ".product-stock-name-btn, .product-stock-qty-btn"
      )
    ) {
      event.preventDefault();
    }
  });

  output.addEventListener("click", event => {
    const button = event.target.closest(
      ".product-stock-name-btn, .product-stock-qty-btn"
    );
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();

    if (triggered) {
      triggered = false;
    }
  });
}

function editProductNameFromImportPage(productId) {
  const newName = renameInventoryProduct(productId);
  if (!newName) return;

  const status = document.getElementById("batchProductStockStatus");
  if (status) status.textContent = `已更新产品名称：${newName}`;
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

function appendProductStockAdjustments(product, changes, changedAt) {
  const existing = getProductStockAdjustments(product);
  const timestamp = changedAt || new Date().toISOString();
  const date = formatDateDDMMYYYY(new Date(timestamp));

  const additions = (changes || [])
    .filter(change => Number(change?.delta) !== 0)
    .map(change => ({
      id:
        `ADJ${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
      date,
      createdAt: timestamp,
      importNumber: String(change.importNumber || "").trim(),
      delta: Math.trunc(Number(change.delta) || 0),
      before: Math.max(0, Math.trunc(Number(change.before) || 0)),
      after: Math.max(0, Math.trunc(Number(change.after) || 0))
    }));

  const next = [...existing, ...additions];

  return {
    stockAdjustments: next,
    stockAdjustmentsJson: JSON.stringify(next)
  };
}

function allocateProductRemainingFIFO(productId, productName, targetStock) {
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
      delta: 0
    };

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

  saveImports(nextImports);
  saveBatches(nextBatches);

  return {
    ok: true,
    cumulativeOriginal,
    changedAt: now,
    changes: Array.from(changesByImportNumber.values())
      .filter(change => change.delta !== 0)
  };
}

function editProductStockFromImportPage(productId) {
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

  const confirmed = window.confirm(
    `确认修改？\n\n产品：${product.name}\n目前库存：${formatNumber(currentStock)}\n修改为：${formatNumber(nextStock)}`
  );

  if (!confirmed) return;

  const allocation = allocateProductRemainingFIFO(
    product.id,
    product.name,
    nextStock
  );

  if (!allocation.ok) {
    alert(allocation.message);
    return;
  }

  const adjustmentData = appendProductStockAdjustments(
    product,
    allocation.changes,
    allocation.changedAt
  );

  products[productIndex] = {
    ...product,
    ...adjustmentData,
    stock: nextStock,
    inventoryArchived:
      nextStock > 0 ? false : product.inventoryArchived,
    updatedAt: allocation.changedAt || new Date().toISOString()
  };

  saveProducts(products);
  renderBatchProductStockResults();
  renderInventoryManagementList();
  renderDashboard();
  renderBatchList();

  const status = document.getElementById("batchProductStockStatus");
  if (status) {
    status.textContent =
      `已更新：${product.name} 当前库存 ${formatNumber(nextStock)}`;
  }
}

async function copyInventoryProductName(button) {
  const productName =
    String(button?.dataset?.productName || button?.textContent || "").trim();

  if (!productName) return;

  const showCopied = () => {
    const original = productName;
    button.textContent = "✓ 已复制";
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
        '<div class="empty-state">输入进口编号、产品名称，或选择日期范围查看历史资料</div>';
    }

    return "已清空历史查询";
  }

  if (pageId === "settingsPage") {
    const defaults = {
      CNY: 1.60,
      NTD: 7.69,
      VND: 6300.00,
      IDR: 3571.00
    };
    const saved = loadJSON("importSystemSettings", defaults);

    ["CNY", "NTD", "VND", "IDR"].forEach(currency => {
      const field = document.getElementById(`rate${currency}`);
      if (field) {
        field.value = formatMoney(
          saved[currency] ?? defaults[currency]
        );
      }
    });

    const settingsStatus = document.getElementById("settingsStatus");
    const toolsStatus = document.getElementById("dataToolsStatus");
    const restoreInput = document.getElementById("restoreFileInput");

    if (settingsStatus) settingsStatus.textContent = "";
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
      }, 1000);
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
    .addEventListener("input", renderInventoryManagementList);
  document
    .getElementById("inventorySort")
    .addEventListener("change", renderInventoryManagementList);

  const inventoryList = document.getElementById("inventoryManagementList");

  inventoryList.addEventListener("click", event => {
    const importButton =
      event.target.closest(".inventory-import-number");

    if (importButton) {
      copyInventoryImportNumber(importButton);
    }
  });

  renderInventoryManagementList();
}

function renameInventoryProduct(productId) {
  const id = String(productId || "").trim();
  if (!id) return "";

  const products = getProducts();
  const productIndex = products.findIndex(
    product => String(product.id || "") === id
  );

  if (productIndex === -1) {
    alert("找不到这个产品。");
    return "";
  }

  const product = products[productIndex];
  const oldName = String(product.name || "").trim();
  const enteredName = window.prompt("修改产品名称", oldName);

  if (enteredName === null) return;

  const newName = String(enteredName).trim();

  if (!newName) {
    alert("产品名称不能为空。");
    return "";
  }

  if (Array.from(newName).length > 15) {
    alert("产品名称最多15个字。");
    return "";
  }

  if (newName === oldName) {
    showProductRenameMessage("名称没有改变");
    return "";
  }

  const duplicate = products.find(
    item =>
      String(item.id || "") !== id &&
      String(item.name || "").trim().toLowerCase() === newName.toLowerCase()
  );

  if (duplicate) {
    alert("已有相同名称的产品。");
    return "";
  }

  const confirmed = window.confirm(
    `确认修改？\n\n原名称：${oldName}\n修改为：${newName}`
  );

  if (!confirmed) return "";

  const now = new Date().toISOString();

  products[productIndex] = {
    ...product,
    name: newName,
    updatedAt: now
  };

  const imports = getImports().map(record => {
    const sameProductId =
      record.productId && String(record.productId) === id;
    const sameLegacyName =
      !record.productId &&
      String(record.productName || "").trim().toLowerCase() ===
        oldName.toLowerCase();

    if (!sameProductId && !sameLegacyName) return record;

    return {
      ...record,
      productName: newName,
      updatedAt: now
    };
  });

  const batches = getBatches().map(batch => ({
    ...batch,
    items: (Array.isArray(batch.items) ? batch.items : []).map(item => {
      const sameProductId =
        item.productId && String(item.productId) === id;
      const sameLegacyName =
        !item.productId &&
        String(item.productName || "").trim().toLowerCase() ===
          oldName.toLowerCase();

      if (!sameProductId && !sameLegacyName) return item;

      return {
        ...item,
        productName: newName,
        updatedAt: now
      };
    }),
    updatedAt: now
  }));

  saveProducts(products);
  saveImports(imports);
  saveBatches(batches);

  renderInventoryManagementList();
  renderDashboard();
  renderBatchSuggestions();
  renderBatchList();
  renderBatchProductStockResults();

  showProductRenameMessage(`已编辑：${newName}`);
  return newName;
}

function showProductRenameMessage(message) {
  const element = document.getElementById("googleSyncStatus");
  if (!element) {
    alert(message);
    return;
  }

  const icon = element.querySelector(".dashboard-sync-icon");
  const text = element.querySelector(".dashboard-sync-text");

  element.classList.remove("syncing", "failed");
  element.classList.add("synced");

  if (icon) icon.textContent = "✓";
  if (text) text.textContent = message;

  window.clearTimeout(window.productRenameStatusTimer);
  window.productRenameStatusTimer = window.setTimeout(() => {
    setCloudState("synced");
  }, 2200);
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
  const batches = getBatches();

  const batchByImportNumber = new Map(
    batches
      .filter(batch => String(batch.importNumber || "").trim())
      .map(batch => [
        String(batch.importNumber || "").trim().toLowerCase(),
        batch
      ])
  );

  const products = getProducts()
    // 首页以实际库存为准；避免旧的 inventoryArchived 标记
    // 把删除新批次后仍剩旧库存的产品错误隐藏。
    .filter(product => (Number(product.stock) || 0) > 0)
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
          const batchA = batchByImportNumber.get(
            String(a.importNumber || "").trim().toLowerCase()
          );
          const batchB = batchByImportNumber.get(
            String(b.importNumber || "").trim().toLowerCase()
          );
          const dateA = getImportDisplayDate(a, batchA);
          const dateB = getImportDisplayDate(b, batchB);
          const dateDiff =
            parseDDMMYYYY(dateB) - parseDDMMYYYY(dateA);

          if (dateDiff) return dateDiff;

          return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
        });

      const batchStockMap = new Map();

      matchingImports.forEach(record => {
        const importNumber = String(record.importNumber || "").trim();
        if (!importNumber) return;

        const key = importNumber.toLowerCase();
        const originalQuantity =
          getSafeDisplayOriginalQuantity(record);
        const remainingRaw = Number(
          record.remainingQuantity ?? record.quantity
        );
        const remainingQuantity = Number.isFinite(remainingRaw)
          ? Math.min(
              originalQuantity,
              Math.max(0, Math.floor(remainingRaw))
            )
          : originalQuantity;

        const current = batchStockMap.get(key) || {
          importNumber,
          originalQuantity: 0,
          remainingQuantity: 0
        };

        current.originalQuantity += originalQuantity;
        current.remainingQuantity += remainingQuantity;
        batchStockMap.set(key, current);
      });

      const batchStocks = Array.from(batchStockMap.values())
        .filter(item => item.remainingQuantity > 0);

      const importNumbers = batchStocks
        .map(item => item.importNumber)
        .join(" ");

      const overseasTrackingNumbers = Array.from(
        new Set(
          matchingImports
            .map(record => {
              const relatedBatch = batchByImportNumber.get(
                String(record.importNumber || "")
                  .trim()
                  .toLowerCase()
              );

              return String(
                record.overseasTrackingNumber ||
                relatedBatch?.overseasTrackingNumber ||
                ""
              ).trim();
            })
            .filter(Boolean)
        )
      ).join(" ");

      return {
        ...product,
        importNumbers,
        overseasTrackingNumbers,
        batchStocks,
        latestImportNumber:
          String(batchStocks[0]?.importNumber || matchingImports[0]?.importNumber || "").trim(),
        displayLastImport:
          (() => {
            const latestRecord = matchingImports[0];
            const latestBatch = latestRecord
              ? batchByImportNumber.get(
                  String(latestRecord.importNumber || "")
                    .trim()
                    .toLowerCase()
                )
              : null;

            return (
              getImportDisplayDate(latestRecord, latestBatch) ||
              getLatestImportDateByProduct(product.id) ||
              normalizeDateToDDMMYYYY(product.lastImport) ||
              ""
            );
          })()
      };
    })
    .filter(product => {
      const productTarget =
        `${product.id} ${product.name} ${product.category}`;

      const productMatch =
        smartSearchMatches(productTarget, keyword);

      const importNumberMatch =
        sequentialSearchMatches(product.importNumbers, keyword);

      const overseasTrackingMatch =
        sequentialSearchMatches(
          product.overseasTrackingNumbers,
          keyword
        );

      return (
        productMatch ||
        importNumberMatch ||
        overseasTrackingMatch
      );
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
  if (!products.length) {
    list.innerHTML = '<div class="empty-state">暂无符合的库存资料</div>';
    return;
  }

  list.innerHTML = products.map(product => {
    const stock = Number(product.stock) || 0;
    const averageCost = Number(product.averageCost) || 0;
    const inventoryValue = stock * averageCost;

    return `
      <article class="inventory-manage-card"
               data-product-id="${escapeHTML(product.id)}"
               title="长按可修改产品名称">
        <div class="inventory-manage-head">
          <div>
            <div class="inventory-product-title-row">
              <button
                class="inventory-product-name-copy"
                type="button"
                data-product-name="${escapeHTML(product.name)}"
                onclick="copyInventoryProductName(this)"
                title="点击复制产品名称">
                ${escapeHTML(product.name)}
              </button>
            </div>
            ${product.batchStocks?.length ? `
              <div class="inventory-batch-list">
                ${product.batchStocks.map(batchStock => `
                  <button class="inventory-import-number inventory-batch-number" type="button" data-import-number="${escapeHTML(batchStock.importNumber)}" title="点击复制进口编号">
                    ${escapeHTML(batchStock.importNumber)}
                    <span>${formatNumber(batchStock.originalQuantity)}</span>
                  </button>
                `).join("")}
              </div>
            ` : ""}
            <div class="product-code">${escapeHTML(product.id)} · ${escapeHTML(product.category)}</div>
          </div>
        </div>

        <div class="inventory-summary-grid">
          <div><span>当前库存</span><strong>${formatNumber(stock)}</strong></div>
          <div><span>平均成本</span><strong>${formatMoney(averageCost, "RM ")}</strong></div>
          <div><span>库存成本总值</span><strong>${formatMoney(inventoryValue, "RM ")}</strong></div>
          <div><span>最后进口</span><strong>${escapeHTML(normalizeDateToDDMMYYYY(product.displayLastImport) || "-")}</strong></div>
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
  const rebuildHistoryButton =
    document.getElementById("rebuildHistoryStockBtn");
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

  // 暂时停用，保留原函数以便以后重新开启。
  if (rebuildHistoryButton) {
    rebuildHistoryButton.disabled = true;
  }

  findStaleButton?.addEventListener(
    "click",
    renderStaleZeroStockProducts
  );

  staleList?.addEventListener("change", () => {
    updateStaleDeleteButtonState();
  });

  deleteSelectedButton?.addEventListener(
    "click",
    deleteSelectedStaleZeroStockProducts
  );
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
  const imports = getImports();
  const batches = getBatches();
  const threshold = getThreeMonthsAgoTime();

  return getProducts()
    .filter(product => (Number(product?.stock) || 0) === 0)
    .map(product => ({
      product,
      lastActivityTime:
        getStaleProductActivityTime(product, imports, batches)
    }))
    .filter(item =>
      item.lastActivityTime > 0 &&
      item.lastActivityTime < threshold
    )
    .sort((a, b) =>
      a.lastActivityTime - b.lastActivityTime
    );
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
    showDataToolsStatus("没有超过3个月未进出的零库存产品");
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
            最后进出 ${formatActivityDate(item.lastActivityTime)}
          </small>
        </span>
        <span class="stale-zero-stock-value">库存 0</span>
      </label>
    `;
  }).join("");

  updateStaleDeleteButtonState();
  showDataToolsStatus(
    `已找到 ${formatNumber(staleProducts.length)} 个可清理产品`
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
    document.querySelectorAll(
      ".stale-zero-stock-checkbox:checked"
    )
  ).map(input => String(input.value || "").trim());

  if (!selectedIds.length) return;

  const staleById = new Map(
    getStaleZeroStockProducts().map(item => [
      String(item.product.id || "").trim(),
      item.product
    ])
  );

  const selectedProducts = selectedIds
    .map(id => staleById.get(id))
    .filter(Boolean);

  if (!selectedProducts.length) {
    alert("这些产品已不符合删除条件，请重新检查。");
    renderStaleZeroStockProducts();
    return;
  }

  const typed = window.prompt(
    `危险操作：将永久删除 ${selectedProducts.length} 个产品及所有相关进口资料。\n\n此操作无法还原。请先完成 Backup。\n\n请输入 DELETE 确认：`
  );

  if (typed === null) return;

  if (String(typed).trim() !== "DELETE") {
    alert("输入不正确，已取消删除。");
    return;
  }

  const selectedIdSet = new Set(
    selectedProducts.map(product =>
      String(product.id || "").trim()
    )
  );

  const products = getProducts();
  const imports = getImports();
  const batches = getBatches();
  const now = new Date().toISOString();

  const nextProducts = products.filter(product =>
    !selectedIdSet.has(String(product.id || "").trim())
  );

  const nextImports = imports.filter(record =>
    !selectedProducts.some(product =>
      isSameCleanupProduct(record, product)
    )
  );

  const nextBatches = batches
    .map(batch => {
      const currentItems =
        Array.isArray(batch.items) ? batch.items : [];

      const nextItems = currentItems.filter(item =>
        !selectedProducts.some(product =>
          isSameCleanupProduct(item, product)
        )
      );

      if (!nextItems.length) return null;

      if (nextItems.length === currentItems.length) {
        return batch;
      }

      return {
        ...batch,
        items: nextItems,
        productTypeCount: new Set(
          nextItems.map(item =>
            String(item.productId || item.productName || "")
          )
        ).size,
        totalQuantity: nextItems.reduce(
          (sum, item) =>
            sum + (Number(item.quantity) || 0),
          0
        ),
        updatedAt: now
      };
    })
    .filter(Boolean);

  saveProducts(nextProducts);
  saveImports(nextImports);
  saveBatches(nextBatches);

  renderProductList();
  renderDashboard();
  renderInventoryManagementList();
  renderBatchSuggestions();
  renderBatchList();
  renderBatchProductStockResults();
  renderImportHistory();
  renderStaleZeroStockProducts();

  showDataToolsStatus(
    `已永久删除 ${formatNumber(selectedProducts.length)} 个零库存产品及相关资料`
  );
}

function rebuildAllImportHistoryRemainingFIFO() {
  const products = getProducts();
  const imports = getImports();
  const batches = getBatches();

  if (!products.length || !imports.length) {
    showDataToolsStatus("没有可重建的产品或进口历史。");
    return;
  }

  const confirmed = window.confirm(
    "确认重建历史库存？\n\n" +
    "系统会依据每个产品目前的总库存，按最早进口优先（FIFO）重新分配各进口编号的当前剩余。\n\n" +
    "不会修改：原进口数量、Average Cost、原单价、原每棵成本和进口成本。\n\n" +
    "建议已经完成 Backup 后再继续。"
  );

  if (!confirmed) return;

  const now = new Date().toISOString();
  const nextImports = imports.map(record => ({ ...record }));
  const nextBatches = batches.map(batch => ({
    ...batch,
    items: Array.isArray(batch.items)
      ? batch.items.map(item => ({ ...item }))
      : []
  }));

  const batchById = new Map(
    nextBatches.map(batch => [String(batch.id || ""), batch])
  );
  const batchByImportNumber = new Map(
    nextBatches.map(batch => [
      String(batch.importNumber || "").trim().toLowerCase(),
      batch
    ])
  );

  const originalOf = item =>
    getSafeDisplayOriginalQuantity(item);

  let repairedProducts = 0;
  let repairedRecords = 0;
  const skippedProducts = [];

  products.forEach(product => {
    const productId = String(product.id || "").trim();
    const productName = String(product.name || "").trim().toLowerCase();
    const targetStock = Math.max(0, Math.floor(Number(product.stock) || 0));

    const isSameProduct = item => {
      const sameProductId =
        productId &&
        item?.productId &&
        String(item.productId).trim() === productId;

      const sameLegacyName =
        !sameProductId &&
        productName &&
        String(item?.productName || item?.name || "")
          .trim()
          .toLowerCase() === productName;

      return sameProductId || sameLegacyName;
    };

    const entries = nextImports
      .map((record, index) => ({ record, index }))
      .filter(entry => isSameProduct(entry.record))
      .map(entry => {
        const record = entry.record;
        const batch =
          batchById.get(String(record.batchId || "")) ||
          batchByImportNumber.get(
            String(record.importNumber || "").trim().toLowerCase()
          ) ||
          {};

        const arrivalTime = parseDDMMYYYY(
          record.arrivalDate || batch.arrivalDate || ""
        );
        const containerTime = parseDDMMYYYY(
          record.containerDate || batch.containerDate || ""
        );
        const createdTime = Date.parse(
          record.createdAt || batch.createdAt || ""
        );

        return {
          ...entry,
          batch,
          originalQuantity: originalOf(record),
          sortTime:
            arrivalTime ||
            containerTime ||
            (Number.isFinite(createdTime) ? createdTime : 0),
          importNumber: String(
            record.importNumber || batch.importNumber || ""
          ).trim()
        };
      })
      .sort((a, b) => {
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

    if (!entries.length) return;

    const cumulativeOriginal = entries.reduce(
      (sum, entry) => sum + entry.originalQuantity,
      0
    );

    if (targetStock > cumulativeOriginal) {
      skippedProducts.push(
        `${product.name}：库存 ${formatNumber(targetStock)} > 原进口 ${formatNumber(cumulativeOriginal)}`
      );
      return;
    }

    let quantityToDeduct = cumulativeOriginal - targetStock;
    const remainingByImportIndex = new Map();

    entries.forEach(entry => {
      const deducted = Math.min(
        entry.originalQuantity,
        quantityToDeduct
      );
      const remainingQuantity =
        entry.originalQuantity - deducted;

      quantityToDeduct -= deducted;
      remainingByImportIndex.set(entry.index, remainingQuantity);

      const previousRemaining = Number(
        nextImports[entry.index].remainingQuantity
      );

      if (
        !Number.isFinite(previousRemaining) ||
        previousRemaining !== remainingQuantity ||
        Number(nextImports[entry.index].originalQuantity) !==
          entry.originalQuantity
      ) {
        repairedRecords += 1;
      }

      nextImports[entry.index] = {
        ...nextImports[entry.index],
        originalQuantity: entry.originalQuantity,
        remainingQuantity,
        updatedAt: now
      };
    });

    nextBatches.forEach(batch => {
      const matchingEntries = entries.filter(entry => {
        const sameBatchId =
          batch.id &&
          entry.record.batchId &&
          String(entry.record.batchId) === String(batch.id);

        const sameImportNumber =
          batch.importNumber &&
          String(entry.record.importNumber || "")
            .trim()
            .toLowerCase() ===
          String(batch.importNumber)
            .trim()
            .toLowerCase();

        return sameBatchId || sameImportNumber;
      });

      if (!matchingEntries.length || !Array.isArray(batch.items)) return;

      const unusedEntries = matchingEntries.map(entry => ({
        entry,
        used: false
      }));

      batch.items = batch.items.map(item => {
        if (!isSameProduct(item)) return item;

        const itemProductId = String(item.productId || "").trim();
        const itemName = String(
          item.productName || item.name || ""
        ).trim().toLowerCase();
        const itemCategory = String(item.category || "盆栽");

        const matched = unusedEntries.find(wrapper => {
          if (wrapper.used) return false;
          const record = wrapper.entry.record;

          const sameProductId =
            itemProductId &&
            record.productId &&
            String(record.productId).trim() === itemProductId;

          const sameLegacyIdentity =
            !sameProductId &&
            itemName &&
            String(record.productName || record.name || "")
              .trim()
              .toLowerCase() === itemName &&
            String(record.category || "盆栽") === itemCategory;

          return sameProductId || sameLegacyIdentity;
        });

        if (!matched) return item;

        matched.used = true;

        return {
          ...item,
          originalQuantity: matched.entry.originalQuantity,
          remainingQuantity:
            remainingByImportIndex.get(matched.entry.index),
          updatedAt: now
        };
      });

      batch.updatedAt = now;
    });

    repairedProducts += 1;
  });

  saveImports(nextImports);
  saveBatches(nextBatches);

  renderBatchList();
  renderImportHistory();
  renderInventoryManagementList();
  renderDashboard();

  let message =
    `历史库存重建完成：${formatNumber(repairedProducts)} 个产品，` +
    `${formatNumber(repairedRecords)} 条进口记录已检查或更新。`;

  if (skippedProducts.length) {
    message +=
      ` 有 ${formatNumber(skippedProducts.length)} 个产品未处理，因为当前库存超过累计原进口数量。`;
    console.warn("未重建产品：", skippedProducts);
  }

  showDataToolsStatus(message);
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
  const activeInventoryProducts = products.filter(
    product => (Number(product.stock) || 0) > 0
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
      ["进口编号", "装柜日期", "抵达日期", "产品编号", "产品名称", "类别", "数量", "单价", "货币", "汇率", "货款RM", "每件成本RM", "入库", "成本变化"],
      importRows
    ) +
    excelWorksheet(
      "Batches",
      ["进口编号", "装柜日期", "抵达日期", "运输天数", "产品种类", "总数量", "木架总数", "运输单号", "货币", "汇率", "海外运费RM", "海外运费比例", "进口总成本RM"],
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
    version: "2.63",
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
