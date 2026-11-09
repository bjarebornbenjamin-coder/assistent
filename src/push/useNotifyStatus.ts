import { useEffect, useState } from 'react'
import { supabase, syncConfigured, useSession } from '../sync/supabase'
import { currentSubscription, pushSupported, vapidKey } from './push'

export type NotifyStatus = { on: true } | { on: false; reason: string }

/** Kan appen skicka notiser till den här enheten just nu? Och i så fall inte: varför. */
export function useNotifyStatus(): NotifyStatus | undefined {
  const session = useSession()
  const [subscribed, setSubscribed] = useState<boolean | undefined>(undefined)
  useEffect(() => {
    if (!pushSupported() || Notification.permission !== 'granted') return setSubscribed(false)
    void currentSubscription().then((s) => setSubscribed(Boolean(s)))
  }, [session])
  if (!pushSupported()) return { on: false, reason: 'Den här webbläsaren kan inte ta emot notiser (på iPhone måste appen ligga på hemskärmen).' }
  if (!syncConfigured || !supabase || !vapidKey) return { on: false, reason: 'Notiser är inte installerade i den här versionen av appen, så påminnelser syns bara på Hem.' }
  if (session === undefined || subscribed === undefined) return undefined
  if (!session) return { on: false, reason: 'Logga in under Inställningar → Synk och slå på notiser för att få påminnelser på telefonen.' }
  if (!subscribed) return { on: false, reason: 'Slå på notiser under Inställningar → Notiser för att få påminnelser på telefonen.' }
  return { on: true }
}
