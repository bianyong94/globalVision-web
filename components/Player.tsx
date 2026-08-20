import React, { useEffect, useRef, useState } from "react"
import { RefreshCw, RotateCcw, WifiOff } from "lucide-react"
import type Hls from "hls.js"
import { configureMobileVideo } from "./player/device"
import {
  cancelPendingVideoSourceLoad,
  destroyHlsInstance,
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

const STALL_RECOVERY_DELAY_MS = 8000
const MAX_RECOVERY_ATTEMPTS = 3

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
  const recoveryAttemptsRef = useRef(0)
  const recoverySeekTimeRef = useRef<number | null>(null)
  const lastPlayUrlRef = useRef("")
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

    if (lastPlayUrlRef.current !== playUrl) {
      lastPlayUrlRef.current = playUrl
      recoveryAttemptsRef.current = 0
      recoverySeekTimeRef.current = null
    }

    configureMobileVideo(video)
    setStatus("loading")
    setStatusMessage("正在加载播放资源...")

    const clearStallTimer = () => {
      if (stallTimerRef.current !== null) {
        window.clearTimeout(stallTimerRef.current)
        stallTimerRef.current = null
      }
    }

    const markReady = () => {
      clearStallTimer()
      recoveryAttemptsRef.current = 0
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
      setStatus("error")
      setStatusMessage("当前线路加载失败，请重试或切换线路")
      callbacksRef.current.onError?.()
    }

    const restartSource = (seekTime: number) => {
      recoverySeekTimeRef.current = seekTime
      setLoadAttempt((attempt) => attempt + 1)
    }

    const recoverPlayback = (forceSourceRestart = false) => {
      if (video.ended) return
      if (recoveryAttemptsRef.current >= MAX_RECOVERY_ATTEMPTS) {
        failPlayback()
        return
      }

      recoveryAttemptsRef.current += 1
      const attempt = recoveryAttemptsRef.current
      const seekTime = Number.isFinite(video.currentTime) ? video.currentTime : 0
      setStatus("loading")
      setStatusMessage(`播放中断，正在自动重试（${attempt}/${MAX_RECOVERY_ATTEMPTS}）...`)

      if (forceSourceRestart) {
        restartSource(seekTime)
        return
      }

      const hls = hlsRef.current
      if (!hls) {
        restartSource(seekTime)
        return
      }

      try {
        hls.stopLoad()
        hls.startLoad(seekTime)
        playIfRequested()
        scheduleStallRecovery()
      } catch {
        restartSource(seekTime)
      }
    }

    function scheduleStallRecovery() {
      if (stallTimerRef.current !== null) return
      stallTimerRef.current = window.setTimeout(() => {
        stallTimerRef.current = null
        if (video.ended || video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
          return
        }
        recoverPlayback()
      }, STALL_RECOVERY_DELAY_MS)
    }

    const seekTarget =
      recoverySeekTimeRef.current ??
      (initialTime && initialTime > 0 ? initialTime : 0)
    recoverySeekTimeRef.current = null

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
      () => recoverPlayback(true),
      {
        shouldAutoPlay: () => shouldAutoPlayRef.current,
      },
    )

    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      seekAndMaybePlay()
    } else {
      video.addEventListener("loadedmetadata", seekAndMaybePlay, { once: true })
    }

    let hasStartedPlayback = false
    let lastTimeEmit = 0
    let lastObservedTime = video.currentTime
    const onTimeUpdateEvent = () => {
      const currentTime = video.currentTime
      if (currentTime > lastObservedTime + 0.05) {
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
      shouldAutoPlayRef.current = false
      callbacksRef.current.onPlaybackStateChange?.(false)
    }

    const onWaitingEvent = () => {
      setStatus("loading")
      setStatusMessage("网络缓冲中，请稍候...")
      scheduleStallRecovery()
    }

    const onCanPlayEvent = () => {
      markReady()
      playIfRequested()
    }

    const onSeekingEvent = () => {
      setStatus("loading")
      setStatusMessage("正在定位播放位置...")
      scheduleStallRecovery()
    }

    const onSeekedEvent = () => {
      if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) markReady()
    }

    const onErrorEvent = () => {
      if (!video.error?.code) return
      clearStallTimer()
      recoverPlayback()
    }

    video.addEventListener("timeupdate", onTimeUpdateEvent)
    video.addEventListener("ended", onEndedEvent)
    video.addEventListener("play", onPlayEvent)
    video.addEventListener("pause", onPauseEvent)
    video.addEventListener("error", onErrorEvent)
    video.addEventListener("loadstart", onWaitingEvent)
    video.addEventListener("waiting", onWaitingEvent)
    video.addEventListener("stalled", onWaitingEvent)
    video.addEventListener("canplay", onCanPlayEvent)
    video.addEventListener("playing", markReady)
    video.addEventListener("seeking", onSeekingEvent)
    video.addEventListener("seeked", onSeekedEvent)
    scheduleStallRecovery()

    return () => {
      clearStallTimer()
      cancelPendingVideoSourceLoad(video)
      video.removeEventListener("loadedmetadata", seekAndMaybePlay)
      video.removeEventListener("timeupdate", onTimeUpdateEvent)
      video.removeEventListener("ended", onEndedEvent)
      video.removeEventListener("play", onPlayEvent)
      video.removeEventListener("pause", onPauseEvent)
      video.removeEventListener("error", onErrorEvent)
      video.removeEventListener("loadstart", onWaitingEvent)
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
    recoveryAttemptsRef.current = 0
    recoverySeekTimeRef.current = video?.currentTime || initialTime || 0
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
