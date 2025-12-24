import React, { useState, useEffect, useCallback, useRef } from "react"
import { fetchCategories, fetchVideos } from "../services/api"
import { Category, VideoSummary } from "../types"
import VideoCard from "../components/VideoCard"
import { useSearchParams } from "react-router-dom"
import toast from "react-hot-toast"
import {
  Search as SearchIcon,
  Loader2,
  Filter,
  Clock,
  Flame,
  Layers,
  Sparkles,
  XCircle,
  Film,
} from "lucide-react"

const YEARS = [
  "2025",
  "2024",
  "2023",
  "2022",
  "2021",
  "2020",
  "2010-2019",
  "2000-2009",
]
const SORTS = [
  { label: "最新", value: "time", icon: <Clock size={12} /> },
  { label: "最热", value: "hits", icon: <Flame size={12} /> },
  { label: "评分", value: "score", icon: <Sparkles size={12} /> },
]

const Search = () => {
  // 1. 获取 URL 参数
  const [searchParams, setSearchParams] = useSearchParams()

  // 初始化参数读取
  const initialQuery = searchParams.get("q") || ""
  const initialType = searchParams.get("t") || "" // 修复：读取分类参数

  // --- State ---
  const [categories, setCategories] = useState<Category[]>([])
  const [videos, setVideos] = useState<VideoSummary[]>([])

  // 搜索词状态
  const [inputValue, setInputValue] = useState(initialQuery)
  const [activeKeyword, setActiveKeyword] = useState(initialQuery)

  // 筛选状态
  const [selectedCategory, setSelectedCategory] = useState<number | string>(
    initialType
  ) // 修复：应用初始分类
  const [selectedYear, setSelectedYear] = useState("")
  const [selectedSort, setSelectedSort] = useState("time")

  // 分页与加载
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  // --- Refs ---
  const abortControllerRef = useRef<AbortController | null>(null)
  const observer = useRef<IntersectionObserver | null>(null)

  const lastVideoElementRef = useCallback(
    (node: HTMLDivElement) => {
      if (loading || loadingMore) return
      if (observer.current) observer.current.disconnect()
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setPage((prev) => prev + 1)
        }
      })
      if (node) observer.current.observe(node)
    },
    [loading, loadingMore, hasMore]
  )

  // --- Effects ---

  // 1. 初始化分类数据
  useEffect(() => {
    fetchCategories().then(setCategories)
  }, [])

  // 2. 监听 URL 参数变化 (处理 AI 跳转 或 浏览器前进后退)
  useEffect(() => {
    const query = searchParams.get("q")
    const type = searchParams.get("t")

    // 如果 URL 里的 q 变了，且跟当前不一样，同步到内部状态
    if (query !== null && query !== activeKeyword) {
      setInputValue(query)
      setActiveKeyword(query)
    }

    // 如果 URL 里的 t 变了，同步分类
    if (type !== null && type !== String(selectedCategory)) {
      setSelectedCategory(type)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // 3. 修复痛点：监听输入框清空
  // 当用户手动删除所有文字时，自动重置搜索，防止带入旧关键词
  useEffect(() => {
    if (inputValue === "" && activeKeyword !== "") {
      setActiveKeyword("")
    }
  }, [inputValue, activeKeyword])

  // 4. 核心搜索逻辑 (重置型请求)
  useEffect(() => {
    // 取消上一次未完成的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    const doSearch = async () => {
      setLoading(true)
      setVideos([]) // 清空旧数据
      setPage(1)
      setHasMore(true)

      try {
        const res = await fetchVideos(
          {
            wd: activeKeyword,
            t: selectedCategory,
            year: selectedYear === "全部" ? "" : selectedYear,
            pg: 1,
            by: selectedSort,
          },
          controller.signal
        )

        if (!res.list || res.list.length === 0) {
          if (activeKeyword)
            toast("未找到相关资源", { icon: "🤔", id: "search_empty" })
          setHasMore(false)
        } else {
          setVideos(res.list)
          setHasMore(true)
        }
      } catch (e: any) {
        if (e.name === "CanceledError" || e.message === "canceled") return
        setHasMore(false)
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    doSearch()

    return () => {
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKeyword, selectedCategory, selectedYear, selectedSort])

  // 5. 加载更多逻辑
  useEffect(() => {
    if (page === 1) return

    const loadMoreData = async () => {
      setLoadingMore(true)
      try {
        const res = await fetchVideos({
          wd: activeKeyword,
          t: selectedCategory,
          year: selectedYear === "全部" ? "" : selectedYear,
          pg: page,
          by: selectedSort,
        })

        if (!res.list || res.list.length === 0) {
          setHasMore(false)
          toast("到底了", {
            icon: "🔚",
            style: { borderRadius: "10px", background: "#333", color: "#fff" },
          })
        } else {
          setVideos((prev) => [...prev, ...res.list])
        }
      } catch (e) {
        setHasMore(false)
      } finally {
        setLoadingMore(false)
      }
    }

    loadMoreData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  // --- Handlers ---

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputValue.trim() !== activeKeyword) {
      setActiveKeyword(inputValue.trim())
      // 更新 URL 中的 q 参数 (可选，为了分享链接)
      setSearchParams((prev) => {
        if (inputValue.trim()) prev.set("q", inputValue.trim())
        else prev.delete("q")
        return prev
      })
      ;(document.activeElement as HTMLElement)?.blur()
    }
  }

  const handleClear = () => {
    setInputValue("")
    // useEffect 会自动处理 activeKeyword 的重置
    setSearchParams((prev) => {
      prev.delete("q")
      return prev
    })
  }

  // 优化：切换分类同时更新 URL，方便用户分享链接
  const handleCategoryChange = (id: string | number) => {
    setSelectedCategory(id)
    setSearchParams((prev) => {
      if (id) prev.set("t", String(id))
      else prev.delete("t")
      return prev
    })
  }

  // --- Components ---
  const FilterChip = ({ active, onClick, children, icon }: any) => (
    <button
      onClick={onClick}
      className={`
            flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-300 border backdrop-blur-sm whitespace-nowrap
            ${
              active
                ? "bg-gradient-to-r from-emerald-500 to-cyan-600 border-transparent text-white shadow-[0_0_10px_rgba(16,185,129,0.4)] transform scale-105"
                : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-emerald-500/30 hover:text-white"
            }
        `}
    >
      {icon}
      {children}
    </button>
  )

  return (
    <div className="min-h-screen bg-[#050505] pb-20 selection:bg-emerald-500/30">
      {/* 顶部搜索栏 */}
      <div className="sticky top-0 z-30 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <form onSubmit={handleSubmit} className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-xl opacity-20 group-focus-within:opacity-100 transition duration-500 blur"></div>
          <div className="relative flex items-center bg-[#121212] rounded-xl overflow-hidden">
            <button
              type="submit"
              className="pl-4 text-gray-400 hover:text-white transition-colors"
            >
              <SearchIcon size={18} />
            </button>
            <input
              type="search"
              placeholder="搜索片名、导演、演员..."
              className="w-full bg-transparent text-white px-3 py-3 outline-none placeholder-gray-600 text-sm"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
            {inputValue && (
              <button
                type="button"
                onClick={handleClear}
                className="pr-4 text-gray-500 hover:text-white"
              >
                <XCircle size={16} />
              </button>
            )}
          </div>
        </form>
      </div>

      {/* 筛选区域 */}
      <div className="px-4 py-4 space-y-4">
        {/* 分类 */}
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
            <Filter size={14} className="text-emerald-400" />
          </div>
          <FilterChip
            active={selectedCategory === ""}
            onClick={() => handleCategoryChange("")}
          >
            全部
          </FilterChip>
          {categories.map((cat) => (
            <FilterChip
              key={cat.type_id}
              active={String(selectedCategory) === String(cat.type_id)}
              onClick={() => handleCategoryChange(cat.type_id)}
            >
              {cat.type_name}
            </FilterChip>
          ))}
        </div>

        {/* 年份 */}
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
            <Clock size={14} className="text-cyan-400" />
          </div>
          <FilterChip
            active={selectedYear === ""}
            onClick={() => setSelectedYear("")}
          >
            全部年份
          </FilterChip>
          {YEARS.map((year) => (
            <FilterChip
              key={year}
              active={selectedYear === year}
              onClick={() => setSelectedYear(year)}
            >
              {year}
            </FilterChip>
          ))}
        </div>

        {/* 排序 */}
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar border-t border-white/5 pt-4 mt-2">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
            <Layers size={14} className="text-purple-400" />
          </div>
          {SORTS.map((sort) => (
            <FilterChip
              key={sort.value}
              active={selectedSort === sort.value}
              icon={sort.icon}
              onClick={() => setSelectedSort(sort.value)}
            >
              {sort.label}
            </FilterChip>
          ))}
        </div>
      </div>

      {/* 结果区域 */}
      <div className="px-4 mt-2 min-h-[50vh]">
        {loading ? (
          <div className="grid grid-cols-3 gap-3 animate-pulse">
            {[...Array(9)].map((_, i) => (
              <div
                key={i}
                className="aspect-[2/3] bg-white/5 rounded-lg border border-white/5"
              ></div>
            ))}
          </div>
        ) : videos.length > 0 ? (
          <div className="grid grid-cols-3 gap-3">
            {videos.map((v, index) => {
              if (videos.length === index + 1) {
                return (
                  <div ref={lastVideoElementRef} key={`${v.id}-${index}`}>
                    <VideoCard video={v} />
                  </div>
                )
              } else {
                return <VideoCard key={`${v.id}-${index}`} video={v} />
              }
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-gray-600 space-y-4">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center animate-bounce border border-white/5">
              <Film size={32} className="text-gray-500" />
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-400">未找到相关资源</p>
              <p className="text-xs text-gray-600 mt-1">
                {activeKeyword
                  ? `"${activeKeyword}" 暂无结果`
                  : "尝试更换筛选条件"}
              </p>
            </div>
          </div>
        )}

        {loadingMore && (
          <div className="flex justify-center py-6">
            <div className="flex items-center gap-2 text-emerald-500 text-xs font-bold bg-emerald-500/10 px-4 py-2 rounded-full border border-emerald-500/20">
              <Loader2 className="animate-spin" size={14} />
              LOADING...
            </div>
          </div>
        )}

        {!hasMore && videos.length > 0 && (
          <div className="flex justify-center py-8 opacity-30">
            <span className="text-[10px] text-gray-500 tracking-widest uppercase">
              - End of Results -
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default Search
