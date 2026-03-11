# SSS-1: Minimal Stablecoin Standard

> **Status: Production-Ready** — Deployed on Devnet. All instructions tested.

## Overview

SSS-1 is the foundational stablecoin preset — the minimum viable standard that every Solana stablecoin needs. It provides a clean, secure administrative layer over Token-2022's native capabilities without adding compliance overhead.

**Analogy:** SSS-1 is to Solana stablecoins what ERC-20 is to Ethereum. It covers the core: issuance, burning, emergency controls, and role management.

## When to Use SSS-1

| Use Case | Recommended |
|---|---|
| Internal treasury tokens | ✅ SSS-1 |
| DAO governance tokens | ✅ SSS-1 |
| Ecosystem settlement tokens | ✅ SSS-1 |
| Regulated (USDC-class) stablecoins | ❌ Use SSS-2 |
| Cross-border payment rails | ❌ Use SSS-2 |

**Key benefit:** No TransferHook overhead — transfers run at native Token-2022 speed.

## Architecture

SSS-1 stores a `StablecoinState` PDA at `[b"state", mint]` that authorizes all operations:

```
┌───────────────────────────────┐
│     StablecoinState PDA       │
│  seeds: ["state", mint]       │
│  ──────────────────────────   │
│  mint:             Pubkey     │
│  master_authority: Pubkey     │
│  minters:          Vec<Pubkey>│
│  burner:           Pubkey     │
│  pauser:           Pubkey     │
│  blacklister:      Pubkey     │
│  is_paused:        bool       │
└───────────────────────────────┘
```

The token itself is a standard Token-2022 mint. The PDA is the gatekeeper — no instruction executes without passing its access checks.

## Role-Based Access Control

| Role | Who Holds It | Can Do |
|---|---|---|
| `master_authority` | Issuer multisig | Everything — transfer roles, update minters |
| `minters` (Vec) | Licensed minting agents | `mint` only |
| `burner` | Treasury/redemption agent | `burn` only |
| `pauser` | Risk/compliance team | `pause`, `unpause` |
| `blacklister` | Compliance officer | N/A in SSS-1 (activates in SSS-2) |

No single key holds all permissions. Role separation is enforced on-chain.

## Instructions

### `initialize`
Creates the StablecoinState PDA and initializes the Token-2022 mint.

```typescript
await defineStablecoin(sdk, authority, mintKeypair, {
  preset: Preset.SSS1,
  decimals: 6,
  masterAuthority: authority.publicKey,
  minters: [minter1.publicKey, minter2.publicKey],
});
```

**Access:** Payer (anyone — security from mint keypair ownership)

---

### `mint`
Mints tokens to a recipient ATA. Checks: not paused, authorized minter.

```typescript
await mintTokens(sdk, minterKeypair, mint, recipientAta, 1_000_000n);
```

**Access:** Any key in `state.minters`  
**Errors:** `UnauthorizedMinter`, `TokenPaused`

---

### `burn`
Burns tokens from an ATA, reducing total supply.

```typescript
await burnTokens(sdk, burnerKeypair, mint, sourceAta, 500_000n);
```

**Access:** `state.burner`  
**Errors:** `UnauthorizedBurner`, `TokenPaused`

---

### `freeze_account` / `thaw_account`
Temporarily prevents or restores transfers from a specific ATA.

```typescript
await freezeAccount(sdk, authority, mint, targetAta);
await thawAccount(sdk, authority, mint, targetAta);
```

**Access:** `state.master_authority`  
**Note:** Uses Token-2022 native freeze — works at the account level, not the token level.

---

### `pause` / `unpause`
Global emergency stop — reverts all mint/burn/seize operations until unpaused.

```typescript
await pauseToken(sdk, authority, mint);   // Emergency stop
await unpauseToken(sdk, authority, mint); // Restore
```

**Access:** `state.pauser`  
**Note:** Transfers are NOT blocked by pause (by design — blocking transfers requires SSS-2 TransferHook).

---

### `transfer_authority`
Updates any role(s). All fields are optional — pass `null` to preserve.

```typescript
await sdk.program.methods
  .transferAuthority(
    newMasterAuthority,   // Option<Pubkey>
    newMinters,           // Option<Vec<Pubkey>>
    newBurner,            // Option<Pubkey>
    newPauser,            // Option<Pubkey>
    newBlacklister,       // Option<Pubkey>
  )
  .accounts({ mint })
  .signers([currentMaster])
  .rpc();
```

**Access:** `state.master_authority`

---

## CLI Usage

```bash
BASE="npx ts-node packages/cli/src/index.ts"
OPTS="-u https://api.devnet.solana.com -k ~/.config/solana/id.json"
MINT="ArEHowwekqTPiHQKqQRYaZADifp3Pi54H9v5UDDRVqUZ"

# Core operations
$BASE init      $OPTS --preset sss-1
$BASE mint      $OPTS --mint $MINT --target <ATA> --amount 1000000
$BASE burn      $OPTS --mint $MINT --target <ATA> --amount 500000
$BASE freeze    $OPTS --mint $MINT --target <ATA>
$BASE thaw      $OPTS --mint $MINT --target <ATA>
$BASE pause     $OPTS --mint $MINT
$BASE unpause   $OPTS --mint $MINT

# Monitoring
$BASE status    $OPTS --mint $MINT
$BASE supply    $OPTS --mint $MINT
$BASE holders   $OPTS --mint $MINT --min-balance 0

# Minter management
$BASE minters list    $OPTS --mint $MINT
$BASE minters add     $OPTS --mint $MINT --minter <NEW_MINTER_PUBKEY>
$BASE minters remove  $OPTS --mint $MINT --minter <MINTER_TO_REMOVE>
```

---

## Devnet Verification

- **sss_token Program:** [`F7igqZa75yYPnXBBKUK3hDwEmtfwUWogEcWMsh5v6FyR`](https://explorer.solana.com/address/F7igqZa75yYPnXBBKUK3hDwEmtfwUWogEcWMsh5v6FyR?cluster=devnet)
- **Demo Mint:** [`ArEHowwekqTPiHQKqQRYaZADifp3Pi54H9v5UDDRVqUZ`](https://explorer.solana.com/address/ArEHowwekqTPiHQKqQRYaZADifp3Pi54H9v5UDDRVqUZ?cluster=devnet)

## Upgrading to SSS-2

To add compliance capabilities to an existing SSS-1 token, you must re-initialize with SSS-2 extensions — Token-2022 extensions cannot be added post-initialization. Plan your extension set at mint creation.

See [SSS-2.md](./SSS-2.md) for the full compliance spec.
