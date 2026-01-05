import { requireAuth } from "../general.js";
import { initHomeView } from "./listener.js";
import { initPlaylistView } from "./playlist.js";
import { initSettingsView } from "./settings.js";
import { initArtistView } from "./artist-profile.js";
import { initPlaylistsView } from "./playlists.js";
import { initLibraryView } from "./library.js";

// Minimal inline fallback to ensure required containers exist if a dev server injects markup
const fallbackViews = {
  home: `
    <section class="songs-section">
      <h2>Recently Listened</h2>
      <div id="recentlyListened"></div>
    </section>
    <section class="songs-section">
      <h2>Recommended For You</h2>
      <div id="recommendedTracks"></div>
    </section>
    <section class="songs-section">
      <h2>Discover</h2>
      <div id="trackList"></div>
    </section>
  `,
  playlist: `
    <header class="top-bar">
      <input type="text" id="searchBar" placeholder="Search for songs or artists..." />
    </header>
    <section class="songs-section"><div id="playlistTrackList"></div></section>
  `,
  playlists: `
    <header class="top-bar">
      <button id="createPlaylistBtn" class="btn-primary">+ Create Playlist</button>
    </header>
    <section class="playlists-section"><div id="playlistsGrid" class="playlist-grid"></div></section>
    <div class="empty-state" id="emptyState" style="display: none">
      <p>No playlists yet</p>
      <p class="empty-hint">Create your first playlist to get started</p>
    </div>
  `,
  library: `
    <section class="songs-section">
      <h2>Liked Songs</h2>
      <div id="trackList"></div>
    </section>
  `,
  explore: `
    <section class="songs-section">
      <h2>Explore & Discover</h2>
      <div id="trackList"></div>
    </section>
  `,
  settings: `
    <header class="top-bar"><h2 class="head">Settings & Account</h2></header>
    <section class="settings-section"><div class="settings-card"><span id="userEmail"></span></div></section>
  `,
  artist: `
    <header class="top-bar">
      <input type="text" id="searchBar" placeholder="Search for songs or artists..." />
    </header>
    <div class="artist-poster">
      <img class="artist-cover-img" />
      <div class="artist-photo">
        <img class="artist-profile-img" alt="Artist Profile" />
        <div class="about-artist">About</div>
        <div class="about-background">
          <div class="about-artist-text"></div>
        </div>
      </div>
    </div>
    <section class="songs-section fade-in">
      <h2 id="artistPageTitle">Artist</h2>
      <div id="artistTrackList"></div>
    </section>
  `,
};

requireAuth();

const viewRoot = document.getElementById("viewRoot");
const navItems = Array.from(document.querySelectorAll("[data-route]")); 

const routes = {
  home: {
    view: "/listener/views/home.html",
    init: initHomeView,
  },
  playlist: {
    view: "/listener/views/playlist.html",
    init: initPlaylistView,
  },
  playlists: {
    view: "/listener/views/playlists.html",
    init: initPlaylistsView,
  },
  library: {
    view: "/listener/views/library.html",
    init: initLibraryView,
  },
  explore: {
    view: "/listener/views/explore.html",
    init: initHomeView,
  },
  settings: {
    view: "/listener/views/settings.html",
    init: initSettingsView,
  },
  artist: {
    view: "/listener/views/artist.html",
    init: initArtistView,
  },
};

function getRouteFromHash() {
  const hash = window.location.hash.replace("#", "").trim();
  const [route] = hash.split(":");
  if (!route) return "home";
  return routes[route] ? route : "home";
}

function setActive(routeKey) {
  navItems.forEach((item) => {
    const isActive = item.dataset.route === routeKey;
    item.classList.toggle("active", isActive);
  });
}

async function fetchView(url) {
  const res = await fetch(url, { cache: "no-cache" });
  const text = await res.text();
  if (!res.ok) throw new Error(`Failed to fetch view: ${url} status=${res.status}`);
  return { text, status: res.status, finalUrl: res.url };
}

async function loadRoute(routeKey, routeParam = null) {
  const key = routes[routeKey] ? routeKey : "home";
  const config = routes[key];

  try {
    // Fallback for single-page app pattern (if needed)
    if (!viewRoot) {
      console.error("viewRoot not found; cannot render view.");
      return;
    }

    viewRoot.innerHTML = "<div class='loading'>Loading…</div>";

    const viewUrl = typeof config.view === "function" ? config.view() : config.view;
    
    // Use fallback view if no viewUrl or fetch fails
    let htmlToUse;
    if (viewUrl) {
      const { text: html, status, finalUrl } = await fetchView(viewUrl);
      
      // Check for route-specific container IDs
      const containerMap = {
        home: "trackList",
        playlist: "playlistTrackList",
        playlists: "playlistsGrid",
        library: "playlistTrackList",
        explore: "trackList",
        artist: "artistTrackList",
      };
      const expectedContainer = containerMap[key] || "trackList";
      const hasExpectedContainer = html.includes(expectedContainer);
      
      htmlToUse = hasExpectedContainer ? html : fallbackViews[key] || html;
      
      if (!hasExpectedContainer) {
        console.warn(`View '${key}' served without ${expectedContainer} container; used fallback.`);
      }
    } else {
      // No viewUrl provided, use fallback
      htmlToUse = fallbackViews[key] || "<p>View not found</p>";
    }
    
    const tpl = document.createElement("div");
    tpl.innerHTML = htmlToUse;
    viewRoot.replaceChildren(...tpl.childNodes);

    if (typeof config.init === "function") {
      await config.init(routeParam);
    }

    setActive(key);
    
    // Restore player bar display and album art after route changes
    const playerBar = document.getElementById("playerBar");
    if (playerBar) {
      // Restore player bar visibility if a song is playing
      if (typeof window.currentSong !== 'undefined' && window.currentSong) {
        playerBar.classList.remove("hidden");
        
        // Ensure album art is displayed
        const albumArt = document.getElementById("currentTrackArt");
        if (albumArt && window.currentSong) {
          albumArt.src = window.currentSong.art_url || window.currentSong.coverImage || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%23667eea'/%3E%3Cstop offset='100%25' style='stop-color:%23764ba2'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='url(%23g)' width='200' height='200'/%3E%3C/svg%3E";
        }
      }
    }
    
    // Re-initialize waveform after route changes
    if (typeof window.initializeWaveform === 'function') {
      window.initializeWaveform();
    }
  } catch (err) {
    console.error("❌ Route load failed:", err);
    if (viewRoot) {
      viewRoot.innerHTML = "<p>Could not load this view.</p>";
    }
  }
}

function handleNavClick(e) {
  e.preventDefault();
  const target = e.currentTarget;
  const routeKey = target.dataset.route;
  if (!routeKey) return;

  if (getRouteFromHash() === routeKey) {
    loadRoute(routeKey);
    return;
  }

  window.location.hash = routeKey;
}

function initRouter() {
  if (!viewRoot) return;

  navItems.forEach((item) => {
    item.addEventListener("click", handleNavClick);
  });

  window.addEventListener("hashchange", () => {
    const hash = window.location.hash.replace("#", "").trim();
    const [route, param] = hash.split(":");
    loadRoute(route || "home", param);
  });

  const hash = window.location.hash.replace("#", "").trim();
  const [route, param] = hash.split(":");
  loadRoute(route || "home", param);
}

initRouter();
