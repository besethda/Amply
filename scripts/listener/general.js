import { API_URL } from "../general.js";
import { parseJwt } from "../general.js";
import { requireAuth } from "../general.js";
import { loadAmplyIndex } from "../general.js";

requireAuth();

// === DOM Helpers ===
export function $(selector, parent = document) {
  return parent.querySelector(selector);
}

// === Load Songs ===
export async function loadSongs() {
  try {
    const res = await fetch(`${API_URL}/songs`);
    if (!res.ok) throw new Error("Failed to load songs");

    const data = await res.json();

    return data.map(s => ({
      ...s,
      id: s.id || s.songId || s.file || s.title
    }));

  } catch (err) {
    console.error("❌ Error loading songs:", err);
    return [];
  }
}

// === Artist Dashboard Button ===
document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("amplyIdToken");
  if (!token) return;

  try {
    const payload = parseJwt(token);
    const groups = payload["cognito:groups"] || [];
    const role = payload["custom:role"] || "";

    if (role === "artist" || groups.includes("artist") || groups.includes("admin")) {
      const sidebarFooter = document.querySelector(".sidebar-footer");
      if (!sidebarFooter) return;
      if (document.getElementById("artistDashboardBtn")) return;

      const artistBtn = document.createElement("button");
      artistBtn.id = "artistDashboardBtn";
      artistBtn.textContent = "Artist→";
      artistBtn.className = "logout-btn";
      artistBtn.style.marginBottom = "10px";

      artistBtn.addEventListener("click", () => {
        window.location.href = "/artist/dashboard.html";
      });

      const logoutBtn = sidebarFooter.querySelector("#logoutBtn");
      sidebarFooter.insertBefore(artistBtn, logoutBtn);
    }
  } catch (err) {
    console.warn("Artist check failed:", err);
  }
});

// === Settings Icon Handler ===
function setupSettingsIcon() {
  const settingsIcon = document.querySelector(".settings");
  if (settingsIcon && !settingsIcon.hasSettingsListener) {
    settingsIcon.addEventListener("click", () => {
      window.location.hash = "settings";
    });
    settingsIcon.hasSettingsListener = true;
  }
}

// Set up initially
document.addEventListener("DOMContentLoaded", setupSettingsIcon);
setupSettingsIcon(); // Also try immediately in case DOM is already ready