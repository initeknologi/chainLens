import { decodeFunctionData, erc20Abi, erc721Abi, type Hex } from 'viem'
import type { DecodedArg, DecodedCall, TxType } from '@chainlens/shared-types'

const wethAbi = [
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'payable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'withdraw',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'wad', type: 'uint256' }],
    outputs: [],
  },
] as const

const swapAbi = [
  {
    type: 'function',
    name: 'swapExactETHForTokens',
    stateMutability: 'payable',
    inputs: [
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
  {
    type: 'function',
    name: 'swapExactTokensForETH',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
  {
    type: 'function',
    name: 'swapExactTokensForTokens',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
] as const

const abis = [erc20Abi, erc721Abi, wethAbi, swapAbi]

function stringifyArg(value: unknown): string {
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map((item) => stringifyArg(item)).join(', ')
  return JSON.stringify(value)
}

export function decodeCalldata(input: string): DecodedCall | null {
  if (!input || input === '0x' || !input.startsWith('0x') || input.length < 10) return null
  const selector = input.slice(0, 10)
  for (const abi of abis) {
    try {
      const decoded = decodeFunctionData({ abi, data: input as Hex })
      const fragment = abi.find((item) => item.type === 'function' && item.name === decoded.functionName)
      const inputs = fragment && 'inputs' in fragment ? fragment.inputs : []
      const args: DecodedArg[] = (decoded.args ?? []).map((value, index) => ({
        name: inputs[index]?.name || `arg${index}`,
        type: inputs[index]?.type || 'unknown',
        value: stringifyArg(value),
      }))
      return { method: decoded.functionName, selector, args, source: 'local-abi' }
    } catch {
      continue
    }
  }
  return { method: null, selector, args: [], source: 'selector-only' }
}

export function classifyTransaction(input: {
  method: string | null
  value: bigint
  to: string | null
  inputData: string
}): TxType {
  if (!input.to) return 'contract_creation'
  const name = (input.method ?? '').toLowerCase()
  if (name === 'approve' || name === 'increaseallowance' || name === 'setapprovalforall') return 'approval'
  if (name.includes('swap')) return 'swap'
  if (name === 'transfer' || name === 'transferfrom' || name === 'safetransferfrom') return 'token_transfer'
  const emptyInput = !input.inputData || input.inputData === '0x'
  if (input.value > 0n && emptyInput) return 'native_transfer'
  return 'contract_interaction'
}

export function selectorOf(input: string): string | null {
  if (!input || !input.startsWith('0x') || input.length < 10) return null
  return input.slice(0, 10)
}
