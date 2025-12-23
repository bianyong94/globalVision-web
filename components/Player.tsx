import React, { useEffect, useRef } from "react"
import Artplayer from "artplayer"
import Hls from "hls.js"

interface PlayerProps {
  url: string
  poster?: string
  className?: string
}

const Player: React.FC<PlayerProps> = ({ url, poster, className }) => {
  const artRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<Artplayer | null>(null)

  useEffect(() => {
    if (!artRef.current) return

    // 初始化播放器
    const art = new Artplayer({
      container: artRef.current,
      url: url,
      poster: poster,
      volume: 0.7,
      isLive: false,
      muted: false,
      autoplay: false,
      autoSize: true, // 自动适配尺寸
      autoMini: true, // 滚动页面时自动开启迷你模式 (类似B站)

      // 核心功能配置
      playbackRate: true, // 开启倍速
      aspectRatio: true, // 开启画面比例切换
      setting: true, // 开启设置面板
      pip: true, // 开启画中画
      fullscreen: true, // 全屏
      fullscreenWeb: true, // 网页全屏
      miniProgressBar: true, // 底部迷你进度条

      // 移动端优化 (Bilibili 风格)
      moreVideoAttr: {
        // @ts-ignore
        "x5-video-player-type": "h5-page", // 微信同层播放优化
        playsInline: true,
      },
      lock: true, // 移动端锁定按钮
      fastForward: true, // 移动端长按2倍速 (B站核心功能)

      // 缓存配置
      icons: {
        loading: '<img src="/assets/loading.svg" width="50" />', // 你可以自定义loading
      },

      // HLS 集成 (核心性能优化点)
      customType: {
        m3u8: function (video: HTMLVideoElement, url: string, art: Artplayer) {
          if (Hls.isSupported()) {
            if (art.hls) (art.hls as Hls).destroy()
            const hls = new Hls()
            hls.loadSource(url)
            hls.attachMedia(video)
            art.hls = hls
            art.on("destroy", () => hls.destroy())
          } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = url
          } else {
            art.notice.show = "Unsupported playback format: m3u8"
          }
        },
      },
    })

    playerRef.current = art

    // 监听播放错误，自动重试或提示
    art.on("error", (error) => {
      console.log("Player Error:", error)
      art.notice.show = "视频加载失败，请切换源尝试"
    })

    return () => {
      if (art && art.destroy) {
        art.destroy(false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // 空依赖，只初始化一次

  // 监听 URL 变化，实现无刷新切换 (性能优化)
  useEffect(() => {
    if (playerRef.current && url) {
      console.log("Switching URL:", url)
      playerRef.current.switchUrl(url)
      if (poster) playerRef.current.poster = poster
    }
  }, [url, poster])

  return (
    <div
      ref={artRef}
      className={`w-full aspect-video bg-black ${className}`}
      style={{ zIndex: 10 }}
    />
  )
}

export default Player
