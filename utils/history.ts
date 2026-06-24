const STORAGE_KEY = "vastren.playHistory"
const MAX_ITEMS = 30

export interface PlayHistoryItem {
  id: string
  name: string
  cover: string
  sourceCode: string
  sourceName: string
  episodeIndex: number
  episodeName: string
  currentTime: number
  updatedAt: number
}

const readAll = (): PlayHistoryItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const writeAll = (items: PlayHistoryItem[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)))
  } catch {
    // storage full or unavailable
  }
}

export const getPlayHistory = (): PlayHistoryItem[] => readAll()

export const upsertPlayHistory = (item: PlayHistoryItem) => {
  const list = readAll().filter((existing) => existing.id !== item.id)
  list.unshift({ ...item, updatedAt: Date.now() })
  writeAll(list)
}

export const removePlayHistory = (id: string) => {
  writeAll(readAll().filter((item) => item.id !== id))
}

export const clearPlayHistory = () => {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
