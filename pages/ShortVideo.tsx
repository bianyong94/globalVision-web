import React, { useEffect, useMemo, useRef, useState } from "react"
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import { useLocation, useNavigate } from "react-router-dom"
import type Hls from "hls.js"
import {
  ChevronLeft,
  Eye,
  EyeOff,
  Flame,
  Heart,
  Loader2,
  MessageCircle,
  Play,
  Shuffle,
  RefreshCw,
  Volume2,
  VolumeX,
  X,
} from "lucide-react"
import SEO from "../components/SEO"
import { configureMobileVideo } from "../components/player/device"
import {
  destroyHlsInstance,
  isM3u8Url,
  loadVideoSource,
} from "../components/player/hls-loader"
import { fetchShortVideoComments, fetchShortVideoFeed } from "../services/api"
import { ShortVideoCommentItem, ShortVideoItem } from "../types"
import {
  createImageFallbackHandler,
  getProxyUrl,
  normalizeMediaUrl,
} from "../utils/common"
import {
  getLikedShortVideos,
  subscribeShortVideoLikes,
  toggleLikedShortVideo,
} from "../utils/shortVideoLikes"

const FEED_PAGE_SIZE = 5
const COMMENT_PAGE_SIZE = 10
const STORAGE_KEY = "vastren.short-video.v1"
const PROGRESS_STATE_SYNC_MS = 120
const RANDOM_BOOTSTRAP_PAGE = 1
const RANDOM_RECENT_PAGE_LIMIT = 600
const MEDIA_PRELOAD_BEHIND = 1
const MEDIA_PRELOAD_AHEAD = 2
const MEDIA_AUTO_PRELOAD_AHEAD = 1
const VIDEO_PREWARM_BYTES = 1024 * 1024
const AUTO_PLAY_RETRY_DELAY_MS = 1600
const VIDEO_PREWARM_DELAY_MS = 700
const VIDEO_PREWARM_AHEAD_COUNT = 1

type FeedMode = "latest" | "recommend" | "random"
type ShortVideoViewMode = "feed" | "liked"

type FeedState = {
  activeFeed: FeedMode
  activeIndexByFeed: Record<FeedMode, number>
  loadedPagesByFeed: Record<FeedMode, number>
}

const DEFAULT_STATE: FeedState = {
  activeFeed: "latest",
  activeIndexByFeed: {
    latest: 0,
    recommend: 0,
    random: 0,
  },
  loadedPagesByFeed: {
    latest: 1,
    recommend: 1,
    random: 1,
  },
}

const readState = (): FeedState => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_STATE
    const parsed = JSON.parse(raw) as Partial<FeedState>
    return {
      activeFeed:
        parsed.activeFeed === "recommend" || parsed.activeFeed === "random"
          ? parsed.activeFeed
          : parsed.activeFeed === "latest"
            ? "latest"
            : DEFAULT_STATE.activeFeed,
      activeIndexByFeed: {
        latest:
          typeof parsed.activeIndexByFeed?.latest === "number"
            ? parsed.activeIndexByFeed.latest
            : 0,
        recommend:
          typeof parsed.activeIndexByFeed?.recommend === "number"
            ? parsed.activeIndexByFeed.recommend
            : 0,
        random:
          typeof parsed.activeIndexByFeed?.random === "number"
            ? parsed.activeIndexByFeed.random
            : 0,
      },
      loadedPagesByFeed: {
        latest:
          typeof parsed.loadedPagesByFeed?.latest === "number" &&
          parsed.loadedPagesByFeed.latest > 0
            ? parsed.loadedPagesByFeed.latest
            : 1,
        recommend:
          typeof parsed.loadedPagesByFeed?.recommend === "number" &&
          parsed.loadedPagesByFeed.recommend > 0
            ? parsed.loadedPagesByFeed.recommend
            : 1,
        random:
          typeof parsed.loadedPagesByFeed?.random === "number" &&
          parsed.loadedPagesByFeed.random > 0
            ? parsed.loadedPagesByFeed.random
            : 1,
      },
    }
  } catch {
    return DEFAULT_STATE
  }
}

const FEED_TABS: Array<{ key: FeedMode; label: string }> = [
  { key: "latest", label: "最新" },
  { key: "recommend", label: "推荐" },
  { key: "random", label: "随机" },
]

const seededRandom = (seed: number) => {
  let value = seed || 1
  return () => {
    value |= 0
    value = (value + 0x6d2b79f5) | 0
    let t = Math.imul(value ^ (value >>> 15), 1 | value)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const shuffleShortVideos = (list: ShortVideoItem[], seed: number) => {
  const next = [...list]
  const random = seededRandom(seed)
  for (let index = next.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[next[index], next[target]] = [next[target], next[index]]
  }
  return next
}

const resolveRandomMaxPage = (total: number, pageSize: number) => {
  const totalPages = Math.max(1, Math.ceil(total / Math.max(pageSize, 1)))
  return Math.min(totalPages, RANDOM_RECENT_PAGE_LIMIT)
}

const pickRandomUnseenPage = (
  maxPage: number,
  seenPages: Set<number>,
  seed: number,
) => {
  const safeMaxPage = Math.max(1, maxPage)
  const availableCount = safeMaxPage - seenPages.size
  if (availableCount <= 0) return undefined

  const random = seededRandom(seed)
  for (let attempt = 0; attempt < safeMaxPage * 2; attempt += 1) {
    const candidate = Math.floor(random() * safeMaxPage) + 1
    if (!seenPages.has(candidate)) return candidate
  }

  for (let page = 1; page <= safeMaxPage; page += 1) {
    if (!seenPages.has(page)) return page
  }

  return undefined
}

const fetchNextRandomVideoPage = async (
  targetFeed: "latest" | "recommend",
  maxPage: number,
  seenPages: Set<number>,
  seed: number,
) => {
  const triedPages = new Set(seenPages)

  while (triedPages.size < maxPage) {
    const page =
      pickRandomUnseenPage(maxPage, triedPages, seed + triedPages.size * 131) ||
      1
    triedPages.add(page)

    const response = await fetchShortVideoFeed(targetFeed, {
      page,
      pageSize: FEED_PAGE_SIZE,
    })

    if (response.list.length > 0 || triedPages.size >= maxPage) {
      return response
    }
  }

  return fetchShortVideoFeed(targetFeed, {
    page: 1,
    pageSize: FEED_PAGE_SIZE,
  })
}

const formatCount = (value?: string) => {
  if (!value) return "0"
  const normalized = value.trim()
  if (!normalized) return "0"
  const num = parseInt(normalized, 10)
  if (isNaN(num)) return normalized
  if (num >= 10000) return (num / 10000).toFixed(1) + "w"
  return num.toString()
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const ensureVideoOriginPreconnect = (url?: string) => {
  if (typeof document === "undefined" || !url) return

  let origin = ""
  try {
    origin = new URL(normalizeMediaUrl(url)).origin
  } catch {
    return
  }

  if (!origin) return
  const selector = `link[data-short-video-preconnect="${origin}"]`
  if (document.head.querySelector(selector)) return

  const link = document.createElement("link")
  link.rel = "preconnect"
  link.href = origin
  link.crossOrigin = "anonymous"
  link.dataset.shortVideoPreconnect = origin
  document.head.appendChild(link)
}

const videoPrewarmPending = new Map<string, Promise<void>>()
const videoPrewarmDone = new Set<string>()

const parseContentRangeTotal = (contentRange: string | null) => {
  if (!contentRange) return 0
  const match = contentRange.match(/\/(\d+)$/)
  return match ? Number(match[1]) || 0 : 0
}

const fetchVideoRange = async (url: string, range: string) => {
  const response = await fetch(url, {
    method: "GET",
    mode: "cors",
    headers: {
      Range: range,
      Accept: "video/mp4,video/*;q=0.9,*/*;q=0.8",
    },
  })
  await response.arrayBuffer()
}

const prewarmVideoBytes = (rawUrl?: string) => {
  if (typeof window === "undefined" || !rawUrl) return
  const url = normalizeMediaUrl(rawUrl)
  if (!url || videoPrewarmDone.has(url) || videoPrewarmPending.has(url)) return
  if (isM3u8Url(url)) return

  const task = (async () => {
    const firstResponse = await fetch(url, {
      method: "GET",
      mode: "cors",
      headers: {
        Range: `bytes=0-${VIDEO_PREWARM_BYTES - 1}`,
        Accept: "video/mp4,video/*;q=0.9,*/*;q=0.8",
      },
    })

    const total = parseContentRangeTotal(
      firstResponse.headers.get("content-range"),
    )
    await firstResponse.arrayBuffer()
    if (total > VIDEO_PREWARM_BYTES * 2) {
      const tailStart = Math.max(0, total - VIDEO_PREWARM_BYTES)
      await fetchVideoRange(url, `bytes=${tailStart}-${total - 1}`)
    }

    videoPrewarmDone.add(url)
  })()
    .catch(() => undefined)
    .finally(() => {
      videoPrewarmPending.delete(url)
    })

  videoPrewarmPending.set(url, task)
}

const CommentSheet = ({
  open,
  item,
  onClose,
}: {
  open: boolean
  item: ShortVideoItem | null
  onClose: () => void
}) => {
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const [shouldRender, setShouldRender] = useState(open)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (open) {
      setShouldRender(true)
      const frame = window.requestAnimationFrame(() => {
        setIsVisible(true)
      })
      return () => window.cancelAnimationFrame(frame)
    }

    setIsVisible(false)
    const timer = window.setTimeout(() => {
      setShouldRender(false)
    }, 220)

    return () => window.clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!shouldRender) {
      setIsVisible(false)
      return
    }
  }, [shouldRender])

  const commentsQuery = useInfiniteQuery({
    queryKey: ["short-video-comments", item?.id || ""],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) =>
      fetchShortVideoComments(item?.id || "", {
        page: Number(pageParam || 1),
        pageSize: COMMENT_PAGE_SIZE,
      }),
    getNextPageParam: (lastPage) => {
      const loaded = lastPage.page * lastPage.pageSize
      return loaded < lastPage.total ? lastPage.page + 1 : undefined
    },
    enabled: open && Boolean(item?.id),
    staleTime: 1000 * 30,
  })

  const comments = commentsQuery.data?.pages.flatMap((page) => page.list) || []

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose, open])

  useEffect(() => {
    if (!open) return
    const el = loadMoreRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          commentsQuery.hasNextPage &&
          !commentsQuery.isFetchingNextPage
        ) {
          commentsQuery.fetchNextPage()
        }
      },
      { threshold: 0.1, rootMargin: "160px" },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [
    commentsQuery.fetchNextPage,
    commentsQuery.hasNextPage,
    commentsQuery.isFetchingNextPage,
    open,
  ])

  if (!shouldRender) return null

  return (
    <div className="absolute inset-0 z-[80]">
      <button
        type="button"
        className={`absolute inset-0 backdrop-blur-[2px] transition-opacity duration-200 ${
          isVisible ? "bg-black/55 opacity-100" : "bg-black/0 opacity-0"
        }`}
        onClick={onClose}
        aria-label="关闭评论"
      />

      <section
        className={`absolute inset-x-0 bottom-0 h-[72dvh] overflow-hidden rounded-t-[28px] border-t border-white/10 bg-[#0c0d12] shadow-[0_-18px_60px_rgba(0,0,0,0.45)] transition-transform duration-200 ease-out ${
          isVisible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 pb-3 pt-3">
          <div>
            <p className="text-sm font-semibold text-white/95">
              {item?.commentCount || comments.length} 条评论
            </p>
            {item?.description ? (
              <p className="mt-1 line-clamp-1 text-xs text-white/45">
                {item.description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/5 p-2 text-white/70 active:scale-95"
            aria-label="关闭评论弹层"
          >
            <X size={18} />
          </button>
        </div>

        <div className="h-px bg-white/6" />

        <div className="h-[calc(72dvh-4.5rem)] overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
          {commentsQuery.isLoading ? (
            <div className="flex items-center justify-center py-12 text-white/45">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : null}

          {!commentsQuery.isLoading && commentsQuery.isError ? (
            <div className="py-10 text-center">
              <p className="text-sm text-white/55">评论加载失败</p>
              <button
                type="button"
                onClick={() => commentsQuery.refetch()}
                className="mt-4 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white active:scale-95"
              >
                重试
              </button>
            </div>
          ) : null}

          {!commentsQuery.isLoading &&
          !commentsQuery.isError &&
          comments.length === 0 ? (
            <div className="py-12 text-center text-sm text-white/45">
              暂无评论
            </div>
          ) : null}

          <div className="space-y-4">
            {comments.map((comment: ShortVideoCommentItem) => (
              <article key={comment.id} className="flex gap-3">
                <img
                  src={getProxyUrl(comment.user.avatar, { w: 80, q: 70 })}
                  alt={comment.user.nickname}
                  className="h-9 w-9 rounded-full object-cover"
                  loading="lazy"
                  decoding="async"
                  onError={createImageFallbackHandler(comment.user.avatar)}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-white/78">
                      {comment.user.nickname}
                    </p>
                    <span className="text-[11px] text-white/35">
                      {comment.createTime}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-white/92">
                    {comment.content}
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-[11px] text-white/35">
                    <span>赞 {comment.likeCount}</span>
                    {comment.replies.repliesCount > 0 ? (
                      <span>回复 {comment.replies.repliesCount}</span>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div ref={loadMoreRef} className="flex justify-center py-5">
            {commentsQuery.isFetchingNextPage ? (
              <Loader2 size={18} className="animate-spin text-white/45" />
            ) : null}
          </div>
        </div>
      </section>
    </div>
  )
}

const ShortVideoSlide = ({
  item,
  isActive,
  isPageActive,
  shouldLoad,
  preloadMode,
  isLiked,
  isMuted,
  isPaused,
  isCleanMode,
  onToggleLike,
  onToggleMute,
  onTogglePaused,
  onToggleCleanMode,
  onOpenComments,
}: {
  item: ShortVideoItem
  isActive: boolean
  isPageActive: boolean
  shouldLoad: boolean
  preloadMode: "auto" | "metadata"
  isLiked: boolean
  isMuted: boolean
  isPaused: boolean
  isCleanMode: boolean
  onToggleLike: () => void
  onToggleMute: () => void
  onTogglePaused: () => void
  onToggleCleanMode: () => void
  onOpenComments: () => void
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const hlsRef = useRef<Hls | null>(null)
  const longPressTimerRef = useRef<number | null>(null)
  const longPressTriggeredRef = useRef(false)
  const playbackFrameRef = useRef<number | null>(null)
  const autoplayRetryTimerRef = useRef<number | null>(null)
  const progressTrackRef = useRef<HTMLDivElement | null>(null)
  const playedProgressRef = useRef<HTMLDivElement | null>(null)
  const bufferedProgressRef = useRef<HTMLDivElement | null>(null)
  const currentTimeRef = useRef(0)
  const bufferedEndRef = useRef(0)
  const lastProgressStateSyncRef = useRef(0)

  const shouldPlay = isPageActive && isActive && !isPaused
  const posterUrl = getProxyUrl(item.file.thumbnail, { w: 720, q: 78 })

  const [duration, setDuration] = useState<number>(item.file.duration || 0)
  const [currentTime, setCurrentTime] = useState(0)
  const [bufferedEnd, setBufferedEnd] = useState(0)

  const [isSeeking, setIsSeeking] = useState(false)
  const [seekValue, setSeekValue] = useState(0)

  const [isBoosting, setIsBoosting] = useState(false)
  const [isLandscape, setIsLandscape] = useState(() => {
    const { width, height } = item.file
    return Boolean(width && height && width >= height * 1.15)
  })

  // 确保 duration 是有效数值，防止 NaN 导致进度条计算崩溃
  const effectiveDuration =
    Number.isFinite(duration) && duration > 0 ? duration : 1
  // 核心：当前时间到底是播放时间还是拖拽时间
  const currentRenderTime = isSeeking ? seekValue : currentTime

  const playedRatio = clamp(currentRenderTime / effectiveDuration, 0, 1)
  const bufferedRatio = clamp(bufferedEnd / effectiveDuration, 0, 1)
  const showProgressLoading =
    shouldLoad &&
    isActive &&
    isPageActive &&
    shouldPlay &&
    currentTime <= 0 &&
    bufferedEnd <= 0

  const renderProgress = (
    playedTime = isSeeking ? seekValue : currentTimeRef.current,
    bufferedTime = bufferedEndRef.current,
    durationValue = effectiveDuration,
  ) => {
    const playedWidth = `${clamp(playedTime / durationValue, 0, 1) * 100}%`
    const bufferedWidth = `${clamp(bufferedTime / durationValue, 0, 1) * 100}%`

    if (playedProgressRef.current) {
      playedProgressRef.current.style.width = playedWidth
    }
    if (bufferedProgressRef.current) {
      bufferedProgressRef.current.style.width = bufferedWidth
    }
  }

  const syncProgressState = (now = performance.now()) => {
    if (now - lastProgressStateSyncRef.current < PROGRESS_STATE_SYNC_MS) return
    lastProgressStateSyncRef.current = now
    setCurrentTime(currentTimeRef.current)
    setBufferedEnd(bufferedEndRef.current)
  }

  const requestActivePlayback = (video: HTMLVideoElement) => {
    if (!shouldPlay) return
    video.playbackRate = isBoosting ? 2 : 1
    const playPromise = video.play()
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => undefined)
    }
  }

  const clearAutoplayRetry = () => {
    if (autoplayRetryTimerRef.current != null) {
      window.clearTimeout(autoplayRetryTimerRef.current)
      autoplayRetryTimerRef.current = null
    }
  }

  const scheduleAutoplayRetry = () => {
    clearAutoplayRetry()
    if (!shouldPlay) return
    autoplayRetryTimerRef.current = window.setTimeout(() => {
      autoplayRetryTimerRef.current = null
      const video = videoRef.current
      if (!video || !shouldPlay) return
      if (!video.paused && !video.ended && video.currentTime > 0.05) return
      requestActivePlayback(video)
    }, AUTO_PLAY_RETRY_DELAY_MS)
  }

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = isMuted
  }, [isMuted])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !shouldLoad) return
    configureMobileVideo(video)
    video.setAttribute("x5-video-player-fullscreen", "false")
  }, [shouldLoad])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !shouldLoad) return

    video.defaultMuted = isMuted
    loadVideoSource(video, item.file.resourceURL, hlsRef, () => {
      scheduleAutoplayRetry()
    })
    scheduleAutoplayRetry()

    return () => {
      clearAutoplayRetry()
      destroyHlsInstance(hlsRef.current)
      hlsRef.current = null
      video.pause()
      video.removeAttribute("src")
      video.load()
    }
  }, [isMuted, item.file.resourceURL, shouldLoad])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (!shouldPlay) {
      clearAutoplayRetry()
      video.pause()
      video.playbackRate = 1
      return
    }

    requestActivePlayback(video)
    scheduleAutoplayRetry()
  }, [isBoosting, shouldPlay])

  useEffect(() => {
    if (isActive) return
    setIsSeeking(false)
    setSeekValue(0)
    setIsBoosting(false)
    longPressTriggeredRef.current = false
    if (longPressTimerRef.current != null) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [isActive])

  useEffect(() => {
    const video = videoRef.current
    if (!shouldLoad) {
      bufferedEndRef.current = 0
      setBufferedEnd(0)
      return
    }

    if (video?.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      currentTimeRef.current = video.currentTime || currentTimeRef.current
      syncBuffered()
      renderProgress()
      syncProgressState()
      return
    }

    bufferedEndRef.current = 0
    setBufferedEnd(0)
  }, [item.file.resourceURL, shouldLoad])

  useEffect(() => {
    currentTimeRef.current = 0
    setCurrentTime(0)
  }, [item.file.resourceURL])

  useEffect(
    () => () => {
      clearAutoplayRetry()
      destroyHlsInstance(hlsRef.current)
      if (longPressTimerRef.current != null) {
        window.clearTimeout(longPressTimerRef.current)
      }
      if (playbackFrameRef.current != null) {
        window.cancelAnimationFrame(playbackFrameRef.current)
      }
    },
    [],
  )

  useEffect(() => {
    const video = videoRef.current
    if (!video || !isActive || !isPageActive || isSeeking) {
      if (playbackFrameRef.current != null) {
        window.cancelAnimationFrame(playbackFrameRef.current)
        playbackFrameRef.current = null
      }
      return
    }

    const syncPlaybackProgress = () => {
      if (!videoRef.current) return
      currentTimeRef.current = videoRef.current.currentTime || 0
      syncBuffered(false)
      renderProgress()
      syncProgressState()
      if (!videoRef.current.paused && !videoRef.current.ended) {
        playbackFrameRef.current =
          window.requestAnimationFrame(syncPlaybackProgress)
      } else {
        playbackFrameRef.current = null
      }
    }

    if (!video.paused && !video.ended) {
      playbackFrameRef.current =
        window.requestAnimationFrame(syncPlaybackProgress)
    }

    return () => {
      if (playbackFrameRef.current != null) {
        window.cancelAnimationFrame(playbackFrameRef.current)
        playbackFrameRef.current = null
      }
    }
  }, [isActive, isPageActive, isSeeking, shouldPlay])

  useEffect(() => {
    if (isSeeking) {
      renderProgress(seekValue, bufferedEndRef.current)
      return
    }
    renderProgress()
  }, [effectiveDuration, isSeeking, seekValue])

  const syncBuffered = (commitState = true) => {
    const video = videoRef.current
    if (!video || !video.buffered.length) return
    const end = video.buffered.end(video.buffered.length - 1)
    bufferedEndRef.current = end
    renderProgress()
    if (commitState) {
      setBufferedEnd(end)
    }
  }

  const resetLongPress = () => {
    if (longPressTimerRef.current != null) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    const video = videoRef.current
    if (video) video.playbackRate = 1
    setIsBoosting(false)
  }

  const triggerLongPress = () => {
    longPressTriggeredRef.current = true
    setIsBoosting(true)
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(10)
    }
    const video = videoRef.current
    if (video) {
      video.playbackRate = 2
      if (video.paused && shouldPlay) {
        const playPromise = video.play()
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => undefined)
        }
      }
    }
  }

  const handlePressStart = () => {
    if (!isActive) return
    longPressTriggeredRef.current = false
    if (longPressTimerRef.current != null) {
      window.clearTimeout(longPressTimerRef.current)
    }
    longPressTimerRef.current = window.setTimeout(triggerLongPress, 280)
  }

  const handlePressEnd = () => {
    const triggered = longPressTriggeredRef.current
    resetLongPress()
    if (triggered) {
      longPressTriggeredRef.current = false
      return
    }
    onTogglePaused()
  }

  const handlePressCancel = () => {
    longPressTriggeredRef.current = false
    resetLongPress()
  }

  // ==== 核心：修复进度条拖拽逻辑 ====
  const handleSeekStart = () => {
    setIsSeeking(true)
  }

  const handleSeekChange = (value: number) => {
    setIsSeeking(true)
    setSeekValue(value)
  }

  const handleSeekCommit = (value: number) => {
    const video = videoRef.current
    if (video) {
      video.currentTime = value
    }
    currentTimeRef.current = value
    setCurrentTime(value)
    setSeekValue(value)
    setIsSeeking(false)
    renderProgress(value, bufferedEndRef.current)
  }

  const getSeekValueFromPointer = (clientX: number) => {
    const track = progressTrackRef.current
    if (!track) return 0
    const rect = track.getBoundingClientRect()
    const ratio = clamp((clientX - rect.left) / Math.max(rect.width, 1), 0, 1)
    return ratio * effectiveDuration
  }

  const handleTrackPointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    event.stopPropagation()
    event.preventDefault()
    handleSeekStart()
    const nextValue = getSeekValueFromPointer(event.clientX)
    handleSeekChange(nextValue)

    const target = event.currentTarget
    if (target.setPointerCapture) {
      target.setPointerCapture(event.pointerId)
    }
  }

  const handleTrackPointerMove = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (!isSeeking) return
    event.stopPropagation()
    event.preventDefault()
    handleSeekChange(getSeekValueFromPointer(event.clientX))
  }

  const handleTrackPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isSeeking) return
    event.stopPropagation()
    event.preventDefault()
    handleSeekCommit(getSeekValueFromPointer(event.clientX))

    const target = event.currentTarget
    if (target.hasPointerCapture?.(event.pointerId)) {
      target.releasePointerCapture(event.pointerId)
    }
  }

  const handleTrackPointerCancel = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (!isSeeking) return
    event.stopPropagation()
    event.preventDefault()
    handleSeekCommit(getSeekValueFromPointer(event.clientX))
  }

  return (
    <article
      className="relative h-full w-full snap-center overflow-hidden bg-black text-white"
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-black" aria-hidden="true" />

        {shouldLoad ? (
          <video
            ref={videoRef}
            className={`absolute inset-0 z-10 h-full w-full ${
              isLandscape ? "object-contain" : "object-cover"
            }`}
            preload={preloadMode}
            poster={posterUrl || undefined}
            autoPlay={shouldPlay}
            playsInline
            loop
            muted={isMuted}
            controls={false}
            onLoadedMetadata={(event) => {
              const { videoWidth, videoHeight } = event.currentTarget
              const d = event.currentTarget.duration
              if (videoWidth > 0 && videoHeight > 0) {
                setIsLandscape(videoWidth >= videoHeight * 1.15)
              }
              if (Number.isFinite(d) && d > 0) setDuration(d)
              if (
                event.currentTarget.readyState >=
                HTMLMediaElement.HAVE_CURRENT_DATA
              ) {
                syncBuffered()
              }
              currentTimeRef.current = event.currentTarget.currentTime || 0
              syncBuffered()
              renderProgress()
            }}
            onLoadedData={(event) => {
              syncBuffered()
              requestActivePlayback(event.currentTarget)
              scheduleAutoplayRetry()
            }}
            onDurationChange={(event) => {
              const d = event.currentTarget.duration
              if (Number.isFinite(d) && d > 0) setDuration(d)
              renderProgress()
            }}
            onTimeUpdate={(event) => {
              if (isSeeking) return
              currentTimeRef.current = event.currentTarget.currentTime || 0
              renderProgress()
              syncProgressState()
            }}
            onProgress={syncBuffered}
            onCanPlay={(event) => {
              syncBuffered()
              requestActivePlayback(event.currentTarget)
              scheduleAutoplayRetry()
            }}
            onPlaying={() => {
              clearAutoplayRetry()
              syncBuffered()
            }}
            onPause={() => {
              if (shouldPlay) {
                scheduleAutoplayRetry()
              } else {
                clearAutoplayRetry()
              }
            }}
            onWaiting={scheduleAutoplayRetry}
            onStalled={scheduleAutoplayRetry}
          />
        ) : null}

        <div className="absolute inset-0 h-full w-full bg-[#111]" />
      </div>

      <button
        type="button"
        className="absolute inset-0 z-20"
        aria-label={isPaused ? "播放视频" : "暂停视频"}
        onPointerDown={handlePressStart}
        onPointerUp={handlePressEnd}
        onPointerCancel={handlePressCancel}
        onPointerLeave={handlePressCancel}
      />

      <div
        className={`pointer-events-none absolute inset-0 z-30 flex items-center justify-center transition-opacity duration-300 ${
          isPaused ? "opacity-100 scale-100" : "opacity-0 scale-150"
        }`}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/40 backdrop-blur-md">
          <Play size={32} className="ml-1 fill-white text-white opacity-90" />
        </div>
      </div>

      <div
        className={`pointer-events-none absolute left-1/2 top-24 z-30 -translate-x-1/2 transition-all duration-200 ${
          isBoosting ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
        }`}
      >
        <div className="flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 font-semibold tracking-wide backdrop-blur-md">
          <span className="text-lime-400">▶▶</span>
          <span>2x 快进中</span>
        </div>
      </div>

      <div
        className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-32 bg-gradient-to-b from-black/60 to-transparent transition-opacity duration-150 ${
          isCleanMode ? "opacity-0" : "opacity-100"
        }`}
      />
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 h-1/2 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-90 transition-opacity duration-150 ${
          isCleanMode ? "opacity-0" : "opacity-90"
        }`}
      />

      <div className="absolute bottom-12 right-3 z-30 flex flex-col items-center gap-5 pb-4">
        <div
          className={`flex flex-col items-center gap-5 transition-opacity duration-150 ${
            isCleanMode ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
        >
          <div className="relative mb-3 flex flex-col items-center">
            <img
              src={getProxyUrl(item.user.avatar, { w: 96, q: 72 })}
              alt={item.user.nickname}
              className="h-12 w-12 rounded-full border-[1.5px] border-white object-cover shadow-lg"
              loading="lazy"
              decoding="async"
              onError={createImageFallbackHandler(item.user.avatar)}
            />
          </div>

          <button
            onClick={(event) => {
              event.stopPropagation()
              onToggleLike()
            }}
            className="group flex flex-col items-center gap-1.5 drop-shadow-md transition-transform active:scale-90"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/20 backdrop-blur-sm transition group-hover:bg-black/40">
              <Heart
                size={26}
                className={isLiked ? "fill-red-500 text-red-500" : "text-white"}
              />
            </div>
          </button>

          <button
            onClick={(event) => {
              event.stopPropagation()
              onOpenComments()
            }}
            className="group flex flex-col items-center gap-1.5 drop-shadow-md transition-transform active:scale-90"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/20 backdrop-blur-sm transition group-hover:bg-black/40">
              <MessageCircle size={26} className="fill-white/10 text-white" />
            </div>
            <span className="text-[11px] font-bold tracking-wide">
              {formatCount(item.commentCount)}
            </span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleMute()
            }}
            className="group mt-2 flex flex-col items-center gap-1.5 drop-shadow-md transition-transform active:scale-90"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/20 backdrop-blur-sm transition group-hover:bg-black/40">
              {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
            </div>
          </button>
        </div>

        <button
          onClick={(event) => {
            event.stopPropagation()
            onToggleCleanMode()
          }}
          className="group mt-2 flex flex-col items-center gap-1.5 drop-shadow-md transition-transform active:scale-90"
          aria-label={isCleanMode ? "恢复界面" : "清屏"}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/20 backdrop-blur-sm transition group-hover:bg-black/40">
            {isCleanMode ? <Eye size={24} /> : <EyeOff size={24} />}
          </div>
        </button>
      </div>

      <div
        className={`absolute bottom-12 left-4 right-16 z-30 flex flex-col justify-end gap-2.5 pb-4 transition-opacity duration-150 ${
          isCleanMode ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
      >
        <h2 className="text-base font-bold drop-shadow-md">
          @{item.user.nickname}
        </h2>
        {item.description && (
          <p className="line-clamp-3 text-sm leading-relaxed text-white/95 drop-shadow-md">
            {item.description}
          </p>
        )}
        {(item.infoText || item.createdAt) && (
          <div className="flex items-center gap-2 text-[11px] font-medium text-white/80">
            {item.infoText && (
              <span className="rounded bg-white/20 px-1.5 py-0.5 backdrop-blur-sm">
                {item.infoText}
              </span>
            )}
            {item.createdAt && <span>{item.createdAt}</span>}
          </div>
        )}
      </div>

      {/* ==== 核心布局修复：进度条 ====
        1. 预留了 pb-2 (8px)，确保在任何屏幕圆角或容器下，放大的圆形 Thumb 都不会被截断。
        2. h-10 提供极大的防误触区域，方便指腹拖拽。
      */}
      <div
        className={`group/slider absolute inset-x-0 bottom-0 z-40 flex h-10 w-full items-end pb-2 transition-opacity duration-150 ${
          isCleanMode ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
        onPointerDown={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
        onPointerCancel={(event) => event.stopPropagation()}
      >
        <div
          ref={progressTrackRef}
          className="relative h-12 w-full"
          onPointerDown={handleTrackPointerDown}
          onPointerMove={handleTrackPointerMove}
          onPointerUp={handleTrackPointerUp}
          onPointerCancel={handleTrackPointerCancel}
        >
          {/* 背景轨道 */}
          <div
            className={`absolute inset-x-0 bottom-0 rounded-full bg-white/20 transition-all duration-200 ${
              isSeeking ? "h-[6px]" : "h-[2px] group-hover/slider:h-[4px]"
            }`}
          />

          {showProgressLoading ? (
            <div
              className={`pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden rounded-full transition-all duration-200 ${
                isSeeking ? "h-[6px]" : "h-[2px] group-hover/slider:h-[4px]"
              }`}
            >
              <div className="short-video-progress-loading absolute inset-y-0 left-0 w-24 rounded-full" />
            </div>
          ) : null}

          {/* 缓冲轨道 */}
          <div
            ref={bufferedProgressRef}
            className={`absolute bottom-0 left-0 rounded-full bg-white/40 transition-all duration-300 ${
              isSeeking ? "h-[6px]" : "h-[2px] group-hover/slider:h-[4px]"
            }`}
            style={{ width: `${bufferedRatio * 100}%` }}
          />

          {/* 已播放轨道 */}
          <div
            ref={playedProgressRef}
            className={`absolute bottom-0 left-0 rounded-full bg-white/90 shadow-[0_0_10px_rgba(255,255,255,0.28)] ${
              isSeeking ? "h-[6px]" : "h-[2px] group-hover/slider:h-[4px]"
            }`}
            style={{ width: `${playedRatio * 100}%` }}
          />
        </div>
      </div>
    </article>
  )
}

const ShortVideo = ({ mode = "feed" }: { mode?: ShortVideoViewMode }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const initialState = useMemo(() => readState(), [mode])
  const [activeFeed, setActiveFeed] = useState<FeedMode>(
    mode === "feed" && "activeFeed" in initialState
      ? initialState.activeFeed
      : "latest",
  )
  const [activeIndexByFeed, setActiveIndexByFeed] = useState<
    Record<FeedMode, number>
  >(
    mode === "feed" && "activeIndexByFeed" in initialState
      ? initialState.activeIndexByFeed
      : {
          latest: 0,
          recommend: 0,
          random: 0,
        },
  )
  const [loadedPagesByFeed, setLoadedPagesByFeed] = useState<
    Record<FeedMode, number>
  >(
    mode === "feed" && "loadedPagesByFeed" in initialState
      ? initialState.loadedPagesByFeed
      : DEFAULT_STATE.loadedPagesByFeed,
  )
  const [likedItems, setLikedItems] = useState<ShortVideoItem[]>(() =>
    mode === "liked" ? getLikedShortVideos() : [],
  )
  const [likedIds, setLikedIds] = useState<Set<string>>(
    () => new Set(getLikedShortVideos().map((item) => item.id)),
  )
  const [isMuted, setIsMuted] = useState(true)
  const [pausedVideoId, setPausedVideoId] = useState<string | null>(null)
  const [isCleanMode, setIsCleanMode] = useState(false)
  const [commentSheetItem, setCommentSheetItem] =
    useState<ShortVideoItem | null>(null)
  const [randomSeed, setRandomSeed] = useState(() => Date.now())
  const containerRef = useRef<HTMLDivElement | null>(null)
  const prewarmTimerRef = useRef<number | null>(null)
  const isRestoringRef = useRef(false)
  const restoreCompletedRef = useRef<Record<FeedMode, boolean>>({
    latest: false,
    recommend: false,
    random: false,
  })

  const isStandalone = mode === "liked"
  const isPageActive = isStandalone
    ? location.pathname === "/shorts/likes"
    : location.pathname === "/shorts"
  const activeIndexKey: FeedMode = isStandalone ? "latest" : activeFeed

  useEffect(() => {
    const syncLikes = () => {
      const nextItems = getLikedShortVideos()
      setLikedIds(new Set(nextItems.map((item) => item.id)))
      if (isStandalone) {
        setLikedItems(nextItems)
      }
    }

    syncLikes()
    return subscribeShortVideoLikes(syncLikes)
  }, [isStandalone])

  useEffect(() => {
    if (isStandalone) return
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        activeFeed,
        activeIndexByFeed,
        loadedPagesByFeed,
      } satisfies FeedState),
    )
  }, [activeFeed, activeIndexByFeed, isStandalone, loadedPagesByFeed])

  const feedQuery = useInfiniteQuery({
    queryKey: [
      "short-video-feed",
      activeFeed,
      activeFeed === "random" ? randomSeed : 0,
    ],
    initialPageParam: activeFeed === "random" ? 0 : 1,
    queryFn: async ({ pageParam }) => {
      const targetFeed = activeFeed === "recommend" ? "recommend" : "latest"

      if (activeFeed !== "random") {
        return fetchShortVideoFeed(targetFeed, {
          page: Number(pageParam || 1),
          pageSize: FEED_PAGE_SIZE,
        })
      }

      const requestedPage = Number(pageParam || 0)
      if (requestedPage > 0) {
        const response = await fetchShortVideoFeed(targetFeed, {
          page: requestedPage,
          pageSize: FEED_PAGE_SIZE,
        })

        if (response.list.length > 0) return response

        const bootstrap = await fetchShortVideoFeed(targetFeed, {
          page: RANDOM_BOOTSTRAP_PAGE,
          pageSize: 1,
        })
        const maxPage = resolveRandomMaxPage(bootstrap.total, FEED_PAGE_SIZE)
        return fetchNextRandomVideoPage(
          targetFeed,
          maxPage,
          new Set([requestedPage]),
          randomSeed + requestedPage * 97,
        )
      }

      const bootstrap = await fetchShortVideoFeed(targetFeed, {
        page: RANDOM_BOOTSTRAP_PAGE,
        pageSize: 1,
      })
      const maxPage = resolveRandomMaxPage(bootstrap.total, FEED_PAGE_SIZE)
      return fetchNextRandomVideoPage(
        targetFeed,
        maxPage,
        new Set(),
        randomSeed,
      )
    },
    getNextPageParam: (lastPage, allPages) => {
      if (activeFeed !== "random") {
        const loaded = lastPage.page * lastPage.pageSize
        return loaded < lastPage.total ? lastPage.page + 1 : undefined
      }

      const maxPage = resolveRandomMaxPage(lastPage.total, FEED_PAGE_SIZE)
      const seenPages = new Set(allPages.map((page) => page.page))
      return pickRandomUnseenPage(
        maxPage,
        seenPages,
        randomSeed + allPages.length * 97,
      )
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    enabled: !isStandalone,
  })

  const items = isStandalone
    ? likedItems
    : activeFeed === "random"
      ? feedQuery.data?.pages.flatMap((page) =>
          shuffleShortVideos(page.list, randomSeed + page.page * 31),
        ) || []
      : feedQuery.data?.pages.flatMap((page) => page.list) || []
  const loadedPageCount = feedQuery.data?.pages.length || 0
  const activeIndex = Math.min(
    activeIndexByFeed[activeIndexKey] || 0,
    Math.max(items.length - 1, 0),
  )

  useEffect(() => {
    if (!items.length) return
    if (prewarmTimerRef.current != null) {
      window.clearTimeout(prewarmTimerRef.current)
      prewarmTimerRef.current = null
    }

    const candidates = items.slice(
      activeIndex,
      Math.min(items.length, activeIndex + MEDIA_AUTO_PRELOAD_AHEAD + 1),
    )
    candidates.forEach((item) => {
      ensureVideoOriginPreconnect(item.file.resourceURL)
    })

    prewarmTimerRef.current = window.setTimeout(() => {
      prewarmTimerRef.current = null
      for (
        let index = activeIndex + 1;
        index <
        Math.min(items.length, activeIndex + VIDEO_PREWARM_AHEAD_COUNT + 1);
        index += 1
      ) {
        ensureVideoOriginPreconnect(items[index]?.file.resourceURL)
        prewarmVideoBytes(items[index]?.file.resourceURL)
      }
    }, VIDEO_PREWARM_DELAY_MS)

    return () => {
      if (prewarmTimerRef.current != null) {
        window.clearTimeout(prewarmTimerRef.current)
        prewarmTimerRef.current = null
      }
    }
  }, [activeIndex, items])

  useEffect(() => {
    if (isStandalone || !loadedPageCount) return
    setLoadedPagesByFeed((current) =>
      current[activeFeed] === loadedPageCount
        ? current
        : { ...current, [activeFeed]: loadedPageCount },
    )
  }, [activeFeed, isStandalone, loadedPageCount])

  useEffect(() => {
    if (isStandalone || !items.length) return
    if (
      activeIndex >= items.length - 2 &&
      feedQuery.hasNextPage &&
      !feedQuery.isFetchingNextPage
    ) {
      feedQuery.fetchNextPage()
    }
  }, [
    activeIndex,
    feedQuery.fetchNextPage,
    feedQuery.hasNextPage,
    feedQuery.isFetchingNextPage,
    isStandalone,
    items.length,
  ])

  useEffect(() => {
    if (!items.length) return
    const container = containerRef.current
    if (!container) return

    if (!isStandalone && restoreCompletedRef.current[activeFeed]) return

    const savedIndex = activeIndexByFeed[activeIndexKey] || 0
    const requiredItemCount = Math.max(savedIndex + 1, 1)
    const savedPageCount = Math.max(
      loadedPagesByFeed[activeIndexKey] || 1,
      Math.ceil(requiredItemCount / FEED_PAGE_SIZE),
    )
    const requiredLoadedCount = Math.max(
      requiredItemCount,
      savedPageCount * FEED_PAGE_SIZE,
    )

    if (
      !isStandalone &&
      items.length < requiredLoadedCount &&
      feedQuery.hasNextPage &&
      !feedQuery.isFetchingNextPage
    ) {
      feedQuery.fetchNextPage()
      return
    }

    const nextIndex = Math.min(savedIndex, Math.max(items.length - 1, 0))

    isRestoringRef.current = true
    window.requestAnimationFrame(() => {
      container.scrollTo({
        top: container.clientHeight * nextIndex,
        behavior: "auto",
      })

      window.setTimeout(() => {
        if (!isStandalone) {
          restoreCompletedRef.current[activeFeed] = true
        }
        isRestoringRef.current = false
      }, 120)
    })
  }, [
    activeFeed,
    activeIndexByFeed,
    activeIndexKey,
    feedQuery,
    isStandalone,
    items.length,
    loadedPagesByFeed,
  ])

  useEffect(() => {
    if (!isStandalone) return
    setActiveIndexByFeed((current) => {
      const nextIndex = Math.min(
        current.latest || 0,
        Math.max(items.length - 1, 0),
      )
      return current.latest === nextIndex
        ? current
        : { ...current, latest: nextIndex }
    })
  }, [isStandalone, items.length])

  useEffect(() => {
    const container = containerRef.current
    if (!container || items.length === 0) return

    const slideNodes = Array.from(
      container.querySelectorAll<HTMLElement>("[data-short-video-index]"),
    )
    if (slideNodes.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        let nextIndex: number | null = null
        let bestRatio = 0

        for (const entry of entries) {
          const ratio = entry.intersectionRatio
          if (!entry.isIntersecting || ratio < 0.45 || ratio < bestRatio)
            continue
          bestRatio = ratio
          nextIndex = Number(
            (entry.target as HTMLElement).dataset.shortVideoIndex || 0,
          )
        }

        if (nextIndex == null || isRestoringRef.current) return

        setActiveIndexByFeed((current) =>
          current[activeIndexKey] === nextIndex
            ? current
            : { ...current, [activeIndexKey]: nextIndex },
        )
        setPausedVideoId((current) =>
          current && current !== items[nextIndex]?.id ? null : current,
        )
      },
      {
        root: container,
        threshold: [0.45, 0.6, 0.8],
      },
    )

    slideNodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [activeIndexKey, items])

  const refreshRandomFeed = () => {
    restoreCompletedRef.current.random = false
    isRestoringRef.current = false
    setPausedVideoId(null)
    setCommentSheetItem(null)
    setActiveIndexByFeed((current) => ({ ...current, random: 0 }))
    setLoadedPagesByFeed((current) => ({ ...current, random: 1 }))
    setRandomSeed(Date.now())
  }

  const handleFeedChange = (feed: FeedMode) => {
    if (isStandalone) return
    if (feed === activeFeed) {
      if (feed === "random") {
        refreshRandomFeed()
      }
      return
    }
    restoreCompletedRef.current[feed] = false
    isRestoringRef.current = false
    setPausedVideoId(null)
    setCommentSheetItem(null)
    setActiveFeed(feed)
    if (
      feed === "random" &&
      !queryClient.getQueryData(["short-video-feed", "random", randomSeed])
    ) {
      refreshRandomFeed()
    }
  }

  const handleTogglePaused = (itemId: string) => {
    setPausedVideoId((current) => (current === itemId ? null : itemId))
  }

  const handleToggleLike = (item: ShortVideoItem) => {
    const nextLiked = toggleLikedShortVideo({
      ...item,
      isLiked: !likedIds.has(item.id),
    })

    setLikedIds((current) => {
      const next = new Set(current)
      if (nextLiked) next.add(item.id)
      else next.delete(item.id)
      return next
    })

    if (isStandalone && !nextLiked) {
      setLikedItems((current) =>
        current.filter((likedItem) => likedItem.id !== item.id),
      )
      setCommentSheetItem((current) =>
        current?.id === item.id ? null : current,
      )
      setPausedVideoId((current) => (current === item.id ? null : current))
    }
  }

  return (
    <div
      className="fixed inset-x-0 top-0 z-40 bg-black text-white"
      style={{
        bottom: isStandalone
          ? "0"
          : "calc(var(--bottom-nav-height, 4rem) + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <SEO
        title={isStandalone ? "短视频" : "短视频"}
        description={
          isStandalone
            ? "浏览本地保存的喜欢短视频。"
            : "短视频沉浸式滑动浏览，支持最新与推荐切换。"
        }
      />

      {isStandalone ? (
        <header className="pointer-events-none absolute inset-x-0 top-0 z-50 px-4 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
          <div className="pointer-events-auto flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md active:scale-95"
              aria-label="返回"
            >
              <ChevronLeft size={22} />
            </button>
            <div className="rounded-full bg-black/25 px-4 py-2 text-sm font-semibold text-white/90 backdrop-blur-md"></div>
            <div className="w-10" />
          </div>
        </header>
      ) : (
        <header className="pointer-events-none absolute inset-x-0 top-0 z-50 px-4 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
          <div className="pointer-events-auto mx-auto flex max-w-sm items-center justify-center gap-6">
            {FEED_TABS.map((tab) => {
              const active = tab.key === activeFeed
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => handleFeedChange(tab.key)}
                  className={`relative flex items-center justify-center gap-1 py-2 text-[17px] transition-all ${
                    active
                      ? "font-bold text-white drop-shadow-md scale-105"
                      : "font-semibold text-white/60 hover:text-white/80"
                  }`}
                >
                  {tab.key === "recommend" && active ? (
                    <Flame size={16} className="text-lime-400" />
                  ) : tab.key === "random" && active ? (
                    <Shuffle size={15} className="text-lime-400" />
                  ) : null}
                  {tab.label}
                  {active && (
                    <span className="absolute bottom-0 left-1/2 h-[3px] w-6 -translate-x-1/2 rounded-full bg-lime-400 drop-shadow-[0_0_8px_rgba(163,230,53,0.8)]" />
                  )}
                </button>
              )
            })}
          </div>
        </header>
      )}

      {!isStandalone && feedQuery.isLoading && items.length === 0 ? (
        <div className="flex h-full items-center justify-center bg-black">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={32} className="animate-spin text-white/40" />
            <span className="text-sm font-medium text-white/40 tracking-widest">
              推荐引擎启动中
            </span>
          </div>
        </div>
      ) : null}

      {!isStandalone && feedQuery.isError && items.length === 0 ? (
        <div className="flex h-full items-center justify-center bg-black px-6">
          <div className="w-full max-w-sm flex flex-col items-center text-center">
            <p className="text-lg font-bold text-white/90">加载失败</p>
            <p className="mt-2 text-sm text-white/50">
              网络有些颠簸，没能拉取到最新的视频
            </p>
            <button
              type="button"
              onClick={() => feedQuery.refetch()}
              className="mt-6 flex items-center gap-2 rounded-full bg-white/10 px-6 py-2.5 text-sm font-bold text-white backdrop-blur-md active:scale-95"
            >
              <RefreshCw size={16} />
              点击重试
            </button>
          </div>
        </div>
      ) : null}

      {(isStandalone || (!feedQuery.isLoading && !feedQuery.isError)) && (
        <div
          ref={containerRef}
          className="h-full w-full snap-y snap-mandatory overflow-y-auto no-scrollbar"
        >
          {items.map((item, index) => {
            const isActive = index === activeIndex
            const shouldLoad =
              index >= activeIndex - MEDIA_PRELOAD_BEHIND &&
              index <= activeIndex + MEDIA_PRELOAD_AHEAD
            const preloadMode =
              index <= activeIndex + MEDIA_AUTO_PRELOAD_AHEAD &&
              index >= activeIndex - MEDIA_PRELOAD_BEHIND
                ? "auto"
                : "metadata"
            return (
              <div
                key={item.id}
                data-short-video-index={index}
                className="h-full w-full snap-center snap-always"
              >
                <ShortVideoSlide
                  item={item}
                  isActive={isActive}
                  isPageActive={isPageActive}
                  shouldLoad={shouldLoad}
                  preloadMode={preloadMode}
                  isLiked={likedIds.has(item.id)}
                  isMuted={isMuted}
                  isPaused={pausedVideoId === item.id}
                  isCleanMode={isCleanMode}
                  onToggleLike={() => handleToggleLike(item)}
                  onToggleMute={() => setIsMuted((current) => !current)}
                  onTogglePaused={() => handleTogglePaused(item.id)}
                  onToggleCleanMode={() =>
                    setIsCleanMode((current) => !current)
                  }
                  onOpenComments={() => setCommentSheetItem(item)}
                />
              </div>
            )
          })}

          {!isStandalone && feedQuery.isFetchingNextPage ? (
            <div className="flex h-20 items-center justify-center bg-black">
              <Loader2 size={24} className="animate-spin text-white/50" />
            </div>
          ) : null}
        </div>
      )}

      {((!isStandalone && !feedQuery.isLoading && !feedQuery.isError) ||
        isStandalone) &&
      items.length === 0 ? (
        <div className="flex h-full items-center justify-center bg-black px-6">
          <div className="text-center">
            <span className="text-white/40 tracking-widest text-sm">
              {isStandalone ? "还没有喜欢的短视频" : "暂无更多内容"}
            </span>
            {isStandalone ? (
              <p className="mt-3 text-xs text-white/30">
                在短视频流里点击右侧爱心，这里会自动收集
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <CommentSheet
        open={Boolean(commentSheetItem)}
        item={commentSheetItem}
        onClose={() => setCommentSheetItem(null)}
      />
    </div>
  )
}

export default ShortVideo
