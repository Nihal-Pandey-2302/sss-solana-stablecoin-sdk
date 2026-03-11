#!/bin/bash
set -e

echo "=========================================="
echo "🚀 Solana Stablecoin Standard Deployer"
echo "=========================================="

echo "[1/4] Building anchor programs..."
anchor build

echo "[2/4] Syncing program IDs across workspace..."
anchor keys sync

echo "[3/4] Building TypeScript SDK & CLI..."
yarn build

echo "[4/4] Deploying to Localnet (ensure solana-test-validator is running)..."
# In a real environment, you would use --provider.cluster devnet or similar
anchor deploy

echo "✅ Deployment Complete! The SSS contracts are live."
echo "You can now run 'sss dashboard' to interact with them via the CLI."
