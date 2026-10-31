'use client'

import { AssessmentBadge, EvidenceList, SeverityLabel } from '@chainlens/ui'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { getContract, shortAddress } from '@/lib/api'

export function ContractView({ chainId, address }: { chainId: string; address: string }) {
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  const query = useQuery({
    queryKey: ['contract', chainId, address.toLowerCase()],
    queryFn: () => getContract(chainId, address),
    enabled: ready,
  })
  if (!ready || query.isLoading) return <p className="text-muted">Reading contract metadata from the explorer and the chain.</p>
  if (query.error instanceof Error) return <p className="text-rose">{query.error.message}</p>
  const contract = query.data
  if (!contract) return null
  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border border-line bg-panel/85 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Contract intelligence</p>
          <AssessmentBadge overall={contract.risk.overall} />
        </div>
        <h1 className="mt-4 break-all font-mono text-lg text-mint">{contract.address}</h1>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <Fact label="Name" value={contract.name ?? 'Not provided'} />
          <Fact label="Network" value={String(contract.chainId)} />
          <Fact label="Bytecode" value={contract.isContract == null ? 'Unknown' : contract.isContract ? 'Present' : 'Not observed'} />
          <Fact label="Verified" value={contract.verified == null ? 'Unknown' : contract.verified ? 'Verified source' : 'Unverified bytecode'} />
          <Fact label="Creator" value={contract.creator ? shortAddress(contract.creator) : 'Not provided by the explorer'} />
          <Fact label="Creation transaction" value={contract.creationTxHash ? shortAddress(contract.creationTxHash) : 'Not provided'} />
          <Fact label="Owner" value={contract.owner ? shortAddress(contract.owner) : 'owner() did not return an address'} />
          <Fact label="ABI" value={contract.abi ? `${contract.abi.length} entries` : 'Unavailable'} />
        </dl>
      </section>
      <section className="grid gap-4">
        {contract.risk.signals.map((signal) => (
          <article key={signal.id} className="rounded-3xl border border-line p-5">
            <div className="flex flex-wrap items-center gap-3">
              <h2>{signal.title}</h2>
              <SeverityLabel severity={signal.severity} />
            </div>
            <p className="mt-2 text-sm text-muted">{signal.explanation}</p>
            <div className="mt-3">
              <EvidenceList items={signal.evidence} />
            </div>
          </article>
        ))}
      </section>
      <ul className="grid gap-2 text-sm text-muted">
        {contract.risk.limitations.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.16em] text-muted">{label}</dt>
      <dd className="mt-1 break-all">{value}</dd>
    </div>
  )
}
