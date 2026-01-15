import { motion } from "framer-motion"
import { Star, PlayCircle } from "lucide-react"
import { VideoItem } from "@/types"
import { matchLocalResource } from "@/services/api" // 引入刚才写的匹配接口
import { useNavigate } from "react-router-dom"
import toast from "react-hot-toast"
import { getProxyUrl } from "@/utils/common"

interface MediaCardProps {
  video: VideoItem
  layout?: "portrait" | "landscape"
  year: string | number // 竖图或横图
}

export const MediaCard = ({ video, layout = "portrait" }: MediaCardProps) => {
  const navigate = useNavigate()

  const handleClick = async () => {
    // 如果已有本地 ID (说明是普通列表查出来的)，直接跳转
    if (
      (typeof video.id === "string" && video.id.includes("_")) ||
      (video as any).uniq_id
    ) {
      navigate(`/detail/${video.id}`)
      return
    }

    // 如果是 TMDB 数据 (只有 tmdb_id)，需要去后台匹配
    const toastId = toast.loading("正在寻找播放源...")
    try {
      // 传入 category 帮助后端更精准匹配
      const category =
        video.category || (video.tags?.includes("netflix") ? "tv" : "movie")

      const res = await matchLocalResource({
        tmdb_id: video.id, // 这里假设 TMDB 接口把 id 映射为了 id 或 tmdb_id
        title: video.title,
        category: category,
        year: video.year,
      })

      toast.dismiss(toastId)

      if (res.found && res.id) {
        navigate(`/detail/${res.id}`)
      } else {
        toast.error(`暂无《${video.title}》片源，尝试搜索...`)
        // 没匹配到，跳转搜索页自动搜索
        setTimeout(
          () => navigate(`/search?wd=${encodeURIComponent(video.title)}`),
          1000
        )
      }
    } catch (e) {
      toast.dismiss(toastId)
      toast.error("匹配失败，请重试")
    }
  }

  return (
    <motion.div
      className={`relative group cursor-pointer flex-shrink-0 ${
        layout === "landscape" ? "w-[280px]" : "w-[160px] md:w-[180px]"
      }`}
      whileHover={{ scale: 1.05, zIndex: 10 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      onClick={handleClick}
    >
      <div
        className={`relative overflow-hidden rounded-lg shadow-lg bg-gray-800 ${
          layout === "landscape" ? "aspect-video" : "aspect-[2/3]"
        }`}
      >
        {/* 图片 */}
        <img
          src={
            layout === "landscape"
              ? getProxyUrl(video.backdrop) || getProxyUrl(video.poster)
              : getProxyUrl(video.poster)
          }
          alt={video.title}
          className="w-full h-full object-cover transition-opacity duration-300 group-hover:opacity-80"
          loading="lazy"
        />

        {/* 悬停时的遮罩层 */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <PlayCircle className="w-12 h-12 text-white/90 drop-shadow-lg" />
        </div>

        {/* 评分角标 */}
        {video.rating && video.rating > 0 && (
          <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded flex items-center gap-1 text-xs text-yellow-400 font-bold border border-white/10">
            <Star className="w-3 h-3 fill-yellow-400" />
            {video.rating.toFixed(1)}
          </div>
        )}

        {/* Netflix 标 (如果是 Netflix 剧) */}
        {video.tags?.some((t) => t.toLowerCase().includes("netflix")) && (
          <div className="absolute top-2 left-2">
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg"
              className="h-4 drop-shadow-md"
              alt="N"
            />
          </div>
        )}
      </div>

      {/* 标题 */}
      <div className="mt-2 px-1">
        <h3 className="text-sm font-medium text-gray-100 truncate">
          {video.title}
        </h3>
        {video.year && <p className="text-xs text-gray-500">{video.year}</p>}
      </div>
    </motion.div>
  )
}
