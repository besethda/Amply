import { loadConfig, checkArtistConnected, API_URL, parseJwt, getAuthToken } from "../general.js";

// On page load, check artist connection
window.addEventListener("DOMContentLoaded", async () => {
  const connected = checkArtistConnected();
  if (!connected) return;

  const config = await loadConfig();
  const artistProfile = JSON.parse(localStorage.getItem("amplyArtistProfile") || "{}");
  const displayName = config.displayName || artistProfile.artistName || "Artist";
  console.log("🎛 Dashboard loaded for:", displayName);

  // Get artistId from token or localStorage
  let artistId = config.artistId || localStorage.getItem("artistId");
  
  if (!artistId) {
    // Try to extract from token
    const token = getAuthToken();
    if (token) {
      const payload = parseJwt(token);
      artistId = payload.sub; // Use user ID as artist ID
    }
  }
  
  console.log("🎛 Using artistId:", artistId);

  // Load and display releases
  await loadAndDisplayReleases(artistId);

  // Also try fetching stats
  try {
    const res = await fetch(`${API_URL}/get-artist-analytics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        artistId: artistId,
      }),
    });

    if (!res.ok) throw new Error(`Status ${res.status}`);

    const analyticsData = await res.json();
    console.log("📊 Raw analytics data:", analyticsData);
    
    // Transform analytics data to dashboard format
    const stats = {
      revenueThisMonth: (analyticsData.totalListens || 0) * 0.005, // $0.005 per stream
      totalBilled: ((analyticsData.totalListens || 0) * 0.005) * 0.05, // 5% platform fee
      streamsThisMonth: analyticsData.totalListens || 0,
      topSongs: analyticsData.topSongs?.map(song => ({
        title: song.title,
        plays: song.listens
      })) || [],
    };
    
    console.log("📊 Transformed stats:", stats);
    renderStats(stats);
  } catch (err) {
    console.warn("⚠️ Using empty state:", err.message);
    renderStats({
      revenueThisMonth: 0,
      totalBilled: 0,
      streamsThisMonth: 0,
      topSongs: [],
    });
  }
});

// === LOAD AND DISPLAY RELEASES ===
async function loadAndDisplayReleases(artistId) {
  try {
    const token = getAuthToken();
    const res = await fetch(`${API_URL}/releases`, {
      method: "GET",
      headers: { 
        "Authorization": `Bearer ${token}`,
      },
    });

    if (!res.ok) throw new Error(`Status ${res.status}`);

    const data = await res.json();
    const releases = data.releases || [];
    console.log("📀 Loaded releases:", releases);

    renderReleases(releases);
  } catch (err) {
    console.error("❌ Error loading releases:", err);
    const releasesSection = document.getElementById("releasesSection");
    if (releasesSection) {
      releasesSection.innerHTML = `<p style="color: #ff6b6b;">Error loading releases: ${err.message}</p>`;
    }
  }
}

// === RENDER RELEASES ===
function renderReleases(releases) {
  const releasesSection = document.getElementById("releasesSection");
  if (!releasesSection) {
    console.warn("⚠️ releasesSection element not found");
    return;
  }

  if (releases.length === 0) {
    releasesSection.innerHTML = `
      <div style="padding: 2rem; text-align: center; color: #999;">
        <p>No releases yet. Start by uploading your first song!</p>
      </div>
    `;
    return;
  }

  releasesSection.innerHTML = "";

  releases.forEach(release => {
    const releaseCard = document.createElement("div");
    releaseCard.className = "release-card";
    releaseCard.innerHTML = `
      <div class="release-header">
        <div class="release-cover">
          <img src="${release.coverArt || '../images/Amply.png'}" alt="${release.title}" />
        </div>
        <div class="release-info">
          <h3>${release.title}</h3>
          <p class="release-type">${release.releaseType?.toUpperCase()} • ${new Date(release.releaseDate).toLocaleDateString()}</p>
          <p class="release-status" style="color: ${release.status === 'published' ? '#8df' : '#ff9f43'};">
            Status: ${release.status?.toUpperCase()}
          </p>
        </div>
      </div>
      <div class="release-actions">
        <button class="btn-small" onclick="viewReleaseSongs('${release.releaseId}')">View Songs</button>
        <button class="btn-small btn-secondary" onclick="editRelease('${release.releaseId}')">Edit</button>
        <button class="btn-small btn-danger" onclick="deleteRelease('${release.releaseId}')">Delete</button>
      </div>
    `;
    releasesSection.appendChild(releaseCard);
  });
}

// === VIEW RELEASE SONGS ===
async function viewReleaseSongs(releaseId) {
  try {
    const token = getAuthToken();
    const res = await fetch(`${API_URL}/release/${releaseId}/songs`, {
      method: "GET",
      headers: { 
        "Authorization": `Bearer ${token}`,
      },
    });

    if (!res.ok) throw new Error(`Status ${res.status}`);

    const data = await res.json();
    const songs = data.songs || [];
    console.log(`📀 Loaded ${songs.length} songs for release ${releaseId}`);

    showSongsModal(releaseId, songs);
  } catch (err) {
    alert(`Error loading songs: ${err.message}`);
  }
}

// === SHOW SONGS MODAL ===
function showSongsModal(releaseId, songs) {
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.onclick = () => modal.remove();

  const modalContent = document.createElement("div");
  modalContent.className = "modal-content";
  modalContent.onclick = (e) => e.stopPropagation();

  let songsHtml = `<h2>Songs in Release</h2>`;
  
  if (songs.length === 0) {
    songsHtml += `<p>No songs in this release yet.</p>`;
  } else {
    songsHtml += `<ul style="list-style: none; padding: 0;">`;
    songs.forEach((song, idx) => {
      songsHtml += `
        <li style="padding: 1rem 0; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong>${idx + 1}. ${song.title}</strong>
            <br><small style="color: #999;">${song.genre || 'No genre'} • ${song.duration || '?'}s</small>
          </div>
          <button class="btn-small btn-danger" onclick="removeSong('${releaseId}', '${song.songId}')">Remove</button>
        </li>
      `;
    });
    songsHtml += `</ul>`;
  }

  songsHtml += `<div style="margin-top: 1.5rem; text-align: right;">
    <button class="btn" onclick="this.closest('.modal-overlay').remove()">Close</button>
  </div>`;

  modalContent.innerHTML = songsHtml;
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
}

// === REMOVE SONG ===
async function removeSong(releaseId, songId) {
  if (!confirm("Are you sure you want to remove this song from the release?")) return;

  try {
    const token = getAuthToken();
    const res = await fetch(`${API_URL}/release/${releaseId}/song/${songId}`, {
      method: "DELETE",
      headers: { 
        "Authorization": `Bearer ${token}`,
      },
    });

    if (!res.ok) throw new Error(`Status ${res.status}`);

    alert("✅ Song removed successfully!");
    
    // Reload releases
    const config = await loadConfig();
    const artistId = config.artistId || localStorage.getItem("artistId");
    await loadAndDisplayReleases(artistId);
    
    // Close modal if open
    const modal = document.querySelector(".modal-overlay");
    if (modal) modal.remove();
  } catch (err) {
    alert(`❌ Error removing song: ${err.message}`);
  }
}

// === EDIT RELEASE ===
function editRelease(releaseId) {
  alert("Edit functionality coming soon! Release ID: " + releaseId);
}

// === DELETE RELEASE ===
async function deleteRelease(releaseId) {
  if (!confirm("Are you sure? This will delete the entire release and all its songs.")) return;

  try {
    const token = getAuthToken();
    const res = await fetch(`${API_URL}/release/${releaseId}`, {
      method: "DELETE",
      headers: { 
        "Authorization": `Bearer ${token}`,
      },
    });

    if (!res.ok) throw new Error(`Status ${res.status}`);

    alert("✅ Release deleted successfully!");
    
    // Reload releases
    const config = await loadConfig();
    const artistId = config.artistId || localStorage.getItem("artistId");
    await loadAndDisplayReleases(artistId);
  } catch (err) {
    alert(`❌ Error deleting release: ${err.message}`);
  }
}

function renderStats(stats) {
  document.querySelector(".metric-box:nth-child(1) p").textContent =
    stats.revenueThisMonth > 0 ? `$${stats.revenueThisMonth.toFixed(2)}` : "No revenue yet";
  document.querySelector(".metric-box:nth-child(2) p").textContent =
    stats.totalBilled > 0 ? `$${stats.totalBilled.toFixed(2)}` : "No earnings yet";
  document.querySelector(".metric-box:nth-child(3) p").textContent =
    stats.streamsThisMonth > 0 ? stats.streamsThisMonth.toLocaleString() : "No listens yet";

  const topList = document.querySelector(".top-songs ul");
  topList.innerHTML = "";
  
  if (stats.topSongs.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No songs with listens yet";
    topList.appendChild(li);
  } else {
    // Only show top 5 songs
    stats.topSongs.slice(0, 5).forEach((song) => {
      const li = document.createElement("li");
      li.innerHTML = `<strong>${song.title}</strong> — ${song.plays.toLocaleString()} streams`;
      topList.appendChild(li);
    });
  }
}

// === EXPOSE FUNCTIONS TO GLOBAL SCOPE ===
// This allows onclick handlers in dynamically generated HTML to call these functions
window.loadAndDisplayReleases = loadAndDisplayReleases;
window.viewReleaseSongs = viewReleaseSongs;
window.showSongsModal = showSongsModal;
window.removeSong = removeSong;
window.editRelease = editRelease;
window.deleteRelease = deleteRelease;