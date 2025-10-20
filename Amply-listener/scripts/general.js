// === GENERAL.JS ===

// 🔗 Core API and constants
export const API_URL = "https://u7q5tko85l.execute-api.eu-north-1.amazonaws.com";
export const INDEX_URL =
  "https://amply-central-596430611327.s3.eu-north-1.amazonaws.com/amply-index.json";

// 🎟️ Get token from localStorage (if logged in)
export function getAuthToken() {
  return localStorage.getItem("amplyIdToken");
}

// 🔐 Redirect to login if not authenticated
export function requireAuth() {
  const token = getAuthToken();
  if (!token) {
    console.warn("User not logged in — redirecting to login page.");
    window.location.href = "../login/login.html"; // adjust if your login page path differs
  }
}

// 📡 Generic fetch wrapper (handles auth + errors)
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

// 🎵 Fetch all songs from index.json
export async function loadSongs() {
  const res = await fetch(INDEX_URL + "?v=" + Date.now());
  const data = await res.json();
  return data.artists.flatMap((artist) =>
    artist.songs.map((song) => ({
      ...song,
      artist: artist.name,
      bucket: artist.bucket,
    }))
  );
}

// 🧠 Small helper for query selector shorthand
export const $ = (sel) => document.querySelector(sel);
export const $$ = (sel) => document.querySelectorAll(sel);

// 🚪 Optional: logout helper
export function logout() {
  localStorage.removeItem("amplyAccessToken");
  localStorage.removeItem("amplyIdToken");
  localStorage.removeItem("amplyRefreshToken");
  window.location.href = "../login/login.html";
}