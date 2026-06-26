const STORAGE_KEY = "vastren.searchHistory"
const MAX_ITEMS = 30

export interface SearchHistoryItem {
  word: string
  updatedAt: number
}

const normalizeWord = (value: string) => value.trim()

const sanitizeItems = (items: unknown): SearchHistoryItem[] => {
  if (!Array.isArray(items)) return []

  const seen = new Set<string>()
  const normalized: SearchHistoryItem[] = []

  for (const item of items) {
    if (!item || typeof item !== "object") continue

    const rawWord =
      "word" in item && typeof item.word === "string" ? item.word : ""
    const word = normalizeWord(rawWord)
    if (!word || seen.has(word)) continue

    const updatedAt =
      "updatedAt" in item && Number.isFinite(Number(item.updatedAt))
        ? Number(item.updatedAt)
        : 0

    seen.add(word)
    normalized.push({ word, updatedAt })
  }

  return normalized
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_ITEMS)
}

const readAll = (): SearchHistoryItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return sanitizeItems(parsed)
  } catch {
    return []
  }
}

const writeAll = (items: SearchHistoryItem[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeItems(items)))
  } catch {
    // storage full or unavailable
  }
}

export const getSearchHistory = (): SearchHistoryItem[] => readAll()

export const upsertSearchHistory = (value: string) => {
  const word = normalizeWord(value)
  if (!word) return

  const next = readAll().filter((item) => item.word !== word)
  next.unshift({ word, updatedAt: Date.now() })
  writeAll(next)
}

export const clearSearchHistory = () => {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
