const trackList = document.getElementById("trackList");
const API_BASE = "https://u7q5tko85l.execute-api.eu-north-1.amazonaws.com";

const globalAudio = document.getElementById("globalAudio");
const playerBar = document.getElementById("playerBar");
const currentTrackName = document.getElementById("currentTrackName");
const playPauseBtn = document.getElementById("playPause");
const progressBar = document.getElementById("progressBar");

let currentTrack = null;
let isPlaying = false;

async function fetchTracks() {
  try {
    const res = await fetch(`${API_BASE}/list`);
    const data = await res.json();
    const files = data.files || [];

    if (files.length === 0) {
      trackList.innerHTML = "<p>No tracks available yet.</p>";
      return;
    }

    trackList.innerHTML = "";
    files.forEach((file) => addTrack(file));
  } catch (err) {
    console.error("Error loading tracks:", err);
    trackList.innerHTML = "<p>⚠️ Error loading tracks.</p>";
  }
}

function addTrack(fileName) {
  const div = document.createElement("div");
  div.className = "track";
  div.innerHTML = `
    <button class="track-play icon-button" aria-label="Play ${fileName}">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
        <path d="M8 5v14l11-7z"/>
      </svg>
    </button>
    <strong class="track-name">${fileName}</strong>
  `;

  const button = div.querySelector("button");

  button.addEventListener("click", async () => {
    button.disabled = true;
    button.classList.add("loading");

    try {
      const res = await fetch(
        `${API_BASE}/stream?file=${encodeURIComponent(fileName)}`
      );
      const { streamUrl } = await res.json();

      currentTrack = fileName;
      currentTrackName.textContent = fileName;
      globalAudio.src = streamUrl;

      playerBar.classList.remove("hidden");
      await globalAudio.play();
      isPlaying = true;

      const playIcon = document.getElementById("playIcon");
      const pauseIcon = document.getElementById("pauseIcon");
      playIcon.style.display = "none";
      pauseIcon.style.display = "block";
    } catch (err) {
      console.error("Error streaming:", err);
      button.innerHTML = "⚠️";
    } finally {
      button.disabled = false;
      button.classList.remove("loading");
    }
  });

  trackList.appendChild(div);
}

// === Global player controls ===
const playIcon = document.getElementById("playIcon");
const pauseIcon = document.getElementById("pauseIcon");

playPauseBtn.addEventListener("click", () => {
  if (!currentTrack) return;

  if (isPlaying) {
    globalAudio.pause();
    playIcon.style.display = "block";
    pauseIcon.style.display = "none";
  } else {
    globalAudio.play();
    playIcon.style.display = "none";
    pauseIcon.style.display = "block";
  }

  isPlaying = !isPlaying;
});

globalAudio.addEventListener("play", () => {
  playIcon.style.display = "none";
  pauseIcon.style.display = "block";
});

globalAudio.addEventListener("pause", () => {
  playIcon.style.display = "block";
  pauseIcon.style.display = "none";
});

globalAudio.addEventListener("timeupdate", () => {
  const progress = (globalAudio.currentTime / globalAudio.duration) * 100;
  progressBar.value = progress || 0;
});

progressBar.addEventListener("input", () => {
  if (globalAudio.duration) {
    globalAudio.currentTime =
      (progressBar.value / 100) * globalAudio.duration;
  }
});

fetchTracks();