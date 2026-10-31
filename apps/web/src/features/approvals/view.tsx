'use client'

import { AssessmentBadge, EvidenceList, SeverityLabel } from '@chainlens/ui'
import type { ApprovalReport } from '@chainlens/shared-types'
import { AlertTriangle, CheckCircle2, KeyRound, ShieldCheck } from 'lucide-react'
import { shortAddress } from '@/lib/api'

export function ApprovalsView({ report }: { report: ApprovalReport }) {
  return (
    <div className="grid gap-5">
      <div><p className="eyebrow">Permission intelligence</p><h2 className="mt-2 text-2xl font-semibold">Token approvals</h2><p className="mt-1 text-sm text-muted">Current allowances are separated from historical approval events.</p></div>
      <section className="grid gap-4 sm:grid-cols-3">
        <Summary icon={KeyRound} label="Approvals observed" value={String(report.items.length)} />
        <Summary icon={AlertTriangle} label="Needs review" value={String(report.items.filter((item) => item.risk.overall === 'review_recommended').length)} warning />
        <Summary icon={CheckCircle2} label="Current reads" value={String(report.items.filter((item) => item.asOf === 'current').length)} />
      </section>
      {report.items.length === 0 ? (
        <section className="glass-panel p-8">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-success/10 text-success"><ShieldCheck /></span>
          <h2 className="mt-5 text-xl font-semibold">No approval found in the indexed data</h2>
          <p className="mt-3 max-w-2xl text-sm text-muted">
            That does not mean the wallet has zero allowances. ChainLens only reports approvals it can point to in decoded calls or an explorer feed.
          </p>
        </section>
      ) : null}
      {report.items.map((item) => (
        <article key={`${item.chainId}:${item.tokenAddress}:${item.spender}`} className="glass-panel overflow-hidden">
          <div className={`h-1 ${item.risk.overall === 'review_recommended' ? 'bg-amber' : item.asOf === 'current' ? 'bg-success' : 'bg-blue'}`} />
          <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-signal/10 text-sm font-semibold text-[#a99dff]">{(item.tokenSymbol ?? '??').slice(0, 2)}</span>
              <div>
              <h2 className="font-medium">{item.tokenSymbol ?? shortAddress(item.tokenAddress)}</h2>
              <p className="font-mono text-xs text-muted">
                {item.chainName} · spender {shortAddress(item.spender)}
                {item.observedAtBlock ? ` · block ${item.observedAtBlock}` : ''}
              </p>
              </div>
            </div>
            <AssessmentBadge overall={item.risk.overall} />
          </div>
          <p className="mt-4 text-sm text-muted">
            {item.asOf === 'current'
              ? 'This allowance was read with allowance() at the block above.'
              : 'This is a historical approval event. It is not treated as the permission in place now.'}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wider ${item.asOf === 'current' ? 'bg-success/10 text-success' : 'bg-blue/10 text-blue'}`}>{item.asOf}</span>
            {item.risk.signals.map((signal) => (
              <SeverityLabel key={signal.id} severity={signal.severity} />
            ))}
          </div>
          <div className="mt-4">
            <EvidenceList items={item.risk.signals.flatMap((signal) => signal.evidence)} />
          </div>
          </div>
        </article>
      ))}
      <ul className="grid gap-2 text-sm text-muted">
        {report.limitations.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function Summary({ icon: Icon, label, value, warning = false }: { icon: typeof KeyRound; label: string; value: string; warning?: boolean }) {
  return <article className="data-card p-5"><div className="flex items-center justify-between"><p className="eyebrow">{label}</p><Icon size={17} className={warning ? 'text-amber' : 'text-[#9e8cff]'} /></div><p className="mt-4 font-mono text-3xl">{value}</p></article>
}
