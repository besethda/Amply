# Frontend Updates - Release-First Architecture

## Summary

Updated the artist frontend to support the new release-first architecture. All forms now follow a 2-step flow: create release metadata first, then add songs to the release.

## Files Modified

### 1. scripts/artist/upload.js

**Changes**: Refactored upload flow to support 2-step release creation

#### Single Upload Changes

- **OLD FLOW**: Upload audio → Upload metadata → Create release (with songs array)
- **NEW FLOW**: Create release → Add song to release

**Key Changes**:

- Removed metadata file upload (`.json` files)
- Changed `/create-release` to only accept metadata (no songs array)
- Added `POST /release/{id}/add-song` call after release creation
- S3 path now: `songs/{artistId}/{releaseId}/{songId}.mp3`
- Removed unused `metaKey` variable

#### Album Upload Changes

- **OLD**: All songs uploaded, then single release created with all songs in one request
- **NEW**: Create release first, then loop through songs adding each one individually

**Key Changes**:

- Release created BEFORE song uploads (allows parallel uploads in future)
- Each song added via `POST /release/{id}/add-song`
- Simplified error handling (no songs array to validate)
- Duration estimated from file size (128kbps)

**Code**:

```javascript
// Step 1: Create release (metadata only)
const releaseRes = await fetch(`${API_URL}/create-release`, {...});
const releaseId = releaseData.releaseId;

// Step 2: Add songs to release
for (let idx = 0; idx < albumSongs.length; idx++) {
  const s3Key = `songs/${artistId}/${releaseId}/${songTitle}.mp3`;
  const addSongRes = await fetch(
    `${API_URL}/release/${releaseId}/add-song`,
    {...}
  );
}
```

### 2. scripts/artist/dashboard.js

**Changes**: Complete rewrite to show releases instead of just analytics

#### New Features

- **Load Releases**: `GET /releases` - Lists all artist releases
- **View Songs**: `GET /release/{id}/songs` - Shows songs in a release
- **Remove Song**: `DELETE /release/{id}/song/{songId}` - Remove song from release
- **Delete Release**: `DELETE /release/{id}` - Delete entire release
- **Edit Release**: Stub for future implementation

#### UI Changes

- Releases displayed as cards with:
  - Cover art thumbnail
  - Release title, type (SINGLE/EP/ALBUM), date
  - Status badge (draft/published)
  - Action buttons (View Songs, Edit, Delete)
- Modal dialog for viewing songs in release
- Song list with remove buttons
- Analytics metrics still displayed above releases

**Key Code**:

```javascript
async function loadAndDisplayReleases(artistId) {
  const res = await fetch(`${API_URL}/releases`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  const releases = await res.json();
  renderReleases(releases.releases);
}

function renderReleases(releases) {
  // Display release cards with actions
}
```

### 3. Styles/artist/dashboard.css

**Changes**: Added new styles for release cards and modal dialogs

#### New Styles

- `.release-card` - Main release container with hover effects
- `.release-cover` - Cover art thumbnail (120x120px)
- `.release-header` - Title, type, status info
- `.release-actions` - Button group (View, Edit, Delete)
- `.btn-small` - Small action buttons
- `.btn-secondary` - Secondary button variant
- `.btn-danger` - Danger button variant (red)
- `.modal-overlay` - Full-screen modal background
- `.modal-content` - Modal dialog box

#### Design

- Follows existing dark theme (#1a1a1a background)
- Accent colors (cyan for primary, red for danger)
- Smooth transitions and hover effects
- Responsive layout with flexbox

### 4. artist/dashboard.html

**Changes**: Added releases section

- Added `<div id="releasesSection">` for releases display
- Heading: "📀 My Releases"
- Loading placeholder text

## Flow Diagrams

### Old Single Upload

```
┌─────────────────┐
│ User fills form │
└────────┬────────┘
         ↓
┌─────────────────────┐
│ Upload audio to S3  │
└────────┬────────────┘
         ↓
┌──────────────────────┐
│ Upload metadata JSON │
└────────┬─────────────┘
         ↓
┌──────────────────────────────┐
│ POST /create-release         │
│ (with songs array)           │
└──────────────┬───────────────┘
               ↓
         ✅ Done
```

### New Single Upload

```
┌─────────────────┐
│ User fills form │
└────────┬────────┘
         ↓
┌──────────────────────────┐
│ POST /create-release     │
│ (metadata only)          │
└────────┬─────────────────┘
         ↓
┌──────────────────────┐
│ Upload audio to S3   │
└────────┬─────────────┘
         ↓
┌──────────────────────────────┐
│ POST /release/{id}/add-song  │
│ (register song with backend) │
└──────────────┬───────────────┘
               ↓
         ✅ Done
```

### Old Album Upload

```
┌──────────────────────┐
│ Upload all songs to S3 (loop)
└────────┬─────────────┘
         ↓
┌──────────────────────────┐
│ Build songs[] array      │
└────────┬─────────────────┘
         ↓
┌──────────────────────────────┐
│ POST /create-release         │
│ (with entire songs array)    │
└──────────────┬───────────────┘
               ↓
         ✅ Done
```

### New Album Upload

```
┌──────────────────────────┐
│ POST /create-release     │
│ (metadata only)          │
└────────┬─────────────────┘
         ↓
┌──────────────────────────┐
│ For each song:           │
│ 1. Upload audio to S3    │
│ 2. Add song to release   │
└────────┬─────────────────┘
         ↓
   ✅ Done
```

## API Endpoints Used

### Upload Flow

- `POST /create-release` - Create release without songs
- `POST /release/{id}/add-song` - Add song to release after upload

### Dashboard

- `GET /releases` - List all releases
- `GET /release/{id}/songs` - Get songs in a release
- `DELETE /release/{id}/song/{songId}` - Remove song
- `DELETE /release/{id}` - Delete release

## Testing Checklist

- [ ] Single upload flow works (create release → add song)
- [ ] Album upload flow works (create release → add all songs)
- [ ] Release cards display correctly
- [ ] Songs modal opens and closes properly
- [ ] Remove song button works
- [ ] Delete release button works
- [ ] Analytics metrics still display
- [ ] Cover art displays correctly
- [ ] Release status badge shows correctly
- [ ] Responsive design works on mobile

## Browser Console Tips

**Check releases load**:

```javascript
fetch("/releases")
  .then((r) => r.json())
  .then((d) => console.log("Releases:", d));
```

**Check song add**:

```javascript
const releaseId = "test-id";
fetch(`/release/${releaseId}/add-song`, {
  method: "POST",
  body: JSON.stringify({
    title: "Test Song",
    genre: "Electronic",
    duration: 240,
    s3Key: "songs/artist-id/release-id/song.mp3",
  }),
});
```

## Future Enhancements

- [ ] Edit release metadata (PUT /release/{id})
- [ ] Bulk upload (add multiple songs at once)
- [ ] Drag-drop file upload
- [ ] Preview release before publishing
- [ ] Set release publish date
- [ ] Add credits/collaborators to songs
- [ ] Set explicit content flag
- [ ] View release analytics

---

**Status**: ✅ Complete and Ready for Testing

**Last Updated**: January 13, 2026
