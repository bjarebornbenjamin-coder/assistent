import { handleChat } from './_lib/openai'
import { adapt } from './_lib/vercel'

export default adapt((req, env) => handleChat(req, env))
