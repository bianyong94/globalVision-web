import axios from "axios"
import {
  HomeData,
  SearchResult,
  VideoDetail,
  AuthResponse,
  User,
  Category,
  VideoSummary, // 确保从 types 导入了 Video 类型
} from "../types"
import toast from "react-hot-toast"
import { VideoSource } from "../types"

// Base URL configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 100000, // 20s timeout
})

// ... (拦截器部分保持不变，不需要动) ...
api.interceptors.response.use(
  (response) => {
    if (response.data && response.data.code && response.data.code !== 200) {
      // 兼容某些接口直接返回数组或对象没有 code 字段的情况
      if (
        !response.data.code &&
        (Array.isArray(response.data) || response.data.list)
      ) {
        return response
      }
      return Promise.reject(new Error(response.data.message || "Error"))
    }
    return response
  },
  (error) => {
    if (error.code === "ERR_CANCELED" || axios.isCancel(error)) {
      return Promise.reject(error)
    }
    let message = "网络连接异常，请检查网络"
    if (error.response) {
      message = error.response.data.message || "请求失败"
    } else if (error.code === "ECONNABORTED") {
      message = "请求超时，源站响应过慢"
    }
    toast.error(message, { id: "global_error" })
    return Promise.reject(error)
  },
)

// =================================================================
// 🔥🔥🔥 核心升级区域：适配 CMS 数据库模式 🔥🔥🔥
// =================================================================

// 1. 获取“精装修”首页数据 (Banner + Netflix/短剧/高分专区)
export const fetchHomeData = async (): Promise<HomeData> => {
  // 对应后端的新接口 /api/v2/home
  const response = await api.get("/v2/home")
  return response.data.data
}

// 2. 视频列表与筛选接口 (支持标签、分类、排序)
// 对应后端的新接口 /api/v2/videos
export const fetchVideos = async (
  params: {
    pg?: number // 页码
    cat?: string // 🔥 标准大类: movie, tv, anime, variety, sports
    tag?: string // 🔥 智能标签: netflix, 4k, 古装, 悬疑, miniseries(短剧)
    area?: string // 地区: 韩国, 美国...
    year?: string // 年份
    sort?: string // 排序: rating(评分), year(年份), 默认按时间
    wd?: string // 搜索关键词 (Search 页面复用此接口)
    view?: "season"
  },
  signal?: AbortSignal,
): Promise<SearchResult> => {
  const response = await api.get("/v2/videos", { params, signal })

  // 后端返回的是 { code: 200, list: [...] }
  // 这里做个适配，让前端能直接拿到数据
  return {
    list: response.data.list || [],
    total: response.data.total || 0, // 如果后端没算 total，前端最好做个无限滚动不做分页条
    pagecount: 100, // 数据库模式下，暂定给个足够大的页数，或者后端补上 count 计算
  } as unknown as SearchResult
}

// 3. 视频详情
export const fetchVideoDetail = async (
  id: string | number,
): Promise<VideoDetail> => {
  // 注意：现在的 ID 可能是 "maotai_12345" 这种字符串格式
  const response = await api.get(`/detail/${id}`)
  // 兼容直接返回对象或包裹在 data 里的情况
  return response.data.data || response.data
}

// 4. 分类接口
// ⚠️ 注意：既然我们采用了“标准分类”，前端其实可以写死 Tab (电影/剧集/综艺/动漫)，
// 这个接口主要用于获取资源站的原始分类做映射，或者您可以暂时不再使用它。
export const fetchCategories = async (): Promise<Category[]> => {
  try {
    const response = await api.get("/categories")
    return Array.isArray(response.data.data) ? response.data.data : []
  } catch (error) {
    console.error("Failed to fetch categories", error)
    return []
  }
}

// =================================================================
// 🔥 AI 与 用户系统 (保持不变)
// =================================================================

export const askAI = async (question: string): Promise<string[]> => {
  const response = await api.post("/ai/ask", { question })
  return Array.isArray(response.data.data) ? response.data.data : []
}

export const login = async (
  username: string,
  password: string,
): Promise<User> => {
  const response = await api.post<AuthResponse>("/auth/login", {
    username,
    password,
  })
  if (response.data.code !== 200) {
    throw new Error(response.data.message || "登录失败")
  }
  return response.data.data
}

export const register = async (
  username: string,
  password: string,
): Promise<User> => {
  const response = await api.post<AuthResponse>("/auth/register", {
    username,
    password,
  })
  if (response.data.code !== 200) {
    throw new Error(response.data.message || "注册失败")
  }
  return response.data.data
}

export const fetchHistory = async (username: string): Promise<any[]> => {
  const response = await api.get("/user/history", { params: { username } })
  return Array.isArray(response.data.data) ? response.data.data : []
}

export const saveHistory = async (payload: {
  username: string
  video: {
    id: string | number
    title: string
    poster: string
    type: string
    seasonLabel?: string
    sourceRef?: string
  }
  episodeIndex: number
  progress: number
}) => {
  await api.post("/user/history", payload)
}

export const clearUserHistory = async (username: string): Promise<boolean> => {
  try {
    const response = await api.delete(
      `/user/history?username=${encodeURIComponent(username)}`,
    )
    return response.data.code === 200
  } catch (error) {
    console.error("清空历史失败", error)
    return false
  }
}

export const fetchVideoSources = async (
  title: string,
): Promise<VideoSource[]> => {
  // 注意：axios 的 params 会自动处理 URL 编码
  const response = await api.get("/v2/video/sources", { params: { title } })

  // 后端返回的是 { code: 200, data: [...] } 或直接数组，根据你的封装调整
  // 假设你的拦截器返回的是 response.data.data
  return Array.isArray(response.data.data) ? response.data.data : []
}

// =================================================================
// 🔥🔥🔥 TMDB 元数据驱动接口 (Netflix/高分榜/关联查询) 🔥🔥🔥
// =================================================================

/**
 * 获取 TMDB Netflix 热门剧集列表
 * 返回的数据是精美的 TMDB 数据，用于展示
 */
export const fetchTmdbNetflix = async (): Promise<VideoSummary[]> => {
  const response = await api.get("/v2/tmdb/netflix")
  // 后端接口返回的是 { code: 200, data: [...] }
  return Array.isArray(response.data.data) ? response.data.data : []
}

/**
 * 获取 TMDB 高分电影榜单
 */
export const fetchTmdbTopRated = async (): Promise<VideoSummary[]> => {
  const response = await api.get("/v2/tmdb/top_rated")
  return Array.isArray(response.data.data) ? response.data.data : []
}

/**
 * 资源关联匹配接口
 * 前端点击 TMDB 列表中的卡片时调用，检查本地数据库是否有资源
 * @param params { tmdb_id, title, category }
 */
export const matchLocalResource = async (params: {
  tmdb_id: number | string
  title: string
  category?: string
  year?: number | string
}): Promise<{
  found: boolean
  id?: string // 如果 found 为 true，这里返回本地数据库的 uniq_id (如 "maotai_1234")
  title?: string
  message?: string
}> => {
  const response = await api.get("/v2/resource/match", { params })
  return response.data.data
}

export const ingestVideo = async (title: string): Promise<any> => {
  // 因为 api 实例已经配置了 baseURL: '/api'，所以这里直接请求 /v2/ingest 即可
  const response = await api.post("/v2/ingest", { title })
  return response.data
}
