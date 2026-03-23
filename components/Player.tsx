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
  const apiBase = (
    import.meta.env.VITE_API_BASE_URL || "https://api.bycurry.cc/api"
  )
    .trim()
    .replace(/\/$/, "")
  const playUrl =
    /\.m3u8(\?.*)?$/i.test(url) && !/\/video\/proxy\/playlist\.m3u8/i.test(url)
      ? `${apiBase}/video/proxy/playlist.m3u8?url=${encodeURIComponent(url)}`
      : url

  const callbacksRef = useRef({ onTimeUpdate, onEnded, onError })
  useEffect(() => {
    callbacksRef.current = { onTimeUpdate, onEnded, onError }
  }, [onTimeUpdate, onEnded, onError])

  useEffect(() => {
    if (!artRef.current) return

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

      // 纯 Web 设置
      fullscreen: true,
      fullscreenWeb: true, // Web端建议开启网页全屏
      autoSize: true,
      autoMini: true,
      setting: true,
      pip: true,
      playbackRate: true,

      // 移动端优化
      playsInline: true,
      lock: true,
      fastForward: true,
      autoOrientation: true,

      customType: {
        m3u8: function (video: HTMLVideoElement, url: string, art: Artplayer) {
          if (hlsRef.current) {
            hlsRef.current.destroy()
            hlsRef.current = null
          }
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

            // 5. 补充关键的“错误自动恢复机制”
            hls.on(Hls.Events.ERROR, function (event, data) {
              if (data.fatal) {
                switch (data.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                    // 遇到网络断开或 CDN 偶发 502，尝试自动恢复加载
                    console.warn("HLS 网络错误，正在尝试恢复...")
                    hls.startLoad()
                    break
                  case Hls.ErrorTypes.MEDIA_ERROR:
                    // 遇到视频数据格式解析异常，尝试恢复媒体
                    console.warn("HLS 媒体错误，正在尝试恢复...")
                    hls.recoverMediaError()
                    break
                  default:
                    // 遇到无法恢复的致命错误，销毁重置
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
            // 兼容 Safari 原生播放
            video.src = url
          }
        },
      },
    })

    if (initialTime && initialTime > 0) {
      art.on("ready", () => {
        art.seek = initialTime
      })
    }

    art.on("video:timeupdate", () => {
      if (callbacksRef.current.onTimeUpdate && art.currentTime > 0) {
        callbacksRef.current.onTimeUpdate(art.currentTime)
      }
      // if (onTimeUpdate && art.currentTime > 0) onTimeUpdate(art.currentTime)
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
      {/* 
         ✅ 修复：移除了外层的 onClick={togglePlay}
         Web 端 Artplayer 自带点击暂停/播放功能，加了反而冲突
      */}
      <div ref={artRef} className="w-full h-full" />
    </div>
  )
}

export default Player
