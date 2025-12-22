import React, { useState, useEffect, useRef, useCallback } from "react"
import { Search as SearchIcon, X, Filter, Loader2 } from "lucide-react"
import { fetchVideoList } from "../services/api"
import { VideoResource } from "../types"
import VideoGrid from "../components/VideoGrid"
import {
  CATEGORY_HIERARCHY,
  findCategoryContext,
} from "../src/constants/categories"

interface SearchProps {
  onVideoSelect: (v: VideoResource) => void
  darkMode: boolean
  initialCategory?: number
}

// 年份配置
const YEARS = [
  "全部",
  "2025",
  "2024",
  "2023",
  "2022",
  "2021",
  "2020",
  "2019",
  "2018",
  "2010-2017",
  "更早",
]

const Search: React.FC<SearchProps> = ({
  onVideoSelect,
  darkMode,
  initialCategory = 0,
}) => {
  // === 筛选状态 ===
  const [query, setQuery] = useState("")
  const [activeParentId, setActiveParentId] = useState<number>(1)
  const [activeChildId, setActiveChildId] = useState<number>(5)
  const [activeYear, setActiveYear] = useState("全部")

  // === 数据状态 ===
  const [videos, setVideos] = useState<VideoResource[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true) // 是否还有下一页

  // === 引用 Ref (用于监听触底) ===
  const observer = useRef<IntersectionObserver | null>(null)

  // 触底元素的回调
  const lastVideoElementRef = useCallback(
    (node: HTMLDivElement) => {
      if (loading) return
      if (observer.current) observer.current.disconnect()

      observer.current = new IntersectionObserver((entries) => {
        // 如果底部元素可见，且还有更多数据，页码+1
        if (entries[0].isIntersecting && hasMore) {
          setPage((prevPage) => prevPage + 1)
        }
      })

      if (node) observer.current.observe(node)
    },
    [loading, hasMore]
  )

  // 1. 初始化逻辑：处理从首页跳转过来的 ID
  useEffect(() => {
    if (initialCategory !== 0) {
      const { parentId, defaultChildId } = findCategoryContext(initialCategory)
      setActiveParentId(parentId)
      setActiveChildId(defaultChildId)
    }
  }, [initialCategory])

  // 2. 核心数据请求逻辑
  // 监听 query, activeChildId, activeYear, page 的变化
  useEffect(() => {
    const loadVideos = async () => {
      setLoading(true)
      try {
        const params: any = {
          pg: page,
          year: activeYear === "全部" ? undefined : activeYear,
        }

        // 搜索优先：如果有搜索词，通常不传分类，只传 wd
        if (query.trim()) {
          params.wd = query.trim()
        } else {
          // 没有搜索词，传分类ID
          params.t = activeChildId
        }

        const { list, pagecount } = await fetchVideoList(params)

        setVideos((prev) => {
          // 如果是第1页，直接覆盖；如果是翻页，追加数据
          // 使用 Set 去重，防止 API 偶尔返回重复数据
          if (page === 1) return list
          const existingIds = new Set(prev.map((v) => v.id))
          const newUniqueItems = list.filter((v) => !existingIds.has(v.id))
          return [...prev, ...newUniqueItems]
        })

        // 判断是否还有下一页
        setHasMore(page < pagecount)
      } catch (e) {
        if (page === 1) setVideos([])
      } finally {
        setLoading(false)
      }
    }

    // 防抖逻辑
    const timer = setTimeout(() => {
      loadVideos()
    }, 300)

    return () => clearTimeout(timer)
  }, [page, query, activeChildId, activeYear])

  // 3. 当筛选条件变化时，重置页码为 1
  useEffect(() => {
    setPage(1)
    setVideos([]) // 可选：清空列表让用户感知到切换了
    setHasMore(true)
    // 自动滚动回顶部
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [query, activeChildId, activeYear])

  // 切换父类时的逻辑
  const handleParentChange = (parentId: number) => {
    setActiveParentId(parentId)
    const parent = CATEGORY_HIERARCHY.find((p) => p.id === parentId)
    if (parent && parent.children && parent.children.length > 0) {
      setActiveChildId(parent.children[0].id)
    } else {
      setActiveChildId(parentId)
    }
  }

  const currentSubCategories =
    CATEGORY_HIERARCHY.find((c) => c.id === activeParentId)?.children || []

  return (
    <div
      className={`min-h-screen pb-20 ${
        darkMode ? "bg-zinc-950 text-white" : "bg-white"
      }`}
    >
      {/* 顶部固定筛选区 */}
      <div
        className={`sticky top-0 z-30 ${
          darkMode ? "bg-zinc-950/95" : "bg-white/95"
        } backdrop-blur border-b border-gray-800/30`}
      >
        {/* 1. 搜索框 */}
        <div className="p-4 pb-2">
          <div
            className={`relative flex items-center rounded-xl p-3 border transition-colors ${
              darkMode
                ? "bg-zinc-900 border-zinc-800 focus-within:border-blue-500"
                : "bg-gray-50 border-gray-200"
            }`}
          >
            <SearchIcon size={18} className="text-gray-400 mr-3" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜片名、导演、演员、关键词..."
              className="bg-transparent flex-1 outline-none text-sm placeholder:text-gray-500"
            />
            {query && (
              <button onClick={() => setQuery("")}>
                <X size={18} className="text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {/* 2. 筛选条件区 (只有没搜索词时显示) */}
        {!query && (
          <div className="flex flex-col gap-2 pb-2">
            {/* 一级分类 */}
            <div className="flex items-center px-4 gap-6 overflow-x-auto hide-scrollbar">
              {CATEGORY_HIERARCHY.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleParentChange(cat.id)}
                  className={`py-2 text-sm font-bold whitespace-nowrap border-b-2 transition-all ${
                    activeParentId === cat.id
                      ? "border-blue-500 text-blue-500"
                      : "border-transparent text-gray-500"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* 二级分类 */}
            {currentSubCategories.length > 1 && (
              <div className="px-4 flex gap-2 overflow-x-auto hide-scrollbar">
                {currentSubCategories.map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => setActiveChildId(sub.id)}
                    className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                      activeChildId === sub.id
                        ? "bg-blue-600 text-white"
                        : darkMode
                        ? "bg-zinc-800 text-zinc-400"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {sub.name}
                  </button>
                ))}
              </div>
            )}

            {/* 年份筛选 */}
            <div className="px-4 flex gap-2 overflow-x-auto hide-scrollbar border-t border-gray-800/10 pt-2">
              <div className="flex items-center text-xs text-gray-500 mr-2 shrink-0">
                年份
              </div>
              {YEARS.map((y) => (
                <button
                  key={y}
                  onClick={() => setActiveYear(y)}
                  className={`px-2 py-1 rounded-md text-xs whitespace-nowrap transition-all ${
                    activeYear === y
                      ? "bg-blue-500/10 text-blue-500 font-bold"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 内容区域 */}
      <div className="px-4 pt-4 min-h-[50vh]">
        {videos.length > 0 ? (
          <>
            <VideoGrid
              videos={videos}
              onVideoClick={onVideoSelect}
              darkMode={darkMode}
            />

            {/* 触底加载指示器 */}
            <div
              ref={lastVideoElementRef}
              className="py-8 flex justify-center w-full"
            >
              {loading && hasMore && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Loader2 size={16} className="animate-spin" /> 加载更多...
                </div>
              )}
              {!hasMore && videos.length > 10 && (
                <p className="text-xs text-gray-500">———— 我是有底线的 ————</p>
              )}
            </div>
          </>
        ) : (
          !loading && (
            <div className="text-center py-20 text-gray-500 text-sm">
              {query ? "未找到相关结果" : "暂无数据"}
            </div>
          )
        )}

        {/* 首次加载的 Loading 占位 */}
        {loading && page === 1 && (
          <div className="flex flex-col items-center py-20 gap-4 opacity-50">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs">正在搜索资源库...</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Search
