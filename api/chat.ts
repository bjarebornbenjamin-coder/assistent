import { handleChat } from './_lib/openai.js'
import { adapt } from './_lib/vercel.js'

export default adapt((req, env) => handleChat(req, env))
