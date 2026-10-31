'use client'

import { FormEvent, useEffect, useState } from 'react'
import { Fingerprint, LockKeyhole, Plus, ShieldCheck, Trash2, WalletCards } from 'lucide-react'
import { createAccount, deleteAccount, forgetWallet, getAccount, savePreferences, shortAddress } from '@/lib/api'
import { readChainIds, readToken, writeToken } from '@/lib/session'

interface Account {
  displayName: string
  wallets: Array<{ address: string; savedAt: string }>
}

export function AccountView() {
  const [name, setName] = useState('Local profile')
  const [account, setAccount] = useState<Account | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const token = readToken()
    if (!token) return
    void getAccount(token).then(setAccount).catch(() => writeToken(null))
  }, [])

  async function create(event: FormEvent) {
    event.preventDefault()
    const created = await createAccount(name)
    writeToken(created.token)
    const next = await getAccount(created.token)
    setAccount(next)
    await savePreferences(created.token, { networks: readChainIds(), showUnpriced: true })
    setMessage('Profile created on this browser. The token stays in session storage and is not a wallet key.')
  }

  async function removeWallet(address: string) {
    const token = readToken()
    if (!token) return
    const next = await forgetWallet(token, address)
    setAccount((current) => (current ? { ...current, wallets: next.wallets.map((wallet) => ({ ...wallet, savedAt: '' })) } : current))
  }

  async function removeAccount() {
    const token = readToken()
    if (!token) return
    await deleteAccount(token)
    writeToken(null)
    setAccount(null)
    setMessage('The profile and its saved wallet references were deleted.')
  }

  return (
    <div className="grid gap-5">
      <section className="glass-panel relative overflow-hidden p-7 sm:p-8">
        <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-signal/15 blur-3xl" />
        <div className="relative">
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-signal/15 text-[#a99dff]"><Fingerprint /></span>
        <p className="eyebrow mt-6">Privacy center</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Profile & saved wallets</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          ChainLens does not store a wallet address unless you create a profile and choose Save. Deleting the profile removes that association and the indexed rows that belong only to it. Public chain data is not a secret, but the fact that you looked it up can be.
        </p>
        <div className="mt-5 flex flex-wrap gap-4 text-xs text-muted"><span className="flex items-center gap-2"><LockKeyhole size={13} className="text-success" /> Session-only profile token</span><span className="flex items-center gap-2"><ShieldCheck size={13} className="text-success" /> No wallet credentials</span></div>
        </div>
      </section>
      {account ? (
        <section className="glass-panel p-6">
          <div className="flex items-center justify-between"><div><p className="eyebrow">Active profile</p><h2 className="mt-2 text-lg">{account.displayName}</h2></div><WalletCards className="text-[#a99dff]" /></div>
          <ul className="mt-4 grid gap-3">
            {account.wallets.map((wallet) => (
              <li key={wallet.address} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white/[0.02] p-4">
                <div><p className="font-mono text-sm">{shortAddress(wallet.address)}</p><p className="mt-1 text-xs text-muted">Saved public address</p></div>
                <button type="button" className="flex items-center gap-2 text-xs text-rose" onClick={() => void removeWallet(wallet.address)}>
                  <Trash2 size={13} /> Remove
                </button>
              </li>
            ))}
            {account.wallets.length === 0 ? <li className="text-sm text-muted">No wallet is saved.</li> : null}
          </ul>
          <button type="button" className="mt-6 flex items-center gap-2 rounded-xl border border-rose/30 bg-rose/[0.04] px-4 py-2.5 text-sm text-rose" onClick={() => void removeAccount()}>
            <Trash2 size={14} /> Delete profile and associations
          </button>
        </section>
      ) : (
        <form onSubmit={(event) => void create(event)} className="glass-panel grid max-w-xl gap-4 p-6">
          <div><p className="eyebrow">Optional account</p><h2 className="mt-2 text-xl font-semibold">Create a local profile</h2></div>
          <label className="text-sm text-muted" htmlFor="name">
            Display name
          </label>
          <input id="name" value={name} onChange={(event) => setName(event.target.value)} className="rounded-xl border border-line bg-white/[0.03] px-4 py-3 outline-none focus:border-signal/50" />
          <button className="web3-button w-fit" type="submit">
            <Plus size={15} /> Create profile
          </button>
        </form>
      )}
      {message ? <p className="text-sm text-muted">{message}</p> : null}
    </div>
  )
}
