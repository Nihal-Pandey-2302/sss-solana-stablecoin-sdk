"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
const web3_js_1 = require("@solana/web3.js");
const helius_sdk_1 = require("helius-sdk");
dotenv_1.default.config();
// Database setup
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://admin:password@localhost:5432/stablecoin_db',
});
// Helius configurations
const HELIUS_API_KEY = process.env.HELIUS_API_KEY || 'dummy_key';
const PROGRAM_ID = new web3_js_1.PublicKey(process.env.PROGRAM_ID || 'DyHpthHQhvcuywjyV4nBjpEZbM1PfP71wAn84nkVshUy');
const MINT = process.env.MINT_ADDRESS || '';
let helius;
try {
    helius = new helius_sdk_1.Helius(HELIUS_API_KEY);
    console.log('✅ Helius SDK Initialized via API Key');
}
catch (e) {
    console.warn('⚠️ Helius init failed - check HELIUS_API_KEY');
}
/**
 * Initializes DB Tables required by the indexer and api service
 */
async function initializeDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS operations (
                id SERIAL PRIMARY KEY,
                type VARCHAR(50) NOT NULL,
                signature VARCHAR(100) UNIQUE NOT NULL,
                mint VARCHAR(100) NOT NULL,
                target VARCHAR(100) NOT NULL,
                amount NUMERIC,
                status VARCHAR(20) NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS indexer_state (
                key VARCHAR(50) PRIMARY KEY,
                value VARCHAR(100) NOT NULL
            );
        `);
        console.log('✅ PostgreSQL Schema Initialized');
    }
    catch (e) {
        console.error('❌ DB Init error:', e.message);
        process.exit(1);
    }
}
/**
 * Fallback polling mechanism using standard Web3.js getSignaturesForAddress
 * Used if Helius webhooks are unconfigured.
 */
async function pollRecentTransactions() {
    console.log('Running background transaction sync...');
    const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8899';
    const connection = new web3_js_1.Connection(rpcUrl, 'confirmed');
    try {
        const signatures = await connection.getSignaturesForAddress(PROGRAM_ID, { limit: 10 });
        for (const sigInfo of signatures) {
            // Insert raw signatures as discovered operations (status: discovered)
            pool.query('INSERT INTO operations (type, signature, mint, target, amount, status) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING', ['DISCOVERED', sigInfo.signature, MINT || 'unknown', 'unknown', 0, sigInfo.err ? 'failed' : 'success']).catch(() => { });
        }
    }
    catch (e) {
        console.error('Polling Error:', e.message);
    }
}
async function start() {
    console.log('🚀 Starting Stablecoin Indexer...');
    await initializeDB();
    setInterval(() => {
        pollRecentTransactions();
    }, 15000);
}
start();
