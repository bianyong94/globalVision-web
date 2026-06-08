import Hls from "hls.js"
import type VideoJsPlayer from "video.js/dist/types/player"
import { normalizeMediaUrl } from "../../utils/common"
import { getSourceType } from "./videojs-extensions"

export const isM3u8Url = (url: string) => /\.m3u8(?:$|[?#])/i.test(url)

const getVideoEl = (player: VideoJsPlayer) =>
  player.tech(true).el() as HTMLVideoElement

const createHls = (onFatal?: () => void) => {
  const hls = new Hls({
    enableWorker: true,
    lowLatencyMode: false,
    backBufferLength: 30,
    maxBufferLength: 24,
    maxMaxBufferLength: 120,
    fragLoadingTimeOut: 25000,
    fragLoadingMaxRetry: 6,
    fragLoadingRetryDelay: 800,
    fragLoadingMaxRetryTimeout: 8000,
    manifestLoadingTimeOut: 12000,
    manifestLoadingMaxRetry: 4,
    manifestLoadingRetryDelay: 800,
    levelLoadingTimeOut: 12000,
    levelLoadingMaxRetry: 4,
    levelLoadingRetryDelay: 800,
    startLevel: 0,
  })

  hls.on(Hls.Events.ERROR, (_event, data) => {
    if (!data.fatal) return
    switch (data.type) {
      case Hls.ErrorTypes.NETWORK_ERROR:
        hls.startLoad()
        break
      case Hls.ErrorTypes.MEDIA_ERROR:
        hls.recoverMediaError()
        break
      default:
        hls.destroy()
        onFatal?.()
        break
    }
  })

  return hls
}

export const destroyHlsInstance = (hls: Hls | null) => {
  if (!hls) return
  hls.destroy()
}

export const loadPlayerSource = (
  player: VideoJsPlayer,
  rawUrl: string,
  hlsRef: { current: Hls | null },
  onFatal?: () => void,
) => {
  const url = normalizeMediaUrl(rawUrl)
  if (!url) return

  destroyHlsInstance(hlsRef.current)
  hlsRef.current = null

  const video = getVideoEl(player)
  video.removeAttribute("src")
  video.load()

  if (isM3u8Url(url)) {
    if (Hls.isSupported()) {
      const hls = createHls(onFatal)
      hls.loadSource(url)
      hls.attachMedia(video)
      hlsRef.current = hls
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        player.play()?.catch(() => {})
      })
      return
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      player.src({ src: url, type: "application/x-mpegURL" })
      player.play()?.catch(() => {})
      return
    }
  }

  player.src({ src: url, type: getSourceType(url) })
  player.play()?.catch(() => {})
}
