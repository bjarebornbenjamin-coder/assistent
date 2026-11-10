const SEARCH = 'https://www.google.com/search?q='
const DIRECT = 'https://duckduckgo.com/?q='

/** En sökning på rättens namn, som reserv om direktlänken hamnar fel. */
export function recipeSearchUrl(title: string): string {
  return SEARCH + encodeURIComponent(`${title.trim()} recept`).replace(/%20/g, '+')
}

/**
 * Direkt till receptet på ICA. DuckDuckGo öppnar första träffen direkt när sökningen börjar med "\",
 * och "site:ica.se" håller det till ICA:s receptsidor. AI:n kan inte surfa, så en adress den
 * skrev själv vore gissad; den här leder alltid till en riktig sida.
 */
export function recipeDirectUrl(title: string): string {
  return DIRECT + encodeURIComponent(`\\ site:ica.se/recept ${title.trim()}`).replace(/%20/g, '+')
}

/**
 * Länkar i chatten. Modellen skriver [text](recept:Rättens namn) och appen bygger adressen,
 * så att modellen aldrig kan hitta på en adress. Gamla sökningar på Google tillåts också.
 */
export function resolveLink(href: string): string | null {
  if (href.startsWith('recept:')) {
    const title = decodeURIComponent(href.slice(7)).trim()
    return title ? recipeDirectUrl(title) : null
  }
  return href.startsWith(SEARCH) && !/[\s"'<>]/.test(href) ? href : null
}
