import { loadSongs, $, requireAuth } from "../general.js";
import { renderSongsToDom } from "../player.js";

requireAuth();

(async function () {
  try {
    // Load all songs
    const songs = await loadSongs();

    if (!songs || songs.length === 0) {
      console.error("❌ No songs available.");
      const container = document.querySelector("#playlistTrackList");
      if (container) {
        container.innerHTML = "<p>No songs available.</p>";
      }
      return;
    }

    console.log("🎵 Loaded All Songs:", songs);

    // Render as LIST VIEW
    renderSongsToDom({
      songs,
      layout: "list",
      container: "#playlistTrackList"
    });

  } catch (err) {
    console.error("❌ Failed to load playlist songs:", err);
    const container = document.querySelector("#playlistTrackList");
    if (container) {
      container.innerHTML = "<p>Error loading songs.</p>";
    }
  }
})();