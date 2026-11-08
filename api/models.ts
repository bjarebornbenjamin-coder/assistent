import { handleModels } from './_lib/openai'
import { adapt } from './_lib/vercel'

export default adapt((req, env) => handleModels(req, env))
