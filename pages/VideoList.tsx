import React, { useRef, useEffect } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"
import { fetchVideos } from "../services/api"
import VideoCard from "../components/VideoCard"
import { Loader2, Film } from "lucide-react"

interface VideoListProps {
  cat: string
  tag: string
  keyword: string
  year: string
  sort: string
  isActive: boolean
}

const VideoList: React.FC<VideoListProps> = ({
  cat,
  tag,
  keyword,
  year,
  sort,
  isActive,
}) => {
  // 1. 数据请求 (参数通过 props 传入)
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isError,
    refetch,
  } = useInfiniteQuery({
    // 关键：QueryKey 包含 cat，确保每个 Tab 数据独立缓存
    queryKey: ["search_v2", cat, tag, keyword, year, sort],
    queryFn: async ({ pageParam = 1, signal }) => {
      const params: any = {
        pg: pageParam,
        year: year === "全部" ? undefined : year,
        sort: sort,
      }
      if (keyword) params.wd = keyword
      if (cat && cat !== "all") params.cat = cat
      if (tag) params.tag = tag

      const res = await fetchVideos(params, signal)
      return {
        list: res.list || [],
        hasMore: (res.list?.length || 0) > 0,
        page: Number(pageParam),
      }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    // 只有当这个 Tab 处于激活状态，或者已经加载过数据时，才允许后台更新
    // 这里的 enabled 可以根据需求调整，设为 true 表示一直在后台保持更新
    enabled: true,
    staleTime: 1000 * 60 * 5, // 5分钟缓存
  })

  const videos = data?.pages.flatMap((page) => page.list) || []
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // 2. 滚动加载监听 (仅在激活状态下生效)
  useEffect(() => {
    if (!isActive) return // 如果当前 Tab 不可见，不监听滚动

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
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, isActive])

  // 3. 这里的渲染逻辑与之前相同，但去掉了外层的 Grid 容器，只负责内容
  return (
    <div className="px-4 mt-3 min-h-[50vh] relative">
      {/* Loading 骨架屏 - 仅在首次加载且无数据时显示 */}
      {isFetching && videos.length === 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="bg-[#1a1a1a] rounded-lg animate-pulse aspect-[2/3]"
            />
          ))}
        </div>
      )}

      {/* 视频列表 */}
      {videos.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {videos.map((v) => (
            // 修复 Key：不要用 index，使用唯一 ID
            <VideoCard key={v.id || v._id} video={v} />
          ))}
        </div>
      )}

      {/* 空状态 */}
      {!isFetching && videos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-600 space-y-4">
          <div className="w-20 h-20 bg-[#1a1a1a] rounded-full flex items-center justify-center border border-white/5">
            <Film size={32} className="opacity-20" />
          </div>
          <p className="text-sm font-bold text-gray-400">未找到相关资源</p>
        </div>
      )}

      {/* 底部加载更多 */}
      <div ref={loadMoreRef} className="py-8 flex justify-center w-full">
        {isFetchingNextPage && (
          <div className="flex items-center gap-2 text-emerald-500 text-xs">
            <Loader2 className="animate-spin" size={14} /> 加载中...
          </div>
        )}
      </div>

      {isError && (
        <div className="text-center py-10">
          <button onClick={() => refetch()} className="text-xs text-red-400">
            重试
          </button>
        </div>
      )}
    </div>
  )
}

export default VideoList
