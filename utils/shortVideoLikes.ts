import { ShortVideoItem } from "../types"

const STORAGE_KEY = "vastren.short-video.likes.v1"
const EVENT_NAME = "vastren:short-video-likes-updated"

const readAll = (): ShortVideoItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const writeAll = (items: ShortVideoItem[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    window.dispatchEvent(new Event(EVENT_NAME))
  } catch {
    // ignore storage failures
  }
}

export const getLikedShortVideos = (): ShortVideoItem[] => readAll()

export const isShortVideoLiked = (id: string) =>
  readAll().some((item) => item.id === id)

export const upsertLikedShortVideo = (item: ShortVideoItem) => {
  const list = readAll().filter((existing) => existing.id !== item.id)
  list.unshift({ ...item, isLiked: true })
  writeAll(list)
}

export const removeLikedShortVideo = (id: string) => {
  writeAll(readAll().filter((item) => item.id !== id))
}

export const toggleLikedShortVideo = (item: ShortVideoItem) => {
  const liked = isShortVideoLiked(item.id)
  if (liked) {
    removeLikedShortVideo(item.id)
    return false
  }
  upsertLikedShortVideo(item)
  return true
}

export const subscribeShortVideoLikes = (listener: () => void) => {
  window.addEventListener(EVENT_NAME, listener)
  return () => window.removeEventListener(EVENT_NAME, listener)
}
