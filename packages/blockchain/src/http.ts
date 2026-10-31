import { URL } from 'node:url'
import { allowedHttpsHosts } from '@chainlens/config'
import { UpstreamError } from '@chainlens/shared-types'

const BLOCKED_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', 'metadata.google.internal'])

function isPrivateIpv4(hostname: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname)
  if (!match) return false
  const parts = match.slice(1).map(Number)
  if (parts.some((part) => part > 255)) return true
  const [a, b] = parts
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || a === 0
}

export function assertFetchableUrl(url: string, env: NodeJS.ProcessEnv = process.env): void {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new UpstreamError('Refusing a data source URL that is not absolute')
  }
  if (parsed.protocol !== 'https:') {
    throw new UpstreamError('ChainLens only calls https data sources')
  }
  if (parsed.username || parsed.password) {
    throw new UpstreamError('Refusing a data source URL with embedded credentials')
  }
  const host = parsed.hostname.toLowerCase()
  if (BLOCKED_HOSTS.has(host) || host.endsWith('.local') || host.endsWith('.internal') || isPrivateIpv4(host)) {
    throw new UpstreamError('Refusing a private or local data source host')
  }
  if (!allowedHttpsHosts(env).has(host)) {
    throw new UpstreamError(`Data source host is not allowlisted: ${host}`)
  }
}

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>

interface CircuitState {
  failures: number
  openUntil: number
}

const circuits = new Map<string, CircuitState>()
const FAILURES_TO_OPEN = 4
const OPEN_MS = 30_000

export interface FetchPolicy {
  retries?: number
  baseDelayMs?: number
  timeoutMs?: number
}

export function resetProviderHealth(): void {
  circuits.clear()
}

export function providerHealth(): Array<{ host: string; failures: number; open: boolean }> {
  const now = Date.now()
  return [...circuits.entries()].map(([host, state]) => ({
    host,
    failures: state.failures,
    open: state.openUntil > now,
  }))
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function noteSuccess(host: string): void {
  circuits.set(host, { failures: 0, openUntil: 0 })
}

function noteFailure(host: string): void {
  const current = circuits.get(host) ?? { failures: 0, openUntil: 0 }
  const failures = current.failures + 1
  circuits.set(host, {
    failures,
    openUntil: failures >= FAILURES_TO_OPEN ? Date.now() + OPEN_MS : current.openUntil,
  })
}

export async function getJson<T>(url: string, fetcher: Fetcher = fetch, timeoutMs = 12_000, policy: FetchPolicy = {}): Promise<T> {
  assertFetchableUrl(url)
  const host = new URL(url).hostname
  const state = circuits.get(host)
  if (state && state.openUntil > Date.now()) {
    throw new UpstreamError(`Data source circuit is open for ${host}`)
  }
  const retries = policy.retries ?? 2
  const baseDelayMs = policy.baseDelayMs ?? 200
  const budget = policy.timeoutMs ?? timeoutMs
  let lastError: unknown = new UpstreamError(`Data source request failed for ${host}`)
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (attempt > 0) await sleep(baseDelayMs * 2 ** (attempt - 1))
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), budget)
    try {
      const response = await fetcher(url, {
        signal: controller.signal,
        headers: { accept: 'application/json', 'user-agent': 'ChainLens/0.1' },
      })
      if (!response.ok) {
        throw new UpstreamError(`Data source returned ${response.status} for ${host}`)
      }
      const body = (await response.json()) as T
      noteSuccess(host)
      return body
    } catch (error) {
      noteFailure(host)
      lastError = error
      const message = error instanceof Error ? error.message : 'request failed'
      const clientError = /returned 4\d\d/.test(message) && !message.includes('429')
      if (clientError || attempt === retries) {
        if (error instanceof UpstreamError) throw error
        throw new UpstreamError(`Data source request failed: ${message}`)
      }
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastError instanceof UpstreamError ? lastError : new UpstreamError('Data source request failed')
}
