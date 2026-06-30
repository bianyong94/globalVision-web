import React, { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { Loader2, RefreshCw } from "lucide-react"
import SEO from "../components/SEO"
import {
  fetchRankingCategories,
  fetchRankingMovies,
  fetchTopicDetail,
  fetchTopics,
  fetchWeeklyMovies,
} from "../services/api"
import { createImageFallbackHandler, getProxyUrl } from "../utils/common"
import { MovieListItem, MovieTopicItem } from "../types"

type ExploreModule = "ranking" | "weekly" | "topic"

type WeekItem = {
  key: string
  label: string
  weekDay: number
  isToday: boolean
}

const MODULES: Array<{ id: ExploreModule; title: string }> = [
  { id: "ranking", title: "排行榜" },
  { id: "weekly", title: "追剧周榜" },
  { id: "topic", title: "发现专题" },
]

const buildWeeklyTabs = (): WeekItem[] => {
  const now = new Date()
  return [-1, 0, 1, 2, 3, 4, 5].map((offset) => {
    const date = new Date(now)
    date.setDate(now.getDate() + offset)
    const weekDay = ((date.getDay() + 6) % 7) + 1
    const isToday = offset === 0
    return {
      key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
      label: isToday ? "今" : String(date.getDate()),
      weekDay,
      isToday,
    }
  })
}

const getCardMeta = (item: MovieListItem) => {
  const meta = [item.label, item.dynamic, item.year, item.type_name]
    .concat(
      item.hot ? [`热度 ${item.hot}`] : [],
      item.popularity_score != null ? [`指数 ${item.popularity_score}`] : [],
    )
    .map((value) => (value ? String(value).trim() : ""))
    .filter(Boolean)
  return [...new Set(meta)].slice(0, 2)
}

const MoviePosterCard = ({
  item,
  onOpen,
}: {
  item: MovieListItem
  onOpen: (item: MovieListItem) => void
}) => {
  const meta = getCardMeta(item)

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="group text-left focus:outline-none w-full"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-[#0c1020] shadow-lg ring-1 ring-white/5">
        <img
          src={getProxyUrl(item.cover, { w: 360, q: 72 })}
          alt={item.name}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
          loading="lazy"
          decoding="async"
          onError={createImageFallbackHandler(item.cover)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#08090f]/90 via-transparent to-transparent opacity-80" />

        {meta.length > 0 && (
          <div className="absolute left-2 top-2 flex flex-wrap gap-1">
            {meta.map((tag) => (
              <span
                key={tag}
                className="rounded bg-black/40 backdrop-blur-md px-1.5 py-0.5 text-[10px] font-medium text-white/90"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        {(item.dynamic || item.score) && (
          <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between gap-1">
            <span className="line-clamp-1 text-[11px] font-medium text-lime-400 drop-shadow-md">
              {item.dynamic || "更新"}
            </span>
            {item.score && (
              <span className="text-xs font-black text-amber-400 drop-shadow-md">
                {item.score}
              </span>
            )}
          </div>
        )}
      </div>
      <h3 className="mt-2 line-clamp-1 text-sm font-medium text-white/90 transition-colors group-hover:text-lime-400">
        {item.name}
      </h3>
    </button>
  )
}

const RankedMovieCard = ({
  item,
  index,
  onOpen,
}: {
  item: MovieListItem
  index: number
  onOpen: (item: MovieListItem) => void
}) => {
  const isTop3 = index < 3

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="group relative flex items-center gap-4 rounded-2xl bg-white/[0.02] p-3 text-left transition hover:bg-white/[0.05] active:scale-[0.98]"
    >
      <div
        className={`w-6 text-center font-black italic shrink-0 ${isTop3 ? "text-3xl text-lime-400" : "text-2xl text-white/20"}`}
      >
        {index + 1}
      </div>

      {/* 优化点：图片尺寸从原来的 h-20 w-14 增大为 h-28 w-20 */}
      <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-[#0c1020] shadow-md border border-white/5">
        <img
          src={getProxyUrl(item.cover, { w: 220, q: 75 })}
          alt={item.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
          decoding="async"
          onError={createImageFallbackHandler(item.cover)}
        />
      </div>

      <div className="min-w-0 flex-1 py-1 flex flex-col justify-center">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-base font-medium text-white/90 group-hover:text-lime-300">
            {item.name}
          </h3>
        </div>
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-white/40">
          {item.blurb || item.remarks || item.dynamic || item.type_name}
        </p>
        <div className="mt-2 flex gap-2 text-[11px] font-medium text-white/30">
          {item.score && (
            <span className="text-amber-400/80 bg-amber-400/10 px-1.5 py-0.5 rounded">
              评分 {item.score}
            </span>
          )}
          {item.hot && (
            <span className="bg-white/5 px-1.5 py-0.5 rounded">
              热度 {item.hot}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

const EmptyState = ({ text }: { text: string }) => (
  <div className="flex flex-col items-center justify-center py-20 text-white/30">
    <div className="h-12 w-12 rounded-full bg-white/5 mb-4 flex items-center justify-center">
      <RefreshCw size={20} className="opacity-50" />
    </div>
    <p className="text-sm">{text}</p>
  </div>
)

const Explore = () => {
  const navigate = useNavigate()
  const [activeModule, setActiveModule] = useState<ExploreModule>("topic")
  const [activeRankingId, setActiveRankingId] = useState<number>(0)
  const [activeWeekDay, setActiveWeekDay] = useState<number>(0)
  const [activeTopicId, setActiveTopicId] = useState<number>(0)
  const weeklyTabs = useMemo(() => buildWeeklyTabs(), [])

  const rankingCategoriesQuery = useQuery({
    queryKey: ["explore-ranking-categories"],
    queryFn: fetchRankingCategories,
    staleTime: 1000 * 60 * 10,
  })

  const rankingCategories = rankingCategoriesQuery.data || []

  useEffect(() => {
    if (activeRankingId || rankingCategories.length === 0) return
    setActiveRankingId(rankingCategories[0].id)
  }, [activeRankingId, rankingCategories])

  const rankingMoviesQuery = useQuery({
    queryKey: ["explore-ranking-movies", activeRankingId],
    queryFn: () => fetchRankingMovies(activeRankingId),
    enabled: activeRankingId > 0,
    staleTime: 1000 * 60 * 5,
    placeholderData: (previous) => previous,
  })

  const weeklyDefaultDay = weeklyTabs.find((item) => item.isToday)?.weekDay || 1

  useEffect(() => {
    if (activeWeekDay > 0) return
    setActiveWeekDay(weeklyDefaultDay)
  }, [activeWeekDay, weeklyDefaultDay])

  const weeklyMoviesQuery = useQuery({
    queryKey: ["explore-weekly-movies", activeWeekDay],
    queryFn: () => fetchWeeklyMovies(activeWeekDay),
    enabled: activeWeekDay > 0,
    staleTime: 1000 * 60 * 5,
    placeholderData: (previous) => previous,
  })

  const topicsQuery = useQuery({
    queryKey: ["explore-topics"],
    queryFn: fetchTopics,
    staleTime: 1000 * 60 * 10,
  })

  const topics = topicsQuery.data || []

  useEffect(() => {
    if (activeTopicId || topics.length === 0) return
    setActiveTopicId(topics[0].id)
  }, [activeTopicId, topics])

  const topicDetailQuery = useQuery({
    queryKey: ["explore-topic-detail", activeTopicId],
    queryFn: () => fetchTopicDetail(activeTopicId),
    enabled: activeTopicId > 0,
    staleTime: 1000 * 60 * 5,
    placeholderData: (previous) => previous,
  })

  const handleOpen = (item: MovieListItem) => {
    if (item?.id) navigate(`/detail/${item.id}`)
  }

  const handleRefresh = async () => {
    await Promise.all([
      rankingCategoriesQuery.refetch(),
      activeRankingId > 0 ? rankingMoviesQuery.refetch() : Promise.resolve(),
      weeklyMoviesQuery.refetch(),
      topicsQuery.refetch(),
      activeTopicId > 0 ? topicDetailQuery.refetch() : Promise.resolve(),
    ])
  }

  const isRefreshing =
    rankingCategoriesQuery.isFetching ||
    rankingMoviesQuery.isFetching ||
    weeklyMoviesQuery.isFetching ||
    topicsQuery.isFetching ||
    topicDetailQuery.isFetching

  const rankingMovies = rankingMoviesQuery.data || []
  const weeklyMovies = weeklyMoviesQuery.data || []
  const topicDetail = topicDetailQuery.data

  return (
    <div className="min-h-screen w-full bg-[#08090f] pb-32 text-white antialiased selection:bg-lime-400/30">
      <SEO title="探索" />

      {/* 极简吸顶导航 */}
      <div className="sticky top-0 z-50 bg-[#08090f]/80 backdrop-blur-2xl border-b border-white/[0.04]">
        <div className="mx-auto max-w-xl px-4 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-2 flex items-center justify-between">
          <div className="flex gap-6">
            {MODULES.map((module) => {
              const active = activeModule === module.id
              return (
                <button
                  type="button"
                  key={module.id}
                  onClick={() => setActiveModule(module.id)}
                  className={`relative py-2 text-[15px] font-medium transition-colors ${
                    active ? "text-white" : "text-white/40 hover:text-white/70"
                  }`}
                >
                  {module.title}
                  {active && (
                    <span className="absolute bottom-0 left-1/2 h-[3px] w-4 -translate-x-1/2 rounded-full bg-lime-400" />
                  )}
                </button>
              )
            })}
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="p-2 text-white/40 hover:text-white active:scale-95 transition-all"
          >
            <RefreshCw
              size={18}
              className={isRefreshing ? "animate-spin" : ""}
            />
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-xl w-full pt-4 min-w-0">
        {/* 排行榜模块 */}
        {activeModule === "ranking" && (
          <div className="animate-in fade-in duration-300">
            <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 pb-2">
              {rankingCategories.map((item) => {
                const active = activeRankingId === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveRankingId(item.id)}
                    className={`shrink-0 rounded-full px-4 py-1.5 text-sm transition-all duration-300 ${
                      active
                        ? "bg-white text-black font-semibold"
                        : "bg-white/5 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    {item.name}
                  </button>
                )
              })}
            </div>

            <div className="px-4 mt-4 flex flex-col gap-1">
              {rankingCategoriesQuery.isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="h-28 animate-pulse rounded-2xl bg-white/5"
                    />
                  ))}
                </div>
              ) : rankingMovies.length > 0 ? (
                rankingMovies.map((item, index) => (
                  <RankedMovieCard
                    key={item.id}
                    item={item}
                    index={index}
                    onOpen={handleOpen}
                  />
                ))
              ) : (
                <EmptyState text="当前榜单暂无数据" />
              )}
            </div>
          </div>
        )}

        {/* 追剧周榜模块 */}
        {activeModule === "weekly" && (
          <div className="animate-in fade-in duration-300">
            <div className="flex justify-between overflow-x-auto no-scrollbar px-4 pb-4 gap-2">
              {weeklyTabs.map((item) => {
                const active = activeWeekDay === item.weekDay
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActiveWeekDay(item.weekDay)}
                    className={`flex flex-col items-center justify-center w-[13%] min-w-[44px] shrink-0 rounded-2xl py-3 transition-all ${
                      active
                        ? "bg-lime-400 text-black shadow-[0_4px_20px_rgba(163,230,53,0.25)]"
                        : "bg-white/[0.03] text-white/40 hover:bg-white/[0.08]"
                    }`}
                  >
                    <span className="text-[10px] font-medium opacity-80 mb-1">
                      {item.isToday
                        ? "今日"
                        : "周" +
                          ["日", "一", "二", "三", "四", "五", "六"][
                            item.weekDay === 7 ? 0 : item.weekDay
                          ]}
                    </span>
                    <span className="text-lg font-bold leading-none">
                      {item.label}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="px-4">
              {weeklyMoviesQuery.isLoading ? (
                <div className="grid grid-cols-3 gap-3">
                  {[...Array(9)].map((_, i) => (
                    <div
                      key={i}
                      className="aspect-[2/3] animate-pulse rounded-xl bg-white/5"
                    />
                  ))}
                </div>
              ) : weeklyMovies.length > 0 ? (
                <div className="grid grid-cols-3 gap-3">
                  {weeklyMovies.map((item) => (
                    <MoviePosterCard
                      key={item.id}
                      item={item}
                      onOpen={handleOpen}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState text="今天没有更新的内容哦" />
              )}
            </div>
          </div>
        )}

        {/* 专题模块 */}
        {activeModule === "topic" && (
          <div className="animate-in fade-in duration-300">
            {/* 优化点：增加了 py-2 防止边框/阴影被截断，加大了 gap-4，改用内边框 */}
            <div className="flex gap-4 overflow-x-auto no-scrollbar px-4 py-2 snap-x snap-mandatory">
              {topicsQuery.isLoading
                ? [...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className="w-[260px] shrink-0 h-32 animate-pulse rounded-2xl bg-white/5"
                    />
                  ))
                : topics.map((item) => {
                    const active = activeTopicId === item.id
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveTopicId(item.id)}
                        className={`group relative h-32 w-[260px] shrink-0 snap-start overflow-hidden rounded-2xl transition-all duration-300 box-border ${
                          active
                            ? "border-2 border-lime-400 shadow-[0_4px_16px_rgba(163,230,53,0.15)] scale-100"
                            : "border border-white/5 opacity-60 hover:opacity-100 scale-[0.97]"
                        }`}
                      >
                        <img
                          src={getProxyUrl(item.cover, { w: 400, q: 75 })}
                          alt={item.name}
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                          loading="lazy"
                          onError={createImageFallbackHandler(item.cover)}
                        />
                        <div
                          className={`absolute inset-0 transition-colors ${active ? "bg-black/10" : "bg-black/50 group-hover:bg-black/30"}`}
                        />
                        <div className="absolute bottom-3 left-3 right-3 text-left">
                          <h3 className="truncate text-sm font-bold text-white drop-shadow-md">
                            {item.name}
                          </h3>
                        </div>
                      </button>
                    )
                  })}
            </div>

            <div className="px-4 mt-4">
              {topicDetailQuery.isLoading && !topicDetail ? (
                <div className="grid grid-cols-3 gap-3 mt-6">
                  {[...Array(6)].map((_, i) => (
                    <div
                      key={i}
                      className="aspect-[2/3] animate-pulse rounded-xl bg-white/5"
                    />
                  ))}
                </div>
              ) : topicDetail ? (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="mb-5">
                    <h2 className="text-xl font-bold text-white mb-2">
                      {topicDetail.name}
                    </h2>
                    <p className="text-sm text-white/50 leading-relaxed">
                      {topicDetail.description}
                    </p>
                  </div>

                  {topicDetail.movies.length > 0 ? (
                    <div className="grid grid-cols-3 gap-3">
                      {topicDetail.movies.map((item) => (
                        <MoviePosterCard
                          key={item.id}
                          item={item}
                          onOpen={handleOpen}
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyState text="该专题下暂无影片" />
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}

        <div className="h-10" />
      </main>
    </div>
  )
}

export default Explore
