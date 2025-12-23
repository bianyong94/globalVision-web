import axios from "axios"
import {
  HomeData,
  SearchResult,
  VideoDetail,
  AuthResponse,
  User,
  Category,
} from "../types"
import toast from "react-hot-toast" // 引入 toast
// Base URL configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000, // 20s timeout for scraping multiple sources
})

// Response Interceptor for global error handling (Optional but recommended)
api.interceptors.response.use(
  (response) => {
    if (response.data && response.data.code && response.data.code !== 200) {
      // 如果不是 200，说明业务报错，抛出错误给 catch 处理
      // 注意：有些采集站接口可能不返回标准 code，需根据实际情况调整
      return Promise.reject(new Error(response.data.message || "Error"))
    }
    return response
  },
  (error) => {
    // ✋ 核心修改：如果是“取消请求”导致的错误，直接抛出，不弹窗！
    if (error.code === "ERR_CANCELED" || axios.isCancel(error)) {
      // 静默失败，不做任何 UI 处理
      return Promise.reject(error)
    }
    // 1. 获取错误信息
    let message = "网络连接异常，请检查网络"

    if (error.response) {
      // 服务器返回了状态码，但不是 2xx
      // switch (error.response.status) {
      //   case 404:
      //     message = "资源未找到 (404)"
      //     break
      //   case 500:
      //     message = "服务器繁忙，请稍后 (500)"
      //     break
      //   case 401:
      //     message = "登录已过期，请重新登录"
      //     break
      //   default:
      //     message = `请求失败 (${error.response.status})`
      // }
      message = error.response.data.message || "请求失败"
    } else if (error.code === "ECONNABORTED") {
      message = "请求超时，源站响应过慢"
    }

    // 2. ⚡️ 全局弹出错误提示
    toast.error(message, { id: "global_error" }) // id防止重复弹窗

    return Promise.reject(error)
  }
)

export const fetchHomeData = async (): Promise<HomeData> => {
  const response = await api.get("/home/trending")
  return response.data.data
}

// Updated fetchVideos to support more filters
export const fetchVideos = async (
  params: {
    t?: string | number // Type ID (Category)
    pg?: number // Page number
    wd?: string // Keyword
    year?: string // Year filter
    h?: number // Hours (e.g., 24 for latest updates)
    by?: string // Sort order (time, hits, score) - 配合前端排序功能
  },
  signal?: AbortSignal
): Promise<SearchResult> => {
  const response = await api.get("/videos", { params, signal })
  return response.data.data
}

export const fetchVideoDetail = async (
  id: string | number
): Promise<VideoDetail> => {
  const response = await api.get(`/detail/${id}`)
  return response.data.data
}

export const fetchCategories = async (): Promise<Category[]> => {
  try {
    const response = await api.get("/categories")
    // Ensure we always return an array even if api fails silently
    return Array.isArray(response.data.data) ? response.data.data : []
  } catch (error) {
    console.error("Failed to fetch categories", error)
    return []
  }
}

// Auth
export const login = async (
  username: string,
  password: string
): Promise<User> => {
  const response = await api.post<AuthResponse>("/auth/login", {
    username,
    password,
  })
  // Handle business logic errors (e.g. 401/400 returned as 200 with error code)
  if (response.data.code !== 200) {
    throw new Error(response.data.message || "登录失败")
  }
  return response.data.data
}

export const register = async (
  username: string,
  password: string
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
  video: { id: string | number; title: string; poster: string; type: string }
  episodeIndex: number
  progress: number
}) => {
  await api.post("/user/history", payload)
}
