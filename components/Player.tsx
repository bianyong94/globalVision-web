import React, { useEffect, useRef } from "react"
import videojs from "video.js"
import type VideoJsPlayer from "video.js/dist/types/player"
import type Hls from "hls.js"
import "video.js/dist/video-js.css"
import "./player/videojs-theme.css"
import {
  applyVideoCastAttrs,
  getControlBarChildren,
  registerVideoJsExtensions,
} from "./player/videojs-extensions"
import { destroyHlsInstance, loadPlayerSource } from "./player/hls-loader"
import { normalizeMediaUrl } from "../utils/common"

interface PlayerProps {
  url: string
  poster?: string
  className?: string
  initialTime?: number
  onTimeUpdate?: (time: number) => void
  onEnded?: () => void
  onError?: () => void
}

registerVideoJsExtensions()

const Player: React.FC<PlayerProps> = ({
  url,
  poster,
  className,
  initialTime,
  onTimeUpdate,
  onEnded,
  onError,
}) => {
  const shellRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<VideoJsPlayer | null>(null)
  const hlsRef = useRef<Hls | null>(null)
  const stallTimerRef = useRef<number | null>(null)
  const callbacksRef = useRef({ onTimeUpdate, onEnded, onError })
  const playUrl = normalizeMediaUrl(url)

  useEffect(() => {
    callbacksRef.current = { onTimeUpdate, onEnded, onError }
  }, [onTimeUpdate, onEnded, onError])

  useEffect(() => {
    const shell = shellRef.current
    if (!shell) return

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
        callbacksRef.current.onError?.()
      }, 25000)
    }

    const handleFatalError = () => {
      clearStallTimer()
      callbacksRef.current.onError?.()
    }

    const videoEl = document.createElement("video")
    videoEl.className =
      "video-js vjs-big-play-centered vjs-fill w-full h-full"
    videoEl.setAttribute("playsinline", "true")
    videoEl.setAttribute("crossorigin", "anonymous")
    shell.appendChild(videoEl)

    let player: VideoJsPlayer
    try {
      player = videojs(videoEl, {
        controls: true,
        autoplay: false,
        preload: "auto",
        fluid: false,
        fill: true,
        responsive: false,
        playsinline: true,
        poster: poster || "",
        playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
        html5: {
          vhs: {
            overrideNative: false,
          },
          nativeAudioTracks: false,
          nativeVideoTracks: false,
        },
        controlBar: {
          pictureInPictureToggle: false,
          children: getControlBarChildren(),
        },
      })
    } catch (error) {
      console.error("video.js init failed:", error)
      shell.innerHTML = ""
      handleFatalError()
      return
    }

    playerRef.current = player

    player.ready(() => {
      applyVideoCastAttrs(player)

      if (playUrl) {
        loadPlayerSource(player, playUrl, hlsRef, handleFatalError)
      }

      if (initialTime && initialTime > 0) {
        player.one("loadedmetadata", () => {
          player.currentTime(initialTime)
        })
      }
    })

    player.on("timeupdate", () => {
      const current = player.currentTime()
      if (callbacksRef.current.onTimeUpdate && current > 0) {
        callbacksRef.current.onTimeUpdate(current)
      }
    })

    player.on("ended", () => {
      clearStallTimer()
      callbacksRef.current.onEnded?.()
    })

    player.on("error", () => {
      handleFatalError()
    })

    player.on("waiting", scheduleStallFail)
    player.on("stalled", scheduleStallFail)
    player.on("playing", clearStallTimer)

    return () => {
      clearStallTimer()
      destroyHlsInstance(hlsRef.current)
      hlsRef.current = null

      if (playerRef.current && !playerRef.current.isDisposed()) {
        playerRef.current.dispose()
      }
      playerRef.current = null
      shell.innerHTML = ""
    }
  }, [])

  useEffect(() => {
    const player = playerRef.current
    if (!player || player.isDisposed() || !playUrl) return

    player.poster(poster || "")
    loadPlayerSource(player, playUrl, hlsRef, () => {
      callbacksRef.current.onError?.()
    })
    applyVideoCastAttrs(player)
  }, [playUrl, poster])

  return (
    <div
      className={`gv-video-player ${className || ""}`.trim()}
      style={{ width: "100%", height: "100%" }}
    >
      <div ref={shellRef} data-vjs-player className="w-full h-full" />
    </div>
  )
}

export default Player
