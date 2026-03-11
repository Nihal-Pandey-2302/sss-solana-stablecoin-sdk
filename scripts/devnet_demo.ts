import { Connection, Keypair, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { createAssociatedTokenAccountInstruction, getAssociatedTokenAddress, createTransferCheckedInstruction, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import { SolanaStablecoin, defineStablecoin, mintTokens, addToBlacklist, removeFromBlacklist, seizeTokens, Preset } from "@solana-stablecoin-standard/sdk";
import * as fs from "fs";

async function main() {
    console.log("🎬 Starting Devnet Demo Script...");
    const rpc = "https://api.devnet.solana.com";
    const connection = new Connection(rpc, "confirmed");
    const secretKeyString = fs.readFileSync("/home/nihal/.config/solana/id.json", { encoding: "utf8" });
    const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
    const masterAuthority = Keypair.fromSecretKey(secretKey);

    const wallet = new anchor.Wallet(masterAuthority);
    const sdk = new SolanaStablecoin(connection, wallet);

    console.log(`🔑 Authority: ${masterAuthority.publicKey.toBase58()}`);
    
    // 1. Initialize SSS-2 Token
    const mintKeypair = Keypair.generate();
    console.log(`⚙️ Mint target: ${mintKeypair.publicKey.toBase58()}`);
    const initSig = await defineStablecoin(sdk, masterAuthority, mintKeypair, {
        decimals: 6,
        preset: Preset.SSS2,
        masterAuthority: masterAuthority.publicKey,
        minters: [masterAuthority.publicKey]
    });
    console.log(`✅ 1. Initialize SSS-2 Token: ${initSig}`);

    // Give Devnet some time to propagate the new mint
    await new Promise(r => setTimeout(r, 5000));

    // Target ATA setup
    const targetOwner = Keypair.generate();
    const targetAta = await getAssociatedTokenAddress(mintKeypair.publicKey, targetOwner.publicKey, false, TOKEN_2022_PROGRAM_ID);
    
    // Create ATA
    let tx = new Transaction().add(
        createAssociatedTokenAccountInstruction(
            masterAuthority.publicKey,
            targetAta,
            targetOwner.publicKey,
            mintKeypair.publicKey,
            TOKEN_2022_PROGRAM_ID
        )
    );
    const ataSig = await sendAndConfirmTransaction(connection, tx, [masterAuthority], { commitment: "confirmed" });
    console.log(`🔧 Created Target ATA: ${ataSig}`);

    // Create Receiver ATA for blocked transfer test
    const receiverOwner = Keypair.generate();
    const receiverAta = await getAssociatedTokenAddress(mintKeypair.publicKey, receiverOwner.publicKey, false, TOKEN_2022_PROGRAM_ID);
    tx = new Transaction().add(
        createAssociatedTokenAccountInstruction(
            masterAuthority.publicKey,
            receiverAta,
            receiverOwner.publicKey,
            mintKeypair.publicKey,
            TOKEN_2022_PROGRAM_ID
        )
    );
    await sendAndConfirmTransaction(connection, tx, [masterAuthority], { commitment: "confirmed" });
    console.log(`🔧 Created Receiver ATA`);

    // 2. Mint 1M Tokens (1 USDC with 6 decimals)
    const mintSig = await mintTokens(sdk, masterAuthority, mintKeypair.publicKey, targetAta, 1000000);
    console.log(`✅ 2. Mint 1M Tokens: ${mintSig}`);

    await new Promise(r => setTimeout(r, 3000));

    // 3. Add to Blacklist
    const blacklistSig = await addToBlacklist(sdk, masterAuthority, mintKeypair.publicKey, targetAta);
    console.log(`✅ 3. Add to Blacklist: ${blacklistSig}`);

    await new Promise(r => setTimeout(r, 3000));

    // 4. Transfer Blocked (Blacklist)
    try {
        const transferTx = new Transaction().add(
            createTransferCheckedInstruction(
                targetAta,
                mintKeypair.publicKey,
                receiverAta,
                targetOwner.publicKey,
                100,
                6,
                [],
                TOKEN_2022_PROGRAM_ID
            )
        );
        transferTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        transferTx.feePayer = masterAuthority.publicKey;
        transferTx.sign(targetOwner, masterAuthority);
        
        // Skip preflight so it hits the chain and gets a transaction signature.
        const transferSig = await connection.sendRawTransaction(transferTx.serialize(), { skipPreflight: true });
        console.log(`✅ 4. Transfer Blocked (Blacklist) Sig: ${transferSig}`);
    } catch(e: any) {
        console.log(`❌ 4. Transfer Blocked (Blacklist): Simulation Error -> ${e.message}`);
    }

    await new Promise(r => setTimeout(r, 5000));

    // 5. Seize 500K Tokens
    const seizeSig = await seizeTokens(sdk, masterAuthority, mintKeypair.publicKey, targetAta, 500000);
    console.log(`✅ 5. Seize 500K Tokens: ${seizeSig}`);

    await new Promise(r => setTimeout(r, 3000));

    // 6. Remove from Blacklist
    const unblacklistSig = await removeFromBlacklist(sdk, masterAuthority, mintKeypair.publicKey, targetAta);
    console.log(`✅ 6. Remove from Blacklist: ${unblacklistSig}`);

    console.log("🏁 Demo Transactions Complete!");
}

main().catch(console.error);
