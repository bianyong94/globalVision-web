import React, { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Loader2, RefreshCw, Zap } from "lucide-react"
import toast from "react-hot-toast"
import SEO from "../components/SEO"
import { fetchHistory, fetchHomeData } from "../services/api"
import { useAuth } from "../context/AuthContext"
import { HeroSection } from "@/components/home/HeroSection"
import { MediaRow } from "@/components/home/MediaRow"
import { HomeData, VideoItem } from "../types"

const HOME_QUERY_KEY = ["home_data_v4"]

const toItem = (x: any): VideoItem => ({
  id: String(x.id),
  title: String(x.title || ""),
  poster: String(x.poster || ""),
  backdrop: x.backdrop || "",
  remarks: x.remarks || "",
  year: x.year,
  rating: Number(x.rating || 0),
  category: x.category || "",
  tags: Array.isArray(x.tags) ? x.tags : [],
})

export default function Home() {
  const [isSpinning, setIsSpinning] = useState(false)
  const { user } = useAuth()

  const { data, isLoading, isRefetching, refetch, isError } = useQuery<HomeData>({
    queryKey: HOME_QUERY_KEY,
    queryFn: fetchHomeData,
    staleTime: 1000 * 60 * 3,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  })

  const { data: historyRows } = useQuery<any[]>({
    queryKey: ["home_history", user?.username || ""],
    queryFn: () => fetchHistory(user!.username),
    enabled: !!user?.username,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
  })

  const historyItems = useMemo(
    () => (historyRows || []).slice(0, 12).map(toItem).filter((x) => x.id && x.poster),
    [historyRows],
  )

  const sections = data?.sections || []

  const handleRefresh = async () => {
    setIsSpinning(true)
    const toastId = toast.loading("正在刷新首页内容...")
    try {
      await refetch()
      toast.success("首页内容已更新", { id: toastId })
    } catch {
      toast.error("刷新失败", { id: toastId })
    } finally {
      setTimeout(() => setIsSpinning(false), 700)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#050505]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
          <p className="text-gray-500 text-sm animate-pulse">正在加载首页...</p>
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
        <p className="text-gray-400">连接片库失败，请稍后再试</p>
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

      {data?.banners && data.banners.length > 0 && <HeroSection items={data.banners} />}

      <div className="relative z-20 -mt-24 md:-mt-40 space-y-4 px-2 md:px-6">
        {historyItems.length > 0 && (
          <MediaRow title="继续观看" items={historyItems} isPoster />
        )}

        {sections.map((section) => (
          <div key={section.title} className="transition-transform duration-300">
            <MediaRow title={section.title} items={section.data} isPoster />
          </div>
        ))}
      </div>
    </div>
  )
}
