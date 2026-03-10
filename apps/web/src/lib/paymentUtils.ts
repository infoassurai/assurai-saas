export type PaymentFrequency = 'annuale' | 'semestrale' | 'mensile' | 'rateizzata'

export const PAYMENT_FREQUENCY_OPTIONS: { value: PaymentFrequency; label: string }[] = [
  { value: 'annuale', label: 'Annuale' },
  { value: 'semestrale', label: 'Semestrale' },
  { value: 'mensile', label: 'Mensile' },
  { value: 'rateizzata', label: 'Rateizzata (10 rate)' },
]

/**
 * Crea una data sicura gestendo il cap al giorno massimo del mese.
 * Es: 31 gennaio + 1 mese = 28/29 febbraio (non 3 marzo)
 */
function safeDate(year: number, month: number, day: number): Date {
  // month è 0-based qui
  const d = new Date(year, month, 1)
  const maxDay = new Date(year, month + 1, 0).getDate()
  d.setDate(Math.min(day, maxDay))
  return d
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * Calcola la prossima data di scadenza rata >= oggi.
 *
 * @param effectiveDate Data decorrenza polizza (YYYY-MM-DD)
 * @param expiryDate Data scadenza polizza (YYYY-MM-DD)
 * @param frequency Tipo di frazionamento
 * @returns Data prossima scadenza rata (YYYY-MM-DD)
 */
export function calculateNextPaymentDate(
  effectiveDate: string,
  expiryDate: string,
  frequency: PaymentFrequency
): string {
  if (frequency === 'annuale') {
    return expiryDate
  }

  const eff = parseDate(effectiveDate)
  const exp = parseDate(expiryDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const effDay = eff.getDate()
  const effMonth = eff.getMonth()
  const effYear = eff.getFullYear()

  if (frequency === 'semestrale') {
    // Ciclo ogni 6 mesi dalla decorrenza
    for (let i = 1; i <= 100; i++) {
      const next = safeDate(effYear, effMonth + i * 6, effDay)
      if (next > exp) return expiryDate
      if (next >= today) return formatDate(next)
    }
    return expiryDate
  }

  if (frequency === 'mensile') {
    // Ciclo ogni mese dalla decorrenza
    for (let i = 1; i <= 100; i++) {
      const next = safeDate(effYear, effMonth + i, effDay)
      if (next > exp) return expiryDate
      if (next >= today) return formatDate(next)
    }
    return expiryDate
  }

  if (frequency === 'rateizzata') {
    // 10 rate su 12 mesi: si salta il mese DOPO e il mese PRIMA dell'anniversario
    // Anniversario = mese della decorrenza
    // Mese da saltare DOPO = effMonth + 1
    // Mese da saltare PRIMA = effMonth - 1 (cioè effMonth + 11 in modulo 12)
    const skipAfter = (effMonth + 1) % 12
    const skipBefore = (effMonth + 11) % 12

    for (let i = 1; i <= 100; i++) {
      const next = safeDate(effYear, effMonth + i, effDay)
      if (next > exp) return expiryDate
      const nextMonth = next.getMonth()
      // Salta i 2 mesi
      if (nextMonth === skipAfter || nextMonth === skipBefore) continue
      if (next >= today) return formatDate(next)
    }
    return expiryDate
  }

  return expiryDate
}
