'use client'

import type { Explanation } from '@chainlens/shared-types'
import { EvidenceList } from '@chainlens/ui'
import { Bot, Braces, Loader2, Send, ShieldCheck } from 'lucide-react'
import { FormEvent, useState } from 'react'
import { askAssistant } from '@/lib/api'

interface Turn {
  question: string
  explanation: Explanation
}

export function AssistantView({ address }: { address?: string }) {
  const [question, setQuestion] = useState('What happened to the balances that were just read?')
  const [hash, setHash] = useState('')
  const [chainId, setChainId] = useState('1')
  const [turns, setTurns] = useState<Turn[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      const explanation = await askAssistant({
        question,
        address,
        chainId: hash ? Number(chainId) : undefined,
        hash: hash || undefined,
      })
      setTurns((current) => [...current, { question, explanation }])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The question could not be answered.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="grid gap-5">
      <section className="glass-panel relative overflow-hidden p-6 sm:p-8">
        <div className="absolute -right-12 -top-20 h-64 w-64 rounded-full bg-signal/20 blur-[90px]" />
        <div className="relative">
        <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-signal/15 text-[#aa9fff]"><Bot /></span><div><p className="eyebrow">Blockchain explainer</p><p className="mt-1 text-xs text-success">Source-linked answers</p></div></div>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">Ask from on-chain context</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          A transaction question uses that hash. A wallet question uses a fresh read of the public address. Responses stay deterministic unless a model key is configured; answers that invent a hash are discarded.
        </p>
        <form onSubmit={submit} className="mt-7 grid gap-3">
          <label className="text-sm text-muted" htmlFor="question">
            Question
          </label>
          <textarea id="question" value={question} onChange={(event) => setQuestion(event.target.value)} className="min-h-28 rounded-xl border border-line bg-white/[0.03] px-4 py-3 text-sm outline-none focus:border-signal/50" />
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={chainId} onChange={(event) => setChainId(event.target.value)} placeholder="Chain id" className="rounded-xl border border-line bg-white/[0.03] px-4 py-3 font-mono text-sm outline-none focus:border-signal/50" />
            <input value={hash} onChange={(event) => setHash(event.target.value)} placeholder="Optional transaction hash" className="rounded-xl border border-line bg-white/[0.03] px-4 py-3 font-mono text-sm outline-none focus:border-signal/50" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-4 text-xs text-muted"><span className="flex items-center gap-1"><Braces size={12} /> Structured context</span><span className="flex items-center gap-1"><ShieldCheck size={12} /> Hash guard</span></div>
          <button className="web3-button w-fit" type="submit" disabled={pending}>
            {pending ? <><Loader2 size={15} className="animate-spin" /> Working</> : <><Send size={15} /> Ask ChainLens</>}
          </button>
          </div>
        </form>
        {error ? <p className="mt-3 text-sm text-rose">{error}</p> : null}
        </div>
      </section>
      {turns.map((turn, index) => (
        <article key={`${turn.question}-${index}`} className="glass-panel p-6">
          <h2 className="text-lg">{turn.question}</h2>
          <p className="mt-3 whitespace-pre-wrap">{turn.explanation.answer}</p>
          <p className="mt-3 text-xs uppercase tracking-[0.14em] text-muted">Mode: {turn.explanation.mode}</p>
          <div className="mt-4">
            <EvidenceList items={turn.explanation.evidence} />
          </div>
          <ul className="mt-4 grid gap-2 text-sm text-muted">
            {turn.explanation.limitations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  )
}
