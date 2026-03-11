import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { SolanaStablecoin } from "./index";

/**
 * Derives the Blacklist PDA for a specific Token Account.
 */
export function getBlacklistPda(
  sdk: SolanaStablecoin,
  mint: PublicKey,
  targetAta: PublicKey
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("blacklist"), mint.toBuffer(), targetAta.toBuffer()],
    sdk.program.programId
  );
  return pda;
}


/**
 * Adds a target token account to the Blacklist.
 */
export async function addToBlacklist(
  sdk: SolanaStablecoin,
  blacklister: Keypair,
  mint: PublicKey,
  targetAta: PublicKey
): Promise<string> {
  const blacklistPda = getBlacklistPda(sdk, mint, targetAta);

  return await sdk.program.methods
    .addToBlacklist()
    .accounts({
      mint,
      targetAccount: targetAta,
    })
    .signers([blacklister])
    .rpc();
}

/**
 * Removes a target token account from the Blacklist.
 */
export async function removeFromBlacklist(
  sdk: SolanaStablecoin,
  blacklister: Keypair,
  mint: PublicKey,
  targetAta: PublicKey
): Promise<string> {
  const blacklistPda = getBlacklistPda(sdk, mint, targetAta);

  return await sdk.program.methods
    .removeFromBlacklist()
    .accounts({
      mint,
      targetAccount: targetAta,
    })
    .signers([blacklister])
    .rpc();
}

/**
 * Seizes tokens from a blacklisted user using the Token-2022 Permanent Delegate.
 */
export async function seizeTokens(
  sdk: SolanaStablecoin,
  authority: Keypair,
  mint: PublicKey,
  targetAta: PublicKey,
  amount: number
): Promise<string> {
  const statePda = sdk.getStatePda(mint);
  return await sdk.program.methods
    .seize(new anchor.BN(amount))
    .accounts({
      authority: authority.publicKey,
      mint,
      state: statePda,
      targetAccount: targetAta,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    } as any)
    .signers([authority])
    .rpc();
}
