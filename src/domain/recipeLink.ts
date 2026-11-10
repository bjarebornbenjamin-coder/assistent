const SEARCH = 'https://www.google.com/search?q='

/**
 * Länk till en sökning efter receptet. AI:n kan inte surfa, så en direktlänk till en receptsida
 * skulle vara gissad och ofta trasig; en sökning på rättens namn fungerar alltid.
 */
export function recipeSearchUrl(title: string): string {
  return SEARCH + encodeURIComponent(`${title.trim()} recept`).replace(/%20/g, '+')
}

/** Bara receptsökningar blir klickbara i chatten, så att modellen inte kan hitta på adresser. */
export function isAllowedLink(url: string): boolean {
  return url.startsWith(SEARCH) && !/[\s"'<>]/.test(url)
}
