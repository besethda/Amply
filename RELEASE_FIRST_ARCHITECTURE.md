# Release-First Architecture Implementation

## Overview

Successfully implemented a **release-first data model** where releases are the primary organizational unit and all songs must belong to exactly one release. This eliminates orphaned songs and provides a clear hierarchy for artist content.

## Architecture Decisions

### Core Principle

- **Every song MUST belong to a release** (single, EP, or album)
- Artists cannot upload orphaned songs
- Songs can be added/removed from releases independently
- Songs remain queryable individually for library/explore features

### Data Model

#### amply-releases-dev (Metadata Only)

- **Primary Key**: `artistId` (PK) + `releaseId` (SK)
- **Fields**:
  - `releaseType`: 'single' | 'EP' | 'album'
  - `title`, `description`, `coverArt`, `releaseDate`
  - `status`: 'draft' | 'published'
  - `createdAt`, `updatedAt`
- **GSI**: `releaseIdIndex` for direct release lookups
- **Note**: No embedded `songIds` array - songs tracked in separate table

#### amply-songs-dev (NEW)

- **Primary Key**: `songId`
- **Fields**:
  - `releaseId` (FK to releases)
  - `artistId` (FK to artist ownership)
  - `title`, `genre`, `duration`
  - `s3Key`: S3 file path
  - `createdAt`, `updatedAt`
- **GSIs**:
  - `releaseIdIndex`: Query all songs in a release
  - `artistIdIndex`: Query all songs by artist
- **Billing**: PAY_PER_REQUEST

### S3 Organization

```
{artistId}/{releaseId}/{songId}.mp3
```

Example: `206c09cc-5011-706f-dc48-45bda43e61bf/1957b24a-54aa-4315/song1.mp3`

## API Endpoints

### Release Management (Existing)

- `POST /create-release` - Create release metadata (NO songs array)
- `GET /releases` - List all releases for artist
- `GET /release/{id}` - Get release details
- `PUT /release/{id}` - Update release metadata
- `DELETE /release/{id}` - Delete entire release

### Song Management (NEW)

- `POST /release/{id}/add-song` - Add song to release
  - Request: `{ title, genre, duration, s3Key }`
  - Returns: `{ songId, releaseId, artistId, ... }`
- `DELETE /release/{id}/song/{songId}` - Remove song from release
  - Deletes from both S3 and DynamoDB
  - Validates artist ownership
  - Gracefully handles missing S3 files
- `GET /release/{id}/songs` - List all songs in release
  - Queries via `releaseIdIndex`
  - Returns array of song metadata
- `GET /songs/{songId}` - Get individual song details
  - Direct songId lookup
  - Used for library/explore features

## Test Results ✅

**Full Architecture Test** - All 6 operations passed:

```
1️⃣ Create Release (without songs)           → ✅ 201 Created
2️⃣ Add Song to Release                      → ✅ 201 Created
3️⃣ Get Songs in Release                     → ✅ 200 OK (1 song)
4️⃣ Get Song Details                         → ✅ 200 OK
5️⃣ Remove Song from Release                 → ✅ 200 OK
6️⃣ Verify Song Deleted (404 expected)       → ✅ 404 Not Found
```

### Test Script

See [test_new_architecture.py](./test_new_architecture.py) for full test implementation.

## Migration Path

### For New Artists

1. Create release: `POST /create-release`
2. Add songs: `POST /release/{id}/add-song` (one at a time)
3. Songs automatically available in library/explore

### For Existing Artists (Future)

If data exists in old format:

1. Query all songs for artist
2. Create releases based on song metadata
3. Migrate songs to amply-songs table
4. Update S3 paths to release-based structure

## Benefits

1. **Clear Hierarchy**: Releases → Songs (no orphans)
2. **Artist Intent**: Releases reflect how artists think about content
3. **Flexible Management**: Add/remove songs without recreating releases
4. **Simple Queries**:
   - All songs in release: Index on `releaseId`
   - All songs by artist: Index on `artistId`
   - Individual songs: Direct `songId` lookup
5. **S3 Organization**: Files grouped logically by release

## Implementation Status

### Completed ✅

- [x] Created amply-songs-dev table with GSIs
- [x] Refactored /create-release endpoint (metadata only)
- [x] Implemented 4 song management endpoints
- [x] Lambda deployed and tested
- [x] Authorization checks on all endpoints
- [x] S3 deletion with graceful fallback
- [x] Full architecture test passing

### Next Steps

- [ ] Frontend refactor: Update upload.js flow
- [ ] Update library/explore to query amply-songs
- [ ] Add album view with grouped songs
- [ ] Deprecate /update-index endpoint
- [ ] Migrate existing data (if any)

## Code References

### Constants (Line 24)

```javascript
const RELEASES_TABLE = `amply-releases-${environment}`;
const SONGS_TABLE = `amply-songs-${environment}`;
```

### New Endpoints

- `/release/{id}/add-song` POST (Line ~2007)
- `/release/{id}/song/{songId}` DELETE (Line ~2058)
- `/release/{id}/songs` GET (Line ~2129)
- `/songs/{songId}` GET (Line ~2153)

### Key Implementation Details

- All song endpoints validate `artistId` ownership
- S3 deletion gracefully handles missing files
- Artist bucket lookup from artist-config table
- Fallback to defaultBucket if config missing
- DynamoDB operations maintain data consistency

## Lambda Deployment Info

- **Function**: AmplyAPI
- **Region**: eu-north-1
- **Current SHA**: u+fFuCIyhvibeyYDOXZrnAmnNwDfJB25Km3ylpjLT9E=
- **Status**: Live and tested

---

**Last Updated**: 2026-01-13
**Architecture Version**: 1.0 (Release-First)
**Test Status**: ✅ All tests passing
