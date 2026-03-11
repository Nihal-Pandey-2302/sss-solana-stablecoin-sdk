import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { SolanaStablecoin } from "./index";

/**
 * Mints stablecoin tokens to a recipient.
 */
export async function mintTokens(
  sdk: SolanaStablecoin,
  minter: Keypair,
  mint: PublicKey,
  recipientAta: PublicKey,
  amount: number
): Promise<string> {
  const statePda = sdk.getStatePda(mint);
  const blacklistPda = sdk.getBlacklistPda(mint, recipientAta);
  return await sdk.program.methods
    .mint(new anchor.BN(amount))
    .accounts({
      minter: minter.publicKey,
      mint,
      recipient: recipientAta,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    })
    .signers([minter])
    .rpc();
}

/**
 * Burns stablecoin tokens from a user's ATA.
 */
export async function burnTokens(
  sdk: SolanaStablecoin,
  burner: Keypair,
  mint: PublicKey,
  targetAta: PublicKey,
  amount: number
): Promise<string> {
  const statePda = sdk.getStatePda(mint);
  const blacklistPda = sdk.getBlacklistPda(mint, targetAta);
  return await sdk.program.methods
    .burn(new anchor.BN(amount))
    .accounts({
      burner: burner.publicKey,
      mint,
      from: targetAta,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    })
    .signers([burner])
    .rpc();
}

/**
 * Freezes a target token account.
 */
export async function freezeAccount(
  sdk: SolanaStablecoin,
  master: Keypair,
  mint: PublicKey,
  targetAta: PublicKey
): Promise<string> {
  const statePda = sdk.getStatePda(mint);
  return await sdk.program.methods
    .freezeAccount()
    .accounts({
      mint,
      targetAccount: targetAta,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    })
    .signers([master])
    .rpc();
}

/**
 * Thaws a frozen target token account.
 */
export async function thawAccount(
  sdk: SolanaStablecoin,
  master: Keypair,
  mint: PublicKey,
  targetAta: PublicKey
): Promise<string> {
  const statePda = sdk.getStatePda(mint);
  return await sdk.program.methods
    .thawAccount()
    .accounts({
      mint,
      targetAccount: targetAta,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    })
    .signers([master])
    .rpc();
}

/**
 * Pauses all token operations.
 */
export async function pauseToken(
  sdk: SolanaStablecoin,
  master: Keypair,
  mint: PublicKey
): Promise<string> {
  const statePda = sdk.getStatePda(mint);
  return await sdk.program.methods
    .pause()
    .accounts({
      mint,
    })
    .signers([master])
    .rpc();
}

/**
 * Unpauses all token operations.
 */
export async function unpauseToken(
  sdk: SolanaStablecoin,
  master: Keypair,
  mint: PublicKey
): Promise<string> {
  const statePda = sdk.getStatePda(mint);
  return await sdk.program.methods
    .unpause()
    .accounts({
      mint,
    })
    .signers([master])
    .rpc();
}
