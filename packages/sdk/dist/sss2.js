"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBlacklistPda = getBlacklistPda;
exports.addToBlacklist = addToBlacklist;
exports.removeFromBlacklist = removeFromBlacklist;
exports.seizeTokens = seizeTokens;
const anchor = __importStar(require("@coral-xyz/anchor"));
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
/**
 * Derives the Blacklist PDA for a specific Token Account.
 */
function getBlacklistPda(sdk, mint, targetAta) {
    const [pda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("blacklist"), mint.toBuffer(), targetAta.toBuffer()], sdk.program.programId);
    return pda;
}
/**
 * Adds a target token account to the Blacklist.
 */
async function addToBlacklist(sdk, blacklister, mint, targetAta) {
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
async function removeFromBlacklist(sdk, blacklister, mint, targetAta) {
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
async function seizeTokens(sdk, authority, mint, targetAta, amount) {
    const statePda = sdk.getStatePda(mint);
    return await sdk.program.methods
        .seize(new anchor.BN(amount))
        .accounts({
        authority: authority.publicKey,
        mint,
        state: statePda,
        targetAccount: targetAta,
        tokenProgram: spl_token_1.TOKEN_2022_PROGRAM_ID,
    })
        .signers([authority])
        .rpc();
}
