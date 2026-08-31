const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const requireRole = require("../middleware/role.middleware");
const governanceController = require("../controllers/governance.controller");

router.use(authMiddleware, requireRole("OVERSIGHT"));

router.post("/propose-member", governanceController.proposeMember);
router.post("/approve-member/:organizationId", governanceController.approveMember);
router.get("/audit-log", governanceController.getAuditLog);
router.get("/organizations", governanceController.listOrganizations);
router.get("/pending-members", governanceController.listPendingMembers);

module.exports = router;
