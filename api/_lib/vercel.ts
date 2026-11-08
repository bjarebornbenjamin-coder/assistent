import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { ApiRequest, ApiResponse, Env } from './types'

/** Kopplar våra rena handlers till Vercels Node-signatur. */
export function adapt(handler: (req: ApiRequest, env: Env) => Promise<ApiResponse>) {
  return async (req: VercelRequest, res: VercelResponse): Promise<void> => {
    const forwarded = req.headers['x-forwarded-for']
    const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0].trim() ?? req.socket?.remoteAddress ?? ''
    const out = await handler(
      { method: req.method ?? 'GET', headers: req.headers, body: req.body, ip },
      process.env as unknown as Env,
    )
    for (const [k, v] of Object.entries(out.headers ?? {})) res.setHeader(k, v)
    res.status(out.status).json(out.body)
  }
}
