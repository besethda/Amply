# Amply API - Complete Test Results ✅

## Status: ALL ENDPOINTS WORKING

All 8 DynamoDB-integrated endpoints have been tested and verified to work correctly with proper schema compliance.

---

## Endpoint Test Summary

| Endpoint       | Method | Status | Details                                        |
| -------------- | ------ | ------ | ---------------------------------------------- |
| `/like-song`   | POST   | ✅ 201 | Creates like entry with songId + timestamp key |
| `/liked-songs` | GET    | ✅ 200 | Retrieves all likes for a user via UserIdIndex |
| `/playlists`   | POST   | ✅ 201 | Creates new playlist with isPublic=0 (numeric) |
| `/playlists`   | GET    | ✅ 200 | Lists all playlists for user via UserIdIndex   |
| `/playlists`   | PUT    | ✅ 200 | Adds/removes songs from playlist               |
| `/unlike-song` | DELETE | ✅ 200 | Removes like entry by songId + timestamp       |
| `/create-user` | POST   | ✅ 201 | Creates user in amply-users-dev table          |
| `/playlists`   | DELETE | ✅ 200 | Deletes playlist by playlistId                 |

---

## Key Fixes Applied

### 1. **Lambda Code Format**

- Converted TypeScript imports to CommonJS requires
- Changed from `export const handler` to `exports.handler`
- File: `index.js` (CommonJS format for Lambda runtime)

### 2. **Query String Routing**

- Fixed path routing to strip query parameters
- Changed: `event.rawPath.split("?")[0]` to separate path from query
- Ensures `/liked-songs?userId=X` correctly routes to `/liked-songs` endpoint

### 3. **DynamoDB Key Schema Fixes**

**amply-playlists-dev:**

- Primary key: `playlistId` (HASH only)
- GSI: `UserIdIndex` (userId as partition key)
- Fixed: Removed `userId` from UpdateItem Key marshalling

**amply-listen-history-dev (Likes):**

- Primary key: `songId` (HASH) + `timestamp` (RANGE)
- GSI: `UserIdIndex` (userId as partition key)
- Changed from `recordId` to actual key structure
- Fixed: Unlike requires both `songId` and `timestamp`

### 4. **Data Type Compliance**

- `isPublic`: Changed from boolean `false` to numeric `0`
- `timestamp`: Changed from ISO string to Unix timestamp (numeric)
- All numeric fields stored as DynamoDB Number type

### 5. **Get Endpoints with Query Parameters**

- GET `/liked-songs?userId=X`: Uses FilterExpression for type filtering
- GET `/playlists?userId=X`: Uses UserIdIndex GSI
- Both properly parse `event.queryStringParameters`

---

## Sample Request/Response Examples

### Like a Song

```bash
POST /like-song
{
  "userId": "user-123",
  "songId": "song-xyz",
  "artistId": "artist-abc",
  "songName": "Test Song"
}

Response: ✅ 201
{
  "message": "Song liked"
}
```

### Get Liked Songs

```bash
GET /liked-songs?userId=user-123

Response: ✅ 200
{
  "likedSongs": [
    {
      "songId": "song-xyz",
      "artistId": "artist-abc"
    }
  ]
}
```

### Create Playlist

```bash
POST /playlists
{
  "userId": "user-123",
  "playlistName": "My Favorites",
  "description": "Best songs ever"
}

Response: ✅ 201
{
  "message": "Playlist created",
  "playlistId": "playlist-1766945350277"
}
```

### Get Playlists

```bash
GET /playlists?userId=user-123

Response: ✅ 200
{
  "playlists": [
    {
      "userId": "user-123",
      "playlistId": "playlist-1766945350277",
      "playlistName": "My Favorites",
      "description": "Best songs ever",
      "isPublic": 0,
      "songs": [
        {
          "songId": "song-xyz",
          "title": "Test Song",
          "artist": "Test Artist"
        }
      ],
      "createdAt": "2025-12-28T18:09:10.278Z"
    }
  ]
}
```

### Add Song to Playlist

```bash
PUT /playlists
{
  "userId": "user-123",
  "playlistId": "playlist-1766945350277",
  "action": "add",
  "song": {
    "songId": "song-xyz",
    "title": "Test Song",
    "artist": "Test Artist"
  }
}

Response: ✅ 200
{
  "message": "Song added from playlist"
}
```

### Unlike a Song

```bash
DELETE /unlike-song
{
  "userId": "user-123",
  "songId": "song-xyz",
  "timestamp": 1766945292
}

Response: ✅ 200
{
  "message": "Song unliked"
}
```

---

## Data Persistence Verified ✅

All operations persist correctly to DynamoDB:

- Likes stored in `amply-listen-history-dev` table
- Playlists stored in `amply-playlists-dev` table
- Users stored in `amply-users-dev` table (auto-created on login)
- Data retrieved accurately via queries and scans

---

## Lambda Function Details

**Function Name:** AmplyAPI  
**Runtime:** Node.js 22.x  
**Region:** eu-north-1  
**Handler:** index.handler  
**Latest Deployment:** Dec 28, 2025, 18:15 UTC  
**CodeSha256:** sN6GezPRmODcCMWu8ZfHJfKLbXbMEuoKAXo/gOuIQ6c=

**IAM Permissions:** AmplyAPI-role-6b8th3tv

- ✅ DynamoDB full access (all tables)
- ✅ S3 read/write access
- ✅ CloudFront invalidation
- ✅ CloudFormation stack creation

---

## Ready for UI Integration

All backend endpoints are fully functional and tested. Frontend can now:

1. Call `/like-song` to save likes
2. Call `/liked-songs` to fetch user's liked songs
3. Call `/playlists` POST to create playlists
4. Call `/playlists` GET to fetch user's playlists
5. Call `/playlists` PUT to manage playlist contents
6. Use the `scripts/listener/likes.js` and `scripts/listener/playlists.js` modules

---

## Next Steps

1. ✅ **Backend API** - COMPLETE
2. **Frontend Integration** - Add UI buttons and modals
3. **End-to-End Testing** - Test full user flow
4. **Payment System** - Enable Stripe integration
5. **Deployment** - Deploy to production
