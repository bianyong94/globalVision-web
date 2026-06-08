import React, { useEffect, useMemo, useRef, useState } from "react"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { Loader2, Search } from "lucide-react"
import SEO from "../components/SEO"
import {
  fetchAppConfig,
  fetchHomeData,
  fetchScreenMovies,
} from "../services/api"
import { getProxyUrl } from "../utils/common"
import { AppScreenFilterGroup, MovieListItem } from "../types"

const PAGE_SIZE = 12

const SORT_OPTIONS = [
  { label: "最新", value: "by_time" },
  { label: "最热", value: "by_hits" },
  { label: "评分", value: "by_score" },
] as const

type TopicFilters = {
  sort: string
  class: string
  area: string
  year: string
}

const DEFAULT_FILTERS: TopicFilters = {
  sort: "by_time",
  class: "",
  area: "",
  year: "",
}

const FilterRow = ({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) => (
  <div className="flex items-center gap-2 min-w-0">
    <span className="shrink-0 rounded-md bg-lime-400/15 px-2.5 py-1 text-[11px] font-bold text-lime-300 border border-lime-400/20">
      {label}
    </span>
    <div className="flex flex-1 gap-2 overflow-x-auto no-scrollbar scroll-smooth py-0.5">
      {children}
    </div>
  </div>
)

const FilterChip = ({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`shrink-0 rounded-full px-3 py-1 text-xs transition ${
      active
        ? "bg-lime-400 text-[#08090f] font-bold"
        : "text-white/60 hover:text-white/90"
    }`}
  >
    {children}
  </button>
)

const TopicFilterPanel = ({
  filterGroup,
  filters,
  onChange,
}: {
  filterGroup: AppScreenFilterGroup
  filters: TopicFilters
  onChange: (next: TopicFilters) => void
}) => {
  const classOptions = filterGroup.class.slice(1)
  const areaOptions = filterGroup.area.slice(1)
  const yearOptions = filterGroup.year.slice(1)

  return (
    <section className="space-y-2.5 border-t border-white/5 py-3">
      <FilterRow label="综合">
        {SORT_OPTIONS.map((option) => (
          <FilterChip
            key={option.value}
            active={filters.sort === option.value}
            onClick={() => onChange({ ...filters, sort: option.value })}
          >
            {option.label}
          </FilterChip>
        ))}
      </FilterRow>

      {classOptions.length > 0 && (
        <FilterRow label="类型">
          <FilterChip
            active={!filters.class}
            onClick={() => onChange({ ...filters, class: "" })}
          >
            全部
          </FilterChip>
          {classOptions.map((option) => (
            <FilterChip
              key={option}
              active={filters.class === option}
              onClick={() => onChange({ ...filters, class: option })}
            >
              {option}
            </FilterChip>
          ))}
        </FilterRow>
      )}

      {areaOptions.length > 0 && (
        <FilterRow label="地区">
          <FilterChip
            active={!filters.area}
            onClick={() => onChange({ ...filters, area: "" })}
          >
            全部
          </FilterChip>
          {areaOptions.map((option) => (
            <FilterChip
              key={option}
              active={filters.area === option}
              onClick={() => onChange({ ...filters, area: option })}
            >
              {option}
            </FilterChip>
          ))}
        </FilterRow>
      )}

      {yearOptions.length > 0 && (
        <FilterRow label="年份">
          <FilterChip
            active={!filters.year}
            onClick={() => onChange({ ...filters, year: "" })}
          >
            全部
          </FilterChip>
          {yearOptions.map((option) => (
            <FilterChip
              key={option}
              active={filters.year === option}
              onClick={() => onChange({ ...filters, year: option })}
            >
              {option}
            </FilterChip>
          ))}
        </FilterRow>
      )}
    </section>
  )
}

const MovieGridCard = ({
  item,
  onOpen,
}: {
  item: MovieListItem
  onOpen: (item: MovieListItem) => void
}) => (
  <button
    onClick={() => onOpen(item)}
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
      {item.collect_count != null && item.collect_count > 0 && (
        <span className="absolute top-1.5 right-1.5 rounded bg-amber-400/90 px-1.5 py-0.5 text-[9px] font-bold text-black">
          多人收藏
        </span>
      )}
    </div>
    <h3 className="mt-1.5 line-clamp-1 text-xs sm:text-sm font-semibold text-white/80 group-hover:text-lime-400 transition-colors">
      {item.name}
    </h3>
  </button>
)

const Home = () => {
  const navigate = useNavigate()
  const [activeTopicId, setActiveTopicId] = useState<number>(0)
  const [topicFilters, setTopicFilters] =
    useState<TopicFilters>(DEFAULT_FILTERS)
  const [currentSlide, setCurrentSlide] = useState(0)
  const carouselRef = useRef<HTMLDivElement>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const [headerHeight, setHeaderHeight] = useState(0)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [activeTopicId])

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

  const topTabs = configQuery.data?.index_top_nav || []
  const filterGroups = configQuery.data?.movie_screen?.filter || []

  const tabItems = useMemo(() => {
    const filteredTabs = topTabs.filter(
      (tab) => tab.id !== 0 && tab.name !== "推荐",
    )
    return [{ id: 0, name: "推荐" }, ...filteredTabs]
  }, [topTabs])

  const activeFilterGroup = useMemo(
    () => filterGroups.find((group) => group.id === activeTopicId),
    [filterGroups, activeTopicId],
  )

  const topicListQuery = useInfiniteQuery({
    queryKey: [
      "topic-screen",
      activeTopicId,
      topicFilters.sort,
      topicFilters.class,
      topicFilters.area,
      topicFilters.year,
    ],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const page = Number(pageParam || 1)
      const result = await fetchScreenMovies({
        type_id: activeTopicId,
        sort: topicFilters.sort,
        class: topicFilters.class || undefined,
        area: topicFilters.area || undefined,
        year: topicFilters.year || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      return {
        page,
        list: result.list,
        hasMore: result.list.length >= PAGE_SIZE,
      }
    },
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    enabled: activeTopicId > 0,
    staleTime: 1000 * 60 * 5,
  })

  const banners = homeQuery.data?.banners || []
  const sections = homeQuery.data?.sections || []
  const topicItems =
    topicListQuery.data?.pages.flatMap((page) => page.list) || []

  useEffect(() => {
    setTopicFilters(DEFAULT_FILTERS)
  }, [activeTopicId])

  useEffect(() => {
    const el = headerRef.current
    if (!el) return

    const updateHeight = () => setHeaderHeight(el.offsetHeight)
    updateHeight()

    const observer = new ResizeObserver(updateHeight)
    observer.observe(el)
    return () => observer.disconnect()
  }, [activeTopicId, activeFilterGroup, topicFilters, tabItems.length])

  const handleOpen = (
    item: MovieListItem | { id: string; source_ref?: string } | any,
  ) => {
    const id = item?.id
    if (id) navigate(`/detail/${id}`)
  }

  const filteredSections = useMemo(() => {
    if (sections.length <= 1) return sections
    return sections.slice(1)
  }, [sections])

  const carouselItems = useMemo(() => {
    if (sections.length > 0 && sections[0]?.data) {
      return sections[0].data
    }
    return banners
  }, [sections, banners])

  useEffect(() => {
    if (activeTopicId !== 0 || carouselItems.length <= 1) return

    const timer = setInterval(() => {
      setCurrentSlide((prev) => {
        const nextIndex = prev >= carouselItems.length - 1 ? 0 : prev + 1

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
    }, 4000)

    return () => clearInterval(timer)
  }, [carouselItems, activeTopicId])

  const handleScroll = () => {
    if (!carouselRef.current || carouselItems.length === 0) return
    const { scrollLeft, clientWidth } = carouselRef.current
    const index = Math.round(scrollLeft / clientWidth)
    if (index >= 0 && index < carouselItems.length) {
      setCurrentSlide(index)
    }
  }

  const {
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetching: isTopicFetching,
  } = topicListQuery

  useEffect(() => {
    if (activeTopicId === 0) return

    const el = loadMoreRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 0.1, rootMargin: "200px" },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [
    activeTopicId,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    topicItems.length,
    topicFilters,
  ])

  const showInitialLoading = homeQuery.isLoading && !homeQuery.data
  const showHomeError = homeQuery.isError && !homeQuery.data

  return (
    <div className="min-h-screen w-full overflow-x-hidden no-scrollbar bg-[radial-gradient(circle_at_top,_rgba(132,204,22,0.05),_transparent_40%),linear-gradient(180deg,#0d1121_0%,#08090f_30%,#08090f_100%)] pb-28 text-white antialiased">
      <SEO
        title="首页"
        description="基于接口文档重构的影视首页，提供推荐、分类和精选内容入口。"
      />

      <div
        ref={headerRef}
        className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#08090f]/90 backdrop-blur-xl shadow-lg shadow-black/20"
      >
        <div className="mx-auto max-w-6xl px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
          <div
            onClick={() => navigate("/search")}
            className="flex h-11 items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white/40 transition active:scale-[0.98] hover:border-lime-400/30 hover:bg-white/10 cursor-pointer"
          >
            <Search size={15} className="text-white/40" />
            <span>搜索影片、剧集、演员</span>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-3 no-scrollbar scroll-smooth">
            {(tabItems.length > 0 ? tabItems : [{ id: 0, name: "推荐" }]).map((tab) => (
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

          {activeTopicId > 0 && activeFilterGroup && (
            <TopicFilterPanel
              filterGroup={activeFilterGroup}
              filters={topicFilters}
              onChange={setTopicFilters}
            />
          )}
        </div>
      </div>

      <main
        className="mx-auto max-w-6xl px-4 space-y-6 w-full box-border min-w-0"
        style={{
          paddingTop:
            headerHeight > 0
              ? headerHeight + 12
              : "calc(env(safe-area-inset-top) + 8.5rem)",
        }}
      >
        {showInitialLoading && (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-lime-400" />
            <p className="text-sm text-white/40 tracking-wide">
              正在加载精彩内容...
            </p>
          </div>
        )}

        {showHomeError && (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 text-center">
            <p className="text-sm text-white/50">
              首页数据加载失败，请检查网络后重试
            </p>
            <button
              type="button"
              onClick={() => homeQuery.refetch()}
              className="rounded-full bg-lime-400 px-5 py-2 text-xs font-bold text-[#08090f]"
            >
              重新加载
            </button>
          </div>
        )}

        {!showInitialLoading && !showHomeError && activeTopicId === 0 && carouselItems.length > 0 && (
          <section className="relative w-full group">
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

            <div className="absolute top-4 right-4 z-20 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold tracking-wider text-white/90 backdrop-blur-md border border-white/10">
              <span className="text-lime-400">{currentSlide + 1}</span>
              <span className="mx-1 text-white/30">/</span>
              <span className="text-white/60">{carouselItems.length}</span>
            </div>
          </section>
        )}

        {!showInitialLoading && !showHomeError && (
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
          ) : isTopicFetching && topicItems.length === 0 ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {[...Array(12)].map((_, index) => (
                <div
                  key={index}
                  className="rounded-xl bg-white/5 aspect-[2/3] animate-pulse"
                />
              ))}
            </div>
          ) : topicItems.length > 0 ? (
            <>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                {topicItems.map((item) => (
                  <MovieGridCard
                    key={item.id}
                    item={item}
                    onOpen={handleOpen}
                  />
                ))}
              </div>

              <div
                ref={loadMoreRef}
                className="py-8 flex justify-center w-full"
              >
                {isFetchingNextPage && (
                  <div className="flex items-center gap-2 text-lime-400 text-xs">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    加载更多...
                  </div>
                )}
                {!hasNextPage && topicItems.length > 0 && (
                  <p className="text-xs text-white/30">已经到底了</p>
                )}
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-xs sm:text-sm text-white/40 bg-white/[0.01]">
              当前分类暂时没有可展示的内容。
            </div>
          )}
        </section>
        )}
      </main>
    </div>
  )
}

export default Home
