// 处理图片的工具函数
export const getProxyUrl = (url: string) => {
  if (!url) return ""
  // 如果已经是 https 且看起来很快的源，可以跳过 (可选)
  // 这里使用 weserv.nl 免费图片代理及缓存服务
  // 它可以把 http 转 https，自动压缩图片，且在全球有 CDN
  return `https://wsrv.nl/?url=${encodeURIComponent(
    url,
  )}&w=300&h=450&fit=cover&a=top`
}

// 工具函数：转义正则特殊字符
