import { loadSongs, $, requireAuth } from "../general.js";
import { initPlayer, renderSongsToDom } from "../player.js";

requireAuth();

let songs = [];

export async function initHomeView() {
  const root = document.getElementById("viewRoot") || document;
  const trackList = root.querySelector("#trackList");
  const recentlyListened = root.querySelector("#recentlyListened");
  const recommendedTracks = root.querySelector("#recommendedTracks");
  const searchBar = root.querySelector("#searchBar");

  if (!trackList) {
    return;
  }

  try {
    songs = await loadSongs();

    // Helper function to shuffle array
    const shuffleArray = (arr) => {
      const newArr = [...arr];
      for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
      }
      return newArr;
    };

    // Render Recently Listened (random songs for now)
    if (recentlyListened) {
      const recentSongs = shuffleArray(songs).slice(0, 6);
      renderSongsToDom({
        songs: recentSongs,
        layout: "grid",
        container: "#recentlyListened",
      });
    }

    // Render Recommended (different random songs)
    if (recommendedTracks) {
      const recommendedSongs = shuffleArray(songs).slice(0, 6);
      renderSongsToDom({
        songs: recommendedSongs,
        layout: "grid",
        container: "#recommendedTracks",
      });
    }

    // Render Discover (all songs)
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