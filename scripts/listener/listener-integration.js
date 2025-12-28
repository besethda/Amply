// listener/listener.js - Integration Example

import { requireAuth } from "../../scripts/general.js";
import { initLikeButtons } from "./likes.js";
import { getUserPlaylists } from "./playlists.js";

requireAuth();

// === INITIALIZE LIKE BUTTONS ===
document.addEventListener("DOMContentLoaded", async () => {
  console.log("🎵 Initializing Listener page...");

  // Load user's playlists for later use
  try {
    const playlists = await getUserPlaylists();
    console.log("📋 User playlists:", playlists);
    window.userPlaylists = playlists; // Make available globally
  } catch (err) {
    console.warn("⚠️ Failed to load playlists:", err);
  }

  // Initialize like buttons on all song cards
  try {
    await initLikeButtons();
    console.log("❤️ Like buttons initialized");
  } catch (err) {
    console.warn("⚠️ Failed to initialize like buttons:", err);
  }

  // Add click handlers for "Add to Playlist" buttons
  setupAddToPlaylistButtons();

  // Listen for dynamic content (songs added after page load)
  observeNewSongs();
});

// === ADD TO PLAYLIST HANDLER ===
function setupAddToPlaylistButtons() {
  document.addEventListener("click", async (e) => {
    const target = e.target.closest('[data-action="add-to-playlist"]');
    if (!target) return;

    e.preventDefault();
    e.stopPropagation();

    const songId = target.dataset.songId;
    const songName = target.dataset.songName || "Unknown";
    const artistName = target.dataset.artistName || "Unknown";

    console.log(`📝 Adding "${songName}" to playlist...`);

    const playlists = window.userPlaylists || [];

    // Show playlist selector
    const playlistId = await showPlaylistSelector(playlists, songName);
    if (!playlistId) return; // User cancelled

    // Add song to selected playlist
    try {
      const { addSongToPlaylist } = await import("./playlists.js");
      
      await addSongToPlaylist(playlistId, {
        songId,
        songName,
        artistName,
        bucket: target.dataset.bucket || "unknown",
        cloudfrontDomain: target.dataset.cloudfrontDomain || "unknown",
      });

      // Show success
      target.textContent = "✅ Added";
      target.disabled = true;
      
      setTimeout(() => {
        target.textContent = "+ Playlist";
        target.disabled = false;
      }, 2000);

    } catch (err) {
      console.error("❌ Failed to add song:", err);
      alert("Failed to add to playlist");
    }
  });
}

// === PLAYLIST SELECTOR MODAL ===
async function showPlaylistSelector(playlists, songName) {
  return new Promise((resolve) => {
    // Create modal HTML
    const modal = document.createElement("div");
    modal.className = "playlist-modal";
    modal.innerHTML = `
      <div class="playlist-modal-content">
        <h3>Add to Playlist</h3>
        <p>Adding "<strong>${songName}</strong>" to:</p>
        
        <div class="playlist-list">
          ${playlists
            .map(
              (p) =>
                `<button class="playlist-option" data-playlist-id="${p.playlistId}">
              ${p.playlistName} (${p.songs?.length || 0} songs)
            </button>`
            )
            .join("")}
        </div>
        
        <input 
          type="text" 
          class="new-playlist-input" 
          placeholder="Or create new playlist..."
        />
        
        <div class="modal-actions">
          <button class="btn-secondary btn-cancel">Cancel</button>
          <button class="btn-primary btn-create">Create New</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Handle existing playlist selection
    modal.querySelectorAll(".playlist-option").forEach((btn) => {
      btn.addEventListener("click", () => {
        const playlistId = btn.dataset.playlistId;
        modal.remove();
        resolve(playlistId);
      });
    });

    // Handle create new
    modal.querySelector(".btn-create").addEventListener("click", async () => {
      const name = modal.querySelector(".new-playlist-input").value.trim();
      if (!name) {
        alert("Please enter a playlist name");
        return;
      }

      try {
        const { createPlaylist } = await import("./playlists.js");
        const newPlaylist = await createPlaylist(name);
        modal.remove();
        resolve(newPlaylist.playlistId);
      } catch (err) {
        alert("Failed to create playlist");
        console.error(err);
      }
    });

    // Handle cancel
    modal.querySelector(".btn-cancel").addEventListener("click", () => {
      modal.remove();
      resolve(null);
    });
  });
}

// === OBSERVE DYNAMICALLY ADDED SONGS ===
function observeNewSongs() {
  const observer = new MutationObserver(async (mutations) => {
    let hasNewSongs = false;

    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length) {
        // Check if new song cards were added
        mutation.addedNodes.forEach((node) => {
          if (node.querySelector && node.querySelector('[data-action="like"]')) {
            hasNewSongs = true;
          }
        });
      }
    });

    if (hasNewSongs) {
      console.log("🆕 New songs detected, re-initializing like buttons...");
      const { initLikeButtons } = await import("./likes.js");
      await initLikeButtons();
    }
  });

  observer.observe(document.querySelector(".songs-container") || document.body, {
    childList: true,
    subtree: true,
  });
}

// === EXPORT FOR USE IN OTHER MODULES ===
export { setupAddToPlaylistButtons, showPlaylistSelector };
