#!/usr/bin/env node
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const dotenv_1 = __importDefault(require("dotenv"));
const anchor = __importStar(require("@coral-xyz/anchor"));
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const sdk_1 = require("@solana-stablecoin-standard/sdk");
const fs = __importStar(require("fs"));
const dashboard_1 = require("./dashboard");
dotenv_1.default.config();
const program = new commander_1.Command();
program
    .name("sss")
    .description("CLI to manage the Solana Stablecoin Standard.")
    .version("1.0.0");
// ─── Setup helper ────────────────────────────────────────────────────────────
function setupEnv(options) {
    const rpcUrl = options.url || process.env.RPC_URL || "http://127.0.0.1:8899";
    const keypairPath = options.keypair || process.env.AUTHORITY_KEYPAIR_PATH;
    if (!keypairPath || !fs.existsSync(keypairPath)) {
        console.error("❌ Keypair file not found! Provide via --keypair or AUTHORITY_KEYPAIR_PATH env.");
        process.exit(1);
    }
    const rawKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
    const keypair = web3_js_1.Keypair.fromSecretKey(new Uint8Array(rawKey));
    const connection = new web3_js_1.Connection(rpcUrl, "confirmed");
    const wallet = new anchor.Wallet(keypair);
    const sdk = new sdk_1.SolanaStablecoin(connection, wallet);
    return { sdk, keypair, connection };
}
function commonOpts(cmd) {
    return cmd
        .option("-u, --url <url>", "RPC URL")
        .option("-k, --keypair <path>", "Path to authority keypair");
}
// ─── init ────────────────────────────────────────────────────────────────────
commonOpts(program
    .command("init")
    .description("Initialize a new Stablecoin (default: SSS-2).")
    .option("-p, --preset <preset>", "Preset: sss-1 or sss-2", "sss-2")
    .option("-d, --decimals <number>", "Mint decimals", "6")).action(async (options) => {
    try {
        const { sdk, keypair } = setupEnv(options);
        const mintKeypair = web3_js_1.Keypair.generate();
        const preset = options.preset === "sss-1" ? sdk_1.Preset.SSS1 : sdk_1.Preset.SSS2;
        console.log(`🛠️  Initializing ${options.preset.toUpperCase()} stablecoin...`);
        const sig = await (0, sdk_1.defineStablecoin)(sdk, keypair, mintKeypair, {
            decimals: parseInt(options.decimals),
            preset,
            masterAuthority: keypair.publicKey,
            minters: [keypair.publicKey]
        });
        console.log(`✅ Mint created:   ${mintKeypair.publicKey.toBase58()}`);
        console.log(`🔗 Tx:             ${sig}`);
    }
    catch (e) {
        console.error("❌ Init Error:", e.message);
    }
});
// ─── mint ────────────────────────────────────────────────────────────────────
commonOpts(program
    .command("mint")
    .description("Mint tokens to a specific ATA.")
    .requiredOption("-m, --mint <pubkey>", "Mint address")
    .requiredOption("-t, --target <pubkey>", "Target ATA")
    .requiredOption("-a, --amount <number>", "Amount (smallest unit)")).action(async (options) => {
    try {
        const { sdk, keypair } = setupEnv(options);
        console.log(`💸 Minting ${options.amount} tokens...`);
        const sig = await (0, sdk_1.mintTokens)(sdk, keypair, new web3_js_1.PublicKey(options.mint), new web3_js_1.PublicKey(options.target), Number(options.amount));
        console.log(`✅ Minted! Tx: ${sig}`);
    }
    catch (e) {
        console.error("❌ Mint Error:", e.message);
    }
});
// ─── burn ────────────────────────────────────────────────────────────────────
commonOpts(program
    .command("burn")
    .description("Burn tokens from a specific ATA.")
    .requiredOption("-m, --mint <pubkey>", "Mint address")
    .requiredOption("-t, --target <pubkey>", "Target ATA")
    .requiredOption("-a, --amount <number>", "Amount to burn")).action(async (options) => {
    try {
        const { sdk, keypair } = setupEnv(options);
        console.log(`🔥 Burning ${options.amount} tokens...`);
        const sig = await (0, sdk_1.burnTokens)(sdk, keypair, new web3_js_1.PublicKey(options.mint), new web3_js_1.PublicKey(options.target), Number(options.amount));
        console.log(`✅ Burned! Tx: ${sig}`);
    }
    catch (e) {
        console.error("❌ Burn Error:", e.message);
    }
});
// ─── freeze / thaw ───────────────────────────────────────────────────────────
commonOpts(program
    .command("freeze")
    .description("Freeze a token account.")
    .requiredOption("-m, --mint <pubkey>", "Mint address")
    .requiredOption("-t, --target <pubkey>", "Target ATA to freeze")).action(async (options) => {
    try {
        const { sdk, keypair } = setupEnv(options);
        console.log(`🧊 Freezing ${options.target}...`);
        const sig = await (0, sdk_1.freezeAccount)(sdk, keypair, new web3_js_1.PublicKey(options.mint), new web3_js_1.PublicKey(options.target));
        console.log(`✅ Account frozen! Tx: ${sig}`);
    }
    catch (e) {
        console.error("❌ Freeze Error:", e.message);
    }
});
commonOpts(program
    .command("thaw")
    .description("Thaw a frozen token account.")
    .requiredOption("-m, --mint <pubkey>", "Mint address")
    .requiredOption("-t, --target <pubkey>", "Target ATA to thaw")).action(async (options) => {
    try {
        const { sdk, keypair } = setupEnv(options);
        console.log(`🌡️  Thawing ${options.target}...`);
        const sig = await (0, sdk_1.thawAccount)(sdk, keypair, new web3_js_1.PublicKey(options.mint), new web3_js_1.PublicKey(options.target));
        console.log(`✅ Account thawed! Tx: ${sig}`);
    }
    catch (e) {
        console.error("❌ Thaw Error:", e.message);
    }
});
// ─── pause / unpause ─────────────────────────────────────────────────────────
commonOpts(program
    .command("pause")
    .description("Pause all token operations (emergency stop).")
    .requiredOption("-m, --mint <pubkey>", "Mint address")).action(async (options) => {
    try {
        const { sdk, keypair } = setupEnv(options);
        console.log(`⏸️  Pausing token operations...`);
        const sig = await (0, sdk_1.pauseToken)(sdk, keypair, new web3_js_1.PublicKey(options.mint));
        console.log(`✅ Token paused! Tx: ${sig}`);
    }
    catch (e) {
        console.error("❌ Pause Error:", e.message);
    }
});
commonOpts(program
    .command("unpause")
    .description("Resume token operations.")
    .requiredOption("-m, --mint <pubkey>", "Mint address")).action(async (options) => {
    try {
        const { sdk, keypair } = setupEnv(options);
        console.log(`▶️  Unpausing token operations...`);
        const sig = await (0, sdk_1.unpauseToken)(sdk, keypair, new web3_js_1.PublicKey(options.mint));
        console.log(`✅ Token unpaused! Tx: ${sig}`);
    }
    catch (e) {
        console.error("❌ Unpause Error:", e.message);
    }
});
// ─── blacklist:add / blacklist:remove ────────────────────────────────────────
commonOpts(program
    .command("blacklist:add")
    .description("Blacklist a token account (SSS-2 only).")
    .requiredOption("-m, --mint <pubkey>", "Mint address")
    .requiredOption("-t, --target <pubkey>", "Target ATA to blacklist")
    .option("-r, --reason <text>", "Reason (logged locally)", "No reason provided")).action(async (options) => {
    try {
        const { sdk, keypair } = setupEnv(options);
        console.log(`🛑 Blacklisting ${options.target}...`);
        if (options.reason)
            console.log(`   Reason: ${options.reason}`);
        const sig = await (0, sdk_1.addToBlacklist)(sdk, keypair, new web3_js_1.PublicKey(options.mint), new web3_js_1.PublicKey(options.target));
        console.log(`✅ Account blacklisted! Tx: ${sig}`);
    }
    catch (e) {
        console.error("❌ Blacklist Error:", e.message);
    }
});
commonOpts(program
    .command("blacklist:remove")
    .description("Remove a token account from the blacklist.")
    .requiredOption("-m, --mint <pubkey>", "Mint address")
    .requiredOption("-t, --target <pubkey>", "Target ATA to unblacklist")).action(async (options) => {
    try {
        const { sdk, keypair } = setupEnv(options);
        console.log(`✅ Removing ${options.target} from blacklist...`);
        const sig = await (0, sdk_1.removeFromBlacklist)(sdk, keypair, new web3_js_1.PublicKey(options.mint), new web3_js_1.PublicKey(options.target));
        console.log(`✅ Account unblacklisted! Tx: ${sig}`);
    }
    catch (e) {
        console.error("❌ Remove Blacklist Error:", e.message);
    }
});
// ─── seize ───────────────────────────────────────────────────────────────────
commonOpts(program
    .command("seize")
    .description("Seize tokens from a blacklisted account (Permanent Delegate).")
    .requiredOption("-m, --mint <pubkey>", "Mint address")
    .requiredOption("-t, --target <pubkey>", "Blacklisted ATA to seize from")
    .requiredOption("-a, --amount <number>", "Amount to seize")).action(async (options) => {
    try {
        const { sdk, keypair } = setupEnv(options);
        console.log(`🔥 Seizing ${options.amount} tokens from ${options.target}...`);
        const sig = await (0, sdk_1.seizeTokens)(sdk, keypair, new web3_js_1.PublicKey(options.mint), new web3_js_1.PublicKey(options.target), Number(options.amount));
        console.log(`✅ Tokens seized! Tx: ${sig}`);
    }
    catch (e) {
        console.error("❌ Seize Error:", e.message);
    }
});
// ─── supply ──────────────────────────────────────────────────────────────────
commonOpts(program
    .command("supply")
    .description("Show current token supply.")
    .requiredOption("-m, --mint <pubkey>", "Mint address")).action(async (options) => {
    try {
        const { connection } = setupEnv(options);
        const mintInfo = await (0, spl_token_1.getMint)(connection, new web3_js_1.PublicKey(options.mint), "confirmed", spl_token_1.TOKEN_2022_PROGRAM_ID);
        const decimals = mintInfo.decimals;
        const rawSupply = mintInfo.supply;
        const humanSupply = Number(rawSupply) / Math.pow(10, decimals);
        console.log(`\n📊 Token Supply`);
        console.log(`   Mint:        ${options.mint}`);
        console.log(`   Raw supply:  ${rawSupply.toString()}`);
        console.log(`   Decimals:    ${decimals}`);
        console.log(`   Total:       ${humanSupply.toLocaleString()} tokens\n`);
    }
    catch (e) {
        console.error("❌ Supply Error:", e.message);
    }
});
// ─── status ──────────────────────────────────────────────────────────────────
commonOpts(program
    .command("status")
    .description("Display full stablecoin state.")
    .requiredOption("-m, --mint <pubkey>", "Mint address")).action(async (options) => {
    try {
        const { sdk, connection } = setupEnv(options);
        const mintPk = new web3_js_1.PublicKey(options.mint);
        const state = await sdk.getState(mintPk);
        const mintInfo = await (0, spl_token_1.getMint)(connection, mintPk, "confirmed", spl_token_1.TOKEN_2022_PROGRAM_ID);
        console.log(`\n🏦 Stablecoin Status`);
        console.log(`${"─".repeat(50)}`);
        console.log(`  Mint:             ${options.mint}`);
        console.log(`  Supply:           ${(Number(mintInfo.supply) / Math.pow(10, mintInfo.decimals)).toLocaleString()} tokens`);
        console.log(`  Decimals:         ${mintInfo.decimals}`);
        console.log(`  Status:           ${state.isPaused ? "🔴 PAUSED" : "🟢 Active"}`);
        console.log(`${"─".repeat(50)}`);
        console.log(`  Master Authority: ${state.masterAuthority.toBase58()}`);
        console.log(`  Burner:           ${state.burner.toBase58()}`);
        console.log(`  Pauser:           ${state.pauser.toBase58()}`);
        console.log(`  Blacklister:      ${state.blacklister.toBase58()}`);
        console.log(`${"─".repeat(50)}`);
        console.log(`  Minters (${state.minters.length}):`);
        state.minters.forEach((m, i) => {
            console.log(`    [${i}] ${m.toBase58()}`);
        });
        console.log();
    }
    catch (e) {
        console.error("❌ Status Error:", e.message);
    }
});
// ─── minters ─────────────────────────────────────────────────────────────────
const mintersCmd = program
    .command("minters")
    .description("Manage minters for a stablecoin.");
commonOpts(mintersCmd
    .command("list")
    .description("List all authorized minters.")
    .requiredOption("-m, --mint <pubkey>", "Mint address")).action(async (options) => {
    try {
        const { sdk } = setupEnv(options);
        const state = await sdk.getState(new web3_js_1.PublicKey(options.mint));
        console.log(`\n👥 Authorized Minters (${state.minters.length}):`);
        state.minters.forEach((m, i) => {
            console.log(`  [${i}] ${m.toBase58()}`);
        });
        console.log();
    }
    catch (e) {
        console.error("❌ Minters Error:", e.message);
    }
});
commonOpts(mintersCmd
    .command("add")
    .description("Add a new minter.")
    .requiredOption("-m, --mint <pubkey>", "Mint address")
    .requiredOption("--minter <pubkey>", "Public key of new minter to add")).action(async (options) => {
    try {
        const { sdk, keypair } = setupEnv(options);
        const mintPk = new web3_js_1.PublicKey(options.mint);
        const newMinter = new web3_js_1.PublicKey(options.minter);
        const state = await sdk.getState(mintPk);
        const currentMinters = state.minters;
        if (currentMinters.some((m) => m.equals(newMinter))) {
            console.log("⚠️  That address is already a minter.");
            return;
        }
        const updatedMinters = [...currentMinters, newMinter];
        const sig = await sdk.program.methods
            .transferAuthority(null, updatedMinters, null, null, null)
            .accounts({ mint: mintPk })
            .signers([keypair])
            .rpc();
        console.log(`✅ Minter added: ${newMinter.toBase58()}`);
        console.log(`🔗 Tx: ${sig}`);
    }
    catch (e) {
        console.error("❌ Add Minter Error:", e.message);
    }
});
commonOpts(mintersCmd
    .command("remove")
    .description("Remove a minter.")
    .requiredOption("-m, --mint <pubkey>", "Mint address")
    .requiredOption("--minter <pubkey>", "Public key of minter to remove")).action(async (options) => {
    try {
        const { sdk, keypair } = setupEnv(options);
        const mintPk = new web3_js_1.PublicKey(options.mint);
        const removeMinter = new web3_js_1.PublicKey(options.minter);
        const state = await sdk.getState(mintPk);
        const updatedMinters = state.minters.filter((m) => !m.equals(removeMinter));
        if (updatedMinters.length === state.minters.length) {
            console.log("⚠️  That address is not a minter.");
            return;
        }
        const sig = await sdk.program.methods
            .transferAuthority(null, updatedMinters, null, null, null)
            .accounts({ mint: mintPk })
            .signers([keypair])
            .rpc();
        console.log(`✅ Minter removed: ${removeMinter.toBase58()}`);
        console.log(`🔗 Tx: ${sig}`);
    }
    catch (e) {
        console.error("❌ Remove Minter Error:", e.message);
    }
});
// ─── holders (read-only, uses RPC getProgramAccounts) ────────────────────────
commonOpts(program
    .command("holders")
    .description("List all token holders.")
    .requiredOption("-m, --mint <pubkey>", "Mint address")
    .option("--min-balance <amount>", "Minimum balance filter", "0")).action(async (options) => {
    try {
        const { connection } = setupEnv(options);
        console.log(`\n🔍 Fetching token holders for ${options.mint}...`);
        const accounts = await connection.getParsedProgramAccounts(spl_token_1.TOKEN_2022_PROGRAM_ID, {
            filters: [
                { dataSize: 165 },
                { memcmp: { offset: 0, bytes: options.mint } },
            ]
        });
        const minBalance = Number(options.minBalance);
        console.log(`\n👥 Token Holders:`);
        let count = 0;
        for (const acct of accounts) {
            const data = acct.account.data.parsed?.info;
            if (!data)
                continue;
            const balance = Number(data.tokenAmount?.amount || 0);
            if (balance >= minBalance) {
                count++;
                console.log(`  [${count}] ${data.owner}  —  ${(balance / Math.pow(10, data.tokenAmount?.decimals || 6)).toLocaleString()} tokens`);
            }
        }
        if (count === 0)
            console.log("  No holders found.");
        console.log();
    }
    catch (e) {
        console.error("❌ Holders Error:", e.message);
    }
});
// ─── dashboard ───────────────────────────────────────────────────────────────
commonOpts(program
    .command("dashboard")
    .description("Launch the interactive TUI dashboard.")).action(async (options) => {
    try {
        const { sdk, keypair } = setupEnv(options);
        await (0, dashboard_1.startDashboard)(sdk, keypair);
    }
    catch (e) {
        console.error("❌ Dashboard Error:", e.message);
    }
});
program.parse(process.argv);
