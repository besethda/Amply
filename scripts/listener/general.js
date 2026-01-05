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

    // Check if the user is an artist
    if (role === "artist" || groups.includes("artist") || groups.includes("admin")) {

      // 1. Handle the new sidebar menu item (icon only)
      const artistMenuItem = document.getElementById("artistDashboardBtn");
      if (artistMenuItem) {
        artistMenuItem.style.display = "flex"; // Ensure it's visible
        artistMenuItem.addEventListener("click", () => {
          window.location.href = "/artist/dashboard.html";
        });
      }

      // 2. Handle the old footer button (if it still exists or is dynamically added)
      const sidebarFooter = document.querySelector(".sidebar-footer");
      if (sidebarFooter) {
        // Check if we need to add a button here (legacy support or mobile view if needed)
        // For now, we'll assume the menu item is the primary way.
        // If you want to keep the footer button logic, we can leave it, 
        // but ensure it doesn't duplicate if the ID is reused.

        // The previous code created a button with ID "artistDashboardBtn".
        // Since we now have an LI with that ID in the HTML, we should avoid conflict.
        // Let's rename the dynamic button if we still want it, or remove this block if the menu item is sufficient.

        // Given the user request to "make sure the artist icon href is still working",
        // and we added an LI with id="artistDashboardBtn" in the HTML,
        // we should prioritize that LI.
      }
    } else {
      // Hide the menu item if not an artist
      const artistMenuItem = document.getElementById("artistDashboardBtn");
      if (artistMenuItem) {
        artistMenuItem.style.display = "none";
      }
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

// === Sidebar Logic ===
document.addEventListener("DOMContentLoaded", () => {
  const hamburgerBtn = document.getElementById("hamburgerBtn");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");

  if (hamburgerBtn && sidebar && overlay) {
    function toggleSidebar() {
      sidebar.classList.toggle("open");
      overlay.classList.toggle("active");
    }

    function closeSidebar() {
      sidebar.classList.remove("open");
      overlay.classList.remove("active");
    }

    hamburgerBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleSidebar();
    });

    overlay.addEventListener("click", closeSidebar);

    // Close when clicking a menu item
    const menuItems = sidebar.querySelectorAll(".menu li, .menu li a");
    menuItems.forEach(item => {
      item.addEventListener("click", closeSidebar);
    });
  }
});

// === PWA Service Worker Registration ===
// Disabled for now - causing issues with audio streaming on localhost
// if ('serviceWorker' in navigator) {
//   window.addEventListener('load', () => {
//     navigator.serviceWorker.register('/sw.js')
//       .then(registration => {
//         console.log('ServiceWorker registration successful with scope: ', registration.scope);
//       })
//       .catch(err => {
//         console.log('ServiceWorker registration failed: ', err);
//       });
//   });
// }

// === PROFILE MODAL ===
document.addEventListener("DOMContentLoaded", () => {
  const profileIcon = document.getElementById("profileIcon");
  const profileModal = document.getElementById("profileModal");
  const profileBackdrop = document.getElementById("profileBackdrop");
  const closeBtn = document.getElementById("closeProfileModal");
  const tabButtons = document.querySelectorAll(".profile-tab-btn");
  const tabContents = document.querySelectorAll(".profile-tab");

  // Load user data
  const token = localStorage.getItem("amplyIdToken");
  if (token) {
    try {
      const payload = parseJwt(token);
      const username = payload["cognito:username"] || payload["email"] || "User";
      document.getElementById("displayUsername").textContent = username;
    } catch (err) {
      console.error("❌ Error parsing token:", err);
    }
  }

  // Open modal on profile icon click
  if (profileIcon) {
    profileIcon.addEventListener("click", (e) => {
      e.stopPropagation();
      profileModal.classList.remove("hidden");
      profileBackdrop.classList.add("active");
      document.body.classList.add("modal-open");
    });
  }

  // Close modal on close button click
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      profileModal.classList.add("hidden");
      profileBackdrop.classList.remove("active");
      document.body.classList.remove("modal-open");
    });
  }

  // Close modal on backdrop click
  if (profileBackdrop) {
    profileBackdrop.addEventListener("click", (e) => {
      profileModal.classList.add("hidden");
      profileBackdrop.classList.remove("active");
      document.body.classList.remove("modal-open");
    });
  }

  // Tab switching functionality
  tabButtons.forEach(button => {
    button.addEventListener("click", async () => {
      const tabName = button.getAttribute("data-tab");

      // Remove active class from all buttons and contents
      tabButtons.forEach(btn => btn.classList.remove("active"));
      tabContents.forEach(content => content.classList.remove("active"));

      // Add active class to clicked button and corresponding content
      button.classList.add("active");
      const activeTab = document.getElementById(`${tabName}-tab`);
      if (activeTab) {
        activeTab.classList.add("active");
        
        // Load listening stats when stats tab is clicked
        if (tabName === "stats") {
          await loadListeningStats();
        }
        
        // Initialize artist card visibility when settings tab is clicked
        if (tabName === "settings") {
          initializeArtistCard();
        }
      }
    });
  });

  // Initialize artist card on modal open
  initializeArtistCard();
});

// === INITIALIZE ARTIST CARD ===
function initializeArtistCard() {
  const token = localStorage.getItem("amplyIdToken");
  if (!token) return;

  try {
    const payload = parseJwt(token);
    const userRole = payload?.["custom:role"]?.toLowerCase() || "listener";
    const artistCard = document.getElementById("becomeArtistCard");
    const becomeArtistBtn = document.getElementById("becomeArtistBtnModal");

    // Hide artist card if user is already an artist
    if (userRole === "artist" && artistCard) {
      artistCard.style.display = "none";
    } else if (artistCard) {
      artistCard.style.display = "block";
    }

    // Add click handler for become artist button
    if (becomeArtistBtn) {
      becomeArtistBtn.addEventListener("click", () => {
        localStorage.setItem("role", "artist");
        window.location.href = "/artist/setup-template.html";
      });
    }
  } catch (err) {
    console.error("❌ Error initializing artist card:", err);
  }

// === LISTENING STATS ===
async function loadListeningStats() {
  const container = document.getElementById("listeningStatsContainer");
  if (!container) return;

  try {
    container.innerHTML = "<p>Loading your listening history...</p>";

    const response = await fetch(`${API_URL}/user/listening-history`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${localStorage.getItem("amplyIdToken")}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const listens = data.listens || [];

    if (listens.length === 0) {
      container.innerHTML = "<p>No listening history yet. Start playing songs!</p>";
      return;
    }

    // Create listening history HTML
    let html = `
      <div class="listening-history">
        <p class="stats-summary">You have listened to <strong>${listens.length}</strong> songs</p>
        <div class="listening-list">
    `;

    listens.forEach((listen, index) => {
      const date = new Date(listen.timestamp).toLocaleDateString();
      const songId = listen.actualSongId || listen.songId;
      const artist = listen.artistId || 'Unknown';
      
      // Use title if available, otherwise extract from filename
      let songName = listen.title || songId;
      if (!listen.title && songId && typeof songId === 'string') {
        // Remove "songs/" prefix if present
        songName = songId.replace(/^songs\//, '');
        // Remove file extension
        songName = songName.replace(/\.[^.]+$/, '');
      }
      
      html += `
        <div class="listening-item">
          <span class="listen-number">${index + 1}</span>
          <div class="listen-info">
            <p class="song-title">${songName} by ${artist}</p>
            <p class="listen-date">${date}</p>
            <p class="song-cost">$0.99</p>
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;

    container.innerHTML = html;
  } catch (err) {
    console.error("❌ Error loading listening stats:", err);
    container.innerHTML = `<p>Error loading listening history: ${err.message}</p>`;
  }
}
