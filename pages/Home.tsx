import React, { useState, useRef, useEffect } from "react"
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

// --- Hook: 封装下拉刷新逻辑 ---
const usePullToRefresh = (onRefresh: () => Promise<void>) => {
  const [pullY, setPullY] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const startY = useRef(0)
  // 用于标记是否正在进行下拉动作，防止误触
  const isPulling = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleTouchStart = (e: TouchEvent) => {
      // 只有当页面处于顶部时，才记录起始点
      if (window.scrollY <= 0) {
        startY.current = e.touches[0].clientY
        isPulling.current = false // 重置
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      // 如果正在刷新中，或者页面不在顶部，直接忽略
      if (isRefreshing || window.scrollY > 0) return

      const currentY = e.touches[0].clientY
      const diff = currentY - startY.current

      // 只有向下移动 (diff > 0) 且 起始点确实在顶部
      if (diff > 0 && startY.current > 0) {
        // 如果是可以取消的事件，阻止默认行为（防止 iOS 橡皮筋效果）
        if (e.cancelable && diff < 200) {
          e.preventDefault()
        }

        isPulling.current = true
        // 增加阻尼感，diff 越大阻力越大
        const damping = Math.pow(diff, 0.8) * 0.4
        setPullY(Math.min(damping, 100)) // 最大下拉 100px
      }
    }

    const handleTouchEnd = async () => {
      if (!isPulling.current) return

      startY.current = 0
      isPulling.current = false

      if (pullY > 60) {
        // 阈值 60px
        setIsRefreshing(true)
        setPullY(60) // 停留在加载位置
        try {
          await onRefresh()
        } finally {
          setIsRefreshing(false)
          setPullY(0)
        }
      } else {
        setPullY(0) // 回弹
      }
    }

    // 绑定原生事件以支持 { passive: false }，这对于 preventDefault 至关重要
    container.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    })
    container.addEventListener("touchmove", handleTouchMove, { passive: false }) // 关键：false
    container.addEventListener("touchend", handleTouchEnd)

    return () => {
      container.removeEventListener("touchstart", handleTouchStart)
      container.removeEventListener("touchmove", handleTouchMove)
      container.removeEventListener("touchend", handleTouchEnd)
    }
  }, [pullY, isRefreshing, onRefresh])

  return { containerRef, pullY, isRefreshing }
}

const Home = () => {
  const navigate = useNavigate()

  // 1. 数据请求
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["homeData"],
    queryFn: fetchHomeData,
    staleTime: 1000 * 60 * 10,
  })

  // 2. 使用自定义 Hook
  const { containerRef, pullY, isRefreshing } = usePullToRefresh(async () => {
    // 强制 refetch，忽略 staleTime
    await refetch()
  })

  // Loading (首次)
  if (isLoading && !isRefreshing && !data)
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
    <div
      ref={containerRef}
      className="min-h-screen bg-[#050505] text-white pb-24 font-sans selection:bg-emerald-500/30 overflow-hidden" // 加上 overflow-hidden 防止横向滚动
    >
      {/* 🟢 下拉刷新指示器 */}
      <div
        className="fixed top-0 left-0 right-0 flex justify-center z-50 pointer-events-none"
        style={{
          // 使用 translateY 控制位置，当刷新时停留在 60px 处，否则根据 pullY 移动
          transform: `translateY(${pullY > 0 ? pullY : 0}px)`,
          opacity: pullY > 0 ? 1 : 0,
          transition: isRefreshing
            ? "transform 0.2s"
            : "transform 0.2s, opacity 0.2s", // 回弹动画
        }}
      >
        <div className="mt-[-40px] bg-black/80 backdrop-blur text-emerald-500 p-2.5 rounded-full shadow-xl border border-white/10 flex items-center gap-2">
          <RefreshCw
            size={18}
            className={isRefreshing ? "animate-spin" : ""}
            style={{ transform: `rotate(${pullY * 3}deg)` }}
          />
          <span className="text-xs font-bold text-emerald-500">
            {isRefreshing ? "正在刷新..." : "下拉刷新"}
          </span>
        </div>
      </div>

      {/* 🔴 内容区域 (整体下移) */}
      <div
        style={{
          transform: `translateY(${pullY}px)`,
          transition: isRefreshing
            ? "transform 0.2s"
            : "transform 0.3s cubic-bezier(0.215, 0.61, 0.355, 1)", // 模拟 iOS 回弹曲线
        }}
        className="will-change-transform" // 性能优化
      >
        {!hasData ? (
          <div className="h-[80vh] flex flex-col items-center justify-center text-gray-500 gap-4">
            <RefreshCw size={40} className="opacity-50" />
            <p className="text-sm">暂无数据，请下拉刷新</p>
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
