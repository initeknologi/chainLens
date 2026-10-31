import type { Assessment, Evidence, RiskSeverity } from '@chainlens/shared-types'
import { headlineFor } from '@chainlens/shared-types'

const tone: Record<Assessment, string> = {
  review_recommended: 'bg-amber/15 text-amber border-amber/30',
  incomplete: 'bg-blue/10 text-blue border-blue/30',
  no_issue_observed: 'bg-signal/10 text-signal border-signal/30',
}

export function AssessmentBadge({ overall }: { overall: Assessment }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium tracking-wide ${tone[overall]}`}>
      {headlineFor(overall)}
    </span>
  )
}

const severityTone: Record<RiskSeverity, string> = {
  informational: 'text-blue',
  warning: 'text-amber',
  critical: 'text-rose',
}

export function SeverityLabel({ severity }: { severity: RiskSeverity }) {
  return <span className={`text-xs uppercase tracking-[0.14em] ${severityTone[severity]}`}>{severity}</span>
}

export function EvidenceList({ items }: { items: Evidence[] }) {
  if (items.length === 0) return null
  return (
    <dl className="grid gap-3">
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`} className="grid gap-1 border-t border-line pt-3">
          <dt className="text-xs uppercase tracking-[0.16em] text-muted">{item.label}</dt>
          <dd className="break-all font-mono text-sm text-text">{item.value}</dd>
          <dd className="text-xs text-muted">Source: {item.source}</dd>
        </div>
      ))}
    </dl>
  )
}
