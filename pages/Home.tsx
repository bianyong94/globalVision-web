import React, { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { fetchHomeData } from "../services/api"
import { getProxyUrl } from "../utils/common"
import {
  Play,
  Info,
  ChevronRight,
  Flame,
  Sparkles,
  Tv,
  Clapperboard,
  Music,
  Globe,
  Loader2,
} from "lucide-react"

// Swiper
import { Swiper, SwiperSlide } from "swiper/react"
import { Autoplay, Pagination, EffectFade } from "swiper/modules"
import "swiper/css"
import "swiper/css/pagination"
import "swiper/css/effect-fade"

const Home = () => {
  const navigate = useNavigate()

  // 使用 React Query 替代 useEffect (你之前要求的缓存策略)
  const { data, isLoading } = useQuery({
    queryKey: ["homeData"],
    queryFn: fetchHomeData,
    staleTime: 1000 * 60 * 10, // 10分钟缓存
  })

  if (isLoading)
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
        <p className="text-xs text-gray-500 animate-pulse tracking-widest">
          LOADING G-VISION...
        </p>
      </div>
    )

  if (!data) return null

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24 font-sans selection:bg-emerald-500/30">
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

      <div className="space-y-8 mt-2">
        {/* 2. 电影热榜 (大横卡) */}
        <Section
          title="热门大片"
          icon={<Flame className="text-orange-500" />}
          items={data.movies}
          categoryId={1}
          type="landscape" // 横向海报模式
        />

        {/* 3. 剧集 (竖卡) */}
        <Section
          title="必追好剧"
          icon={<Tv className="text-cyan-400" />}
          items={data.tvs}
          categoryId={2}
        />

        {/* 4. 综艺 (竖卡) */}
        {data.varieties && data.varieties.length > 0 && (
          <Section
            title="热门综艺"
            icon={<Music className="text-pink-400" />}
            items={data.varieties}
            categoryId={3}
          />
        )}

        {/* 5. 动漫 (竖卡) */}
        <Section
          title="新番动漫"
          icon={<Clapperboard className="text-emerald-400" />}
          items={data.animes}
          categoryId={4}
        />

        {/* 6. 纪录片 (横卡) */}
        {data.documentaries && data.documentaries.length > 0 && (
          <Section
            title="探索世界"
            icon={<Globe className="text-blue-400" />}
            items={data.documentaries}
            categoryId={20}
            type="landscape"
          />
        )}

        <div className="py-8 flex justify-center opacity-30">
          <span className="text-[10px] tracking-widest uppercase text-gray-500">
            - Global Vision -
          </span>
        </div>
      </div>
    </div>
  )
}

// --- 通用 Section 组件 (复用逻辑) ---
const Section = ({
  title,
  icon,
  items,
  categoryId,
  type = "portrait",
}: any) => {
  const navigate = useNavigate()

  if (!items || items.length === 0) return null

  return (
    <section className="pl-4">
      {/* 标题栏 */}
      <div className="flex items-center justify-between pr-4 mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-lg font-bold text-white tracking-wide">
            {title}
          </h2>
        </div>
        <button
          className="text-xs text-gray-500 flex items-center hover:text-white transition-colors"
          onClick={() => navigate(`/search?t=${categoryId}`)}
        >
          全部 <ChevronRight size={14} />
        </button>
      </div>

      {/* 滚动列表 */}
      <div className="flex overflow-x-auto gap-3 pr-4 pb-2 no-scrollbar touch-pan-x snap-x">
        {items.map((item: any) => (
          <div
            key={item.id}
            className={`flex-shrink-0 snap-start group cursor-pointer ${
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
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
                alt={item.title}
              />
              {/* 评分角标 */}
              {item.rating > 0 && (
                <div className="absolute top-1 right-1 bg-black/60 backdrop-blur-sm text-[9px] text-white px-1.5 py-0.5 rounded">
                  {item.rating}
                </div>
              )}
              {/* 更新提示 */}
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 pt-6">
                <p className="text-[9px] text-gray-300 truncate text-right">
                  {item.remarks}
                </p>
              </div>
            </div>
            <h3 className="text-xs text-gray-300 truncate group-active:text-emerald-400 transition-colors">
              {item.title}
            </h3>
          </div>
        ))}
      </div>
    </section>
  )
}

export default Home
