import type { AllocationSlice, AssetPosition } from '@chainlens/shared-types'
import { addUsd, parseDecimalToScaled } from './money'

const USD_SCALE = 8

export function buildAllocation(assets: AssetPosition[]): AllocationSlice[] {
  const priced = assets
    .filter((asset) => asset.valueUsd != null)
    .map((asset) => ({
      key: `${asset.chainId}:${asset.tokenAddress}`,
      symbol: asset.symbol,
      chainName: asset.chainName,
      valueUsd: asset.valueUsd as string,
      usd: parseDecimalToScaled(asset.valueUsd as string, USD_SCALE),
    }))
  const total = priced.reduce((sum, asset) => sum + asset.usd, 0n)
  if (total === 0n) return []
  const slices = priced.map((asset) => ({
    key: asset.key,
    symbol: asset.symbol,
    chainName: asset.chainName,
    valueUsd: asset.valueUsd,
    shareBps: Number((asset.usd * 10000n) / total),
    remainder: asset.usd * 10000n - (asset.usd * 10000n / total) * total,
  }))
  const assigned = slices.reduce((sum, slice) => sum + slice.shareBps, 0)
  if (assigned < 10000 && slices.length > 0) {
    const winner = slices.reduce((best, slice) => (slice.remainder > best.remainder ? slice : best))
    winner.shareBps += 10000 - assigned
  }
  return slices
    .map(({ key, symbol, chainName, valueUsd, shareBps }) => ({ key, symbol, chainName, valueUsd, shareBps }))
    .sort((a, b) => b.shareBps - a.shareBps)
}

export function valuationCoverage(assets: AssetPosition[]): 'complete' | 'partial' | 'unavailable' {
  const totals = addUsd(assets.map((asset) => asset.valueUsd))
  if (totals.priced === 0) return 'unavailable'
  if (totals.missing > 0) return 'partial'
  return 'complete'
}

export function networkDistribution(assets: AssetPosition[]): Array<{
  chainId: number
  chainName: string
  valueUsd: string
  shareBps: number
}> {
  const grouped = new Map<number, { chainName: string; values: Array<string | null> }>()
  for (const asset of assets) {
    const current = grouped.get(asset.chainId) ?? { chainName: asset.chainName, values: [] }
    current.values.push(asset.valueUsd)
    grouped.set(asset.chainId, current)
  }
  const rows = [...grouped.entries()].map(([chainId, group]) => ({
    chainId,
    chainName: group.chainName,
    valueUsd: addUsd(group.values).total ?? '0.00',
  }))
  return buildAllocation(
    rows.map((row) => ({
      chainId: row.chainId,
      chainName: row.chainName,
      tokenAddress: 'network',
      symbol: row.chainName,
      name: row.chainName,
      decimals: 0,
      rawBalance: '0',
      displayBalance: '0',
      priceUsd: null,
      valueUsd: row.valueUsd,
      priceSource: null,
      priceObservedAt: null,
      isNative: false,
    })),
  ).map((slice) => ({
    chainId: Number(slice.key.split(':')[0]),
    chainName: slice.chainName,
    valueUsd: slice.valueUsd,
    shareBps: slice.shareBps,
  }))
}
