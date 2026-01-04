import React, { useState } from "react" // ✅ 引入 useState
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { fetchHomeData } from "../services/api"
import { getProxyUrl } from "../utils/common"
import {
  Play,
  Info,
  ChevronRight,
  Sparkles,
  Tv,
  Clapperboard,
  Music,
  Film,
  Trophy,
  Loader2,
  RefreshCw,
} from "lucide-react"

// Swiper
import { Swiper, SwiperSlide } from "swiper/react"
import { Autoplay, Pagination, EffectFade } from "swiper/modules"
import "swiper/css"
import "swiper/css/pagination"
import "swiper/css/effect-fade"

const Home = () => {
  const navigate = useNavigate()

  // 1. 数据请求
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["homeData"],
    queryFn: fetchHomeData,
    staleTime: 1000 * 60 * 10,
  })

  // ✅ 新增：控制点击后的最小旋转动画状态
  const [isSpinning, setIsSpinning] = useState(false)

  // ✅ 新增：处理点击刷新
  const handleRefresh = () => {
    // 1. 开启强制旋转状态
    setIsSpinning(true)

    // 2. 触发数据重新请求
    refetch()

    // 3. 设置定时器，至少旋转 1 秒 (视觉上大约是一圈多)，防止请求太快导致动画闪烁
    setTimeout(() => {
      setIsSpinning(false)
    }, 1000)
  }

  // Loading (首次加载且无数据)
  if (isLoading && !data)
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
        <p className="text-xs text-gray-500 animate-pulse tracking-widest">
          LOADING G-VISION...
        </p>
      </div>
    )

  const hasData = data && Object.keys(data).length > 0

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24 font-sans selection:bg-emerald-500/30">
      {/* 🟢 悬浮刷新按钮 */}
      <button
        onClick={handleRefresh} // ✅ 绑定新的处理函数
        disabled={isRefetching || isSpinning} // ✅ 动画或请求中禁用点击
        className="fixed bottom-24 right-5 z-50 bg-[#1a1a1a]/80 backdrop-blur-md text-emerald-500 p-3.5 rounded-full shadow-2xl border border-white/10 active:scale-90 transition-all duration-200 hover:bg-[#2a2a2a]"
        style={{ boxShadow: "0 0 20px rgba(16, 185, 129, 0.2)" }}
      >
        <RefreshCw
          size={22}
          // ✅ 逻辑修改：请求中 OR 强制旋转中，都执行旋转动画
          className={isRefetching || isSpinning ? "animate-spin" : ""}
        />
      </button>

      {/* 🔴 内容区域 */}
      <div>
        {!hasData ? (
          <div className="h-[80vh] flex flex-col items-center justify-center text-gray-500 gap-4">
            <RefreshCw size={40} className="opacity-50" />
            <p className="text-sm">暂无数据，请尝试刷新</p>
          </div>
        ) : (
          <>
            {/* Banner */}
            <section className="relative h-[60vh] w-full group">
              <Swiper
                modules={[Autoplay, Pagination, EffectFade]}
                effect="fade"
                autoplay={{ delay: 5000, disableOnInteraction: false }}
                pagination={{ clickable: true }}
                loop={true}
                className="h-full w-full"
              >
                {data.banners.map((item: any, idx: number) => (
                  <SwiperSlide key={idx} className="relative">
                    <div className="absolute inset-0">
                      <img
                        loading="lazy"
                        src={getProxyUrl(item.backdrop || item.poster)}
                        alt={item.title}
                        className="w-full h-full object-cover object-top opacity-90"
                      />
                      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/90 to-transparent" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/40 to-transparent" />
                    </div>

                    <div className="absolute bottom-0 left-0 w-full p-6 pb-10 flex flex-col items-start z-10">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-emerald-600 text-[10px] font-bold px-2 py-0.5 rounded text-white shadow-lg shadow-emerald-500/30">
                          本周推荐
                        </span>
                        <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                          <Sparkles size={10} /> {item.rating || "9.0"}
                        </span>
                      </div>

                      <h1 className="text-3xl font-black text-white mb-2 leading-tight drop-shadow-xl line-clamp-2 w-[90%]">
                        {item.title}
                      </h1>

                      <div className="flex items-center gap-3 w-full mt-4">
                        <button
                          onClick={() => navigate(`/detail/${item.id}`)}
                          className="flex-1 bg-white text-black font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-xl"
                        >
                          <Play size={16} fill="black" /> 播放
                        </button>
                        <button
                          onClick={() => navigate(`/detail/${item.id}`)}
                          className="flex-1 bg-white/10 backdrop-blur-md border border-white/10 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
                        >
                          <Info size={16} /> 详情
                        </button>
                      </div>
                    </div>
                  </SwiperSlide>
                ))}
              </Swiper>
            </section>

            <div className="space-y-8 mt-4">
              <Section
                title="电影"
                icon={<Film className="text-blue-500" />}
                items={data.movies}
                categoryId={1}
                type="landscape"
              />
              <Section
                title="剧集"
                icon={<Tv className="text-emerald-400" />}
                items={data.tvs}
                categoryId={2}
              />
              <Section
                title="动漫"
                icon={<Clapperboard className="text-pink-400" />}
                items={data.animes}
                categoryId={4}
              />
              {data.varieties && data.varieties.length > 0 && (
                <Section
                  title="综艺"
                  icon={<Music className="text-purple-400" />}
                  items={data.varieties}
                  categoryId={3}
                />
              )}
              {data.sports && data.sports.length > 0 && (
                <Section
                  title="体育赛事"
                  icon={<Trophy className="text-yellow-500" />}
                  items={data.sports}
                  customLink="/search?q=NBA"
                  type="landscape"
                />
              )}

              <div className="py-8 flex justify-center opacity-30">
                <span className="text-[10px] tracking-widest uppercase text-gray-500">
                  - Global Vision -
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// --- 通用 Section 组件 (保持不变) ---
const Section = ({
  title,
  icon,
  items,
  categoryId,
  customLink,
  type = "portrait",
}: any) => {
  const navigate = useNavigate()

  if (!items || items.length === 0) return null

  const handleMoreClick = () => {
    if (customLink) {
      navigate(customLink)
    } else {
      navigate(`/search?t=${categoryId}`)
    }
  }

  return (
    <section className="pl-4">
      <div className="flex items-center justify-between pr-4 mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-lg font-bold text-white tracking-wide">
            {title}
          </h2>
        </div>
        <button
          className="text-xs text-gray-500 flex items-center hover:text-white transition-colors p-2 -mr-2"
          onClick={handleMoreClick}
        >
          全部 <ChevronRight size={14} />
        </button>
      </div>

      <div className="flex overflow-x-auto gap-3 pr-4 pb-2 no-scrollbar snap-x">
        {items.map((item: any) => (
          <div
            key={item.id}
            style={{ WebkitTapHighlightColor: "transparent" }}
            className={`flex-shrink-0 snap-start cursor-pointer relative ${
              type === "landscape" ? "w-40" : "w-28"
            }`}
            onClick={() => navigate(`/detail/${item.id}`)}
          >
            <div
              className={`rounded-lg overflow-hidden mb-2 relative bg-[#1a1a1a] border border-white/5 ${
                type === "landscape" ? "aspect-video" : "aspect-[2/3]"
              }`}
            >
              <img
                src={getProxyUrl(item.poster)}
                className="w-full h-full object-cover opacity-90"
                loading="lazy"
                alt={item.title}
              />
              {item.rating > 0 && (
                <div className="absolute top-1 right-1 bg-black/60 backdrop-blur-sm text-[9px] text-white px-1.5 py-0.5 rounded">
                  {item.rating}
                </div>
              )}
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent p-1.5 pt-6">
                <p className="text-[9px] text-gray-300 truncate text-right">
                  {item.remarks}
                </p>
              </div>
            </div>
            <h3 className="text-xs text-gray-300 truncate pl-0.5">
              {item.title}
            </h3>
          </div>
        ))}
      </div>
    </section>
  )
}

export default Home
