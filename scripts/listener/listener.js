import { loadSongs, $, requireAuth } from "../general.js";
import { initPlayer, renderSongsToDom } from "../player.js";

requireAuth();

const trackList = $("#trackList");
const searchBar = $("#searchBar");

let songs = [];

// ===============================
// INITIAL LOAD
// ===============================
window.addEventListener("DOMContentLoaded", async () => {
  try {
    // Load songs from API
    songs = await loadSongs();

    // Render them in GRID view by default
    renderSongsToDom({
      songs,
      layout: "grid",
      container: "#trackList",
    });

    // Initialize global audio player with loaded songs
    initPlayer(songs);

  } catch (err) {
    console.error("❌ Failed to load songs:", err);
    trackList.innerHTML = "<p>Could not load songs.</p>";
  }
});

// ===============================
// SEARCH BAR FILTER
// ===============================
if (searchBar) {
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
}