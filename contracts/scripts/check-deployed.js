// Exit 0 if the contracts named in deployments/localhost.json still have bytecode
// at their stored addresses; exit 1 otherwise (missing file, unreachable chain,
// or a reset chain where the addresses now point at nothing).
//
// Used by deploy/docker-compose.prod.yml's contracts-deploy step so a chain
// restart triggers a redeploy instead of the backend talking to dead addresses.

const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const RPC = process.env.LOCALHOST_RPC_URL || "http://127.0.0.1:8545";
const file =
  process.env.DEPLOYMENTS_FILE ||
  path.join(process.env.DEPLOY_OUT_DIR || path.join(__dirname, "..", "deployments"), "localhost.json");

(async () => {
  try {
    if (!fs.existsSync(file)) process.exit(1);
    const { contracts } = JSON.parse(fs.readFileSync(file, "utf8"));
    const addresses = Object.values(contracts || {});
    if (addresses.length === 0) process.exit(1);

    const provider = new ethers.JsonRpcProvider(RPC);
    for (const address of addresses) {
      const code = await provider.getCode(address);
      if (!code || code === "0x") process.exit(1);
    }
    process.exit(0);
  } catch {
    process.exit(1);
  }
})();
