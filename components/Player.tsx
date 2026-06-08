import React, { useEffect, useRef } from "react"
import Artplayer from "artplayer"
import Hls from "hls.js"

interface PlayerProps {
  url: string
  poster?: string
  className?: string
  initialTime?: number
  onTimeUpdate?: (time: number) => void
  onEnded?: () => void
  onError?: () => void
}

type VideoWithCast = HTMLVideoElement & {
  webkitShowPlaybackTargetPicker?: () => void
  webkitEnterFullscreen?: () => void
  disableRemotePlayback?: boolean
  remote?: {
    state?: string
    prompt?: () => Promise<void>
    watchAvailability?: (
      callback: (available: boolean) => void,
    ) => Promise<void>
  }
}

const getDeviceInfo = () => {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : ""
  const isAndroid = /Android/i.test(ua)
  const isIOS =
    /iPhone|iPad|iPod/i.test(ua) ||
    (typeof navigator !== "undefined" &&
      navigator.platform === "MacIntel" &&
      navigator.maxTouchPoints > 1)
  const isTablet = /Android/i.test(ua) && !/Mobile/i.test(ua)
  const isStandalone =
    (typeof window !== "undefined" &&
      window.matchMedia?.("(display-mode: standalone)")?.matches) ||
    (typeof navigator !== "undefined" &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))

  return { isAndroid, isIOS, isTablet, isStandalone }
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

const showCastGuide = (isIOS: boolean, isAndroid: boolean, isStandalone: boolean) => {
  if (isIOS) {
    window.alert(
      "iOS 投屏说明：\n1) 确保 iPhone/iPad 与电视在同一 Wi-Fi\n2) 播放时点击播放器控制栏的 AirPlay 图标\n3) 或打开控制中心 → 屏幕镜像\n\n提示：Safari 或「添加到主屏幕」模式下支持效果最好。",
    )
    return
  }

  if (isAndroid) {
    window.alert(
      `安卓投屏说明：\n1) 确保手机与电视在同一 Wi-Fi\n2) 下拉状态栏 → 投屏 / 无线显示 / Smart View\n3) 选择电视设备即可镜像屏幕${isStandalone ? "\n\n当前为「添加到桌面」模式，建议使用系统投屏镜像整个页面。" : ""}`,
    )
    return
  }

  window.alert(
    "当前浏览器不支持网页内一键投屏。\n请使用系统自带的屏幕镜像或投屏功能，将本页面投送到电视。",
  )
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

const Player: React.FC<PlayerProps> = ({
  url,
  poster,
  className,
  initialTime,
  onTimeUpdate,
  onEnded,
  onError,
}) => {
  const artRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<Artplayer | null>(null)
  const hlsRef = useRef<Hls | null>(null)
  const stallTimerRef = useRef<number | null>(null)
  const playUrl = url
  const deviceRef = useRef(getDeviceInfo())
  const callbacksRef = useRef({ onTimeUpdate, onEnded, onError })

  useEffect(() => {
    callbacksRef.current = { onTimeUpdate, onEnded, onError }
  }, [onTimeUpdate, onEnded, onError])

  useEffect(() => {
    if (!artRef.current) return

    const { isAndroid, isIOS, isTablet, isStandalone } = deviceRef.current
    const useNativeFullscreen = !isStandalone && !isAndroid

    const clearStallTimer = () => {
      if (stallTimerRef.current) {
        window.clearTimeout(stallTimerRef.current)
        stallTimerRef.current = null
      }
    }

    const scheduleStallFail = () => {
      if (stallTimerRef.current) return
      stallTimerRef.current = window.setTimeout(() => {
        stallTimerRef.current = null
        callbacksRef.current.onError?.()
      }, 25000)
    }

    const art = new Artplayer({
      container: artRef.current,
      url: playUrl,
      poster: poster,
      volume: 0.7,
      isLive: false,
      muted: false,
      autoplay: true,

      // PWA/添加到桌面：使用网页全屏，避免原生全屏在部分安卓设备卡死
      fullscreen: useNativeFullscreen,
      fullscreenWeb: true,
      autoSize: !isTablet,
      autoMini: false,
      setting: true,
      pip: !isAndroid,
      playbackRate: true,

      playsInline: true,
      lock: !isTablet,
      fastForward: !isTablet,
      autoOrientation: true,
      moreVideoAttr: {
        crossorigin: "anonymous",
        playsinline: "true",
        "webkit-playsinline": "true",
        "webkit-airplay": "allow",
        "x-webkit-airplay": "allow",
        "x5-video-player-type": "h5-page",
        "x5-video-orientation": "landscape",
        "x5-playsinline": "true",
      },
      customType: {
        m3u8: function (video: HTMLVideoElement, url: string) {
          if (hlsRef.current) {
            hlsRef.current.destroy()
            hlsRef.current = null
          }

          const castVideo = video as VideoWithCast
          configureVideoForCast(castVideo)

          if (Hls.isSupported()) {
            const hls = new Hls({
              enableWorker: true,
              lowLatencyMode: false,
              backBufferLength: 30,
              maxBufferLength: 24,
              maxMaxBufferLength: 120,
              fragLoadingTimeOut: 25000,
              fragLoadingMaxRetry: 6,
              fragLoadingRetryDelay: 800,
              fragLoadingMaxRetryTimeout: 8000,
              manifestLoadingTimeOut: 12000,
              manifestLoadingMaxRetry: 4,
              manifestLoadingRetryDelay: 800,
              levelLoadingTimeOut: 12000,
              levelLoadingMaxRetry: 4,
              levelLoadingRetryDelay: 800,
              startLevel: 0,
            })

            hls.on(Hls.Events.ERROR, function (_event, data) {
              if (data.fatal) {
                switch (data.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                    hls.startLoad()
                    break
                  case Hls.ErrorTypes.MEDIA_ERROR:
                    hls.recoverMediaError()
                    break
                  default:
                    hls.destroy()
                    clearStallTimer()
                    callbacksRef.current.onError?.()
                    break
                }
              }
            })

            hls.loadSource(url)
            hls.attachMedia(video)
            hlsRef.current = hls
          } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = url
          }
        },
      },
    })

    art.on("ready", () => {
      const video = art.template?.$video as VideoWithCast | undefined
      if (video) {
        configureVideoForCast(video)

        const canCast =
          supportsAirPlay(video) ||
          supportsRemotePlayback(video) ||
          isIOS ||
          isAndroid

        if (canCast) {
          art.controls.add({
            position: "right",
            index: 12,
            html: "投屏",
            tooltip: "投屏到电视",
            click: async () => {
              const castVideo = art.template?.$video as VideoWithCast | undefined
              if (!castVideo) return

              const started = await tryCastPlayback(castVideo)
              if (!started) {
                showCastGuide(isIOS, isAndroid, isStandalone)
              }
            },
          })
        }
      }

      if (initialTime && initialTime > 0) {
        art.seek = initialTime
      }
    })

    art.on("video:timeupdate", () => {
      if (callbacksRef.current.onTimeUpdate && art.currentTime > 0) {
        callbacksRef.current.onTimeUpdate(art.currentTime)
      }
    })

    art.on("video:ended", () => {
      clearStallTimer()
      callbacksRef.current.onEnded?.()
    })

    art.on("error", () => {
      clearStallTimer()
      callbacksRef.current.onError?.()
    })
    art.on("video:error", () => {
      clearStallTimer()
      callbacksRef.current.onError?.()
    })
    art.on("video:waiting", () => {
      scheduleStallFail()
    })
    art.on("video:stalled", () => {
      scheduleStallFail()
    })
    art.on("video:playing", () => {
      clearStallTimer()
    })

    playerRef.current = art

    return () => {
      clearStallTimer()
      if (hlsRef.current) hlsRef.current.destroy()
      if (art && art.destroy) art.destroy(false)
    }
  }, [])

  useEffect(() => {
    if (playerRef.current && playUrl) {
      playerRef.current.switchUrl(playUrl, poster)
      playerRef.current.play()
    }
  }, [playUrl, poster])

  return (
    <div className={className} style={{ width: "100%", height: "100%" }}>
      <div ref={artRef} className="w-full h-full" />
    </div>
  )
}

export default Player
