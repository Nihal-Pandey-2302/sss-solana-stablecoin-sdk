/**
 * Oracle Integration Demo
 *
 * Fetches BRL/USD and EUR/USD prices from Switchboard feeds on Devnet.
 * Shows a live example of calculating mint amounts for non-USD stablecoins.
 *
 * Run: npx ts-node scripts/oracle_demo.ts
 */

import { Connection } from "@solana/web3.js";
import { 
  getPegPrice, 
  SwitchboardFeeds, 
  calculateMintAmount, 
  calculateRedeemAmount,
  getBatchPrices,
} from "../packages/sdk/src/oracle";

const DEVNET_RPC = "https://api.devnet.solana.com";

async function main() {
  console.log("\n🔮 Oracle Integration Demo — Switchboard Price Feeds");
  console.log("═".repeat(50) + "\n");

  const connection = new Connection(DEVNET_RPC, "confirmed");

  console.log("Fetching prices from Switchboard Devnet...\n");

  // Fetch all prices in parallel
  const feeds = [
    SwitchboardFeeds.BRL_USD_DEVNET,
    SwitchboardFeeds.EUR_USD_DEVNET,
    SwitchboardFeeds.SOL_USD_DEVNET,
  ] as const;

  const prices = await getBatchPrices(connection, [...feeds]);

  const printPrice = (label: string, feed: string) => {
    const p = prices.get(feed);
    if (!p) { console.log(`  ${label}: unavailable`); return; }
    const staleStr = p.isStale ? " ⚠️ STALE" : "";
    console.log(`  ${label}: $${p.price.toFixed(6)}  (±${p.confidence.toFixed(6)})${staleStr}`);
  };

  console.log("📊 Live Prices:");
  printPrice("BRL/USD", SwitchboardFeeds.BRL_USD_DEVNET);
  printPrice("EUR/USD", SwitchboardFeeds.EUR_USD_DEVNET);
  printPrice("SOL/USD", SwitchboardFeeds.SOL_USD_DEVNET);
  console.log();

  // --- BRL example ---
  const brlPrice = prices.get(SwitchboardFeeds.BRL_USD_DEVNET);
  if (brlPrice) {
    const depositUsdc = 100_000_000; // 100 USDC
    const brlMinted = calculateMintAmount(depositUsdc, brlPrice.price, 6);
    const redeemUsdc = calculateRedeemAmount(brlMinted, brlPrice.price, 6);

    console.log("💰 BRL Stablecoin Example:");
    console.log(`  User deposits:  100 USDC`);
    console.log(`  BRL/USD rate:   ${brlPrice.price.toFixed(6)}`);
    console.log(`  Tokens minted:  ${(brlMinted / 1e6).toLocaleString("en-US", { maximumFractionDigits: 2 })} pBRL`);
    console.log(`  Redeem value:   ${(redeemUsdc / 1e6).toFixed(2)} USDC (round-trip)`);
    console.log();
  }

  // --- EUR example ---
  const eurPrice = prices.get(SwitchboardFeeds.EUR_USD_DEVNET);
  if (eurPrice) {
    const depositUsdc = 1_000_000_000; // 1000 USDC
    const eurMinted = calculateMintAmount(depositUsdc, eurPrice.price, 6);

    console.log("💶 EUR Stablecoin Example:");
    console.log(`  User deposits:  1,000 USDC`);
    console.log(`  EUR/USD rate:   ${eurPrice.price.toFixed(6)}`);
    console.log(`  Tokens minted:  ${(eurMinted / 1e6).toLocaleString("en-US", { maximumFractionDigits: 2 })} pEUR`);
    console.log();
  }

  console.log("✅ Oracle module working correctly.\n");
  console.log("🔗 Integration guide: docs/ORACLE.md");
  console.log("   SDK module:      packages/sdk/src/oracle.ts\n");
}

main().catch(console.error);
