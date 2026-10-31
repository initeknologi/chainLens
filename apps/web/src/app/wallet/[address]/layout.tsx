import { WalletFrame } from '@/components/wallet-frame'
import { WalletProvider } from '@/components/wallet-provider'

export default async function WalletLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ address: string }>
}) {
  const { address } = await params
  return (
    <WalletProvider address={address}>
      <WalletFrame>{children}</WalletFrame>
    </WalletProvider>
  )
}
