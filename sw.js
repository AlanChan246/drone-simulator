const CACHE_VERSION = 'drone-simulator-hero-video-nowm-20260722';
const APP_SHELL = [
  './', './index.html', './style.css',
  './js/simulator.js', './js/blockly_def.js', './js/mission2_answer.js', './js/main.js',
  './node_modules/three/build/three.min.js',
  './node_modules/three/examples/js/loaders/GLTFLoader.js',
  './node_modules/blockly/blockly_compressed.js',
  './node_modules/blockly/blocks_compressed.js',
  './node_modules/blockly/javascript_compressed.js',
  './node_modules/blockly/msg/en.js',
  './assets/models/kenney/starter-city/models/road-straight.glb',
  './assets/models/kenney/starter-city/models/road-corner.glb',
  './assets/models/kenney/starter-city/models/road-split.glb',
  './assets/models/kenney/starter-city/models/road-intersection.glb',
  './assets/models/kenney/starter-city/models/pavement.glb',
  './assets/models/kenney/starter-city/models/pavement-fountain.glb',
  './assets/models/kenney/starter-city/models/building-small-a.glb',
  './assets/models/kenney/starter-city/models/building-small-b.glb',
  './assets/models/kenney/starter-city/models/building-small-c.glb',
  './assets/models/kenney/starter-city/models/building-small-d.glb',
  './assets/models/kenney/starter-city/models/building-garage.glb',
  './assets/models/kenney/starter-city/models/grass-trees.glb',
  './assets/models/kenney/starter-city/models/grass-trees-tall.glb',
  './assets/models/kenney/starter-city/models/Textures/colormap.png',
  './assets/models/kenney_city-kit-commercial_2.1/Models/GLB format/building-g.glb',
  './assets/models/kenney_city-kit-commercial_2.1/Models/GLB format/building-c.glb',
  './assets/models/kenney_city-kit-commercial_2.1/Models/GLB format/building-skyscraper-a.glb',
  './assets/models/kenney_city-kit-commercial_2.1/Models/GLB format/building-skyscraper-b.glb',
  './assets/models/kenney_city-kit-commercial_2.1/Models/GLB format/Textures/colormap.png'
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
