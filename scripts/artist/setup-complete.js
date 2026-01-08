import { API_URL} from "../general.js";
import { saveArtistConfig} from "./general.js";
import { CallbackListener } from "./callback-listener.js";

const setupMessage = document.getElementById("setupMessage");
const nextStepMessage = document.getElementById("nextStepMessage");

// Check if we have infrastructure data already (from setup.js)
const artistConfig = localStorage.getItem("artistConfig");

if (artistConfig) {
  // Infrastructure is already set up, redirect immediately
  const config = JSON.parse(artistConfig);
  
  setupMessage.textContent = "✅ Setup confirmed! Redirecting to profile…";
  if (nextStepMessage) {
    nextStepMessage.style.display = "block";
    nextStepMessage.textContent = "Your hosting is ready!";
  }
  
  // Save to session
  saveArtistConfig(config);
  
  // Redirect to profile setup
  setTimeout(() => {
    window.location.href = "/artist/setup-profile.html";
  }, 1500);
} else {
  // Fallback: Initialize callback listener in case we got redirected from another flow
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
        setupMessage.innerHTML += `<br><span style="color: #ff8080;">Callback timeout. Verify setup completed in AWS console.</span>`;
      }
    }
  );
}