export type VideoWithCast = HTMLVideoElement & {
  webkitShowPlaybackTargetPicker?: () => void
  webkitEnterFullscreen?: () => void
  webkitEnterFullScreen?: () => void
  webkitExitFullscreen?: () => void
  webkitRequestFullscreen?: () => Promise<void> | void
  webkitDisplayingFullscreen?: boolean
  disableRemotePlayback?: boolean
}

export const getDeviceInfo = () => {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : ""
  const isAndroid = /Android/i.test(ua)
  const isIOS =
    /iPhone|iPad|iPod/i.test(ua) ||
    (typeof navigator !== "undefined" &&
      navigator.platform === "MacIntel" &&
      navigator.maxTouchPoints > 1)
  const isStandalone =
    (typeof window !== "undefined" &&
      window.matchMedia?.("(display-mode: standalone)")?.matches) ||
    (typeof navigator !== "undefined" &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))

  return { isAndroid, isIOS, isStandalone, isMobile: isIOS || isAndroid }
}

export const configureMobileVideo = (video: VideoWithCast) => {
  video.setAttribute("playsinline", "true")
  video.setAttribute("webkit-playsinline", "true")
  video.setAttribute("x5-playsinline", "true")
  video.setAttribute("x5-video-player-type", "h5-page")
  video.setAttribute("x5-video-player-fullscreen", "true")
  video.setAttribute("x5-video-orientation", "portraint")
}

export const getSourceType = (url: string) => {
  if (/\.m3u8(?:$|[?#])/i.test(url)) return "application/x-mpegURL"
  if (/\.mp4(?:$|[?#])/i.test(url)) return "video/mp4"
  if (/\.webm(?:$|[?#])/i.test(url)) return "video/webm"
  return "application/x-mpegURL"
}
