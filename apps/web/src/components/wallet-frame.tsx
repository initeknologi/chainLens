'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, Bot, History, LayoutDashboard, RefreshCw, ShieldCheck } from 'lucide-react'
import { useWallet } from './wallet-provider'
import { shortAddress } from '@/lib/api'

const links = [
  { href: '', label: 'Portfolio', icon: LayoutDashboard },
  { href: '/activity', label: 'Activity', icon: History },
  { href: '/approvals', label: 'Approvals', icon: ShieldCheck },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
]

export function WalletFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { address, bundle, isLoading, error, refetch, chainIds } = useWallet()
  const base = `/wallet/${address}`
  const showLoading = isLoading
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2"><span className="status-dot" /><p className="eyebrow">Active wallet</p></div>
          <h1 className="mt-2 font-mono text-sm text-text sm:text-lg">{bundle?.portfolio.ensName ?? shortAddress(bundle?.portfolio.address ?? decodeURIComponent(address))}</h1>
          <p className="mt-1 font-mono text-[10px] text-muted">{bundle?.portfolio.address ?? decodeURIComponent(address)}</p>
        </div>
        <button onClick={refetch} className="web3-button-secondary" type="button">
          <RefreshCw size={14} /> Refresh data
        </button>
      </div>
      <nav className="flex gap-1 overflow-auto rounded-xl border border-line bg-panel/50 p-1">
        {links.map((link) => {
          const href = `${base}${link.href}`
          const active = pathname === href
          const Icon = link.icon
          return (
            <Link
              key={link.label}
              href={href}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition ${active ? 'bg-signal/15 text-[#b5abff]' : 'text-muted hover:bg-white/[0.025] hover:text-text'}`}
            >
              <Icon size={14} /> {link.label}
            </Link>
          )
        })}
        <Link href={`/assistant?address=${address}`} className="ml-auto flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-muted hover:bg-white/[0.025] hover:text-text">
          <Bot size={14} /> Ask AI
        </Link>
      </nav>
      {showLoading ? (
        <section className="glass-panel overflow-hidden p-8">
          <div className="mb-5 h-1 overflow-hidden rounded-full bg-line"><div className="h-full w-1/2 animate-pulse rounded-full bg-signal" /></div>
          <p className="text-2xl font-semibold">Reading {chainIds.length === 1 ? 'one network' : `${chainIds.length} networks`}.</p>
          <p className="mt-3 max-w-xl text-muted">
            ChainLens is requesting public balances and recent transactions for the networks you selected. Nothing is signed, and the address is stored only if you chose to save it.
          </p>
        </section>
      ) : null}
      {error ? (
        <section className="rounded-2xl border border-rose/30 bg-rose/[0.06] p-6">
          <p className="text-rose">{error.message}</p>
          <p className="mt-2 text-sm text-muted">Short address shown as {shortAddress(decodeURIComponent(address))}.</p>
        </section>
      ) : null}
      {!showLoading && !error ? children : null}
    </div>
  )
}
