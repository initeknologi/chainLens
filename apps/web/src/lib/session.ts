export const CHAINS = [
  { id: 1, label: 'Ethereum', initial: true },
  { id: 8453, label: 'Base', initial: true },
  { id: 56, label: 'BNB Smart Chain', initial: false },
  { id: 137, label: 'Polygon', initial: false },
] as const

const ALLOWED = new Set(CHAINS.map((chain) => chain.id))

export function readChainIds(): number[] {
  if (typeof window === 'undefined') return [1, 8453]
  const raw = sessionStorage.getItem('chainlens.chains')
  if (!raw) return [1, 8453]
  const ids = raw
    .split(',')
    .map((part) => Number(part))
    .filter((id): id is number => ALLOWED.has(id as 1 | 56 | 137 | 8453))
  return ids.length > 0 ? ids : [1, 8453]
}

export function writeChainIds(ids: number[]) {
  sessionStorage.setItem('chainlens.chains', ids.join(','))
}

export function readToken(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem('chainlens.token')
}

export function writeToken(token: string | null) {
  if (token) sessionStorage.setItem('chainlens.token', token)
  else sessionStorage.removeItem('chainlens.token')
}

export function readSave(): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem('chainlens.save') === '1'
}

export function writeSave(save: boolean) {
  sessionStorage.setItem('chainlens.save', save ? '1' : '0')
}
