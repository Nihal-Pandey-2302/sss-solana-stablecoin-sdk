# Compliance Guide

> Regulatory considerations, audit trail format, and compliance design decisions for the Solana Stablecoin Standard.

## Regulatory Framework

SSS-2 is designed for **regulated stablecoin issuers** that must:
- Respond to law enforcement requests for asset freezing/seizure
- Maintain an auditable record of all token operations
- Implement sanctions screening (OFAC, EU Consolidated List, FATF)
- Comply with the GENIUS Act (US) and MiCA (EU) frameworks

---

## How On-Chain Compliance Works

### 1. Blacklist (Account-Level Blocking)

The blacklist is implemented as individual **PDAs per token account** — not a central list. This design means:

- **No central point of failure** — each PDA is independent
- **Atomic enforcement** — the Transfer Hook reads the PDA in the same transaction
- **Zero latency** — blocked transfers revert instantly, before settlement

```
State: Blacklist PDA
  seeds = ["blacklist", mint, target_ata]
  data  = { is_blacklisted: bool }

When is_blacklisted = true:
  → Any transfer from target_ata: reverts with SenderBlacklisted
  → Any transfer to target_ata:   reverts with RecipientBlacklisted
```

**No bypass is possible** — the Transfer Hook is called by the Token-2022 runtime itself as a CPI, before any settlement occurs.

### 2. Asset Seizure (Permanent Delegate)

Token-2022's **Permanent Delegate** extension grants the `sss_token` state PDA unconditional authority over all token accounts associated with the mint. The `seize` instruction uses this to:

1. Verify target is blacklisted (safety check)
2. Call `token_interface::transfer_checked` with the PDA as the authority
3. Move tokens to the treasury — **no owner signature required**

```rust
// Seize instruction (simplified)
mint_to(CpiContext::new_with_signer(
    token_program,
    TransferChecked { from: target_ata, to: treasury_ata, authority: state_pda },
    &[state_pda_seeds],
), amount, decimals)?;
```

---

## GENIUS Act Alignment (US)

The **GENIUS Act** (Guiding and Establishing National Innovation for US Stablecoins) requires issuers to:

| GENIUS Act Requirement | SSS-2 Implementation |
|---|---|
| 1:1 reserve backing verification | Off-chain (auditor attestation) + on-chain supply via `getMint()` |
| Redemption within 1 business day | Burn instruction + off-chain fiat release flow |
| Sanctions compliance (OFAC) | `add_to_blacklist` → `seize` lifecycle |
| Regulatory access to freeze accounts | `freeze_account` + `seize` via Permanent Delegate |
| Audit trail | On-chain events + Helius indexer → Postgres |

---

## MiCA Alignment (EU)

The **Markets in Crypto-Assets Regulation** (MiCA) requires issuers to:

| MiCA Requirement | SSS-2 Implementation |
|---|---|
| Asset-Referenced Token (ART) compliance | SSS-2 + Oracle module (EUR/USD peg) |
| Transactions can be reversed by issuer | Transfer Hook blocks + Seize capability |
| White paper and public disclosure | README + all spec docs (SSS-1, SSS-2, SSS-3) |
| Technical security standards | Role-based AC + PDA-based state |

---

## Audit Trail Format

All events are emitted as Anchor program logs and indexed by the Helius webhook indexer into Postgres.

### On-Chain Event Logs

Every instruction emits a `msg!()` log that can be parsed from transaction metadata:

```
Program F7igqZa... log: "Minting 1000000 tokens to rgkteMW..."
Program F7igqZa... log: "Blacklisted: rgkteMWM..."
Program F7igqZa... log: "Seized 500000 tokens from rgkteMW... to treasury..."
```

### Off-Chain Audit Table Schema

```sql
CREATE TABLE audit_log (
    id             SERIAL PRIMARY KEY,
    event_type     VARCHAR(50),    -- 'mint', 'burn', 'blacklist_add', 'seize', etc.
    mint           VARCHAR(44),
    actor          VARCHAR(44),    -- who signed the tx
    target         VARCHAR(44),    -- affected ATA
    amount         BIGINT,
    reason         TEXT,           -- for blacklist: reason string
    tx_signature   VARCHAR(88),
    block          BIGINT,
    created_at     TIMESTAMP DEFAULT NOW()
);

-- Compliance events table (blacklist-specific)
CREATE TABLE compliance_events (
    id             SERIAL PRIMARY KEY,
    event_type     VARCHAR(20),    -- 'blacklist_add', 'blacklist_remove', 'seize'
    mint           VARCHAR(44),
    target_ata     VARCHAR(44),
    target_owner   VARCHAR(44),
    amount_seized  BIGINT,
    reason         TEXT,
    tx_signature   VARCHAR(88),
    authorized_by  VARCHAR(44),
    created_at     TIMESTAMP DEFAULT NOW()
);
```

### Audit Log Export

```bash
# Export last 30 days of compliance events
psql postgresql://postgres:password@localhost:5432/stablecoin \
  -c "\COPY (SELECT * FROM compliance_events WHERE created_at > NOW() - INTERVAL '30 days') TO 'audit_export.csv' CSV HEADER;"

# Via REST API
curl "http://localhost:3000/audit?mint=<MINT>&start=2026-01-01&end=2026-03-12&format=json"
```

---

## Sanctions Screening Integration Point

The backend `mint-service` is designed with a compliance hook in the minting flow:

```typescript
// mint-service/src/index.ts (integration point)
async function processMintRequest(recipient: string, amount: number) {
  // 1. Sanctions check (plug in your provider here)
  const screeningResult = await ofacScreening.check(recipient);
  if (screeningResult.isMatch) {
    await addToBlacklist(sdk, authority, mint, recipientAta);
    throw new Error(`Sanctions match: ${screeningResult.reason}`);
  }

  // 2. Execute mint
  return await mintTokens(sdk, minter, mint, recipientAta, amount);
}
```

Supported integration points:
- **Chainalysis** — KYT API for transaction risk scoring
- **Elliptic** — VASP screening
- **Comply Advantage** — Sanctions/PEP screening
- **TRM Labs** — On-chain risk assessment

---

## Privacy Considerations (SSS-3 Preview)

SSS-3 adds ZK-proof-based confidential transfers that:
- Hide transfer amounts from public view
- Allow an **auditor key** (regulators) to decrypt amounts on request
- Maintain sanctions compliance via the same Transfer Hook + Blacklist mechanism

This is aligned with the EU digital euro privacy model and the proposed US digital dollar frameworks, which allow privacy from the public but not from regulators.

See [SSS-3.md](./SSS-3.md) for the full specification.

---

## Security Audit Recommendations

Before mainnet deployment, we recommend:

1. **Anchor audit** — Full review of `sss_token` and `transfer_hook`
2. **Economic attack simulation** — Test permanent delegate edge cases
3. **PDA collision analysis** — Verify seed uniqueness across all instructions
4. **Role separation review** — Verify no single role can self-approve
5. **Fuzz testing** — Use Trident to fuzz initialize, mint, and seize instructions

---

## Devnet Proof of Compliance Lifecycle

| Step | Tx | Notes |
|---|---|---|
| 1. Mint tokens | [5MPnYoSo…](https://explorer.solana.com/tx/5MPnYoSo8KzujXiPLoh1b17PQHG47wCdZtp5f2HpFwYFS3TMYVbvWUmnt7uW1vHriU5wWHCTYNCF47LNQZpRe7cV?cluster=devnet) | 1M tokens minted |
| 2. Blacklist | [53hvNeK9…](https://explorer.solana.com/tx/53hvNeK9UQp55hpBhZETaxL9LS4tvnWBM6oo2dSki5qJ9JLkkRJQryJ5Gsky2xGtg7xs8eTDsG4edwfbLg5eZYag?cluster=devnet) | Blacklist PDA created |
| 3. Transfer blocked | [QBZqnmRX…](https://explorer.solana.com/tx/QBZqnmRXVgGD3hs1LNv1dzRcP6Mq49tDriHe36cwtJJmT2QwwRpZxYY1kPWZvKHjAbFuSikZ228vsRQ4nMkTxwL?cluster=devnet) | Hook rejected transfer |
| 4. Seize | [5EoEj7jY…](https://explorer.solana.com/tx/5EoEj7jYSepcwVDZXCVmG9d6kUfsTgcG1yW1LiXeXFRbaojQq1HZbi6buMMmL4jPydiRa3uxJ37QctzkAGgu4H7K?cluster=devnet) | Permanent Delegate used |
| 5. Remove blacklist | [5wuCCF51…](https://explorer.solana.com/tx/5wuCCF51BQtt8rRCBQg4nVwWtKGSJjQm6kj6aLB9bccEZTKKcMmwCBNtX1mLLyrfCPi7hjhq1TFag55maV419WV3?cluster=devnet) | Restored transfer capability |
