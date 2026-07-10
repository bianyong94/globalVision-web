interface ProxyOptions {
  w?: number
  q?: number
  forceProxy?: boolean
}

const IMAGE_PROXY_BASE = String(import.meta.env.VITE_IMAGE_PROXY_BASE || "").trim()
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

const isImageProxyUrl = (url: string) => {
  if (!IMAGE_PROXY_BASE) return false
  try {
    return new URL(url).origin === new URL(IMAGE_PROXY_BASE, location.origin).origin
  } catch {
    return false
  }
}

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
  // Mainland users should hit the image origin directly by default. The old
  // public wsrv.nl hop added a slow, cross-border request to every image.
  // Deployments with a first-party image CDN can opt in via this env value.
  if (!IMAGE_PROXY_BASE) return normalized
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

    if (
      img.dataset.fallbackStage !== "1" &&
      fallback &&
      IMAGE_PROXY_BASE &&
      !isImageProxyUrl(img.src)
    ) {
      img.dataset.fallbackStage = "1"
      img.src = getProxyUrl(fallback, { forceProxy: true, q: 72 })
      return
    }

    img.dataset.fallbackStage = "2"
    img.src = IMAGE_PLACEHOLDER
  }

export const getSignedMediaExpiry = (url?: string) => {
  const normalized = normalizeMediaUrl(url)
  if (!normalized) return 0

  try {
    const rawExpiry = new URL(normalized).searchParams.get("t")
    if (!rawExpiry) return 0
    const numericExpiry = Number(rawExpiry)
    if (!Number.isFinite(numericExpiry) || numericExpiry <= 0) return 0
    return numericExpiry < 10_000_000_000
      ? numericExpiry * 1000
      : numericExpiry
  } catch {
    return 0
  }
}
