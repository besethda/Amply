import { API_URL, parseJwt, getAuthToken, apiFetch } from "../scripts/general.js";
import { SimpleWaveformRenderer } from "../scripts/waveform-simple.js";

// Ensure player bar starts hidden when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const pb = document.getElementById("playerBar");
    if (pb) pb.classList.add("hidden");
  });
} else {
  const pb = document.getElementById("playerBar");
  if (pb) pb.classList.add("hidden");
}

// ===============================
// DOM ELEMENTS
// ===============================
const audio = document.getElementById("globalAudio");
const playerBar = document.getElementById("playerBar");

const playIcon = document.getElementById("playIcon");
const pauseIcon = document.getElementById("pauseIcon");
const waveformCanvas = document.getElementById("waveformCanvas");
const currentTrackName = document.getElementById("currentTrackName");
const currentTrackArtist = document.getElementById("currentTrackArtist");
const currentTrackArt = document.getElementById("currentTrackArt");
const playPauseBtn = document.getElementById("playPause");
const playerMenuBtn = document.getElementById("playerMenuBtn");
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

// Waveform Analyzer and Renderer
let waveformAnalyzer = null;
let waveformRenderer = null;

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
// LISTEN TRACKING STATE
// ===============================
let listenTracked = new Set(); // Track songs that have been counted to prevent duplicates
let currentSongReady = false; // Track if current song has properly loaded and started
let currentSongStartTime = 0; // When current song started playing

// ===============================
// WAVEFORM STATE
// ===============================
let waveformAnimationId = null;
let staticWaveformData = []; // Static waveform data for the current song
let currentWaveformDuration = 0; // Duration of song with current waveform
let waveformCanvasElement = null; // Track which canvas we're using
let waveformDataGenerated = false; // Track if waveform data has been generated for current song

// Drag-to-seek state accessible to button handlers
let isDraggingWaveform = false;
let hasMovedEnoughWaveform = false;

// ===============================
// PLAYER STATE PERSISTENCE
// ===============================
function savePlayerState() {
  if (!audio || !currentSong) return;
  
  try {
    const state = {
      currentSong: {
        id: currentSong.id,
        title: currentSong.title,
        artist: currentSong.artist,
        file: currentSong.file,
        bucket: currentSong.bucket,
        cloudfrontDomain: currentSong.cloudfrontDomain,
        coverImage: currentSong.coverImage,
      },
      currentTime: audio.currentTime,
      isPlaying: !audio.paused,
      currentIndex,
      playlist: playlist.map(s => ({
        id: s.id,
        title: s.title,
        artist: s.artist,
        file: s.file,
        bucket: s.bucket,
        cloudfrontDomain: s.cloudfrontDomain,
        coverImage: s.coverImage,
      })),
    };
    localStorage.setItem('amplyPlayerState', JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save player state:', err);
  }
}

function restorePlayerState() {
  try {
    const saved = localStorage.getItem('amplyPlayerState');
    if (!saved) return false;
    
    const state = JSON.parse(saved);
    if (!state.currentSong || !state.playlist?.length) return false;
    
    // Restore playlist and current song
    playlist = state.playlist;
    currentSong = state.currentSong;
    window.currentSong = currentSong;
    currentIndex = state.currentIndex || 0;
    
    // Update UI
    if (currentSong) {
      // Update player bar
      currentTrackName.textContent = currentSong.title || "Unknown Track";
      currentTrackArtist.textContent = currentSong.artist || "";
      if (currentTrackArt) {
        currentTrackArt.src = currentSong.coverImage || currentSong.art_url || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%23667eea'/%3E%3Cstop offset='100%25' style='stop-color:%23764ba2'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='url(%23g)' width='200' height='200'/%3E%3C/svg%3E";
      }
      updateFullPlayerUI();
      if (playerBar) playerBar.classList.remove('hidden');
    }
    
    // Setup audio if not already setup
    if (!audio.src && state.currentSong.file) {
      const setupAudio = async () => {
        try {
          const res = await fetch(
            `${API_URL}/stream?bucket=${encodeURIComponent(
              currentSong.bucket
            )}&file=${encodeURIComponent(currentSong.file)}`
          );
          const data = await res.json();
          audio.src = data.streamUrl;
          
          // Wait for audio to be loadable before setting currentTime
          await new Promise((resolve) => {
            const onCanPlay = () => {
              audio.removeEventListener('canplay', onCanPlay);
              resolve();
            };
            audio.addEventListener('canplay', onCanPlay, { once: true });
            // Timeout fallback in case canplay doesn't fire
            setTimeout(resolve, 2000);
          });
          
          // Restore playback position
          if (state.currentTime) {
            audio.currentTime = state.currentTime;
          }
          
          // Restore playback state
          if (state.isPlaying) {
            try {
              await audio.play();
            } catch (err) {
              // Autoplay is blocked by browser policy - this is expected
              console.log('ℹ️ Autoplay blocked (browser policy) - user must click play');
            }
          }
        } catch (err) {
          console.error('Failed to setup audio:', err);
        }
      };
      setupAudio();
    }
    
    return true;
  } catch (err) {
    console.error('Failed to restore player state:', err);
    return false;
  }
}

function clearPlayerState() {
  try {
    localStorage.removeItem('amplyPlayerState');
  } catch (err) {
    console.error('Failed to clear player state:', err);
  }
}

// ===============================
// INIT PLAYER
// ===============================
export function initPlayer(songs = []) {
  // Preserve current song's art_url when re-initializing player with new playlist
  const preservedArtUrl = window.currentSong?.art_url;
  const preservedCoverImage = window.currentSong?.coverImage;
  
  if (songs?.length) {
    playlist = songs.map((s) => ({
      ...s,
      id: s.id || s.songId || s.file || s.title,
      // Preserve art_url if it's missing from this song but was in the previous currentSong
      art_url: s.art_url || preservedArtUrl,
      coverImage: s.coverImage || preservedCoverImage,
    }));
  }

  // If we have a current song, update it in the playlist with preserved metadata
  if (window.currentSong && playlist.length > 0) {
    const currentIndex = playlist.findIndex(s => s.id === window.currentSong.id);
    if (currentIndex >= 0) {
      // Merge current song with updated playlist song while preserving metadata
      window.currentSong = {
        ...playlist[currentIndex],
        art_url: window.currentSong.art_url || playlist[currentIndex].art_url,
        coverImage: window.currentSong.coverImage || playlist[currentIndex].coverImage,
      };
    }
  }

  // Initialize waveform
  initializeWaveform();

  // Add resize listener to handle canvas resizing
  window.addEventListener('resize', () => {
    if (document.getElementById('waveformCanvas')) {
      resizeWaveformCanvas();
    }
  });

  // Watch for canvas element appearing/disappearing (in case we navigated away)
  const observeCanvasChanges = () => {
    // Check if canvas exists now
    const canvas = document.getElementById('waveformCanvas');
    
    // If canvas appeared and we haven't initialized it yet
    if (canvas && !waveformCanvasElement) {
      console.log('🎵 [Waveform] Canvas element detected, reinitializing...');
      initializeWaveform();
    } 
    // If canvas disappeared, reset reference
    else if (!canvas) {
      waveformCanvasElement = null;
    }
  };

  // Use MutationObserver to watch for DOM changes
  const observer = new MutationObserver(observeCanvasChanges);
  observer.observe(document.body, { 
    childList: true, 
    subtree: true 
  });

  restoreSettings();
  setupEvents();
}

// ===============================
// WAVEFORM INITIALIZATION
// ===============================
export function initializeWaveform() {
  const canvas = document.getElementById('waveformCanvas');
  const audio = document.getElementById('globalAudio');
  
  console.log('🎵 [Waveform] initializeWaveform called');
  console.log('🎵 [Waveform] Canvas found:', !!canvas, canvas?.id);
  console.log('🎵 [Waveform] Audio found:', !!audio, audio?.id);
  
  if (!audio) {
    console.log('🎵 [Waveform] Audio element not found, skipping initialization');
    return;
  }
  
  // If no canvas yet, just initialize the renderer in the background
  if (!canvas) {
    console.log('🎵 [Waveform] Canvas not found, will reinitialize when canvas appears');
    if (!window.waveformRenderer) {
      window.waveformRenderer = new SimpleWaveformRenderer(document.createElement('canvas'));
    }
    return;
  }

  // Canvas is available - fully initialize
  console.log('🎵 [Waveform] Initializing simple waveform renderer...');
  waveformCanvasElement = canvas;
  
  // Create or reuse waveform renderer
  if (!window.waveformRenderer) {
    window.waveformRenderer = new SimpleWaveformRenderer(canvas);
  } else {
    // Update canvas reference
    window.waveformRenderer.canvas = canvas;
    window.waveformRenderer.ctx = canvas.getContext('2d');
  }
  
  // If we already generated waveform data, don't regenerate - just resize and redraw
  if (waveformDataGenerated && window.waveformRenderer.waveformBars.length > 0) {
    console.log('🎵 [Waveform] Using existing waveform data');
    // Wait for layout before resizing
    requestAnimationFrame(() => {
      setTimeout(() => {
        resizeWaveformCanvas();
        startWaveformAnimation();
      }, 0);
    });
    return;
  }
  
  // If audio is currently playing, waveform is loaded from backend
  if (!audio.paused && audio.src) {
    waveformDataGenerated = true;
    console.log('🎵 [Waveform] Waveform loaded from backend');
  }
  
  // Wait for canvas layout to be complete before sizing
  requestAnimationFrame(() => {
    setTimeout(() => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        resizeWaveformCanvas();
        startWaveformAnimation();
      } else {
        // Try again after a bit more time
        setTimeout(() => {
          resizeWaveformCanvas();
          startWaveformAnimation();
        }, 100);
      }
    }, 0);
  });
}

function resizeWaveformCanvas() {
  const canvas = waveformCanvasElement || document.getElementById('waveformCanvas');
  if (!canvas) return;
  
  const rect = canvas.getBoundingClientRect();
  console.log('📐 Canvas rect:', { width: rect.width, height: rect.height });
  
  // Set devicePixelRatio for better quality
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  
  // Scale canvas context if using high DPI
  if (dpr > 1) {
    canvas.getContext('2d').scale(dpr, dpr);
  }
  
  console.log('📐 Canvas resized to:', { width: canvas.width, height: canvas.height, dpr });
  
  // Redraw waveform
  if (window.waveformRenderer && window.waveformRenderer.waveformBars.length > 0) {
    console.log('📐 Redrawing waveform');
    window.waveformRenderer.draw();
  }
}

function startWaveformAnimation() {
  if (!window.waveformRenderer) {
    return;
  }
  
  // Just draw once - no animation loop
  window.waveformRenderer.draw();
}

function onCanvasAvailable() {
  console.log('🎵 [Waveform] Canvas became available, reinitializing...');
  if (document.getElementById('waveformCanvas')) {
    initializeWaveform();
  }
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

  // Reset playing class
  document.querySelectorAll(".song-list, .song-box").forEach(el => el.classList.remove("playing"));

  if (!isPaused && currentId) {
    // Show pause icon for current song
    const safeSelector = CSS.escape(currentId);
    const currentCard = document.querySelector(`[data-song-id="${safeSelector}"]`);
    
    if (currentCard) {
      currentCard.classList.add("playing");
      
      const pauseIcon = currentCard.querySelector(".pause-icon, .pause-icon-box, .pause-icon-list");
      const playIcon = currentCard.querySelector(".play-icon, .play-icon-box, .play-icon-list");
      
      if (pauseIcon) pauseIcon.style.display = "block";
      if (playIcon) playIcon.style.display = "none";
    }
  }
}

// ===============================
// PLAY SONG
// ===============================
// RECORD LISTEN
// ===============================
async function recordListen(song) {
  console.log("⏱️ === START recordListen function ===");
  try {
    if (!song) {
      console.error("❌ recordListen: No song provided");
      return;
    }
    
    const artistId = song.artistId || song.artist || "Unknown";
    const songId = song.file || song.songId || song.id;
    const title = song.title || song.name || "Unknown Title";

    console.log("🎧 Recording listen:", {
      title,
      artistId,
      songId,
      durationPlayed: Math.round(audio.currentTime),
      currentTime: audio.currentTime,
      duration: audio.duration,
    });

    const durationPlayed = Math.round(audio.currentTime);
    const payload = {
      songId,
      title,
      artistId,
      durationPlayed,
    };

    console.log("📤 Sending to API:", JSON.stringify(payload));

    const response = await apiFetch(`${API_URL}/record-listen`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    console.log("✅ API Response:", response);
    console.log("✅ Listen recorded successfully:", songId, "Duration:", durationPlayed, "seconds");
    console.log("⏱️ === END recordListen function ===");
  } catch (err) {
    console.error("❌ Failed to record listen:", err);
    console.error("❌ Error details:", err.message, err.stack);
    console.log("⏱️ === END recordListen function (with error) ===");
  }
}

// ===============================
// PLAY SONG
// ===============================
export async function playSong(song, list = playlist) {
  console.log('🎵 [Player] playSong() called with song:', song?.title);
  if (!song) return;

  const safeId = song.id || song.songId || song.file || song.title;

  // Preserve metadata from previous currentSong if the new song doesn't have it
  const previousMetadata = window.currentSong;
  const mergedSong = {
    ...song,
    id: safeId,
    // Preserve art_url if the new song doesn't have it
    art_url: song.art_url || previousMetadata?.art_url,
    coverImage: song.coverImage || previousMetadata?.coverImage,
  };

  // Apply normalized ID to the current song
  currentSong = mergedSong;
  window.currentSong = currentSong;
  window.fullSongMetadata = currentSong; // Store full metadata separately
  
  // Reset listen tracking for new song
  listenTracked.clear();
  currentSongReady = false; // Mark that the new song hasn't fully loaded yet
  currentSongStartTime = audio.currentTime || 0;

  // Reset waveform for new song
  waveformDataGenerated = false;
  if (window.waveformRenderer) {
    window.waveformRenderer.waveformBars = [];
  }

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
    currentTrackArt.src = currentSong.coverImage || currentSong.art_url || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%23667eea'/%3E%3Cstop offset='100%25' style='stop-color:%23764ba2'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='url(%23g)' width='200' height='200'/%3E%3C/svg%3E";
  }
  updateScrollingTitle();
  updateFullPlayerUI();
  
  // Resize canvas after player bar becomes visible (use requestAnimationFrame for layout)
  requestAnimationFrame(() => {
    setTimeout(() => {
      if (waveformCanvas) {
        const rect = waveformCanvas.getBoundingClientRect();
        console.log('🎵 [Player] Resizing canvas after player bar shown:', rect);
        const dpr = window.devicePixelRatio || 1;
        waveformCanvas.width = rect.width * dpr;
        waveformCanvas.height = rect.height * dpr;
        if (dpr > 1) {
          waveformCanvas.getContext('2d').scale(dpr, dpr);
        }
        console.log('🎵 [Player] Canvas resized to:', { width: waveformCanvas.width, height: waveformCanvas.height });
      }
    }, 0);
  });

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
    // Reset currentTime immediately to prevent recording the old song
    // This is safe to do after setting src
    if (audio.currentTime > 0) {
      try {
        audio.currentTime = 0;
      } catch (e) {
        // Ignore errors from setting currentTime before metadata loads
      }
    }
    
    try {
      console.log('[Player] Attempting to play audio:', { src: audio.src, ready: currentSongReady });
      await audio.play();
      currentSongReady = true; // Song has started playing
      console.log('[Player] Audio playing successfully');

      // Generate waveform and start animation
      if (window.waveformRenderer) {
        // First, try to fetch pre-computed waveform data
        let waveformLoaded = false;
        
        if (currentSong.bucket && currentSong.file) {
          try {
            console.log('🎵 [Player] Fetching pre-computed waveform data...');
            // Extract just the filename (remove path prefix and extension)
            const songFilename = currentSong.file.split('/').pop().replace(/\.[^.]+$/, '');
            
            const waveformResponse = await fetch(`${API_URL}/get-waveform`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`,
              },
              body: JSON.stringify({
                artistId: currentSong.artistId || undefined,
                songTitle: songFilename,
                bucketName: currentSong.bucket,
              }),
            });
            
            if (waveformResponse.ok) {
              const waveformData = await waveformResponse.json();
              console.log('✅ [Player] Loaded pre-computed waveform with', waveformData.data.length, 'samples');
              
              // Load the pre-computed waveform data into the renderer
              window.waveformRenderer.waveformBars = waveformData.data;
              
              window.waveformRenderer.isPlaying = true;
              waveformLoaded = true;
              waveformDataGenerated = true;
            } else {
              console.warn('⚠️ [Player] Waveform data not available:', waveformResponse.status);
            }
          } catch (err) {
            console.warn('⚠️ [Player] Failed to fetch pre-computed waveform:', err.message);
          }
        }
        
        // If pre-computed waveform not available, skip (no synthetic fallback)
        if (!waveformLoaded) {
          console.log('⚠️ [Player] Waveform data not available');
        }
        
        window.waveformRenderer.draw();
        startWaveformAnimation();
      } else {
        console.warn('⚠️ [Player] Waveform renderer not available');
      }
    } catch (err) {
      // Handle AbortError silently (user switched songs before this one finished loading)
      if (err.name === 'AbortError') {
        console.log('⏭️ [Player] Song playback aborted (user switched songs)');
        return;
      }
      console.error("❌ Play failed:", err.message);
    }

    // Update main player bar icons
    playIcon.style.display = "none";
    pauseIcon.style.display = "block";
    updateFullPlayerPlayPause(true);

    // Update all cards
    syncPlayerIcons();
    
    // Save player state to persist across page navigations
    savePlayerState();
  } catch (err) {
    // Handle AbortError silently
    if (err.name === 'AbortError') {
      console.log('⏭️ [Player] Stream fetch aborted (user switched songs)');
      return;
    }
    console.error("Playback error:", err);
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
  playPauseBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    
    // Don't activate if we just dragged the waveform
    if (hasMovedEnoughWaveform) {
      // Reset the flag so future clicks work
      hasMovedEnoughWaveform = false;
      return;
    }
    
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

  // ===============================
  // WAVEFORM DRAG-TO-SEEK
  // ===============================
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  const DRAG_THRESHOLD = 5; // pixels

  // Helper function to seek to position
  const seekToPosition = (e) => {
    if (!audio.duration || !waveformCanvasElement) return;
    const rect = waveformCanvasElement.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const progress = x / rect.width;
    audio.currentTime = progress * audio.duration;
    console.log('🎯 [Seek] Moved to', (progress * 100).toFixed(1) + '%');
  };

  // Mouse down - start drag detection
  waveformCanvasElement?.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // Only left mouse button
    
    isDragging = true;
    isDraggingWaveform = true;
    hasMovedEnoughWaveform = false;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
  });

  // Mouse move - check if drag threshold is exceeded
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const deltaX = Math.abs(e.clientX - dragStartX);
    const deltaY = Math.abs(e.clientY - dragStartY);
    if (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD) {
      hasMovedEnoughWaveform = true;
      seekToPosition(e);
    }
  }, true); // Use capture phase

  // Mouse up - stop dragging
  document.addEventListener('mouseup', () => {
    isDragging = false;
    isDraggingWaveform = false;
  });

  // Click-to-seek on canvas (single click without dragging)
  waveformCanvasElement?.addEventListener('click', (e) => {
    if (hasMovedEnoughWaveform) {
      // Drag occurred, don't seek again
      e.stopPropagation();
      return;
    }
    
    // Pure click without dragging - seek
    seekToPosition(e);
  });

  // Previous track in player bar
  const prevBtn = document.getElementById("prevBtn");
  const prevSvg = prevBtn?.querySelector("svg");
  prevSvg?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!playlist.length) return;

    currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    playSong(playlist[currentIndex], playlist);
  });

  // Next track in player bar
  const nextBtn = document.getElementById("nextBtn");
  const nextSvg = nextBtn?.querySelector("svg");
  nextSvg?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!playlist.length) return;

    if (isShuffle) {
      currentIndex = Math.floor(Math.random() * playlist.length);
    } else {
      currentIndex = (currentIndex + 1) % playlist.length;
    }

    playSong(playlist[currentIndex], playlist);
  });

  // Navigate to artist page when clicking artist name
  currentTrackArtist?.addEventListener("click", (e) => {
    e.stopPropagation();
    
    // Reset drag state for clean click detection
    hasMovedEnoughWaveform = false;
    isDraggingWaveform = false;
    
    if (!currentSong) return;
    
    const artistName = currentSong.artist;
    console.log('🎨 [Artist Click] Navigating to artist:', artistName);
    
    // Navigate to artist profile using artist name (same pattern as song boxes)
    window.location.hash = `artist:${encodeURIComponent(artistName)}`;
  });

  // Progress bar update and listening tracking
  audio.addEventListener("timeupdate", () => {
    if (audio.duration) {
      const progress = (audio.currentTime / audio.duration) * 100;
      if (fullProgressBar) fullProgressBar.value = progress;
      // Waveform is updated in the animation loop

      // Update time stamps
      if (fullCurrentTime) fullCurrentTime.textContent = formatTime(audio.currentTime);
      if (fullTotalTime) fullTotalTime.textContent = formatTime(audio.duration);
    }

    // Debug: Log state at 5, 15, 25, 30 seconds
    const currentRounded = Math.round(audio.currentTime);
    if ([5, 15, 25, 30].includes(currentRounded)) {
      console.log(`⏱️ [Player] Time: ${currentRounded}s | Song: ${currentSong?.title} | Ready: ${currentSongReady} | Duration: ${audio.duration}s`);
    }

    // Track listen when:
    // - 30+ seconds played (for songs >= 30 seconds), OR
    // - Song finished (for songs < 30 seconds)
    if (currentSong && audio.duration) {
      const threshold = Math.min(30, audio.duration); // Use song duration if < 30 seconds
      
      if (audio.currentTime >= threshold) {
        const currentSongUrl = audio.src;
        if (currentSongUrl && currentSongUrl.length > 0) {
          const songKey = currentSong.file || currentSong.id || currentSong.songId || currentSong.title;
          if (!listenTracked.has(songKey)) {
            console.log(`✅ [Player] 30-second threshold reached for: ${currentSong.title}`);
            console.log(`⏱️ CALLING recordListen function...`);
            recordListen(currentSong);
            listenTracked.add(songKey);
            console.log(`⏱️ recordListen function completed for: ${currentSong.title}`);
          }
        }
      }
    }
  });

  // Waveform is loaded from backend when song starts playing
  audio.addEventListener('canplay', () => {
    if (window.waveformRenderer) {
      waveformDataGenerated = true;
    }
  });

  // Song end - backup recording for edge cases
  audio.addEventListener("ended", () => {
    if (currentSong && currentSongReady) {
      const songKey = currentSong.file || currentSong.id || currentSong.songId || currentSong.title;
      if (!listenTracked.has(songKey)) {
        recordListen(currentSong);
        listenTracked.add(songKey);
      }
    }
    handleEnd();
    syncPlayerIcons();
  });

  audio.addEventListener("play", () => {
    playIcon.style.display = "none";
    pauseIcon.style.display = "block";
    updateFullPlayerPlayPause(true);
    syncPlayerIcons();
    savePlayerState();
  });

  audio.addEventListener("pause", () => {
    playIcon.style.display = "block";
    pauseIcon.style.display = "none";
    updateFullPlayerPlayPause(false);
    syncPlayerIcons();
    savePlayerState();
  });

  // Player options menu button - attach to SVG
  const playerMenuSvg = playerMenuBtn?.querySelector("svg");
  playerMenuSvg?.addEventListener("click", (e) => {
    e.stopPropagation();
    optionsMenu?.classList.toggle("show");
  });

  // Options menu
  document.addEventListener("click", () => {
    optionsMenu?.classList.remove("show");
  });

  optionsMenu?.addEventListener("click", (e) => e.stopPropagation());

  // Options menu actions
  optionsMenu?.querySelectorAll(".option").forEach((opt) => {
    opt.addEventListener("click", () => handleOptionClick(opt.dataset.action));
  });

  // Repeat toggle in menu - attach to SVG
  const repeatBtn = document.getElementById("repeatBtn");
  const repeatSvg = repeatBtn?.querySelector("svg");
  repeatSvg?.addEventListener("click", (e) => {
    e.stopPropagation();
    isRepeat = !isRepeat;
    repeatBtn.classList.toggle("active", isRepeat);
    localStorage.setItem("amplyRepeat", isRepeat);
  });

  // Shuffle toggle in menu - attach to SVG
  const shuffleBtn = document.getElementById("shuffleBtn");
  const shuffleSvg = shuffleBtn?.querySelector("svg");
  shuffleSvg?.addEventListener("click", (e) => {
    e.stopPropagation();
    isShuffle = !isShuffle;
    shuffleBtn.classList.toggle("active", isShuffle);
    localStorage.setItem("amplyShuffle", isShuffle);
  });

  setupFullPlayerEvents();
}

// ===============================
// FULL PLAYER LOGIC
// ===============================
function setupFullPlayerEvents() {
  // Open Full Player when clicking player bar (except buttons)
  playerBar?.addEventListener("click", (e) => {
    // Don't open if clicking the play button itself
    if (e.target.closest(".player-play-pause") || e.target.closest(".player-album-art")) {
      return;
    }

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

  // Next track in full player
  fullNextBtn?.addEventListener("click", () => {
    if (!playlist.length) return;

    if (isShuffle) {
      currentIndex = Math.floor(Math.random() * playlist.length);
    } else {
      currentIndex = (currentIndex + 1) % playlist.length;
    }

    playSong(playlist[currentIndex], playlist);
  });

  // Previous track in full player
  fullPrevBtn?.addEventListener("click", () => {
    if (!playlist.length) return;

    currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    playSong(playlist[currentIndex], playlist);
  });

  // Shuffle toggle
  fullShuffleBtn?.addEventListener("click", () => {
    isShuffle = !isShuffle;
    fullShuffleBtn?.classList.toggle("active", isShuffle);
    localStorage.setItem("amplyShuffle", isShuffle);
  });

  // Repeat toggle
  fullRepeatBtn?.addEventListener("click", () => {
    isRepeat = !isRepeat;
    fullRepeatBtn?.classList.toggle("active", isRepeat);
    localStorage.setItem("amplyRepeat", isRepeat);
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
  fullPlayerArt.src = currentSong.art_url || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%23667eea'/%3E%3Cstop offset='100%25' style='stop-color:%23764ba2'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='url(%23g)' width='200' height='200'/%3E%3C/svg%3E";

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

// Helper to get current user from token
function getCurrentUser() {
  const token = getAuthToken();
  if (!token) return null;
  const payload = parseJwt(token);
  return { userId: payload.sub, email: payload.email };
}

export async function addToPlaylist(song) {
  if (!song) {
    alert("No song selected");
    return;
  }
  
  // Validate song has required fields
  if (!song.songId && !song.file) {
    alert("Invalid song data - missing songId or file");
    return;
  }

  if (!song.title) song.title = "Unknown Track";
  if (!song.artist) song.artist = "Unknown Artist";
  
  try {
    const user = getCurrentUser();
    if (!user) {
      alert("Please log in first");
      return;
    }

    // Fetch user's playlists
    const data = await apiFetch(`${API_URL}/playlists?userId=${encodeURIComponent(user.userId)}`);
    const playlists = data.playlists || [];

    // Import the nice playlist selector modal
    const { showPlaylistSelector } = await import("./listener/listener-integration.js");
    const playlistId = await showPlaylistSelector(playlists, song.title);
    
    if (!playlistId) return; // User cancelled

    // Add song to playlist (only send songId to maintain single source of truth)
    await apiFetch(`${API_URL}/playlists`, {
      method: "PUT",
      body: JSON.stringify({
        userId: user.userId,
        playlistId,
        action: "add",
        song: {
          songId: song.songId || song.file,
        },
      }),
    });

    alert(`✅ Added "${song.title}" to playlist`);
  } catch (err) {
    console.error("❌ Add to playlist error:", err);
    alert("Failed to add to playlist: " + err.message);
  }
}

export function addToQueue(song) {
  if (!song) return;
  console.log("⏳ Add to queue:", song);
  // Placeholder for queue functionality
  alert(`Added "${song.title}" to queue.`);
}

export async function addToLibrary(song) {
  if (!song) {
    alert("No song selected");
    return;
  }

  // Validate song has required fields
  if (!song.songId && !song.file) {
    alert("Invalid song data - missing songId or file");
    return;
  }

  if (!song.title) song.title = "Unknown Track";
  if (!song.artist) song.artist = "Unknown Artist";
  
  try {
    const user = getCurrentUser();
    if (!user) {
      alert("Please log in first");
      return;
    }

    console.log("📝 Liking song:", {
      userId: user.userId,
      songId: song.songId,
      file: song.file,
      title: song.title,
      artist: song.artist,
    });

    // Call like-song endpoint
    await apiFetch(`${API_URL}/like-song`, {
      method: "POST",
      body: JSON.stringify({
        userId: user.userId,
        songId: song.songId || song.file,
        artistId: song.artistId || song.artist,
        songName: song.title,
      }),
    });

    console.log("❤️ Added to library:", song.title);
    alert(`❤️ Saved "${song.title}" to your library.`);
  } catch (err) {
    console.error("❌ Add to library error:", err);
    alert("Failed to save to library: " + err.message);
  }
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
    fullRepeatBtn?.classList.add("active");
  }

  if (localStorage.getItem("amplyShuffle") === "true") {
    isShuffle = true;
    shuffleBtn?.classList.add("active");
    fullShuffleBtn?.classList.add("active");
  }
  
  // Restore player state (current song, position, playback status)
  restorePlayerState();
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
  playlistId = null,
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
  const isPaused = audio ? audio.paused : true;

  songs.forEach((song) => {
    const div = document.createElement("div");
    const safeId = song.id || song.songId || song.file || song.title;
    div.dataset.songId = safeId;

    // Check if this song is currently playing
    const isCurrentlyPlaying = currentSongId === safeId && !isPaused;
    const isCurrentSong = currentSongId === safeId;

    if (layout === "grid") {
      div.className = `song-box ${isCurrentSong ? 'playing' : ''}`;
      div.innerHTML = `
        <img src="${song.art_url || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%23667eea'/%3E%3Cstop offset='100%25' style='stop-color:%23764ba2'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='url(%23g)' width='200' height='200'/%3E%3C/svg%3E"}" class="cover-art" />

        <div class="song-info-box" data-artist="${song.artist}">
          <span class="song-title-box">${song.title}</span>
          <span class="song-artist-box"><span class="go-artist">${song.artist}</span></span>
        </div>

        <button class="song-play-btn-box">
          <svg class="play-icon-box" width="40" height="40"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"
            style="display:${isCurrentlyPlaying ? 'none' : 'block'}" transform="translate(2, 0)">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>

          <svg class="pause-icon-box" width="40" height="40"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"
            style="display:${isCurrentlyPlaying ? 'block' : 'none'}">
            <rect x="6" y="4" width="4" height="16"></rect>
            <rect x="14" y="4" width="4" height="16"></rect>
          </svg>
        </button>
      `;
    } else {
      div.className = `song-list ${isCurrentSong ? 'playing' : ''}`;
      div.innerHTML = `
        <img src="${song.art_url || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%23667eea'/%3E%3Cstop offset='100%25' style='stop-color:%23764ba2'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='url(%23g)' width='200' height='200'/%3E%3C/svg%3E"}" class="cover-art" />

        <div class="song-info-list" data-artist="${song.artist}">
          <span class="song-title-list">${song.title}</span>
          <span class="song-artist-list"><span class="go-artist">${song.artist}</span></span>
          <svg
            class="song-option"
            xmlns="http://www.w3.org/2000/svg"
            width="26"
            height="26"
            fill="none"
            stroke="currentColor"
            stroke-width="1.2"
            stroke-linecap="round"
            stroke-linejoin="round"
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="5" r="1.5"></circle>
            <circle cx="12" cy="12" r="1.5"></circle>
            <circle cx="12" cy="19" r="1.5"></circle>
          </svg>
        </div>

        <button class="song-like-btn" data-action="like" data-song-id="${safeId}" data-artist-id="${song.artistId || ''}" data-song-name="${song.title || ''}">
          🤍
        </button>

        <button class="song-play-btn-list">
          <svg class="play-icon-list" width="40" height="40"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"
            style="display:${isCurrentlyPlaying ? 'none' : 'block'}">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>

          <svg class="pause-icon-list" width="40" height="40"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"
            style="display:${isCurrentlyPlaying ? 'block' : 'none'}">
            <rect x="6" y="4" width="4" height="16"></rect>
            <rect x="14" y="4" width="4" height="16"></rect>
          </svg>
        </button>
      `;
    }

    setupPlayButton(div, { ...song, id: safeId }, songs);
    
    // Add context menu handler for song options (3-dot menu)
    const optionBtn = div.querySelector(".song-option");
    if (optionBtn) {
      optionBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await showSongContextMenu(optionBtn, { ...song, id: safeId }, playlistId);
      });
    }
    
    trackList.appendChild(div);
  });
}

// ===============================
// PLAY BUTTON LOGIC PER CARD
// ===============================
function setupPlayButton(div, song, fullList) {
  // Get the specific SVG icons if they exist
  const playIconEl = div.querySelector(".play-icon-list, .play-icon-box");
  const pauseIconEl = div.querySelector(".pause-icon-list, .pause-icon-box");

  // Click handler for playing the song
  const handlePlay = () => {
    console.log('🎵 [Player] Playing song:', song.title);
    
    // Toggle if already playing
    if (window.currentSong && window.currentSong.id === song.id) {
      if (audio.paused) {
        // Resume playback
        audio.play();
      } else {
        // Pause playback
        audio.pause();
      }

      // Sync all cards with the current state
      syncPlayerIcons();
      return;
    }

    // Play the newly selected song
    playSong(song, fullList);
  };

  // Make entire song box clickable (except for restricted areas)
  div.addEventListener("click", (e) => {
    // Ignore if clicking artist name (user request)
    if (e.target.closest(".song-artist-box") || e.target.closest(".song-artist-list")) return;
    
    // Ignore if clicking song title 
    if (e.target.closest(".song-title-box") || e.target.closest(".song-title-list")) return;
    
    // Ignore if clicking options menu
    if (e.target.closest(".song-option")) return;

    console.log('🎵 [Player] Song box clicked for:', song.title);
    handlePlay();
  });
}

// ===============================
// SONG CONTEXT MENU
// ===============================
async function showSongContextMenu(triggerElement, song, playlistId) {
  // Remove any existing menu
  const existingMenu = document.querySelector(".song-context-menu");
  if (existingMenu) existingMenu.remove();

  // Create context menu
  const menu = document.createElement("div");
  menu.className = "song-context-menu";
  menu.style.cssText = `
    position: fixed;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    z-index: 10000;
    min-width: 180px;
  `;

  // Like/Unlike Song option
  try {
    console.log("Loading likes.js and song data:", song);
    const likeModule = await import("./listener/likes.js");
    const { isSongLiked, likeSong, unlikeSong } = likeModule;
    
    // Use the file property since that's what playlists store
    const songId = song.file || song.songId || song.id;
    console.log("Song ID for like check:", songId);
    console.log("Full song object:", JSON.stringify(song));
    
    const isLiked = await isSongLiked(songId);
    console.log("Is song liked?", isLiked);
    
    const likeItem = document.createElement("div");
    likeItem.style.cssText = `
      padding: 12px 16px;
      cursor: pointer;
      border-bottom: 1px solid var(--border-color);
      transition: background-color 0.2s;
    `;
    likeItem.textContent = isLiked ? "Unlike Song" : "Like Song";
    likeItem.addEventListener("mouseenter", () => {
      likeItem.style.backgroundColor = "var(--bg-tertiary)";
    });
    likeItem.addEventListener("mouseleave", () => {
      likeItem.style.backgroundColor = "transparent";
    });
    likeItem.addEventListener("click", async () => {
      menu.remove();
      try {
        console.log("Like/Unlike clicked, current isLiked:", isLiked);
        if (isLiked) {
          await unlikeSong(songId);
        } else {
          const artistId = song.artist || song.artistId || "";
          const songName = song.title || "Unknown";
          console.log("Liking song:", songId, artistId, songName);
          await likeSong(songId, artistId, songName);
        }
        
        // Refresh library view if it's currently displayed
        const viewRoot = document.getElementById("viewRoot");
        const currentHash = window.location.hash.slice(1);
        if (currentHash === "library" && viewRoot) {
          try {
            const { initLibraryView } = await import("./listener/library.js");
            await initLibraryView();
            console.log("Library view refreshed after like/unlike");
          } catch (err) {
            console.error("Failed to refresh library:", err);
          }
        }
      } catch (err) {
        console.error("Error toggling like:", err);
        alert("Failed to update like status");
      }
    });
    menu.appendChild(likeItem);
    console.log("Like item appended to menu");
  } catch (err) {
    console.error("Error loading like functionality:", err);
    console.error("Error stack:", err.stack);
  }

  // Remove from Playlist option (only if viewing a playlist)
  if (playlistId) {
    const removeItem = document.createElement("div");
    removeItem.style.cssText = `
      padding: 12px 16px;
      cursor: pointer;
      color: var(--text-danger, #ff6b6b);
      transition: background-color 0.2s;
    `;
    removeItem.textContent = "Remove from Playlist";
    removeItem.addEventListener("mouseenter", () => {
      removeItem.style.backgroundColor = "var(--bg-tertiary)";
    });
    removeItem.addEventListener("mouseleave", () => {
      removeItem.style.backgroundColor = "transparent";
    });
    removeItem.addEventListener("click", async () => {
      menu.remove();
      try {
        // Import dynamically to avoid circular dependency
        const { removeSongFromPlaylist } = await import("./listener/playlists.js");
        // Use file as the identifier since that's what's stored
        await removeSongFromPlaylist(playlistId, song.file || song.songId || song.id);
        
        // Refresh the playlist view
        const { initPlaylistView } = await import("./listener/playlist.js");
        await initPlaylistView(playlistId);
      } catch (err) {
        console.error("Error removing song:", err);
        alert("Failed to remove song from playlist");
      }
    });
    menu.appendChild(removeItem);
  }

  // Position menu near cursor
  const rect = triggerElement.getBoundingClientRect();
  menu.style.top = (rect.bottom + 5) + "px";
  menu.style.left = (rect.left - 150) + "px";

  document.body.appendChild(menu);

  // Close menu when clicking elsewhere
  const closeMenu = (e) => {
    if (!menu.contains(e.target) && !triggerElement.contains(e.target)) {
      menu.remove();
      document.removeEventListener("click", closeMenu);
    }
  };
  document.addEventListener("click", closeMenu);
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

// ===============================
// MOBILE SWIPE CONTROLS
// ===============================
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;

function handleSwipe() {
  const diffX = touchStartX - touchEndX; // positive = swiped left, negative = swiped right
  const diffY = touchEndY - touchStartY; // positive = swiped down, negative = swiped up

  // Minimum swipe distance (30px)
  const minSwipeDistance = 30;

  // Check for vertical swipe (down) to close full player
  if (diffY > minSwipeDistance && fullPlayer && !fullPlayer.classList.contains("hidden")) {
    fullPlayer.classList.add("hidden");
    return;
  }

  // Check for horizontal swipes (left = next, right = previous)
  if (Math.abs(diffX) > minSwipeDistance) {
    if (diffX > 0) {
      // Swiped left - next track
      nextBtn?.click();
    } else {
      // Swiped right - previous track
      prevBtn?.click();
    }
  }
}

// Add swipe listeners to full player
if (fullPlayer) {
  fullPlayer.addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  }, false);

  fullPlayer.addEventListener("touchend", (e) => {
    touchEndX = e.changedTouches[0].screenX;
    touchEndY = e.changedTouches[0].screenY;
    handleSwipe();
  }, false);
}

// Add swipe listeners to player bar
if (playerBar) {
  playerBar.addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  }, false);

  playerBar.addEventListener("touchend", (e) => {
    touchEndX = e.changedTouches[0].screenX;
    touchEndY = e.changedTouches[0].screenY;
    handleSwipe();
  }, false);
}

// ===============================
// EXPOSE TO WINDOW FOR CROSS-MODULE ACCESS
// ===============================
window.initializeWaveform = initializeWaveform;
window.playSong = playSong;