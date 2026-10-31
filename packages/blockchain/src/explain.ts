import type { ActivityItem, Evidence, Explanation, RiskAssessment, TransactionReport } from '@chainlens/shared-types'

const SHARED_LIMITATIONS = [
  'This explanation is produced from retrieved on-chain data and explorer fields. It is not a security guarantee.',
  'ChainLens does not recommend buying, selling, revoking, or signing anything.',
]

export function explainTransaction(question: string, report: Pick<TransactionReport, 'item' | 'risk' | 'contract'>): Explanation {
  const item = report.item
  const asked = question.trim() || 'What happened in this transaction?'
  const normalized = asked.toLowerCase()
  const evidence = evidenceFor(item, report.risk)
  let answer: string
  if (normalized.includes('gas')) {
    answer = explainGas(item)
  } else if (normalized.includes('flag') || normalized.includes('risk') || normalized.includes('why')) {
    answer = explainRisk(report.risk)
  } else if (normalized.includes('contract')) {
    answer = explainContract(item, report.contract?.name ?? item.contractName, report.contract?.verified ?? item.contractVerified)
  } else {
    answer = explainWhatHappened(item)
  }
  return {
    question: asked,
    answer,
    evidence,
    limitations: [...SHARED_LIMITATIONS, ...report.risk.limitations],
    sources: [...new Set(evidence.map((itemEvidence) => itemEvidence.source))],
    mode: 'deterministic',
  }
}

function evidenceFor(item: ActivityItem, risk: RiskAssessment): Evidence[] {
  const rows: Evidence[] = [
    { label: 'Transaction', value: item.hash, source: 'transaction record' },
    { label: 'Network', value: `${item.chainName} (${item.chainId})`, source: 'network configuration' },
    { label: 'Status', value: item.status, source: 'transaction receipt' },
    { label: 'Type', value: item.type, source: 'decoded call or value transfer' },
  ]
  if (item.gasUsed) rows.push({ label: 'Gas used', value: item.gasUsed, source: 'transaction receipt' })
  if (item.gasPrice) rows.push({ label: 'Gas price wei', value: item.gasPrice, source: 'transaction receipt' })
  if (item.feeDisplay) rows.push({ label: 'Fee', value: `${item.feeDisplay} ${item.nativeSymbol}`, source: 'transaction receipt' })
  for (const signal of risk.signals) rows.push(...signal.evidence)
  return rows
}

function explainWhatHappened(item: ActivityItem): string {
  const when = `Block ${item.blockNumber} at ${item.timestamp}.`
  const status = item.status === 'success' ? 'The receipt status is success.' : item.status === 'failed' ? 'The receipt status is failed.' : 'The receipt status was not available.'
  return `${item.summary} ${when} ${status}`
}

function explainGas(item: ActivityItem): string {
  if (!item.gasUsed || !item.gasPrice || !item.feeDisplay) {
    return 'Gas details are incomplete for this transaction. ChainLens will not estimate a fee that is not present on the receipt.'
  }
  const usd = item.feeUsd ? ` Using the native-token exchange rate attached to the source record, that fee is about $${item.feeUsd}.` : ' No exchange rate was attached, so a USD figure is not shown.'
  return `The receipt reports ${item.gasUsed} gas used and a gas price of ${item.gasPrice} wei. The fee is gas used multiplied by gas price, which the source reports as ${item.feeDisplay} ${item.nativeSymbol}.${usd}`
}

function explainContract(item: ActivityItem, name: string | null, verified: boolean | null): string {
  if (!item.to) return 'This transaction created a contract. ChainLens does not infer the behavior of the deployed bytecode.'
  const label = name ? `${name} (${item.to})` : item.to
  const verification =
    verified == null
      ? 'Verification status was not available, so what the contract does cannot be stated from source code.'
      : verified
        ? 'The explorer reports the contract source as verified. Read that source for behavior. Verification is not a safety guarantee.'
        : 'The explorer does not report this contract as verified, so ChainLens cannot describe its behavior from published source.'
  const method = item.method ? ` The called method recorded here is ${item.method}.` : ' The call could not be decoded to a method name.'
  return `The transaction interacted with ${label}. ${verification}${method}`
}

function explainRisk(risk: RiskAssessment): string {
  if (risk.signals.length === 0) {
    return 'No review signal was produced from the checks that ran. That is not a statement that the transaction is safe. Checks that did not return data stay incomplete.'
  }
  const lines = risk.signals.map((item) => `${item.title}: ${item.explanation}`)
  return `${risk.headline}. ${lines.join(' ')}`
}

export function hashesInText(value: string): string[] {
  return value.match(/0x[a-fA-F0-9]{64}/g) ?? []
}

export function explanationIntroducesUnknownHash(answer: string, allowed: string[]): boolean {
  const allow = new Set(allowed.map((hash) => hash.toLowerCase()))
  return hashesInText(answer).some((hash) => !allow.has(hash.toLowerCase()))
}
