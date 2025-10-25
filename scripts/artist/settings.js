import { loadArtistConfig, requireArtistAWS } from "./general.js";
import { logout, loadAmplyIndex } from "../general.js";

window.addEventListener("DOMContentLoaded", async () => {
  requireArtistAWS();
  await displayArtistInfo();
});

document.getElementById("logoutBtn").addEventListener("click", logout);
document.getElementById("refreshBtn").addEventListener("click", displayArtistInfo);

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