interface ProxyOptions {
  w?: number
  q?: number
  forceProxy?: boolean
}

const resolveApiBase = () => {
  const raw = (import.meta.env.VITE_API_BASE_URL || "/api").trim()
  if (raw.endsWith("/api")) return raw
  if (raw.endsWith("/api/")) return raw.slice(0, -1)
  return `${raw.replace(/\/+$/, "")}/api`
}

export const getProxyUrl = (url?: string, options: ProxyOptions = {}) => {
  if (!url) return ""
  if (url.includes("/api/image/proxy?url=")) return url

  const normalized = url.startsWith("//") ? `https:${url}` : url
  const directUrl = normalized.startsWith("http://")
    ? normalized.replace("http://", "https://")
    : normalized

  // 本地开发优先直连，避免后端未重启或代理限制导致整站无图。
  if (import.meta.env.DEV && !options.forceProxy) return directUrl

  const apiBase = resolveApiBase()
  const params = new URLSearchParams({ url: directUrl })

  if (options.w && Number.isFinite(options.w)) {
    params.set("w", String(Math.max(100, Math.floor(options.w))))
  }
  if (options.q && Number.isFinite(options.q)) {
    params.set("q", String(Math.min(95, Math.max(40, Math.floor(options.q)))))
  }

  return `${apiBase}/image/proxy?${params.toString()}`
}
