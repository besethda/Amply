import { API_URL } from "../scripts/general.js";

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

let isRepeat = false;
let isShuffle = false;
let currentSong = null;
let playlist = [];
let currentIndex = 0;

export function initPlayer(songs = []) {
  playlist = songs;
  restoreSettings();
  setupEvents();
}

export async function playSong(song, list = playlist) {
  if (!song) return;

  currentSong = song;
  playlist = list;
  currentIndex = list.findIndex((s) => s.title === song.title);
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
  } catch (err) {
    console.error("❌ Playback error:", err);
    alert("Cannot play this track right now.");
  }
}

function updateScrollingTitle() {
  const el = currentTrackName;

  el.classList.remove("scrolling");

  // allow DOM to update fully
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (el.scrollWidth > el.clientWidth) {
        el.classList.add("scrolling");
      }
    });
  });
}

function setupEvents() {
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
  });

  prevBtn?.addEventListener("click", () => {
    if (!playlist.length) return;
    currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    playSong(playlist[currentIndex], playlist);
  });

  nextBtn?.addEventListener("click", () => {
    if (!playlist.length) return;
    if (isShuffle) {
      currentIndex = Math.floor(Math.random() * playlist.length);
    } else {
      currentIndex = (currentIndex + 1) % playlist.length;
    }
    playSong(playlist[currentIndex], playlist);
  });

  progressBar?.addEventListener("input", () => {
    if (audio.duration) {
      audio.currentTime = (progressBar.value / 100) * audio.duration;
    }
  });

  repeatBtn?.addEventListener("click", () => {
    isRepeat = !isRepeat;
    repeatBtn.classList.toggle("active", isRepeat);
    localStorage.setItem("amplyRepeat", isRepeat);
  });

  shuffleBtn?.addEventListener("click", () => {
    isShuffle = !isShuffle;
    shuffleBtn.classList.toggle("active", isShuffle);
    localStorage.setItem("amplyShuffle", isShuffle);
  });

  audio.addEventListener("timeupdate", () => {
    if (audio.duration) {
      progressBar.value = (audio.currentTime / audio.duration) * 100;
    }
  });

  audio.addEventListener("ended", () => handleEnd());
}

function handleEnd() {
  if (isRepeat && currentSong) {
    audio.currentTime = 0;
    audio.play();
    return;
  }

  if (isShuffle && playlist.length > 1) {
    let next;
    do {
      next = playlist[Math.floor(Math.random() * playlist.length)];
    } while (next.title === currentSong.title);
    playSong(next, playlist);
    return;
  }

  if (playlist.length && currentIndex < playlist.length - 1) {
    currentIndex++;
    playSong(playlist[currentIndex], playlist);
  } else {
    stopPlayback();
  }
}

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

export function stopPlayback() {
  audio.pause();
  playerBar.classList.add("hidden");
  playIcon.style.display = "block";
  pauseIcon.style.display = "none";
}