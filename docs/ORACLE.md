# Oracle Integration Module

> Connect SSS-1/SSS-2 stablecoins to real-world price feeds for non-USD pegs.

## Overview

The Oracle Integration Module enables stablecoin issuers to use **Switchboard** price feeds to implement non-USD-pegged stablecoins — BRL, EUR, CPI-indexed tokens, and commodity-backed assets.

The oracle is a **separate module** — the token itself remains pure SSS-1 or SSS-2. The oracle layer handles mint/redeem pricing only.

```
               ┌───────────────────────────────┐
               │    Switchboard Oracle Feed     │
               │  e.g. BRL/USD: 0.18           │
               └───────────────┬───────────────┘
                               │
               ┌───────────────▼───────────────┐
               │       Oracle Module            │
               │  calculateMintAmount()         │
               │  calculateRedeemAmount()       │
               └───────────────┬───────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                       ▼
 ┌─────────────┐       ┌─────────────┐         ┌─────────────┐
 │  SSS-1 Mint │       │  SSS-2 Mint │         │  SSS-3 Mint │
 │  (Simple)   │       │  (Compliant)│         │  (Private)  │
 └─────────────┘       └─────────────┘         └─────────────┘
```

## Supported Price Feeds (Switchboard Devnet)

| Feed | Address | Use Case |
|------|---------|----------|
| BRL/USD | `GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtltW7` | Brazilian Real stablecoin |
| EUR/USD | `FNNvb1AFDnDVPkocEri8mWbJ1952HQZtFLuwPiUjSJQ` | Euro stablecoin |
| SOL/USD | `GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtltW7` | SOL-collateralized stable |

## Usage

### Installation
```bash
yarn add @switchboard-xyz/on-demand
```

### Basic Usage — Mint with Exchange Rate
```typescript
import { getPegPrice, mintWithOraclePeg } from "@solana-stablecoin-standard/sdk";

// Get current BRL/USD rate from Switchboard
const brlUsdRate = await getPegPrice(connection, BRL_USD_FEED);
console.log(`1 USDC = ${1 / brlUsdRate} BRL`);

// User pays 100 USDC, receives equivalent BRL tokens
const brlAmount = await mintWithOraclePeg(
  sdk,
  authority,
  brlMint,
  recipientAta,
  100_000_000, // 100 USDC (6 decimals)
  BRL_USD_FEED  // Switchboard feed address
);
console.log(`Minted ${brlAmount} BRL tokens`);
```

### Full Workflow
```typescript
import { 
  getPegPrice, 
  calculateMintAmount, 
  calculateRedeemAmount,
  mintWithOraclePeg,
  SwitchboardFeeds
} from "@solana-stablecoin-standard/sdk";

// 1. Get current exchange rate
const rate = await getPegPrice(connection, SwitchboardFeeds.BRL_USD_DEVNET);
// rate = 0.175 (1 BRL = 0.175 USD)

// 2. Calculate: how many BRL tokens does 50 USD buy?
const brlTokens = calculateMintAmount(50_000_000, rate, 6); // 285,714,285

// 3. Mint at oracle rate
const sig = await mintWithOraclePeg(sdk, authority, mint, ata, 50_000_000, SwitchboardFeeds.BRL_USD_DEVNET);

// 4. On redemption: calculate USD value of 1000 BRL
const usdValue = calculateRedeemAmount(1_000_000_000, rate, 6); // ~175,000,000 (175 USDC)
```

## Architecture: Why Separate?

The oracle module is intentionally separated from the token program to maintain:

1. **Upgradeability** — Oracle feeds and pricing logic can change without modifying the token
2. **Composability** — Any SSS-1/2/3 token can use any oracle feed
3. **Security** — The token program has no oracle dependencies — no oracle attack surface
4. **Flexibility** — Issuers can switch between oracle providers (Switchboard → Pyth → custom)

## Oracle Safety Features

The module includes built-in safety checks:
- **Staleness check** — Rejects feeds older than 60 seconds
- **Confidence interval** — Rejects prices with >1% uncertainty
- **Deviation guard** — Rejects prices that deviate >5% from TWAP
- **Circuit breaker** — Halts minting if price moves >10% in a single block

## CPI-Indexed Stablecoin Example

```typescript
// A stablecoin pegged to Brazilian inflation index (IPCA)
const ipcaFeed = "SWITCHBOARD_IPCA_BRL_FEED_ADDRESS";

// Mint adjusts its target price monthly based on IPCA
const currentRate = await getPegPrice(connection, ipcaFeed);
const adjustedAmount = calculateMintAmount(depositAmount, currentRate, 6);
await mintTokens(sdk, minter, mint, ata, adjustedAmount);
```

## Running the Demo

```bash
npx ts-node scripts/oracle_demo.ts
```

This will:
1. Connect to Devnet
2. Fetch the live BRL/USD price from Switchboard
3. Print the current exchange rate
4. Show you how many BRL tokens you'd receive for 100 USDC

## References

- [Switchboard On-Demand](https://docs.switchboard.xyz/product/solana/on-demand)
- [Pyth Network](https://pyth.network/developers/consumers/solana)
- [Solana Pyth Client](https://github.com/pyth-network/pyth-client-rs)
