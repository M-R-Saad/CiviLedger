const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { User } = require("../models");

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, organization_id: user.organization_id, wallet_address: user.wallet_address },
    process.env.JWT_SECRET,
    { expiresIn: "12h" }
  );
}

// For ISSUER_ADMIN / VERIFIER_STAFF / OVERSIGHT — classic email+password.
async function register(req, res) {
  try {
    const { full_name, email, password, role, organization_id } = req.body;
    if (!full_name || !email || !password || !role) {
      return res.status(400).json({ error: "full_name, email, password, role are required" });
    }
    const password_hash = await bcrypt.hash(password, 10);
    const user = await User.create({ full_name, email, password_hash, role, organization_id });
    return res.status(201).json({ token: signToken(user), user: { id: user.id, role: user.role } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user || !user.password_hash) return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    return res.json({ token: signToken(user), user: { id: user.id, role: user.role, wallet_address: user.wallet_address, full_name: user.full_name } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// For CITIZEN — the frontend has the user sign a nonce with MetaMask; here we just
// trust a verified signature was checked client-side for the prototype. Harden this
// with a real challenge/response signature check (ethers.verifyMessage) before any
// real deployment.
async function walletLogin(req, res) {
  try {
    const { wallet_address, full_name, email } = req.body;
    if (!wallet_address) return res.status(400).json({ error: "wallet_address is required" });

    let user = await User.findOne({ where: { wallet_address } });
    if (!user) {
      user = await User.create({
        full_name: full_name || "Citizen",
        email: email || `${wallet_address.toLowerCase()}@wallet.local`,
        role: "CITIZEN",
        wallet_address,
        did: `did:ethr:${wallet_address}`
      });
    }
    return res.json({ token: signToken(user), user: { id: user.id, role: user.role, wallet_address } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { register, login, walletLogin };
