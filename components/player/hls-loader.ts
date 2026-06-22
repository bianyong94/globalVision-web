import Hls from "hls.js"
import { normalizeMediaUrl } from "../../utils/common"

export const isM3u8Url = (url: string) => /\.m3u8(?:$|[?#])/i.test(url)

const createHls = (onFatal?: () => void) => {
  const hls = new Hls({
    enableWorker: true,
    lowLatencyMode: false,

    // Buffer: allow aggressive forward buffering (especially while paused)
    maxBufferLength: 60,
    maxMaxBufferLength: 600,
    maxBufferSize: 120 * 1000 * 1000,
    backBufferLength: 15,

    // Fast start: auto-select quality based on bandwidth, prefetch first fragment
    startLevel: -1,
    startFragPrefetch: true,
    testBandwidth: true,

    // Seek tolerance: handle small gaps after seeking without stalling
    maxBufferHole: 0.5,
    nudgeMaxRetry: 5,

    // Fragment loading: tighter timeout for faster failover on seek
    fragLoadingTimeOut: 12000,
    fragLoadingMaxRetry: 6,
    fragLoadingRetryDelay: 500,
    fragLoadingMaxRetryTimeout: 6000,

    // Manifest/level loading
    manifestLoadingTimeOut: 10000,
    manifestLoadingMaxRetry: 4,
    manifestLoadingRetryDelay: 500,
    levelLoadingTimeOut: 10000,
    levelLoadingMaxRetry: 4,
    levelLoadingRetryDelay: 500,

    // Progressive download for better throughput on supported browsers
    progressive: true,

    // ABR: fast switch to adapt quality quickly after bandwidth changes
    abrEwmaDefaultEstimate: 1000000,
    abrEwmaDefaultEstimateMax: 5000000,
  })

  let networkRetryCount = 0
  const MAX_NETWORK_RETRIES = 3

  hls.on(Hls.Events.ERROR, (_event, data) => {
    if (!data.fatal) return
    switch (data.type) {
      case Hls.ErrorTypes.NETWORK_ERROR:
        if (networkRetryCount < MAX_NETWORK_RETRIES) {
          networkRetryCount++
          hls.startLoad()
        } else {
          hls.destroy()
          onFatal?.()
        }
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

  hls.on(Hls.Events.FRAG_LOADED, () => {
    networkRetryCount = 0
  })

  return hls
}

export const destroyHlsInstance = (hls: Hls | null) => {
  if (!hls) return
  hls.destroy()
}

export const loadVideoSource = (
  video: HTMLVideoElement,
  rawUrl: string,
  hlsRef: { current: Hls | null },
  onFatal?: () => void,
) => {
  const url = normalizeMediaUrl(rawUrl)
  if (!url) return

  destroyHlsInstance(hlsRef.current)
  hlsRef.current = null

  video.removeAttribute("src")
  video.load()

  if (isM3u8Url(url)) {
    if (Hls.isSupported()) {
      const hls = createHls(onFatal)
      hls.loadSource(url)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {})
      })
      hlsRef.current = hls
      return
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url
      return
    }
  }

  video.src = url
}
