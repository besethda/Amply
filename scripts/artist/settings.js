import { loadArtistConfig, requireArtistAWS } from "./general.js";
import { logout, loadAmplyIndex } from "../general.js";

window.addEventListener("DOMContentLoaded", async () => {
  requireArtistAWS();
  await displayArtistInfo();
});

document.getElementById("logoutBtn").addEventListener("click", logout);

// Refresh info and credentials from backend
const refreshBtn = document.getElementById("refreshBtn");
refreshBtn.addEventListener("click", async () => {
  try {
    refreshBtn.disabled = true;
    refreshBtn.textContent = "⏳ Refreshing...";
    
    const config = await loadArtistConfig();
    if (config && Object.keys(config).length > 0) {
      console.log("✅ Credentials refreshed:", config);
      localStorage.setItem("amplyArtistConfig", JSON.stringify(config));
      refreshBtn.textContent = "✅ Refreshed!";
      
      // Refresh display
      await displayArtistInfo();
      
      setTimeout(() => {
        refreshBtn.textContent = "🔄 Refresh Info";
        refreshBtn.disabled = false;
      }, 2000);
    } else {
      refreshBtn.textContent = "❌ No credentials found";
      setTimeout(() => {
        refreshBtn.textContent = "🔄 Refresh Info";
        refreshBtn.disabled = false;
      }, 2000);
    }
  } catch (err) {
    console.error("Error refreshing info:", err);
    refreshBtn.textContent = "❌ Error";
    setTimeout(() => {
      refreshBtn.textContent = "🔄 Refresh Info";
      refreshBtn.disabled = false;
    }, 2000);
  }
});

async function displayArtistInfo() {
  try {
    const artistConfig = await loadArtistConfig();
    const artistProfile =
      JSON.parse(localStorage.getItem("amplyArtistProfile") || "{}") || {};

    console.log("🎨 Loaded artist config:", artistConfig);
    console.log("🎭 Loaded artist profile:", artistProfile);

    // 🧩 Fallback merge logic — priority order:
    // profile (public index) > config (private AWS) > local storage
    const artistId =
      artistProfile.artistId || artistConfig.id || localStorage.getItem("artistId") || "N/A";
    const artistName =
      artistProfile.artistName ||
      artistConfig.displayName ||
      artistConfig.artistName ||
      artistId;
    const bucketName =
      artistConfig.bucketName || artistProfile.bucket || "N/A";
    const cloudfrontDomain =
      artistConfig.cloudfrontDomain ||
      artistProfile.cloudfrontDomain ||
      "N/A";
    const region = artistConfig.region || "eu-north-1";

    // 🖼️ Optional visual elements (if your HTML includes them)
    const profileImg = document.getElementById("artistProfilePhoto");
    const coverImg = document.getElementById("artistCoverPhoto");

    if (profileImg && artistProfile.profilePhoto) {
      profileImg.src = artistProfile.profilePhoto;
    }
    if (coverImg && artistProfile.coverPhoto) {
      coverImg.src = artistProfile.coverPhoto;
    }

    // ✅ Populate data fields
    document.getElementById("artistId").textContent = artistId;
    document.getElementById("artistName").textContent = artistName;
    document.getElementById("bucketName").textContent = bucketName;
    document.getElementById("cloudfrontDomain").textContent = cloudfrontDomain;
    document.getElementById("region").textContent = region;

    console.log("✅ Displaying merged artist info:", {
      artistId,
      artistName,
      bucketName,
      cloudfrontDomain,
      region,
    });
  } catch (err) {
    console.error("❌ Error displaying artist info:", err);
    document.getElementById("artistId").textContent = "Error loading info";
    document.getElementById("artistName").textContent = "—";
    document.getElementById("bucketName").textContent = "—";
    document.getElementById("cloudfrontDomain").textContent = "—";
    document.getElementById("region").textContent = "—";
  }
}