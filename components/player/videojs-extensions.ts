import videojs from "video.js"
import type Player from "video.js/dist/types/player"

export type VideoWithCast = HTMLVideoElement & {
  webkitShowPlaybackTargetPicker?: () => void
  webkitEnterFullscreen?: () => void
  webkitEnterFullScreen?: () => void
  webkitExitFullscreen?: () => void
  webkitDisplayingFullscreen?: boolean
  disableRemotePlayback?: boolean
  remote?: {
    state?: string
    prompt?: () => Promise<void>
    watchAvailability?: (
      callback: (available: boolean) => void,
    ) => Promise<void>
  }
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

export const getSourceType = (url: string) => {
  if (/\.m3u8(?:$|[?#])/i.test(url)) return "application/x-mpegURL"
  if (/\.mp4(?:$|[?#])/i.test(url)) return "video/mp4"
  if (/\.webm(?:$|[?#])/i.test(url)) return "video/webm"
  return "application/x-mpegURL"
}

const getVideoEl = (player: Player): VideoWithCast | null => {
  const tech = player.tech(true) as { el?: () => HTMLVideoElement } | undefined
  return (tech?.el?.() as VideoWithCast | undefined) || null
}

const configureVideoForCast = (video: VideoWithCast) => {
  video.setAttribute("webkit-airplay", "allow")
  video.setAttribute("x-webkit-airplay", "allow")
  video.setAttribute("playsinline", "true")
  if ("disableRemotePlayback" in video) {
    video.disableRemotePlayback = false
  }
}

const supportsAirPlay = (video: VideoWithCast) =>
  typeof video.webkitShowPlaybackTargetPicker === "function"

const supportsRemotePlayback = (video: VideoWithCast) =>
  Boolean(video.remote && typeof video.remote.prompt === "function")

const showCastGuide = (
  isIOS: boolean,
  isAndroid: boolean,
  isStandalone: boolean,
) => {
  if (isIOS) {
    window.alert(
      "iOS 投屏：请确保设备与电视在同一 Wi-Fi，点击 AirPlay 图标或前往控制中心 → 屏幕镜像。",
    )
    return
  }

  if (isAndroid) {
    window.alert(
      `安卓投屏：下拉状态栏 → 投屏 / 无线显示，选择电视设备。${isStandalone ? "（桌面快捷方式模式建议镜像整个屏幕）" : ""}`,
    )
    return
  }

  window.alert("当前环境不支持网页内投屏，请使用系统屏幕镜像功能。")
}

const tryCastPlayback = async (video: VideoWithCast) => {
  configureVideoForCast(video)

  if (supportsAirPlay(video)) {
    video.webkitShowPlaybackTargetPicker?.()
    return true
  }

  const remote = video.remote
  if (!remote?.prompt) return false

  try {
    if (remote.watchAvailability) {
      const available = await new Promise<boolean>((resolve) => {
        remote
          .watchAvailability?.((state) => resolve(Boolean(state)))
          .catch(() => resolve(false))
      })
      if (!available) return false
    }

    await remote.prompt()
    return true
  } catch {
    return false
  }
}

const isVideoFullscreen = (video?: VideoWithCast | null) =>
  Boolean(
    document.fullscreenElement ||
      (document as Document & { webkitFullscreenElement?: Element })
        .webkitFullscreenElement ||
      video?.webkitDisplayingFullscreen,
  )

const isPlayerFullscreen = (player: Player) =>
  Boolean(
    player.isFullscreen?.() ||
      document.fullscreenElement ||
      (document as Document & { webkitFullscreenElement?: Element })
        .webkitFullscreenElement ||
      isVideoFullscreen(getVideoEl(player)),
  )

const toggleFullscreen = async (player: Player, isIOS: boolean) => {
  const video = getVideoEl(player)
  if (!video) return

  if (isPlayerFullscreen(player)) {
    await player.exitFullscreen?.().catch(() => {})
    await document.exitFullscreen?.().catch(() => {})
    ;(
      document as Document & { webkitExitFullscreen?: () => void }
    ).webkitExitFullscreen?.()
    video.webkitExitFullscreen?.()
    return
  }

  if (isIOS) {
    const enter = video.webkitEnterFullscreen || video.webkitEnterFullScreen
    if (typeof enter === "function") {
      enter.call(video)
      return
    }
  }

  const candidates = [
    video,
    player.el(),
    player.el().querySelector(".vjs-tech") as HTMLElement | null,
  ].filter(Boolean) as HTMLElement[]

  for (const target of candidates) {
    const request =
      target.requestFullscreen?.bind(target) ||
      (target as HTMLElement & { webkitRequestFullscreen?: () => void })
        .webkitRequestFullscreen?.bind(target)
    if (!request) continue

    try {
      await request()
      return
    } catch {
      // try next
    }
  }

  await player.requestFullscreen?.().catch(() => {})
}

let extensionsRegistered = false

export const registerVideoJsExtensions = () => {
  if (extensionsRegistered) return
  extensionsRegistered = true

  const Button = videojs.getComponent("Button")
  const FullscreenToggle = videojs.getComponent("FullscreenToggle")
  const device = getDeviceInfo()

  class CastButton extends Button {
    constructor(player: Player, options?: videojs.ButtonOptions) {
      super(player, options)
      this.controlText("投屏")
      this.addClass("vjs-cast-control")
    }

    handleClick() {
      const video = getVideoEl(this.player())
      if (!video) return

      void (async () => {
        const started = await tryCastPlayback(video)
        if (!started) {
          showCastGuide(device.isIOS, device.isAndroid, device.isStandalone)
        }
      })()
    }

    buildCSSClass() {
      return `vjs-cast-control ${super.buildCSSClass()}`
    }
  }

  class UniversalFullscreenToggle extends FullscreenToggle {
    handleClick() {
      void toggleFullscreen(this.player(), device.isIOS)
    }

    constructor(player: Player, options?: videojs.ButtonOptions) {
      super(player, options)
      this.controlText("全屏")
    }

    buildCSSClass() {
      return `vjs-universal-fullscreen-control ${super.buildCSSClass()}`
    }
  }

  const isComponentRegistered = (name: string) => {
    try {
      videojs.getComponent(name)
      return true
    } catch {
      return false
    }
  }

  if (!isComponentRegistered("CastButton")) {
    videojs.registerComponent("CastButton", CastButton)
  }
  if (!isComponentRegistered("UniversalFullscreenToggle")) {
    videojs.registerComponent(
      "UniversalFullscreenToggle",
      UniversalFullscreenToggle,
    )
  }
}

export const getControlBarChildren = () => {
  return [
    "playToggle",
    "volumePanel",
    "currentTimeDisplay",
    "timeDivider",
    "durationDisplay",
    "progressControl",
    "playbackRateMenuButton",
    "CastButton",
    "UniversalFullscreenToggle",
  ]
}

export const applyVideoCastAttrs = (player: Player) => {
  const video = getVideoEl(player)
  if (video) configureVideoForCast(video)
}
