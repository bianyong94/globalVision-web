interface ProxyOptions {
  w?: number
  q?: number
  forceProxy?: boolean
}

export const getProxyUrl = (url?: string, options: ProxyOptions = {}) => {
  if (!url) return ""

  const normalized = url.startsWith("//") ? `https:${url}` : url
  const directUrl = normalized.startsWith("http://")
    ? normalized.replace("http://", "https://")
    : normalized

  return directUrl
}
