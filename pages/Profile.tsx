import React from "react"
import { useNavigate } from "react-router-dom"
import {
  CircleUserRound,
  Search,
  Sparkles,
  History,
  Bookmark,
} from "lucide-react"

const Profile = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(132,204,22,0.08),_transparent_40%),linear-gradient(180deg,#0d1121_0%,#08090f_30%,#08090f_100%)] px-4 pb-28 text-white antialiased">
      <div className="mx-auto max-w-xl pt-[calc(env(safe-area-inset-top)+2rem)]">
        {/* 用户主卡片 */}
        <div className="relative overflow-hidden rounded-[2rem] border border-white/5 bg-white/[0.03] p-6 shadow-2xl backdrop-blur-xl">
          {/* 背景装饰微光 */}
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-lime-400/10 blur-3xl pointer-events-none" />

          <div className="flex items-center gap-4">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-lime-300 to-lime-500 text-[#08090f] shadow-[0_8px_20px_rgba(163,230,53,0.25)]">
              <CircleUserRound size={32} strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight">
                  个人中心
                </h1>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/60 border border-white/5">
                  游客模式
                </span>
              </div>
              <p className="mt-1 text-xs text-white/40 truncate">
                登录后即可同步多端观看记录与收藏
              </p>
            </div>
          </div>

          {/* 核心操作区 */}
          <div className="mt-8 space-y-3">
            <button
              onClick={() => navigate("/search")}
              className="flex w-full items-center justify-between rounded-xl border border-white/5 bg-white/5 px-4 py-3.5 text-left transition-all duration-200 active:scale-[0.99] hover:bg-white/10 group"
            >
              <div>
                <div className="text-sm font-bold group-hover:text-lime-400 transition-colors">
                  探索更多影片
                </div>
                <div className="mt-0.5 text-xs text-white/40">
                  快捷查找海量影视、综艺、动漫
                </div>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-lime-400/10 text-lime-400 group-hover:bg-lime-400 group-hover:text-black transition-all">
                <Search size={15} />
              </div>
            </button>

            {/* 预留功能占位 - 视觉美化 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col justify-between rounded-xl border border-dashed border-white/10 bg-black/20 p-4 opacity-60">
                <div className="flex items-center gap-2 text-xs font-semibold text-white/70">
                  <Bookmark size={14} className="text-lime-400/80" />
                  我的收藏
                </div>
                <p className="mt-4 text-[11px] text-white/30">暂无收藏内容</p>
              </div>

              <div className="flex flex-col justify-between rounded-xl border border-dashed border-white/10 bg-black/20 p-4 opacity-60">
                <div className="flex items-center gap-2 text-xs font-semibold text-white/70">
                  <History size={14} className="text-lime-400/80" />
                  观看历史
                </div>
                <p className="mt-4 text-[11px] text-white/30">暂无播放记录</p>
              </div>
            </div>
          </div>

          {/* 底部功能前瞻提示 */}
          <div className="mt-6 flex items-start gap-2.5 rounded-xl bg-lime-400/[0.02] border border-lime-400/10 p-3.5">
            <Sparkles
              size={14}
              className="text-lime-400 shrink-0 mt-0.5 animate-pulse"
            />
            <div className="text-[11px] leading-relaxed text-white/50">
              <span className="text-lime-400/90 font-medium">功能预告：</span>
              个性化追剧模块正在紧锣密鼓地筹备中。未来将接入多线路收藏夹、播放历史同步及个性化影视推荐，敬请期待。
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Profile
