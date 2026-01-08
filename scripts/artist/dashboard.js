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

  // Try fetching stats
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
    stats.topSongs.forEach((song) => {
      const li = document.createElement("li");
      li.innerHTML = `<strong>${song.title}</strong> — ${song.plays.toLocaleString()} streams`;
      topList.appendChild(li);
    });
  }
}