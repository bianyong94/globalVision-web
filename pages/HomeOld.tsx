import React, { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { fetchHomeData } from "../services/api"
import { getProxyUrl } from "../utils/common"
import { motion, AnimatePresence } from "framer-motion"
import {
  Play,
  Info,
  ChevronRight,
  Flame,
  Award,
  Zap,
  Tv,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react"

// Swiper
import { Swiper, SwiperSlide } from "swiper/react"
import { Autoplay, Pagination, EffectFade } from "swiper/modules"
import "swiper/css"
import "swiper/css/pagination"
import "swiper/css/effect-fade"

// 🏃 动画变体配置
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 50 } },
}

const Home = () => {
  const navigate = useNavigate()

  // 1. 数据请求
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["homeData"],
    queryFn: fetchHomeData,
    staleTime: 1000 * 60 * 10, // 10分钟缓存
  })

  // 2. 刷新逻辑
  const [isSpinning, setIsSpinning] = useState(false)
  const handleRefresh = () => {
    setIsSpinning(true)
    refetch()
    setTimeout(() => setIsSpinning(false), 1000)
  }

  // 3. Loading 状态 (骨架屏)
  if (isLoading && !data) return <HomeSkeleton />

  const hasData =
    data && (data.banners?.length > 0 || data.sections?.length > 0)

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="min-h-screen bg-[#050505] text-white pb-24 font-sans selection:bg-emerald-500/30 overflow-x-hidden"
    >
      {/* 🟢 悬浮刷新按钮 (毛玻璃风格) */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileTap={{ scale: 0.9 }}
        onClick={handleRefresh}
        disabled={isRefetching || isSpinning}
        className="fixed bottom-24 right-5 z-50 bg-black/60 backdrop-blur-xl text-emerald-400 p-3.5 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.3)] border border-emerald-500/20 transition-all hover:bg-black/80"
      >
        <RefreshCw
          size={22}
          className={isRefetching || isSpinning ? "animate-spin" : ""}
        />
      </motion.button>

      {/* 🔴 顶部搜索栏 (透明浮动) */}
      <div className="fixed top-0 left-0 right-0 z-40 px-4 py-3 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <div
          className="pointer-events-auto bg-white/10 backdrop-blur-md border border-white/10 rounded-full h-10 flex items-center px-4 gap-2 active:scale-95 transition-transform pt-[calc(0.75rem+env(safe-area-inset-top))] "
          onClick={() => navigate("/search")}
        >
          <Search size={16} className="text-gray-400" />
          <span className="text-xs text-gray-400">搜索影片、剧集、演员...</span>
        </div>
      </div>

      {!hasData ? (
        <div className="h-[80vh] flex flex-col items-center justify-center text-gray-500 gap-4">
          <RefreshCw size={40} className="opacity-50" />
          <p className="text-sm">暂无数据，请尝试刷新</p>
          <button
            onClick={handleRefresh}
            className="text-emerald-500 text-xs border border-emerald-500/30 px-4 py-1.5 rounded-full"
          >
            重试
          </button>
        </div>
      ) : (
        <>
          {/* 🎬 Hero Banner 轮播区 */}
          <section className="relative w-full h-[65vh] md:h-[70vh]">
            <Swiper
              modules={[Autoplay, Pagination, EffectFade]}
              effect="fade"
              speed={800}
              autoplay={{ delay: 6000, disableOnInteraction: false }}
              pagination={{ clickable: true, dynamicBullets: true }}
              loop={true}
              className="h-full w-full"
            >
              {data.banners.map((item: any, idx: number) => (
                <SwiperSlide
                  key={idx}
                  className="relative group cursor-pointer"
                  onClick={() => navigate(`/detail/${item.id}`)}
                >
                  {/* 背景图 */}
                  <div className="absolute inset-0">
                    <img
                      src={getProxyUrl(item.poster, { w: 1280, q: 72 })}
                      alt={item.title}
                      className="w-full h-full object-cover object-top opacity-100 transition-transform duration-[10s] ease-linear group-hover:scale-105"
                      loading={idx === 0 ? "eager" : "lazy"}
                      fetchPriority={idx === 0 ? "high" : "auto"}
                      decoding="async"
                    />
                    {/* 遮罩层：下部渐变黑 + 顶部渐变黑 */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/40 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent" />
                  </div>

                  {/* 内容信息 */}
                  <div className="absolute bottom-0 left-0 w-full p-5 pb-12 z-20 flex flex-col items-start">
                    {/* 标签 */}
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-2 mb-3"
                    >
                      <span className="bg-emerald-600/90 backdrop-blur text-[10px] font-bold px-2 py-0.5 rounded text-white shadow-lg shadow-emerald-500/20 uppercase tracking-wider">
                        Featured
                      </span>
                      {item.tags &&
                        item.tags.slice(0, 2).map((tag: string, i: number) => (
                          <span
                            key={i}
                            className="text-[10px] bg-white/10 backdrop-blur px-2 py-0.5 rounded text-gray-200 border border-white/10"
                          >
                            {tag}
                          </span>
                        ))}
                    </motion.div>

                    {/* 标题 */}
                    <h1 className="text-3xl md:text-5xl font-black text-white mb-2 leading-tight drop-shadow-2xl line-clamp-2 w-[90%]">
                      {item.title}
                    </h1>

                    {/* 简介/状态 */}
                    <p className="text-xs text-gray-300 line-clamp-1 mb-5 opacity-80 font-medium">
                      {item.remarks} · {item.category || "精选"}
                    </p>

                    {/* 按钮组 */}
                    <div className="flex items-center gap-3 w-full max-w-md">
                      <button className="flex-1 bg-white text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                        <Play size={18} fill="currentColor" /> 立即播放
                      </button>
                      <button className="flex-1 bg-white/10 backdrop-blur-md border border-white/10 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform">
                        <Info size={18} /> 详情
                      </button>
                    </div>
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>
          </section>

          {/* ⚡ 快捷分类胶囊 (Quick Filters) */}
          <div className="relative z-20 -mt-6 px-4 mb-6">
            <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2">
              <QuickPill
                icon={<Flame size={14} className="text-red-500" />}
                label="Netflix"
                link="/search?q=Netflix"
              />
              <QuickPill
                icon={<Award size={14} className="text-yellow-500" />}
                label="豆瓣高分"
                link="/search?q=高分"
              />
              <QuickPill
                icon={<Zap size={14} className="text-blue-500" />}
                label="4K原盘"
                link="/search?tag=4k"
              />
              <QuickPill
                icon={<Tv size={14} className="text-purple-500" />}
                label="短剧"
                link="/search?tag=miniseries"
              />
            </div>
          </div>

          {/* 🌊 动态 Sections 渲染 (核心修改) */}
          <div className="space-y-10">
            {data.sections?.map((section: any, index: number) => (
              <DynamicSection key={index} section={section} delay={index} />
            ))}

            {/* 底部版权 */}
            <div className="py-12 flex flex-col items-center justify-center opacity-30 gap-2">
              <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center">
                <Play size={14} fill="currentColor" />
              </div>
              <span className="text-[10px] tracking-[0.3em] uppercase text-gray-500">
                Global Vision
              </span>
            </div>
          </div>
        </>
      )}
    </motion.div>
  )
}

// 🧩 子组件：快捷胶囊
const QuickPill = ({
  icon,
  label,
  link,
}: {
  icon: React.ReactNode
  label: string
  link: string
}) => {
  const navigate = useNavigate()
  return (
    <div
      onClick={() => navigate(link)}
      className="flex items-center gap-2 bg-[#1a1a1a] border border-white/10 px-4 py-2.5 rounded-xl whitespace-nowrap active:scale-95 transition-transform cursor-pointer shadow-lg"
    >
      {icon}
      <span className="text-xs font-bold text-gray-200">{label}</span>
    </div>
  )
}

// 🧩 子组件：动态 Section (支持 Scroll 和 Grid)
const DynamicSection = ({
  section,
  delay,
}: {
  section: any
  delay: number
}) => {
  const navigate = useNavigate()

  if (!section.data || section.data.length === 0) return null

  return (
    <motion.section variants={itemVariants} className="pl-4">
      {/* 标题栏 */}
      <div className="flex items-end justify-between pr-4 mb-4">
        <div>
          <h2 className="text-lg font-black text-white tracking-wide leading-none">
            {section.title}
          </h2>
          <div className="h-1 w-6 bg-emerald-500 mt-2 rounded-full" />
        </div>
        <button
          className="text-xs font-bold text-gray-500 flex items-center hover:text-white transition-colors py-2"
          onClick={() => navigate("/search")} // 这里可以根据 section 类型跳不同路由
        >
          查看全部 <ChevronRight size={12} className="ml-1" />
        </button>
      </div>

      {/* 内容区：根据 type 切换布局 */}
      {section.type === "scroll" ? (
        // --- 横向滚动布局 (Netflix Style) ---
        <div className="flex overflow-x-auto gap-3 pr-4 pb-4 no-scrollbar snap-x">
          {section.data.map((item: any) => (
            <VideoCard key={item.id} item={item} layout="portrait" />
          ))}
        </div>
      ) : (
        // --- 网格布局 (Grid Style) ---
        <div className="grid grid-cols-2 gap-3 pr-4">
          {section.data.map((item: any) => (
            <VideoCard key={item.id} item={item} layout="landscape" />
          ))}
        </div>
      )}
    </motion.section>
  )
}

// 🧩 子组件：统一视频卡片
const VideoCard = ({
  item,
  layout,
}: {
  item: any
  layout: "portrait" | "landscape"
}) => {
  const navigate = useNavigate()

  // 尺寸配置
  const sizeClass = layout === "portrait" ? "w-[110px] md:w-[140px]" : "w-full"

  const aspectClass = layout === "portrait" ? "aspect-[2/3]" : "aspect-video" // 16:9

  return (
    <div
      onClick={() => navigate(`/detail/${item.id}`)}
      className={`flex-shrink-0 snap-start cursor-pointer group relative ${sizeClass}`}
    >
      {/* 海报容器 */}
      <div
        className={`rounded-xl overflow-hidden bg-[#1a1a1a] border border-white/5 relative shadow-lg transition-transform duration-300 group-active:scale-95 ${aspectClass}`}
      >
        <img
          src={getProxyUrl(item.poster)}
          className="w-full h-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
          loading="lazy"
          alt={item.title}
        />

        {/* 左上角角标 (评分或画质) */}
        <div className="absolute top-1.5 left-1.5 flex flex-col gap-1 items-start">
          {item.rating > 0 && (
            <span className="bg-amber-500/90 backdrop-blur-sm text-[9px] font-black text-black px-1.5 py-0.5 rounded shadow-sm">
              {item.rating.toFixed(1)}
            </span>
          )}
          {item.tags?.includes("4k") && (
            <span className="bg-black/60 backdrop-blur-sm border border-white/10 text-[8px] text-emerald-400 px-1.5 py-0.5 rounded">
              4K
            </span>
          )}
        </div>

        {/* 底部渐变文字 */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/60 to-transparent p-2 pt-8 flex flex-col justify-end">
          {layout === "landscape" && (
            <h3 className="text-xs font-bold text-white truncate mb-0.5">
              {item.title}
            </h3>
          )}
          <p className="text-[9px] text-gray-400 truncate text-right">
            {item.remarks || "更新中"}
          </p>
        </div>
      </div>

      {/* 竖版标题在外部 */}
      {layout === "portrait" && (
        <div className="mt-2 px-0.5">
          <h3 className="text-xs font-bold text-gray-200 truncate leading-snug">
            {item.title}
          </h3>
        </div>
      )}
    </div>
  )
}

// 💀 Loading 骨架屏
const HomeSkeleton = () => (
  <div className="min-h-screen bg-[#050505] p-4 space-y-8 animate-pulse">
    <div className="w-full h-[60vh] bg-white/5 rounded-2xl" />
    <div className="flex gap-3 overflow-hidden">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="w-24 h-8 bg-white/5 rounded-xl shrink-0" />
      ))}
    </div>
    {[1, 2].map((i) => (
      <div key={i} className="space-y-3">
        <div className="w-20 h-4 bg-white/5 rounded" />
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3, 4].map((j) => (
            <div key={j} className="w-28 h-40 bg-white/5 rounded-xl shrink-0" />
          ))}
        </div>
      </div>
    ))}
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <Loader2 className="w-8 h-8 text-emerald-500 animate-spin opacity-50" />
    </div>
  </div>
)

export default Home
