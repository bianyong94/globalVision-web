import React, { useEffect, useRef, useState } from "react"
import { RotateCcw, WifiOff } from "lucide-react"
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
  const retrySeekTimeRef = useRef<number | null>(null)
  const shouldAutoPlayRef = useRef(autoPlay)
  const callbacksRef = useRef({
    onTimeUpdate,
    onPlaybackStateChange,
    onEnded,
    onError,
  })
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [hasError, setHasError] = useState(false)
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
    setHasError(false)

    const playIfRequested = () => {
      if (!shouldAutoPlayRef.current) return
      void video.play().catch(() => {
        // Browsers may require an explicit user gesture. Native controls remain usable.
      })
    }

    const failPlayback = () => {
      setHasError(true)
      callbacksRef.current.onError?.()
    }

    const seekTarget =
      retrySeekTimeRef.current ??
      (initialTime && initialTime > 0 ? initialTime : 0)
    retrySeekTimeRef.current = null

    const seekAndMaybePlay = () => {
      if (seekTarget > 0 && Number.isFinite(video.duration)) {
        video.currentTime = Math.min(seekTarget, Math.max(0, video.duration - 0.25))
      }
      playIfRequested()
    }

    let hasStartedPlayback = false
    let lastTimeEmit = 0
    const onTimeUpdateEvent = () => {
      const now = performance.now()
      if (now - lastTimeEmit < 250 || video.currentTime <= 0) return
      lastTimeEmit = now
      callbacksRef.current.onTimeUpdate?.(
        video.currentTime,
        Number.isFinite(video.duration) ? video.duration : 0,
      )
    }

    const onEndedEvent = () => {
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

    const onErrorEvent = () => {
      if (!video.error?.code || usesManagedHls) return
      failPlayback()
    }

    video.addEventListener("loadedmetadata", seekAndMaybePlay, { once: true })
    video.addEventListener("canplay", playIfRequested)
    video.addEventListener("timeupdate", onTimeUpdateEvent)
    video.addEventListener("ended", onEndedEvent)
    video.addEventListener("play", onPlayEvent)
    video.addEventListener("pause", onPauseEvent)
    video.addEventListener("error", onErrorEvent)

    loadVideoSource(video, playUrl, hlsRef, failPlayback, {
      shouldAutoPlay: () => shouldAutoPlayRef.current,
    })

    return () => {
      cancelPendingVideoSourceLoad(video)
      video.removeEventListener("loadedmetadata", seekAndMaybePlay)
      video.removeEventListener("canplay", playIfRequested)
      video.removeEventListener("timeupdate", onTimeUpdateEvent)
      video.removeEventListener("ended", onEndedEvent)
      video.removeEventListener("play", onPlayEvent)
      video.removeEventListener("pause", onPauseEvent)
      video.removeEventListener("error", onErrorEvent)
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
    retrySeekTimeRef.current = video?.currentTime || initialTime || 0
    shouldAutoPlayRef.current = true
    setHasError(false)
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
        controlsList="nodownload noremoteplayback"
      />

      {hasError ? (
        <div className="gv-player-error" role="alert">
          <div className="gv-player-error-card">
            <WifiOff className="gv-player-error-icon" aria-hidden="true" />
            <span>当前线路无法播放，请重试或切换线路</span>
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
