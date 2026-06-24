import path from "path"
import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"
import { VitePWA } from "vite-plugin-pwa" // 引入PWA插件

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "")
  const buildStamp = new Date().toISOString()
  return {
    base: "/",
    server: {
      port: 5174,
      host: "0.0.0.0",
    },
    plugins: [
      react(),
      ...(mode === "production"
        ? [
            {
              name: "inject-production-csp",
              transformIndexHtml(html: string) {
                return html.replace(
                  '<meta name="referrer"',
                  '<meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests" />\n    <meta name="referrer"',
                )
              },
            },
          ]
        : []),
      // 🔥 新增：PWA 插件配置 (核心)
      VitePWA({
        registerType: "autoUpdate",
        // 开发环境不注册 SW，避免 Safari 缓存空壳页面导致黑屏
        devOptions: {
          enabled: false,
        },
        workbox: {
          // 强制新 SW 尽快接管，减少旧缓存导致的“页面一直请求”
          skipWaiting: true,
          clientsClaim: true,
          cleanupOutdatedCaches: true,
          // 缓存所有静态资源 (JS, CSS, Fonts...)
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],

          // 核心：缓存来自 API 的图片
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.pathname.startsWith("/api/image/proxy"),
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "api-images-cache",
                expiration: {
                  maxEntries: 300,
                  maxAgeSeconds: 30 * 24 * 60 * 60,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },

        // Manifest 配置 (可选，让应用可以被“添加到主屏幕”)
        manifest: {
          name: "Vastren",
          short_name: "Vastren",
          description: `A modern video catalog. build:${buildStamp}`,
          theme_color: "#050505",
          icons: [
            // 你需要准备一些图标放在 public 文件夹下
            { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
            { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          ],
        },
      }),
    ],

    define: {
      "process.env.API_KEY": JSON.stringify(env.GEMINI_API_KEY),
      "process.env.GEMINI_API_KEY": JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
  }
})
