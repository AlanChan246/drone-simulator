const CACHE_VERSION = 'drone-simulator-charge-material-fix-20260717';
const APP_SHELL = [
  './', './index.html', './style.css',
  './js/simulator.js', './js/blockly_def.js', './js/mission2_answer.js', './js/main.js',
  './node_modules/three/build/three.min.js',
  './node_modules/three/examples/js/loaders/GLTFLoader.js',
  './node_modules/blockly/blockly_compressed.js',
  './node_modules/blockly/blocks_compressed.js',
  './node_modules/blockly/javascript_compressed.js',
  './node_modules/blockly/msg/en.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_VERSION).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_VERSION).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fromNetwork = fetch(event.request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, copy));
        }
        return response;
      });
      return cached || fromNetwork.catch(() => caches.match('./index.html'));
    })
  );
});
