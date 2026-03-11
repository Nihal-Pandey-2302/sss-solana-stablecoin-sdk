import express, { Request, Response } from 'express';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { SolanaStablecoin, mintTokens, Preset } from '@solana-stablecoin-standard/sdk';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Solana network connection setup
const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8899';
const connection = new Connection(RPC_URL, 'confirmed');

// Mock wallet for the backend to pay for transaction fees
let backendWallet: anchor.Wallet;
let sdk: SolanaStablecoin;
let minterKeypair: Keypair;

try {
  // Parse the authority keypair from the environment variable
  const secretKeyString = process.env.AUTHORITY_KEYPAIR || '[]';
  const secretKeyArray = JSON.parse(secretKeyString);
  minterKeypair = Keypair.fromSecretKey(new Uint8Array(secretKeyArray));
  backendWallet = new anchor.Wallet(minterKeypair);
  
  // Initialize the SDK
  sdk = new SolanaStablecoin(connection, backendWallet);
  console.log('✅ SDK Initialized with backend authority:', backendWallet.publicKey.toBase58());
} catch (e: any) {
  console.warn('⚠️ Warning: AUTHORITY_KEYPAIR not set or invalid. SDK operations requiring signatures will fail.');
}


/**
 * @route GET /health
 * @desc API Health Check
 */
app.get('/health', async (req: Request, res: Response) => {
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
  } catch (error: any) {
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
app.post('/api/mint', async (req: Request, res: Response): Promise<any> => {
  try {
    const { mint, destinationAta, amount } = req.body;

    if (!mint || !destinationAta || !amount) {
      return res.status(400).json({ error: 'Missing mint, destinationAta, or amount fields' });
    }

    if (!minterKeypair || !sdk) {
      return res.status(500).json({ error: 'Backend wallet not configured properly' });
    }

    const mintPubkey = new PublicKey(mint);
    const destPubkey = new PublicKey(destinationAta);
    const amountNum = Number(amount);

    console.log(`Processing mint request of ${amount} to ${destinationAta}...`);

    const txSignature = await mintTokens(
      sdk,
      minterKeypair,
      mintPubkey,
      destPubkey,
      amountNum
    );

    // Record the operation in PostgreSQL asynchronously
    pool.query(
      'INSERT INTO operations (type, signature, mint, target, amount, status) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING',
      ['MINT', txSignature, mint, destinationAta, amountNum, 'confirmed']
    ).catch(err => console.error('DB Insert Error:', err));

    return res.status(200).json({
      success: true,
      signature: txSignature,
      message: `Minted ${amount} tokens to ${destinationAta}`
    });

  } catch (error: any) {
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
