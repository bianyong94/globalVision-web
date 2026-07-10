import type Hls from "hls.js"
import { normalizeMediaUrl } from "../../utils/common"

export const isM3u8Url = (url: string) => /\.m3u8(?:$|[?#])/i.test(url)

type HlsProfile = "vod" | "short"

type VideoSourceOptions = {
  profile?: HlsProfile
  shouldAutoPlay?: () => boolean
}

type HlsConstructor = typeof import("hls.js")["default"]

let hlsConstructorPromise: Promise<HlsConstructor> | null = null
const sourceLoadGeneration = new WeakMap<HTMLVideoElement, number>()

const getHlsConstructor = () => {
  hlsConstructorPromise ||= import("hls.js").then((module) => module.default)
  return hlsConstructorPromise
}

const createHls = (
  HlsImpl: HlsConstructor,
  profile: HlsProfile,
  onFatal?: () => void,
) => {
  const isShortVideo = profile === "short"
  const hls = new HlsImpl({
    enableWorker: true,
    lowLatencyMode: false,

    // Short feeds keep a small rolling buffer so the active item cannot consume
    // all memory/bandwidth. Long-form playback can still buffer aggressively.
    maxBufferLength: isShortVideo ? 12 : 60,
    maxMaxBufferLength: isShortVideo ? 30 : 600,
    maxBufferSize: (isShortVideo ? 24 : 120) * 1000 * 1000,
    backBufferLength: isShortVideo ? 5 : 15,

    // Fast start: auto-select quality based on bandwidth, prefetch first fragment
    startLevel: -1,
    startFragPrefetch: true,
    testBandwidth: true,
    capLevelToPlayerSize: true,

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
  let mediaRetryCount = 0
  const MAX_NETWORK_RETRIES = 3
  const MAX_MEDIA_RETRIES = 2

  hls.on(HlsImpl.Events.ERROR, (_event, data) => {
    if (!data.fatal) return
    switch (data.type) {
      case HlsImpl.ErrorTypes.NETWORK_ERROR:
        if (networkRetryCount < MAX_NETWORK_RETRIES) {
          networkRetryCount++
          hls.startLoad()
        } else {
          hls.destroy()
          onFatal?.()
        }
        break
      case HlsImpl.ErrorTypes.MEDIA_ERROR:
        if (mediaRetryCount < MAX_MEDIA_RETRIES) {
          mediaRetryCount += 1
          if (mediaRetryCount === MAX_MEDIA_RETRIES) {
            hls.swapAudioCodec()
          }
          hls.recoverMediaError()
        } else {
          hls.destroy()
          onFatal?.()
        }
        break
      default:
        hls.destroy()
        onFatal?.()
        break
    }
  })

  hls.on(HlsImpl.Events.FRAG_LOADED, () => {
    networkRetryCount = 0
    mediaRetryCount = 0
  })

  return hls
}

export const destroyHlsInstance = (hls: Hls | null) => {
  if (!hls) return
  hls.destroy()
}

export const cancelPendingVideoSourceLoad = (video: HTMLVideoElement) => {
  sourceLoadGeneration.set(
    video,
    (sourceLoadGeneration.get(video) || 0) + 1,
  )
}

export const loadVideoSource = (
  video: HTMLVideoElement,
  rawUrl: string,
  hlsRef: { current: Hls | null },
  onFatal?: () => void,
  options: VideoSourceOptions = {},
) => {
  const url = normalizeMediaUrl(rawUrl)
  if (!url) return
  const generation = (sourceLoadGeneration.get(video) || 0) + 1
  sourceLoadGeneration.set(video, generation)

  destroyHlsInstance(hlsRef.current)
  hlsRef.current = null

  video.removeAttribute("src")
  video.load()

  if (isM3u8Url(url)) {
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url
      return
    }

    void getHlsConstructor()
      .then((HlsImpl) => {
        if (sourceLoadGeneration.get(video) !== generation) return
        if (!HlsImpl.isSupported()) {
          onFatal?.()
          return
        }

        const hls = createHls(HlsImpl, options.profile || "vod", onFatal)
        hls.attachMedia(video)
        hls.loadSource(url)
        hls.on(HlsImpl.Events.MANIFEST_PARSED, () => {
          if (options.shouldAutoPlay?.() ?? true) {
            video.play().catch(() => {})
          }
        })
        hlsRef.current = hls
      })
      .catch(() => onFatal?.())
    return
  }

  video.src = url
}
