// Ejecuta fn sobre items con un limite de concurrencia. Devuelve los
// resultados en el MISMO orden que items. Para paralelizar lecturas Graph sin
// disparar throttling (el SDK reintenta 429, pero mejor no provocarlo).
export async function enParalelo(items, limite, fn) {
  const out = new Array(items.length)
  let i = 0
  const workers = Array.from({ length: Math.max(1, Math.min(limite, items.length)) }, async () => {
    while (i < items.length) {
      const idx = i++
      out[idx] = await fn(items[idx], idx)
    }
  })
  await Promise.all(workers)
  return out
}
