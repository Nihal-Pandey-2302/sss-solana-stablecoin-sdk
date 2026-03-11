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
exports.mintTokens = mintTokens;
exports.burnTokens = burnTokens;
exports.freezeAccount = freezeAccount;
exports.thawAccount = thawAccount;
exports.pauseToken = pauseToken;
exports.unpauseToken = unpauseToken;
const anchor = __importStar(require("@coral-xyz/anchor"));
const spl_token_1 = require("@solana/spl-token");
/**
 * Mints stablecoin tokens to a recipient.
 */
async function mintTokens(sdk, minter, mint, recipientAta, amount) {
    const statePda = sdk.getStatePda(mint);
    const blacklistPda = sdk.getBlacklistPda(mint, recipientAta);
    return await sdk.program.methods
        .mint(new anchor.BN(amount))
        .accounts({
        minter: minter.publicKey,
        mint,
        recipient: recipientAta,
        tokenProgram: spl_token_1.TOKEN_2022_PROGRAM_ID,
    })
        .signers([minter])
        .rpc();
}
/**
 * Burns stablecoin tokens from a user's ATA.
 */
async function burnTokens(sdk, burner, mint, targetAta, amount) {
    const statePda = sdk.getStatePda(mint);
    const blacklistPda = sdk.getBlacklistPda(mint, targetAta);
    return await sdk.program.methods
        .burn(new anchor.BN(amount))
        .accounts({
        burner: burner.publicKey,
        mint,
        from: targetAta,
        tokenProgram: spl_token_1.TOKEN_2022_PROGRAM_ID,
    })
        .signers([burner])
        .rpc();
}
/**
 * Freezes a target token account.
 */
async function freezeAccount(sdk, master, mint, targetAta) {
    const statePda = sdk.getStatePda(mint);
    return await sdk.program.methods
        .freezeAccount()
        .accounts({
        mint,
        targetAccount: targetAta,
        tokenProgram: spl_token_1.TOKEN_2022_PROGRAM_ID,
    })
        .signers([master])
        .rpc();
}
/**
 * Thaws a frozen target token account.
 */
async function thawAccount(sdk, master, mint, targetAta) {
    const statePda = sdk.getStatePda(mint);
    return await sdk.program.methods
        .thawAccount()
        .accounts({
        mint,
        targetAccount: targetAta,
        tokenProgram: spl_token_1.TOKEN_2022_PROGRAM_ID,
    })
        .signers([master])
        .rpc();
}
/**
 * Pauses all token operations.
 */
async function pauseToken(sdk, master, mint) {
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
async function unpauseToken(sdk, master, mint) {
    const statePda = sdk.getStatePda(mint);
    return await sdk.program.methods
        .unpause()
        .accounts({
        mint,
    })
        .signers([master])
        .rpc();
}
