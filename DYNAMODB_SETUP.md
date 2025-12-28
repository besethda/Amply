# DynamoDB Setup Guide

## What These Tables Do

### 1. **amply-users**

Stores user profiles (listeners and artists)

- **Search by**: userId, username, email
- **Use case**: User registration, profile lookup, search users

### 2. **amply-listen-history** ⭐ CRITICAL FOR PAYMENTS

Tracks every listen for accurate artist payments

- **Search by**: songId (for payments), userId (for history), artistId (for analytics)
- **Use case**: Payment calculations, user listening history, artist analytics
- **Auto-deletes**: Old records after 1 year (set `expiryTime`)

### 3. **amply-playlists**

User-created playlists (public and private)

- **Search by**: playlistId, userId, isPublic
- **Use case**: User playlists, playlist discovery, public playlist browsing

### 4. **amply-artist-config** ⚠️ PRIVATE

Artist S3 buckets and IAM roles (NEVER expose to frontend)

- **Search by**: artistId
- **Use case**: Lambda internal use only

### 5. **amply-follows**

Track follower relationships

- **Search by**: userId→artistId, artistId→followers
- **Use case**: User follows artist, artist follower count

---

## How to Deploy

### Option 1: AWS Console (Easy)

1. Go to CloudFormation console
2. Create stack
3. Upload `dynamodb-tables.yml`
4. Set `Environment=dev` (or `prod`)
5. Click Create

### Option 2: AWS CLI (Recommended)

```bash
aws cloudformation create-stack \
  --stack-name amply-dynamodb \
  --template-body file://dynamodb-tables.yml \
  --parameters ParameterKey=Environment,ParameterValue=dev \
  --region eu-north-1
```

### Option 3: Terraform (If you prefer)

Can convert this CloudFormation to Terraform later if needed

---

## Sample Data Structures

### Users Table Item

```json
{
  "userId": "user-uuid-123",
  "email": "john@example.com",
  "username": "john_listener",
  "displayName": "John Doe",
  "accountType": "listener",
  "profilePhoto": "https://d123.cloudfront.net/profiles/john.jpg",
  "bio": "Music lover from NYC",
  "createdAt": 1705939200000,
  "updatedAt": 1705939200000,
  "preferences": {
    "favoriteGenres": ["electronic", "pop"],
    "language": "en",
    "emailNotifications": true
  },
  "stats": {
    "totalListens": 5000,
    "playlistsCreated": 12,
    "followingArtists": 45
  }
}
```

### Listen History Item

```json
{
  "songId": "song-uuid-456",
  "timestamp": 1705939200000,
  "userId": "user-uuid-123",
  "artistId": "artist-uuid-789",
  "duration": 240,
  "listeningDuration": 180,
  "completionPercentage": 75,
  "deviceType": "mobile",
  "ipCountry": "US",
  "expiryTime": 1737475200 // Auto-delete after 1 year
}
```

### Playlist Item

```json
{
  "playlistId": "playlist-uuid-111",
  "userId": "user-uuid-123",
  "title": "Late Night Vibes",
  "description": "My favorite chill tracks",
  "isPublic": 1,
  "coverUrl": "https://d123.cloudfront.net/playlists/late-night.jpg",
  "songIds": ["song-uuid-456", "song-uuid-789"],
  "genres": ["electronic", "ambient"],
  "createdAt": 1705939200000,
  "updatedAt": 1705939200000,
  "followers": 12,
  "likeCount": 8
}
```

### Artist Config Item (PRIVATE)

```json
{
  "artistId": "artist-uuid-789",
  "s3BucketName": "amply-artist-john-doe",
  "roleArn": "arn:aws:iam::123456789012:role/AmplyArtistRole",
  "cloudfrontDomain": "d123.cloudfront.net",
  "awsRegion": "eu-north-1",
  "createdAt": 1705939200000,
  "updatedAt": 1705939200000
}
```

---

## Important Notes

⚠️ **Never Expose Artist Config to Frontend**

- S3 bucket names and IAM role ARNs are private
- Only Lambda should read this table
- Frontend should only see the CloudFront domain

✅ **Listen History is Time-Sensitive**

- Set `expiryTime` when recording listens
- Format: Unix timestamp in seconds (milliseconds / 1000)
- Example: Record a listen with `expiryTime = timestamp/1000 + (365 * 24 * 60 * 60)`

✅ **Username Must Be Unique**

- Enforce in Lambda (check before insert)
- Use UsernameIndex for lookup

---

## Next Steps

1. Deploy this CloudFormation stack
2. Update Lambda to add DynamoDB endpoints:
   - POST /users (create user)
   - GET /users/{userId} (get profile)
   - POST /listen (track listen)
   - GET /listens/{songId} (artist analytics)
   - POST /playlists (create playlist)
   - GET /playlists/public (browse public playlists)
3. Update frontend to call new endpoints
