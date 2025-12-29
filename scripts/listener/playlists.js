import { API_URL, getAuthToken, parseJwt, apiFetch } from "../../scripts/general.js";

/**
 * PLAYLIST MANAGEMENT
 * Create, read, update, delete playlists
 */

// Store playlists in memory for page operations
let userPlaylistsCache = [];

// Get current user from token
function getCurrentUser() {
  const token = getAuthToken();
  if (!token) return null;
  const payload = parseJwt(token);
  return { userId: payload.sub, email: payload.email };
}

// === CREATE PLAYLIST ===
export async function createPlaylist(userId, playlistName, description = "") {
  try {
    const response = await apiFetch(`${API_URL}/playlists`, {
      method: "POST",
      body: JSON.stringify({
        userId,
        playlistName,
        description,
      }),
    });

    console.log("✅ Playlist created:", response);
    return response;
  } catch (err) {
    console.error("❌ Error creating playlist:", err);
    throw err;
  }
}

// === GET ALL PLAYLISTS ===
export async function getUserPlaylists(userId) {
  try {
    const response = await apiFetch(
      `${API_URL}/playlists?userId=${encodeURIComponent(userId)}`
    );

    console.log("📋 User playlists:", response.playlists);
    userPlaylistsCache = response.playlists || [];
    return userPlaylistsCache;
  } catch (err) {
    console.error("❌ Error fetching playlists:", err);
    return [];
  }
}

// === ADD SONG TO PLAYLIST ===
export async function addSongToPlaylist(playlistId, song) {
  const user = getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  try {
    const response = await apiFetch(`${API_URL}/playlists`, {
      method: "PUT",
      body: JSON.stringify({
        userId: user.userId,
        playlistId,
        action: "add",
        song: {
          songId: song.songId,
          songName: song.songName || song.name,
          artistName: song.artistName,
          bucket: song.bucket,
          cloudfrontDomain: song.cloudfrontDomain,
        },
      }),
    });

    console.log("✅ Song added to playlist");
    return response;
  } catch (err) {
    console.error("❌ Error adding song to playlist:", err);
    throw err;
  }
}

// === REMOVE SONG FROM PLAYLIST ===
export async function removeSongFromPlaylist(playlistId, songId) {
  const user = getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  try {
    const response = await apiFetch(`${API_URL}/playlists`, {
      method: "PUT",
      body: JSON.stringify({
        userId: user.userId,
        playlistId,
        action: "remove",
        songId,
      }),
    });

    console.log("✅ Song removed from playlist");
    return response;
  } catch (err) {
    console.error("❌ Error removing song from playlist:", err);
    throw err;
  }
}

// === DELETE PLAYLIST ===
export async function deletePlaylist(playlistId) {
  const user = getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  try {
    const response = await apiFetch(`${API_URL}/playlists`, {
      method: "DELETE",
      body: JSON.stringify({
        userId: user.userId,
        playlistId,
      }),
    });

    console.log("✅ Playlist deleted");
    return response;
  } catch (err) {
    console.error("❌ Error deleting playlist:", err);
    throw err;
  }
}

// === RENDER PLAYLISTS ===
export function renderPlaylists() {
  const grid = document.getElementById("playlistsGrid");
  const emptyState = document.getElementById("emptyState");

  if (!grid) return;

  if (userPlaylistsCache.length === 0) {
    grid.style.display = "none";
    emptyState.style.display = "flex";
    return;
  }

  grid.style.display = "grid";
  emptyState.style.display = "none";

  grid.innerHTML = userPlaylistsCache
    .map((playlist) => createPlaylistCardHTML(playlist))
    .join("");

  // Attach click handlers to cards
  document.querySelectorAll(".playlist-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      // If clicking the edit button, show the detail modal
      if (e.target.closest(".playlist-card-edit-btn")) {
        e.stopPropagation();
        const playlistId = card.dataset.playlistId;
        showPlaylistDetail(playlistId);
        return;
      }
      
      // Otherwise, open the playlist in list view
      const playlistId = card.dataset.playlistId;
      openPlaylistListView(playlistId);
    });
  });
}

// === CREATE PLAYLIST CARD HTML ===
function createPlaylistCardHTML(playlist) {
  const songCount = (playlist.songs || []).length;
  const imageUrls = getPlaylistImageUrls(playlist);

  return `
    <div class="playlist-card" data-playlist-id="${playlist.playlistId}">
      <div class="playlist-cover">
        <div class="cover-box" style="background-image: url('${imageUrls[0]}')"></div>
        <div class="cover-box" style="background-image: url('${imageUrls[1]}')"></div>
        <div class="cover-box" style="background-image: url('${imageUrls[2]}')"></div>
        <button class="playlist-card-edit-btn" title="Edit playlist">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="1"></circle>
            <circle cx="19" cy="12" r="1"></circle>
            <circle cx="5" cy="12" r="1"></circle>
          </svg>
        </button>
      </div>
      <div class="playlist-card-info">
        <div class="playlist-card-name">${escapeHtml(playlist.playlistName)}</div>
        <div class="playlist-card-meta">${songCount} song${songCount !== 1 ? "s" : ""}</div>
      </div>
    </div>
  `;
}

// === GET PLAYLIST IMAGE URLS (3-box overlay) ===
function getPlaylistImageUrls(playlist) {
  // Fallback gradients for empty slots
  const gradients = [
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%23667eea'/%3E%3Cstop offset='100%25' style='stop-color:%23764ba2'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='url(%23g)' width='200' height='200'/%3E%3C/svg%3E",
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%23f093fb'/%3E%3Cstop offset='100%25' style='stop-color:%23f5576c'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='url(%23g)' width='200' height='200'/%3E%3C/svg%3E",
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%234facfe'/%3E%3Cstop offset='100%25' style='stop-color:%2300f2fe'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='url(%23g)' width='200' height='200'/%3E%3C/svg%3E",
  ];

  const songs = playlist.songs || [];
  const urls = [];

  // For each of the 3 cover boxes, get the corresponding song's cover or use fallback
  for (let i = 0; i < 3; i++) {
    if (songs[i] && songs[i].coverImage) {
      urls.push(songs[i].coverImage);
    } else {
      urls.push(gradients[i]);
    }
  }

  return urls;
}

// === OPEN PLAYLIST IN LIST VIEW ===
function openPlaylistListView(playlistId) {
  const playlist = userPlaylistsCache.find((p) => p.playlistId === playlistId);
  if (!playlist) return;

  // Import player functions
  import("./player.js").then(({ initPlayer, renderSongsToDom }) => {
    const root = document.getElementById("viewRoot") || document;
    const mainContent = root.querySelector(".main-content");
    
    if (!mainContent) return;

    // Create list view header
    const header = document.createElement("div");
    header.className = "playlist-view-header";
    header.innerHTML = `
      <button class="btn-back" onclick="window.location.reload()">← Back to Playlists</button>
      <h2>${escapeHtml(playlist.playlistName)}</h2>
      <p>${(playlist.songs || []).length} songs</p>
    `;

    // Clear main content and show playlist songs
    const viewContainer = document.createElement("div");
    viewContainer.id = "playlistViewContainer";
    viewContainer.style.marginLeft = "80px";
    viewContainer.style.padding = "1rem";
    viewContainer.style.color = "white";

    mainContent.innerHTML = "";
    mainContent.appendChild(header);
    mainContent.appendChild(viewContainer);

    // Render songs as playable list
    if (playlist.songs && playlist.songs.length > 0) {
      // Convert stored songs to playable format
      const songs = playlist.songs.map((s) => ({
        songId: s.songId,
        title: s.songName || "Unknown",
        artist: s.artistName || "Unknown Artist",
        file: s.file,
        bucket: s.bucket,
      }));

      renderSongsToDom({
        songs,
        layout: "list",
        container: "#playlistViewContainer",
      });

      initPlayer(songs);
    } else {
      viewContainer.innerHTML = "<p style='color: var(--text-secondary);'>No songs in this playlist yet</p>";
    }
  });
}

// === SHOW PLAYLIST DETAIL ===
function showPlaylistDetail(playlistId) {
  const playlist = userPlaylistsCache.find((p) => p.playlistId === playlistId);
  if (!playlist) return;

  const modal = document.getElementById("playlistDetailModal");
  if (!modal) return;

  // Update modal content
  document.getElementById("detailPlaylistName").textContent = playlist.playlistName;
  document.getElementById("detailPlaylistDesc").textContent = playlist.description || "No description";
  document.getElementById("detailSongCount").textContent = `${(playlist.songs || []).length} songs`;

  // Render cover boxes
  const coverImages = getPlaylistImageUrls(playlist);
  const coverBoxes = document.querySelectorAll("#playlistDetailModal .cover-box");
  coverBoxes.forEach((box, idx) => {
    box.style.backgroundImage = `url('${coverImages[idx]}')`;
  });

  // Render songs list
  const songsList = document.getElementById("playlistSongsList");
  if (playlist.songs && playlist.songs.length > 0) {
    songsList.innerHTML = playlist.songs
      .map(
        (song) => `
      <div class="playlist-song-item">
        <div>
          <div class="song-title">${escapeHtml(song.songName || "Unknown")}</div>
          <div class="song-artist">${escapeHtml(song.artistName || "Unknown Artist")}</div>
        </div>
        <button class="btn-remove-song" data-song-id="${song.songId}" data-playlist-id="${playlistId}">Remove</button>
      </div>
    `
      )
      .join("");

    // Add remove handlers
    document.querySelectorAll(".btn-remove-song").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const songId = btn.dataset.songId;
        const pId = btn.dataset.playlistId;
        await removeSongFromPlaylist(pId, songId);
        await getUserPlaylists(getCurrentUser().userId);
        renderPlaylists();
        showPlaylistDetail(pId); // Re-open detail
      });
    });
  } else {
    songsList.innerHTML = "<p style='color: var(--text-secondary);'>No songs in this playlist yet</p>";
  }

  // Delete playlist button
  const deleteBtn = document.getElementById("deletePlaylistBtn");
  deleteBtn.onclick = async () => {
    await deletePlaylist(playlistId);
    await getUserPlaylists(getCurrentUser().userId);
    renderPlaylists();
    modal.style.display = "none";
  };

  // Close modal button
  const closeBtn = document.getElementById("detailModalClose");
  if (closeBtn) {
    closeBtn.onclick = () => {
      modal.style.display = "none";
    };
  }

  // Show modal
  modal.style.display = "flex";
}

// === UTILITY: ESCAPE HTML ===
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// === EXPORT FOR WINDOW ACCESS (CommonJS compatibility) ===
window.PlaylistManager = {
  createPlaylist,
  getUserPlaylists,
  loadUserPlaylists: getUserPlaylists, // Alias for HTML
  renderPlaylists,
  addSongToPlaylist,
  removeSongFromPlaylist,
  deletePlaylist,
};
