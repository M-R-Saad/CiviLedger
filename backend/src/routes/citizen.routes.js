const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const requireRole = require("../middleware/role.middleware");
const citizenController = require("../controllers/citizen.controller");

router.use(authMiddleware, requireRole("CITIZEN"));

router.get("/credentials", citizenController.listMyCredentials);
router.get("/credentials/:id", citizenController.getCredentialDetail);
router.post("/presentations", citizenController.createPresentation);
router.get("/audit-history", citizenController.getAuditHistory);
router.get("/stats", citizenController.getCitizenStats);

module.exports = router;
