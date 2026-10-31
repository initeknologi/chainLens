'use client'

import { useWallet } from '@/components/wallet-provider'
import { ApprovalsView } from '@/features/approvals/view'

export default function ApprovalsPage() {
  const { bundle } = useWallet()
  if (!bundle) return null
  return <ApprovalsView report={bundle.approvals} />
}
