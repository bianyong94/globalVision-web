import React, { useState, useEffect } from "react"
import { X, Share, PlusSquare, Download } from "lucide-react"

const FIRST_VISIT_KEY = "pwa_install_prompt_seen"

const InstallPwaPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true

    if (isStandalone) return

    const hasSeenPrompt = localStorage.getItem(FIRST_VISIT_KEY) === "1"
    if (hasSeenPrompt) {
      return
    }

    localStorage.setItem(FIRST_VISIT_KEY, "1")

    const ua = window.navigator.userAgent
    const isIosDevice = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream
    setIsIOS(isIosDevice)

    if (isIosDevice) {
      const timer = window.setTimeout(() => setShowPrompt(true), 1200)
      return () => window.clearTimeout(timer)
    } else {
      const handler = (e: Event) => {
        e.preventDefault()
        setDeferredPrompt(e)
        setShowPrompt(true)
      }
      const installedHandler = () => {
        setDeferredPrompt(null)
        setShowPrompt(false)
      }

      window.addEventListener("beforeinstallprompt", handler)
      window.addEventListener("appinstalled", installedHandler)
      return () => {
        window.removeEventListener("beforeinstallprompt", handler)
        window.removeEventListener("appinstalled", installedHandler)
      }
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
                ? "添加后可直接从桌面打开，名称会使用网站默认名称。"
                : "可直接一键添加到桌面，名称会使用网站默认名称。"}
            </p>

            {isIOS ? (
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
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 animate-bounce opacity-50">
                  👇
                </div>
              </div>
            ) : (
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
