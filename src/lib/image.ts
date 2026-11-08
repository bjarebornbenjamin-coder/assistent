/** Skalar ner en bild och gör om den till JPEG (data-URL) så att den ryms i en förfrågan till servern. */
export async function imageToDataUrl(file: File, maxSide = 1600, maxChars = 3_000_000): Promise<string> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('Kunde inte läsa bilden. Använd en JPG- eller PNG-fil.')
  })
  let side = maxSide
  for (let attempt = 0; attempt < 4; attempt++) {
    const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Kunde inte bearbeta bilden.')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const url = canvas.toDataURL('image/jpeg', attempt < 2 ? 0.85 : 0.7)
    if (url.length <= maxChars) return url
    side = Math.round(side * 0.75)
  }
  throw new Error('Bilden är för stor. Beskär den eller ta en mindre skärmdump.')
}
