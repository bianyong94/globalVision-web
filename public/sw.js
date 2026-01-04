// 简单的 Service Worker，主要为了满足 PWA 安装标准
self.addEventListener("install", (e) => {
  console.log("[Service Worker] Install")
})
self.addEventListener("fetch", (e) => {
  // 这里可以做离线缓存，目前直接透传请求
  // e.respondWith(fetch(e.request));
})
