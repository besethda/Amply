// === Amply Artist Setup Script (Quick Create Stack Flow) ===

import {
  TEMPLATE_URL,
  AMPLY_ACCOUNT_ID,
  REGION,
  saveConfig, // optional future helper
} from "../../scripts/general.js";

const connectAwsBtn = document.getElementById("connectAwsBtn");
const saveConfigBtn = document.getElementById("saveConfigBtn");
const configStatus = document.getElementById("configStatus");

const RETURN_URL = "https://amply.app/Amply-artist/setup-complete.html"; // 🧭 adjust to your actual URL

// === 1️⃣ Launch AWS Quick Create Stack ===
connectAwsBtn.addEventListener("click", () => {
  const artistInput = document.getElementById("artistName").value.trim();

  if (!artistInput) {
    alert("Please enter your artist name.");
    return;
  }

  const artistDisplay = artistInput;
  const artistId = artistInput.toLowerCase().replace(/[^a-z0-9-]/g, "");

  // store locally so setup-complete page knows who we are
  localStorage.setItem("artistName", artistDisplay);
  localStorage.setItem("artistId", artistId);

  const stackName = `amply-${artistId}`;

  // build the AWS Quick Create link
  const url =
    `https://console.aws.amazon.com/cloudformation/home?region=${REGION}` +
    `#/stacks/quickcreate?templateURL=${encodeURIComponent(TEMPLATE_URL)}` +
    `&stackName=${encodeURIComponent(stackName)}` +
    `&param_ArtistName=${encodeURIComponent(artistId)}` +
    `&param_AmplyAccountId=${encodeURIComponent(AMPLY_ACCOUNT_ID)}` +
    `&param_Region=${encodeURIComponent(REGION)}` +
    `&param_ReturnUrl=${encodeURIComponent(RETURN_URL)}`;

  configStatus.textContent =
    "🌐 Opening AWS CloudFormation... click 'Create Stack' there to continue.";
  window.open(url, "_blank");
});

// === 2️⃣ (Legacy manual entry fallback) Save Configuration Manually ===
saveConfigBtn.addEventListener("click", () => {
  const bucketName = document.getElementById("bucketName").value.trim();
  const roleArn = document.getElementById("roleArn").value.trim();
  const cloudfrontDomain = document
    .getElementById("cloudfrontDomain")
    .value.trim();

  let artistDisplay = localStorage.getItem("artistName") || "";
  let artistId = localStorage.getItem("artistId") || "";

  // derive artistId if not stored
  if (!artistId && bucketName.startsWith("amply-")) {
    artistId = bucketName.split("-")[1] || "unknown";
  }
  if (!artistDisplay) artistDisplay = artistId;

  // basic validation
  if (!bucketName || !roleArn || !cloudfrontDomain) {
    configStatus.textContent = "⚠️ Please fill in all fields.";
    return;
  }

  // save config
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

// === 3️⃣ Optional: Automatic check when redirected back ===
// If the artist returns from AWS with ?stack=<name> param,
// we can auto-poll to detect completion.
window.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const stackName = params.get("stack");
  if (!stackName) return;

  configStatus.textContent = "🔄 Checking AWS stack creation status...";

  const interval = setInterval(async () => {
    try {
      const res = await fetch(
        `${API_URL}/artist-setup/status?stackName=${encodeURIComponent(
          stackName
        )}`
      );
      const data = await res.json();

      if (data.status && data.status !== "CREATE_IN_PROGRESS") {
        clearInterval(interval);
        if (data.status === "CREATE_COMPLETE") {
          const o = data.outputs || {};
          const artistName = localStorage.getItem("artistName");
          const cfg = {
            artistName,
            bucketName: o.ArtistBucket,
            roleArn: o.RoleArn,
            cloudfrontDomain: o.CloudFrontDomain,
          };
          localStorage.setItem("amplyArtistConfig", JSON.stringify(cfg));
          configStatus.textContent =
            "✅ Artist environment created! Redirecting...";
          setTimeout(() => (window.location.href = "upload.html"), 1000);
        } else {
          configStatus.textContent = `❌ Stack ended with status: ${data.status}`;
        }
      }
    } catch (err) {
      console.error(err);
    }
  }, 5000);
});