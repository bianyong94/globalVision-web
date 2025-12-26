import React, { useState, useEffect, useCallback, useRef } from "react"
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
} from "lucide-react"

// --- 1. 常量定义 ---
const YEARS = []
for (let i = 0; i < 10; i++) {
  const year = new Date().getFullYear() - i
  YEARS.push(String(year))
}
YEARS.push("更早")
const SORTS = [
  { label: "最新", value: "time", icon: <Clock size={12} /> },
  { label: "最热", value: "hits", icon: <Flame size={12} /> },
  { label: "评分", value: "score", icon: <Sparkles size={12} /> },
]

const CATEGORY_TABS = [
  {
    id: 1,
    name: "电影",
    icon: <Film size={14} />,
    childrenKeywords: [
      "动作",
      "喜剧",
      "爱情",
      "科幻",
      "恐怖",
      "剧情",
      "战争",
      "灾难",
      "微电影",
      "伦理",
    ],
  },
  {
    id: 2,
    name: "剧集",
    icon: <Tv size={14} />,
    childrenKeywords: [
      "国产",
      "港台",
      "日韩",
      "欧美",
      "海外",
      "泰国",
      "香港",
      "台湾",
      "韩国",
      "日本",
      "美国",
    ],
  },
  {
    id: 4,
    name: "动漫",
    icon: <Clapperboard size={14} />,
    childrenKeywords: ["动漫", "动画", "新番"],
  },
  {
    id: 3,
    name: "综艺",
    icon: <Music size={14} />,
    childrenKeywords: ["综艺", "真人秀", "晚会"],
  },
  {
    id: 20,
    name: "纪录片",
    icon: <Globe size={14} />,
    childrenKeywords: ["纪录", "记录", "解说", "篮球", "足球", "体育"],
  },
]

const STORAGE_KEY = "GV_SEARCH_STATE"

const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams()

  const [initialState] = useState(() => {
    const savedStateJSON = sessionStorage.getItem(STORAGE_KEY)
    const savedState = savedStateJSON ? JSON.parse(savedStateJSON) : {}
    const urlQ = searchParams.get("q")
    const urlT = searchParams.get("t")
    const q = urlQ !== null ? urlQ : savedState.q || ""
    const t = urlT !== null ? urlT : savedState.t || ""
    const year = savedState.year || ""
    const sort = savedState.sort || "time"
    const activeParentTab = t ? Number(t) || null : q ? null : 1
    const selectedCategory = t || (q ? "" : 1)
    return { q, t: selectedCategory, year, sort, activeParentTab }
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
  const [selectedSort, setSelectedSort] = useState(initialState.sort)

  const [pullY, setPullY] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const touchStartRef = useRef(0)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stateToSave = {
      q: activeKeyword,
      t: selectedCategory,
      year: selectedYear,
      sort: selectedSort,
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave))
    setSearchParams(
      (prev) => {
        const newParams = new URLSearchParams(prev)
        if (activeKeyword) newParams.set("q", activeKeyword)
        else newParams.delete("q")
        if (selectedCategory) newParams.set("t", String(selectedCategory))
        else newParams.delete("t")
        if (newParams.toString() !== prev.toString()) return newParams
        return prev
      },
      { replace: true }
    )
  }, [
    activeKeyword,
    selectedCategory,
    selectedYear,
    selectedSort,
    setSearchParams,
  ])

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
    queryKey: [
      "videos",
      activeKeyword,
      selectedCategory,
      selectedYear,
      selectedSort,
    ],
    queryFn: async ({ pageParam = 1, signal }) => {
      const res = await fetchVideos(
        {
          wd: activeKeyword,
          t: selectedCategory,
          year:
            selectedYear === "全部" || selectedYear === "更早"
              ? ""
              : selectedYear,
          pg: pageParam,
          by: selectedSort,
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
      const currentPage = Number(lastPage.page)
      const totalPages = Number(lastPage.pagecount)
      if (
        !isNaN(currentPage) &&
        !isNaN(totalPages) &&
        currentPage < totalPages
      ) {
        return currentPage + 1
      }
      return undefined
    },
    staleTime: 1000 * 60 * 5,
    placeholderData: (prev) => prev,
  })

  const videos = data?.pages.flatMap((page) => page.list) || []
  const isEmpty = !isFetching && videos.length === 0

  // 🔴 核心状态判断：是否正在进行"筛选刷新" (不是加载更多，不是下拉刷新)
  // 当 isFetching 为 true，但不是在加载下一页，且也不是下拉刷新时，说明是用户点了分类或搜索
  const isFilterLoading = isFetching && !isFetchingNextPage && !isRefreshing

  useEffect(() => {
    const currentTarget = loadMoreRef.current
    if (!currentTarget) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 0.1, rootMargin: "200px" }
    )
    observer.observe(currentTarget)
    return () => {
      if (currentTarget) observer.unobserve(currentTarget)
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  useEffect(() => {
    const query = searchParams.get("q")
    if (query !== null && query !== activeKeyword) {
      setInputValue(query)
      setActiveKeyword(query)
      setActiveParentTab(null)
      setSelectedCategory("")
    }
  }, [searchParams])

  useEffect(() => {
    if (inputValue === "" && activeKeyword !== "") {
      setActiveKeyword("")
      if (!activeParentTab) {
        setActiveParentTab(1)
        setSelectedCategory(1)
      }
    }
  }, [inputValue])

  // --- Handlers ---
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputValue.trim() !== activeKeyword) {
      setActiveKeyword(inputValue.trim())
      setActiveParentTab(null)
      setSelectedCategory("")
      setSearchParams((prev) => {
        if (inputValue.trim()) prev.set("q", inputValue.trim())
        else prev.delete("q")
        prev.delete("t")
        return prev
      })
      ;(document.activeElement as HTMLElement)?.blur()
    }
  }

  const handleParentTabClick = (parentId: number) => {
    if (activeParentTab === parentId && !activeKeyword) return
    // 切换分类时，为了体验更好，建议滚动到顶部
    window.scrollTo({ top: 0, behavior: "auto" })
    setActiveParentTab(parentId)
    setSelectedCategory(parentId)
    setInputValue("")
    setActiveKeyword("")
    setSearchParams((prev) => {
      prev.set("t", String(parentId))
      prev.delete("q")
      return prev
    })
  }

  const handleSubCategoryClick = (id: number) => {
    window.scrollTo({ top: 0, behavior: "auto" })
    setSelectedCategory(id)
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

  const currentSubCategories = allApiCategories.filter((cat) => {
    if (!activeParentTab) return false
    if (String(cat.type_id) === String(activeParentTab)) return false
    const parent = CATEGORY_TABS.find((p) => p.id === activeParentTab)
    if (!parent) return false
    return parent.childrenKeywords.some((keyword) =>
      cat.type_name.includes(keyword)
    )
  })

  return (
    <div
      className="min-h-screen bg-[#050505] pb-20 selection:bg-emerald-500/30"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* 下拉 Loading */}
      <div
        className="fixed top-16 left-0 right-0 flex justify-center z-40 transition-all duration-300 pointer-events-none"
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

      {/* 顶部搜索 */}
      <div className="sticky top-0 z-30 bg-[#050505]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <form onSubmit={handleSubmit}>
          <div className="relative flex items-center bg-[#121212] rounded-full border border-white/10 focus-within:border-emerald-500/50 transition-colors">
            {/* 🟢 优化：如果正在过滤加载，左侧显示 Spinner */}
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

      {/* 筛选区 */}
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
              onClick={() => handleParentTabClick(tab.id)}
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
            <button
              onClick={() => {
                setSelectedCategory(activeParentTab!)
                window.scrollTo(0, 0)
              }}
              className={`px-3 py-1 text-xs rounded-full border transition-colors whitespace-nowrap ${
                String(selectedCategory) === String(activeParentTab)
                  ? "bg-white text-black border-white font-bold"
                  : "bg-transparent text-gray-400 border-white/10"
              }`}
            >
              全部
            </button>
            {currentSubCategories.map((sub) => (
              <button
                key={sub.type_id}
                onClick={() => handleSubCategoryClick(sub.type_id)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors whitespace-nowrap ${
                  String(selectedCategory) === String(sub.type_id)
                    ? "bg-white text-black border-white font-bold"
                    : "bg-transparent text-gray-400 border-white/10"
                }`}
              >
                {sub.type_name}
              </button>
            ))}
          </div>
        </div>

        {/* 排序与年份 */}
        <div className="flex items-center gap-2 px-4 mt-3 overflow-x-auto no-scrollbar pb-2">
          <div className="flex gap-1 pr-3 border-r border-white/10 mr-1 flex-shrink-0">
            {SORTS.map((sort) => (
              <button
                key={sort.value}
                onClick={() => {
                  setSelectedSort(sort.value)
                  window.scrollTo(0, 0)
                }}
                className={`p-1.5 rounded-md ${
                  selectedSort === sort.value
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "text-gray-500"
                }`}
              >
                {sort.icon}
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

      {/* 结果列表容器 */}
      {/* ⚡️ 添加 relative，为 Loading 遮罩提供定位基准 */}
      <div
        className="px-4 mt-2 min-h-[50vh] transition-transform duration-300 relative"
        style={{ transform: `translateY(${pullY}px)` }}
      >
        {/* 🟢 新增：过滤/搜索时的悬浮遮罩 Loading */}
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

        {/* 初次加载 Loading (只有当完全没有旧数据时才显示骨架屏) */}
        {isFetching && !isFetchingNextPage && videos.length === 0 && (
          <div className="grid grid-cols-3 gap-3 animate-pulse">
            {[...Array(9)].map((_, i) => (
              <div
                key={i}
                className="aspect-[2/3] bg-white/5 rounded-lg border border-white/5"
              ></div>
            ))}
          </div>
        )}

        {/* 列表数据 */}
        {videos.length > 0 && (
          <div
            className={`grid grid-cols-3 gap-3 transition-opacity duration-300 ${
              isFilterLoading ? "opacity-50" : "opacity-100"
            }`}
          >
            {videos.map((v, index) => (
              <VideoCard
                key={`${v.id}-${index}`}
                video={{ ...v, rating: v.rating || 0.0 }}
              />
            ))}
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

        {/* 触底检测 */}
        <div ref={loadMoreRef} className="py-6 flex justify-center w-full">
          {isFetchingNextPage ? (
            <div className="flex items-center gap-2 text-emerald-500 text-xs px-4 py-2 rounded-full bg-emerald-500/10">
              <Loader2 className="animate-spin" size={14} /> 加载中...
            </div>
          ) : hasNextPage ? (
            <span className="text-xs text-gray-600">上滑加载更多</span>
          ) : videos.length > 0 ? (
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
