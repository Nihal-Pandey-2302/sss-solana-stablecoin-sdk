import {
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  getMintLen,
  createInitializeTransferHookInstruction,
  createInitializePermanentDelegateInstruction,
  createInitializeMintInstruction,
  createSetAuthorityInstruction,
  AuthorityType,
} from "@solana/spl-token";
import { SolanaStablecoin, Preset } from "./index";

export interface DefineStablecoinParams {
  decimals: number;
  preset: Preset;
  masterAuthority: PublicKey;
  minters: PublicKey[];
  burnerPlaceholder?: PublicKey;
  pauserPlaceholder?: PublicKey;
  blacklisterPlaceholder?: PublicKey;
}

export async function defineStablecoin(
  sdk: SolanaStablecoin,
  payer: Keypair,
  mintKeypair: Keypair,
  params: DefineStablecoinParams
): Promise<string> {
  const { decimals, preset, masterAuthority, minters } = params;
  const burner = params.burnerPlaceholder || masterAuthority;
  const pauser = params.pauserPlaceholder || masterAuthority;
  const blacklister = params.blacklisterPlaceholder || masterAuthority;

  const statePda = sdk.getStatePda(mintKeypair.publicKey);
  const extensions = SolanaStablecoin.getExtensions(preset);
  const mintLen = getMintLen(extensions);
  const lamports = await sdk.connection.getMinimumBalanceForRentExemption(mintLen);

  const tx = new Transaction();

  // 1. Allocate space
  tx.add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      space: mintLen,
      lamports,
      programId: TOKEN_2022_PROGRAM_ID,
    })
  );

  // 2. Initialize Extensions based on preset
  if (preset === Preset.SSS2) {
    tx.add(
      createInitializeTransferHookInstruction(
        mintKeypair.publicKey,
        statePda, // transfer hook authority
        sdk.hookProgram.programId,
        TOKEN_2022_PROGRAM_ID
      ),
      createInitializePermanentDelegateInstruction(
        mintKeypair.publicKey,
        statePda, // permanent delegate
        TOKEN_2022_PROGRAM_ID
      )
    );
  }

  // 3. Initialize Mint Core & Set Master Authority
  tx.add(
    createInitializeMintInstruction(
      mintKeypair.publicKey,
      decimals,
      payer.publicKey, // temp mint authority
      statePda, // freeze authority
      TOKEN_2022_PROGRAM_ID
    ),
    createSetAuthorityInstruction(
      mintKeypair.publicKey,
      payer.publicKey, // current mint authority
      AuthorityType.MintTokens,
      statePda, // new mint authority (State PDA)
      [],
      TOKEN_2022_PROGRAM_ID
    )
  );

  await sendAndConfirmTransaction(sdk.connection, tx, [payer, mintKeypair]);

  // 4. Initialize SSS Token State and ExtraAccountMetas (if SSS2)
  const initSssTx = await sdk.program.methods
    .initialize(minters, burner, pauser, blacklister)
    .accounts({
      masterAuthority,
      mint: mintKeypair.publicKey,
    })
    .signers([payer])
    .rpc();

  if (preset === Preset.SSS2) {
    const [extraAccountMetaListPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("extra-account-metas"), mintKeypair.publicKey.toBuffer()],
      sdk.hookProgram.programId
    );

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
