// === MY SONGS SCRIPT (Artist Dashboard) ===
// Fetch, display, and manage uploaded songs

import { API_URL, logout } from "../general.js";
import { requireArtistAWS, loadArtistConfig } from "./general.js";

// ===== DOM ELEMENTS =====
const songsList = document.getElementById("songsList");
const emptyState = document.getElementById("emptyState");
const statusMessage = document.getElementById("status");
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");
const deleteModal = document.getElementById("deleteModal");
const deleteModalSongName = document.getElementById("deleteModalSongName");
const deleteCancelBtn = document.getElementById("deleteCancelBtn");
const deleteConfirmBtn = document.getElementById("deleteConfirmBtn");
const logoutBtn = document.getElementById("logoutBtn");
const filterBubbles = document.querySelectorAll(".filter-bubble");

let allSongs = [];
let selectedSongToDelete = null;
let currentFilter = "all";

// ===== INIT =====
window.addEventListener("DOMContentLoaded", () => {
  requireArtistAWS();
  loadSongs();
  setupEventListeners();
});

if (logoutBtn) logoutBtn.addEventListener("click", logout);

// ===== EVENT LISTENERS =====
function setupEventListeners() {
  searchInput.addEventListener("input", filterAndSortSongs);
  sortSelect.addEventListener("change", filterAndSortSongs);
  deleteCancelBtn.addEventListener("click", closeDeleteModal);
  deleteConfirmBtn.addEventListener("click", confirmDelete);
  
  // Filter bubble listeners
  filterBubbles.forEach(bubble => {
    bubble.addEventListener("click", (e) => {
      filterBubbles.forEach(b => b.classList.remove("active"));
      e.target.classList.add("active");
      currentFilter = e.target.dataset.filter;
      filterAndSortSongs();
    });
  });
}

// ===== LOAD SONGS =====
async function loadSongs() {
  try {
    statusMessage.innerHTML = `<span style="color:#8df;">Loading songs...</span>`;

    const config = await loadArtistConfig();
    if (!config?.roleArn || !config?.bucketName) {
      statusMessage.textContent = "❌ Missing AWS config. Please reconnect your artist account.";
      return;
    }

    const artistId = config.artistId || localStorage.getItem("artistId");

    // Fetch the artist's songs from the central index
    const res = await fetch(`${API_URL}/get-artist-songs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        artistId,
        cloudfrontDomain: config.cloudfrontDomain,
        bucketName: config.bucketName,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to fetch songs: ${errText}`);
    }

    const data = await res.json();
    allSongs = data.songs || [];

    if (allSongs.length === 0) {
      statusMessage.textContent = "";
      songsList.classList.add("hidden");
      emptyState.classList.remove("hidden");
    } else {
      statusMessage.textContent = "";
      emptyState.classList.add("hidden");
      songsList.classList.remove("hidden");
      filterAndSortSongs();
    }
  } catch (err) {
    console.error("❌ Error loading songs:", err);
    statusMessage.innerHTML = `❌ Error: ${err.message}`;
  }
}

// ===== FILTER AND SORT =====
function filterAndSortSongs() {
  const searchTerm = searchInput.value.toLowerCase();
  const sortBy = sortSelect.value;

  let filtered = allSongs.filter(song => {
    // Text search
    const matchesSearch = 
      song.title.toLowerCase().includes(searchTerm) ||
      (song.artist && song.artist.toLowerCase().includes(searchTerm)) ||
      (song.album && song.album.toLowerCase().includes(searchTerm));
    
    if (!matchesSearch) return false;

    // Type filter
    if (currentFilter === "all") return true;
    
    const songType = song.type || "songs"; // Default to "songs" if not specified
    return songType === currentFilter;
  });

  // Sort
  filtered.sort((a, b) => {
    switch (sortBy) {
      case "oldest":
        return new Date(a.uploaded_at) - new Date(b.uploaded_at);
      case "name-asc":
        return a.title.localeCompare(b.title);
      case "name-desc":
        return b.title.localeCompare(a.title);
      case "newest":
      default:
        return new Date(b.uploaded_at) - new Date(a.uploaded_at);
    }
  });

  renderSongs(filtered);
}

// ===== RENDER SONGS =====
function renderSongs(songs) {
  songsList.innerHTML = "";

  songs.forEach(song => {
    const card = document.createElement("div");
    card.className = "song-card";
    card.dataset.songId = song.id || song.file;

    // Cover Art
    const cover = document.createElement("img");
    cover.className = "song-cover";
    cover.src = song.art_url || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cdefs%3E%3ClinearGradient id='grad' x1='0%' y1='0%' x2='100%' y2='100%'%3E%3Cstop offset='0%' style='stop-color:%23667eea;stop-opacity:1' /%3E%3Cstop offset='100%' style='stop-color:%23764ba2;stop-opacity:1' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='200' height='200' fill='url(%23grad)'/%3E%3C/svg%3E";

    // Info
    const info = document.createElement("div");
    info.className = "song-info";

    const title = document.createElement("p");
    title.className = "song-title";
    title.textContent = song.title;

    const artist = document.createElement("p");
    artist.className = "song-artist";
    artist.textContent = song.artist || "Unknown Artist";

    const meta = document.createElement("div");
    meta.className = "song-meta";
    const uploadDate = new Date(song.uploaded_at).toLocaleDateString();
    meta.textContent = `Uploaded ${uploadDate}`;

    if (song.album) {
      const album = document.createElement("div");
      album.className = "song-meta";
      album.textContent = `Album: ${song.album}`;
      info.appendChild(album);
    }

    info.appendChild(title);
    info.appendChild(artist);
    info.appendChild(meta);

    // Actions
    const actions = document.createElement("div");
    actions.className = "song-actions";

    const playBtn = document.createElement("button");
    playBtn.className = "song-btn";
    playBtn.textContent = "Play";
    playBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      playSong(song);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "song-btn song-delete-btn";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openDeleteModal(song);
    });

    actions.appendChild(playBtn);
    actions.appendChild(deleteBtn);

    card.appendChild(cover);
    card.appendChild(info);
    card.appendChild(actions);
    songsList.appendChild(card);
  });
}

// ===== PLAY SONG =====
function playSong(song) {
  let audioEl = document.getElementById("globalAudio");
  if (!audioEl) {
    audioEl = document.createElement("audio");
    audioEl.id = "globalAudio";
    audioEl.controls = true;
    audioEl.style.position = "fixed";
    audioEl.style.bottom = "20px";
    audioEl.style.right = "20px";
    audioEl.style.zIndex = "999";
    document.body.appendChild(audioEl);
  }

  audioEl.src = `https://${loadArtistConfig().cloudfrontDomain}/${song.file}`;
  audioEl.play().catch(err => {
    console.error("Play error:", err);
    statusMessage.textContent = "❌ Could not play song";
  });
}

// ===== DELETE MODAL =====
function openDeleteModal(song) {
  selectedSongToDelete = song;
  deleteModalSongName.textContent = song.title;
  deleteModal.classList.remove("hidden");
}

function closeDeleteModal() {
  deleteModal.classList.add("hidden");
  selectedSongToDelete = null;
}

async function confirmDelete() {
  if (!selectedSongToDelete) return;

  try {
    deleteConfirmBtn.disabled = true;
    deleteConfirmBtn.textContent = "Deleting...";
    deleteConfirmBtn.disabled = true;

    const config = loadArtistConfig();
    const artistId = config.artistId || localStorage.getItem("artistId");

    const requestBody = {
      artistId,
      songId: selectedSongToDelete.id || selectedSongToDelete.file,
      songFile: selectedSongToDelete.file,
      artFile: selectedSongToDelete.art_url ? selectedSongToDelete.art_url.split("/").pop() : null,
      artistRoleArn: config.roleArn,
      bucketName: config.bucketName,
    };
    
    console.log("🗑️ Delete request body:", requestBody);
    console.log("📝 Config loaded:", config);

    const res = await fetch(`${API_URL}/delete-song`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to delete song: ${errText}`);
    }

    const messageContent = `✅ Deleted "<strong>${selectedSongToDelete.title}</strong>" successfully!`;
    const songId = selectedSongToDelete.id || selectedSongToDelete.file;
    closeDeleteModal();
    statusMessage.innerHTML = messageContent;
    deleteConfirmBtn.disabled = false;
    deleteConfirmBtn.textContent = "Delete";
    
    // Remove from local array and re-render
    allSongs = allSongs.filter(s => (s.id || s.file) !== songId);
    
    if (allSongs.length === 0) {
      songsList.classList.add("hidden");
      emptyState.classList.remove("hidden");
      statusMessage.textContent = "";
    } else {
      filterAndSortSongs();
    }

    // Clear message after 3 seconds
    setTimeout(() => {
      statusMessage.textContent = "";
    }, 3000);
  } catch (err) {
    console.error("❌ Delete error:", err);
    statusMessage.innerHTML = `❌ Error: ${err.message}`;
    deleteConfirmBtn.disabled = false;
    deleteConfirmBtn.textContent = "Delete";
  }
}
