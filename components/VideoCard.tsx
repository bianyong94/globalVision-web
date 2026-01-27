import React from "react"
import { VideoSummary } from "../types"
import { useNavigate } from "react-router-dom"
import { Play } from "lucide-react"
import { getProxyUrl } from "../utils/common"

interface Props {
  video: VideoSummary
  layout?: "grid" | "list"
}

const VideoCard: React.FC<Props> = ({ video, layout = "grid" }) => {
  const navigate = useNavigate()
  const handleImageError = (
    e: React.SyntheticEvent<HTMLImageElement, Event>,
  ) => {
    e.currentTarget.src = "https://picsum.photos/300/450?text=No+Image"
  }

  if (layout === "list") {
    return (
      <>
        <div
          className="group relative flex flex-col gap-2 rounded-xl" // 基础样式移到这里
        >
          <div
            onClick={() => navigate(`/detail/${video._id}`)}
            className="flex gap-3 bg-surface rounded-lg overflow-hidden p-2 mb-3 cursor-pointer active:scale-95 transition-transform"
          >
            <div className="relative w-24 h-32 flex-shrink-0 rounded-md overflow-hidden bg-gray-800">
              <img
                src={getProxyUrl(video.poster)}
                alt={video.title}
                loading="lazy"
                onError={handleImageError}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-1 right-1 bg-black/60 text-[10px] px-1 rounded text-white">
                {video.remarks}
              </div>
            </div>
            <div className="flex flex-col justify-center flex-1">
              <h3 className="text-sm font-bold text-white mb-1 line-clamp-2">
                {video.title}
              </h3>
              <p className="text-xs text-gray-400 mb-2">
                {video.type} • {video.year}
              </p>
              {video.overview && (
                <p className="text-xs text-gray-500 line-clamp-2">
                  {video.overview}
                </p>
              )}
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <div
      className="group relative flex flex-col gap-2 rounded-xl" // 基础样式移到这里
    >
      <div
        onClick={() => navigate(`/detail/${video.id}`)}
        className="relative flex flex-col cursor-pointer group"
      >
        <div className="relative aspect-[3/4.5] rounded-lg overflow-hidden bg-gray-800 mb-2">
          <img
            src={getProxyUrl(video.poster)}
            loading="lazy"
            alt={video.title}
            onError={handleImageError}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors" />
          <div className="absolute top-1 right-1 bg-primary text-[10px] font-bold px-1.5 py-0.5 rounded text-white shadow-sm">
            {video.remarks}
          </div>
          <div className="absolute bottom-1 right-1 bg-black/60 text-[10px] px-1.5 py-0.5 rounded text-yellow-400 font-bold">
            {video.rating || "N/A"}
          </div>
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="bg-white/20 backdrop-blur-sm p-2 rounded-full">
              <Play fill="white" size={20} className="text-white" />
            </div>
          </div>
        </div>
        <h3 className="text-sm font-medium text-gray-200 line-clamp-1">
          {video.title}
        </h3>
        <p className="text-xs text-gray-500">{video.year}</p>
      </div>
    </div>
  )
}

export default VideoCard
