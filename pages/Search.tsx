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
  // 现在体育不是虚拟的了，是真实存在的分类
  { key: "sports", name: "体育", icon: <Trophy size={14} /> },
  // ✨ 新增“其他” Tab
  { key: "other", name: "精选", icon: <MoreHorizontal size={14} /> },
]

const STORAGE_KEY = "GV_SEARCH_STATE"

interface CategoryData {
  rootId: number
  children: Array<{
    type_id: string
    type_name: string
    type_pid: string
  }>
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
    // 1. 初始化篮子 (ID 必须与 server.js 定义的 STANDARD_GROUPS 一致)
    const buckets: Record<string, { rootId: number; children: any[] }> = {
      movie: { rootId: 1, children: [] },
      tv: { rootId: 2, children: [] },
      variety: { rootId: 3, children: [] },
      anime: { rootId: 4, children: [] },
      sports: { rootId: 5, children: [] }, // 现在体育也是后端返回的一等公民了
    }

    allApiCategories.forEach((cat: any) => {
      const pid = parseInt(cat.type_pid)
      const id = parseInt(cat.type_id)

      // 如果是父类自己，跳过 (rootId 已经预设好了)
      if (pid === 0) return

      // 2. 傻瓜式归类：后端说它是谁，它就是谁
      if (pid === 1) buckets.movie.children.push(cat)
      else if (pid === 2) buckets.tv.children.push(cat)
      else if (pid === 3) buckets.variety.children.push(cat)
      else if (pid === 4) buckets.anime.children.push(cat)
      else if (pid === 5) buckets.sports.children.push(cat)
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

    // 初始化 Tab
    let activeTabKey = "movie"
    if (q && SPORTS_SUB_CATS.some((s) => s.keyword === q)) {
      activeTabKey = "sports"
    } else if (t) {
      // 根据 t (ID) 反查属于哪个 Tab
      const targetId = parseInt(t)
      // 检查是否是 RootID
      if (targetId === 1) activeTabKey = "movie"
      else if (targetId === 2) activeTabKey = "tv"
      else if (targetId === 3) activeTabKey = "variety"
      else if (targetId === 4) activeTabKey = "anime"
      else {
        // 检查子分类
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

  const [pullY, setPullY] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const touchStartRef = useRef(0)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // --- 修正：切换 Tab 时，自动选中该 Tab 的 Root ID ---
  // 仅在手动切换 Tab 或初始化且无选中子分类时触发
  useEffect(() => {
    // 1. 如果正在搜索，不干扰
    if (activeKeyword && activeTabKey !== "sports") return
    // 2. 体育 Tab 特殊逻辑
    if (activeTabKey === "sports") {
      if (!activeKeyword) {
        // 如果切到体育但没关键词，默认给第一个
        setActiveKeyword(SPORTS_SUB_CATS[0].keyword)
        setInputValue(SPORTS_SUB_CATS[0].keyword)
      }
      return
    }

    // 如果当前选中的分类 不属于 当前Tab (防止切换Tab后还保留着上个Tab的子分类ID)
    const currentGroup = categorizedData[activeTabKey]
    if (!currentGroup || currentGroup.children.length === 0) return

    // 3. 检查当前选中的 ID 是否有效（是否属于当前 Tab 的子分类）
    const isCurrentIdValid = currentGroup.children.some(
      (c) => String(c.type_id) === String(selectedCategory)
    )

    // ✨ 修改点：如果 ID 无效（比如刚进来，或者从别的 Tab 切过来），强制选中第一个子分类
    if (!isCurrentIdValid) {
      setSelectedCategory(currentGroup.children[0].type_id)
    }
  }, [activeTabKey, categorizedData, activeKeyword, selectedCategory])

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
      // 构造请求
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
      // 搜索模式下取消所有分类选中，且 UI 上的 Tab 高亮建议取消或保持当前
      setActiveTabKey("")
      setSelectedCategory("")
      ;(document.activeElement as HTMLElement)?.blur()
    }
  }

  // 清空搜索逻辑
  useEffect(() => {
    if (!inputValue && activeKeyword) {
      setActiveKeyword("")
      // 恢复默认状态
      if (!activeTabKey) {
        setActiveTabKey("movie")
        setSelectedCategory(1) // 默认回电影
      }
    }
  }, [inputValue, activeKeyword, activeTabKey])

  const handleTabClick = (key: string) => {
    window.scrollTo({ top: 0, behavior: "auto" })
    setActiveTabKey(key)

    // 清空搜索状态
    setActiveKeyword("")
    setInputValue("")

    if (key === "sports") {
      // 体育特殊处理：默认选中第一个虚拟子分类
      const firstSport = SPORTS_SUB_CATS[0]
      setSelectedCategory("") // 体育没有真实 ID，用 keyword
      setActiveKeyword(firstSport.keyword)
      setInputValue(firstSport.keyword)
    } else {
      // 常规分类：默认选中第一个子分类
      const currentGroup = categorizedData[key]
      if (currentGroup && currentGroup.children.length > 0) {
        // ✨ 修改点：直接选中第一个子分类 ID
        setSelectedCategory(currentGroup.children[0].type_id)
      } else {
        // 兜底：如果没有子分类，才用 rootId (虽然理论上都有子分类)
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
        {/* "全部" 按钮 -> 对应 Root ID */}
        {/* <button
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
        </button> */}

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
