import React, { useState, useEffect, useRef } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { useInfiniteQuery } from "@tanstack/react-query"
import { fetchVideos } from "../services/api"
import VideoCard from "../components/VideoCard"
import {
  Search as SearchIcon,
  Loader2,
  Film,
  RefreshCw,
  Tv,
  Clapperboard,
  Music,
  XCircle,
  Trophy,
  MoreHorizontal,
  SlidersHorizontal,
  ArrowUpDown,
} from "lucide-react"
import VideoList from "./VideoList" // 引入上面的组件
// ==========================================
// 1. 静态配置
// ==========================================

const CATEGORIES = [
  { key: "all", name: "全局", icon: null },
  { key: "movie", name: "电影", icon: <Film size={14} /> },
  { key: "tv", name: "剧集", icon: <Tv size={14} /> },
  { key: "anime", name: "动漫", icon: <Clapperboard size={14} /> },
  { key: "variety", name: "综艺", icon: <Music size={14} /> },
  { key: "sports", name: "体育", icon: <Trophy size={14} /> },
]

const TAGS_MAP: Record<string, { label: string; value: string }[]> = {
  all: [
    { label: "Netflix", value: "netflix" },
    { label: "高分影视", value: "high_score" },
  ],
  movie: [
    { label: "全部", value: "" },
    { label: "Netflix", value: "netflix" },
    { label: "动作", value: "动作" },
    { label: "科幻", value: "科幻" },
    { label: "悬疑", value: "悬疑" },
    { label: "灾难", value: "灾难" },
    { label: "喜剧", value: "喜剧" },
    { label: "爱情", value: "爱情" },
    { label: "战争", value: "战争" },
    { label: "犯罪", value: "犯罪" },
  ],
  tv: [
    { label: "全部", value: "" },
    { label: "国产剧", value: "国产" },
    { label: "美剧", value: "欧美" },
    { label: "韩剧", value: "韩剧" },
    { label: "Netflix", value: "netflix" },
    { label: "悬疑", value: "悬疑" },
    { label: "喜剧", value: "喜剧" },
    { label: "爱情", value: "爱情" },
    { label: "战争", value: "战争" },
    { label: "犯罪", value: "犯罪" },
  ],
  anime: [
    { label: "全部", value: "" },
    { label: "国产动漫", value: "国漫" },
    { label: "日本动漫", value: "日本" },
  ],
  variety: [
    { label: "全部", value: "" },
    { label: "大陆综艺", value: "大陆" },
    { label: "韩国综艺", value: "韩剧" },
    { label: "欧美综艺", value: "欧美" },
  ],
  sports: [
    { label: "全部", value: "" },
    { label: "NBA", value: "NBA" },
    { label: "足球", value: "足球" },
    { label: "F1", value: "F1" },
  ],
}

const SORT_OPTIONS = [
  { label: "按时间", value: "time" },
  { label: "按评分", value: "rating" },
]

const currentYear = new Date().getFullYear()
const YEARS = [
  "全部",
  ...Array.from({ length: 15 }, (_, i) => String(currentYear - i)),
]

const STORAGE_KEY = "GV_SEARCH_STATE_V2"

const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  // ==========================================
  // 2. 状态初始化 (移除 viewMode)
  // ==========================================
  const [state, setState] = useState(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY)
    const parsedSaved = saved ? JSON.parse(saved) : {}

    const urlQ = searchParams.get("q")
    const urlCat = searchParams.get("cat")
    const urlTag = searchParams.get("tag")

    return {
      keyword: urlQ !== null ? urlQ : parsedSaved.keyword || "",
      cat: urlCat || parsedSaved.cat || "all",
      tag: urlTag || parsedSaved.tag || "",
      year: parsedSaved.year || "全部",
      sort: parsedSaved.sort || "time",
    }
  })

  const [inputValue, setInputValue] = useState(state.keyword)
  const [showFilters, setShowFilters] = useState(false)
  const [isSpinning, setIsSpinning] = useState(false)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // 新增：记录哪些 Tab 已经被用户点过了
  const [visitedCats, setVisitedCats] = useState<Set<string>>(
    new Set([state.cat]),
  )

  // 当 state.cat 变化时，将其加入已访问列表
  useEffect(() => {
    setVisitedCats((prev) => {
      const newSet = new Set(prev)
      newSet.add(state.cat)
      return newSet
    })
  }, [state.cat])
  // ==========================================
  // 3. 数据请求
  // ==========================================
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    refetch,
    isRefetching,
    isError,
  } = useInfiniteQuery({
    queryKey: [
      "search_v2",
      state.cat,
      state.tag,
      state.keyword,
      state.year,
      state.sort,
    ],
    queryFn: async ({ pageParam = 1, signal }) => {
      const params: any = {
        pg: pageParam,
        year: state.year === "全部" ? undefined : state.year,
        sort: state.sort,
      }
      if (state.keyword) {
        params.wd = state.keyword
        params.view = "season"
      }
      if (state.cat && state.cat !== "all") params.cat = state.cat
      if (state.tag) params.tag = state.tag

      const res = await fetchVideos(params, signal)

      return {
        list: res.list || [],
        hasMore: (res.list?.length || 0) > 0,
        page: Number(pageParam),
      }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore || lastPage.list.length < 5) return undefined
      return lastPage.page + 1
    },
    staleTime: 1000 * 60 * 2,
  })

  const videos = data?.pages.flatMap((page) => page.list) || []
  const isEmpty = !isFetching && videos.length === 0
  const isFilterLoading = isFetching && !isFetchingNextPage && !isRefetching

  // ==========================================
  // 4. 事件处理
  // ==========================================

  useEffect(() => {
    const newState = {
      keyword: state.keyword,
      cat: state.cat,
      tag: state.tag,
      year: state.year,
      sort: state.sort,
    }

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(newState))

    setSearchParams(
      (prev) => {
        const newParams = new URLSearchParams(prev)
        if (state.keyword) newParams.set("q", state.keyword)
        else newParams.delete("q")

        if (state.cat && state.cat !== "all") newParams.set("cat", state.cat)
        else newParams.delete("cat")

        if (state.tag) newParams.set("tag", state.tag)
        else newParams.delete("tag")

        return newParams
      },
      { replace: true },
    )
  }, [state, setSearchParams])

  useEffect(() => {
    const el = loadMoreRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage)
          fetchNextPage()
      },
      { threshold: 0.1, rootMargin: "200px" },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setState((prev) => ({
      ...prev,
      keyword: inputValue.trim(),
      cat: "all",
      tag: "",
    }))
    ;(document.activeElement as HTMLElement)?.blur()
  }

  const clearSearch = () => {
    setInputValue("")
    setState((prev) => ({ ...prev, keyword: "" }))
  }

  const handleRefresh = () => {
    setIsSpinning(true)
    refetch()
    setTimeout(() => setIsSpinning(false), 1000)
  }

  const renderTags = () => {
    const tags = TAGS_MAP[state.cat] || []
    if (tags.length === 0) return null

    return (
      <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto no-scrollbar">
        {tags.map((t) => (
          <button
            key={t.value}
            onClick={() => {
              setState((prev) => ({ ...prev, tag: t.value }))
            }}
            className={`px-3 py-1.5 text-xs rounded-full border transition-all whitespace-nowrap ${
              state.tag === t.value
                ? "bg-emerald-500 text-white border-emerald-500 font-bold shadow-lg shadow-emerald-500/20"
                : "bg-[#1a1a1a] text-gray-400 border-white/5 hover:border-white/20"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050505] pb-20 selection:bg-emerald-500/30">
      <button
        onClick={handleRefresh}
        disabled={isRefetching || isSpinning}
        className="fixed bottom-24 right-5 z-50 bg-[#1a1a1a]/80 backdrop-blur-md text-emerald-500 p-3.5 rounded-full shadow-2xl border border-white/10 active:scale-90 transition-all duration-200 hover:bg-[#2a2a2a]"
        style={{ boxShadow: "0 0 20px rgba(16, 185, 129, 0.2)" }}
      >
        <RefreshCw
          size={22}
          className={isRefetching || isSpinning ? "animate-spin" : ""}
        />
      </button>

      <div className="sticky top-0 z-30 bg-[#050505]/95 backdrop-blur-xl border-b border-white/5 pb-2 transition-all">
        {/* 顶部搜索栏 */}
        <div className="px-4 pb-2 pt-[calc(0.75rem+env(safe-area-inset-top))] flex gap-3 items-center">
          <form onSubmit={handleSearchSubmit} className="flex-1">
            <div className="relative flex items-center bg-[#121212] rounded-full border border-white/10 focus-within:border-emerald-500/50 transition-colors h-10">
              {isFilterLoading ? (
                <Loader2
                  size={16}
                  className="absolute left-3 text-emerald-500 animate-spin"
                />
              ) : (
                <SearchIcon
                  size={16}
                  className="absolute left-3 text-gray-500"
                />
              )}
              <input
                type="search"
                placeholder="搜索影片、剧集、演员..."
                className="w-full bg-transparent text-white pl-10 pr-10 h-full outline-none text-sm placeholder-gray-600 appearance-none"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />
              {inputValue && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-3 text-gray-500 hover:text-white p-1"
                >
                  <XCircle size={14} />
                </button>
              )}
            </div>
          </form>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2.5 rounded-full border transition-colors ${
              showFilters || state.year !== "全部" || state.sort !== "time"
                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                : "bg-[#121212] text-gray-500 border-white/10"
            }`}
          >
            <SlidersHorizontal size={18} />
          </button>
        </div>

        {/* 分类 Tabs */}
        <div className="flex items-center gap-4 px-4 overflow-x-auto no-scrollbar border-b border-white/5">
          {CATEGORIES.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setState((prev) => ({
                  ...prev,
                  cat: tab.key,
                  tag: "",
                }))
              }}
              className={`
                py-3 text-sm font-bold whitespace-nowrap transition-all relative flex items-center gap-1.5
                ${
                  state.cat === tab.key
                    ? "text-white"
                    : "text-gray-500 hover:text-gray-300"
                }
              `}
            >
              {tab.icon}
              {tab.name}
              {state.cat === tab.key && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-emerald-500 shadow-[0_-2px_10px_rgba(16,185,129,0.5)]" />
              )}
            </button>
          ))}
        </div>

        {/* 子标签 */}
        <div
          className={`transition-all duration-300 overflow-hidden ${
            state.cat ? "mt-2" : ""
          }`}
        >
          {renderTags()}
        </div>

        {/* 筛选面板 */}
        <div
          className={`overflow-hidden transition-all duration-300 bg-[#0a0a0a] ${
            showFilters ? "max-h-40 border-b border-white/5" : "max-h-0"
          }`}
        >
          <div className="px-4 py-3 space-y-3">
            <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
              <span className="text-xs text-gray-500 whitespace-nowrap flex items-center gap-1">
                <ArrowUpDown size={12} /> 排序
              </span>
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() =>
                    setState((prev) => ({ ...prev, sort: opt.value }))
                  }
                  className={`px-3 py-1 text-xs rounded border whitespace-nowrap ${
                    state.sort === opt.value
                      ? "bg-white/10 text-emerald-400 border-emerald-500/30"
                      : "border-white/5 text-gray-500"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
              <span className="text-xs text-gray-500 whitespace-nowrap flex items-center gap-1">
                <MoreHorizontal size={12} /> 年份
              </span>
              {YEARS.map((y) => (
                <button
                  key={y}
                  onClick={() => setState((prev) => ({ ...prev, year: y }))}
                  className={`px-3 py-1 text-xs rounded border whitespace-nowrap ${
                    state.year === y
                      ? "bg-white/10 text-emerald-400 border-emerald-500/30"
                      : "border-white/5 text-gray-500"
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 结果统计栏 (移除视图切换按钮) */}
        <div className="px-4 mt-2 flex items-center justify-between min-h-[24px]">
          <div className="text-[10px] text-gray-500">
            {isFetching ? "搜索中..." : `已加载 ${videos.length} 个相关资源`}
          </div>
        </div>
      </div>

      {/* 🔴 替换原来的 Video Grid 区域 */}
      {/* 我们遍历所有分类，而不是只渲染当前分类 */}
      {CATEGORIES.map((category) => {
        // 性能优化：如果没有访问过这个 Tab，就不渲染 DOM，节省内存
        if (!visitedCats.has(category.key)) return null

        const isActive = state.cat === category.key

        return (
          <div
            key={category.key}
            // ✨ 魔法所在：使用 CSS 显隐，而不是销毁组件
            style={{ display: isActive ? "block" : "none" }}
          >
            <VideoList
              cat={category.key}
              tag={state.tag} // 注意：这里假设 tag 是跟随 cat 变化的，或者你可以为每个 Tab 维护独立的 tag 状态
              keyword={state.keyword}
              year={state.year}
              sort={state.sort}
              isActive={isActive}
            />
          </div>
        )
      })}
    </div>
  )
}

export default Search
