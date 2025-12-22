import React, { useEffect, useState } from "react"
// 确保 components/VideoGrid 是默认导出 (export default VideoGrid)
import VideoGrid from "../components/VideoGrid"
import { fetchCategories, fetchVideoList } from "../services/api"
import { Category, VideoResource } from "../types"

interface CategoryPageProps {
  onVideoSelect: (v: VideoResource) => void
  onBack: () => void
  darkMode: boolean
}

const REGIONS = ["全部", "大陆", "香港", "台湾", "美国", "韩国", "日本"]
const YEARS = ["全部", "2025", "2024", "2023", "2022", "2021", "2020"]

// 🟢 修复：直接使用 export default function，避免 HMR 热更新时的导出丢失问题
export default function CategoryPage({
  onVideoSelect,
  onBack,
  darkMode,
}: CategoryPageProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [videos, setVideos] = useState<VideoResource[]>([])

  // 筛选状态
  const [activeType, setActiveType] = useState<number>(0)
  const [activeRegion, setActiveRegion] = useState("全部")
  const [activeYear, setActiveYear] = useState("全部")
  const [loading, setLoading] = useState(false)

  // 初始化获取分类
  useEffect(() => {
    fetchCategories().then((res) => {
      // 这里的 res 可能是 null 或数组，做个兜底
      setCategories(res || [])
    })
  }, [])

  // 筛选逻辑
  useEffect(() => {
    const loadVideos = async () => {
      setLoading(true)

      let keyword = ""
      if (activeRegion !== "全部") keyword += activeRegion + " "
      if (activeYear !== "全部") keyword += activeYear

      try {
        const res = await fetchVideoList({
          t: activeType === 0 ? undefined : activeType,
          pg: 1,
          wd: keyword.trim() || undefined,
        })
        setVideos(res || [])
      } catch (e) {
        console.error("加载列表失败", e)
        setVideos([])
      } finally {
        setLoading(false)
      }
    }
    loadVideos()
  }, [activeType, activeRegion, activeYear])

  return (
    <div
      className={`min-h-screen ${
        darkMode ? "bg-zinc-950 text-white" : "bg-white text-gray-900"
      }`}
    >
      {/* 顶部导航 */}
      <div className="sticky top-0 z-40 bg-inherit border-b border-gray-800 p-4">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={onBack} className="font-bold text-lg">
            ← 分类浏览
          </button>
        </div>

        {/* 筛选区 */}
        <div className="space-y-3">
          {/* 主分类 */}
          <div className="flex overflow-x-auto gap-2 hide-scrollbar pb-1">
            <button
              onClick={() => setActiveType(0)}
              className={`px-3 py-1 rounded-full text-xs whitespace-nowrap ${
                activeType === 0
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-800 text-gray-400"
              }`}
            >
              全部分类
            </button>
            {categories.map((c) => (
              <button
                key={c.type_id}
                onClick={() => setActiveType(c.type_id)}
                className={`px-3 py-1 rounded-full text-xs whitespace-nowrap ${
                  activeType === c.type_id
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-800 text-gray-400"
                }`}
              >
                {c.type_name}
              </button>
            ))}
          </div>

          {/* 地区 */}
          <div className="flex overflow-x-auto gap-2 hide-scrollbar pb-1">
            {REGIONS.map((r) => (
              <button
                key={r}
                onClick={() => setActiveRegion(r)}
                className={`px-3 py-1 rounded-full text-xs whitespace-nowrap border ${
                  activeRegion === r
                    ? "border-blue-500 text-blue-500"
                    : "border-zinc-800 text-gray-500"
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* 年份 */}
          <div className="flex overflow-x-auto gap-2 hide-scrollbar pb-1">
            {YEARS.map((y) => (
              <button
                key={y}
                onClick={() => setActiveYear(y)}
                className={`px-3 py-1 rounded-full text-xs whitespace-nowrap border ${
                  activeYear === y
                    ? "border-blue-500 text-blue-500"
                    : "border-zinc-800 text-gray-500"
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 列表内容 */}
      <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          /* ⚠️ 注意：这里我用了 items={videos}，请根据你的VideoGrid实际Props调整 */
          /* 如果你的 VideoGrid 定义的是 interface { videos: ... }，请改回 videos={videos} */
          <VideoGrid
            videos={videos}
            onVideoClick={onVideoSelect}
            darkMode={darkMode}
          />
        )}
      </div>
    </div>
  )
}
