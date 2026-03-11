# SSS-2: Compliant Stablecoin Standard

> **Status: Production-Ready** — Deployed on Devnet. Full blacklist lifecycle verified.

## Overview

SSS-2 is the regulated stablecoin preset — USDC/USDT-class. It extends SSS-1 with mandatory compliance infrastructure: a **Transfer Hook** program that intercepts every token transfer, and a **Permanent Delegate** that enables asset seizure without owner signature.

**Analogy:** If SSS-1 is a bank account, SSS-2 is a bank account that regulators have the legal authority to freeze and confiscate from.

## When to Use SSS-2

| Use Case | Recommended |
|---|---|
| Regulated fiat-backed stablecoins | ✅ SSS-2 |
| Cross-border payment rails | ✅ SSS-2 |
| CBDC-adjacent tokens | ✅ SSS-2 |
| OFAC/sanctions-compliant issuance | ✅ SSS-2 |
| Internal DAO tokens | ❌ SSS-1 is sufficient |

## Architecture: Two-Program Design

SSS-2 requires **two programs** running together:

```
┌──────────────────────────────────────────────────────────┐
│                 Token-2022 Mint (SSS-2)                   │
│  Extensions: TransferHook + PermanentDelegate             │
└───────────────────┬──────────────────────────────────────┘
                    │ every transfer triggers hook CPI
        ┌───────────▼────────────┐   ┌───────────────────────┐
        │   transfer_hook.so     │   │    sss_token.so        │
        │  DyHpthHQ…             │   │  F7igqZa…              │
        │                        │   │                        │
        │  1. Derive blacklist   │   │  Admin instructions:   │
        │     PDA for sender     │◄──│  • add_to_blacklist    │
        │  2. Derive blacklist   │   │  • remove_from_blacklist│
        │     PDA for recipient  │   │  • seize               │
        │  3. Check is_blacklisted│  │  • init_minter_quota   │
        │  4. Return OK or FAIL  │   └───────────────────────┘
        └────────────────────────┘
```

**Key design principle:** The hook is stateless — it reads PDAs initialized by `sss_token`. This means blacklist state is always consistent; there is no race condition between the hook and the admin program.

## Token-2022 Extensions

| Extension | What It Does |
|---|---|
| `TransferHook` | Points every transfer to `transfer_hook` program for validation |
| `PermanentDelegate` | Grants `sss_token` PDA authority to move tokens without owner signature |

Both extensions are set at mint initialization — they cannot be added later.

## PDA Layout

```
StablecoinState: seeds = ["state", mint]
  mint, master_authority, minters[], burner, pauser, blacklister, is_paused

Blacklist:        seeds = ["blacklist", mint, target_ata]
  is_blacklisted: bool

MinterQuota:      seeds = ["quota", mint, minter]
  mint, minter, max_quota, minted_this_period, period_start, period_duration
```

## SSS-2 Instructions (Beyond SSS-1)

### `add_to_blacklist`
Creates a `Blacklist` PDA for a target ATA. Once created, the Transfer Hook will reject any transfer involving that account.

```typescript
import { addToBlacklist } from "@solana-stablecoin-standard/sdk";
await addToBlacklist(sdk, blacklisterKeypair, mint, suspiciousAta);
```

**Access:** `state.blacklister`  
**Effect:** Creates PDA `["blacklist", mint, target_ata]` with `is_blacklisted = true`

---

### `remove_from_blacklist`
Closes the Blacklist PDA, restoring normal transfer capability.

```typescript
import { removeFromBlacklist } from "@solana-stablecoin-standard/sdk";
await removeFromBlacklist(sdk, blacklisterKeypair, mint, targetAta);
```

**Access:** `state.blacklister`

---

### `seize`
Transfers tokens from a target ATA to a destination ATA using the Permanent Delegate — **no owner signature required**. Target must be blacklisted.

```typescript
import { seizeTokens } from "@solana-stablecoin-standard/sdk";
await seizeTokens(sdk, authorityKeypair, mint, blacklistedAta, amount);
```

**Access:** `state.master_authority`  
**Mechanism:** CPI to `token_interface::transfer_checked` with the PDA as signer (Permanent Delegate)  
**Errors:** `RecipientBlacklisted` (target must be on blacklist first)

---

### `init_minter_quota` (New)
Creates a per-period mint cap for a specific minter. Prevents any single minter from exceeding their authorized limit.

```typescript
await sdk.program.methods
  .initMinterQuota(
    new anchor.BN(10_000_000_000), // max 10,000 tokens per period
    new anchor.BN(86400),          // period = 24 hours
  )
  .accounts({ mint, minter: minterPubkey })
  .signers([masterAuthority])
  .rpc();
```

**Access:** `state.master_authority`  
**PDA:** `["quota", mint, minter]`

---

### `update_minter_quota`
Updates an existing quota and resets the minted_this_period counter.

**Access:** `state.master_authority`

---

## Transfer Hook: How It Works

The `transfer_hook` program is invoked automatically by the Token-2022 runtime on every transfer. It:

1. Derives `["blacklist", mint, sender_ata]` — checks `is_blacklisted`
2. Derives `["blacklist", mint, recipient_ata]` — checks `is_blacklisted`
3. If either returns `true` → transaction reverts with `SenderBlacklisted` or `RecipientBlacklisted`
4. If both are clean → returns `Ok(())` and transfer proceeds

**This check has zero bypasses.** The Transfer Hook is called as a CPI by the Token-2022 program itself — it cannot be skipped by the sender.

## Compliance Lifecycle

```
1. SUSPECT → add_to_blacklist(suspect_ata)
               Creates: Blacklist PDA, is_blacklisted = true
               Effect:  All transfers to/from this ATA now fail

2. CONFIRM → seize(suspect_ata, treasury_ata, amount)
               Uses: Permanent Delegate (no owner sig needed)
               Effect:  Tokens moved to treasury

3. CLEAR   → remove_from_blacklist(suspect_ata)
               Closes: Blacklist PDA
               Effect:  Normal transfer capability restored

Verified on Devnet:
• Blacklist add:     https://explorer.solana.com/tx/53hvNeK9…?cluster=devnet
• Transfer blocked:  https://explorer.solana.com/tx/QBZqnmRX…?cluster=devnet
• Seize:             https://explorer.solana.com/tx/5EoEj7jY…?cluster=devnet
• Blacklist remove:  https://explorer.solana.com/tx/5wuCCF51…?cluster=devnet
```

## CLI Usage

```bash
MINT=ArEHowwekqTPiHQKqQRYaZADifp3Pi54H9v5UDDRVqUZ
OPTS="-u https://api.devnet.solana.com -k ~/.config/solana/id.json"
BASE="npx ts-node packages/cli/src/index.ts"

# Blacklist an account
$BASE blacklist:add $OPTS --mint $MINT --target <ATA>

# Seize tokens
$BASE seize $OPTS --mint $MINT --target <ATA> --amount 500000

# Remove from blacklist
$BASE blacklist:remove $OPTS --mint $MINT --target <ATA>
```

## Security Properties

| Property | How Enforced |
|---|---|
| Cannot mint without authorization | `require!(state.minters.contains(&minter.key()))` |
| Cannot seize non-blacklisted account | `require!(blacklist.is_blacklisted)` |
| Cannot bypass transfer hook | Token-2022 CPI — hook is called by the runtime |
| Cannot add hook after initialization | `TransferHook` is an immutable extension |
| No single key controls everything | Distinct roles: blacklister ≠ minter ≠ seizer |

## Devnet Links

| Resource | Link |
|---|---|
| sss_token Program | [F7igqZa7…](https://explorer.solana.com/address/F7igqZa75yYPnXBBKUK3hDwEmtfwUWogEcWMsh5v6FyR?cluster=devnet) |
| transfer_hook Program | [DyHpthHQ…](https://explorer.solana.com/address/DyHpthHQhvcuywjyV4nBjpEZbM1PfP71wAn84nkVshUy?cluster=devnet) |
| Demo Mint | [ArEHowwe…](https://explorer.solana.com/address/ArEHowwekqTPiHQKqQRYaZADifp3Pi54H9v5UDDRVqUZ?cluster=devnet) |
