/** Shared preview player so swipe / navigation always can hard-stop audio. */

let current: HTMLAudioElement | null = null
let generation = 0

export function getPreviewAudio(): HTMLAudioElement {
  if (!current) current = new Audio()
  return current
}

export function previewGeneration(): number {
  return generation
}

export function bumpPreviewGeneration(): number {
  generation += 1
  return generation
}

export function stopPreviewAudio(): void {
  bumpPreviewGeneration()
  const a = current
  if (!a) return
  a.onended = null
  a.onpause = null
  a.onerror = null
  try {
    a.pause()
  } catch {
    /* ignore */
  }
  try {
    a.currentTime = 0
  } catch {
    /* ignore */
  }
  try {
    a.src = ''
    a.removeAttribute('src')
    a.load()
  } catch {
    /* ignore */
  }
}
