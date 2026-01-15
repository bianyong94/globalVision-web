import { useQuery } from "@tanstack/react-query"
import {
  fetchTmdbNetflix,
  fetchTmdbTopRated,
  fetchVideos,
} from "../services/api"
import { HeroSection } from "@/components/home/HeroSection"
import { MediaRow } from "@/components/home/MediaRow"
import { VideoItem, HomeData } from "../types"
import { Loader2, RefreshCw } from "lucide-react"
import { useState } from "react"
import toast from "react-hot-toast"

// 定义首页数据的查询 Key
const HOME_QUERY_KEY = ["home_data_v2"]

export default function Home() {
  const [isSpinning, setIsSpinning] = useState(false)

  // 🔥 使用 useQuery 替代 useEffect
  // 这会自动处理缓存、加载状态和错误
  const { data, isLoading, isRefetching, refetch, isError } =
    useQuery<HomeData>({
      queryKey: HOME_QUERY_KEY,
      queryFn: async (): Promise<HomeData> => {
        // 并行请求所有数据
        const [tmdbNetflix, tmdbTop, usShows, newMovies] = await Promise.all([
          fetchTmdbNetflix(), // 1. Netflix (TMDB数据)
          fetchTmdbTopRated(), // 2. 高分电影 (TMDB数据)
          // 3. 高分美剧 (查本地库: 剧集 + 标签 + 评分排)
          // 记得用 tag='netflix' 或 tag='high_score' 配合后端逻辑
          fetchVideos({ cat: "tv", tag: "netflix", sort: "rating" }),
          // 4. 院线新片 (查本地库: 电影 + 2025 + 按时间排)
          fetchVideos({ cat: "movie", year: "2025", sort: "time" }),
        ])

        // 组装 HomeData 结构
        return {
          banners: tmdbTop.slice(0, 5), // 用高分电影的前5个做 Banner
          sections: [
            { title: "Netflix 独家精选", type: "scroll", data: tmdbNetflix },
            { title: "🔥 院线新片", type: "scroll", data: newMovies.list },
            { title: "口碑炸裂！高分电影榜", type: "scroll", data: tmdbTop },
            { title: "必看高分美剧", type: "scroll", data: usShows.list },
          ],
        }
      },
      staleTime: 1000 * 60 * 10, // 🔥 10分钟内不重新请求 (缓存)
      gcTime: 1000 * 60 * 30, // 30分钟后才回收垃圾
      refetchOnWindowFocus: false, // 切窗口回来不刷新
    })

  // 手动刷新逻辑
  const handleRefresh = async () => {
    setIsSpinning(true)
    const toastId = toast.loading("正在刷新首页...")
    try {
      await refetch()
      toast.success("刷新成功", { id: toastId })
    } catch (e) {
      toast.error("刷新失败", { id: toastId })
    } finally {
      setTimeout(() => setIsSpinning(false), 1000)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#141414] text-white">
        <Loader2 className="w-10 h-10 animate-spin text-red-600" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#141414] text-white gap-4">
        <p>加载失败</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-red-600 rounded"
        >
          重试
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#141414] text-white pb-20">
      {/* 🟢 悬浮刷新按钮 (复用 Search 页的样式) */}
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

      {/* 1. 沉浸式 Hero Banner (传入数组) */}
      {data?.banners && data.banners.length > 0 && (
        <HeroSection items={data.banners} />
      )}

      <div className="relative z-20 -mt-20 md:-mt-32 space-y-8">
        {/* 动态渲染所有板块 */}
        {data?.sections.map((section, index) => (
          <MediaRow
            key={index}
            title={section.title}
            items={section.data}
            // Netflix 专区用横图，其他用竖图
            isPoster={!section.title.includes("Netflix")}
          />
        ))}
      </div>
    </div>
  )
}
