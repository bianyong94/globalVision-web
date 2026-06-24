interface ProxyOptions {
  w?: number
  q?: number
  forceProxy?: boolean
}

const IMAGE_PROXY_BASE = "https://wsrv.nl/"
const IMAGE_PLACEHOLDER =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="3" height="4" viewBox="0 0 3 4" preserveAspectRatio="none"><rect width="3" height="4" fill="#0c1020"/></svg>`,
  )

export const normalizeMediaUrl = (url?: string) => {
  if (!url) return ""
  const normalized = url.startsWith("//") ? `https:${url}` : url
  return normalized.startsWith("http://")
    ? normalized.replace("http://", "https://")
    : normalized
}

const isProxyableUrl = (url: string) => /^https?:\/\//i.test(url)

const isImageProxyUrl = (url: string) =>
  /^https:\/\/(?:wsrv\.nl|images\.weserv\.nl)\//i.test(url)

const BYPASS_PROXY_HOSTS = [
  /(?:^|\.)baidu\.com$/i,
  /(?:^|\.)lputol\.com$/i,
  /(?:^|\.)kitpg\.cn$/i,
]

const shouldBypassProxy = (url: string) => {
  try {
    const host = new URL(url).host
    return BYPASS_PROXY_HOSTS.some((pattern) => pattern.test(host))
  } catch {
    return false
  }
}

export const getProxyUrl = (url?: string, options: ProxyOptions = {}) => {
  const normalized = normalizeMediaUrl(url)
  if (!normalized) return ""
  if (!options.forceProxy && !options.w && !options.q) return normalized
  if (!isProxyableUrl(normalized)) return normalized
  if (isImageProxyUrl(normalized)) return normalized
  if (!options.forceProxy && shouldBypassProxy(normalized)) return normalized

  const proxy = new URL(IMAGE_PROXY_BASE)
  proxy.searchParams.set("url", normalized)

  if (options.w) proxy.searchParams.set("w", String(options.w))
  if (options.q) proxy.searchParams.set("q", String(options.q))

  proxy.searchParams.set("output", "webp")
  proxy.searchParams.set("we", "1")

  return proxy.toString()
}

export const createImageFallbackHandler =
  (fallbackUrl?: string) => (e: { currentTarget: HTMLImageElement }) => {
    const img = e.currentTarget
    const fallback = normalizeMediaUrl(fallbackUrl)

    if (img.dataset.fallbackStage !== "1" && fallback && img.src !== fallback) {
      img.dataset.fallbackStage = "1"
      img.src = fallback
      return
    }

    img.dataset.fallbackStage = "2"
    img.src = IMAGE_PLACEHOLDER
  }
