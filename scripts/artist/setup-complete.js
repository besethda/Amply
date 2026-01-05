import { API_URL} from "../general.js";
import { saveArtistConfig} from "./general.js";
import { CallbackListener } from "./callback-listener.js";

const setupMessage = document.getElementById("setupMessage");
const nextStepMessage = document.getElementById("nextStepMessage");

// Initialize callback listener for automatic setup completion
const callbackListener = new CallbackListener();

callbackListener.start(
  // On callback received
  (callbackData) => {
    setupMessage.textContent = "✅ Setup confirmed! Redirecting to profile…";
    if (nextStepMessage) {
      nextStepMessage.style.display = "block";
      nextStepMessage.textContent = "Your hosting is ready!";
    }
    setTimeout(() => {
      window.location.href = "/artist/setup-profile.html";
    }, 1500);
  },
  // On timeout warning/error
  (stage) => {
    if (stage === "warning") {
      setupMessage.innerHTML += `<br>Taking a while? Check AWS console for status...`;
    } else if (stage === "error") {
      setupMessage.innerHTML += `<br><span style="color: #ff8080;">Callback timeout. Using fallback verification...</span>`;
      // Fall through to polling
      checkStackStatus();
    }
  }
);

async function checkStackStatus() {
  const artistId = localStorage.getItem("artistId");

  if (!artistId) {
    setupMessage.textContent = "⚠️ Missing artist info. Please restart setup.";
    return;
  }

  setupMessage.textContent = `Verifying setup for ${artistId}…`;

  try {
    const res = await fetch(`${API_URL}/verify-stack?artist=${artistId}`);
    const data = await res.json();

    if (data.status === "CREATE_COMPLETE") {
      setupMessage.textContent = "✅ Environment ready! Setting up your profile…";

      saveArtistConfig({
        artistId,
        provider: "aws", // Mark this as AWS-hosted
        roleArn: data.roleArn,
        bucketName: data.bucketName,
        cloudfrontDomain: data.cloudfrontDomain,
      });

      if (nextStepMessage) {
        nextStepMessage.style.display = "block";
        nextStepMessage.textContent = "Redirecting to profile setup...";
      }

      setTimeout(() => {
        window.location.href = "/artist/setup-profile.html";
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
  // Poll for 30 minutes (180 attempts × 10 seconds = 1800 seconds = 30 mins)
  if (done || attempts > 180) {
    clearInterval(interval);
    if (attempts > 180) {
      setupMessage.textContent = "❌ Stack creation timeout (30 mins). Please check your AWS Console.";
    }
  }
}, 10000);

checkStackStatus();