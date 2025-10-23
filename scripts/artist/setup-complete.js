import { API_URL } from "../general.js";

const setupMessage = document.getElementById("setupMessage");

async function checkStackStatus() {
  const artistId = localStorage.getItem("artistId");

  if (!artistId) {
    setupMessage.textContent = "⚠️ Missing artist info. Please restart setup.";
    return;
  }

  setupMessage.textContent = `Checking AWS environment for ${artistId}…`;

  try {
    const res = await fetch(`${API_URL}/verify-stack?artist=${artistId}`);
    const data = await res.json();

    if (data.status === "CREATE_COMPLETE") {
      setupMessage.textContent = "✅ Environment ready! Redirecting…";
      setTimeout(() => {
        window.location.href = "/Amply-artist/dashboard.html";
      }, 1500);
      return true;
    }

    if (data.status && data.status.includes("FAILED")) {
      setupMessage.textContent = "❌ Setup failed. Please contact support.";
      return true;
    }

    return false; // still creating
  } catch (err) {
    console.error("Error checking stack status:", err);
    setupMessage.textContent = "⚠️ Still waiting for confirmation...";
    return false;
  }
}

// Poll every 10 seconds until ready (max 5 minutes)
let attempts = 0;
const interval = setInterval(async () => {
  const done = await checkStackStatus();
  attempts++;
  if (done || attempts > 30) clearInterval(interval);
}, 10000);

// Initial check immediately
checkStackStatus();