import {
  configureMobileVideo,
  getDeviceInfo,
  type VideoWithCast,
} from "./device"

export const isNativeVideoFullscreen = (video?: VideoWithCast | null) =>
  Boolean(
    document.fullscreenElement ||
      (document as Document & { webkitFullscreenElement?: Element })
        .webkitFullscreenElement ||
      video?.webkitDisplayingFullscreen,
  )

export const enterNativeFullscreen = async (video: VideoWithCast) => {
  configureMobileVideo(video)

  const { isIOS } = getDeviceInfo()

  if (isIOS) {
    const enter = video.webkitEnterFullscreen || video.webkitEnterFullScreen
    if (typeof enter === "function") {
      enter.call(video)
      return true
    }
  }

  const candidates = [
    video.requestFullscreen?.bind(video),
    video.webkitRequestFullscreen?.bind(video),
    (video as VideoWithCast & { webkitEnterFullscreen?: () => void })
      .webkitEnterFullscreen?.bind(video),
    (video as VideoWithCast & { mozRequestFullScreen?: () => void })
      .mozRequestFullScreen?.bind(video),
  ].filter(Boolean) as Array<() => Promise<void> | void>

  for (const request of candidates) {
    try {
      await request()
      return true
    } catch {
      // try next
    }
  }

  const container = video.closest(".gv-native-player") ?? video.parentElement
  const containerRequest =
    container?.requestFullscreen?.bind(container) ||
    (container as HTMLElement & { webkitRequestFullscreen?: () => void })
      ?.webkitRequestFullscreen?.bind(container)
  if (containerRequest) {
    try {
      await containerRequest()
      return true
    } catch {
      // fall through
    }
  }

  return false
}

export const exitNativeFullscreen = async (video?: VideoWithCast | null) => {
  if (video?.webkitDisplayingFullscreen) {
    video.webkitExitFullscreen?.()
    return
  }

  await document.exitFullscreen?.().catch(() => {})
  ;(
    document as Document & { webkitExitFullscreen?: () => void }
  ).webkitExitFullscreen?.()
}

export const toggleNativeFullscreen = async (video: VideoWithCast) => {
  if (isNativeVideoFullscreen(video)) {
    await exitNativeFullscreen(video)
    return
  }

  await enterNativeFullscreen(video)
}
