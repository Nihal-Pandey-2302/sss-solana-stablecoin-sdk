import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SssToken } from "../target/types/sss_token";
import { TransferHook } from "../target/types/transfer_hook";
import {
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  PublicKey,
} from "@solana/web3.js";
import {
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  createInitializeMintInstruction,
  getMintLen,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createSetAuthorityInstruction,
  AuthorityType,
  createInitializeTransferHookInstruction,
  createInitializePermanentDelegateInstruction,
} from "@solana/spl-token";
import { expect } from "chai";

describe("Phase 3: SSS-2 Transfer Hook (Blacklist & Seize)", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const connection = provider.connection;
  const wallet = provider.wallet as anchor.Wallet;

  const program = anchor.workspace.SssToken as Program<SssToken>;
  const hookProgram = anchor.workspace.TransferHook as Program<TransferHook>;

  let mintKeypair: Keypair;
  const decimals = 6;
  
  let statePda: PublicKey;
  
  const master = Keypair.generate();
  const minter1 = Keypair.generate();
  const blacklister = Keypair.generate();

  const userA = Keypair.generate();
  const userB = Keypair.generate();
  let userA_Ata: PublicKey;
  let userB_Ata: PublicKey;

  before(async () => {
    mintKeypair = Keypair.generate();
    // Fund test wallets
    await Promise.all([
      connection.requestAirdrop(master.publicKey, 10 * 1e9),
      connection.requestAirdrop(blacklister.publicKey, 10 * 1e9),
      connection.requestAirdrop(minter1.publicKey, 10 * 1e9),
      connection.requestAirdrop(userA.publicKey, 10 * 1e9),
      connection.requestAirdrop(userB.publicKey, 10 * 1e9),
    ]);
    
    // Find PDAs
    [statePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("state"), mintKeypair.publicKey.toBuffer()],
      program.programId
    );

    userA_Ata = getAssociatedTokenAddressSync(
      mintKeypair.publicKey,
      userA.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    userB_Ata = getAssociatedTokenAddressSync(
      mintKeypair.publicKey,
      userB.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    // Give wallets a moment for airdrop inclusion
    await new Promise((r) => setTimeout(r, 2000));
  });

  it("Initializes Token-2022 Mint with Transfer Hook & Permanent Delegate", async () => {
    // 1. Create Mint with TransferHook AND PermanentDelegate
    const extensions = [ExtensionType.TransferHook, ExtensionType.PermanentDelegate];
    const mintLen = getMintLen(extensions);

    const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);

    const tx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: mintLen,
        lamports,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeTransferHookInstruction(
        mintKeypair.publicKey,
        statePda, // transfer hook authority
        hookProgram.programId, // transfer hook program ID
        TOKEN_2022_PROGRAM_ID
      ),
      createInitializePermanentDelegateInstruction(
        mintKeypair.publicKey,
        statePda, // SSS-Token State PDA is the permanent delegate
        TOKEN_2022_PROGRAM_ID
      ),
      createInitializeMintInstruction(
        mintKeypair.publicKey,
        decimals,
        wallet.publicKey,
        statePda, 
        TOKEN_2022_PROGRAM_ID
      ),
      createSetAuthorityInstruction(
        mintKeypair.publicKey,
        wallet.publicKey,
        AuthorityType.MintTokens,
        statePda,
        [],
        TOKEN_2022_PROGRAM_ID
      )
    );

    await sendAndConfirmTransaction(connection, tx, [wallet.payer, mintKeypair]);

    // 2. Initialize SSS-1 State
    await program.methods
      .initialize(
        [minter1.publicKey], // minters
        master.publicKey, // burner placeholder
        master.publicKey, // pauser placeholder
        blacklister.publicKey // blacklister
      )
      .accounts({
        masterAuthority: master.publicKey,
        mint: mintKeypair.publicKey,
      })
      .signers([master])
      .rpc();
  });

  it("Initializes ExtraAccountMetaList in Transfer Hook", async () => {
    const [extraAccountMetaListPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("extra-account-metas"), mintKeypair.publicKey.toBuffer()],
      hookProgram.programId
    );

    await hookProgram.methods
      .initializeExtraAccountMetaList()
      .accounts({
        payer: wallet.publicKey,
        mint: mintKeypair.publicKey,
      })
      .rpc();
  });

  it("Creates ATAs and mints initial tokens to User A", async () => {
    const createAtasTx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        userA_Ata,
        userA.publicKey,
        mintKeypair.publicKey,
        TOKEN_2022_PROGRAM_ID
      ),
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        userB_Ata,
        userB.publicKey,
        mintKeypair.publicKey,
        TOKEN_2022_PROGRAM_ID
      )
    );
    await sendAndConfirmTransaction(connection, createAtasTx, [wallet.payer]);

    await program.methods
      .mint(new anchor.BN(1000 * 10 ** decimals))
      .accounts({
        minter: minter1.publicKey,
        mint: mintKeypair.publicKey,
        recipient: userA_Ata,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([minter1])
      .rpc();
  });

  it("Standard transfer works when not blacklisted", async () => {
    // We do a direct standard Token-2022 transfer
    // The Token-2022 program will automatically call our Transfer Hook via `Execute`
    const { createTransferCheckedWithTransferHookInstruction } = await import("@solana/spl-token");

    const transferAmount = 100 * 10 ** decimals;

    // We must manually append extra accounts for testing with transfer hook offline builder 
    // OR we use the helper instruction
    const transferIx = await createTransferCheckedWithTransferHookInstruction(
      connection,
      userA_Ata,
      mintKeypair.publicKey,
      userB_Ata,
      userA.publicKey,
      transferAmount,
      decimals,
      [],
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );

    const tx = new Transaction().add(transferIx);
    await sendAndConfirmTransaction(connection, tx, [userA]);

    const bBalance = await connection.getTokenAccountBalance(userB_Ata);
    expect(bBalance.value.uiAmount).to.eq(100);
  });

  it("Blacklists User A (Sender)", async () => {
    const [userABlacklistPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("blacklist"), mintKeypair.publicKey.toBuffer(), userA_Ata.toBuffer()],
      program.programId
    );

    await program.methods
      .addToBlacklist()
      .accounts({
        targetAccount: userA_Ata,
      })
      .signers([blacklister])
      .rpc();
  });

  it("Transfer is blocked when Sender (User A) is blacklisted", async () => {
     // Expected to fail
     const { createTransferCheckedWithTransferHookInstruction } = await import("@solana/spl-token");

     const transferAmount = 10 * 10 ** decimals;
     const transferIx = await createTransferCheckedWithTransferHookInstruction(
       connection,
       userA_Ata,
       mintKeypair.publicKey,
       userB_Ata,
       userA.publicKey,
       BigInt(transferAmount),
       decimals,
       [],
       "confirmed",
       TOKEN_2022_PROGRAM_ID
     );
 
     const tx = new Transaction().add(transferIx);
     try {
       await sendAndConfirmTransaction(connection, tx, [userA]);
       expect.fail("Transfer should have been blocked");
     } catch (err: any) {
        expect(err.message).to.include("Transfer blocked: Source account is blacklisted");
     }
  });

  it("Removes User A from Blacklist", async () => {
    const [userABlacklistPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("blacklist"), mintKeypair.publicKey.toBuffer(), userA_Ata.toBuffer()],
      program.programId
    );

    await program.methods
      .removeFromBlacklist()
      .accounts({
        targetAccount: userA_Ata,
      })
      .signers([blacklister])
      .rpc();
  });

  it("Transfer succeeds after User A is removed from Blacklist", async () => {
     const { createTransferCheckedWithTransferHookInstruction } = await import("@solana/spl-token");

     const transferAmount = 10 * 10 ** decimals;
     const transferIx = await createTransferCheckedWithTransferHookInstruction(
       connection,
       userA_Ata,
       mintKeypair.publicKey,
       userB_Ata,
       userA.publicKey,
       BigInt(transferAmount),
       decimals,
       [],
       "confirmed",
       TOKEN_2022_PROGRAM_ID
     );
 
     const tx = new Transaction().add(transferIx);
     await sendAndConfirmTransaction(connection, tx, [userA]);

     const bBalance = await connection.getTokenAccountBalance(userB_Ata);
     expect(bBalance.value.uiAmount).to.eq(110);
  });

  it("Master can seize tokens from User B", async () => {
    // Master seizes 10 tokens from User B
    const seizeAmount = new anchor.BN(10 * 10 ** decimals);

    await program.methods
      .seize(seizeAmount)
      .accounts({
        authority: master.publicKey,
        targetAccount: userB_Ata,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([master])
      .rpc();

    const bBalance = await connection.getTokenAccountBalance(userB_Ata);
    expect(bBalance.value.uiAmount).to.eq(100); // Previously 110, seized 10
  });

});
