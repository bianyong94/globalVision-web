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
            登录或注册时，账号服务会处理您的手机号、昵称、密码凭据和设备会话；密码仅以安全哈希形式保存。
            登录后的观看历史和播放进度保存在账号服务中，用于与 TV 端同步。浏览器本地只保存登录令牌、
            搜索历史和页面展示状态，不再保存观看历史副本。
          </div>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-2">匿名访问统计</h2>
          <p className="text-sm leading-relaxed text-gray-400">
            为了解访问规模并改善页面体验，应用使用 Vercel Web Analytics
            收集匿名汇总数据，包括访问时间、页面路径、访问来源、粗粒度地区、设备类型、操作系统和浏览器类型。
            该统计功能不使用 Cookie，不保存或向本站展示可关联到具体用户的原始 IP
            地址，也不会用于跨网站或跨日识别用户。相关数据由 Vercel
            处理，用于生成访问人数、页面浏览量、热门页面和跳出率等统计报表。
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-2">第三方资源说明</h2>
          <p className="text-sm leading-relaxed text-gray-400">
            页面中的影片封面、视频流地址或短视频资源，可能来自第三方内容源或第三方图片服务。应用本身会尽量
            以只读方式请求这些资源，用于播放、展示封面和加载缩略图，但并不代表对第三方内容拥有控制权或所有权。
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-2">数据控制与清理</h2>
          <p className="text-sm leading-relaxed text-gray-400">
            您可以通过“我的”页面删除单条或清空全部观看历史，变更会同步到同一账号登录的 TV 端。
            退出登录会清除当前浏览器中的账号会话；清理浏览器站点数据还会移除搜索历史和页面状态。
            匿名访问统计不提供识别或追踪单个用户的能力。
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-2">隐私原则</h2>
          <p className="text-sm leading-relaxed text-gray-400">
            当前项目按功能需要最少存储用户数据。影视内容接口与账号服务相互独立，账号服务仅用于认证、
            会话管理和用户资料、观看历史等同步数据。
          </p>
        </section>
        <section>
          <h2 className="text-white font-bold text-lg mb-2">侵权声明</h2>
          <p className="text-sm leading-relaxed text-gray-400">
            当前项目不参与任何版权纠纷，请勿将本项目用于商业用途。
            否则，我们会及时联系并删除。
            如有任何版权问题，本站将及时处理并删除相关内容。
          </p>
        </section>
      </div>
    </div>
  )
}

export default PrivacyPolicy
