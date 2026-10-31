import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as { chainlensPrisma?: PrismaClient }

export function getPrisma(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Run pnpm dev so embedded Postgres starts, or point DATABASE_URL at PostgreSQL.')
  }
  if (!globalForPrisma.chainlensPrisma) {
    globalForPrisma.chainlensPrisma = new PrismaClient()
  }
  return globalForPrisma.chainlensPrisma
}
