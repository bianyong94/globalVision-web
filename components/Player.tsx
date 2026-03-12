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
  const apiBase = (import.meta.env.VITE_API_BASE_URL || "/api")
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
              // 1. 核心性能：开启 Web Worker
              // 将切片解析扔给后台线程，绝对不阻塞 React 的主线程 UI 渲染
              enableWorker: true,

              // 2. 贴合 CDN 的缓冲策略：防带宽浪费
              // 因为 CF 边缘节点响应极快，不需要囤积太多切片。
              maxBufferLength: 30, // 正常缓冲 30 秒即可满足流畅播放
              maxMaxBufferLength: 600, // 内存中最多允许驻留的极限值

              // 3. 容错与重试机制 (应对用户端网络抖动)
              fragLoadingTimeOut: 20000, // 切片下载 20 秒超时
              fragLoadingMaxRetry: 4, // 切片失败允许重试 4 次
              manifestLoadingTimeOut: 10000, // m3u8 列表 10 秒超时
              manifestLoadingMaxRetry: 3,

              // 4. 起步策略：首屏秒开
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
      if (onEnded) onEnded()
    })

    art.on("error", () => {
      if (onError) onError()
    })
    art.on("video:error", () => {
      if (onError) onError()
    })

    playerRef.current = art

    return () => {
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
