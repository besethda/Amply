const INDEX_URL = "https://amply-central-596430611327.s3.eu-north-1.amazonaws.com/amply-index.json";

const trackList = document.getElementById("trackList");
const playPauseBtn = document.getElementById("playPause");
const playIcon = document.getElementById("playIcon");
const pauseIcon = document.getElementById("pauseIcon");
const progressBar = document.getElementById("progressBar");
const playerBar = document.getElementById("playerBar");
const currentTrackName = document.getElementById("currentTrackName");
const audio = document.getElementById("globalAudio");

let currentSong = null;
let songs = [];

// === LOAD SONGS ===
window.addEventListener("DOMContentLoaded", async () => {
  try {
    const res = await fetch(INDEX_URL + "?v=" + Date.now()); // avoid cache
    const data = await res.json();

    // Flatten all songs from all artists
    songs = data.artists.flatMap((artist) =>
      artist.songs.map((song) => ({
        ...song,
        artist: artist.name,
        stream_url: song.art_url?.replace("/art/", "/songs/").replace("-cover", ""), // fallback if needed
      }))
    );

    renderSongs(songs);
  } catch (err) {
    console.error("Error loading songs:", err);
    trackList.innerHTML = `<p>❌ Failed to load songs.</p>`;
  }
});

// === RENDER SONGS ===
function renderSongs(songs) {
  trackList.innerHTML = "";

  if (!songs.length) {
    trackList.innerHTML = `<p>No songs uploaded yet.</p>`;
    return;
  }

  songs.forEach((song) => {
    const songBox = document.createElement("div");
    songBox.className = "track";

    songBox.innerHTML = `
      <img src="${song.art_url || './images/default-art.jpg'}" 
           alt="${song.title} cover" 
           class="cover-art" 
           style="width:100%;border-radius:12px;">
      <strong>${song.title}</strong>
      <span style="font-size:0.9rem;color:#333;">${song.artist || 'Unknown Artist'}</span>
      <div class="track-play">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z"/>
        </svg>
      </div>
    `;

    // play click
    songBox.addEventListener("click", () => playSong(song));
    trackList.appendChild(songBox);
  });
}

// === PLAY / PAUSE ===
function playSong(song) {
  if (currentSong && currentSong.stream_url === song.stream_url && !audio.paused) {
    audio.pause();
    playIcon.style.display = "block";
    pauseIcon.style.display = "none";
    return;
  }

  currentSong = song;
  audio.src = song.stream_url;
  audio.play();

  playerBar.classList.remove("hidden");
  currentTrackName.textContent = `${song.title} – ${song.artist}`;
  playIcon.style.display = "none";
  pauseIcon.style.display = "block";
}

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