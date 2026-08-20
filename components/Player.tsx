import React, { useEffect, useRef, useState } from "react"
import { RefreshCw, RotateCcw, WifiOff } from "lucide-react"
import type Hls from "hls.js"
import { configureMobileVideo } from "./player/device"
import {
  cancelPendingVideoSourceLoad,
  destroyHlsInstance,
  isM3u8Url,
  loadVideoSource,
} from "./player/hls-loader"
import { normalizeMediaUrl } from "../utils/common"
import "./player/native-player.css"

interface PlayerProps {
  url: string
  poster?: string
  className?: string
  initialTime?: number
  autoPlay?: boolean
  onTimeUpdate?: (time: number, duration: number) => void
  onPlaybackStateChange?: (isPlaying: boolean) => void
  onEnded?: () => void
  onError?: () => void
}

type PlayerStatus = "loading" | "ready" | "error"

const SOFT_STALL_RECOVERY_DELAY_MS = 20000

const Player: React.FC<PlayerProps> = ({
  url,
  poster,
  className,
  initialTime,
  autoPlay = true,
  onTimeUpdate,
  onPlaybackStateChange,
  onEnded,
  onError,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const stallTimerRef = useRef<number | null>(null)
  const retrySeekTimeRef = useRef<number | null>(null)
  const fatalErrorRef = useRef(false)
  const isSeekingRef = useRef(false)
  const isRestoringPositionRef = useRef(false)
  const shouldAutoPlayRef = useRef(autoPlay)
  const callbacksRef = useRef({
    onTimeUpdate,
    onPlaybackStateChange,
    onEnded,
    onError,
  })
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [status, setStatus] = useState<PlayerStatus>("loading")
  const [statusMessage, setStatusMessage] = useState("正在加载播放资源...")
  const playUrl = normalizeMediaUrl(url)

  useEffect(() => {
    callbacksRef.current = {
      onTimeUpdate,
      onPlaybackStateChange,
      onEnded,
      onError,
    }
  }, [onTimeUpdate, onPlaybackStateChange, onEnded, onError])

  useEffect(() => {
    shouldAutoPlayRef.current = autoPlay
  }, [autoPlay])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !playUrl) return
    const usesManagedHls =
      isM3u8Url(playUrl) &&
      !video.canPlayType("application/vnd.apple.mpegurl")

    configureMobileVideo(video)
    fatalErrorRef.current = false
    isSeekingRef.current = false
    isRestoringPositionRef.current = false
    setStatus("loading")
    setStatusMessage("正在加载播放资源...")
    let hasStartedPlayback = false

    const clearStallTimer = () => {
      if (stallTimerRef.current !== null) {
        window.clearTimeout(stallTimerRef.current)
        stallTimerRef.current = null
      }
    }

    const markReady = () => {
      if (fatalErrorRef.current) return
      clearStallTimer()
      isSeekingRef.current = false
      isRestoringPositionRef.current = false
      setStatus("ready")
    }

    const playIfRequested = () => {
      if (!shouldAutoPlayRef.current) return
      void video.play().catch(() => {
        // Browsers may require an explicit user gesture. Native controls remain usable.
      })
    }

    const failPlayback = () => {
      clearStallTimer()
      fatalErrorRef.current = true
      setStatus("error")
      setStatusMessage("当前线路加载失败，请重试或切换线路")
      callbacksRef.current.onError?.()
    }

    const scheduleSoftStallRecovery = () => {
      if (
        stallTimerRef.current !== null ||
        !hasStartedPlayback ||
        video.paused ||
        video.ended
      ) {
        return
      }
      const stalledAt = video.currentTime
      stallTimerRef.current = window.setTimeout(() => {
        stallTimerRef.current = null
        if (
          fatalErrorRef.current ||
          video.paused ||
          video.ended ||
          video.seeking ||
          video.currentTime > stalledAt + 0.1 ||
          video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA
        ) {
          return
        }

        // Hls.js keeps ownership of network retries. This is only a soft kick
        // after a prolonged, real playback stall; it never reloads the source
        // or turns a recoverable wait into a fatal UI state.
        try {
          hlsRef.current?.startLoad(video.currentTime)
          playIfRequested()
        } catch {
          // A destroyed HLS instance will report through the fatal callback.
        }
      }, SOFT_STALL_RECOVERY_DELAY_MS)
    }

    const seekTarget =
      retrySeekTimeRef.current ??
      (initialTime && initialTime > 0 ? initialTime : 0)
    retrySeekTimeRef.current = null
    isRestoringPositionRef.current = seekTarget > 0

    const seekAndMaybePlay = () => {
      if (seekTarget > 0 && Number.isFinite(video.duration)) {
        video.currentTime = Math.min(seekTarget, Math.max(0, video.duration - 0.25))
      }
      playIfRequested()
    }

    loadVideoSource(
      video,
      playUrl,
      hlsRef,
      failPlayback,
      {
        shouldAutoPlay: () => shouldAutoPlayRef.current,
      },
    )

    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      seekAndMaybePlay()
    } else {
      video.addEventListener("loadedmetadata", seekAndMaybePlay, { once: true })
    }

    let lastTimeEmit = 0
    let lastObservedTime = video.currentTime
    const onTimeUpdateEvent = () => {
      const currentTime = video.currentTime
      if (!video.seeking && currentTime > lastObservedTime + 0.05) {
        lastObservedTime = currentTime
        markReady()
      }

      const now = performance.now()
      if (now - lastTimeEmit < 250) return
      lastTimeEmit = now
      if (callbacksRef.current.onTimeUpdate && currentTime > 0) {
        callbacksRef.current.onTimeUpdate(
          currentTime,
          Number.isFinite(video.duration) ? video.duration : 0,
        )
      }
    }

    const onEndedEvent = () => {
      clearStallTimer()
      callbacksRef.current.onPlaybackStateChange?.(false)
      callbacksRef.current.onEnded?.()
    }

    const onPlayEvent = () => {
      hasStartedPlayback = true
      shouldAutoPlayRef.current = true
      callbacksRef.current.onPlaybackStateChange?.(true)
    }

    const onPauseEvent = () => {
      if (video.ended) return
      if (!hasStartedPlayback && video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        return
      }
      clearStallTimer()
      shouldAutoPlayRef.current = false
      callbacksRef.current.onPlaybackStateChange?.(false)
    }

    const onLoadStartEvent = () => {
      if (fatalErrorRef.current) return
      setStatus("loading")
      setStatusMessage("正在加载播放资源...")
    }

    const onWaitingEvent = () => {
      if (fatalErrorRef.current) return
      setStatus("loading")
      setStatusMessage(
        video.seeking ||
          isSeekingRef.current ||
          isRestoringPositionRef.current
          ? "正在定位播放位置..."
          : "网络缓冲中，请稍候...",
      )
      scheduleSoftStallRecovery()
    }

    const onCanPlayEvent = () => {
      if (!video.seeking && !isSeekingRef.current) markReady()
      playIfRequested()
    }

    const onSeekingEvent = () => {
      clearStallTimer()
      isSeekingRef.current = true
      isRestoringPositionRef.current = true
      setStatus("loading")
      setStatusMessage("正在定位播放位置...")
    }

    const onSeekedEvent = () => {
      isSeekingRef.current = false
      if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
        markReady()
      } else {
        setStatus("loading")
        setStatusMessage(
          isRestoringPositionRef.current
            ? "正在定位播放位置..."
            : "网络缓冲中，请稍候...",
        )
        scheduleSoftStallRecovery()
      }
    }

    const onErrorEvent = () => {
      if (!video.error?.code) return
      // In MSE/Hls.js mode, native media errors are part of HLS recovery.
      // Only hls-loader's final fatal callback may transition to error.
      if (usesManagedHls) return
      failPlayback()
    }

    video.addEventListener("timeupdate", onTimeUpdateEvent)
    video.addEventListener("ended", onEndedEvent)
    video.addEventListener("play", onPlayEvent)
    video.addEventListener("pause", onPauseEvent)
    video.addEventListener("error", onErrorEvent)
    video.addEventListener("loadstart", onLoadStartEvent)
    video.addEventListener("waiting", onWaitingEvent)
    video.addEventListener("stalled", onWaitingEvent)
    video.addEventListener("canplay", onCanPlayEvent)
    video.addEventListener("playing", markReady)
    video.addEventListener("seeking", onSeekingEvent)
    video.addEventListener("seeked", onSeekedEvent)

    return () => {
      clearStallTimer()
      cancelPendingVideoSourceLoad(video)
      video.removeEventListener("loadedmetadata", seekAndMaybePlay)
      video.removeEventListener("timeupdate", onTimeUpdateEvent)
      video.removeEventListener("ended", onEndedEvent)
      video.removeEventListener("play", onPlayEvent)
      video.removeEventListener("pause", onPauseEvent)
      video.removeEventListener("error", onErrorEvent)
      video.removeEventListener("loadstart", onLoadStartEvent)
      video.removeEventListener("waiting", onWaitingEvent)
      video.removeEventListener("stalled", onWaitingEvent)
      video.removeEventListener("canplay", onCanPlayEvent)
      video.removeEventListener("playing", markReady)
      video.removeEventListener("seeking", onSeekingEvent)
      video.removeEventListener("seeked", onSeekedEvent)
      destroyHlsInstance(hlsRef.current)
      hlsRef.current = null
    }
  }, [playUrl, initialTime, loadAttempt])

  useEffect(() => {
    const video = videoRef.current
    if (video && poster) video.poster = poster
  }, [poster])

  const retry = () => {
    const video = videoRef.current
    fatalErrorRef.current = false
    retrySeekTimeRef.current = video?.currentTime || initialTime || 0
    shouldAutoPlayRef.current = true
    setStatus("loading")
    setStatusMessage("正在重新连接播放资源...")
    setLoadAttempt((attempt) => attempt + 1)
  }

  return (
    <div className={`gv-native-player ${className || ""}`.trim()}>
      <video
        ref={videoRef}
        className="gv-native-video"
        controls
        playsInline
        preload="auto"
        poster={poster || undefined}
        crossOrigin="anonymous"
        controlsList="nodownload noremoteplayback"
      />

      {status === "loading" ? (
        <div className="gv-player-status" role="status" aria-live="polite">
          <div className="gv-player-status-card">
            <RefreshCw className="gv-player-status-spinner" aria-hidden="true" />
            <span>{statusMessage}</span>
          </div>
        </div>
      ) : null}

      {status === "error" ? (
        <div className="gv-player-status gv-player-status--error" role="alert">
          <div className="gv-player-status-card gv-player-status-card--error">
            <WifiOff className="gv-player-status-error-icon" aria-hidden="true" />
            <span>{statusMessage}</span>
            <button type="button" onClick={retry} className="gv-player-retry">
              <RotateCcw size={14} aria-hidden="true" />
              重新加载
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default Player
