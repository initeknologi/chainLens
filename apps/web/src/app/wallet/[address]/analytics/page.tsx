'use client'

import { useWallet } from '@/components/wallet-provider'
import { AnalyticsView } from '@/features/analytics/view'

export default function AnalyticsPage() {
  const { bundle } = useWallet()
  if (!bundle) return null
  return <AnalyticsView address={bundle.portfolio.address} portfolio={bundle.portfolio} />
}
