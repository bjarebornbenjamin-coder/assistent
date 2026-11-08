import { handleTest } from './_lib/push'
import { adapt } from './_lib/vercel'

export default adapt((req, env) => handleTest(req, env))
