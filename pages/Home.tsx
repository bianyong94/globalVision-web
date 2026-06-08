import React, { useEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import {
  ChevronRight,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react"
import SEO from "../components/SEO"
import {
  fetchAppConfig,
  fetchHomeData,
  fetchScreenMovies,
} from "../services/api"
import { getProxyUrl } from "../utils/common"
import { MovieListItem } from "../types"

const Home = () => {
  const navigate = useNavigate()
  const [activeTopicId, setActiveTopicId] = useState<number>(0)

  // 轮播图当前聚焦的索引状态
  const [currentSlide, setCurrentSlide] = useState(0)
  const carouselRef = useRef<HTMLDivElement>(null)

  const configQuery = useQuery({
    queryKey: ["app-config"],
    queryFn: fetchAppConfig,
    staleTime: 1000 * 60 * 10,
  })

  const homeQuery = useQuery({
    queryKey: ["home-data"],
    queryFn: fetchHomeData,
    staleTime: 1000 * 60 * 5,
  })

  const topicQuery = useQuery({
    queryKey: ["topic-recommend", activeTopicId],
    queryFn: () =>
      fetchScreenMovies({
        type_id: activeTopicId,
        page: 1,
        pageSize: 12,
      }),
    enabled: activeTopicId > 0,
    staleTime: 1000 * 60 * 5,
  })

  const topTabs = configQuery.data?.index_top_nav || []
  const tabItems = useMemo(() => {
    const filteredTabs = topTabs.filter(
      (tab) => tab.id !== 0 && tab.name !== "推荐",
    )
    return [{ id: 0, name: "推荐" }, ...filteredTabs]
  }, [topTabs])

  const banners = homeQuery.data?.banners || []
  const sections = homeQuery.data?.sections || []
  const topicItems = topicQuery.data?.list || []

  const handleOpen = (
    item: MovieListItem | { id: string; source_ref?: string } | any,
  ) => {
    const id =
      item && "source_ref" in item && item.source_ref
        ? item.source_ref
        : item?.id
    if (id) navigate(`/detail/${id}`)
  }

  // 过滤出除了第一个模块（最新上线·全网热播）之外的其余动态区块
  const filteredSections = useMemo(() => {
    if (sections.length <= 1) return sections
    return sections.slice(1)
  }, [sections])

  // 轮播图数据源
  const carouselItems = useMemo(() => {
    if (sections.length > 0 && sections[0]?.data) {
      return sections[0].data
    }
    return banners
  }, [sections, banners])

  // 自动轮播与滚动监听逻辑
  useEffect(() => {
    if (activeTopicId !== 0 || carouselItems.length <= 1) return

    const timer = setInterval(() => {
      setCurrentSlide((prev) => {
        const nextIndex = prev >= carouselItems.length - 1 ? 0 : prev + 1

        // 自动计算宽度并滚动物理视图
        if (carouselRef.current) {
          const slideElement = carouselRef.current.children[
            nextIndex
          ] as HTMLElement
          if (slideElement) {
            carouselRef.current.scrollTo({
              left: slideElement.offsetLeft - carouselRef.current.offsetLeft,
              behavior: "smooth",
            })
          }
        }
        return nextIndex
      })
    }, 4000) // 4秒自动切换

    return () => clearInterval(timer)
  }, [carouselItems, activeTopicId])

  // 用户手动手势左右划动时，同步更新指示器数字
  const handleScroll = () => {
    if (!carouselRef.current || carouselItems.length === 0) return
    const { scrollLeft, clientWidth } = carouselRef.current
    // 依据当前的滚动比例，计算出滑到了第几个卡片
    const index = Math.round(scrollLeft / clientWidth)
    if (index >= 0 && index < carouselItems.length) {
      setCurrentSlide(index)
    }
  }

  if (homeQuery.isLoading && !homeQuery.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#08090f] text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-lime-400" />
          <p className="text-sm text-white/40 tracking-wide">
            正在加载精彩内容...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[radial-gradient(circle_at_top,_rgba(132,204,22,0.05),_transparent_40%),linear-gradient(180deg,#0d1121_0%,#08090f_30%,#08090f_100%)] pb-28 text-white antialiased">
      <SEO
        title="首页"
        description="基于接口文档重构的影视首页，提供推荐、分类和精选内容入口。"
      />

      {/* 整体强固顶导航栏区域（包含搜索框 + Tab 切换栏） */}
      <div className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#08090f]/90 backdrop-blur-xl shadow-lg shadow-black/20">
        <div className="mx-auto max-w-6xl px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
          {/* 搜索框 */}
          <div
            onClick={() => navigate("/search")}
            className="flex h-11 items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white/40 transition active:scale-[0.98] hover:border-lime-400/30 hover:bg-white/10 cursor-pointer"
          >
            <Search size={15} className="text-white/40" />
            <span>搜索影片、剧集、演员</span>
          </div>

          {/* Tab 切换栏 */}
          <div className="mt-4 flex gap-2 overflow-x-auto pb-3 no-scrollbar scroll-smooth">
            {tabItems.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTopicId(tab.id)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm transition-all duration-200 ${
                  activeTopicId === tab.id
                    ? "bg-lime-400 text-[#08090f] font-bold shadow-[0_4px_12px_rgba(163,230,53,0.3)]"
                    : "bg-white/5 text-white/70 border border-white/5 hover:bg-white/10"
                }`}
              >
                {tab.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 主内容区域 */}
      <main className="mx-auto max-w-6xl px-4 pt-[calc(env(safe-area-inset-top)+8.5rem)] space-y-6 w-full box-border min-w-0">
        {/* 精美的手滑横向自动轮播图（集成了数字位置指示器栏） */}
        {activeTopicId === 0 && carouselItems.length > 0 && (
          <section className="relative w-full group">
            {/* 轮播滚动主轴 */}
            <div
              ref={carouselRef}
              onScroll={handleScroll}
              className="w-full overflow-x-auto snap-x snap-mandatory flex gap-4 no-scrollbar pb-2 scroll-smooth"
            >
              {carouselItems.map((item: any, idx: number) => (
                <div
                  key={item.id || idx}
                  className="w-[92vw] sm:w-[80vw] lg:w-full shrink-0 snap-center rounded-2xl border border-white/5 bg-[#0a0c14] relative overflow-hidden aspect-[16/10] sm:aspect-[16/9] md:max-h-[460px] shadow-2xl"
                >
                  <button
                    onClick={() => handleOpen(item)}
                    className="group relative flex h-full w-full flex-col justify-end text-left focus:outline-none"
                  >
                    <img
                      src={getProxyUrl(
                        item.backdrop || item.poster || item.cover,
                      )}
                      alt={item.title || item.name}
                      className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.01]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#08090f] via-[#08090f]/20 to-transparent" />

                    <div className="relative z-10 p-5 sm:p-8 w-full box-border">
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        <span className="rounded bg-lime-400 px-2 py-0.5 text-[10px] font-black text-black uppercase tracking-wider">
                          HOT
                        </span>
                      </div>
                      <h1 className="text-xl font-black leading-tight sm:text-3xl lg:text-4xl tracking-tight line-clamp-1 w-full text-white">
                        {item.title || item.name}
                      </h1>
                      <p className="mt-1 text-xs text-white/50 line-clamp-1">
                        {item.remarks ||
                          item.dynamic ||
                          item.label ||
                          "热播新剧 · 点击观看"}
                      </p>
                      <div className="mt-3 flex items-center gap-1.5">
                        <span className="rounded bg-white/10 backdrop-blur-md px-2 py-0.5 text-[10px] font-semibold text-white/70 border border-white/5">
                          精选
                        </span>
                        <span className="rounded bg-white/10 backdrop-blur-md px-2 py-0.5 text-[10px] font-semibold text-white/70 border border-white/5">
                          最新
                        </span>
                      </div>
                    </div>
                  </button>
                </div>
              ))}
            </div>

            {/* 精致的胶囊式数字进度指示器（告诉你总共几张，当前是第几张） */}
            <div className="absolute top-4 right-4 z-20 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold tracking-wider text-white/90 backdrop-blur-md border border-white/10">
              <span className="text-lime-400">{currentSlide + 1}</span>
              <span className="mx-1 text-white/30">/</span>
              <span className="text-white/60">{carouselItems.length}</span>
            </div>
          </section>
        )}

        {/* 动态区块列表区（已按照指示，去掉了原来的“推荐-刷新”标题整栏栏目） */}
        <section className="w-full min-w-0">
          {activeTopicId === 0 ? (
            <div className="space-y-8">
              {filteredSections.map((section) => (
                <div key={section.title} className="space-y-3">
                  <div className="flex items-baseline justify-between border-b border-white/5 pb-1">
                    <h3 className="text-base font-bold text-white/90">
                      {section.title}
                    </h3>
                    <span className="text-[11px] font-medium text-white/30">
                      {section.data?.length || 0} 部
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                    {(section.data || []).slice(0, 12).map((item: any) => (
                      <button
                        key={item.id}
                        onClick={() => handleOpen(item)}
                        className="group text-left focus:outline-none"
                      >
                        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0c1020] aspect-[2/3] shadow-md">
                          <img
                            src={getProxyUrl(item.poster)}
                            alt={item.title || item.name}
                            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                            loading="lazy"
                          />
                          {(item.remarks || item.dynamic || item.label) && (
                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-2 pb-1.5 pt-4 text-right">
                              <span className="text-[10px] text-lime-300 font-medium line-clamp-1">
                                {item.remarks || item.dynamic || item.label}
                              </span>
                            </div>
                          )}
                        </div>
                        <h4 className="mt-1.5 line-clamp-1 text-xs sm:text-sm font-semibold text-white/80 group-hover:text-lime-400 transition-colors">
                          {item.title || item.name}
                        </h4>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : topicQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-lime-400" />
            </div>
          ) : topicItems.length > 0 ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {topicItems.slice(0, 18).map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleOpen(item)}
                  className="group text-left focus:outline-none"
                >
                  <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0c1020] aspect-[2/3] shadow-md">
                    <img
                      src={getProxyUrl(item.cover)}
                      alt={item.name}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                    {(item.dynamic || item.label) && (
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-2 pb-1.5 pt-4 text-right">
                        <span className="text-[10px] text-lime-300 font-medium line-clamp-1">
                          {item.dynamic || item.label}
                        </span>
                      </div>
                    )}
                  </div>
                  <h3 className="mt-1.5 line-clamp-1 text-xs sm:text-sm font-semibold text-white/80 group-hover:text-lime-400 transition-colors">
                    {item.name}
                  </h3>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-xs sm:text-sm text-white/40 bg-white/[0.01]">
              当前分类暂时没有可展示的内容。
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default Home
