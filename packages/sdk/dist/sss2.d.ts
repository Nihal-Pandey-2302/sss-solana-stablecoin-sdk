import { PublicKey, Keypair } from "@solana/web3.js";
import { SolanaStablecoin } from "./index";
/**
 * Derives the Blacklist PDA for a specific Token Account.
 */
export declare function getBlacklistPda(sdk: SolanaStablecoin, mint: PublicKey, targetAta: PublicKey): PublicKey;
/**
 * Adds a target token account to the Blacklist.
 */
export declare function addToBlacklist(sdk: SolanaStablecoin, blacklister: Keypair, mint: PublicKey, targetAta: PublicKey): Promise<string>;
/**
 * Removes a target token account from the Blacklist.
 */
export declare function removeFromBlacklist(sdk: SolanaStablecoin, blacklister: Keypair, mint: PublicKey, targetAta: PublicKey): Promise<string>;
/**
 * Seizes tokens from a blacklisted user using the Token-2022 Permanent Delegate.
 */
export declare function seizeTokens(sdk: SolanaStablecoin, authority: Keypair, mint: PublicKey, targetAta: PublicKey, amount: number): Promise<string>;
