const SEARCH = 'https://www.google.com/search?q='

/** En sökning på rättens namn, som reserv om direktlänken hamnar fel. */
export function recipeSearchUrl(title: string): string {
  return SEARCH + encodeURIComponent(`${title.trim()} recept`).replace(/%20/g, '+')
}

/**
 * Länkar i chatten. Adresser i assistentens svar har redan rensats så att bara sådana som kom
 * från receptsökningen finns kvar (keepLinks). Äldre svar kan ha recept:Namn, som blir en sökning.
 */
export function resolveLink(href: string): string | null {
  if (href.startsWith('recept:')) {
    const title = decodeURIComponent(href.slice(7)).trim()
    return title ? recipeSearchUrl(title) : null
  }
  return /^https:\/\/[^\s"'<>]+$/.test(href) ? href : null
}
