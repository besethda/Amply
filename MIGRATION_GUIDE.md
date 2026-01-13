# Architecture Migration: Song-First → Release-First

## Summary of Changes

The Amply platform has shifted from a **song-first** architecture to a **release-first** architecture. This document outlines what changed and why.

## Old Architecture (DEPRECATED)

### Structure

```
Song (Primary Unit)
├─ Title, Genre, Duration
├─ artistId, s3Key
└─ Direct upload via /update-index
```

### Problems

1. ❌ Orphaned songs possible (no release context)
2. ❌ No way to group songs logically
3. ❌ Unclear artist intent (single vs album)
4. ❌ Hard to manage releases as units
5. ❌ No EP/album support

### Endpoints (DEPRECATED)

- `PUT /update-index` - Upload song directly (❌ NO LONGER USE)

### Database

```
amply-releases: UNUSED (just metadata container)
Songs: Scattered, no release hierarchy
S3: Unorganized: songs/{artistId}/{songId}.mp3
```

## New Architecture (CURRENT)

### Structure

```
Release (Primary Unit)
├─ Type: single/EP/album
├─ Metadata: title, description, coverArt, releaseDate
├─ Status: draft/published
└─ Songs[] (belongs-to relationship)
    ├─ Title, Genre, Duration
    ├─ artistId, s3Key
    └─ releaseId (FK)
```

### Benefits

1. ✅ Clear hierarchy (no orphans)
2. ✅ Logical grouping (songs belong to releases)
3. ✅ Artist intent explicit (single/EP/album)
4. ✅ Release-level management
5. ✅ Full EP/album support
6. ✅ Better library organization

### Endpoints (NEW)

- `POST /create-release` - Create empty release (metadata)
- `POST /release/{id}/add-song` - Add song to release
- `DELETE /release/{id}/song/{songId}` - Remove song
- `GET /release/{id}/songs` - List release songs
- `GET /songs/{songId}` - Get song details
- `PUT /release/{id}` - Update release (new)

### Database

```
amply-releases: Metadata-only
├─ PRIMARY KEY: artistId + releaseId
├─ releaseType, title, status
└─ releaseIdIndex (GSI)

amply-songs: Individual songs
├─ PRIMARY KEY: songId
├─ releaseId (FK), artistId (FK)
├─ releaseIdIndex (GSI)
└─ artistIdIndex (GSI)

S3: Release-organized: {artistId}/{releaseId}/{songId}.mp3
```

## Migration Guide

### For Frontend Developers

#### BEFORE (Old Upload Flow)

```javascript
// 1. Upload audio file to S3
const s3Key = `songs/${artistId}/${songId}.mp3`;
await uploadToS3(audioFile, s3Key);

// 2. Register in database
const result = await fetch("/update-index", {
  method: "PUT",
  body: JSON.stringify({
    artistId,
    songId,
    title,
    genre,
    duration,
    s3Key,
  }),
});
```

#### AFTER (New Upload Flow)

```javascript
// 1. Create release first
const releaseRes = await fetch("/create-release", {
  method: "POST",
  body: JSON.stringify({
    releaseType: "single",
    title: "Release Title",
    releaseDate: "2026-01-15",
  }),
});
const { releaseId } = await releaseRes.json();

// 2. Upload audio file to S3
const s3Key = `songs/${artistId}/${releaseId}/${songId}.mp3`;
await uploadToS3(audioFile, s3Key);

// 3. Register song with release
const songRes = await fetch(`/release/${releaseId}/add-song`, {
  method: "POST",
  body: JSON.stringify({
    title,
    genre,
    duration,
    s3Key,
  }),
});
const { songId } = await songRes.json();
```

### API Endpoint Mapping

| Purpose        | Old Endpoint        | New Endpoint                         | Notes                        |
| -------------- | ------------------- | ------------------------------------ | ---------------------------- |
| Upload Song    | `PUT /update-index` | `POST /release/{id}/add-song`        | 2-step: create release first |
| List Songs     | `GET /songs`        | `GET /release/{id}/songs`            | Now grouped by release       |
| Get Song       | `GET /songs/{id}`   | `GET /songs/{songId}`                | No change (same endpoint)    |
| Create Album   | ❌ Not supported    | `POST /create-release`               | Type: 'album'                |
| Delete Song    | ❌ Manual S3        | `DELETE /release/{id}/song/{songId}` | Automatic cleanup            |
| Manage Release | ❌ Not possible     | `PUT /release/{id}`                  | Status, metadata updates     |

### Database Query Changes

#### BEFORE: Get all songs by artist

```javascript
// Scan through all songs, filter by artistId
const songs = await query("amply-songs").where("artistId", "==", userId).get();
```

#### AFTER: Get all songs by artist

```javascript
// Option 1: Query via artistIdIndex
const songs = await query("amply-songs-dev")
  .where("artistId", "==", userId)
  .using("artistIdIndex")
  .get();

// Option 2: Get releases then songs
const releases = await query("amply-releases-dev")
  .where("artistId", "==", userId)
  .get();

for (const release of releases) {
  const songs = await query("amply-songs-dev")
    .where("releaseId", "==", release.releaseId)
    .using("releaseIdIndex")
    .get();
}
```

### S3 Path Changes

#### BEFORE

```
s3://amply-{artist-id}/songs/{artistId}/{songId}.mp3
```

#### AFTER

```
s3://amply-{artist-id}/songs/{artistId}/{releaseId}/{songId}.mp3
```

**Why**: Groups all songs in a release together for easier management and backups.

## Breaking Changes

### ❌ /update-index Endpoint Removed

- **Old**: `PUT /update-index` to upload songs
- **New**: Must create release first, then use `/release/{id}/add-song`
- **Migration**: Update all upload forms to follow new flow

### ❌ Direct Song Creation Removed

- **Old**: Could create songs without release context
- **New**: Songs MUST belong to a release
- **Migration**: Group existing songs into releases

### ❌ S3 Path Format Changed

- **Old**: `songs/{artistId}/{songId}.mp3`
- **New**: `songs/{artistId}/{releaseId}/{songId}.mp3`
- **Migration**: Needed for existing data

## Backwards Compatibility

### Listener Features (NO CHANGES)

Listeners don't care about releases - they still see:

- 🎵 Individual songs in library
- 🎵 Songs in playlists
- 🎵 Search results (individual songs)
- **No UI changes needed**

### Artist Dashboard (MUST UPDATE)

Artists now see:

- 📊 Releases instead of songs
- 📊 Songs grouped by release
- 📊 Release publish/draft status
- 📊 Remove songs from releases
- **UI changes required**

### Explore Page (OPTIONAL UPDATE)

Can display:

- Option 1: Individual songs (old way) - No changes
- Option 2: Releases + songs (new way) - Better browsing
- **Recommendation**: Show releases prominently, songs as items

## Rollout Plan

### Phase 1: Backend Ready (✅ COMPLETE)

- [x] Created amply-songs table
- [x] Updated release endpoints
- [x] Added song management endpoints
- [x] Deployed to Lambda
- [x] All tests passing

### Phase 2: Frontend Migration (IN PROGRESS)

- [ ] Update upload.js to new flow
- [ ] Update dashboard.js for releases
- [ ] Update any artist management pages
- [ ] Test full upload flow

### Phase 3: Library Updates (PENDING)

- [ ] Update library.js queries
- [ ] Update explore.js display
- [ ] Add release browsing option
- [ ] Test listener features

### Phase 4: Data Migration (OPTIONAL)

- [ ] Check for existing data
- [ ] Migrate to new structure
- [ ] Verify S3 paths
- [ ] Update any references

## Testing Checklist

- [ ] Create release via API
- [ ] Add song to release via API
- [ ] List songs in release via API
- [ ] Get individual song details via API
- [ ] Remove song from release via API
- [ ] Upload flow on frontend works
- [ ] Dashboard shows releases correctly
- [ ] Library still works for listeners
- [ ] Playlists still work
- [ ] Search still works

## FAQ

### Q: Can I still upload individual songs?

**A**: No. All songs must belong to a release. If uploading a single song, create a release with type 'single'.

### Q: What about my existing songs?

**A**: They'll need to be migrated. We can create a script to group them into releases automatically.

### Q: Do listeners see releases?

**A**: Not in the current UI. Listeners still see individual songs, but the backend now knows which release they belong to. We can add release browsing later.

### Q: Can I remove a song from a release?

**A**: Yes, use `DELETE /release/{id}/song/{songId}`. This removes it from both DynamoDB and S3.

### Q: Can I add a song to multiple releases?

**A**: No. Each song belongs to exactly one release. This prevents confusion and keeps data clean.

### Q: What's the difference between draft and published?

**A**: Draft releases are works-in-progress. Published releases are live (visible to listeners). Can toggle via `PUT /release/{id}` with `status: 'published'`.

---

**Questions?** See:

- [RELEASE_FIRST_ARCHITECTURE.md](./RELEASE_FIRST_ARCHITECTURE.md) - Technical details
- [FRONTEND_INTEGRATION_GUIDE.md](./FRONTEND_INTEGRATION_GUIDE.md) - Integration examples
