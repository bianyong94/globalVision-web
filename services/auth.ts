import { VideoResource } from "../types"

// 这里写死IP，或者复用 api.ts 里的 BASE_URL
const BASE_URL = "http://bycurry.zeabur.app/api"

export interface User {
  id: number
  username: string
  history?: VideoResource[]
}

export const login = async (
  username: string,
  password: string
): Promise<User | null> => {
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    })
    const data = await res.json()
    if (data.code === 200) return data.data
    alert(data.message)
    return null
  } catch (e) {
    console.error(e)
    return null
  }
}

export const register = async (
  username: string,
  password: string
): Promise<User | null> => {
  try {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    })
    const data = await res.json()
    if (data.code === 200) return data.data
    alert(data.message)
    return null
  } catch (e) {
    console.error(e)
    return null
  }
}

export const syncHistory = async (username: string, video: VideoResource) => {
  try {
    await fetch(`${BASE_URL}/user/history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, video }),
    })
  } catch (e) {
    console.error("同步历史记录失败", e)
  }
}

// ✅ [新增] 主动拉取最新历史记录
export const fetchUserHistory = async (
  username: string
): Promise<VideoResource[]> => {
  try {
    const res = await fetch(`${BASE_URL}/user/history?username=${username}`)
    const data = await res.json()
    if (data.code === 200) {
      return data.data || []
    }
    return []
  } catch (e) {
    console.error("获取历史记录失败", e)
    return []
  }
}
