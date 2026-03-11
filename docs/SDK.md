# SDK Reference

> `@solana-stablecoin-standard/sdk` — TypeScript SDK for building on the Solana Stablecoin Standard.

## Installation

```bash
# From the monorepo
yarn workspace @solana-stablecoin-standard/cli add @solana-stablecoin-standard/sdk

# Standalone (after publishing)
npm install @solana-stablecoin-standard/sdk
```

## Quick Start

```typescript
import { Connection, Keypair } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import {
  SolanaStablecoin, Preset,
  defineStablecoin, mintTokens, burnTokens,
  freezeAccount, thawAccount, pauseToken, unpauseToken,
  addToBlacklist, removeFromBlacklist, seizeTokens,
} from "@solana-stablecoin-standard/sdk";

const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const wallet = new anchor.Wallet(Keypair.fromSecretKey(/* ... */));
const sdk = new SolanaStablecoin(connection, wallet);
```

---

## `SolanaStablecoin` Class

### Constructor

```typescript
new SolanaStablecoin(connection: Connection, wallet: anchor.Wallet)
```

Initializes the Anchor program clients for both `sss_token` and `transfer_hook`.

### Methods

#### `getStatePda(mint: PublicKey): PublicKey`
Derives the `StablecoinState` PDA deterministically. No RPC call needed.

```typescript
const statePda = sdk.getStatePda(mint);
// ["state", mint.toBytes()] @ sss_token program
```

#### `getState(mint: PublicKey): Promise<StablecoinState>`
Fetches and decodes the on-chain state account.

```typescript
const state = await sdk.getState(mint);
console.log(state.masterAuthority.toBase58());
console.log(state.minters.length);
console.log(state.isPaused);
```

#### `getBlacklistPda(mint: PublicKey, targetAta: PublicKey): PublicKey`
Derives the `Blacklist` PDA for a specific token account.

```typescript
const blacklistPda = sdk.getBlacklistPda(mint, ata);
// ["blacklist", mint.toBytes(), ata.toBytes()] @ sss_token program
```

---

## `Preset` Enum

```typescript
enum Preset {
  SSS1 = "SSS1",  // Core: Mint, Burn, Pause, Freeze
  SSS2 = "SSS2",  // SSS-1 + Transfer Hook + Permanent Delegate
}
```

---

## Core Functions

### `defineStablecoin`

Initializes a new Token-2022 mint with the correct extensions and creates the `StablecoinState` PDA.

```typescript
async function defineStablecoin(
  sdk: SolanaStablecoin,
  authority: Keypair,
  mintKeypair: Keypair,
  params: DefineStablecoinParams
): Promise<string> // transaction signature
```

**Parameters:**
```typescript
interface DefineStablecoinParams {
  decimals: number;           // Token decimal places (typically 6)
  preset: Preset;             // SSS1 or SSS2
  masterAuthority: PublicKey; // Master authority pubkey
  minters: PublicKey[];       // Initial authorized minters
  burnerPlaceholder?: PublicKey;
  pauserPlaceholder?: PublicKey;
  blacklisterPlaceholder?: PublicKey;
}
```

**Example:**
```typescript
const mintKeypair = Keypair.generate();

const sig = await defineStablecoin(sdk, authority, mintKeypair, {
  decimals: 6,
  preset: Preset.SSS2,
  masterAuthority: authority.publicKey,
  minters: [minter1.publicKey],
});

console.log(`Mint: ${mintKeypair.publicKey.toBase58()}`);
console.log(`Tx:   ${sig}`);
```

---

### `mintTokens`

Mints tokens to a recipient's ATA.

```typescript
async function mintTokens(
  sdk: SolanaStablecoin,
  minter: Keypair,
  mint: PublicKey,
  recipientAta: PublicKey,
  amount: number
): Promise<string>
```

```typescript
const sig = await mintTokens(sdk, minterKeypair, mint, recipientAta, 1_000_000);
// Mints 1.000000 tokens (with 6 decimals)
```

**Errors:** `UnauthorizedMinter`, `TokenPaused`, `AccountNotInitialized`

---

### `burnTokens`

Burns tokens from a source ATA.

```typescript
async function burnTokens(
  sdk: SolanaStablecoin,
  burner: Keypair,
  mint: PublicKey,
  sourceAta: PublicKey,
  amount: number
): Promise<string>
```

---

### `freezeAccount` / `thawAccount`

Freeze or thaw a token account.

```typescript
async function freezeAccount(sdk, authority, mint, targetAta): Promise<string>
async function thawAccount(sdk, authority, mint, targetAta): Promise<string>
```

---

### `pauseToken` / `unpauseToken`

Global emergency stop/resume.

```typescript
async function pauseToken(sdk, authority, mint): Promise<string>
async function unpauseToken(sdk, authority, mint): Promise<string>
```

---

## SSS-2 Compliance Functions

### `addToBlacklist`

Creates a Blacklist PDA for a target ATA. Any transfer to/from this account will be rejected by the Transfer Hook.

```typescript
async function addToBlacklist(
  sdk: SolanaStablecoin,
  blacklister: Keypair,
  mint: PublicKey,
  targetAta: PublicKey
): Promise<string>
```

```typescript
const sig = await addToBlacklist(sdk, blacklisterKeypair, mint, suspiciousAta);
// Creates PDA: ["blacklist", mint, suspiciousAta]
```

---

### `removeFromBlacklist`

Closes the Blacklist PDA, restoring normal transfer capability.

```typescript
async function removeFromBlacklist(
  sdk: SolanaStablecoin,
  blacklister: Keypair,
  mint: PublicKey,
  targetAta: PublicKey
): Promise<string>
```

---

### `seizeTokens`

Transfers tokens from a blacklisted account using the Permanent Delegate. No owner signature required.

```typescript
async function seizeTokens(
  sdk: SolanaStablecoin,
  authority: Keypair,
  mint: PublicKey,
  targetAta: PublicKey,
  amount: number
): Promise<string>
```

```typescript
// Seize 500,000 micro-tokens from blacklisted account
const sig = await seizeTokens(sdk, authority, mint, blacklistedAta, 500_000);
```

---

## Oracle Module

```typescript
import {
  getPegPrice, calculateMintAmount, calculateRedeemAmount,
  getBatchPrices, assertPriceSafe, SwitchboardFeeds
} from "@solana-stablecoin-standard/sdk";
```

### `getPegPrice(connection, feedAddress): Promise<OraclePrice>`

Fetches the current price from a Switchboard oracle feed.

```typescript
const price = await getPegPrice(connection, SwitchboardFeeds.BRL_USD_DEVNET);
// { price: 0.175, confidence: 0.0001, timestamp: ..., isStale: false }
```

### `calculateMintAmount(fiatAmount, rate, decimals): number`

Converts a USDC deposit into the equivalent foreign-currency token amount.

```typescript
// How many BRL tokens for 100 USDC at 0.175 BRL/USD?
const brlTokens = calculateMintAmount(100_000_000, 0.175, 6);
// → 571_428_571 (571.43 pBRL)
```

### `calculateRedeemAmount(tokenAmount, rate, decimals): number`

Converts a token balance back to USDC equivalent.

```typescript
const usdValue = calculateRedeemAmount(1_000_000_000, 0.175, 6);
// → 175_000_000 (175 USDC)
```

### `assertPriceSafe(price, maxStaleSecs?, maxConfidencePct?)`

Throws if the price is stale or has low confidence. Use before minting at oracle rates.

```typescript
const price = await getPegPrice(connection, feed);
assertPriceSafe(price, 60, 0.01); // max 60s old, max 1% spread
await mintTokens(sdk, minter, mint, ata, calculateMintAmount(deposit, price.price, 6));
```

---

## SSS-3 Module (Proof of Concept)

```typescript
import { initSSS3, SSS3Config } from "@solana-stablecoin-standard/sdk";

const sig = await initSSS3(connection, authority, mintKeypair, {
  decimals: 6,
  autoApproveNewAccounts: false,
  auditorElGamalKey: null, // Production: real ElGamal pubkey
});
```

See [SSS-3.md](./SSS-3.md) for the full spec and [scripts/sss3_poc.ts](../scripts/sss3_poc.ts) for a Devnet demo.

---

## Error Reference

| Error Code | Name | Description |
|---|---|---|
| 6000 | `UnauthorizedMinter` | Signer not in `state.minters` |
| 6001 | `UnauthorizedBurner` | Signer is not `state.burner` |
| 6002 | `UnauthorizedFreezer` | Signer is not `state.master_authority` |
| 6003 | `UnauthorizedMaster` | Signer is not `state.master_authority` |
| 6004 | `UnauthorizedBlacklister` | Signer is not `state.blacklister` |
| 6005 | `TokenPaused` | All operations halted via `pause` |
| 6006 | `SenderBlacklisted` | Sender ATA is on the blacklist |
| 6007 | `RecipientBlacklisted` | Recipient ATA is on the blacklist |
| 6008 | `MinterQuotaExceeded` | Minter has exceeded period quota |

---

## TypeScript Types

```typescript
interface StablecoinState {
  mint: PublicKey;
  masterAuthority: PublicKey;
  minters: PublicKey[];
  burner: PublicKey;
  pauser: PublicKey;
  blacklister: PublicKey;
  isPaused: boolean;
}

interface OraclePrice {
  feed: string;
  price: number;
  timestamp: number;
  confidence: number;
  isStale: boolean;
}

interface SSS3Config {
  decimals: number;
  auditorElGamalKey?: Uint8Array | null;
  autoApproveNewAccounts: boolean;
  transferHookProgram?: string;
}
```
