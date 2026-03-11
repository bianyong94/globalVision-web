import path from "path"
import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"
import { VitePWA } from "vite-plugin-pwa" // 引入PWA插件

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "")
  return {
    base: "/",
    server: {
      port: 5174,
      host: "0.0.0.0",
      proxy: {
        "/api": {
          target: "http://127.0.0.1:3000", // 你的真实后端接口地址
          changeOrigin: true, // 是否跨域
          // 如果后端接口本身不带 /api，需要把 /api 移除掉；如果带，则不需要重写
          // rewrite: (path) => path.replace(/^\/api/, '')
        },
      },
    },
    plugins: [
      react(),
      // 🔥 新增：PWA 插件配置 (核心)
      VitePWA({
        registerType: "autoUpdate",
        workbox: {
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
          name: "Global Vision",
          short_name: "GV",
          description: "A modern video streaming app.",
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
