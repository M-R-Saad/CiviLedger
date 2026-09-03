const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { ethers } = require("ethers");
const { User } = require("../models");
const { serverError, parseBody } = require("../utils/http");
const S = require("../schemas");

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, organization_id: user.organization_id, wallet_address: user.wallet_address },
    process.env.JWT_SECRET,
    { expiresIn: "12h" }
  );
}

// ── wallet-login challenge nonces ───────────────────────────────────────────
// address(lowercase) -> { nonce, expires }. In-memory is fine for a single
// backend instance; move to a shared store if the API is ever scaled out.
const nonces = new Map();
const NONCE_TTL_MS = 5 * 60 * 1000;

function nonceMessage(address, nonce) {
  return `CiviLedger wallet login\nAddress: ${address}\nNonce: ${nonce}`;
}
function sweepNonces() {
  const now = Date.now();
  for (const [k, v] of nonces) if (v.expires < now) nonces.delete(k);
}

// POST /auth/register — OVERSIGHT only (route-gated). Creates a staff account.
async function register(req, res) {
  const data = parseBody(res, S.register, req.body);
  if (!data) return;
  try {
    const password_hash = await bcrypt.hash(data.password, 10);
    const user = await User.create({
      full_name: data.full_name,
      email: data.email,
      password_hash,
      role: data.role,
      organization_id: data.organization_id || null
    });
    return res.status(201).json({ user: { id: user.id, role: user.role } });
  } catch (err) {
    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ error: "An account with that email already exists." });
    }
    return serverError(res, "auth.register", err);
  }
}

// POST /auth/login — staff email + password.
async function login(req, res) {
  const data = parseBody(res, S.login, req.body);
  if (!data) return;
  try {
    const user = await User.findOne({ where: { email: data.email } });
    if (!user || !user.password_hash) return res.status(401).json({ error: "Invalid credentials." });
    const valid = await bcrypt.compare(data.password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials." });
    return res.json({
      token: signToken(user),
      user: { id: user.id, role: user.role, wallet_address: user.wallet_address, full_name: user.full_name }
    });
  } catch (err) {
    return serverError(res, "auth.login", err);
  }
}

// POST /auth/wallet-nonce { wallet_address } -> { message } for the client to sign.
async function walletNonce(req, res) {
  const data = parseBody(res, S.walletNonce, req.body);
  if (!data) return;
  let address;
  try {
    address = ethers.getAddress(data.wallet_address);
  } catch {
    return res.status(400).json({ error: "Not a valid Ethereum address." });
  }
  sweepNonces();
  const nonce = crypto.randomUUID();
  nonces.set(address.toLowerCase(), { nonce, expires: Date.now() + NONCE_TTL_MS });
  return res.json({ address, message: nonceMessage(address, nonce) });
}

// POST /auth/wallet-login { wallet_address, signature } -> { token, user }.
async function walletLogin(req, res) {
  const data = parseBody(res, S.walletLogin, req.body);
  if (!data) return;

  let address;
  try {
    address = ethers.getAddress(data.wallet_address);
  } catch {
    return res.status(400).json({ error: "Not a valid Ethereum address." });
  }

  const entry = nonces.get(address.toLowerCase());
  if (!entry || entry.expires < Date.now()) {
    nonces.delete(address.toLowerCase());
    return res.status(401).json({ error: "Your login challenge expired. Connect your wallet again." });
  }

  let recovered;
  try {
    recovered = ethers.verifyMessage(nonceMessage(address, entry.nonce), data.signature);
  } catch {
    return res.status(401).json({ error: "That signature could not be verified." });
  }
  if (recovered.toLowerCase() !== address.toLowerCase()) {
    return res.status(401).json({ error: "That signature does not match this wallet." });
  }
  nonces.delete(address.toLowerCase()); // single use

  try {
    let user = await User.findOne({ where: { wallet_address: address } });
    if (!user) {
      user = await User.create({
        full_name: data.full_name || "Citizen",
        email: `${address.toLowerCase()}@wallet.local`,
        role: "CITIZEN",
        wallet_address: address,
        did: `did:ethr:${address}`
      });
    }
    return res.json({
      token: signToken(user),
      user: { id: user.id, role: user.role, wallet_address: address, full_name: user.full_name }
    });
  } catch (err) {
    return serverError(res, "auth.walletLogin", err);
  }
}

module.exports = { register, login, walletNonce, walletLogin };
