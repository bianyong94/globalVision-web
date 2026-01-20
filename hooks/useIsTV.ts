import { Capacitor } from "@capacitor/core"

export const useIsTV = () => {
  // 逻辑：如果是 Android 原生环境，我们暂且认为是 TV
  // 如果你以后要发 Android 手机版，这里需要加更细的判断（比如屏幕宽度或 UserAgent）
  const isAndroid = Capacitor.getPlatform() === "android"
  return isAndroid
}
