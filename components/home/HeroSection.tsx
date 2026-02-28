import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Play, Info, Loader2, ChevronLeft, ChevronRight } from "lucide-react"
import { VideoItem } from "@/types"
import { useNavigate } from "react-router-dom"
import { matchLocalResource } from "@/services/api"
import toast from "react-hot-toast"

interface HeroSectionProps {
  items: VideoItem[] // 接收数组
}

export const HeroSection = ({ items }: HeroSectionProps) => {
  const navigate = useNavigate()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  // 如果没有数据，不渲染
  if (!items || items.length === 0) return null

  const currentItem = items[currentIndex]

  // 自动轮播 (8秒)
  useEffect(() => {
    const timer = setInterval(() => {
      handleNext()
    }, 5000)
    return () => clearInterval(timer)
  }, [currentIndex])

  // 切换逻辑
  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % items.length)
  }

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length)
  }

  // 🔥 统一跳转逻辑 (去详情页)
  // const handleNavigateToDetail = async () => {
  //   const item = currentItem

  //   // 1. 如果本身就是本地数据 (ID带下划线)，直接跳
  //   if (item.id && typeof item.id === "string" && item.id.includes("_")) {
  //     navigate(`/detail/${item.id}`)
  //     return
  //   }

  //   // 2. 如果是 TMDB 数据，先去后台匹配本地资源 ID
  //   setIsLoading(true)
  //   try {
  //     // 优先用 tmdb_id，没有则用 id (兼容不同接口返回格式)
  //     const tmdbId = (item as any).tmdb_id || item.id

  //     const res = await matchLocalResource({
  //       tmdb_id: tmdbId,
  //       title: item.title,
  //       category: item.category,
  //       year: item.year, // 传入分类辅助匹配
  //     })

  //     if (res.found && res.id) {
  //       navigate(`/detail/${res.id}`)
  //     } else {
  //       // 兜底：如果实在匹配不到，还是得跳搜索，否则用户什么都看不了
  //       // 但为了体验，我们可以提示一下
  //       toast.error(`暂未收录《${item.title}》，为您跳转全网搜索...`, {
  //         duration: 3000,
  //       })
  //       setTimeout(
  //         () => navigate(`/search?wd=${encodeURIComponent(item.title)}`),
  //         1000,
  //       )
  //     }
  //   } catch (e) {
  //     toast.error("网络异常，跳转搜索")
  //     navigate(`/search?wd=${encodeURIComponent(item.title)}`)
  //   } finally {
  //     setIsLoading(false)
  //   }
  // }
  const handleNavigateToDetail = async () => {
    const item = currentItem
    if (!item) return

    // 🕵️‍♂️ 1. 识别是否为本地资源 (MongoID 是 24位 hex 字符串)
    // 如果 item.id 是数字(TMDB ID) 或者如果不符合 MongoID 格式，则认为是外部数据
    const isLocalId =
      typeof item.id === "string" && /^[0-9a-fA-F]{24}$/.test(item.id)

    if (isLocalId) {
      // 本地资源，直接跳详情
      navigate(`/detail/${item.id}`)
      return
    }

    // 🕵️‍♂️ 2. 外部数据 (TMDB)，需要去后台匹配
    setIsLoading(true)
    const loadingToast = toast.loading("正在查找播放源...")

    try {
      // 兼容字段提取
      const tmdbId = (item as any).tmdb_id || item.id
      // 提取年份 (TMDB数据可能是 release_date)
      const rawDate =
        item.year || (item as any).release_date || (item as any).first_air_date
      const year = rawDate ? String(rawDate).substring(0, 4) : ""
      // 提取分类 (TMDB数据可能是 media_type)
      const category = item.category || (item as any).media_type || "movie"

      const res = await matchLocalResource({
        tmdb_id: tmdbId,
        title: item.title,
        category: category,
        year: year,
      })

      toast.dismiss(loadingToast)

      if (res.found && res.id) {
        toast.success(`为您找到资源：${res.title}`)
        navigate(`/detail/${res.id}`)
      } else {
        // 兜底策略：跳去搜索页
        toast.error(`暂无片源，跳转全网搜索...`, { duration: 3000 })
        navigate(`/search?wd=${encodeURIComponent(item.title)}`)
      }
    } catch (e) {
      toast.dismiss(loadingToast)
      toast.error("网络异常，跳转搜索")
      navigate(`/search?wd=${encodeURIComponent(item.title)}`)
    } finally {
      setIsLoading(false)
    }
  }
  const onDragEnd = (e: any, { offset, velocity }: any) => {
    const swipe = Math.abs(offset.x) > 50 && Math.abs(velocity.x) > 500
    if (swipe && offset.x > 0) handlePrev()
    else if (swipe && offset.x < 0) handleNext()
  }
  return (
    <div className="relative w-full h-[60vh] md:h-[85vh] overflow-hidden group">
      {/* 🎬 背景轮播层 (使用 AnimatePresence 实现淡入淡出) */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentItem.id}
          drag="x" // 🚀 开启横向拖拽
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={onDragEnd}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
        >
          <img
            src={currentItem.backdrop || currentItem.poster}
            alt={currentItem.title}
            className="w-full h-full object-cover"
          />
          {/* 渐变遮罩 */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-transparent to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#141414] via-[#141414]/40 to-transparent" />
        </motion.div>
      </AnimatePresence>

      {/* 🎮 左右切换按钮 (鼠标悬停显示) */}
      <div className="absolute inset-0 z-20 flex items-center justify-between px-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <button
          onClick={handlePrev}
          className="pointer-events-auto p-2 bg-black/30 hover:bg-black/60 text-white rounded-full backdrop-blur-md transition"
        >
          <ChevronLeft size={32} />
        </button>
        <button
          onClick={handleNext}
          className="pointer-events-auto p-2 bg-black/30 hover:bg-black/60 text-white rounded-full backdrop-blur-md transition"
        >
          <ChevronRight size={32} />
        </button>
      </div>

      {/* 📝 内容层 */}
      <div className="absolute bottom-12 left-0 w-full p-6 md:p-12 pb-16 md:pb-24 z-20 flex flex-col gap-4 max-w-3xl">
        {/* 标签动画 */}
        <motion.div
          key={`tags-${currentItem.id}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex gap-2"
        >
          <span className="px-2 py-1 bg-red-600 rounded text-xs font-bold text-white uppercase tracking-wider shadow-lg shadow-red-900/50">
            {currentItem.category === "tv" ? "剧集" : "电影"}
          </span>
          {currentItem.tags?.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-2 py-1 bg-white/20 backdrop-blur-md rounded text-xs font-bold text-white uppercase tracking-wider"
            >
              {tag}
            </span>
          ))}
          {currentItem.rating && (
            <span className="px-2 py-1 bg-yellow-500 text-black rounded text-xs font-black">
              TMDB {currentItem.rating.toFixed(1)}
            </span>
          )}
        </motion.div>

        {/* 标题动画 */}
        <motion.h1
          key={`title-${currentItem.id}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-4xl md:text-6xl font-black text-white drop-shadow-xl leading-tight"
        >
          {currentItem.title}
        </motion.h1>

        {/* 简介动画 */}
        <motion.p
          key={`desc-${currentItem.id}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-gray-300 text-sm md:text-lg line-clamp-2 md:line-clamp-3 max-w-xl drop-shadow-md"
        >
          {currentItem.overview || "暂无简介..."}
        </motion.p>

        {/* 按钮组 */}
        <motion.div
          key={`btn-${currentItem.id}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex gap-4 mt-4"
        >
          <button
            onClick={handleNavigateToDetail}
            disabled={isLoading}
            className="flex items-center gap-2 bg-white text-black px-8 py-3 rounded-lg font-bold hover:bg-gray-200 active:scale-95 transition disabled:opacity-70 shadow-lg shadow-white/10"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Play className="w-5 h-5 fill-black" />
            )}
            立即播放
          </button>

          <button
            onClick={handleNavigateToDetail}
            className="flex items-center gap-2 bg-gray-600/60 backdrop-blur-md text-white px-8 py-3 rounded-lg font-bold hover:bg-gray-600/80 active:scale-95 transition shadow-lg"
          >
            <Info className="w-5 h-5" /> 更多信息
          </button>
        </motion.div>
      </div>

      {/* 🚦 底部指示器 (Dots) */}
      <div className="absolute bottom-20 right-6 md:right-12 z-30 flex gap-2">
        {items.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              idx === currentIndex
                ? "bg-white w-6"
                : "bg-white/30 hover:bg-white/60"
            }`}
          />
        ))}
      </div>
    </div>
  )
}
