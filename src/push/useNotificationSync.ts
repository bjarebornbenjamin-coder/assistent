import { liveQuery } from 'dexie'
import { useEffect } from 'react'
import { db } from '../db/db'
import { getSettings } from '../db/repo'
import { planNotifications } from '../domain/notifications'
import { supabase, useSession } from '../sync/supabase'
import { currentSubscription, pushSupported, uploadNotifications } from './push'

const DEBOUNCE_MS = 3_000

/** Håller serverns lista över kommande notiser i takt med schema, packlistor och inställningar. */
export function useNotificationSync(): void {
  const session = useSession()
  const userId = session?.user.id

  useEffect(() => {
    if (!supabase || !userId || !pushSupported()) return
    const client = supabase
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let last = ''

    async function plan() {
      if (stopped || !navigator.onLine) return
      if (Notification.permission !== 'granted' || !(await currentSubscription())) return
      const [settings, lessons, subjects, reminders, pantry, shopping, events, tasks] = await Promise.all([getSettings(), db.lessons.toArray(), db.subjects.toArray(), db.reminders.toArray(), db.pantry.toArray(), db.shopping.toArray(), db.events.toArray(), db.tasks.toArray()])
      const planned = planNotifications(new Date(), settings, lessons, subjects, 14, reminders, { pantry, shopping }, { events, tasks })
      const fingerprint = JSON.stringify(planned.map((n) => [n.id, n.fireAt.getTime(), n.title, n.body]))
      if (fingerprint === last) return
      try {
        await uploadNotifications(client, userId!, planned)
        last = fingerprint
      } catch {
        /* nästa ändring eller start försöker igen */
      }
    }
    const schedule = () => {
      clearTimeout(timer)
      timer = setTimeout(() => void plan(), DEBOUNCE_MS)
    }

    schedule()
    const sub = liveQuery(() => Promise.all([db.settings.toArray(), db.lessons.toArray(), db.subjects.toArray(), db.reminders.toArray(), db.pantry.toArray(), db.shopping.toArray(), db.events.toArray(), db.tasks.toArray()])).subscribe({ next: schedule, error: () => {} })
    window.addEventListener('push-changed', schedule)
    window.addEventListener('online', schedule)
    document.addEventListener('visibilitychange', schedule)
    return () => {
      stopped = true
      clearTimeout(timer)
      sub.unsubscribe()
      window.removeEventListener('push-changed', schedule)
      window.removeEventListener('online', schedule)
      document.removeEventListener('visibilitychange', schedule)
    }
  }, [userId])
}
