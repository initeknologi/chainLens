'use client'

import { AssessmentBadge, EvidenceList, SeverityLabel } from '@chainlens/ui'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { explainTransaction, getTransaction } from '@/lib/api'

const questions = [
  'What happened in this transaction?',
  'Why did this transaction consume gas?',
  'What does this smart contract do?',
  'Why is this transaction flagged?',
]

export function TransactionView({ chainId, hash, address }: { chainId: string; hash: string; address?: string }) {
  const [activeQuestion, setActiveQuestion] = useState(questions[0])
  const [ready, setReady] = useState(false)
  useEffect(() => {
    setReady(true)
  }, [])
  const query = useQuery({
    queryKey: ['tx', chainId, hash, address ?? ''],
    queryFn: () => getTransaction(chainId, hash, address),
    enabled: ready,
  })
  const explain = useMutation({
    mutationFn: (question: string) =>
      explainTransaction({ question, chainId: Number(chainId), hash, address }),
  })
  if (!ready || query.isLoading) return <p className="text-muted">Loading the transaction from the explorer and decoding it.</p>
  if (query.error instanceof Error) return <p className="text-rose">{query.error.message}</p>
  const report = explain.data ?? query.data
  if (!report) return null
  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border border-line bg-panel/85 p-6 shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Transaction analysis</p>
          <AssessmentBadge overall={report.risk.overall} />
        </div>
        <h1 className="mt-4 break-all font-mono text-lg text-mint sm:text-xl">{report.item.hash}</h1>
        <p className="mt-4 max-w-3xl text-lg">{report.item.summary}</p>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <Fact label="Network" value={`${report.item.chainName} · chain ${report.item.chainId}`} />
          <Fact label="Type" value={report.item.type.replaceAll('_', ' ')} />
          <Fact label="Gas fee" value={report.item.feeDisplay ? `${report.item.feeDisplay} ${report.item.nativeSymbol}` : 'Not on the receipt'} />
          <Fact label="Contract" value={report.item.contractName ?? report.item.to ?? 'None'} />
          <Fact label="Status" value={report.item.status} />
          <Fact label="Block" value={report.item.blockNumber} />
          <Fact label="Verification" value={report.item.contractVerified == null ? 'Unknown' : report.item.contractVerified ? 'Verified' : 'Not verified'} />
        </dl>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          {report.item.explorerUrl ? (
            <a className="text-signal" href={report.item.explorerUrl} target="_blank" rel="noreferrer">
              Open in the block explorer
            </a>
          ) : null}
          {report.item.to ? (
            <a className="text-signal" href={`/contract/${report.item.chainId}/${report.item.to}`}>
              Contract intelligence
            </a>
          ) : null}
        </div>
      </section>
      <section className="rounded-3xl border border-line p-6">
        <h2 className="text-lg">What the checks found</h2>
        <div className="mt-4 grid gap-4">
          {report.risk.signals.map((signal) => (
            <article key={signal.id} className="border-t border-line pt-4">
              <div className="flex flex-wrap items-center gap-3">
                <h3>{signal.title}</h3>
                <SeverityLabel severity={signal.severity} />
              </div>
              <p className="mt-2 text-sm text-muted">{signal.explanation}</p>
              <div className="mt-3">
                <EvidenceList items={signal.evidence} />
              </div>
            </article>
          ))}
          {report.risk.signals.length === 0 ? <p className="text-sm text-muted">No signal was produced. That is not a safety verdict.</p> : null}
        </div>
      </section>
      <section className="rounded-3xl border border-line bg-ink/40 p-6">
        <h2 className="font-serif text-3xl text-mint">Ask from the evidence</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {questions.map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => {
                setActiveQuestion(question)
                explain.mutate(question)
              }}
              className={`rounded-full border px-3 py-2 text-left text-sm ${activeQuestion === question ? 'border-signal text-mint' : 'border-line text-muted'}`}
            >
              {question}
            </button>
          ))}
        </div>
        <p className="mt-5 whitespace-pre-wrap text-sm leading-6">{report.explanation.answer}</p>
        <p className="mt-4 text-xs uppercase tracking-[0.16em] text-muted">Explainer mode: {report.explanation.mode}</p>
        <ul className="mt-3 grid gap-2 text-sm text-muted">
          {report.explanation.limitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
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
