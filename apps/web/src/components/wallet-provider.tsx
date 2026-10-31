'use client'

import { useQuery } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useState } from 'react'
import type { AnalysisBundle } from '@chainlens/shared-types'
import { analyzeWallet } from '@/lib/api'
import { readChainIds, readSave, readToken } from '@/lib/session'

interface WalletState {
  address: string
  chainIds: number[]
  bundle?: AnalysisBundle
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

const WalletContext = createContext<WalletState | null>(null)

export function WalletProvider({ address, children }: { address: string; children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const [chainIds, setChainIds] = useState<number[]>([1, 8453])
  useEffect(() => {
    setChainIds(readChainIds())
    setReady(true)
  }, [])
  const query = useQuery({
    queryKey: ['analysis', address.toLowerCase(), chainIds.join(',')],
    queryFn: () => analyzeWallet(decodeURIComponent(address), chainIds, readSave(), readToken()),
    enabled: ready,
    retry: false,
    staleTime: 60_000,
  })
  return (
    <WalletContext.Provider
      value={{
        address,
        chainIds,
        bundle: query.data,
        isLoading: !ready || query.isLoading,
        error: query.error instanceof Error ? query.error : null,
        refetch: () => void query.refetch(),
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const value = useContext(WalletContext)
  if (!value) throw new Error('WalletProvider is missing')
  return value
}
