import { URL } from 'node:url'

export interface NetworkConfig {
  chainId: number
  name: string
  slug: string
  nativeSymbol: string
  nativeDecimals: number
  coingeckoId: string
  explorerUrl: string
  blockscoutUrl: string
  defaultRpcUrl: string
}

export const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000'

export const NETWORKS: NetworkConfig[] = [
  {
    chainId: 1,
    name: 'Ethereum',
    slug: 'ethereum',
    nativeSymbol: 'ETH',
    nativeDecimals: 18,
    coingeckoId: 'ethereum',
    explorerUrl: 'https://etherscan.io',
    blockscoutUrl: 'https://eth.blockscout.com',
    defaultRpcUrl: 'https://ethereum.publicnode.com',
  },
  {
    chainId: 56,
    name: 'BNB Smart Chain',
    slug: 'bsc',
    nativeSymbol: 'BNB',
    nativeDecimals: 18,
    coingeckoId: 'binancecoin',
    explorerUrl: 'https://bscscan.com',
    blockscoutUrl: 'https://bsc.blockscout.com',
    defaultRpcUrl: 'https://bsc.publicnode.com',
  },
  {
    chainId: 137,
    name: 'Polygon',
    slug: 'polygon',
    nativeSymbol: 'POL',
    nativeDecimals: 18,
    coingeckoId: 'polygon-ecosystem-token',
    explorerUrl: 'https://polygonscan.com',
    blockscoutUrl: 'https://polygon.blockscout.com',
    defaultRpcUrl: 'https://polygon-bor.publicnode.com',
  },
  {
    chainId: 8453,
    name: 'Base',
    slug: 'base',
    nativeSymbol: 'ETH',
    nativeDecimals: 18,
    coingeckoId: 'ethereum',
    explorerUrl: 'https://basescan.org',
    blockscoutUrl: 'https://base.blockscout.com',
    defaultRpcUrl: 'https://base.publicnode.com',
  },
]

const RPC_ENV: Record<number, string> = {
  1: 'ETH_RPC_URL',
  56: 'BSC_RPC_URL',
  137: 'POLYGON_RPC_URL',
  8453: 'BASE_RPC_URL',
}

export function getNetwork(chainId: number): NetworkConfig | undefined {
  return NETWORKS.find((network) => network.chainId === chainId)
}

export function requireNetwork(chainId: number): NetworkConfig {
  const network = getNetwork(chainId)
  if (!network) {
    throw new Error(`Chain ${chainId} is not supported`)
  }
  return network
}

export function rpcUrlFor(network: NetworkConfig, env: NodeJS.ProcessEnv = process.env): string {
  const override = env[RPC_ENV[network.chainId]]
  return override && override.length > 0 ? override : network.defaultRpcUrl
}

export function allowedHttpsHosts(env: NodeJS.ProcessEnv = process.env): Set<string> {
  const hosts = new Set<string>()
  for (const network of NETWORKS) {
    hosts.add(new URL(network.blockscoutUrl).hostname)
    hosts.add(new URL(rpcUrlFor(network, env)).hostname)
    hosts.add(new URL(network.defaultRpcUrl).hostname)
  }
  hosts.add('api.coingecko.com')
  hosts.add('api.openai.com')
  hosts.add('api.gopluslabs.io')
  return hosts
}

export function explorerTxUrl(network: NetworkConfig, hash: string): string {
  return `${network.explorerUrl}/tx/${hash}`
}

export function explorerAddressUrl(network: NetworkConfig, address: string): string {
  return `${network.explorerUrl}/address/${address}`
}
