import { useSyncExternalStore } from 'react'

export interface SyncStatus {
  state: 'off' | 'idle' | 'syncing' | 'error'
  lastSync: number | null
  error: string
}

let status: SyncStatus = { state: 'off', lastSync: null, error: '' }
const listeners = new Set<() => void>()

export function setSyncStatus(patch: Partial<SyncStatus>): void {
  status = { ...status, ...patch }
  listeners.forEach((l) => l())
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => status,
  )
}
