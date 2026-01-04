import React, { useState, useEffect, useRef, useMemo } from "react"
import { useSearchParams } from "react-router-dom"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { fetchCategories, fetchVideos } from "../services/api"
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
} from "lucide-react"

// --- 1. 常量定义 ---

const YEARS: string[] = []
const currentYear = new Date().getFullYear()
for (let i = 0; i < 12; i++) {
  YEARS.push(String(currentYear - i))
}
YEARS.push("更早")

const VIEW_MODES = [
  { value: "grid", icon: <LayoutGrid size={14} />, label: "网格" },
  { value: "list", icon: <ListIcon size={14} />, label: "列表" },
]

// 体育专属虚拟子分类
const SPORTS_SUB_CATS = [
  { name: "全部体育", keyword: "体育" },
  { name: "篮球", keyword: "NBA" },
  { name: "足球", keyword: "足球" },
  { name: "F1", keyword: "F1" },
  { name: "斯诺克", keyword: "斯诺克" },
]

const CATEGORY_UI_CONFIG = [
  { key: "movie", name: "电影", icon: <Film size={14} /> },
  { key: "tv", name: "剧集", icon: <Tv size={14} /> },
  { key: "anime", name: "动漫", icon: <Clapperboard size={14} /> },
  { key: "variety", name: "综艺", icon: <Music size={14} /> },
  { key: "sports", name: "体育", icon: <Trophy size={14} /> },
  { key: "other", name: "精选", icon: <MoreHorizontal size={14} /> },
]

const STORAGE_KEY = "GV_SEARCH_STATE"

// --- Hook: 封装下拉刷新逻辑 (复用 Home 页的逻辑) ---
const usePullToRefresh = (onRefresh: () => Promise<void>) => {
  const [pullY, setPullY] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const startY = useRef(0)
  const isPulling = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleTouchStart = (e: TouchEvent) => {
      // 只有当页面处于顶部时，才记录起始点
      if (window.scrollY <= 0) {
        startY.current = e.touches[0].clientY
        isPulling.current = false
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      // 如果正在刷新中，或者页面不在顶部，直接忽略
      if (isRefreshing || window.scrollY > 0) return

      const currentY = e.touches[0].clientY
      const diff = currentY - startY.current

      // 只有向下移动 (diff > 0) 且 起始点确实在顶部
      if (diff > 0 && startY.current > 0) {
        // 如果是可以取消的事件，阻止默认行为（防止 iOS 橡皮筋效果）
        if (e.cancelable && diff < 200) {
          e.preventDefault()
        }

        isPulling.current = true
        // 增加阻尼感
        const damping = Math.pow(diff, 0.8) * 0.4
        setPullY(Math.min(damping, 100)) // 最大下拉 100px
      }
    }

    const handleTouchEnd = async () => {
      if (!isPulling.current) return

      startY.current = 0
      isPulling.current = false

      if (pullY > 60) {
        // 阈值 60px
        setIsRefreshing(true)
        setPullY(60) // 停留在加载位置
        try {
          await onRefresh()
        } finally {
          setIsRefreshing(false)
          setPullY(0)
        }
      } else {
        setPullY(0) // 回弹
      }
    }

    // 绑定原生事件以支持 { passive: false }
    container.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    })
    container.addEventListener("touchmove", handleTouchMove, { passive: false })
    container.addEventListener("touchend", handleTouchEnd)

    return () => {
      container.removeEventListener("touchstart", handleTouchStart)
      container.removeEventListener("touchmove", handleTouchMove)
      container.removeEventListener("touchend", handleTouchEnd)
    }
  }, [pullY, isRefreshing, onRefresh])

  return { containerRef, pullY, isRefreshing }
}

const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams()

  // --- API ---
  const { data: allApiCategories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    staleTime: 1000 * 60 * 60 * 24,
  })

  const categorizedData = useMemo(() => {
    const buckets: Record<string, { rootId: number; children: any[] }> = {
      movie: { rootId: 1, children: [] },
      tv: { rootId: 2, children: [] },
      variety: { rootId: 3, children: [] },
      anime: { rootId: 4, children: [] },
      sports: { rootId: 5, children: [] },
      other: { rootId: 999, children: [] },
    }

    allApiCategories.forEach((cat: any) => {
      const pid = parseInt(cat.type_pid)
      if (pid === 0) return

      if (pid === 1) buckets.movie.children.push(cat)
      else if (pid === 2) buckets.tv.children.push(cat)
      else if (pid === 3) buckets.variety.children.push(cat)
      else if (pid === 4) buckets.anime.children.push(cat)
      else if (pid === 5) buckets.sports.children.push(cat)
      else if (pid === 999) buckets.other.children.push(cat)
    })

    return buckets
  }, [allApiCategories])

  // --- 初始化逻辑 ---
  const [initialState] = useState(() => {
    const savedStateJSON = sessionStorage.getItem(STORAGE_KEY)
    const savedState = savedStateJSON ? JSON.parse(savedStateJSON) : {}

    const urlQ = searchParams.get("q")
    const urlT = searchParams.get("t")

    const q = urlQ !== null ? urlQ : savedState.q || ""
    const t = urlT !== null ? urlT : savedState.t || ""
    const year = savedState.year || ""
    const viewMode = savedState.viewMode || "grid"

    let activeTabKey = "movie"
    if (q && SPORTS_SUB_CATS.some((s) => s.keyword === q)) {
      activeTabKey = "sports"
    } else if (t) {
      const targetId = parseInt(t)
      if (targetId === 1) activeTabKey = "movie"
      else if (targetId === 2) activeTabKey = "tv"
      else if (targetId === 3) activeTabKey = "variety"
      else if (targetId === 4) activeTabKey = "anime"
      else if (targetId === 5) activeTabKey = "sports"
      else {
        for (const [key, data] of Object.entries(categorizedData)) {
          if (
            data.children.some((c: any) => parseInt(c.type_id) === targetId)
          ) {
            activeTabKey = key
            break
          }
        }
      }
    } else if (!q) {
      activeTabKey = "movie"
    }

    return { q, t, year, viewMode, activeTabKey }
  })

  // --- State ---
  const [inputValue, setInputValue] = useState(initialState.q)
  const [activeKeyword, setActiveKeyword] = useState(initialState.q)
  const [activeTabKey, setActiveTabKey] = useState<string>(
    initialState.activeTabKey
  )
  const [selectedCategory, setSelectedCategory] = useState<number | string>(
    initialState.t
  )
  const [selectedYear, setSelectedYear] = useState(initialState.year)
  const [viewMode, setViewMode] = useState<"grid" | "list">(
    initialState.viewMode
  )

  const loadMoreRef = useRef<HTMLDivElement>(null)

  // --- API Request ---
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    refetch,
    isError,
  } = useInfiniteQuery({
    queryKey: ["videos", activeKeyword, selectedCategory, selectedYear],
    queryFn: async ({ pageParam = 1, signal }) => {
      const res = await fetchVideos(
        {
          wd: activeKeyword,
          t: selectedCategory,
          year: selectedYear === "更早" ? "" : selectedYear,
          pg: pageParam,
        },
        signal
      )
      return {
        list: res.list || [],
        pagecount: Number(res.pagecount) || 1,
        page: Number(pageParam),
      }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const curr = Number(lastPage.page)
      const total = Number(lastPage.pagecount)
      return curr < total ? curr + 1 : undefined
    },
    staleTime: 1000 * 60 * 5,
    placeholderData: (prev) => prev,
  })

  // --- 集成下拉刷新 Hook ---
  const { containerRef, pullY, isRefreshing } = usePullToRefresh(async () => {
    // 下拉刷新时，重新获取第一页数据
    await refetch()
  })

  const videos = data?.pages.flatMap((page) => page.list) || []
  const isEmpty = !isFetching && videos.length === 0
  const isFilterLoading = isFetching && !isFetchingNextPage && !isRefreshing

  // --- Effects ---
  useEffect(() => {
    if (activeKeyword && activeTabKey !== "sports") return
    if (activeTabKey === "sports") {
      if (!activeKeyword) {
        setActiveKeyword(SPORTS_SUB_CATS[0].keyword)
        setInputValue(SPORTS_SUB_CATS[0].keyword)
      }
      return
    }

    const currentGroup = categorizedData[activeTabKey]
    if (!currentGroup || currentGroup.children.length === 0) return

    const isCurrentIdValid = currentGroup.children.some(
      (c) => String(c.type_id) === String(selectedCategory)
    )

    if (!isCurrentIdValid) {
      setSelectedCategory(currentGroup.children[0].type_id)
    }
  }, [activeTabKey, categorizedData, activeKeyword, selectedCategory])

  useEffect(() => {
    const stateToSave = {
      q: activeKeyword,
      t: selectedCategory,
      year: selectedYear,
      viewMode,
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave))
    setSearchParams(
      (prev) => {
        const newParams = new URLSearchParams(prev)
        if (activeKeyword) newParams.set("q", activeKeyword)
        else newParams.delete("q")
        if (selectedCategory) newParams.set("t", String(selectedCategory))
        else newParams.delete("t")
        return newParams
      },
      { replace: true }
    )
  }, [activeKeyword, selectedCategory, selectedYear, viewMode, setSearchParams])

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputValue.trim() !== activeKeyword) {
      setActiveKeyword(inputValue.trim())
      setActiveTabKey("")
      setSelectedCategory("")
      ;(document.activeElement as HTMLElement)?.blur()
    }
  }

  useEffect(() => {
    if (!inputValue && activeKeyword) {
      setActiveKeyword("")
      if (!activeTabKey) {
        setActiveTabKey("movie")
        setSelectedCategory(1)
      }
    }
  }, [inputValue, activeKeyword, activeTabKey])

  const handleTabClick = (key: string) => {
    window.scrollTo({ top: 0, behavior: "auto" })
    setActiveTabKey(key)
    setActiveKeyword("")
    setInputValue("")

    if (key === "sports") {
      const firstSport = SPORTS_SUB_CATS[0]
      setSelectedCategory("")
      setActiveKeyword(firstSport.keyword)
      setInputValue(firstSport.keyword)
    } else {
      const currentGroup = categorizedData[key]
      if (currentGroup && currentGroup.children.length > 0) {
        setSelectedCategory(currentGroup.children[0].type_id)
      } else {
        setSelectedCategory(currentGroup?.rootId || "")
      }
    }
  }

  const handleSubCategoryClick = (
    id: number | string,
    isVirtual: boolean,
    keyword?: string
  ) => {
    window.scrollTo({ top: 0, behavior: "auto" })
    if (isVirtual && keyword) {
      setSelectedCategory("")
      setActiveKeyword(keyword)
      setInputValue(keyword)
    } else {
      setSelectedCategory(id)
      setActiveKeyword("")
      setInputValue("")
    }
  }

  const renderSubCategories = () => {
    if (!activeTabKey) return null
    if (activeTabKey === "sports") {
      return SPORTS_SUB_CATS.map((sub) => (
        <button
          key={sub.name}
          onClick={() => handleSubCategoryClick(0, true, sub.keyword)}
          className={`px-3 py-1 text-xs rounded-full border transition-colors whitespace-nowrap ${
            activeKeyword === sub.keyword
              ? "bg-white text-black border-white font-bold"
              : "bg-transparent text-gray-400 border-white/10"
          }`}
        >
          {sub.name}
        </button>
      ))
    }
    const currentGroup = categorizedData[activeTabKey]
    if (!currentGroup) return null
    const { children } = currentGroup
    return (
      <>
        {children.map((sub: any) => (
          <button
            key={sub.type_id}
            onClick={() => handleSubCategoryClick(sub.type_id, false)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors whitespace-nowrap ${
              String(selectedCategory) === String(sub.type_id)
                ? "bg-white text-black border-white font-bold"
                : "bg-transparent text-gray-400 border-white/10"
            }`}
          >
            {sub.type_name}
          </button>
        ))}
      </>
    )
  }

  return (
    <div
      ref={containerRef} // ✅ 绑定容器 Ref
      className="min-h-screen bg-[#050505] pb-20 selection:bg-emerald-500/30 overflow-hidden" // ✅ 加上 overflow-hidden
    >
      {/* 🟢 下拉刷新指示器 */}
      <div
        className="fixed top-0 left-0 right-0 flex justify-center z-50 pointer-events-none"
        style={{
          transform: `translateY(${pullY > 0 ? pullY : 0}px)`,
          opacity: pullY > 0 ? 1 : 0,
          transition: isRefreshing
            ? "transform 0.2s"
            : "transform 0.2s, opacity 0.2s",
        }}
      >
        <div className="mt-[-40px] bg-black/80 backdrop-blur text-emerald-500 p-2.5 rounded-full shadow-xl border border-white/10 flex items-center gap-2">
          <RefreshCw
            size={18}
            className={isRefreshing ? "animate-spin" : ""}
            style={{ transform: `rotate(${pullY * 3}deg)` }}
          />
          <span className="text-xs font-bold text-emerald-500">
            {isRefreshing ? "正在刷新..." : "下拉刷新"}
          </span>
        </div>
      </div>

      {/* 🔴 可滚动内容区域 (随手指下移) */}
      <div
        style={{
          transform: `translateY(${pullY}px)`,
          transition: isRefreshing
            ? "transform 0.2s"
            : "transform 0.3s cubic-bezier(0.215, 0.61, 0.355, 1)", // 模拟 iOS 回弹
        }}
        className="will-change-transform"
      >
        {/* Header Search Bar */}
        <div className="sticky top-0 z-30 bg-[#050505]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3">
          <form onSubmit={handleSubmit}>
            <div className="relative flex items-center bg-[#121212] rounded-full border border-white/10 focus-within:border-emerald-500/50 transition-colors">
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
                placeholder="搜索影片..."
                className="w-full bg-transparent text-white pl-10 pr-10 py-2.5 outline-none text-sm placeholder-gray-600"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />
              {inputValue && (
                <button
                  type="button"
                  onClick={() => {
                    setInputValue("")
                    setActiveKeyword("")
                  }}
                  className="absolute right-3 text-gray-500 hover:text-white p-1"
                >
                  <XCircle size={14} />
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Category Tabs */}
        <div className="pt-2 pb-2">
          {/* Level 1: Main Tabs */}
          <div className="flex items-center gap-4 px-4 overflow-x-auto no-scrollbar border-b border-white/5">
            <button
              onClick={() => {
                setActiveTabKey("")
                setSelectedCategory("")
                setInputValue("")
                setActiveKeyword("")
                window.scrollTo(0, 0)
              }}
              className={`py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-all ${
                !activeTabKey
                  ? "border-emerald-500 text-white"
                  : "border-transparent text-gray-500"
              }`}
            >
              全局搜索
            </button>

            {CATEGORY_UI_CONFIG.map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleTabClick(tab.key)}
                className={`
                py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-all relative flex items-center gap-1.5
                ${
                  activeTabKey === tab.key
                    ? "border-emerald-500 text-white"
                    : "border-transparent text-gray-500 hover:text-gray-300"
                }
              `}
              >
                {tab.name}
                {activeTabKey === tab.key && (
                  <span className="absolute inset-x-0 -bottom-0.5 h-0.5 bg-emerald-500 shadow-[0_-2px_10px_rgba(16,185,129,0.5)]" />
                )}
              </button>
            ))}
          </div>

          {/* Level 2: Sub Categories */}
          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              activeTabKey ? "max-h-14 opacity-100 mt-3" : "max-h-0 opacity-0"
            }`}
          >
            <div className="flex items-center gap-2 px-4 overflow-x-auto no-scrollbar">
              {renderSubCategories()}
            </div>
          </div>

          {/* Level 3: View Mode & Year Filter */}
          <div className="flex items-center gap-2 px-4 mt-3 overflow-x-auto no-scrollbar pb-2">
            <div className="flex gap-1 pr-3 border-r border-white/10 mr-1 flex-shrink-0">
              {VIEW_MODES.map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => setViewMode(mode.value as "grid" | "list")}
                  className={`p-1.5 rounded-md transition-colors ${
                    viewMode === mode.value
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "text-gray-600"
                  }`}
                >
                  {mode.icon}
                </button>
              ))}
            </div>
            {YEARS.map((year) => (
              <button
                key={year}
                onClick={() => {
                  setSelectedYear(selectedYear === year ? "" : year)
                  window.scrollTo(0, 0)
                }}
                className={`px-3 py-1 rounded-md text-xs whitespace-nowrap transition-colors ${
                  selectedYear === year
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-[#121212] text-gray-500 border border-white/5"
                }`}
              >
                {year}
              </button>
            ))}
          </div>
        </div>

        {/* Video Grid/List */}
        <div className="px-4 mt-2 min-h-[50vh] relative">
          {isFilterLoading && videos.length > 0 && (
            <div className="absolute inset-0 z-20 bg-[#050505]/70 backdrop-blur-[2px] flex items-start justify-center pt-32 transition-all duration-300">
              <div className="bg-[#1a1a1a] px-5 py-3 rounded-full border border-white/10 shadow-2xl flex items-center gap-3">
                <Loader2 className="animate-spin text-emerald-500" size={18} />
                <span className="text-xs text-gray-300 font-medium">
                  正在搜索资源...
                </span>
              </div>
            </div>
          )}

          {isFetching && !isFetchingNextPage && videos.length === 0 && (
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-3 gap-3 animate-pulse"
                  : "flex flex-col gap-3 animate-pulse"
              }
            >
              {[...Array(9)].map((_, i) => (
                <div
                  key={i}
                  className={`bg-white/5 rounded-lg border border-white/5 ${
                    viewMode === "grid" ? "aspect-[2/3]" : "h-24"
                  }`}
                ></div>
              ))}
            </div>
          )}

          {videos.length > 0 && (
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-3 gap-3"
                  : "flex flex-col gap-3"
              }
            >
              {videos.map((v, index) => {
                const displayVideo = { ...v, rating: v.rating || 0.0 }

                if (viewMode === "list") {
                  return (
                    <div
                      key={`${v.id}-${index}`}
                      className="flex gap-3 p-2 bg-[#1a1a1a] rounded-lg border border-white/5 active:scale-[0.98] transition-transform cursor-pointer"
                      onClick={() => (window.location.href = `/detail/${v.id}`)}
                    >
                      <div className="w-20 aspect-[2/3] rounded overflow-hidden flex-shrink-0 bg-gray-800">
                        <img
                          src={v.poster}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          alt={v.title}
                        />
                      </div>
                      <div className="flex-1 py-1 flex flex-col justify-center min-w-0">
                        <h3 className="text-sm font-bold text-gray-200 truncate">
                          {v.title}
                        </h3>
                        <div className="text-xs text-gray-500 mt-2 space-y-1">
                          <p>
                            {v.year} · {v.type}
                          </p>
                          <p className="truncate">{v.remarks}</p>
                        </div>
                      </div>
                    </div>
                  )
                }
                return (
                  <VideoCard key={`${v.id}-${index}`} video={displayVideo} />
                )
              })}
            </div>
          )}

          {isEmpty && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-600 space-y-4">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center border border-white/5">
                <Film size={24} />
              </div>
              <p className="text-xs">暂无相关资源</p>
            </div>
          )}

          {/* Load More Trigger */}
          <div ref={loadMoreRef} className="py-6 flex justify-center w-full">
            {isFetchingNextPage ? (
              <div className="flex items-center gap-2 text-emerald-500 text-xs px-4 py-2 rounded-full bg-emerald-500/10">
                <Loader2 className="animate-spin" size={14} /> 加载中...
              </div>
            ) : !hasNextPage && videos.length > 0 ? (
              <span className="text-[10px] text-gray-600 uppercase tracking-widest">
                - END -
              </span>
            ) : null}
          </div>

          {isError && (
            <div
              className="text-center py-10 text-red-500/50 text-xs cursor-pointer"
              onClick={() => refetch()}
            >
              加载失败，点击重试
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Search
