export type ChainStatus = 'ok' | 'partial' | 'unavailable'
export type Assessment = 'no_issue_observed' | 'review_recommended' | 'incomplete'
export type RiskLevel = 'info' | 'review' | 'incomplete'
export type RiskSeverity = 'informational' | 'warning' | 'critical'
export type AllowanceAsOf = 'current' | 'historical'
export type TxStatus = 'success' | 'failed' | 'unknown'
export type TxDirection = 'in' | 'out' | 'self' | 'unknown'
export type TxType =
  | 'native_transfer'
  | 'token_transfer'
  | 'approval'
  | 'contract_creation'
  | 'contract_interaction'
  | 'swap'
export type ValuationCoverage = 'complete' | 'partial' | 'unavailable'
export type ExplainerMode = 'deterministic' | 'llm'

export interface Evidence {
  label: string
  value: string
  source: string
}

export interface RiskSignal {
  id: string
  level: RiskLevel
  severity: RiskSeverity
  title: string
  explanation: string
  evidence: Evidence[]
  limitations: string[]
}

export interface RiskAssessment {
  overall: Assessment
  headline: string
  signals: RiskSignal[]
  limitations: string[]
}

export interface AssetPosition {
  chainId: number
  chainName: string
  tokenAddress: string
  symbol: string
  name: string
  decimals: number
  rawBalance: string
  displayBalance: string
  priceUsd: string | null
  valueUsd: string | null
  priceSource: string | null
  priceObservedAt: string | null
  isNative: boolean
}

export interface ChainPortfolio {
  chainId: number
  chainName: string
  nativeSymbol: string
  status: ChainStatus
  error?: string
  assets: AssetPosition[]
  totalUsd: string | null
  explorerUrl: string
}

export interface AllocationSlice {
  key: string
  symbol: string
  chainName: string
  valueUsd: string
  shareBps: number
}

export interface PortfolioReport {
  address: string
  ensName: string | null
  capturedAt: string
  chains: ChainPortfolio[]
  totalUsd: string | null
  valuationCoverage: ValuationCoverage
  allocation: AllocationSlice[]
  limitations: string[]
}

export interface DecodedArg {
  name: string
  type: string
  value: string
}

export interface DecodedCall {
  method: string | null
  selector: string | null
  args: DecodedArg[]
  source: string
}

export interface ActivityItem {
  chainId: number
  chainName: string
  hash: string
  blockNumber: string
  timestamp: string
  from: string
  to: string | null
  status: TxStatus
  type: TxType
  method: string | null
  summary: string
  valueRaw: string
  valueDisplay: string
  nativeSymbol: string
  feeRaw: string | null
  feeDisplay: string | null
  feeUsd: string | null
  gasUsed: string | null
  gasPrice: string | null
  direction: TxDirection
  counterparty: string | null
  contractName: string | null
  contractVerified: boolean | null
  decoded: DecodedCall | null
  inputData: string
  explorerUrl: string
}

export interface GasByChain {
  chainId: number
  chainName: string
  nativeSymbol: string
  sampleSize: number
  totalFeeRaw: string
  totalFeeDisplay: string
  totalFeeUsd: string | null
}

export interface ActivityReport {
  address: string
  items: ActivityItem[]
  page: number
  pageSize: number
  total: number
  gas: {
    byChain: GasByChain[]
    limitations: string[]
  }
  limitations: string[]
}

export interface ApprovalItem {
  chainId: number
  chainName: string
  tokenAddress: string
  tokenSymbol: string | null
  spender: string
  allowanceRaw: string
  allowanceDisplay: string | null
  unlimited: boolean
  source: string
  txHash: string | null
  asOf: AllowanceAsOf
  observedAtBlock: string | null
  risk: RiskAssessment
}

export interface ApprovalReport {
  address: string
  items: ApprovalItem[]
  limitations: string[]
}

export interface ContractSnapshot {
  chainId: number
  address: string
  name: string | null
  isContract: boolean | null
  verified: boolean | null
  proxyType: string | null
  creator: string | null
  creationTxHash: string | null
  owner: string | null
  abi: unknown[] | null
  risk: RiskAssessment
}

export interface Explanation {
  question: string
  answer: string
  evidence: Evidence[]
  limitations: string[]
  sources: string[]
  mode: ExplainerMode
}

export interface TransactionReport {
  item: ActivityItem
  risk: RiskAssessment
  explanation: Explanation
  contract: ContractSnapshot | null
}

export interface SnapshotPoint {
  capturedAt: string
  totalUsd: string | null
}

export interface NativeHistory {
  chainId: number
  chainName: string
  nativeSymbol: string
  points: { timestamp: string; displayBalance: string; rawBalance: string }[]
}

export interface AnalyticsReport {
  address: string
  concentration: { symbol: string; chainName: string; shareBps: number } | null
  networkDistribution: { chainId: number; chainName: string; valueUsd: string; shareBps: number }[]
  snapshots: SnapshotPoint[]
  nativeHistory: NativeHistory[]
  limitations: string[]
}

export interface AnalysisBundle {
  portfolio: PortfolioReport
  activity: ActivityReport
  approvals: ApprovalReport
}

export class SecretMaterialError extends Error {
  constructor() {
    super(
      'ChainLens only accepts a public wallet address. Never paste a secret recovery phrase or private key.',
    )
    this.name = 'SecretMaterialError'
  }
}

export class InvalidAddressError extends Error {
  constructor(message = 'Enter a public wallet address, such as 0xabc… or a vitalik.eth name.') {
    super(message)
    this.name = 'InvalidAddressError'
  }
}

export class UnsupportedChainError extends Error {
  constructor(chainId: number) {
    super(`Chain ${chainId} is not supported. ChainLens reads Ethereum, BNB Smart Chain, Polygon, and Base.`)
    this.name = 'UnsupportedChainError'
  }
}

export class UpstreamError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UpstreamError'
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}

const PRIVATE_KEY = /^(0x)?[a-fA-F0-9]{64}$/
const MNEMONIC = /^[a-z]+(?:\s+[a-z]+){11,23}$/i

export function assertPublicIdentifier(input: string): void {
  const value = input.trim()
  const compact = value.replace(/\s+/g, ' ')
  if (PRIVATE_KEY.test(value) || MNEMONIC.test(compact)) {
    throw new SecretMaterialError()
  }
}

export function headlineFor(overall: Assessment): string {
  if (overall === 'review_recommended') return 'Review recommended'
  if (overall === 'incomplete') return 'Risk assessment incomplete'
  return 'No issue observed in the checked signals'
}

export function combineAssessments(parts: RiskAssessment[]): RiskAssessment {
  const signals = parts.flatMap((part) => part.signals)
  const limitations = [...new Set(parts.flatMap((part) => part.limitations))]
  const overall: Assessment = signals.some((signal) => signal.severity === 'critical' || signal.severity === 'warning' || signal.level === 'review')
    ? 'review_recommended'
    : signals.some((signal) => signal.level === 'incomplete') || parts.some((part) => part.overall === 'incomplete')
      ? 'incomplete'
      : 'no_issue_observed'
  return { overall, headline: headlineFor(overall), signals, limitations }
}
