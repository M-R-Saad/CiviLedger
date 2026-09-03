const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const { CredentialType } = require("../models");
const { serverError } = require("../utils/http");

// Requires login. Drives the dynamic issuance form.
router.get("/", authMiddleware, async (req, res) => {
  try {
    const types = await CredentialType.findAll();
    res.json(types);
  } catch (err) {
    return serverError(res, "credentialTypes.list", err);
  }
});

module.exports = router;
