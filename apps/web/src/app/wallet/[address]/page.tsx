'use client'

import { PortfolioView } from '@/features/portfolio/view'
import { useWallet } from '@/components/wallet-provider'

export default function PortfolioPage() {
  const { bundle } = useWallet()
  if (!bundle) return null
  return <PortfolioView bundle={bundle} />
}
