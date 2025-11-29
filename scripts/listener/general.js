import { parseJwt } from "../general.js";

// === 🎵 Add "Artist Dashboard" button if user is an artist ===
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

      // Prevent duplicate insertions
      if (document.getElementById("artistDashboardBtn")) return;

      const artistBtn = document.createElement("button");
      artistBtn.id = "artistDashboardBtn";
      artistBtn.textContent = "Artist→";
      artistBtn.className = "logout-btn"; // reuse existing sidebar button styling
      artistBtn.style.marginBottom = "10px";

      artistBtn.addEventListener("click", () => {
        window.location.href = "/artist/dashboard.html";
      });

      // Insert the artist button *above* the logout button
      const logoutBtn = sidebarFooter.querySelector("#logoutBtn");
      sidebarFooter.insertBefore(artistBtn, logoutBtn);
    }
  } catch (err) {
    console.warn("Artist check failed:", err);
  }
});

import { loadAmplyIndex } from "../general.js";

(async function() {
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