// ============================================================
//  Always On Generators – Field Hub
//  Service Worker  |  sw.js  |  Version: aog-forms-v2.0.0
//  Scope: root (../)
//
//  ⚠ WHEN YOU UPDATE ANY TOOL:
//    1. Bump CACHE_NAME
//    2. Update CHANGELOG below with what changed
// ============================================================

var CACHE_NAME = 'aog-forms-v2.0.10';
var DEV_MODE   = false;

// Stores last known cache progress so late-loading pages can request it
var cacheProgress = { percent: 0, label: '', done: false }; // ← SET TRUE during development/testing

// ============================================================
//  CHANGELOG — Update this every time you bump CACHE_NAME.
//  This is what shows up in the update banner on their device.
//  Keep each line short — one change per item.
// ============================================================
var CHANGELOG = [
  'Property Lookup: fixed gas/electric territories not loading on mobile',
  'Property Lookup: territory data now cached for offline use',
  'Property Lookup: wider desktop panel, newspaper-style print',
  'Major hub redesign — new dark industrial UI',
  'Added 40 random animated background themes',
  'Cards now fully transparent with no blur',
  'All cards uniform size across every device & category',
  'Full mobile & tablet responsive fixes across all themes',
  'Added QC Checklist form',
  'Added Service Work form',
  'Added Site Plan / Annotator tool',
  'Offline page updated to match new hub design',
];
// ============================================================

var PRECACHE_URLS = [
  './',
  './index.html',
  './offline.html',
  './manifest.json',
  './logo.png',
  './sw.js',
  './estimate/',
  './maintenance/',
  './site-visit/',
  './gas-install/',
  './elect-install/',
  './qc-checklist/',
  './service-work/',
  './site-annotator/',
  './load-calcs/',
  './breaker-conductor/',
  './conduit-fill/',
  './property-lookup/',
  './property-lookup/fl_gas_territories.geojson',
  './property-lookup/fl_electric_territories.geojson',
  './gas-calc/',
  './spec-viewer/'
];

// CDN assets that must be cached on install for 100% offline support
var PRECACHE_CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
];

// Google Fonts CSS URLs — cached on install so fonts load offline
// Font files themselves are cached on first visit via staleWhileRevalidate
var PRECACHE_FONTS = [
  'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&family=Share+Tech+Mono&family=Exo+2:wght@300;400;500;600&display=swap',
  'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&family=Share+Tech+Mono&family=Exo+2:wght@300;400;500;600;700&display=swap',
  'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&family=Share+Tech+Mono&family=Exo+2:wght@300;400;500;600&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap',
  'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap',
  'https://fonts.googleapis.com/css2?family=Orbitron:wght@700&family=Share+Tech+Mono&display=swap',
];

var CACHE_CDN = [
  'https://api.mapbox.com',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
  'https://cdnjs.cloudflare.com'
];

// ============================================================
//  INSTALL — Pre-cache all core files
//  ⚠ NO skipWaiting here — we wait for the user to tap
//  "Update Now" before taking over. This gives them time
//  to read the changelog before the page reloads.
// ============================================================
self.addEventListener('install', function(event) {
  console.log('[SW] Installing — Cache:', CACHE_NAME);

  if (DEV_MODE) {
    console.log('[SW] ⚠ DEV MODE — taking control immediately');
    self.skipWaiting();
    return;
  }

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('[SW] Pre-caching core files');
        var total = PRECACHE_URLS.length;
        var completed = 0;
        var scope = self.registration.scope; // e.g. https://brandonaog.github.io/AOGTEST/

        // Combine all URLs to cache: app pages + CDN assets + fonts
        var allUrls = PRECACHE_URLS.concat(PRECACHE_CDN).concat(PRECACHE_FONTS);
        total = allUrls.length;

        // Sequential caching so progress is accurate and stored for polling
        return allUrls.reduce(function(chain, url) {
          return chain.then(function() {
            // CDN and font URLs are already absolute; convert relative ones using scope
            var absUrl = url.startsWith('http') ? url : new URL(url, scope).href;
            var label = absUrl.replace(scope,'').replace(/\/$/,'') || absUrl.split('/').pop() || 'cdn';
            return cache.add(absUrl)
              .then(function() {
                completed++;
                cacheProgress = {
                  percent: Math.round((completed / total) * 100),
                  label: label,
                  done: completed === total
                };
                console.log('[SW] Cached (' + cacheProgress.percent + '%):', absUrl);
              })
              .catch(function(err) {
                completed++;
                cacheProgress = {
                  percent: Math.round((completed / total) * 100),
                  label: 'skipped: ' + label,
                  done: completed === total
                };
                console.warn('[SW] Pre-cache skipped:', absUrl, err);
              });
          });
        }, Promise.resolve());
      })
      .then(function() {
        cacheProgress = { percent: 100, label: 'All files cached', done: true };
        console.log('[SW] Install complete — waiting for user to approve update');
        // No skipWaiting() on purpose — user taps Update Now to activate
      })
  );
});


// ============================================================
//  ACTIVATE — Delete old caches, claim clients
// ============================================================
self.addEventListener('activate', function(event) {
  console.log('[SW] Activating — Cache:', CACHE_NAME);

  event.waitUntil(
    caches.keys()
      .then(function(cacheNames) {
        return Promise.all(
          cacheNames.map(function(cacheName) {
            if (cacheName !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(function() {
        console.log('[SW] Activated — claiming all clients');
        return self.clients.claim();
      })
  );
});

// ============================================================
//  FETCH — Request handling strategies
// ============================================================
self.addEventListener('fetch', function(event) {

  var request = event.request;

  // Safari fix: wrap URL parsing in try/catch — malformed URLs throw and
  // crash the entire fetch handler, causing the respondWith error
  var url;
  try { url = new URL(request.url); } catch(e) { return; }

  // Only handle GET requests over http/https — let everything else pass through
  if (request.method !== 'GET') return;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Safari fix: skip cross-origin requests that aren't in our CDN list —
  // Safari throws on certain cross-origin fetches inside the SW
  var isSameOrigin = url.origin === self.location.origin;
  var isAllowedCDN = url.hostname.includes('fonts.googleapis.com') ||
                     url.hostname.includes('fonts.gstatic.com')    ||
                     url.hostname.includes('cdnjs.cloudflare.com') ||
                     url.hostname.includes('mapbox.com')           ||
                     url.hostname.includes('mapbox.cn');
  if (!isSameOrigin && !isAllowedCDN) return;

  if (DEV_MODE) {
    event.respondWith(
      fetch(request).catch(function() {
        return new Response(
          '<h2 style="font-family:sans-serif;color:red;padding:20px">⚠ Network unavailable (Dev Mode)</h2>',
          { headers: { 'Content-Type': 'text/html' } }
        );
      })
    );
    return;
  }

  if (url.hostname.includes('mapbox.com') || url.hostname.includes('mapbox.cn')) {
    event.respondWith(
      fetch(request).catch(function() {
        return new Response('{}', { headers: { 'Content-Type': 'application/json' } });
      })
    );
    return;
  }

  var accept = request.headers.get('Accept') || '';

  if (accept.includes('text/html')) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com')    ||
      url.hostname.includes('cdnjs.cloudflare.com')) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Safari fix: request.destination can be empty string — use || '' guard
  var dest = request.destination || '';
  if (dest === 'image' || url.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp)$/i)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (url.pathname.match(/\.(js|css)$/i)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  event.respondWith(networkFirst(request));
});

// ============================================================
//  STRATEGY: Network First
// ============================================================
function networkFirst(request) {
  return fetch(request)
    .then(function(networkResponse) {
      if (networkResponse && networkResponse.ok) {
        var responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(request, responseClone);
        });
      }
      return networkResponse;
    })
    .catch(function() {
      return caches.match(request)
        .then(function(cachedResponse) {
          if (cachedResponse) return cachedResponse;
          var accept = request.headers.get('Accept') || '';
          if (accept.includes('text/html')) {
            // Build offline URL relative to SW scope — matches how it was cached
            var offlineUrl = self.registration.scope + 'offline.html';
            console.log('[SW] Looking for offline page at:', offlineUrl);
            return caches.match(offlineUrl)
              .then(function(r) {
                if (r) return r;
                // Fallback: search all caches for offline.html
                return caches.keys().then(function(cacheNames) {
                  return Promise.all(
                    cacheNames.map(function(name) {
                      return caches.open(name).then(function(c) {
                        return c.match(offlineUrl);
                      });
                    })
                  ).then(function(results) {
                    for (var i = 0; i < results.length; i++) {
                      if (results[i]) return results[i];
                    }
                    // Last resort inline fallback
                    return new Response(
                      '<!DOCTYPE html><html><head><meta charset=UTF-8><meta name=viewport content=width=device-width,initial-scale=1><title>Offline</title></head><body style=background:#060913;color:#FBBF24;font-family:monospace;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center><div><div style=font-size:3rem>⚡</div><h2 style=margin:16px 0>You are offline</h2><p style=color:#7A8BA8>Connect to the internet and try again</p><br><button onclick=location.reload() style=background:#FBBF24;color:#060913;border:none;padding:12px 28px;border-radius:8px;font-weight:bold;font-size:1rem;cursor:pointer>Try Again</button></div></body></html>',
                      { headers: { 'Content-Type': 'text/html' } }
                    );
                  });
                });
              });
          }
          return new Response('Service Unavailable', { status: 503 });
        });
    });
}

// ============================================================
//  STRATEGY: Stale While Revalidate
// ============================================================
function staleWhileRevalidate(request) {
  return caches.open(CACHE_NAME).then(function(cache) {
    return cache.match(request).then(function(cachedResponse) {
      var networkFetch = fetch(request).then(function(networkResponse) {
        if (networkResponse && networkResponse.ok) {
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      }).catch(function(err) {
        console.log('[SW] Revalidate failed:', err);
        // Return a valid empty response so respondWith never gets undefined
        return new Response('', { status: 503 });
      });
      return cachedResponse || networkFetch;
    });
  });
}

// ============================================================
//  STRATEGY: Cache First
// ============================================================
function cacheFirst(request) {
  return caches.match(request).then(function(cachedResponse) {
    if (cachedResponse) return cachedResponse;
    return fetch(request).then(function(networkResponse) {
      if (networkResponse && networkResponse.ok) {
        var responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(request, responseClone);
        });
      }
      return networkResponse;
    }).catch(function() {
      return new Response('', { status: 503 });
    });
  });
}

// ============================================================
//  MESSAGE HANDLER
// ============================================================
self.addEventListener('message', function(event) {

  // User tapped "Update Now" — activate and let page reload
  if (event.data && event.data.action === 'SKIP_WAITING') {
    console.log('[SW] User approved update — activating now');
    self.skipWaiting();
  }

  if (event.data && event.data.action === 'CLEAR_CACHE') {
    caches.keys().then(function(keys) {
      keys.forEach(function(key) { caches.delete(key); });
    });
    event.ports[0].postMessage({ result: 'Cache cleared' });
  }

  // Page asks new waiting SW what changed — reply with fresh changelog
  if (event.data && event.data.action === 'GET_CHANGELOG') {
    event.ports[0].postMessage({
      version:   CACHE_NAME,
      changelog: CHANGELOG
    });
  }

  // Page requests current cache progress (for late-loading pages that missed broadcasts)
  if (event.data && event.data.action === 'GET_CACHE_PROGRESS') {
    if (event.ports[0]) {
      event.ports[0].postMessage({
        action:  'CACHE_PROGRESS',
        percent: cacheProgress.percent,
        label:   cacheProgress.label,
        done:    cacheProgress.done
      });
    }
  }

});

// ============================================================
//  END OF SERVICE WORKER
// ============================================================
