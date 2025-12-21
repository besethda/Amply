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
const currentTrackArt = document.getElementById("currentTrackArt");
const repeatBtn = document.getElementById("repeatBtn");
const shuffleBtn = document.getElementById("shuffleBtn");
const playPauseBtn = document.getElementById("playPause");
const nextBtn = document.getElementById("nextBtn");
const prevBtn = document.getElementById("prevBtn");
const optionsBtn = document.getElementById("optionsBtn");
const optionsMenu = document.getElementById("playerOptionsMenu");

// Full Player Elements
const fullPlayer = document.getElementById("fullPlayer");
const closeFullPlayerBtn = document.getElementById("closeFullPlayer");
const fullPlayerArt = document.getElementById("fullPlayerArt");
const fullPlayerTitle = document.getElementById("fullPlayerTitle");
const fullPlayerArtist = document.getElementById("fullPlayerArtist");
const fullProgressBar = document.getElementById("fullProgressBar");
const fullCurrentTime = document.getElementById("fullCurrentTime");
const fullTotalTime = document.getElementById("fullTotalTime");
const fullPlayPauseBtn = document.getElementById("fullPlayPauseBtn");
const fullPlayIcon = document.getElementById("fullPlayIcon");
const fullPauseIcon = document.getElementById("fullPauseIcon");
const fullNextBtn = document.getElementById("fullNextBtn");
const fullPrevBtn = document.getElementById("fullPrevBtn");
const fullShuffleBtn = document.getElementById("fullShuffleBtn");
const fullRepeatBtn = document.getElementById("fullRepeatBtn");

// ===============================
// PLAYER STATE
// ===============================
let isRepeat = false;
let isShuffle = false;
let currentSong = null;
let playlist = [];
let currentIndex = 0;
let eventsBound = false;

// ===============================
// INIT PLAYER
// ===============================
export function initPlayer(songs = []) {
  if (songs?.length) {
    playlist = songs.map((s) => ({
      ...s,
      id: s.id || s.songId || s.file || s.title,
    }));
  }

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
  document
    .querySelectorAll(".pause-icon, .pause-icon-box, .pause-icon-list")
    .forEach((el) => (el.style.display = "none"));

  document
    .querySelectorAll(".play-icon, .play-icon-box, .play-icon-list")
    .forEach((el) => (el.style.display = "block"));

  if (!currentId) return;

  // Activate the correct song card
  const safeSelector = CSS.escape(currentId);
  const activeCard = document.querySelector(`[data-song-id="${safeSelector}"]`);
  if (!activeCard) return;

  const btn = activeCard.querySelector("button");
  if (!btn) return;

  const cardPlay = btn.querySelector(
    ".play-icon, .play-icon-box, .play-icon-list"
  );
  const cardPause = btn.querySelector(
    ".pause-icon, .pause-icon-box, .pause-icon-list"
  );

  if (!cardPlay || !cardPause) return;

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

  const safeId = song.id || song.songId || song.file || song.title;

  // Apply normalized ID to the current song
  currentSong = { ...song, id: safeId };
  window.currentSong = currentSong;

  // Normalize playlist IDs before comparing
  playlist = list.map(s => ({
    ...s,
    id: s.id || s.songId || s.file || s.title
  }));

  currentIndex = playlist.findIndex((s) => s.id === safeId);

  playerBar.classList.remove("hidden");
  currentTrackName.textContent = currentSong.title || "Unknown Track";
  currentTrackArtist.textContent = currentSong.artist || "";
  if (currentTrackArt) {
    currentTrackArt.src = currentSong.art_url || "../images/default-art.jpg";
  }
  updateScrollingTitle();
  updateFullPlayerUI();

  try {
    let streamUrl = song.url;

    if (!streamUrl && song.bucket && song.file) {
      const res = await fetch(
        `${API_URL}/stream?bucket=${encodeURIComponent(
          song.bucket
        )}&file=${encodeURIComponent(song.file)}`
      );
      const data = await res.json();
      streamUrl = data.streamUrl;
    }

    if (!streamUrl) throw new Error("Missing stream URL");

    audio.src = streamUrl;
    await audio.play();

    // Update main player bar icons
    playIcon.style.display = "none";
    pauseIcon.style.display = "block";
    updateFullPlayerPlayPause(true);

    // Update all cards
    syncPlayerIcons();
  } catch (err) {
    console.error("❌ Playback error:", err);
    alert("Cannot play this track right now.");
  }
}

// =======================================
// OPEN ARTIST PROFILE WHEN CLICKING NAMES
// =======================================
document.addEventListener("click", (e) => {
  if (!e.target.classList.contains("go-artist")) return;

  const wrapper = e.target.closest("[data-artist]");
  if (!wrapper) return;

  const artist = wrapper.dataset.artist;
  if (!artist) return;

  window.location.hash = `artist:${encodeURIComponent(artist)}`;
});

// ===============================
// SCROLLING TITLE FIXER
// ===============================
function updateScrollingTitle() {
  const el = currentTrackName;
  const container = el.parentElement; // .track-name-container

  el.classList.remove("scrolling");
  el.style.removeProperty("--scroll-distance");

  // Wait for layout
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      // Check if text is wider than the container
      if (el.offsetWidth > container.clientWidth) {
        const distance = el.offsetWidth - container.clientWidth;
        el.style.setProperty("--scroll-distance", `-${distance}px`);
        el.classList.add("scrolling");
      }
    });
  });
}

// Listen for resize to re-check scrolling
window.addEventListener("resize", () => {
  if (currentSong) updateScrollingTitle();
});

// ===============================
// EVENT LISTENERS
// ===============================
function setupEvents() {
  if (eventsBound) return;
  if (!audio) {
    console.warn("⚠️ globalAudio element missing; player controls disabled.");
    return;
  }

  eventsBound = true;

  // Global Spacebar Play/Pause
  document.addEventListener("keydown", (e) => {
    // Ignore if typing in an input or textarea
    if (["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;

    if (e.code === "Space") {
      // Only prevent scrolling if we actually have a song to control
      if (audio.src) {
        e.preventDefault(); 
        if (audio.paused) {
          audio.play();
        } else {
          audio.pause();
        }
      }
    }
  });

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
      const progress = (audio.currentTime / audio.duration) * 100;
      if (progressBar) progressBar.value = progress;
      if (fullProgressBar) fullProgressBar.value = progress;
      
      // Update time stamps
      if (fullCurrentTime) fullCurrentTime.textContent = formatTime(audio.currentTime);
      if (fullTotalTime) fullTotalTime.textContent = formatTime(audio.duration);
    }
  });

  // Song end
  audio.addEventListener("ended", () => {
    handleEnd();
    syncPlayerIcons();
  });

  audio.addEventListener("play", () => {
    playIcon.style.display = "none";
    pauseIcon.style.display = "block";
    updateFullPlayerPlayPause(true);
    syncPlayerIcons();
  });

  audio.addEventListener("pause", () => {
    playIcon.style.display = "block";
    pauseIcon.style.display = "none";
    updateFullPlayerPlayPause(false);
    syncPlayerIcons();
  });

  // Options menu
  optionsBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    optionsMenu?.classList.toggle("show");
  });

  document.addEventListener("click", () => {
    optionsMenu?.classList.remove("show");
  });

  optionsMenu?.addEventListener("click", (e) => e.stopPropagation());

  // Options menu actions
  optionsMenu?.querySelectorAll(".option").forEach((opt) => {
    opt.addEventListener("click", () => handleOptionClick(opt.dataset.action));
  });

  setupFullPlayerEvents();
}

// ===============================
// FULL PLAYER LOGIC
// ===============================
function setupFullPlayerEvents() {
  // Open Full Player
  playerBar?.addEventListener("click", (e) => {
    // Don't open if clicking buttons or progress bar
    if (e.target.closest("button") || e.target.closest("input")) return;
    
    // Only open in portrait mode (mobile)
    if (!window.matchMedia("(orientation: portrait)").matches) return;

    fullPlayer.classList.remove("hidden");
    updateFullPlayerUI();
  });

  // Close Full Player
  closeFullPlayerBtn?.addEventListener("click", () => {
    fullPlayer.classList.add("hidden");
  });

  // Full Player Controls
  fullPlayPauseBtn?.addEventListener("click", () => {
    if (audio.paused) {
      audio.play();
    } else {
      audio.pause();
    }
  });

  fullNextBtn?.addEventListener("click", () => nextBtn?.click());
  fullPrevBtn?.addEventListener("click", () => prevBtn?.click());
  
  fullShuffleBtn?.addEventListener("click", () => {
    shuffleBtn?.click();
    fullShuffleBtn.classList.toggle("active", isShuffle);
  });
  
  fullRepeatBtn?.addEventListener("click", () => {
    repeatBtn?.click();
    fullRepeatBtn.classList.toggle("active", isRepeat);
  });

  // Full Progress Bar
  fullProgressBar?.addEventListener("input", () => {
    if (audio.duration) {
      audio.currentTime = (fullProgressBar.value / 100) * audio.duration;
    }
  });

  // Close on orientation change to landscape
  window.addEventListener("resize", () => {
    if (!window.matchMedia("(orientation: portrait)").matches) {
      fullPlayer.classList.add("hidden");
    }
  });
}

function updateFullPlayerUI() {
  if (!currentSong) return;

  fullPlayerTitle.textContent = currentSong.title || "Unknown Track";
  fullPlayerArtist.textContent = currentSong.artist || "";
  fullPlayerArt.src = currentSong.art_url || "../images/default-art.jpg";
  
  updateFullPlayerPlayPause(!audio.paused);
  
  // Sync shuffle/repeat state
  fullShuffleBtn?.classList.toggle("active", isShuffle);
  fullRepeatBtn?.classList.toggle("active", isRepeat);
}

function updateFullPlayerPlayPause(isPlaying) {
  if (isPlaying) {
    fullPlayIcon.style.display = "none";
    fullPauseIcon.style.display = "block";
  } else {
    fullPlayIcon.style.display = "block";
    fullPauseIcon.style.display = "none";
  }
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

  optionsMenu?.classList.remove("show");
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
  window.location.hash = `artist:${name}`;
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
    repeatBtn?.classList.add("active");
  }

  if (localStorage.getItem("amplyShuffle") === "true") {
    isShuffle = true;
    shuffleBtn?.classList.add("active");
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

  const currentSongId = window.currentSong?.id;
  const isPaused = audio.paused;

  songs.forEach((song) => {
    const div = document.createElement("div");
    const safeId = song.id || song.songId || song.file || song.title;
    div.dataset.songId = safeId;  

    // Check if this song is currently playing
    const isCurrentlyPlaying = currentSongId === safeId && !isPaused;
    const isCurrentSong = currentSongId === safeId;

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
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            style="display:${isCurrentlyPlaying ? 'none' : 'block'}">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>

          <svg class="pause-icon-box" width="40" height="40"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            style="display:${isCurrentlyPlaying ? 'block' : 'none'}">
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
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            style="display:${isCurrentlyPlaying ? 'none' : 'block'}">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>

          <svg class="pause-icon-list" width="40" height="40"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            style="display:${isCurrentlyPlaying ? 'block' : 'none'}">
            <rect x="6" y="4" width="4" height="16"></rect>
            <rect x="14" y="4" width="4" height="16"></rect>
          </svg>
        </button>
      `;
    }

    setupPlayButton(div, { ...song, id: safeId }, songs);
    trackList.appendChild(div);
  });
}

// ===============================
// PLAY BUTTON LOGIC PER CARD
// ===============================
function setupPlayButton(div, song, fullList) {
  const btn = div.querySelector("button");

  // Click handler for the play button
  const handlePlay = () => {
    // Toggle if already playing
    if (window.currentSong && window.currentSong.id === song.id) {
      if (audio.paused) {
        // Resume playback
        audio.play();
        playIcon.style.display = "none";
        pauseIcon.style.display = "block";
      } else {
        // Pause playback
        audio.pause();
        playIcon.style.display = "block";
        pauseIcon.style.display = "none";
      }

      // Sync all cards with the current state
      syncPlayerIcons();
      return;
    }

    // Reset icons on all cards
    document
      .querySelectorAll(".pause-icon, .pause-icon-box, .pause-icon-list")
      .forEach((el) => (el.style.display = "none"));

    document
      .querySelectorAll(".play-icon, .play-icon-box, .play-icon-list")
      .forEach((el) => (el.style.display = "block"));

    // Play the newly selected song
    playSong(song, fullList);
  };

  btn.addEventListener("click", (e) => {
    e.stopPropagation(); // Prevent bubbling if we add listener to div
    handlePlay();
  });

  // Click on the box itself (for mobile)
  div.addEventListener("click", (e) => {
    // Only in portrait (mobile)
    if (!window.matchMedia("(orientation: portrait)").matches) return;

    // Ignore if clicking the button directly (handled above)
    if (e.target.closest("button")) return;

    // Ignore if clicking artist name (user request)
    if (e.target.closest(".song-artist-box") || e.target.closest(".song-artist-list")) return;
    
    // Also ignore if clicking options
    if (e.target.closest(".song-option")) return;

    handlePlay();
  });
}

// ===============================
// HELPER: FORMAT TIME
// ===============================
function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}