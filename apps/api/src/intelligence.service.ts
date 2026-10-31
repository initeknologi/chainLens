import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { Queue } from 'bullmq'
import IORedis from 'ioredis'
import { NETWORKS, readEnv } from '@chainlens/config'
import {
  analyzeAddress,
  analyzeTransaction,
  analyticsFrom,
  explainQuestion,
  inspectContract,
  providerHealth,
  readNativeHistory,
  resolvePublicAddress,
} from '@chainlens/blockchain'
import {
  createAccount,
  deleteAccount,
  enqueueRefresh,
  forgetWallet,
  getPrisma,
  readAccount,
  readActivity,
  readApprovals,
  readPortfolio,
  readSnapshots,
  recordProductEvent,
  rememberWallet,
  saveAnalysis,
  saveTransactionReport,
  updatePreferences,
} from '@chainlens/database'

function tokenFrom(authorization?: string): string | null {
  if (!authorization?.toLowerCase().startsWith('bearer ')) return null
  const token = authorization.slice(7).trim()
  return token.length > 0 ? token : null
}

function failure(code: string, message: string, status: HttpStatus): never {
  throw new HttpException({ code, message, error: message }, status)
}

@Injectable()
export class IntelligenceService {
  private queue: Queue | null = null

  async health() {
    await getPrisma().$queryRaw`SELECT 1`
    return {
      ok: true,
      database: process.env.DATABASE_URL?.includes('54329') ? 'embedded-postgres' : 'postgres',
      redis: Boolean(process.env.REDIS_URL),
      providers: providerHealth(),
    }
  }

  networks() {
    return NETWORKS.map((network) => ({
      chainId: network.chainId,
      name: network.name,
      slug: network.slug,
      nativeSymbol: network.nativeSymbol,
      explorerUrl: network.explorerUrl,
      initialRelease: network.chainId === 1 || network.chainId === 8453,
    }))
  }

  async analyze(address: string, input: { chainIds?: number[]; save?: boolean; authorization?: string }) {
    await recordProductEvent(getPrisma(), 'wallet_analysis_started')
    const bundle = await analyzeAddress(address, { chainIds: input.chainIds })
    let persisted = false
    if (input.save) {
      const token = tokenFrom(input.authorization)
      if (!token || !(await readAccount(getPrisma(), token))) {
        failure('ANALYSIS_INCOMPLETE', 'Create a profile before saving a wallet. Analysis itself does not store the address.', HttpStatus.UNAUTHORIZED)
      }
      await saveAnalysis(getPrisma(), bundle)
      await rememberWallet(getPrisma(), token, bundle.portfolio.address)
      await this.scheduleRefresh(bundle.portfolio.address)
      persisted = true
    }
    await recordProductEvent(getPrisma(), 'wallet_analysis_completed')
    return { ...bundle, persisted }
  }

  async overview(address: string) {
    const portfolio = await this.portfolio(address)
    return {
      address: portfolio.address,
      ensName: portfolio.ensName,
      capturedAt: portfolio.capturedAt,
      totalUsd: portfolio.totalUsd,
      valuationCoverage: portfolio.valuationCoverage,
      chains: portfolio.chains.map((chain) => ({ chainId: chain.chainId, name: chain.chainName, status: chain.status })),
    }
  }

  async portfolio(address: string) {
    const canonical = await this.canonical(address)
    const report = await readPortfolio(getPrisma(), canonical)
    if (!report) failure('ANALYSIS_INCOMPLETE', 'This address is not saved. Analyze it, or save it to a profile, to read it back.', HttpStatus.NOT_FOUND)
    return report
  }

  async balances(address: string) {
    const report = await this.portfolio(address)
    return { address: report.address, capturedAt: report.capturedAt, chains: report.chains }
  }

  async activity(address: string, page = 1, pageSize = 20) {
    await recordProductEvent(getPrisma(), 'transaction_opened')
    const report = await readActivity(getPrisma(), await this.canonical(address), page, pageSize)
    if (!report) failure('ANALYSIS_INCOMPLETE', 'No saved activity for this address.', HttpStatus.NOT_FOUND)
    return report
  }

  async approvals(address: string) {
    await recordProductEvent(getPrisma(), 'approval_analysis_viewed')
    const report = await readApprovals(getPrisma(), await this.canonical(address))
    if (!report) failure('ANALYSIS_INCOMPLETE', 'No saved approvals for this address.', HttpStatus.NOT_FOUND)
    return report
  }

  async analytics(address: string) {
    const normalized = await this.canonical(address)
    const portfolio = await readPortfolio(getPrisma(), normalized)
    const activity = await readActivity(getPrisma(), normalized, 1, 50)
    const approvals = await readApprovals(getPrisma(), normalized)
    if (!portfolio || !activity || !approvals) {
      failure('ANALYSIS_INCOMPLETE', 'Historical analytics are available after the wallet is saved.', HttpStatus.NOT_FOUND)
    }
    const [history, snapshots] = await Promise.all([readNativeHistory(normalized), readSnapshots(getPrisma(), normalized)])
    return analyticsFrom({ portfolio, activity, approvals }, history, snapshots)
  }

  async analyticsSummary(address: string) {
    const report = await this.analytics(address)
    return { address: report.address, concentration: report.concentration, networkDistribution: report.networkDistribution, limitations: report.limitations }
  }

  async analyticsHistory(address: string, chainIds?: number[]) {
    const normalized = await this.canonical(address)
    const [nativeHistory, snapshots] = await Promise.all([
      readNativeHistory(normalized, { chainIds }),
      readSnapshots(getPrisma(), normalized),
    ])
    return {
      address: normalized,
      nativeHistory,
      snapshots,
      limitations: [
        snapshots.length === 0 ? 'No portfolio snapshot is stored. Snapshots are written only when you save the wallet.' : 'Snapshots are estimated valuations at the time they were saved.',
        'Native history is the explorer series for the native asset. A missing series stays empty.',
      ],
    }
  }

  async analyticsAllocation(address: string) {
    const portfolio = await this.portfolio(address)
    return { address: portfolio.address, allocation: portfolio.allocation, valuationCoverage: portfolio.valuationCoverage, capturedAt: portfolio.capturedAt }
  }

  async transaction(chainId: number, hash: string, address?: string) {
    const report = await analyzeTransaction(chainId, hash, address)
    await saveTransactionReport(getPrisma(), report)
    await recordProductEvent(getPrisma(), 'transaction_opened')
    return report
  }

  async decode(chainId: number, hash: string, address?: string) {
    const report = await this.transaction(chainId, hash, address)
    return {
      chainId,
      hash,
      decoded: report.item.decoded,
      type: report.item.type,
      method: report.item.method,
      status: report.item.status,
      limitations: report.item.decoded ? [] : ['No ABI match was found. The method was not guessed.'],
    }
  }

  async explain(input: { question: string; chainId: number; hash: string; address?: string }) {
    const env = readEnv()
    const report = await analyzeTransaction(input.chainId, input.hash, input.address)
    const explanation = await explainQuestion({
      question: input.question,
      report,
      apiKey: env.OPENAI_API_KEY || undefined,
      model: env.OPENAI_MODEL,
    })
    const next = { ...report, explanation }
    await saveTransactionReport(getPrisma(), next)
    await recordProductEvent(getPrisma(), 'transaction_explained')
    return next
  }

  async ask(input: { question: string; chainId?: number; hash?: string; address?: string }) {
    await recordProductEvent(getPrisma(), 'ai_question_submitted')
    if (input.hash && input.chainId) {
      return this.explain({ question: input.question, chainId: input.chainId, hash: input.hash, address: input.address })
    }
    if (!input.address) {
      failure('ANALYSIS_INCOMPLETE', 'Provide a transaction hash and chain id, or a public address.', HttpStatus.BAD_REQUEST)
    }
    const bundle = await analyzeAddress(input.address)
    const priced = bundle.portfolio.chains.flatMap((chain) => chain.assets).filter((asset) => asset.valueUsd != null)
    const answer = [
      `Captured at ${bundle.portfolio.capturedAt}.`,
      bundle.portfolio.totalUsd
        ? `Estimated priced value is ${bundle.portfolio.totalUsd} USD across ${priced.length} priced assets.`
        : 'No reference price was available, so no portfolio total is shown.',
      ...bundle.portfolio.chains.map((chain) => `${chain.chainName}: ${chain.status}.`),
      'This uses the balances just read. It is not a profit or loss figure, and it is not a recommendation.',
    ].join(' ')
    return {
      question: input.question,
      answer,
      evidence: priced.slice(0, 8).map((asset) => ({
        label: `${asset.symbol} on ${asset.chainName}`,
        value: asset.valueUsd ?? 'unavailable',
        source: asset.priceSource ?? 'no price source',
      })),
      limitations: bundle.portfolio.limitations,
      sources: ['ChainLens balance read'],
      mode: 'deterministic' as const,
    }
  }

  async contract(chainId: number, address: string) {
    await recordProductEvent(getPrisma(), 'contract_analysis_viewed')
    return inspectContract(chainId, address)
  }

  async contractRisks(chainId: number, address: string) {
    const snapshot = await this.contract(chainId, address)
    return { chainId, address: snapshot.address, risk: snapshot.risk }
  }

  async contractAbi(chainId: number, address: string) {
    const snapshot = await this.contract(chainId, address)
    if (!snapshot.abi) {
      return { chainId, address: snapshot.address, abi: null, code: 'CONTRACT_DATA_UNAVAILABLE', message: 'The explorer did not return an ABI for this contract.' }
    }
    return { chainId, address: snapshot.address, abi: snapshot.abi, source: 'explorer smart-contract endpoint' }
  }

  async openAccount(displayName: string) {
    return createAccount(getPrisma(), displayName)
  }

  async account(authorization?: string) {
    const token = tokenFrom(authorization)
    if (!token) failure('ANALYSIS_INCOMPLETE', 'Send the profile token in the Authorization header.', HttpStatus.UNAUTHORIZED)
    const account = await readAccount(getPrisma(), token)
    if (!account) failure('ANALYSIS_INCOMPLETE', 'That profile token is not recognized.', HttpStatus.UNAUTHORIZED)
    return account
  }

  async savePreferences(authorization: string | undefined, preferences: { networks: number[]; showUnpriced: boolean }) {
    const token = tokenFrom(authorization)
    if (!token) failure('ANALYSIS_INCOMPLETE', 'Send the profile token in the Authorization header.', HttpStatus.UNAUTHORIZED)
    const account = await updatePreferences(getPrisma(), token, preferences)
    if (!account) failure('ANALYSIS_INCOMPLETE', 'That profile token is not recognized.', HttpStatus.UNAUTHORIZED)
    return account
  }

  async removeWallet(authorization: string | undefined, address: string) {
    const token = tokenFrom(authorization)
    if (!token) failure('ANALYSIS_INCOMPLETE', 'Send the profile token in the Authorization header.', HttpStatus.UNAUTHORIZED)
    const canonical = await this.canonical(address)
    const account = await forgetWallet(getPrisma(), token, canonical)
    if (!account) failure('ANALYSIS_INCOMPLETE', 'That profile token is not recognized.', HttpStatus.UNAUTHORIZED)
    return account
  }

  async removeAccount(authorization?: string) {
    const token = tokenFrom(authorization)
    if (!token) failure('ANALYSIS_INCOMPLETE', 'Send the profile token in the Authorization header.', HttpStatus.UNAUTHORIZED)
    const removed = await deleteAccount(getPrisma(), token)
    if (!removed) failure('ANALYSIS_INCOMPLETE', 'That profile token is not recognized.', HttpStatus.UNAUTHORIZED)
    return { deleted: true }
  }

  private async canonical(address: string) {
    const resolved = await resolvePublicAddress(address)
    return resolved.address
  }

  private async scheduleRefresh(address: string) {
    if (process.env.REDIS_URL) {
      const queue = this.redisQueue()
      await queue.add('refresh', { address }, { jobId: `refresh:${address}`, delay: 30 * 60 * 1000, removeOnComplete: 100 })
      return
    }
    await enqueueRefresh(getPrisma(), address)
  }

  private redisQueue() {
    if (!this.queue && process.env.REDIS_URL) {
      const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
      this.queue = new Queue('chainlens-refresh', { connection })
    }
    if (!this.queue) throw new Error('Redis queue is not configured')
    return this.queue
  }
}
