'use client'

import { useWallet } from '@/components/wallet-provider'
import { ActivityView } from '@/features/transactions/view'

export default function ActivityPage() {
  const { bundle } = useWallet()
  if (!bundle) return null
  return <ActivityView report={bundle.activity} address={bundle.portfolio.address} />
}
