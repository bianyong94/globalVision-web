import React, { useEffect, useRef } from "react"
import Artplayer from "artplayer"
import Hls from "hls.js"
import artplayerPluginDanmuku from "artplayer-plugin-danmuku"

interface PlayerProps {
  url: string
  poster?: string
  initialTime?: number // 记忆播放时间
  onTimeUpdate?: (currentTime: number) => void // 进度回调
  onPlay?: () => void
}

const Player: React.FC<PlayerProps> = ({
  url,
  poster,
  initialTime,
  onTimeUpdate,
  onPlay,
}) => {
  const artRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<Artplayer | null>(null)

  useEffect(() => {
    if (!artRef.current) return

    // 初始化 ArtPlayer
    const art = new Artplayer({
      container: artRef.current,
      url: url,
      poster: poster,
      volume: 0.5,
      isLive: false,
      muted: false,
      autoplay: true,
      pip: true, // 画中画
      autoSize: true, // 自动比例
      autoMini: true, // 滚动时自动小窗
      screenshot: true, // 截图
      setting: true, // 设置面板
      loop: false,
      flip: true, // 画面翻转
      playbackRate: true, // 倍速
      aspectRatio: true, // 比例切换
      fullscreen: true, // 全屏
      fullscreenWeb: true, // 网页全屏
      subtitleOffset: true, // 字幕偏移
      miniProgressBar: true, // 迷你进度条
      mutex: true, // 互斥
      backdrop: true,
      playsInline: true, // 移动端内联播放
      autoPlayback: true,
      airplay: true,
      theme: "#23ade5", // Bilibili 蓝

      // 移动端手势 (核心体验)
      moreVideoAttr: {
        crossOrigin: "anonymous",
      },

      // 核心：集成 HLS.js 以支持 m3u8
      customType: {
        m3u8: function (video: HTMLMediaElement, url: string, art) {
          if (Hls.isSupported()) {
            if (art.hls) art.hls.destroy()
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

      // 弹幕插件
      plugins: [
        artplayerPluginDanmuku({
          danmuku: [
            // 模拟一些弹幕，真实场景需要后端接口
            { text: "前方高能", time: 1, color: "#ff0000" },
            { text: "第一！！", time: 2, color: "#fff" },
            { text: "画质感人", time: 3, color: "#00ff00" },
          ],
          speed: 5,
          opacity: 1,
          fontSize: 14,
          color: "#ffffff",
          mode: 0,
          margin: [10, "25%"],
          antiOverlap: true,
          useWorker: true,
          synchronousPlayback: false,
          lockTime: 5,
          maxLength: 100,
          minWidth: 200,
          weight: 10,
          visible: true,
          emitter: true, // 允许发送弹幕
        }),
      ],
    })

    // 事件监听
    art.on("ready", () => {
      // 记忆播放跳转
      if (initialTime && initialTime > 0) {
        console.log("Jump to history:", initialTime)
        art.seek = initialTime
      }
    })

    art.on("video:timeupdate", () => {
      // 每秒回调一次进度
      if (onTimeUpdate) {
        onTimeUpdate(art.currentTime)
      }
    })

    art.on("play", () => {
      if (onPlay) onPlay()
    })

    playerRef.current = art

    return () => {
      if (playerRef.current && playerRef.current.destroy) {
        playerRef.current.destroy(false)
      }
    }
  }, [url]) // 当 URL 变化时销毁重建

  return <div ref={artRef} className="w-full h-full" />
}

export default Player
