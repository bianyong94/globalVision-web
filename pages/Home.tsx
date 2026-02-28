import React, { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { fetchHomeData } from "../services/api" // 👈 统一使用后端聚合接口
import { HeroSection } from "@/components/home/HeroSection"
import { MediaRow } from "@/components/home/MediaRow"
import { HomeData } from "../types"
import { Loader2, RefreshCw, Zap } from "lucide-react"
import toast from "react-hot-toast"
import SEO from "../components/SEO"

const HOME_QUERY_KEY = ["home_data_v2"]

export default function Home() {
  const [isSpinning, setIsSpinning] = useState(false)

  // 1. 数据重构：直接请求后端封装好的 HomeData
  const { data, isLoading, isRefetching, refetch, isError } =
    useQuery<HomeData>({
      queryKey: HOME_QUERY_KEY,
      queryFn: fetchHomeData, // 👈 这里的 fetchHomeData 对应后端的 /v2/home 接口
      staleTime: 1000 * 60 * 5, // 5分钟缓存
      gcTime: 1000 * 60 * 30,
      refetchOnWindowFocus: false,
    })

  const handleRefresh = async () => {
    setIsSpinning(true)
    const toastId = toast.loading("正在获取最新资源...")
    try {
      await refetch()
      toast.success("内容已更新", { id: toastId })
    } catch (e) {
      toast.error("刷新失败", { id: toastId })
    } finally {
      setTimeout(() => setIsSpinning(false), 800)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#050505]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
          <p className="text-gray-500 text-sm animate-pulse">
            正在极速加载片库...
          </p>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#050505] text-white gap-4">
        <div className="bg-red-500/10 p-4 rounded-full">
          <Zap className="text-red-500" size={32} />
        </div>
        <p className="text-gray-400">连接片库失败，请检查网络</p>
        <button
          onClick={() => refetch()}
          className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-full font-bold transition-all"
        >
          重新连接
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24 overflow-x-hidden">
      <SEO title="首页-极影聚合" />

      {/* 🟢 悬浮刷新：位置微调，不遮挡内容 */}
      <button
        onClick={handleRefresh}
        disabled={isRefetching || isSpinning}
        className="fixed bottom-28 right-6 z-50 bg-emerald-500 text-black p-3 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.4)] active:scale-90 transition-all hover:scale-110"
      >
        <RefreshCw
          size={20}
          className={isRefetching || isSpinning ? "animate-spin" : ""}
        />
      </button>

      {/* 2. 沉浸式 Banner：通过后端筛选出的 4K/最新资源 */}
      {data?.banners && data.banners.length > 0 && (
        <HeroSection items={data.banners} />
      )}

      {/* 3. 紧凑型内容布局 */}
      <div className="relative z-20 -mt-24 md:-mt-40 space-y-4 px-2 md:px-6">
        {data?.sections.map((section, index) => (
          <div key={index} className="transition-transform duration-300">
            <MediaRow
              title={section.title}
              items={section.data}
              // 布局优化策略：
              // 1. Netflix 和短剧（剧本杀类）使用横向海报 (Backdrop)，节省垂直空间
              // 2. 院线新片和高分榜使用标准竖向海报 (Poster)，突出画面感
              isPoster={
                !section.title.includes("Netflix") &&
                !section.title.includes("短剧")
              }
            />
          </div>
        ))}
      </div>
    </div>
  )
}
