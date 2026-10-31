'use client'

import { assertPublicIdentifier, SecretMaterialError } from '@chainlens/shared-types'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { CHAINS, readToken, writeChainIds, writeSave } from '@/lib/session'

const schema = z.object({
  address: z.string().trim().min(1, 'Enter a public address or ENS name.'),
  save: z.boolean(),
  ethereum: z.boolean(),
  base: z.boolean(),
  bsc: z.boolean(),
  polygon: z.boolean(),
})

type FormValues = z.infer<typeof schema>

const EXAMPLE = 'vitalik.eth'

export function AddressForm({ initial = '' }: { initial?: string }) {
  const router = useRouter()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { address: initial, save: false, ethereum: true, base: true, bsc: false, polygon: false },
  })
  const error = form.formState.errors.address?.message

  function submit(values: FormValues) {
    try {
      assertPublicIdentifier(values.address)
    } catch (caught) {
      form.setError('address', {
        message: caught instanceof SecretMaterialError ? caught.message : 'Enter a public address or ENS name.',
      })
      return
    }
    const chainIds = [
      values.ethereum ? 1 : 0,
      values.base ? 8453 : 0,
      values.bsc ? 56 : 0,
      values.polygon ? 137 : 0,
    ].filter((id) => id > 0)
    if (chainIds.length === 0) {
      form.setError('address', { message: 'Select at least one network. Ethereum and Base are the initial set.' })
      return
    }
    if (values.save && !readToken()) {
      writeChainIds(chainIds)
      writeSave(true)
      router.push('/account')
      return
    }
    writeChainIds(chainIds)
    writeSave(values.save)
    router.push(`/wallet/${encodeURIComponent(values.address.trim())}`)
  }

  return (
    <form onSubmit={form.handleSubmit(submit)} className="grid gap-4">
      <label className="sr-only" htmlFor="address">Public address or ENS</label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-mono text-xs text-[#8e7dff]">0x</span>
          <input
            id="address"
            {...form.register('address')}
            placeholder="wallet address or name.eth"
            spellCheck={false}
            autoCapitalize="off"
            className="w-full rounded-xl border border-line bg-white/[0.035] py-3.5 pl-11 pr-4 font-mono text-sm outline-none placeholder:text-muted/60 focus:border-signal/60 focus:ring-2 focus:ring-signal/15"
          />
        </div>
        <button className="web3-button px-5" type="submit">
          Analyze
        </button>
      </div>
      <fieldset className="grid gap-2.5">
        <legend className="eyebrow">Networks</legend>
        <div className="flex flex-wrap gap-2 text-xs">
          {CHAINS.map((chain) => (
            <label key={chain.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-white/[0.025] px-3 py-2 text-muted has-[:checked]:border-signal/40 has-[:checked]:bg-signal/10 has-[:checked]:text-text">
              <input className="accent-[#775cff]" type="checkbox" {...form.register(chain.id === 1 ? 'ethereum' : chain.id === 8453 ? 'base' : chain.id === 56 ? 'bsc' : 'polygon')} />
              <span>
                {chain.label}
                {chain.initial ? '' : ' · beta'}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex cursor-pointer items-start gap-2 text-xs leading-5 text-muted">
        <input type="checkbox" {...form.register('save')} className="mt-1 accent-[#775cff]" />
        <span>Save to my private profile. Off by default; otherwise this address is not persisted.</span>
      </label>
      {error ? <p className="text-sm text-rose">{error}</p> : null}
      <button type="button" className="w-fit text-left text-xs text-[#9d8fff] hover:text-text" onClick={() => form.setValue('address', EXAMPLE)}>
        Try vitalik.eth →
      </button>
    </form>
  )
}
