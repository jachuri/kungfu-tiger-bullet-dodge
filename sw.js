/**
 * Service Worker — 오프라인 캐시 전략
 * 게임에 필요한 모든 정적 에셋을 캐시하여 오프라인 플레이 가능
 */

const CACHE_NAME = 'kungfu-tiger-v3';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/main.js',
  '/js/game.js',
  '/js/player.js',
  '/js/bullet.js',
  '/js/audio.js',
  '/js/ranking.js',
  '/js/touch.js',
  '/assets/svg/tiger.svg',
  '/assets/svg/tiger-jump.svg',
  '/assets/svg/tiger-duck.svg',
  '/assets/svg/bullet-h.svg',
  '/assets/svg/bullet-v.svg',
  '/manifest.json'
];

// 설치: 정적 에셋 프리캐시
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 활성화: 이전 캐시 정리
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// 페치: 캐시 우선, 네트워크 대체 (Cache First)
self.addEventListener('fetch', (event) => {
  // Google Fonts 등 외부 리소스는 네트워크 우선
  if (!event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        // 유효한 응답만 캐시에 추가
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
