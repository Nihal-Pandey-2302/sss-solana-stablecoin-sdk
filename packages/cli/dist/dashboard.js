"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startDashboard = startDashboard;
const inquirer_1 = __importDefault(require("inquirer"));
const sdk_1 = require("@solana-stablecoin-standard/sdk");
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
function cleanKey(input) {
    return input.replace(/[^1-9A-HJ-NP-Za-km-z]/g, "");
}
async function ensureAta(sdk, payer, mint, target) {
    const ata = await (0, spl_token_1.getAssociatedTokenAddress)(mint, target, false, spl_token_1.TOKEN_2022_PROGRAM_ID);
    const info = await sdk.program.provider.connection.getAccountInfo(ata);
    if (!info) {
        console.log(`  ⚙️  ATA not found, creating it automatically...`);
        const tx = new web3_js_1.Transaction().add((0, spl_token_1.createAssociatedTokenAccountInstruction)(payer.publicKey, ata, target, mint, spl_token_1.TOKEN_2022_PROGRAM_ID));
        await (0, web3_js_1.sendAndConfirmTransaction)(sdk.program.provider.connection, tx, [payer], { commitment: "confirmed" });
        console.log(`  ✅ ATA created: ${ata.toBase58()}`);
    }
    return ata;
}
async function startDashboard(sdk, keypair) {
    console.log("=========================================");
    console.log("🏦 Solana Stablecoin Standard Dashboard");
    console.log("=========================================\n");
    let exit = false;
    while (!exit) {
        const { action } = await inquirer_1.default.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'What would you like to do?',
                choices: [
                    'Mint Tokens',
                    'Add to Blacklist',
                    'Seize Tokens',
                    'Exit Dashboard'
                ]
            }
        ]);
        try {
            if (action === 'Mint Tokens') {
                const answers = await inquirer_1.default.prompt([
                    { name: 'mint', message: 'Enter Mint PublicKey:' },
                    { name: 'target', message: 'Enter Recipient Wallet PublicKey (owner, not ATA):' },
                    { name: 'amount', message: 'Enter Amount to mint (smallest unit, e.g. 1000000 = 1 token):' }
                ]);
                const mint = new web3_js_1.PublicKey(cleanKey(answers.mint));
                const ownerPk = new web3_js_1.PublicKey(cleanKey(answers.target));
                console.log(`\n💸 Minting ${answers.amount} tokens...`);
                const ata = await ensureAta(sdk, keypair, mint, ownerPk);
                const sig = await (0, sdk_1.mintTokens)(sdk, keypair, mint, ata, Number(answers.amount));
                console.log(`✅ Success! Tx: ${sig}\n`);
            }
            else if (action === 'Add to Blacklist') {
                const answers = await inquirer_1.default.prompt([
                    { name: 'mint', message: 'Enter Mint PublicKey:' },
                    { name: 'target', message: 'Enter Target ATA PublicKey to blacklist:' }
                ]);
                const mint = new web3_js_1.PublicKey(cleanKey(answers.mint));
                const targetAta = new web3_js_1.PublicKey(cleanKey(answers.target));
                console.log(`\n🛑 Blacklisting ${targetAta.toBase58()}...`);
                const sig = await (0, sdk_1.addToBlacklist)(sdk, keypair, mint, targetAta);
                console.log(`✅ Account Blacklisted! Tx: ${sig}\n`);
            }
            else if (action === 'Seize Tokens') {
                const answers = await inquirer_1.default.prompt([
                    { name: 'mint', message: 'Enter Mint PublicKey:' },
                    { name: 'target', message: 'Enter Target ATA PublicKey to seize from:' },
                    { name: 'amount', message: 'Enter Amount to seize (smallest unit):' }
                ]);
                const mint = new web3_js_1.PublicKey(cleanKey(answers.mint));
                const targetAta = new web3_js_1.PublicKey(cleanKey(answers.target));
                console.log(`\n🔥 Seizing ${answers.amount} tokens...`);
                const sig = await (0, sdk_1.seizeTokens)(sdk, keypair, mint, targetAta, Number(answers.amount));
                console.log(`✅ Tokens Seized! Tx: ${sig}\n`);
            }
            else if (action === 'Exit Dashboard') {
                console.log("Exiting... Goodbye!");
                exit = true;
            }
        }
        catch (error) {
            console.error(`❌ Error during ${action}:`, error.message, "\n");
        }
    }
}
