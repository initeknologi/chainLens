import { createHash, randomBytes } from 'node:crypto'
import { Prisma, type PrismaClient } from '@prisma/client'
import { NETWORKS } from '@chainlens/config'
import { addUsd, buildAllocation, formatUnits, rawToUsd, valuationCoverage } from '@chainlens/blockchain'
import type {
  ActivityItem,
  ActivityReport,
  AnalysisBundle,
  ApprovalItem,
  ApprovalReport,
  ContractSnapshot,
  DecodedCall,
  PortfolioReport,
  RiskAssessment,
  SnapshotPoint,
  TransactionReport,
  TxDirection,
  TxStatus,
  TxType,
} from '@chainlens/shared-types'

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

export async function ensureNetworks(prisma: PrismaClient): Promise<void> {
  for (const network of NETWORKS) {
    await prisma.network.upsert({
      where: { chainId: network.chainId },
      create: {
        chainId: network.chainId,
        name: network.name,
        slug: network.slug,
        nativeSymbol: network.nativeSymbol,
        explorerUrl: network.explorerUrl,
      },
      update: {
        name: network.name,
        slug: network.slug,
        nativeSymbol: network.nativeSymbol,
        explorerUrl: network.explorerUrl,
      },
    })
  }
}

export async function saveAnalysis(prisma: PrismaClient, bundle: AnalysisBundle): Promise<void> {
  await ensureNetworks(prisma)
  const capturedAt = new Date(bundle.portfolio.capturedAt)
  for (const chain of bundle.portfolio.chains) {
    if (chain.status === 'unavailable') continue
    const wallet = await prisma.wallet.upsert({
      where: { address_chainId: { address: bundle.portfolio.address, chainId: chain.chainId } },
      create: {
        address: bundle.portfolio.address,
        chainId: chain.chainId,
        ensName: bundle.portfolio.ensName,
        lastIndexedAt: capturedAt,
      },
      update: { ensName: bundle.portfolio.ensName, lastIndexedAt: capturedAt },
    })
    await prisma.walletBalance.deleteMany({ where: { walletId: wallet.id } })
    for (const asset of chain.assets) {
      const token = await prisma.token.upsert({
        where: { chainId_address: { chainId: chain.chainId, address: asset.tokenAddress } },
        create: {
          chainId: chain.chainId,
          address: asset.tokenAddress,
          symbol: asset.symbol,
          name: asset.name,
          decimals: asset.decimals,
        },
        update: { symbol: asset.symbol, name: asset.name, decimals: asset.decimals },
      })
      await prisma.walletBalance.create({
        data: {
          walletId: wallet.id,
          tokenId: token.id,
          rawBalance: asset.rawBalance,
          priceUsd: asset.priceUsd,
          priceSource: asset.priceSource,
          capturedAt,
        },
      })
    }
    await prisma.walletApproval.deleteMany({ where: { walletId: wallet.id } })
  }

  for (const approval of bundle.approvals.items) {
    const wallet = await prisma.wallet.findUnique({
      where: { address_chainId: { address: bundle.portfolio.address, chainId: approval.chainId } },
    })
    if (!wallet) continue
    await prisma.walletApproval.create({
      data: {
        walletId: wallet.id,
        chainId: approval.chainId,
        tokenAddress: approval.tokenAddress,
        tokenSymbol: approval.tokenSymbol,
        spender: approval.spender,
        allowanceRaw: approval.allowanceRaw,
        allowanceDisplay: approval.allowanceDisplay,
        unlimited: approval.unlimited,
        source: approval.source,
        txHash: approval.txHash,
        asOf: approval.asOf,
        observedAtBlock: approval.observedAtBlock,
        risk: json(approval.risk),
      },
    })
  }

  for (const item of bundle.activity.items) {
    const transaction = await prisma.transaction.upsert({
      where: {
        chainId_hash_walletAddress: {
          chainId: item.chainId,
          hash: item.hash,
          walletAddress: bundle.portfolio.address,
        },
      },
      create: transactionData(bundle.portfolio.address, item),
      update: transactionData(bundle.portfolio.address, item),
    })
    await prisma.transactionEvent.deleteMany({ where: { transactionId: transaction.id } })
    if (item.decoded?.args.length) {
      await prisma.transactionEvent.createMany({
        data: item.decoded.args.map((arg, index) => ({
          transactionId: transaction.id,
          logIndex: index,
          address: item.to ?? item.from,
          eventName: item.decoded?.method ?? item.method,
          decoded: json(arg),
        })),
      })
    }
  }

  const previous = await prisma.portfolioSnapshot.findFirst({
    where: { address: bundle.portfolio.address },
    orderBy: { capturedAt: 'desc' },
  })
  if (!previous || capturedAt.getTime() - previous.capturedAt.getTime() > 10 * 60 * 1000) {
    await prisma.portfolioSnapshot.create({
      data: {
        address: bundle.portfolio.address,
        capturedAt,
        totalUsd: bundle.portfolio.totalUsd,
        allocation: json(bundle.portfolio.allocation),
        coverage: json({
          valuationCoverage: bundle.portfolio.valuationCoverage,
          limitations: bundle.portfolio.limitations,
        }),
      },
    })
  }
}

export async function readPortfolio(prisma: PrismaClient, address: string): Promise<PortfolioReport | null> {
  const wallets = await prisma.wallet.findMany({
    where: { address },
    include: { network: true, balances: { include: { token: true } } },
    orderBy: { chainId: 'asc' },
  })
  if (wallets.length === 0) return null
  const chains = wallets.map((wallet) => {
    const assets = wallet.balances.map((balance) => {
      const valueUsd = balance.priceUsd ? rawToUsd(BigInt(balance.rawBalance), balance.token.decimals, balance.priceUsd) : null
      return {
        chainId: wallet.chainId,
        chainName: wallet.network.name,
        tokenAddress: balance.token.address,
        symbol: balance.token.symbol,
        name: balance.token.name,
        decimals: balance.token.decimals,
        rawBalance: balance.rawBalance,
        displayBalance: formatUnits(BigInt(balance.rawBalance), balance.token.decimals),
        priceUsd: balance.priceUsd,
        valueUsd,
        priceSource: balance.priceSource,
        priceObservedAt: balance.priceUsd ? balance.capturedAt.toISOString() : null,
        isNative: balance.token.address === '0x0000000000000000000000000000000000000000',
      }
    })
    const total = addUsd(assets.map((asset) => asset.valueUsd))
    return {
      chainId: wallet.chainId,
      chainName: wallet.network.name,
      nativeSymbol: wallet.network.nativeSymbol,
      status: assets.some((asset) => asset.valueUsd == null) ? ('partial' as const) : ('ok' as const),
      assets,
      totalUsd: total.total,
      explorerUrl: `${wallet.network.explorerUrl}/address/${address}`,
    }
  })
  const assets = chains.flatMap((chain) => chain.assets)
  const snapshot = await prisma.portfolioSnapshot.findFirst({ where: { address }, orderBy: { capturedAt: 'desc' } })
  const coverage = snapshot?.coverage as { limitations?: string[]; valuationCoverage?: PortfolioReport['valuationCoverage'] } | null
  return {
    address,
    ensName: wallets.find((wallet) => wallet.ensName)?.ensName ?? null,
    capturedAt: (wallets[0]?.lastIndexedAt ?? new Date()).toISOString(),
    chains,
    totalUsd: addUsd(assets.map((asset) => asset.valueUsd)).total,
    valuationCoverage: coverage?.valuationCoverage ?? valuationCoverage(assets),
    allocation: buildAllocation(assets),
    limitations: coverage?.limitations ?? [
      'This report was rebuilt from stored balances.',
      'Tokens without a price are excluded from the valuation.',
    ],
  }
}

export async function readActivity(prisma: PrismaClient, address: string, page = 1, pageSize = 20): Promise<ActivityReport | null> {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
  const safeSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.min(Math.floor(pageSize), 50) : 20
  const total = await prisma.transaction.count({ where: { walletAddress: address } })
  const rows = await prisma.transaction.findMany({
    where: { walletAddress: address },
    orderBy: { timestamp: 'desc' },
    skip: (safePage - 1) * safeSize,
    take: safeSize,
  })
  if (rows.length === 0) {
    const wallet = await prisma.wallet.findFirst({ where: { address } })
    if (!wallet) return null
  }
  const items = rows.map(toActivityItem)
  const byChain = new Map<number, ActivityItem[]>()
  for (const item of items) {
    byChain.set(item.chainId, [...(byChain.get(item.chainId) ?? []), item])
  }
  return {
    address,
    items,
    page: safePage,
    pageSize: safeSize,
    total,
    gas: {
      byChain: [...byChain.entries()].map(([chainId, chainItems]) => {
        const total = chainItems.reduce((sum, item) => sum + BigInt(item.feeRaw ?? '0'), 0n)
        return {
          chainId,
          chainName: chainItems[0]?.chainName ?? String(chainId),
          nativeSymbol: chainItems[0]?.nativeSymbol ?? 'ETH',
          sampleSize: chainItems.length,
          totalFeeRaw: total.toString(),
          totalFeeDisplay: formatUnits(total, 18),
          totalFeeUsd: addUsd(chainItems.map((item) => item.feeUsd)).total,
        }
      }),
      limitations: ['Gas totals cover indexed transactions, not the full history of the address.'],
    },
    limitations: [
      'Activity is limited to the transactions indexed for this address.',
      'Identity is chain id plus transaction hash.',
    ],
  }
}

export async function readApprovals(prisma: PrismaClient, address: string): Promise<ApprovalReport | null> {
  const wallets = await prisma.wallet.findMany({ where: { address }, include: { approvals: true, network: true } })
  if (wallets.length === 0) return null
  const items: ApprovalItem[] = wallets.flatMap((wallet) =>
    wallet.approvals.map((approval) => ({
      chainId: approval.chainId,
      chainName: wallet.network.name,
      tokenAddress: approval.tokenAddress,
      tokenSymbol: approval.tokenSymbol,
      spender: approval.spender,
      allowanceRaw: approval.allowanceRaw,
      allowanceDisplay: approval.allowanceDisplay,
      unlimited: approval.unlimited,
      source: approval.source,
      txHash: approval.txHash,
      asOf: approval.asOf === 'current' ? 'current' : 'historical',
      observedAtBlock: approval.observedAtBlock,
      risk: approval.risk as unknown as RiskAssessment,
    })),
  )
  return {
    address,
    items,
    limitations: [
      'Stored approvals keep the as-of value recorded at analysis time. Historical rows are not current permissions.',
    ],
  }
}

export async function readSnapshots(prisma: PrismaClient, address: string): Promise<SnapshotPoint[]> {
  const rows = await prisma.portfolioSnapshot.findMany({
    where: { address },
    orderBy: { capturedAt: 'asc' },
    take: 90,
  })
  return rows.map((row) => ({ capturedAt: row.capturedAt.toISOString(), totalUsd: row.totalUsd }))
}

export async function saveTransactionReport(prisma: PrismaClient, report: TransactionReport): Promise<void> {
  await ensureNetworks(prisma)
  if (report.contract) await saveContract(prisma, report.contract)
  await prisma.analysisReport.create({
    data: {
      kind: 'transaction',
      subjectId: `${report.item.chainId}:${report.item.hash}`,
      question: report.explanation.question,
      answer: report.explanation.answer,
      payload: json(report),
    },
  })
}

export async function readStoredTransaction(prisma: PrismaClient, chainId: number, hash: string): Promise<TransactionReport | null> {
  const row = await prisma.analysisReport.findFirst({
    where: { kind: 'transaction', subjectId: `${chainId}:${hash}` },
    orderBy: { createdAt: 'desc' },
  })
  return (row?.payload as unknown as TransactionReport | undefined) ?? null
}

export async function enqueueRefresh(prisma: PrismaClient, address: string): Promise<void> {
  if (process.env.REDIS_URL) return
  await prisma.indexJob.create({
    data: {
      address,
      status: 'pending',
      runAfter: new Date(Date.now() + 30 * 60 * 1000),
    },
  })
}

export async function claimDueJob(prisma: PrismaClient): Promise<{ id: string; address: string } | null> {
  const job = await prisma.indexJob.findFirst({
    where: { status: 'pending', runAfter: { lte: new Date() } },
    orderBy: { runAfter: 'asc' },
  })
  if (!job) return null
  const claimed = await prisma.indexJob.updateMany({
    where: { id: job.id, status: 'pending' },
    data: { status: 'running', attempts: { increment: 1 } },
  })
  if (claimed.count !== 1) return null
  return { id: job.id, address: job.address }
}

export async function finishJob(prisma: PrismaClient, id: string, error?: string): Promise<void> {
  await prisma.indexJob.update({
    where: { id },
    data: error ? { status: 'failed', lastError: error.slice(0, 500) } : { status: 'done', lastError: null },
  })
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function createAccount(prisma: PrismaClient, displayName: string) {
  const token = randomBytes(32).toString('hex')
  const user = await prisma.user.create({
    data: {
      displayName: displayName.trim().slice(0, 80) || 'Local profile',
      tokenHash: hashToken(token),
      preferences: { networks: [1, 8453], showUnpriced: true },
    },
  })
  return { token, id: user.id, displayName: user.displayName, preferences: user.preferences }
}

export async function readAccount(prisma: PrismaClient, token: string) {
  const user = await prisma.user.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { savedWallets: { orderBy: { createdAt: 'desc' } } },
  })
  if (!user) return null
  return {
    id: user.id,
    displayName: user.displayName,
    preferences: user.preferences,
    wallets: user.savedWallets.map((wallet) => ({ address: wallet.address, savedAt: wallet.createdAt.toISOString() })),
  }
}

export async function updatePreferences(prisma: PrismaClient, token: string, preferences: unknown) {
  const account = await readAccount(prisma, token)
  if (!account) return null
  await prisma.user.update({ where: { id: account.id }, data: { preferences: json(preferences) } })
  return readAccount(prisma, token)
}

export async function rememberWallet(prisma: PrismaClient, token: string, address: string) {
  const account = await readAccount(prisma, token)
  if (!account) return null
  await prisma.savedWallet.upsert({
    where: { userId_address: { userId: account.id, address } },
    create: { userId: account.id, address },
    update: {},
  })
  return readAccount(prisma, token)
}

export async function forgetWallet(prisma: PrismaClient, token: string, address: string) {
  const account = await readAccount(prisma, token)
  if (!account) return null
  await prisma.savedWallet.deleteMany({ where: { userId: account.id, address } })
  const stillSaved = await prisma.savedWallet.count({ where: { address } })
  if (stillSaved === 0) await deleteAddressData(prisma, address)
  return readAccount(prisma, token)
}

export async function deleteAccount(prisma: PrismaClient, token: string): Promise<boolean> {
  const account = await readAccount(prisma, token)
  if (!account) return false
  for (const wallet of account.wallets) {
    const stillSaved = await prisma.savedWallet.count({ where: { address: wallet.address, userId: { not: account.id } } })
    if (stillSaved === 0) await deleteAddressData(prisma, wallet.address)
  }
  await prisma.user.delete({ where: { id: account.id } })
  return true
}

async function deleteAddressData(prisma: PrismaClient, address: string): Promise<void> {
  await prisma.transaction.deleteMany({ where: { walletAddress: address } })
  await prisma.portfolioSnapshot.deleteMany({ where: { address } })
  await prisma.wallet.deleteMany({ where: { address } })
  await prisma.indexJob.deleteMany({ where: { address } })
}

export async function recordProductEvent(prisma: PrismaClient, name: string): Promise<void> {
  await prisma.productEvent.create({ data: { name } })
}

export async function savedChainIds(prisma: PrismaClient, address: string): Promise<number[]> {
  const rows = await prisma.wallet.findMany({ where: { address }, select: { chainId: true } })
  return rows.map((row) => row.chainId)
}

async function saveContract(prisma: PrismaClient, contract: ContractSnapshot): Promise<void> {
  const row = await prisma.contract.upsert({
    where: { chainId_address: { chainId: contract.chainId, address: contract.address } },
    create: {
      chainId: contract.chainId,
      address: contract.address,
      name: contract.name,
      isContract: contract.isContract,
      verified: contract.verified,
      proxyType: contract.proxyType,
      creator: contract.creator,
      creationTxHash: contract.creationTxHash,
      ownerAddress: contract.owner,
      abi: contract.abi ? json(contract.abi) : undefined,
    },
    update: {
      name: contract.name,
      isContract: contract.isContract,
      verified: contract.verified,
      proxyType: contract.proxyType,
      creator: contract.creator,
      creationTxHash: contract.creationTxHash,
      ownerAddress: contract.owner,
      abi: contract.abi ? json(contract.abi) : undefined,
    },
  })
  await prisma.contractRisk.deleteMany({ where: { contractId: row.id } })
  if (contract.risk.signals.length === 0) return
  await prisma.contractRisk.createMany({
    data: contract.risk.signals.map((signal) => ({
      contractId: row.id,
      signalId: signal.id,
      level: signal.level,
      severity: signal.severity,
      title: signal.title,
      explanation: signal.explanation,
      evidence: json(signal.evidence),
      limitations: json(signal.limitations),
    })),
  })
}

function transactionData(walletAddress: string, item: ActivityItem): Prisma.TransactionUncheckedCreateInput {
  return {
    chainId: item.chainId,
    hash: item.hash,
    walletAddress,
    blockNumber: item.blockNumber,
    timestamp: new Date(item.timestamp),
    fromAddress: item.from,
    toAddress: item.to,
    status: item.status,
    txType: item.type,
    method: item.method,
    summary: item.summary,
    valueRaw: item.valueRaw,
    valueDisplay: item.valueDisplay,
    nativeSymbol: item.nativeSymbol,
    feeRaw: item.feeRaw,
    feeDisplay: item.feeDisplay,
    feeUsd: item.feeUsd,
    gasUsed: item.gasUsed,
    gasPrice: item.gasPrice,
    direction: item.direction,
    counterparty: item.counterparty,
    contractName: item.contractName,
    contractVerified: item.contractVerified,
    decoded: item.decoded ? json(item.decoded) : undefined,
    inputData: item.inputData.slice(0, 20_000),
  }
}

function toActivityItem(row: {
  chainId: number
  hash: string
  blockNumber: string
  timestamp: Date
  fromAddress: string
  toAddress: string | null
  status: string
  txType: string
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
  direction: string
  counterparty: string | null
  contractName: string | null
  contractVerified: boolean | null
  decoded: Prisma.JsonValue
  inputData: string
}): ActivityItem {
  const network = NETWORKS.find((item) => item.chainId === row.chainId)
  return {
    chainId: row.chainId,
    chainName: network?.name ?? String(row.chainId),
    hash: row.hash,
    blockNumber: row.blockNumber,
    timestamp: row.timestamp.toISOString(),
    from: row.fromAddress,
    to: row.toAddress,
    status: asStatus(row.status),
    type: asType(row.txType),
    method: row.method,
    summary: row.summary,
    valueRaw: row.valueRaw,
    valueDisplay: row.valueDisplay,
    nativeSymbol: row.nativeSymbol,
    feeRaw: row.feeRaw,
    feeDisplay: row.feeDisplay,
    feeUsd: row.feeUsd,
    gasUsed: row.gasUsed,
    gasPrice: row.gasPrice,
    direction: asDirection(row.direction),
    counterparty: row.counterparty,
    contractName: row.contractName,
    contractVerified: row.contractVerified,
    decoded: (row.decoded as DecodedCall | null) ?? null,
    inputData: row.inputData,
    explorerUrl: network ? `${network.explorerUrl}/tx/${row.hash}` : '',
  }
}

function asStatus(value: string): TxStatus {
  if (value === 'success' || value === 'failed' || value === 'unknown') return value
  return 'unknown'
}

function asType(value: string): TxType {
  const allowed: TxType[] = ['native_transfer', 'token_transfer', 'approval', 'contract_creation', 'contract_interaction', 'swap']
  return allowed.includes(value as TxType) ? (value as TxType) : 'contract_interaction'
}

function asDirection(value: string): TxDirection {
  if (value === 'in' || value === 'out' || value === 'self' || value === 'unknown') return value
  return 'unknown'
}
