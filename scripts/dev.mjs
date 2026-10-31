import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(pnpm, args, {
      cwd: root,
      stdio: 'inherit',
      env: process.env,
      shell: process.platform === 'win32',
    })
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${args.join(' ')} exited ${code}`))
    })
  })
}

let server
let database

if (!process.env.DATABASE_URL) {
  mkdirSync(path.join(root, 'data'), { recursive: true })
  database = await PGlite.create(path.join(root, 'data', 'pglite'))
  server = new PGLiteSocketServer({
    db: database,
    host: '127.0.0.1',
    port: 54329,
    maxConnections: 10,
  })
  await server.start()
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:54329/postgres?sslmode=disable&connection_limit=1&pgbouncer=true'
  console.log('Embedded Postgres is listening on 127.0.0.1:54329')
}

const shutdown = async () => {
  if (server) await server.stop()
  if (database) await database.close()
}

process.on('SIGINT', () => {
  void shutdown().finally(() => process.exit(0))
})
process.on('SIGTERM', () => {
  void shutdown().finally(() => process.exit(0))
})

await run(['--filter', '@chainlens/database', 'generate'])
await run(['--filter', '@chainlens/database', 'push'])
const turbo = spawn(pnpm, ['exec', 'turbo', 'dev'], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
})

turbo.on('exit', (code) => {
  void shutdown().finally(() => process.exit(code ?? 0))
})
