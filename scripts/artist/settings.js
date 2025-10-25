import { loadArtistConfig, requireArtistAWS } from "./general.js";
import { logout } from "../general.js";

window.addEventListener("DOMContentLoaded", async () => {
  requireArtistAWS();
  await displayArtistInfo();
});

document.getElementById("logoutBtn").addEventListener("click", logout);
document.getElementById("refreshBtn").addEventListener("click", displayArtistInfo);

async function displayArtistInfo() {
  try {
    const info = await loadArtistConfig();
    console.log("🎨 Loaded artist config:", info);

    // Handle missing or invalid config
    if (!info || (!info.id && !info.email)) {
      console.warn("⚠️ No artist info found or invalid config:", info);
      document.getElementById("artistId").textContent = "Not available";
      document.getElementById("artistName").textContent = "Not available";
      document.getElementById("bucketName").textContent = "Not available";
      document.getElementById("cloudfrontDomain").textContent = "Not available";
      document.getElementById("region").textContent = "Not available";
      return;
    }

    // ✅ Populate data (matching your API field names)
    document.getElementById("artistId").textContent = info.id || "N/A";
    document.getElementById("artistName").textContent = info.displayName || info.id || "N/A";
    document.getElementById("bucketName").textContent = info.bucketName || "N/A";
    document.getElementById("cloudfrontDomain").textContent = info.cloudfrontDomain || "N/A";
    document.getElementById("region").textContent = info.region || "N/A";
  } catch (err) {
    console.error("❌ Error displaying artist info:", err);
    document.getElementById("artistId").textContent = "Error loading info";
  }
}