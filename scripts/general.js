// === GENERAL UTILITIES & AUTH MANAGEMENT ===

// 🌐 API endpoints
export const API_URL = "https://u7q5tko85l.execute-api.eu-north-1.amazonaws.com";
export const INDEX_URL =
  "https://amply-central-596430611327.s3.eu-north-1.amazonaws.com/amply-index.json";

// 🧠 Shorthand selectors
export const $ = (sel) => document.querySelector(sel);
export const $$ = (sel) => document.querySelectorAll(sel);

// 🎟️ Get current auth token
export function getAuthToken() {
  return localStorage.getItem("amplyIdToken");
}

// 🔐 Require authentication — redirect to login if not logged in
export function requireAuth() {
  const token = getAuthToken();

  if (!token) {
    console.warn("⚠️ Not logged in — redirecting to login page...");

    // detect where we are (listener, artist, or root)
    const path = window.location.pathname;

    let loginPath;
    if (path.includes("Amply-listener") || path.includes("Amply-artist")) {
      // going up two directories
      loginPath = "../../login.html";
    } else {
      // same level or root
      loginPath = "./login.html";
    }

    window.location.href = loginPath;
  }
}

// 📡 Authorized fetch helper (adds token automatically)
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

// 🧩 Decode JWT token (for checking Cognito groups etc.)
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

// 🎵 Load songs from the index JSON
export async function loadSongs() {
  try {
    const res = await fetch(INDEX_URL + "?v=" + Date.now());
    const data = await res.json();

    // Flatten artist → songs into one array
    return data.artists.flatMap((artist) =>
      artist.songs.map((song) => ({
        ...song,
        artist: artist.name,
        bucket: artist.bucket,
      }))
    );
  } catch (err) {
    console.error("❌ Failed to load songs:", err);
    return [];
  }
}

// 🚪 Optional: Logout helper
export function logout() {
  localStorage.removeItem("amplyIdToken");
  localStorage.removeItem("amplyAccessToken");
  localStorage.removeItem("amplyRefreshToken");
  window.location.href = "/login.html";
}

// ✅ Check if an artist is logged in
export function checkArtistConnected() {
  const token = localStorage.getItem("amplyIdToken");

  // not logged in? redirect to login page
  if (!token) {
    console.warn("⚠️ Artist not logged in — redirecting...");
    window.location.href = "/login.html";
    return false;
  }

  // optional: check if the user belongs to artist group
  try {
    const payload = parseJwt(token);
    const groups = payload["cognito:groups"] || [];

    if (!groups.includes("artist") && !groups.includes("admin")) {
      console.warn("⚠️ Not an artist — redirecting to listener page...");
      window.location.href = "../index.html";
      return false;
    }
  } catch (e) {
    console.error("JWT parsing failed", e);
    window.location.href = "../login.html";
    return false;
  }

  console.log("✅ Artist authenticated");
  return true;
}

// ✅ Placeholder for loading user config
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