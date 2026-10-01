// オフラインでも開けるように、アプリのファイルをスマホに保存しておく。
// ファイルを更新したら VERSION の数字を上げ、index.html の ?v= の数字もそろえる。
const VERSION = "v14";
const FILES = ["./", "index.html", "style.css?v=14", "app.js?v=14", "ui.js?v=14", "manifest.json", "icon.svg", "icon-180.png"];

self.addEventListener("install", (e) => {
  self.skipWaiting(); // 新しい版をすぐ使う
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES.map((u) => new Request(u, { cache: "reload" }))))); // 一時保存を使わず最新を取る
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 保存するのは、このサイト自身のファイルを正しく取得できたとき(GET・200番台)だけ。
// ブラウザの一時保存(HTTPキャッシュ)を使わず、毎回サーバーに最新を確認する
self.addEventListener("fetch", (e) => {
  const sameSite = new URL(e.request.url).origin === self.location.origin;
  if (e.request.method !== "GET" || !sameSite) return;
  e.respondWith(
    fetch(e.request, { cache: "no-cache" })
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
