import React from "react"
import { useNavigate } from "react-router-dom"
import { ChevronLeft, ShieldAlert } from "lucide-react"

const Disclaimer = () => {
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
        <h1 className="text-white font-bold text-lg">免责声明</h1>
      </div>

      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex gap-3 items-start">
          <ShieldAlert className="text-red-500 flex-shrink-0 mt-1" />
          <div>
            <h3 className="text-red-500 font-bold mb-1">重要提示</h3>
            <p className="text-xs text-red-300/80">
              本站仅提供Web页面服务，所有内容均来源于互联网第三方站点。
            </p>
          </div>
        </div>

        <section>
          <h2 className="text-white font-bold text-lg mb-2">1. 资源来源</h2>
          <p className="text-sm leading-relaxed text-gray-400">
            本网站作为影视数据聚合引擎，所有视频资源均通过程序自动采集自互联网公共接口（API）。本站服务器
            <strong>不存储、不上传、不录制</strong>
            任何视频文件。所有视频播放流均直接链接至第三方服务器。
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-2">2. 版权说明</h2>
          <p className="text-sm leading-relaxed text-gray-400">
            如果您发现本站链接的第三方资源侵犯了您的权益，请直接联系源站点（如第三方API提供商）进行处理。一旦源站点删除相关内容，本站将自动无法访问该资源。
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-2">3. 用户责任</h2>
          <p className="text-sm leading-relaxed text-gray-400">
            用户在使用本站服务时，请遵守当地法律法规。任何因使用本站服务而产生的纠纷，本站概不负责。
          </p>
        </section>
      </div>
    </div>
  )
}

export default Disclaimer
