import { loadSongs, $, requireAuth } from "../general.js";
import { initPlayer, renderSongsToDom } from "../player.js";

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
          if (playlist.songs && playlist.songs.length > 0) {
            // Convert stored songs to playable format
            songs = playlist.songs.map((s) => ({
              songId: s.songId,
              title: s.songName || "Unknown",
              artist: s.artistName || "Unknown Artist",
              file: s.file,
              bucket: s.bucket,
              cloudfrontDomain: s.cloudfrontDomain,
              coverImage: s.coverImage,
            }));
          }
        }
      }
    }
    
    // Update the title if the header exists
    if (titleHeader) {
      titleHeader.textContent = playlistName;
    }
    
    // If we didn't get songs from the playlist, load all songs as fallback
    if (songs.length === 0) {
      songs = await loadSongs();
    }

    if (!songs || songs.length === 0) {
      container.innerHTML = "<p>No songs available.</p>";
      return;
    }

    renderSongsToDom({
      songs,
      layout: "list",
      container: "#playlistTrackList"
    });

    initPlayer(songs);
  } catch (err) {
    console.error("Failed to load playlist songs:", err);
    container.innerHTML = "<p>Error loading songs.</p>";
  }
}

// Auto-init if we are on the standalone playlist page
if (document.getElementById("playlistTrackList")) {
  initPlaylistView();
}