# Album/Single/EP System Implementation Plan

## Overview

Implement a comprehensive categorization system where every song must be classified as:

- **Single**: Standalone song release
- **EP**: Extended Play (typically 2-6 songs)
- **Album**: Full-length release (7+ songs)

## Database Schema Updates

### 1. New DynamoDB Table: `amply-releases` (stores album/EP/single metadata)

```
pk: `ARTIST#{artistId}`
sk: `RELEASE#{releaseId}`

Attributes:
- releaseId (UUID)
- artistId (String)
- releaseType (String: 'single' | 'ep' | 'album')
- title (String)
- description (String)
- releaseDate (ISO8601)
- coverArt (String - URL)
- genres (List of Strings)
- status (String: 'draft' | 'released' | 'archived')
- songIds (List of Strings - references to song metadata)
- createdAt (ISO8601)
- updatedAt (ISO8601)

GSI1:
pk: `ARTIST#{artistId}#TYPE#{releaseType}`
sk: `RELEASE#{releaseId}`
(For filtering releases by type)

GSI2:
pk: `LISTENER#RELEASE`
sk: `DATE#{releaseDate}`
(For discovery - newest releases)
```

### 2. Update Song Metadata Structure

Current: `songs/{title}.json`
New: Add fields:

```json
{
  "title": "Song Title",
  "artist": "Artist Name",
  "uploadType": "single",
  "genre": [],
  "art_url": "...",
  "file": "...",
  "uploaded_at": "...",

  // NEW FIELDS:
  "releaseId": "uuid-of-album-or-single",
  "releaseType": "single|ep|album",
  "trackNumber": 1,
  "albumTitle": "Album Name",
  "albumArtist": "Album Artist",
  "totalTracks": 10,
  "isrc": "International Standard Recording Code (optional)"
}
```

## Frontend Changes

### 1. Upload Flow Updates (`scripts/artist/upload.js`)

**Step 1**: Choose release type

- Single
- EP
- Album

**Step 2A - Single Upload**:

- Song title
- Genre
- Cover art
- Metadata
  → Creates new single (one-song release)

**Step 2B - EP/Album Upload**:

- Release title
- Release description
- Release cover art (different from song covers)
- Add multiple songs:
  - Song title
  - Track number
  - Genre per song
  - Individual cover (optional, use release cover as fallback)
- Set release date
  → Creates EP/Album with multiple tracks

### 2. Album Page (`listener/views/album.html`)

New page showing:

- Album/EP/Single cover
- Release title & artist
- Release date
- Description
- All tracks in order:
  - Track number
  - Song title
  - Duration
  - Genre
  - Play button
- Stats:
  - Total duration
  - Number of tracks
- Listener actions:
  - Add to playlist
  - Share
  - Like (entire release)

### 3. Artist Dashboard Updates (`artist/dashboard.html`)

New "Releases" tab showing:

- List of all releases grouped by type:
  - Singles
  - EPs
  - Albums
- Each release shows:
  - Cover art
  - Title
  - Release date
  - Number of tracks
  - Status (draft/released)
  - Edit button
  - Delete button
  - View details button
- Stats:
  - Total releases
  - Total songs
  - Earliest/latest release

### 4. Library Updates (`listener/views/library.html`)

Add filtering by release type:

- Show "Singles" section
- Show "EPs" section
- Show "Albums" section
- Search across all types

## Backend API Changes

### 1. New Endpoints (in `index.js`)

#### POST `/create-release`

```json
{
  "releaseType": "single|ep|album",
  "title": "Release Title",
  "description": "...",
  "coverArt": "...",
  "releaseDate": "2026-01-20",
  "songs": [
    {
      "title": "Song 1",
      "genre": ["Rock"],
      "trackNumber": 1,
      "fileKey": "songs/Song 1.mp3"
    }
  ]
}
```

Response: `releaseId`

#### GET `/releases?artistId=xxx&type=single|ep|album`

Returns: List of releases with metadata

#### GET `/release/{releaseId}`

Returns: Full release details with all songs

#### PUT `/release/{releaseId}`

Update release metadata (title, description, cover, etc.)

#### DELETE `/release/{releaseId}`

Archive/delete release

#### GET `/release/{releaseId}/songs`

Returns: All songs in release

### 2. Modified Endpoints

#### `/update-index` (POST)

Change from:

```json
{ "song": { ... } }
```

To:

```json
{
  "release": { ... },
  "songs": [ ... ]
}
```

Creates/updates both release and individual song records

#### `loadSongs()` (Frontend)

Modify to fetch both individual songs and songs from releases

## S3 Structure Changes

```
artist-bucket/
├── songs/
│   ├── song-title.mp3
│   ├── song-title.waveform.json
│   └── song-title.json (metadata)
│
├── releases/
│   ├── album-id.json (release metadata)
│   ├── album-id-cover.jpg
│   └── album-id/
│       ├── track-1.json
│       ├── track-2.json
│       └── ...
│
└── art/
    ├── song-cover.jpg
    └── album-cover.jpg
```

## Migration Plan

### Phase 1: Data Structure

1. Create new DynamoDB table
2. Update song metadata schema
3. Add releaseId & releaseType fields to existing songs

### Phase 2: Backend

1. Add new API endpoints
2. Update `/update-index` to handle releases
3. Add release retrieval endpoints

### Phase 3: Frontend - Artist

1. Update upload form for release type selection
2. Implement EP/Album multi-song upload
3. Create artist dashboard releases view

### Phase 4: Frontend - Listener

1. Create album page template
2. Update library to show release grouping
3. Add album view in discover

## Example Data Models

### Single

```json
{
  "releaseId": "uuid",
  "releaseType": "single",
  "title": "My Song",
  "artist": "Artist Name",
  "releaseDate": "2026-01-20",
  "coverArt": "url",
  "songs": ["song-id-1"]
}
```

### EP

```json
{
  "releaseId": "uuid",
  "releaseType": "ep",
  "title": "My EP",
  "artist": "Artist Name",
  "releaseDate": "2026-01-20",
  "description": "A short collection",
  "coverArt": "url",
  "songs": ["song-id-1", "song-id-2", "song-id-3"]
}
```

### Album

```json
{
  "releaseId": "uuid",
  "releaseType": "album",
  "title": "My Album",
  "artist": "Artist Name",
  "releaseDate": "2026-01-20",
  "description": "Full-length album",
  "coverArt": "url",
  "genres": ["Rock", "Indie"],
  "songs": ["song-id-1", "song-id-2", ..., "song-id-10"]
}
```

## Key Decisions

1. **Release vs Song**: Releases are the container, songs are individual tracks
2. **Cover Art**: One cover per release, but can override per-track if needed
3. **Backwards Compatibility**: Existing single uploads become single-type releases
4. **Discovery**: Albums/EPs featured on listener home, singles in "Latest Releases"

---

## Implementation Priority

**Start with:**

1. ✅ Database schema (DynamoDB table)
2. ✅ Song metadata updates
3. ✅ Backend release creation API
4. ✅ Album page frontend
5. ✅ Upload form changes

This foundational work allows future features like:

- Release analytics
- Pre-orders
- Collaborative albums
- Release scheduling
