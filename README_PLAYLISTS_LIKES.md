# 🎵 Amply Playlists & Likes System

**Status: ✅ READY TO USE**

All backend infrastructure is complete. UI implementation is straightforward.

## 🚀 Quick Links

- **Getting Started**: Read [DYNAMODB_INTEGRATION_SUMMARY.md](./DYNAMODB_INTEGRATION_SUMMARY.md)
- **Implementation Guide**: [UI_IMPLEMENTATION_GUIDE.md](./UI_IMPLEMENTATION_GUIDE.md)
- **API Reference**: [PLAYLISTS_LIKES_SETUP.md](./PLAYLISTS_LIKES_SETUP.md)
- **Checklist**: [IMPLEMENTATION_CHECKLIST.md](./IMPLEMENTATION_CHECKLIST.md)

## 📊 What's Implemented

### Backend (100% Complete)
- ✅ DynamoDB tables for users, playlists, likes
- ✅ 8 Lambda endpoints for CRUD operations
- ✅ User auto-creation on login
- ✅ JWT authentication on all endpoints

### Frontend Modules (100% Complete)
- ✅ `scripts/listener/likes.js` - Like/unlike functionality
- ✅ `scripts/listener/playlists.js` - Playlist operations
- ✅ `scripts/listener/listener-integration.js` - Full example

### UI (Ready to Add)
- ⏳ Like buttons (🤍)
- ⏳ Add to playlist buttons
- ⏳ Playlists page
- ⏳ Liked songs page

## 📋 What You Can Do Right Now

### Test Backend (No UI needed)
```javascript
// In browser console
import { likeSong, getLikedSongs } from "./scripts/listener/likes.js";

// Like a song
await likeSong("song123", "artist456", "Song Title");

// Get all likes
const liked = await getLikedSongs();
console.log(liked); // Persisted in DynamoDB! ✅
```

### Add to UI (5 min per page)
1. Copy button HTML from guide
2. Import likes.js/playlists.js
3. Call initLikeButtons()
4. Done!

## 🎯 3 Steps to Deploy

### Step 1: Add Like Buttons (5 min)
```html
<button data-action="like" data-song-id="..." data-artist-id="...">🤍</button>
```
```javascript
import { initLikeButtons } from "./scripts/listener/likes.js";
await initLikeButtons();
```

### Step 2: Create Playlists & Liked Songs Pages (20 min)
Copy HTML/JS from `UI_IMPLEMENTATION_GUIDE.md`

### Step 3: Add Navigation Links (5 min)
Link to new pages in your nav menu

**Total time: 30 minutes** to have full working system!

## 📊 Database Schema

```
Users
├── userId (PK)
├── email
├── username
├── displayName
└── createdAt

Playlists
├── userId (PK)
├── playlistId (SK)
├── playlistName
├── description
├── songs: [
│   ├── songId
│   ├── songName
│   └── artistName
│ ]
└── createdAt

Likes (stored in listen-history table)
├── songId (PK) = "userId#songId"
├── timestamp (SK)
├── userId
├── artistId
├── type: "like"
└── createdAt
```

## 🔗 API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/create-user` | Create user in DynamoDB |
| POST | `/like-song` | Like a song |
| DELETE | `/unlike-song` | Unlike a song |
| GET | `/liked-songs` | Get user's liked songs |
| POST | `/playlists` | Create playlist |
| GET | `/playlists` | Get user's playlists |
| PUT | `/playlists` | Add/remove songs |
| DELETE | `/playlists` | Delete playlist |

## 💡 Usage Examples

### Like a Song
```javascript
import { likeSong } from "./scripts/listener/likes.js";

button.addEventListener("click", async () => {
  await likeSong(songId, artistId, songName);
  button.innerHTML = "❤️"; // Heart fills
});
```

### Create Playlist
```javascript
import { createPlaylist } from "./scripts/listener/playlists.js";

const playlist = await createPlaylist("My Favorites");
console.log(playlist.playlistId); // Use to add songs
```

### Add Song to Playlist
```javascript
import { addSongToPlaylist } from "./scripts/listener/playlists.js";

await addSongToPlaylist(playlistId, {
  songId: "song123",
  songName: "Song Title",
  artistName: "Artist Name",
  bucket: "artist-bucket",
  cloudfrontDomain: "d123.cloudfront.net"
});
```

## ✨ Features Included

- ✅ Like/unlike individual songs
- ✅ Create multiple playlists
- ✅ Add/remove songs from playlists
- ✅ View all playlists
- ✅ View all liked songs
- ✅ Delete playlists
- ✅ Persistent storage in DynamoDB
- ✅ Full JWT authentication
- ✅ Auto-update UI on changes

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `DYNAMODB_INTEGRATION_COMPLETE.md` | Complete overview |
| `DYNAMODB_INTEGRATION_SUMMARY.md` | Quick summary |
| `PLAYLISTS_LIKES_SETUP.md` | Full API reference |
| `PLAYLISTS_QUICK_START.md` | Usage examples |
| `UI_IMPLEMENTATION_GUIDE.md` | **→ START HERE** |
| `IMPLEMENTATION_CHECKLIST.md` | Step-by-step checklist |

## 🎯 Next Steps

1. ✅ Read `UI_IMPLEMENTATION_GUIDE.md`
2. ✅ Add like buttons to song cards
3. ✅ Add "Add to Playlist" buttons
4. ✅ Create Playlists page
5. ✅ Create Liked Songs page
6. ✅ Test everything works
7. 🔮 Integrate Stripe for payments

## 🐛 Troubleshooting

### Buttons don't work?
- Check browser console for errors
- Make sure you called `initLikeButtons()`
- Verify user is logged in (should have token in localStorage)

### Songs not persisting?
- Check DynamoDB in AWS Console
- Verify user.userId matches in database
- Check Lambda CloudWatch logs

### Playlists not loading?
- Check network tab for 403/500 errors
- Verify user has JWT token
- Check that playlistId format is correct

## 📞 Support

All code is documented with JSDoc comments. Check:
- `scripts/listener/likes.js` - Function signatures
- `scripts/listener/playlists.js` - Function signatures  
- `PLAYLISTS_LIKES_SETUP.md` - Full API docs

## 🎉 You're Ready!

Everything is implemented. Just add the UI and you have:
- ❤️ Like system
- 📋 Playlist system
- 💾 Full DynamoDB persistence
- 🔐 JWT authentication

Have fun building! 🚀
