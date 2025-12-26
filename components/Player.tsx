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
  // 新增：用 ref 存 Hls 实例，确保能销毁
  const hlsRef = useRef<Hls | null>(null)

  useEffect(() => {
    if (!artRef.current) return

    // 1. 初始化播放器
    const art = new Artplayer({
      container: artRef.current,
      url: url,
      poster: poster,
      volume: 0.7,
      isLive: false,
      muted: false,
      autoplay: true, // 自动播放
      autoSize: true,
      autoMini: true,
      playbackRate: true,
      aspectRatio: true,
      setting: true,
      pip: true,
      fullscreen: true,
      fullscreenWeb: true,
      miniProgressBar: true,
      moreVideoAttr: {
        // @ts-ignore
        "x5-video-player-type": "h5-page",
        playsInline: true,
      },
      lock: true,
      fastForward: true,

      customType: {
        m3u8: function (video: HTMLVideoElement, url: string, art: Artplayer) {
          // 先销毁旧的
          if (hlsRef.current) {
            hlsRef.current.destroy()
            hlsRef.current = null
          }

          if (Hls.isSupported()) {
            const hls = new Hls()
            hls.loadSource(url)
            hls.attachMedia(video)
            hlsRef.current = hls // 存入 ref

            // 监听错误，自动恢复
            hls.on(Hls.Events.ERROR, (event, data) => {
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
                    break
                }
              }
            })
          } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = url
          } else {
            art.notice.show = "Unsupported playback format: m3u8"
          }
        },
      },
    })

    // 2. 跳转到历史进度
    if (initialTime && initialTime > 0) {
      art.on("ready", () => {
        art.seek = initialTime
      })
    }

    // 3. 监听进度更新，汇报给父组件
    art.on("video:timeupdate", () => {
      if (onTimeUpdate && art.currentTime > 0) {
        onTimeUpdate(art.currentTime)
      }
    })

    playerRef.current = art

    // 4. ⚡️ 核心修复：组件卸载时的清理逻辑
    return () => {
      console.log("🛑 正在销毁播放器...")

      // 先销毁 HLS (最重要！)
      if (hlsRef.current) {
        hlsRef.current.stopLoad() // 停止下载 .ts
        hlsRef.current.detachMedia()
        hlsRef.current.destroy()
        hlsRef.current = null
      }

      // 再销毁 Artplayer
      if (art && art.destroy) {
        art.destroy(false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 监听 URL 变化实现切集
  useEffect(() => {
    if (playerRef.current && url) {
      // 切集时也要先停止当前的 HLS 加载，否则可能会串流
      if (hlsRef.current) {
        hlsRef.current.stopLoad()
      }
      playerRef.current.switchUrl(url)
      if (poster) playerRef.current.poster = poster
    }
  }, [url, poster])

  return (
    <div
      ref={artRef}
      className={`w-full h-full bg-black ${className}`}
      style={{ zIndex: 10 }}
    />
  )
}

export default Player
