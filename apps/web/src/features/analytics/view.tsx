'use client'

import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { PortfolioReport } from '@chainlens/shared-types'
import { getAnalyticsHistory, percent, usd } from '@/lib/api'
import { readChainIds } from '@/lib/session'
import { ChartNoAxesCombined, Layers3, Radio } from 'lucide-react'

export function AnalyticsView({ address, portfolio }: { address: string; portfolio: PortfolioReport }) {
  const [ready, setReady] = useState(false)
  const [chainIds, setChainIds] = useState<number[]>([1, 8453])
  useEffect(() => {
    setChainIds(readChainIds())
    setReady(true)
  }, [])
  const query = useQuery({
    queryKey: ['history', address.toLowerCase(), chainIds.join(',')],
    queryFn: () => getAnalyticsHistory(address, chainIds),
    enabled: ready,
  })
  const largest = portfolio.allocation[0]
  const history =
    query.data?.nativeHistory.flatMap((chain) =>
      chain.points.map((point) => ({
        label: new Date(point.timestamp).toLocaleDateString(),
        balance: Number(point.displayBalance),
      })),
    ) ?? []
  const networkShares = new Map<number, { name: string; value: number }>()
  for (const slice of portfolio.allocation) {
    const chain = portfolio.chains.find((item) => item.chainName === slice.chainName)
    if (!chain) continue
    const current = networkShares.get(chain.chainId) ?? { name: chain.chainName, value: 0 }
    current.value += Number(slice.valueUsd)
    networkShares.set(chain.chainId, current)
  }
  const networkTotal = [...networkShares.values()].reduce((sum, item) => sum + item.value, 0)
  return (
    <div className="grid gap-5">
      <div><p className="eyebrow">Portfolio intelligence</p><h2 className="mt-2 text-2xl font-semibold">Analytics</h2><p className="mt-1 text-sm text-muted">Historical snapshots, concentration, and network distribution.</p></div>
      <section className="grid gap-4 md:grid-cols-2">
        <article className="data-card p-5">
          <div className="flex items-center justify-between"><p className="eyebrow">Largest priced position</p><Layers3 size={17} className="text-[#a99dff]" /></div>
          <p className="mt-4 font-mono text-3xl">{largest ? `${largest.symbol} ${percent(largest.shareBps)}` : 'Unavailable'}</p>
          <p className="mt-2 text-sm text-muted">{largest ? largest.chainName : 'No priced assets were returned. Missing prices stay unavailable.'}</p>
        </article>
        <article className="data-card p-5">
          <div className="flex items-center justify-between"><p className="eyebrow">Network distribution</p><ChartNoAxesCombined size={17} className="text-cyan" /></div>
          <div className="mt-4 grid gap-3">
            {[...networkShares.entries()].map(([chainId, network]) => {
              const share = networkTotal > 0 ? Math.round((network.value / networkTotal) * 1000) / 10 : 0
              return (
                <div key={chainId}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{network.name}</span>
                    <span className="text-muted">{share}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-line">
                    <div className="h-2 rounded-full bg-gradient-to-r from-signal to-cyan" style={{ width: `${share}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </article>
      </section>
      <section className="glass-panel p-5">
        <h2 className="text-lg">Stored portfolio snapshots</h2>
        <p className="mt-2 text-sm text-muted">A snapshot is written only when you save the wallet, at most once every 10 minutes. This is an estimated valuation, not realized profit or loss.</p>
        <div className="mt-4 grid gap-2">
          {(query.data?.snapshots ?? []).map((point) => (
            <div key={point.capturedAt} className="flex justify-between border-t border-line py-2 text-sm">
              <span>{new Date(point.capturedAt).toLocaleString()}</span>
              <span className="font-mono">{usd(point.totalUsd)}</span>
            </div>
          ))}
          {!query.data?.snapshots.length ? <p className="text-sm text-muted">No snapshot is stored. Save the wallet from the home form if you want history kept.</p> : null}
        </div>
      </section>
      <section className="glass-panel h-80 p-5">
        <div className="flex items-center justify-between"><h2 className="font-medium">Native balance history</h2><Radio size={15} className="text-success" /></div>
        <p className="mb-3 text-sm text-muted">Explorer coin-balance series for the native asset. An empty chart means that series was not returned.</p>
        {history.length > 0 ? (
          <ResponsiveContainer width="100%" height="80%">
            <LineChart data={history}>
              <XAxis dataKey="label" hide />
              <YAxis hide />
              <Tooltip />
              <Line type="monotone" dataKey="balance" stroke="#775cff" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted">{query.isLoading ? 'Loading the explorer series.' : 'The explorer did not return a native balance series.'}</p>
        )}
      </section>
      <ul className="grid gap-2 text-sm text-muted">
        {(query.data?.limitations ?? portfolio.limitations).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}
