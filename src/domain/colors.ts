/** Färger som fungerar både mot ljus och mörk bakgrund. */
export const SUBJECT_COLORS = [
  { name: 'Blå', value: '#1a73e8' },
  { name: 'Röd', value: '#d93025' },
  { name: 'Orange', value: '#e8710a' },
  { name: 'Gul', value: '#c9a000' },
  { name: 'Grön', value: '#188038' },
  { name: 'Turkos', value: '#129eaf' },
  { name: 'Lila', value: '#8e24aa' },
  { name: 'Rosa', value: '#d01884' },
]

export const isColor = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)
