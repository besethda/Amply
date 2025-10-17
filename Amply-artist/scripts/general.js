export const TEMPLATE_URL =
  "https://amply-templates.s3.eu-north-1.amazonaws.com/artist-environment.yml";
export const AMPLY_ACCOUNT_ID = "596430611327";
export const REGION = "eu-north-1";
export const API_URL = "https://u7q5tko85l.execute-api.eu-north-1.amazonaws.com";

// save and load artist configuration
export function saveConfig(config) {
  localStorage.setItem("amplyArtistConfig", JSON.stringify(config));
}

export function loadConfig() {
  return JSON.parse(localStorage.getItem("amplyArtistConfig") || "{}");
}

// convert a file to base64 string
export function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
}

// redirect to setup page if no config saved yet
export function redirectIfNoConfig() {
  const cfg = loadConfig();
  if (!cfg.bucketName || !cfg.roleArn) {
    alert("⚠️ Please complete setup first.");
    window.location.href = "setup.html";
  }
  return cfg;
}

// ✅ Show connection info or redirect if missing
export function checkArtistConnected({ redirect = true, showBanner = true } = {}) {
  const config = JSON.parse(localStorage.getItem("amplyArtistConfig") || "{}");

  const artistDisplay =
    config.displayName ||
    localStorage.getItem("artistName") ||
    config.artistId ||
    "Unknown Artist";

  const isConnected =
    config && config.bucketName && config.roleArn && config.cloudfrontDomain;

  const banner = document.getElementById("warningBanner");
  const loginInfo = document.getElementById("artistStatus");

  if (isConnected) {
    if (banner) banner.classList.add("hidden");

    if (loginInfo) {
      loginInfo.innerHTML = `
        🎵 Logged in as <strong>${artistDisplay}</strong><br>
      `;
      loginInfo.classList.remove("hidden");
    }

    return true;
  } else {
    if (showBanner && banner) {
      banner.textContent = "⚠️ Please connect your AWS account to continue.";
      banner.classList.remove("hidden");
    }
    if (redirect) {
      setTimeout(() => {
        window.location.href = "setup.html";
      }, 1200);
    }
    return false;
  }
}