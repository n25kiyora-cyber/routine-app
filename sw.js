// オフラインでも開けるように、アプリのファイルをスマホに保存しておく。
// ファイルを更新したら VERSION の数字を上げる。
const VERSION = "v8";
const FILES = ["./", "index.html", "style.css", "app.js", "manifest.json", "icon.svg", "icon-180.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
  );
});

// ネットにつながれば最新を、つながらなければ保存したものを使う
// 保存するのは、このサイト自身のファイルを正しく取得できたとき(GET・200番台)だけ
self.addEventListener("fetch", (e) => {
  const sameSite = new URL(e.request.url).origin === self.location.origin;
  if (e.request.method !== "GET" || !sameSite) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
