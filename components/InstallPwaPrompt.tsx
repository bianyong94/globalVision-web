import React, { useState, useEffect } from "react"
import { X, Share, PlusSquare, Download } from "lucide-react"

const InstallPwaPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  useEffect(() => {
    // 1. 检查是否已经是 APP 模式 (Standalone)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true

    if (isStandalone) return // 如果已经是 App 了，就不显示

    // 2. 检查是否刚刚关闭过 (避免烦人，设置24小时冷却)
    const lastDismissed = localStorage.getItem("pwa_dismissed_ts")
    if (
      lastDismissed &&
      Date.now() - parseInt(lastDismissed) < 1000 * 60 * 60 * 24
    ) {
      return
    }

    // 3. 判断设备类型
    const ua = window.navigator.userAgent
    const isIosDevice = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream
    setIsIOS(isIosDevice)

    if (isIosDevice) {
      // iOS 只要不是 Standalone 就显示提示 (延迟 2 秒显示，让用户先看会儿页面)
      setTimeout(() => setShowPrompt(true), 2000)
    } else {
      // Android / Desktop Chrome 监听安装事件
      const handler = (e: Event) => {
        e.preventDefault() // 阻止浏览器默认的丑陋横幅
        setDeferredPrompt(e) // 保存事件，稍后触发
        setShowPrompt(true)
      }
      window.addEventListener("beforeinstallprompt", handler)
      return () => window.removeEventListener("beforeinstallprompt", handler)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === "accepted") {
      setDeferredPrompt(null)
      setShowPrompt(false)
    }
  }

  const handleClose = () => {
    setShowPrompt(false)
    // 记录关闭时间
    localStorage.setItem("pwa_dismissed_ts", Date.now().toString())
  }

  if (!showPrompt) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom-5 duration-500">
      <div className="bg-[#1a1a1a]/95 backdrop-blur-md border border-white/10 p-4 rounded-2xl shadow-2xl relative overflow-hidden">
        {/* 关闭按钮 */}
        <button
          onClick={handleClose}
          className="absolute top-2 right-2 p-1 text-gray-400 hover:text-white"
        >
          <X size={16} />
        </button>

        <div className="flex items-start gap-4 pr-6">
          {/* LOGO 占位 */}
          <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center text-black font-bold text-lg shrink-0 shadow-lg shadow-emerald-500/20">
            GV
          </div>

          <div className="flex-1">
            <h3 className="text-white font-bold text-sm mb-1">添加到主屏幕</h3>
            <p className="text-gray-400 text-xs leading-relaxed mb-3">
              {isIOS
                ? "安装后获得全屏沉浸式体验，且访问更流畅。"
                : "将网站安装为 App，体验更佳，随时随地观看。"}
            </p>

            {isIOS ? (
              // iOS 引导 UI
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-gray-300">
                  <span className="flex items-center justify-center w-5 h-5 bg-white/10 rounded">
                    1
                  </span>
                  <span>点击底部浏览器的</span>
                  <Share size={14} className="text-blue-400" />
                  <span>分享按钮</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-300">
                  <span className="flex items-center justify-center w-5 h-5 bg-white/10 rounded">
                    2
                  </span>
                  <span>向下滑动选择</span>
                  <span className="flex items-center gap-1 font-bold text-white">
                    <PlusSquare size={14} /> 添加到主屏幕
                  </span>
                </div>
                {/* 底部小箭头指向 Safari 底部工具栏 */}
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 animate-bounce opacity-50">
                  👇
                </div>
              </div>
            ) : (
              // Android 安装按钮
              <button
                onClick={handleInstallClick}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-bold px-4 py-2 rounded-full transition-colors"
              >
                <Download size={14} />
                立即安装 App
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default InstallPwaPrompt
