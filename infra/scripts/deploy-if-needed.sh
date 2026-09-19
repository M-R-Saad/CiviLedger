#!/bin/sh
# Deploy the registries unless they are already live at the recorded addresses.
#
# The address book lives on a shared volume the API and worker read. Checking
# for deployed bytecode rather than for the file alone means a wiped chain
# triggers a redeploy instead of leaving every service pointing at nothing.
set -eu

CHAIN_ID=$(cast chain-id --rpc-url "$RPC_URL")
OUT="/out/${CHAIN_ID}.json"

if [ -f "$OUT" ]; then
  REGISTRY=$(sed -n 's/.*"IssuerRegistry": *"\([^"]*\)".*/\1/p' "$OUT")
  if [ -n "$REGISTRY" ]; then
    CODE=$(cast code "$REGISTRY" --rpc-url "$RPC_URL" 2>/dev/null || echo 0x)
    if [ "$CODE" != "0x" ] && [ -n "$CODE" ]; then
      echo "contracts already deployed at $REGISTRY on chain $CHAIN_ID"
      exit 0
    fi
    echo "address book exists but the chain has no code there; redeploying"
  fi
fi

echo "deploying registries to chain $CHAIN_ID"
forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --sig "run(address,bytes32)" "$ADMIN_ADDRESS" "$ADMIN_ORG_ID" \
  --private-key "$DEPLOYER_PRIVATE_KEY"

cp "deployments/${CHAIN_ID}.json" "$OUT"
echo "address book written to $OUT"
cat "$OUT"
