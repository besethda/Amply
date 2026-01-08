// === ANALYTICS SCRIPT (Artist Dashboard) ===
// Display analytics for artist's songs

import { API_URL, logout } from "../general.js";
import { requireArtistAWS, loadArtistConfig } from "./general.js";

// ===== DOM ELEMENTS =====
const totalListensEl = document.getElementById("totalListens");
const totalDurationEl = document.getElementById("totalDuration");
const avgListenDurationEl = document.getElementById("avgListenDuration");
const topSongsListEl = document.getElementById("topSongsList");
const statusMessage = document.getElementById("status");
const timePeriodSelect = document.getElementById("timePeriod");
const logoutBtn = document.getElementById("logoutBtn");

let allAnalytics = null;

// ===== INIT =====
window.addEventListener("DOMContentLoaded", () => {
  requireArtistAWS();
  loadAnalytics();
});

if (logoutBtn) logoutBtn.addEventListener("click", logout);
if (timePeriodSelect) timePeriodSelect.addEventListener("change", () => {
  if (allAnalytics) renderAnalytics(allAnalytics);
});

// ===== LOAD ANALYTICS =====
async function loadAnalytics() {
  try {
    statusMessage.innerHTML = `<span style="color:#8df;">Loading analytics...</span>`;

    const config = loadArtistConfig();
    if (!config?.artistId) {
      statusMessage.textContent = "❌ Missing artist configuration.";
      return;
    }

    const res = await fetch(`${API_URL}/get-artist-analytics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        artistId: config.artistId,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to fetch analytics: ${errText}`);
    }

    const data = await res.json();
    allAnalytics = data;
    statusMessage.textContent = "";
    renderAnalytics(data);
  } catch (err) {
    console.error("❌ Error loading analytics:", err);
    statusMessage.innerHTML = `❌ Error: ${err.message}`;
  }
}

// ===== RENDER ANALYTICS =====
function renderAnalytics(analytics) {
  const timePeriod = timePeriodSelect?.value || "all";
  
  // Filter listens based on time period
  const filteredAnalytics = filterByTimePeriod(analytics, timePeriod);

  // Update metric cards
  totalListensEl.textContent = filteredAnalytics.totalListens || 0;
  const totalMinutes = Math.round((filteredAnalytics.totalDurationPlayed || 0) / 60);
  totalDurationEl.textContent = totalMinutes;

  // Calculate average listen duration
  const avgDuration = filteredAnalytics.totalListens > 0 
    ? Math.round((filteredAnalytics.totalDurationPlayed || 0) / filteredAnalytics.totalListens)
    : 0;
  avgListenDurationEl.textContent = avgDuration;

  // Render top songs
  renderTopSongs(filteredAnalytics.topSongs || []);
}

// ===== FILTER BY TIME PERIOD =====
function filterByTimePeriod(analytics, period) {
  // Note: The backend doesn't currently filter by time, so we'd need to do it client-side
  // or modify the endpoint. For now, return the full analytics.
  // In production, you'd want to timestamp each listen and filter accordingly.
  return analytics;
}

// ===== RENDER TOP SONGS =====
function renderTopSongs(topSongs) {
  topSongsListEl.innerHTML = "";

  if (!topSongs || topSongs.length === 0) {
    topSongsListEl.innerHTML = `
      <div class="empty-state">
        <p>No listen data yet</p>
        <p>Shares of your songs will appear here once listeners start playing them</p>
      </div>
    `;
    return;
  }

  topSongs.forEach((song, index) => {
    const rank = index + 1;
    let rankClass = "";
    if (rank === 1) rankClass = "gold";
    else if (rank === 2) rankClass = "silver";
    else if (rank === 3) rankClass = "bronze";

    const row = document.createElement("div");
    row.className = "song-row";
    row.innerHTML = `
      <div class="song-row-rank">
        <div class="song-rank-number ${rankClass}">#${rank}</div>
        <div class="song-info">
          <div class="song-info-title">Song ID: ${song.songId}</div>
          <div class="song-info-artist">${song.listenCount} ${song.listenCount === 1 ? 'play' : 'plays'}</div>
        </div>
      </div>
      <div class="song-row-stats">
        <div class="stat-item">
          <div class="stat-value">${song.listenCount}</div>
          <div class="stat-label">Listens</div>
        </div>
      </div>
    `;
    topSongsListEl.appendChild(row);
  });
}
