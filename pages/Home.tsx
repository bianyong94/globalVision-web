import React, { useState, useRef } from "react"
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
  Globe,
  Film,
  Trophy,
  Loader2,
  RefreshCw, // 引入刷新图标
} from "lucide-react"

// Swiper
import { Swiper, SwiperSlide } from "swiper/react"
import { Autoplay, Pagination, EffectFade } from "swiper/modules"
import "swiper/css"
import "swiper/css/pagination"
import "swiper/css/effect-fade"

const Home = () => {
  const navigate = useNavigate()

  // 1. 获取 refetch 方法
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["homeData"],
    queryFn: fetchHomeData,
    staleTime: 1000 * 60 * 10, // 10分钟缓存
  })

  // 2. 下拉刷新状态管理
  const [pullY, setPullY] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const touchStartRef = useRef(0)

  // 3. 手势处理函数
  const handleTouchStart = (e: React.TouchEvent) => {
    // 只有当页面滚动在顶部时，才允许下拉
    if (window.scrollY === 0) {
      touchStartRef.current = e.touches[0].clientY
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const currentY = e.touches[0].clientY
    const diff = currentY - touchStartRef.current

    // 只有向下划动，且在顶部时触发
    if (window.scrollY === 0 && diff > 0) {
      // 增加阻尼感 (diff * 0.4)，限制最大下拉距离 80px
      setPullY(Math.min(diff * 0.4, 80))
    }
  }

  const handleTouchEnd = async () => {
    if (pullY > 50) {
      // 如果下拉超过阈值，触发刷新
      setIsRefreshing(true)
      try {
        await refetch() // 强制重新请求后端
      } catch (e) {
        console.error(e)
      } finally {
        setIsRefreshing(false)
      }
    }
    // 回弹
    setPullY(0)
  }

  // Loading 界面 (首次加载)
  if (isLoading && !isRefreshing)
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
        <p className="text-xs text-gray-500 animate-pulse tracking-widest">
          LOADING G-VISION...
        </p>
      </div>
    )

  // 即使 data 为空，也要渲染外层结构以便支持下拉刷新，或者显示空状态
  const hasData = data && Object.keys(data).length > 0

  return (
    <div
      className="min-h-screen bg-[#050505] text-white pb-24 font-sans selection:bg-emerald-500/30"
      // 绑定手势事件
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* 🟢 下拉刷新指示器 (固定在顶部，随 pullY 显现) */}
      <div
        className="fixed top-4 left-0 right-0 flex justify-center z-50 transition-all duration-300 pointer-events-none"
        style={{
          transform: `translateY(${
            pullY > 0 ? pullY + 40 : isRefreshing ? 60 : 0
          }px)`,
          opacity: pullY > 0 || isRefreshing ? 1 : 0,
        }}
      >
        <div className="bg-black/80 backdrop-blur text-emerald-500 p-2.5 rounded-full shadow-xl border border-white/10 flex items-center gap-2">
          <RefreshCw
            size={20}
            className={isRefreshing ? "animate-spin" : ""}
            style={{ transform: `rotate(${pullY * 3}deg)` }}
          />
          {isRefreshing && (
            <span className="text-xs font-bold">刷新数据...</span>
          )}
        </div>
      </div>

      {/* 🔴 主要内容区域 (随手指下移) */}
      <div
        style={{ transform: `translateY(${pullY}px)` }}
        className="transition-transform duration-200 ease-out"
      >
        {!hasData ? (
          // 空数据/加载失败时的兜底显示，允许下拉重试
          <div className="h-[80vh] flex flex-col items-center justify-center text-gray-500 gap-4">
            <RefreshCw size={40} className="opacity-50" />
            <p className="text-sm">暂无数据，请下拉刷新重试</p>
          </div>
        ) : (
          <>
            {/* 1. 沉浸式 Banner */}
            <section className="relative h-[60vh] w-full group">
              <Swiper
                modules={[Autoplay, Pagination, EffectFade]}
                effect="fade"
                autoplay={{ delay: 5000, disableOnInteraction: false }}
                pagination={{ clickable: true }}
                loop={true}
                className="h-full w-full"
              >
                {data.banners.map((item, idx) => (
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
                      <div className="flex items-center gap-2 mb-2 animate-in fade-in slide-in-from-bottom-2 duration-700">
                        <span className="bg-emerald-600 text-[10px] font-bold px-2 py-0.5 rounded text-white shadow-lg shadow-emerald-500/30">
                          本周推荐
                        </span>
                        <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                          <Sparkles size={10} /> {item.rating || "9.0"}
                        </span>
                      </div>

                      <h1 className="text-3xl font-black text-white mb-2 leading-tight drop-shadow-xl line-clamp-2 w-[90%] animate-in fade-in slide-in-from-bottom-3 duration-700 delay-100">
                        {item.title}
                      </h1>

                      <div className="flex items-center gap-3 w-full mt-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
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
              {/* 2. 电影 */}
              <Section
                title="电影"
                icon={<Film className="text-blue-500" />}
                items={data.movies}
                categoryId={1}
                type="landscape"
              />

              {/* 3. 剧集 */}
              <Section
                title="剧集"
                icon={<Tv className="text-emerald-400" />}
                items={data.tvs}
                categoryId={2}
              />

              {/* 4. 动漫 */}
              <Section
                title="动漫"
                icon={<Clapperboard className="text-pink-400" />}
                items={data.animes}
                categoryId={4}
              />

              {/* 5. 综艺 */}
              {data.varieties && data.varieties.length > 0 && (
                <Section
                  title="综艺"
                  icon={<Music className="text-purple-400" />}
                  items={data.varieties}
                  categoryId={3}
                />
              )}

              {/* 6.  */}
              {/* {data.documentaries && data.documentaries.length > 0 && (
                <Section
                  title="纪录片"
                  icon={<Globe className="text-cyan-400" />}
                  items={data.documentaries}
                  categoryId={19}
                  type="landscape"
                />
              )} */}

              {/* 7. 体育赛事 */}
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
