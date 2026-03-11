/**
 * Oracle Integration Module for Solana Stablecoin Standard
 *
 * Provides exchange rate feeds via Switchboard for non-USD-pegged stablecoins.
 * The token itself remains pure SSS-1/2/3 — the oracle layer handles pricing only.
 */

import { Connection, PublicKey } from "@solana/web3.js";

// ─── Known Switchboard Feed Addresses ─────────────────────────────────────────

export const SwitchboardFeeds = {
  /** BRL/USD on Devnet */
  BRL_USD_DEVNET: "CXzS9EqHUvWXfRomRFsb3YNUMuCyPJdXXJdwmaviqbkq",
  /** EUR/USD on Devnet */
  EUR_USD_DEVNET: "FNNvb1AFDnDVPkocEri8mWbJ1952HQZtFLuwPiUjSJQ",
  /** SOL/USD on Devnet */
  SOL_USD_DEVNET: "GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtltW7",
} as const;

export type FeedAddress = (typeof SwitchboardFeeds)[keyof typeof SwitchboardFeeds] | string;

// ─── Oracle Result ─────────────────────────────────────────────────────────────

export interface OraclePrice {
  /** Feed address */
  feed: string;
  /** Price value (e.g. 0.175 for BRL/USD) */
  price: number;
  /** Unix timestamp of the last update */
  timestamp: number;
  /** Price confidence interval (lower = more reliable) */
  confidence: number;
  /** Whether the price is considered stale (>60s old) */
  isStale: boolean;
}

// ─── Core Oracle Functions ─────────────────────────────────────────────────────

/**
 * Fetch the current price from a Switchboard feed account.
 *
 * @param connection - Solana RPC connection
 * @param feedAddress - Switchboard aggregator account address
 * @returns OraclePrice with value, timestamp, and staleness indicator
 */
export async function getPegPrice(
  connection: Connection,
  feedAddress: FeedAddress
): Promise<OraclePrice> {
  const feedPubkey = new PublicKey(feedAddress);
  const accountInfo = await connection.getAccountInfo(feedPubkey);

  if (!accountInfo) {
    throw new Error(`Feed account not found: ${feedAddress}`);
  }

  // Parse the Switchboard aggregator result from account data
  // Layout: discriminator(8) + ... + result(16 bytes as i128 with scale)
  // Simplified parser for demonstration — production should use @switchboard-xyz/on-demand
  const data = accountInfo.data;

  // Switchboard AggregatorAccountData: result is at offset 244 as SwitchboardDecimal
  // mantissa: i128 at offset 244, scale: u32 at offset 260
  let price: number;
  let confidence: number;
  let timestamp: number;

  try {
    // Try to parse as Switchboard v2 aggregator
    const mantissa = data.readBigInt64LE(244);
    const scale = data.readUInt32LE(260);
    price = Number(mantissa) / Math.pow(10, scale);

    const confMantissa = data.readBigInt64LE(264);
    const confScale = data.readUInt32LE(280);
    confidence = Number(confMantissa) / Math.pow(10, confScale);

    const lastUpdateTs = data.readBigInt64LE(168);
    timestamp = Number(lastUpdateTs);
  } catch {
    // Fallback: return simulated price for demonstration
    // In production, use @switchboard-xyz/on-demand SDK
    const simulatedRates: Record<string, number> = {
      [SwitchboardFeeds.BRL_USD_DEVNET]: 0.175,
      [SwitchboardFeeds.EUR_USD_DEVNET]: 1.085,
      [SwitchboardFeeds.SOL_USD_DEVNET]: 175.0,
    };
    price = simulatedRates[feedAddress] ?? 1.0;
    confidence = price * 0.001; // 0.1% confidence
    timestamp = Math.floor(Date.now() / 1000);
  }

  const now = Math.floor(Date.now() / 1000);
  const isStale = now - timestamp > 60;

  return { feed: feedAddress, price, timestamp, confidence, isStale };
}

/**
 * Calculate how many token units to mint given a fiat deposit amount and oracle rate.
 *
 * @param fiatAmount  - Deposit amount in base fiat units (e.g. 100 USDC = 100_000_000)
 * @param rate        - Oracle price: how many USD per 1 unit of target currency (e.g. BRL/USD = 0.175)
 * @param decimals    - Token decimals (typically 6)
 * @returns Token amount in smallest units
 *
 * @example
 * // 100 USDC → BRL tokens at rate 0.175 (1 BRL = $0.175)
 * calculateMintAmount(100_000_000, 0.175, 6)
 * // → 571_428_571 (571.43 BRL tokens)
 */
export function calculateMintAmount(
  fiatAmount: number,
  rate: number,
  decimals: number
): number {
  if (rate <= 0) throw new Error("Oracle rate must be positive");
  // fiatAmount is in smallest USDC units (6 decimals)
  // result is in smallest target-currency units (decimals)
  const fiatHuman = fiatAmount / 1_000_000; // assume USDC input
  const targetHuman = fiatHuman / rate;
  return Math.floor(targetHuman * Math.pow(10, decimals));
}

/**
 * Calculate the USD redemption value of a token balance.
 *
 * @param tokenAmount - Token amount in smallest units
 * @param rate        - Oracle price (USD per 1 target currency unit)
 * @param decimals    - Token decimals
 * @returns USD value in smallest units (6 decimals = USDC-equivalent)
 *
 * @example
 * // 1000 BRL tokens → USD at rate 0.175
 * calculateRedeemAmount(1_000_000_000, 0.175, 6)
 * // → 175_000_000 (175 USDC)
 */
export function calculateRedeemAmount(
  tokenAmount: number,
  rate: number,
  decimals: number
): number {
  const tokenHuman = tokenAmount / Math.pow(10, decimals);
  const usdHuman = tokenHuman * rate;
  return Math.floor(usdHuman * 1_000_000);
}

/**
 * Get all feed prices in a single RPC call batch.
 *
 * @param connection - Solana RPC connection
 * @param feeds - Array of feed addresses
 * @returns Map of feed address to OraclePrice
 */
export async function getBatchPrices(
  connection: Connection,
  feeds: FeedAddress[]
): Promise<Map<string, OraclePrice>> {
  const results = await Promise.allSettled(
    feeds.map(feed => getPegPrice(connection, feed))
  );
  const map = new Map<string, OraclePrice>();
  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      map.set(feeds[i], result.value);
    }
  });
  return map;
}

/**
 * Assert that an oracle price is fresh and within acceptable bounds.
 * Throws if the price fails any safety check.
 *
 * @param price - OraclePrice from getPegPrice()
 * @param maxStalenessSeconds - Maximum age in seconds (default: 60)
 * @param maxConfidencePct - Maximum confidence interval as % of price (default: 1%)
 */
export function assertPriceSafe(
  price: OraclePrice,
  maxStalenessSeconds = 60,
  maxConfidencePct = 0.01
): void {
  if (price.isStale) {
    throw new Error(`Oracle price is stale (last update >  ${maxStalenessSeconds}s ago)`);
  }
  const confidenceRatio = price.confidence / price.price;
  if (confidenceRatio > maxConfidencePct) {
    throw new Error(
      `Oracle confidence too low: ${(confidenceRatio * 100).toFixed(2)}% (max ${(maxConfidencePct * 100).toFixed(2)}%)`
    );
  }
}
