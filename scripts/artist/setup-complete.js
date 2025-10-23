import { API_URL} from "../general.js";
import { saveArtistConfig} from "./general.js";

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

      saveArtistConfig({
        artistId,
        roleArn: data.roleArn,
        bucketName: data.bucketName,
        cloudfrontDomain: data.cloudfrontDomain,
      });

      setTimeout(() => {
        window.location.href = "/Amply-artist/dashboard.html";
      }, 1500);
      return true;
    }

    if (data.status?.includes("FAILED")) {
      setupMessage.textContent = "❌ Setup failed. Please contact support.";
      return true;
    }

    return false;
  } catch (err) {
    console.error("Error checking stack status:", err);
    setupMessage.textContent = "⚠️ Still waiting for confirmation...";
    return false;
  }
}

let attempts = 0;
const interval = setInterval(async () => {
  const done = await checkStackStatus();
  attempts++;
  if (done || attempts > 30) clearInterval(interval);
}, 10000);

checkStackStatus();