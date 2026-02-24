const SYMBOL = (import.meta.env?.VITE_CURRENCY_SYMBOL as string) || '€'

export function formatCurrency(amount: number) {
  const n = Math.round(amount)
  return `${n.toLocaleString()} ${SYMBOL}`.trim()
}
