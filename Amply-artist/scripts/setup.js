import {
  TEMPLATE_URL,
  AMPLY_ACCOUNT_ID,
  REGION,
  saveConfig,
} from "./general.js";

const connectAwsBtn = document.getElementById("connectAwsBtn");
const saveConfigBtn = document.getElementById("saveConfigBtn");
const configStatus = document.getElementById("configStatus");

// --- 1️⃣ Launch AWS setup ---
connectAwsBtn.addEventListener("click", () => {
  const artistInput = document.getElementById("artistName").value.trim();

  if (!artistInput) {
    alert("Please enter your artist name.");
    return;
  }

  const artistDisplay = artistInput; // keep original capitalization
  const artistId = artistInput.toLowerCase().replace(/[^a-z0-9-]/g, "");

  // ✅ Save both immediately (before opening AWS)
  localStorage.setItem("artistName", artistDisplay);
  localStorage.setItem("artistId", artistId);

  const stackName = `amply-${artistId}`;
  const url = `https://console.aws.amazon.com/cloudformation/home?region=${REGION}#/stacks/quickcreate?templateURL=${encodeURIComponent(
    TEMPLATE_URL
  )}&stackName=${encodeURIComponent(
    stackName
  )}&param_ArtistName=${encodeURIComponent(
    artistId
  )}&param_AmplyAccountId=${encodeURIComponent(
    AMPLY_ACCOUNT_ID
  )}&param_Region=${encodeURIComponent(REGION)}`;

  window.open(url, "_blank");
});

// --- 2️⃣ Save configuration ---
saveConfigBtn.addEventListener("click", () => {
  // Get artist name from localStorage or bucket
  let artistDisplay = localStorage.getItem("artistName") || "";
  let artistId = localStorage.getItem("artistId") || "";

  const bucketName = document.getElementById("bucketName").value.trim();
  const roleArn = document.getElementById("roleArn").value.trim();
  const cloudfrontDomain = document
    .getElementById("cloudfrontDomain")
    .value.trim();

  // 🧩 If the user didn’t provide a name, derive from bucket
  if (!artistId && bucketName.startsWith("amply-")) {
    artistId = bucketName.split("-")[1] || "unknown";
  }

  // 🧩 If no display name, use the ID as a placeholder
  if (!artistDisplay) artistDisplay = artistId;

  if (!bucketName || !roleArn || !cloudfrontDomain) {
    configStatus.textContent = "⚠️ Please fill in all fields.";
    return;
  }

  const config = {
    artistId,
    displayName: artistDisplay,
    bucketName,
    roleArn,
    cloudfrontDomain,
  };

  localStorage.setItem("amplyArtistConfig", JSON.stringify(config));
  localStorage.setItem("artistName", artistDisplay);
  localStorage.setItem("artistId", artistId);

  console.log("✅ Final saved config:", config);
  configStatus.textContent = `✅ Saved as ${artistDisplay}! Redirecting...`;
  setTimeout(() => (window.location.href = "upload.html"), 1000);
});