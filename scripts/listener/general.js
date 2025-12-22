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
    const menuItems = sidebar.querySelectorAll(".menu li");
    menuItems.forEach(item => {
      item.addEventListener("click", closeSidebar);
    });
  }
});

// === PWA Service Worker Registration ===
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      })
      .catch(err => {
        console.log('ServiceWorker registration failed: ', err);
      });
  });
}
// === PROFILE MODAL ===
document.addEventListener("DOMContentLoaded", () => {
  console.log("🔍 Profile Modal: DOMContentLoaded fired");
  
  const profileIcon = document.getElementById("profileIcon");
  const profileModal = document.getElementById("profileModal");
  const profileBackdrop = document.getElementById("profileBackdrop");
  const closeBtn = document.getElementById("closeProfileModal");
  const tabButtons = document.querySelectorAll(".profile-tab-btn");
  const tabContents = document.querySelectorAll(".profile-tab");

  console.log("🔍 Profile Modal Elements:", {
    profileIcon: profileIcon ? "✅ Found" : "❌ NOT FOUND",
    profileModal: profileModal ? "✅ Found" : "❌ NOT FOUND",
    profileBackdrop: profileBackdrop ? "✅ Found" : "❌ NOT FOUND",
    closeBtn: closeBtn ? "✅ Found" : "❌ NOT FOUND",
    tabButtons: tabButtons.length,
    tabContents: tabContents.length
  });

  // Load user data
  const token = localStorage.getItem("amplyIdToken");
  if (token) {
    try {
      const payload = parseJwt(token);
      const username = payload["cognito:username"] || payload["email"] || "User";
      console.log("✅ Username loaded:", username);
      document.getElementById("displayUsername").textContent = username;
    } catch (err) {
      console.error("❌ Error parsing token:", err);
    }
  }

  // Open modal on profile icon click
  if (profileIcon) {
    profileIcon.addEventListener("click", (e) => {
      console.log("✅ Profile icon clicked");
      e.stopPropagation();
      profileModal.classList.remove("hidden");
      profileBackdrop.classList.add("active");
      document.body.classList.add("modal-open");
      console.log("✅ Modal and backdrop shown");
    });
  } else {
    console.error("❌ profileIcon not found - click listener NOT attached");
  }

  // Close modal on close button click
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      console.log("✅ Close button clicked");
      profileModal.classList.add("hidden");
      profileBackdrop.classList.remove("active");
      document.body.classList.remove("modal-open");
    });
  }

  // Close modal on backdrop click
  if (profileBackdrop) {
    profileBackdrop.addEventListener("click", (e) => {
      console.log("✅ Backdrop clicked");
      profileModal.classList.add("hidden");
      profileBackdrop.classList.remove("active");
      document.body.classList.remove("modal-open");
    });
  }

  // Tab switching functionality
  tabButtons.forEach(button => {
    button.addEventListener("click", () => {
      const tabName = button.getAttribute("data-tab");
      console.log("✅ Tab clicked:", tabName);

      // Remove active class from all buttons and contents
      tabButtons.forEach(btn => btn.classList.remove("active"));
      tabContents.forEach(content => content.classList.remove("active"));

      // Add active class to clicked button and corresponding content
      button.classList.add("active");
      const activeTab = document.getElementById(`${tabName}-tab`);
      if (activeTab) {
        activeTab.classList.add("active");
        console.log("✅ Tab activated:", tabName);
      }
    });
  });

  console.log("🔍 Profile Modal: Setup complete");
});