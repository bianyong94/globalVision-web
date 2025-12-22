import React from "react"
import { VideoResource } from "../types"
import { Play, Star } from "lucide-react"

interface VideoGridProps {
  videos: VideoResource[]
  onVideoClick: (video: VideoResource) => void
  darkMode: boolean
}

const VideoGrid: React.FC<VideoGridProps> = ({
  videos,
  onVideoClick,
  darkMode,
}) => {
  return (
    <div className="grid grid-cols-3 gap-3 p-4">
      {videos?.map((video) => (
        <div
          key={`${video.type}-${video.id}`}
          onClick={() => onVideoClick(video)}
          className="group relative cursor-pointer"
        >
          <div className="aspect-[2/3] rounded-xl overflow-hidden relative shadow-lg bg-zinc-800">
            <img
              src={video.poster}
              alt={video.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              loading="lazy"
              onError={(e) => {
                ;(e.target as HTMLImageElement).src =
                  "https://via.placeholder.com/300x450?text=No+Poster"
              }}
            />
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/60 transition-colors flex items-center justify-center">
              <div className="bg-blue-600 rounded-full p-2.5 scale-0 group-hover:scale-100 transition-all duration-300 shadow-xl">
                <Play size={18} fill="white" className="text-white ml-0.5" />
              </div>
            </div>
            {video.rating && (
              <div className="absolute top-2 left-2 bg-yellow-500/90 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] text-black font-bold flex items-center gap-0.5">
                <Star size={8} fill="black" /> {video.rating}
              </div>
            )}
          </div>
          <h3
            className={`mt-2 text-xs font-bold line-clamp-1 ${
              darkMode ? "text-zinc-200" : "text-gray-800"
            }`}
          >
            {video.title}
          </h3>
          <p className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-tighter">
            {video.type || "视频"} ·{" "}
            {video.date?.split("-")[0] || video.year || ""}
          </p>
        </div>
      ))}
    </div>
  )
}

export default VideoGrid
