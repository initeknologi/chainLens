-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT NOT NULL DEFAULT 'Public-address analysis does not require an account.',
    "display_name" TEXT NOT NULL DEFAULT 'Local profile',
    "token_hash" TEXT,
    "preferences" JSONB,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_wallets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_events" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "networks" (
    "chain_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "native_symbol" TEXT NOT NULL,
    "explorer_url" TEXT NOT NULL,

    CONSTRAINT "networks_pkey" PRIMARY KEY ("chain_id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "chain_id" INTEGER NOT NULL,
    "ens_name" TEXT,
    "last_indexed_at" TIMESTAMP(3),

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokens" (
    "id" TEXT NOT NULL,
    "chain_id" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL,

    CONSTRAINT "tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_balances" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "token_id" TEXT NOT NULL,
    "raw_balance" TEXT NOT NULL,
    "price_usd" TEXT,
    "price_source" TEXT,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "chain_id" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "block_number" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "from_address" TEXT NOT NULL,
    "to_address" TEXT,
    "status" TEXT NOT NULL,
    "tx_type" TEXT NOT NULL,
    "method" TEXT,
    "summary" TEXT NOT NULL,
    "value_raw" TEXT NOT NULL,
    "value_display" TEXT NOT NULL,
    "native_symbol" TEXT NOT NULL,
    "fee_raw" TEXT,
    "fee_display" TEXT,
    "fee_usd" TEXT,
    "gas_used" TEXT,
    "gas_price" TEXT,
    "direction" TEXT NOT NULL,
    "counterparty" TEXT,
    "contract_name" TEXT,
    "contract_verified" BOOLEAN,
    "decoded" JSONB,
    "input_data" TEXT NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_events" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "log_index" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "event_name" TEXT,
    "decoded" JSONB,

    CONSTRAINT "transaction_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "chain_id" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "name" TEXT,
    "is_contract" BOOLEAN,
    "verified" BOOLEAN,
    "proxy_type" TEXT,
    "creator" TEXT,
    "creation_tx_hash" TEXT,
    "owner_address" TEXT,
    "abi" JSONB,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_risks" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "signal_id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'informational',
    "title" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "limitations" JSONB NOT NULL,

    CONSTRAINT "contract_risks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_approvals" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "chain_id" INTEGER NOT NULL,
    "token_address" TEXT NOT NULL,
    "token_symbol" TEXT,
    "spender" TEXT NOT NULL,
    "allowance_raw" TEXT NOT NULL,
    "allowance_display" TEXT,
    "unlimited" BOOLEAN NOT NULL,
    "source" TEXT NOT NULL,
    "tx_hash" TEXT,
    "as_of" TEXT NOT NULL DEFAULT 'historical',
    "observed_at_block" TEXT,
    "risk" JSONB NOT NULL,

    CONSTRAINT "wallet_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_snapshots" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_usd" TEXT,
    "allocation" JSONB NOT NULL,
    "coverage" JSONB NOT NULL,

    CONSTRAINT "portfolio_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_reports" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "question" TEXT,
    "answer" TEXT,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analysis_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "index_jobs" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "run_after" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "index_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_token_hash_key" ON "users"("token_hash");

-- CreateIndex
CREATE INDEX "saved_wallets_address_idx" ON "saved_wallets"("address");

-- CreateIndex
CREATE UNIQUE INDEX "saved_wallets_user_id_address_key" ON "saved_wallets"("user_id", "address");

-- CreateIndex
CREATE INDEX "product_events_name_created_at_idx" ON "product_events"("name", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "networks_slug_key" ON "networks"("slug");

-- CreateIndex
CREATE INDEX "wallets_address_idx" ON "wallets"("address");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_address_chain_id_key" ON "wallets"("address", "chain_id");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_chain_id_address_key" ON "tokens"("chain_id", "address");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_balances_wallet_id_token_id_key" ON "wallet_balances"("wallet_id", "token_id");

-- CreateIndex
CREATE INDEX "transactions_wallet_address_timestamp_idx" ON "transactions"("wallet_address", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_chain_id_hash_wallet_address_key" ON "transactions"("chain_id", "hash", "wallet_address");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_events_transaction_id_log_index_key" ON "transaction_events"("transaction_id", "log_index");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_chain_id_address_key" ON "contracts"("chain_id", "address");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_approvals_wallet_id_token_address_spender_key" ON "wallet_approvals"("wallet_id", "token_address", "spender");

-- CreateIndex
CREATE INDEX "portfolio_snapshots_address_captured_at_idx" ON "portfolio_snapshots"("address", "captured_at");

-- CreateIndex
CREATE INDEX "analysis_reports_kind_subject_id_created_at_idx" ON "analysis_reports"("kind", "subject_id", "created_at");

-- CreateIndex
CREATE INDEX "index_jobs_status_run_after_idx" ON "index_jobs"("status", "run_after");

-- AddForeignKey
ALTER TABLE "saved_wallets" ADD CONSTRAINT "saved_wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_chain_id_fkey" FOREIGN KEY ("chain_id") REFERENCES "networks"("chain_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_chain_id_fkey" FOREIGN KEY ("chain_id") REFERENCES "networks"("chain_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_balances" ADD CONSTRAINT "wallet_balances_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_balances" ADD CONSTRAINT "wallet_balances_token_id_fkey" FOREIGN KEY ("token_id") REFERENCES "tokens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_events" ADD CONSTRAINT "transaction_events_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_risks" ADD CONSTRAINT "contract_risks_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_approvals" ADD CONSTRAINT "wallet_approvals_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
