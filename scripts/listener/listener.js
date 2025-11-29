import { loadSongs, $, requireAuth } from "../general.js";
import { initPlayer, renderSongsToDom } from "../player.js";

requireAuth();

const trackList = $("#trackList");
const searchBar = $("#searchBar");

let songs = [];

// ===============================
// LOAD SONGS
// ===============================
window.addEventListener("DOMContentLoaded", async () => {
  try {
    songs = await loadSongs();

    // Default GRID VIEW
    renderSongsToDom({
      songs,
      layout: "grid",
      container: "#trackList",
    });

    // Initialize player with loaded list
    initPlayer(songs);

  } catch (err) {
    console.error("❌ Failed to load songs:", err);
    trackList.innerHTML = "<p>Could not load songs.</p>";
  }
});

// ===============================
// SEARCH BAR FILTER
// ===============================
searchBar.addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase();

  const filtered = songs.filter((s) =>
    s.title.toLowerCase().includes(q) ||
    s.artist.toLowerCase().includes(q) ||
    (s.genre?.join(", ").toLowerCase().includes(q) || false)
  );

  renderSongsToDom({
    songs: filtered,
    layout: "grid",
    container: "#trackList",
  });
});

// ===============================
// ARTIST CLICK HANDLER
// ===============================
document.addEventListener("click", (e) => {
  if (!e.target.classList.contains("go-artist")) return;

  // Works for BOTH grid + list
  const wrapper = e.target.closest("[data-artist]");
  if (!wrapper) return;

  const artist = wrapper.dataset.artist;
  if (!artist) return;

  window.location.href =
    `/listener/artist-profile.html?artist=${encodeURIComponent(artist)}`;
});