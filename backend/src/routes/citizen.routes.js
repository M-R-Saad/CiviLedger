const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const requireRole = require("../middleware/role.middleware");
const citizenController = require("../controllers/citizen.controller");

router.use(authMiddleware, requireRole("CITIZEN"));

router.get("/credentials", citizenController.listMyCredentials);
router.post("/presentations", citizenController.createPresentation);
router.get("/audit-history", citizenController.getAuditHistory);

module.exports = router;
