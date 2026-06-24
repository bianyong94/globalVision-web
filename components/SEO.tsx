import React from "react"
import { Helmet } from "react-helmet-async"

interface SeoProps {
  title?: string
  description?: string
  keywords?: string[]
  image?: string
  type?: "website" | "video.movie" | "video.tv_show"
}

const SITE_NAME = "Vastren"
const DEFAULT_DESC =
  "Vastren 是基于目标接口重构的影视前端，聚合推荐、搜索、详情、评论与播放线路。"
const DEFAULT_KEYWORDS = [
  "Vastren",
  "影视搜索",
  "在线点播",
  "电影",
  "剧集",
  "评论",
]

const SEO: React.FC<SeoProps> = ({
  title,
  description = DEFAULT_DESC,
  keywords = [],
  image = "/logo-192.png",
  type = "website",
}) => {
  // 构建完整的标题： "肖申克的救赎 - 极影聚合"
  const fullTitle = title ? `${title} - ${SITE_NAME}` : SITE_NAME
  const allKeywords = [...DEFAULT_KEYWORDS, ...keywords].join(", ")

  return (
    <Helmet>
      {/* 1. 基础 Meta 标签 */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={allKeywords} />

      {/* 2. Open Graph (OG) 标签 - 用于微信、Discord、Slack 分享时显示卡片 */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content={SITE_NAME} />

      {/* 3. Twitter Card 标签 */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* 4. 移动端优化 */}
      <meta
        name="viewport"
        content="width=device-width, initial-scale=1, maximum-scale=1"
      />
    </Helmet>
  )
}

export default SEO
