import { API_URL, loadSongs, $, requireAuth } from "../general.js";
import { playSong, initPlayer } from "../player.js";

// requireAuth();

const trackList = $("#trackList");
const searchBar = $("#searchBar");
let layoutType = 'box'
let songs = [];

function tabsList(name, defaultRender, custom) {
  this.name = name
  this.defaultRender = defaultRender
  this.custom = custom
}

const home = new tabsList('Home', 'box', '')
const playlists = new tabsList('Playlists', 'list', '')
const library = new tabsList('Library', 'list', '')
const explore = new tabsList('Explore', 'box', '')
const settings = new tabsList('Settings', 'box', '')

function initiateTabs(tabsList) {
  let tabsContainer = document.querySelector('.sidebar-list')
  let tabsArray =
    tabsList.forEach(tab => {
      let currentTab = document.createElement('li')
      currentTab.addEventListener('click', () => { switchTabs(tab) })
      tabsContainer.appendChild(currentTab)
    });
}

initiateTabs(tabsList)

window.addEventListener("DOMContentLoaded", async () => {
  try {
    songs = await loadSongs();
    layoutType === 'list' ? renderSongsList(songs) : renderSongBox(songs);
    initPlayer(songs);
  } catch (err) {
    console.error("❌ Failed to load songs:", err);
    trackList.innerHTML = "<p>Could not load songs.</p>";
  }
});

function renderSongList(list) {
  trackList.innerHTML = "";
  if (!list.length) {
    trackList.innerHTML = `<p>No songs available.</p>`;
    return;
  }

  list.forEach(song => {
    const div = document.createElement('div');
    div.className = "song-list"
    div.innerHTML = `
    <!-- PLAY BUTTON (centered) -->
    <button class="list-play-btn" aria-label="Play or pause">
      <svg class="play-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
        width="40" height="40" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round">
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
      </svg>
      <svg class="list-pause-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
        width="40" height="40" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round" style="display:none">
        <rect x="6" y="4" width="4" height="16"></rect>
        <rect x="14" y="4" width="4" height="16"></rect>
      </svg>
    </button>
    <div class="list-info">
      <p class="list-title">${song.title}</p>
      <p class="list-artist">${song.artist}</p>
    </div>
  `
  });
  const btn = div.querySelector(".list-play-btn");
  const playIcon = btn.querySelector(".list-play-icon");
  const pauseIcon = btn.querySelector(".list-pause-icon");

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
    document.querySelectorAll(".list-pause-icon").forEach((el) => (el.style.display = "none"));
    document.querySelectorAll(".list-icon").forEach((el) => (el.style.display = "block"));

    playIcon.style.display = "none";
    pauseIcon.style.display = "block";

    playSong(song, songs);
  });

  trackList.appendChild(div);
}

function renderSongBox(list) {
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
      <div class="box-info">
        <p class="box-title">${song.title}</p>
        <p class="box-artist">${song.artist}</p>
      </div>

      <!-- PLAY BUTTON (centered) -->
      <button class="box-play-btn" aria-label="Play or pause">
        <svg class="play-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
          width="40" height="40" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
        <svg class="box-pause-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
          width="40" height="40" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round" style="display:none">
          <rect x="6" y="4" width="4" height="16"></rect>
          <rect x="14" y="4" width="4" height="16"></rect>
        </svg>
      </button>
    `;

    const btn = div.querySelector(".box-play-btn");
    const playIcon = btn.querySelector(".box-play-icon");
    const pauseIcon = btn.querySelector(".box-pause-icon");

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