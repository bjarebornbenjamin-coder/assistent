import { handleRecipeSearch } from './_lib/recipes.js'
import { adapt } from './_lib/vercel.js'

export default adapt((req, env) => handleRecipeSearch(req, env))
