import React from "react"
import ReactDOM from "react-dom/client"
import { Analytics } from "@vercel/analytics/react"
import App from "./App"
// 1. 引入 React Query
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import "./index.css"
import { HelmetProvider } from "react-helmet-async" // 引入这个

// 2. 创建实例并配置默认策略
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 🔥 核心配置：
      // staleTime: 数据"保鲜"时间。设置为 5 分钟 (1000 * 60 * 5)。
      // 在这 5 分钟内，只要缓存里有数据，再次进入页面直接读取缓存，不发网络请求。
      staleTime: 1000 * 60 * 5,

      // gcTime: 缓存垃圾回收时间 (默认 5 分钟)。如果不使用该数据，多久后从内存清除。
      gcTime: 1000 * 60 * 10,

      // 失败重试次数 (默认 3 次，设为 1 次避免接口挂了狂刷)
      retry: 1,

      // 窗口重新聚焦时不自动刷新 (看视频时切出去切回来不需要刷新)
      refetchOnWindowFocus: false,
    },
  },
})

const rootElement = document.getElementById("root")
if (!rootElement) {
  throw new Error("Could not find root element to mount to")
}

const root = ReactDOM.createRoot(rootElement)
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <App />
        <Analytics />
      </HelmetProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
