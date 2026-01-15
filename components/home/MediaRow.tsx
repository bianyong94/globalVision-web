import { useRef } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { VideoItem } from "@/types"
import { MediaCard } from "./MediaCard"

interface MediaRowProps {
  title: string
  items: VideoItem[]
  isPoster?: boolean // true=竖图, false=横图(Netflix样式)
}

export const MediaRow = ({ title, items, isPoster = true }: MediaRowProps) => {
  const rowRef = useRef<HTMLDivElement>(null)

  const scroll = (direction: "left" | "right") => {
    if (rowRef.current) {
      const { scrollLeft, clientWidth } = rowRef.current
      const scrollTo =
        direction === "left"
          ? scrollLeft - clientWidth
          : scrollLeft + clientWidth
      rowRef.current.scrollTo({ left: scrollTo, behavior: "smooth" })
    }
  }

  if (!items || items.length === 0) return null

  return (
    <div className="py-6 space-y-4 group">
      <div className="px-6 md:px-12 flex justify-between items-end">
        <h2 className="text-xl md:text-2xl font-bold text-white hover:text-red-500 transition cursor-pointer">
          {title}
        </h2>
        {/* <span className="text-xs text-gray-500 cursor-pointer hover:text-white">
          查看全部 &gt;
        </span> */}
      </div>

      <div className="relative">
        {/* 左箭头 */}
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-0 bottom-0 z-40 bg-black/50 hover:bg-black/70 w-12 items-center justify-center hidden group-hover:flex transition-opacity opacity-0 group-hover:opacity-100 backdrop-blur-sm"
        >
          <ChevronLeft className="w-8 h-8 text-white" />
        </button>

        {/* 滚动容器 */}
        <div
          ref={rowRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide px-6 md:px-12 pb-4 scroll-smooth"
        >
          {items.map((video, index) => {
            const uniqueKey = video.id || (video as any).tmdb_id || index
            return (
              <MediaCard
                key={uniqueKey}
                video={video}
                layout={isPoster ? "portrait" : "landscape"}
              />
            )
          })}
        </div>

        {/* 右箭头 */}
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-0 bottom-0 z-40 bg-black/50 hover:bg-black/70 w-12 items-center justify-center hidden group-hover:flex transition-opacity opacity-0 group-hover:opacity-100 backdrop-blur-sm"
        >
          <ChevronRight className="w-8 h-8 text-white" />
        </button>
      </div>
    </div>
  )
}
