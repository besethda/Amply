// 💾 Save AWS environment info for artist
export function saveArtistConfig(data) {
  if (!data || !data.artistId) {
    console.error("Missing artist data:", data);
    return;
  }

  const config = {
    artistId: data.artistId,
    roleArn: data.roleArn,
    bucketName: data.bucketName,
    cloudfrontDomain: data.cloudfrontDomain,
    displayName: data.displayName || data.artistId,
  };

  localStorage.setItem("amplyArtistConfig", JSON.stringify(config));
  console.log("💾 Saved artist config:", config);
}

// 🔧 Load artist AWS config from localStorage
export function loadArtistConfig() {
  try {
    const config = JSON.parse(localStorage.getItem("amplyArtistConfig"));
    if (!config) throw new Error("No artist config found");
    return config;
  } catch (err) {
    console.error("❌ loadArtistConfig() failed:", err);
    return {};
  }
}

import { parseJwt } from "../general.js";

export function requireArtistAWS() {
  const token = localStorage.getItem("amplyIdToken");
  if (!token) {
    console.warn("❌ No auth token — redirecting to login.");
    window.location.href = "/index.html";
    return false;
  }

  const payload = parseJwt(token);
  const role = payload["custom:role"];
  const groups = payload["cognito:groups"] || [];

  const config = loadArtistConfig();

  // ✅ Allow access if they're an artist even if AWS isn't connected yet
  if (role === "artist" || groups.includes("artist") || groups.includes("admin")) {
    if (!config || !config.bucketName) {
      console.warn("⚠️ Artist AWS config not found. Staying on page (no redirect).");
    }
    return true;
  }

  // ❌ Non-artist users get redirected to listener home
  console.warn("❌ Not an artist — redirecting to listener.");
  window.location.href = "/listener/listener.html";
  return false;
}