import { API_URL, loadSongs, $, requireAuth } from "../general.js";
import { playSong, initPlayer } from "../player.js";

requireAuth();

const trackList = $("#trackList");
const searchBar = $("#searchBar");

let songs = [];

window.addEventListener("DOMContentLoaded", async () => {
  try {
    songs = await loadSongs();
    renderSongBoxes(songs); // default view
    initPlayer(songs);
  } catch (err) {
    console.error("❌ Failed to load songs:", err);
    trackList.innerHTML = "<p>Could not load songs.</p>";
  }
});

function artistPage(artistName) {
  window.location.href =
    `/listener/artist-profile.html?artist=${encodeURIComponent(artistName)}`;
}

// -----------------------------
// BOX VIEW
// -----------------------------
function renderSongBoxes(list) {
  trackList.innerHTML = "";

  if (!list.length) {
    trackList.innerHTML = "<p>No songs available.</p>";
    return;
  }

  list.forEach((song) => {
    const div = document.createElement("div");
    div.className = "song-box";

    div.innerHTML = `
      <img src="${song.art_url || "../images/default-art.jpg"}" class="cover-art" />

      <div class="song-info-box" data-artist="${song.artist}">
        <span class="song-title-box go-artist">${song.title}</span>
        <span class="song-artist-box go-artist">${song.artist}</span>
      </div>

      <button class="song-play-btn-box" aria-label="Play or pause">
        <svg class="play-icon-box" xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24" width="40" height="40"
          fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>

        <svg class="pause-icon-box" xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24" width="40" height="40"
          fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round"
          style="display:none">
          <rect x="6" y="4" width="4" height="16"></rect>
          <rect x="14" y="4" width="4" height="16"></rect>
        </svg>
      </button>
    `;

    setupPlayButton(div, song);
    trackList.appendChild(div);
  });
}

// -----------------------------
// LIST VIEW
// -----------------------------
function renderSongList(list) {
  trackList.innerHTML = "";

  if (!list.length) {
    trackList.innerHTML = "<p>No songs available.</p>";
    return;
  }

  list.forEach((song) => {
    const div = document.createElement("div");
    div.className = "song-box";

    div.innerHTML = `
      <img src="${song.art_url || "../images/default-art.jpg"}" class="cover-art" />

      <div class="song-info" data-artist="${song.artist}">
        <span class="song-title go-artist">${song.title}</span>
        <span class="song-artist go-artist">${song.artist}</span>
      </div>

      <button class="song-play-btn" aria-label="Play or pause">
        <svg class="play-icon" xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24" width="40" height="40"
          fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>

        <svg class="pause-icon" xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24" width="40" height="40"
          fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round"
          style="display:none">
          <rect x="6" y="4" width="4" height="16"></rect>
          <rect x="14" y="4" width="4" height="16"></rect>
        </svg>
      </button>
    `;

    setupPlayButton(div, song);
    trackList.appendChild(div);
  });
}

// -----------------------------
// PLAY BUTTON LOGIC
// -----------------------------
function setupPlayButton(div, song) {
  const btn = div.querySelector("button");
  const playIcon = btn.querySelector(".play-icon, .play-icon-box");
  const pauseIcon = btn.querySelector(".pause-icon, .pause-icon-box");

  btn.addEventListener("click", () => {
    const audio = document.getElementById("globalAudio");

    // If song already playing, toggle pause
    if (window.currentSong && window.currentSong.id === song.id) {
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

    // New song
    document.querySelectorAll(".pause-icon, .pause-icon-box")
      .forEach((el) => (el.style.display = "none"));
    document.querySelectorAll(".play-icon, .play-icon-box")
      .forEach((el) => (el.style.display = "block"));

    playIcon.style.display = "none";
    pauseIcon.style.display = "block";

    playSong(song, songs);
  });
}

// -----------------------------
// SEARCH FILTER
// -----------------------------
searchBar.addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase();
  const filtered = songs.filter(
    (s) =>
      s.title.toLowerCase().includes(q) ||
      s.artist.toLowerCase().includes(q) ||
      s.genre?.join(", ").toLowerCase().includes(q)
  );

  // Pick which layout should update
  renderSongBoxes(filtered); // or renderSongList(filtered);
});

// -----------------------------
// ARTIST CLICK LISTENER (both views)
// -----------------------------
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("go-artist")) {
    const info = e.target.closest(".song-info, .song-info-box");
    const artist = info.dataset.artist;
    artistPage(artist);
  }
});