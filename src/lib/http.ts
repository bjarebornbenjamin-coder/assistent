/** fetch med tidsgräns, så att ett hängande anrop inte låter användaren vänta för alltid. */
export async function fetchWithTimeout(url: string, init: RequestInit = {}, fetchFn: typeof fetch = fetch, ms = 15_000): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetchFn(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
  }
}
