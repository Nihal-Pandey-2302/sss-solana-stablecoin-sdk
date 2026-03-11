# Architecture Overview

> Solana Stablecoin Standard — technical deep dive into the three-layer model, program design, and security architecture.

## Three-Layer Model

```
┌────────────────────────────────────────────────────────────────────┐
│  LAYER 3 — Standard Presets                                        │
│  Opinionated, documented, ready to fork                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │    SSS-1     │  │    SSS-2     │  │    SSS-3 (PoC)           │ │
│  │   Minimal    │  │  Compliant   │  │   Private (ZK)           │ │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘ │
├────────────────────────────────────────────────────────────────────┤
│  LAYER 2 — Modules                                                 │
│  Composable, independently testable                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │  Compliance  │  │   Oracle     │  │   Privacy                │ │
│  │  (blacklist, │  │ (Switchboard │  │  (confidential           │ │
│  │   seize)     │  │  price feeds)│  │   transfers)             │ │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘ │
├────────────────────────────────────────────────────────────────────┤
│  LAYER 1 — Base SDK                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐           │
│  │   sss_token  │  │ transfer_hook│  │  TypeScript   │           │
│  │   (Anchor)   │  │  (Anchor)    │  │    SDK + CLI  │           │
│  └──────────────┘  └──────────────┘  └───────────────┘           │
└────────────────────────────────────────────────────────────────────┘
```

## On-Chain Programs

### `sss_token` — Core Administrative Program

**ID (Devnet):** `F7igqZa75yYPnXBBKUK3hDwEmtfwUWogEcWMsh5v6FyR`

The administrative layer. Never holds tokens — only authorizes operations against the Token-2022 mint.

**Instructions** (12 total):

| Instruction | Access | Description |
|---|---|---|
| `initialize` | Payer | Create StablecoinState PDA, configure roles |
| `mint` | Minter | Mint tokens to recipient ATA |
| `burn` | Burner | Burn tokens from source ATA |
| `freeze_account` | Master | Freeze ATA (Token-2022 native) |
| `thaw_account` | Master | Thaw frozen ATA |
| `pause` | Pauser | Global emergency stop |
| `unpause` | Pauser | Resume operations |
| `transfer_authority` | Master | Update any role |
| `add_to_blacklist` | Blacklister | Create Blacklist PDA |
| `remove_from_blacklist` | Blacklister | Close Blacklist PDA |
| `seize` | Master | Confiscate tokens (Permanent Delegate) |
| `init_minter_quota` | Master | Create per-period mint cap |
| `update_minter_quota` | Master | Modify existing quota |

**State Accounts:**

```rust
#[account]
pub struct StablecoinState {
    pub mint: Pubkey,
    pub master_authority: Pubkey,
    pub minters: Vec<Pubkey>,      // Multi-minter support
    pub burner: Pubkey,
    pub pauser: Pubkey,
    pub blacklister: Pubkey,
    pub is_paused: bool,
}

#[account]
pub struct Blacklist {
    pub is_blacklisted: bool,      // PDA existence = blacklisted
}

#[account]
pub struct MinterQuota {
    pub mint: Pubkey,
    pub minter: Pubkey,
    pub max_quota: u64,            // 0 = unlimited
    pub minted_this_period: u64,
    pub period_start: i64,
    pub period_duration: i64,      // 0 = no reset
}
```

---

### `transfer_hook` — Compliance Enforcement Program

**ID (Devnet):** `DyHpthHQhvcuywjyV4nBjpEZbM1PfP71wAn84nkVshUy`

Called by the Token-2022 runtime on every transfer. Stateless — reads Blacklist PDAs initialized by `sss_token`.

```
Transfer flow:
  Sender → Token-2022 → transfer_hook (CPI) → return Ok/Err → complete or revert
                             ↓
                    1. derive ["blacklist", mint, sender_ata]
                    2. derive ["blacklist", mint, recipient_ata]
                    3. if either account exists && is_blacklisted → error
```

**Why two programs?**
- Separation of concerns: hook is compliance-only, `sss_token` is administrative
- Upgradability: hook can be upgraded independently of the admin program
- Testing: each program has isolated unit tests

---

## PDA Derivations

```
StablecoinState:   PDA["state",     mint]
Blacklist:         PDA["blacklist", mint, target_ata]
MinterQuota:       PDA["quota",     mint, minter]
ExtraAccountMetas: PDA["extra-account-metas", mint]  (hook registration)
```

All PDAs are deterministic — clients derive them locally without any RPC call.

---

## Data Flow Diagrams

### Mint Flow
```
Client → CLI/SDK → sss_token.mint → check minter in state.minters
                                  → check !state.is_paused
                                  → CPI: token_interface::mint_to (state PDA as signer)
                                  → token_2022.mint → recipient ATA +amount
```

### Blacklist + Transfer Block Flow
```
Admin → sss_token.add_to_blacklist
      → create PDA["blacklist", mint, target_ata] { is_blacklisted: true }

User  → send transfer → token_2022 program
      → token_2022 CPI → transfer_hook program
      → hook derives ["blacklist", mint, sender_ata] → account exists? → FAIL
      → transaction reverts: RecipientBlacklisted
```

### Seize Flow
```
Admin → sss_token.seize(target_ata, destination_ata, amount)
      → require!(blacklist_pda.is_blacklisted)
      → CPI: token_interface::transfer_checked
             authority = state PDA (PermanentDelegate)
      → tokens move: target_ata → destination_ata (no owner sig)
```

---

## Token-2022 Extension Architecture

SSS-2 uses two Token-2022 extensions initialized at mint creation:

```
Mint account data layout (SSS-2):
  [Base Mint Data: 82 bytes]
  [TransferHook:   hook_program_id = DyHpthHQ…]
  [PermanentDelegate: delegate = sss_token state PDA]
```

**Important:** Extensions are **immutable post-initialization**. Choose your preset carefully.

---

## Security Model

### Threat Model

| Threat | Mitigation |
|---|---|
| Rogue minter mints unlimited tokens | Per-minter quota PDAs limit mint volumes per period |
| Owner transfers out before seizure | Transfer hook blocks any transfer from blacklisted account |
| Transfer hook bypassed | Hook called by Token-2022 runtime (CPI) — cannot be skipped |
| Admin key compromise | Role separation — master cannot mint; minter cannot seize |
| Reentrancy | Anchor CPI + Solana's native account model prevents reentrancy |
| PDA collision | Unique seeds per instruction prevent collision |

### Privilege Separation

```
master_authority → can: transfer_authority, freeze, seize, set_quota
minters[]        → can: mint only (capped by MinterQuota)
burner           → can: burn only
pauser           → can: pause, unpause
blacklister      → can: add_to_blacklist, remove_from_blacklist
```

No single role can both mint and seize. Compromise of any single key cannot drain funds without additional access.

---

## Backend Services

### Mint Service (REST API)
Port 3000 — coordinates fiat → token lifecycle:

```
POST /mint          → verify fiat receipt → call mintTokens SDK
POST /burn          → verify redemption → call burnTokens SDK
GET  /supply        → read Token-2022 mint info
GET  /holders       → query getProgramAccounts
GET  /health        → liveness check
```

### Indexer
Helius webhook receiver → parses events → writes to Postgres:

```
event: mintTo(recipient, amount)  → audit_log table
event: blacklistAdd(target)       → compliance_events table
event: seize(from, to, amount)    → seizure_log table
```

### Docker Compose

```yaml
services:
  postgres:     port 5432
  mint-service: port 3000 → depends_on postgres
  indexer:      background → depends_on postgres
```

---

## TypeScript SDK Architecture

```
SolanaStablecoin (class)
  ├── program: Program<SssToken>       # Anchor program wrapper
  ├── hookProgram: Program<TransferHook>
  ├── getStatePda(mint): PublicKey     # Derive state PDA
  ├── getBlacklistPda(mint, ata)       # Derive blacklist PDA
  └── getState(mint): StablecoinState # Fetch+decode state account

Exported functions:
  defineStablecoin()   → full SSS-1/2 initialization
  mintTokens()         → mint to ATA
  burnTokens()         → burn from ATA
  freezeAccount()      → freeze ATA
  thawAccount()        → thaw ATA
  pauseToken()         → global pause
  unpauseToken()       → global unpause
  addToBlacklist()     → create blacklist PDA
  removeFromBlacklist() → close blacklist PDA
  seizeTokens()        → permanent delegate transfer
  initSSS3()           → confidential transfer mint (PoC)

Oracle module:
  getPegPrice()              → Switchboard feed price
  calculateMintAmount()      → fiat → token conversion
  calculateRedeemAmount()    → token → fiat conversion
  getBatchPrices()           → multi-feed parallel fetch
  assertPriceSafe()          → staleness + confidence checks
```

---

## Devnet Deployment Proof

| Program | Address | Deployed |
|---|---|---|
| sss_token | F7igqZa75yYPnXBBKUK3hDwEmtfwUWogEcWMsh5v6FyR | ✅ Upgraded Mar 2026 |
| transfer_hook | DyHpthHQhvcuywjyV4nBjpEZbM1PfP71wAn84nkVshUy | ✅ Live |

Latest upgrade transaction (adds quota instruction):
[5qQK8bgsCv6b…](https://explorer.solana.com/tx/5qQK8bgsCv6bnAxEW1QtyjarxsN1KRWVPUZZCcGUyAHUzhtRX9nqLzUGk5ZQGRQt4u4ptCoErdXppozXXkdvZ3dC?cluster=devnet)
