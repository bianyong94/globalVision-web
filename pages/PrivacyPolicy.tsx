import React from "react"
import { useNavigate } from "react-router-dom"
import { ChevronLeft, Lock } from "lucide-react"

const PrivacyPolicy = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-300 p-4 pb-20">
      <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-md -mx-4 px-4 py-3 flex items-center gap-2 border-b border-white/5 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-1 rounded-full hover:bg-white/10"
        >
          <ChevronLeft className="text-white" />
        </button>
        <h1 className="text-white font-bold text-lg">隐私政策</h1>
      </div>

      <div className="space-y-6 max-w-2xl mx-auto">
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Lock className="text-primary" size={20} />
            <h2 className="text-white font-bold text-lg">数据收集与使用</h2>
          </div>
          <div className="text-sm leading-relaxed text-gray-400 bg-white/5 p-4 rounded-xl">
            为了提供“观看历史”同步功能，我们需要收集以下最少量的必要信息：
            <ul className="list-disc list-inside mt-2 space-y-1 ml-2 text-gray-300">
              <li>您的用户名（用于身份标识）</li>
              <li>加密存储的密码（仅用于登录验证）</li>
              <li>您的观看记录（包含影片ID、名称及观看进度）</li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-2">信息安全</h2>
          <p className="text-sm leading-relaxed text-gray-400">
            我们采取加密技术保护您的密码安全。您的个人信息绝不会被出售或分享给第三方机构。本站是一个开源学习项目，我们致力于保护您的数字隐私。
          </p>
        </section>
      </div>
    </div>
  )
}

export default PrivacyPolicy
