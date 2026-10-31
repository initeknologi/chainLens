# ChainLens

Read-only portfolio intelligence for public EVM wallets.

ChainLens turns balances, transactions, approvals, and contract metadata into traceable wallet reports. It accepts only a public address or ENS name—never a recovery phrase, private key, signature, or wallet connection.

> ChainLens is an analytics tool, not a wallet, trading service, or security guarantee.

## Features

- Multi-chain balances and allocation across Ethereum, Base, BNB Smart Chain, and Polygon
- Decoded transaction activity with gas usage and plain-language summaries
- Token approval visibility with current allowances separated from historical events
- Contract verification, proxy or delegation metadata, ownership, and ABI inspection
- Evidence-linked risk signals with explicit uncertainty instead of an opaque safety score
- Deterministic explanations with an optional, guarded language-model enhancement
- Optional local profiles; public addresses are not stored unless the user chooses to save them

## Tech stack

- **Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS, TanStack Query, Recharts
- **API:** NestJS, Zod, Helmet, OpenAPI
- **Blockchain:** Viem, public EVM RPC endpoints, Blockscout
- **Data:** PostgreSQL, Prisma, PGlite for zero-config local development
- **Jobs:** BullMQ and Redis, with a PostgreSQL-backed fallback
- **Tooling:** pnpm workspaces, Turborepo, Vitest, Docker Compose

## Architecture

```text
Next.js web app
      |
      v
NestJS API -----> Prisma / PostgreSQL
      |                    |
      v                    v
Blockchain domain      Refresh jobs
      |              (BullMQ or Postgres)
      v
Public RPC + Blockscout
```

`packages/blockchain` owns chain reads, ABI decoding, token math, risk rules, and explanations. The API orchestrates those operations and persists normalized reports; the web app never calls RPC providers directly.

## Getting started

### Prerequisites

- Node.js 20 or newer
- pnpm 10
- Docker Desktop only if you want external PostgreSQL and Redis

### Zero-config development

```bash
pnpm install
pnpm dev
```

When `DATABASE_URL` is not set, the development script starts an embedded PostgreSQL-compatible database on `127.0.0.1:54329`, applies the Prisma schema, and launches all applications.

| Service | URL |
| --- | --- |
| Web app | [http://localhost:3000](http://localhost:3000) |
| API health | [http://localhost:4000/api/v1/health](http://localhost:4000/api/v1/health) |
| OpenAPI document | [http://localhost:4000/api/v1/openapi.json](http://localhost:4000/api/v1/openapi.json) |

Stop the process with `Ctrl+C`. Local embedded-database data is stored under `data/`.

### PostgreSQL and Redis with Docker

Start the infrastructure:

```bash
docker compose up -d
```

Set these variables in your shell before running `pnpm dev`:

```text
DATABASE_URL=postgresql://chainlens:chainlens@127.0.0.1:5432/chainlens?sslmode=disable
REDIS_URL=redis://127.0.0.1:6379
```

The remaining supported variables and RPC overrides are documented in [`.env.example`](.env.example). When `REDIS_URL` is set, the worker consumes the `chainlens-refresh` BullMQ queue.

## Configuration

| Variable | Required | Default / purpose |
| --- | --- | --- |
| `DATABASE_URL` | No | Embedded database during `pnpm dev`; set for external PostgreSQL |
| `REDIS_URL` | No | Enables BullMQ; otherwise PostgreSQL jobs are used |
| `API_PORT` | No | `4000` |
| `WEB_ORIGIN` | No | `http://localhost:3000` |
| `NEXT_PUBLIC_API_URL` | No | `http://localhost:4000` |
| `OPENAI_API_KEY` | No | Enables model-enhanced explanations |
| `OPENAI_MODEL` | No | `gpt-4o-mini` |
| `ETH_RPC_URL` | No | Ethereum RPC override |
| `BASE_RPC_URL` | No | Base RPC override |
| `BSC_RPC_URL` | No | BNB Smart Chain RPC override |
| `POLYGON_RPC_URL` | No | Polygon RPC override |

Do not commit secrets or `.env` files. RPC overrides must be public HTTPS endpoints; private, loopback, and link-local hosts are rejected.

## Useful commands

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the web app, API, worker, and local database |
| `pnpm build` | Generate Prisma Client and build the monorepo |
| `pnpm test` | Run blockchain domain tests |
| `pnpm db:generate` | Generate Prisma Client |
| `pnpm db:push` | Apply the Prisma schema to the configured database |

## Project structure

```text
apps/
  api/          NestJS HTTP API
  web/          Next.js application
  worker/       Background refresh worker
packages/
  blockchain/   Chain clients, decoding, math, and risk analysis
  config/       Runtime configuration and supported networks
  database/     Prisma schema and persistence
  shared-types/ Shared domain contracts
  ui/           Reusable interface components
docs/           Architecture, API, database, security, and product notes
infrastructure/ Deployment-related configuration
scripts/        Local development orchestration
```

## API overview

The canonical prefix is `/api/v1`; legacy `/v1` requests are rewritten to it.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/health` | Database and provider-circuit health |
| `GET` | `/api/v1/networks` | Supported network metadata |
| `POST` | `/api/v1/wallets/analyze` | Analyze a public address |
| `GET` | `/api/v1/wallets/:address/activity` | Paginated indexed activity |
| `GET` | `/api/v1/transactions/:chainId/:hash` | Transaction intelligence |
| `GET` | `/api/v1/contracts/:chainId/:address` | Contract intelligence |
| `POST` | `/api/v1/explainer/ask` | Ask about retrieved wallet or transaction data |
| `POST` | `/api/v1/account` | Create an optional local profile |

See the [API guide](docs/api/endpoints.md) or `GET /api/v1/openapi.json` for request and response details.

## Testing

```bash
pnpm test
pnpm build
```

The domain test suite covers integer token math, calldata decoding, risk evidence, allowance history, network selection, provider circuit breaking, explanation guardrails, secret rejection, and provider allowlisting. Tests do not call live blockchain networks.

## Security model

- Secret-looking input is rejected before a network request.
- The application cannot construct, sign, or broadcast transactions.
- Provider hosts are allowlisted; unsafe outbound URLs are blocked.
- External JSON is normalized into known fields and token metadata is never rendered as HTML.
- Missing provider data remains explicitly incomplete.
- Model output is discarded if it introduces a transaction hash absent from the retrieved evidence.

See the [security model](docs/security/model.md) for the full threat model and trust boundaries.

## Known limitations

- Only EVM-compatible chains are supported.
- Activity comes from the latest explorer page, not a complete historical index.
- Observed approval events are not equivalent to a complete allowance scan.
- Valuation depends on explorer pricing; unpriced assets remain unpriced.
- Portfolio history begins after an address is first indexed.
- Public-provider availability and rate limits may produce partial reports.

## Documentation

- [Architecture](docs/architecture/overview.md)
- [API](docs/api/endpoints.md)
- [Database schema](docs/database/schema.md)
- [Security model](docs/security/model.md)
- [Wallet Intelligence Center concept](docs/product/wallet-intelligence-center.md)

## License

Released under the MIT License. See [LICENSE](LICENSE).
