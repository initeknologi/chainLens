import type { AnalysisBundle, AnalyticsReport, ApprovalReport, ContractSnapshot, Explanation, TransactionReport } from '@chainlens/shared-types'

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

async function request<T>(path: string, init?: RequestInit, token?: string | null): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  })
  if (!response.ok) {
    let message = response.statusText
    try {
      const body = (await response.json()) as { error?: string; message?: string; code?: string }
      message = body.message || body.error || response.statusText
      if (body.code) message = `${body.code}: ${message}`
    } catch {
      message = response.statusText
    }
    throw new Error(message)
  }
  return response.json() as Promise<T>
}

export function analyzeWallet(address: string, chainIds: number[], save: boolean, token: string | null) {
  return request<AnalysisBundle & { persisted: boolean }>(
    '/api/v1/wallets/analyze',
    { method: 'POST', body: JSON.stringify({ address, chainIds, save }) },
    token,
  )
}

export function getAnalyticsHistory(address: string, chainIds: number[]) {
  const chains = chainIds.join(',')
  return request<{
    nativeHistory: AnalyticsReport['nativeHistory']
    snapshots: AnalyticsReport['snapshots']
    limitations: string[]
  }>(`/api/v1/analytics/${address}/history?chains=${chains}`)
}

export function getTransaction(chainId: string, hash: string, address?: string) {
  const query = address ? `?address=${encodeURIComponent(address)}` : ''
  return request<TransactionReport>(`/api/v1/transactions/${chainId}/${hash}${query}`)
}

export function explainTransaction(input: { question: string; chainId: number; hash: string; address?: string }) {
  return request<TransactionReport>('/api/v1/explainer/explain', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function askAssistant(input: { question: string; chainId?: number; hash?: string; address?: string }) {
  return request<Explanation>('/api/v1/explainer/ask', { method: 'POST', body: JSON.stringify(input) })
}

export function getContract(chainId: string, address: string) {
  return request<ContractSnapshot>(`/api/v1/contracts/${chainId}/${address}`)
}

export function createAccount(displayName: string) {
  return request<{ token: string; id: string; displayName: string }>('/api/v1/account', {
    method: 'POST',
    body: JSON.stringify({ displayName }),
  })
}

export function getAccount(token: string) {
  return request<{ id: string; displayName: string; preferences: unknown; wallets: Array<{ address: string; savedAt: string }> }>(
    '/api/v1/account',
    undefined,
    token,
  )
}

export function deleteAccount(token: string) {
  return request<{ deleted: boolean }>('/api/v1/account', { method: 'DELETE' }, token)
}

export function forgetWallet(token: string, address: string) {
  return request<{ wallets: Array<{ address: string }> }>(`/api/v1/account/wallets/${address}`, { method: 'DELETE' }, token)
}

export function savePreferences(token: string, preferences: { networks: number[]; showUnpriced: boolean }) {
  return request('/api/v1/account/preferences', { method: 'PUT', body: JSON.stringify(preferences) }, token)
}

export function shortAddress(value: string) {
  if (value.length < 12) return value
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}

export function usd(value: string | null) {
  if (value == null) return 'Price unavailable'
  return `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function percent(bps: number) {
  return `${(bps / 100).toFixed(1)}%`
}

export type { ApprovalReport }
