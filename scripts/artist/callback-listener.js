/**
 * CALLBACK LISTENER
 * 
 * Runs in setup-complete.html and listens for cloud provider completion callbacks.
 * Once callback is received, automatically completes the setup and redirects to profile.
 */

import { CALLBACK_CONFIG } from "./callback-config.js";
import { saveArtistConfig } from "./general.js";

export class CallbackListener {
  constructor() {
    this.artistId = localStorage.getItem("artistId");
    this.selectedTemplate = localStorage.getItem("selectedTemplate") || "aws";
    this.isListening = false;
    this.callbackReceived = false;
    this.timeoutWarningShown = false;
  }

  /**
   * Start listening for callback messages
   */
  start(onCallbackReceived, onTimeout) {
    if (!this.artistId) {
      console.error("❌ No artist ID found");
      return false;
    }

    this.onCallbackReceived = onCallbackReceived;
    this.onTimeout = onTimeout;
    this.isListening = true;

    // Listen for postMessage from cloud provider callback
    window.addEventListener("message", this.handleMessage.bind(this));

    // Set up timeout warnings
    setTimeout(() => {
      if (!this.callbackReceived && !this.timeoutWarningShown) {
        this.timeoutWarningShown = true;
        if (this.onTimeout) {
          this.onTimeout("warning");
        }
      }
    }, CALLBACK_CONFIG.timeout_warning_ms);

    // Set up hard timeout
    setTimeout(() => {
      if (!this.callbackReceived) {
        this.stop();
        if (this.onTimeout) {
          this.onTimeout("error");
        }
      }
    }, CALLBACK_CONFIG.timeout_error_ms);

    console.log(`🎤 [Callback] Listening for ${this.selectedTemplate} setup completion...`);
    return true;
  }

  /**
   * Handle message events from cloud provider
   */
  handleMessage(event) {
    // Only accept messages from expected origins
    const allowedOrigins = [
      "https://console.aws.amazon.com",
      "https://console.cloud.google.com",
      "https://portal.azure.com",
      window.location.origin // Allow same-origin for testing
    ];

    if (!allowedOrigins.includes(event.origin)) {
      console.warn("⚠️ Message from unknown origin:", event.origin);
      return;
    }

    const payload = event.data;

    // Check for setup completion message
    if (payload?.type === "amply:setup-complete") {
      console.log("✅ [Callback] Received setup completion message:", payload);
      this.handleCallback(payload);
    }
  }

  /**
   * Handle received callback
   */
  async handleCallback(callbackData) {
    if (this.callbackReceived) {
      console.warn("⚠️ Callback already received, ignoring duplicate");
      return;
    }

    this.callbackReceived = true;
    this.stop();

    // Validate the callback payload
    const validation = this.validateCallback(callbackData);
    if (!validation.valid) {
      console.error("❌ Invalid callback:", validation.error);
      if (this.onCallback) {
        this.onCallback({ error: validation.error });
      }
      return;
    }

    try {
      // Save artist config with callback data
      saveArtistConfig({
        artistId: this.artistId,
        provider: this.selectedTemplate,
        ...callbackData.config
      });

      console.log("💾 [Callback] Saved artist config from callback");

      if (this.onCallbackReceived) {
        this.onCallbackReceived(callbackData);
      }
    } catch (err) {
      console.error("❌ Error processing callback:", err);
      if (this.onCallback) {
        this.onCallback({ error: err.message });
      }
    }
  }

  /**
   * Validate callback payload
   */
  validateCallback(payload) {
    if (!payload.artistId || payload.artistId !== this.artistId) {
      return { valid: false, error: "Artist ID mismatch" };
    }

    if (!payload.provider || payload.provider !== this.selectedTemplate) {
      return { valid: false, error: "Provider mismatch" };
    }

    if (!payload.config) {
      return { valid: false, error: "Missing config data" };
    }

    return { valid: true };
  }

  /**
   * Stop listening for callbacks
   */
  stop() {
    this.isListening = false;
    window.removeEventListener("message", this.handleMessage.bind(this));
    console.log("🛑 [Callback] Listener stopped");
  }
}

/**
 * Alternative: Fetch-based callback (for backend-to-backend communication)
 * The cloud provider Lambda/Function sends config directly to Amply API
 */
export async function notifyCallbackComplete(artistId, callbackData) {
  try {
    const response = await fetch("/complete-artist-setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        artistId,
        ...callbackData
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();
    console.log("✅ [API] Callback processed:", result);
    return result;
  } catch (err) {
    console.error("❌ [API] Failed to notify callback:", err);
    throw err;
  }
}
