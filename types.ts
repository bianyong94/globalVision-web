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
  source_ref?: string
  season_no?: number | null
  season_label?: string
}
export interface VideoSource {
  key?: string // feifan
  name?: string // 非凡资源
  id?: string // feifan_12345 (跳转用的ID)
  source_key?: string
  source_name?: string
  vod_name?: string
  vod_id?: string
  source_id?: string // 采集站那边的 ID
  remarks?: string
  health?: "good" | "unknown" | "bad"
  latency_ms?: number | null
  // 这里可以存储原始的 m3u8 字符串，或者解析后的数组，看你后端怎么给
  // 如果后端返回的是字符串 "第1集$url#第2集$url"，前端需要解析
  vod_play_url: string
}
export interface Episode {
  name: string
  link: string
}

export interface VideoDetail extends VideoSummary {
  director: string
  writer?: string // 编剧
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
  country?: string // 制片国家 "美国", "中国大陆"
  language?: string // 语言 "en", "zh"
  duration?: number // 单集时长 (分钟)
  // 播放列表
  // 关联推荐
  related?: VideoItem[]
  sources: VideoSource[]
}

export interface HomeData {
  banners: VideoItem[]
  sections: {
    title: string
    type: "scroll" | "grid" | "rank" | "shelf"
    data: VideoItem[]
  }[]
}
export interface VideoItem {
  id: string // 以前可能是 number，现在数据库是 string (uniq_id)
  title: string
  poster: string
  remarks: string
  // 🔥 新增字段
  backdrop?: string // 横版剧照 (用于首页 Banner 或详情页顶部背景)
  original_title?: string // 原名 (例如 "Three Body")
  year?: number | string
  rating?: number
  category?: string // 新增
  tags?: string[] // 新增
  overview?: string // 新增
  source_ref?: string
  season_no?: number | null
  season_label?: string
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

export type AiCandidateSource = "local" | "tmdb" | "external"

export interface AiCandidate {
  source: AiCandidateSource
  title: string
  year?: string
  category?: string
  rating?: number
  id?: string
  tmdb_id?: number
  poster?: string
  poster_path?: string
  source_key?: string
  vod_id?: string
  remarks?: string
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

export interface AppTopNav {
  id: number
  name: string
}

export interface AppScreenFilterGroup {
  id: number
  name: string
  class: string[]
  area: string[]
  year: string[]
  sort?: string[]
}

export interface AppMovieScreen {
  filter: AppScreenFilterGroup[]
}

export interface AppConfig {
  index_top_nav: AppTopNav[]
  movie_screen: AppMovieScreen
}

export interface MovieBannerItem {
  id: string
  title: string
  cover: string
  image?: string
  backdrop?: string
  click?: string
  type?: number
  dynamic?: string
  year?: string
  label?: string
  content?: string
  safe?: boolean
}

export interface MovieListMember {
  member_id: number
  name: string
  type: number
}

export interface MovieListItem {
  id: string
  name: string
  cover: string
  year?: string
  dynamic?: string
  type_name?: string
  collect_count?: number
  label?: string
  highlight?: string
  blurb?: string
  hot?: string
  popularity_score?: number
  score?: string
  remarks?: string
  members?: MovieListMember[]
  safe?: boolean
  click?: string
}

export interface MovieRankingItem {
  id: number
  name: string
}

export interface MovieTopicItem {
  id: number
  name: string
  cover: string
  view?: string
  description?: string
  movie_count?: number
}

export interface MovieTopicDetail {
  id: number
  name: string
  description?: string
  cover: string
  view?: string
  movies: MovieListItem[]
}

export interface MovieEpisodeItem {
  episode_id: number
  episode_name: string
  play_url: string
  from_code: string
  ready_to_play?: boolean
  parseUrl?: string
}

export interface MoviePlaySourceItem {
  code: string
  name: string
  list: MovieEpisodeItem[]
}

export interface MovieCommentItem {
  id: number
  movie_id: string
  content: string
  likes?: number
  user?: {
    id: number
    nickname: string
    avatar: string
  }
  safe?: boolean
}

export interface MovieDetailItem {
  id: string
  name: string
  type_id?: number
  type_name?: string
  score?: string
  cover: string
  year?: string
  area?: string
  director?: string
  writer?: string
  actor?: string
  content?: string
  remarks?: string
  play_from: MoviePlaySourceItem[]
  safe?: boolean
}

export interface SearchRankingItem {
  name: string
  word?: string
  hot?: number
  safe?: boolean
}

export interface SearchRankingGroup {
  name: string
  list: SearchRankingItem[]
}

export interface SearchLatelyWord {
  name: string
  word?: string
  safe?: boolean
}

export interface SearchAutocompleteItem {
  name: string
  word?: string
  dynamic?: string
  highlight?: string
  safe?: boolean
}

export interface SearchMoviesResult {
  list: MovieListItem[]
  total?: number
  pagecount?: number
}

export interface ShortVideoFile {
  resourceURL: string
  thumbnail: string
  duration?: number
  width?: number
  height?: number
  size?: number
  title?: string
}

export interface ShortVideoUser {
  id: number
  nickname: string
  avatar: string
  level?: string
}

export interface ShortVideoItem {
  id: string
  description: string
  fileType: string
  file: ShortVideoFile
  createdAt?: string
  commentCount: string
  likeCount: string
  infoText?: string
  isLiked: boolean
  isSaved: boolean
  isFollowed: boolean
  user: ShortVideoUser
}

export interface ShortVideoFeedResult {
  list: ShortVideoItem[]
  total: number
  page: number
  pageSize: number
}

export interface HomeSectionItem {
  title: string
  items: MovieListItem[]
  layout?: string
}

export interface HomeDataV2 {
  config: AppConfig | null
  banners: MovieBannerItem[]
  sections: HomeSectionItem[]
  topicSections: { id: number; name: string; items: MovieListItem[] }[]
}
