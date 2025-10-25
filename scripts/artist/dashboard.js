import { loadConfig, checkArtistConnected, API_URL } from "../general.js";

// On page load, check artist connection
window.addEventListener("DOMContentLoaded", async () => {
  const connected = checkArtistConnected();
  if (!connected) return;

  const config = loadConfig();
  console.log("🎛 Dashboard loaded for:", config.displayName);

  // Try fetching stats
  try {
    const res = await fetch(`${API_URL}/artist-stats`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        artistId: config.artistId,
        bucketName: config.bucketName,
        roleArn: config.roleArn,
      }),
    });

    if (!res.ok) throw new Error(`Status ${res.status}`);

    const stats = await res.json();
    renderStats(stats);
  } catch (err) {
    console.warn("⚠️ Using demo stats:", err.message);
    renderStats({
      revenueThisMonth: 142.5,
      totalBilled: 37.2,
      streamsThisMonth: 4231,
      topSongs: [
        { title: "Dr. Scott", plays: 1204 },
        { title: "Sunset Drive", plays: 947 },
        { title: "Late Nights", plays: 856 },
        { title: "Funky Times", plays: 605 },
      ],
    });
  }
});

function renderStats(stats) {
  document.querySelector(".metric-box:nth-child(1) p").textContent =
    `$${stats.revenueThisMonth.toFixed(2)}`;
  document.querySelector(".metric-box:nth-child(2) p").textContent =
    `$${stats.totalBilled.toFixed(2)}`;
  document.querySelector(".metric-box:nth-child(3) p").textContent =
    stats.streamsThisMonth.toLocaleString();

  const topList = document.querySelector(".top-songs ul");
  topList.innerHTML = "";
  stats.topSongs.forEach((song) => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${song.title}</strong> — ${song.plays.toLocaleString()} streams`;
    topList.appendChild(li);
  });
}