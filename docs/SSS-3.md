# SSS-3: Private Stablecoin Standard

> **Status: Proof of Concept** — Confidential transfer tooling is available but experimental. SSS-3 is documented here as a forward-looking standard for privacy-preserving regulated stablecoins.

## Overview

SSS-3 extends SSS-2 with **Token-2022 Confidential Transfers** — a ZK-proof extension that hides transfer amounts and balances from public view while preserving audit capabilities for authorized parties.

```
SSS-1 (Minimal)
    ↓ + Blacklist + TransferHook + PermanentDelegate
SSS-2 (Compliant)
    ↓ + ConfidentialTransferMint + Allowlists
SSS-3 (Private)
```

## Use Cases

| Use Case | Why SSS-3 |
|---|---|
| Central Bank Digital Currency (CBDC) | Citizen balances must be private |
| Institutional settlement | Trade sizes are commercially sensitive |
| Privacy-first stablecoins | Regulatory compliance without full transparency |
| BRL/EUR digital money | National currencies require balance confidentiality |

## Token-2022 Extensions Used

| Extension | Purpose |
|---|---|
| `ConfidentialTransferMint` | Enables shielded balances using ElGamal encryption |
| `TransferHook` | Compliance enforcement (inherited from SSS-2) |
| `PermanentDelegate` | Asset recovery without decryption (inherited from SSS-2) |
| `ConfidentialTransferFeeConfig` | Optional: confidential fee collection |

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     SSS-3 Token Mint                      │
│  ConfidentialTransferMint + TransferHook + PermanentDelegate│
└───────────────────────┬────────────────────────────────── ┘
                        │
        ┌───────────────┼────────────────┐
        ▼               ▼                ▼
  ┌──────────┐   ┌────────────┐    ┌──────────────┐
  │  Shielded│   │ TransferHook│   │ Audit Service│
  │  Balance │   │ (Blacklist) │   │ (Decrypt w/  │
  │(ElGamal) │   │  Check PDA  │   │  Auditor Key)│
  └──────────┘   └────────────┘    └──────────────┘
```

### Key Cryptographic Components

**ElGamal Encryption** — Each token account holds an encrypted balance:
```
encrypted_balance = ElGamal.encrypt(amount, recipient_public_key)
```
The encrypted balance is publicly visible on-chain; the amount is not.

**ZK Range Proofs** — Every transfer must include a zero-knowledge proof that:
- The sender has sufficient balance
- The transfer amount is non-negative
- The resulting balance is non-negative

**Auditor Key** — A designated auditor public key (regulator or compliance officer) can decrypt all transaction amounts. This enables regulatory compliance without public disclosure.

## Implementation

### Initialization Parameters
```typescript
import { SSS3Preset } from "@solana-stablecoin-standard/sdk";

const token = await SolanaStablecoin.create(connection, {
  preset: Presets.SSS_3,
  name: "Private Real",
  symbol: "pBRL",
  decimals: 6,
  authority: adminKeypair,
  // SSS-3 specific
  auditorElGamalPubkey: auditorElGamalKey, // regulatorkey for decryption
  autoApproveNewAccounts: false,            // require explicit approval
});
```

### Account Approval Flow (SSS-3)
Unlike SSS-1/2 where any ATA can receive tokens, SSS-3 requires **account approval** before a wallet can hold shielded balances:

```
1. User requests account approval
2. Authority reviews off-chain KYC (sanctions screening)  
3. Authority calls `approve_account()` on-chain
4. User `deposit()` converts public tokens → shielded balance
5. User `transfer_with_fee()` to another approved account
6. User `withdraw()` converts shielded → public (for redemption)
```

### TypeScript SDK
```typescript
import { initSSS3, approveAccount, depositConfidential, 
         withdrawConfidential, transferConfidential } from "@sss/sdk/sss3";

// Initialize SSS-3 token with confidential transfer extension
const { mint, sig } = await initSSS3(connection, authority, {
  decimals: 6,
  auditorElGamalPubkey: auditorPubkey,
  autoApproveNewAccounts: false,
});

// Approve a user account for confidential transfers
await approveAccount(sdk, authority, mint, userAta);

// Deposit: convert public tokens to shielded balance
await depositConfidential(sdk, user, mint, userAta, amount);

// Transfer: shielded amount between approved accounts (ZK proof auto-generated)
await transferConfidential(sdk, sender, mint, senderAta, receiverAta, amount);

// Withdraw: convert shielded balance to public tokens (for redemption)
await withdrawConfidential(sdk, user, mint, userAta, amount);
```

## Comparison

| Feature | SSS-2 | SSS-3 |
|---|---|---|
| Balances | Public | Encrypted |
| Transfer amounts | Public | ZK-proven |
| Auditor access | Full public | Decrypt-only |
| Account approval required | No | Yes |
| Blacklist enforcement | Yes | Yes |
| Asset seizure | Yes | Yes (w/ authority key) |
| UX complexity | Low | Medium |
| Gas overhead | +0.001 SOL/tx | +0.005 SOL/tx (ZK proof) |

## Security Considerations

1. **Auditor Key Management** — The auditor ElGamal key must be stored securely. Loss means the issuer cannot prove compliance to regulators.

2. **ZK Proof Generation** — Client-side proof generation requires trust in the wallet implementation. Hardware wallets with ZK support are recommended.

3. **Seizure Without Decryption** — The Permanent Delegate can seize `encrypted_balance` (the entire shielded balance) without knowing the exact amount. The amount is revealed post-seizure via auditor decryption.

4. **Front-Running Protection** — Shielded balances prevent MEV bots from seeing pending transfer amounts.

## Regulatory Considerations

SSS-3 is designed for jurisdictions that permit privacy-preserving digital currencies with auditor access (similar to the EU's proposed digital euro model). Key points:

- **GDPR-compatible** — Only the auditor can decrypt amounts; amounts are not publicly logged
- **GENIUS Act alignment** — Auditor access enables regulator compliance
- **FATF Travel Rule** — Counterparty information can be transmitted off-chain with the shielded transfer

## Current Limitations (March 2026)

- Ledger hardware wallet support for ZK proof generation is not yet available
- Client-side ZK proof generation adds ~200-500ms latency per transfer  
- `solana-zk-token-sdk` is still in limited availability on Mainnet
- No block explorer support for rendering shielded amounts

## Proof of Concept

See [`scripts/sss3_poc.ts`](../scripts/sss3_poc.ts) for a working Devnet demonstration of:
- Initializing a mint with `ConfidentialTransferMint` extension
- Approving a test account
- Depositing tokens to shielded balance

```bash
npx ts-node scripts/sss3_poc.ts
```

## References

- [Token-2022: Confidential Transfers](https://spl.solana.com/confidential-token/quickstart)
- [solana-zk-token-sdk](https://github.com/solana-labs/solana-program-library/tree/master/token/js)
- [ElGamal Encryption on Solana](https://docs.rs/solana-zk-token-sdk/latest/solana_zk_token_sdk/)
- [EU Digital Euro Privacy Model](https://www.ecb.europa.eu/paym/digital_euro/html/index.en.html)
