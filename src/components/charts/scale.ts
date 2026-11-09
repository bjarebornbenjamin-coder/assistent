/** Runda upp till ett "snyggt" maxvärde så att axeln får jämna steg. */
export function niceMax(value: number): { max: number; ticks: number[] } {
  if (!(value > 0)) return { max: 4, ticks: [0, 1, 2, 3, 4] }
  const rough = value / 4
  const pow = Math.pow(10, Math.floor(Math.log10(rough)))
  const frac = rough / pow
  const step = (frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 2.5 ? 2.5 : frac <= 5 ? 5 : 10) * pow
  const max = Math.ceil(value / step) * step
  const ticks: number[] = []
  for (let v = 0; v <= max + step / 1000; v += step) ticks.push(Math.round(v * 1000) / 1000)
  return { max, ticks }
}

/** Rektangel med rundade övre hörn (4 px) och rak baslinje, för staplar som växer från botten. */
export function topRoundedRect(x: number, y: number, w: number, h: number, r = 4): string {
  const rr = Math.max(0, Math.min(r, w / 2, h))
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`
}
