import React, { useEffect, useRef } from "react"
import Artplayer from "artplayer"
import Hls from "hls.js"
import artplayerPluginDanmuku from "artplayer-plugin-danmuku"

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

    // 1. 初始化播放器
    const art = new Artplayer({
      container: artRef.current,
      url: url,
      poster: poster,
      volume: 0.7,
      isLive: false,
      muted: false,
      autoplay: true,

      // 🔥 投屏相关配置
      airplay: true, // 开启 AirPlay 按钮 (Mac/iOS)

      // 🔥 播放器功能
      autoSize: true,
      autoMini: true,
      playbackRate: true,
      aspectRatio: true,
      setting: true, // 开启设置面板 (画质切换会显示在这里)
      pip: true,
      fullscreen: true,
      fullscreenWeb: true,
      miniProgressBar: true,
      lock: true,
      fastForward: true,

      // 移动端优化属性
      moreVideoAttr: {
        "x5-video-player-type": "h5-page",
        "x5-video-player-fullscreen": "false",
        playsinline: "true",
        "webkit-playsinline": "true",
        "x-webkit-airplay": "allow", // 允许 AirPlay
      },

      // HLS 集成与画质切换逻辑
      customType: {
        m3u8: function (video: HTMLVideoElement, url: string, art: Artplayer) {
          // 销毁旧实例
          if (hlsRef.current) {
            hlsRef.current.destroy()
            hlsRef.current = null
          }

          if (Hls.isSupported()) {
            const hls = new Hls()
            hls.loadSource(url)
            hls.attachMedia(video)
            hlsRef.current = hls

            // 🔥 核心：监听解析完成，构建画质菜单
            hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
              // 只有当存在多个 Level (画质) 时才显示切换菜单
              if (data.levels.length > 1) {
                const quality = data.levels.map((level, index) => {
                  return {
                    default: index === data.levels.length - 1, // 默认选最高画质
                    html: level.height
                      ? `${level.height}P`
                      : `画质 ${index + 1}`,
                    level: index, // 自定义属性，存 index
                  }
                })

                // 添加“自动”选项
                quality.unshift({
                  default: false,
                  html: "自动",
                  level: -1,
                })

                // 更新 Artplayer 的画质列表
                art.quality = quality
              }
            })

            // 错误自动恢复
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
            // Safari 原生支持 HLS (无法手动切换画质，由系统自动调节)
            video.src = url
          } else {
            art.notice.show = "Unsupported playback format: m3u8"
          }
        },
      },
    })

    // 🔥 监听画质切换事件 (无缝切换)
    art.on("video:quality", (item: any) => {
      if (hlsRef.current) {
        // -1 代表自动，其他代表具体的 Level Index
        hlsRef.current.currentLevel = item.level
        art.notice.show = `已切换至: ${item.html}`
      }
    })

    // 2. 跳转到历史进度
    if (initialTime && initialTime > 0) {
      art.on("ready", () => {
        art.seek = initialTime
      })
    }

    // 3. 监听进度更新
    art.on("video:timeupdate", () => {
      if (onTimeUpdate && art.currentTime > 0) {
        onTimeUpdate(art.currentTime)
      }
    })

    playerRef.current = art

    // 4. 清理
    return () => {
      if (hlsRef.current) {
        hlsRef.current.stopLoad()
        hlsRef.current.detachMedia()
        hlsRef.current.destroy()
        hlsRef.current = null
      }
      if (art && art.destroy) {
        art.destroy(false)
      }
    }
  }, []) // 只在初始化时执行一次，切集走下面的 useEffect

  // 监听 URL 变化实现切集 (平滑切换)
  useEffect(() => {
    if (playerRef.current && url) {
      // 停止 HLS 加载
      if (hlsRef.current) {
        hlsRef.current.stopLoad()
        hlsRef.current.detachMedia()
        // 这里的 destroy 是必须的，因为 customType.m3u8 会重新创建 hls 实例
        hlsRef.current.destroy()
        hlsRef.current = null
      }

      // ArtPlayer 切换 URL 会重新触发 customType.m3u8
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
