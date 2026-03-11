import inquirer from 'inquirer';
import { 
  SolanaStablecoin, 
  mintTokens, 
  addToBlacklist,
  seizeTokens,
} from "@solana-stablecoin-standard/sdk";
import { Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { 
  createAssociatedTokenAccountInstruction, 
  getAssociatedTokenAddress, 
  TOKEN_2022_PROGRAM_ID 
} from "@solana/spl-token";

function cleanKey(input: string): string {
  return input.replace(/[^1-9A-HJ-NP-Za-km-z]/g, "");
}

async function ensureAta(sdk: SolanaStablecoin, payer: Keypair, mint: PublicKey, target: PublicKey): Promise<PublicKey> {
  const ata = await getAssociatedTokenAddress(mint, target, false, TOKEN_2022_PROGRAM_ID);
  const info = await sdk.program.provider.connection.getAccountInfo(ata);
  if (!info) {
    console.log(`  ⚙️  ATA not found, creating it automatically...`);
    const tx = new Transaction().add(
      createAssociatedTokenAccountInstruction(payer.publicKey, ata, target, mint, TOKEN_2022_PROGRAM_ID)
    );
    await sendAndConfirmTransaction(sdk.program.provider.connection, tx, [payer], { commitment: "confirmed" });
    console.log(`  ✅ ATA created: ${ata.toBase58()}`);
  }
  return ata;
}

export async function startDashboard(sdk: SolanaStablecoin, keypair: Keypair) {
  console.log("=========================================");
  console.log("🏦 Solana Stablecoin Standard Dashboard");
  console.log("=========================================\n");

  let exit = false;

  while (!exit) {
    const { action } = await inquirer.prompt([
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
        const answers = await inquirer.prompt([
          { name: 'mint', message: 'Enter Mint PublicKey:' },
          { name: 'target', message: 'Enter Recipient Wallet PublicKey (owner, not ATA):' },
          { name: 'amount', message: 'Enter Amount to mint (smallest unit, e.g. 1000000 = 1 token):' }
        ]);
        const mint = new PublicKey(cleanKey(answers.mint));
        const ownerPk = new PublicKey(cleanKey(answers.target));
        console.log(`\n💸 Minting ${answers.amount} tokens...`);
        const ata = await ensureAta(sdk, keypair, mint, ownerPk);
        const sig = await mintTokens(sdk, keypair, mint, ata, Number(answers.amount));
        console.log(`✅ Success! Tx: ${sig}\n`);

      } else if (action === 'Add to Blacklist') {
        const answers = await inquirer.prompt([
          { name: 'mint', message: 'Enter Mint PublicKey:' },
          { name: 'target', message: 'Enter Target ATA PublicKey to blacklist:' }
        ]);
        const mint = new PublicKey(cleanKey(answers.mint));
        const targetAta = new PublicKey(cleanKey(answers.target));
        console.log(`\n🛑 Blacklisting ${targetAta.toBase58()}...`);
        const sig = await addToBlacklist(sdk, keypair, mint, targetAta);
        console.log(`✅ Account Blacklisted! Tx: ${sig}\n`);

      } else if (action === 'Seize Tokens') {
        const answers = await inquirer.prompt([
          { name: 'mint', message: 'Enter Mint PublicKey:' },
          { name: 'target', message: 'Enter Target ATA PublicKey to seize from:' },
          { name: 'amount', message: 'Enter Amount to seize (smallest unit):' }
        ]);
        const mint = new PublicKey(cleanKey(answers.mint));
        const targetAta = new PublicKey(cleanKey(answers.target));
        console.log(`\n🔥 Seizing ${answers.amount} tokens...`);
        const sig = await seizeTokens(sdk, keypair, mint, targetAta, Number(answers.amount));
        console.log(`✅ Tokens Seized! Tx: ${sig}\n`);

      } else if (action === 'Exit Dashboard') {
        console.log("Exiting... Goodbye!");
        exit = true;
      }
    } catch (error: any) {
      console.error(`❌ Error during ${action}:`, error.message, "\n");
    }
  }
}
