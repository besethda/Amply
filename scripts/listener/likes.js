import { API_URL, getAuthToken, parseJwt, apiFetch } from "../../scripts/general.js";

/**
 * LIKES MANAGEMENT
 * Like/unlike songs and manage liked songs library
 */

// Get current user from token
function getCurrentUser() {
  const token = getAuthToken();
  if (!token) return null;
  const payload = parseJwt(token);
  return { userId: payload.sub, email: payload.email };
}

// === LIKE SONG ===
export async function likeSong(songId, artistId, songName) {
  const user = getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  try {
    const response = await apiFetch(`${API_URL}/like-song`, {
      method: "POST",
      body: JSON.stringify({
        userId: user.userId,
        songId,
        artistId,
        songName,
      }),
    });

    console.log("❤️ Song liked");
    
    // Update UI
    updateLikeButton(songId, true);
    
    return response;
  } catch (err) {
    console.error("❌ Error liking song:", err);
    throw err;
  }
}

// === UNLIKE SONG ===
export async function unlikeSong(songId) {
  const user = getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  try {
    // Get the timestamp of when the song was liked
    const likedSongs = await getLikedSongs();
    const likedSong = likedSongs.find(s => s.songId === songId);
    const timestamp = likedSong?.timestamp || new Date().toISOString();
    
    const response = await apiFetch(
      `${API_URL}/unlike-song?userId=${encodeURIComponent(user.userId)}&songId=${encodeURIComponent(songId)}&timestamp=${encodeURIComponent(timestamp)}`,
      { method: "DELETE" }
    );

    console.log("💔 Song unliked");
    
    // Update UI
    updateLikeButton(songId, false);
    
    return response;
  } catch (err) {
    console.error("❌ Error unliking song:", err);
    throw err;
  }
}

// === GET LIKED SONGS ===
export async function getLikedSongs() {
  const user = getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  try {
    const response = await apiFetch(
      `${API_URL}/liked-songs?userId=${encodeURIComponent(user.userId)}`
    );

    console.log("📚 Liked songs:", response.likedSongs);
    return response.likedSongs || [];
  } catch (err) {
    console.error("❌ Error fetching liked songs:", err);
    return [];
  }
}

// === CHECK IF SONG IS LIKED ===
export async function isSongLiked(songId) {
  const likedSongs = await getLikedSongs();
  return likedSongs.some((like) => like.songId === songId);
}

// === UPDATE LIKE BUTTON UI ===
function updateLikeButton(songId, isLiked) {
  const buttons = document.querySelectorAll(`[data-song-id="${songId}"][data-action="like"]`);
  
  buttons.forEach((btn) => {
    if (isLiked) {
      btn.classList.add("liked");
      btn.innerHTML = "❤️";
    } else {
      btn.classList.remove("liked");
      btn.innerHTML = "🤍";
    }
  });
}

// === INITIALIZE LIKE BUTTONS ===
export async function initLikeButtons() {
  const likedSongs = await getLikedSongs();
  const likedSongIds = new Set(likedSongs.map((like) => like.songId));

  const likeButtons = document.querySelectorAll('[data-action="like"]');

  likeButtons.forEach((btn) => {
    const songId = btn.dataset.songId;
    const artistId = btn.dataset.artistId;
    const songName = btn.dataset.songName;

    // Set initial UI state
    if (likedSongIds.has(songId)) {
      btn.classList.add("liked");
      btn.innerHTML = "❤️";
    } else {
      btn.classList.remove("liked");
      btn.innerHTML = "🤍";
    }

    // Add click handler
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (btn.classList.contains("liked")) {
        await unlikeSong(songId);
      } else {
        await likeSong(songId, artistId, songName);
      }
    });
  });
}
