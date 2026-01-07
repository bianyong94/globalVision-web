export interface VideoSummary {
  id: number | string
  title: string
  type?: string
  poster: string
  backdrop?: string
  remarks: string
  year?: number | string
  rating?: number | string
  date?: string
  overview?: string
}
export interface VideoSource {
  key: string // feifan
  name: string // 非凡资源
  id: string // feifan_12345 (跳转用的ID)
  remarks: string // 更新至30集
}
export interface Episode {
  name: string
  link: string
}

export interface VideoDetail extends VideoSummary {
  director: string
  actors: string
  id: string | number
  title: string
  poster: string
  pic?: string // 兼容字段
  category?: string
  type?: string // 旧字段兼容
  rating?: number
  year?: string | number
  area?: string
  content?: string
  // 播放列表
  episodes: { name: string; link: string }[]

  // 🔥 新增：源信息
  available_sources?: SourceInfo[]
  current_source?: { key: string; name: string }
}

export interface HomeData {
  banners: VideoItem[]
  sections: {
    title: string
    type: "scroll" | "grid"
    data: VideoItem[]
  }[]
}
export interface VideoItem {
  id: string // 以前可能是 number，现在数据库是 string (uniq_id)
  title: string
  poster: string
  remarks: string
  year?: number | string
  rating?: number
  category?: string // 新增
  tags?: string[] // 新增
  // ... 其他字段
}
export interface SearchResult {
  // list: VideoSummary[]
  // total: number
  // pagecount: number
  // source: string
  list: VideoItem[]
  pagecount?: number // 设为可选
  total?: number // 设为可选
}

export interface Category {
  type_id: number
  type_name: string
}

export interface User {
  id: string
  username: string
  history: any[]
}

export interface AuthResponse {
  code: number
  message: string
  data: User
}

export interface HistoryItem extends VideoSummary {
  episodeIndex: number
  progress: number
  viewedAt: string
}

export interface SourceInfo {
  key: string
  name: string
  id: string // 切换用的ID
  remarks?: string
}
