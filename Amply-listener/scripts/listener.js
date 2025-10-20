// === DOM ELEMENTS ===
const trackList = $("#trackList");
const playerBar = $("#playerBar");
const currentTrackName = $("#currentTrackName");
const currentTrackArtist = $("#currentTrackArtist");
const playPauseBtn = $("#playPause");
const playIcon = $("#playIcon");
const pauseIcon = $("#pauseIcon");
const progressBar = $("#progressBar");
const searchBar = $("#searchBar");
const audio = $("#globalAudio");
const repeatBtn = $("#repeatBtn");
const shuffleBtn = $("#shuffleBtn");

let currentSong = null;
let songs = [];
let isRepeat = false;
let isShuffle = false;

import { API_URL, loadSongs, $, requireAuth } from "../../scripts/general.js";

requireAuth(); // 🔐 Redirects if not logged in

// === LOAD SONGS ON START ===
window.addEventListener("DOMContentLoaded", async () => {
  try {
    songs = await loadSongs();
    renderSongs(songs);

    // load saved repeat/shuffle states
    if (localStorage.getItem("amplyRepeat") === "true") {
      isRepeat = true;
      repeatBtn.classList.add("active");
    }
    if (localStorage.getItem("amplyShuffle") === "true") {
      isShuffle = true;
      shuffleBtn.classList.add("active");
    }
  } catch (err) {
    console.error("❌ Error loading songs:", err);
    trackList.innerHTML = `<p>Failed to load songs.</p>`;
  }
});



// === RENDER SONG GRID ===
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
      <img src="${song.art_url || "./images/default-art.jpg"}" class="cover-art">
      <div class="song-info">
        <p class="song-title">${song.title}</p>
        <p class="song-artist">${song.artist}</p>
      </div>
      <button class="play-btn">▶</button>
    `;
    div.querySelector(".play-btn").addEventListener("click", () => playSong(song));
    trackList.appendChild(div);
  });
}

// === PLAY SONG ===
async function playSong(song) {
  currentSong = song;
  playerBar.classList.remove("hidden");

  currentTrackName.textContent = `${song.title} – ${song.artist}`;
  currentTrackArtist.textContent = ""; // clear secondary line (optional)

  try {
    const res = await fetch(
      `${API_URL}/stream?bucket=${encodeURIComponent(song.bucket)}&file=${encodeURIComponent(song.file)}`
    );
    const data = await res.json();

    if (!data.streamUrl) throw new Error("Missing stream URL");

    audio.src = data.streamUrl;
    await audio.play();

    playIcon.style.display = "none";
    pauseIcon.style.display = "block";
  } catch (err) {
    console.error("🎵 Stream error:", err);
    alert("Cannot play this track right now.");
  }
}

// === PLAY/PAUSE BUTTON ===
playPauseBtn.addEventListener("click", () => {
  if (!currentSong) return;

  if (audio.paused) {
    audio.play();
    playIcon.style.display = "none";
    pauseIcon.style.display = "block";
  } else {
    audio.pause();
    playIcon.style.display = "block";
    pauseIcon.style.display = "none";
  }
});

// === PROGRESS BAR ===
audio.addEventListener("timeupdate", () => {
  if (audio.duration) {
    progressBar.value = (audio.currentTime / audio.duration) * 100;
  }
});

progressBar.addEventListener("input", () => {
  if (audio.duration) {
    audio.currentTime = (progressBar.value / 100) * audio.duration;
  }
});

// === SEARCH BAR ===
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

// === AUDIO ENDED BEHAVIOR ===
audio.addEventListener("ended", async () => {
  if (isRepeat && currentSong) {
    // 🔁 Repeat the same song
    audio.currentTime = 0;
    await audio.play();
    return;
  }

  if (isShuffle && songs.length > 1) {
    // 🔀 Shuffle mode: play random track
    let nextSong;
    do {
      nextSong = songs[Math.floor(Math.random() * songs.length)];
    } while (nextSong.title === currentSong.title && songs.length > 1);

    playSong(nextSong);
    return;
  }

  // 🛑 Hide player bar if neither repeat nor shuffle
  playerBar.classList.add("hidden");
  audio.pause();
  audio.currentTime = 0;
  playIcon.style.display = "block";
  pauseIcon.style.display = "none";
});

// === REPEAT BUTTON ===
repeatBtn.addEventListener("click", () => {
  isRepeat = !isRepeat;
  repeatBtn.classList.toggle("active", isRepeat);
  localStorage.setItem("amplyRepeat", isRepeat ? "true" : "false");
});

// === SHUFFLE BUTTON ===
shuffleBtn.addEventListener("click", () => {
  isShuffle = !isShuffle;
  shuffleBtn.classList.toggle("active", isShuffle);
  localStorage.setItem("amplyShuffle", isShuffle ? "true" : "false");
});