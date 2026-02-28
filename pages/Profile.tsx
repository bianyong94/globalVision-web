import React, { useEffect, useState } from "react"
import { useAuth } from "../context/AuthContext"
import {
  askAI,
  login,
  register,
  fetchHistory,
  clearUserHistory,
  ingestVideo,
  fetchVideos,
} from "../services/api"
import { useNavigate, Link } from "react-router-dom"
import { getProxyUrl } from "../utils/common"

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
  Play,
  Trash2,
  AlertCircle,
  PlusCircle, // 🟢 [新增] 用于采录按钮
  CheckCircle, // 🟢 [新增] 用于成功状态
  SearchX, // 🟢 [新增] 用于失败状态
} from "lucide-react"
import toast from "react-hot-toast"

// 🟢 [新增] AI 智能搜片入库卡片组件
// 负责单个影片的去向检查和一键入库
// 🟢 [优化版] 智能资源卡片：支持本地预览与一键入库
const AiResourceCard: React.FC<{ movieTitle: string }> = ({ movieTitle }) => {
  // 状态：checking(核验中), local(本地已有), idle(全网有但本地无), ingesting(采录中), failed(全网无)
  const [status, setStatus] = useState<
    "checking" | "local" | "idle" | "ingesting" | "failed"
  >("checking")
  const [videoData, setVideoData] = useState<any>(null)
  const navigate = useNavigate()

  useEffect(() => {
    let isMounted = true
    const checkLocal = async () => {
      try {
        // 使用 api.ts 中的 fetchVideos 检查本地
        const data = await fetchVideos({ wd: movieTitle })
        if (!isMounted) return

        if (data && data.list && data.list.length > 0) {
          const match = data.list.find(
            (v: any) =>
              v.title.includes(movieTitle) || movieTitle.includes(v.title),
          )
          if (match) {
            setVideoData(match)
            setStatus("local") // 🚀 识别为本地资源
            return
          }
        }
        setStatus("idle")
      } catch (e) {
        if (isMounted) setStatus("idle")
      }
    }
    checkLocal()
    return () => {
      isMounted = false
    }
  }, [movieTitle])

  const handleIngestAction = async () => {
    setStatus("ingesting")
    const toastId = toast.loading(`正在全网采录《${movieTitle}》...`)
    try {
      const data = await ingestVideo(movieTitle)
      if (data.code === 200) {
        // 入库成功后，获取刚存入的 ID 并标记为 local
        // (也可以简单设置为 success 状态，这里为了展示海报，我们设为 local)
        setStatus("local")
        setVideoData({ id: data.id, title: movieTitle })
        toast.success("收录成功！", { id: toastId })
      } else {
        setStatus("failed")
        toast.error(data.message || "未找到资源", { id: toastId })
      }
    } catch (error) {
      setStatus("failed")
      toast.dismiss(toastId)
    }
  }

  // --- 渲染逻辑 ---

  // 1. 本地已有：显示精美横向卡片
  if (status === "local" && videoData) {
    return (
      <div
        onClick={() => navigate(`/detail/${videoData.id}`)}
        className="flex items-center gap-3 p-2 bg-white/5 border border-emerald-500/30 rounded-xl cursor-pointer hover:bg-white/10 transition-all active:scale-[0.98]"
      >
        <div className="w-16 h-20 shrink-0 rounded-lg overflow-hidden bg-gray-800">
          <img
            src={getProxyUrl(videoData.poster)}
            className="w-full h-full object-cover"
            alt={videoData.title}
          />
        </div>
        <div className="flex-1 overflow-hidden">
          <h4 className="text-sm font-bold text-white truncate">
            {videoData.title}
          </h4>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded">
              本地片库
            </span>
            {videoData.rating > 0 && (
              <span className="text-[10px] text-yellow-500">
                ★ {videoData.rating}
              </span>
            )}
          </div>
          <p className="text-[10px] text-gray-500 mt-1 line-clamp-1">
            点击立即进入播放
          </p>
        </div>
        <div className="pr-2 text-emerald-500">
          <Play size={20} fill="currentColor" />
        </div>
      </div>
    )
  }

  // 2. 正在检查、等待入库或失败：显示紧凑状态条
  return (
    <div className="flex items-center justify-between p-3 bg-[#1a1a1a] border border-white/5 rounded-xl">
      <div className="flex flex-col">
        <span className="text-sm text-gray-300 font-bold">
          《{movieTitle}》
        </span>
        <span className="text-[10px] text-gray-500 mt-0.5">
          {status === "checking"
            ? "正在匹配本地资源..."
            : status === "failed"
              ? "全网暂无该资源"
              : "本站未收录，点击全网采录"}
        </span>
      </div>

      {status === "checking" ? (
        <Loader2 size={16} className="animate-spin text-gray-600 mr-2" />
      ) : status === "idle" || status === "failed" ? (
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleIngestAction()
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold rounded-full transition-all"
        >
          {status === "failed" ? (
            <SearchX size={14} />
          ) : (
            <PlusCircle size={14} />
          )}
          {status === "failed" ? "重试" : "一键收录"}
        </button>
      ) : (
        <Loader2 size={16} className="animate-spin text-blue-500 mr-2" />
      )}
    </div>
  )
}

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

  // 🚀 [终极智能版] 包含意图识别与绝对格式约束的 AI 提示词
  const handleAskAI = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!aiPrompt.trim()) return
    setAiLoading(true)
    setAiResults([])
    try {
      const enhancedPrompt = `你现在是一个冷酷且精准的影视数据库核心API。
用户输入了以下内容：“${aiPrompt}”

请你立刻在内部进行【意图识别】，并严格按照以下两种分支之一输出结果：

分支 A【精准定位】：如果用户输入的是某一部特定的影视、动漫或综艺名称（哪怕有错别字、简称、别名，如“大圣归来”、“莎拉的真伪”），请凭借知识库推断出它的【官方完整原名】，并且只输出这 1 个名字。
分支 B【泛化推荐】：如果用户是求推荐，或者输入的是演员名、导演名、类型、年份等（例如“推荐好看的剧”、“申惠善演的剧”、“2023高分科幻片”、“周星驰”），请推荐 3 到 5 部最经典的符合条件的影视作品名字。

【最高格式禁令】（违背将被重置）：
1. 所有的影视名字必须严格使用书名号《》包裹。
2. 绝对、绝对不允许输出任何问候语、解释性文字、前缀、后缀、编号（如"1."）。
3. 如果有多个结果，请用一个空格隔开。

正确输出示例：
（如果走分支A）：《西游记之大圣归来》
（如果走分支B）：《秘密森林》 《哲仁王后》 《莎拉的真伪人生》

现在，请直接输出你的结果：`

      const results = await askAI(enhancedPrompt)
      setAiResults(results)
    } catch (error) {
      setAiResults(["服务繁忙，请重试"])
    } finally {
      setAiLoading(false)
    }
  }

  // 🚀 [优化2] 增强字符串提取鲁棒性
  const extractMovieTitles = (texts: string[]) => {
    const titles = new Set<string>()
    texts.forEach((text) => {
      const matches = text.match(/《(.*?)》/g)
      if (matches) {
        matches.forEach((m) => titles.add(m.replace(/[《》]/g, "").trim()))
      }
    })

    // 如果大模型不听话，没加书名号，再兜底提取
    if (titles.size === 0) {
      texts.forEach((text) => {
        const cleanText = text.replace(/["'”‘]/g, "").trim()
        // 去掉包含“指令”等系统性废话的内容
        if (
          cleanText.length > 0 &&
          cleanText.length < 15 &&
          !cleanText.includes("指令") &&
          !cleanText.includes("服务")
        ) {
          titles.add(cleanText)
        }
      })
    }
    return Array.from(titles)
  }

  const goToDetail = (video: any) => navigate(`/detail/${video.id}`)

  const formatProgress = (seconds: number) => {
    if (!seconds || seconds < 0) return "刚刚"
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    if (m === 0) return `${s}秒`
    return `${m}分${s}秒`
  }

  const formatEpisode = (index: number) => {
    if (index === undefined || index === null) return "观看至"
    return `第${index + 1}集`
  }

  const handleClearHistory = async () => {
    if (!user || history.length === 0) return

    const isConfirmed = window.confirm(
      "确定要清空所有观看记录吗？此操作不可恢复。",
    )
    if (!isConfirmed) return

    const success = await clearUserHistory(user.username)
    if (success) {
      setHistory([])
      toast.success("历史记录已清空")
    } else {
      toast.error("清空失败，请重试")
    }
  }

  // --- 1. 未登录视图 ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-96 h-96 bg-emerald-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-96 h-96 bg-blue-600/20 rounded-full blur-[120px]" />

        <div className="w-full max-w-sm relative z-10">
          <div className="text-center mb-10">
            <h1 className="text-5xl font-black bg-gradient-to-r from-emerald-400 to-cyan-500 bg-clip-text text-transparent mb-2 tracking-tighter">
              GV
            </h1>
            <p className="text-gray-400 text-sm">Global Vision</p>
          </div>

          <div className="bg-[#121212] border border-white/10 p-8 rounded-3xl shadow-2xl backdrop-blur-xl">
            <h2 className="text-xl text-white font-bold mb-6 text-center">
              {isLoginMode ? "欢迎回来" : "创建账号"}
            </h2>
            <form onSubmit={handleAuth} className="space-y-4">
              <input
                type="text"
                placeholder="用户名"
                required
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3.5 text-white focus:border-emerald-500 transition-all outline-none"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <input
                type="password"
                placeholder="密码"
                required
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3.5 text-white focus:border-emerald-500 transition-all outline-none"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {authError && (
                <div className="text-red-400 text-xs text-center">
                  {authError}
                </div>
              )}
              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98] mt-2 flex justify-center items-center"
              >
                {authLoading ? (
                  <Loader2 className="animate-spin" />
                ) : isLoginMode ? (
                  "登录"
                ) : (
                  "注册"
                )}
              </button>
            </form>
            <button
              onClick={() => setIsLoginMode(!isLoginMode)}
              className="w-full text-center text-gray-500 text-xs mt-6 hover:text-white transition-colors"
            >
              {isLoginMode ? "没有账号？注册" : "已有账号？登录"}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 获取解析后的电影名称列表
  const parsedAiTitles = extractMovieTitles(aiResults)

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
                <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-gray-300">
                  ID: {user?.id.toString().slice(-4)}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={logoutUser}
            className="p-2 bg-white/5 rounded-full hover:bg-white/10"
          >
            <LogOut size={18} className="text-gray-400" />
          </button>
        </div>
      </div>

      <div className="px-4 space-y-6">
        {/* AI 搜片模块 */}
        {/* AI 搜片模块 */}
        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] rounded-2xl border border-white/10 p-5 shadow-2xl relative overflow-hidden group">
          {/* 背景装饰：增加科技感 */}
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-600/10 blur-3xl group-hover:bg-purple-600/20 transition-all" />

          <div className="flex flex-col gap-1 mb-5 relative z-10">
            <div className="flex items-center gap-2">
              <div className="bg-gradient-to-r from-purple-500 to-blue-500 p-1.5 rounded-lg shadow-lg shadow-purple-900/20">
                <Bot size={20} className="text-white" />
              </div>
              <h3 className="font-bold text-white text-lg">智能影视助手</h3>
            </div>
            <p className="text-[11px] text-gray-500 leading-relaxed pl-1">
              💡 试试描述剧情找片，若片库未收录，支持
              <span className="text-purple-400">一键全网同步入库</span>。
            </p>
          </div>

          <form onSubmit={handleAskAI} className="relative z-10">
            <div className="relative">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="例如：推荐几部申惠善演的剧..."
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-4 pr-12 py-3.5 text-sm text-white focus:border-purple-500/50 transition-all placeholder:text-gray-600"
              />
              <button
                type="submit"
                disabled={aiLoading || !aiPrompt}
                className="absolute right-2 top-2 bottom-2 px-3 bg-purple-600 hover:bg-purple-500 rounded-lg text-white disabled:opacity-30 transition-all active:scale-90"
              >
                {aiLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Send size={18} />
                )}
              </button>
            </div>
          </form>

          {/* AI 结果区域：展示智能卡片 */}
          {aiResults.length > 0 && (
            <div className="mt-5 space-y-3 relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-[1px] flex-1 bg-white/5"></div>
                <span className="text-[10px] text-gray-600 font-bold tracking-widest uppercase">
                  AI 识别结果
                </span>
                <div className="h-[1px] flex-1 bg-white/5"></div>
              </div>
              {parsedAiTitles.length > 0
                ? parsedAiTitles.map((title, idx) => (
                    <AiResourceCard key={`ai-item-${idx}`} movieTitle={title} />
                  ))
                : aiResults.map((res, idx) => (
                    <div
                      key={idx}
                      className="bg-white/5 px-3 py-2.5 rounded-lg text-xs text-gray-400 italic"
                    >
                      {res}
                    </div>
                  ))}
            </div>
          )}
        </div>

        {/* 观看历史 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold text-gray-400 flex items-center gap-2">
              <History size={16} /> 观看历史
              <span className="text-xs text-gray-600">
                {history.length} 条记录
              </span>
            </h3>
            <div>
              {history.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="flex items-center gap-1 text-xs text-red-500/80 hover:text-red-500 bg-red-500/10 px-2 py-1 rounded transition-colors"
                >
                  <Trash2 size={12} /> 清空
                </button>
              )}
            </div>
          </div>

          {historyLoading ? (
            <div className="text-center py-10 text-gray-500 text-xs">
              加载记录中...
            </div>
          ) : history.length > 0 ? (
            <div className="grid grid-cols-3 gap-3">
              {history.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => goToDetail(item)}
                  className="relative group cursor-pointer"
                >
                  {/* 海报容器 */}
                  <div className="aspect-[2/3] rounded-lg overflow-hidden bg-gray-800 relative border border-white/5">
                    <img
                      src={getProxyUrl(item.poster)}
                      className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                      loading="lazy"
                    />

                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent pt-6 pb-1 px-1.5">
                      <div className="flex flex-col items-start gap-0.5">
                        <span className="text-[10px] font-bold text-white">
                          {formatEpisode(item.episodeIndex)}
                        </span>
                        <span className="text-[9px] text-emerald-400">
                          {formatProgress(item.progress)}
                        </span>
                      </div>
                    </div>

                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-black/50 p-2 rounded-full backdrop-blur-sm">
                        <Play size={16} fill="white" className="text-white" />
                      </div>
                    </div>
                  </div>

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
          <Link
            to="/disclaimer"
            className="flex items-center justify-between p-4 border-b border-white/5 active:bg-white/5"
          >
            <span className="text-sm text-gray-400 flex items-center gap-3">
              <ShieldCheck size={16} /> 免责声明
            </span>
            <ChevronRight size={14} className="text-gray-600" />
          </Link>
          <Link
            to="/privacy"
            className="flex items-center justify-between p-4 active:bg-white/5"
          >
            <span className="text-sm text-gray-400 flex items-center gap-3">
              <FileText size={16} /> 隐私政策
            </span>
            <ChevronRight size={14} className="text-gray-600" />
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Profile
