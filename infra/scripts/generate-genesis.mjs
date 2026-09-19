/**
 * Generate the IBFT 2.0 genesis, validator keys and static-nodes file.
 *
 * Deterministic on purpose: every developer gets the same validator set, the
 * same enode identities and therefore the same contract addresses, so a
 * runbook can quote an address and still be right a month later.
 *
 * The keys this writes are DEVNET ONLY and are documented as such in
 * infra/README.md. A production network generates its own, one per operator,
 * on that operator's own machine.
 *
 *   node infra/scripts/generate-genesis.mjs
 */

import { createECDH, createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { keccak256, toHex } from 'viem';

const here = dirname(fileURLToPath(import.meta.url));
const besuDir = join(here, '..', 'besu');

const CHAIN_ID = 13137;
const VALIDATOR_COUNT = 4;

/** Derive a deterministic secp256k1 keypair from a fixed label. */
function deriveValidator(label) {
  const privateKey = createHash('sha256').update(label).digest();
  const ecdh = createECDH('secp256k1');
  ecdh.setPrivateKey(privateKey);
  // Uncompressed public key: 0x04 || X || Y. Ethereum drops the 0x04.
  const publicKey = ecdh.getPublicKey().subarray(1);
  const address = `0x${keccak256(publicKey).slice(-40)}`;
  return { privateKey, publicKey, address };
}

// --- minimal RLP, enough for the IBFT extraData ----------------------------

function encodeLength(length, offset) {
  if (length < 56) return Buffer.from([length + offset]);
  const hex = length.toString(16);
  const lengthBuffer = Buffer.from(hex.length % 2 ? `0${hex}` : hex, 'hex');
  return Buffer.concat([Buffer.from([lengthBuffer.length + offset + 55]), lengthBuffer]);
}

function rlp(item) {
  if (Buffer.isBuffer(item)) {
    if (item.length === 1 && item[0] < 0x80) return item;
    return Buffer.concat([encodeLength(item.length, 0x80), item]);
  }
  const payload = Buffer.concat(item.map(rlp));
  return Buffer.concat([encodeLength(payload.length, 0xc0), payload]);
}

// --- build ------------------------------------------------------------------

const validators = Array.from({ length: VALIDATOR_COUNT }, (_, i) =>
  deriveValidator(`civiledger.devnet.validator.${i + 1}`),
);

mkdirSync(join(besuDir, 'keys'), { recursive: true });
validators.forEach((validator, index) => {
  writeFileSync(
    join(besuDir, 'keys', `validator${index + 1}.key`),
    `${toHex(validator.privateKey)}\n`,
  );
});

/**
 * IBFT extraData: RLP([vanity, validators, vote, round, seals]).
 * The validator set in genesis is what makes these four nodes, and only these
 * four, able to seal a block.
 */
const extraData = toHex(
  rlp([
    Buffer.alloc(32),
    validators.map((v) => Buffer.from(v.address.slice(2), 'hex')),
    Buffer.alloc(0),
    Buffer.alloc(0),
    [],
  ]),
);

/**
 * Funded devnet accounts: Anvil's first two, so the same deploy and seed
 * commands work against `anvil` and against Besu without a second code path.
 * Account 0 deploys and administers; account 1 is spare for a second operator.
 */
const DEVNET_BALANCE = '0x21e19e0c9bab2400000';

const genesis = {
  config: {
    chainId: CHAIN_ID,
    berlinBlock: 0,
    londonBlock: 0,
    shanghaiTime: 0,
    cancunTime: 0,
    // Registries hold no value and transfer none. Charging an institution gas
    // to record a revocation would tax doing the right thing; permissioning,
    // not price, is what keeps this chain from being spammed.
    zeroBaseFee: true,
    ibft2: {
      blockperiodseconds: 2,
      epochlength: 30000,
      requesttimeoutseconds: 10,
    },
  },
  nonce: '0x0',
  timestamp: '0x0',
  gasLimit: '0x1fffffffffffff',
  difficulty: '0x1',
  mixHash: '0x63746963616c2062797a616e74696e65206661756c7420746f6c6572616e6365',
  coinbase: '0x0000000000000000000000000000000000000000',
  extraData,
  alloc: {
    f39Fd6e51aad88F6F4ce6aB8827279cffFb92266: { balance: DEVNET_BALANCE },
    '70997970C51812dc3A010C7d01b50e0d17dc79C8': { balance: DEVNET_BALANCE },
  },
};

writeFileSync(join(besuDir, 'genesis.json'), `${JSON.stringify(genesis, null, 2)}\n`);

const staticNodes = validators.map(
  (validator, index) =>
    `enode://${Buffer.from(validator.publicKey).toString('hex')}@besu-validator-${index + 1}:30303`,
);
writeFileSync(join(besuDir, 'static-nodes.json'), `${JSON.stringify(staticNodes, null, 2)}\n`);

console.log(`chainId ${CHAIN_ID}, ${VALIDATOR_COUNT} validators:`);
validators.forEach((validator, index) => {
  console.log(`  validator${index + 1}  ${validator.address}`);
});
console.log('\nwrote besu/genesis.json, besu/static-nodes.json, besu/keys/*.key');
