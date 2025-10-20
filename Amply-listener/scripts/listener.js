const API_URL = "https://u7q5tko85l.execute-api.eu-north-1.amazonaws.com";
const INDEX_URL = "https://amply-central-596430611327.s3.eu-north-1.amazonaws.com/amply-index.json";

const trackList = document.getElementById("trackList");
const playPauseBtn = document.getElementById("playPause");
const playIcon = document.getElementById("playIcon");
const pauseIcon = document.getElementById("pauseIcon");
const progressBar = document.getElementById("progressBar");
const playerBar = document.getElementById("playerBar");
const currentTrackName = document.getElementById("currentTrackName");
const audio = document.getElementById("globalAudio");
const searchBar = document.getElementById("searchBar");

let currentSong = null;
let songs = [];

// === LOAD SONGS ===
window.addEventListener("DOMContentLoaded", async () => {
  try {
    const res = await fetch(INDEX_URL + "?v=" + Date.now());
    const data = await res.json();

    // include artist bucket for streaming
    songs = data.artists.flatMap((artist) =>
      artist.songs.map((song) => ({
        ...song,
        artist: artist.name,
        bucket: artist.bucket, // ✅ added so we know where to stream from
      }))
    );

    renderSongs(songs);
  } catch (err) {
    console.error("Error loading songs:", err);
    trackList.innerHTML = `<p>❌ Failed to load songs.</p>`;
  }
});

// === RENDER SONGS ===
function renderSongs(list) {
  trackList.innerHTML = "";
  if (!list.length) {
    trackList.innerHTML = `<p>No songs uploaded yet.</p>`;
    return;
  }

  list.forEach((song) => {
    const songBox = document.createElement("div");
    songBox.className = "track";

    songBox.innerHTML = `
      <img src="${song.art_url || './images/default-art.jpg'}"
           alt="${song.title} cover"
           class="cover-art">
      <strong>${song.title}</strong>
      <div style="font-size:0.9rem;color:#bbb;">${song.artist}</div>
    `;

    songBox.addEventListener("click", () => playSong(song));
    trackList.appendChild(songBox);
  });
}

// === PLAY SONG (SECURE STREAM) ===
async function playSong(song) {
  if (currentSong && currentSong.title === song.title && !audio.paused) {
    audio.pause();
    playIcon.style.display = "block";
    pauseIcon.style.display = "none";
    return;
  }

  currentSong = song;
  playerBar.classList.remove("hidden");
  currentTrackName.textContent = `${song.title} – ${song.artist}`;

  try {
    // ✅ now includes both bucket and file
    const res = await fetch(
      `${API_URL}/stream?bucket=${encodeURIComponent(song.bucket)}&file=${encodeURIComponent(song.file)}`
    );

    const data = await res.json();
    if (!res.ok || !data.streamUrl) throw new Error(data.error || "Failed to get stream URL");

    audio.src = data.streamUrl;
    await audio.play();

    playIcon.style.display = "none";
    pauseIcon.style.display = "block";
  } catch (err) {
    console.error("🎵 Stream error:", err);
    alert("Sorry — this track can’t be played right now.");
  }
}

// === PLAYER CONTROLS ===
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

// === SEARCH FILTER ===
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