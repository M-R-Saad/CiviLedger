const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const requireRole = require("../middleware/role.middleware");
const verifierController = require("../controllers/verifier.controller");

// Reading / checking a presentation by token is public — the token is the secret.
// Anyone the citizen shares the link with (including the citizen) can see the result.
router.get("/presentations/:token", verifierController.getPresentation);
router.get("/presentations/:token/check", verifierController.checkPresentation);

// Recording an OFFICIAL verification (on-chain receipt + logged event) needs a verifier account.
router.post("/verify", authMiddleware, requireRole("VERIFIER_STAFF"), verifierController.verifyPresentation);
router.get("/stats", authMiddleware, requireRole("VERIFIER_STAFF"), verifierController.getVerifierStats);

module.exports = router;
