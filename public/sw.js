const CACHE_NAME = "moving-mep-shell-v1";
const APP_SHELL = [
	"/",
	"/favicon.ico",
	"/manifest.json",
	"/icon-192.png",
	"/icon-512.png",
];

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
	);
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches.keys().then((keys) =>
			Promise.all(
				keys
					.filter((key) => key !== CACHE_NAME)
					.map((key) => caches.delete(key)),
			),
		),
	);
	self.clients.claim();
});

self.addEventListener("fetch", (event) => {
	if (event.request.method !== "GET") {
		return;
	}

	const requestUrl = new URL(event.request.url);

	if (event.request.mode === "navigate") {
		event.respondWith(
			fetch(event.request).catch(() => caches.match("/")),
		);
		return;
	}

	if (requestUrl.origin !== self.location.origin) {
		return;
	}

	event.respondWith(
		caches.match(event.request).then((cachedResponse) => {
			if (cachedResponse) {
				return cachedResponse;
			}

			return fetch(event.request).then((networkResponse) => {
				if (!networkResponse || networkResponse.status !== 200) {
					return networkResponse;
				}

				const responseToCache = networkResponse.clone();
				caches.open(CACHE_NAME).then((cache) => {
					cache.put(event.request, responseToCache);
				});

				return networkResponse;
			});
		}),
	);
});
