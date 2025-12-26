import axios from "axios"
import {
  HomeData,
  SearchResult,
  VideoDetail,
  AuthResponse,
  User,
  Category,
} from "../types"
import toast from "react-hot-toast"

// Base URL configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000, // 20s timeout
})

// ... (拦截器部分保持不变，不需要动) ...
api.interceptors.response.use(
  (response) => {
    if (response.data && response.data.code && response.data.code !== 200) {
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
  }
)

// ... (fetchHomeData, fetchVideos, fetchVideoDetail, fetchCategories 保持不变) ...

export const fetchHomeData = async (): Promise<HomeData> => {
  const response = await api.get("/home/trending")
  return response.data.data
}

export const fetchVideos = async (
  params: {
    t?: string | number
    pg?: number
    wd?: string
    year?: string
    h?: number
    by?: string
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
    return Array.isArray(response.data.data) ? response.data.data : []
  } catch (error) {
    console.error("Failed to fetch categories", error)
    return []
  }
}

// 🔥🔥🔥 新增 AI 提问接口 🔥🔥🔥
export const askAI = async (question: string): Promise<string[]> => {
  // 使用 api 实例调用，享受全局拦截器处理错误
  const response = await api.post("/ai/ask", { question })

  // 后端返回结构为 { code: 200, data: ["电影1", "电影2"] }
  // 做个防御性检查，确保返回的是数组
  return Array.isArray(response.data.data) ? response.data.data : []
}

// ... (Auth 和 History 部分保持不变) ...

// Auth
export const login = async (
  username: string,
  password: string
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
