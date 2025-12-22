import { ApiResponse, VideoResource, HomeData, Category } from "../types"

const BASE_URL = "http://bycurry.zeabur.app/api"

/**
 * 获取首页聚合数据 (轮播、热门电影/电视剧/动漫)
 */
export const fetchHomeTrending = async (): Promise<HomeData | null> => {
  try {
    const response = await fetch(`${BASE_URL}/home/trending`)
    const res: ApiResponse<HomeData> = await response.json()
    return res.data
  } catch (error) {
    console.error("Fetch trending failed:", error)
    return null
  }
}

/**
 * 获取视频详情
 */
export const getVideoDetail = async (
  id: string | number
): Promise<VideoResource | null> => {
  try {
    const response = await fetch(`${BASE_URL}/detail/${id}`)
    const res: ApiResponse<VideoResource> = await response.json()
    return res.data
  } catch (error) {
    console.error("Get video detail failed:", error)
    return null
  }
}

/**
 * [新增] 获取分类列表 (如: 电影, 电视剧, 动漫...)
 */
export const fetchCategories = async (): Promise<Category[]> => {
  try {
    const response = await fetch(`${BASE_URL}/categories`)
    const res: ApiResponse<Category[]> = await response.json()
    return res.data || []
  } catch (error) {
    console.error("Fetch categories failed:", error)
    return []
  }
}

/**
 * [新增] 通用视频列表查询 (支持分类筛选、分页、搜索)
 * 用于“更多”页面和“搜索”功能
 */
export const fetchVideoList = async (params: {
  t?: number
  pg?: number
  wd?: string
  year?: string // 👈 新增
}): Promise<{ list: VideoResource[]; pagecount: number }> => {
  // 👈 返回值带上总页数，用于判断是否还有下一页
  try {
    const url = new URL(`${BASE_URL}/videos`)
    if (params.t) url.searchParams.append("t", String(params.t))
    if (params.pg) url.searchParams.append("pg", String(params.pg))
    if (params.wd) url.searchParams.append("wd", params.wd)
    if (params.year) url.searchParams.append("year", params.year)

    const response = await fetch(url.toString())
    const res = await response.json()

    // 返回列表和总页数
    return {
      list: res.data?.list || [],
      pagecount: res.data?.pagecount || 1,
    }
  } catch (error) {
    console.error("Fetch video list failed:", error)
    return { list: [], pagecount: 0 }
  }
}

/**
 * [保留] 旧的搜索方法 (为了兼容性，底层直接复用 fetchVideoList)
 */
export const searchVideos = async (query: string): Promise<VideoResource[]> => {
  return fetchVideoList({ wd: query })
}
