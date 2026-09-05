export function money(value: number, currency = 'ARS') {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency, maximumFractionDigits: 0
  }).format(value)
}
