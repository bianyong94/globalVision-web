import React, { useState } from "react"
import { User as UserIcon, Lock, ArrowRight } from "lucide-react"
import { login, register, User } from "../services/auth"

interface LoginProps {
  onLoginSuccess: (user: User) => void
  darkMode: boolean
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess, darkMode }) => {
  const [isRegister, setIsRegister] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) return

    setLoading(true)
    let user: User | null = null

    if (isRegister) {
      user = await register(username, password)
      // 注册成功后自动登录，或者提示去登录，这里简化为直接成功
    } else {
      user = await login(username, password)
    }

    setLoading(false)
    if (user) {
      onLoginSuccess(user)
    }
  }

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center p-6 ${
        darkMode ? "bg-zinc-950 text-white" : "bg-white"
      }`}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black text-blue-500 mb-2">
            Global Vision
          </h1>
          <p className="text-sm text-gray-500">开启你的全球影视之旅</p>
        </div>

        <div
          className={`p-6 rounded-2xl border ${
            darkMode
              ? "bg-zinc-900 border-zinc-800"
              : "bg-white border-gray-100 shadow-xl"
          }`}
        >
          <div className="flex mb-6 border-b border-gray-700/20">
            <button
              onClick={() => setIsRegister(false)}
              className={`flex-1 pb-3 text-sm font-bold ${
                !isRegister
                  ? "text-blue-500 border-b-2 border-blue-500"
                  : "text-gray-500"
              }`}
            >
              登录
            </button>
            <button
              onClick={() => setIsRegister(true)}
              className={`flex-1 pb-3 text-sm font-bold ${
                isRegister
                  ? "text-blue-500 border-b-2 border-blue-500"
                  : "text-gray-500"
              }`}
            >
              注册
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div
              className={`flex items-center p-3 rounded-xl border ${
                darkMode
                  ? "bg-zinc-950 border-zinc-800"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <UserIcon size={18} className="text-gray-400 mr-3" />
              <input
                type="text"
                placeholder="用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-transparent flex-1 outline-none text-sm"
              />
            </div>
            <div
              className={`flex items-center p-3 rounded-xl border ${
                darkMode
                  ? "bg-zinc-950 border-zinc-800"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <Lock size={18} className="text-gray-400 mr-3" />
              <input
                type="password"
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-transparent flex-1 outline-none text-sm"
              />
            </div>

            <button
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 mt-4 active:scale-95 transition-transform"
            >
              {loading ? "处理中..." : isRegister ? "立即注册" : "进入视界"}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Login
