const PRICE_SCALE = 8

export function parseDecimalToScaled(value: string, scale: number): bigint {
  const trimmed = value.trim()
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Invalid decimal: ${value}`)
  }
  const negative = trimmed.startsWith('-')
  const unsigned = negative ? trimmed.slice(1) : trimmed
  const [whole, fraction = ''] = unsigned.split('.')
  const digits = `${whole}${fraction.padEnd(scale, '0').slice(0, scale)}`.replace(/^0+(?=\d)/, '')
  const scaled = BigInt(digits || '0')
  return negative ? -scaled : scaled
}

export function formatScaled(value: bigint, scale: number, maxDecimals = scale): string {
  const negative = value < 0n
  const absolute = negative ? -value : value
  const base = 10n ** BigInt(scale)
  const whole = absolute / base
  let fraction = (absolute % base).toString().padStart(scale, '0').slice(0, maxDecimals)
  fraction = fraction.replace(/0+$/, '')
  const text = fraction.length > 0 ? `${whole.toString()}.${fraction}` : whole.toString()
  return negative ? `-${text}` : text
}

export function formatUnits(raw: bigint, decimals: number, maxDecimals = 6): string {
  return formatScaled(raw, decimals, Math.min(maxDecimals, decimals))
}

export function rawToUsd(raw: bigint, decimals: number, priceUsd: string): string | null {
  if (!/^\d+(\.\d+)?$/.test(priceUsd)) return null
  const price = parseDecimalToScaled(priceUsd, PRICE_SCALE)
  if (price < 0n) return null
  const usd = (raw * price) / 10n ** BigInt(decimals)
  return formatScaled(usd, PRICE_SCALE, 2)
}

export function addUsd(values: Array<string | null>): { total: string | null; priced: number; missing: number } {
  let total = 0n
  let priced = 0
  let missing = 0
  for (const value of values) {
    if (value == null) {
      missing += 1
      continue
    }
    total += parseDecimalToScaled(value, PRICE_SCALE)
    priced += 1
  }
  if (priced === 0) return { total: null, priced, missing }
  return { total: formatScaled(total, PRICE_SCALE, 2), priced, missing }
}

export function isUnlimitedAllowance(raw: bigint): boolean {
  return raw >= 2n ** 200n
}

export function shortHash(value: string, lead = 6, tail = 4): string {
  if (value.length <= lead + tail + 1) return value
  return `${value.slice(0, lead)}…${value.slice(-tail)}`
}
