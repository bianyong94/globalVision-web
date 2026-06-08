import forge from "node-forge"
import {
  AppConfig,
  AppTopNav,
  HomeDataV2,
  HomeSectionItem,
  MovieBannerItem,
  MovieCommentItem,
  MovieDetailItem,
  MovieEpisodeItem,
  MovieListItem,
  MoviePlaySourceItem,
  SearchAutocompleteItem,
  SearchLatelyWord,
  SearchMoviesResult,
  SearchRankingItem,
  VideoDetail,
  VideoSource,
  HomeData,
  SearchResult,
  Category,
  VideoSummary,
  AiCandidate,
  User,
  AuthResponse,
} from "../types"

const API_BASE_URL = "https://dbe6vejb.qlpru.cn/api/v1"
const PUBLIC_KEY =
  "-----BEGIN RSA PUBLIC KEY-----MIIBCgKCAQEA02F/kPg5A2NX4qZ5JSns+bjhVMCC6JbTiTKpbgNgiXU+Kkorg6Dj76gS68gB8llhbUKCXjIdygnHPrxVHWfzmzisq9P9awmXBkCk74Skglx2LKHa/mNz9ivg6YzQ5pQFUEWS0DfomGBXVtqvBlOXMCRxp69oWaMsnfjnBV+0J7vHbXzUIkqBLdXSNfM9Ag5qdRDrJC3CqB65EJ3ARWVzZTTcXSdMW9i3qzEZPawPNPe5yPYbMZIoXLcrqvEZnRK1oak67/ihf7iwPJqdc+68ZYEmmdqwunOvRdjq89fQMVelmqcRD9RYe08v+xDxG9Co9z7hcXGTsUquMxkh29uNawIDAQAB-----END RSA PUBLIC KEY-----"
const SIGN_KEY = "635a580fcb5dc6e60caa39c31a7bde48"
const AES_KEY = "e6d5de5fcc51f53d"
const AES_IV = "2f13eef7dfc6c613"

const DEFAULT_HEADERS = {
  "Accept-Language": "en",
  "X-Client-Version": "3100",
  "X-Client-Setting": JSON.stringify({ "pure-mode": 0 }),
  "Content-Type": "application/json",
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const toBytes = (value: string) => encoder.encode(value)

const fromBytes = (value: Uint8Array) => decoder.decode(value)

const concatBytes = (...chunks: Uint8Array[]) => {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }
  return merged
}

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = ""
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

const base64ToBytes = (input: string) => {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/")
  const padded = normalized.padEnd(
    Math.ceil(normalized.length / 4) * 4,
    "=",
  )
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")

const hexToBytes = (hex: string) => {
  const clean = hex.replace(/^0x/, "").trim()
  const out = new Uint8Array(Math.ceil(clean.length / 2))
  for (let i = 0; i < clean.length; i += 2) {
    out[i / 2] = Number.parseInt(clean.slice(i, i + 2).padEnd(2, "0"), 16)
  }
  return out
}

const sanitizeList = <T extends Record<string, any>>(items: T[]) =>
  (Array.isArray(items) ? items : []).filter(Boolean)

const normalizeImage = (value?: string) => {
  if (!value) return ""
  if (value.startsWith("//")) return `https:${value}`
  if (value.startsWith("http://")) return value.replace("http://", "https://")
  return value
}

const appendTimestamp = (payload: Record<string, any>) => ({
  ...payload,
  timestamp: Date.now(),
})

const parseDerLength = (bytes: Uint8Array, offset: number) => {
  let length = bytes[offset]
  offset += 1

  if (length < 0x80) {
    return { length, offset }
  }

  const octets = length & 0x7f
  length = 0
  for (let i = 0; i < octets; i += 1) {
    length = (length << 8) | bytes[offset]
    offset += 1
  }

  return { length, offset }
}

const parseRsaPublicKey = (() => {
  let cached:
    | {
        modulus: bigint
        exponent: bigint
        byteLength: number
      }
    | undefined

  return () => {
    if (cached) return cached

    const pemBody = PUBLIC_KEY.replace(/-----BEGIN RSA PUBLIC KEY-----/g, "")
      .replace(/-----END RSA PUBLIC KEY-----/g, "")
      .replace(/\s+/g, "")
    const der = base64ToBytes(pemBody)

    let offset = 0
    if (der[offset] !== 0x30) {
      throw new Error("Invalid RSA public key")
    }
    offset += 1
    ;({ offset } = parseDerLength(der, offset))

    if (der[offset] !== 0x02) {
      throw new Error("Invalid RSA public key modulus")
    }
    offset += 1
    let result = parseDerLength(der, offset)
    let modulusBytes = der.slice(result.offset, result.offset + result.length)
    if (modulusBytes[0] === 0x00) {
      modulusBytes = modulusBytes.slice(1)
    }
    offset = result.offset + result.length

    if (der[offset] !== 0x02) {
      throw new Error("Invalid RSA public key exponent")
    }
    offset += 1
    result = parseDerLength(der, offset)
    const exponentBytes = der.slice(result.offset, result.offset + result.length)

    const modulus = BigInt(`0x${bytesToHex(modulusBytes)}`)
    const exponent = BigInt(`0x${bytesToHex(exponentBytes)}`)
    const byteLength = modulusBytes.length

    cached = { modulus, exponent, byteLength }
    return cached
  }
})()

const modPow = (base: bigint, exponent: bigint, modulus: bigint) => {
  let result = 1n
  let power = base % modulus
  let exp = exponent

  while (exp > 0n) {
    if (exp & 1n) {
      result = (result * power) % modulus
    }
    exp >>= 1n
    power = (power * power) % modulus
  }

  return result
}

const bigIntToBytes = (value: bigint, length: number) => {
  const hex = value.toString(16).padStart(length * 2, "0")
  const bytes = hexToBytes(hex)
  if (bytes.length === length) return bytes
  if (bytes.length > length) return bytes.slice(bytes.length - length)
  const out = new Uint8Array(length)
  out.set(bytes, length - bytes.length)
  return out
}

const randomNonZeroBytes = (length: number) => {
  const bytes = new Uint8Array(length)
  let index = 0
  while (index < length) {
    const chunk = new Uint8Array(length - index)
    crypto.getRandomValues(chunk)
    for (let i = 0; i < chunk.length && index < length; i += 1) {
      if (chunk[i] !== 0) {
        bytes[index] = chunk[i]
        index += 1
      }
    }
  }
  return bytes
}

const rsaEncryptPkcs1 = (message: string) => {
  const { modulus, exponent, byteLength } = parseRsaPublicKey()
  const messageBytes = toBytes(message)
  const maxChunkLength = byteLength - 11
  const chunks: Uint8Array[] = []

  for (let offset = 0; offset < messageBytes.length; offset += maxChunkLength) {
    const slice = messageBytes.slice(offset, offset + maxChunkLength)
    const paddingLength = byteLength - slice.length - 3
    if (paddingLength < 8) {
      throw new Error("RSA message too long")
    }

    const encoded = concatBytes(
      Uint8Array.of(0x00, 0x02),
      randomNonZeroBytes(paddingLength),
      Uint8Array.of(0x00),
      slice,
    )
    const cipher = modPow(BigInt(`0x${bytesToHex(encoded)}`), exponent, modulus)
    chunks.push(bigIntToBytes(cipher, byteLength))
  }

  return bytesToBase64(concatBytes(...chunks))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

const md5Shift = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
]

const md5Constants = Array.from({ length: 64 }, (_, i) =>
  Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0,
)

const leftRotate = (value: number, shift: number) =>
  ((value << shift) | (value >>> (32 - shift))) >>> 0

const md5Bytes = (input: Uint8Array) => {
  const originalLength = input.length
  const bitLength = originalLength * 8
  const paddedLength = ((originalLength + 9 + 63) >> 6) << 6
  const buffer = new Uint8Array(paddedLength)
  buffer.set(input)
  buffer[originalLength] = 0x80
  const view = new DataView(buffer.buffer)
  view.setUint32(paddedLength - 8, bitLength >>> 0, true)
  view.setUint32(paddedLength - 4, Math.floor(bitLength / 2 ** 32), true)

  let a0 = 0x67452301
  let b0 = 0xefcdab89
  let c0 = 0x98badcfe
  let d0 = 0x10325476

  for (let offset = 0; offset < buffer.length; offset += 64) {
    const words = new Uint32Array(16)
    for (let i = 0; i < 16; i += 1) {
      words[i] = view.getUint32(offset + i * 4, true)
    }

    let a = a0
    let b = b0
    let c = c0
    let d = d0

    for (let i = 0; i < 64; i += 1) {
      let f = 0
      let g = 0

      if (i < 16) {
        f = (b & c) | (~b & d)
        g = i
      } else if (i < 32) {
        f = (d & b) | (~d & c)
        g = (5 * i + 1) % 16
      } else if (i < 48) {
        f = b ^ c ^ d
        g = (3 * i + 5) % 16
      } else {
        f = c ^ (b | ~d)
        g = (7 * i) % 16
      }

      const temp = d
      d = c
      c = b
      const sum = (a + f + md5Constants[i] + words[g]) >>> 0
      b = (b + leftRotate(sum, md5Shift[i])) >>> 0
      a = temp
    }

    a0 = (a0 + a) >>> 0
    b0 = (b0 + b) >>> 0
    c0 = (c0 + c) >>> 0
    d0 = (d0 + d) >>> 0
  }

  const out = new Uint8Array(16)
  const outView = new DataView(out.buffer)
  outView.setUint32(0, a0, true)
  outView.setUint32(4, b0, true)
  outView.setUint32(8, c0, true)
  outView.setUint32(12, d0, true)
  return out
}

const hmacMd5 = (message: string, key: string) => {
  const hmac = forge.hmac.create()
  hmac.start("md5", key)
  hmac.update(message, "utf8")
  return hmac.digest().toHex()
}

const forgePublicKey = forge.pki.publicKeyFromPem(PUBLIC_KEY)

const toUrlSafeBase64 = (value: string) =>
  forge.util
    .encode64(value)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")

const encryptWithPublicKey = (message: string) => {
  const binaryMessage = forge.util.encodeUtf8(message)
  const maxChunkSize = Math.floor(forgePublicKey.n.bitLength() / 8) - 11

  if (maxChunkSize <= 0) {
    throw new Error("Invalid RSA key")
  }

  const encryptedChunks: string[] = []
  for (let index = 0; index < binaryMessage.length; index += maxChunkSize) {
    const chunk = binaryMessage.slice(index, index + maxChunkSize)
    encryptedChunks.push(
      forgePublicKey.encrypt(chunk, "RSAES-PKCS1-V1_5"),
    )
  }

  return toUrlSafeBase64(encryptedChunks.join(""))
}

const signPack = (pack: string) => hmacMd5(pack, SIGN_KEY)

const buildSignedPayload = (payload: Record<string, any>) => {
  const pack = encryptWithPublicKey(JSON.stringify(appendTimestamp(payload)))
  return { pack, signature: signPack(pack) }
}

const decryptResponseText = async (response: Response) => {
  const rawText = await response.text()
  const trimmed = rawText.trim()

  if (!trimmed) return null

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed)
    } catch {
      // fall through to encrypted path
    }
  }

  const encryptedText = trimmed.replace(/^"|"$/g, "")

  try {
    const decipher = forge.cipher.createDecipher(
      "AES-CBC",
      forge.util.createBuffer(AES_KEY),
    )
    decipher.start({
      iv: forge.util.createBuffer(AES_IV),
    })
    decipher.update(
      forge.util.createBuffer(
        forge.util.decode64(encryptedText.replace(/-/g, "+").replace(/_/g, "/")),
      ),
    )
    if (!decipher.finish()) {
      throw new Error("Decrypt failed")
    }
    return JSON.parse(decipher.output.toString(forge.util.Utf8))
  } catch {
    try {
      return JSON.parse(trimmed)
    } catch {
      return trimmed
    }
  }
}

const request = async <T>(
  path: string,
  options: {
    method?: "GET" | "POST"
    params?: Record<string, any>
    body?: Record<string, any>
    headers?: Record<string, string>
  } = {},
): Promise<T> => {
  const method = options.method ?? "GET"
  const url = new URL(path, API_BASE_URL)
  const mergedParams: Record<string, any> = {}

  for (const [key, value] of url.searchParams.entries()) {
    mergedParams[key] = value
  }
  for (const [key, value] of Object.entries(options.params || {})) {
    if (value !== undefined && value !== null && value !== "") {
      mergedParams[key] = value
    }
  }

  const headers = {
    ...DEFAULT_HEADERS,
    ...options.headers,
  }

  let response: Response
  if (method === "GET") {
    const signedParams: Record<string, any> = { timestamp: Date.now() }
    for (const [key, value] of Object.entries(mergedParams)) {
      const stringValue = String(value)
      signedParams[key] = isNaN(Number(stringValue)) ? stringValue : Number(stringValue)
    }
    const pack = encryptWithPublicKey(JSON.stringify(signedParams))
    const signedUrl = `${url.pathname}?pack=${encodeURIComponent(pack)}&signature=${encodeURIComponent(signPack(pack))}`
    response = await fetch(`${API_BASE_URL}${signedUrl}`, {
      method,
      headers,
    })
  } else {
    const signedBody = buildSignedPayload(options.body || mergedParams)
    response = await fetch(`${API_BASE_URL}${url.pathname}`, {
      method,
      headers,
      body: JSON.stringify(signedBody),
    })
  }

  const parsed = await decryptResponseText(response)
  if (!response.ok) {
    const message =
      (parsed as any)?.msg ||
      (parsed as any)?.message ||
      (parsed as any)?.error ||
      `请求失败 (${response.status})`
    throw new Error(message)
  }

  return parsed as T
}

const mapBanner = (item: any): MovieBannerItem | null => {
  const title = String(item?.title || item?.name || "").trim()
  const cover = normalizeImage(item?.image || item?.cover || item?.poster)
  const click = String(item?.click || item?.id || "").trim()
  if (Number(item?.type || 0) === 3) return null
  if (/^https?:\/\//i.test(click)) return null
  if (!title && !cover) return null

  return {
    id: String(item?.id || item?.click || title),
    title,
    cover,
    image: cover,
    backdrop: normalizeImage(item?.backdrop),
    click,
    type: Number(item?.type || 0),
    dynamic: item?.dynamic,
    year: item?.year,
    label: item?.label,
    content: item?.content,
    safe: true,
  }
}

const mapListItem = (item: any): MovieListItem | null => {
  const name = String(item?.name || item?.title || "").trim()
  const cover = normalizeImage(item?.cover || item?.poster || item?.image)
  if (!name && !cover) return null

  return {
    id: String(item?.id || item?.click || name),
    name,
    cover,
    year: item?.year ? String(item.year) : undefined,
    dynamic: item?.dynamic,
    type_name: item?.type_name,
    collect_count:
      item?.collect_count != null ? Number(item.collect_count) : undefined,
    label: item?.label,
    highlight: item?.highlight,
    score: item?.score != null ? String(item.score) : undefined,
    remarks: item?.remarks,
    members: Array.isArray(item?.members)
      ? item.members.map((member: any) => ({
          member_id: Number(member.member_id || member.id || 0),
          name: String(member.name || ""),
          type: Number(member.type || 0),
        }))
      : undefined,
    safe: true,
    click: String(item?.click || item?.id || ""),
  }
}

const mapComment = (item: any): MovieCommentItem | null => {
  const content = String(item?.content || "").trim()
  if (!content) return null
  return {
    id: Number(item?.id || 0),
    movie_id: String(item?.movie_id || ""),
    content,
    likes: item?.likes != null ? Number(item.likes) : undefined,
    user: item?.user
      ? {
          id: Number(item.user.id || 0),
          nickname: String(item.user.nickname || ""),
          avatar: normalizeImage(item.user.avatar),
      }
      : undefined,
    safe: true,
  }
}

const mapEpisodes = (source: any): MovieEpisodeItem[] =>
  sanitizeList(Array.isArray(source?.list) ? source.list : []).map((item) => ({
    episode_id: Number(item?.episode_id || 0),
    episode_name: String(item?.episode_name || item?.name || ""),
    play_url: String(item?.play_url || ""),
    from_code: String(item?.from_code || source?.code || ""),
    ready_to_play: Boolean(item?.ready_to_play),
    parseUrl: item?.parseUrl ? String(item.parseUrl) : undefined,
  }))

const mapDetail = (item: any): MovieDetailItem | null => {
  const name = String(item?.name || item?.title || "").trim()
  const cover = normalizeImage(item?.cover || item?.poster)
  if (!name && !cover) return null

  const playFrom = sanitizeList(Array.isArray(item?.play_from) ? item.play_from : [])
    .map((source): MoviePlaySourceItem => ({
      code: String(source?.code || ""),
      name: String(source?.name || ""),
      list: mapEpisodes(source),
    }))
    .filter((source) => source.code && source.name)

  return {
    id: String(item?.id || ""),
    name,
    type_id: item?.type_id != null ? Number(item.type_id) : undefined,
    type_name: item?.type_name,
    score: item?.score != null ? String(item.score) : undefined,
    cover,
    year: item?.year ? String(item.year) : undefined,
    area: item?.area,
    director: item?.director,
    writer: item?.writer,
    actor: item?.actor,
    content: item?.content,
    remarks: item?.remarks,
    play_from: playFrom,
    safe: true,
  }
}

const normalizeConfig = (payload: any): AppConfig => ({
  index_top_nav: Array.isArray(payload?.index_top_nav)
    ? payload.index_top_nav.map((item: any) => ({
        id: Number(item?.id || 0),
        name: String(item?.name || ""),
      }))
    : [],
  movie_screen: {
    filter: Array.isArray(payload?.movie_screen?.filter)
      ? payload.movie_screen.filter.map((item: any) => ({
          id: Number(item?.id || 0),
          name: String(item?.name || ""),
          class: Array.isArray(item?.class) ? item.class.map(String) : [],
          area: Array.isArray(item?.area) ? item.area.map(String) : [],
          year: Array.isArray(item?.year) ? item.year.map(String) : [],
          sort: Array.isArray(item?.sort) ? item.sort.map(String) : undefined,
        }))
      : [],
  },
})

const normalizeHome = async (
  config: AppConfig | null,
  recommendPayload: any,
  includeTopicSections = false,
): Promise<HomeDataV2> => {
  const banners: MovieBannerItem[] = []
  const sections: HomeSectionItem[] = []

  const payload = Array.isArray(recommendPayload?.data)
    ? recommendPayload.data
    : Array.isArray(recommendPayload)
      ? recommendPayload
      : []

  for (const group of payload) {
    const layout = String(group?.layout || group?.type || "")
    const list = sanitizeList(Array.isArray(group?.list) ? group.list : [])

    const mappedItems = list
      .map(mapListItem)
      .filter(Boolean) as MovieListItem[]

    if (layout.includes("carousel")) {
      for (const item of list) {
        const banner = mapBanner(item)
        if (banner) banners.push(banner)
      }
      continue
    }

    if (mappedItems.length > 0) {
      sections.push({
        title:
          String(group?.title || group?.name || layout || "推荐").replace(
            /^index_recommend_/,
            "",
          ) || "推荐",
        items: mappedItems,
        layout,
      })
    }
  }

  const topicSections: { id: number; name: string; items: MovieListItem[] }[] =
    []

  if (includeTopicSections && config?.index_top_nav?.length) {
    const topicNav = config.index_top_nav.filter((item) => item.id > 0)
    const responses = await Promise.allSettled(
      topicNav.slice(0, 2).map((topic) =>
        request<any>(`/movie/${topic.id}/recommend`).then((res) => ({
          topic,
          res,
        })),
      ),
    )

    for (const result of responses) {
      if (result.status !== "fulfilled") continue
      const { topic, res } = result.value
      const list = sanitizeList(Array.isArray(res?.data?.list) ? res.data.list : [])
      const items = list.map(mapListItem).filter(Boolean) as MovieListItem[]
      if (items.length) {
        topicSections.push({ id: topic.id, name: topic.name, items })
      }
    }
  }

  return {
    config,
    banners,
    sections,
    topicSections,
  }
}

export const fetchAppConfig = async (): Promise<AppConfig> => {
  const response = await request<any>(`/app/config`)
  return normalizeConfig(response?.data || response)
}

export const fetchHomeData = async (): Promise<HomeData> => {
  const config = await fetchAppConfig().catch(() => null)
  const recommendPayload = await request<any>(`/movie/index_recommend`)
  const normalized = await normalizeHome(config, recommendPayload, false)

  return {
    banners: normalized.banners.map((item) => ({
      id: item.id,
      title: item.title,
      poster: item.cover,
      backdrop: item.backdrop,
      remarks: item.dynamic || item.label || "",
      year: item.year,
      rating: Number(item.score || 0),
      category: item.type_name || "",
      tags: item.label ? [item.label] : [],
      overview: item.highlight || item.dynamic || "",
      source_ref: item.click || "",
    })),
    sections: normalized.sections.map((section) => ({
      title: section.title,
      type: "scroll",
      data: section.items.map((item) => ({
        id: item.id,
        title: item.name,
        poster: item.cover,
        backdrop: "",
        remarks: item.dynamic || item.label || "",
        year: item.year,
        rating: Number(item.score || 0),
        category: item.type_name || "",
        tags: item.label ? [item.label] : [],
        overview: item.highlight || item.dynamic || "",
        source_ref: item.click || "",
      })),
    })),
  } as HomeData
}

export const fetchTopTopicSections = async () => {
  const config = await fetchAppConfig().catch(() => null)
  const normalized = await normalizeHome(
    config,
    await request<any>(`/movie/index_recommend`),
    true,
  )
  return normalized.topicSections
}

export const fetchTopicRecommend = async (topicId: number): Promise<MovieListItem[]> => {
  const response = await request<any>(`/movie/${topicId}/recommend`)
  const list = sanitizeList(Array.isArray(response?.data?.list) ? response.data.list : [])
  return list.map(mapListItem).filter(Boolean) as MovieListItem[]
}

export const fetchScreenMovies = async (params: {
  type_id: number
  sort?: string
  class?: string
  area?: string
  year?: string
  pageSize?: number
  page?: number
}): Promise<SearchMoviesResult> => {
  const response = await request<any>(`/movie/screen/list`, { params })
  const list = sanitizeList(Array.isArray(response?.data?.list) ? response.data.list : [])
  const items = list.map(mapListItem).filter(Boolean) as MovieListItem[]
  return {
    list: items,
    total: Number(response?.data?.total || items.length || 0),
    pagecount: Number(response?.data?.pagecount || 1),
  }
}

export const fetchSearchAutocomplete = async (
  keyword: string,
): Promise<SearchAutocompleteItem[]> => {
  const response = await request<any>(`/movie/search_complete`, {
    params: { keyword },
  })
  const list = sanitizeList(Array.isArray(response?.data) ? response.data : [])
  return list.map((item: any) => ({
    name: String(item?.word || item?.name || ""),
    word: item?.word != null ? String(item.word) : undefined,
    dynamic: item?.dynamic,
    highlight: item?.highlight,
    safe: true,
  }))
}

export const fetchSearchRanking = async (): Promise<SearchRankingItem[]> => {
  const response = await request<any>(`/movie/search_ranking`)
  const groups = sanitizeList(Array.isArray(response?.data) ? response.data : [])
  const firstGroup = groups.find((item: any) => Array.isArray(item?.list)) || groups[0]
  const list = sanitizeList(Array.isArray(firstGroup?.list) ? firstGroup.list : [])
  return list.map((item: any) => ({
    name: String(item?.word || item?.name || ""),
    word: item?.word != null ? String(item.word) : undefined,
    hot: item?.hot != null ? Number(item.hot) : undefined,
    safe: true,
  }))
}

export const fetchSearchLatelyWords = async (): Promise<SearchLatelyWord[]> => {
  const response = await request<any>(`/movie/search_lately_words`)
  const list = sanitizeList(Array.isArray(response?.data) ? response.data : [])
  return list.map((item: any) => ({
    name: String(item?.word || item?.name || ""),
    word: item?.word != null ? String(item.word) : undefined,
    safe: true,
  }))
}

export const fetchSearchResults = async (params: {
  keyword: string
  page?: number
  sort?: string
  type_id?: number
  res_type?: "by_movie_name" | "by_member_name" | "by_actor_name"
}): Promise<SearchMoviesResult> => {
  const response = await request<any>(`/movie/search`, { params })
  const list = sanitizeList(Array.isArray(response?.data?.list) ? response.data.list : [])
  const items = list.map(mapListItem).filter(Boolean) as MovieListItem[]
  return {
    list: items,
    total: Number(response?.data?.total || items.length || 0),
    pagecount: Number(response?.data?.pagecount || 1),
  }
}

export const fetchMovieDetail = async (id: string | number): Promise<MovieDetailItem> => {
  const response = await request<any>(`/movie/detail`, { params: { id } })
  const detail = mapDetail(response?.data)
  if (!detail) {
    throw new Error("影片详情不可用")
  }
  return detail
}

export const fetchMovieEpisodes = async (
  movieId: string,
  fromCode: string,
): Promise<MovieEpisodeItem[]> => {
  const response = await request<any>(`/movie_addr/list`, {
    params: { movie_id: movieId, from_code: fromCode },
  })
  const list = sanitizeList(Array.isArray(response?.data) ? response.data : [])
  return list.map((item: any) => ({
    episode_id: Number(item?.episode_id || 0),
    episode_name: String(item?.episode_name || item?.name || ""),
    play_url: String(item?.play_url || ""),
    from_code: String(item?.from_code || fromCode),
    ready_to_play: Boolean(item?.ready_to_play),
    parseUrl: item?.parseUrl ? String(item.parseUrl) : undefined,
  }))
}

export const parseMovieEpisodeUrl = async (payload: {
  episode_id: number
  from_code: string
  play_url: string
  refresh?: number
}) => {
  const method = "GET"
  const path = `/movie_addr/parse_url`
  const url = new URL(path, API_BASE_URL)
  const signedParams = {
    timestamp: Date.now(),
    type: "play",
    episode_id: payload.episode_id,
    from_code: payload.from_code,
    play_url: payload.play_url,
    refresh: payload.refresh ?? 1,
  }
  const pack = encryptWithPublicKey(JSON.stringify(signedParams))
  const signedUrl = `${url.pathname}?pack=${encodeURIComponent(pack)}&signature=${encodeURIComponent(signPack(pack))}`
  const response = await fetch(`${API_BASE_URL}${signedUrl}`, {
    method,
    headers: DEFAULT_HEADERS,
  })
  const parsed = await decryptResponseText(response)
  const errorCode = Number((parsed as any)?.errorCode ?? (parsed as any)?.code ?? 0)
  const message = String(
    (parsed as any)?.msg || (parsed as any)?.message || (parsed as any)?.error || "",
  )

  if (
    !response.ok &&
    (errorCode === 1015 || message.includes("无需解析") || message.includes("无需"))
  ) {
    return {
      ...((parsed as any) || {}),
      data: {
        ...((parsed as any)?.data || {}),
        play_url: payload.play_url,
      },
    }
  }

  return parsed
}

export const fetchMovieComments = async (
  movieId: string,
  page = 1,
  pageSize = 10,
): Promise<{ total: number; page: number; pageSize: number; list: MovieCommentItem[] }> => {
  const response = await request<any>(`/movie/comments/index`, {
    params: { movie_id: movieId, page, pageSize },
  })
  const list = sanitizeList(Array.isArray(response?.data?.list) ? response.data.list : [])
  const items = list.map(mapComment).filter(Boolean) as MovieCommentItem[]
  return {
    total: Number(response?.data?.total || items.length || 0),
    page: Number(response?.data?.page || page),
    pageSize: Number(response?.data?.pageSize || pageSize),
    list: items,
  }
}

// ---------------------------------------------------------------------------
// Compatibility exports for the old project structure.
// Keep these as soft fallbacks so unused legacy files still compile.
// ---------------------------------------------------------------------------

export const fetchVideos = async (
  params: {
    pg?: number
    cat?: string
    tag?: string
    area?: string
    year?: string
    sort?: string
    wd?: string
    view?: "season"
  } = {},
): Promise<SearchResult> => {
  if (params.wd) {
    const result = await fetchSearchResults({
      keyword: params.wd,
      page: params.pg || 1,
      sort: params.sort,
      type_id: params.cat ? Number(params.cat) || 0 : 0,
      res_type: "by_movie_name",
    })
    return {
      list: result.list.map((item) => ({
        id: item.id,
        title: item.name,
        poster: item.cover,
        backdrop: "",
        remarks: item.dynamic || item.label || "",
        year: item.year,
        rating: Number(item.score || 0),
        category: item.type_name || "",
        tags: item.label ? [item.label] : [],
        overview: item.highlight || item.dynamic || "",
        source_ref: item.click || "",
      })),
      total: result.total,
      pagecount: result.pagecount,
    } as SearchResult
  }

  const result = await fetchScreenMovies({
    type_id: params.cat ? Number(params.cat) || 0 : 0,
    sort: params.sort,
    area: params.area,
    year: params.year,
    pageSize: 12,
    page: params.pg || 1,
  })
  return {
    list: result.list.map((item) => ({
      id: item.id,
      title: item.name,
      poster: item.cover,
      backdrop: "",
      remarks: item.dynamic || item.label || "",
      year: item.year,
      rating: Number(item.score || 0),
      category: item.type_name || "",
      tags: item.label ? [item.label] : [],
      overview: item.highlight || item.dynamic || "",
      source_ref: item.click || "",
    })),
    total: result.total,
    pagecount: result.pagecount,
  } as SearchResult
}

export const fetchVideoDetail = async (
  id: string | number,
): Promise<VideoDetail> => {
  const detail = await fetchMovieDetail(id)
  const playFrom = detail.play_from

  return {
    id: detail.id,
    title: detail.name,
    poster: detail.cover,
    pic: detail.cover,
    category: detail.type_name || "",
    type: detail.type_name || "",
    rating: Number(detail.score || 0),
    year: detail.year,
    area: detail.area,
    content: detail.content,
    director: detail.director || "",
    writer: detail.writer,
    actors: detail.actor || "",
    remarks: detail.remarks || "",
    episodes: [],
    available_sources: playFrom.map((source) => ({
      key: source.code,
      name: source.name,
      id: source.code,
      remarks: "",
    })),
    current_source: playFrom[0]
      ? { key: playFrom[0].code, name: playFrom[0].name }
      : undefined,
    sources: playFrom.map((source) => ({
      key: source.code,
      name: source.name,
      id: source.code,
      remarks: "",
      source_key: source.code,
      source_name: source.name,
      vod_name: source.name,
      vod_id: source.code,
      vod_play_url: source.list
        .map((episode) => `${episode.episode_name}$${episode.play_url}`)
        .join("#"),
    })),
  }
}

export const fetchCategories = async (): Promise<Category[]> => {
  const config = await fetchAppConfig().catch(() => null)
  return (config?.index_top_nav || []).map((item) => ({
    type_id: item.id,
    type_name: item.name,
  }))
}

export const fetchVideoSources = async (
  title: string,
): Promise<VideoSource[]> => {
  const result = await fetchSearchResults({
    keyword: title,
    page: 1,
    res_type: "by_movie_name",
  })
  return result.list.map((item) => ({
    key: item.id,
    name: item.name,
    id: item.id,
    source_key: item.id,
    source_name: item.type_name || item.name,
    vod_name: item.name,
    vod_id: item.id,
    remarks: item.dynamic,
    vod_play_url: "",
  }))
}

export const fetchHistory = async (_username: string): Promise<any[]> => []
export const saveHistory = async (_payload: any) => undefined
export const clearUserHistory = async (_username: string): Promise<boolean> => true
export const askAI = async (_question: string): Promise<AiCandidate[]> => []
export const login = async (username: string): Promise<User> =>
  ({ id: username, username, history: [] } as User)
export const register = async (username: string): Promise<User> =>
  ({ id: username, username, history: [] } as User)
export const ingestVideo = async (_title: string): Promise<any> => ({})
export const ingestVideoBySource = async (_payload: {
  source_key: string
  vod_id: string
}): Promise<any> => ({})
export const createDownloadTask = async (_payload: {
  url: string
  title?: string
  episode?: string
}): Promise<{
  id: string
  status: string
  progress: number
  fileName: string
  directUrl?: string
}> => ({ id: "", status: "idle", progress: 0, fileName: "" })
export const fetchDownloadTask = async (_id: string): Promise<any> => ({})
export const matchLocalResource = async (_params: {
  tmdb_id: number | string
  title: string
  category?: string
  year?: number | string
}): Promise<{
  found: boolean
  id?: string
  title?: string
  message?: string
}> => ({ found: false })
