'use client'

import { AssessmentBadge } from '@chainlens/ui'
import type { AnalysisBundle } from '@chainlens/shared-types'
import { ArrowDownLeft, ArrowUpRight, Box, Coins, ExternalLink, Layers3, Radio, WalletCards } from 'lucide-react'
import Link from 'next/link'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { percent, shortAddress, usd } from '@/lib/api'

const colors = ['#775cff', '#32d6ff', '#42e6a4', '#ffb84d', '#ff5c7c', '#6ca8ff']

export function PortfolioView({ bundle }: { bundle: AnalysisBundle }) {
  const { portfolio, activity } = bundle
  const chart = portfolio.allocation.slice(0, 6).map((slice) => ({
    name: `${slice.symbol} · ${slice.chainName}`,
    value: Number(slice.valueUsd),
  }))
  const discoveryPartial = portfolio.chains.some((chain) => chain.status !== 'ok')
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Wallet overview</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Portfolio intelligence</h2>
          <p className="mt-1 text-sm text-muted">Point-in-time data across the networks you selected.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-line bg-panel/60 px-3 py-1.5 text-xs text-muted">
          <Radio size={12} className="text-success" /> Synced {new Date(portfolio.capturedAt).toLocaleTimeString()}
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={WalletCards} label="Estimated net worth" value={usd(portfolio.totalUsd)} accent />
        <Metric icon={Layers3} label="Networks" value={String(portfolio.chains.length)} copy="Selected chains" />
        <Metric icon={Coins} label="Assets found" value={String(portfolio.chains.reduce((sum, chain) => sum + chain.assets.length, 0))} copy="Actual balances" />
        <Metric icon={Box} label="Transactions read" value={String(activity.items.length)} copy="Explorer coverage" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
        <article className="glass-panel p-5 sm:p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="eyebrow">Asset allocation</p>
              <h3 className="mt-2 font-medium">Portfolio composition</h3>
            </div>
            <span className="rounded-lg border border-line px-2 py-1 text-[10px] text-muted">{portfolio.valuationCoverage} pricing</span>
          </div>
          <div className="relative mt-2 h-56">
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted">Priced value</p>
                <p className="mt-1 font-mono text-lg">{usd(portfolio.totalUsd)}</p>
              </div>
            </div>
            {chart.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chart} dataKey="value" nameKey="name" innerRadius={72} outerRadius={94} paddingAngle={3} stroke="none">
                    {chart.map((slice, index) => <Cell key={slice.name} fill={colors[index % colors.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#0d1020', border: '1px solid rgba(150,164,220,.2)', borderRadius: 12 }} formatter={(value: number) => usd(String(value))} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="pt-20 text-center text-sm text-muted">No priced allocation yet.</p>}
          </div>
          <div className="grid gap-2">
            {portfolio.allocation.slice(0, 5).map((slice, index) => (
              <div key={`${slice.key}-${slice.chainName}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 text-xs">
                <span className="h-2 w-2 rounded-full" style={{ background: colors[index % colors.length] }} />
                <span><span className="font-medium">{slice.symbol}</span> <span className="text-muted">· {slice.chainName}</span></span>
                <span className="font-mono text-muted">{percent(slice.shareBps)}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="glass-panel overflow-hidden">
          <div className="flex items-start justify-between border-b border-line p-5 sm:p-6">
            <div>
              <p className="eyebrow">Holdings</p>
              <h3 className="mt-2 font-medium">Assets across networks</h3>
            </div>
            <span className="text-xs text-muted">{portfolio.chains.reduce((sum, chain) => sum + chain.assets.length, 0)} assets</span>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[620px]">
              <div className="grid grid-cols-[1.3fr_.8fr_.8fr_.8fr] gap-3 border-b border-line px-5 py-3 text-[10px] uppercase tracking-wider text-muted sm:px-6">
                <span>Asset</span><span>Network</span><span className="text-right">Balance</span><span className="text-right">Value</span>
              </div>
              {portfolio.chains.flatMap((chain) => chain.assets.map((asset) => ({ ...asset, chain }))).slice(0, 10).map(({ chain, ...asset }, index) => (
                <div key={`${chain.chainId}-${asset.tokenAddress}`} className="grid grid-cols-[1.3fr_.8fr_.8fr_.8fr] items-center gap-3 border-b border-line/60 px-5 py-3.5 text-sm last:border-0 sm:px-6">
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-full text-xs font-semibold" style={{ background: `${colors[index % colors.length]}22`, color: colors[index % colors.length] }}>{asset.symbol.slice(0, 2)}</span>
                    <div><p className="font-medium">{asset.symbol}</p><p className="font-mono text-[10px] text-muted">{asset.isNative ? 'Native asset' : shortAddress(asset.tokenAddress)}</p></div>
                  </div>
                  <span className="text-xs text-muted">{chain.chainName}</span>
                  <span className="text-right font-mono text-xs">{asset.displayBalance}</span>
                  <span className="text-right font-mono text-xs">{usd(asset.valueUsd)}</span>
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.3fr_.7fr]">
        <article className="glass-panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-line p-5">
            <div><p className="eyebrow">Activity feed</p><h3 className="mt-2 font-medium">Recent on-chain activity</h3></div>
            <AssessmentBadge overall={activity.items.some((item) => item.contractVerified === false) ? 'review_recommended' : 'incomplete'} />
          </div>
          <div>
            {activity.items.slice(0, 6).map((item) => (
              <Link key={`${item.chainId}:${item.hash}`} href={`/tx/${item.chainId}/${item.hash}?address=${bundle.portfolio.address}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-line/60 px-5 py-4 transition last:border-0 hover:bg-white/[0.025]">
                <span className={`grid h-9 w-9 place-items-center rounded-xl ${item.direction === 'in' ? 'bg-success/10 text-success' : 'bg-signal/10 text-[#9e8cff]'}`}>
                  {item.direction === 'in' ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}
                </span>
                <div className="min-w-0"><p className="truncate text-sm">{item.summary}</p><p className="mt-1 font-mono text-[10px] text-muted">{item.chainName} · {shortAddress(item.hash)}</p></div>
                <div className="text-right"><p className="font-mono text-xs">{item.feeDisplay ? `${item.feeDisplay} ${item.nativeSymbol}` : '—'}</p><p className="mt-1 text-[10px] uppercase text-muted">{item.status}</p></div>
              </Link>
            ))}
            {activity.items.length === 0 ? <p className="p-5 text-sm text-muted">No activity returned by the selected explorers.</p> : null}
          </div>
        </article>

        <div className="grid gap-4">
          {portfolio.chains.map((chain) => (
            <article key={chain.chainId} className="data-card p-5">
              <div className="flex items-start justify-between">
                <div><p className="eyebrow">Network</p><h3 className="mt-2 font-medium">{chain.chainName}</h3></div>
                <span className={`rounded-full px-2.5 py-1 text-[10px] uppercase ${chain.status === 'ok' ? 'bg-success/10 text-success' : 'bg-amber/10 text-amber'}`}>{chain.status}</span>
              </div>
              <p className="mt-5 font-mono text-xl">{chain.status === 'unavailable' ? 'Unavailable' : usd(chain.totalUsd)}</p>
              <div className="mt-4 flex items-center justify-between text-xs text-muted">
                <span>{chain.assets.length} assets</span>
                <a className="flex items-center gap-1 hover:text-text" href={chain.explorerUrl} target="_blank" rel="noreferrer">Explorer <ExternalLink size={11} /></a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <details className="data-card p-5 text-sm text-muted">
        <summary className="cursor-pointer font-medium text-text">Data coverage & limitations</summary>
        <p className="mt-3 max-w-3xl">
            Price coverage is {portfolio.valuationCoverage}.{' '}
            {discoveryPartial
              ? 'Some networks did not return a full token list. The total includes only balances that were actually read, and the notes below say which networks are partial.'
              : 'Unpriced tokens stay visible and are left out of the total instead of being given a guessed price.'}
        </p>
        <ul className="mt-3 grid gap-2 text-xs">{portfolio.limitations.map((item) => <li key={item}>• {item}</li>)}</ul>
      </details>
    </div>
  )
}

function Metric({ icon: Icon, label, value, copy, accent = false }: { icon: typeof WalletCards; label: string; value: string; copy?: string; accent?: boolean }) {
  return (
    <div className={`data-card relative overflow-hidden p-5 ${accent ? 'border-signal/30 bg-signal/[0.08]' : ''}`}>
      {accent ? <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-signal/20 blur-2xl" /> : null}
      <div className="flex items-center justify-between"><p className="eyebrow">{label}</p><Icon size={17} className={accent ? 'text-[#a99dff]' : 'text-muted'} /></div>
      <p className={`mt-4 font-mono font-medium tracking-tight ${accent ? 'text-2xl' : 'text-3xl'}`}>{value}</p>
      {copy ? <p className="mt-1 text-xs text-muted">{copy}</p> : null}
    </div>
  )
}

export function shareLabel(bps: number) {
  return percent(bps)
}
