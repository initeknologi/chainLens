# Architecture

`packages/blockchain` owns chain reads, decoding, integer math, risk rules, and explanations. It does not import the database.

`packages/database` maps those reports into Postgres with Prisma. Tables cover networks, wallets, tokens, balances, transactions, decoded events, contracts, contract risk signals, approvals, portfolio snapshots, analysis reports, and index jobs.

`apps/api` is a NestJS gateway. `POST /v1/wallets/analyze` performs a synchronous read so the first view is not empty, writes the normalized rows, and enqueues a refresh. The refresh waits 30 minutes.

`apps/worker` claims due jobs from Postgres. If `REDIS_URL` is set, it listens on the BullMQ queue `chainlens-refresh` instead.

`apps/web` is a Next.js client. It never talks to RPC providers directly.

Indexing is idempotent on `(chain_id, transaction_hash, wallet_address)`. Re-reading a transaction updates the stored receipt fields, including a changed block hash if the explorer returns one on a later read. Rows outside the latest page are kept, because a short page is not proof that an older transaction was reorged away.
