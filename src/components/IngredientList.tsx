import type { Ingredient } from '../ai/recipes'

/** Ingredienser med om de finns hemma. `expiring` = lagrets namn på varor som snart går ut. */
export function IngredientList({ items, expiring }: { items: Ingredient[]; expiring: Set<string> }) {
  return (
    <ul className="ingredients">
      {items.map((i) => (
        <li key={i.name} className={i.status === 'missing' || i.status === 'pantry-low' ? 'missing' : ''}>
          <span>{i.amount ? `${i.amount} ` : ''}{i.name}</span>
          <span className="sub">
            {i.status === 'pantry' && (expiring.has(i.pantryName ?? '') ? 'har hemma, snart ute' : 'har hemma')}
            {i.status === 'pantry-low' && 'har hemma, kanske för lite'}
            {i.status === 'pantry-check' && 'har hemma, kolla mängden'}
            {i.status === 'staple' && 'basvara'}
            {i.status === 'missing' && 'saknas'}
          </span>
        </li>
      ))}
    </ul>
  )
}
