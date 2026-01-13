# Release-First Architecture - Frontend Integration Guide

## User Flow

### Artist Upload Flow (NEW)

```
Step 1: Create Release
├─ Get release metadata from user:
│  ├─ Release Type: single / EP / album
│  ├─ Title, Description
│  ├─ Cover Art
│  └─ Release Date
└─ API: POST /create-release
   ├─ Returns: releaseId
   └─ Status: DRAFT (no songs yet)

Step 2: Upload Songs to Release
├─ For each song:
│  ├─ Upload audio to S3 at: {artistId}/{releaseId}/{songId}.mp3
│  ├─ Get presigned URL from backend
│  └─ API: POST /release/{releaseId}/add-song
│     ├─ Body: { title, genre, duration, s3Key }
│     └─ Returns: songId
└─ Repeat until all songs uploaded

Step 3: Publish Release
└─ API: PUT /release/{releaseId}
   └─ Status: PUBLISHED
```

## API Reference

### 1. Create Release (Metadata Only)

```javascript
// POST /create-release
fetch("/create-release", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: JSON.stringify({
    releaseType: "single", // 'single', 'EP', 'album'
    title: "My Release",
    description: "About this release",
    coverArt: "https://...jpg", // Optional
    releaseDate: "2026-01-15",
  }),
});
// Response: { releaseId, artistId, status: 'draft', ... }
```

### 2. Add Song to Release

```javascript
// POST /release/{releaseId}/add-song
fetch(`/release/${releaseId}/add-song`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: JSON.stringify({
    title: "Song Title",
    genre: "Electronic",
    duration: 240, // Seconds
    s3Key: "songs/{artistId}/{releaseId}/song1.mp3",
  }),
});
// Response: { songId, releaseId, artistId, ... }
```

### 3. Get Songs in Release

```javascript
// GET /release/{releaseId}/songs
fetch(`/release/${releaseId}/songs`, {
  headers: { Authorization: `Bearer ${token}` },
});
// Response: { songs: [{ songId, title, genre, duration, ... }] }
```

### 4. Get Song Details

```javascript
// GET /songs/{songId}
fetch(`/songs/${songId}`, {
  headers: { Authorization: `Bearer ${token}` },
});
// Response: { songId, releaseId, artistId, title, genre, ... }
```

### 5. Remove Song from Release

```javascript
// DELETE /release/{releaseId}/song/{songId}
fetch(`/release/${releaseId}/song/${songId}`, {
  method: "DELETE",
  headers: { Authorization: `Bearer ${token}` },
});
// Response: { message: 'Song deleted' }
```

### 6. Update Release

```javascript
// PUT /release/{releaseId}
fetch(`/release/${releaseId}`, {
  method: "PUT",
  headers: { Authorization: `Bearer ${token}` },
  body: JSON.stringify({
    title: "Updated Title", // Optional
    description: "New description",
    coverArt: "https://...jpg",
    status: "published", // 'draft' or 'published'
  }),
});
// Response: { releaseId, status, ... }
```

## Frontend Files to Update

### 1. scripts/artist/upload.js

**Changes needed**:

- Add release creation step FIRST
- Change to loop-based song uploads (instead of batch)
- Update form UI to show release metadata fields
- Add song removal buttons for each uploaded song

**Current Flow** (OLD):

```
Upload Form → Submit Songs → /update-index
```

**New Flow**:

```
Upload Form → Create Release → Loop: Upload Song → Publish
```

### 2. scripts/artist/dashboard.js

**Changes needed**:

- Update "My Songs" to query releases instead
- Show songs grouped by release
- Add release management UI
- Add song removal functionality

### 3. scripts/listener/library.js

**Changes needed**:

- Update to query `GET /songs` (if searching individual songs)
- Or use existing endpoints for library display
- Maintain artist/release relationships in UI

### 4. scripts/listener/playlist.js

**Changes needed**:

- Songs are now identified by `songId` (not change needed if already using IDs)
- Ensure queries use updated DynamoDB structure

## Example: Upload Component

```javascript
// Step 1: Create Release
const releaseRes = await fetch("/create-release", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: JSON.stringify({
    releaseType: "single",
    title: "My New Release",
    description: "A fresh track",
    releaseDate: new Date().toISOString().split("T")[0],
  }),
});
const { releaseId } = await releaseRes.json();

// Step 2: Upload Songs
for (const file of audioFiles) {
  // Upload to S3
  const s3Key = `songs/${userId}/${releaseId}/${file.name}`;
  await uploadToS3(file, s3Key);

  // Register in database
  const songRes = await fetch(`/release/${releaseId}/add-song`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      title: file.name,
      genre: "Electronic",
      duration: 240,
      s3Key: s3Key,
    }),
  });
  const { songId } = await songRes.json();
  console.log("✅ Added song:", songId);
}

// Step 3: Publish Release
await fetch(`/release/${releaseId}`, {
  method: "PUT",
  headers: { Authorization: `Bearer ${token}` },
  body: JSON.stringify({ status: "published" }),
});
```

## Key UI Changes

### Upload Page (artist/upload.html)

```html
<!-- NEW: Release Metadata Form -->
<form id="releaseForm">
  <select name="releaseType" required>
    <option value="single">Single</option>
    <option value="EP">EP</option>
    <option value="album">Album</option>
  </select>
  <input type="text" name="title" placeholder="Release Title" required />
  <textarea name="description" placeholder="Description"></textarea>
  <input type="date" name="releaseDate" required />
</form>

<!-- CHANGED: Song Upload (repeatable) -->
<div id="songList">
  <div class="song-upload">
    <input type="file" accept="audio/*" required />
    <input type="text" placeholder="Song Title" />
    <input type="text" placeholder="Genre" />
    <button type="button" onclick="addSong()">Add This Song</button>
  </div>
</div>

<!-- NEW: Remove Button -->
<button type="button" onclick="removeSong(songId)">Remove</button>
```

### Dashboard (artist/dashboard.html)

```html
<!-- CHANGED: My Releases instead of My Songs -->
<section id="releases">
  <h2>My Releases</h2>
  <div class="release-card">
    <h3>Release Title</h3>
    <p>Type: Single | Date: 2026-01-15</p>
    <div class="songs">
      <div class="song-item">
        <span>Song 1</span>
        <button onclick="removeSong(releaseId, songId)">Remove</button>
      </div>
    </div>
    <button onclick="publishRelease(releaseId)">Publish</button>
    <button onclick="deleteRelease(releaseId)">Delete</button>
  </div>
</section>
```

## Error Handling

All endpoints return standard error responses:

```javascript
// Success
{ statusCode: 200|201, body: { data: ... } }

// Error
{ statusCode: 400|401|404|500, body: { error: "Message" } }
```

**Common Errors**:

- `401 Unauthorized`: Missing/invalid authorization token
- `403 Forbidden`: Trying to modify another artist's release
- `404 Not Found`: Release/song doesn't exist
- `400 Bad Request`: Missing required fields
- `500 Server Error`: Unexpected backend issue

## Testing

Use the test script to validate your integration:

```bash
python3 test_new_architecture.py
```

Expected output shows:

1. ✅ Create Release (201)
2. ✅ Add Song (201)
3. ✅ Get Songs (200)
4. ✅ Get Song Details (200)
5. ✅ Remove Song (200)
6. ✅ Verify Deleted (404)

## Deprecation Notice

The following endpoint is **DEPRECATED** and should not be used:

- `PUT /update-index` - Direct song uploads without releases

All song management must now go through the release-first flow:

1. Create release
2. Add songs to release
3. Publish when ready

---

**Questions?** Check [RELEASE_FIRST_ARCHITECTURE.md](./RELEASE_FIRST_ARCHITECTURE.md) for technical details.
