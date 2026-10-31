'use client'

import {
  Activity,
  ChartNoAxesCombined,
  CircleUserRound,
  ExternalLink,
  Gauge,
  LockKeyhole,
  Radar,
  Search,
  ShieldCheck,
  MessageSquareText,
  WalletCards,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navigation = [
  { href: '/', label: 'Overview', icon: Gauge },
  { href: '/assistant', label: 'Explainer', icon: MessageSquareText },
  { href: '/product', label: 'Intelligence Center', icon: ShieldCheck },
  { href: '/account', label: 'Profile & privacy', icon: CircleUserRound },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const walletArea = pathname.startsWith('/wallet') || pathname.startsWith('/tx') || pathname.startsWith('/contract')

  return (
    <div className="relative min-h-screen lg:grid lg:grid-cols-[228px_minmax(0,1fr)]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[228px] flex-col border-r border-line bg-[#070812]/95 px-4 py-5 backdrop-blur-xl lg:flex">
        <Link href="/" className="flex items-center gap-3 px-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-signal text-white shadow-glow">
            <Radar size={20} />
          </span>
          <span>
            <strong className="block text-lg tracking-tight">ChainLens</strong>
            <span className="eyebrow block text-[8px] text-signal">Web3 intelligence</span>
          </span>
        </Link>

        <div className="mt-8 border-t border-line pt-6">
          <p className="eyebrow px-3">Workspace</p>
          <nav className="mt-3 grid gap-1">
            {navigation.map((item) => {
              const active = item.href === '/' ? pathname === '/' || walletArea : pathname.startsWith(item.href)
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                    active ? 'bg-signal/15 text-text ring-1 ring-inset ring-signal/20' : 'text-muted hover:bg-white/[0.035] hover:text-text'
                  }`}
                >
                  <Icon size={17} className={active ? 'text-[#9c8cff]' : ''} />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="mt-7 border-t border-line pt-6">
          <p className="eyebrow px-3">Protocol status</p>
          <div className="mt-3 grid gap-3 rounded-2xl border border-line bg-white/[0.025] p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">API</span>
              <span className="flex items-center gap-2 text-success"><span className="status-dot" /> Online</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">Mode</span>
              <span className="flex items-center gap-1.5 text-text"><LockKeyhole size={12} /> Read only</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">Networks</span>
              <span className="text-text">ETH · Base</span>
            </div>
          </div>
        </div>

        <div className="mt-auto rounded-2xl border border-signal/20 bg-signal/[0.08] p-4">
          <ShieldCheck size={17} className="text-[#9c8cff]" />
          <p className="mt-3 text-sm font-medium">Signals, not scores</p>
          <p className="mt-1 text-xs leading-5 text-muted">Warnings link to the field that triggered them.</p>
          <Link href="/product" className="mt-3 inline-flex items-center gap-1 text-xs text-[#a89bff]">
            Product concept <ExternalLink size={11} />
          </Link>
        </div>
      </aside>

      <div className="lg:col-start-2">
        <header className="sticky top-0 z-30 border-b border-line bg-ink/80 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-4 px-4 sm:px-6 lg:px-8">
            <Link href="/" className="flex items-center gap-2 lg:hidden">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-signal"><Radar size={17} /></span>
              <strong>ChainLens</strong>
            </Link>
            <div className="mx-auto hidden max-w-xl flex-1 items-center gap-3 rounded-xl border border-line bg-white/[0.025] px-4 py-2 text-sm text-muted md:flex">
              <Search size={15} />
              <span>Search public wallet, ENS, or transaction hash</span>
              <span className="ml-auto rounded-md border border-line px-1.5 py-0.5 font-mono text-[10px]">READ ONLY</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="hidden items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs text-muted sm:flex">
                <span className="status-dot" /> Live chain data
              </span>
              <Link href="/account" className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-white/[0.025] text-muted hover:text-text">
                <CircleUserRound size={17} />
              </Link>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:hidden">
            {[
              { href: '/', label: 'Dashboard', icon: ChartNoAxesCombined },
              { href: '/assistant', label: 'Explain', icon: Activity },
              { href: '/product', label: 'Security', icon: ShieldCheck },
              { href: '/account', label: 'Profile', icon: WalletCards },
            ].map((item) => (
              <Link key={item.href} href={item.href} className="flex shrink-0 items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs text-muted">
                <item.icon size={14} /> {item.label}
              </Link>
            ))}
          </nav>
        </header>

        <main className="relative mx-auto min-h-[calc(100vh-64px)] max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  )
}
