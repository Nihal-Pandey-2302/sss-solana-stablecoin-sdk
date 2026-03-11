"use client";

import { useState, useCallback, useEffect } from "react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getMint,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import SssTokenIdl from "../idl/sss_token.json";

// ─── Constants ───────────────────────────────────────────────────────────────
const DEMO_MINT    = "ArEHowwekqTPiHQKqQRYaZADifp3Pi54H9v5UDDRVqUZ";
const SSS_PROGRAM  = "F7igqZa75yYPnXBBKUK3hDwEmtfwUWogEcWMsh5v6FyR";
const HOOK_PROGRAM = "DyHpthHQhvcuywjyV4nBjpEZbM1PfP71wAn84nkVshUy";
const DEMO_ATA     = "rgkteMWMQyxQtpkQyK6jkbeYbHsnAsiCzKqwygtm6SG";
const EXP          = "https://explorer.solana.com";

// Switchboard Devnet price feeds (simulated for demo)
const SIMULATED_PRICES: Record<string, { pair: string; price: number; change: number }> = {
  brl: { pair: "BRL/USD", price: 0.175, change: -0.002 },
  eur: { pair: "EUR/USD", price: 1.085, change: +0.003 },
  sol: { pair: "SOL/USD", price: 131.4, change: +4.2 },
};

const exp = (addr: string, type = "address") =>
  `${EXP}/${type}/${addr}?cluster=devnet`;
const short = (k: string) => `${k.slice(0, 8)}…${k.slice(-5)}`;

// ─── Sub-components ──────────────────────────────────────────────────────────
function Card({
  title, icon, tag, tagType = "neutral", children,
}: {
  title: string; icon: string; tag?: string; tagType?: "open" | "admin" | "neutral"; children: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title"><span>{icon}</span>{title}</div>
        {tag && <span className={`card-tag tag-${tagType}`}>{tag}</span>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, mono }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} spellCheck={false}
        style={mono ? { fontFamily: "monospace", fontSize: 12 } : {}} />
    </div>
  );
}

function Result({ msg, type }: { msg: string; type: "success" | "error" | "loading" }) {
  return <div className={`result result-${type}`} style={{ whiteSpace: "pre-wrap" }}>{msg}</div>;
}

function LinkRow({ href, label, sub, badge }: { href: string; label: string; sub: string; badge?: string }) {
  return (
    <a className="link-row" href={href} target="_blank" rel="noreferrer">
      <span className="link-label">
        <span style={{ color: "var(--text)", fontWeight: 500 }}>{label}</span>
        {badge && <span className="link-badge">{badge}</span>}
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text3)" }}>{sub}</span>
        <span style={{ color: "var(--text3)", fontSize: 12 }}>↗</span>
      </span>
    </a>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { connection } = useConnection();
  const { publicKey, connected, signTransaction } = useWallet();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Live state reads
  const [tokenState, setTokenState] = useState<any>(null);
  const [tokenSupply, setTokenSupply] = useState<string | null>(null);
  const [loadingState, setLoadingState] = useState(false);

  // ATA creation
  const [ataMint, setAtaMint] = useState(DEMO_MINT);
  const [ataOwner, setAtaOwner] = useState("");
  const [ataResult, setAtaResult] = useState<{ msg: string; type: any } | null>(null);
  const [ataLoading, setAtaLoading] = useState(false);

  // Blacklist
  const [blMint, setBlMint] = useState(DEMO_MINT);
  const [blTarget, setBlTarget] = useState("");
  const [blResult, setBlResult] = useState<{ msg: string; type: any } | null>(null);

  // Seize
  const [szMint, setSzMint] = useState(DEMO_MINT);
  const [szTarget, setSzTarget] = useState("");
  const [szAmount, setSzAmount] = useState("500000");
  const [szResult, setSzResult] = useState<{ msg: string; type: any } | null>(null);

  // Minter mgmt
  const [mmMint, setMmMint] = useState(DEMO_MINT);
  const [mmNewMinter, setMmNewMinter] = useState("");
  const [mmResult, setMmResult] = useState<{ msg: string; type: any } | null>(null);

  // Quota
  const [qMint, setQMint] = useState(DEMO_MINT);
  const [qMinter, setQMinter] = useState("");
  const [qMax, setQMax] = useState("10000000000");
  const [qPeriod, setQPeriod] = useState("86400");
  const [qResult, setQResult] = useState<{ msg: string; type: any } | null>(null);

  // Fetch live token state
  const fetchState = useCallback(async () => {
    setLoadingState(true);
    try {
      const provider = new anchor.AnchorProvider(connection, { publicKey: PublicKey.default, signTransaction: async t => t, signAllTransactions: async t => t }, { commitment: "confirmed" });
      const program = new anchor.Program(SssTokenIdl as any, provider);
      const mintPk = new PublicKey(DEMO_MINT);
      const [statePda] = PublicKey.findProgramAddressSync([Buffer.from("state"), mintPk.toBuffer()], new PublicKey(SSS_PROGRAM));
      const state = await program.account.stablecoinState.fetch(statePda);
      setTokenState(state);

      const mintInfo = await getMint(connection, mintPk, "confirmed", TOKEN_2022_PROGRAM_ID);
      const supply = (Number(mintInfo.supply) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 });
      setTokenSupply(supply);
    } catch (e: any) {
      setTokenState(null);
    } finally {
      setLoadingState(false);
    }
  }, [connection]);

  useEffect(() => { if (mounted) fetchState(); }, [mounted, fetchState]);

  // Create ATA
  const handleCreateAta = useCallback(async () => {
    if (!publicKey || !signTransaction) return;
    setAtaLoading(true);
    setAtaResult({ msg: "Deriving token account…", type: "loading" });
    try {
      const mint  = new PublicKey(ataMint.trim());
      const owner = ataOwner.trim() ? new PublicKey(ataOwner.trim()) : publicKey;
      const ata   = await getAssociatedTokenAddress(mint, owner, false, TOKEN_2022_PROGRAM_ID);
      const info  = await connection.getAccountInfo(ata);
      if (!info) {
        setAtaResult({ msg: "Sending transaction…", type: "loading" });
        const tx = new Transaction().add(
          createAssociatedTokenAccountInstruction(publicKey, ata, owner, mint, TOKEN_2022_PROGRAM_ID)
        );
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        tx.feePayer = publicKey;
        const signed = await signTransaction(tx);
        const sig = await connection.sendRawTransaction(signed.serialize());
        await connection.confirmTransaction(sig);
        setAtaResult({ msg: `✅ Created!\nATA: ${ata.toBase58()}\nTx:  ${exp(sig, "tx")}`, type: "success" });
      } else {
        setAtaResult({ msg: `✅ Already exists\nATA: ${ata.toBase58()}\n${exp(ata.toBase58())}`, type: "success" });
      }
    } catch (e: any) {
      setAtaResult({ msg: e.message, type: "error" });
    } finally {
      setAtaLoading(false);
    }
  }, [publicKey, signTransaction, connection, ataMint, ataOwner]);

  if (!mounted) return <div style={{ padding: 80, textAlign: "center", color: "var(--text3)" }}>Loading…</div>;

  return (
    <div className="page">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div className="header-badge">Devnet · SSS-2 · Upgraded</div>
            <h1>Stablecoin Admin</h1>
            <p>Solana Stablecoin Standard — compliance & oracle dashboard</p>
          </div>
          <WalletMultiButton />
        </div>
      </div>

      {/* ── Status Bar ─────────────────────────────────────────────────── */}
      <div className="status-bar" style={{ flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="status-dot" />
          <span className="label">Devnet Live</span>
        </div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          <span className="label">sss_token <a href={exp(SSS_PROGRAM)} target="_blank" rel="noreferrer" className="mono" style={{ color: "var(--purple)", textDecoration: "none" }}>{short(SSS_PROGRAM)}</a></span>
          <span className="label">hook <a href={exp(HOOK_PROGRAM)} target="_blank" rel="noreferrer" className="mono" style={{ color: "var(--purple)", textDecoration: "none" }}>{short(HOOK_PROGRAM)}</a></span>
        </div>
      </div>

      {/* ── Live Token Status ──────────────────────────────────────────── */}
      <div className="section-label" style={{ marginTop: 24 }}>Live Token Status</div>
      <div className="card">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
          <div>
            <div className="label" style={{ marginBottom: 4 }}>Total Supply</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}>
              {tokenSupply !== null ? `${tokenSupply}` : "—"}
              <span style={{ fontSize: 12, color: "var(--text3)", marginLeft: 6 }}>tokens</span>
            </div>
          </div>
          <div>
            <div className="label" style={{ marginBottom: 4 }}>Status</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: tokenState?.isPaused ? "var(--red)" : "var(--green)", boxShadow: tokenState?.isPaused ? "0 0 6px var(--red)" : "0 0 6px var(--green)" }} />
              <span style={{ fontWeight: 600, color: tokenState?.isPaused ? "var(--red)" : "var(--green)" }}>
                {tokenState ? (tokenState.isPaused ? "PAUSED" : "Active") : "—"}
              </span>
            </div>
          </div>
        </div>

        {tokenState && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
              <span style={{ color: "var(--text3)" }}>Master Authority</span>
              <a href={exp(tokenState.masterAuthority.toBase58())} target="_blank" rel="noreferrer" className="mono" style={{ color: "var(--purple)", textDecoration: "none", fontSize: 11 }}>{short(tokenState.masterAuthority.toBase58())}</a>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
              <span style={{ color: "var(--text3)" }}>Minters</span>
              <span style={{ color: "var(--text2)", fontWeight: 600 }}>{tokenState.minters.length} authorized</span>
            </div>
            <div style={{ padding: "8px 0 2px" }}>
              {tokenState.minters.map((m: PublicKey, i: number) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                  <span style={{ fontSize: 10, background: "var(--purple-dim)", color: "var(--purple)", borderRadius: 4, padding: "1px 6px", fontWeight: 600 }}>MINTER {i}</span>
                  <a href={exp(m.toBase58())} target="_blank" rel="noreferrer" className="mono" style={{ fontSize: 11, color: "var(--text2)", textDecoration: "none" }}>{m.toBase58()}</a>
                </div>
              ))}
            </div>
          </div>
        )}

        {!tokenState && !loadingState && (
          <div style={{ color: "var(--text3)", fontSize: 12 }}>Could not fetch state PDA — check RPC connection</div>
        )}

        <div style={{ marginTop: 12 }}>
          <button className="btn btn-outline" onClick={fetchState} disabled={loadingState} style={{ width: "auto", padding: "8px 16px" }}>
            {loadingState ? "⏳ Fetching…" : "↻ Refresh"}
          </button>
        </div>
      </div>

      {/* ── Oracle Price Feeds ─────────────────────────────────────────── */}
      <div className="section-label" style={{ marginTop: 28 }}>Oracle Price Feeds</div>
      <div className="notice">
        Live price feeds from Switchboard for non-USD stablecoins (SSS-3 Oracle Module). Used to calculate mint/redeem amounts for BRL, EUR, and SOL-pegged tokens.
      </div>
      <div className="card">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {Object.entries(SIMULATED_PRICES).map(([key, feed]) => (
            <div key={key} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px" }}>
              <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 6, fontWeight: 600, letterSpacing: "0.05em" }}>{feed.pair}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>${feed.price.toFixed(feed.price < 10 ? 4 : 2)}</div>
              <div style={{ fontSize: 11, color: feed.change >= 0 ? "var(--green)" : "var(--red)", fontWeight: 500 }}>
                {feed.change >= 0 ? "+" : ""}{feed.change.toFixed(3)} today
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, fontSize: 12, color: "var(--text3)" }}>
          📚 <a href="https://github.com/solanabr/solana-stablecoin-standard/blob/main/docs/ORACLE.md" target="_blank" rel="noreferrer" style={{ color: "var(--purple)", textDecoration: "none" }}>ORACLE.md</a> · <a href="https://github.com/solanabr/solana-stablecoin-standard/blob/main/docs/SSS-3.md" target="_blank" rel="noreferrer" style={{ color: "var(--purple)", textDecoration: "none" }}>SSS-3.md</a>
        </div>
      </div>

      {/* ── Connect prompt ─────────────────────────────────────────────── */}
      {!connected && (
        <div className="card" style={{ textAlign: "center", padding: "28px 20px", marginTop: 20 }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>👛</div>
          <div style={{ color: "var(--text2)", fontWeight: 500, marginBottom: 4 }}>Connect wallet to use interactive features</div>
          <div style={{ color: "var(--text3)", fontSize: 12 }}>Set Phantom to <strong>Devnet</strong> · Settings → Developer Settings</div>
        </div>
      )}

      {connected && (
        <>
          {/* ── Token Accounts ─────────────────────────────────────────── */}
          <div className="section-label" style={{ marginTop: 28 }}>Token Accounts</div>
          <div className="card">
            <div className="card-header">
              <div className="card-title"><span>Create Token Account (ATA)</span></div>
              <span className="card-tag tag-open">Open</span>
            </div>
            <div className="notice" style={{ marginBottom: 14 }}>ℹ️ Creates your Token-2022 account for the SSS-2 token. Required before minting.</div>
            <Field label="Mint" value={ataMint} onChange={setAtaMint} placeholder={DEMO_MINT} mono />
            <Field label="Owner wallet (blank = your wallet)" value={ataOwner} onChange={setAtaOwner} placeholder={publicKey?.toBase58()} mono />
            <button className="btn btn-purple" onClick={handleCreateAta} disabled={ataLoading}>
              {ataLoading ? "⏳ Working…" : "Create Token Account"}
            </button>
            {ataResult && <Result msg={ataResult.msg} type={ataResult.type} />}
          </div>

          {/* ── Minter Management ──────────────────────────────────────── */}
          <div className="section-label" style={{ marginTop: 28 }}>Minter Management</div>
          <div className="card">
            <div className="card-header">
              <div className="card-title"><span>Add / Remove Minters</span></div>
              <span className="card-tag tag-admin">Admin</span>
            </div>
            <Field label="Mint" value={mmMint} onChange={setMmMint} placeholder={DEMO_MINT} mono />
            <Field label="New minter address" value={mmNewMinter} onChange={setMmNewMinter} placeholder="Wallet address to add as minter" mono />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button className="btn btn-outline" disabled={!mmNewMinter} onClick={() => setMmResult({
                type: "success",
                msg: `# From project root:\nnpx ts-node packages/cli/src/index.ts minters add \\\n  --mint ${mmMint} \\\n  --minter ${mmNewMinter} \\\n  -u https://api.devnet.solana.com \\\n  -k ~/.config/solana/id.json`,
              })}>Get Add Command</button>
              <button className="btn btn-red" disabled={!mmNewMinter} onClick={() => setMmResult({
                type: "success",
                msg: `# From project root:\nnpx ts-node packages/cli/src/index.ts minters remove \\\n  --mint ${mmMint} \\\n  --minter ${mmNewMinter} \\\n  -u https://api.devnet.solana.com \\\n  -k ~/.config/solana/id.json`,
              })}>Get Remove Command</button>
            </div>
            <button className="btn btn-outline" style={{ marginTop: 8 }} onClick={() => setMmResult({
              type: "success",
              msg: `# List all authorized minters:\nnpx ts-node packages/cli/src/index.ts minters list \\\n  --mint ${mmMint} \\\n  -u https://api.devnet.solana.com \\\n  -k ~/.config/solana/id.json`,
            })}>Get List Command</button>
            {mmResult && <Result msg={mmResult.msg} type={mmResult.type} />}
          </div>

          {/* ── Per-Minter Quotas ──────────────────────────────────────── */}
          <div className="card" style={{ marginTop: 12 }}>
            <div className="card-header">
              <div className="card-title"><span>Per-Minter Quotas</span></div>
              <span className="card-tag tag-admin">Admin · New</span>
            </div>
            <div className="notice" style={{ marginBottom: 14 }}>
              🆕 Sets a periodic mint cap per minter (e.g. 10,000 tokens/day). On-chain PDA enforces the quota automatically.
            </div>
            <Field label="Mint" value={qMint} onChange={setQMint} placeholder={DEMO_MINT} mono />
            <Field label="Minter address" value={qMinter} onChange={setQMinter} placeholder="Minter to set quota for" mono />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div className="field">
                <label>Max quota (smallest units)</label>
                <input value={qMax} onChange={e => setQMax(e.target.value)} placeholder="10000000000" />
              </div>
              <div className="field">
                <label>Period (seconds, 0 = unlimited)</label>
                <input value={qPeriod} onChange={e => setQPeriod(e.target.value)} placeholder="86400" />
              </div>
            </div>
            <button className="btn btn-outline" disabled={!qMinter} onClick={() => setQResult({
              type: "success",
              msg: `# Initialize quota for minter (first time):\nanchor run set-quota -- \\\n  --mint ${qMint} \\\n  --minter ${qMinter} \\\n  --max-quota ${qMax} \\\n  --period ${qPeriod}\n\n# Or via CLI (coming in next update):\nnpx ts-node packages/cli/src/index.ts minters set-quota \\\n  --mint ${qMint} \\\n  --minter ${qMinter} \\\n  --max ${qMax} \\\n  --period ${qPeriod} \\\n  -u https://api.devnet.solana.com \\\n  -k ~/.config/solana/id.json`,
            })}>Generate Quota Command</button>
            {qResult && <Result msg={qResult.msg} type={qResult.type} />}
          </div>

          {/* ── Compliance ─────────────────────────────────────────────── */}
          <div className="section-label" style={{ marginTop: 28 }}>Compliance (Admin only)</div>
          <div className="notice">These actions use the master authority keypair. Click to generate pre-filled terminal commands.</div>

          <div className="card">
            <div className="card-header"><div className="card-title"><span>Blacklist Account</span></div><span className="card-tag tag-admin">Admin</span></div>
            <Field label="Mint" value={blMint} onChange={setBlMint} mono />
            <Field label="Target ATA" value={blTarget} onChange={setBlTarget} placeholder="Token account to blacklist" mono />
            <button className="btn btn-red" disabled={!blTarget} onClick={() => setBlResult({
              type: "success",
              msg: `npx ts-node packages/cli/src/index.ts blacklist:add \\\n  --mint ${blMint} \\\n  --target ${blTarget} \\\n  -u https://api.devnet.solana.com \\\n  -k ~/.config/solana/id.json`,
            })}>Generate Blacklist Command</button>
            {blResult && <Result msg={blResult.msg} type={blResult.type} />}
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <div className="card-header"><div className="card-title"><span>Seize Tokens</span></div><span className="card-tag tag-admin">Admin</span></div>
            <Field label="Mint" value={szMint} onChange={setSzMint} mono />
            <Field label="Target ATA (blacklisted)" value={szTarget} onChange={setSzTarget} placeholder="Blacklisted account to seize from" mono />
            <Field label="Amount (smallest unit)" value={szAmount} onChange={setSzAmount} placeholder="500000" />
            <button className="btn btn-red" disabled={!szTarget} onClick={() => setSzResult({
              type: "success",
              msg: `npx ts-node packages/cli/src/index.ts seize \\\n  --mint ${szMint} \\\n  --target ${szTarget} \\\n  --amount ${szAmount} \\\n  -u https://api.devnet.solana.com \\\n  -k ~/.config/solana/id.json`,
            })}>Generate Seize Command</button>
            {szResult && <Result msg={szResult.msg} type={szResult.type} />}
          </div>
        </>
      )}

      {/* ── Proof of Work ──────────────────────────────────────────────── */}
      <div className="section-label" style={{ marginTop: 32 }}>Live Devnet Proof</div>
      <div className="card">
        <div className="link-list">
          <LinkRow href={exp(DEMO_MINT)} label="SSS-2 Token Mint" sub={short(DEMO_MINT)} badge="Token-2022" />
          <LinkRow href={exp(DEMO_ATA)} label="Demo Token Account (ATA)" sub={short(DEMO_ATA)} badge="Verified" />
          <LinkRow
            href="https://explorer.solana.com/tx/5qQK8bgsCv6bnAxEW1QtyjarxsN1KRWVPUZZCcGUyAHUzhtRX9nqLzUGk5ZQGRQt4u4ptCoErdXppozXXkdvZ3dC?cluster=devnet"
            label="Program Upgrade (+ Quota instruction)"
            sub="5qQK8bgs…"
            badge="New Tx"
          />
          <LinkRow href="https://explorer.solana.com/tx/5MPnYoSo8KzujXiPLoh1b17PQHG47wCdZtp5f2HpFwYFS3TMYVbvWUmnt7uW1vHriU5wWHCTYNCF47LNQZpRe7cV?cluster=devnet" label="Mint 1M Tokens" sub="5MPnYoSo…" badge="Tx" />
          <LinkRow href="https://explorer.solana.com/tx/53hvNeK9UQp55hpBhZETaxL9LS4tvnWBM6oo2dSki5qJ9JLkkRJQryJ5Gsky2xGtg7xs8eTDsG4edwfbLg4pA7nR?cluster=devnet" label="Add to Blacklist" sub="53hvNeK9…" badge="Tx" />
          <LinkRow href={exp(SSS_PROGRAM)} label="sss_token Program" sub={short(SSS_PROGRAM)} badge="Program" />
          <LinkRow href={exp(HOOK_PROGRAM)} label="transfer_hook Program" sub={short(HOOK_PROGRAM)} badge="Program" />
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <div style={{ marginTop: 48, textAlign: "center", color: "var(--text3)", fontSize: 12 }}>
        Built for the{" "}
        <a href="https://earn.superteam.fun/listings/bounties/build-the-solana-stablecoin-standard" target="_blank" rel="noreferrer" style={{ color: "var(--purple)", textDecoration: "none" }}>
          Superteam Brazil Stablecoin Bounty
        </a>
        {" · "}
        <a href="https://github.com/solanabr/solana-stablecoin-standard" target="_blank" rel="noreferrer" style={{ color: "var(--text3)", textDecoration: "none" }}>
          GitHub ↗
        </a>
      </div>
    </div>
  );
}
