import { AddressForm } from '@/components/address-form'
import { Activity, ArrowUpRight, Bot, Braces, CheckCircle2, LockKeyhole, Network, Radar, ShieldCheck, WalletCards } from 'lucide-react'
import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="grid gap-6">
      <section className="relative overflow-hidden rounded-3xl border border-line bg-panel/65 px-6 py-10 shadow-panel sm:px-10 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12 lg:py-14">
        <div className="pointer-events-none absolute -right-36 -top-44 h-[420px] w-[420px] rounded-full bg-signal/20 blur-[110px]" />
        <div className="relative">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-signal/25 bg-signal/10 px-3 py-1.5 text-xs text-[#a99dff]">
            <span className="status-dot" /> Live multi-chain intelligence
          </div>
          <h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-6xl">
            See what your wallet
            <span className="block bg-gradient-to-r from-[#9e8cff] via-[#5ebcff] to-[#42e6c7] bg-clip-text text-transparent">is really doing.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-muted sm:text-lg">
            Turn balances, contract calls, approvals, and raw transactions into clear summaries with cited on-chain sources.
          </p>
          <div className="mt-7 flex flex-wrap gap-5 text-xs text-muted">
            <span className="flex items-center gap-2"><LockKeyhole size={14} className="text-success" /> No wallet connection</span>
            <span className="flex items-center gap-2"><ShieldCheck size={14} className="text-success" /> Read only</span>
            <span className="flex items-center gap-2"><CheckCircle2 size={14} className="text-success" /> Source cited</span>
          </div>
        </div>

        <div className="relative mt-10 lg:mt-0">
          <div className="absolute -inset-5 rounded-[32px] bg-signal/10 blur-2xl" />
          <div className="relative rounded-3xl border border-signal/25 bg-[#090b18]/90 p-5 shadow-glow backdrop-blur-xl sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="eyebrow">Analyze public wallet</p>
                <p className="mt-1 text-sm text-muted">Address or ENS · no signature required</p>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-signal/15 text-[#a99dff]"><Radar size={20} /></span>
            </div>
            <AddressForm />
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { title: 'Portfolio intelligence', copy: 'Multi-chain balances, allocation, and estimated valuation.', icon: WalletCards, tone: 'text-[#9e8cff] bg-signal/10' },
          { title: 'Transaction decoding', copy: 'Calldata, event context, gas, and plain-language summaries.', icon: Braces, tone: 'text-cyan bg-cyan/10' },
          { title: 'Contract risk', copy: 'Verification, metadata, approvals, and traceable evidence.', icon: ShieldCheck, tone: 'text-rose bg-rose/10' },
          { title: 'Natural language explainer', copy: 'Answers tied to retrieved on-chain fields and stated limits.', icon: Bot, tone: 'text-success bg-success/10' },
        ].map(({ title, copy, icon: Icon, tone }) => (
          <article key={title} className="data-card group p-5">
            <span className={`grid h-11 w-11 place-items-center rounded-xl ${tone}`}><Icon size={20} /></span>
            <h2 className="mt-5 text-base font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{copy}</p>
            <ArrowUpRight size={16} className="mt-5 text-muted transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-text" />
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.38fr]">
        <div className="data-card grid gap-5 p-6 sm:grid-cols-3">
          {[
            ['2', 'Initial networks', 'Ethereum & Base'],
            ['0', 'Transactions signed', 'Analysis is read-only'],
            ['Strict', 'Explainer guardrails', 'Unknown hashes rejected'],
          ].map(([value, label, copy]) => (
            <div key={label} className="border-b border-line pb-4 last:border-0 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-5 sm:last:border-0">
              <p className="metric-value">{value}</p>
              <p className="mt-2 text-sm font-medium">{label}</p>
              <p className="mt-1 text-xs text-muted">{copy}</p>
            </div>
          ))}
        </div>
        <Link href="/product" className="data-card flex items-center justify-between gap-4 p-6 hover:bg-signal/[0.06]">
          <div>
            <p className="eyebrow">Product concept</p>
            <p className="mt-2 font-medium">Wallet Intelligence Center</p>
          </div>
          <Network className="text-[#9e8cff]" />
        </Link>
      </section>
      <p className="flex items-center gap-2 text-xs text-muted"><Activity size={13} /> Educational analytics only. No custody, signing, trading, or investment recommendations.</p>
    </div>
  )
}
