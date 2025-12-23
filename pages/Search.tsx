import React, { useState, useEffect, useCallback, useRef } from "react"
import { fetchCategories, fetchVideos } from "../services/api"
import { Category, VideoSummary } from "../types"
import VideoCard from "../components/VideoCard"
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

const SearchPage = () => {
  // --- State ---
  const [categories, setCategories] = useState<Category[]>([])
  const [videos, setVideos] = useState<VideoSummary[]>([])

  // 搜索相关
  const [inputValue, setInputValue] = useState("") // UI显示的值
  const [activeKeyword, setActiveKeyword] = useState("") // 实际请求用的值

  // 筛选相关
  const [selectedCategory, setSelectedCategory] = useState<number | string>("")
  const [selectedYear, setSelectedYear] = useState("")
  const [selectedSort, setSelectedSort] = useState("time")

  // 分页与加载
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false) // 重置加载
  const [loadingMore, setLoadingMore] = useState(false) // 滚动加载

  // --- Refs (用于解决竞态问题和无限滚动) ---
  const abortControllerRef = useRef<AbortController | null>(null) // 控制请求取消
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

  // 1. 初始化分类
  useEffect(() => {
    fetchCategories().then(setCategories)
  }, [])

  // ⚡️ 修复痛点1：监听输入框清空
  // 当用户手动删除所有文字时，立即重置搜索关键词，防止切换分类时带入旧关键词
  useEffect(() => {
    if (inputValue === "" && activeKeyword !== "") {
      setActiveKeyword("")
    }
  }, [inputValue, activeKeyword])

  // 2. 核心搜索逻辑 (重置型请求)
  useEffect(() => {
    // ⚡️ 修复痛点2：取消上一次未完成的请求 (防竞态)
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    // 创建新的控制器
    const controller = new AbortController()
    abortControllerRef.current = controller

    const doSearch = async () => {
      setLoading(true)
      setVideos([]) // 立即清空列表，防止视觉上残留旧数据
      setPage(1)
      setHasMore(true)

      try {
        // 传入 signal
        const res = await fetchVideos(
          {
            wd: activeKeyword,
            t: selectedCategory,
            year: selectedYear === "全部" ? "" : selectedYear,
            pg: 1,
            by: selectedSort,
          },
          controller.signal
        ) // <--- 关键：绑定 signal

        if (!res.list || res.list.length === 0) {
          if (activeKeyword)
            toast("未找到相关资源", { icon: "🤔", id: "search_empty" })
          setHasMore(false)
        } else {
          setVideos(res.list)
          setHasMore(true)
        }
      } catch (e: any) {
        // 如果是“取消请求”导致的错误，不处理，也不弹窗
        if (e.name === "CanceledError" || e.message === "canceled") {
          return
        }
        setHasMore(false)
      } finally {
        // 只有当这个请求没有被取消时，才关闭 loading
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    // 稍微延迟一点点执行，避免极速连续点击导致的闪烁（可选）
    // 但有了 AbortController，直接执行也是安全的
    doSearch()

    return () => {
      // 组件卸载或依赖变化时取消
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKeyword, selectedCategory, selectedYear, selectedSort])

  // 3. 加载更多逻辑 (追加型请求)
  // 加载更多通常不需要 Abort，因为它是顺序发生的，但为了严谨也可以加
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
        }) // 这里不加 signal，防止滚动太快取消了前一页

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
      ;(document.activeElement as HTMLElement)?.blur()
    }
  }

  const handleClear = () => {
    setInputValue("")
    // useEffect 会监听到 inputValue 变空，从而自动设置 activeKeyword 为空
    // 这里不需要手动 setActiveKeyword('')，交给 useEffect 统一管理状态同步
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
            onClick={() => setSelectedCategory("")}
          >
            全部
          </FilterChip>
          {categories.map((cat) => (
            <FilterChip
              key={cat.type_id}
              active={selectedCategory === cat.type_id}
              onClick={() => setSelectedCategory(cat.type_id)}
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
          // 加载中骨架屏
          <div className="grid grid-cols-3 gap-3 animate-pulse">
            {[...Array(9)].map((_, i) => (
              <div
                key={i}
                className="aspect-[2/3] bg-white/5 rounded-lg border border-white/5"
              ></div>
            ))}
          </div>
        ) : videos.length > 0 ? (
          // 结果列表
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
          // 空状态
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

        {/* 加载更多 Loading */}
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

export default SearchPage
