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

// 体育专属虚拟子分类 (保持不变)
const SPORTS_SUB_CATS = [
  { name: "全部体育", keyword: "体育" },
  { name: "篮球", keyword: "NBA" },
  { name: "足球", keyword: "足球" },
  { name: "F1", keyword: "F1" },
  { name: "斯诺克", keyword: "斯诺克" },
]

// ✨ 核心修改：仅定义 UI Tab，不再绑定具体 ID
// typeKey 用于后续匹配归类逻辑
const CATEGORY_UI_CONFIG = [
  { key: "movie", name: "电影", icon: <Film size={14} /> },
  { key: "tv", name: "剧集", icon: <Tv size={14} /> },
  { key: "anime", name: "动漫", icon: <Clapperboard size={14} /> },
  { key: "variety", name: "综艺", icon: <Music size={14} /> },
  { key: "sports", name: "体育", icon: <Trophy size={14} />, isVirtual: true },
]

const STORAGE_KEY = "GV_SEARCH_STATE"

const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams()

  // --- API ---
  const { data: allApiCategories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    staleTime: 1000 * 60 * 60 * 24,
  })

  // ✨ 核心逻辑：智能分类算法
  // 将 API 返回的扁平数据，根据名字关键词，自动归类到 UI Tab 下
  const categorizedData = useMemo(() => {
    const buckets: Record<
      string,
      { rootId: string | number; children: any[] }
    > = {
      movie: { rootId: "", children: [] },
      tv: { rootId: "", children: [] },
      anime: { rootId: "", children: [] },
      variety: { rootId: "", children: [] },
    }

    allApiCategories.forEach((cat: any) => {
      const name = cat.type_name || ""
      const id = cat.type_id

      // 1. 寻找根分类 ID (用于"全部"按钮)
      // 如果 API 里有一个分类叫 "电影" 或 "电视剧"，它通常是大类入口
      if (name === "电影" || name === "全部电影") buckets.movie.rootId = id
      if (name === "电视剧" || name === "连续剧" || name === "电视连续剧")
        buckets.tv.rootId = id
      if (name === "动漫" || name === "全集动漫") buckets.anime.rootId = id
      if (name === "综艺" || name === "综艺频道") buckets.variety.rootId = id

      // 2. 归类子分类 (基于关键词正则)
      // 排除掉 root 本身，避免子分类里出现"电影"
      if (buckets.movie.rootId === id) return
      if (buckets.tv.rootId === id) return
      if (buckets.anime.rootId === id) return
      if (buckets.variety.rootId === id) return

      // --- 动漫判断 (优先级最高，防止"动画片"被归为电影) ---
      if (/动漫|动画/.test(name)) {
        buckets.anime.children.push(cat)
        return
      }

      // --- 综艺判断 ---
      if (/综艺/.test(name)) {
        buckets.variety.children.push(cat)
        return
      }

      // --- 剧集判断 ---
      if (/剧|连续剧/.test(name) && !/动画|动漫/.test(name)) {
        buckets.tv.children.push(cat)
        return
      }

      // --- 电影判断 (剩余带"片"的，或者特定类型) ---
      if (
        /片|电影|微电影/.test(name) ||
        /动作|喜剧|爱情|科幻|恐怖|剧情|战争|记录|纪录|灾难|悬疑|犯罪|奇幻|预告/.test(
          name
        )
      ) {
        buckets.movie.children.push(cat)
        return
      }
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

    // 初始化 Tab：如果有 keyword 且是体育相关
    let activeTabKey = "movie" // 默认电影
    if (q && SPORTS_SUB_CATS.some((s) => s.keyword === q)) {
      activeTabKey = "sports"
    } else if (t) {
      // 根据 t (ID) 反查属于哪个 Tab
      // 遍历 categorizedData 找 ID
      for (const [key, data] of Object.entries(categorizedData)) {
        if (
          String(data.rootId) === String(t) ||
          data.children.some((c: any) => String(c.type_id) === String(t))
        ) {
          activeTabKey = key
          break
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

  // 使用 Key (string) 而不是 ID 来控制 Tab
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

  const [pullY, setPullY] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const touchStartRef = useRef(0)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // --- 修正：确保初始加载时，如果 API 数据刚回来，能正确设置默认 ID ---
  useEffect(() => {
    // 只有当没有选中分类，且不在搜索模式，且不是体育时，才自动设置当前 Tab 的默认推荐 ID
    if (
      !selectedCategory &&
      !activeKeyword &&
      activeTabKey !== "sports" &&
      categorizedData[activeTabKey]?.rootId
    ) {
      setSelectedCategory(categorizedData[activeTabKey].rootId)
    }
  }, [categorizedData, activeTabKey, selectedCategory, activeKeyword])

  // --- Persistence ---
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

  const videos = data?.pages.flatMap((page) => page.list) || []
  const isEmpty = !isFetching && videos.length === 0
  const isFilterLoading = isFetching && !isFetchingNextPage && !isRefreshing

  // --- Scroll Observer ---
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

  // --- Handlers ---
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputValue.trim() !== activeKeyword) {
      setActiveKeyword(inputValue.trim())
      // 搜索时，取消分类选中
      setActiveTabKey("")
      setSelectedCategory("")
      ;(document.activeElement as HTMLElement)?.blur()
    }
  }

  // 清空搜索时的逻辑
  useEffect(() => {
    if (!inputValue && activeKeyword) {
      setActiveKeyword("")
      // 如果之前是在全网搜索，清空后默认回电影
      if (!activeTabKey) {
        setActiveTabKey("movie")
        // 设置为电影的 rootId
        if (categorizedData.movie.rootId)
          setSelectedCategory(categorizedData.movie.rootId)
      }
    }
  }, [inputValue, categorizedData])

  const handleTabClick = (key: string) => {
    window.scrollTo({ top: 0, behavior: "auto" })
    setActiveTabKey(key)

    if (key === "sports") {
      setSelectedCategory("")
      setActiveKeyword("NBA")
      setInputValue("NBA")
    } else {
      // 获取该分类的 rootId (例如 "电视剧" 的 ID)
      const defaultId = categorizedData[key]?.rootId || ""
      setSelectedCategory(defaultId)
      setActiveKeyword("")
      setInputValue("")
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

  // --- Touch Logic (Pull to Refresh) ---
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) touchStartRef.current = e.touches[0].clientY
  }
  const handleTouchMove = (e: React.TouchEvent) => {
    const currentY = e.touches[0].clientY
    const diff = currentY - touchStartRef.current
    if (window.scrollY === 0 && diff > 0) setPullY(Math.min(diff * 0.4, 80))
  }
  const handleTouchEnd = async () => {
    if (pullY > 50) {
      setIsRefreshing(true)
      await refetch()
      setIsRefreshing(false)
    }
    setPullY(0)
  }

  // --- Render Helpers ---
  const renderSubCategories = () => {
    if (!activeTabKey) return null

    // 1. 体育特殊处理
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

    // 2. 常规分类渲染
    const currentGroup = categorizedData[activeTabKey]
    if (!currentGroup) return null

    const { rootId, children } = currentGroup

    return (
      <>
        {/* "全部/推荐" 按钮 -> 对应 Root ID */}
        {rootId && (
          <button
            onClick={() => {
              setSelectedCategory(rootId)
              window.scrollTo(0, 0)
            }}
            className={`px-3 py-1 text-xs rounded-full border transition-colors whitespace-nowrap ${
              String(selectedCategory) === String(rootId)
                ? "bg-white text-black border-white font-bold"
                : "bg-transparent text-gray-400 border-white/10"
            }`}
          >
            全部
          </button>
        )}

        {/* 子分类按钮 */}
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
      className="min-h-screen bg-[#050505] pb-20 selection:bg-emerald-500/30"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Loading Spinner for Pull Refresh */}
      <div
        className="fixed top-16 left-0 right-0 flex justify-center z-40 pointer-events-none transition-all"
        style={{
          transform: `translateY(${
            pullY > 0 ? pullY : isRefreshing ? 50 : 0
          }px)`,
          opacity: pullY > 0 || isRefreshing ? 1 : 0,
        }}
      >
        <div className="bg-black/80 backdrop-blur text-emerald-500 p-2 rounded-full shadow-xl border border-white/10">
          <RefreshCw
            size={20}
            className={isRefreshing ? "animate-spin" : ""}
            style={{ transform: `rotate(${pullY * 2}deg)` }}
          />
        </div>
      </div>

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
              <SearchIcon size={16} className="absolute left-3 text-gray-500" />
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
      <div
        className="px-4 mt-2 min-h-[50vh] transition-transform duration-300 relative"
        style={{ transform: `translateY(${pullY}px)` }}
      >
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
              return <VideoCard key={`${v.id}-${index}`} video={displayVideo} />
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
  )
}

export default Search
