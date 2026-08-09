import { useSyncExternalStore } from 'react'

function readNeon(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.getAttribute('data-theme') === 'neon'
}

function subscribe(onStoreChange: () => void): () => void {
  if (typeof document === 'undefined') return () => {}
  const obs = new MutationObserver(onStoreChange)
  obs.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  })
  return () => obs.disconnect()
}

/** True when Play-style neon theme is active. */
export function useNeonTheme(): boolean {
  return useSyncExternalStore(subscribe, readNeon, () => false)
}
