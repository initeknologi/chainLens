# API

Base path: `/api/v1`. The previous `/v1` prefix is rewritten to `/api/v1`.

OpenAPI: `GET /api/v1/openapi.json`.

Wallet analysis does not store an address unless `save` is true and the request carries a profile bearer token.

Error body: `{ "code", "message", "error" }`. Codes include `INVALID_WALLET_ADDRESS`, `UNSUPPORTED_NETWORK`, `RPC_UNAVAILABLE`, `RATE_LIMIT_EXCEEDED`, `TRANSACTION_NOT_FOUND`, `CONTRACT_DATA_UNAVAILABLE`, and `ANALYSIS_INCOMPLETE`.

## POST /api/v1/wallets/analyze

```json
{ "address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", "chainIds": [1, 8453], "save": false }
```

`chainIds` defaults to Ethereum and Base. BNB Smart Chain (`56`) and Polygon (`137`) are optional.

## GET /api/v1/transactions/:chainId/:hash

Optional query `address` sets transfer direction relative to that wallet. `/decode` and `/explain` are separate resources on the same identity.

`risk.signals[].severity` is `informational`, `warning`, or `critical`. `risk.overall` remains `review_recommended`, `incomplete`, or `no_issue_observed`.

## POST /api/v1/explainer/explain and POST /api/v1/explainer/ask

Explanations are deterministic unless `OPENAI_API_KEY` is set and the model answer does not introduce a hash that was not in the evidence. If the model is unavailable, the deterministic explanation is returned.
