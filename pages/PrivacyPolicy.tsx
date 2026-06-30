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
            当前版本以本地使用为主。为了提供更顺手的浏览体验，应用会在您的设备浏览器中保存少量本地数据，
            主要包括观看历史、短视频喜欢列表、搜索历史以及页面展示状态。这些数据默认保存在当前设备的
            `localStorage` 或 `sessionStorage`
            中，用于实现继续播放、恢复浏览位置和本地偏好展示。
          </div>
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
            您可以通过“我的”页面清除观看历史；短视频喜欢列表也会在取消喜欢后从本地移除。如需彻底清除本地缓存，
            也可以直接清理浏览器站点数据。清理后，观看进度、喜欢记录和搜索历史将无法恢复。
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-2">隐私原则</h2>
          <p className="text-sm leading-relaxed text-gray-400">
            当前项目优先采用“本地优先、最少存储”的方式处理用户数据，不主动要求与功能无关的个人信息。若后续
            引入账号、同步或云端能力，相关页面与文案会同步更新。
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
