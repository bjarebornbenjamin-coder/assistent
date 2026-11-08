import { handleHealth } from './_lib/health.js'
import { adapt } from './_lib/vercel.js'

export default adapt((req, env) => handleHealth(req, env))
