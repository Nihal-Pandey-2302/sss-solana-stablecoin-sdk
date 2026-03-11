import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { SolanaStablecoin, defineStablecoin, mintTokens, Preset } from "@solana-stablecoin-standard/sdk";

// This scripts outlines a simple demonstration end-to-end flow
async function main() {
    console.log("🎬 Starting SSS Demo Script...");

    // Connect and setup Localnet
    const connection = new Connection("http://127.0.0.1:8899", "confirmed");
    const masterAuthority = Keypair.generate();
    console.log(`🔑 Generated Master Authority: ${masterAuthority.publicKey.toBase58()}`);

    // Assuming local test validator is running and funded, in real scenarios fund the keypair
    const wallet = new anchor.Wallet(masterAuthority);
    const sdk = new SolanaStablecoin(connection, wallet);

    console.log("⚙️  Initializing SSS-2 Stablecoin...");
    const mintKeypair = Keypair.generate();

    try {
        const initSig = await defineStablecoin(sdk, masterAuthority, mintKeypair, {
            decimals: 6,
            preset: Preset.SSS2,
            masterAuthority: masterAuthority.publicKey,
            minters: [masterAuthority.publicKey]
        });
        console.log(`✅ Mint initialized! Tx: ${initSig}`);
    } catch (e: any) {
        console.error("❌ Failed to initialize mint (ensure validator is running & funded). Error:", e.message);
        return;
    }

    // In a full demo, we would create ATA and mint:
    // const ata = ... (get ATA)
    // await mintTokens(sdk, masterAuthority, mintKeypair.publicKey, ata, 1000);
}

main().catch(console.error);
