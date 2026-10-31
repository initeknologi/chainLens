import type { Metadata } from 'next'
import { Activity, Bot, BrainCircuit, ChevronRight, Eye, Fingerprint, KeyRound, ShieldCheck } from 'lucide-react'

export const metadata: Metadata = { title: 'Wallet Intelligence Center · ChainLens' }

export default function ProductPage() {
  return (
    <main className="grid gap-6">
      <section className="relative overflow-hidden rounded-3xl border border-signal/20 bg-panel/70 p-8 shadow-glow sm:p-10">
        <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-signal/20 blur-[100px]" />
        <div className="relative max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-signal/25 bg-signal/10 px-3 py-1.5 text-xs text-[#a99dff]"><BrainCircuit size={13} /> Product concept</div>
        <h1 className="mt-5 text-4xl font-semibold tracking-[-0.04em] sm:text-6xl">Wallet Intelligence <span className="text-[#9e8cff]">Center</span></h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-muted">
          An activity-understanding layer for self-custody wallets. ChainLens is the reference implementation: read-only, public data, no signing.
        </p>
        <div className="mt-7 flex flex-wrap gap-3"><span className="web3-button"><BrainCircuit size={16} /> Explore the concept</span><span className="web3-button-secondary"><Eye size={15} /> Source-first UX</span></div>
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          { title: 'Wallet health', copy: 'Checked signals with evidence and explicit uncertainty.', icon: ShieldCheck },
          { title: 'Activity intelligence', copy: 'Human-readable sends, approvals, swaps, and calls.', icon: Activity },
          { title: 'Contract insights', copy: 'Verification, delegation, owner, and metadata.', icon: Fingerprint },
          { title: 'Approval awareness', copy: 'Current allowance separated from event history.', icon: KeyRound },
          { title: 'Wallet assistant', copy: 'Answers cite retrieved fields; invented hashes are dropped.', icon: Bot },
        ].map(({ title, copy, icon: Icon }) => (
          <article key={title} className="data-card group p-5">
            <Icon size={20} className="text-[#9e8cff]" />
            <h2 className="mt-5 font-medium">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{copy}</p>
            <ChevronRight size={15} className="mt-5 text-muted group-hover:text-text" />
          </article>
        ))}
      </section>
      <section className="glass-panel grid gap-8 p-6 lg:grid-cols-[.4fr_.6fr] lg:p-8">
        <div><p className="eyebrow">User journey</p><h2 className="mt-3 text-2xl font-semibold">From opaque activity to informed attention</h2><p className="mt-3 text-sm leading-6 text-muted">The product does not make decisions for the user. It makes the available data legible.</p></div>
        <ol className="grid gap-3">
          {['Open Wallet Intelligence','Send the public address only','Read balances, activity, and metadata','Attach cited sources','Explain what deserves attention'].map((step, index) => <li key={step} className="flex items-center gap-4 rounded-xl border border-line bg-white/[0.02] p-3 text-sm"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-signal/15 font-mono text-xs text-[#a99dff]">0{index + 1}</span>{step}</li>)}
        </ol>
      </section>
      <section className="data-card p-6 text-sm leading-6 text-muted">
        <p className="eyebrow mb-3">Scope</p>
        <p>
          Wallet Intelligence Center sits beside existing wallet security features and focuses on comprehension: what happened, which fields support a warning, and what the indexer cannot know yet.
        </p>
        <p className="mt-3 text-text">Prototype boundary: EVM chains only, read-only public data, no signing, and no arbitrary risk score.</p>
      </section>
    </main>
  )
}
