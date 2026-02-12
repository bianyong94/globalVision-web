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
}

const Player: React.FC<PlayerProps> = ({
  url,
  poster,
  className,
  initialTime,
  onTimeUpdate,
  onEnded,
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
              // 增大缓冲区，减少卡顿 (单位：秒)
              maxBufferLength: 60,
              maxMaxBufferLength: 120,
              // 遇到错误时尝试重连
              manifestLoadingTimeOut: 20000,
              manifestLoadingMaxRetry: 3,
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

    if (initialTime && initialTime > 0) {
      art.on("ready", () => {
        art.seek = initialTime
      })
    }

    art.on("video:timeupdate", () => {
      if (onTimeUpdate && art.currentTime > 0) onTimeUpdate(art.currentTime)
    })

    art.on("video:ended", () => {
      if (onEnded) onEnded()
    })

    playerRef.current = art

    return () => {
      if (hlsRef.current) hlsRef.current.destroy()
      if (art && art.destroy) art.destroy(false)
    }
  }, [])

  useEffect(() => {
    if (playerRef.current && url) {
      playerRef.current.switchUrl(url, poster)
      playerRef.current.play()
    }
  }, [url, poster])

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
