import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SssToken } from "../target/types/sss_token";
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
  createInitializeMetadataPointerInstruction,
  TYPE_SIZE,
  LENGTH_SIZE,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createSetAuthorityInstruction,
  AuthorityType,
} from "@solana/spl-token";
import { createInitializeInstruction, pack } from "@solana/spl-token-metadata";
import { expect } from "chai";

describe("Phase 2: SSS-1 Core", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const connection = provider.connection;
  const wallet = provider.wallet as anchor.Wallet;

  const program = anchor.workspace.SssToken as Program<SssToken>;

  let mintKeypair: Keypair;
  const decimals = 6;
  
  let statePda: PublicKey;
  let stateBump: number;

  const master = Keypair.generate();
  const minter1 = Keypair.generate();
  const minter2 = Keypair.generate();
  const burner = Keypair.generate();
  const pauser = Keypair.generate();
  const blacklister = Keypair.generate();

  const user = Keypair.generate();
  let userAta: PublicKey;

  before(async () => {
    mintKeypair = Keypair.generate();
    // Fund test wallets
    await Promise.all([
      connection.requestAirdrop(master.publicKey, 10 * 1e9),
      connection.requestAirdrop(minter1.publicKey, 10 * 1e9),
      connection.requestAirdrop(burner.publicKey, 10 * 1e9),
      connection.requestAirdrop(pauser.publicKey, 10 * 1e9),
      connection.requestAirdrop(user.publicKey, 10 * 1e9),
    ]);
    
    // Wait for airdrops
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Get State PDA
    [statePda, stateBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("state"), mintKeypair.publicKey.toBuffer()],
      program.programId
    );
  });

  it("Initializes a new SSS-1 Token and links State PDA", async () => {
    // 1. Create Token-2022 Mint with PDA as mintAuthority
    const mintLen = getMintLen([ExtensionType.MetadataPointer]);
    const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack({
      updateAuthority: statePda,
      mint: mintKeypair.publicKey,
      name: "Phase 2 Stable",
      symbol: "P2S",
      uri: "",
      additionalMetadata: [],
    }).length;

    const lamports = await connection.getMinimumBalanceForRentExemption(
      mintLen + metadataLen
    );

    const tx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: mintLen,
        lamports,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeMetadataPointerInstruction(
        mintKeypair.publicKey,
        wallet.publicKey,
        mintKeypair.publicKey,
        TOKEN_2022_PROGRAM_ID
      ),
      createInitializeMintInstruction(
        mintKeypair.publicKey,
        decimals,
        wallet.publicKey,
        statePda, // Freeze authority is also PDA
        TOKEN_2022_PROGRAM_ID
      ),
      createInitializeInstruction({
        programId: TOKEN_2022_PROGRAM_ID,
        metadata: mintKeypair.publicKey,
        updateAuthority: statePda,
        mint: mintKeypair.publicKey,
        mintAuthority: wallet.publicKey,
        name: "Phase 2 Stable",
        symbol: "P2S",
        uri: "",
      }),
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

    // 2. Initialize SSS-1 Program State
    await program.methods
      .initialize(
        [minter1.publicKey, minter2.publicKey], // minters
        burner.publicKey,
        pauser.publicKey,
        blacklister.publicKey
      )
      .accounts({
        masterAuthority: master.publicKey,
        mint: mintKeypair.publicKey,
      })
      .signers([master])
      .rpc();

    const stateAccount = await program.account.stablecoinState.fetch(statePda);
    expect(stateAccount.masterAuthority.toBase58()).to.eq(master.publicKey.toBase58());
    expect(stateAccount.minters[0].toBase58()).to.eq(minter1.publicKey.toBase58());
    expect(stateAccount.isPaused).to.be.false;
  });

  it("Minter can mint tokens", async () => {
    userAta = getAssociatedTokenAddressSync(
      mintKeypair.publicKey,
      user.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    const createAtaTx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        userAta,
        user.publicKey,
        mintKeypair.publicKey,
        TOKEN_2022_PROGRAM_ID
      )
    );
    await sendAndConfirmTransaction(connection, createAtaTx, [wallet.payer]);

    await program.methods
      .mint(new anchor.BN(1000 * 10 ** decimals))
      .accounts({
        minter: minter1.publicKey,
        mint: mintKeypair.publicKey,
        recipient: userAta,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([minter1])
      .rpc();

    const ataBalance = await connection.getTokenAccountBalance(userAta);
    expect(ataBalance.value.uiAmount).to.eq(1000);
  });

  it("Unauthorized user cannot mint", async () => {
    try {
      await program.methods
        .mint(new anchor.BN(1000 * 10 ** decimals))
        .accounts({
          minter: user.publicKey,
          mint: mintKeypair.publicKey,
          recipient: userAta,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([user])
        .rpc();
      expect.fail("Should have thrown unauthorized error");
    } catch (err: any) {
      expect(err.message).to.include("UnauthorizedMinter");
    }
  });

  it("Pauser can pause the token", async () => {
    await program.methods
      .pause()
      .accounts({
        authority: pauser.publicKey,
        state: statePda,
        mint: mintKeypair.publicKey,
      } as any)
      .signers([pauser])
      .rpc();

    const stateAccount = await program.account.stablecoinState.fetch(statePda);
    expect(stateAccount.isPaused).to.be.true;
  });

  it("Minting fails when paused", async () => {
    try {
      await program.methods
        .mint(new anchor.BN(1000 * 10 ** decimals))
        .accounts({
          minter: minter1.publicKey,
          mint: mintKeypair.publicKey,
          recipient: userAta,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([minter1])
        .rpc();
      expect.fail("Should have thrown paused error");
    } catch (err: any) {
      expect(err.message).to.include("TokenPaused");
    }
  });

  it("Pauser can unpause the token", async () => {
    await program.methods
      .unpause()
      .accounts({
        authority: pauser.publicKey,
        state: statePda,
        mint: mintKeypair.publicKey,
      } as any)
      .signers([pauser])
      .rpc();

    const stateAccount = await program.account.stablecoinState.fetch(statePda);
    expect(stateAccount.isPaused).to.be.false;
  });

  it("Pauser can freeze an account", async () => {
    await program.methods
      .freezeAccount()
      .accounts({
        authority: pauser.publicKey,
        mint: mintKeypair.publicKey,
        targetAccount: userAta,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([pauser])
      .rpc();

    // Verify account is frozen via TS SDK maybe later
  });

  it("Pauser can thaw an account", async () => {
    await program.methods
      .thawAccount()
      .accounts({
        authority: pauser.publicKey,
        mint: mintKeypair.publicKey,
        targetAccount: userAta,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([pauser])
      .rpc();
  });

  it("User can burn their own tokens with Burner's authorization", async () => {
    // Actually the burn instruction requires the Burner to sign as the authority of `from`.
    // Let's test burning burner's own tokens first.
    const burnerAta = getAssociatedTokenAddressSync(
      mintKeypair.publicKey,
      burner.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    const createAtaTx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        burnerAta,
        burner.publicKey,
        mintKeypair.publicKey,
        TOKEN_2022_PROGRAM_ID
      )
    );
    await sendAndConfirmTransaction(connection, createAtaTx, [wallet.payer]);

    // Mint some to burner
    await program.methods
      .mint(new anchor.BN(500 * 10 ** decimals))
      .accounts({
        minter: minter1.publicKey,
        mint: mintKeypair.publicKey,
        recipient: burnerAta,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([minter1])
      .rpc();

    // Burn
    await program.methods
      .burn(new anchor.BN(200 * 10 ** decimals))
      .accounts({
        burner: burner.publicKey,
        mint: mintKeypair.publicKey,
        from: burnerAta,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([burner])
      .rpc();

    const ataBalance = await connection.getTokenAccountBalance(burnerAta);
    expect(ataBalance.value.uiAmount).to.eq(300);
  });

  it("Master can update roles", async () => {
    const newMaster = Keypair.generate();
    await program.methods
      .transferAuthority(
        newMaster.publicKey,
        null, // keep minters
        null, // keep burner
        null, // keep pauser
        null  // keep blacklister
      )
      .accounts({
        mint: mintKeypair.publicKey,
      })
      .signers([master])
      .rpc();

    const stateAccount = await program.account.stablecoinState.fetch(statePda);
    expect(stateAccount.masterAuthority.toBase58()).to.eq(newMaster.publicKey.toBase58());
  });
});
