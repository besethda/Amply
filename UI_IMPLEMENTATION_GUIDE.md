# UI Implementation Guide - Where to Add Code

## Current File Structure

```
listener/
  listener.html       ← Add like & playlist buttons to songs here
  library.html        ← Show user's playlists
  playlist.html       ← Show songs in a playlist (NEW)
  views/
    home.html         ← Home view with songs
scripts/
  listener/
    listener.js       ← Main listener page logic
    likes.js          ← READY: Like functionality
    playlists.js      ← READY: Playlist functionality
```

## 1. Add Like & Playlist Buttons to Song Cards

### File: `listener/listener.html` (or `listener/views/home.html`)

Find your song card HTML (search for song display):

```html
<!-- Current structure (example) -->
<div class="song-card" id="song-{songId}">
  <h4>{songName}</h4>
  <p>{artistName}</p>
  <button class="play-btn">Play</button>
</div>
```

**Update to:**

```html
<div class="song-card" id="song-{songId}">
  <h4>{songName}</h4>
  <p>{artistName}</p>

  <!-- Like Button -->
  <button
    class="like-btn"
    data-action="like"
    data-song-id="{songId}"
    data-artist-id="{artistId}"
    data-song-name="{songName}"
    title="Like this song"
  >
    🤍
  </button>

  <!-- Add to Playlist Button -->
  <button
    class="add-to-playlist-btn"
    data-action="add-to-playlist"
    data-song-id="{songId}"
    data-song-name="{songName}"
    data-artist-name="{artistName}"
    data-bucket="{bucket}"
    data-cloudfront-domain="{cloudfrontDomain}"
    title="Add to playlist"
  >
    + Playlist
  </button>

  <button class="play-btn">Play</button>
</div>
```

### File: `scripts/listener/listener.js`

Add at the top:

```javascript
import { initLikeButtons } from "./likes.js";
import { getUserPlaylists } from "./playlists.js";
```

Add in `DOMContentLoaded` event:

```javascript
document.addEventListener("DOMContentLoaded", async () => {
  // ... existing code ...

  // Initialize like buttons
  try {
    await initLikeButtons();
    console.log("❤️ Like buttons ready");
  } catch (err) {
    console.warn("⚠️ Failed to init like buttons:", err);
  }

  // Load user's playlists
  try {
    const playlists = await getUserPlaylists();
    window.userPlaylists = playlists;
    console.log("📋 Playlists loaded:", playlists);
  } catch (err) {
    console.warn("⚠️ Failed to load playlists:", err);
  }
});
```

At the end of file, add:

```javascript
// === ADD TO PLAYLIST HANDLER ===
document.addEventListener("click", async (e) => {
  const btn = e.target.closest('[data-action="add-to-playlist"]');
  if (!btn) return;

  e.preventDefault();
  const songId = btn.dataset.songId;
  const songName = btn.dataset.songName;

  try {
    const playlistId = await showPlaylistSelector(
      window.userPlaylists || [],
      songName
    );

    if (playlistId) {
      const { addSongToPlaylist } = await import("./playlists.js");

      await addSongToPlaylist(playlistId, {
        songId,
        songName: btn.dataset.songName,
        artistName: btn.dataset.artistName,
        bucket: btn.dataset.bucket,
        cloudfrontDomain: btn.dataset.cloudfrontDomain,
      });

      btn.textContent = "✅ Added";
      btn.disabled = true;
      setTimeout(() => {
        btn.textContent = "+ Playlist";
        btn.disabled = false;
      }, 2000);
    }
  } catch (err) {
    console.error("❌ Failed to add to playlist:", err);
    alert("Failed to add to playlist");
  }
});

// === PLAYLIST SELECTOR MODAL ===
async function showPlaylistSelector(playlists, songName) {
  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.className = "playlist-modal-overlay";
    modal.innerHTML = `
      <div class="playlist-modal">
        <h3>Add to Playlist</h3>
        <p>Adding "<strong>${songName}</strong>"</p>
        
        <div class="playlist-options">
          ${playlists
            .map(
              (p) =>
                `<button class="playlist-option" data-id="${p.playlistId}">
              ${p.playlistName} (${p.songs?.length || 0} songs)
            </button>`
            )
            .join("")}
        </div>
        
        <div class="modal-form">
          <input 
            type="text" 
            id="newPlaylistName"
            placeholder="Create new playlist..."
          />
          <button id="createPlaylistBtn" class="btn-primary">Create</button>
        </div>
        
        <button id="cancelBtn" class="btn-secondary">Cancel</button>
      </div>
    `;

    document.body.appendChild(modal);

    // Select existing
    modal.querySelectorAll(".playlist-option").forEach((btn) => {
      btn.addEventListener("click", () => {
        modal.remove();
        resolve(btn.dataset.id);
      });
    });

    // Create new
    modal
      .querySelector("#createPlaylistBtn")
      .addEventListener("click", async () => {
        const name = modal.querySelector("#newPlaylistName").value.trim();
        if (!name) return alert("Enter playlist name");

        try {
          const { createPlaylist } = await import("./playlists.js");
          const newPlaylist = await createPlaylist(name);
          modal.remove();
          resolve(newPlaylist.playlistId);
        } catch (err) {
          alert("Failed to create playlist");
        }
      });

    // Cancel
    modal.querySelector("#cancelBtn").addEventListener("click", () => {
      modal.remove();
      resolve(null);
    });
  });
}
```

## 2. Create Playlists Page

### File: `listener/playlists.html` (NEW)

```html
<!DOCTYPE html>
<html>
  <head>
    <title>My Playlists - Amply</title>
    <link rel="stylesheet" href="../Styles/listener/playlist.css" />
  </head>
  <body>
    <header>
      <h1>My Playlists</h1>
      <button id="createPlaylistBtn" class="btn-primary">+ New Playlist</button>
    </header>

    <main>
      <div id="playlistsContainer" class="playlists-grid">
        <!-- Playlists loaded here -->
      </div>
    </main>

    <script type="module">
      import { requireAuth } from "../../scripts/general.js";
      import {
        getUserPlaylists,
        createPlaylist,
        deletePlaylist,
      } from "../../scripts/listener/playlists.js";

      requireAuth();

      async function loadPlaylists() {
        const container = document.getElementById("playlistsContainer");

        try {
          const playlists = await getUserPlaylists();

          container.innerHTML = playlists
            .map(
              (p) => `
          <div class="playlist-card">
            <h3>${p.playlistName}</h3>
            <p class="description">${p.description || "No description"}</p>
            <p class="song-count">${p.songs?.length || 0} songs</p>
            
            <div class="actions">
              <a href="playlist.html?id=${p.playlistId}" class="btn-secondary">
                View
              </a>
              <button 
                class="btn-danger"
                onclick="deleteAndRefresh('${p.playlistId}')"
              >
                Delete
              </button>
            </div>
          </div>
        `
            )
            .join("");
        } catch (err) {
          container.innerHTML = `<p class="error">Failed to load playlists</p>`;
        }
      }

      window.deleteAndRefresh = async (playlistId) => {
        if (!confirm("Delete this playlist?")) return;

        try {
          await deletePlaylist(playlistId);
          loadPlaylists();
        } catch (err) {
          alert("Failed to delete playlist");
        }
      };

      document
        .getElementById("createPlaylistBtn")
        .addEventListener("click", async () => {
          const name = prompt("Playlist name:");
          if (!name) return;

          try {
            await createPlaylist(name);
            loadPlaylists();
          } catch (err) {
            alert("Failed to create playlist");
          }
        });

      loadPlaylists();
    </script>
  </body>
</html>
```

## 3. Create Liked Songs Page

### File: `listener/liked-songs.html` (NEW)

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Liked Songs - Amply</title>
    <link rel="stylesheet" href="../Styles/listener/listener.css" />
  </head>
  <body>
    <header>
      <h1>❤️ Liked Songs</h1>
    </header>

    <main>
      <div id="likedSongsContainer" class="songs-container">
        <!-- Songs loaded here -->
      </div>
    </main>

    <script type="module">
      import { requireAuth, loadSongs } from "../../scripts/general.js";
      import { getLikedSongs } from "../../scripts/listener/likes.js";
      import { initLikeButtons } from "../../scripts/listener/likes.js";

      requireAuth();

      async function loadLikedSongs() {
        const container = document.getElementById("likedSongsContainer");

        try {
          const allSongs = await loadSongs();
          const likedSongs = await getLikedSongs();
          const likedIds = new Set(likedSongs.map((l) => l.songId));

          const userLikedSongs = allSongs.filter((s) => likedIds.has(s.songId));

          if (userLikedSongs.length === 0) {
            container.innerHTML =
              "<p>No liked songs yet. Start liking songs!</p>";
            return;
          }

          container.innerHTML = userLikedSongs
            .map(
              (song) => `
          <div class="song-card">
            <h4>${song.name}</h4>
            <p>${song.artist}</p>
            
            <button class="like-btn" 
              data-action="like"
              data-song-id="${song.songId}"
              data-artist-id="${song.artist}"
              data-song-name="${song.name}"
            >
              ❤️
            </button>
            
            <button class="play-btn" data-song-id="${song.songId}">
              Play
            </button>
          </div>
        `
            )
            .join("");

          // Initialize like buttons (already liked, but allow unlike)
          await initLikeButtons();
        } catch (err) {
          container.innerHTML = `<p class="error">Failed to load liked songs</p>`;
        }
      }

      loadLikedSongs();
    </script>
  </body>
</html>
```

## 4. Add CSS (Styling)

### File: `Styles/listener/listener.css`

Add these styles:

```css
/* Like Button */
.like-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.5rem;
  transition: transform 0.2s;
}

.like-btn:hover {
  transform: scale(1.2);
}

.like-btn.liked {
  color: #ff6b6b;
}

/* Add to Playlist Button */
.add-to-playlist-btn {
  padding: 0.5rem 1rem;
  background: #6366f1;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}

.add-to-playlist-btn:hover {
  background: #4f46e5;
}

/* Playlist Modal */
.playlist-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.playlist-modal {
  background: #1a1a1a;
  padding: 2rem;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  color: white;
}

.playlist-modal h3 {
  margin-bottom: 1rem;
}

.playlist-options {
  max-height: 300px;
  overflow-y: auto;
  margin-bottom: 1rem;
}

.playlist-option {
  width: 100%;
  padding: 1rem;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  color: white;
  cursor: pointer;
  margin-bottom: 0.5rem;
  border-radius: 4px;
  text-align: left;
}

.playlist-option:hover {
  background: #333;
}

.modal-form {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.modal-form input {
  flex: 1;
  padding: 0.75rem;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  color: white;
  border-radius: 4px;
}

.btn-primary,
.btn-secondary,
.btn-danger {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.95rem;
}

.btn-primary {
  background: #6366f1;
  color: white;
}

.btn-secondary {
  background: #3a3a3a;
  color: white;
}

.btn-danger {
  background: #ef4444;
  color: white;
}
```

## Summary

This gives you:

1. ❤️ Like buttons on every song
2. 📋 Add to playlist buttons
3. 📚 Playlists page to manage all playlists
4. 💕 Liked songs library page

All connected to DynamoDB and ready to use!
