import React, { useEffect, useRef } from "react"
import Artplayer from "artplayer"
import Hls from "hls.js"
import toast from "react-hot-toast" // 引入 toast 用于电视端操作反馈

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

  // 1. 🔥 新增：统一处理播放/暂停 (供点击和遥控器使用)
  const togglePlay = () => {
    if (playerRef.current) {
      playerRef.current.toggle()
    }
  }

  // 2. 🔥 新增：键盘/遥控器事件监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const art = playerRef.current
      if (!art) return

      // 避免按键重复触发 (长按)
      // if (e.repeat) return;

      switch (e.key) {
        case "Enter":
        case " ": // 空格键
        case "Ok": // 部分 Android TV 遥控器映射为 Ok
        case "Select": // 部分遥控器
        case "MediaPlayPause": // 媒体专用键
          e.preventDefault()
          art.toggle()
          // 显示播放状态提示
          const state = art.playing ? "暂停" : "播放"
          toast(state, {
            icon: art.playing ? "⏸️" : "▶️",
            duration: 1000,
            id: "play-state", // ID 防止重复 toast
          })
          break

        case "ArrowRight": // 快进
          e.preventDefault()
          art.seek = art.currentTime + 10
          toast("快进 10s", { icon: "⏩", duration: 1000, id: "seek" })
          break

        case "ArrowLeft": // 快退
          e.preventDefault()
          art.seek = art.currentTime - 10
          toast("快退 10s", { icon: "⏪", duration: 1000, id: "seek" })
          break

        case "ArrowUp": // 音量+
          e.preventDefault()
          // 限制最大 1
          const newVolUp = Math.min(1, art.volume + 0.1)
          art.volume = newVolUp
          toast(`音量 ${(newVolUp * 100).toFixed(0)}%`, {
            icon: "🔊",
            duration: 1000,
            id: "volume",
          })
          break

        case "ArrowDown": // 音量-
          e.preventDefault()
          const newVolDown = Math.max(0, art.volume - 0.1)
          art.volume = newVolDown
          toast(`音量 ${(newVolDown * 100).toFixed(0)}%`, {
            icon: "🔉",
            duration: 1000,
            id: "volume",
          })
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  // 3. 初始化播放器
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

      // 系统全屏 (性能最好)
      fullscreen: true,
      fullscreenWeb: false,

      // 基础配置
      autoSize: true,
      autoMini: true,
      setting: true,
      pip: true,
      playbackRate: true,

      // 🔥 TV 适配核心：禁用默认热键，使用我们在 useEffect 里自定义的逻辑
      // 避免按一次方向键触发两次快进
      hotkey: false,

      // 移动端优化
      playsInline: true,
      lock: true,
      fastForward: true, // 开启长按倍速 (触屏有效)
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
              // 1. 开启 WebWorker 多线程
              enableWorker: true,

              // 2. 极致的缓冲策略
              maxBufferLength: 60,
              maxMaxBufferLength: 120,
              maxBufferHole: 0.5,
              // 3. 核心：已播放内容的缓存
              backBufferLength: 90,

              // 4. 起播速度优化
              startLevel: -1,
              startFragPrefetch: true,

              abrEwmaDefaultEstimate: 500000, // 初始下载速度预估
              testBandwidth: true,

              // 5. 网络容错
              manifestLoadingTimeOut: 10000,
              fragLoadingTimeOut: 10000,
              levelLoadingTimeOut: 10000,
              fragLoadingMaxRetry: 2,

              lowLatencyMode: false,
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
          // 🔥 iOS: 只能用原生
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

    // 监听播放结束
    art.on("video:ended", () => {
      if (onEnded) onEnded()
    })

    // 解决快进/拖动进度条时图标闪烁问题
    art.on("seeking", () => {
      if (art.template.$state) {
        art.template.$state.style.display = "none"
      }
    })
    art.on("seeked", () => {
      if (art.template.$state) {
        setTimeout(() => {
          if (art.template.$state) art.template.$state.style.display = ""
        }, 200)
      }
    })

    playerRef.current = art

    return () => {
      if (hlsRef.current) hlsRef.current.destroy()
      if (art && art.destroy) art.destroy(false)
    }
  }, [])

  // 监听 URL 变化
  useEffect(() => {
    if (playerRef.current && url) {
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
      playerRef.current.switchUrl(url)
      playerRef.current.play()
    }
  }, [url, poster])

  return (
    <div
      className={className}
      style={{ width: "100%", height: "100%" }}
      // 🔥 新增：点击容器也能暂停/播放 (适配手机触摸)
      onClick={togglePlay}
    >
      <div ref={artRef} className="w-full h-full" />
    </div>
  )
}

export default Player
