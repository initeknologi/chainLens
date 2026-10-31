# Wallet Intelligence Center

## Proposal

Add an activity-understanding layer to a self-custody wallet. The user still holds their keys. The product explains public activity and shows why a warning exists, without replacing existing security controls.

## Components

| Component | Job |
| --- | --- |
| Wallet health | Summarize signals that have evidence |
| Activity intelligence | Describe transactions in plain language |
| Contract insights | Show verification, proxy or delegation, and missing data |
| Approval awareness | Show spender, token, and raw allowance |
| Wallet assistant | Answer only from retrieved records |

## Journey

1. Open the wallet.
2. Choose Wallet Intelligence.
3. The app reads the public address. The secret phrase never leaves the device.
4. Checks run on balances, recent calls, and contract metadata.
5. Each warning links to the field that produced it.
6. If a lookup fails, the result stays incomplete.

Example notice:

> Your indexed history includes 3 token approvals that may need attention. Review the spender and the allowance, then decide what you want to do. This notice is not a revoke button and not a safety guarantee.

## Why it fits

The hard part of self-custody is not only key storage. It is understanding a signature, a spender, and a contract before confirming. A dedicated intelligence view uses the same ingredients as the rest of the wallet: security signals, multi-chain data, and a calm interface.

## What ChainLens implements today

The read path for four EVM networks:

- public address in, no signing
- chain id + transaction hash as identity
- integer balances
- deterministic risk signals with evidence and limitations
- optional language model that cannot introduce a new transaction hash

Out of scope in this repo: mobile embedding, push notifications, and a full historical allowance index. Those need wallet-client access and a dedicated indexer.
