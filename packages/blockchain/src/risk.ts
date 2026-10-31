import {
  combineAssessments,
  headlineFor,
  type Evidence,
  type RiskAssessment,
  type RiskSeverity,
  type RiskSignal,
} from '@chainlens/shared-types'
import { isUnlimitedAllowance } from './money'

export interface TokenMetadataInput {
  name: string | null
  symbol: string | null
  decimals: number | null
  source: string
}

export interface ContractFactInput {
  address: string
  isContract: boolean | null
  verified: boolean | null
  proxyType: string | null
  sourceFlagged: boolean | null
  source: string
  owner?: string | null
  intelligenceFlag?: IntelligenceFlag | null
}

export interface ApprovalFactInput {
  tokenSymbol: string | null
  tokenAddress: string
  spender: string
  allowanceRaw: bigint
  source: string
  txHash: string | null
  asOf?: 'current' | 'historical' | 'transaction'
  blockNumber?: string | null
}

export interface IntelligenceFlag {
  source: string
  label: string
  value: string
}

function signal(input: Omit<RiskSignal, 'severity'> & { severity?: RiskSeverity }): RiskSignal {
  const severity = input.severity ?? (input.level === 'review' ? 'warning' : 'informational')
  return { ...input, severity }
}

export function assessTokenMetadata(input: TokenMetadataInput): RiskAssessment {
  const signals: RiskSignal[] = []
  const source = input.source
  if (!input.name || input.name.trim().length === 0) {
    signals.push(
      signal({
        id: 'token-name-missing',
        level: 'review',
        title: 'Token name is missing',
        explanation: 'The metadata source did not provide a token name. That makes the asset harder to identify.',
        evidence: [{ label: 'Name', value: input.name ?? '(empty)', source }],
        limitations: ['A missing name is not proof that the token is malicious.'],
      }),
    )
  }
  if (!input.symbol || input.symbol.trim().length === 0 || input.symbol.length > 12 || /\s/.test(input.symbol)) {
    signals.push(
      signal({
        id: 'token-symbol-unusual',
        level: 'review',
        title: 'Token symbol looks unusual',
        explanation: 'The symbol is empty, unusually long, or contains spaces. Compare it with a source you already trust before treating it as a familiar asset.',
        evidence: [{ label: 'Symbol', value: input.symbol ?? '(empty)', source }],
        limitations: ['Unusual metadata is a prompt to look closer, not a verdict.'],
      }),
    )
  }
  if (input.decimals == null || input.decimals < 0 || input.decimals > 36) {
    signals.push(
      signal({
        id: 'token-decimals-unusual',
        level: 'review',
        title: 'Token decimals are unusual or missing',
        explanation: 'Balance display depends on decimals. A missing or extreme value means the displayed amount may not be meaningful.',
        evidence: [{ label: 'Decimals', value: input.decimals == null ? '(missing)' : String(input.decimals), source }],
        limitations: ['Some legitimate tokens use uncommon decimals.'],
      }),
    )
  }
  return finish(signals, ['Metadata was read from the indexed source. ChainLens does not score tokens.'])
}

export function assessContract(input: ContractFactInput): RiskAssessment {
  const signals: RiskSignal[] = []
  const evidenceBase: Evidence[] = [{ label: 'Contract', value: input.address, source: input.source }]
  if (input.isContract === false) {
    signals.push(
      signal({
        id: 'not-a-contract',
        level: 'info',
        title: 'No contract code observed',
        explanation: 'The address did not present contract bytecode in the source used for this check.',
        evidence: evidenceBase,
        limitations: ['An externally owned account can later delegate code, for example through EIP-7702.'],
      }),
    )
  }
  if (input.isContract == null || input.verified == null) {
    signals.push(
      signal({
        id: 'verification-unknown',
        level: 'incomplete',
        title: 'Contract verification was not available',
        explanation: 'ChainLens could not confirm whether this contract source is verified. The assessment stays incomplete.',
        evidence: evidenceBase,
        limitations: ['A failed lookup is not evidence that the contract is benign or harmful.'],
      }),
    )
  } else if (input.isContract && input.verified === false) {
    signals.push(
      signal({
        id: 'contract-unverified',
        level: 'review',
        title: 'Contract source is not verified',
        explanation: 'The explorer used for this check does not have a verified source match for this contract. You cannot read the published source from that explorer.',
        evidence: [...evidenceBase, { label: 'Verified', value: 'false', source: input.source }],
        limitations: ['Unverified does not mean the contract is malicious. Verified does not mean it is safe.'],
      }),
    )
  } else if (input.verified === true) {
    signals.push(
      signal({
        id: 'contract-verified',
        level: 'info',
        title: 'Contract source is verified on the explorer',
        explanation: 'The explorer reports a verified source match. That lets you read the published code. It is not a safety guarantee.',
        evidence: [...evidenceBase, { label: 'Verified', value: 'true', source: input.source }],
        limitations: ['Verified source can still be risky, upgradeable, or depend on other contracts.'],
      }),
    )
  }
  if (input.proxyType) {
    signals.push(
      signal({
        id: 'proxy-or-delegation',
        level: 'info',
        title: 'Proxy or delegated code detected',
        explanation: `The source reports proxy or delegation type "${input.proxyType}". The code that runs can differ from the address you see, and it may change.`,
        evidence: [...evidenceBase, { label: 'Proxy type', value: input.proxyType, source: input.source }],
        limitations: ['Delegation is common for wallets and upgradeable contracts. It still deserves a closer look.'],
      }),
    )
  }
  if (input.owner) {
    signals.push(
      signal({
        id: 'contract-owner',
        level: 'info',
        title: 'Contract owner was reported',
        explanation: 'A public owner() call returned an address. Ownership can change, and it is not a measure of whether the contract is safe.',
        evidence: [...evidenceBase, { label: 'Owner', value: input.owner, source: input.source }],
        limitations: ['Many contracts have no owner function. A missing owner is not evidence of safety or of a problem.'],
      }),
    )
  }
  if (input.sourceFlagged) {
    signals.push(
      signal({
        id: 'explorer-flag',
        level: 'review',
        severity: 'critical',
        title: 'Explorer reputation flag',
        explanation: 'The explorer marked this address with a scam or reputation warning. Review that source before interacting.',
        evidence: [...evidenceBase, { label: 'Explorer flag', value: 'present', source: input.source }],
        limitations: ['Explorer flags can be incomplete or wrong. ChainLens repeats the flag with its source. It does not create an independent score.'],
      }),
    )
  }
  if (input.intelligenceFlag) {
    signals.push(
      signal({
        id: 'intelligence-flag',
        level: 'review',
        severity: 'critical',
        title: 'Intelligence source reported a malicious indicator',
        explanation: `The intelligence source marked "${input.intelligenceFlag.label}" as present. Review that source. This is not an independent ChainLens score.`,
        evidence: [...evidenceBase, { label: input.intelligenceFlag.label, value: input.intelligenceFlag.value, source: input.intelligenceFlag.source }],
        limitations: ['A third-party flag can be incomplete or wrong. Absence of a flag is not proof of safety.'],
      }),
    )
  }
  return finish(signals, ['Contract checks use explorer verification, a public owner call when it succeeds, and an intelligence flag only when a provider returns one. They are not an audit.'])
}

export function assessApproval(input: ApprovalFactInput): RiskAssessment {
  const unlimited = isUnlimitedAllowance(input.allowanceRaw)
  const asOf = input.asOf ?? 'transaction'
  const evidence: Evidence[] = [
    { label: 'Token', value: input.tokenSymbol ? `${input.tokenSymbol} (${input.tokenAddress})` : input.tokenAddress, source: input.source },
    { label: 'Spender', value: input.spender, source: input.source },
    { label: 'Allowance raw', value: input.allowanceRaw.toString(), source: input.source },
    { label: 'As of', value: asOf, source: input.source },
  ]
  if (input.blockNumber) evidence.push({ label: 'Block', value: input.blockNumber, source: input.source })
  if (input.txHash) evidence.push({ label: 'Transaction', value: input.txHash, source: input.source })
  if (asOf === 'historical') {
    return finish(
      [
        signal({
          id: 'allowance-not-current',
          level: 'incomplete',
          title: 'Current allowance was not read',
          explanation: 'An approval event was seen, but the current allowance call did not succeed. That historical amount is not treated as the permission that exists now.',
          evidence,
          limitations: ['A failed allowance call is not proof the spender still has, or has lost, permission.'],
        }),
      ],
      ['ChainLens does not revoke approvals and does not tell you to revoke them.'],
    )
  }
  if (unlimited) {
    return finish(
      [
        signal({
          id: 'unlimited-approval',
          level: 'review',
          title: 'Unlimited or extremely large token approval',
          explanation:
            asOf === 'current'
              ? 'allowance() at the named block is large enough to treat as unlimited. The spender can move the token until that allowance changes. Review who the spender is.'
              : 'This transaction set an allowance large enough to treat as unlimited. That describes the transaction. It is not an allowance() read at a later block.',
          evidence,
          limitations: [
            'A large allowance is not proof the spender is malicious.',
            asOf === 'current'
              ? 'The figure is the allowance() result at the block named in the evidence, not a scan of every token.'
              : 'A transaction amount is not proof that the same allowance is still in place.',
          ],
        }),
      ],
      ['ChainLens does not revoke approvals and does not tell you to revoke them.'],
    )
  }
  return finish(
    [
      signal({
        id: 'limited-approval',
        level: 'info',
        title: 'Limited token approval observed',
        explanation: 'An approval was observed with a finite allowance. The raw amount is shown so you can compare it with the token decimals.',
        evidence,
        limitations: ['The allowance can change in a later transaction.'],
      }),
    ],
    ['Indexed approvals are not a complete picture of every spender.'],
  )
}

export function assessTransaction(input: {
  contract: ContractFactInput | null
  approval: ApprovalFactInput | null
  decoded: boolean
}): RiskAssessment {
  const parts: RiskAssessment[] = []
  if (input.contract) parts.push(assessContract(input.contract))
  if (input.approval) parts.push(assessApproval(input.approval))
  if (!input.decoded) {
    parts.push(
      finish(
        [
          signal({
            id: 'calldata-not-decoded',
            level: 'incomplete',
            title: 'Call data was not fully decoded',
            explanation: 'ChainLens does not have an ABI match for this call. The method selector is preserved, and the explanation does not guess the arguments.',
            evidence: [],
            limitations: ['Unknown calldata is incomplete information, not a risk score.'],
          }),
        ],
        [],
      ),
    )
  }
  if (parts.length === 0) {
    return finish([], ['No contract, approval, or decoding signal was available for this transaction.'])
  }
  return combineAssessments(parts)
}

function finish(signals: RiskSignal[], limitations: string[]): RiskAssessment {
  const overall = signals.some((item) => item.severity === 'critical' || item.severity === 'warning' || item.level === 'review')
    ? 'review_recommended'
    : signals.some((item) => item.level === 'incomplete')
      ? 'incomplete'
      : 'no_issue_observed'
  return {
    overall,
    headline: headlineFor(overall),
    signals,
    limitations: [...new Set([...limitations, ...signals.flatMap((item) => item.limitations)])],
  }
}
