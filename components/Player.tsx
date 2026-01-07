import React, { useEffect, useRef } from "react"
import Artplayer from "artplayer"
import Hls from "hls.js"

interface PlayerProps {
  url: string
  poster?: string
  className?: string
  initialTime?: number
  onTimeUpdate?: (time: number) => void
}

const Player: React.FC<PlayerProps> = ({
  url,
  poster,
  className,
  initialTime,
  onTimeUpdate,
}) => {
  const artRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<Artplayer | null>(null)
  const hlsRef = useRef<Hls | null>(null)

  useEffect(() => {
    if (!artRef.current) return

    const art = new Artplayer({
      container: artRef.current,
      url: url,
      poster: poster,
      volume: 0.7,
      isLive: false,
      muted: false,
      autoplay: false,

      // 系统全屏 (性能最好)
      fullscreen: true,
      fullscreenWeb: false,

      // 基础配置
      autoSize: true,
      autoMini: true,
      setting: true,
      pip: true,
      playbackRate: true,

      // 移动端优化
      playsInline: true,
      lock: true,
      fastForward: true, // 开启长按倍速
      autoOrientation: true,

      moreVideoAttr: {
        "x5-video-player-type": "h5-page",
        "x5-video-player-fullscreen": "true",
        playsinline: "true",
        "webkit-playsinline": "true",
      },

      customType: {
        m3u8: function (video: HTMLVideoElement, url: string, art: Artplayer) {
          if (hlsRef.current) {
            hlsRef.current.destroy()
            hlsRef.current = null
          }

          // 🔥 Android & PC: 使用 Hls.js 进行极致优化
          if (Hls.isSupported()) {
            const hls = new Hls({
              // 1. 开启 WebWorker 多线程，利用多核 CPU 解码，减少主线程卡顿
              enableWorker: true,

              // 2. 极致的缓冲策略 (Bilibili 模式)
              maxBufferLength: 60, // 正常播放时，预加载前方 60秒 (默认是 30)
              maxMaxBufferLength: 120, // 网络好时，最大允许预加载 120秒

              // 3. 核心：已播放内容的缓存 (回退不重载)
              backBufferLength: 90, // 保留过去 90秒 的缓存 (回退 1.5分钟内秒播)

              // 4. 起播速度优化
              startLevel: -1, // 自动选择最佳清晰度
              startFragPrefetch: true, // 开启首分片预加载

              // 5. 网络容错 (死链快速跳过)
              manifestLoadingTimeOut: 10000, // m3u8 加载超时 10s
              fragLoadingTimeOut: 10000, // 切片加载超时 10s
              levelLoadingTimeOut: 10000,
              fragLoadingMaxRetry: 2, // 切片重试最多 2 次 (默认 6 次太慢了)
            })

            hls.loadSource(url)
            hls.attachMedia(video)
            hlsRef.current = hls

            hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
              if (data.levels.length > 1) {
                const quality = data.levels.map((level, index) => ({
                  default: index === data.levels.length - 1,
                  html: level.height ? `${level.height}P` : `画质 ${index + 1}`,
                  level: index,
                }))
                quality.unshift({ default: false, html: "自动", level: -1 })
                art.quality = quality
              }
            })

            // 错误自动恢复逻辑
            hls.on(Hls.Events.ERROR, (event, data) => {
              if (data.fatal) {
                switch (data.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                    console.log("网络错误，尝试恢复...")
                    hls.startLoad()
                    break
                  case Hls.ErrorTypes.MEDIA_ERROR:
                    console.log("解码错误，尝试恢复...")
                    hls.recoverMediaError()
                    break
                  default:
                    hls.destroy()
                    break
                }
              }
            })
          }
          // 🔥 iOS: 只能用原生，无法控制缓冲，但性能本身就是系统级最优
          else if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = url
          }
        },
      },
    })

    // 历史进度跳转
    if (initialTime && initialTime > 0) {
      art.on("ready", () => {
        art.seek = initialTime
      })
    }

    art.on("video:timeupdate", () => {
      if (onTimeUpdate && art.currentTime > 0) onTimeUpdate(art.currentTime)
    })

    playerRef.current = art

    return () => {
      if (hlsRef.current) hlsRef.current.destroy()
      if (art && art.destroy) art.destroy(false)
    }
  }, [])

  useEffect(() => {
    if (playerRef.current && url) {
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
      playerRef.current.switchUrl(url)
    }
  }, [url, poster])

  return (
    <div className={className} style={{ width: "100%", height: "100%" }}>
      <div ref={artRef} className="w-full h-full" />
    </div>
  )
}

export default Player
