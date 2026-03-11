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
const express_1 = __importDefault(require("express"));
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
const web3_js_1 = require("@solana/web3.js");
const anchor = __importStar(require("@coral-xyz/anchor"));
const sdk_1 = require("@solana-stablecoin-standard/sdk");
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
app.use(express_1.default.json());
// Database connection
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
});
pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});
// Solana network connection setup
const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8899';
const connection = new web3_js_1.Connection(RPC_URL, 'confirmed');
// Mock wallet for the backend to pay for transaction fees
let backendWallet;
let sdk;
let minterKeypair;
try {
    // Parse the authority keypair from the environment variable
    const secretKeyString = process.env.AUTHORITY_KEYPAIR || '[]';
    const secretKeyArray = JSON.parse(secretKeyString);
    minterKeypair = web3_js_1.Keypair.fromSecretKey(new Uint8Array(secretKeyArray));
    backendWallet = new anchor.Wallet(minterKeypair);
    // Initialize the SDK
    sdk = new sdk_1.SolanaStablecoin(connection, backendWallet);
    console.log('✅ SDK Initialized with backend authority:', backendWallet.publicKey.toBase58());
}
catch (e) {
    console.warn('⚠️ Warning: AUTHORITY_KEYPAIR not set or invalid. SDK operations requiring signatures will fail.');
}
/**
 * @route GET /health
 * @desc API Health Check
 */
app.get('/health', async (req, res) => {
    try {
        const dbRes = await pool.query('SELECT NOW()');
        // Quick connection check to Solana
        const slot = await connection.getSlot();
        res.status(200).json({
            status: 'ok',
            service: 'mint-service',
            database: dbRes.rowCount ? 'connected' : 'disconnected',
            solana_slot: slot,
            time: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(503).json({
            status: 'error',
            message: error.message
        });
    }
});
/**
 * @route POST /api/mint
 * @desc Mints stablecoin to a specific ATA. Requires authorized backend minter signature.
 */
app.post('/api/mint', async (req, res) => {
    try {
        const { mint, destinationAta, amount } = req.body;
        if (!mint || !destinationAta || !amount) {
            return res.status(400).json({ error: 'Missing mint, destinationAta, or amount fields' });
        }
        if (!minterKeypair || !sdk) {
            return res.status(500).json({ error: 'Backend wallet not configured properly' });
        }
        const mintPubkey = new web3_js_1.PublicKey(mint);
        const destPubkey = new web3_js_1.PublicKey(destinationAta);
        const amountNum = Number(amount);
        console.log(`Processing mint request of ${amount} to ${destinationAta}...`);
        const txSignature = await (0, sdk_1.mintTokens)(sdk, minterKeypair, mintPubkey, destPubkey, amountNum);
        // Record the operation in PostgreSQL asynchronously
        pool.query('INSERT INTO operations (type, signature, mint, target, amount, status) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING', ['MINT', txSignature, mint, destinationAta, amountNum, 'confirmed']).catch(err => console.error('DB Insert Error:', err));
        return res.status(200).json({
            success: true,
            signature: txSignature,
            message: `Minted ${amount} tokens to ${destinationAta}`
        });
    }
    catch (error) {
        console.error('Mint Error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
app.listen(port, () => {
    console.log(`🚀 Mint Service running on port ${port}`);
});
