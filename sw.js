const CACHE_VERSION = 'drone-simulator-architecture-20260927a';
importScripts('js/asset_catalog.js');
const APP_SHELL = [
  "./",
  "index.html",
  "style.css",
  "js/v2_ui.js",
  "js/theme.js",
  "js/medical_drone_model.js",
  "js/main.js",
  "js/blockly_workspace_io.js",
  "js/scene_lifecycle.js",
  "js/mission2_answer.js",
  "js/flight_deck_view.js",
  "js/blockly_def.js",
  "js/flight_command_execution.js",
  "js/mission_rules.js",
  "js/simulator.js",
  "js/scenes/mission2-v2/config.js",
  "js/scenes/mission2-v2/assets.js",
  "js/scenes/mission2-v2/environment.js",
  "assets/images/mission-preview-1-final.png",
  "assets/video/drone-simulator-promo-poster.jpg",
  "assets/images/mission-preview-2-v2.png",
  "assets/styles/tokens.css",
  "assets/styles/hub.css",
  "assets/styles/overlays.css",
  "assets/styles/v2.css",
  "assets/styles/deck.css",
  "assets/styles/base.css",
  "node_modules/three/build/three.min.js",
  "node_modules/three/examples/js/loaders/GLTFLoader.js",
  "node_modules/three/examples/js/geometries/RoundedBoxGeometry.js",
  "node_modules/blockly/blockly_compressed.js",
  "node_modules/blockly/blocks_compressed.js",
  "node_modules/blockly/javascript_compressed.js",
  "node_modules/blockly/msg/zh-hant.js",
  "node_modules/blockly/media/1x1.gif",
  "node_modules/blockly/media/click.mp3",
  "node_modules/blockly/media/click.ogg",
  "node_modules/blockly/media/click.wav",
  "node_modules/blockly/media/delete.mp3",
  "node_modules/blockly/media/delete.ogg",
  "node_modules/blockly/media/delete.wav",
  "node_modules/blockly/media/disconnect.mp3",
  "node_modules/blockly/media/disconnect.ogg",
  "node_modules/blockly/media/disconnect.wav",
  "node_modules/blockly/media/dropdown-arrow.svg",
  "node_modules/blockly/media/handclosed.cur",
  "node_modules/blockly/media/handdelete.cur",
  "node_modules/blockly/media/handopen.cur",
  "node_modules/blockly/media/pilcrow.png",
  "node_modules/blockly/media/quote0.png",
  "node_modules/blockly/media/quote1.png",
  "node_modules/blockly/media/sprites.png",
  "node_modules/blockly/media/sprites.svg",
  "assets/styles/factory.css",
  "assets/images/mission-preview-factory.png",
  "js/factory/ui.js",
  "js/factory/runtime.js",
  "js/factory/rules.js",
  "js/factory/scene.js",
  "js/factory/config.js",
  "js/factory/blocks.js",
  "js/factory/mission.js",
  "js/factory/assets.js",
  "js/asset_catalog.js"
].concat(AssetCatalog.offline);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_VERSION).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('drone-simulator-') && key !== CACHE_VERSION).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Let the browser handle byte ranges; the poster remains available offline.
  if (/\.(?:mp4|webm)$/.test(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(event.request, {ignoreSearch: true});
    const isCode = event.request.mode === 'navigate' || /\.(?:js|css|html)$/.test(url.pathname);
    if (cached && !isCode) return cached;
    try {
      const response = await fetch(event.request);
      if (response.ok) await cache.put(event.request, response.clone());
      return response;
    } catch (error) {
      if (cached) return cached;
      if (event.request.mode === 'navigate') return await cache.match('./index.html') || Response.error();
      return Response.error();
    }
  })());
});
