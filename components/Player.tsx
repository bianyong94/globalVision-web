import React, { useEffect, useRef } from "react"
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
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const stallTimerRef = useRef<number | null>(null)
  const callbacksRef = useRef({ onTimeUpdate, onEnded, onError })
  const playUrl = normalizeMediaUrl(url)

  useEffect(() => {
    callbacksRef.current = { onTimeUpdate, onEnded, onError }
  }, [onTimeUpdate, onEnded, onError])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !playUrl) return

    configureMobileVideo(video)

    const clearStallTimer = () => {
      if (stallTimerRef.current) {
        window.clearTimeout(stallTimerRef.current)
        stallTimerRef.current = null
      }
    }

    const scheduleStallFail = () => {
      if (stallTimerRef.current) return
      stallTimerRef.current = window.setTimeout(() => {
        stallTimerRef.current = null
        if (video.paused || video.ended) return
        callbacksRef.current.onError?.()
      }, 30000)
    }

    const handleError = () => {
      const code = video.error?.code
      if (!code) return
      clearStallTimer()
      callbacksRef.current.onError?.()
    }

    loadVideoSource(video, playUrl, hlsRef, () => {
      callbacksRef.current.onError?.()
    })

    if (initialTime && initialTime > 0) {
      const seek = () => {
        video.currentTime = initialTime
      }
      if (video.readyState >= 1) seek()
      else video.addEventListener("loadedmetadata", seek, { once: true })
    }

    let lastTimeEmit = 0
    const onTimeUpdateEvent = () => {
      const now = performance.now()
      if (now - lastTimeEmit < 250) return
      lastTimeEmit = now
      if (callbacksRef.current.onTimeUpdate && video.currentTime > 0) {
        callbacksRef.current.onTimeUpdate(video.currentTime)
      }
    }

    const onEndedEvent = () => {
      clearStallTimer()
      callbacksRef.current.onEnded?.()
    }

    video.addEventListener("timeupdate", onTimeUpdateEvent)
    video.addEventListener("ended", onEndedEvent)
    video.addEventListener("error", handleError)
    video.addEventListener("waiting", scheduleStallFail)
    video.addEventListener("stalled", scheduleStallFail)
    video.addEventListener("playing", clearStallTimer)

    return () => {
      clearStallTimer()
      cancelPendingVideoSourceLoad(video)
      video.removeEventListener("timeupdate", onTimeUpdateEvent)
      video.removeEventListener("ended", onEndedEvent)
      video.removeEventListener("error", handleError)
      video.removeEventListener("waiting", scheduleStallFail)
      video.removeEventListener("stalled", scheduleStallFail)
      video.removeEventListener("playing", clearStallTimer)
      destroyHlsInstance(hlsRef.current)
      hlsRef.current = null
    }
  }, [playUrl, initialTime])

  useEffect(() => {
    const video = videoRef.current
    if (video && poster) {
      video.poster = poster
    }
  }, [poster])

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
    </div>
  )
}

export default Player
