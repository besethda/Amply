# DynamoDB & Playlist/Likes Integration

## What's Been Set Up

### 1. **DynamoDB Integration** ✅

- **Tables Deployed** (all operational):
  - `amply-users-dev` - User profiles, preferences, following/followers
  - `amply-playlists-dev` - User playlists with songs
  - `amply-listen-history-dev` - Listen tracking + likes (dual purpose)
  - `amply-artist-config-dev` - Artist AWS credentials
  - `amply-follows-dev` - Follow relationships

### 2. **Lambda API Endpoints** ✅

#### User Management

- `POST /create-user` - Creates user on signup
  ```javascript
  POST ${API_URL}/create-user
  Body: { userId, email, username, displayName }
  ```

#### Playlist Operations

- `GET /playlists?userId=...` - Get all user playlists

  ```javascript
  GET ${API_URL}/playlists?userId=123
  ```

- `POST /playlists` - Create new playlist

  ```javascript
  POST ${API_URL}/playlists
  Body: { userId, playlistName, description }
  ```

- `PUT /playlists` - Add/remove songs from playlist

  ```javascript
  PUT ${API_URL}/playlists
  Body: { userId, playlistId, action: "add"|"remove", song: {...} }
  ```

- `DELETE /playlists?userId=...&playlistId=...` - Delete playlist
  ```javascript
  DELETE ${API_URL}/playlists?userId=123&playlistId=abc
  ```

#### Like Operations

- `POST /like-song` - Like a song

  ```javascript
  POST ${API_URL}/like-song
  Body: { userId, songId, artistId }
  ```

- `DELETE /unlike-song?userId=...&songId=...` - Unlike a song

  ```javascript
  DELETE ${API_URL}/unlike-song?userId=123&songId=song123
  ```

- `GET /liked-songs?userId=...` - Get user's liked songs
  ```javascript
  GET ${API_URL}/liked-songs?userId=123
  ```

### 3. **Frontend Modules** ✅

#### Playlist Management (`scripts/listener/playlists.js`)

```javascript
import {
  createPlaylist,
  getUserPlaylists,
  addSongToPlaylist,
  removeSongFromPlaylist,
  deletePlaylist,
} from "./playlists.js";

// Create playlist
const playlist = await createPlaylist("My Favorites", "My favorite songs");

// Get all playlists
const playlists = await getUserPlaylists();

// Add song to playlist
await addSongToPlaylist(playlistId, songObject);

// Remove song from playlist
await removeSongFromPlaylist(playlistId, songId);

// Delete playlist
await deletePlaylist(playlistId);
```

#### Likes Management (`scripts/listener/likes.js`)

```javascript
import {
  likeSong,
  unlikeSong,
  getLikedSongs,
  isSongLiked,
  initLikeButtons,
} from "./likes.js";

// Like a song
await likeSong(songId, artistId, songName);

// Unlike a song
await unlikeSong(songId);

// Get user's liked songs
const likedSongs = await getLikedSongs(); // Returns [{ songId, artistId }, ...]

// Check if song is liked
const isLiked = await isSongLiked(songId);

// Auto-initialize like buttons in HTML
await initLikeButtons(); // Finds all [data-action="like"] buttons
```

## How to Use in Frontend

### In HTML

```html
<!-- Like button -->
<button
  data-action="like"
  data-song-id="song123"
  data-artist-id="artist456"
  data-song-name="My Song"
  class="like-btn"
>
  🤍
</button>

<!-- Add to playlist button -->
<button
  data-action="add-to-playlist"
  data-song-id="song123"
  onclick="showPlaylistSelector(this)"
>
  + Playlist
</button>
```

### In JavaScript

```javascript
import { initLikeButtons } from "./scripts/listener/likes.js";
import {
  getUserPlaylists,
  addSongToPlaylist,
} from "./scripts/listener/playlists.js";

// On page load
document.addEventListener("DOMContentLoaded", async () => {
  // Initialize like buttons
  await initLikeButtons();

  // Load user's playlists for dropdown
  const playlists = await getUserPlaylists();
  console.log("User playlists:", playlists);
});
```

## Database Schema

### Users Table

```json
{
  "userId": "abc123",
  "email": "user@example.com",
  "username": "username",
  "displayName": "Display Name",
  "createdAt": "2025-12-28T...",
  "likedSongs": [],
  "followingArtists": []
}
```

### Playlists Table

```json
{
  "userId": "abc123",
  "playlistId": "abc123#1703875200000",
  "playlistName": "My Favorites",
  "description": "Songs I love",
  "songs": [
    {
      "songId": "song123",
      "songName": "Song Title",
      "artistName": "Artist Name",
      "bucket": "artist-bucket",
      "cloudfrontDomain": "d123.cloudfront.net"
    }
  ],
  "isPublic": false,
  "createdAt": "2025-12-28T...",
  "updatedAt": "2025-12-28T..."
}
```

### Listen History / Likes Table

```json
{
  "songId": "userId#songId",
  "timestamp": 1703875200000,
  "userId": "abc123",
  "artistId": "artist456",
  "type": "like"
}
```

## Next Steps

1. **Create user on signup** - Call `POST /create-user` after Cognito confirmation
2. **Add UI to listener pages** - Add like buttons and playlist selectors
3. **Create playlist view** - Show user's playlists with songs
4. **Create likes view** - Show "Liked Songs" library
5. **Integrate with Stripe** - When song is played, charge listener

## Testing

```bash
# Test create user
curl -X POST https://api.url/create-user \
  -H "Content-Type: application/json" \
  -d '{"userId":"123","email":"user@example.com"}'

# Test create playlist
curl -X POST https://api.url/playlists \
  -H "Content-Type: application/json" \
  -d '{"userId":"123","playlistName":"Test"}'

# Test like song
curl -X POST https://api.url/like-song \
  -H "Content-Type: application/json" \
  -d '{"userId":"123","songId":"song1","artistId":"artist1"}'
```

## Current Integration Status

- ✅ DynamoDB tables deployed
- ✅ Lambda endpoints created
- ✅ Frontend modules written
- ⏳ Next: Wire up to UI components
- ⏳ Next: Call `/create-user` on signup
- ⏳ Next: Add like buttons to song cards
- ⏳ Next: Build playlist pages
