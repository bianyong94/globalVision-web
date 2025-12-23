import React, { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { fetchHomeData } from "../services/api"
import { HomeData, Video } from "../types"
import VideoCard from "../components/VideoCard"
import {
  Loader2,
  Play,
  Info,
  ChevronRight,
  Flame,
  Sparkles,
  Tv,
  Clapperboard,
} from "lucide-react"

// 引入 Swiper 核心和样式
import { Swiper, SwiperSlide } from "swiper/react"
import { Autoplay, Pagination, EffectFade } from "swiper/modules"
import "swiper/css"
import "swiper/css/pagination"
import "swiper/css/effect-fade"

const Home = () => {
  const navigate = useNavigate()
  const [data, setData] = useState<HomeData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const result = await fetchHomeData()
        setData(result)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // 骨架屏加载动画 (让等待过程也很酷)
  if (loading)
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center space-y-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-emerald-500/30 border-t-emerald-500 animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-4 border-cyan-500/30 border-b-cyan-500 animate-spin-reverse"></div>
          </div>
        </div>
        <p className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 text-xs font-bold tracking-widest animate-pulse">
          LOADING DATA...
        </p>
      </div>
    )

  if (!data) return null

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24 font-sans selection:bg-emerald-500/30">
      {/* 1. 沉浸式动态 Banner (Swiper) */}
      <section className="relative h-[65vh] w-full group">
        <Swiper
          modules={[Autoplay, Pagination, EffectFade]}
          effect="fade"
          autoplay={{ delay: 5000, disableOnInteraction: false }}
          pagination={{
            clickable: true,
            bulletClass: "swiper-pagination-bullet !bg-white/30 !opacity-100",
            bulletActiveClass:
              "swiper-pagination-bullet-active !bg-emerald-400 !w-6 transition-all",
          }}
          loop={true}
          className="h-full w-full"
        >
          {data.banners.map((item, idx) => (
            <SwiperSlide key={idx} className="relative">
              {/* 背景图 + 遮罩 */}
              <div className="absolute inset-0">
                <img
                  src={item.backdrop || item.poster}
                  alt={item.title}
                  className="w-full h-full object-cover object-top"
                />
                {/* 顶部渐变遮罩 (防止刘海挡住) */}
                <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/80 to-transparent" />
                {/* 底部强渐变遮罩 (融合背景) */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/60 to-transparent" />
                {/* 侧边装饰光 */}
                <div className="absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-black/60 to-transparent" />
              </div>

              {/* 内容区域 */}
              <div className="absolute bottom-0 left-0 w-full p-6 pb-12 flex flex-col items-start z-10">
                {/* 标签 */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="bg-gradient-to-r from-emerald-500 to-cyan-600 text-[10px] font-bold px-2 py-0.5 rounded text-white shadow-[0_0_10px_rgba(16,185,129,0.5)]">
                    独家推荐
                  </span>
                  <span className="text-xs text-gray-300 border border-white/20 px-2 py-0.5 rounded backdrop-blur-sm">
                    {item.type}
                  </span>
                  <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                    <Sparkles size={10} /> 9.8
                  </span>
                </div>

                {/* 标题 */}
                <h1 className="text-4xl font-black text-white mb-2 leading-tight drop-shadow-lg line-clamp-2 w-[85%]">
                  {item.title}
                </h1>

                {/* 简介简述 */}
                <p className="text-sm text-gray-400 line-clamp-1 mb-6 w-[80%]">
                  {item.remarks} · {item.year} · {item.area}
                </p>

                {/* 按钮组 */}
                <div className="flex items-center gap-3 w-full">
                  <button
                    onClick={() => navigate(`/detail/${item.id}`)}
                    className="flex-1 bg-white text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
                  >
                    <Play size={18} fill="black" />
                    立即播放
                  </button>
                  <button
                    onClick={() => navigate(`/detail/${item.id}`)}
                    className="flex-1 bg-white/10 backdrop-blur-md border border-white/10 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
                  >
                    <Info size={18} />
                    详情
                  </button>
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </section>

      {/* 2. 快速分类胶囊 (Horizontal Scroll) */}
      <div className="px-4 -mt-4 relative z-20 mb-8 overflow-x-auto no-scrollbar">
        <div className="flex gap-3 mt-4">
          {["动作", "科幻", "爱情", "悬疑", "动画", "恐怖", "喜剧"].map(
            (cat, i) => (
              <button
                key={i}
                className="whitespace-nowrap px-5 py-2 rounded-full bg-[#1A1A1A] border border-white/5 text-xs text-gray-300 hover:text-white hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-all shadow-lg"
              >
                {cat}
              </button>
            )
          )}
        </div>
      </div>

      <div className="space-y-10 pb-6">
        {/* 3. 热门榜单模块 (带数字排名的横向滚动) */}
        <section className="pl-4">
          <SectionHeader
            title="本周热榜"
            icon={<Flame className="text-orange-500" />}
          />

          <div className="flex overflow-x-auto gap-4 pr-4 pb-4 no-scrollbar snap-x">
            {data.movies.slice(0, 8).map((movie, index) => (
              <div
                key={movie.id}
                className="relative flex-shrink-0 w-36 snap-start group"
                onClick={() => navigate(`/detail/${movie.id}`)}
              >
                {/* 巨大排名数字 */}
                <span
                  className={`
                            absolute -left-4 -bottom-6 text-[80px] font-black italic leading-none z-0 select-none
                            text-transparent bg-clip-text bg-gradient-to-t 
                            ${
                              index === 0
                                ? "from-yellow-500 to-transparent opacity-80"
                                : index === 1
                                ? "from-gray-400 to-transparent opacity-60"
                                : index === 2
                                ? "from-orange-700 to-transparent opacity-50"
                                : "from-white/10 to-transparent opacity-30"
                            }
                        `}
                >
                  {index + 1}
                </span>

                {/* 海报 */}
                <div className="w-full aspect-[2/3] rounded-lg overflow-hidden border border-white/10 relative z-10 shadow-2xl bg-[#1a1a1a]">
                  <img
                    src={movie.poster}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    loading="lazy"
                  />
                  {/* 角标 */}
                  <div className="absolute top-1 right-1 bg-black/60 backdrop-blur text-[10px] px-1.5 rounded text-white">
                    {movie.rating}
                  </div>
                </div>
                <div className="mt-2 relative z-10 pl-2">
                  <h3 className="text-sm font-bold text-gray-200 truncate">
                    {movie.title}
                  </h3>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 4. 电视剧集 (Netflix式横滑) */}
        <section className="pl-4">
          <SectionHeader
            title="热播剧集"
            icon={<Tv className="text-cyan-400" />}
          />
          <div className="flex overflow-x-auto gap-3 pr-4 pb-2 no-scrollbar">
            {data.tvs.map((tv) => (
              <div
                key={tv.id}
                className="w-28 flex-shrink-0"
                onClick={() => navigate(`/detail/${tv.id}`)}
              >
                <div className="aspect-[2/3] rounded-lg overflow-hidden mb-2 relative group">
                  <img
                    src={tv.poster}
                    className="w-full h-full object-cover group-hover:opacity-80 transition-opacity bg-[#1a1a1a]"
                    loading="lazy"
                  />
                  <div className="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />
                  <div className="absolute bottom-1 right-1 text-[10px] text-cyan-300 bg-cyan-900/30 border border-cyan-500/30 px-1 rounded backdrop-blur-sm">
                    {tv.remarks}
                  </div>
                </div>
                <h3 className="text-xs text-gray-300 truncate">{tv.title}</h3>
              </div>
            ))}
          </div>
        </section>

        {/* 5. 动漫精选 (网格布局) */}
        <section className="px-4">
          <SectionHeader
            title="动漫新番"
            icon={<Clapperboard className="text-emerald-400" />}
          />
          <div className="grid grid-cols-3 gap-3">
            {data.animes.map((anime) => (
              <div
                key={anime.id}
                onClick={() => navigate(`/detail/${anime.id}`)}
                className="group relative"
              >
                <div className="aspect-[2/3] rounded-lg overflow-hidden bg-[#1a1a1a] border border-white/5 relative">
                  <img
                    src={anime.poster}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                  {/* 悬浮播放按钮 */}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.6)]">
                      <Play size={12} fill="white" className="ml-0.5" />
                    </div>
                  </div>
                </div>
                <h3 className="text-xs text-gray-300 mt-2 truncate group-hover:text-emerald-400 transition-colors">
                  {anime.title}
                </h3>
              </div>
            ))}
          </div>
        </section>

        {/* 底部装饰 */}
        <div className="mt-8 flex justify-center opacity-30">
          <div className="h-1 w-20 bg-gradient-to-r from-transparent via-gray-500 to-transparent rounded-full"></div>
        </div>
      </div>
    </div>
  )
}

// 辅助组件：Section 标题
const SectionHeader = ({
  title,
  icon,
}: {
  title: string
  icon: React.ReactNode
}) => (
  <div className="flex items-center justify-between pr-4 mb-4">
    <div className="flex items-center gap-2">
      {icon}
      <h2 className="text-lg font-bold text-white tracking-wide">{title}</h2>
    </div>
    <button className="text-xs text-gray-500 flex items-center hover:text-white transition-colors">
      全部 <ChevronRight size={14} />
    </button>
  </div>
)

export default Home
