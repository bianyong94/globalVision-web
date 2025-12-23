import React, { useEffect, useState } from "react"
import { useAuth } from "../context/AuthContext"
import { login, register, fetchHistory } from "../services/api"
import { HistoryItem } from "../types"
import { useNavigate, Link } from "react-router-dom" // 引入 Link
import {
  LogOut,
  History,
  PlayCircle,
  ShieldCheck,
  FileText,
  ChevronRight,
  Sparkles,
  User as UserIcon,
} from "lucide-react"

const Profile = () => {
  const { user, loginUser, logoutUser, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  // Auth Form State
  const [isLoginMode, setIsLoginMode] = useState(true)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  // Data State
  const [history, setHistory] = useState<HistoryItem[]>([])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      let userData
      if (isLoginMode) {
        userData = await login(username, password)
      } else {
        userData = await register(username, password)
      }
      loginUser(userData)
    } catch (err: any) {
      console.log("报错", err)
      setError(err.message || "操作失败")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchHistory(user.username).then(setHistory).catch(console.error)
    }
  }, [isAuthenticated, user])

  // 跳转到详情页
  const goToDetail = (video: HistoryItem) => {
    // 假设 video.id 已经是 sourceKey$vodId 格式，如果不是，可能需要处理
    navigate(`/detail/${video.id}`)
  }

  // --- 未登录状态视图 ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* 背景装饰光 */}
        <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-primary/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-64 h-64 bg-blue-600/20 rounded-full blur-[100px]" />

        <div className="w-full max-w-sm relative z-10">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-black bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent mb-2">
              StreamHub
            </h1>
            <p className="text-gray-400 text-sm">海量高清影视聚合引擎</p>
          </div>

          <div className="bg-white/5 backdrop-blur-xl p-8 rounded-2xl border border-white/10 shadow-2xl">
            <div className="flex justify-center mb-6">
              <div className="bg-white/10 p-3 rounded-full">
                <UserIcon className="text-white w-6 h-6" />
              </div>
            </div>

            <h2 className="text-xl text-white font-bold mb-6 text-center">
              {isLoginMode ? "欢迎回来" : "创建新账号"}
            </h2>

            <form onSubmit={handleAuth} className="space-y-4">
              <div className="space-y-1">
                <input
                  type="text"
                  placeholder="用户名"
                  required
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 focus:border-primary/50 focus:bg-black/80 transition-all outline-none text-sm"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <input
                  type="password"
                  placeholder="密码"
                  required
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 focus:border-primary/50 focus:bg-black/80 transition-all outline-none text-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg text-center animate-pulse">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-primary to-red-700 hover:from-red-600 hover:to-red-800 text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {loading ? "处理中..." : isLoginMode ? "立即登录" : "立即注册"}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => setIsLoginMode(!isLoginMode)}
                className="text-gray-400 text-xs hover:text-white transition-colors"
              >
                {isLoginMode ? "还没有账号？ 点击注册" : "已有账号？ 点击登录"}
              </button>
            </div>
          </div>

          {/* 底部法律链接 (未登录也显示) */}
          <div className="mt-8 flex justify-center gap-6 text-xs text-gray-600">
            <Link to="/disclaimer" className="hover:text-gray-400">
              免责声明
            </Link>
            <span>|</span>
            <Link to="/privacy" className="hover:text-gray-400">
              隐私政策
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // --- 登录后状态视图 ---
  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-24 text-gray-100">
      {/* 头部用户信息卡片 */}
      <div className="relative pt-12 pb-8 px-6 bg-gradient-to-b from-gray-900 to-[#0a0a0a] border-b border-white/5">
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white text-3xl font-bold shadow-2xl shadow-primary/20 border-4 border-[#0a0a0a]">
              {user?.username.charAt(0).toUpperCase()}
            </div>
            <div className="absolute bottom-0 right-0 w-6 h-6 bg-green-500 border-4 border-[#0a0a0a] rounded-full"></div>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl text-white font-bold truncate mb-1">
              {user?.username}
            </h2>
            <div className="flex items-center gap-2 text-xs text-gray-400 bg-white/5 w-fit px-2 py-1 rounded-md">
              <Sparkles size={12} className="text-yellow-500" />
              <span>ID: {user?.id.slice(-6).toUpperCase()}</span>
            </div>
          </div>
          <button
            onClick={logoutUser}
            className="p-3 bg-white/5 rounded-full hover:bg-white/10 transition-colors border border-white/5 group"
            aria-label="Logout"
          >
            <LogOut
              size={20}
              className="text-gray-400 group-hover:text-red-400 transition-colors"
            />
          </button>
        </div>
      </div>

      <div className="px-4 -mt-4 space-y-6">
        {/* 观看历史模块 */}
        <div className="bg-[#121212] rounded-2xl border border-white/5 overflow-hidden shadow-lg">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <History className="text-primary" size={18} />
              <h3 className="font-bold">观看历史</h3>
            </div>
            {history.length > 0 && (
              <span className="text-xs text-gray-500">
                {history.length} 条记录
              </span>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {history.length > 0 ? (
              <div className="divide-y divide-white/5">
                {history.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => goToDetail(item)}
                    className="flex gap-3 p-3 items-center hover:bg-white/5 transition-colors cursor-pointer group active:bg-white/10"
                  >
                    <div className="relative w-12 h-16 flex-shrink-0">
                      <img
                        src={item.poster}
                        className="w-full h-full object-cover rounded bg-gray-800"
                        alt={item.title}
                        loading="lazy"
                      />
                      {/* 播放悬浮层 */}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded">
                        <PlayCircle size={20} className="text-white" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm text-gray-200 font-medium truncate group-hover:text-primary transition-colors">
                        {item.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-gray-500 border border-white/10 px-1 rounded">
                          {item.type}
                        </span>
                        <p className="text-[10px] text-gray-500 truncate">
                          {item.viewedAt
                            ? new Date(item.viewedAt).toLocaleDateString()
                            : "刚刚"}
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-gray-700" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-600 flex flex-col items-center">
                <History size={32} className="mb-2 opacity-20" />
                <p className="text-sm">暂无观看记录</p>
                <button
                  onClick={() => navigate("/")}
                  className="mt-4 text-xs text-primary border border-primary/30 px-4 py-1.5 rounded-full hover:bg-primary/10"
                >
                  去首页看看
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 关于与法律模块 */}
        <div className="bg-[#121212] rounded-2xl border border-white/5 overflow-hidden shadow-lg">
          <div className="p-4 border-b border-white/5 text-sm font-bold text-gray-300">
            更多服务
          </div>
          <div className="divide-y divide-white/5">
            <Link
              to="/disclaimer"
              className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <ShieldCheck size={18} className="text-green-500" />
                <span className="text-sm text-gray-300">免责声明</span>
              </div>
              <ChevronRight size={16} className="text-gray-700" />
            </Link>
            <Link
              to="/privacy"
              className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileText size={18} className="text-blue-500" />
                <span className="text-sm text-gray-300">隐私政策</span>
              </div>
              <ChevronRight size={16} className="text-gray-700" />
            </Link>
          </div>
        </div>

        {/* 底部版本号 */}
        <div className="text-center text-[10px] text-gray-600 pb-4">
          <p>StreamHub v1.0.2 Beta</p>
          <p className="mt-1">Designed for Learning Purposes</p>
        </div>
      </div>
    </div>
  )
}

export default Profile
