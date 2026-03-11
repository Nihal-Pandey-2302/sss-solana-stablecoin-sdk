import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { ExtensionType } from "@solana/spl-token";
import { SssToken } from "./idl/sss_token";
import { TransferHook } from "./idl/transfer_hook";
export declare enum Preset {
    SSS1 = "SSS1",// Core: Mint, Burn, Pause, Freeze
    SSS2 = "SSS2"
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
export declare class SolanaStablecoin {
    connection: Connection;
    program: Program<SssToken>;
    hookProgram: Program<TransferHook>;
    constructor(connection: Connection, wallet: anchor.Wallet, programId?: PublicKey, hookProgramId?: PublicKey);
    /**
     * Returns the required Token-2022 Extensions required for a preset.
     */
    static getExtensions(preset: Preset): ExtensionType[];
    /**
     * Derives the state PDA for the given mint.
     */
    getStatePda(mint: PublicKey): PublicKey;
    /**
     * Fetches the on-chain StablecoinState data.
     */
    getState(mint: PublicKey): Promise<{
        mint: anchor.web3.PublicKey;
        masterAuthority: anchor.web3.PublicKey;
        minters: anchor.web3.PublicKey[];
        burner: anchor.web3.PublicKey;
        pauser: anchor.web3.PublicKey;
        blacklister: anchor.web3.PublicKey;
        isPaused: boolean;
    }>;
    /**
     * Derives the Blacklist PDA for a specific Token Account.
     */
    getBlacklistPda(mint: PublicKey, targetAta: PublicKey): PublicKey;
}
export * from "./defineStablecoin";
export * from "./sss1";
export * from "./sss2";
