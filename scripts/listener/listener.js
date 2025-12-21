import { loadSongs, $, requireAuth } from "../general.js";
import { initPlayer, renderSongsToDom } from "../player.js";

requireAuth();

let songs = [];

export async function initHomeView() {
  const root = document.getElementById("viewRoot") || document;
  const trackList = root.querySelector("#trackList");
  const searchBar = root.querySelector("#searchBar");

  if (!trackList) {
    return;
  }

  try {
    songs = await loadSongs();

    renderSongsToDom({
      songs,
      layout: "grid",
      container: "#trackList",
    });

    initPlayer(songs);
  } catch (err) {
    console.error("❌ Failed to load songs:", err);
    trackList.innerHTML = "<p>Could not load songs.</p>";
    return;
  }

  if (searchBar) {
    searchBar.oninput = (e) => {
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
    };
  }
}