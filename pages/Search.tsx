import React, { useState, useEffect, useRef } from "react"
import { useSearchParams } from "react-router-dom"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { fetchCategories, fetchVideos } from "../services/api"
import { VideoSummary } from "../types"
import VideoCard from "../components/VideoCard"
import {
  Search as SearchIcon,
  Loader2,
  Clock,
  Flame,
  Sparkles,
  XCircle,
  Film,
  RefreshCw,
  Tv,
  Clapperboard,
  Music,
  Globe,
  LayoutGrid,
  List as ListIcon,
  Trophy,
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

const CATEGORY_TABS = [
  {
    id: 1,
    name: "电影",
    icon: <Film size={14} />,
    defaultId: 1,
    childrenIds: [6, 7, 8, 9, 10, 11, 12, 20, 34, 35, 43, 45],
  },
  {
    id: 2,
    name: "剧集",
    icon: <Tv size={14} />,
    defaultId: 2,
    childrenIds: [13, 14, 15, 16, 21, 22, 23, 24, 46],
  },
  {
    id: 4,
    name: "动漫",
    icon: <Clapperboard size={14} />,
    defaultId: 4,
    childrenIds: [29, 30, 31, 32, 33],
  },
  {
    id: 3,
    name: "综艺",
    icon: <Music size={14} />,
    defaultId: 3,
    childrenIds: [25, 26, 27, 28],
  },
  {
    id: 99,
    name: "体育",
    icon: <Trophy size={14} />,
    defaultId: null,
    childrenIds: [],
    isVirtual: true,
  },
]

const STORAGE_KEY = "GV_SEARCH_STATE"

const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams()

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

    let activeParentTab = null

    if (q && SPORTS_SUB_CATS.some((s) => s.keyword === q)) {
      activeParentTab = 99
    } else if (t) {
      const tNum = Number(t)
      const parent = CATEGORY_TABS.find(
        (p) => p.id === tNum || p.childrenIds?.includes(tNum)
      )
      if (parent) activeParentTab = parent.id
    } else if (!q) {
      activeParentTab = 1
    }

    const selectedCategory = t || (q ? "" : 1)

    return { q, t: selectedCategory, year, viewMode, activeParentTab }
  })

  // --- State ---
  const [inputValue, setInputValue] = useState(initialState.q)
  const [activeKeyword, setActiveKeyword] = useState(initialState.q)
  const [activeParentTab, setActiveParentTab] = useState<number | null>(
    initialState.activeParentTab
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

  // 🟢 修复：这里只保留 loadMoreRef，删除了 lastVideoElementRef 的相关代码
  const loadMoreRef = useRef<HTMLDivElement>(null)

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

  // --- API ---
  const { data: allApiCategories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    staleTime: 1000 * 60 * 60 * 24,
  })

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

  // --- 滚动监听 (监听 loadMoreRef) ---
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
      setActiveParentTab(null)
      setSelectedCategory("")
      ;(document.activeElement as HTMLElement)?.blur()
    }
  }

  useEffect(() => {
    if (!inputValue && activeKeyword) {
      setActiveKeyword("")
      if (!activeParentTab) {
        setActiveParentTab(1)
        setSelectedCategory(1)
      }
    }
  }, [inputValue])

  const handleParentTabClick = (tab: (typeof CATEGORY_TABS)[0]) => {
    window.scrollTo({ top: 0, behavior: "auto" })
    setActiveParentTab(tab.id)

    if (tab.id === 99) {
      setSelectedCategory("")
      setActiveKeyword("NBA")
      setInputValue("NBA")
    } else {
      setSelectedCategory(tab.defaultId || "")
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

  const renderSubCategories = () => {
    if (!activeParentTab) return null

    if (activeParentTab === 99) {
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

    const currentSubCats = allApiCategories.filter((cat) => {
      const parentConfig = CATEGORY_TABS.find((p) => p.id === activeParentTab)
      return parentConfig?.childrenIds?.includes(Number(cat.type_id))
    })

    return (
      <>
        <button
          onClick={() => {
            const parent = CATEGORY_TABS.find((p) => p.id === activeParentTab)
            if (parent) setSelectedCategory(parent.defaultId || "")
            window.scrollTo(0, 0)
          }}
          className={`px-3 py-1 text-xs rounded-full border transition-colors whitespace-nowrap ${
            String(selectedCategory) ===
            String(
              CATEGORY_TABS.find((p) => p.id === activeParentTab)?.defaultId
            )
              ? "bg-white text-black border-white font-bold"
              : "bg-transparent text-gray-400 border-white/10"
          }`}
        >
          推荐
        </button>

        {currentSubCats
          .filter(
            (sub) =>
              String(sub.type_id) !==
              String(
                CATEGORY_TABS.find((p) => p.id === activeParentTab)?.defaultId
              )
          )
          .map((sub) => (
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
      {/* Pull Loading */}
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

      {/* Top Search */}
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

      {/* Filters */}
      <div className="pt-2 pb-2">
        {/* 一级分类 */}
        <div className="flex items-center gap-4 px-4 overflow-x-auto no-scrollbar border-b border-white/5">
          <button
            onClick={() => {
              setActiveParentTab(null)
              setSelectedCategory("")
              setInputValue("")
              setActiveKeyword("")
              window.scrollTo(0, 0)
            }}
            className={`py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-all ${
              !activeParentTab
                ? "border-emerald-500 text-white"
                : "border-transparent text-gray-500"
            }`}
          >
            全局搜索
          </button>
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleParentTabClick(tab)}
              className={`
                py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-all relative
                ${
                  activeParentTab === tab.id
                    ? "border-emerald-500 text-white"
                    : "border-transparent text-gray-500 hover:text-gray-300"
                }
              `}
            >
              {tab.name}
              {activeParentTab === tab.id && (
                <span className="absolute inset-x-0 -bottom-0.5 h-0.5 bg-emerald-500 shadow-[0_-2px_10px_rgba(16,185,129,0.5)]" />
              )}
            </button>
          ))}
        </div>

        {/* 二级分类 */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            activeParentTab ? "max-h-14 opacity-100 mt-3" : "max-h-0 opacity-0"
          }`}
        >
          <div className="flex items-center gap-2 px-4 overflow-x-auto no-scrollbar">
            {renderSubCategories()}
          </div>
        </div>

        {/* 排序与年份 */}
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

      {/* 结果列表 */}
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

              // 网格模式：🔴 修复点：移除了 ref={lastVideoElementRef}，因为触底检测由下面的 div 负责
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

        {/* 🟢 触底加载哨兵 */}
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
