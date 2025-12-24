import React, { useEffect, useState, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { fetchVideoDetail, saveHistory, fetchHistory } from "../services/api"
import { VideoDetail } from "../types"
import Player from "../components/Player"
import { useAuth } from "../context/AuthContext"
import {
  Loader2,
  ChevronLeft,
  Calendar,
  MapPin,
  Tag,
  PlayCircle,
  Info,
  History as HistoryIcon,
  Star,
} from "lucide-react"

const Detail = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [detail, setDetail] = useState<VideoDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentEpIndex, setCurrentEpIndex] = useState(0)
  const [startTime, setStartTime] = useState(0)

  // Refs 防止闭包问题
  const detailRef = useRef<VideoDetail | null>(null)
  const currentEpIndexRef = useRef(0)

  useEffect(() => {
    if (!id) return
    
    const load = async () => {
      setLoading(true)
      try {
        const data = await fetchVideoDetail(id)
        setDetail(data)
        detailRef.current = data

        if (user) {
          const historyList = await fetchHistory(user.username)
          // 强制转字符串对比，防止类型不一致
          const record = historyList.find((h: any) => String(h.id) === String(data.id))
          
          if (record) {
            const savedEpIdx = record.episodeIndex || 0
            const savedTime = record.progress || 0
            
            if (savedEpIdx < data.episodes.length) {
              setCurrentEpIndex(savedEpIdx)
              currentEpIndexRef.current = savedEpIdx
            }
            setStartTime(savedTime)
          }
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, user?.username])

  const handleSaveHistory = (time: number) => {
    if (!user || !detailRef.current) return
    if (time > 5) {
      saveHistory({
        username: user.username,
        video: {
          id: detailRef.current.id,
          title: detailRef.current.title,
          poster: detailRef.current.poster,
          type: detailRef.current.type,
        },
        episodeIndex: currentEpIndexRef.current,
        progress: time,
      })
    }
  }

  const handleEpisodeChange = (index: number) => {
    setCurrentEpIndex(index)
    currentEpIndexRef.current = index
    setStartTime(0)
    handleSaveHistory(0)
  }

  if (loading)
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <Loader2 className="animate-spin text-emerald-500 w-8 h-8" />
      </div>
    )
  
  if (!detail)
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center text-gray-500 gap-4">
        <Info size={40} />
        <p>资源不存在或已下架</p>
        <button onClick={() => navigate(-1)} className="text-white border border-white/20 px-4 py-2 rounded-full text-sm">
          返回上一页
        </button>
      </div>
    )

  const currentEp = detail.episodes[currentEpIndex]

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 font-sans flex flex-col">
      
      {/* --- 播放器区域 (吸顶 + 极高层级) --- */}
      {/* 修复：使用 sticky top-0 且设置 z-50，确保覆盖在内容之上 */}
      {/* 修复：背景强制黑色，防止下方文字透上来 */}
      <div className="sticky top-0 z-50 w-full aspect-video bg-black shadow-2xl shrink-0">
        
        {/* 返回按钮 (悬浮在播放器左上角，不再占用独立导航栏) */}
        <div className="absolute top-0 left-0 w-full h-14 bg-gradient-to-b from-black/60 to-transparent z-[60] pointer-events-none">
           {/* pointer-events-auto 确保按钮可点击 */}
           <button 
             onClick={() => navigate(-1)} 
             className="absolute top-2 left-2 p-2 pointer-events-auto text-white hover:text-emerald-400 transition-colors"
           >
             <ChevronLeft size={28} className="drop-shadow-md" />
           </button>
        </div>

        {currentEp ? (
          <Player
            url={currentEp.link}
            poster={detail.backdrop || detail.poster}
            initialTime={startTime}
            onTimeUpdate={(t) => handleSaveHistory(t)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 gap-2">
            <Info size={32} />
            <span className="text-xs">暂无播放源</span>
          </div>
        )}
      </div>

      {/* --- 详情内容区域 (可滚动) --- */}
      {/* 修复：relative z-10 确保层级低于播放器 */}
      {/* 修复：bg-[#0a0a0a] 确保背景不透明 */}
      <div className="flex-1 relative z-10 bg-[#0a0a0a] pb-20 mt-[50px]">
        
        {/* 历史记录提示条 */}
        {startTime > 0 && (
          <div className="bg-[#121212] border-b border-white/5 px-4 py-2 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-emerald-400">
              <HistoryIcon size={12} />
              <span>续播：第{currentEpIndex + 1}集 {Math.floor(startTime / 60)}分{Math.floor(startTime % 60)}秒</span>
            </div>
            <button onClick={() => { setStartTime(0); document.querySelector('video')?.load(); }} className="text-gray-500 hover:text-white">
              从头播放
            </button>
          </div>
        )}

        <div className="p-5 space-y-6">
          {/* 标题与评分 */}
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1">
              <h1 className="text-xl font-bold text-white leading-snug">{detail.title}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-gray-400">
                <span className="text-emerald-400 font-medium">{detail.year}</span>
                <span>•</span>
                <span>{detail.area}</span>
                <span>•</span>
                <span className="bg-white/10 px-1.5 py-0.5 rounded text-gray-300">{detail.type}</span>
              </div>
            </div>
            {detail.rating > 0 && (
              <div className="flex flex-col items-end flex-shrink-0">
                <span className="text-2xl font-black text-yellow-500 leading-none flex items-center gap-1">
                  {detail.rating} <span className="text-[10px] font-normal text-gray-600 mt-1">分</span>
                </span>
                <div className="flex gap-0.5 mt-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={8} className={i < Math.round(detail.rating / 2) ? "fill-yellow-500 text-yellow-500" : "text-gray-700"} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 简介 */}
          <div className="bg-white/5 p-3 rounded-lg border border-white/5">
            <p className="text-sm text-gray-300 leading-relaxed text-justify line-clamp-3 active:line-clamp-none transition-all" onClick={(e) => e.currentTarget.classList.toggle('line-clamp-3')}>
              {detail.overview ? detail.overview.trim() : "暂无简介"}
            </p>
            <div className="text-center mt-1">
               <span className="text-[10px] text-gray-600">点击展开/收起</span>
            </div>
          </div>

          {/* 选集 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-white flex items-center gap-2">
                <PlayCircle size={16} className="text-emerald-500" /> 
                选集 <span className="text-xs font-normal text-gray-500">({detail.episodes.length})</span>
              </h3>
              <span className="text-[10px] text-gray-600 bg-gray-900 px-2 py-1 rounded">
                更新至 {detail.episodes[detail.episodes.length - 1]?.name}
              </span>
            </div>
            
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
              {detail.episodes.map((ep, idx) => {
                const isActive = idx === currentEpIndex
                return (
                  <button
                    key={idx}
                    onClick={() => handleEpisodeChange(idx)}
                    className={`
                      relative text-xs h-10 rounded-lg transition-all duration-200 font-medium truncate px-1 border
                      ${isActive 
                        ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-900/50" 
                        : "bg-[#161616] border-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                      }
                    `}
                  >
                    {isActive && (
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-white rounded-full animate-pulse shadow-[0_0_5px_white]" />
                    )}
                    {ep.name.replace(/第|集/g, "")}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 演职员表 */}
          {(detail.actors || detail.director) && (
            <div className="pt-2 border-t border-white/5">
              <h3 className="text-sm font-bold text-gray-400 mb-2">演职员信息</h3>
              <div className="space-y-1 text-xs text-gray-500">
                {detail.director && <p><span className="text-gray-600 mr-2">导演:</span> {detail.director}</p>}
                {detail.actors && <p className="leading-5"><span className="text-gray-600 mr-2">主演:</span> {detail.actors}</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Detail