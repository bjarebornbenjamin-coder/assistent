import { handleDispatch } from './_lib/push.js'
import { adapt } from './_lib/vercel.js'

export default adapt((req, env) => handleDispatch(req, env))
