const CACHE_NAME = 'amply-v2';
const STREAM_CACHE_NAME = 'amply-streams-v1'; // Never used, but named for clarity

// Cache essential UI assets ONLY - NO audio files
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/Styles/core.css',
  '/Styles/fonts.css',
  '/Styles/variables.css',
  '/Styles/listener/general.css',
  '/Styles/listener/listener.css',
  '/images/Amply_lgo.png',
  '/images/Amply_lgofav.png',
  '/images/amply.png'
];

// Install event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache).catch(err => {
          console.log('Cache addAll error:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  const url = event.request.url;

  // ===== NEVER CACHE: Audio/Media Streams =====
  // These should ALWAYS stream fresh from the network
  if (url.includes('/stream') ||
    url.includes('.mp3') ||
    url.includes('.wav') ||
    url.includes('.m4a') ||
    url.includes('amazonaws.com') ||
    url.includes('cloudfront.net')) {
    // Pass through to network without caching
    event.respondWith(fetch(event.request));
    return;
  }

  // ===== CACHE EVERYTHING ELSE =====
  // CSS, JS, HTML, images, fonts, API calls for user data
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version if available
        if (response) {
          return response;
        }

        // Otherwise try to fetch from network
        return fetch(event.request)
          .then(response => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            // Cache the fetched response
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // For HTML requests, return the offline page
            if (event.request.destination === 'document') {
              return caches.match('/index.html');
            }
            // For other requests, return nothing
            return undefined;
          });
      })
  );
});
