import { requireAuth } from "../general.js";
import { initHomeView } from "./listener.js";
import { initPlaylistView } from "./playlist.js";
import { initSettingsView } from "./settings.js";
import { initArtistView } from "./artist-profile.js";

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
  library: `
    <header class="top-bar">
      <input type="text" id="searchBar" placeholder="Search for playlists..." />
    </header>
    <section class="playlist-section"><div id="playlistGrid" class="playlist-grid"></div></section>
  `,
  explore: `
    <header class="top-bar"><h2>Explore</h2></header>
    <section class="songs-section"><p>Explore content coming soon.</p></section>
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
    redirect: "listener.html",
    init: initHomeView,
  },
  playlist: {
    redirect: "playlists.html",
  },
  library: {
    redirect: "playlists.html",
  },
  explore: {
    redirect: "listener.html",
  },
  settings: {
    redirect: "settings.html",
  },
  artist: {
    redirect: "artist-profile.html",
  },
};

function getRouteFromHash() {
  const hash = window.location.hash.replace("#", "").trim();
  if (hash.startsWith("artist:")) return "artist";
  return hash && routes[hash] ? hash : "home";
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
    // If this route has a redirect, navigate to that page
    // But only if we're not already on that page
    if (config.redirect) {
      const currentFile = window.location.pathname.split('/').pop() || 'listener.html';
      const targetFile = config.redirect;
      
      // Only redirect if we're not already on the target page
      if (!currentFile.includes(targetFile.replace('.html', ''))) {
        window.location.href = config.redirect;
        return;
      }
    }

    // Fallback for single-page app pattern (if needed)
    if (!viewRoot) {
      console.error("❌ viewRoot not found; cannot render view.");
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
        library: "playlistGrid",
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
