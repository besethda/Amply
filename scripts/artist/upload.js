// === UPLOAD SCRIPT (Artist Dashboard) ===
// Multi-step wizard for uploading songs and albums

import { API_URL, logout } from "../general.js";
import { requireArtistAWS, loadArtistConfig } from "./general.js";
import { generateCdnUrl } from "./provider-config.js";

// ===== STATE =====
let currentStep = 1;
let uploadType = null;
let singleAudioUrl = null;
let singleCoverUrl = null;
let currentViewMode = "list";
let albumSongs = [];
let albumCoverUrl = null;

// ===== DOM ELEMENTS =====
const step1 = document.getElementById("step1");
const step2Single = document.getElementById("step2Single");
const step2Album = document.getElementById("step2Album");
const choiceBtns = document.querySelectorAll(".upload-choice-btn");
const logoutBtn = document.getElementById("logoutBtn");
const backBtn1 = document.getElementById("backBtn1");
const backBtn2 = document.getElementById("backBtn2");
const uploadBtn = document.getElementById("uploadBtn");
const uploadAlbumBtn = document.getElementById("uploadAlbumBtn");
const addSongBtn = document.getElementById("addSongBtn");
const songsList = document.getElementById("songsList");
const statusDiv = document.getElementById("status");
const statusAlbumDiv = document.getElementById("statusAlbum");
const viewToggles = document.querySelectorAll(".view-toggle");
const viewTogglesAlbum = document.querySelectorAll(".view-toggle-album");

// ===== INIT =====
window.addEventListener("DOMContentLoaded", () => {
  requireArtistAWS();
  setupEventListeners();
});

if (logoutBtn) logoutBtn.addEventListener("click", logout);

// ===== EVENT LISTENERS =====
function setupEventListeners() {
  // Step 1: Choice buttons
  choiceBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      uploadType = btn.dataset.choice;
      goToStep(2);
    });
  });

  // Back buttons
  backBtn1.addEventListener("click", goToStep.bind(null, 1));
  backBtn2.addEventListener("click", goToStep.bind(null, 1));

  // Single upload
  uploadBtn.addEventListener("click", handleSingleUpload);

  // Album upload
  uploadAlbumBtn.addEventListener("click", handleAlbumUpload);

  // Album song management
  addSongBtn.addEventListener("click", addNewSongToAlbum);
  viewTogglesAlbum.forEach(toggle => {
    toggle.addEventListener("click", () => {
      viewTogglesAlbum.forEach(t => t.classList.remove("active"));
      toggle.classList.add("active");
      currentViewMode = toggle.dataset.view;
      stopPreviewAudio();
      renderAlbumPreview();
    });
  });

  // Single upload preview
  viewToggles.forEach(toggle => {
    toggle.addEventListener("click", () => {
      viewToggles.forEach(t => t.classList.remove("active"));
      toggle.classList.add("active");
      currentViewMode = toggle.dataset.view;
      stopPreviewAudio();
      renderSinglePreview();
    });
  });

  document.getElementById("fileInput").addEventListener("change", (e) => {
    statusDiv.textContent = "";
    const file = e.target.files[0];
    if (file) {
      generateSinglePreview(file);
    }
  });

  document.getElementById("coverArt").addEventListener("change", (e) => {
    statusDiv.textContent = "";
    generateSinglePreview(document.getElementById("fileInput").files[0]);
  });

  // Real-time preview updates when metadata changes
  document.getElementById("trackTitle").addEventListener("input", () => {
    generateSinglePreview(document.getElementById("fileInput").files[0]);
  });

  document.getElementById("trackGenre").addEventListener("input", () => {
    generateSinglePreview(document.getElementById("fileInput").files[0]);
  });

  document.getElementById("albumCoverArt").addEventListener("change", (e) => {
    statusAlbumDiv.textContent = "";
    const coverFile = e.target.files[0];
    if (coverFile) {
      albumCoverUrl = URL.createObjectURL(coverFile);
    }
    renderAlbumPreview();
  });
}

// ===== NAVIGATION =====
function goToStep(stepNum) {
  step1.classList.toggle("hidden", stepNum !== 1);
  step2Single.classList.toggle("hidden", stepNum !== 2 || uploadType !== "single");
  step2Album.classList.toggle("hidden", stepNum !== 2 || uploadType !== "album");
  currentStep = stepNum;
}

// ===== ALBUM SONG MANAGEMENT =====
function addNewSongToAlbum() {
  const songId = `song-${Date.now()}`;
  const song = {
    id: songId,
    title: "",
    file: null,
    cover: null,
    genre: "",
  };
  albumSongs.push(song);
  renderAlbumSongsList();
  renderAlbumPreview();
}

function removeSongFromAlbum(songId) {
  albumSongs = albumSongs.filter(s => s.id !== songId);
  renderAlbumSongsList();
  renderAlbumPreview();
}

function renderAlbumSongsList() {
  songsList.innerHTML = "";

  albumSongs.forEach((song, index) => {
    const box = document.createElement("div");
    box.className = "song-box";
    box.dataset.songId = song.id;
    
    // Only the last added song is expanded
    if (index === albumSongs.length - 1) {
      box.classList.add("active");
    }

    const header = document.createElement("div");
    header.className = "song-box-header";

    const title = document.createElement("h3");
    title.className = "song-box-title";
    title.textContent = song.title || `Song ${index + 1}`;

    const removeBtn = document.createElement("button");
    removeBtn.className = "song-box-remove-btn";
    removeBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      <line x1="10" y1="11" x2="10" y2="17"></line>
      <line x1="14" y1="11" x2="14" y2="17"></line>
    </svg>`;
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      removeSongFromAlbum(song.id);
    });

    header.appendChild(title);
    header.appendChild(removeBtn);
    
    // Make entire box clickable to toggle expand/collapse
    box.addEventListener("click", (e) => {
      // Don't toggle if clicking on remove button or inputs
      if (e.target === removeBtn || e.target.closest(".song-box-inputs")) return;
      
      // Close all other songs
      document.querySelectorAll(".song-box.active").forEach(el => {
        if (el !== box) el.classList.remove("active");
      });
      
      // Toggle current song
      box.classList.toggle("active");
    });

    const inputs = document.createElement("div");
    inputs.className = "song-box-inputs";

    // Song Title
    const titleLabel = document.createElement("label");
    titleLabel.textContent = "Song Title";
    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.placeholder = `e.g. Track ${index + 1}`;
    titleInput.value = song.title;
    titleInput.addEventListener("input", (e) => {
      song.title = e.target.value;
      title.textContent = song.title || `Song ${index + 1}`;
      renderAlbumPreview();
    });

    // Audio File
    const fileLabel = document.createElement("label");
    fileLabel.textContent = "Audio File";
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "audio/*";
    fileInput.addEventListener("change", (e) => {
      song.file = e.target.files[0];
    });

    // Genre
    const genreLabel = document.createElement("label");
    genreLabel.textContent = "Genre(s)";
    const genreInput = document.createElement("input");
    genreInput.type = "text";
    genreInput.placeholder = "e.g. chillwave, synthpop";
    genreInput.value = song.genre;
    genreInput.addEventListener("input", (e) => {
      song.genre = e.target.value;
    });

    inputs.appendChild(titleLabel);
    inputs.appendChild(titleInput);
    inputs.appendChild(fileLabel);
    inputs.appendChild(fileInput);
    inputs.appendChild(genreLabel);
    inputs.appendChild(genreInput);

    box.appendChild(header);
    box.appendChild(inputs);
    songsList.appendChild(box);
  });
}

// ===== PREVIEW GENERATION (Before Upload) =====
function generateSinglePreview(audioFile) {
  if (!audioFile) return;

  const previewSection = document.getElementById("previewSection");
  const previewContent = document.getElementById("previewContent");

  // Create local URLs for preview
  const audioUrl = URL.createObjectURL(audioFile);
  let coverUrl = "";
  
  const coverFile = document.getElementById("coverArt").files[0];
  if (coverFile) {
    coverUrl = URL.createObjectURL(coverFile);
  }

  singleAudioUrl = audioUrl;
  singleCoverUrl = coverUrl;

  previewSection.classList.remove("hidden");
  previewContent.innerHTML = "";
  previewContent.classList.remove("list-view", "box-view");
  previewContent.classList.add(`${currentViewMode}-view`);

  const title = document.getElementById("trackTitle").value.trim() || "Untitled";
  const artistProfile = JSON.parse(localStorage.getItem("amplyArtistProfile") || "{}");
  const artistName = artistProfile.artistName || "Unknown Artist";

  if (currentViewMode === "list") {
    previewContent.appendChild(createListItem(title, artistName, singleAudioUrl, singleCoverUrl, null));
  } else {
    previewContent.appendChild(createBoxItem(title, artistName, singleAudioUrl, singleCoverUrl, null));
  }
}

// ===== PREVIEW RENDERING (After Upload) =====
function renderSinglePreview() {
  const previewSection = document.getElementById("previewSection");
  const previewContent = document.getElementById("previewContent");

  if (!singleAudioUrl) return;

  previewSection.classList.remove("hidden");
  previewContent.innerHTML = "";
  previewContent.classList.remove("list-view", "box-view");
  previewContent.classList.add(`${currentViewMode}-view`);

  const title = document.getElementById("trackTitle").value.trim() || "Untitled";
  const artistProfile = JSON.parse(localStorage.getItem("amplyArtistProfile") || "{}");
  const artistName = artistProfile.artistName || "Unknown Artist";

  if (currentViewMode === "list") {
    previewContent.appendChild(createListItem(title, artistName, singleAudioUrl, singleCoverUrl, null));
  } else {
    previewContent.appendChild(createBoxItem(title, artistName, singleAudioUrl, singleCoverUrl, null));
  }
}

function clearSingleUploadForm() {
  document.getElementById("fileInput").value = "";
  document.getElementById("coverArt").value = "";
  document.getElementById("trackTitle").value = "";
  document.getElementById("trackGenre").value = "";
  singleCoverUrl = null;
  singleAudioUrl = null;
  renderSinglePreview();
}

function renderAlbumPreview() {
  const previewSection = document.getElementById("previewSectionAlbum");
  const previewContent = document.getElementById("previewContentAlbum");

  if (albumSongs.length === 0) {
    previewSection.classList.add("hidden");
    return;
  }

  previewSection.classList.remove("hidden");
  previewContent.innerHTML = "";
  previewContent.classList.remove("list-view", "box-view");
  previewContent.classList.add(`${currentViewMode}-view`);

  const artistProfile = JSON.parse(localStorage.getItem("amplyArtistProfile") || "{}");
  const artistName = artistProfile.artistName || "Unknown Artist";
  const albumTitle = document.getElementById("albumTitle").value.trim() || "Untitled Album";

  albumSongs.forEach((song, idx) => {
    const audioUrl = song.file ? URL.createObjectURL(song.file) : null;

    if (currentViewMode === "list") {
      previewContent.appendChild(createListItem(
        song.title || `Song ${idx + 1}`,
        artistName,
        audioUrl,
        albumCoverUrl,
        albumTitle
      ));
    } else {
      previewContent.appendChild(createBoxItem(
        song.title || `Song ${idx + 1}`,
        artistName,
        audioUrl,
        albumCoverUrl,
        albumTitle
      ));
    }
  });
}

function createListItem(title, artist, audioUrl, coverUrl, albumTitle) {
  const item = document.createElement("div");
  item.className = "song-list";
  const uniqueId = `preview-${Math.random().toString(36).substr(2, 9)}`;
  item.dataset.songId = uniqueId;

  const cover = document.createElement("img");
  cover.className = "cover-art";
  cover.src = coverUrl || "../images/Amply.png";

  const info = document.createElement("div");
  info.className = "song-info-list";
  info.dataset.artist = artist;

  const titleEl = document.createElement("span");
  titleEl.className = "song-title-list";
  titleEl.textContent = title;

  const artistEl = document.createElement("span");
  artistEl.className = "song-artist-list";
  const artistSpan = document.createElement("span");
  artistSpan.className = "go-artist";
  artistSpan.textContent = artist;
  artistEl.appendChild(artistSpan);

  info.appendChild(titleEl);
  info.appendChild(artistEl);

  const playBtn = document.createElement("button");
  playBtn.className = "song-play-btn-list";
  playBtn.innerHTML = `
    <svg class="play-icon-list" width="40" height="40"
      viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
      <polygon points="5 3 19 12 5 21 5 3"></polygon>
    </svg>
    <svg class="pause-icon-list" width="40" height="40"
      viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"
      style="display:none">
      <rect x="6" y="4" width="4" height="16"></rect>
      <rect x="14" y="4" width="4" height="16"></rect>
    </svg>
  `;

  if (audioUrl) {
    playBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      playPreview(audioUrl, item);
    });
  }

  item.appendChild(cover);
  item.appendChild(info);
  item.appendChild(playBtn);

  return item;
}

function createBoxItem(title, artist, audioUrl, coverUrl, albumTitle) {
  const item = document.createElement("div");
  item.className = "song-box";
  const uniqueId = `preview-${Math.random().toString(36).substr(2, 9)}`;
  item.dataset.songId = uniqueId;

  const cover = document.createElement("img");
  cover.className = "cover-art";
  cover.src = coverUrl || "../images/Amply.png";
  item.appendChild(cover);

  const infoBox = document.createElement("div");
  infoBox.className = "song-info-box";
  infoBox.dataset.artist = artist;

  const titleEl = document.createElement("span");
  titleEl.className = "song-title-box";
  titleEl.textContent = title;

  const artistEl = document.createElement("span");
  artistEl.className = "song-artist-box";
  const artistSpan = document.createElement("span");
  artistSpan.className = "go-artist";
  artistSpan.textContent = artist;
  artistEl.appendChild(artistSpan);

  infoBox.appendChild(titleEl);
  infoBox.appendChild(artistEl);
  item.appendChild(infoBox);

  const playBtn = document.createElement("button");
  playBtn.className = "song-play-btn-box";
  playBtn.innerHTML = `
    <svg class="play-icon-box" width="40" height="40"
      viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"
      transform="translate(2, 0)">
      <polygon points="5 3 19 12 5 21 5 3"></polygon>
    </svg>
    <svg class="pause-icon-box" width="40" height="40"
      viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"
      style="display:none">
      <rect x="6" y="4" width="4" height="16"></rect>
      <rect x="14" y="4" width="4" height="16"></rect>
    </svg>
  `;

  if (audioUrl) {
    playBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      playPreview(audioUrl, item);
    });
  }

  item.appendChild(playBtn);

  return item;
}

function playPreview(audioUrl, element) {
  let audioEl = document.getElementById("previewAudio");
  if (!audioEl) {
    audioEl = document.createElement("audio");
    audioEl.id = "previewAudio";
    audioEl.style.display = "none";
    document.body.appendChild(audioEl);
  }

  // Check if this element is already playing
  const isCurrentlyPlaying = audioEl.src === audioUrl && !audioEl.paused;

  if (isCurrentlyPlaying) {
    // Pause the audio
    audioEl.pause();
    updatePlayPauseIcons(element, false);
    element.classList.remove("playing");
  } else {
    // Stop any currently playing audio and reset its icons
    const currentPlayingElement = document.querySelector(".song-list.playing, .song-box.playing");
    if (currentPlayingElement && currentPlayingElement !== element) {
      currentPlayingElement.classList.remove("playing");
      resetPlayPauseIcons(currentPlayingElement);
    }

    // Play new audio
    audioEl.src = audioUrl;
    element.classList.add("playing");
    audioEl.play();
    updatePlayPauseIcons(element, true);

    audioEl.onended = () => {
      element.classList.remove("playing");
      updatePlayPauseIcons(element, false);
    };
  }
}

function updatePlayPauseIcons(element, isPlaying) {
  const playIcon = element.querySelector(".play-icon-list, .play-icon-box");
  const pauseIcon = element.querySelector(".pause-icon-list, .pause-icon-box");

  if (playIcon && pauseIcon) {
    if (isPlaying) {
      playIcon.style.display = "none";
      pauseIcon.style.display = "block";
    } else {
      playIcon.style.display = "block";
      pauseIcon.style.display = "none";
    }
  }
}

function resetPlayPauseIcons(element) {
  const playIcon = element.querySelector(".play-icon-list, .play-icon-box");
  const pauseIcon = element.querySelector(".pause-icon-list, .pause-icon-box");

  if (playIcon && pauseIcon) {
    playIcon.style.display = "block";
    pauseIcon.style.display = "none";
  }
}

function stopPreviewAudio() {
  const audioEl = document.getElementById("previewAudio");
  if (audioEl) {
    audioEl.pause();
    audioEl.src = "";
  }

  // Reset all playing states and icons
  document.querySelectorAll(".song-list.playing, .song-box.playing").forEach(el => {
    el.classList.remove("playing");
    resetPlayPauseIcons(el);
  });
}

// ===== SINGLE UPLOAD =====
async function handleSingleUpload() {
  const file = document.getElementById("fileInput").files[0];
  if (!file) {
    statusDiv.textContent = "Please choose an audio file to upload.";
    return;
  }

  const title = document.getElementById("trackTitle").value.trim();
  if (!title) {
    statusDiv.textContent = "Please enter a song title.";
    return;
  }

  // Sanitize filename - remove special characters that cause issues
  const sanitizedTitle = title
    .replace(/[^a-zA-Z0-9\s\-_]/g, '') // Remove special chars except dash, underscore
    .replace(/\s+/g, ' ')              // Collapse multiple spaces
    .trim();
  
  if (!sanitizedTitle) {
    statusDiv.textContent = "❌ Song title contains only special characters. Please use letters, numbers, spaces, dashes, or underscores.";
    return;
  }

  if (sanitizedTitle !== title) {
    statusDiv.textContent = `⚠️ Song title cleaned: "${sanitizedTitle}" (special characters removed)`;
    // Wait a bit so user sees the message
    await new Promise(resolve => setTimeout(resolve, 1500));
    statusDiv.textContent = "";
  }

  const validAudioTypes = ["audio/mpeg", "audio/wav"];
  const validAudioExts = [".mp3", ".wav"];
  const fileExt = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  if (!validAudioTypes.includes(file.type) && !validAudioExts.includes(fileExt)) {
    statusDiv.textContent = "❌ Only .mp3 or .wav audio files are allowed.";
    return;
  }

  const config = await loadArtistConfig();
  if (!config?.roleArn || !config?.bucketName) {
    statusDiv.textContent = "❌ Missing AWS info. Please reconnect your artist account.";
    return;
  }

  const artistProfile = JSON.parse(localStorage.getItem("amplyArtistProfile") || "{}");
  const artistId = config.artistId || localStorage.getItem("artistId");
  const artistName = artistProfile.artistName || config.displayName || "Unknown Artist";
  const genre = document.getElementById("trackGenre").value.trim();

  try {
    statusDiv.innerHTML = `<span style="color:#8df;">Preparing upload...</span>`;

    // Generate keys for S3 paths
    const fileExt = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    const songKey = `songs/${sanitizedTitle}${fileExt}`;

    // Upload cover art
    let coverUrl = "";
    const coverFile = document.getElementById("coverArt").files[0];
    if (coverFile) {
      const validImageExts = [".jpg", ".jpeg", ".png"];
      const coverExt = coverFile.name.toLowerCase().slice(coverFile.name.lastIndexOf("."));
      if (!validImageExts.includes(coverExt)) {
        statusDiv.textContent = "❌ Only .jpg, .jpeg, or .png allowed for cover art.";
        return;
      }

      const coverKey = `art/${file.name.replace(/\.[^/.]+$/, "")}-cover${coverExt}`;
      const presignCover = await fetch(`${API_URL}/get-upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: coverKey,
          artistRoleArn: config.roleArn,
          bucketName: config.bucketName,
          contentType: coverFile.type || "image/jpeg",
        }),
      });

      const presignCoverData = await presignCover.json();
      if (!presignCoverData.uploadUrl) throw new Error("Failed to get upload URL for cover art.");

      await fetch(presignCoverData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": coverFile.type || "image/jpeg" },
        body: coverFile,
      });

      // Generate CDN URLs using provider system
      coverUrl = generateCdnUrl(config, coverKey);
    }

    // Upload audio
    statusDiv.innerHTML = `<span style="color:#8df;">Uploading audio...</span>`;
    // songKey already defined above using sanitized title

    const presignAudio = await fetch(`${API_URL}/get-upload-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: songKey,
        artistRoleArn: config.roleArn,
        bucketName: config.bucketName,
        contentType: file.type || "audio/mpeg",
      }),
    });

    const presignAudioData = await presignAudio.json();
    if (!presignAudioData.uploadUrl) throw new Error("Failed to get upload URL for audio.");

    await fetch(presignAudioData.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "audio/mpeg" },
      body: file,
    });

    // Update URLs to use uploaded versions
    // Generate CDN URL using provider system
    singleAudioUrl = generateCdnUrl(config, songKey);
    singleCoverUrl = coverUrl;

    // Step 1: Create release (metadata only - no songs)
    statusDiv.innerHTML = `<span style="color:#8df;">Creating release...</span>`;
    const artistProfile = JSON.parse(localStorage.getItem("amplyArtistProfile") || "{}");
    const artistName = config.artistName || artistProfile.artistName || "Unknown Artist";
    
    const releaseRes = await fetch(`${API_URL}/create-release`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("amplyIdToken")}`,
      },
      body: JSON.stringify({
        releaseType: "single",
        title: sanitizedTitle,
        artistName: artistName,
        description: "",
        coverArt: coverUrl,
        releaseDate: new Date().toISOString(),
      }),
    });

    if (!releaseRes.ok) throw new Error("Failed to create release");
    
    const releaseData = await releaseRes.json();
    const releaseId = releaseData.releaseId;

    // Step 2: Add song to release
    statusDiv.innerHTML = `<span style="color:#8df;">Adding song to release...</span>`;
    const s3Key = `songs/${artistId}/${releaseId}/${sanitizedTitle}${fileExt}`;
    
    const addSongRes = await fetch(`${API_URL}/release/${releaseId}/add-song`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("amplyIdToken")}`,
      },
      body: JSON.stringify({
        title: sanitizedTitle,
        genre: genre || "",
        duration: Math.round((file.size / 128000)), // Rough estimate: 128kbps
        s3Key: s3Key,
      }),
    });

    if (!addSongRes.ok) throw new Error("Failed to add song to release");
    
    const songData = await addSongRes.json();
    statusDiv.innerHTML = `✅ Uploaded "<strong>${title}</strong>" as single successfully! Release ID: ${releaseId}`;
    renderSinglePreview();
    
    // Clear form for next upload
    clearSingleUploadForm();

    console.log("✅ Upload complete!");
  } catch (err) {
    console.error("❌ Upload error:", err);
    statusDiv.innerHTML = `❌ Error: ${err.message}`;
  }
}

// ===== ALBUM/EP UPLOAD =====
async function handleAlbumUpload() {
  const albumTitle = document.getElementById("albumTitle").value.trim();
  if (!albumTitle) {
    statusAlbumDiv.textContent = "Please enter an album title.";
    return;
  }

  if (albumSongs.length === 0) {
    statusAlbumDiv.textContent = "Please add at least one song to the album.";
    return;
  }

  // Validate all songs have files and titles
  for (const song of albumSongs) {
    if (!song.title) {
      statusAlbumDiv.textContent = "All songs must have a title.";
      return;
    }
    if (!song.file) {
      statusAlbumDiv.textContent = `"${song.title}" is missing an audio file.`;
      return;
    }
  }

  const config = await loadArtistConfig();
  if (!config?.roleArn || !config?.bucketName) {
    statusAlbumDiv.textContent = "❌ Missing AWS info. Please reconnect your artist account.";
    return;
  }

  const artistProfile = JSON.parse(localStorage.getItem("amplyArtistProfile") || "{}");
  const artistName = artistProfile.artistName || config.displayName || "Unknown Artist";

  try {
    statusAlbumDiv.innerHTML = `<span style="color:#8df;">Preparing album upload...</span>`;

    // Upload album cover art
    let coverUrl = "";
    const coverFile = document.getElementById("albumCoverArt").files[0];
    if (coverFile) {
      const validImageExts = [".jpg", ".jpeg", ".png"];
      const coverExt = coverFile.name.toLowerCase().slice(coverFile.name.lastIndexOf("."));
      if (!validImageExts.includes(coverExt)) {
        statusAlbumDiv.textContent = "❌ Only .jpg, .jpeg, or .png allowed for cover art.";
        return;
      }

      const coverKey = `art/${albumTitle}-cover${coverExt}`;
      const presignCover = await fetch(`${API_URL}/get-upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: coverKey,
          artistRoleArn: config.roleArn,
          bucketName: config.bucketName,
          contentType: coverFile.type || "image/jpeg",
        }),
      });

      const presignCoverData = await presignCover.json();
      if (!presignCoverData.uploadUrl) throw new Error("Failed to get upload URL for cover art.");

      await fetch(presignCoverData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": coverFile.type || "image/jpeg" },
        body: coverFile,
      });

      coverUrl = generateCdnUrl(config, coverKey);
    }

    // Upload all songs and build release data
    for (let idx = 0; idx < albumSongs.length; idx++) {
      const song = albumSongs[idx];
      const sanitizedTitle = song.title
        .replace(/[^a-zA-Z0-9\s\-_]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      statusAlbumDiv.innerHTML = `<span style="color:#8df;">Uploading song ${idx + 1}/${albumSongs.length}...</span>`;

      const fileExt = song.file.name.toLowerCase().slice(song.file.name.lastIndexOf("."));
      const songKey = `songs/${albumTitle}/${sanitizedTitle}${fileExt}`;

      // Get upload URL
      const presignAudio = await fetch(`${API_URL}/get-upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: songKey,
          artistRoleArn: config.roleArn,
          bucketName: config.bucketName,
          contentType: song.file.type || "audio/mpeg",
        }),
      });

      const presignAudioData = await presignAudio.json();
      if (!presignAudioData.uploadUrl) throw new Error(`Failed to get upload URL for ${song.title}`);

      // Upload file
      await fetch(presignAudioData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": song.file.type || "audio/mpeg" },
        body: song.file,
      });
    }

    // Determine release type based on song count
    let releaseType = "single";
    if (albumSongs.length === 2 || albumSongs.length === 3) {
      releaseType = "ep";
    } else if (albumSongs.length >= 4) {
      releaseType = "album";
    }

    // Override with user selection
    if (uploadType === "ep") releaseType = "ep";
    if (uploadType === "album") releaseType = "album";

    // Step 1: Create release (metadata only - no songs)
    statusAlbumDiv.innerHTML = `<span style="color:#8df;">Creating release...</span>`;
    const artistProfile = JSON.parse(localStorage.getItem("amplyArtistProfile") || "{}");
    const artistName = config.artistName || artistProfile.artistName || "Unknown Artist";
    
    const releaseRes = await fetch(`${API_URL}/create-release`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("amplyIdToken")}`,
      },
      body: JSON.stringify({
        releaseType,
        title: albumTitle,
        artistName: artistName,
        description: "",
        coverArt: coverUrl,
        releaseDate: new Date().toISOString(),
      }),
    });

    if (!releaseRes.ok) throw new Error("Failed to create release");
    
    const releaseData = await releaseRes.json();
    const releaseId = releaseData.releaseId;

    // Step 2: Add all songs to the release
    for (let idx = 0; idx < albumSongs.length; idx++) {
      const song = albumSongs[idx];
      const sanitizedTitle = song.title
        .replace(/[^a-zA-Z0-9\s\-_]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      statusAlbumDiv.innerHTML = `<span style="color:#8df;">Adding song ${idx + 1}/${albumSongs.length} to release...</span>`;

      const fileExt = song.file.name.toLowerCase().slice(song.file.name.lastIndexOf("."));
      const s3Key = `songs/${artistId}/${releaseId}/${sanitizedTitle}${fileExt}`;

      // Add song to release
      const addSongRes = await fetch(`${API_URL}/release/${releaseId}/add-song`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("amplyIdToken")}`,
        },
        body: JSON.stringify({
          title: sanitizedTitle,
          genre: song.genre || "",
          duration: Math.round((song.file.size / 128000)), // Rough estimate: 128kbps
          s3Key: s3Key,
        }),
      });

      if (!addSongRes.ok) throw new Error(`Failed to add "${song.title}" to release`);
    }

    statusAlbumDiv.innerHTML = `✅ Uploaded "<strong>${albumTitle}</strong>" successfully! Release ID: ${releaseId}`;
    renderAlbumPreview();
    clearAlbumUploadForm();

    console.log("✅ Album upload complete!");
  } catch (err) {
    console.error("❌ Album upload error:", err);
    statusAlbumDiv.innerHTML = `❌ Error: ${err.message}`;
  }
}

// Clear album upload form fields
function clearAlbumUploadForm() {
  document.getElementById("albumTitle").value = "";
  document.getElementById("albumCoverArt").value = "";
  albumSongs = [];
  albumCoverUrl = null;
  renderAlbumSongsList();
  renderAlbumPreview();
}