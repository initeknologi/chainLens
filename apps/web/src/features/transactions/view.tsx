'use client'

import type { ActivityReport } from '@chainlens/shared-types'
import { ArrowDownLeft, ArrowLeft, ArrowRight, ArrowUpRight, ExternalLink, Fuel, Radio, ScrollText } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { shortAddress, usd } from '@/lib/api'

export function ActivityView({ report, address }: { report: ActivityReport; address: string }) {
  const [page, setPage] = useState(1)
  const pageSize = 10
  const start = (page - 1) * pageSize
  const items = report.items.slice(start, start + pageSize)
  const pages = Math.max(1, Math.ceil(report.items.length / pageSize))
  return (
    <div className="grid gap-5">
      <div><p className="eyebrow">On-chain history</p><h2 className="mt-2 text-2xl font-semibold">Wallet activity</h2><p className="mt-1 text-sm text-muted">Decoded transactions and gas usage from available explorer pages.</p></div>
      <section className="grid gap-4 md:grid-cols-2">
        {report.gas.byChain.map((chain) => (
          <article key={chain.chainId} className="data-card p-5">
            <div className="flex items-center justify-between"><p className="eyebrow">{chain.chainName} gas usage</p><Fuel size={17} className="text-amber" /></div>
            <p className="mt-4 font-mono text-2xl">
              {chain.totalFeeDisplay} {chain.nativeSymbol}
            </p>
            <p className="mt-2 text-xs text-muted">
              {chain.sampleSize} transactions · {usd(chain.totalFeeUsd)}
            </p>
          </article>
        ))}
      </section>
      <section className="glass-panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-line p-5"><div><p className="eyebrow">Transaction timeline</p><h3 className="mt-2 font-medium">{report.items.length} records analyzed</h3></div><Radio size={17} className="text-success" /></div>
        {items.map((item) => (
          <article key={`${item.chainId}:${item.hash}`} className="border-b border-line/60 p-5 transition last:border-0 hover:bg-white/[0.02]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className={`grid h-9 w-9 place-items-center rounded-xl ${item.direction === 'in' ? 'bg-success/10 text-success' : 'bg-signal/10 text-[#a99dff]'}`}>{item.direction === 'in' ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}</span>
                <p className="max-w-3xl text-sm">{item.summary}</p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.14em] ${item.status === 'failed' ? 'border-rose/40 text-rose' : 'border-line text-muted'}`}>
                {item.status} · {item.type.replaceAll('_', ' ')}
              </span>
            </div>
            <p className="mt-3 font-mono text-xs text-muted">
              {item.chainName} · {shortAddress(item.hash)} · block {item.blockNumber} · {new Date(item.timestamp).toLocaleString()}
            </p>
            <div className="mt-3 flex flex-wrap gap-4 pl-12 text-xs">
              <Link className="flex items-center gap-1 text-[#9e8cff]" href={`/tx/${item.chainId}/${item.hash}?address=${address}`}>
                <ScrollText size={12} /> Read explanation
              </Link>
              {item.explorerUrl ? (
                <a className="flex items-center gap-1 text-muted hover:text-text" href={item.explorerUrl} target="_blank" rel="noreferrer">
                  Explorer <ExternalLink size={11} />
                </a>
              ) : null}
              {item.to ? (
                <Link className="text-muted hover:text-text" href={`/contract/${item.chainId}/${item.to}`}>
                  Contract
                </Link>
              ) : null}
            </div>
          </article>
        ))}
        {items.length === 0 ? <p className="p-6 text-sm text-muted">No recent transactions were returned for the selected networks.</p> : null}
        <div className="flex items-center justify-between border-t border-line p-4 text-xs text-muted">
          <span>
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            <button type="button" className="web3-button-secondary px-3 py-1.5" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>
              <ArrowLeft size={12} /> Previous
            </button>
            <button type="button" className="web3-button-secondary px-3 py-1.5" onClick={() => setPage((current) => Math.min(pages, current + 1))} disabled={page === pages}>
              Next <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </section>
      <ul className="grid gap-2 text-xs text-muted">
        {[...report.limitations, ...report.gas.limitations].map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}
