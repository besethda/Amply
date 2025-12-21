import { loadSongs, $, requireAuth } from "../general.js";
import { initPlayer, renderSongsToDom } from "../player.js";

requireAuth();

export async function initPlaylistView() {
  const root = document.getElementById("viewRoot") || document;
  const container = root.querySelector("#playlistTrackList");
  if (!container) return;

  try {
    const songs = await loadSongs();

    if (!songs || songs.length === 0) {
      console.error("❌ No songs available.");
      container.innerHTML = "<p>No songs available.</p>";
      return;
    }

    renderSongsToDom({
      songs,
      layout: "list",
      container: "#playlistTrackList"
    });

    initPlayer(songs);
  } catch (err) {
    console.error("❌ Failed to load playlist songs:", err);
    container.innerHTML = "<p>Error loading songs.</p>";
  }
}