import type VideoJsPlayer from "video.js/dist/types/player"

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

export type TouchSeekHandle = {
  dispose: () => void
}

export const attachTouchSeek = (player: VideoJsPlayer): TouchSeekHandle => {
  const root = player.el()
  let active = false
  let startX = 0
  let startTime = 0

  const isControlTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false
    return Boolean(
      target.closest(".vjs-control-bar") ||
        target.closest(".vjs-big-play-button") ||
        target.closest(".vjs-menu"),
    )
  }

  const getDuration = () => {
    const duration = player.duration()
    return Number.isFinite(duration) && duration > 0 ? duration : 0
  }

  const seekTo = (time: number) => {
    const duration = getDuration()
    if (!duration) return
    player.currentTime(clamp(time, 0, duration))
  }

  const onTouchStart = (event: TouchEvent) => {
    if (event.touches.length !== 1 || isControlTarget(event.target)) return

    const duration = getDuration()
    if (!duration) return

    active = true
    startX = event.touches[0].clientX
    startTime = player.currentTime()
  }

  const onTouchMove = (event: TouchEvent) => {
    if (!active || event.touches.length !== 1) return

    const duration = getDuration()
    if (!duration) return

    const width = Math.max(root.clientWidth, 1)
    const deltaX = event.touches[0].clientX - startX
    const seekSpan = Math.max(duration * 0.35, 45)
    const nextTime = startTime + (deltaX / width) * seekSpan

    seekTo(nextTime)
    event.preventDefault()
  }

  const onTouchEnd = () => {
    active = false
  }

  const onProgressTap = (event: TouchEvent) => {
    if (isControlTarget(event.target)) return
    const bar = (event.target as HTMLElement).closest(".vjs-progress-holder")
    if (!bar || !(bar instanceof HTMLElement)) return

    const duration = getDuration()
    if (!duration) return

    const rect = bar.getBoundingClientRect()
    const ratio = clamp((event.touches[0].clientX - rect.left) / rect.width, 0, 1)
    seekTo(ratio * duration)
    event.preventDefault()
  }

  root.addEventListener("touchstart", onTouchStart, { passive: true })
  root.addEventListener("touchmove", onTouchMove, { passive: false })
  root.addEventListener("touchend", onTouchEnd, { passive: true })
  root.addEventListener("touchcancel", onTouchEnd, { passive: true })

  let progressHolder: Element | null = null

  const bindProgressSeek = () => {
    const holder = root.querySelector(".vjs-progress-holder")
    if (!holder || progressHolder === holder) return holder
    holder.addEventListener("touchstart", onProgressTap, { passive: false })
    progressHolder = holder
    return holder
  }

  bindProgressSeek()
  player.one("loadedmetadata", bindProgressSeek)

  return {
    dispose: () => {
      root.removeEventListener("touchstart", onTouchStart)
      root.removeEventListener("touchmove", onTouchMove)
      root.removeEventListener("touchend", onTouchEnd)
      root.removeEventListener("touchcancel", onTouchEnd)
      progressHolder?.removeEventListener("touchstart", onProgressTap)
    },
  }
}
