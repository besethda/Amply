# ✅ DynamoDB & Playlists/Likes Implementation Checklist

## Backend ✅ COMPLETE

### DynamoDB

- ✅ Tables deployed (all 5 tables operational)
- ✅ User schema defined
- ✅ Playlist schema defined
- ✅ Likes schema defined

### Lambda API

- ✅ POST /create-user
- ✅ GET /playlists
- ✅ POST /playlists
- ✅ PUT /playlists
- ✅ DELETE /playlists
- ✅ POST /like-song
- ✅ DELETE /unlike-song
- ✅ GET /liked-songs

### Authentication

- ✅ User auto-created on login
- ✅ UserId stored in localStorage
- ✅ JWT auth integrated

### Frontend Modules

- ✅ `scripts/listener/playlists.js` - All functions
- ✅ `scripts/listener/likes.js` - All functions
- ✅ `scripts/listener/listener-integration.js` - Example code

## Frontend UI - READY TO IMPLEMENT

### Phase 1: Add UI to Existing Pages (2 hours)

**Files to Edit:**

- [ ] `listener/listener.html` or `listener/views/home.html`
  - [ ] Add like button (🤍) to each song
  - [ ] Add "Add to Playlist" button to each song
  - [ ] Update `scripts/listener/listener.js` to import and init

**What to Add:**

```html
<!-- Like Button -->
<button
  class="like-btn"
  data-action="like"
  data-song-id="{songId}"
  data-artist-id="{artistId}"
  data-song-name="{songName}"
>
  🤍
</button>

<!-- Add to Playlist -->
<button
  data-action="add-to-playlist"
  data-song-id="{songId}"
  data-song-name="{songName}"
  data-artist-name="{artistName}"
  data-bucket="{bucket}"
  data-cloudfront-domain="{cloudfrontDomain}"
>
  + Playlist
</button>
```

**Code to Add to listener.js:**

```javascript
import { initLikeButtons } from "./likes.js";
import { getUserPlaylists } from "./playlists.js";

document.addEventListener("DOMContentLoaded", async () => {
  await initLikeButtons();
  window.userPlaylists = await getUserPlaylists();
});
```

### Phase 2: Create New Pages (2 hours)

**New Files to Create:**

- [ ] `listener/playlists.html` - Show all user playlists
- [ ] `listener/liked-songs.html` - Show liked songs library
- [ ] `listener/playlist.html` - Show songs in one playlist (optional)

**Code Templates Available In:**
`UI_IMPLEMENTATION_GUIDE.md`

### Phase 3: Add Navigation Links (30 min)

**Update:**

- [ ] `listener/listener.html` - Add link to Playlists page
- [ ] `listener/listener.html` - Add link to Liked Songs page
- [ ] `listener/sidebar.html` or navigation - Add these links

### Phase 4: Add Styling (1 hour)

**Add to `Styles/listener/listener.css`:**

- [ ] `.like-btn` styles
- [ ] `.like-btn.liked` styles
- [ ] `.add-to-playlist-btn` styles
- [ ] `.playlist-modal` and related styles

**CSS Available In:**
`UI_IMPLEMENTATION_GUIDE.md`

## Testing Checklist

### Before Implementing UI

- [ ] Run: `npm test` or check for TypeScript errors
- [ ] Verify Lambda endpoints are deployed
- [ ] Test manual API calls:
  ```bash
  curl -X POST https://API_URL/like-song \
    -H "Content-Type: application/json" \
    -d '{"userId":"123","songId":"song1","artistId":"artist1"}'
  ```

### After Adding UI - Phase 1

- [ ] Like button appears on songs
- [ ] Click like → console shows "❤️ Song liked"
- [ ] Like icon changes to ❤️
- [ ] Click again → unlike works
- [ ] "Add to Playlist" button appears
- [ ] Click shows playlist selector modal

### After Adding UI - Phase 2

- [ ] Playlists page loads and shows all playlists
- [ ] Can create new playlist from modal
- [ ] Songs are added to selected playlist
- [ ] Liked songs page shows all liked songs
- [ ] Like button still works on liked songs page

### After Adding UI - Phase 3

- [ ] Navigation links visible and working
- [ ] Can navigate between pages smoothly

### After Adding UI - Phase 4

- [ ] Buttons look good and match design
- [ ] Modal is visually appealing
- [ ] Responsive on mobile

## Current Status

**Backend:** ✅ 100% Complete
**Frontend Modules:** ✅ 100% Complete
**UI Implementation:** ⏳ Ready to Start

## Time Estimate

- Phase 1 (Add buttons): 2 hours
- Phase 2 (New pages): 2 hours
- Phase 3 (Navigation): 30 minutes
- Phase 4 (Styling): 1 hour

**Total: 5.5 hours** to have full working playlist/likes system!

## Next After This

Once playlists/likes UI is complete:

1. **Stripe Integration** - Charge per listen
2. **Artist Earnings Dashboard** - Show how much artists make
3. **Payment History** - Show transaction logs
4. **Advanced Features** - Sharing playlists, following artists, etc.

## Resources

- `DYNAMODB_INTEGRATION_COMPLETE.md` - Overview
- `PLAYLISTS_QUICK_START.md` - API reference
- `UI_IMPLEMENTATION_GUIDE.md` - Exact code to add
- `PLAYLISTS_LIKES_SETUP.md` - Full documentation

## Questions?

All endpoints and functions are documented in the markdown files above. If something is unclear, check:

1. `PLAYLISTS_LIKES_SETUP.md` - Most detailed reference
2. `UI_IMPLEMENTATION_GUIDE.md` - Code examples
3. `scripts/listener/playlists.js` - Function signatures
4. `scripts/listener/likes.js` - Function signatures
