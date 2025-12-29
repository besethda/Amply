import { loadSongs, requireAuth } from "../general.js";
import { initPlayer, renderSongsToDom } from "../player.js";
import { getLikedSongs, initLikeButtons } from "./likes.js";

requireAuth();

export async function initLibraryView() {
  const root = document.getElementById("viewRoot") || document;
  const container = root.querySelector("#playlistTrackList");
  if (!container) return;

  try {
    // Get user's liked songs
    const likedSongs = await getLikedSongs();
    
    if (!likedSongs || likedSongs.length === 0) {
      container.innerHTML = "<p>No liked songs yet. Like songs to add them here!</p>";
      return;
    }

    // Load all songs
    const allSongs = await loadSongs();
    if (!allSongs || allSongs.length === 0) {
      container.innerHTML = "<p>No songs available.</p>";
      return;
    }

    // Filter to get liked songs with full metadata
    // The backend returns {songId, artistId}, so we match by songId
    const likedSongIds = new Set(likedSongs.map(s => s.songId));
    const songs = allSongs.filter(s => likedSongIds.has(s.songId || s.file));

    if (songs.length === 0) {
      container.innerHTML = "<p>No liked songs found.</p>";
      return;
    }

    // Render in list view
    renderSongsToDom({
      songs,
      layout: "list",
      container: "#playlistTrackList"
    });

    // Initialize player with liked songs
    initPlayer(songs);

    // Initialize like buttons
    await initLikeButtons();
  } catch (err) {
    console.error("Failed to load library:", err);
    container.innerHTML = "<p>Error loading liked songs.</p>";
  }
}

// Auto-init if we are on the library page
if (document.getElementById("playlistTrackList")) {
  initLibraryView();
}
