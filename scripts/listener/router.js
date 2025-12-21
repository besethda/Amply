import { requireAuth } from "../general.js";
import { initHomeView } from "./listener.js";
import { initPlaylistView } from "./playlist.js";
import { initSettingsView } from "./settings.js";
import { initArtistView } from "./artist-profile.js";

// Minimal inline fallback to ensure required containers exist if a dev server injects markup
const fallbackViews = {
  home: `
    <header class="top-bar">
      <input type="text" id="searchBar" placeholder="Search for songs or artists..." />
    </header>
    <section class="songs-section"><div id="trackList"></div></section>
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
    view: () => `/listener/views/home.html?v=${Date.now()}`,
    init: initHomeView,
  },
  playlist: {
    view: () => `/listener/views/playlist.html?v=${Date.now()}`,
    init: initPlaylistView,
  },
  library: {
    view: () => `/listener/views/library.html?v=${Date.now()}`,
  },
  explore: {
    view: () => `/listener/views/explore.html?v=${Date.now()}`,
  },
  settings: {
    view: () => `/listener/views/settings.html?v=${Date.now()}`,
    init: initSettingsView,
  },
  artist: {
    view: () => `/listener/views/artist.html?v=${Date.now()}`,
    init: initArtistView,
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

  if (!viewRoot) {
    console.error("❌ viewRoot not found; cannot render view.");
    return;
  }

  viewRoot.innerHTML = "<div class='loading'>Loading…</div>";

  try {
    const viewUrl = typeof config.view === "function" ? config.view() : config.view;
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
    
    const htmlToUse = hasExpectedContainer ? html : fallbackViews[key] || html;
    const tpl = document.createElement("div");
    tpl.innerHTML = htmlToUse;
    viewRoot.replaceChildren(...tpl.childNodes);

    if (!hasExpectedContainer) {
      console.warn(`View '${key}' served without ${expectedContainer} container; used fallback.`);
    }

    if (typeof config.init === "function") {
      await config.init(routeParam);
    }

    setActive(key);
  } catch (err) {
    console.error("❌ Route load failed:", err);
    viewRoot.innerHTML = "<p>Could not load this view.</p>";
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
