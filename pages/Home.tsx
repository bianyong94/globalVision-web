import React, { useEffect, useState } from "react"
import { fetchHomeTrending } from "../services/api"
import { VideoResource, HomeData } from "../types"
import VideoGrid from "../components/VideoGrid"
import { ChevronRight, Play, Star, Film, Tv, Zap } from "lucide-react"

interface HomeProps {
  onVideoSelect: (v: VideoResource) => void
  onNavigateMore: (categoryId: number) => void
  darkMode: boolean
}

const Home: React.FC<HomeProps> = ({
  onVideoSelect,
  onNavigateMore,
  darkMode,
}) => {
  const [data, setData] = useState<HomeData | null>(null)

  useEffect(() => {
    fetchHomeTrending().then(setData)
  }, [])

  if (!data)
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-gray-500">正在为您聚合全网最新资源...</p>
      </div>
    )

  // 板块组件
  const Section = ({ title, icon: Icon, items, categoryId }: any) => (
    <section className="mt-8 px-4">
      <div className="flex items-center justify-between mb-4">
        <h2
          className={`text-lg font-black flex items-center gap-2 ${
            darkMode ? "text-white" : "text-gray-900"
          }`}
        >
          <Icon size={20} className="text-blue-500" /> {title}
        </h2>
        <button
          onClick={() => onNavigateMore(categoryId)}
          className="text-blue-500 text-xs flex items-center font-medium bg-blue-500/10 px-2 py-1 rounded-full"
        >
          更多 <ChevronRight size={12} />
        </button>
      </div>
      <VideoGrid
        videos={items}
        onVideoClick={onVideoSelect}
        darkMode={darkMode}
      />
    </section>
  )

  return (
    <div className="pb-24">
      {/* 沉浸式轮播图 (只展示第一个作为 Hero，其他的可以做成小轮播，或者这里简化为一个大 Banner) */}
      {data.banners.length > 0 && (
        <div className="relative w-full aspect-[4/3] md:aspect-[21/9] overflow-hidden">
          {/* 这里只展示最新的一部作为头图，或者你可以恢复之前的轮播逻辑 */}
          <div
            className="w-full h-full relative"
            onClick={() => onVideoSelect(data.banners[0])}
          >
            <img
              src={data.banners[0].poster}
              className="w-full h-full object-cover"
              alt={data.banners[0].title}
            />
            {/* 渐变遮罩 */}
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent flex flex-col justify-end p-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                  {data.banners[0].year || "2025"} 最新
                </span>
                <span className="bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                  <Star size={8} fill="black" />{" "}
                  {data.banners[0].rating || "N/A"}
                </span>
              </div>
              <h1 className="text-3xl font-black text-white drop-shadow-xl line-clamp-2 leading-tight">
                {data.banners[0].title}
              </h1>
              <p className="text-gray-300 text-xs mt-2 line-clamp-1 opacity-90">
                {data.banners[0].type} · {data.banners[0].remarks}
              </p>

              <button className="mt-4 w-fit flex items-center gap-2 bg-white text-black px-6 py-2.5 rounded-full font-bold text-sm hover:scale-105 transition-transform">
                <Play size={16} fill="black" /> 立即播放
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2025 热门电影 (动作+科幻) */}
      <Section
        title="热门大片 (2025)"
        icon={Film}
        items={data.movies}
        categoryId={1}
      />

      {/* 2025 热播剧集 (国产+欧美) */}
      <Section title="必追好剧" icon={Tv} items={data.tvs} categoryId={2} />

      {/* 动漫 */}
      <Section title="新番动漫" icon={Zap} items={data.animes} categoryId={4} />
    </div>
  )
}

export default Home
