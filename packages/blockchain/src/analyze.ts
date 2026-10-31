import { getAddress, isAddress } from 'viem'
import { NATIVE_TOKEN_ADDRESS, explorerTxUrl, getNetwork, type NetworkConfig } from '@chainlens/config'
import {
  InvalidAddressError,
  NotFoundError,
  UnsupportedChainError,
  UpstreamError,
  combineAssessments,
  assertPublicIdentifier,
  type ActivityItem,
  type AnalyticsReport,
  type AnalysisBundle,
  type ApprovalItem,
  type AssetPosition,
  type ChainPortfolio,
  type ContractSnapshot,
  type DecodedCall,
  type NativeHistory,
  type TransactionReport,
} from '@chainlens/shared-types'
import { classifyTransaction, decodeCalldata } from './decode'
import { explainTransaction, explanationIntroducesUnknownHash } from './explain'
import { assertFetchableUrl, type Fetcher, getJson } from './http'
import { addUsd, formatUnits, isUnlimitedAllowance, rawToUsd, shortHash } from './money'
import { buildAllocation, networkDistribution, valuationCoverage } from './portfolio-math'
import { assessApproval, assessContract, assessTokenMetadata, assessTransaction } from './risk'
import { createPublicClient, erc20Abi, http } from 'viem'
import { base, bsc, mainnet, polygon } from 'viem/chains'
import { rpcUrlFor } from '@chainlens/config'

const CHAINS = { 1: mainnet, 56: bsc, 137: polygon, 8453: base } as const
const TX_LIMIT = 25
const TOKEN_LIMIT = 40

interface ExplorerAddress {
  hash?: string
  ens_domain_name?: string | null
  coin_balance?: string | null
  exchange_rate?: string | null
  is_contract?: boolean
  is_verified?: boolean | null
  is_scam?: boolean
  proxy_type?: string | null
  name?: string | null
  creator_address_hash?: string | null
  creation_transaction_hash?: string | null
  abi?: unknown
}

interface ExplorerToken {
  address?: string
  name?: string | null
  symbol?: string | null
  decimals?: string | number | null
  exchange_rate?: string | null
  type?: string | null
}

interface ExplorerTokenBalance {
  value?: string
  token?: ExplorerToken
}

interface ExplorerParty {
  hash?: string
  name?: string | null
  is_contract?: boolean
  is_verified?: boolean | null
  is_scam?: boolean
}

interface ExplorerTx {
  hash?: string
  block_number?: number
  timestamp?: string
  from?: ExplorerParty
  to?: ExplorerParty | null
  value?: string
  fee?: { value?: string }
  gas_used?: string | null
  gas_price?: string | null
  status?: string
  method?: string | null
  decoded_input?: { method_call?: string; method_id?: string; parameters?: Array<{ name?: string; type?: string; value?: unknown }> } | null
  raw_input?: string | null
  exchange_rate?: string | null
  transaction_types?: string[]
}

interface ExplorerTxPage {
  items?: ExplorerTx[]
  next_page_params?: Record<string, string | number | null> | null
}

interface ExplorerHistoryPage {
  items?: Array<{ block_timestamp?: string; value?: string }>
}

export interface ReadOptions {
  fetcher?: Fetcher
  env?: NodeJS.ProcessEnv
  chainIds?: number[]
}

const V1_CHAIN_IDS = [1, 8453]

export function selectNetworks(chainIds?: number[]): NetworkConfig[] {
  const ids = chainIds && chainIds.length > 0 ? [...new Set(chainIds)] : V1_CHAIN_IDS
  return ids.map((chainId) => {
    const network = getNetwork(chainId)
    if (!network) throw new UnsupportedChainError(chainId)
    return network
  })
}

export function normalizePublicAddress(input: string): string {
  assertPublicIdentifier(input)
  const value = input.trim()
  if (!isAddress(value)) throw new InvalidAddressError()
  return getAddress(value)
}

export async function resolvePublicAddress(input: string, options: ReadOptions = {}): Promise<{ address: string; ensName: string | null }> {
  assertPublicIdentifier(input)
  const value = input.trim()
  if (isAddress(value)) return { address: getAddress(value), ensName: null }
  if (!value.toLowerCase().endsWith('.eth')) {
    throw new InvalidAddressError()
  }
  const network = getNetwork(1)
  if (!network) throw new UnsupportedChainError(1)
  const rpcUrl = rpcUrlFor(network, options.env)
  assertFetchableUrl(rpcUrl, options.env)
  const client = createPublicClient({
    chain: mainnet,
    transport: http(rpcUrl, { timeout: 8_000 }),
  })
  const resolved = await client.getEnsAddress({ name: value.toLowerCase() })
  if (!resolved) throw new InvalidAddressError(`Could not resolve ${value} on Ethereum mainnet.`)
  return { address: getAddress(resolved), ensName: value.toLowerCase() }
}

export async function analyzeAddress(input: string, options: ReadOptions = {}): Promise<AnalysisBundle> {
  const resolved = await resolvePublicAddress(input, options)
  const networks = selectNetworks(options.chainIds)
  const prices = await readReferencePrices(options)
  const chainResults = await Promise.all(networks.map((network) => readChain(resolved.address, network, options, prices)))
  const capturedAt = new Date().toISOString()
  const assets = chainResults.flatMap((chain) => chain.portfolio.assets)
  for (const asset of assets) {
    asset.priceObservedAt = asset.priceUsd ? capturedAt : null
  }
  const totals = addUsd(assets.map((asset) => asset.valueUsd))
  const portfolio = {
    address: resolved.address,
    ensName: chainResults.find((chain) => chain.ensName)?.ensName ?? resolved.ensName,
    capturedAt,
    chains: chainResults.map((chain) => chain.portfolio),
    totalUsd: totals.total,
    valuationCoverage: valuationCoverage(assets),
    allocation: buildAllocation(assets),
    limitations: [
      'Valuation uses the exchange rate supplied by the explorer or a public reference price. Tokens without a price are excluded from the total and called out as partial coverage.',
      'Balances are point-in-time. They can change in the next block.',
      'A market price, when present, is timestamped with this report. A missing price stays unavailable and is not stored as zero.',
      ...chainResults.flatMap((chain) => chain.notes),
    ],
  }
  const items = chainResults.flatMap((chain) => chain.activity).sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
  const activity = {
    address: resolved.address,
    items,
    page: 1,
    pageSize: items.length,
    total: items.length,
    gas: {
      byChain: chainResults.map((chain) => chain.gas),
      limitations: ['Gas totals cover the explorer pages fetched for each selected chain, not full wallet history.'],
    },
    limitations: [
      `Activity shows up to ${TX_LIMIT * 2} recent transactions per selected chain, across the explorer pages that were fetched.`,
      'A transaction hash is stored together with its chain id. The hash alone is not treated as a global identity.',
      ...chainResults.flatMap((chain) => chain.notes),
    ],
  }
  const approvals = {
    address: resolved.address,
    items: chainResults.flatMap((chain) => chain.approvals),
    limitations: [
      'Current allowances are read with allowance(owner, spender) at a named block. A failed read stays historical and is not treated as the permission in place now.',
      'This is not a complete scan of every token the wallet has ever approved.',
    ],
  }
  return { portfolio, activity, approvals }
}

export async function inspectContract(chainId: number, address: string, options: ReadOptions = {}): Promise<ContractSnapshot> {
  const network = getNetwork(chainId)
  if (!network) throw new UnsupportedChainError(chainId)
  return readContract(network, normalizePublicAddress(address), options)
}

export async function analyzeTransaction(chainId: number, hash: string, wallet: string | undefined, options: ReadOptions = {}): Promise<TransactionReport> {
  const network = getNetwork(chainId)
  if (!network) throw new UnsupportedChainError(chainId)
  if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) throw new InvalidAddressError('Enter a transaction hash beginning with 0x and containing 64 hex characters.')
  const walletAddress = wallet ? normalizePublicAddress(wallet) : null
  let record: ExplorerTx
  try {
    record = await getJson<ExplorerTx>(`${network.blockscoutUrl}/api/v2/transactions/${hash}`, options.fetcher)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unavailable'
    if (message.includes('404')) throw new NotFoundError('That transaction was not found on the selected network.')
    throw error
  }
  const item = mapTransaction(record, network, walletAddress)
  if (!item) throw new NotFoundError('The explorer response did not include a usable transaction.')
  const contract = item.to ? await readContract(network, item.to, options) : null
  const approval = approvalFromItem(item, network.name)
  const decoded = Boolean(item.decoded?.method) || item.type === 'native_transfer'
  const parts = [
    ...(contract ? [contract.risk] : []),
    ...(approval ? [assessApproval(approval)] : []),
    ...(!decoded ? [assessTransaction({ contract: null, approval: null, decoded: false })] : []),
  ]
  const risk = parts.length > 0 ? combineAssessments(parts) : assessTransaction({ contract: null, approval: null, decoded: true })
  const explanation = explainTransaction('What happened in this transaction?', { item, risk, contract })
  return { item, risk, explanation, contract }
}

export async function readNativeHistory(addressInput: string, options: ReadOptions = {}): Promise<NativeHistory[]> {
  const { address } = await resolvePublicAddress(addressInput, options)
  const histories = await Promise.all(
    selectNetworks(options.chainIds).map(async (network) => {
      try {
        const page = await getJson<ExplorerHistoryPage>(
          `${network.blockscoutUrl}/api/v2/addresses/${address}/coin-balance-history`,
          options.fetcher,
        )
        const points = (page.items ?? [])
          .filter((item) => item.block_timestamp && item.value)
          .slice(0, 60)
          .map((item) => ({
            timestamp: item.block_timestamp as string,
            rawBalance: item.value as string,
            displayBalance: formatUnits(BigInt(item.value as string), network.nativeDecimals, 6),
          }))
        return { chainId: network.chainId, chainName: network.name, nativeSymbol: network.nativeSymbol, points }
      } catch {
        return { chainId: network.chainId, chainName: network.name, nativeSymbol: network.nativeSymbol, points: [] }
      }
    }),
  )
  return histories
}

export function analyticsFrom(bundle: AnalysisBundle, nativeHistory: NativeHistory[], snapshots: AnalyticsReport['snapshots']): AnalyticsReport {
  const assets = bundle.portfolio.chains.flatMap((chain) => chain.assets)
  const allocation = bundle.portfolio.allocation
  return {
    address: bundle.portfolio.address,
    concentration: allocation[0] ? { symbol: allocation[0].symbol, chainName: allocation[0].chainName, shareBps: allocation[0].shareBps } : null,
    networkDistribution: networkDistribution(assets),
    snapshots,
    nativeHistory,
    limitations: [
      'Portfolio snapshots accumulate when you refresh an address. ChainLens does not invent historical valuations.',
      'Native balance history is the explorer coin-balance series for the native asset only. It is not a full portfolio chart.',
      'Concentration uses priced assets only. Unpriced tokens are omitted rather than given a guessed value.',
      'No buy or sell signal is computed.',
    ],
  }
}

function asTokenBalances(value: unknown): ExplorerTokenBalance[] {
  if (Array.isArray(value)) return value as ExplorerTokenBalance[]
  if (value && typeof value === 'object' && Array.isArray((value as { items?: unknown[] }).items)) {
    return (value as { items: ExplorerTokenBalance[] }).items
  }
  return []
}

const CURATED: Record<number, Array<{ address: `0x${string}`; symbol: string; name: string; decimals: number; priceId: string }>> = {
  1: [
    { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', name: 'USD Coin', decimals: 6, priceId: 'usd-coin' },
    { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', name: 'Tether USD', decimals: 6, priceId: 'tether' },
    { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', name: 'Wrapped Ether', decimals: 18, priceId: 'ethereum' },
  ],
  56: [
    { address: '0x55d398326f99059fF775485246999027B3197955', symbol: 'USDT', name: 'Tether USD', decimals: 18, priceId: 'tether' },
    { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', symbol: 'USDC', name: 'USD Coin', decimals: 18, priceId: 'usd-coin' },
    { address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', symbol: 'WBNB', name: 'Wrapped BNB', decimals: 18, priceId: 'binancecoin' },
  ],
  137: [
    { address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', symbol: 'USDC', name: 'USD Coin', decimals: 6, priceId: 'usd-coin' },
    { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', symbol: 'USDT', name: 'Tether USD', decimals: 6, priceId: 'tether' },
    { address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', symbol: 'WPOL', name: 'Wrapped POL', decimals: 18, priceId: 'polygon-ecosystem-token' },
  ],
  8453: [
    { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', name: 'USD Coin', decimals: 6, priceId: 'usd-coin' },
    { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', name: 'Wrapped Ether', decimals: 18, priceId: 'ethereum' },
  ],
}

async function readReferencePrices(options: ReadOptions): Promise<Record<string, string>> {
  try {
    const body = await getJson<Record<string, { usd?: number }>>(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,binancecoin,polygon-ecosystem-token,usd-coin,tether&vs_currencies=usd',
      options.fetcher,
    )
    const prices: Record<string, string> = {}
    for (const [id, value] of Object.entries(body)) {
      if (typeof value?.usd === 'number' && Number.isFinite(value.usd)) prices[id] = String(value.usd)
    }
    return prices
  } catch {
    return {}
  }
}

async function readChain(address: string, network: NetworkConfig, options: ReadOptions, prices: Record<string, string>) {
  const notes: string[] = []
  try {
    assertFetchableUrl(rpcUrlFor(network, options.env), options.env)
    let transactionLookupFailed = false
    const [explorerAddress, tokenBalances, transactions, rpcBalance, curated] = await Promise.all([
      getJson<ExplorerAddress>(`${network.blockscoutUrl}/api/v2/addresses/${address}`, options.fetcher).catch((error: unknown) => {
        notes.push(`${network.name}: explorer account lookup failed (${error instanceof Error ? error.message : 'unavailable'}). Native balance is read from the chain RPC.`)
        return null
      }),
      getJson<unknown>(`${network.blockscoutUrl}/api/v2/addresses/${address}/token-balances`, options.fetcher)
        .then(asTokenBalances)
        .catch(() => []),
      fetchTransactions(network, address, options).catch(() => {
        transactionLookupFailed = true
        return [] as ExplorerTx[]
      }),
      readNativeBalance(address, network, options).catch(() => null),
      readCuratedBalances(address, network, options, prices).catch(() => []),
    ])
    if (!explorerAddress && rpcBalance == null) {
      throw new Error('Neither the explorer nor the RPC returned a native balance')
    }
    const mapped = mapAssets(network, explorerAddress, tokenBalances, rpcBalance, prices)
    const seen = new Set(mapped.assets.map((asset) => asset.tokenAddress.toLowerCase()))
    const assets = [...mapped.assets, ...curated.filter((asset) => !seen.has(asset.tokenAddress.toLowerCase()))]
    if (mapped.metadataReviews > 0) {
      notes.push(
        `${network.name}: ${mapped.metadataReviews} token${mapped.metadataReviews === 1 ? '' : 's'} have missing or unusual name, symbol, or decimals. Compare that metadata with a source you trust.`,
      )
    }
    if (!explorerAddress) {
      notes.push(`${network.name}: full token discovery is unavailable, so only the native asset and a curated token set are shown.`)
    }
    if (transactionLookupFailed) {
      notes.push(`${network.name}: recent transactions were not returned by the public explorer.`)
    }
    const total = addUsd(assets.map((asset) => asset.valueUsd))
    const portfolio: ChainPortfolio = {
      chainId: network.chainId,
      chainName: network.name,
      nativeSymbol: network.nativeSymbol,
      status: !explorerAddress || assets.some((asset) => asset.valueUsd == null) ? 'partial' : 'ok',
      assets,
      totalUsd: total.total,
      explorerUrl: `${network.explorerUrl}/address/${address}`,
    }
    const activity = transactions.slice(0, TX_LIMIT * 2).flatMap((tx) => {
      try {
        const item = mapTransaction(tx, network, address)
        return item ? [item] : []
      } catch {
        return []
      }
    })
    const approvals = await confirmCurrentAllowances(address, network, await readApprovals(address, network, activity, options), options)
    const gas = summarizeGas(network, activity)
    if (rpcBalance == null) notes.push(`${network.name}: native balance fell back to the explorer because the RPC request failed.`)
    return { portfolio, activity, approvals, gas, ensName: explorerAddress?.ens_domain_name ?? null, notes }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unavailable'
    notes.push(`${network.name} is unavailable: ${message}`)
    return {
      portfolio: {
        chainId: network.chainId,
        chainName: network.name,
        nativeSymbol: network.nativeSymbol,
        status: 'unavailable' as const,
        error: message,
        assets: [],
        totalUsd: null,
        explorerUrl: `${network.explorerUrl}/address/${address}`,
      },
      activity: [],
      approvals: [],
      gas: {
        chainId: network.chainId,
        chainName: network.name,
        nativeSymbol: network.nativeSymbol,
        sampleSize: 0,
        totalFeeRaw: '0',
        totalFeeDisplay: '0',
        totalFeeUsd: null,
      },
      ensName: null,
      notes,
    }
  }
}

async function readCuratedBalances(
  address: string,
  network: NetworkConfig,
  options: ReadOptions,
  prices: Record<string, string>,
): Promise<AssetPosition[]> {
  const tokens = CURATED[network.chainId] ?? []
  if (tokens.length === 0) return []
  const chain = CHAINS[network.chainId as keyof typeof CHAINS]
  const client = createPublicClient({
    chain,
    transport: http(rpcUrlFor(network, options.env), { timeout: 8_000 }),
  })
  const results = await client.multicall({
    contracts: tokens.map((token) => ({
      address: token.address,
      abi: erc20Abi,
      functionName: 'balanceOf' as const,
      args: [address as `0x${string}`],
    })),
    allowFailure: true,
  })
  return tokens.flatMap((token, index) => {
    const result = results[index]
    if (!result || result.status !== 'success' || typeof result.result !== 'bigint' || result.result === 0n) return []
    const price = prices[token.priceId] ?? null
    return [
      {
        chainId: network.chainId,
        chainName: network.name,
        tokenAddress: token.address,
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        rawBalance: result.result.toString(),
        displayBalance: formatUnits(result.result, token.decimals),
        priceUsd: price,
        valueUsd: price ? rawToUsd(result.result, token.decimals, price) : null,
        priceSource: price ? 'CoinGecko simple price' : null,
        priceObservedAt: null,
        isNative: false,
      },
    ]
  })
}

function mapAssets(
  network: NetworkConfig,
  explorerAddress: ExplorerAddress | null,
  tokenBalances: ExplorerTokenBalance[],
  rpcBalance: bigint | null,
  prices: Record<string, string>,
): { assets: ChainPortfolio['assets']; metadataReviews: number } {
  const nativeRaw = rpcBalance ?? (explorerAddress?.coin_balance ? BigInt(explorerAddress.coin_balance) : 0n)
  const nativeQuote = explorerAddress?.exchange_rate
    ? { price: explorerAddress.exchange_rate, source: `${network.name} explorer exchange rate` }
    : prices[network.coingeckoId]
      ? { price: prices[network.coingeckoId], source: 'CoinGecko simple price' }
      : { price: null, source: null }
  const native: ChainPortfolio['assets'][number] = {
    chainId: network.chainId,
    chainName: network.name,
    tokenAddress: NATIVE_TOKEN_ADDRESS,
    symbol: network.nativeSymbol,
    name: network.nativeSymbol,
    decimals: network.nativeDecimals,
    rawBalance: nativeRaw.toString(),
    displayBalance: formatUnits(nativeRaw, network.nativeDecimals),
    priceUsd: nativeQuote.price,
    valueUsd: nativeQuote.price ? rawToUsd(nativeRaw, network.nativeDecimals, nativeQuote.price) : null,
    priceSource: nativeQuote.source,
    priceObservedAt: null,
    isNative: true,
  }
  let metadataReviews = 0
  const tokens = tokenBalances
    .filter((row) => row.token?.address && row.value && row.token.type !== 'ERC-721' && row.token.type !== 'ERC-1155')
    .slice(0, TOKEN_LIMIT)
    .flatMap((row) => {
      const token = row.token as ExplorerToken
      try {
        const decimals = Number(token.decimals ?? 18)
        const safeDecimals = Number.isFinite(decimals) ? decimals : 18
        const raw = BigInt(row.value as string)
        if (raw === 0n) return []
        const price = token.exchange_rate ?? null
        const metadata = assessTokenMetadata({
          name: token.name ?? null,
          symbol: token.symbol ?? null,
          decimals: Number.isFinite(decimals) ? decimals : null,
          source: `${network.name} token list`,
        })
        if (metadata.overall === 'review_recommended') metadataReviews += 1
        return [
          {
            chainId: network.chainId,
            chainName: network.name,
            tokenAddress: getAddress(token.address as string),
            symbol: token.symbol || 'UNKNOWN',
            name: token.name || 'Unknown token',
            decimals: safeDecimals,
            rawBalance: raw.toString(),
            displayBalance: formatUnits(raw, safeDecimals),
            priceUsd: price,
            valueUsd: price ? rawToUsd(raw, safeDecimals, price) : null,
            priceSource: price ? `${network.name} explorer token exchange rate` : null,
            priceObservedAt: null,
            isNative: false,
          },
        ]
      } catch {
        return []
      }
    })
  return { assets: [native, ...tokens], metadataReviews }
}

function mapTransaction(tx: ExplorerTx, network: NetworkConfig, wallet: string | null): ActivityItem | null {
  if (!tx.hash || tx.block_number == null || !tx.timestamp || !tx.from?.hash) return null
  const inputData = tx.raw_input && tx.raw_input !== '0x' ? tx.raw_input : '0x'
  const local = decodeCalldata(inputData)
  const decoded = decodedFromExplorer(tx) ?? local
  const method = decoded?.method ?? tx.method ?? null
  const value = BigInt(tx.value ?? '0')
  const to = tx.to?.hash ? getAddress(tx.to.hash) : null
  const from = getAddress(tx.from.hash)
  const type = classifyTransaction({ method, value, to, inputData })
  const feeRaw = tx.fee?.value ? BigInt(tx.fee.value) : null
  const direction = !wallet ? 'unknown' : from === wallet && to === wallet ? 'self' : from === wallet ? 'out' : to === wallet ? 'in' : 'unknown'
  const counterparty = direction === 'out' ? to : direction === 'in' ? from : to
  const summary = summarize({
    type,
    direction,
    value,
    network,
    method,
    counterparty,
    contractName: tx.to?.name ?? null,
    decoded,
  })
  return {
    chainId: network.chainId,
    chainName: network.name,
    hash: tx.hash,
    blockNumber: String(tx.block_number),
    timestamp: tx.timestamp,
    from,
    to,
    status: tx.status === 'ok' ? 'success' : tx.status === 'error' ? 'failed' : 'unknown',
    type,
    method,
    summary,
    valueRaw: value.toString(),
    valueDisplay: formatUnits(value, network.nativeDecimals),
    nativeSymbol: network.nativeSymbol,
    feeRaw: feeRaw?.toString() ?? null,
    feeDisplay: feeRaw != null ? formatUnits(feeRaw, network.nativeDecimals) : null,
    feeUsd: feeRaw != null && tx.exchange_rate ? rawToUsd(feeRaw, network.nativeDecimals, tx.exchange_rate) : null,
    gasUsed: tx.gas_used ?? null,
    gasPrice: tx.gas_price ?? null,
    direction,
    counterparty,
    contractName: tx.to?.name ?? null,
    contractVerified: tx.to?.is_contract ? (tx.to.is_verified ?? null) : tx.to ? false : null,
    decoded,
    inputData,
    explorerUrl: explorerTxUrl(network, tx.hash),
  }
}

function decodedFromExplorer(tx: ExplorerTx): DecodedCall | null {
  const decoded = tx.decoded_input
  if (!decoded?.method_call && !tx.method) return null
  const method = tx.method ?? decoded?.method_call?.split('(')[0] ?? null
  return {
    method,
    selector: decoded?.method_id ? `0x${decoded.method_id}` : null,
    args: (decoded?.parameters ?? []).map((parameter, index) => ({
      name: parameter.name || `arg${index}`,
      type: parameter.type || 'unknown',
      value: typeof parameter.value === 'string' ? parameter.value : JSON.stringify(parameter.value),
    })),
    source: 'blockscout',
  }
}

function summarize(input: {
  type: ActivityItem['type']
  direction: ActivityItem['direction']
  value: bigint
  network: NetworkConfig
  method: string | null
  counterparty: string | null
  contractName: string | null
  decoded: DecodedCall | null
}): string {
  const who = input.contractName ?? (input.counterparty ? shortHash(input.counterparty) : 'another address')
  if (input.type === 'native_transfer') {
    const amount = `${formatUnits(input.value, input.network.nativeDecimals)} ${input.network.nativeSymbol}`
    if (input.direction === 'out') return `Sent ${amount} to ${who}.`
    if (input.direction === 'in') return `Received ${amount} from ${who}.`
    return `Native transfer of ${amount}.`
  }
  if (input.type === 'approval') {
    const spender = input.decoded?.args.find((arg) => arg.type === 'address')?.value
    const allowance = input.decoded?.args.find((arg) => arg.type.startsWith('uint'))?.value
    return `Approved token spending${spender ? ` for ${shortHash(spender)}` : ''}${allowance ? `. Raw allowance ${allowance}` : ''}.`
  }
  if (input.type === 'token_transfer') return `Token transfer via ${input.method ?? 'transfer'} on ${who}.`
  if (input.type === 'swap') return `Swap call ${input.method ?? ''} on ${who}.`.replace('  ', ' ')
  if (input.type === 'contract_creation') return 'Contract creation. The new bytecode is not interpreted here.'
  return `Contract call ${input.method ?? 'with unknown method'} on ${who}.`
}

async function fetchTransactions(network: NetworkConfig, address: string, options: ReadOptions): Promise<ExplorerTx[]> {
  const first = await getJson<ExplorerTxPage>(`${network.blockscoutUrl}/api/v2/addresses/${address}/transactions`, options.fetcher)
  const items = [...(first.items ?? [])]
  const next = first.next_page_params
  if (!next) return items
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(next)) {
    if (value != null) params.set(key, String(value))
  }
  try {
    const second = await getJson<ExplorerTxPage>(
      `${network.blockscoutUrl}/api/v2/addresses/${address}/transactions?${params.toString()}`,
      options.fetcher,
    )
    items.push(...(second.items ?? []))
  } catch {
    return items
  }
  return items
}

async function confirmCurrentAllowances(
  owner: string,
  network: NetworkConfig,
  items: ApprovalItem[],
  options: ReadOptions,
): Promise<ApprovalItem[]> {
  if (items.length === 0) return []
  const chain = CHAINS[network.chainId as keyof typeof CHAINS]
  const client = createPublicClient({
    chain,
    transport: http(rpcUrlFor(network, options.env), { timeout: 8_000 }),
  })
  let block: bigint
  try {
    block = await client.getBlockNumber()
  } catch {
    return items.map((item) => ({
      ...item,
      asOf: 'historical' as const,
      risk: assessApproval({
        tokenSymbol: item.tokenSymbol,
        tokenAddress: item.tokenAddress,
        spender: item.spender,
        allowanceRaw: BigInt(item.allowanceRaw),
        source: item.source,
        txHash: item.txHash,
        asOf: 'historical',
      }),
    }))
  }
  const confirmed: ApprovalItem[] = []
  for (const item of items.slice(0, 12)) {
    try {
      const allowance = await client.readContract({
        address: item.tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [owner as `0x${string}`, item.spender as `0x${string}`],
      })
      const source = `${network.name} eth_call allowance at block ${block}`
      confirmed.push({
        ...item,
        allowanceRaw: allowance.toString(),
        allowanceDisplay: item.allowanceDisplay,
        unlimited: isUnlimitedAllowance(allowance),
        source,
        asOf: 'current',
        observedAtBlock: block.toString(),
        risk: assessApproval({
          tokenSymbol: item.tokenSymbol,
          tokenAddress: item.tokenAddress,
          spender: item.spender,
          allowanceRaw: allowance,
          source,
          txHash: item.txHash,
          asOf: 'current',
          blockNumber: block.toString(),
        }),
      })
    } catch {
      confirmed.push({
        ...item,
        asOf: 'historical',
        observedAtBlock: block.toString(),
        risk: assessApproval({
          tokenSymbol: item.tokenSymbol,
          tokenAddress: item.tokenAddress,
          spender: item.spender,
          allowanceRaw: BigInt(item.allowanceRaw),
          source: item.source,
          txHash: item.txHash,
          asOf: 'historical',
          blockNumber: block.toString(),
        }),
      })
    }
  }
  return confirmed
}

async function readApprovals(address: string, network: NetworkConfig, activity: ActivityItem[], options: ReadOptions): Promise<ApprovalItem[]> {
  const derived = activity
    .filter((item) => item.type === 'approval' && item.decoded)
    .map((item) => approvalItemFromActivity(item, network.name))
    .filter((item): item is ApprovalItem => item != null)
  try {
    const remote = await getJson<unknown>(`${network.blockscoutUrl}/api/v2/addresses/${address}/token-approvals`, options.fetcher)
    const rows = Array.isArray(remote) ? remote : []
    for (const row of rows) {
      const mapped = approvalFromExplorer(row, network)
      if (!mapped) continue
      const key = `${mapped.tokenAddress}:${mapped.spender}`
      const index = derived.findIndex((item) => `${item.tokenAddress}:${item.spender}` === key)
      if (index >= 0) derived[index] = mapped
      else derived.push(mapped)
    }
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error
  }
  return derived
}

function approvalItemFromActivity(item: ActivityItem, chainName: string): ApprovalItem | null {
  const fact = approvalFromItem(item, chainName)
  if (!fact || !item.to) return null
  const risk = assessApproval(fact)
  return {
    chainId: item.chainId,
    chainName,
    tokenAddress: item.to,
    tokenSymbol: item.contractName,
    spender: fact.spender,
    allowanceRaw: fact.allowanceRaw.toString(),
    allowanceDisplay: null,
    unlimited: isUnlimitedAllowance(fact.allowanceRaw),
    source: fact.source,
    txHash: item.hash,
    asOf: 'historical',
    observedAtBlock: null,
    risk,
  }
}

function approvalFromItem(item: ActivityItem, chainName: string) {
  if (item.type !== 'approval' || !item.decoded) return null
  const spender = item.decoded.args.find((arg) => arg.type === 'address')?.value
  const raw = item.decoded.args.find((arg) => arg.type.startsWith('uint'))?.value
  if (!spender || !raw || !item.to) return null
  try {
    return {
      tokenSymbol: item.contractName,
      tokenAddress: item.to,
      spender: getAddress(spender),
      allowanceRaw: BigInt(raw),
      source: `${chainName} decoded transaction ${item.hash}`,
      txHash: item.hash,
    }
  } catch {
    return null
  }
}

function approvalFromExplorer(row: unknown, network: NetworkConfig): ApprovalItem | null {
  if (!row || typeof row !== 'object') return null
  const record = row as Record<string, unknown>
  const token = (record.token ?? {}) as Record<string, unknown>
  const spender = typeof record.spender === 'string' ? record.spender : typeof (record.spender as { hash?: string } | undefined)?.hash === 'string' ? (record.spender as { hash: string }).hash : null
  const tokenAddress = typeof token.address_hash === 'string' ? token.address_hash : typeof token.address === 'string' ? token.address : null
  const value = typeof record.value === 'string' ? record.value : null
  if (!spender || !tokenAddress || !value) return null
  const allowanceRaw = BigInt(value)
  const fact = {
    tokenSymbol: typeof token.symbol === 'string' ? token.symbol : null,
    tokenAddress: getAddress(tokenAddress),
    spender: getAddress(spender),
    allowanceRaw,
    source: `${network.name} explorer approval feed`,
    txHash: typeof record.tx_hash === 'string' ? record.tx_hash : null,
  }
  return {
    chainId: network.chainId,
    chainName: network.name,
    tokenAddress: fact.tokenAddress,
    tokenSymbol: fact.tokenSymbol,
    spender: fact.spender,
    allowanceRaw: allowanceRaw.toString(),
    allowanceDisplay: token.decimals != null ? formatUnits(allowanceRaw, Number(token.decimals)) : null,
    unlimited: isUnlimitedAllowance(allowanceRaw),
    source: fact.source,
    txHash: fact.txHash,
    asOf: 'historical',
    observedAtBlock: null,
    risk: assessApproval({ ...fact, asOf: 'historical' }),
  }
}

const OWNER_ABI = [
  {
    name: 'owner',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
] as const

const MALICIOUS_FLAGS = ['honeypot_related_address', 'phishing_activities', 'stealing_attack', 'darkweb_transactions'] as const

function parseAbi(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string' || value.length === 0) return null
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

async function readIntelligenceFlag(network: NetworkConfig, address: string, options: ReadOptions) {
  try {
    const body = await getJson<{ result?: Record<string, Record<string, string>> }>(
      `https://api.gopluslabs.io/api/v1/address_security/${address}?chain_id=${network.chainId}`,
      options.fetcher,
    )
    const row = body.result?.[address.toLowerCase()] ?? body.result?.[address]
    if (!row) return null
    for (const label of MALICIOUS_FLAGS) {
      if (row[label] === '1') return { source: 'GoPlus address security', label, value: '1' }
    }
    return null
  } catch {
    return null
  }
}

async function readContract(network: NetworkConfig, address: string, options: ReadOptions): Promise<ContractSnapshot> {
  const chain = CHAINS[network.chainId as keyof typeof CHAINS]
  const client = createPublicClient({
    chain,
    transport: http(rpcUrlFor(network, options.env), { timeout: 8_000 }),
  })
  const [explorer, code, ownerResult, intelligenceFlag] = await Promise.all([
    getJson<ExplorerAddress>(`${network.blockscoutUrl}/api/v2/addresses/${address}`, options.fetcher).catch(() => null),
    client.getBytecode({ address: address as `0x${string}` }).catch(() => null),
    client.readContract({ address: address as `0x${string}`, abi: OWNER_ABI, functionName: 'owner' }).catch(() => null),
    readIntelligenceFlag(network, address, options),
  ])
  let abi: unknown[] | null = null
  let verified = typeof explorer?.is_verified === 'boolean' ? explorer.is_verified : null
  let name = explorer?.name ?? null
  let proxyType = explorer?.proxy_type ?? null
  try {
    const contract = await getJson<ExplorerAddress>(`${network.blockscoutUrl}/api/v2/smart-contracts/${address}`, options.fetcher)
    abi = parseAbi(contract.abi)
    if (typeof contract.is_verified === 'boolean') verified = contract.is_verified
    name = contract.name ?? name
    proxyType = contract.proxy_type ?? proxyType
  } catch {
    abi = null
  }
  const isContract = code == null ? (explorer?.is_contract ?? null) : code !== '0x'
  const owner = typeof ownerResult === 'string' ? getAddress(ownerResult) : null
  const risk = assessContract({
    address,
    isContract,
    verified,
    proxyType,
    sourceFlagged: explorer?.is_scam ?? null,
    source: explorer ? `${network.name} explorer` : `${network.name} RPC`,
    owner,
    intelligenceFlag,
  })
  return {
    chainId: network.chainId,
    address,
    name,
    isContract,
    verified,
    proxyType,
    creator: explorer?.creator_address_hash ?? null,
    creationTxHash: explorer?.creation_transaction_hash ?? null,
    owner,
    abi,
    risk,
  }
}

async function readNativeBalance(address: string, network: NetworkConfig, options: ReadOptions): Promise<bigint> {
  const chain = CHAINS[network.chainId as keyof typeof CHAINS]
  const client = createPublicClient({
    chain,
    transport: http(rpcUrlFor(network, options.env), { timeout: 8_000 }),
  })
  return client.getBalance({ address: address as `0x${string}` })
}

function summarizeGas(network: NetworkConfig, items: ActivityItem[]) {
  const fees = items.map((item) => (item.feeRaw ? BigInt(item.feeRaw) : 0n))
  const total = fees.reduce((sum, fee) => sum + fee, 0n)
  const usd = addUsd(items.map((item) => item.feeUsd))
  return {
    chainId: network.chainId,
    chainName: network.name,
    nativeSymbol: network.nativeSymbol,
    sampleSize: items.length,
    totalFeeRaw: total.toString(),
    totalFeeDisplay: formatUnits(total, network.nativeDecimals),
    totalFeeUsd: usd.total,
  }
}

export async function explainQuestion(input: {
  question: string
  report: TransactionReport
  apiKey?: string
  model?: string
  fetcher?: Fetcher
}): Promise<TransactionReport['explanation']> {
  const deterministic = explainTransaction(input.question, input.report)
  if (!input.apiKey) return deterministic
  try {
    const allowedHashes = [input.report.item.hash, input.report.item.to, input.report.item.from].filter((value): value is string => Boolean(value))
    const response = await getJson<{ choices?: Array<{ message?: { content?: string } }> }>(
      'https://api.openai.com/v1/chat/completions',
      async (url, init) => {
        const fetcher = input.fetcher ?? fetch
        return fetcher(url, {
          ...init,
          method: 'POST',
          headers: {
            ...(init?.headers ?? {}),
            accept: 'application/json',
            'content-type': 'application/json',
            authorization: `Bearer ${input.apiKey}`,
          },
          body: JSON.stringify({
            model: input.model ?? 'gpt-4o-mini',
            temperature: 0,
            messages: [
              {
                role: 'system',
                content:
                  'Explain the user question using only the JSON evidence. Do not invent hashes, amounts, symbols, prices, or a safety verdict. Never say the transaction is safe. Never recommend buying, selling, or signing. If data is incomplete, say so.',
              },
              {
                role: 'user',
                content: JSON.stringify({
                  question: input.question,
                  transaction: input.report.item,
                  risk: input.report.risk,
                  contract: input.report.contract,
                }),
              },
            ],
          }),
        })
      },
    )
    const answer = response.choices?.[0]?.message?.content?.trim()
    if (!answer || explanationIntroducesUnknownHash(answer, allowedHashes)) return deterministic
    return { ...deterministic, answer, mode: 'llm' }
  } catch {
    return deterministic
  }
}
