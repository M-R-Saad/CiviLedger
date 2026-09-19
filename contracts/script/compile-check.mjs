/**
 * Compile the contracts with solc-js and report errors.
 *
 * `forge build` is the real build (see foundry.toml). This exists so the
 * contracts can still be type-checked on a machine without the Foundry
 * toolchain installed — CI and anyone reviewing a PR from a laptop.
 *
 * It also enforces two PLAN.html invariants that are easy to break by accident
 * and expensive to discover later:
 *   - no ERC-20/721/1155 value semantics anywhere (§11, §26)
 *   - no `string` in an event parameter, where PII would be hardest to spot (§11)
 *
 * Usage: node script/compile-check.mjs [--write-abi <dir>]
 */

import solc from 'solc';
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'src');
const nodeModules = join(root, 'node_modules');

const sources = {};
for (const file of readdirSync(srcDir).filter((f) => f.endsWith('.sol'))) {
  sources[`src/${file}`] = { content: readFileSync(join(srcDir, file), 'utf8') };
}

/** Resolve `@openzeppelin/...` imports out of node_modules. */
function findImport(path) {
  const candidates = [join(nodeModules, path), join(root, path), join(root, 'lib', path)];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return { contents: readFileSync(candidate, 'utf8') };
  }
  return { error: `not found: ${path}` };
}

const input = {
  language: 'Solidity',
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: 'cancun',
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImport }));

const errors = (output.errors ?? []).filter((e) => e.severity === 'error');
const warnings = (output.errors ?? []).filter((e) => e.severity === 'warning');

for (const warning of warnings) {
  console.warn(`warning: ${warning.formattedMessage.trim()}`);
}
if (errors.length > 0) {
  for (const error of errors) console.error(error.formattedMessage);
  console.error(`\n${errors.length} compile error(s).`);
  process.exit(1);
}

// --- invariant checks -------------------------------------------------------

const FORBIDDEN_FUNCTIONS = new Set([
  'transfer',
  'transferFrom',
  'safeTransferFrom',
  'approve',
  'mint',
  'burn',
  'setApprovalForAll',
]);

const violations = [];
const contracts = [];

for (const [file, defs] of Object.entries(output.contracts ?? {})) {
  for (const [name, def] of Object.entries(defs)) {
    const size = (def.evm?.deployedBytecode?.object?.length ?? 0) / 2;
    contracts.push({ file, name, size });

    for (const entry of def.abi ?? []) {
      if (entry.type === 'function' && FORBIDDEN_FUNCTIONS.has(entry.name)) {
        violations.push(`${name}.${entry.name}() — credentials are not assets (PLAN §11, §26)`);
      }
      if (entry.type === 'event') {
        for (const input of entry.inputs ?? []) {
          if (input.type === 'string') {
            violations.push(
              `${name}.${entry.name} emits string "${input.name}" — no PII in events (PLAN §11)`,
            );
          }
        }
      }
    }
  }
}

console.log('\ncompiled:');
for (const c of contracts.sort((a, b) => a.name.localeCompare(b.name))) {
  const overLimit = c.size > 24_576 ? '  ** OVER 24KB EIP-170 LIMIT **' : '';
  console.log(`  ${c.name.padEnd(20)} ${String(c.size).padStart(6)} bytes${overLimit}`);
}

if (violations.length > 0) {
  console.error('\ninvariant violations:');
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}

const abiDirFlag = process.argv.indexOf('--write-abi');
if (abiDirFlag !== -1) {
  const outDir = resolve(process.argv[abiDirFlag + 1] ?? join(root, 'abi'));
  mkdirSync(outDir, { recursive: true });
  for (const defs of Object.values(output.contracts ?? {})) {
    for (const [name, def] of Object.entries(defs)) {
      writeFileSync(join(outDir, `${name}.json`), `${JSON.stringify(def.abi, null, 2)}\n`);
    }
  }
  console.log(`\nABIs written to ${outDir}`);
}

console.log('\nOK — compiles clean, no forbidden value semantics, no strings in events.');
