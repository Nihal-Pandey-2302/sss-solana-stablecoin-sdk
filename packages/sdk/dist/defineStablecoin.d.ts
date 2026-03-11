import { Keypair, PublicKey } from "@solana/web3.js";
import { SolanaStablecoin, Preset } from "./index";
export interface DefineStablecoinParams {
    decimals: number;
    preset: Preset;
    masterAuthority: PublicKey;
    minters: PublicKey[];
    burnerPlaceholder?: PublicKey;
    pauserPlaceholder?: PublicKey;
    blacklisterPlaceholder?: PublicKey;
}
export declare function defineStablecoin(sdk: SolanaStablecoin, payer: Keypair, mintKeypair: Keypair, params: DefineStablecoinParams): Promise<string>;
