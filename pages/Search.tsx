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
  List as ListIcon,
  Trophy,
  LayoutGrid,
  MoreHorizontal,
  SlidersHorizontal,
  ChevronDown,
  ArrowUpDown,
} from "lucide-react"

// ==========================================
// 1. 静态配置 (对应后端标准分类与标签)
// ==========================================

// 主分类配置
const CATEGORIES = [
  { key: "all", name: "全局", icon: null },
  { key: "movie", name: "电影", icon: <Film size={14} /> },
  { key: "tv", name: "剧集", icon: <Tv size={14} /> },
  { key: "anime", name: "动漫", icon: <Clapperboard size={14} /> },
  { key: "variety", name: "综艺", icon: <Music size={14} /> },
  { key: "sports", name: "体育", icon: <Trophy size={14} /> },
]

// 子标签配置 (根据主分类显示不同标签)
const TAGS_MAP: Record<string, { label: string; value: string }[]> = {
  all: [
    { label: "Netflix", value: "netflix" },
    { label: "高分电影", value: "high_score" },
  ],
  movie: [
    { label: "全部", value: "" },
    { label: "最新院线", value: "new_arrival" },
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
    { label: "国产动漫", value: "国产" },
    { label: "日本动漫", value: "日本" },
  ],
  variety: [
    { label: "全部", value: "" },
    { label: "大陆综艺", value: "大陆" },
    { label: "日韩综艺", value: "日韩" },
  ],
  sports: [
    { label: "全部", value: "" },
    // { label: "NBA", value: "NBA" },
    // { label: "足球", value: "足球" },
    // { label: "F1", value: "F1" },
  ],
}

// 排序选项
const SORT_OPTIONS = [
  { label: "按时间", value: "time" },
  { label: "按评分", value: "rating" },
]

// 年份选项
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
  // 2. 状态初始化 (URL > Storage > Default)
  // ==========================================
  const [state, setState] = useState(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY)
    const parsedSaved = saved ? JSON.parse(saved) : {}

    // URL 优先级最高
    const urlQ = searchParams.get("q")
    const urlCat = searchParams.get("cat")
    const urlTag = searchParams.get("tag")

    return {
      keyword: urlQ !== null ? urlQ : parsedSaved.keyword || "",
      cat: urlCat || parsedSaved.cat || "all",
      tag: urlTag || parsedSaved.tag || "",
      year: parsedSaved.year || "全部",
      sort: parsedSaved.sort || "time",
      viewMode: parsedSaved.viewMode || "grid", // grid | list
    }
  })

  // 输入框状态独立，避免每次输入都触发搜索
  const [inputValue, setInputValue] = useState(state.keyword)

  // 筛选面板折叠状态
  const [showFilters, setShowFilters] = useState(false)

  // 刷新动画状态
  const [isSpinning, setIsSpinning] = useState(false)

  const loadMoreRef = useRef<HTMLDivElement>(null)

  // ==========================================
  // 3. 数据请求 (TanStack Query)
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
      // 构造 API 参数
      const params: any = {
        pg: pageParam,
        year: state.year === "全部" ? undefined : state.year,
        sort: state.sort,
      }
      if (state.keyword) {
        params.wd = state.keyword
      }
      if (state.cat && state.cat !== "all") {
        params.cat = state.cat
      }
      if (state.tag) {
        params.tag = state.tag
      }

      const res = await fetchVideos(params, signal)

      return {
        list: res.list || [],
        // 数据库模式下 pagecount 可能不准，依赖 list 长度判断是否还有下一页
        hasMore: (res.list?.length || 0) > 0,
        page: Number(pageParam),
      }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      // 如果当前页数据为空，或者少于预期(比如20条)，说明没有下一页了
      if (!lastPage.hasMore || lastPage.list.length < 5) return undefined
      return lastPage.page + 1
    },
    staleTime: 1000 * 60 * 2, // 2分钟缓存
  })

  const videos = data?.pages.flatMap((page) => page.list) || []
  const isEmpty = !isFetching && videos.length === 0
  const isFilterLoading = isFetching && !isFetchingNextPage && !isRefetching
  console.log("Home.tsx", videos)
  // ==========================================
  // 4. 事件处理
  // ==========================================

  // 同步 URL 和 Storage
  useEffect(() => {
    const newState = {
      keyword: state.keyword,
      cat: state.cat,
      tag: state.tag,
      year: state.year,
      sort: state.sort,
      viewMode: state.viewMode,
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
      { replace: true }
    )
  }, [state, setSearchParams])

  // 无限滚动监听
  useEffect(() => {
    const el = loadMoreRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage)
          fetchNextPage()
      },
      { threshold: 0.1, rootMargin: "200px" }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // 处理搜索提交
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // 搜索时重置标签和排序，但保留大分类（如果用户想在当前分类下搜）
    // 或者重置为全站搜索，取决于产品逻辑。这里选择重置为全站搜索以获得更多结果。
    setState((prev) => ({
      ...prev,
      keyword: inputValue.trim(),
      cat: "all", // 搜索时切回全局
      tag: "",
    }))
    // 收起键盘
    ;(document.activeElement as HTMLElement)?.blur()
  }

  // 清空搜索
  const clearSearch = () => {
    setInputValue("")
    setState((prev) => ({ ...prev, keyword: "" }))
  }

  // 刷新
  const handleRefresh = () => {
    setIsSpinning(true)
    refetch()
    setTimeout(() => setIsSpinning(false), 1000)
  }

  // ==========================================
  // 5. 渲染辅助函数
  // ==========================================

  // 渲染二级标签栏
  const renderTags = () => {
    // 默认显示当前分类的标签，如果当前分类没有配置标签，则显示默认
    const tags = TAGS_MAP[state.cat] || []
    if (tags.length === 0) return null

    return (
      <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto no-scrollbar">
        {tags.map((t) => (
          <button
            key={t.value}
            onClick={() => {
              window.scrollTo({ top: 0, behavior: "smooth" })
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
      {/* 🟢 悬浮刷新按钮 */}
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

      {/* 🔴 Header: Search & Categories */}
      <div className="sticky top-0 z-30 bg-[#050505]/95 backdrop-blur-xl border-b border-white/5 pb-2 transition-all">
        {/* Top: 搜索框 (适配 iOS 安全区域) */}
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

          {/* 筛选展开按钮 */}
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

        {/* Level 1: 大分类 (Tabs) */}
        <div className="flex items-center gap-4 px-4 overflow-x-auto no-scrollbar border-b border-white/5">
          {CATEGORIES.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                window.scrollTo({ top: 0, behavior: "auto" })
                setState((prev) => ({
                  ...prev,
                  cat: tab.key,
                  tag: "", // 切换大类时重置标签
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

        {/* Level 2: 智能标签 (Tags) */}
        <div
          className={`transition-all duration-300 overflow-hidden ${
            state.cat ? "mt-2" : ""
          }`}
        >
          {renderTags()}
        </div>

        {/* Level 3: 高级筛选 (折叠面板) */}
        <div
          className={`overflow-hidden transition-all duration-300 bg-[#0a0a0a] ${
            showFilters ? "max-h-40 border-b border-white/5" : "max-h-0"
          }`}
        >
          <div className="px-4 py-3 space-y-3">
            {/* 排序 */}
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

            {/* 年份 */}
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

        {/* Level 4: 视图切换与结果统计 */}
        <div className="px-4 mt-2 flex items-center justify-between">
          <div className="text-[10px] text-gray-500">
            {isFetching ? "搜索中..." : `已加载 ${videos.length} 个相关资源`}
          </div>
          <div className="flex bg-[#121212] rounded-lg p-0.5 border border-white/5">
            <button
              onClick={() =>
                setState((prev) => ({ ...prev, viewMode: "grid" }))
              }
              className={`p-1.5 rounded-md transition-all ${
                state.viewMode === "grid"
                  ? "bg-white/10 text-emerald-400"
                  : "text-gray-600"
              }`}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() =>
                setState((prev) => ({ ...prev, viewMode: "list" }))
              }
              className={`p-1.5 rounded-md transition-all ${
                state.viewMode === "list"
                  ? "bg-white/10 text-emerald-400"
                  : "text-gray-600"
              }`}
            >
              <ListIcon size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* 🔴 Content: Video Grid/List */}
      <div className="px-4 mt-3 min-h-[50vh] relative">
        {/* 骨架屏 / Loading */}
        {isFilterLoading && videos.length === 0 && (
          <div
            className={
              state.viewMode === "grid"
                ? "grid grid-cols-3 gap-3"
                : "flex flex-col gap-3"
            }
          >
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className={`bg-[#1a1a1a] rounded-lg animate-pulse ${
                  state.viewMode === "grid" ? "aspect-[2/3]" : "h-24"
                }`}
              />
            ))}
          </div>
        )}

        {/* 视频列表 */}
        {videos.length > 0 && (
          <div
            className={
              state.viewMode === "grid"
                ? "grid grid-cols-3 gap-3"
                : "flex flex-col gap-3"
            }
          >
            {videos.map((v, index) => {
              const displayVideo = { ...v, rating: v.rating.toFixed(1) || 0.0 }

              if (state.viewMode === "list") {
                return (
                  <div
                    key={`${v.id}-${index}`}
                    className="flex gap-3 p-2 bg-[#1a1a1a] rounded-xl border border-white/5 active:scale-[0.98] transition-transform cursor-pointer"
                    onClick={() => navigate(`/detail/${v.id}`)}
                  >
                    <div className="w-20 aspect-[2/3] rounded-lg overflow-hidden flex-shrink-0 bg-gray-800 relative">
                      <img
                        src={v.poster}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        alt={v.title}
                      />
                      {v.rating > 0 && (
                        <div className="absolute top-1 left-1 bg-amber-500/90 text-black text-[8px] font-black px-1 rounded-sm">
                          {v.rating.toFixed(1)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 py-1 flex flex-col justify-center min-w-0">
                      <h3 className="text-sm font-bold text-gray-200 truncate">
                        {v.title}
                      </h3>
                      <div className="text-xs text-gray-500 mt-2 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="bg-white/5 px-1.5 py-0.5 rounded text-[10px]">
                            {v.year || "未知"}
                          </span>
                          <span className="bg-white/5 px-1.5 py-0.5 rounded text-[10px]">
                            {v.category || "其它"}
                          </span>
                        </div>
                        <p className="truncate opacity-70">{v.remarks}</p>
                      </div>
                    </div>
                  </div>
                )
              }
              return <VideoCard key={`${v.id}-${index}`} video={displayVideo} />
            })}
          </div>
        )}
        {/* Empty State */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-600 space-y-4">
            <div className="w-20 h-20 bg-[#1a1a1a] rounded-full flex items-center justify-center border border-white/5">
              <Film size={32} className="opacity-20" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-gray-400">未找到相关资源</p>
              <p className="text-xs mt-1 opacity-50">
                尝试更换关键词或筛选条件
              </p>
            </div>
            <button
              onClick={() => {
                setState((prev) => ({
                  ...prev,
                  keyword: "",
                  cat: "all",
                  tag: "",
                  year: "全部",
                }))
                setInputValue("")
              }}
              className="text-xs bg-emerald-500/10 text-emerald-500 px-4 py-2 rounded-full mt-2"
            >
              清空筛选
            </button>
          </div>
        )}
        {/* Load More & Footer */}
        <div ref={loadMoreRef} className="py-8 flex justify-center w-full">
          {isFetchingNextPage ? (
            <div className="flex items-center gap-2 text-emerald-500 text-xs px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <Loader2 className="animate-spin" size={14} /> 正在加载更多...
            </div>
          ) : !hasNextPage && videos.length > 0 ? (
            <div className="flex items-center gap-2 opacity-30">
              <div className="w-8 h-[1px] bg-gray-500"></div>
              <span className="text-[10px] text-gray-500 uppercase tracking-widest">
                THE END
              </span>
              <div className="w-8 h-[1px] bg-gray-500"></div>
            </div>
          ) : null}
        </div>
        {isError && (
          <div className="text-center py-10">
            <button
              onClick={() => refetch()}
              className="text-xs text-red-400 bg-red-500/10 px-4 py-2 rounded-full border border-red-500/20"
            >
              加载失败，点击重试
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default Search
