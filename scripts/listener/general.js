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

// === Log All Artists (Dev Only) ===
(async function () {
  const index = await loadAmplyIndex();

  if (!index) {
    console.log("No index loaded.");
    return;
  }

  console.log("🎨 All Artists:", index.artists);

  index.artists.forEach(artist => {
    console.log("====== Artist ======");
    console.log("Name:", artist.artistName || artist.name);
    console.log("Bucket:", artist.bucket);
    console.log("Songs:", artist.songs);
  });
})();

const settingsIcon = document.querySelector('.settings')
settingsIcon.addEventListener('click', () => {window.location.href= 'settings.html'})