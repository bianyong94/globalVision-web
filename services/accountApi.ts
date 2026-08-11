import type {
  AccountTokens,
  AccountUser,
  PlaybackHistoryInput,
  PlaybackHistoryItem,
} from "../types"

const ACCOUNT_API_BASE_URL = (
  import.meta.env.VITE_ACCOUNT_API_BASE_URL || "/account-api/api/v1"
).replace(/\/$/, "")

const SESSION_STORAGE_KEY = "globalvision.account.session.v1"
const DEVICE_STORAGE_KEY = "globalvision.account.device.v1"
const SESSION_CHANGED_EVENT = "globalvision:account-session-changed"
export const LEGACY_HISTORY_STORAGE_KEY = "vastren.playHistory"

interface AccountSession {
  user: AccountUser
  tokens: AccountTokens
}

interface AuthResponse {
  user: AccountUser
  tokens: AccountTokens
}

interface HistoryPage {
  items: PlaybackHistoryItem[]
  nextCursor?: string
}

interface ApiErrorBody {
  error?: {
    code?: string
    message?: string
  }
}

export class AccountApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = "AccountApiError"
  }
}

const readSession = (): AccountSession | null => {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<AccountSession>
    if (
      !value.user?.id ||
      !value.tokens?.accessToken ||
      !value.tokens?.refreshToken
    ) {
      return null
    }
    return value as AccountSession
  } catch {
    return null
  }
}

const emitSessionChanged = () => {
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT))
}

const saveSession = (response: AuthResponse) => {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(response))
  emitSessionChanged()
}

export const clearAccountSession = () => {
  localStorage.removeItem(SESSION_STORAGE_KEY)
  emitSessionChanged()
}

export const getStoredAccountUser = () => readSession()?.user ?? null

const parseError = async (response: Response) => {
  const body = (await response.json().catch(() => ({}))) as ApiErrorBody
  return new AccountApiError(
    response.status,
    body.error?.code || "account_request_failed",
    body.error?.message || `account request failed (${response.status})`,
  )
}

const jsonHeaders = (body?: BodyInit | null) => {
  const headers = new Headers()
  headers.set("Accept", "application/json")
  if (body != null) headers.set("Content-Type", "application/json")
  return headers
}

const publicRequest = async <T>(
  path: string,
  init: RequestInit,
): Promise<T> => {
  const response = await fetch(`${ACCOUNT_API_BASE_URL}${path}`, {
    ...init,
    headers: jsonHeaders(init.body),
    cache: "no-store",
  })
  if (!response.ok) throw await parseError(response)
  return (await response.json()) as T
}

let refreshPromise: Promise<boolean> | null = null

const rotateRefreshToken = async (failedAccessToken: string) => {
  const session = readSession()
  if (!session) return false
  if (session.tokens.accessToken !== failedAccessToken) return true

  const response = await fetch(`${ACCOUNT_API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: jsonHeaders("{}"),
    body: JSON.stringify({ refreshToken: session.tokens.refreshToken }),
    cache: "no-store",
  })

  if (!response.ok) {
    const error = await parseError(response)
    if ([400, 401, 403].includes(response.status)) clearAccountSession()
    throw error
  }

  const refreshed = (await response.json()) as AuthResponse
  if (refreshed.user.id !== session.user.id) {
    clearAccountSession()
    throw new AccountApiError(401, "session_user_mismatch", "session user changed")
  }
  saveSession(refreshed)
  return true
}

const refreshSession = (failedAccessToken: string) => {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    const lockManager = (
      navigator as Navigator & {
        locks?: {
          request<T>(name: string, callback: () => Promise<T>): Promise<T>
        }
      }
    ).locks

    if (lockManager) {
      return lockManager.request("globalvision-account-token-refresh", () =>
        rotateRefreshToken(failedAccessToken),
      )
    }
    return rotateRefreshToken(failedAccessToken)
  })().finally(() => {
    refreshPromise = null
  })

  return refreshPromise
}

const authorizedRequest = async <T>(
  path: string,
  init: RequestInit = {},
  retryAfterRefresh = true,
): Promise<T> => {
  const session = readSession()
  if (!session) {
    throw new AccountApiError(401, "authentication_required", "login required")
  }

  const headers = jsonHeaders(init.body)
  headers.set("Authorization", `Bearer ${session.tokens.accessToken}`)
  const response = await fetch(`${ACCOUNT_API_BASE_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  })

  if (response.status === 401 && retryAfterRefresh) {
    const refreshed = await refreshSession(session.tokens.accessToken)
    if (!refreshed) {
      throw new AccountApiError(401, "authentication_required", "login required")
    }
    return authorizedRequest<T>(path, init, false)
  }
  if (!response.ok) {
    const error = await parseError(response)
    if (response.status === 401) clearAccountSession()
    throw error
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

const getOrCreateDeviceKey = () => {
  const existing = localStorage.getItem(DEVICE_STORAGE_KEY)
  if (existing) return existing
  const randomPart =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const deviceKey = `web:${randomPart}`
  localStorage.setItem(DEVICE_STORAGE_KEY, deviceKey)
  return deviceKey
}

const devicePayload = () => ({
  deviceKey: getOrCreateDeviceKey(),
  name: navigator.platform ? `Web · ${navigator.platform}` : "Web 浏览器",
  platform: "web",
  appVersion: "1.0",
})

const authenticate = async (
  endpoint: "login" | "register",
  phone: string,
  password: string,
  displayName = "",
) => {
  const response = await publicRequest<AuthResponse>(`/auth/${endpoint}`, {
    method: "POST",
    body: JSON.stringify({
      phone,
      password,
      ...(endpoint === "register" && displayName.trim()
        ? { displayName: displayName.trim() }
        : {}),
      device: devicePayload(),
    }),
  })
  saveSession(response)
  return response.user
}

export const loginAccount = (phone: string, password: string) =>
  authenticate("login", phone, password)

export const registerAccount = (
  phone: string,
  password: string,
  displayName?: string,
) => authenticate("register", phone, password, displayName)

export const getCurrentAccount = async () => {
  const response = await authorizedRequest<{ user: AccountUser }>("/me")
  const session = readSession()
  if (session) saveSession({ ...session, user: response.user })
  return response.user
}

export const logoutAccount = async () => {
  try {
    await authorizedRequest<void>("/auth/logout", {
      method: "POST",
      body: JSON.stringify({}),
    })
  } finally {
    clearAccountSession()
  }
}

export const fetchPlaybackHistory = async () => {
  const items: PlaybackHistoryItem[] = []
  const seenCursors = new Set<string>()
  let cursor = ""

  do {
    const query = new URLSearchParams({ limit: "100" })
    if (cursor) query.set("cursor", cursor)
    const page = await authorizedRequest<HistoryPage>(
      `/me/history?${query.toString()}`,
    )
    items.push(...(Array.isArray(page.items) ? page.items : []))
    cursor = page.nextCursor?.trim() || ""
  } while (cursor && !seenCursors.has(cursor) && seenCursors.add(cursor))

  return items
}

export const savePlaybackHistory = (
  contentId: string,
  input: PlaybackHistoryInput,
) =>
  authorizedRequest<PlaybackHistoryItem>(
    `/me/history/${encodeURIComponent(contentId)}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  )

export const removePlaybackHistory = (contentId: string) =>
  authorizedRequest<void>(`/me/history/${encodeURIComponent(contentId)}`, {
    method: "DELETE",
  })

export const clearPlaybackHistory = () =>
  authorizedRequest<void>("/me/history", { method: "DELETE" })

export const subscribeAccountSession = (listener: () => void) => {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === SESSION_STORAGE_KEY) listener()
  }
  window.addEventListener(SESSION_CHANGED_EVENT, listener)
  window.addEventListener("storage", handleStorage)
  return () => {
    window.removeEventListener(SESSION_CHANGED_EVENT, listener)
    window.removeEventListener("storage", handleStorage)
  }
}

export const getAccountErrorMessage = (error: unknown) => {
  if (!(error instanceof AccountApiError)) return "账号服务暂时不可用，请稍后再试"
  if (error.code === "registration_disabled") return "暂不开放新账号注册"
  if (error.code === "invalid_phone") return "请输入正确的中国大陆手机号"
  if (error.code === "invalid_password") return "密码需要 8 至 72 个字符"
  if (error.status === 0) return "无法连接账号服务，请检查网络"
  if (error.status === 401) return "手机号或密码不正确，或登录已失效"
  if (error.status === 403) return "账号已被停用，请联系管理员"
  if (error.status === 409) return "该手机号已注册，请直接登录"
  if (error.status === 429) return "尝试次数过多，请稍后再试"
  return "账号服务暂时不可用，请稍后再试"
}
