import { API_URL, loadSongs, $, requireAuth } from "../../scripts/general.js";
import { playSong, initPlayer } from "./player.js";

requireAuth();

const trackList = $("#trackList");
const searchBar = $("#searchBar");

let songs = [];

window.addEventListener("DOMContentLoaded", async () => {
  try {
    songs = await loadSongs();
    renderSongs(songs);
    initPlayer(songs);
  } catch (err) {
    console.error("❌ Failed to load songs:", err);
    trackList.innerHTML = "<p>Could not load songs.</p>";
  }
});

function renderSongs(list) {
  trackList.innerHTML = "";
  if (!list.length) {
    trackList.innerHTML = `<p>No songs available.</p>`;
    return;
  }

  list.forEach((song) => {
    const div = document.createElement("div");
    div.className = "song-box";
    div.innerHTML = `
      <img src="${song.art_url || "../images/default-art.jpg"}" class="cover-art" />
      <div class="song-info">
        <p class="song-title">${song.title}</p>
        <p class="song-artist">${song.artist}</p>
      </div>
      <button class="play-btn">▶</button>
    `;
    div.querySelector(".play-btn").addEventListener("click", () => playSong(song, songs));
    trackList.appendChild(div);
  });
}

searchBar.addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase();
  const filtered = songs.filter(
    (s) =>
      s.title.toLowerCase().includes(q) ||
      s.artist.toLowerCase().includes(q) ||
      s.genre?.join(", ").toLowerCase().includes(q)
  );
  renderSongs(filtered);
});