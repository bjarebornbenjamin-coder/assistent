import { handleDispatch } from './_lib/push'
import { adapt } from './_lib/vercel'

export default adapt((req, env) => handleDispatch(req, env))
