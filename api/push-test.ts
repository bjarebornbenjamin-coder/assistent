import { handleTest } from './_lib/push.js'
import { adapt } from './_lib/vercel.js'

export default adapt((req, env) => handleTest(req, env))
