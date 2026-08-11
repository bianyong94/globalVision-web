import React, { FormEvent, useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useLocation, useNavigate } from "react-router-dom"
import toast from "react-hot-toast"
import {
  CircleUserRound,
  History,
  LoaderCircle,
  LogIn,
  LogOut,
  Play,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  UserPlus,
} from "lucide-react"
import { useAuth } from "../contexts/AuthContext"
import {
  clearPlaybackHistory,
  fetchPlaybackHistory,
  getAccountErrorMessage,
  removePlaybackHistory,
} from "../services/accountApi"
import type { PlaybackHistoryItem } from "../types"
import { createImageFallbackHandler, getProxyUrl } from "../utils/common"

type AccountMode = "login" | "register"

const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  }
  return `${m}:${String(s).padStart(2, "0")}`
}

const formatDate = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const diffMin = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 60_000),
  )
  if (diffMin < 1) return "刚刚"
  if (diffMin < 60) return `${diffMin}分钟前`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}小时前`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `${diffDay}天前`
  return `${date.getMonth() + 1}/${date.getDate()}`
}

const normalizePhone = (value: string) => {
  let normalized = value.trim().replace(/[\s-]/g, "")
  if (normalized.startsWith("+86")) normalized = normalized.slice(3)
  else if (normalized.length === 13 && normalized.startsWith("86")) {
    normalized = normalized.slice(2)
  }
  return normalized
}

const Profile = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { user, initialized, busy, login, register, logout } = useAuth()
  const [mode, setMode] = useState<AccountMode>("login")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [formError, setFormError] = useState("")
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [deletingId, setDeletingId] = useState("")

  const historyQuery = useQuery({
    queryKey: ["account-playback-history", user?.id],
    queryFn: fetchPlaybackHistory,
    enabled: !!user,
    staleTime: 0,
  })

  useEffect(() => {
    if (location.pathname === "/profile" && user) {
      void historyQuery.refetch()
    }
  }, [location.pathname, user?.id])

  const historyList = historyQuery.data || []

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedPhone = normalizePhone(phone)
    if (!/^1[3-9][0-9]{9}$/.test(normalizedPhone)) {
      setFormError("请输入正确的中国大陆手机号")
      return
    }
    const passwordLength = new TextEncoder().encode(password).length
    if (passwordLength < 8 || passwordLength > 72) {
      setFormError("密码需要 8 至 72 个字符")
      return
    }

    setFormError("")
    try {
      if (mode === "login") await login(normalizedPhone, password)
      else await register(normalizedPhone, password, displayName)
      setPassword("")
      toast.success(mode === "login" ? "登录成功" : "注册成功")
    } catch (error) {
      setFormError(getAccountErrorMessage(error))
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
      queryClient.removeQueries({ queryKey: ["account-playback-history"] })
      setShowLogoutConfirm(false)
      toast.success("已退出登录")
    } catch {
      setShowLogoutConfirm(false)
      toast.success("已退出登录")
    }
  }

  const handleClear = async () => {
    try {
      await clearPlaybackHistory()
      queryClient.setQueryData(["account-playback-history", user?.id], [])
      setShowClearConfirm(false)
      toast.success("观看历史已清空")
    } catch (error) {
      toast.error(getAccountErrorMessage(error))
    }
  }

  const handleRemove = async (contentId: string) => {
    setDeletingId(contentId)
    try {
      await removePlaybackHistory(contentId)
      queryClient.setQueryData<PlaybackHistoryItem[]>(
        ["account-playback-history", user?.id],
        (items = []) => items.filter((item) => item.contentId !== contentId),
      )
      toast.success("已删除记录")
    } catch (error) {
      toast.error(getAccountErrorMessage(error))
    } finally {
      setDeletingId("")
    }
  }

  const handleOpenHistory = (item: PlaybackHistoryItem) => {
    const params = new URLSearchParams()
    params.set("sourceIndex", String(Math.max(0, item.sourceIndex)))
    params.set("ep", String(Math.max(0, item.episodeIndex)))
    if (item.positionSeconds > 0) {
      params.set("t", String(Math.floor(item.positionSeconds)))
    }
    navigate(`/detail/${item.contentId}?${params.toString()}`)
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(132,204,22,0.08),_transparent_40%),linear-gradient(180deg,#0d1121_0%,#08090f_30%,#08090f_100%)] px-4 pb-28 text-white antialiased">
      <div className="mx-auto max-w-xl pt-[calc(env(safe-area-inset-top)+2rem)]">
        <div className="relative overflow-hidden rounded-[2rem] border border-white/5 bg-white/[0.03] p-6 shadow-2xl backdrop-blur-xl">
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-lime-400/10 blur-3xl" />

          <div className="flex items-center gap-4">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-lime-300 to-lime-500 text-[#08090f] shadow-[0_8px_20px_rgba(163,230,53,0.25)]">
              <CircleUserRound size={32} strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-extrabold tracking-tight">
                {user?.displayName || (user ? `用户${user.phone.slice(-4)}` : "我的")}
              </h1>
              <p className="mt-1 truncate text-xs text-white/40">
                {user
                  ? `${user.phone} · 已与 TV 端同步`
                  : "登录后可与 TV 端同步观看记录"}
              </p>
            </div>
            {user ? (
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                disabled={busy}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
              >
                <LogOut size={14} />
                退出
              </button>
            ) : null}
          </div>

          {!initialized ? (
            <div className="mt-8 flex items-center justify-center py-10 text-white/40">
              <LoaderCircle className="animate-spin" size={22} />
            </div>
          ) : !user ? (
            <form onSubmit={handleSubmit} className="mt-8">
              <div className="grid grid-cols-2 rounded-xl bg-black/25 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode("login")
                    setFormError("")
                  }}
                  className={`rounded-lg py-2 text-xs font-bold transition ${
                    mode === "login"
                      ? "bg-lime-400 text-black"
                      : "text-white/45 hover:text-white/70"
                  }`}
                >
                  登录
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("register")
                    setFormError("")
                  }}
                  className={`rounded-lg py-2 text-xs font-bold transition ${
                    mode === "register"
                      ? "bg-lime-400 text-black"
                      : "text-white/45 hover:text-white/70"
                  }`}
                >
                  注册
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-medium text-white/45">
                    手机号
                  </span>
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="中国大陆手机号"
                    className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-lime-400/50"
                  />
                </label>
                {mode === "register" ? (
                  <label className="block">
                    <span className="mb-1.5 block text-[11px] font-medium text-white/45">
                      昵称（可选）
                    </span>
                    <input
                      type="text"
                      autoComplete="nickname"
                      value={displayName}
                      maxLength={80}
                      onChange={(event) => setDisplayName(event.target.value)}
                      placeholder="未填写时自动生成"
                      className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-lime-400/50"
                    />
                  </label>
                ) : null}
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-medium text-white/45">
                    密码
                  </span>
                  <input
                    type="password"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="8 至 72 个字符"
                    className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-lime-400/50"
                  />
                </label>
              </div>

              {formError ? (
                <p className="mt-3 text-xs text-red-400">{formError}</p>
              ) : null}

              <button
                type="submit"
                disabled={busy}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-lime-400 py-3 text-sm font-extrabold text-black transition hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? (
                  <LoaderCircle className="animate-spin" size={16} />
                ) : mode === "login" ? (
                  <LogIn size={16} />
                ) : (
                  <UserPlus size={16} />
                )}
                {mode === "login" ? "登录并同步" : "创建账号"}
              </button>
            </form>
          ) : null}

          <div className="mt-8 space-y-3">
            <button
              onClick={() => navigate("/search")}
              className="group flex w-full items-center justify-between rounded-xl border border-white/5 bg-white/5 px-4 py-3.5 text-left transition-all duration-200 hover:bg-white/10 active:scale-[0.99]"
            >
              <div>
                <div className="text-sm font-bold transition-colors group-hover:text-lime-400">
                  探索更多影片
                </div>
                <div className="mt-0.5 text-xs text-white/40">
                  快捷查找海量影视、综艺、动漫
                </div>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-lime-400/10 text-lime-400 transition-all group-hover:bg-lime-400 group-hover:text-black">
                <Search size={15} />
              </div>
            </button>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => user && historyQuery.refetch()}
                disabled={!user || historyQuery.isFetching}
                className="flex flex-col justify-between rounded-xl border border-white/10 bg-black/20 p-4 text-left transition hover:border-lime-400/20 hover:bg-black/30 disabled:opacity-60"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-white/70">
                  {historyQuery.isFetching ? (
                    <RefreshCw size={14} className="animate-spin text-lime-400/80" />
                  ) : (
                    <History size={14} className="text-lime-400/80" />
                  )}
                  观看历史
                </div>
                <p className="mt-4 text-[11px] font-medium text-lime-400/70">
                  {!user
                    ? "登录后查看"
                    : historyList.length > 0
                      ? `${historyList.length} 条记录`
                      : "暂无播放记录"}
                </p>
              </button>

              <button
                onClick={() => navigate("/privacy-policy")}
                className="flex flex-col justify-between rounded-xl border border-white/10 bg-black/20 p-4 text-left transition hover:border-lime-400/20 hover:bg-black/30"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-white/70">
                  <Shield size={14} className="text-lime-400/80" />
                  隐私政策
                </div>
                <p className="mt-4 text-[11px] font-medium text-lime-400/70">
                  查看账号与第三方资源说明
                </p>
              </button>
            </div>
          </div>
        </div>

        {user && historyQuery.isError ? (
          <div className="mt-6 rounded-2xl border border-red-400/15 bg-red-400/5 p-5 text-center">
            <p className="text-xs text-red-300/80">观看历史加载失败</p>
            <button
              type="button"
              onClick={() => historyQuery.refetch()}
              className="mt-3 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60"
            >
              重新加载
            </button>
          </div>
        ) : null}

        {user && historyList.length > 0 ? (
          <div className="mt-6 rounded-[2rem] border border-white/5 bg-white/[0.02] p-5 backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-white/90">
                <History size={16} className="text-lime-400" />
                观看历史
              </div>
              <button
                onClick={() => setShowClearConfirm(true)}
                className="flex items-center gap-1.5 rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-1.5 text-[11px] font-medium text-red-400/80 transition hover:bg-red-400/10 hover:text-red-400"
              >
                <Trash2 size={12} />
                清除全部
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {historyList.map((item) => (
                <div
                  key={item.contentId}
                  className="group relative w-full rounded-xl border border-white/5 bg-black/20 p-2.5 transition hover:bg-white/5"
                >
                  <button
                    type="button"
                    onClick={() => handleOpenHistory(item)}
                    className="w-full text-left active:scale-[0.99]"
                  >
                    <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-[#0c1020]">
                      <img
                        src={getProxyUrl(item.posterUrl, { w: 240, q: 70 })}
                        alt={item.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                        onError={createImageFallbackHandler(item.posterUrl)}
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition group-hover:opacity-100">
                        <Play size={16} className="text-white" fill="white" />
                      </div>
                    </div>
                    <div className="mt-2 min-w-0">
                      <h3 className="line-clamp-1 text-xs font-semibold text-white/90 transition-colors group-hover:text-lime-400">
                        {item.title}
                      </h3>
                      <div className="mt-1 line-clamp-1 text-[10px] text-white/40">
                        {item.episodeName || item.subtitle || `第${item.episodeIndex + 1}集`}
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2 text-[10px] text-white/30">
                        <span className="truncate">{formatTime(item.positionSeconds)}</span>
                        <span className="shrink-0">{formatDate(item.updatedAt)}</span>
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    aria-label={`删除 ${item.title} 的观看记录`}
                    disabled={deletingId === item.contentId}
                    onClick={() => handleRemove(item.contentId)}
                    className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white/55 opacity-0 backdrop-blur transition hover:text-red-400 group-hover:opacity-100 disabled:opacity-50"
                  >
                    {deletingId === item.contentId ? (
                      <LoaderCircle size={12} className="animate-spin" />
                    ) : (
                      <Trash2 size={12} />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {showClearConfirm ? (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0d1121] p-6 shadow-2xl">
              <h3 className="text-base font-bold text-white">确认清除</h3>
              <p className="mt-2 text-sm text-white/50">
                将清除账号下全部 {historyList.length} 条观看记录，并同步到 TV 端。此操作不可恢复。
              </p>
              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/10"
                >
                  取消
                </button>
                <button
                  onClick={handleClear}
                  className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white transition hover:bg-red-600"
                >
                  确认清除
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showLogoutConfirm ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-confirm-title"
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm"
          >
            <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0d1121] p-6 shadow-2xl">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-400/10 text-red-400">
                <LogOut size={20} />
              </div>
              <h3 id="logout-confirm-title" className="mt-4 text-base font-bold text-white">
                确认退出登录？
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/50">
                退出后此浏览器将停止同步观看记录，服务端已有历史不会被删除。
              </p>
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                  disabled={busy}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/10 disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={busy}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white transition hover:bg-red-600 disabled:opacity-60"
                >
                  {busy ? <LoaderCircle size={15} className="animate-spin" /> : null}
                  确认退出
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default Profile
