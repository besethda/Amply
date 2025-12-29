import { loadSongs, $, requireAuth, getAuthToken, parseJwt } from "../general.js";
import { initPlayer, renderSongsToDom } from "../player.js";
import { deletePlaylist, getUserPlaylists, initPlaylistsView } from "./playlists.js";

requireAuth();

export async function initPlaylistView(playlistId) {
  const root = document.getElementById("viewRoot") || document;
  const container = root.querySelector("#playlistTrackList");
  const titleHeader = root.querySelector("#playlistTitle");
  if (!container) return;

  try {
    // Get the playlistId from the URL parameter or sessionStorage
    const actualPlaylistId = playlistId || sessionStorage.getItem('currentPlaylistId');
    
    let songs = [];
    let playlistName = "Playlist";
    
    if (actualPlaylistId && window.PlaylistManager) {
      // Try to get the specific playlist from the cache
      const userPlaylistsCache = window.userPlaylistsCache;
      if (userPlaylistsCache) {
        const playlist = userPlaylistsCache.find(p => p.playlistId === actualPlaylistId);
        if (playlist) {
          playlistName = playlist.playlistName || "Playlist";
          
          // Debug logging
          console.log("📋 Playlist found:", playlist);
          console.log("📝 Playlist songs:", playlist.songs);
          
          // Load all songs to find the ones in this playlist
          if (playlist.songs && playlist.songs.length > 0) {
            const allSongs = await loadSongs();
            console.log("🎵 All songs loaded:", allSongs?.length);
            
            if (allSongs && allSongs.length > 0) {
              // Map songIds to actual song data
              const playlistSongIds = playlist.songs.map(s => s.songId || s);
              console.log("🔍 Playlist song IDs:", playlistSongIds);
              console.log("🔍 First song from allSongs:", allSongs[0]);
              console.log("🔍 Matching songs by file property");
              
              // Match by file property since that's what's being stored
              songs = allSongs.filter(s => {
                const songFile = s.file;
                const match = playlistSongIds.includes(songFile);
                console.log(`  Checking ${songFile}: ${match}`);
                return match;
              });
              console.log("✅ Filtered songs:", songs);
            }
          }
        }
      }
    }
    
    // Update the title if the header exists
    if (titleHeader) {
      titleHeader.textContent = playlistName;
    }
    
    if (!songs || songs.length === 0) {
      container.innerHTML = "<p>No songs in this playlist.</p>";
      return;
    }

    // Ensure all songs have required properties for playback
    const enrichedSongs = songs.map(song => ({
      ...song,
      id: song.id || song.file,
    }));

    renderSongsToDom({
      songs: enrichedSongs,
      layout: "list",
      container: "#playlistTrackList",
      playlistId: actualPlaylistId
    });

    initPlayer(enrichedSongs);

    // Add delete playlist button handler
    const deleteBtn = root.querySelector("#deletePlaylistBtn");
    console.log("🗑️ Delete button found:", deleteBtn);
    console.log("🗑️ Actual playlist ID:", actualPlaylistId);
    if (deleteBtn && actualPlaylistId) {
      deleteBtn.addEventListener("click", async () => {
        console.log("🗑️ Delete button clicked");
        if (confirm(`Are you sure you want to delete "${playlistName}"? This cannot be undone.`)) {
          try {
            console.log("🗑️ Deleting playlist:", actualPlaylistId);
            await deletePlaylist(actualPlaylistId);
            // Refresh playlists list and navigate back to playlists view
            const token = getAuthToken();
            if (token) {
              const payload = parseJwt(token);
              await getUserPlaylists(payload.sub);
            }
            window.location.hash = "playlists";
          } catch (err) {
            console.error("Error deleting playlist:", err);
            alert("Failed to delete playlist");
          }
        }
      });
    }
  } catch (err) {
    console.error("Failed to load playlist songs:", err);
    container.innerHTML = "<p>Error loading songs.</p>";
  }
}

// Auto-init if we are on the standalone playlist page
if (document.getElementById("playlistTrackList")) {
  initPlaylistView();
}