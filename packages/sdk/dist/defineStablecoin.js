"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defineStablecoin = defineStablecoin;
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const index_1 = require("./index");
async function defineStablecoin(sdk, payer, mintKeypair, params) {
    const { decimals, preset, masterAuthority, minters } = params;
    const burner = params.burnerPlaceholder || masterAuthority;
    const pauser = params.pauserPlaceholder || masterAuthority;
    const blacklister = params.blacklisterPlaceholder || masterAuthority;
    const statePda = sdk.getStatePda(mintKeypair.publicKey);
    const extensions = index_1.SolanaStablecoin.getExtensions(preset);
    const mintLen = (0, spl_token_1.getMintLen)(extensions);
    const lamports = await sdk.connection.getMinimumBalanceForRentExemption(mintLen);
    const tx = new web3_js_1.Transaction();
    // 1. Allocate space
    tx.add(web3_js_1.SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: mintLen,
        lamports,
        programId: spl_token_1.TOKEN_2022_PROGRAM_ID,
    }));
    // 2. Initialize Extensions based on preset
    if (preset === index_1.Preset.SSS2) {
        tx.add((0, spl_token_1.createInitializeTransferHookInstruction)(mintKeypair.publicKey, statePda, // transfer hook authority
        sdk.hookProgram.programId, spl_token_1.TOKEN_2022_PROGRAM_ID), (0, spl_token_1.createInitializePermanentDelegateInstruction)(mintKeypair.publicKey, statePda, // permanent delegate
        spl_token_1.TOKEN_2022_PROGRAM_ID));
    }
    // 3. Initialize Mint Core & Set Master Authority
    tx.add((0, spl_token_1.createInitializeMintInstruction)(mintKeypair.publicKey, decimals, payer.publicKey, // temp mint authority
    statePda, // freeze authority
    spl_token_1.TOKEN_2022_PROGRAM_ID), (0, spl_token_1.createSetAuthorityInstruction)(mintKeypair.publicKey, payer.publicKey, // current mint authority
    spl_token_1.AuthorityType.MintTokens, statePda, // new mint authority (State PDA)
    [], spl_token_1.TOKEN_2022_PROGRAM_ID));
    await (0, web3_js_1.sendAndConfirmTransaction)(sdk.connection, tx, [payer, mintKeypair]);
    // 4. Initialize SSS Token State and ExtraAccountMetas (if SSS2)
    const initSssTx = await sdk.program.methods
        .initialize(minters, burner, pauser, blacklister)
        .accounts({
        masterAuthority,
        mint: mintKeypair.publicKey,
    })
        .signers([payer])
        .rpc();
    if (preset === index_1.Preset.SSS2) {
        const [extraAccountMetaListPDA] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("extra-account-metas"), mintKeypair.publicKey.toBuffer()], sdk.hookProgram.programId);
        await sdk.hookProgram.methods
            .initializeExtraAccountMetaList()
            .accounts({
            payer: payer.publicKey,
            mint: mintKeypair.publicKey,
        })
            .signers([payer])
            .rpc();
    }
    return initSssTx;
}
