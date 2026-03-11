# API Reference

> Mint Service REST API — backend service for coordinating fiat-to-stablecoin lifecycle operations.

**Base URL (local dev):** `http://localhost:3000`  
**Start:** `docker compose up`

---

## Authentication

All write endpoints require a Bearer token set via `AUTH_TOKEN` environment variable:

```bash
curl -H "Authorization: Bearer $AUTH_TOKEN" ...
```

Read-only endpoints (`GET /supply`, `GET /health`) are unauthenticated.

---

## Endpoints

### `GET /health`
Service health check.

```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "status": "ok",
  "chain": "devnet",
  "rpc": "https://api.devnet.solana.com",
  "uptime": 3600
}
```

---

### `GET /supply`
Returns the current token supply for a mint.

```bash
curl "http://localhost:3000/supply?mint=ArEHowwekqTPiHQKqQRYaZADifp3Pi54H9v5UDDRVqUZ"
```

**Query params:**
| Param | Required | Description |
|---|---|---|
| `mint` | ✅ | Token mint address |

**Response:**
```json
{
  "mint": "ArEHowwekqTPiHQKqQRYaZADifp3Pi54H9v5UDDRVqUZ",
  "supply": "1000000",
  "supplyHuman": "1.000000",
  "decimals": 6,
  "isPaused": false
}
```

---

### `POST /mint`
Mints tokens to a recipient after optional compliance screening.

```bash
curl -X POST http://localhost:3000/mint \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "mint": "ArEHowwekqTPiHQKqQRYaZADifp3Pi54H9v5UDDRVqUZ",
    "recipient": "rgkteMWMQyxQtpkQyK6jkbeYbHsnAsiCzKqwygtm6SG",
    "amount": 1000000,
    "reference": "TXN-2026-001"
  }'
```

**Request body:**
| Field | Type | Required | Description |
|---|---|---|---|
| `mint` | string | ✅ | Mint address |
| `recipient` | string | ✅ | Recipient ATA address |
| `amount` | number | ✅ | Amount in smallest units |
| `reference` | string | ❌ | External reference ID for audit |

**Response:**
```json
{
  "success": true,
  "signature": "5MPnYoSo8KzujXiPLoh1b17PQHG47CdZtp5f2HpFw...",
  "mint": "ArEHowwek...",
  "recipient": "rgkteMWM...",
  "amount": 1000000,
  "explorerUrl": "https://explorer.solana.com/tx/5MPnYoSo...?cluster=devnet"
}
```

**Errors:**
| Status | Code | Description |
|---|---|---|
| 400 | `INVALID_ADDRESS` | Invalid mint or recipient address |
| 400 | `AMOUNT_TOO_LOW` | Amount below minimum (1 micro-token) |
| 403 | `SANCTIONS_MATCH` | Recipient failed compliance screening |
| 403 | `UNAUTHORIZED` | Invalid or missing auth token |
| 500 | `MINT_FAILED` | On-chain transaction failed |

---

### `POST /burn`
Burns tokens from a source account (redemption flow).

```bash
curl -X POST http://localhost:3000/burn \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "mint": "ArEHowwekqTPiHQKqQRYaZADifp3Pi54H9v5UDDRVqUZ",
    "source": "<SOURCE_ATA>",
    "amount": 500000
  }'
```

**Response:**
```json
{
  "success": true,
  "signature": "...",
  "amountBurned": 500000,
  "newSupply": "500000"
}
```

---

### `GET /status`
Returns full token state: supply, roles, minters, pause status.

```bash
curl "http://localhost:3000/status?mint=ArEHowwekqTPiHQKqQRYaZADifp3Pi54H9v5UDDRVqUZ"
```

**Response:**
```json
{
  "mint": "ArEHowwek...",
  "supply": "1000000",
  "decimals": 6,
  "isPaused": false,
  "masterAuthority": "AQmUwjUZ...",
  "minters": ["AQmUwjUZ..."],
  "burner": "AQmUwjUZ...",
  "pauser": "AQmUwjUZ...",
  "blacklister": "AQmUwjUZ..."
}
```

---

### `GET /holders`
Returns all token accounts for a mint, optionally filtered by minimum balance.

```bash
curl "http://localhost:3000/holders?mint=ArEHowwek...&minBalance=1000000"
```

**Query params:**
| Param | Required | Default | Description |
|---|---|---|---|
| `mint` | ✅ | — | Mint address |
| `minBalance` | ❌ | `0` | Minimum balance filter (smallest units) |
| `limit` | ❌ | `100` | Max results |

**Response:**
```json
{
  "mint": "ArEHowwek...",
  "count": 3,
  "holders": [
    { "address": "rgkteMWM...", "owner": "AQmUwjUZ...", "balance": "1000000", "balanceHuman": "1.000000" }
  ]
}
```

---

### `GET /audit`
Returns the audit event log from Postgres.

```bash
curl "http://localhost:3000/audit?mint=ArEHowwek...&limit=20&type=mint"
```

**Query params:**
| Param | Required | Description |
|---|---|---|
| `mint` | ✅ | Mint address |
| `type` | ❌ | Filter: `mint`, `burn`, `blacklist_add`, `blacklist_remove`, `seize` |
| `limit` | ❌ | Max events (default 50) |
| `start` | ❌ | ISO date filter start |
| `end` | ❌ | ISO date filter end |

**Response:**
```json
{
  "events": [
    {
      "id": 1,
      "event_type": "mint",
      "mint": "ArEHowwek...",
      "actor": "AQmUwjUZ...",
      "target": "rgkteMWM...",
      "amount": 1000000,
      "tx_signature": "5MPnYoSo...",
      "block": 447793000,
      "created_at": "2026-03-11T18:29:55Z"
    }
  ],
  "total": 7
}
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `RPC_URL` | `https://api.devnet.solana.com` | Solana RPC endpoint |
| `AUTHORITY_KEYPAIR_PATH` | `~/.config/solana/id.json` | Path to authority keypair |
| `AUTH_TOKEN` | — | Bearer token for write endpoints |
| `DATABASE_URL` | `postgresql://postgres:password@localhost:5432/stablecoin` | Postgres connection |
| `PORT` | `3000` | HTTP server port |

---

## Error Format

All errors follow the same JSON structure:

```json
{
  "error": "SANCTIONS_MATCH",
  "message": "Recipient failed OFAC sanctions screening",
  "details": { "matchedList": "SDN", "confidence": 0.97 }
}
```

---

## Indexer Webhook Format

The Helius indexer calls `POST /webhook` with transaction events:

```json
{
  "type": "TRANSFER",
  "signature": "...",
  "slot": 447793000,
  "accounts": ["source_ata", "dest_ata"],
  "programId": "F7igqZa..."
}
```

The indexer parses instruction data and writes structured events to Postgres.
