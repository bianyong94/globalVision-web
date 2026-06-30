import React, { useEffect, useMemo, useRef, useState } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"
import { useLocation } from "react-router-dom"
import {
  Flame,
  Heart,
  Loader2,
  MessageCircle,
  Pause,
  Play,
  RefreshCw,
  Volume2,
  VolumeX,
} from "lucide-react"
import SEO from "../components/SEO"
import { fetchShortVideoFeed } from "../services/api"
import { ShortVideoItem } from "../types"
import {
  createImageFallbackHandler,
  getProxyUrl,
  normalizeMediaUrl,
} from "../utils/common"

const FEED_PAGE_SIZE = 5
const STORAGE_KEY = "vastren.short-video.v1"

type FeedMode = "latest" | "recommend"

type FeedState = {
  activeFeed: FeedMode
  activeIndexByFeed: Record<FeedMode, number>
}

const DEFAULT_STATE: FeedState = {
  activeFeed: "latest",
  activeIndexByFeed: {
    latest: 0,
    recommend: 0,
  },
}

const readState = (): FeedState => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_STATE
    const parsed = JSON.parse(raw) as Partial<FeedState>
    return {
      activeFeed:
        parsed.activeFeed === "recommend" ? "recommend" : DEFAULT_STATE.activeFeed,
      activeIndexByFeed: {
        latest:
          typeof parsed.activeIndexByFeed?.latest === "number"
            ? parsed.activeIndexByFeed.latest
            : 0,
        recommend:
          typeof parsed.activeIndexByFeed?.recommend === "number"
            ? parsed.activeIndexByFeed.recommend
            : 0,
      },
    }
  } catch {
    return DEFAULT_STATE
  }
}

const FEED_TABS: Array<{ key: FeedMode; label: string }> = [
  { key: "latest", label: "最新" },
  { key: "recommend", label: "推荐" },
]

const formatCount = (value?: string) => {
  if (!value) return "0"
  const normalized = value.trim()
  if (!normalized) return "0"
  return normalized
}

const formatDuration = (value?: number) => {
  if (!value || !Number.isFinite(value)) return ""
  const minutes = Math.floor(value / 60)
  const seconds = value % 60
  if (minutes <= 0) return `${seconds}s`
  return `${minutes}:${String(seconds).padStart(2, "0")}`
}

const ShortVideoSlide = ({
  item,
  isActive,
  isPageActive,
  shouldLoad,
  isMuted,
  isPaused,
  onToggleMute,
  onTogglePaused,
}: {
  item: ShortVideoItem
  isActive: boolean
  isPageActive: boolean
  shouldLoad: boolean
  isMuted: boolean
  isPaused: boolean
  onToggleMute: () => void
  onTogglePaused: () => void
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const shouldPlay = isPageActive && isActive && !isPaused
  const poster = getProxyUrl(item.file.thumbnail, { w: 720, q: 72 })

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    video.muted = isMuted
  }, [isMuted])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (!shouldPlay) {
      video.pause()
      return
    }

    const playPromise = video.play()
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => undefined)
    }
  }, [shouldPlay])

  return (
    <article className="relative h-[100dvh] w-full snap-start overflow-hidden bg-black text-white">
      <div className="absolute inset-0">
        {poster ? (
          <img
            src={poster}
            alt=""
            className="h-full w-full scale-110 object-cover opacity-40 blur-2xl"
            loading="lazy"
            decoding="async"
            onError={createImageFallbackHandler(item.file.thumbnail)}
          />
        ) : (
          <div className="h-full w-full bg-black" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/75" />
      </div>

      <div className="relative flex h-full w-full items-center justify-center">
        {shouldLoad ? (
          <video
            ref={videoRef}
            className="h-full w-full object-contain"
            src={normalizeMediaUrl(item.file.resourceURL)}
            poster={poster}
            preload={isActive ? "auto" : "metadata"}
            playsInline
            loop
            muted={isMuted}
            controls={false}
          />
        ) : poster ? (
          <img
            src={poster}
            alt={item.description || item.user.nickname}
            className="h-full w-full object-contain"
            loading="lazy"
            decoding="async"
            onError={createImageFallbackHandler(item.file.thumbnail)}
          />
        ) : (
          <div className="h-full w-full bg-black" />
        )}

        <button
          type="button"
          onClick={onTogglePaused}
          className="absolute inset-0"
          aria-label={isPaused ? "播放视频" : "暂停视频"}
        />

        {isPaused && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rounded-full bg-black/40 p-5 backdrop-blur-xl">
              <Play size={28} className="fill-white text-white" />
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/55 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/85 via-black/45 to-transparent" />

        <div className="absolute right-3 bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] z-10 flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={onToggleMute}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md transition active:scale-95"
            aria-label={isMuted ? "打开声音" : "静音"}
          >
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>

          <div className="flex flex-col items-center gap-1 text-white">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/35 backdrop-blur-md">
              <Heart size={20} className={item.isLiked ? "fill-red-500 text-red-500" : ""} />
            </div>
            <span className="text-[11px] font-medium">{formatCount(item.likeCount)}</span>
          </div>

          <div className="flex flex-col items-center gap-1 text-white">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/35 backdrop-blur-md">
              <MessageCircle size={20} />
            </div>
            <span className="text-[11px] font-medium">{formatCount(item.commentCount)}</span>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] z-10 px-4">
          <div className="flex max-w-[calc(100%-4.5rem)] items-center gap-3">
            <img
              src={getProxyUrl(item.user.avatar, { w: 96, q: 72 })}
              alt={item.user.nickname}
              className="h-11 w-11 rounded-full border border-white/20 object-cover"
              loading="lazy"
              decoding="async"
              onError={createImageFallbackHandler(item.user.avatar)}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold">@{item.user.nickname}</p>
                {item.infoText ? (
                  <span className="rounded-full border border-lime-400/25 bg-lime-400/10 px-2 py-0.5 text-[10px] font-semibold text-lime-300">
                    {item.infoText}
                  </span>
                ) : null}
                {item.file.duration ? (
                  <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/75">
                    {formatDuration(item.file.duration)}
                  </span>
                ) : null}
              </div>
              {item.description ? (
                <p className="mt-2 line-clamp-4 text-sm leading-6 text-white/88">
                  {item.description}
                </p>
              ) : (
                <p className="mt-2 text-sm text-white/55">暂无文案</p>
              )}
              {item.createdAt ? (
                <p className="mt-2 text-xs text-white/45">{item.createdAt}</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

const ShortVideo = () => {
  const location = useLocation()
  const initialState = useMemo(readState, [])
  const [activeFeed, setActiveFeed] = useState<FeedMode>(initialState.activeFeed)
  const [activeIndexByFeed, setActiveIndexByFeed] = useState<Record<FeedMode, number>>(
    initialState.activeIndexByFeed,
  )
  const [isMuted, setIsMuted] = useState(true)
  const [pausedVideoId, setPausedVideoId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const restoredFeedRef = useRef<FeedMode | null>(null)

  const isPageActive = location.pathname === "/shorts"

  useEffect(() => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ activeFeed, activeIndexByFeed } satisfies FeedState),
    )
  }, [activeFeed, activeIndexByFeed])

  const feedQuery = useInfiniteQuery({
    queryKey: ["short-video-feed", activeFeed],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) =>
      fetchShortVideoFeed(activeFeed, {
        page: Number(pageParam || 1),
        pageSize: FEED_PAGE_SIZE,
      }),
    getNextPageParam: (lastPage) => {
      const loaded = lastPage.page * lastPage.pageSize
      return loaded < lastPage.total ? lastPage.page + 1 : undefined
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })

  const items = feedQuery.data?.pages.flatMap((page) => page.list) || []
  const activeIndex = Math.min(
    activeIndexByFeed[activeFeed] || 0,
    Math.max(items.length - 1, 0),
  )

  useEffect(() => {
    if (!items.length) return
    if (activeIndex >= items.length - 2 && feedQuery.hasNextPage && !feedQuery.isFetchingNextPage) {
      feedQuery.fetchNextPage()
    }
  }, [
    activeIndex,
    items.length,
    feedQuery.hasNextPage,
    feedQuery.isFetchingNextPage,
    feedQuery.fetchNextPage,
  ])

  useEffect(() => {
    if (!items.length) return
    if (restoredFeedRef.current === activeFeed) return

    restoredFeedRef.current = activeFeed
    const container = containerRef.current
    if (!container) return

    const nextIndex = Math.min(
      activeIndexByFeed[activeFeed] || 0,
      Math.max(items.length - 1, 0),
    )

    window.requestAnimationFrame(() => {
      container.scrollTo({
        top: container.clientHeight * nextIndex,
        behavior: "auto",
      })
    })
  }, [activeFeed, activeIndexByFeed, items.length])

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
          if (!entry.isIntersecting || ratio < 0.6 || ratio < bestRatio) continue
          bestRatio = ratio
          nextIndex = Number(
            (entry.target as HTMLElement).dataset.shortVideoIndex || 0,
          )
        }

        if (nextIndex == null) return

        setActiveIndexByFeed((current) =>
          current[activeFeed] === nextIndex
            ? current
            : { ...current, [activeFeed]: nextIndex },
        )
        setPausedVideoId((current) =>
          current && current !== items[nextIndex]?.id ? null : current,
        )
      },
      {
        root: container,
        threshold: [0.6, 0.75, 0.95],
      },
    )

    slideNodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [activeFeed, items])

  const handleFeedChange = (feed: FeedMode) => {
    if (feed === activeFeed) return
    restoredFeedRef.current = null
    setPausedVideoId(null)
    setActiveFeed(feed)
  }

  const handleTogglePaused = (itemId: string) => {
    setPausedVideoId((current) => (current === itemId ? null : itemId))
  }

  return (
    <div className="fixed inset-0 bg-black text-white">
      <SEO title="短视频" description="短视频沉浸式滑动浏览，支持最新与推荐切换。" />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <div className="pointer-events-auto mx-auto flex max-w-sm items-center justify-center gap-2 rounded-full border border-white/10 bg-black/30 p-1 backdrop-blur-xl">
          {FEED_TABS.map((tab) => {
            const active = tab.key === activeFeed
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleFeedChange(tab.key)}
                className={
                  active
                    ? "flex min-w-[6.5rem] items-center justify-center gap-1 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black"
                    : "flex min-w-[6.5rem] items-center justify-center gap-1 rounded-full px-4 py-2 text-sm font-medium text-white/65"
                }
              >
                {tab.key === "recommend" ? <Flame size={15} /> : null}
                {tab.label}
              </button>
            )
          })}
        </div>
      </header>

      {feedQuery.isLoading && items.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm text-white/75 backdrop-blur-xl">
            <Loader2 size={18} className="animate-spin" />
            正在加载短视频
          </div>
        </div>
      ) : null}

      {feedQuery.isError && items.length === 0 ? (
        <div className="flex h-full items-center justify-center px-6">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-xl">
            <p className="text-base font-semibold">短视频加载失败</p>
            <p className="mt-2 text-sm text-white/55">
              当前数据没有正常返回，请重试。
            </p>
            <button
              type="button"
              onClick={() => feedQuery.refetch()}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black"
            >
              <RefreshCw size={15} />
              重新加载
            </button>
          </div>
        </div>
      ) : null}

      {!feedQuery.isLoading && !feedQuery.isError ? (
        <div
          ref={containerRef}
          className="h-full snap-y snap-mandatory overflow-y-auto overscroll-y-contain"
        >
          {items.map((item, index) => {
            const isActive = index === activeIndex
            return (
              <div key={item.id} data-short-video-index={index}>
                <ShortVideoSlide
                  item={item}
                  isActive={isActive}
                  isPageActive={isPageActive}
                  shouldLoad={Math.abs(index - activeIndex) <= 2}
                  isMuted={isMuted}
                  isPaused={pausedVideoId === item.id}
                  onToggleMute={() => setIsMuted((current) => !current)}
                  onTogglePaused={() => handleTogglePaused(item.id)}
                />
              </div>
            )
          })}

          {feedQuery.isFetchingNextPage ? (
            <div className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/30 p-3 backdrop-blur-lg">
              <Loader2 size={18} className="animate-spin text-white" />
            </div>
          ) : null}
        </div>
      ) : null}

      {!feedQuery.isLoading && !feedQuery.isError && items.length === 0 ? (
        <div className="flex h-full items-center justify-center px-6">
          <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-5 text-center text-white/65 backdrop-blur-xl">
            当前分区暂无短视频内容
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default ShortVideo
