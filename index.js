import { registerRootComponent } from 'expo';

import App from './App';

if (typeof document !== "undefined") {
	const ensureHeadTag = (selector, createTag) => {
		if (!document.head.querySelector(selector)) {
			document.head.appendChild(createTag());
		}
	};

	ensureHeadTag('link[rel="manifest"]', () => {
		const link = document.createElement("link");
		link.rel = "manifest";
		link.href = "/manifest.json";
		return link;
	});

	ensureHeadTag('meta[name="apple-mobile-web-app-capable"]', () => {
		const meta = document.createElement("meta");
		meta.name = "apple-mobile-web-app-capable";
		meta.content = "yes";
		return meta;
	});

	ensureHeadTag('meta[name="mobile-web-app-capable"]', () => {
		const meta = document.createElement("meta");
		meta.name = "mobile-web-app-capable";
		meta.content = "yes";
		return meta;
	});
}

if (typeof window !== "undefined" && "serviceWorker" in navigator) {
	window.addEventListener("load", () => {
		navigator.serviceWorker.register("/sw.js").catch((error) => {
			console.error("Service worker registration failed:", error);
		});
	});
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
