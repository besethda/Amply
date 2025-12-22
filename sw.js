const CACHE_NAME = 'amply-v1';
const ASSETS = [
  '/',
  '/listener/listener.html',
  '/listener/playlist.html',
  '/listener/explore.html',
  '/listener/library.html',
  '/listener/settings.html',
  '/Styles/core.css',
  '/Styles/fonts.css',
  '/Styles/listener/general.css',
  '/Styles/listener/listener.css',
  '/Styles/listener/playlist.css',
  '/Styles/listener/artist-profile.css',
  '/Styles/listener/settings.css',
  '/scripts/general.js',
  '/scripts/player.js',
  '/scripts/listener/general.js',
  '/scripts/listener/router.js',
  '/scripts/listener/playlist.js',
  '/scripts/listener/explore.js',
  '/scripts/listener/settings.js',
  '/images/Amply_lgo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});
