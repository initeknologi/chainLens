# Security model

ChainLens is read-only.

- The only account identifier accepted from a user is a public address or an ENS name.
- Input that looks like a 64-byte private key or a 12–24 word recovery phrase is rejected before any network call.
- The service does not construct, sign, or broadcast transactions.
- Explorer and RPC hosts are allowlisted. Requests to `http`, localhost, link-local, or private addresses are rejected.
- API keys, when configured, stay on the server.
- Analyze and explain routes are rate limited.
- External JSON is mapped into known fields. The interface does not render HTML from token metadata.
- Risk output cannot be the word “safe.” Missing data remains incomplete.
- An optional language model receives the retrieved JSON and is dropped if its answer contains a transaction hash that was not in that JSON.

Dependency review and secret scanning belong in CI before this repository is published. Do not commit `.env`.
