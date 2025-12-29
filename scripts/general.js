//main links...
export const API_URL = "https://0c90n5h21f.execute-api.eu-north-1.amazonaws.com/prod";
export const INDEX_URL =
  "https://amply-central-596430611327.s3.eu-north-1.amazonaws.com/amply-index.json";
export const TEMPLATE_URL =
  "https://amply-templates.s3.eu-north-1.amazonaws.com/artist-environment.yml";

export const AMPLY_ACCOUNT_ID = "596430611327";
export const REGION = "eu-north-1";

export const $ = (sel) => document.querySelector(sel);
export const $$ = (sel) => document.querySelectorAll(sel);

//puts the auth token in localstorage
export function getAuthToken() {
  return localStorage.getItem("amplyIdToken");
}

//Load the amply index
export async function loadAmplyIndex() {
  try {
    const res = await fetch(INDEX_URL + "?v=" + Date.now());
    if (!res.ok) throw new Error(`Failed to fetch index: ${res.status}`);
    const indexData = await res.json();
    localStorage.setItem("amplyIndex", JSON.stringify(indexData));
    console.log("🎧 Loaded Amply Index:", indexData);
    return indexData;
  } catch (err) {
    console.error("❌ Failed to load index:", err);
    return null;
  }
}

// === 👤 Check if artist profile is complete ===
export function isArtistProfileComplete() {
  const artistProfile = JSON.parse(localStorage.getItem("amplyArtistProfile") || "{}");
  if (!artistProfile) return false;
  const hasName = !!artistProfile.artistName;
  const hasProfilePhoto = !!artistProfile.profilePhoto;
  const hasCoverPhoto = !!artistProfile.coverPhoto;
  const complete = hasName && hasProfilePhoto && hasCoverPhoto;
  console.log(
    `Profile completeness check: ${complete ? "Complete" : "Incomplete"}`,
    artistProfile
  );

  return complete;
}

// === 🔐 Require authentication — redirect to login if not logged in ===
export function requireAuth() {
  const token = getAuthToken();

  if (!token) {
    console.warn("⚠️ Not logged in — redirecting to login page...");

    const path = window.location.pathname;
    let loginPath;

    if (path.includes("listener") || path.includes("artist")) {
      loginPath = "./../index.html";
    } else {
      loginPath = "./../index.html";
    }

    window.location.href = loginPath;
  }
}

// === 📡 Authorized fetch helper (adds token automatically) ===
export async function apiFetch(url, options = {}) {
  const token = getAuthToken();

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: token } : {}),
    ...options.headers,
  };

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API Error: ${res.status} ${text}`);
  }
  return res.json();
}

// === 🧩 Decode JWT token (for checking Cognito groups etc.) ===
export function parseJwt(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error("❌ Failed to parse JWT:", e);
    return null;
  }
}

// loads the songs from amply-index in my account
export async function loadSongs() {
  try {
    const res = await fetch(INDEX_URL + "?v=" + Date.now());
    const data = await res.json();

    // Flatten artist → songs
    return data.artists.flatMap((artist) =>
      (artist.songs || []).map((song) => ({
        ...song,
        artist: artist.artistName || artist.name || "Unknown",
        bucket: artist.bucket,
      }))
    );
  } catch (err) {
    console.error("❌ Failed to load songs:", err);
    return [];
  }
}

export async function loadArtistByName(name) {
  try {
    const res = await fetch(INDEX_URL + "?v=" + Date.now());
    const data = await res.json();

    // Find all artists with matching name
    const matches = data.artists.filter(a =>
      (a.artistName || "").toLowerCase() === name.toLowerCase()
    );

    if (!matches.length) return null;

    // Merge multiple entries (your index has duplicates)
    const merged = {
      artistName: matches[0].artistName,
      artistId: matches[0].artistId,
      bio: matches[0].bio,
      bucket: matches[0].bucket,
      cloudfrontDomain: matches[0].cloudfrontDomain,
      profilePhoto: matches[0].profilePhoto,
      coverPhoto: matches[0].coverPhoto,
      songs: matches.flatMap(a => a.songs || [])
    };

    return merged;

  } catch (err) {
    console.error("❌ loadArtistByName failed:", err);
    return null;
  }
}

//Checks if the user is an artist or an admin
export function checkArtistConnected() {
  //if no token is found, redirects to login page
  const token = localStorage.getItem("amplyIdToken");
  if (!token) {
    console.warn("⚠️ No token found — redirecting to login...");
    window.location.href = "../index.html";
    return false;
  }

  try {
    const payload = parseJwt(token);
    console.log("🧠 Decoded token payload:", payload);

    // Prefer Cognito’s custom attribute if present
    const role = payload["custom:role"] || localStorage.getItem("role") || "listener";

    if (role !== "artist" && role !== "admin") {
      console.warn(`⚠️ User role is '${role}', not artist — redirecting...`);
      window.location.href = "./../index.html";
      return false;
    }

    console.log(`✅ Authenticated as ${role}`);
    return true;
  } catch (err) {
    console.error("❌ Failed to parse JWT or validate role:", err);
    window.location.href = "./../index.html";
    return false;
  }
}

//loads .json config file
export async function loadConfig() {
  try {
    const res = await fetch("../config.json");
    if (!res.ok) throw new Error("Missing config.json");
    return await res.json();
  } catch (err) {
    console.warn("⚠️ No config found:", err);
    return {};
  }
}

//logs out- removes local storage
export function logout() {
  console.log("🚪 Logging out and clearing session...");
  localStorage.removeItem("amplyIdToken");
  localStorage.removeItem("amplyAccessToken");
  localStorage.removeItem("amplyRefreshToken");
  localStorage.removeItem("amplyArtistConfig");
  localStorage.removeItem("amplyArtistProfile");
  localStorage.removeItem("amplyIndex");
  localStorage.removeItem("email");
  localStorage.removeItem("artistId");
  localStorage.removeItem("role");

  // 🔁 Redirect to login
  window.location.href = `${window.location.origin}/index.html`;
}

// Automatically attach event listener if logout button exists
document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", logout);
});

// Also expose globally (for inline onclick)
window.logout = logout;

// Export functions to window for use in inline scripts
window.getAuthToken = getAuthToken;
window.parseJwt = parseJwt;
window.apiFetch = apiFetch;
window.API_URL = API_URL;