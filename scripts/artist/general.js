// 💾 Save artist hosting config (provider-agnostic)
export function saveArtistConfig(data) {
  if (!data || !data.artistId) {
    console.error("Missing artist data:", data);
    return;
  }

  const config = {
    artistId: data.artistId,
    provider: data.provider || "aws", // Default to AWS for backward compatibility
    
    // AWS fields
    roleArn: data.roleArn,
    bucketName: data.bucketName,
    cloudfrontDomain: data.cloudfrontDomain,
    
    // GCP fields
    projectId: data.projectId,
    cdnDomain: data.cdnDomain,
    
    // Azure fields
    storageAccount: data.storageAccount,
    container: data.container,
    cdnEndpoint: data.cdnEndpoint,
    
    // Self-hosted fields
    apiEndpoint: data.apiEndpoint,
    uploadUrl: data.uploadUrl,
    cdnUrl: data.cdnUrl,
    
    // Common fields
    displayName: data.displayName || data.artistId,
  };

  localStorage.setItem("amplyArtistConfig", JSON.stringify(config));
  localStorage.setItem("artistProvider", data.provider || "aws");
  console.log("💾 Saved artist config:", config);
}

// 🔧 Load artist config from localStorage (provider-agnostic)
export function loadArtistConfig() {
  try {
    const config = JSON.parse(localStorage.getItem("amplyArtistConfig"));
    if (!config) throw new Error("No artist config found");
    
    // Ensure provider is set (backward compatibility with old configs)
    if (!config.provider) {
      config.provider = localStorage.getItem("artistProvider") || "aws";
    }
    
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