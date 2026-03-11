import { PublicKey, Keypair } from "@solana/web3.js";
import { SolanaStablecoin } from "./index";
/**
 * Mints stablecoin tokens to a recipient.
 */
export declare function mintTokens(sdk: SolanaStablecoin, minter: Keypair, mint: PublicKey, recipientAta: PublicKey, amount: number): Promise<string>;
/**
 * Burns stablecoin tokens from a user's ATA.
 */
export declare function burnTokens(sdk: SolanaStablecoin, burner: Keypair, mint: PublicKey, targetAta: PublicKey, amount: number): Promise<string>;
/**
 * Freezes a target token account.
 */
export declare function freezeAccount(sdk: SolanaStablecoin, master: Keypair, mint: PublicKey, targetAta: PublicKey): Promise<string>;
/**
 * Thaws a frozen target token account.
 */
export declare function thawAccount(sdk: SolanaStablecoin, master: Keypair, mint: PublicKey, targetAta: PublicKey): Promise<string>;
/**
 * Pauses all token operations.
 */
export declare function pauseToken(sdk: SolanaStablecoin, master: Keypair, mint: PublicKey): Promise<string>;
/**
 * Unpauses all token operations.
 */
export declare function unpauseToken(sdk: SolanaStablecoin, master: Keypair, mint: PublicKey): Promise<string>;
