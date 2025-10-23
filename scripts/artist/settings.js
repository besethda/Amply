import { loadArtistConfig, requireArtistAWS } from "./general.js";
import { logout } from "../general.js";

window.addEventListener("DOMContentLoaded", async () => {
  requireArtistAWS();
  await displayArtistInfo();
});

document.getElementById("logoutBtn").addEventListener("click", logout);
document.getElementById("refreshBtn").addEventListener("click", displayArtistInfo);

async function displayArtistInfo() {
  const info = await loadArtistConfig();
  if (!info || !info.artistId) {
    console.warn("⚠️ No artist info found.");
    document.getElementById("artistId").textContent = "Not available";
    return;
  }

  document.getElementById("artistId").textContent = info.artistId || "N/A";
  document.getElementById("artistName").textContent = info.displayName || "N/A";
  document.getElementById("bucketName").textContent = info.bucketName || "N/A";
  document.getElementById("cloudfrontDomain").textContent =
    info.cloudfrontDomain || "N/A";
  document.getElementById("region").textContent = info.region || "N/A";
}