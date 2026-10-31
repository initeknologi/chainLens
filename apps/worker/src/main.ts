import { Worker } from 'bullmq'
import IORedis from 'ioredis'
import { analyzeAddress } from '@chainlens/blockchain'
import { claimDueJob, finishJob, getPrisma, saveAnalysis, savedChainIds } from '@chainlens/database'

function redact(address: string): string {
  return address.length < 12 ? 'address' : `${address.slice(0, 6)}…${address.slice(-4)}`
}

async function refresh(address: string) {
  const chainIds = await savedChainIds(getPrisma(), address)
  const bundle = await analyzeAddress(address, { chainIds: chainIds.length > 0 ? chainIds : [1, 8453] })
  await saveAnalysis(getPrisma(), bundle)
}

async function poll() {
  const prisma = getPrisma()
  const job = await claimDueJob(prisma)
  if (!job) return
  try {
    await refresh(job.address)
    await finishJob(prisma, job.id)
    console.log(JSON.stringify({ event: 'wallet_refresh_completed', address: redact(job.address) }))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'refresh failed'
    await finishJob(prisma, job.id, message)
    console.error(JSON.stringify({ event: 'wallet_refresh_failed', address: redact(job.address) }))
  }
}

async function main() {
  if (process.env.REDIS_URL) {
    const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
    const worker = new Worker('chainlens-refresh', async (job) => refresh(String(job.data.address)), { connection })
    worker.on('failed', (job, error) => console.error(`job ${job?.id} failed: ${error.message}`))
    console.log('ChainLens worker listening on Redis queue chainlens-refresh')
    return
  }
  console.log('ChainLens worker polling indexed wallets. Set REDIS_URL to use BullMQ.')
  setInterval(() => {
    void poll()
  }, 15_000)
  await poll()
}

void main()
