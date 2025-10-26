import { API_URL, loadSongs, $, requireAuth } from "../general.js";
import { playSong, initPlayer } from "../player.js";

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

      <!-- PLAY BUTTON (centered) -->
      <button class="song-play-btn" aria-label="Play or pause">
        <svg class="play-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
          width="40" height="40" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
        <svg class="pause-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
          width="40" height="40" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round" style="display:none">
          <rect x="6" y="4" width="4" height="16"></rect>
          <rect x="14" y="4" width="4" height="16"></rect>
        </svg>
      </button>
    `;

    const btn = div.querySelector(".song-play-btn");
    const playIcon = btn.querySelector(".play-icon");
    const pauseIcon = btn.querySelector(".pause-icon");

    // Click to play or pause
    btn.addEventListener("click", () => {
      // If this song is already playing, toggle pause
      if (window.currentSong && window.currentSong.id === song.id) {
        const audio = document.getElementById("globalAudio");
        if (audio.paused) {
          audio.play();
          playIcon.style.display = "none";
          pauseIcon.style.display = "block";
        } else {
          audio.pause();
          playIcon.style.display = "block";
          pauseIcon.style.display = "none";
        }
        return;
      }

      // Otherwise, play new song
      document.querySelectorAll(".pause-icon").forEach((el) => (el.style.display = "none"));
      document.querySelectorAll(".play-icon").forEach((el) => (el.style.display = "block"));

      playIcon.style.display = "none";
      pauseIcon.style.display = "block";

      playSong(song, songs);
    });

    trackList.appendChild(div);
  });
}

// SEARCH FILTER
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
