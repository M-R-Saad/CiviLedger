const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const requireRole = require("../middleware/role.middleware");
const verifierController = require("../controllers/verifier.controller");

// Reading a presentation by token can be left public-ish (token acts as the secret),
// but verifying/logging the result requires an authenticated verifier account.
router.get("/presentations/:token", verifierController.getPresentation);
router.post("/verify", authMiddleware, requireRole("VERIFIER_STAFF"), verifierController.verifyPresentation);

module.exports = router;
