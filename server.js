const { HttpsProxyAgent } = require("https-proxy-agent")
require("dotenv").config()
const express = require("express")
const axios = require("axios")
const cors = require("cors")
const NodeCache = require("node-cache")

const app = express()
const PORT = process.env.PORT || 3000

// ==========================================
// 1. 配置区域
// ==========================================
// 🔴 核心变更：API 地址换成红牛资源
const HONGNIU_BASE_URL = "https://www.hongniuzy2.com/api.php/provide/vod/"

// 缓存策略 (资源站更新快，建议缩短缓存时间，例如 10 分钟)
const cache = new NodeCache({ stdTTL: 600 })

app.use(cors())

// 🔥 代理配置 (如果你在国内访问红牛慢，可以保留；如果红牛屏蔽代理，请注释掉 httpsAgent)
const proxyUrl = process.env.PROXY_URL || "http://172.19.203.113:7897" // 请确保端口正确
const agent = new HttpsProxyAgent(proxyUrl)

// Axios 实例
const apiClient = axios.create({
  baseURL: HONGNIU_BASE_URL,
  timeout: 4000,
  // 如果不需要代理，请注释下面两行
  httpsAgent: agent,
  proxy: false,
})

// ==========================================
// 2. 工具函数 (核心逻辑变更)
// ==========================================

const success = (res, data) => res.json({ code: 200, message: "success", data })
const fail = (res, msg = "Server Error", code = 500) =>
  res.status(code).json({ code, message: msg })

/**
 * 🛠️ 核心工具：解析 CMS 格式的播放地址
 * 输入: "第01集$https://a.com/1.m3u8#第02集$https://a.com/2.m3u8"
 * 输出: [{ name: "第01集", link: "..." }, { name: "第02集", link: "..." }]
 */
const parsePlayUrl = (urlStr) => {
  if (!urlStr) return []
  // 1. 先用 '#' 分割集数
  const episodes = urlStr.split("#")

  return episodes.map((ep) => {
    // 2. 再用 '$' 分割名称和链接
    // 注意：有些没名字，可能要容错处理
    let parts = ep.split("$")
    let name = parts.length > 1 ? parts[0] : "正片"
    let link = parts.length > 1 ? parts[1] : parts[0]
    return { name, link }
  })
}

/**
 * 🛠️ HTML 标签清理工具
 * 资源站的简介(vod_content)里常带有HTML标签，需要清洗
 */
const stripHtml = (html) => {
  if (!html) return ""
  return html.replace(/<[^>]*>?/gm, "")
}

// ==========================================
// 3. API 接口重写
// ==========================================

/**
 * [首页推荐]
 * 资源站没有"热门算法"，通常直接拉取"最近更新"
 */
// app.get("/api/home/trending", async (req, res) => {
//   const cacheKey = "home_latest"
//   if (cache.has(cacheKey)) return success(res, cache.get(cacheKey))

//   try {
//     // ac=detail 才能拿到图片和简介，只用 ac=list 只有标题
//     // h=24 表示获取最近24小时更新，或者直接分页 pg=1
//     const response = await apiClient.get("", {
//       params: {
//         ac: "detail",
//         at: "json",
//         pg: 1, // 获取第一页作为首页推荐
//       },
//     })

//     const rawList = response.data.list || []

//     // 格式化数据以适配你的前端
//     const formatData = rawList.map((item) => ({
//       id: item.vod_id,
//       title: item.vod_name,
//       type: item.type_name, // 比如 "动作片"
//       poster: item.vod_pic, // 资源站直接给图片URL
//       backdrop: item.vod_pic, // 使用海报作为背景图
//       remarks: item.vod_remarks, // 比如 "更新至08集"
//       date: item.vod_time,
//       rating: item.vod_score || "N/A",
//     }))

//     // 简单模拟一下分类 (资源站返回是混杂的)
//     const result = {
//       banners: formatData.slice(0, 5),
//       latest: formatData,
//     }

//     cache.set(cacheKey, result)
//     success(res, result)
//   } catch (error) {
//     console.error("Home Error:", error.message)
//     fail(res, "获取红牛资源失败")
//   }
// })

/**
 * [搜索功能]
 * 参数: wd (word)
 */
app.get("/api/search", async (req, res) => {
  const { q } = req.query
  if (!q) return fail(res, "缺少搜索关键字", 400)

  try {
    const response = await apiClient.get("", {
      params: {
        ac: "detail", // 必须用 detail 才有图片
        at: "json",
        wd: q, // 红牛搜索参数是 wd
      },
    })

    const list = (response.data.list || []).map((item) => ({
      id: item.vod_id,
      title: item.vod_name,
      type: item.type_name,
      poster: item.vod_pic,
      remarks: item.vod_remarks,
      overview: stripHtml(item.vod_content).substring(0, 50) + "...",
      date: item.vod_time,
      rating: item.vod_score || "N/A",
    }))

    success(res, list)
  } catch (error) {
    console.error("Search Error:", error.message)
    fail(res, "搜索失败")
  }
})

/**
 * [详情页 & 播放源]
 * 资源站直接返回所有数据，不需要像TMDB那样请求3次
 */
app.get("/api/detail/:id", async (req, res) => {
  // 注意：前端路由可能需要改，现在不需要 :type 了，只要 id
  const { id } = req.params
  const cacheKey = `detail_${id}`

  if (cache.has(cacheKey)) return success(res, cache.get(cacheKey))

  try {
    const response = await apiClient.get("", {
      params: {
        ac: "detail",
        at: "json",
        ids: id, // 红牛详情参数是 ids
      },
    })

    if (!response.data.list || response.data.list.length === 0) {
      return fail(res, "资源未找到", 404)
    }

    const detail = response.data.list[0]

    // 处理播放列表
    // 红牛可能有多个播放源，比如 "hnm3u8" 和 "hntv"
    // vod_play_from: "hnm3u8$$$hntv"
    // vod_play_url: "集数$链接#...$$$集数$链接..."

    // 这里做个简单的处理，默认取第一个或者取 m3u8 结尾的
    const playFromArr = (detail.vod_play_from || "").split("$$$")
    const playUrlArr = (detail.vod_play_url || "").split("$$$")

    let selectedPlayUrl = playUrlArr[0] || "" // 默认取第一个源

    // 尝试寻找 m3u8 的源 (通常体验最好)
    const m3u8Index = playFromArr.findIndex(
      (from) => from && from.includes("m3u8")
    )
    if (m3u8Index !== -1 && playUrlArr[m3u8Index]) {
      selectedPlayUrl = playUrlArr[m3u8Index]
    }

    const data = {
      id: detail.vod_id,
      title: detail.vod_name,
      overview: stripHtml(detail.vod_content), // 清洗 HTML
      poster: detail.vod_pic,
      backdrop: detail.vod_pic, // 资源站通常没有专门的 backdrop，用海报代替
      genres: detail.type_name ? [detail.type_name] : [], // 只有单一分类
      rating: detail.vod_score || "N/A", // 资源站评分通常不准
      area: detail.vod_area,
      year: detail.vod_year,
      director: detail.vod_director,
      actors: detail.vod_actor,
      date: detail.vod_time,
      remarks: detail.vod_remarks,
      // 核心：播放列表
      episodes: parsePlayUrl(selectedPlayUrl),
    }

    cache.set(cacheKey, data)
    success(res, data)
  } catch (error) {
    console.error("Detail Error:", error.message)
    fail(res, "获取详情失败")
  }
})

// ==========================================
// 4. 图片代理 (可选)
// ==========================================
// 资源站图片通常是 http 的，如果你网站是 https，需要这个代理来避免 Mixed Content 错误
app.get("/api/image/proxy", async (req, res) => {
  const { url } = req.query
  if (!url) return res.status(404).send("Missing URL")

  try {
    const response = await axios({
      method: "get",
      url: url, // 直接请求完整 URL
      responseType: "stream",
      timeout: 5000,
      // 资源站图片可能也需要代理，或者不需要，视情况而定
      httpsAgent: agent,
      proxy: false,
    })
    res.set("Cache-Control", "public, max-age=31536000")
    response.data.pipe(res)
  } catch (error) {
    res.status(404).send("Image Error")
  }
})

// 缓存分类表，避免每次都请求
let CATEGORY_CACHE = null

/**
 * [辅助] 获取并处理分类表
 */
const getCategories = async () => {
  if (CATEGORY_CACHE) return CATEGORY_CACHE
  try {
    // 请求一次列表，拿 class 字段
    const res = await apiClient.get("", { params: { ac: "list", at: "json" } })
    if (res.data && res.data.class) {
      CATEGORY_CACHE = res.data.class // 保存分类列表
      return CATEGORY_CACHE
    }
  } catch (e) {
    console.error("获取分类失败", e)
  }
  return []
}

/**
 * [API] 获取所有分类
 * 前端用这个来生成“电影、电视剧、动作片”等菜单
 */
app.get("/api/categories", async (req, res) => {
  const list = await getCategories()
  success(res, list)
})

/**
 * [API] 通用视频列表 (支持分页、分类、搜索)
 * 用于“更多”页面和首页的各个板块
 */
app.get("/api/videos", async (req, res) => {
  const { t, pg, wd, h } = req.query // t=分类ID, pg=页码, wd=关键词, h=时间(小时)

  try {
    const params = {
      ac: "detail", // 用 detail 拿海报
      at: "json",
      pg: pg || 1,
    }
    if (t) params.t = t
    if (wd) params.wd = wd
    if (h) params.h = h

    const response = await apiClient.get("", { params })

    const list = (response.data.list || []).map((item) => ({
      id: item.vod_id,
      title: item.vod_name,
      type: item.type_name,
      poster: item.vod_pic, // 如果有图片代理，这里记得套上 getImageUrl
      remarks: item.vod_remarks,
      year: item.vod_year,
      area: item.vod_area,
      // 评分通常 CMS 里是 vod_score，如果没有就随机模拟一个或者显示 N/A
      rating: item.vod_score || "N/A",
    }))

    success(res, {
      list,
      total: response.data.total,
      page: response.data.page,
      pagecount: response.data.pagecount,
    })
  } catch (error) {
    console.error(error)
    fail(res, "获取列表失败")
  }
})

/**
 * [API] 首页聚合数据 (重构版)
 * 一次性拉取：轮播图、电影榜、剧集榜、动漫榜
 */
app.get("/api/home/trending", async (req, res) => {
  const cacheKey = "home_dashboard_v2"
  if (cache.has(cacheKey)) return success(res, cache.get(cacheKey))

  try {
    // 并发请求不同类型的数据
    // 注意：这里的 t=1, t=2 需要你先访问 /api/categories 确认 ID。
    // 通常：1=电影, 2=电视剧, 3=综艺, 4=动漫 (这只是假设，红牛的具体ID需要确认)
    // 为了稳妥，我们先请求“最新更新”作为轮播，然后请求具体分类

    const [latestRes, movieRes, tvRes, animeRes] = await Promise.all([
      // 1. 轮播图：取最近更新的 5 个
      apiClient.get("", { params: { ac: "detail", at: "json", pg: 1 } }),
      // 2. 电影板块 (假设 ID 1 是电影，如果不是，前端展示会乱，但不报错)
      apiClient.get("", { params: { ac: "detail", at: "json", t: 1, pg: 1 } }),
      // 3. 电视剧板块 (假设 ID 2 是电视剧)
      apiClient.get("", { params: { ac: "detail", at: "json", t: 2, pg: 1 } }),
      // 4. 动漫板块 (假设 ID 4 是动漫)
      apiClient.get("", { params: { ac: "detail", at: "json", t: 4, pg: 1 } }),
    ])

    const format = (list) =>
      (list || []).slice(0, 8).map((item) => ({
        id: item.vod_id,
        title: item.vod_name,
        type: item.type_name,
        poster: item.vod_pic,
        remarks: item.vod_remarks,
        rating: item.vod_score,
      }))

    const data = {
      banners: format(latestRes.data.list).slice(0, 5),
      movies: format(movieRes.data.list),
      tvs: format(tvRes.data.list),
      animes: format(animeRes.data.list),
    }

    cache.set(cacheKey, data, 600) // 缓存 10 分钟
    success(res, data)
  } catch (error) {
    console.error(error)
    fail(res, "首页数据获取失败")
  }
})

// 启动服务
app.listen(PORT, () => {
  console.log(`\n🚀 红牛资源 API 服务已启动: http://localhost:${PORT}`)
  console.log(`- 首页列表: http://localhost:${PORT}/api/home/trending`)
  console.log(`- 搜索测试: http://localhost:${PORT}/api/search?q=周星驰`)
  console.log(
    `- 详情测试: http://localhost:${PORT}/api/detail/1234 (ID需自行替换)`
  )
})
