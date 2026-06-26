import React, { useDeferredValue, useEffect, useMemo, useState } from "react"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  ChevronDown,
  X,
  Loader2,
  Search as SearchIcon,
  Sparkles,
  TrendingUp,
  History,
} from "lucide-react"
import SEO from "../components/SEO"
import {
  fetchSearchAutocomplete,
  fetchSearchRanking,
  fetchSearchResults,
} from "../services/api"
import { createImageFallbackHandler, getProxyUrl } from "../utils/common"
import { MovieListItem } from "../types"
import {
  clearSearchHistory,
  getSearchHistory,
  upsertSearchHistory,
} from "../utils/searchHistory"

const PAGE_SIZE = 20
const STORAGE_KEY = "vastren.search.v3"

const getSearchWord = (item: { word?: string; name?: string }) =>
  item.word || item.name || ""

const normalizeSearchValue = (value: unknown) => {
  if (typeof value !== "string") return ""
  return value.trim() ? value : ""
}

const Search = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const loadMoreRef = React.useRef<HTMLDivElement>(null)
  const [recentWords, setRecentWords] = useState(() => getSearchHistory())

  const [activeHotTab, setActiveHotTab] = useState<number>(0)

  const restoredState = useMemo(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  }, [])

  const [keyword, setKeyword] = useState(
    normalizeSearchValue(searchParams.get("q")) ||
      normalizeSearchValue(restoredState.keyword),
  )
  const [submittedKeyword, setSubmittedKeyword] = useState(
    normalizeSearchValue(searchParams.get("q")) ||
      normalizeSearchValue(restoredState.submittedKeyword),
  )
  const deferredKeyword = useDeferredValue(keyword.trim())
  const deferredSubmittedKeyword = useDeferredValue(submittedKeyword.trim())
  const hasKeyword = deferredKeyword.length > 0
  const hasSubmittedKeyword = deferredSubmittedKeyword.length > 0

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

  const listQuery = useInfiniteQuery({
    queryKey: ["search-results", deferredSubmittedKeyword],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const page = Number(pageParam || 1)
      const result = await fetchSearchResults({
        keyword: deferredSubmittedKeyword,
        page,
        pageSize: PAGE_SIZE,
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
    enabled: hasSubmittedKeyword,
    staleTime: 1000 * 60 * 5,
  })

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = listQuery

  useEffect(() => {
    const state = { keyword, submittedKeyword }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))

    const next = new URLSearchParams()
    if (submittedKeyword.trim()) next.set("q", submittedKeyword.trim())
    setSearchParams(next, { replace: true })
  }, [keyword, setSearchParams, submittedKeyword])

  const results = listQuery.data?.pages.flatMap((page) => page.list) || []
  const suggestions = autocompleteQuery.data || []
  const hotGroups = rankingQuery.data || []

  const refreshRecentWords = () => {
    setRecentWords(getSearchHistory())
  }

  const saveSearchHistory = (value: string) => {
    upsertSearchHistory(value)
    refreshRecentWords()
  }

  useEffect(() => {
    if (!hasSubmittedKeyword) return

    const el = loadMoreRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 0.1, rootMargin: "240px" },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [
    fetchNextPage,
    hasSubmittedKeyword,
    hasNextPage,
    isFetchingNextPage,
    results.length,
  ])

  const openDetail = (item: MovieListItem) => {
    saveSearchHistory(deferredSubmittedKeyword || keyword)
    navigate(`/detail/${item.id}`)
  }

  const applyKeyword = (value: string) => {
    const next = value.trim()
    setKeyword(next)
  }

  const clearKeyword = () => {
    setKeyword("")
    setSubmittedKeyword("")
    window.requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[radial-gradient(circle_at_top_left,_rgba(132,204,22,0.15),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.12),_transparent_40%),linear-gradient(180deg,#0a0d1a_0%,#05070a_40%,#05070a_100%)] pb-28 text-white antialiased">
      <SEO title="搜索" description="搜索影片、剧集、演员和热门关键词。" />

      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.04] bg-[#05070a]/75 backdrop-blur-2xl shadow-[0_4px_30px_rgba(0,0,0,0.4)] transition-all duration-300">
        <div className="mx-auto max-w-6xl px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-4 w-full box-border">
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (keyword.trim()) {
                saveSearchHistory(keyword)
                setSubmittedKeyword(keyword.trim())
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
                onChange={(event) =>
                  setKeyword(normalizeSearchValue(event.target.value) || event.target.value)
                }
                placeholder="输入影片、演员、关键词..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-white/40 text-white"
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

      <main className="mx-auto max-w-6xl px-4 pt-[calc(env(safe-area-inset-top)+5.5rem)] w-full box-border min-w-0">
        {!hasKeyword ? (
          <div className="space-y-12 animate-fade-in">
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
                {recentWords.length > 0 ? (
                  <button
                    onClick={() => {
                      clearSearchHistory()
                      refreshRecentWords()
                    }}
                    className="inline-flex items-center gap-1 rounded-full border border-white/5 bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-white/40 hover:border-white/20 hover:bg-white/10 hover:text-white/80 active:scale-95 transition-all"
                  >
                    <X size={12} />
                    清空历史
                  </button>
                ) : null}
              </div>

              {recentWords.length > 0 ? (
                <div className="flex flex-wrap gap-2.5">
                  {recentWords.map((item) => (
                    <button
                      key={item.word}
                      onClick={() => applyKeyword(item.word)}
                      className="rounded-xl border border-white/5 bg-gradient-to-br from-white/[0.04] to-white/[0.01] px-4 py-2 text-xs font-medium text-white/70 shadow-sm backdrop-blur-sm hover:border-lime-400/30 hover:text-lime-300 active:scale-95 transition-all"
                    >
                      {item.word}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/[0.05] bg-white/[0.01] py-8 text-center text-xs text-white/20 tracking-wide">
                  暂无搜索记录
                </div>
              )}
            </section>

            <section className="space-y-6">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-lime-400/10 text-lime-400">
                  <TrendingUp size={14} />
                </div>
                <h2 className="text-lg font-black tracking-tight sm:text-xl bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-transparent">
                  大家都在搜
                </h2>
              </div>

              {/* 动态分类 Tabs：横向滚动 + 隐藏默认滚动条 + 拒绝挤压 */}
              {hotGroups.length > 0 && (
                <div className="flex flex-nowrap gap-2 pb-2 overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  {hotGroups.map((group, index) => (
                    <button
                      key={group.name}
                      onClick={() => setActiveHotTab(index)}
                      className={`relative shrink-0 rounded-full px-5 py-2 text-xs font-bold tracking-wider transition-all duration-300 ${
                        activeHotTab === index
                          ? "bg-lime-400 text-[#05070a] shadow-[0_0_20px_rgba(132,204,22,0.25)]"
                          : "bg-white/[0.03] text-white/50 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {group.name}
                    </button>
                  ))}
                </div>
              )}

              {/* 当前激活的分类列表面板：加上 key 重新触发平滑进入的动画效果 */}
              {hotGroups[activeHotTab] && (
                <div
                  key={activeHotTab}
                  className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 animate-in fade-in slide-in-from-bottom-3 duration-500 ease-out"
                >
                  {hotGroups[activeHotTab].list
                    .slice(0, 10)
                    .map((item, index) => {
                      const word = getSearchWord(item)
                      const isTop3 = index < 3
                      const badgeStyles = [
                        "from-[#FF8A00] to-[#FF3D00] text-white shadow-[0_2px_10px_rgba(255,100,0,0.3)]",
                        "from-[#C0C0C0] to-[#8E8E8E] text-white shadow-[0_2px_10px_rgba(192,192,192,0.2)]",
                        "from-[#D47F31] to-[#A65B1C] text-white shadow-[0_2px_10px_rgba(212,127,49,0.2)]",
                      ]
                      const currentBadge =
                        badgeStyles[index] ||
                        "bg-white/5 text-white/40 border border-white/10"

                      return (
                        <button
                          key={`${hotGroups[activeHotTab].name}-${word}-${index}`}
                          onClick={() => applyKeyword(word)}
                          className="group flex items-center gap-3.5 rounded-2xl border border-white/[0.03] bg-gradient-to-r from-white/[0.03] to-transparent p-3.5 text-left hover:border-lime-400/20 hover:from-lime-400/[0.05] transition-all duration-300 min-w-0"
                        >
                          <div
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-black ${
                              isTop3
                                ? `bg-gradient-to-br ${currentBadge}`
                                : currentBadge
                            }`}
                          >
                            {index + 1}
                          </div>
                          <span className="truncate text-sm font-semibold text-white/70 group-hover:text-lime-300 transition-colors w-full">
                            {word}
                          </span>
                        </button>
                      )
                    })}
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

            {hasSubmittedKeyword && (
              <section className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <h2 className="text-sm font-bold tracking-tight text-white/60 sm:text-base min-w-0 truncate pr-4">
                    搜索结果：
                    <span className="text-lime-300 font-extrabold">
                      「{deferredSubmittedKeyword}」
                    </span>
                  </h2>
                  <button
                    onClick={() => listQuery.refetch()}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10 active:scale-95 transition-all"
                  >
                    <Loader2
                      size={12}
                      className={
                        listQuery.isRefetching
                          ? "animate-spin text-lime-400"
                          : ""
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
                              src={getProxyUrl(item.cover, { w: 320, q: 70 })}
                              alt={item.name}
                              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                              loading="lazy"
                              decoding="async"
                              onError={createImageFallbackHandler(item.cover)}
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

                    <div ref={loadMoreRef} className="py-12 text-center w-full">
                      {hasNextPage ? (
                        <button
                          onClick={() => fetchNextPage()}
                          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-2.5 text-xs font-bold text-white/80 hover:bg-white/10 hover:text-white active:scale-95 transition-all shadow-sm"
                        >
                          {isFetchingNextPage ? (
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
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default Search
