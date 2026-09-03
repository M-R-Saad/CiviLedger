const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const requireRole = require("../middleware/role.middleware");
const authController = require("../controllers/auth.controller");

// Staff accounts are created only by an authenticated OVERSIGHT user.
router.post("/register", authMiddleware, requireRole("OVERSIGHT"), authController.register);

router.post("/login", authController.login);

// Citizens: request a nonce, sign it with MetaMask, exchange the signature for a token.
router.post("/wallet-nonce", authController.walletNonce);
router.post("/wallet-login", authController.walletLogin);

module.exports = router;
