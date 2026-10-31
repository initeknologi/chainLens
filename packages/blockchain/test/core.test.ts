import { encodeFunctionData, erc20Abi, maxUint256 } from 'viem'
import { describe, expect, it } from 'vitest'
import { classifyTransaction, decodeCalldata } from '../src/decode'
import { explanationIntroducesUnknownHash, explainTransaction } from '../src/explain'
import { assertFetchableUrl, getJson, resetProviderHealth } from '../src/http'
import { formatUnits, isUnlimitedAllowance, parseDecimalToScaled, rawToUsd } from '../src/money'
import { normalizePublicAddress, selectNetworks } from '../src/analyze'
import { SecretMaterialError, UnsupportedChainError } from '@chainlens/shared-types'
import { buildAllocation } from '../src/portfolio-math'
import { assessApproval, assessContract, assessTransaction } from '../src/risk'
import type { ActivityItem, RiskAssessment } from '@chainlens/shared-types'

const spender = '0x1111111111111111111111111111111111111111'
const wallet = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'

describe('public address boundary', () => {
  it('accepts a public address and checksums it', () => {
    expect(normalizePublicAddress(wallet.toLowerCase())).toBe(wallet)
  })

  it('rejects a private key and a recovery phrase', () => {
    expect(() => normalizePublicAddress(`0x${'ab'.repeat(32)}`)).toThrow(SecretMaterialError)
    expect(() =>
      normalizePublicAddress('legal winner thank year wave sausage worth useful legal winner thank yellow'),
    ).toThrow(SecretMaterialError)
  })
})

describe('integer amounts', () => {
  it('formats token units without binary floating point', () => {
    expect(formatUnits(1_500_000_000_000_000_000n, 18)).toBe('1.5')
    expect(formatUnits(1_000_000n, 6)).toBe('1')
  })

  it('converts raw balance and a decimal price to USD', () => {
    expect(rawToUsd(1_500_000_000_000_000_000n, 18, '2000')).toBe('3000')
    expect(rawToUsd(1_000_000n, 6, '1')).toBe('1')
  })

  it('treats huge allowances as unlimited and keeps the exact threshold', () => {
    expect(isUnlimitedAllowance(maxUint256)).toBe(true)
    expect(isUnlimitedAllowance(parseDecimalToScaled('10', 0))).toBe(false)
  })
})

describe('calldata decoding', () => {
  it('decodes an ERC-20 approve and classifies it', () => {
    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [spender, maxUint256],
    })
    const decoded = decodeCalldata(data)
    expect(decoded?.method).toBe('approve')
    expect(decoded?.args[0]?.value).toBe(spender)
    expect(
      classifyTransaction({ method: decoded?.method ?? null, value: 0n, to: spender, inputData: data }),
    ).toBe('approval')
  })

  it('classifies a plain value transfer', () => {
    expect(classifyTransaction({ method: null, value: 1n, to: spender, inputData: '0x' })).toBe('native_transfer')
  })
})

describe('evidence-backed risk', () => {
  it('asks for review on an unlimited approval and does not call it safe', () => {
    const assessment = assessApproval({
      tokenSymbol: 'USDC',
      tokenAddress: spender,
      spender,
      allowanceRaw: maxUint256,
      source: 'decoded transaction 0x' + 'ab'.repeat(32),
      txHash: `0x${'ab'.repeat(32)}`,
    })
    expect(assessment.overall).toBe('review_recommended')
    expect(assessment.headline).not.toMatch(/safe/i)
    expect(assessment.signals[0]?.evidence.some((item) => item.label === 'Allowance raw')).toBe(true)
    expect(assessment.signals[0]?.severity).toBe('warning')
  })

  it('does not treat a historical approval amount as the current allowance', () => {
    const assessment = assessApproval({
      tokenSymbol: 'USDC',
      tokenAddress: spender,
      spender,
      allowanceRaw: maxUint256,
      source: 'decoded transaction',
      txHash: `0x${'ab'.repeat(32)}`,
      asOf: 'historical',
    })
    expect(assessment.overall).toBe('incomplete')
    expect(assessment.signals[0]?.id).toBe('allowance-not-current')
    expect(assessment.headline).not.toMatch(/safe/i)
  })

  it('classifies an explorer scam flag as critical evidence', () => {
    const assessment = assessContract({
      address: spender,
      isContract: true,
      verified: false,
      proxyType: null,
      sourceFlagged: true,
      source: 'explorer',
    })
    expect(assessment.signals.find((signal) => signal.id === 'explorer-flag')?.severity).toBe('critical')
    expect(assessment.overall).toBe('review_recommended')
  })

  it('stays incomplete when verification is unknown', () => {
    const assessment = assessContract({
      address: spender,
      isContract: null,
      verified: null,
      proxyType: null,
      sourceFlagged: null,
      source: 'explorer',
    })
    expect(assessment.overall).toBe('incomplete')
  })

  it('combines a verified contract and an unlimited approval into review recommended', () => {
    const assessment = assessTransaction({
      contract: {
        address: spender,
        isContract: true,
        verified: true,
        proxyType: null,
        sourceFlagged: null,
        source: 'explorer',
      },
      approval: {
        tokenSymbol: 'USDC',
        tokenAddress: spender,
        spender,
        allowanceRaw: maxUint256,
        source: 'decoded call',
        txHash: null,
      },
      decoded: true,
    })
    expect(assessment.overall).toBe('review_recommended')
    expect(assessment.signals.map((item) => item.id)).toContain('contract-verified')
    expect(assessment.signals.map((item) => item.id)).toContain('unlimited-approval')
  })
})

describe('explainer', () => {
  it('explains gas from receipt fields and refuses an unknown hash', () => {
    const item = activityFixture()
    const risk: RiskAssessment = {
      overall: 'incomplete',
      headline: 'Risk assessment incomplete',
      signals: [],
      limitations: [],
    }
    const explanation = explainTransaction('Why did this transaction consume gas?', { item, risk, contract: null })
    expect(explanation.answer).toContain('21000')
    expect(explanation.answer).toContain('0.00042')
    expect(explanation.mode).toBe('deterministic')
    expect(explanationIntroducesUnknownHash(`${explanation.answer} 0x${'cd'.repeat(32)}`, [item.hash])).toBe(true)
  })
})

describe('portfolio math', () => {
  it('assigns allocation in basis points that sum to 10000', () => {
    const slices = buildAllocation([
      asset('ETH', '75.00'),
      asset('USDC', '25.00'),
    ])
    expect(slices.reduce((sum, slice) => sum + slice.shareBps, 0)).toBe(10000)
    expect(slices[0]?.shareBps).toBe(7500)
  })
})

describe('network selection', () => {
  it('defaults to Ethereum and Base', () => {
    expect(selectNetworks().map((network) => network.chainId)).toEqual([1, 8453])
  })

  it('rejects a chain that is not configured', () => {
    expect(() => selectNetworks([999])).toThrow(UnsupportedChainError)
  })
})

describe('provider resilience', () => {
  it('opens a circuit after repeated failures and stops calling the host', async () => {
    resetProviderHealth()
    let calls = 0
    const fetcher = async () => {
      calls += 1
      return new Response('unavailable', { status: 503 })
    }
    const url = 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum'
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await expect(getJson(url, fetcher, 1_000, { retries: 0, baseDelayMs: 0 })).rejects.toThrow(/503/)
    }
    await expect(getJson(url, fetcher, 1_000, { retries: 0, baseDelayMs: 0 })).rejects.toThrow(/circuit/)
    expect(calls).toBe(4)
    resetProviderHealth()
  })
})

describe('data source allowlist', () => {
  it('allows the configured explorer and rejects local or unknown hosts', () => {
    expect(() => assertFetchableUrl('https://api.gopluslabs.io/api/v1/address_security/0x1')).not.toThrow()
    expect(() => assertFetchableUrl('http://127.0.0.1/latest')).toThrow(/https/)
    expect(() => assertFetchableUrl('https://169.254.169.254/latest')).toThrow(/private|allowlisted/i)
    expect(() => assertFetchableUrl('https://evil.example/rpc')).toThrow(/allowlisted/)
  })
})

function asset(symbol: string, valueUsd: string) {
  return {
    chainId: 1,
    chainName: 'Ethereum',
    tokenAddress: '0x0000000000000000000000000000000000000000',
    symbol,
    name: symbol,
    decimals: 18,
    rawBalance: '1',
    displayBalance: '1',
    priceUsd: '1',
    valueUsd,
    priceSource: 'test',
    priceObservedAt: null,
    isNative: true,
  }
}

function activityFixture(): ActivityItem {
  return {
    chainId: 1,
    chainName: 'Ethereum',
    hash: `0x${'ab'.repeat(32)}`,
    blockNumber: '1',
    timestamp: '2026-10-31T00:00:00.000Z',
    from: wallet,
    to: spender,
    status: 'success',
    type: 'native_transfer',
    method: null,
    summary: 'Sent 1 ETH to 0x1111…1111.',
    valueRaw: '1000000000000000000',
    valueDisplay: '1',
    nativeSymbol: 'ETH',
    feeRaw: '420000000000000',
    feeDisplay: '0.00042',
    feeUsd: '0.84',
    gasUsed: '21000',
    gasPrice: '20000000000',
    direction: 'out',
    counterparty: spender,
    contractName: null,
    contractVerified: false,
    decoded: null,
    inputData: '0x',
    explorerUrl: `https://etherscan.io/tx/0x${'ab'.repeat(32)}`,
  }
}
