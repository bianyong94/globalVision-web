import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  ChevronRight,
  Clock3,
  MessageCircle,
  PlayCircle,
  RefreshCw,
  ShieldAlert,
  SkipForward,
  Star,
  Tv2,
} from "lucide-react"
import SEO from "../components/SEO"
import Player from "../components/Player"
import {
  fetchMovieComments,
  fetchMovieDetail,
  fetchMovieEpisodes,
  fetchScreenMovies,
  parseMovieEpisodeUrl,
} from "../services/api"
import { getProxyUrl } from "../utils/common"
import { MovieEpisodeItem, MovieListItem } from "../types"

const looksLikeMediaUrl = (value: string) =>
  /\.(m3u8|mp4|flv|mkv)(?:$|[?#])/i.test(value) || value.startsWith("blob:")

const isPlayableUrl = (value: string) => {
  const normalized = value.trim()
  if (!normalized || normalized.startsWith("parse_")) return false
  if (looksLikeMediaUrl(normalized)) return true
  return normalized.startsWith("http://") || normalized.startsWith("https://")
}

const Detail = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [activeSourceCode, setActiveSourceCode] = useState("")
  const [activeEpisodeIndex, setActiveEpisodeIndex] = useState(0)
  const [resolvedPlayUrl, setResolvedPlayUrl] = useState("")
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
  const [playbackError, setPlaybackError] = useState("")
  const [failedSourceCodes, setFailedSourceCodes] = useState<string[]>([])
  const manualSourceSelectionRef = useRef(false)

  const detailQuery = useQuery({
    queryKey: ["movie-detail", id],
    queryFn: () => fetchMovieDetail(id || ""),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  })

  const detail = detailQuery.data

  useEffect(() => {
    manualSourceSelectionRef.current = false
  }, [detail?.id])

  const resolveEpisodeUrl = useCallback(
    async (episode: MovieEpisodeItem | undefined) => {
      if (!episode?.play_url) return ""

      const rawUrl = episode.play_url.trim()
      const preferredUrl = episode.parseUrl?.trim() || ""

      if (preferredUrl && looksLikeMediaUrl(preferredUrl)) {
        return preferredUrl
      }

      if (rawUrl.startsWith("parse_")) {
        try {
          const response = await parseMovieEpisodeUrl({
            episode_id: episode.episode_id,
            from_code: episode.from_code,
            play_url: rawUrl,
            refresh: 1,
          })
          const errorCode = Number(response?.errorCode ?? response?.code ?? 0)
          const message = String(
            response?.msg || response?.message || response?.error || "",
          )
          if (
            errorCode === 1015 ||
            message.includes("无需解析") ||
            message.includes("无需")
          ) {
            return preferredUrl || rawUrl
          }

          const candidate =
            response?.data?.play_url ||
            response?.data?.download_url ||
            response?.data?.data?.play_url ||
            response?.data?.url ||
            response?.play_url ||
            response?.url

          if (candidate) {
            return String(candidate).trim()
          }

          return preferredUrl || rawUrl
        } catch {
          return preferredUrl || rawUrl
        }
      }

      if (looksLikeMediaUrl(rawUrl) || rawUrl.startsWith("http")) {
        return rawUrl
      }

      return preferredUrl || rawUrl
    },
    [],
  )

  const playbackDiscoveryQuery = useQuery({
    queryKey: ["movie-playback-discovery", detail?.id],
    queryFn: async () => {
      if (!detail?.id || !detail?.play_from?.length) return null

      for (const [sourceIndex, source] of detail.play_from.entries()) {
        const episodeList = await fetchMovieEpisodes(
          detail.id,
          source.code,
        ).catch(() => [])
        if (episodeList.length === 0) continue

        const limit = Math.min(episodeList.length, 6)
        for (let episodeIndex = 0; episodeIndex < limit; episodeIndex += 1) {
          const resolved = await resolveEpisodeUrl(episodeList[episodeIndex])
          if (resolved) {
            return {
              sourceCode: source.code,
              sourceIndex,
              episodeIndex,
              resolvedPlayUrl: resolved,
            }
          }
        }
      }

      return null
    },
    enabled: !!detail?.id && !!detail?.play_from?.length,
    staleTime: 1000 * 60 * 30,
  })

  useEffect(() => {
    if (!detail?.play_from?.length || playbackDiscoveryQuery.isLoading) return
    if (manualSourceSelectionRef.current) return
    const candidate = playbackDiscoveryQuery.data
    if (!candidate) return
    setActiveSourceCode(candidate.sourceCode)
    setActiveEpisodeIndex(candidate.episodeIndex)
    setResolvedPlayUrl(candidate.resolvedPlayUrl)
    setFailedSourceCodes([])
    setPlaybackError("")
  }, [
    detail?.id,
    playbackDiscoveryQuery.data,
    playbackDiscoveryQuery.isLoading,
  ])

  const activeSource = useMemo(
    () =>
      detail?.play_from?.find((item) => item.code === activeSourceCode) ||
      detail?.play_from?.[0],
    [detail?.play_from, activeSourceCode],
  )

  const episodesQuery = useQuery({
    queryKey: ["movie-episodes", detail?.id, activeSource?.code],
    queryFn: async (): Promise<MovieEpisodeItem[]> => {
      if (!detail?.id || !activeSource?.code) return []
      if (Array.isArray(activeSource.list) && activeSource.list.length > 0) {
        return activeSource.list
      }
      return fetchMovieEpisodes(detail.id, activeSource.code)
    },
    enabled: !!detail?.id && !!activeSource?.code,
    staleTime: 1000 * 60 * 5,
  })

  const commentsQuery = useQuery({
    queryKey: ["movie-comments", detail?.id],
    queryFn: () => fetchMovieComments(detail?.id || ""),
    enabled: !!detail?.id,
    staleTime: 1000 * 30,
  })

  const relatedQuery = useQuery({
    queryKey: ["movie-related", detail?.type_id],
    queryFn: () =>
      fetchScreenMovies({
        type_id: detail?.type_id || 0,
        page: 1,
        pageSize: 12,
      }),
    enabled: !!detail?.type_id,
    staleTime: 1000 * 60 * 5,
  })

  const episodes = episodesQuery.data || []
  const activeEpisode = episodes[activeEpisodeIndex]

  const handlePlayerError = useCallback(async () => {
    if (!detail?.play_from?.length || !detail?.id) {
      setPlaybackError("当前播放源不可用")
      return
    }

    const currentSourceIndex = Math.max(
      detail.play_from.findIndex(
        (source) => source.code === activeSource?.code,
      ),
      0,
    )
    const orderedSources = [
      ...detail.play_from.slice(currentSourceIndex + 1),
      ...detail.play_from.slice(0, currentSourceIndex),
    ].filter((source) => !failedSourceCodes.includes(source.code))

    for (const source of orderedSources) {
      const sourceEpisodes =
        source.list && source.list.length > 0
          ? source.list
          : await fetchMovieEpisodes(detail.id, source.code).catch(() => [])

      if (sourceEpisodes.length === 0) {
        continue
      }

      const candidate = await resolveEpisodeUrl(sourceEpisodes[0])
      if (!candidate) {
        setFailedSourceCodes((prev) =>
          prev.includes(source.code) ? prev : [...prev, source.code],
        )
        continue
      }

      setActiveSourceCode(source.code)
      setActiveEpisodeIndex(0)
      setResolvedPlayUrl(candidate)
      setPlaybackError("")
      return
    }

    setPlaybackError("当前线路播放失败，已自动尝试其它线路")
  }, [
    activeSource?.code,
    detail?.id,
    detail?.play_from,
    failedSourceCodes,
    resolveEpisodeUrl,
  ])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!detail || !activeEpisode?.play_url) return

      const resolved = await resolveEpisodeUrl(activeEpisode)
      if (cancelled) return

      if (resolved) {
        setResolvedPlayUrl(resolved)
        setPlaybackError("")
        return
      }

      void handlePlayerError()
    }

    run()
    return () => {
      cancelled = true
    }
  }, [
    activeEpisode?.episode_id,
    activeEpisode?.from_code,
    activeEpisode?.play_url,
    detail,
    handlePlayerError,
    resolveEpisodeUrl,
  ])

  const playerUrl = useMemo(
    () => (isPlayableUrl(resolvedPlayUrl) ? resolvedPlayUrl : ""),
    [resolvedPlayUrl],
  )

  const relatedItems =
    relatedQuery.data?.list?.filter((item) => item.id !== detail?.id) || []
  const comments = commentsQuery.data?.list || []

  const safeDescription = useMemo(() => {
    if (!detail?.content) return "暂无简介"
    return detail.content.replace(/<[^>]+>/g, "")
  }, [detail?.content])

  // 原代码逻辑未实现 openRelated 方法，但包含在 JSX 中，此处保持原逻辑不做破坏性改动
  const openRelated = (item: MovieListItem) => {
    navigate(`/detail/${item.id}`)
  }

  if (detailQuery.isLoading && !detail) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#08090f] text-white">
        <RefreshCw className="h-8 w-8 animate-spin text-lime-400" />
      </div>
    )
  }

  if (detailQuery.isError || !detail) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#08090f] px-6 text-white">
        <ShieldAlert className="h-12 w-12 text-red-400" />
        <p className="text-center text-sm text-white/50 max-w-xs leading-relaxed">
          影视详情加载失败，该资源可能不存在或服务繁忙。
        </p>
        <button
          onClick={() => navigate(-1)}
          className="rounded-full bg-lime-400 px-5 py-2 text-xs font-bold text-black shadow-lg"
        >
          返回上一页
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(132,204,22,0.06),_transparent_40%),linear-gradient(180deg,#0d1121_0%,#08090f_30%,#08090f_100%)] text-white antialiased">
      <SEO
        title={detail.name}
        description={safeDescription.slice(0, 150)}
        image={detail.cover}
      />

      <section className="shrink-0 border-b border-white/5 bg-[#08090f]/95 backdrop-blur-xl">
        <div className="relative w-full overflow-hidden">
          <img
            src={getProxyUrl(detail.cover)}
            alt={detail.name}
            className="absolute inset-0 h-full w-full object-cover blur-3xl scale-125 opacity-20 pointer-events-none"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#08090f]/10 via-[#08090f]/80 to-[#08090f]" />

          <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-4 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-4 w-full box-border">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex h-9 w-fit items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 text-xs font-medium text-white/80 backdrop-blur-md transition active:scale-95"
            >
              <ArrowLeft size={14} />
              返回
            </button>

            <div className="flex flex-wrap items-center gap-1.5 w-full">
              <span className="rounded bg-lime-400 px-2 py-0.5 text-[10px] font-bold text-black uppercase tracking-wider shrink-0">
                {detail.type_name || "影音"}
              </span>
              {detail.year && (
                <span className="rounded bg-white/5 border border-white/5 px-2 py-0.5 text-[11px] text-white/60 shrink-0">
                  {detail.year}
                </span>
              )}
              {detail.score && (
                <span className="inline-flex items-center gap-1 rounded bg-white/5 border border-white/5 px-2 py-0.5 text-[11px] font-semibold text-lime-300 shrink-0">
                  <Star size={11} className="fill-lime-300 text-lime-300" />
                  {detail.score}
                </span>
              )}
              {detail.area && (
                <span className="rounded bg-white/5 border border-white/5 px-2 py-0.5 text-[11px] text-white/60 shrink-0">
                  {detail.area}
                </span>
              )}
            </div>

            <h1 className="text-2xl font-black tracking-tight sm:text-4xl lg:text-5xl break-words w-full">
              {detail.name}
            </h1>
          </div>

          <div className="relative z-10 w-full bg-black">
            <div className="aspect-video w-full bg-[#040508] relative">
              {playerUrl ? (
                <Player
                  url={playerUrl}
                  poster={detail.cover}
                  onError={() => {
                    void handlePlayerError()
                  }}
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <LoaderState />
                </div>
              )}
            </div>
            {playbackError && (
              <div className="mx-auto max-w-6xl px-4">
                <div className="border-t border-white/5 bg-red-950/20 px-4 py-2.5 text-xs text-red-300 font-medium tracking-wide break-words w-full box-border">
                  {playbackError}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto mt-6 max-w-6xl px-4 space-y-6 w-full box-border min-w-0 pb-32">
          <section className="grid gap-3 md:grid-cols-[1fr_auto] w-full min-w-0">
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 backdrop-blur-md flex flex-col justify-between min-w-0 w-full box-border">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-white/40 uppercase">
                <PlayCircle size={13} className="text-lime-400" />
                <span>剧情简介</span>
              </div>
              <p className="text-xs leading-relaxed text-white/60 break-words">
                {isDescriptionExpanded
                  ? safeDescription
                  : `${safeDescription.slice(0, 150)}${safeDescription.length > 150 ? "..." : ""}`}
              </p>
              {safeDescription.length > 150 && (
                <button
                  onClick={() => setIsDescriptionExpanded((prev) => !prev)}
                  className="mt-2 text-[11px] font-bold text-lime-400 text-left hover:underline"
                >
                  {isDescriptionExpanded ? "收起简介" : "查看全部简介"}
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-1 gap-2 self-start rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-xs text-white/60 backdrop-blur-md w-full md:w-48 box-border min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <Clock3 size={13} className="text-lime-400 shrink-0" />
                <span className="font-semibold text-white/80 truncate">
                  {activeEpisode ? activeEpisode.episode_name : "未选集"}
                </span>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <SkipForward size={13} className="text-lime-400 shrink-0" />
                <span className="font-semibold text-white/80 truncate">
                  {activeSource?.name || "未知线路"}
                </span>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 backdrop-blur-md w-full min-w-0 box-border">
            <div className="mb-2.5 flex items-center gap-2 text-xs font-bold tracking-wide text-white/40 uppercase">
              <Tv2 size={13} className="text-lime-400" />
              <span>切换线路</span>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar w-full">
              {detail.play_from.map((source) => (
                <button
                  key={source.code}
                  onClick={() => {
                    manualSourceSelectionRef.current = true
                    setActiveSourceCode(source.code)
                    setActiveEpisodeIndex(0)
                    setFailedSourceCodes([])
                    setResolvedPlayUrl("")
                    setPlaybackError("")
                  }}
                  className={`shrink-0 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                    activeSourceCode === source.code
                      ? "bg-lime-400 text-black shadow-md"
                      : "bg-white/5 text-white/70 hover:bg-white/10"
                  }`}
                >
                  {source.name}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/5 bg-white/[0.01] p-4 w-full box-border min-w-0">
            <div className="mb-3 flex items-center justify-between border-b border-white/5 pb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white/40 uppercase">
                <Tv2 size={13} className="text-lime-400" />
                <span>剧集列表</span>
              </div>
            </div>

            {episodes.length > 0 ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 w-full">
                {episodes.map((episode, index) => (
                  <button
                    key={`${episode.episode_id}-${episode.episode_name}`}
                    onClick={() => {
                      manualSourceSelectionRef.current = true
                      setActiveEpisodeIndex(index)
                      setResolvedPlayUrl("")
                      setPlaybackError("")
                    }}
                    className={`rounded-lg py-2.5 text-xs font-medium transition active:scale-95 px-1 truncate ${
                      activeEpisodeIndex === index
                        ? "bg-lime-400 text-black font-bold shadow-md"
                        : "bg-white/5 text-white/70 border border-white/5 hover:bg-white/10"
                    }`}
                  >
                    {episode.episode_name}
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-xs text-white/30">
                该线路频道尚未同步更新集数
              </div>
            )}
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] w-full min-w-0">
            <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-4 h-fit w-full box-border min-w-0">
              <div className="mb-4 flex items-center gap-1.5 text-xs font-bold text-white/40 uppercase">
                <MessageCircle size={13} className="text-lime-400" />
                <span>影迷热评</span>
              </div>

              {commentsQuery.isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <RefreshCw className="h-5 w-5 animate-spin text-lime-400" />
                </div>
              ) : comments.length > 0 ? (
                <div className="space-y-3 w-full">
                  {comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="rounded-xl border border-white/5 bg-black/20 p-4 space-y-2.5 w-full box-border min-w-0"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={getProxyUrl(comment.user?.avatar)}
                          alt={comment.user?.nickname || "用户"}
                          className="h-8 w-8 rounded-full object-cover border border-white/5 bg-[#0a0e18] shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-semibold text-white/80">
                            {comment.user?.nickname || "匿名的影迷"}
                          </div>
                          <div className="text-[10px] text-white/30 mt-0.5 truncate">
                            推荐指数：{comment.likes || 0} 赞同
                          </div>
                        </div>
                      </div>
                      <p className="text-xs leading-relaxed text-white/70 break-words">
                        {comment.content}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-xs text-white/30">
                  暂无影评，快来抢占沙发
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-4 w-full box-border min-w-0">
              <div className="mb-4 flex items-center justify-between border-b border-white/5 pb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-white/40 uppercase">
                  <ChevronRight size={13} className="text-lime-400" />
                  <span>相关推荐</span>
                </div>
                <button
                  onClick={() => relatedQuery.refetch()}
                  className="text-[10px] uppercase font-bold text-white/30 tracking-wider hover:text-white/60 transition shrink-0"
                >
                  换一换
                </button>
              </div>

              {relatedQuery.isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-5 w-5 animate-spin text-lime-400" />
                </div>
              ) : relatedItems.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 w-full">
                  {relatedItems.slice(0, 6).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => openRelated(item)}
                      className="group text-left focus:outline-none w-full min-w-0"
                    >
                      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0c1020] aspect-[2/3] shadow-sm w-full">
                        <img
                          src={getProxyUrl(item.cover)}
                          alt={item.name}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                      </div>
                      <h4 className="mt-1.5 truncate text-xs font-semibold text-white/80 group-hover:text-lime-400 transition-colors w-full">
                        {item.name}
                      </h4>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-xs text-white/30">
                  暂无同类型相关推荐
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

const LoaderState = () => (
  <div className="flex flex-col items-center gap-2">
    <RefreshCw className="h-6 w-6 animate-spin text-lime-400" />
    <p className="text-xs text-white/40 tracking-wide">正在解析加密播放源...</p>
  </div>
)

export default Detail
