import { API_URL } from "../scripts/general.js";

// ===============================
// DOM ELEMENTS
// ===============================
const audio = document.getElementById("globalAudio");
const playerBar = document.getElementById("playerBar");
const playIcon = document.getElementById("playIcon");
const pauseIcon = document.getElementById("pauseIcon");
const progressBar = document.getElementById("progressBar");
const currentTrackName = document.getElementById("currentTrackName");
const currentTrackArtist = document.getElementById("currentTrackArtist");
const repeatBtn = document.getElementById("repeatBtn");
const shuffleBtn = document.getElementById("shuffleBtn");
const playPauseBtn = document.getElementById("playPause");
const nextBtn = document.getElementById("nextBtn");
const prevBtn = document.getElementById("prevBtn");
const optionsBtn = document.getElementById("optionsBtn");
const optionsMenu = document.getElementById("playerOptionsMenu");

// ===============================
// PLAYER STATE
// ===============================
let isRepeat = false;
let isShuffle = false;
let currentSong = null;
let playlist = [];
let currentIndex = 0;

// ===============================
// INIT PLAYER
// ===============================
export function initPlayer(songs = []) {
  playlist = songs;
  restoreSettings();
  setupEvents();
}

// ===============================
// SYNC ALL PLAY/PAUSE ICONS
// ===============================
function syncPlayerIcons() {
  const isPaused = audio.paused;
  const currentId = window.currentSong?.id;

  // Reset all icons
  document.querySelectorAll(".pause-icon, .pause-icon-box, .pause-icon-list")
    .forEach(el => el.style.display = "none");

  document.querySelectorAll(".play-icon, .play-icon-box, .play-icon-list")
    .forEach(el => el.style.display = "block");

  if (!currentId) return;

  // Activate the correct song card
  const activeCard = document.querySelector(`[data-song-id="${currentId}"]`);
  if (!activeCard) return;

  const btn = activeCard.querySelector("button");
  const cardPlay = btn.querySelector(".play-icon, .play-icon-box, .play-icon-list");
  const cardPause = btn.querySelector(".pause-icon, .pause-icon-box, .pause-icon-list");

  if (isPaused) {
    cardPlay.style.display = "block";
    cardPause.style.display = "none";
  } else {
    cardPlay.style.display = "none";
    cardPause.style.display = "block";
  }
}

// ===============================
// PLAY A SONG
// ===============================
export async function playSong(song, list = playlist) {
  if (!song) return;

  currentSong = song;
  window.currentSong = song;

  playlist = list;
  currentIndex = list.findIndex((s) => s.id === song.id);

  playerBar.classList.remove("hidden");
  currentTrackName.textContent = song.title || "Unknown Track";
  currentTrackArtist.textContent = song.artist || "";
  updateScrollingTitle();

  try {
    let streamUrl = song.url;

    if (!streamUrl && song.bucket && song.file) {
      const res = await fetch(
        `${API_URL}/stream?bucket=${encodeURIComponent(song.bucket)}&file=${encodeURIComponent(song.file)}`
      );
      const data = await res.json();
      streamUrl = data.streamUrl;
    }

    if (!streamUrl) throw new Error("Missing stream URL");

    audio.src = streamUrl;
    await audio.play();

    playIcon.style.display = "none";
    pauseIcon.style.display = "block";

    syncPlayerIcons();

  } catch (err) {
    console.error("❌ Playback error:", err);
    alert("Cannot play this track right now.");
  }
}

// ===============================
// SCROLLING TITLE FIXER
// ===============================
function updateScrollingTitle() {
  const el = currentTrackName;
  el.classList.remove("scrolling");

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (el.scrollWidth > el.clientWidth) el.classList.add("scrolling");
    });
  });
}

// ===============================
// EVENT LISTENERS
// ===============================
function setupEvents() {
  // Play/pause in player bar
  playPauseBtn?.addEventListener("click", () => {
    if (!audio.src) return;

    if (audio.paused) {
      audio.play();
      playIcon.style.display = "none";
      pauseIcon.style.display = "block";
    } else {
      audio.pause();
      playIcon.style.display = "block";
      pauseIcon.style.display = "none";
    }

    syncPlayerIcons();
  });

  // Previous track
  prevBtn?.addEventListener("click", () => {
    if (!playlist.length) return;

    currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    playSong(playlist[currentIndex], playlist);
  });

  // Next track
  nextBtn?.addEventListener("click", () => {
    if (!playlist.length) return;

    if (isShuffle) {
      currentIndex = Math.floor(Math.random() * playlist.length);
    } else {
      currentIndex = (currentIndex + 1) % playlist.length;
    }

    playSong(playlist[currentIndex], playlist);
  });

  // Seek
  progressBar?.addEventListener("input", () => {
    if (audio.duration) {
      audio.currentTime = (progressBar.value / 100) * audio.duration;
    }
  });

  // Repeat toggle
  repeatBtn?.addEventListener("click", () => {
    isRepeat = !isRepeat;
    repeatBtn.classList.toggle("active", isRepeat);
    localStorage.setItem("amplyRepeat", isRepeat);
  });

  // Shuffle toggle
  shuffleBtn?.addEventListener("click", () => {
    isShuffle = !isShuffle;
    shuffleBtn.classList.toggle("active", isShuffle);
    localStorage.setItem("amplyShuffle", isShuffle);
  });

  // Progress bar update
  audio.addEventListener("timeupdate", () => {
    if (audio.duration) {
      progressBar.value = (audio.currentTime / audio.duration) * 100;
    }
  });

  // Song end
  audio.addEventListener("ended", () => {
    handleEnd();
    syncPlayerIcons();
  });

  // Options menu
  optionsBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    optionsMenu.classList.toggle("show");
  });

  document.addEventListener("click", () => {
    optionsMenu.classList.remove("show");
  });

  optionsMenu.addEventListener("click", (e) => e.stopPropagation());

  // Options menu actions
  optionsMenu.querySelectorAll(".option").forEach((opt) => {
    opt.addEventListener("click", () => handleOptionClick(opt.dataset.action));
  });
}

// ===============================
// HANDLE OPTIONS MENU
// ===============================
function handleOptionClick(action) {
  if (!currentSong) return;

  switch (action) {
    case "playlist":
      addToPlaylist(currentSong);
      break;
    case "queue":
      addToQueue(currentSong);
      break;
    case "library":
      addToLibrary(currentSong);
      break;
    case "artist":
      viewArtist(currentSong);
      break;
  }

  optionsMenu.classList.remove("show");
}

// ===============================
// ACTIONS
// ===============================
export function addToPlaylist(song) {
  console.log("📀 Add to playlist:", song);
  alert(`Add "${song.title}" to playlist — coming soon!`);
}

export function addToQueue(song) {
  console.log("⏳ Add to queue:", song);
  alert(`Added "${song.title}" to queue.`);
}

export function addToLibrary(song) {
  console.log("❤️  Add to library:", song);
  alert(`Saved "${song.title}" to your library.`);
}

export function viewArtist(song) {
  const name = encodeURIComponent(song.artist);
  window.location.href = `/listener/artist-profile.html?artist=${name}`;
}

// ===============================
// SONG END LOGIC
// ===============================
function handleEnd() {
  if (isRepeat) {
    audio.currentTime = 0;
    audio.play();
    return;
  }

  if (isShuffle) {
    currentIndex = Math.floor(Math.random() * playlist.length);
    playSong(playlist[currentIndex], playlist);
    return;
  }

  if (currentIndex < playlist.length - 1) {
    currentIndex++;
    playSong(playlist[currentIndex], playlist);
  } else {
    stopPlayback();
  }
}

// ===============================
// RESTORE SETTINGS
// ===============================
function restoreSettings() {
  if (localStorage.getItem("amplyRepeat") === "true") {
    isRepeat = true;
    repeatBtn.classList.add("active");
  }

  if (localStorage.getItem("amplyShuffle") === "true") {
    isShuffle = true;
    shuffleBtn.classList.add("active");
  }
}

// ===============================
// STOP
// ===============================
export function stopPlayback() {
  audio.pause();
  playerBar.classList.add("hidden");
  playIcon.style.display = "block";
  pauseIcon.style.display = "none";
}

// ======================================================
// UNIVERSAL SONG RENDERER
// ======================================================
export function renderSongsToDom({
  songs = [],
  layout = "grid",
  container = "#trackList",
}) {
  const trackList = document.querySelector(container);
  if (!trackList) {
    console.error("❌ Missing container:", container);
    return;
  }

  trackList.innerHTML = "";

  if (!songs.length) {
    trackList.innerHTML = "<p>No songs available.</p>";
    return;
  }

  songs.forEach((song) => {
    const div = document.createElement("div");
    div.dataset.songId = song.id;

    if (layout === "grid") {
      div.className = "song-box";
      div.innerHTML = `
        <img src="${song.art_url || "../images/default-art.jpg"}" class="cover-art" />

        <div class="song-info-box" data-artist="${song.artist}">
          <span class="song-title-box go-artist">${song.title}</span>
          <span class="song-artist-box go-artist">${song.artist}</span>
        </div>

        <button class="song-play-btn-box">
          <svg class="play-icon-box" width="40" height="40"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>

          <svg class="pause-icon-box" width="40" height="40"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            style="display:none">
            <rect x="6" y="4" width="4" height="16"></rect>
            <rect x="14" y="4" width="4" height="16"></rect>
          </svg>
        </button>
      `;
    } else {
      div.className = "song-list";
      div.innerHTML = `
        <img src="${song.art_url || "../images/default-art.jpg"}" class="cover-art" />

        <div class="song-info-list" data-artist="${song.artist}">
          <span class="song-title-list go-artist">${song.title}</span>
          <span class="song-artist-list go-artist">${song.artist}</span>
          <svg
            class="song-option"
            xmlns="http://www.w3.org/2000/svg"
            width="26"
            height="26"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="5" r="1.5"></circle>
            <circle cx="12" cy="12" r="1.5"></circle>
            <circle cx="12" cy="19" r="1.5"></circle>
        </svg>
        </div>

        <button class="song-play-btn-list">
          <svg class="play-icon-list" width="40" height="40"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>

          <svg class="pause-icon-list" width="40" height="40"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            style="display:none">
            <rect x="6" y="4" width="4" height="16"></rect>
            <rect x="14" y="4" width="4" height="16"></rect>
          </svg>
        </button>
      `;
    }

    setupPlayButton(div, song, songs);
    trackList.appendChild(div);
  });
}

// ===============================
// PLAY BUTTON LOGIC PER CARD
// ===============================
function setupPlayButton(div, song, fullList) {
  const btn = div.querySelector("button");

  const playIcon = btn.querySelector(".play-icon, .play-icon-box, .play-icon-list");
  const pauseIcon = btn.querySelector(".pause-icon, .pause-icon-box, .pause-icon-list");

  btn.addEventListener("click", () => {
    // Toggle if already playing
    if (window.currentSong && window.currentSong.id === song.id) {
      if (audio.paused) {
        audio.play();
      } else {
        audio.pause();
      }

      syncPlayerIcons();
      return;
    }

    // Reset icons
    document.querySelectorAll(".pause-icon, .pause-icon-box, .pause-icon-list")
      .forEach(el => el.style.display = "none");

    document.querySelectorAll(".play-icon, .play-icon-box, .play-icon-list")
      .forEach(el => el.style.display = "block");

    playSong(song, fullList);
  });
}