import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dir = path.join(root, 'data', 'pglite')
mkdirSync(path.join(root, 'data'), { recursive: true })
const database = await PGlite.create(dir)
const server = new PGLiteSocketServer({
  db: database,
  host: '127.0.0.1',
  port: 54329,
  maxConnections: 10,
})
await server.start()
console.log('ready 127.0.0.1:54329')
setInterval(() => {}, 1 << 30)
