import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair, Transaction, sendAndConfirmTransaction, Signer } from "@solana/web3.js";
import {
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  getMintLen,
  createInitializeMintInstruction,
  createInitializeTransferHookInstruction,
  createInitializePermanentDelegateInstruction,
  createSetAuthorityInstruction,
  AuthorityType,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";

import { SssToken } from "./idl/sss_token";
import { TransferHook } from "./idl/transfer_hook";
import SssTokenIdl from "./idl/sss_token.json";
import TransferHookIdl from "./idl/transfer_hook.json";

export enum Preset {
  SSS1 = "SSS1", // Core: Mint, Burn, Pause, Freeze
  SSS2 = "SSS2", // Advanced: Transfer Hooks, Blacklists, Seize
}

export interface DefineStablecoinParams {
  decimals: number;
  preset: Preset;
  masterAuthority: PublicKey;
  minters: PublicKey[];
  burnerPlaceholder?: PublicKey;
  pauserPlaceholder?: PublicKey;
  blacklisterPlaceholder?: PublicKey;
}

export class SolanaStablecoin {
  public connection: Connection;
  public program: Program<SssToken>;
  public hookProgram: Program<TransferHook>;

  constructor(
    connection: Connection,
    wallet: anchor.Wallet,
    programId?: PublicKey,
    hookProgramId?: PublicKey
  ) {
    this.connection = connection;
    const provider = new anchor.AnchorProvider(connection, wallet, {
      preflightCommitment: "confirmed",
    });

    const defaultProgramId = new PublicKey("DyHpthHQhvcuywjyV4nBjpEZbM1PfP71wAn84nkVshUy");
    const defaultHookProgramId = new PublicKey("F7igqZa75yYPnXBBKUK3hDwEmtfwUWogEcWMsh5v6FyR");

    this.program = new Program<SssToken>(
      SssTokenIdl as any,
      provider
    );

    this.hookProgram = new Program<TransferHook>(
      TransferHookIdl as any,
      provider
    );
  }

  /**
   * Returns the required Token-2022 Extensions required for a preset.
   */
  public static getExtensions(preset: Preset): ExtensionType[] {
    switch (preset) {
      case Preset.SSS1:
        return [];
      case Preset.SSS2:
        return [ExtensionType.TransferHook, ExtensionType.PermanentDelegate];
      default:
        return [];
    }
  }

  /**
   * Derives the state PDA for the given mint.
   */
  public getStatePda(mint: PublicKey): PublicKey {
    const [statePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("state"), mint.toBuffer()],
      this.program.programId
    );
    return statePda;
  }

  /**
   * Fetches the on-chain StablecoinState data.
   */
  public async getState(mint: PublicKey) {
    const statePda = this.getStatePda(mint);
    return await this.program.account.stablecoinState.fetch(statePda);
  }

  /**
   * Derives the Blacklist PDA for a specific Token Account.
   */
  public getBlacklistPda(mint: PublicKey, targetAta: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("blacklist"), mint.toBuffer(), targetAta.toBuffer()],
      this.program.programId
    );
    return pda;
  }
}

export * from "./defineStablecoin";
export * from "./sss1";
export * from "./sss2";
export * from "./sss3";
export * from "./oracle";

