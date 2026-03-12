#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  Solana Stablecoin Standard — Live Demo Script
#  Run from: solana-stablecoin-standard/
# ─────────────────────────────────────────────────────────────

MINT=ArEHowwekqTPiHQKqQRYaZADifp3Pi54H9v5UDDRVqUZ
ATA=44aDgmY1DQXTnXESzyJFVGco6LPiJwGxufowVXnsVKXG
RPC=https://api.devnet.solana.com
KEY=~/.config/solana/id.json
CLI="npx ts-node packages/cli/src/index.ts"

pause() { echo ""; echo "▶ $1"; echo "─────────────────────────────"; sleep 1; }

# ── 1. Status ─────────────────────────────────────────────────
pause "Token Status (supply, roles, minters)"
$CLI status --mint $MINT -u $RPC -k $KEY

# ── 2. Supply ─────────────────────────────────────────────────
pause "Total Supply"
$CLI supply --mint $MINT -u $RPC -k $KEY

# ── 3. Minters ────────────────────────────────────────────────
pause "Authorized Minters"
$CLI minters list --mint $MINT -u $RPC -k $KEY

# ── 4. Mint ───────────────────────────────────────────────────
pause "Minting 1 token (1,000,000 micro-units)"
$CLI mint --mint $MINT --target $ATA --amount 1000000 -u $RPC -k $KEY

# ── 5. Blacklist ──────────────────────────────────────────────
pause "SSS-2: Blacklisting account (OFAC/sanctions enforcement)"
$CLI blacklist:add --mint $MINT --target $ATA -u $RPC -k $KEY

# ── 6. Seize ─────────────────────────────────────────────────
pause "SSS-2: Seizing tokens via Permanent Delegate (no owner sig!)"
$CLI seize --mint $MINT --target $ATA --amount 500000 -u $RPC -k $KEY

# ── 7. Remove blacklist ───────────────────────────────────────
pause "SSS-2: Clearing blacklist (account rehabilitated)"
$CLI blacklist:remove --mint $MINT --target $ATA -u $RPC -k $KEY

# ── 8. Freeze / Thaw ─────────────────────────────────────────
pause "Freeze account (temporary hold)"
$CLI freeze --mint $MINT --target $ATA -u $RPC -k $KEY

pause "Thaw account (restore access)"
$CLI thaw --mint $MINT --target $ATA -u $RPC -k $KEY

# ── 9. Final status ───────────────────────────────────────────
pause "Final Status Check"
$CLI status --mint $MINT -u $RPC -k $KEY

echo ""
echo "✅ Demo complete! All SSS-2 operations verified on Devnet."
echo "   Dashboard: https://sss-solana-stablecoin-elhakuovd-nihals-projects-7da31bb2.vercel.app/"
