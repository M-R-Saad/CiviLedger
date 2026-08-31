const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const requireRole = require("../middleware/role.middleware");
const issuerController = require("../controllers/issuer.controller");

router.use(authMiddleware, requireRole("ISSUER_ADMIN"));

router.post("/credentials", issuerController.issueCredential);
router.get("/credentials", issuerController.listIssuedCredentials);
router.post("/credentials/:id/status", issuerController.changeCredentialStatus);

module.exports = router;
