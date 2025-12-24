import React, { useEffect, useRef } from "react"
import Artplayer from "artplayer"
import Hls from "hls.js"
import artplayerPluginDanmuku from "artplayer-plugin-danmuku"

interface PlayerProps {
  url: string
  poster?: string
  initialTime?: number // 记忆进度
  onTimeUpdate?: (currentTime: number) => void // 进度回调
}

const Player: React.FC<PlayerProps> = ({
  url,
  poster,
  initialTime,
  onTimeUpdate,
}) => {
  const artRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<Artplayer | null>(null)

  useEffect(() => {
    if (!artRef.current) return

    // 销毁旧实例，防止内存泄漏
    if (playerRef.current) {
      playerRef.current.destroy(false)
    }

    const art = new Artplayer({
      container: artRef.current,
      url: url,
      poster: poster,
      volume: 0.5,
      isLive: false,
      muted: false,
      autoplay: true, // 尝试自动播放
      autoOrientation: true, // 移动端自动旋转

      // 🔥 核心功能配置
      pip: true, // 画中画
      autoSize: true,
      autoMini: true, // 滚动时小窗
      setting: true, // 设置面板
      loop: false,
      flip: true, // 画面翻转
      playbackRate: true, // 倍速播放
      aspectRatio: true, // 比例切换

      // 🔥 解决 iPhone 全屏问题
      fullscreen: true, // 允许系统全屏
      fullscreenWeb: true, // 允许网页全屏 (iOS 推荐用这个保留UI)

      // 🔥 Loading 效果 (ArtPlayer 自带美观的 Loading)
      // 当卡顿时会自动显示 loading 图标

      miniProgressBar: true, // 底部迷你进度条
      mutex: true, // 互斥，播放这个时暂停其他
      backdrop: true,
      playsInline: true, // iOS 必须开启，防止强制全屏
      theme: "#22c55e", // 你的主题色 (Emerald-500)

      // 移动端优化
      moreVideoAttr: {
        "webkit-playsinline": "true",
        playsInline: "true",
        crossOrigin: "anonymous",
      },

      // 🔥 清晰度切换逻辑 (仅当源支持多码率时生效)
      customType: {
        m3u8: function (video: HTMLMediaElement, url: string, art) {
          if (Hls.isSupported()) {
            if (art.hls) art.hls.destroy()
            const hls = new Hls()
            hls.loadSource(url)
            hls.attachMedia(video)
            art.hls = hls

            // 监听解析完成，检查是否有多个清晰度
            hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
              if (data.levels.length > 1) {
                // 构建清晰度菜单
                const quality = data.levels.map((item, index) => {
                  return {
                    default: index === data.levels.length - 1, // 默认选最高画质
                    html: item.name || `画质 ${item.height}P`,
                    url: url, // hls.js 会自动处理切换，这里传原 url 即可
                  }
                })
                art.quality = quality
              }
            })

            art.on("destroy", () => hls.destroy())
          } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = url
          } else {
            art.notice.show = "不支持的播放格式: m3u8"
          }
        },
      },

      // 🔥 弹幕插件 (这里模拟数据，真实需要后端弹幕接口)
      plugins: [
        // artplayerPluginDanmuku({
        //   danmuku: [
        //     { text: "前方高能预警！", time: 1, color: "#ff0000" },
        //     { text: "见证历史", time: 3, color: "#00ff00" },
        //     { text: "B站既视感", time: 5, color: "#fff" },
        //   ],
        //   speed: 5,
        //   opacity: 1,
        //   fontSize: 14,
        //   color: "#ffffff",
        //   mode: 0,
        //   margin: [10, "25%"],
        //   antiOverlap: true,
        //   useWorker: true,
        //   synchronousPlayback: false,
        // }),
      ],
    })

    // 🔥 记忆播放跳转
    art.on("ready", () => {
      if (initialTime && initialTime > 0) {
        art.seek = initialTime
        art.notice.show = `已为您跳转到上次观看位置 ${formatTime(initialTime)}`
      }
    })

    // 进度回调 (用于保存历史)
    art.on("video:timeupdate", () => {
      if (onTimeUpdate) {
        onTimeUpdate(art.currentTime)
      }
    })

    // 错误处理
    art.on("error", () => {
      art.notice.show = "视频加载失败，请尝试切换线路"
    })

    playerRef.current = art

    return () => {
      if (playerRef.current && playerRef.current.destroy) {
        playerRef.current.destroy(false)
      }
    }
  }, [url])

  return (
    // 强制黑色背景，防止闪屏
    <div ref={artRef} className="w-full h-full bg-black" />
  )
}

// 辅助时间格式化
function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s < 10 ? "0" + s : s}`
}

export default Player
