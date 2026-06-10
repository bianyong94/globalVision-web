import React, { useDeferredValue, useEffect, useMemo, useState } from "react"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  ChevronDown,
  X,
  Loader2,
  RefreshCw,
  Search as SearchIcon,
  Sparkles,
  TrendingUp,
  History,
} from "lucide-react"
import SEO from "../components/SEO"
import {
  fetchSearchAutocomplete,
  fetchSearchLatelyWords,
  fetchSearchRanking,
  fetchSearchResults,
} from "../services/api"
import { getProxyUrl } from "../utils/common"
import { MovieListItem } from "../types"

const PAGE_SIZE = 12
const STORAGE_KEY = "globalVision.search.v3"

const getSearchWord = (item: { word?: string; name?: string }) =>
  item.word || item.name || ""

const Search = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const inputRef = React.useRef<HTMLInputElement>(null)

  const restoredState = useMemo(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  }, [])

  const [keyword, setKeyword] = useState(
    searchParams.get("q") || restoredState.keyword || "",
  )
  const deferredKeyword = useDeferredValue(keyword.trim())
  const hasKeyword = deferredKeyword.length > 0

  const autocompleteQuery = useQuery({
    queryKey: ["search-autocomplete", deferredKeyword],
    queryFn: () => fetchSearchAutocomplete(deferredKeyword),
    enabled: hasKeyword,
    staleTime: 1000 * 30,
  })

  const rankingQuery = useQuery({
    queryKey: ["search-ranking"],
    queryFn: fetchSearchRanking,
    enabled: !hasKeyword,
    staleTime: 1000 * 60 * 10,
  })

  const latelyQuery = useQuery({
    queryKey: ["search-lately"],
    queryFn: fetchSearchLatelyWords,
    enabled: !hasKeyword,
    staleTime: 1000 * 60 * 10,
  })

  const listQuery = useInfiniteQuery({
    queryKey: ["search-results", deferredKeyword],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const page = Number(pageParam || 1)
      const result = await fetchSearchResults({
        keyword: deferredKeyword,
        page,
        res_type: "by_movie_name",
      })
      return {
        page,
        list: result.list,
        hasMore: result.list.length >= PAGE_SIZE,
      }
    },
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    enabled: hasKeyword,
    staleTime: 1000 * 60 * 5,
  })

  useEffect(() => {
    const state = { keyword }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))

    const next = new URLSearchParams()
    if (keyword.trim()) next.set("q", keyword.trim())
    setSearchParams(next, { replace: true })
  }, [keyword, setSearchParams])

  const results = listQuery.data?.pages.flatMap((page) => page.list) || []
  const suggestions = autocompleteQuery.data || []
  const hotWords = rankingQuery.data || []
  const recentWords = latelyQuery.data || []

  const openDetail = (item: MovieListItem) => {
    navigate(`/detail/${item.id}`)
  }

  const applyKeyword = (value: string) => {
    setKeyword(value)
  }

  const clearKeyword = () => {
    setKeyword("")
    window.requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[radial-gradient(circle_at_top_left,_rgba(132,204,22,0.15),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.12),_transparent_40%),linear-gradient(180deg,#0a0d1a_0%,#05070a_40%,#05070a_100%)] pb-28 text-white antialiased">
      <SEO title="搜索" description="搜索影片、剧集、演员和热门关键词。" />

      {/* 强固顶霓虹发光顶栏 - 升级为 fixed 绝对挂载，确保 100% 固顶成功 */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.04] bg-[#05070a]/75 backdrop-blur-2xl shadow-[0_4px_30px_rgba(0,0,0,0.4)] transition-all duration-300">
        <div className="mx-auto max-w-6xl px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-4 w-full box-border">
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (keyword.trim()) {
                listQuery.refetch()
              }
            }}
          >
            <div className="flex h-12 items-center gap-3 rounded-full border border-white/10 bg-white/[0.03] px-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] focus-within:border-lime-400/40 focus-within:bg-white/[0.07] focus-within:shadow-[0_0_20px_rgba(132,204,22,0.08)] transition-all duration-300">
              <SearchIcon
                size={16}
                className="text-white/40 transition-colors duration-300"
              />
              <input
                ref={inputRef}
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="键入影片、演员、关键词..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-white/20 text-white"
              />
              {keyword.trim() ? (
                <button
                  type="button"
                  onClick={clearKeyword}
                  aria-label="清除搜索词"
                  className="inline-flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 p-1.5 text-white/45 transition hover:border-white/20 hover:bg-white/10 hover:text-white active:scale-95"
                >
                  <X size={14} />
                </button>
              ) : null}
              {keyword.trim() ? (
                <button
                  type="submit"
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-lime-400/30 bg-gradient-to-r from-lime-400/20 to-emerald-400/20 px-4 py-1.5 text-xs font-bold text-lime-300 shadow-md backdrop-blur-sm active:scale-95 transition-all"
                >
                  搜索
                </button>
              ) : null}
            </div>
          </form>
        </div>
      </header>

      {/* 主体区增加了 pt-24 (在移动端安全区域基础上)，防止顶部的 fixed 搜索栏遮挡正文内容 */}
      <main className="mx-auto max-w-6xl px-4 pt-[calc(env(safe-area-inset-top)+5.5rem)] w-full box-border min-w-0">
        {!hasKeyword ? (
          <div className="space-y-10 animate-fade-in">
            {/* 大家都在搜 */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-lime-400/10 text-lime-400">
                    <TrendingUp size={14} />
                  </div>
                  <h2 className="text-lg font-black tracking-tight sm:text-xl bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-transparent">
                    大家都在搜
                  </h2>
                </div>
                <button
                  onClick={() => {
                    rankingQuery.refetch()
                    latelyQuery.refetch()
                  }}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/5 bg-white/[0.03] text-white/60 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
                >
                  <RefreshCw
                    size={13}
                    className={
                      rankingQuery.isRefetching || latelyQuery.isRefetching
                        ? "animate-spin text-lime-400"
                        : ""
                    }
                  />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
                {hotWords.slice(0, 8).map((item, index) => {
                  const word = getSearchWord(item)
                  const badgeColors = [
                    "from-amber-400 to-orange-500 text-black font-black",
                    "from-slate-300 to-slate-400 text-black font-black",
                    "from-amber-600 to-amber-700 text-white font-bold",
                  ]
                  const currentBadge =
                    badgeColors[index] ||
                    "bg-white/10 text-white/50 text-xs font-medium"

                  return (
                    <button
                      key={`${word}-${index}`}
                      onClick={() => applyKeyword(word)}
                      className="group flex items-center gap-3 rounded-xl border border-white/[0.03] bg-gradient-to-b from-white/[0.02] to-transparent p-3 text-left hover:border-lime-400/20 hover:from-lime-400/[0.02] hover:to-lime-400/[0.01] transition-all duration-300 min-w-0 shadow-sm"
                    >
                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] ${index < 3 ? `bg-gradient-to-br ${currentBadge}` : currentBadge}`}
                      >
                        {index + 1}
                      </div>
                      <span className="truncate text-xs sm:text-sm font-semibold text-white/70 group-hover:text-lime-300 transition-colors w-full">
                        {word}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* 最近搜索 */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-400/10 text-blue-400">
                    <History size={14} />
                  </div>
                  <h2 className="text-base font-extrabold tracking-tight sm:text-lg text-white/80">
                    最近搜索
                  </h2>
                </div>
                <button
                  onClick={() => latelyQuery.refetch()}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/5 bg-white/[0.03] text-white/60 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
                >
                  <RefreshCw
                    size={13}
                    className={
                      latelyQuery.isRefetching
                        ? "animate-spin text-blue-400"
                        : ""
                    }
                  />
                </button>
              </div>

              {recentWords.length > 0 ? (
                <div className="flex flex-wrap gap-2.5">
                  {recentWords.slice(0, 8).map((item, index) => {
                    const word = getSearchWord(item)
                    return (
                      <button
                        key={`${word}-${index}`}
                        onClick={() => applyKeyword(word)}
                        className="rounded-full border border-white/5 bg-white/[0.02] px-4 py-2 text-xs font-medium text-white/60 hover:border-blue-400/20 hover:bg-blue-400/[0.04] hover:text-blue-300 transition-all"
                      >
                        {word}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="text-[11px] text-white/20 tracking-wide">
                  暂无搜索历史记录
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 智能检索发现栏 */}
            {suggestions.length > 0 && (
              <section className="rounded-2xl border border-white/[0.04] bg-gradient-to-r from-lime-400/[0.02] via-emerald-400/[0.01] to-transparent p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] backdrop-blur-md">
                <div className="mb-3 flex items-center gap-1.5 text-xs font-bold text-lime-400/70 uppercase tracking-wider">
                  <Sparkles size={12} className="text-lime-400" />
                  <span>搜索智能联想发现</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {suggestions.slice(0, 10).map((item) => {
                    const word = getSearchWord(item)
                    return (
                      <button
                        key={word}
                        onClick={() => applyKeyword(word)}
                        className="rounded-xl border border-white/5 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 hover:border-lime-400/20 hover:bg-lime-400/10 hover:text-white transition-all"
                      >
                        {word}
                      </button>
                    )
                  })}
                </div>
              </section>
            )}

            {/* 结果数据板块容器 */}
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <h2 className="text-sm font-bold tracking-tight text-white/60 sm:text-base min-w-0 truncate pr-4">
                  搜索结果：
                  <span className="text-lime-300 font-extrabold">
                    「{deferredKeyword}」
                  </span>
                </h2>
                <button
                  onClick={() => listQuery.refetch()}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10 active:scale-95 transition-all"
                >
                  <Loader2
                    size={12}
                    className={
                      listQuery.isRefetching ? "animate-spin text-lime-400" : ""
                    }
                  />
                  <span>刷新</span>
                </button>
              </div>

              {listQuery.isLoading && results.length === 0 ? (
                <div className="flex items-center justify-center py-28">
                  <Loader2 className="h-7 w-7 animate-spin text-lime-400" />
                </div>
              ) : results.length > 0 ? (
                <>
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 w-full">
                    {results.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => openDetail(item)}
                        className="group text-left focus:outline-none w-full min-w-0"
                      >
                        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0c1020] aspect-[2/3] shadow-md w-full">
                          <img
                            src={getProxyUrl(item.cover)}
                            alt={item.name}
                            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                            loading="lazy"
                          />
                          {(item.dynamic || item.label) && (
                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-2 pb-2 pt-5 text-right">
                              <span className="text-[10px] text-lime-300 font-semibold line-clamp-1">
                                {item.dynamic || item.label}
                              </span>
                            </div>
                          )}
                        </div>
                        <h3 className="mt-2 line-clamp-1 text-xs sm:text-sm font-semibold text-white/70 group-hover:text-lime-400 transition-colors w-full">
                          {item.name}
                        </h3>
                      </button>
                    ))}
                  </div>

                  <div className="py-12 text-center w-full">
                    {listQuery.hasNextPage ? (
                      <button
                        onClick={() => listQuery.fetchNextPage()}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-2.5 text-xs font-bold text-white/80 hover:bg-white/10 hover:text-white active:scale-95 transition-all shadow-sm"
                      >
                        {listQuery.isFetchingNextPage ? (
                          <Loader2
                            size={13}
                            className="animate-spin text-lime-400"
                          />
                        ) : (
                          <ChevronDown size={13} className="text-white/50" />
                        )}
                        滑动或点击加载更多
                      </button>
                    ) : (
                      <div className="text-[10px] text-white/20 tracking-widest uppercase font-bold">
                        • END OF RESULTS •
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.01] px-6 py-20 text-center text-xs sm:text-sm text-white/40 max-w-xl mx-auto">
                  未搜寻到匹配资源，建议更替搜索条件或缩短关键词。
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  )
}

export default Search
