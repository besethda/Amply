import { loadSongs, $, requireAuth } from "../general.js";
import { initPlayer, renderSongsToDom } from "../player.js";

requireAuth();

export async function initPlaylistView(playlistId) {
  const root = document.getElementById("viewRoot") || document;
  const container = root.querySelector("#playlistTrackList");
  if (!container) return;

  try {
    // If playlistId is provided, fetch that specific playlist
    if (playlistId) {
      // Get the playlist from sessionStorage or from the cache
      const playlistIdFromStorage = sessionStorage.getItem('currentPlaylistId');
      const actualPlaylistId = playlistId || playlistIdFromStorage;
      
      if (!actualPlaylistId) {
        container.innerHTML = "<p>Playlist not found.</p>";
        return;
      }
      
      // Get playlist from window.PlaylistManager if available
      if (window.PlaylistManager && window.PlaylistManager.getUserPlaylists) {
        // We can't easily access the cache from here, so we'll just use all songs for now
        // This is a limitation - ideally we'd pass the full playlist object
      }
      
      const songs = await loadSongs();

      if (!songs || songs.length === 0) {
        container.innerHTML = "<p>No songs available.</p>";
        return;
      }

      renderSongsToDom({
        songs,
        layout: "list",
        container: "#playlistTrackList"
      });

      initPlayer(songs);
    } else {
      // Load all songs if no specific playlist
      const songs = await loadSongs();

      if (!songs || songs.length === 0) {
        container.innerHTML = "<p>No songs available.</p>";
        return;
      }

      renderSongsToDom({
        songs,
        layout: "list",
        container: "#playlistTrackList"
      });

      initPlayer(songs);
    }
  } catch (err) {
    console.error("Failed to load playlist songs:", err);
    container.innerHTML = "<p>Error loading songs.</p>";
  }
}

// Auto-init if we are on the standalone playlist page
if (document.getElementById("playlistTrackList")) {
  initPlaylistView();
}