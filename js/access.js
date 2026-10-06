// V43.1 startup access module: extracted from app.js so password login is ready before the large main app bundle.
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

  // V34.3: bind unlock to this exact history entry on both desktop and mobile.
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

  // V34.3 desktop: if a saved password is still valid, verify locally and enter
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
