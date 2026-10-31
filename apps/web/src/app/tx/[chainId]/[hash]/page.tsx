import { TransactionView } from '@/features/contracts/view'

export default async function TransactionPage({
  params,
  searchParams,
}: {
  params: Promise<{ chainId: string; hash: string }>
  searchParams: Promise<{ address?: string }>
}) {
  const { chainId, hash } = await params
  const query = await searchParams
  return <TransactionView chainId={chainId} hash={hash} address={query.address} />
}
