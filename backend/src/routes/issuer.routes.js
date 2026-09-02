const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const requireRole = require("../middleware/role.middleware");
const issuerController = require("../controllers/issuer.controller");

router.use(authMiddleware, requireRole("ISSUER_ADMIN"));

router.post("/credentials", issuerController.issueCredential);
router.get("/credentials", issuerController.listIssuedCredentials);
router.get("/credentials/:id", issuerController.getCredentialDetail);
router.post("/credentials/:id/status", issuerController.changeCredentialStatus);
router.get("/stats", issuerController.getIssuerStats);

module.exports = router;
