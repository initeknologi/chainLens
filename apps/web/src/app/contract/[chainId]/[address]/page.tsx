'use client'

import { use } from 'react'
import { ContractView } from '@/features/contracts/contract-view'

export default function ContractPage({ params }: { params: Promise<{ chainId: string; address: string }> }) {
  const { chainId, address } = use(params)
  return <ContractView chainId={chainId} address={address} />
}
