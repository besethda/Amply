// 💾 Save AWS environment info for artist
export function saveArtistConfig(data) {
  if (!data || !data.artistId) {
    console.error("Missing artist data:", data);
    return;
  }

  const config = {
    artistId: data.artistId,
    roleArn: data.roleArn,
    bucketName: data.bucketName,
    cloudfrontDomain: data.cloudfrontDomain,
    displayName: data.displayName || data.artistId,
  };

  localStorage.setItem("amplyArtistConfig", JSON.stringify(config));
  console.log("💾 Saved artist config:", config);
}

// 🔧 Load artist AWS config from localStorage
export function loadArtistConfig() {
  try {
    const config = JSON.parse(localStorage.getItem("amplyArtistConfig"));
    if (!config) throw new Error("No artist config found");
    return config;
  } catch (err) {
    console.error("❌ loadArtistConfig() failed:", err);
    return {};
  }
}

// ✅ Require AWS setup before allowing access
export function requireArtistAWS({ redirect = true, showBanner = true } = {}) {
  const config = JSON.parse(localStorage.getItem("amplyArtistConfig") || "{}");
  const banner = document.getElementById("warningBanner");
  const status = document.getElementById("artistStatus");

  if (!config.roleArn || !config.bucketName) {
    if (showBanner && banner) {
      banner.textContent = "⚠️ Not connected to AWS — complete setup first.";
      banner.classList.remove("hidden");
    }
    if (redirect) window.location.href = "/artist/setup.html";
    return false;
  }

  if (status) {
    status.textContent = `🎶 Connected as ${config.displayName || config.artistId}`;
    status.classList.remove("hidden");
  }

  if (banner) banner.classList.add("hidden");
  return true;
}