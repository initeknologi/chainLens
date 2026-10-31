# Database

Prisma schema: `packages/database/prisma/schema.prisma`.

| Table | Role |
| --- | --- |
| users | Reserved. Public analysis does not create accounts. |
| networks | Ethereum, BNB Smart Chain, Polygon, Base |
| wallets | Public address per chain |
| tokens | Metadata keyed by chain and contract |
| wallet_balances | Latest raw balance, stored as a decimal integer string |
| transactions | Unique on chain id, hash, and watched address |
| transaction_events | Decoded call arguments for that transaction |
| contracts | Verification and proxy metadata |
| contract_risks | One row per evidence-backed signal |
| wallet_approvals | Observed spender and raw allowance |
| portfolio_snapshots | Valuation points, at most one every 10 minutes |
| analysis_reports | Stored transaction explanations |
| index_jobs | Refresh queue used when Redis is not configured |

Native and token amounts are integer strings. USD values are decimal strings produced with integer scaling, not IEEE-754 math.

Local development can use the embedded Postgres started by `scripts/dev.mjs`. Docker Compose provides PostgreSQL 16 and Redis 7 for a conventional deployment.
