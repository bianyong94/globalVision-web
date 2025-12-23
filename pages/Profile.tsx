import React, { useEffect, useState } from "react"
import { useAuth } from "../context/AuthContext"
import { askAI, login, register, fetchHistory } from "../services/api"
import { useNavigate, Link } from "react-router-dom"
import {
  LogOut,
  History,
  ShieldCheck,
  FileText,
  ChevronRight,
  User as UserIcon,
  Bot,
  Send,
  Loader2,
  Search as SearchIcon,
  Play
} from "lucide-react"

const Profile = () => {
  const { user, loginUser, logoutUser, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  // 登录相关 State
  const [isLoginMode, setIsLoginMode] = useState(true)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [authError, setAuthError] = useState("")
  const [authLoading, setAuthLoading] = useState(false)

  // 数据相关 State
  const [history, setHistory] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  
  // AI 相关 State
  const [aiPrompt, setAiPrompt] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResults, setAiResults] = useState<string[]>([])

  // --- 登录/注册逻辑 ---
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError("")
    setAuthLoading(true)
    try {
      let userData
      if (isLoginMode) {
        userData = await login(username, password)
      } else {
        userData = await register(username, password)
      }
      if (userData) loginUser(userData)
    } catch (err: any) {
      setAuthError(err.message || "操作失败")
    } finally {
      setAuthLoading(false)
    }
  }

  // --- 获取历史记录 ---
  useEffect(() => {
    if (isAuthenticated && user) {
      setHistoryLoading(true)
      fetchHistory(user.username)
        .then((data) => {
          setHistory(Array.isArray(data) ? data : [])
        })
        .catch(console.error)
        .finally(() => setHistoryLoading(false))
    }
  }, [isAuthenticated, user])

  // --- AI 提问逻辑 ---
  const handleAskAI = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!aiPrompt.trim()) return
    setAiLoading(true)
    setAiResults([])
    try {
      const results = await askAI(aiPrompt)
      setAiResults(results)
    } catch (error) {
      setAiResults(["服务繁忙，请重试"])
    } finally {
      setAiLoading(false)
    }
  }

  const handleAiResultClick = (keyword: string) => navigate(`/search?q=${encodeURIComponent(keyword)}`)
  const goToDetail = (video: any) => navigate(`/detail/${video.id}`)

  // 🟢 [新增] 格式化时间函数
  const formatProgress = (seconds: number) => {
    if (!seconds || seconds < 0) return "刚刚"
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    if (m === 0) return `${s}秒`
    return `${m}分${s}秒`
  }

  // 🟢 [新增] 格式化集数函数
  const formatEpisode = (index: number) => {
    if (index === undefined || index === null) return "观看至"
    return `第${index + 1}集`
  }

  // --- 1. 未登录视图 ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-96 h-96 bg-emerald-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-96 h-96 bg-blue-600/20 rounded-full blur-[120px]" />

        <div className="w-full max-w-sm relative z-10">
          <div className="text-center mb-10">
            <h1 className="text-5xl font-black bg-gradient-to-r from-emerald-400 to-cyan-500 bg-clip-text text-transparent mb-2 tracking-tighter">GV</h1>
            <p className="text-gray-400 text-sm">Global Vision</p>
          </div>

          <div className="bg-[#121212] border border-white/10 p-8 rounded-3xl shadow-2xl backdrop-blur-xl">
            <h2 className="text-xl text-white font-bold mb-6 text-center">{isLoginMode ? "欢迎回来" : "创建账号"}</h2>
            <form onSubmit={handleAuth} className="space-y-4">
              <input type="text" placeholder="用户名" required className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3.5 text-white focus:border-emerald-500 transition-all outline-none" value={username} onChange={(e) => setUsername(e.target.value)} />
              <input type="password" placeholder="密码" required className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3.5 text-white focus:border-emerald-500 transition-all outline-none" value={password} onChange={(e) => setPassword(e.target.value)} />
              {authError && <div className="text-red-400 text-xs text-center">{authError}</div>}
              <button type="submit" disabled={authLoading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98] mt-2 flex justify-center items-center">
                {authLoading ? <Loader2 className="animate-spin" /> : isLoginMode ? "登录" : "注册"}
              </button>
            </form>
            <button onClick={() => setIsLoginMode(!isLoginMode)} className="w-full text-center text-gray-500 text-xs mt-6 hover:text-white transition-colors">{isLoginMode ? "没有账号？注册" : "已有账号？登录"}</button>
          </div>
        </div>
      </div>
    )
  }

  // --- 2. 登录后视图 ---
  return (
    <div className="min-h-screen bg-[#050505] pb-32 text-gray-100 font-sans">
      {/* 头部 */}
      <div className="pt-16 pb-6 px-6 bg-gradient-to-b from-[#111] to-[#050505]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-500 to-cyan-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
              {user?.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl text-white font-bold">{user?.username}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-gray-300">ID: {user?.id.toString().slice(-4)}</span>
              </div>
            </div>
          </div>
          <button onClick={logoutUser} className="p-2 bg-white/5 rounded-full hover:bg-white/10">
            <LogOut size={18} className="text-gray-400" />
          </button>
        </div>
      </div>

      <div className="px-4 space-y-6">
        {/* AI 搜片模块 */}
        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#121212] rounded-2xl border border-white/10 p-5 shadow-xl relative overflow-hidden">
          <div className="flex items-center gap-2 mb-4 relative z-10">
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-1.5 rounded-lg"><Bot size={18} className="text-white" /></div>
            <h3 className="font-bold text-white">AI 帮我找片</h3>
          </div>
          <form onSubmit={handleAskAI} className="relative z-10">
            <div className="relative">
              <input type="text" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="描述剧情..." className="w-full bg-black/30 border border-white/10 rounded-xl pl-4 pr-12 py-3 text-sm text-white focus:border-purple-500 transition-all" />
              <button type="submit" disabled={aiLoading || !aiPrompt} className="absolute right-2 top-2 p-1.5 bg-purple-600 rounded-lg text-white disabled:opacity-50">{aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}</button>
            </div>
          </form>
          {aiResults.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 relative z-10">
              {aiResults.map((res, idx) => (
                <button key={idx} onClick={() => handleAiResultClick(res)} className="flex items-center gap-1 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full text-xs text-gray-300 hover:text-white transition-all"><SearchIcon size={10} />{res}</button>
              ))}
            </div>
          )}
        </div>

        {/* 观看历史 (核心修改区域) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold text-gray-400 flex items-center gap-2"><History size={16} /> 观看历史</h3>
            <span className="text-xs text-gray-600">{history.length} 条记录</span>
          </div>

          {historyLoading ? (
             <div className="text-center py-10 text-gray-500 text-xs">加载记录中...</div>
          ) : history.length > 0 ? (
            <div className="grid grid-cols-3 gap-3">
              {history.map((item, idx) => (
                <div key={idx} onClick={() => goToDetail(item)} className="relative group cursor-pointer">
                  {/* 海报容器 */}
                  <div className="aspect-[2/3] rounded-lg overflow-hidden bg-gray-800 relative border border-white/5">
                    <img 
                      src={item.poster} 
                      className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" 
                      loading="lazy" 
                    />
                    
                    {/* 🟢 进度信息遮罩 (修改点) */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent pt-6 pb-1 px-1.5">
                       <div className="flex flex-col items-start gap-0.5">
                         {/* 显示集数 */}
                         <span className="text-[10px] font-bold text-white">
                           {formatEpisode(item.episodeIndex)}
                         </span>
                         {/* 显示进度条背景 */}
                         <div className="w-full h-0.5 bg-white/30 rounded-full mt-0.5 overflow-hidden">
                            {/* 这里仅仅是装饰，如果不知道总时长无法计算百分比，暂不显示进度条长度 */}
                         </div>
                         {/* 显示具体时间 */}
                         <span className="text-[9px] text-emerald-400">
                           {formatProgress(item.progress)}
                         </span>
                       </div>
                    </div>

                    {/* 悬浮播放按钮 */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-black/50 p-2 rounded-full backdrop-blur-sm">
                        <Play size={16} fill="white" className="text-white" />
                      </div>
                    </div>
                  </div>
                  
                  {/* 标题 */}
                  <h4 className="text-xs text-gray-400 mt-2 line-clamp-1 group-hover:text-white transition-colors">
                    {item.title}
                  </h4>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center border border-dashed border-white/10 rounded-xl">
              <p className="text-xs text-gray-600">暂无观看记录</p>
            </div>
          )}
        </div>

        {/* 底部菜单 */}
        <div className="bg-[#121212] rounded-2xl border border-white/5 overflow-hidden">
          <Link to="/disclaimer" className="flex items-center justify-between p-4 border-b border-white/5 active:bg-white/5">
            <span className="text-sm text-gray-400 flex items-center gap-3"><ShieldCheck size={16} /> 免责声明</span><ChevronRight size={14} className="text-gray-600" />
          </Link>
          <Link to="/privacy" className="flex items-center justify-between p-4 active:bg-white/5">
            <span className="text-sm text-gray-400 flex items-center gap-3"><FileText size={16} /> 隐私政策</span><ChevronRight size={14} className="text-gray-600" />
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Profile