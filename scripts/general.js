// === GENERAL UTILITIES & AUTH MANAGEMENT ===

// 🌐 API endpoints
export const API_URL = "https://u7q5tko85l.execute-api.eu-north-1.amazonaws.com";
export const INDEX_URL =
  "https://amply-central-596430611327.s3.eu-north-1.amazonaws.com/amply-index.json";
  export const TEMPLATE_URL =
  "https://amply-templates.s3.eu-north-1.amazonaws.com/artist-environment.yml";

export const AMPLY_ACCOUNT_ID = "596430611327";
export const REGION = "eu-north-1";
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

// 🎵 Load songs from the global index file
export async function loadSongs() {
  try {
    const res = await fetch(INDEX_URL + "?v=" + Date.now());
    const data = await res.json();

    // Flatten artist → songs
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

export function checkArtistConnected() {
  const token = localStorage.getItem("amplyIdToken");
  if (!token) {
    console.warn("⚠️ No token found — redirecting to login...");
    window.location.href = "./../index.html";
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

// ✅ Load config.json (optional)
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

// 🚪 Logout helper
export function logout() {
  // 🧹 Clear local storage
  localStorage.removeItem("amplyIdToken");
  localStorage.removeItem("amplyAccessToken");
  localStorage.removeItem("amplyRefreshToken");

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