# Operator Runbook

> Step-by-step commands for every production operation. Keep this open in a terminal while operating the Stablecoin Standard.

## Prerequisites

```bash
# Environment setup
export MINT=ArEHowwekqTPiHQKqQRYaZADifp3Pi54H9v5UDDRVqUZ
export RPC=https://api.devnet.solana.com
export KEY=~/.config/solana/id.json
export CLI="npx ts-node packages/cli/src/index.ts"

# Verify setup
$CLI status --mint $MINT -u $RPC -k $KEY
```

---

## Token Status & Monitoring

### Check token state
```bash
$CLI status --mint $MINT -u $RPC -k $KEY
```
Outputs: supply, paused/active status, master authority, minters list.

### Check total supply
```bash
$CLI supply --mint $MINT -u $RPC -k $KEY
```

### List all token holders
```bash
$CLI holders --mint $MINT -u $RPC -k $KEY
$CLI holders --mint $MINT -u $RPC -k $KEY --min-balance 1000000  # Filter: > 1 token
```

---

## Minting Operations

### Mint tokens to a specific ATA
```bash
$CLI mint --mint $MINT --target <ATA_ADDRESS> --amount <AMOUNT> -u $RPC -k $KEY
```
`AMOUNT` is in smallest units. For 6-decimal token: `1000000` = 1.0 token.

### Create ATA if it doesn't exist (auto-creation)
The TUI dashboard automatically creates the ATA. For CLI, pre-create it:
```bash
spl-token create-account $MINT --owner <WALLET_ADDRESS> --url devnet --fee-payer $KEY
# Then mint
$CLI mint --mint $MINT --target <NEW_ATA> --amount 1000000 -u $RPC -k $KEY
```

---

## Minter Management

### List all authorized minters
```bash
$CLI minters list --mint $MINT -u $RPC -k $KEY
```

### Add a new minter
```bash
$CLI minters add --mint $MINT --minter <NEW_MINTER_PUBKEY> -u $RPC -k $KEY
```
> ⚠️ Only `master_authority` can add minters.

### Remove a minter
```bash
$CLI minters remove --mint $MINT --minter <MINTER_PUBKEY> -u $RPC -k $KEY
```

### Set per-minter quota (on-chain enforcement)
Use the Anchor CLI directly (or the web dashboard command generator):
```bash
# First time (creates quota PDA):
anchor run set-quota -- --mint $MINT --minter <MINTER_ADDR> --max 10000000000 --period 86400
```
`period` is in seconds. `86400` = 24 hours. `0` = no period reset.

---

## Freeze / Thaw Operations

### Freeze an account
```bash
$CLI freeze --mint $MINT --target <ATA_ADDRESS> -u $RPC -k $KEY
```
Use for: temporary restrictions, suspicious activity holds, pending review.

### Thaw a frozen account
```bash
$CLI thaw --mint $MINT --target <ATA_ADDRESS> -u $RPC -k $KEY
```

---

## Emergency: Pause / Unpause

### Pause all token operations
```bash
$CLI pause --mint $MINT -u $RPC -k $KEY
```
> ⚠️ This blocks mint, burn, and seize. **Transfers are NOT blocked** by pause (use blacklist for transfer blocking).

### Restore operations
```bash
$CLI unpause --mint $MINT -u $RPC -k $KEY
```

---

## SSS-2 Compliance Operations

### Full Enforcement Lifecycle

**Step 1 — Identify and blacklist:**
```bash
$CLI blacklist:add --mint $MINT --target <SUSPICIOUS_ATA> -u $RPC -k $KEY
```
Creates `Blacklist PDA`. All transfers to/from this ATA now fail immediately.

**Step 2 — Confirm block is working:**
Try a transfer from the blocked account — it should return `SenderBlacklisted`.

**Step 3 — Seize tokens:**
```bash
$CLI seize \
  --mint $MINT \
  --target <SUSPICIOUS_ATA> \
  --amount <AMOUNT_TO_SEIZE> \
  -u $RPC -k $KEY
```
Uses Permanent Delegate — no signature from account owner required.

**Step 4 — Clear (if resolved):**
```bash
$CLI blacklist:remove --mint $MINT --target <SUSPICIOUS_ATA> -u $RPC -k $KEY
```
Closes the Blacklist PDA. Transfers resume normally.

---

## Burn Operations (Redemption)

```bash
# Burn from a specific ATA
$CLI burn \
  --mint $MINT \
  --target <SOURCE_ATA> \
  --amount <AMOUNT> \
  -u $RPC -k $KEY
```
Reduces total supply. Only `state.burner` can call this.

---

## Role Management

### Update any role (master authority only)

Use the SDK directly or the web dashboard. Full TypeScript example:

```typescript
import { SolanaStablecoin } from "@solana-stablecoin-standard/sdk";
import { PublicKey } from "@solana/web3.js";

await sdk.program.methods
  .transferAuthority(
    null,           // new master (null = no change)
    null,           // new minters (null = no change)
    newBurnerPubkey,  // new burner
    null,           // new pauser
    newBlacklisterPubkey // new blacklister
  )
  .accounts({ mint })
  .signers([currentMasterKeypair])
  .rpc();
```

---

## Backend Services

### Start all services
```bash
docker compose up -d
```

### Check health
```bash
curl http://localhost:3000/health
# { "status": "ok", "chain": "devnet" }
```

### Mint via REST API
```bash
curl -X POST http://localhost:3000/mint \
  -H "Content-Type: application/json" \
  -d '{"mint": "ArEHoww...", "recipient": "<ATA>", "amount": 1000000}'
```

### Check supply via REST API
```bash
curl http://localhost:3000/supply?mint=ArEHowwekqTPiHQKqQRYaZADifp3Pi54H9v5UDDRVqUZ
```

---

## Interactive TUI Dashboard

The dashboard wraps all operations in a guided menu:

```bash
$CLI dashboard -u $RPC -k $KEY
```

Menu options:
- **Mint Tokens** — prompts for mint, recipient wallet, amount; auto-creates ATA
- **Add to Blacklist** — prompts for mint, target ATA
- **Seize Tokens** — prompts for mint, target ATA, amount

---

## Audit Log

All on-chain events are indexed by the Helius indexer to Postgres. Query via:

```bash
# Raw Postgres (local dev)
psql postgresql://postgres:password@localhost:5432/stablecoin \
  -c "SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 20;"

# Via REST API
curl "http://localhost:3000/audit?mint=$MINT&limit=20"
```

Event types: `mint`, `burn`, `blacklist_add`, `blacklist_remove`, `seize`, `freeze`, `pause`

---

## Key Addresses (Devnet Reference)

| Name | Address |
|---|---|
| sss_token program | `F7igqZa75yYPnXBBKUK3hDwEmtfwUWogEcWMsh5v6FyR` |
| transfer_hook program | `DyHpthHQhvcuywjyV4nBjpEZbM1PfP71wAn84nkVshUy` |
| Demo mint | `ArEHowwekqTPiHQKqQRYaZADifp3Pi54H9v5UDDRVqUZ` |
| Authority wallet | `AQmUwjUZNJ8y92q9V31EpASY2oRKHobc72XKEQpTtVig` |
