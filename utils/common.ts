interface ProxyOptions {
  w?: number
  q?: number
  forceProxy?: boolean
}

export const normalizeMediaUrl = (url?: string) => {
  if (!url) return ""
  const normalized = url.startsWith("//") ? `https:${url}` : url
  return normalized.startsWith("http://")
    ? normalized.replace("http://", "https://")
    : normalized
}

export const getProxyUrl = (url?: string, _options: ProxyOptions = {}) =>
  normalizeMediaUrl(url)
