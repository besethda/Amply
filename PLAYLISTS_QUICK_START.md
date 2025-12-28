# DynamoDB & Playlists/Likes - Quick Start

## ✅ What's Ready

1. **DynamoDB tables** - Already deployed and operational
2. **Lambda endpoints** - All playlist/like endpoints added to `amplyAPI`
3. **Frontend modules** - `playlists.js` and `likes.js` created
4. **Auto user creation** - When user logs in, automatically creates entry in DynamoDB

## 🚀 How to Add to Your UI

### 1. Add Like Button to Song Cards

In your song display component, add:

```html
<button
  class="like-btn"
  data-action="like"
  data-song-id="song123"
  data-artist-id="artist456"
  data-song-name="Song Title"
>
  🤍
</button>
```

Then in your JavaScript:

```javascript
import { initLikeButtons } from "../../scripts/listener/likes.js";

document.addEventListener("DOMContentLoaded", async () => {
  // Initialize all like buttons
  await initLikeButtons();
});
```

### 2. Add "Add to Playlist" Button

```html
<button class="add-playlist-btn" data-song-id="song123">
  + Add to Playlist
</button>
```

JavaScript handler:

```javascript
import {
  getUserPlaylists,
  addSongToPlaylist,
  createPlaylist,
} from "../../scripts/listener/playlists.js";

const addPlaylistBtns = document.querySelectorAll(".add-playlist-btn");

addPlaylistBtns.forEach((btn) => {
  btn.addEventListener("click", async (e) => {
    e.preventDefault();

    const songId = btn.dataset.songId;
    const playlists = await getUserPlaylists();

    // Show modal with playlist options
    showPlaylistModal(playlists, songId);
  });
});

async function showPlaylistModal(playlists, songId) {
  // Display playlists in a modal/dropdown
  // Let user select or create new

  const selected = prompt("Enter playlist name or select from list");
  if (!selected) return;

  let playlistId;
  const existing = playlists.find((p) => p.playlistName === selected);

  if (existing) {
    playlistId = existing.playlistId;
  } else {
    const newPlaylist = await createPlaylist(selected);
    playlistId = newPlaylist.playlistId;
  }

  // Add song to selected playlist
  await addSongToPlaylist(playlistId, {
    songId,
    songName: "Song Title", // Get from song data
    artistName: "Artist", // Get from song data
    bucket: "bucket-name",
    cloudfrontDomain: "d123.cloudfront.net",
  });
}
```

### 3. Create Playlists View

Create `listener/playlists.html` or add to existing view:

```html
<div id="playlistsContainer"></div>

<script type="module">
  import {
    getUserPlaylists,
    deletePlaylist,
  } from "../../scripts/listener/playlists.js";

  async function loadPlaylists() {
    const playlists = await getUserPlaylists();
    const container = document.getElementById("playlistsContainer");

    container.innerHTML = playlists
      .map(
        (p) => `
      <div class="playlist-card">
        <h3>${p.playlistName}</h3>
        <p>${p.description || "No description"}</p>
        <p>${p.songs?.length || 0} songs</p>
        <button onclick="deletePlaylist('${p.playlistId}')">Delete</button>
      </div>
    `
      )
      .join("");
  }

  loadPlaylists();
</script>
```

### 4. Create Liked Songs View

```html
<div id="likedSongsContainer"></div>

<script type="module">
  import { getLikedSongs } from "../../scripts/listener/likes.js";
  import { loadSongs } from "../../scripts/general.js";

  async function loadLikedSongs() {
    const allSongs = await loadSongs();
    const likedSongs = await getLikedSongs();
    const likedIds = new Set(likedSongs.map((l) => l.songId));

    const userLikedSongs = allSongs.filter((s) => likedIds.has(s.songId));

    const container = document.getElementById("likedSongsContainer");
    container.innerHTML = userLikedSongs
      .map(
        (song) => `
      <div class="song-card">
        <h4>${song.name}</h4>
        <p>${song.artist}</p>
        <button class="play-btn" data-song-id="${song.songId}">Play</button>
      </div>
    `
      )
      .join("");
  }

  loadLikedSongs();
</script>
```

## 📊 Current Data Flow

```
User Signup
  ↓
Cognito creates account
  ↓
Auto verification email sent
  ↓
User confirms email
  ↓
Auto-login happens
  ↓
Lambda creates user in DynamoDB
  ↓
User can now like songs & create playlists
  ↓
Likes/playlists stored in DynamoDB
  ↓
Next: Charge per listen via Stripe
```

## 🔧 API Ready to Call

All these endpoints are now live:

| Method | Endpoint                               | Purpose                 |
| ------ | -------------------------------------- | ----------------------- |
| POST   | `/create-user`                         | Create user in DynamoDB |
| GET    | `/playlists?userId=...`                | Get user's playlists    |
| POST   | `/playlists`                           | Create new playlist     |
| PUT    | `/playlists`                           | Add/remove songs        |
| DELETE | `/playlists?userId=...&playlistId=...` | Delete playlist         |
| POST   | `/like-song`                           | Like a song             |
| DELETE | `/unlike-song?userId=...&songId=...`   | Unlike a song           |
| GET    | `/liked-songs?userId=...`              | Get user's liked songs  |

## ✨ Next: Payment Integration

After you wire up playlists/likes to the UI, the next big task is:

1. **Charge per listen** - When song plays, call `/charge-listen` endpoint
2. **Balance management** - Show listener balance, allow top-up via Stripe
3. **Artist earnings** - Show how much artists are making from their songs

We already have `stripe-integration.ts` created with all the functions. Just need to:

1. Get Stripe API keys
2. Add Stripe endpoints to Lambda
3. Wire up payment buttons in UI

Let me know when you're ready!
