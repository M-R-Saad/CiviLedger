const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const { CredentialType } = require("../models");

// Public-ish read (still requires login) — drives the dynamic issuance form on the frontend.
router.get("/", authMiddleware, async (req, res) => {
  const types = await CredentialType.findAll();
  res.json(types);
});

module.exports = router;
